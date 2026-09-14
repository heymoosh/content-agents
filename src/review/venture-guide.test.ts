import test from 'node:test';
import assert from 'node:assert/strict';
import { ventureGuideHtml, ventureStructuredHtml } from './page-venture-guide.js';
import type { VentureThread } from './venture-thread.js';
import { renderPage } from './page.js';

test('phase view uses recorded phase, preserves blockers, escapes structured values and emits valid browser code',()=>{
  const escape=(s:unknown)=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const thread={phase:1,elapsedDays:20,messages:[{kind:'checkpoint',rows:[{title:'Post',isLive:false,approval:'Not approved',live:'Not live'}],decisions:[],needsPace:true}]} as unknown as VentureThread;
  const before=JSON.stringify(thread);
  const html=ventureGuideHtml(thread,escape);
  assert.match(html,/Phase 1 of 4/); assert.match(html,/Day 21/); assert.match(html,/Not live/);
  for(const phase of [2,3,4]){
    const preview=ventureGuideHtml(thread,escape,phase);
    assert.match(preview,new RegExp('Preview: Phase '+phase+' of 4'));
    assert.match(preview,/Not unlocked yet/);
    assert.match(preview,/What is needed to start/);
    assert.match(preview,/What this phase needs to finish/);
    assert.match(preview,/data-venture-phase="1">Back to current phase and actions/);
    assert.doesNotMatch(preview,/data-venture-history/);
  }
  assert.match(ventureGuideHtml(thread,escape,9),/Phase 1 of 4/);
  assert.equal(JSON.stringify(thread),before);
  const doc=ventureStructuredHtml({reviewed_by_muxin:false,claim:'<script>not markup</script>'},escape);
  assert.match(doc,/Reviewed by muxin/); assert.doesNotMatch(doc,/<script>/); assert.match(doc,/No/);
  const script=renderPage({repoRoot:'/fixture',isDevWorktree:true}).match(/<script>([\s\S]*?)<\/script>/)![1];
  assert.doesNotThrow(()=>new Function(script));
});
