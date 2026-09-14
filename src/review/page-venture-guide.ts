import type { VentureThread } from './venture-thread.js';

/** Presentation only: no inferred checkpoint completion or calendar-driven advancement. */
export function ventureGuideHtml(t: VentureThread, esc: (s: unknown) => string, selectedPhase = t.phase): string {
  const selected = Number.isInteger(selectedPhase) && selectedPhase >= 1 && selectedPhase <= 4 ? selectedPhase : t.phase;
  const preview = selected !== t.phase;
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
  const entry = [
    'Start a venture from your reviewed interview context.',
    'Complete the Attention checkpoint: approved posts with confirmed live evidence and a recorded pace. Review the research findings and select a continuation decision that permits Audience work.',
    'Complete the Audience checkpoint: approved and confirmed lead magnet, landing page, welcome email and survey. Offer analysis also waits for at least 20 eligible unique survey respondents (30 is the target).',
    'Complete the Offer checkpoint: selected problem, transformation and price/format decisions, plus approved product-outline and price-decision artifacts with the required delivery confirmations.',
  ];
  const outcome = [
    'Review audience evidence, decide what it supports, and choose whether to continue into Audience or collect more evidence.',
    'Make the signup and survey path work, then collect enough useful responses to investigate an offer. Existing website assets can support this work; their existence alone does not clear the recorded checkpoint.',
    'Choose a problem, define the change you will help people make, and review a product outline and price. Interest is not proof of paid demand.',
    'Approve a sustainable operating plan and the review of results, then record your decision to continue, revise, collect more evidence or stop. There is no fifth phase.',
  ];
  return '<section class="venture-guide"><h3>'+(preview?'Preview: ':'')+'Phase '+selected+' of 4: '+phases[selected-1][0]+'</h3>'
    + '<ol class="venture-phase-track" aria-label="Venture phase progress">'+phases.map((p,i)=>'<li'+(i+1===t.phase?' aria-current="step"':'')+'><button type="button" data-venture-phase="'+(i+1)+'" aria-pressed="'+(i+1===selected)+'" aria-controls="venturePhaseSummary"><strong>'+ (i+1)+'. '+p[0]+'</strong><span>'+(i+1===t.phase?'Current phase':i+1<t.phase?'Earlier phase':'Preview only')+'</span><small>'+p[1]+' in the starter kit</small></button></li>').join('')+'</ol>'
    + '<div id="venturePhaseSummary"><p>'+phases[selected-1][2]+'</p>'
    + (preview ? '<p><strong>'+(selected>t.phase?'Not unlocked yet.':'Earlier phase preview.')+'</strong> Your venture remains in Phase '+t.phase+'. This preview does not start work or change progress.</p><h4>What is needed to start</h4><p>'+entry[selected-1]+'</p><h4>What this phase needs to finish</h4><p>'+outcome[selected-1]+'</p><button type="button" data-venture-phase="'+t.phase+'">Back to current phase and actions</button>'
      : '<p>'+(t.elapsedDays===null?'':'Day '+(t.elapsedDays+1)+' since kickoff. ')+'The 14 days are a planning guide, not a deadline that advances your venture automatically.</p>'
      + (t.phase===1 && t.executionSeries?.length ? '<p><strong>Right now:</strong> connect and review evidence from your existing work. Your website and scheduled content give you a head start; you are not starting from zero.</p>' : '')
      + '<details><summary>What blocks '+(t.phase===4?'completion':'the next phase')+'?</summary>'+(blockers.length?'<ul>'+blockers.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':'<p>'+esc(t.phase===4?'Finish the operating review and record your final decision.':'Review the current phase requirements in History before advancing.')+'</p>')
      + '<p>'+outcome[selected-1]+'</p><p>These are the recorded workflow requirements, not a claim that your existing work is absent.'+(t.phase===1?' Existing posts still need registered evidence; a research read and your continuation decision also govern the move into Audience.':'')+'</p><button type="button" data-venture-history>Open phase requirements</button></details>')
    + '</div></section>';
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
