import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from './page.js';
import { INTAKE_NOTE_FIELDS } from './intake-notes.js';

const script = renderPage({ repoRoot: '/fixture', isDevWorktree: true }).match(/<script>([\s\S]*?)<\/script>/)![1];
const esc = (v: unknown) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fields = INTAKE_NOTE_FIELDS.map(f => ({ key: f.key, text: f.key === 'scorecard.required_live_posts' ? '3' : 'Supported answer', basis: 'stated', evidence: ['Founder notes'] }));
const state = () => ({ notes: 'Founder notes', draft: '', corrections: {}, messages: [{role:'assistant',text:'We are done.'}], analysis: { summary: 'Working venture', fields: fields.map(f=>({...f})), questions: [] } });
function html(s: ReturnType<typeof state>) {
  const start = script.indexOf('const ivContextProgress =');
  const code = script.slice(start, script.indexOf('function renderIntake(){', start));
  return new Function('esc','ivNotesState','ivNotesFields',`const ivNotesBusy=false,ivNotesMessage='',ivNotesConflict=false,ivNotesAnalyzedText='Founder notes',ivNotesEngine='codex';${code};return ivNotesHtml();`)(esc,s,INTAKE_NOTE_FIELDS) as string;
}
test('emitted script parses and incomplete legacy interviews visibly ask a question', () => {
  assert.doesNotThrow(() => new Function(script));
  const s=state(); s.analysis.fields[0].text='';
  const result=html(s);
  assert.match(result,/34 of 35 context details captured/);
  assert.match(result,/Let’s resolve this next/);
  assert.ok(result.includes(INTAKE_NOTE_FIELDS[0].label));
  assert.doesNotMatch(result,/id="ivNotesConfirm"/);
});
test('complete context automatically opens closeout, while a draft or invalid count blocks starting', () => {
  const s=state();
  const result=html(s);
  assert.match(result,/Ready to start your venture/);
  assert.match(result,/<details open><summary>Review your venture context/);
  assert.match(result,/id="ivNotesConfirm">Start venture/);
  s.draft='Wait, change this'; assert.doesNotMatch(html(s),/id="ivNotesConfirm"/);
  s.draft=''; s.analysis.fields.find(f=>f.key==='scorecard.required_live_posts')!.text='three';
  assert.doesNotMatch(html(s),/id="ivNotesConfirm"/);
});
test('confirmed closeout saves first, creates once, and opens the resulting venture workspace', async () => {
  const start=script.indexOf('async function ivNotesAction(action){');
  const code=script.slice(start,script.indexOf('const ivContextProgress =', start));
  const calls:string[]=[];
  const post=async(url:string,body:Record<string,unknown>)=>{calls.push(url); if(url.endsWith('/confirm')){ assert.equal(body.confirm,true); assert.equal(body.revision,2); return {ok:true,result:{alreadyKickedOff:false}}; } return {ok:true,state:{...state(),revision:2}};};
  const run=new Function('post',`let ivNotesBusy=false,ivNotesState={revision:1,notes:'Founder notes',corrections:{},draft:''},ivSlug='fixture',ivNotesMessage='',ventureSlug;const sessionStorage={removeItem(){}},ivNotesBackupKey=()=>'',renderIntake=()=>{},ivRemember=()=>{},ivExit=()=>{ivSlug=null;},flash=()=>{};let loaded;async function loadVentureList(){loaded=ventureSlug;}${code};return async()=>({ok:await ivNotesAction('confirm'),loaded});`)(post);
  assert.deepEqual(await run(),{ok:true,loaded:'fixture'});
  assert.deepEqual(calls,['/api/venture/fixture/intake/context','/api/venture/fixture/intake/context/confirm']);
});
