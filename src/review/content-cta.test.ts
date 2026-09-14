import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentRequest, mergeContentConfiguration } from './content-request.js';
import { loadContentTypesConfig } from '../publish/cta.js';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readConversionPlan, saveConversionPlan, conversionDestinations } from '../venture/conversions.js';
import { authorizeReaderAction, contentConversionContext, verifyReaderAction, protectDraftReaderAction } from './content-conversions.js';
import { authorizeGuiContentRequest, writeContentRequest, readContentRequest } from './content-request-store.js';
import { useOriginalSource } from './develop.js';
import { splitFrontmatter } from '../util/frontmatter.js';
import { resolveCtaLines } from '../publish/cta.js';
import { setReviewRootsForTest } from './rows.js';
import { generateConfiguredContent, developSpawnPrompt } from './jobs.js';
import { renderPage } from './page.js';

test('a per-piece CTA choice survives configuration without changing Venture ownership', () => {
  const input = { id: 'post', origin: 'human-inference' as const, ventureId: 'demo', descriptor: 'Post', originalInput: 'My writing' };
  const request = buildContentRequest({ ...input, readerAction: { mode: 'none' } } as any);
  const merged = buildContentRequest(mergeContentConfiguration(request, { ...input, ventureId: 'forged', platforms: ['linkedin'] }));
  assert.equal(merged.ventureId, 'demo');
  assert.deepEqual((merged as any).readerAction, { mode: 'none' });
});

test('Venture destination lifecycle, scoped selection, persistence and actual generated CTA', async () => {
  const root=mkdtempSync(join(tmpdir(),'venture-cta-'));
  const old=process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=join(root,'venture');
  mkdirSync(join(root,'venture','demo'),{recursive:true});
  const folder=join(root,'content','piece');mkdirSync(folder,{recursive:true});
  const restore=setReviewRootsForTest({contentRoot:join(root,'content'),outreachRoot:join(root,'outreach')});
  try {
    writeFileSync(join(folder,'source.md'),'---\ntitle: Example\nsource_kind: substack-note\n---\n\nOne useful point.\n\nA concrete next step.\n');
    writeFileSync(join(folder,'review-queue.md'),'# Review\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n');
    const lens=useOriginalSource(folder);
    const cut=splitFrontmatter(readFileSync(join(folder,'cuts',lens,'cut.md'),'utf8'));
    assert.equal(cut.body,'One useful point.\n\nA concrete next step.');
    const base={id:'piece',origin:'human-inference' as const,ventureId:'demo',descriptor:'Piece',originalInput:cut.body,
      sourceProvenance:{kind:'approved-cut' as const,lens,sourceLines:cut.fm.source_lines as string[]},platforms:['bluesky'],treatments:[],includeUntreatedControl:true};
    await writeContentRequest(folder,base);
    const destination={id:'guide',name:'Guide',audience:'Builders',benefit:'A practical checklist',action:'Get the checklist:',measurement:'Completed signups',status:'building' as const,url:'https://example.org/guide'};
    let plan=await saveConversionPlan('demo',{...readConversionPlan('demo'),goal:'Useful reader action',destinations:[destination],assignments:[{contentId:'piece',destinationId:'guide',reason:'The checklist helps apply this point'}]});
    const choice={mode:'destination',destinationId:'guide',reason:'Apply the point',reviewed:true};
    assert.throws(()=>authorizeReaderAction(folder,choice,base),/ready/);
    plan=await saveConversionPlan('demo',{...plan,destinations:[{...destination,status:'ready'}]});
    const competing=await Promise.allSettled([saveConversionPlan('demo',plan),saveConversionPlan('demo',plan)]);
    assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);
    plan=readConversionPlan('demo');
    await assert.rejects(saveConversionPlan('demo',{...plan,revision:0}),/another tab/);
    assert.throws(()=>authorizeReaderAction(folder,{...choice,destinationId:'other'},base),/belonging/);
    assert.throws(()=>authorizeReaderAction(folder,{...choice,reviewed:false},base),/Review/);
    const action=authorizeReaderAction(folder,{...choice,url:'https://evil.example'},base)!;
    assert.equal(action.mode,'destination');
    if(action.mode!=='destination')throw new Error('Expected destination');
    assert.equal(action.url,destination.url);assert.equal(action.from,'venture');
    const original=await readContentRequest(folder);
    const authorized=await authorizeGuiContentRequest(folder,{...base,ventureId:'forged'},original);
    assert.equal(authorized.ventureId,'demo');
    const saved=await writeContentRequest(folder,{...authorized,readerAction:action});
    assert.deepEqual((await readContentRequest(folder)).readerAction,action);
    assert.equal(contentConversionContext(folder).intended?.destinationId,'guide');
    assert.equal(contentConversionContext(folder,{...saved,origin:'charles'}).destinations.length,0);
    const prompt=developSpawnPrompt({arg:'content/piece',brand:'human-inference',engine:'codex'} as any);
    assert.match(prompt,/Useful reader action/);assert.match(prompt,/guide/);
    const generated=await generateConfiguredContent('piece',saved,'codex',{runEngine:async()=>{throw new Error('No model call allowed in this test');}});
    const raw=readFileSync(join(folder,'derivatives',generated.ids[0]+'.md'),'utf8');
    const {fm,body}=splitFrontmatter(raw);
    assert.equal(body,cut.body);assert.equal(fm.cta_id,'guide');assert.equal(fm.cta_venture_id,'demo');
    assert.deepEqual(resolveCtaLines(fm,null,{placement:{},fallbackUrl:null,fallbackLabel:''},'substack-note',loadContentTypesConfig()).ctas,[{url:destination.url,label:destination.action}]);
    assert.throws(()=>protectDraftReaderAction(folder,saved,{mode:'none'}),/already has drafts/);
    plan=await saveConversionPlan('demo',{...plan,destinations:[{...destination,status:'retired'}]});
    assert.throws(()=>verifyReaderAction(folder,saved),/not ready/);
    assert.equal(conversionDestinations('demo')[0].status,'retired');
    writeFileSync(join(root,'venture','demo','artifacts.jsonl'),JSON.stringify({artifact_id:'unfinished',artifact_kind:'lead-magnet',title:'Unfinished resource',editorial_status:'pending',delivery_status:'not_started',evidence:null})+'\n');
    await saveConversionPlan('demo',{...plan,destinations:[{...destination,id:'unfinished',status:'ready'}],assignments:[]});
    assert.equal(conversionDestinations('demo')[0].status,'building','registry cannot bypass the artifact gate');
  } finally {restore();if(old===undefined)delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT=old;rmSync(root,{recursive:true,force:true});}
});

test('the embedded browser code parses after the plan and destination UI changes',()=>{
  const html=renderPage({repoRoot:'/fixture',isDevWorktree:true});
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);assert.doesNotThrow(()=>new Function(script));
});

test('default content-type routing contains no consulting destinations', () => {
  const config = loadContentTypesConfig();
  assert.equal(config.workWithMeUrl, null);
  assert.ok(Object.values(config.types).every(type => type.primary.destination !== 'work_with_me' && type.secondary?.destination !== 'work_with_me'));
});
