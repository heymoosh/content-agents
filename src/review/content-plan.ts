export interface ContentTestPlan {
  readonly id: string;
  readonly title: string;
  readonly why?: string;
  readonly platforms: readonly string[];
  readonly media: readonly string[];
  readonly treatments: readonly string[];
}

/** Shared by the browser preview and server. Keys describe outputs, never authority. */
export function contentPlanOutputs(plans: readonly ContentTestPlan[], control: boolean) {
  const outputs = new Map<string, { key: string; platform: string; media: string; treatment: string | null }>();
  for (const plan of plans) for (const platform of plan.platforms) for (const media of plan.media.length ? plan.media : ['none']) {
    for (const treatment of [...(control ? [null] : []), ...plan.treatments]) {
      const key = JSON.stringify([platform, media, treatment]);
      outputs.set(key, { key, platform, media, treatment });
    }
  }
  return [...outputs.values()];
}

/** Small, source-based starting points, not model output or measured winner claims.
 * Self-contained because the same function runs in the embedded browser. */
export function contentPlanIdeas(context: any, body: string) {
  if (!context?.ventureId || !context.questions?.length || !body.trim()) return [];
  const words = body.trim().split(/\s+/).length;
  return [
    { id: 'text', title: 'Explore the text channels',
      why: 'Test the same source across five text channels, with platform framing and a different opening. Compare reader response before narrowing distribution.',
      platforms: ['linkedin','bluesky','x','threads','mastodon'], media: [] as string[], treatments: ['platform-framing','hook-variants'] },
    ...(words >= 80 ? [{ id: 'visual', title: 'Try a visual version',
      why: 'Compare a verbatim quote card on Instagram, LinkedIn and Bluesky. It tests a visual presentation without requiring a new argument.',
      platforms: ['instagram','linkedin','bluesky'], media: ['static-quote-card'], treatments: ['platform-framing'] }] : []),
    ...(words >= 150 ? [{ id: 'video', title: 'Explore video audiences',
      why: 'Prepare short-video scripts for TikTok and YouTube from this source. Scripts need review and production before they are publishable videos.',
      platforms: ['tiktok','youtube'], media: ['short-video-script'], treatments: ['platform-framing'] }] : []),
  ];
}

/** Describes selections, not recommendations; never falsely attributes manual choices. */
export function contentPlanSummaryHtml(cfg: any, options: any, context: any, esc: (v:any)=>string): string {
  if (cfg.testPlans) {
    const outputs = contentPlanOutputs(cfg.testPlans, cfg.control);
    const selected = outputs.filter(x=>!cfg.excludedOutputs?.has(x.key));
    const controls = selected.filter(x=>x.treatment===null).length;
    return '<h3>Your combined plan</h3><ul>'+cfg.testPlans.map((plan:any)=>'<li><b>'+esc(plan.title)+'</b>: '+
      esc(plan.platforms.map((id:string)=>options.platform.find((o:any)=>o[0]===id)?.[1]||id).join(', '))+' · '+
      esc(plan.media.length?plan.media.map((id:string)=>options.media.find((o:any)=>o[0]===id)?.[1]||id).join(', '):'Text posts')+' · '+
      esc(plan.treatments.map((id:string)=>options.treatment.find((o:any)=>o[0]===id)?.[1]||id).join(', ')||'Original source only')+'</li>').join('')+'</ul>'+
      '<p><b>'+selected.length+' draft variants</b>: '+controls+' source-preserving controls + '+(selected.length-controls)+' treated versions. Shared outputs are created once. Each test keeps its own combinations.</p>'+
      '<details><summary>Review outputs or remove individual drafts ('+selected.length+' selected)</summary><p>Uncheck any output to leave it out. This does not delete drafts already created.</p><table><thead><tr><th>Include</th><th>Platform</th><th>Format</th><th>Angle</th></tr></thead><tbody>'+
      outputs.map(x=>'<tr><td><input type="checkbox" data-plan-output="'+esc(x.key)+'" aria-label="Include '+esc([x.platform,x.media,x.treatment||'control'].join(' '))+'"'+(!cfg.excludedOutputs?.has(x.key)?' checked':'')+(cfg.saving?' disabled':'')+'></td><td>'+esc(options.platform.find((o:any)=>o[0]===x.platform)?.[1]||x.platform)+'</td><td>'+esc(options.media.find((o:any)=>o[0]===x.media)?.[1]||(x.media==='none'?'Text':x.media))+'</td><td>'+esc(options.treatment.find((o:any)=>o[0]===x.treatment)?.[1]||'Untreated control')+'</td></tr>').join('')+'</tbody></table></details>'+
      '<p>Exploratory comparisons, not proof of causation. Video scripts still need review and production.</p>';
  }
  const platforms = [...cfg.platform].map(id => options.platform.find((o:any)=>o[0]===id)?.[1] || id).join(', ');
  const formats = [...cfg.media].map(id => options.media.find((o:any)=>o[0]===id)?.[1] || id).join(', ');
  const treatments = [...cfg.treatment].map(id => options.treatment.find((o:any)=>o[0]===id)?.[1] || id).join(', ');
  const media = [...cfg.media] as string[];
  const combinations = cfg.platform.size * Math.max(1, media.length);
  const controls = cfg.control ? combinations : 0;
  const treated = combinations * cfg.treatment.size;
  return '<h3>Your current plan</h3><ul><li><b>Where:</b> '+esc(platforms||'Choose a platform')+'</li>'+
    '<li><b>Create:</b> '+esc(formats||'Text posts')+'</li><li><b>Try:</b> '+esc(treatments||'Original source only')+'</li></ul>'+
    '<p><b>'+String(controls+treated)+' draft variants</b>: '+controls+' source-preserving controls + '+treated+' treated versions. Each format and angle multiplies the selected platforms.</p>'+
    (!cfg.control?'<p role="status">Controls are off in this saved plan. <button type="button" data-restore-control>Include controls</button></p>':'<p>The control keeps your original wording for comparison on each selected platform. An existing Substack post is not a control for a different platform. These comparisons are directional, not automatically a controlled experiment.</p>')+
    (context?.questions?.length?'<p><b>Venture is investigating:</b> '+esc(context.questions.slice(0,2).join(' '))+'</p>':'');
}
