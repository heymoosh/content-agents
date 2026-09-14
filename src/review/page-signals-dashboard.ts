// Shared browser source, exercised directly by the renderer tests. No duplicate test-only mirror.
export const SIGNALS_DASHBOARD_SCRIPT = String.raw`
function signalsExperimentStatus(plan, performance, interpretation){
  if(plan.status==='proposed') return 'Plan needs your approval';
  if(plan.status==='plan-approved') return 'Plan approved; draft creation still needed';
  if(plan.status==='declined'||plan.status==='deferred') return displayLabel(plan.status);
  if(interpretation) return interpretation.reviewStatus==='pending'?'Learning ready for your review':interpretation.reviewStatus==='accepted'?'Learning recorded':'Interpretation rejected';
  if(performance&&performance.analysisStatus==='ready') return 'Results ready to interpret';
  if(performance&&performance.analysisStatus==='collecting') return 'Awaiting delivery or sufficient measurements';
  if(performance) return displayLabel(performance.analysisStatus);
  return plan.status==='drafts-pending-content-review'?'Drafts sent to Content; check review and delivery':displayLabel(plan.status);
}
function signalsPerformanceHtml(read){
  const e=esc;
  if(!read) return '<p>Loading performance…</p>';
  if(read.error) return '<p role="alert">Could not load performance. '+e(read.error)+'</p><p>Use Refresh the dashboard to retry. This is not a zero result.</p>';
  const date=v=>v?String(v).slice(0,10):'not recorded';
  const number=v=>v==null?'Not measured':groupDigits(v);
  const metric=m=>number(m.value)+'<small>'+m.measured+' posts measured'+(m.missing?' · '+m.missing+' missing':'')+'</small>';
  if(!read.posts) return '<h3>No content measurements for this brand yet</h3><p>Import analytics for this brand to see how its posts performed. Publishing content alone does not import its results.</p><button type="button" data-set-sig-pane="raw">View analytics sources</button>'+(read.excludedUnassigned?'<p class="sig-meta">'+read.excludedUnassigned+' older posts have no brand assignment and are excluded.</p>':'');
  const coverage='<p class="sig-meta">All recorded posts: '+e(date(read.firstPost))+' to '+e(date(read.lastPost))+'. Latest metric capture: '+e(date(read.latestCapture))+'.</p>';
  const missing=read.posts-read.measuredPosts;
  const intro='<h3>How is my content performing?</h3>'+coverage+'<p>'+read.posts+' posts on record; '+read.measuredPosts+' have imported results.'+(missing?' Results are still missing for '+missing+' posts.':'')+'</p>';
  const table='<div class="sig-table-wrap"><table class="sig-table"><thead><tr><th>Platform</th><th>Posts</th><th>Recorded impressions</th><th>Recorded replies</th></tr></thead><tbody>'+read.platforms.map(p=>'<tr><th scope="row">'+e(displayLabel(p.platform))+'</th><td>'+p.posts+'</td><td>'+metric(p.impressions)+'</td><td>'+metric(p.replies)+'</td></tr>').join('')+'</tbody></table></div><p class="sig-meta">Totals use each post’s latest snapshot, not a sum of repeat imports. Different platforms and post ages are not directly comparable. These are recorded outcomes, not a ranking of platform fit.</p>';
  const breakdown=(title,groups)=>'<h4>'+title+'</h4>'+(groups.length?'<div class="sig-table-wrap"><table class="sig-table"><thead><tr><th>Group</th><th>Posts</th><th>Replies per measured post</th><th>Sample</th></tr></thead><tbody>'+groups.map(g=>'<tr><th scope="row">'+e(displayLabel(g.label))+'</th><td>'+g.posts+'</td><td>'+(g.replies.measured?e(String(Math.round(g.replies.value/g.replies.measured*10)/10)):'Not measured')+'</td><td>'+g.replies.measured+' measured'+(g.replies.missing?' · '+g.replies.missing+' missing':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p>No tags recorded for this comparison.</p>');
  const platforms=read.platforms.map(p=>'<details class="sig-detail"><summary>'+e(displayLabel(p.platform))+': posts, topics and formats</summary><p>Examples with the most recorded replies on this platform. Ties are not evidence of a winner; reach, post age and sample size may differ.</p>'+ (p.examples.length?p.examples.map(x=>{
    const safe=/^https?:\/\//i.test(x.url||'');
    return '<article class="sig-post"><p>'+(safe?'<a href="'+e(x.url)+'" target="_blank" rel="noopener noreferrer">'+e(x.text)+'</a>':e(x.text))+'</p><small>'+number(x.replies)+' replies · '+number(x.impressions)+' impressions · posted '+e(date(x.postedAt))+' · measured '+e(date(x.capturedAt))+'</small></article>';
  }).join(''):'<p>No post-level reply counts imported yet.</p>')+breakdown('Which topics are getting replies?',p.topics)+(p.untagged?'<p>'+p.untagged+' posts have no topic tag and are excluded from topic comparisons.</p>':'')+breakdown('How do formats compare?',p.formats)+'<p class="sig-meta">Descriptive averages only. This is not a controlled test of topic or format.</p></details>').join('');
  const standouts=read.platforms.filter(p=>p.examples[0]&&p.examples[0].replies>0).slice(0,3).map(p=>{
    const x=p.examples[0];const safe=/^https?:\/\//i.test(x.url||'');
    return '<article class="sig-post"><p><strong>'+e(displayLabel(p.platform))+': '+number(x.replies)+' replies.</strong> This is one of the posts with the most recorded replies among '+p.replies.measured+' measured posts on this platform.</p><p>'+(safe?'<a href="'+e(x.url)+'" target="_blank" rel="noopener noreferrer">'+e(x.text)+'</a>':e(x.text))+'</p></article>';
  }).join('');
  return intro+table+'<h3>What are people responding to?</h3>'+standouts+(standouts?'<p class="sig-meta">Observed examples, not proof of what caused the response. Expand a platform for dates, more posts and comparisons.</p>':'<p>No positive post-level reply counts to highlight yet. Other recorded outcomes are shown below.</p>')+platforms+'<p class="sig-meta">Framing, posting-time and conversion recommendations need their own evidence. Ask for analysis below; no recommendation changes your settings automatically.</p>';
}
function signalsOutcomeCardsHtml(read){
  if(!read) return '<p>Loading outcomes…</p>';
  if(read.error) return '<p role="alert">Outcome measurements are unavailable: '+esc(read.error)+'</p><p>Post performance above is independent. No missing outcomes have been counted as zero.</p>';
  const questions={attention:'Did people see it?',conversation:'Did people engage?',audience:'Did the audience grow?',business:'Did it create opportunities or sales?'};
  return '<h3>What did that attention lead to?</h3><p>A quiet post can still bring a valuable inquiry. These four outcomes stay separate.</p><div class="sig-outcomes">'+FAMILY_METRICS.map(([key,metrics])=>{
    const fam=read[key]; if(!fam) return '';
    const present=metrics.filter(([name])=>fam[name]);
    const measured=present.filter(([name])=>fam[name].state==='measured'&&fam[name].records_measured>0);
    const absent=present.filter(([name])=>!measured.some(([m])=>m===name));
    return '<section class="sig-outcome"><h4>'+esc(displayLabel(key))+'</h4><p>'+questions[key]+'</p>'+(measured.length?'<dl>'+measured.map(([name,label])=>'<div><dt>'+esc(displayLabel(label.toLowerCase()))+'</dt><dd>'+esc(groupDigits(fam[name].value))+'</dd></div>').join('')+'</dl>':'<p>No measurements imported yet.</p>')+(absent.length?'<p class="sig-meta">Not measured: '+absent.map(([,label])=>esc(label.toLowerCase())).join(', ')+'.</p>':'')+'<details><summary>Evidence and coverage</summary>'+present.map(([name,label])=>'<p><strong>'+esc(displayLabel(label.toLowerCase()))+':</strong> '+esc(metricLine(fam[name]).note)+'</p>').join('')+'</details></section>';
  }).join('')+'</div><details class="sig-detail"><summary>Data coverage and limitations</summary><p>The platform history check below is a minimum guard, not proof of a reliable comparison. Metric coverage and sample size still matter.</p>'+ (read.confidence||[]).map(c=>'<p><strong>'+esc(displayLabel(c.platform))+':</strong> '+c.posts+' posts · '+c.weeks+' weeks · '+(c.sufficient?'clears the four-week history minimum':'less than four weeks; directional only')+'</p>').join('')+'<p>Totals span the available records for each measure; follower totals and changes use audience snapshots, not a single shared reporting window. Outcomes are not automatically attributable to an individual post.</p><p>Unassigned legacy records excluded: '+esc(Object.entries(read.excluded_unassigned||{}).map(([k,v])=>k+' '+v).join(', '))+'.</p></details>';
}
`;
