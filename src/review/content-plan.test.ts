import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPlanIdeas, contentPlanOutputs, contentPlanSummaryHtml } from './content-plan.js';
import { buildContentRequest, mergeContentConfiguration, CONTENT_CONFIG_OPTIONS } from './content-request.js';
import { renderPage } from './page.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readContentRequest, writeContentRequest } from './content-request-store.js';

test('combined tests keep their combinations, deduplicate and persist output exclusions',async()=>{
  const plans=contentPlanIdeas({ventureId:'example',questions:['What works?']},'Source words. '.repeat(100));
  const input={id:'combined',origin:'human-inference' as const,descriptor:'Example',originalInput:'Source',
    testPlans:[...plans,{...plans[0],id:'overlap'}],includeUntreatedControl:true};
  const request=buildContentRequest(input);
  assert.equal(request.variants.length,25,'15 text + 6 visual + 4 video, not their Cartesian product');
  assert.equal(new Set(request.variants.map(v=>v.identity.id)).size,25);
  assert.ok(request.variants.every(v=>v.platform!=='instagram'||v.media==='static-quote-card'));
  assert.ok(request.variants.every(v=>!['tiktok','youtube'].includes(v.platform)||v.media==='short-video-script'));
  const excludedOutputs=[JSON.stringify(['linkedin','none','hook-variants'])];
  const folder=await mkdtemp(join(tmpdir(),'combined-plan-'));
  try{
    const saved=await writeContentRequest(folder,{...input,excludedOutputs});
    const loaded=await readContentRequest(folder);
    assert.equal(loaded.variants.length,24);
    assert.deepEqual(loaded,saved);
    const cfg={testPlans:loaded.testPlans,excludedOutputs:new Set(loaded.excludedOutputs),control:true};
    const html=contentPlanSummaryHtml(cfg,CONTENT_CONFIG_OPTIONS,null,String);
    assert.match(html,/24 draft variants/);
    const browserRender=new Function('contentPlanOutputs','return ('+contentPlanSummaryHtml.toString()+')')(new Function('return ('+contentPlanOutputs.toString()+')')());
    assert.equal(browserRender(cfg,CONTENT_CONFIG_OPTIONS,null,String),html);
    assert.deepEqual(buildContentRequest(mergeContentConfiguration(loaded,{...input,excludedOutputs})),loaded);
    assert.equal(buildContentRequest({...input,includeUntreatedControl:false}).variants.length,15);
  }finally{await rm(folder,{recursive:true,force:true});}
  assert.throws(()=>buildContentRequest({...input,testPlans:[{...plans[0],platforms:['bogus']}]}),/unknown/);
  assert.throws(()=>buildContentRequest({...input,excludedOutputs:['not-an-output']}),/exclu/i);
});

test('exploration ideas are bounded, source-aware, require Venture questions, and expose actual workload',()=>{
  const context={ventureId:'example',questions:['Which platforms lead to useful reader action?']};
  assert.deepEqual(contentPlanIdeas(null,'A thought'),[]);
  assert.deepEqual(contentPlanIdeas({ventureId:'example',questions:[]},'A thought'),[]);
  assert.equal(contentPlanIdeas(context,'A short thought').length,1);
  const ideas=contentPlanIdeas(context,'A source-supported sentence. '.repeat(60));
  assert.equal(ideas.length,3);
  const inBrowser=new Function('return ('+contentPlanIdeas.toString()+')')();
  assert.deepEqual(inBrowser(context,'A source-supported sentence. '.repeat(60)),ideas);
  for(const idea of ideas){
    const request=buildContentRequest({...idea,id:'example',origin:'human-inference',descriptor:'Example',originalInput:'Source',includeUntreatedControl:true});
    const cfg={platform:new Set(idea.platforms),media:new Set(idea.media),treatment:new Set(idea.treatments),control:true};
    const html=contentPlanSummaryHtml(cfg,CONTENT_CONFIG_OPTIONS,context,String);
    const renderInBrowser=new Function('return ('+contentPlanSummaryHtml.toString()+')')();
    assert.equal(renderInBrowser(cfg,CONTENT_CONFIG_OPTIONS,context,String),html);
    assert.ok(html.includes(request.variants.length+' draft variants'));
    assert.equal(request.control.enabled,true);
    assert.ok(!idea.platforms.includes('substack'),'do not automatically requeue the source channel');
  }
});

test('plan summary precedes editable controls and preserves an explicit saved control opt-out',()=>{
  const script=renderPage({repoRoot:'/fixture',isDevWorktree:true}).match(/<script>([\s\S]*?)<\/script>/)![1];
  const start=script.indexOf('function cwEnsureConfig(){');
  const fn=script.slice(start,script.indexOf('function cwConfigSectionHtml',start));
  const CW={requestFor:'source',request:{id:'source',selections:{platforms:['x'],media:['none'],treatments:['summary']},control:{enabled:false}},config:null};
  const cfg=new Function('CW',`const cwSession=()=>({slug:'source'}), cwIntendedReaderAction=()=>null;${fn};return cwEnsureConfig();`)(CW);
  assert.equal(cfg.control,false);
  assert.match(contentPlanSummaryHtml(cfg,CONTENT_CONFIG_OPTIONS,null,String),/data-restore-control/);
  const step=script.slice(script.indexOf('function cwStep2Html(){'),script.indexOf('function cwRefreshPlanSummary(){'));
  assert.ok(step.indexOf('id="contentPlanSummary"')<step.indexOf('cwConfigSectionHtml("platform"'));
  assert.doesNotThrow(()=>new Function(script));
});

test('embedded controls add, remove and select all tests without replacing other selections',()=>{
  const script=renderPage({repoRoot:'/fixture',isDevWorktree:true}).match(/<script>([\s\S]*?)<\/script>/)![1];
  const start=script.indexOf('  const customButton=');
  const handler=script.slice(start,script.indexOf('  const original=',start));
  const cfg:any={control:false,readerAction:{mode:'none'}};
  const CW={conversion:{ventureId:'example',questions:['What works?']},approvedLens:null};
  const click=new Function('e','CW','cfg','contentPlanIdeas','contentPlanOutputs',
    'const cwSession=()=>({sourceBody:"source words. ".repeat(100)}),cwEnsureConfig=()=>cfg,renderContentWizard=()=>{};'+handler);
  const run=(dataset:any)=>click({target:{closest:(selector:string)=>selector.includes('data-plan-idea')?{dataset}:null}},CW,cfg,contentPlanIdeas,contentPlanOutputs);
  run({planIdea:'text'});run({planIdea:'visual'});
  assert.deepEqual(cfg.testPlans.map((p:any)=>p.id),['text','visual']);
  assert.equal(cfg.control,true);
  run({planIdea:'text'});
  assert.deepEqual(cfg.testPlans.map((p:any)=>p.id),['visual']);
  run({planAll:''});
  assert.equal(contentPlanOutputs(cfg.testPlans,cfg.control).length,25);
  assert.deepEqual(cfg.readerAction,{mode:'none'});
});
