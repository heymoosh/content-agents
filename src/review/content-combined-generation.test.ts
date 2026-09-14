import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { repoRoot } from '../db/db.js';
import { contentPlanIdeas } from './content-plan.js';
import { writeContentRequest, readContentRequest } from './content-request-store.js';
import { generateConfiguredContent } from './jobs.js';
import { readQueue } from '../publish/queue.js';
import { approveConfiguredMediaStage, executeConfiguredMediaStage, prepareConfiguredVideoRender } from './configured-media-runtime.js';

test('combined saved plans generate only selected unique outputs and retry without duplicates',async()=>{
  const slug=`test-combined-${process.pid}-${Date.now()}`;
  const folder=join(repoRoot,'content',slug), marker=join(repoRoot,'.e2e-configured-engine-token');
  assert.equal(existsSync(marker),false,'never overwrite another test marker');
  const oldToken=process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN, oldRoot=process.env.E2E_REPO_ROOT;
  const body='The source claim stays exact.';
  mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'source.md'),'---\nsource_kind: essay\n---\n'+body+'\n');
  writeFileSync(join(folder,'review-queue.md'),'# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n');
  writeFileSync(marker,slug);
  process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN=slug;
  process.env.E2E_REPO_ROOT=repoRoot;
  try{
    await writeContentRequest(folder,{id:slug,origin:'human-inference',descriptor:'Fixture',originalInput:body,
      testPlans:contentPlanIdeas({ventureId:'fixture',questions:['What works?']},'source words. '.repeat(100)),
      excludedOutputs:[JSON.stringify(['linkedin','none','hook-variants'])],
      sourceProvenance:{kind:'source',sourceLines:[4]}});
    const request=await readContentRequest(folder);
    const result=await generateConfiguredContent(slug,request,'codex',{runEngine:async()=>{throw new Error('Live engine forbidden in fixture');}});
    assert.equal(result.engineExecution,'disposable-injected');
    assert.equal(result.ids.length,24);
    assert.deepEqual(result.ids,request.variants.map(v=>v.identity.id));
    const rows=readQueue(folder).rows;
    assert.equal(rows.length,24);
    assert.ok(rows.every(row=>row.status==='pending'));
    for(const v of request.variants.filter(v=>v.identity.kind==='control')){
      assert.ok(readFileSync(join(folder,'derivatives',v.identity.id+'.md'),'utf8').includes(body));
    }
    assert.equal((await generateConfiguredContent(slug,request)).existing,true);
    assert.equal(readQueue(folder).rows.length,24);
    const videos=request.variants.filter(v=>v.media==='short-video-script');
    const paths=new Set<string>();
    for(const video of videos){
      const renderFixture=async(stage:any,root:string)=>{
        const render=prepareConfiguredVideoRender(stage,root);
        assert.ok(render.command.at(-1)!.endsWith('/'+stage.id));
        for(const asset of render.assets){
          assert.ok(!paths.has(asset),'video variants never overwrite each other');paths.add(asset);
          mkdirSync(dirname(join(root,asset)),{recursive:true});writeFileSync(join(root,asset),'fixture video');
        }
        return {...render,costUsd:0};
      };
      await assert.rejects(executeConfiguredMediaStage(folder,video.identity.id,renderFixture),/not approved/);
      approveConfiguredMediaStage(folder,video.identity.id);
      await executeConfiguredMediaStage(folder,video.identity.id,renderFixture);
    }
    assert.equal(videos.length,4);
    assert.equal(existsSync(join(folder,'video','short.mp4')),false);
    assert.equal(readFileSync(join(folder,'source.md'),'utf8'),'---\nsource_kind: essay\n---\n'+body+'\n');
  }finally{
    rmSync(folder,{recursive:true,force:true});rmSync(marker);
    if(oldToken===undefined)delete process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN;else process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN=oldToken;
    if(oldRoot===undefined)delete process.env.E2E_REPO_ROOT;else process.env.E2E_REPO_ROOT=oldRoot;
  }
});
