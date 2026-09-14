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
