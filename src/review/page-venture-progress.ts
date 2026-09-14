import type { VentureThread, CardMsg } from './venture-thread.js';

const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Browser supplies its escaping helper; the default serves server-side tests.
export function ventureProgressHtml(t: VentureThread, esc: (s: unknown) => string = escapeHtml): string {
  const c = t.workingContext;
  const titles = {underway:'Already underway',testing:'What we are testing',next:'Agreed next steps',gaps:'Still unknown or deferred',constraints:'How this business should operate'};
  const quotes = t.messages.find(m=>m.kind==='quotes');
  const fallback = quotes?.kind === 'quotes' ? quotes.lines.filter(q=>['q-q1','q-q6'].includes(q.anchor)).map(q=>q.answer).join('\n\n') : '';
  const hasContext = !!c?.revision;
  return '<section class="venture-progress"><h2>Where your venture stands</h2>'
    + (t.messages.some(m=>m.kind==='receipt')?'<p>Interview saved. Your original context and activity remain in History and the details below.</p>':'')
    + (hasContext ? '<p class="vp-meta">Saved working update · '+esc(c.savedAt?.slice(0,10))+' · Reported context, not verified publication or performance.</p>' : '<p>Start from the context you already supplied. Add any developments since the interview below.</p>')
    + '<div class="vp-sections">'+Object.entries(titles).filter(([key])=>key!=='constraints').map(([key,title])=>{
      const value=c?.[key as keyof typeof titles] || (key==='underway'?fallback:'');
      if(!value) return '';
      return '<section><h3>'+title+'</h3><ul>'+value.split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></section>';
    }).join('')+'</div>'
    + (c?.constraints?'<details><summary>Business operating boundaries</summary><p class="vp-text">'+esc(c.constraints)+'</p></details>':'')
    + '<details id="ventureWorkingEdit"><summary>Update this context</summary><p>Tell the model what has changed. These notes inform its next proposal; they do not approve a draft or mark anything live.</p>'
    + Object.entries(titles).map(([key,title])=>'<label class="vp-field">'+title+'<textarea data-working-field="'+key+'" rows="4" maxlength="12000">'+esc(c?.[key as keyof typeof titles] || (key==='underway'?fallback:''))+'</textarea></label>').join('')
    + '<button type="button" id="ventureWorkingSave">Save working update</button><p id="ventureWorkingStatus" role="status">'+(hasContext?'Saved.':'Not saved yet.')+'</p></details></section>';
}

export function ventureResearchPlanHtml(plan: NonNullable<CardMsg['researchPlan']>, esc: (s: unknown) => string = escapeHtml): string {
  return '<div class="vp-plan"><h3>What this plan builds on</h3>'
    + (plan.knowns.length ? '<ul>'+plan.knowns.map(k=>'<li>'+esc(k.claim)+'<p class="vp-meta">Source: '+esc(k.refs.join(', '))+'</p></li>').join('')+'</ul>' : '<p>No audience facts have been confirmed in this plan. Hypotheses below remain unproven.</p>')
    + '<h3>Questions to resolve</h3><ul>'+plan.unknowns.map(u=>'<li>'+esc(u.description)+'</li>').join('')+'</ul>'
    + '<h3>Proposed tests</h3>'+plan.probes.map(p=>'<section><p><strong>'+esc(p.hypothesis)+'</strong></p><p>Question: '+esc(p.question)+'</p><p>Evidence to look for: '+esc(p.evidence)+'</p></section>').join('')
    + (plan.reviewed?'<p>Research plan reviewed.</p>':'<p>Review these hypotheses and evidence requirements. This does not approve any content for publication.</p><button type="button" class="primary" data-review-research-plan="'+esc(plan.updatedAt)+'">Use this research plan</button>')+'</div>';
}
