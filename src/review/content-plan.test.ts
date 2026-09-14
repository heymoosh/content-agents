import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPlanIdeas, contentPlanSummaryHtml } from './content-plan.js';
import { buildContentRequest, CONTENT_CONFIG_OPTIONS } from './content-request.js';
import { renderPage } from './page.js';

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
    const request=buildContentRequest({id:'example',origin:'human-inference',descriptor:'Example',originalInput:'Source',...idea,includeUntreatedControl:true});
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
