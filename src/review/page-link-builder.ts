const PLATFORM_OPTIONS = ["linkedin", "x", "threads", "bluesky", "substack", "email"];
const MEDIUM_OPTIONS = ["social", "email", "newsletter"];

// Every option value below is a fixed literal from the handoff doc, not user data — no escaping needed.
export function linkBuilderPanelHtml(): string {
  return '<section class="website-link-builder"><h4>Make a tagged link</h4>'
    + '<p>Pick a destination and labels, then copy the tagged link. Nothing is sent anywhere.</p>'
    + '<label>Destination<br><input type="text" id="wlbDestination" placeholder="/essays/your-slug or a full humaninference.ai URL"></label><br>'
    + '<label>Platform<br><select id="wlbPlatform">'
      + PLATFORM_OPTIONS.map(p => '<option value="'+p+'">'+p+'</option>').join('')
      + '<option value="__other">Other…</option></select> '
    + '<input type="text" id="wlbPlatformOther" placeholder="platform" hidden></label><br>'
    + '<label>Medium<br><select id="wlbMedium">'
      + MEDIUM_OPTIONS.map(m => '<option value="'+m+'">'+m+'</option>').join('')
      + '<option value="__other">Other…</option></select> '
    + '<input type="text" id="wlbMediumOther" placeholder="medium" hidden></label><br>'
    + '<label>Campaign<br><input type="text" id="wlbCampaign" placeholder="magic-outcomes"></label><br>'
    + '<label>Variant ID<br><input type="text" id="wlbVariantId" placeholder="Studio variant ID"></label><br>'
    + '<label>Source-post ID<br><input type="text" id="wlbSourcePostId" placeholder="Studio source ID"></label><br>'
    + '<button type="button" data-link-builder-build>Build link</button>'
    + '<div id="wlbErrors" class="aierr" hidden></div>'
    + '<div id="wlbResult" hidden><p><code id="wlbUrl"></code></p><button type="button" data-link-builder-copy>Copy</button></div>'
    + '</section>';
}
