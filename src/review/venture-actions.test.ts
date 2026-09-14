import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { queueExistingSeries, selectedPosts, readSeriesProgress, readVentureSeries, saveWebsiteMeasurement, readWebsiteMeasurement } from './venture-actions.js';
import { createArtifact } from '../venture/artifacts.js';
import { reviewResearchPlan } from '../venture/phase1.js';
import { loadRules } from '../venture/rules.js';
import { readContentRequest, authorizeGuiContentRequest } from './content-request-store.js';
import { resolveConfiguredProvenance } from './jobs.js';
import { nextVentureAction } from './venture-thread.js';
import { renderPage } from './page.js';
import { ventureActionsHtml, ventureSeriesSignalsHtml } from './page-venture-actions.js';

test('selected existing sources queue once, preserve exact content and owner gates, and match only scoped whole text',async()=>{
  const root=mkdtempSync(join(tmpdir(),'venture-actions-'));
  const before=process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=join(root,'venture');
  mkdirSync(join(root,'venture','fixture'),{recursive:true});
  const path=join(root,'series.json'), contentRoot=join(root,'content'), dbPath=join(root,'analytics.db');
  const input={ventureSlug:'fixture',title:'Existing test',sourceRef:'/owner/source.md',sourceText:'# Earlier notes\nnot selected\n# Cleaned posts\n---\nMy first post.\n\nMore detail.\n---\nMy second post.',heading:'Cleaned posts',expectedPosts:2,questions:['What converts?']};
  try {
    const plan=createArtifact('fixture',loadRules(),{artifact_id:'p1-research-plan',phase:1,artifact_kind:'phase_1_research_plan',title:'Plan',venture_id:'fixture',venture_phase:1,message_id:'plan',fields:{reviewed_by_muxin:false},at:'2026-09-14T12:00:00Z'});
    await assert.rejects(queueExistingSeries(input,{path,contentRoot}),/Review/);
    reviewResearchPlan('fixture',plan.updated_at);
    const artifacts=readFileSync(join(root,'venture','fixture','artifacts.jsonl'),'utf8');
    const s=await queueExistingSeries(input,{path,contentRoot});
    const folder=join(contentRoot,s.posts[0]!.contentSlug);
    const request=await readContentRequest(folder);
    assert.equal(request.originalInput,'My first post.\n\nMore detail.');
    assert.equal(resolveConfiguredProvenance(folder,request).body.trim(),request.originalInput);
    assert.deepEqual(request.selections.platforms,['linkedin','bluesky','x','threads','mastodon']);
    assert.equal(request.control.enabled,true,'a handoff must not opt out of controls for the owner');
    assert.equal(request.ventureSource,null); assert.equal(request.experiment,null);
    const authorized=await authorizeGuiContentRequest(folder,request,request);
    assert.equal(authorized.originalInput,request.originalInput);
    assert.equal(readFileSync(join(root,'venture','fixture','artifacts.jsonl'),'utf8'),artifacts);
    assert.deepEqual(await queueExistingSeries(input,{path,contentRoot}),s);
    assert.equal(readVentureSeries('human-inference',path).length,1);
    assert.deepEqual(readVentureSeries('charles',path),[]);
    await assert.rejects(queueExistingSeries({...input,sourceText:input.sourceText+' Changed.'},{path,contentRoot}),/source changed/);
    assert.equal(readFileSync(join(root,'venture','fixture','artifacts.jsonl'),'utf8'),artifacts);
    const db=new Database(dbPath);
    db.exec('CREATE TABLE posts(id INTEGER,platform TEXT,url TEXT,posted_at TEXT,content_text TEXT,brand_id TEXT,provider_account_id TEXT)');
    const insert=db.prepare('INSERT INTO posts VALUES(?,?,?,?,?,?,?)');
    insert.run(1,'substack-note','https://example.org/1','2026-09-14',request.originalInput,'human-inference','account');
    insert.run(2,'substack-note','https://example.org/2','2026-09-14','My second post.','charles','account');
    insert.run(3,'substack-note','https://example.org/3','2026-09-14','My second post. Extra text.','human-inference','account');
    db.close();
    const progress=readSeriesProgress('human-inference',{path,contentRoot,dbPath});
    assert.equal(progress[0]!.posts[0]!.matches!.length,1);
    assert.equal(progress[0]!.posts[1]!.matches!.length,0);
    assert.equal(progress[0]!.posts[0]!.draftCount,0);
    const action=nextVentureAction(1,[{...plan,fields:{reviewed_by_muxin:true}}],[],progress);
    assert.equal(action.runnable,false);
    const html=ventureActionsHtml(progress,null,String);
    assert.match(html,/Ready to configure/);assert.match(html,/Setup needed/);assert.match(html,/data-venture-content/);
    assert.match(ventureSeriesSignalsHtml(progress,null,String),/1 of 2/);
  } finally {
    if(before===undefined) delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT; else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=before;
    rmSync(root,{recursive:true,force:true});
  }
});
test('aggregate snapshots preserve measured zero without leaking private fields',()=>{
  const root=mkdtempSync(join(tmpdir(),'website-counts-')),path=join(root,'snapshot.json');
  try {
    assert.equal(readWebsiteMeasurement(path),null);
    const value={brandId:'human-inference' as const,source:'website-postgres' as const,capturedAt:'2026-09-14T12:00:00Z',firstSignupAt:null,signups:0,surveyCompletions:0,activeSubscribers:0,email:'secret@example.test'};
    saveWebsiteMeasurement(value,path);
    assert.equal(readWebsiteMeasurement(path)!.signups,0);
    assert.doesNotMatch(readFileSync(path,'utf8'),/secret|email/);
    assert.throws(()=>saveWebsiteMeasurement({...value,signups:-1},path),/Invalid/);
    assert.equal(readWebsiteMeasurement(path)!.signups,0);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('source section selection is bounded and emitted browser script parses',()=>{
  assert.throws(()=>selectedPosts('# Other\ntext','Missing'),/exact source/);
  assert.deepEqual(selectedPosts('# Posts\none\n# Next\nprivate','Posts'),['one']);
  const page=renderPage({repoRoot:'/fixture',isDevWorktree:true});
  assert.doesNotThrow(()=>new Function(page.match(/<script>([\s\S]*?)<\/script>/)![1]));
});
test('Content restores saved choices instead of generic recommendations and retains unsaved adjustments',()=>{
  const script=renderPage({repoRoot:'/fixture',isDevWorktree:true}).match(/<script>([\s\S]*?)<\/script>/)![1];
  const start=script.indexOf('function cwEnsureConfig(){');
  const fn=script.slice(start,script.indexOf('function cwConfigSectionHtml',start));
  const CW={requestFor:'source',request:{id:'source',selections:{treatments:['platform-framing'],media:['none'],platforms:['linkedin','bluesky']},control:{enabled:false}},config:{slug:'source',platform:new Set(['x'])}};
  const result=new Function('CW',`const cwSession=()=>({slug:'source'});${fn};return cwEnsureConfig();`)(CW);
  assert.deepEqual([...result.platform],['linkedin','bluesky']);assert.equal(result.control,false);assert.equal(result.media.size,0);
  result.platform.delete('bluesky');
  const retained=new Function('CW',`const cwSession=()=>({slug:'source'});${fn};return cwEnsureConfig();`)(CW);
  assert.equal(retained,result);assert.deepEqual([...retained.platform],['linkedin']);
});
