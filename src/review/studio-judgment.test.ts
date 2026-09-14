import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fictionNeedsYou, signalsNeedsYou } from './studio-judgment.js';
import { listFictionSeries, readSceneBeats, readFictionChapter, saveSceneBeats } from './fiction.js';
import { createIdea, listIdeas } from '../fiction/idea-inbox.js';

test('Fiction real stores: pending ideas and owned scene, resolved state, corrupt and missing stores', () => {
  const root = mkdtempSync(join(tmpdir(), 'judgment-'));
  try {
    const stories = join(root, 'stories'), inbox = join(root, 'inbox'), beats = join(root, 'beats');
    mkdirSync(join(stories, 'example', 'chapters'), { recursive: true });
    writeFileSync(join(stories, 'example', 'bible.md'), '# Example');
    const chapter = join(stories, 'example', 'chapters', 'chapter-01.md');
    writeFileSync(chapter, '---\nstatus: drafting\n---\nScene');
    saveSceneBeats('example', 'My beats', 1, beats);
    createIdea('example', 'My idea', { storageRoot: inbox, storiesRoot: stories });
    const readers = { listFictionSeries: () => listFictionSeries(stories), listIdeas: (s: string) => listIdeas(s, inbox, true), readSceneBeats: (s: string) => readSceneBeats(s, beats, true), readFictionChapter: (s: string, n: number) => readFictionChapter(s, n, stories) };
    assert.deepEqual(fictionNeedsYou(readers).map(r => [r.series, r.page]), [['example', 'inbox'], ['example', 'review']]);
    writeFileSync(chapter, '---\nstatus: locked\n---\nScene');
    writeFileSync(join(inbox, 'example', 'ideas.json'), '[]');
    assert.deepEqual(fictionNeedsYou(readers), []);
    rmSync(chapter);
    const missing = fictionNeedsYou(readers);
    assert.equal(missing[0].page, 'write');
    assert.equal(missing[0].action, 'Open direction');
    assert.match(missing[0].detail, /Chapter 1 is missing/);
    writeFileSync(join(inbox, 'example', 'ideas.json'), 'broken');
    assert.match(fictionNeedsYou(readers)[0].detail, /inbox unavailable/);
    assert.equal(readSceneBeats('example', inbox, true), null);
    writeFileSync(join(beats, 'example.json'), 'broken');
    assert.match(fictionNeedsYou(readers)[1].detail, /scene review state unavailable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Signals filters decided work and brands; one failed store retains other reminders', () => {
  const readers = {
    readSignals: () => ({ recommendations: [{ type: 'TEST', title: 'Try this' }] }),
    readSignalsDecisions: () => ({ 'charles:TEST:Try this': { decision: 'decline' } }),
    readSignalsProposals: () => [{ brandId: 'fiction', status: 'pending' }, { brandId: 'fiction', status: 'applied' }],
    readExperimentPlans: () => [{ brandId: 'charles', status: 'proposed' }, { brandId: 'fiction', status: 'declined' }],
    readExperimentInterpretations: () => [], readSignalsVentureProposals: () => [{ status: 'pending' }, { status: 'accepted' }],
  } as unknown as NonNullable<Parameters<typeof signalsNeedsYou>[0]>;
  const rows = signalsNeedsYou(readers);
  assert.equal(rows.length, 4);
  assert.equal(rows.find(r => r.brand === 'charles')?.detail, '1 experiment plans');
  assert.match(rows.find(r => r.brand === 'fiction')!.detail, /1 configuration reviews/);
  readers.readExperimentInterpretations = () => { throw new Error('unavailable'); };
  const degraded = signalsNeedsYou(readers);
  assert.equal(degraded.filter(r => r.urgent).length, 3);
  assert.equal(degraded.filter(r => !r.urgent).length, 4);
});
