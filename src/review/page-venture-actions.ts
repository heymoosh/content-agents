import type { VentureSeries, WebsiteMeasurement } from './venture-actions.js';

export function ventureActionsHtml(series: VentureSeries[], measurement: WebsiteMeasurement | null, esc: (s: unknown) => string): string {
  if (!series.length) return '';
  return '<section class="venture-progress"><h2>Now: test audience response</h2><p>Your research plan is approved. Use the existing posts, prepare a small set of adaptations, and collect evidence. No new proposal is needed to do this work.</p>'
    + series.map(s => '<h3>'+esc(s.title)+'</h3><ol>'
      + '<li><strong>Existing posts saved and linked</strong><p>'+s.posts.length+' source posts are in Content. Scheduling is owner-reported; live post IDs and results still need matching.</p></li>'
      + '<li><strong>Prepare additional channels</strong><p>Start with at most two posts for LinkedIn and Bluesky, as proposed in the reviewed plan. Change the configuration in Content if needed. Existing Substack posts will not be republished.</p><ul>'
      + s.posts.map(p => '<li><button type="button" data-venture-content="'+esc(p.contentSlug)+'">'+esc(p.title)+'</button><span> · '+(p.draftCount===undefined?'source needs checking':p.draftCount?p.draftCount+' Content rows; open to review their status':'ready to configure, no drafts yet')+' · '+(p.matches?.length?p.matches.length+' matching analytics records':'no exact match in imported analytics')+'</span></li>').join('')+'</ul></li>'
      + '<li><strong>Connect website measurements</strong><p>'+(measurement
        ? 'Website totals retrieved: '+measurement.signups+' signups, '+measurement.surveyCompletions+' completed surveys. These are site-wide totals, not conversions attributed to these posts.'
        : 'Setup needed: the website stores signups and survey completions, but no aggregate has been retrieved yet. The database connection is needed for a read-only count.')
      + '</p><p>Page visits and per-post attribution are not connected. This is website integration work, not another content draft.</p></li>'
      + '<li><strong>Review available results</strong><p>Signals holds this series alongside existing platform results. It cannot yet tell us which of these posts converted. Once publication links and measurements are available, review those results before making more content.</p><button type="button" data-venture-signals>Open Signals</button></li></ol>'
      + '<h3>Questions we are testing</h3><ul>'+s.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>').join('')
    + '<p><strong>Then:</strong> wait for evidence and review what to continue or change. The 14-day outline is a guide, not a requirement to keep generating proposals. Phase completion and advancement still need their recorded evidence and your review.</p>'
    + '<button type="button" data-venture-documents>Read the approved research plan</button> <button type="button" data-venture-history>Context and workflow details</button></section>';
}

export function ventureSeriesSignalsHtml(series: VentureSeries[], measurement: WebsiteMeasurement | null, esc: (s: unknown) => string): string {
  if (!series.length) return '';
  return '<section><h3>Venture tests already underway</h3>'+series.map(s=>'<h4>'+esc(s.title)+'</h4><p>'+s.posts.length+' existing source posts linked from '+esc(s.ventureSlug)+'. Exploratory series, not a controlled comparison.</p><ul>'
    + s.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul><p>Source matching: '+s.posts.filter(p=>p.matches?.length).length+' of '+s.posts.length+' have an exact text match in imported analytics. No result or winning platform is inferred.</p><ul>'+s.posts.map(p=>'<li>'+esc(p.title)+' · '+(p.matches?.length?p.matches.map(m=>esc(m.platform)+' #'+m.id+' ('+esc(m.postedAt||'date unknown')+')').join(', '):'awaiting matching publication record')+'</li>').join('')+'</ul><button type="button" class="sig-venture-open" data-slug="'+esc(s.ventureSlug)+'">Open Venture actions</button>').join('')
    + '<h4>Website measurement status</h4>'+(measurement ? '<p>'+measurement.signups+' signups · '+measurement.surveyCompletions+' completed surveys · '+measurement.activeSubscribers+' active subscribers.</p><p>Site-wide database snapshot captured '+esc(measurement.capturedAt)+'. Earliest recorded signup: '+esc(measurement.firstSignupAt||'none')+'. Not attributed to this test. Survey completion is a saved submission, not a qualified response or proof of demand.</p>' : '<p>Signups and survey completions are stored by the website. Connection pending; no counts retrieved.</p>')
    + '<p>Page visits: not connected. Per-post conversions: not attributed. Raw subscriber details and survey answers are not shared here.</p></section>';
}
