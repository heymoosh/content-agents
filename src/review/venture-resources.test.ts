import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { contentConversionContext, authorizeReaderAction } from './content-conversions.js';
import { ventureConversionsHtml } from './page-conversions.js';
import { ventureResources } from './venture-resources.js';

test('Venture discovers and deduplicates linked resources without crossing ownership or promoting unfinished assets', () => {
  const root = mkdtempSync(join(tmpdir(), 'reader-resources-'));
  const previous = process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = join(root, 'venture');
  mkdirSync(join(root, 'venture', 'demo'), { recursive: true });
  const piece = (id: string, ventureId: string, body: string, origin = 'human-inference') => {
    const folder = join(root, 'content', id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'content-request.json'), JSON.stringify({ id, ventureId, origin }));
    writeFileSync(join(folder, 'source.md'), '---\ntitle: '+id+'\n---\n'+body);
    return folder;
  };
  try {
    const folder = piece('one', 'demo', '[Full essay](https://example.org/essays/hope) and [Tool](https://example.org/tool)');
    piece('two', 'demo', '[Same essay](https://example.org/essays/hope)');
    piece('foreign', 'other', '[Private venture](https://example.org/foreign)');
    piece('persona', 'demo', '[Persona](https://example.org/persona)', 'charles');
    const context = contentConversionContext(folder);
    assert.equal(context.destinations.length, 2, 'existing content links should populate the resource list');
    const essay = context.destinations.find(d => d.url === 'https://example.org/essays/hope')!;
    assert.equal(essay.status, 'linked', 'a source link is not verified live');
    assert.equal(context.intended?.destinationId, essay.id, 'a single full-essay link is the existing next step');
    assert.equal((essay as any).usedBy.length, 2);
    assert.throws(() => authorizeReaderAction(folder, {mode:'destination', destinationId:essay.id, reviewed:false}, {} as any), /Review/);
    const action = authorizeReaderAction(folder, {mode:'destination', destinationId:essay.id, reviewed:true, reason:'Continue reading'}, {} as any);
    assert.equal(action?.mode, 'destination');
    assert.equal(existsSync(join(root, 'venture', 'demo', 'conversions.json')), false, 'discovery does not create another source of truth');
    const render = new Function('return (' + ventureConversionsHtml.toString() + ')')();
    const html = render({plan:{goal:'', destinations:[], assignments:[]}, ...ventureResources('demo', join(root,'content'))}, String);
    assert.match(html, /Full essay/);
    assert.match(html, /Referenced by/);
    assert.doesNotMatch(html, /data-conversion-assignment/);
    writeFileSync(join(root, 'venture', 'demo', 'decisions.jsonl'), JSON.stringify({decision_id:'concepts', decision_kind:'lead-magnet-concept', status:'selected', selected_candidate_ids:['guide'], candidates:[{candidate_id:'guide',label:'Practical guide',rationale:'Help readers act'}]})+'\n');
    assert.equal(contentConversionContext(folder).destinations.find(d=>d.name==='Practical guide')?.status, 'proposed');
    writeFileSync(join(root, 'venture', 'demo', 'artifacts.jsonl'), JSON.stringify({ artifact_id: 'magnet', artifact_kind: 'lead-magnet', title: 'Tool', editorial_status: 'pending', delivery_status: 'not_started', evidence: { type: 'url', value: 'https://example.org/tool' } })+'\n');
    const updated = contentConversionContext(folder);
    assert.equal(updated.destinations.some(d=>d.name==='Practical guide'), false, 'artifact lifecycle replaces the concept placeholder');
    assert.equal(updated.destinations.filter(d => d.url === 'https://example.org/tool').length, 1);
    assert.equal(updated.destinations.find(d => d.url === 'https://example.org/tool')?.status, 'building');
    writeFileSync(join(folder, 'source.md'), '[Changed essay](https://example.org/essays/new)');
    assert.equal(contentConversionContext(folder).intended?.destinationId === essay.id, false, 'source edits are read afresh');
  } finally {
    if (previous === undefined) delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
    else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
