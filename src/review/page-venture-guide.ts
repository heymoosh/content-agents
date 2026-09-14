import type { VentureThread } from './venture-thread.js';

/** Presentation only: no inferred checkpoint completion or calendar-driven advancement. */
export function ventureGuideHtml(t: VentureThread, esc: (s: unknown) => string): string {
  const phases = [
    ['Attention', 'Days 1–3', 'Find the content and audience worth exploring.'],
    ['Audience', 'Days 4–6', 'Help interested readers subscribe and share their needs.'],
    ['Offer', 'Days 7–10', 'Use real responses to choose a problem and outline an offer.'],
    ['Operations', 'Days 11–14', 'Choose a sustainable routine and review whether to continue.'],
  ];
  const checkpoint = t.messages.find(m => m.kind === 'checkpoint');
  const blockers = checkpoint?.kind === 'checkpoint' ? [
    ...checkpoint.rows.filter(r => !r.isLive).map(r => r.title + ': ' + r.approval + '; ' + r.live),
    ...checkpoint.decisions.filter(d => !d.selected).map(d => d.kind.replace(/-/g, ' ') + ': decision needed'),
    ...(checkpoint.needsPace ? ['Posting pace has not been recorded in the phase checkpoint.'] : []),
  ] : [];
  return '<section class="venture-guide"><h3>Phase '+t.phase+' of 4: '+phases[t.phase-1][0]+'</h3>'
    + '<ol class="venture-phase-track" aria-label="Venture phase progress">'+phases.map((p,i)=>'<li'+(i+1===t.phase?' aria-current="step"':'')+'><strong>'+ (i+1)+'. '+p[0]+'</strong><span>'+(i+1===t.phase?'Current phase':i+1<t.phase?'Earlier phase':'Ahead')+'</span><small>'+p[1]+' in the starter kit</small></li>').join('')+'</ol>'
    + '<p>'+phases[t.phase-1][2]+' '+(t.elapsedDays===null?'':'Day '+(t.elapsedDays+1)+' since kickoff. ')+'The 14 days are a planning guide, not a deadline that advances your venture automatically.</p>'
    + (t.phase===1 && t.executionSeries?.length ? '<p><strong>Right now:</strong> connect and review evidence from your existing work. Your website and scheduled content give you a head start; you are not starting from zero.</p>' : '')
    + '<details><summary>What blocks the next phase?</summary>'+(blockers.length?'<ul>'+blockers.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':'<p>'+esc(t.phase===4?'Finish the operating review and record your final decision.':'Review the current phase requirements in History before advancing.')+'</p>')
    + '<p>These are the recorded workflow requirements, not a claim that your existing work is absent.'+(t.phase===1?' Existing posts still need registered evidence; a research read and your continuation decision also govern the move into Audience.':'')+'</p><button type="button" data-venture-history>Open phase requirements</button></details></section>';
}

/** Render structured documents without asking a model to rewrite the owner's record. */
export function ventureStructuredHtml(value: unknown, esc: (s: unknown) => string): string {
  const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const render = (v: unknown): string => {
    if (v === null || v === undefined) return '<span>Not recorded</span>';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? '<ul>'+v.map(item=>'<li>'+render(item)+'</li>').join('')+'</ul>' : '<span>None recorded</span>';
    if (typeof v === 'object') return '<dl class="venture-document-fields">'+Object.entries(v).map(([k,val])=>'<div><dt>'+esc(label(k))+'</dt><dd>'+render(val)+'</dd></div>').join('')+'</dl>';
    return '<span style="white-space:pre-wrap">'+esc(v)+'</span>';
  };
  return render(value);
}
