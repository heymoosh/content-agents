import type { VentureSeries, WebsiteMeasurement } from './venture-actions.js';
import type { WebsiteAnalyticsReport } from './website-analytics-client.js';

export function websiteAnalyticsReportHtml(report: WebsiteAnalyticsReport | null | undefined, esc: (s: unknown) => string): string {
  if (!report) return '';
  const percentageText = (value: number | null) => value === null ? 'not measured' : `${Math.round(value * 1000) / 10}%`;
  const rows = report.rows.slice(0, 25);
  const rowLimitNote = report.rows.length > rows.length ? `<p>Showing the first ${rows.length} rows by measured sessions; the saved report retains ${report.rows.length} rows.</p>` : '';
  const rowsHtml = rows.length
    ? '<div class="venture-table-wrap"><table class="venture-action-table"><thead><tr><th>Source / platform</th><th>Landing content</th><th>Measured sessions</th><th>New signups</th><th>Signup rate</th><th>Survey completions</th></tr></thead><tbody>'
      + rows.map(row => '<tr><th scope="row">'+esc(row.platform+' / '+row.medium)+'<br><small>'+esc(row.campaign+' · '+row.variantId)+'</small></th><td>'+esc(row.landingPath)+'</td><td>'+esc(row.measuredSessions)+'</td><td>'+esc(row.newSignups)+'</td><td>'+esc(percentageText(row.signupRate))+'</td><td>'+esc(row.surveyCompletions)+'</td></tr>').join('')
      + '</tbody></table></div>'
    : '<p>No measured source-to-landing rows were recorded in this range.</p>';
  const needs = Object.entries(report.needs).flatMap(([field, value]) => value.categories.map(category => ({ field, category })));
  const needsHtml = needs.length
    ? '<div class="venture-table-wrap"><table class="venture-action-table"><thead><tr><th>Survey field</th><th>Saved choice</th><th>Responses</th><th>Share</th></tr></thead><tbody>'
      + needs.map(({ field, category }) => '<tr><th scope="row">'+esc(field)+'</th><td>'+esc(category.answer)+'</td><td>'+esc(category.count)+'</td><td>'+esc(percentageText(category.share))+'</td></tr>').join('')
      + '</tbody></table></div>'
    : '<p>No saved survey choices were recorded in this range.</p>';
  return '<section class="website-analytics-report"><h4>Measured website funnel</h4><p>Range '+esc(report.range.from)+' to '+esc(report.range.to)+' ('+esc(report.range.timezone)+') · captured '+esc(report.capturedAt)+'. Existing audience: '+esc(report.audience.total)+' records, '+esc(report.audience.active)+' active, '+esc(report.audience.surveyCompletions)+' saved survey completions. Origin counts: '+esc(report.audience.origin.website)+' website · '+esc(report.audience.origin.imported)+' imported · '+esc(report.audience.origin.unknown)+' unknown.</p>'
    + '<p>Measured sessions: '+esc(report.coverage.measuredSessions)+' · unattributed sessions: '+esc(report.coverage.unattributedSessions)+' · new signups without a measured session: '+esc(report.coverage.newSignupsWithoutSession)+'. These aggregate rows do not expose subscriber details or free-text answers.</p>'
    + '<p>Flow diagnostics: newsletter form starts: '+esc(report.coverage.newsletterFormStarts)+' · newsletter submit attempts: '+esc(report.coverage.newsletterFormSubmits)+' · survey starts: '+esc(report.coverage.surveyStarts)+' · saved new-cohort survey completions: '+esc(report.coverage.newCohortSurveyCompletions)+'. These are diagnostic client signals; browser blocking and repeated attempts can affect them. Saved outcomes remain authoritative.</p>'
    + rowsHtml + rowLimitNote + '<h4>Saved audience needs</h4>'+needsHtml+'</section>';
}

export function ventureActionsHtml(series: VentureSeries[], measurement: WebsiteMeasurement | null, esc: (s: unknown) => string, report?: WebsiteAnalyticsReport | null): string {
  if (!series.length) return '';
  const funnelStatus = measurement?.source === 'website-analytics-api' && measurement.measuredSessions !== undefined
    ? 'Aggregate funnel retrieved: '+measurement.measuredSessions+' measured sessions · '+(measurement.newSignups||0)+' new signups · '+(measurement.newSignupSessions||0)+' signup sessions.'
    : measurement
      ? 'Website totals retrieved: '+measurement.signups+' subscriber records, '+measurement.surveyCompletions+' completed surveys. Records may include imports; new website signups are not separated yet. These are not conversions attributed to these posts.'
      : 'Setup needed: the website stores signups and survey completions, but no aggregate has been retrieved yet. The database connection is needed for a read-only count.';
  return '<section class="venture-progress"><h2>Now: test audience response</h2><p>Your research plan is approved. Use the existing posts, prepare a small set of adaptations, and collect evidence. No new proposal is needed to do this work.</p>'
    + series.map(s => '<h3>'+esc(s.title)+'</h3><div class="venture-table-wrap"><table class="venture-action-table"><thead><tr><th>Action</th><th>Status</th><th>Do next</th></tr></thead><tbody>'
      + '<tr><th scope="row">Match the existing posts</th><td>'+s.posts.length+' sources saved; '+s.posts.filter(p=>p.matches?.length).length+' matched to imported results</td><td>Publication links still need matching. Scheduling is owner-reported.</td></tr>'
      + '<tr><th scope="row">Prepare additional channels</th><td>'+s.posts.reduce((n,p)=>n+(p.draftCount||0),0)+' Content review rows</td><td>Open a source below. Start with at most two posts for LinkedIn and Bluesky. Nothing republishes to Substack.</td></tr>'
      + '<tr><th scope="row">Connect website measurements</th><td>'+funnelStatus
      + '</td><td><button type="button" data-website-refresh>Refresh website totals</button><p>Read-only live database query. Page visits and per-post attribution still need website integration.</p>'+(measurement?'<p>Last retrieved '+esc(measurement.capturedAt)+'</p>':'')+'</td></tr>'
      + '<tr><th scope="row">Review existing audience evidence</th><td>Available independently of this test</td><td><button type="button" data-venture-signals="existing">Review existing results</button> Older posts can inform audience and platform questions, but do not prove these hypotheses.</td></tr>'
      + '<tr><th scope="row">Read this test\'s results</th><td>Waiting for matched evidence</td><td><button type="button" data-venture-signals>Open this test in Signals</button></td></tr></tbody></table></div>'
      + '<h3>Content to adapt</h3><div class="venture-table-wrap"><table class="venture-action-table"><thead><tr><th>Source</th><th>Content status</th><th>Analytics match</th></tr></thead><tbody>'
      + s.posts.map(p => '<tr><th scope="row"><button type="button" data-venture-content="'+esc(p.contentSlug)+'">'+esc(p.title)+'</button></th><td>'+(p.draftCount===undefined?'Source needs checking':p.draftCount?p.draftCount+' review rows':'Ready to configure; no drafts yet')+'</td><td>'+(p.matches?.length?p.matches.length+' imported records':'Not matched yet')+'</td></tr>').join('')+'</tbody></table></div>'
      + '<h3>Questions we are testing</h3><ul>'+s.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>').join('')
    + websiteAnalyticsReportHtml(report, esc)
    + '<p><strong>Then:</strong> wait for evidence and review what to continue or change. The 14-day outline is a guide, not a requirement to keep generating proposals. Phase completion and advancement still need their recorded evidence and your review.</p>'
    + '<button type="button" data-venture-documents>Read the approved research plan</button> <button type="button" data-venture-history>Context and workflow details</button></section>';
}

export function ventureSeriesSignalsHtml(series: VentureSeries[], measurement: WebsiteMeasurement | null, esc: (s: unknown) => string, report?: WebsiteAnalyticsReport | null): string {
  if (!series.length) return report ? websiteAnalyticsReportHtml(report, esc) : '';
  const funnelStatus = measurement?.source === 'website-analytics-api' && measurement.measuredSessions !== undefined
    ? '<p>Aggregate funnel: '+measurement.measuredSessions+' measured sessions · '+(measurement.newSignups||0)+' new signups · '+(measurement.newSignupSessions||0)+' signup sessions.</p>'
    : '';
  return '<section><h3>Venture tests already underway</h3>'+series.map(s=>'<h4>'+esc(s.title)+'</h4><p>'+s.posts.length+' existing source posts linked from '+esc(s.ventureSlug)+'. Exploratory series, not a controlled comparison.</p><ul>'
    + s.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul><p>Source matching: '+s.posts.filter(p=>p.matches?.length).length+' of '+s.posts.length+' have an exact text match in imported analytics. No result or winning platform is inferred.</p><ul>'+s.posts.map(p=>'<li>'+esc(p.title)+' · '+(p.matches?.length?p.matches.map(m=>esc(m.platform)+' #'+m.id+' ('+esc(m.postedAt||'date unknown')+')').join(', '):'awaiting matching publication record')+'</li>').join('')+'</ul><button type="button" class="sig-venture-open" data-slug="'+esc(s.ventureSlug)+'">Open Venture actions</button>').join('')
    + '<h4>Website measurement status</h4>'+(measurement ? '<p>'+measurement.signups+' subscriber records · '+measurement.surveyCompletions+' completed surveys · '+measurement.activeSubscribers+' active subscribers.</p>'+funnelStatus+'<p>Site-wide database snapshot captured '+esc(measurement.capturedAt)+'. Earliest stored subscription timestamp: '+esc(measurement.firstSignupAt||'none')+'. Not attributed to this test. Survey completion is a saved submission, not a qualified response or proof of demand.</p>' : '<p>Signups and survey completions are stored by the website. Connection pending; no counts retrieved.</p>')
    + websiteAnalyticsReportHtml(report, esc)
    + '<button type="button" data-website-refresh>Refresh website totals</button><p>Queries the live website database on request. Page visits: not connected. Per-post conversions: not attributed. Raw subscriber details and survey answers are not shared here.</p></section>';
}
