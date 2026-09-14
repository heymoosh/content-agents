import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWorkingContext, saveWorkingContext, VENTURE_PROGRESS_GUIDANCE } from '../venture/working-context.js';
import { nextVentureAction } from './venture-thread.js';
import type { VentureArtifact } from '../venture/artifacts.js';
import type { VentureThread } from './venture-thread.js';
import { ventureProgressHtml, ventureResearchPlanHtml } from './page-venture-progress.js';
import { renderPage } from './page.js';
import { handleVentureWrite } from './venture-writes.js';
import { createArtifact, readArtifact } from '../venture/artifacts.js';
import { loadRules } from '../venture/rules.js';

test('working updates are revision-checked, append-only, scoped and preserve intake', () => {
  const root=mkdtempSync(join(tmpdir(),'venture-progress-'));
  const before=process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=root;
  try {
    mkdirSync(join(root,'fixture')); mkdirSync(join(root,'other'));
    writeFileSync(join(root,'fixture','intake.md'),'Original interview');
    const body={revision:0,underway:'Six Notes scheduled, not verified live.',testing:'Compare platforms',next:'Use existing content',gaps:'Attribution unknown',constraints:'No employees'};
    assert.equal(readWorkingContext('fixture').revision,0);
    const r=handleVentureWrite('POST','/api/venture/fixture/working-context',body)!;
    assert.equal(r.status,200);
    assert.equal(readWorkingContext('fixture').underway,body.underway);
    assert.equal(handleVentureWrite('POST','/api/venture/fixture/working-context',body)!.status,400);
    assert.throws(()=>saveWorkingContext('fixture',{...body,revision:1,next:1}),/must be text/);
    saveWorkingContext('fixture',{...body,revision:1,next:'Read conversion evidence'});
    assert.equal(readWorkingContext('fixture').revision,2);
    const entries=readFileSync(join(root,'fixture','working-context.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(entries.length,2); assert.equal(entries[0].next,body.next);
    assert.equal(readFileSync(join(root,'fixture','intake.md'),'utf8'),'Original interview');
    assert.equal(readWorkingContext('other').revision,0);
    assert.throws(()=>readWorkingContext('../fixture'),/Invalid venture slug/);
    assert.throws(()=>saveWorkingContext('missing',body),/no such venture/);
    const plan=createArtifact('fixture',loadRules(),{artifact_id:'p1-research-plan',phase:1,artifact_kind:'phase_1_research_plan',title:'Test plan',venture_id:'fixture',venture_phase:1,message_id:'p1-research-plan',fields:{reviewed_by_muxin:false},at:'2026-09-14T12:00:00Z'});
    assert.equal(handleVentureWrite('POST','/api/venture/fixture/research-plan/review',{confirm:true,updatedAt:'old'})!.status,400);
    assert.equal(readArtifact('fixture','p1-research-plan')!.fields!.reviewed_by_muxin,false);
    assert.equal(handleVentureWrite('POST','/api/venture/fixture/research-plan/review',{confirm:true,updatedAt:plan.updated_at})!.status,200);
    assert.equal(readArtifact('fixture','p1-research-plan')!.fields!.reviewed_by_muxin,true);
    assert.equal(readArtifact('fixture','p1-research-plan')!.publishable,false);
  } finally {
    if(before===undefined) delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT; else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=before;
    rmSync(root,{recursive:true,force:true});
  }
});
test('new business and existing business both begin with research, then stop for real review', () => {
  assert.equal(nextVentureAction(1,[],[]).command,'plan-init');
  const plan={artifact_kind:'phase_1_research_plan',fields:{reviewed_by_muxin:false}} as unknown as VentureArtifact;
  assert.equal(nextVentureAction(1,[plan],[]).runnable,false);
  plan.fields!.reviewed_by_muxin=true;
  assert.equal(nextVentureAction(1,[plan],[]).runnable,true);
});
test('overview labels owner reports, escapes input, shows existing work and keeps original context secondary', () => {
  const t={workingContext:{revision:1,savedAt:'2026-09-14',underway:'Six Notes scheduled <script>\n\nExisting backlog',testing:'Which platforms?',next:'Map existing posts',gaps:'No offer yet',constraints:'30 hour ceiling'},messages:[]} as unknown as VentureThread;
  const html=ventureProgressHtml(t);
  assert.match(html,/Six Notes scheduled &lt;script&gt;/);
  assert.match(html,/Reported context, not verified publication/);
  assert.match(html,/<details id="ventureWorkingEdit">/);
  assert.match(html,/Which platforms\?/);
  assert.match(html,/<ul><li>Six Notes scheduled &lt;script&gt;<\/li><li>Existing backlog<\/li><\/ul>/);
  assert.doesNotMatch(html,/vp-grid/);
  const page=renderPage({repoRoot:'/fixture',isDevWorktree:true});
  assert.ok(page.indexOf('id="ventureRunStepBtn"') < page.indexOf('id="ventureProgress"'));
  assert.doesNotMatch(html,/25 questions|0 of 0/);
  assert.match(VENTURE_PROGRESS_GUIDANCE,/supersedes conflicting intake/);
  assert.match(VENTURE_PROGRESS_GUIDANCE,/Scheduled is not live/);
});
test('research plan exposes hypotheses and the explicit review action; emitted browser script parses', () => {
  const plan={reviewed:false,updatedAt:'stamp',knowns:[],unknowns:[{id:'location',description:'Where are readers?'}],probes:[{unknown:'location',hypothesis:'Platform fit',question:'What helped?',evidence:'Signups, not just views'}]};
  const html=ventureResearchPlanHtml(plan);
  assert.match(html,/Where are readers\?/); assert.match(html,/Signups, not just views/); assert.match(html,/Use this research plan/);
  assert.doesNotMatch(ventureResearchPlanHtml({...plan,reviewed:true}),/data-review-research-plan/);
  const page=renderPage({repoRoot:'/fixture',isDevWorktree:true});
  assert.doesNotThrow(()=>new Function(page.match(/<script>([\s\S]*?)<\/script>/)![1]));
  const script=page.match(/<script>([\s\S]*?)<\/script>/)![1];
  const start=script.indexOf('const renderVentureProgress =');
  const renderers=script.slice(start,script.indexOf('const ventureWorkingDrafts',start));
  const result=new Function('plan','esc',renderers+';return renderVentureResearchPlan(plan,esc);')(plan,(s:unknown)=>String(s??''));
  assert.match(result,/Use this research plan/);
});
test('saving a working update keeps its editor and confirmation visible', () => {
  const script=renderPage({repoRoot:'/fixture',isDevWorktree:true}).match(/<script>([\s\S]*?)<\/script>/)![1];
  const start=script.indexOf('function renderWorkingContext(t){');
  const code=script.slice(start,script.indexOf("document.addEventListener('input'",start));
  const editor={open:true};
  const elements:Record<string,unknown>={'#ventureWorkingEdit':editor,'#ventureNextExplanation':{},'#ventureRunStepBtn':{},'#ventureProgress':{set innerHTML(_v:string){editor.open=false;}}};
  new Function('$',`const ventureWorkingDraft=()=>null,renderVentureProgress=()=>'',esc=String,ventureRunStepPending=false;${code};renderWorkingContext({nextAction:{label:'Next',runnable:true}});`)((key:string)=>elements[key]);
  assert.equal(editor.open,true);
});
