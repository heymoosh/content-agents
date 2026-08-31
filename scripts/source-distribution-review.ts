import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recommendSourceDistribution } from "../src/review/source-distribution.js";

const sources = [
  { name: "The World's Broken. What Do We Do?", kind: "essay", path: "/Users/Muxin/Documents/Personal Obsidian/Branding/Content/Ideas/The world's broken. What do we do?.md" },
  { name: "Pursuit of Happiness", kind: "essay", path: "/Users/Muxin/Documents/Personal Obsidian/Branding/Content/Ideas/Pursuit of Happiness.md" },
  { name: "Edison and failure", kind: "substack-note", path: "/private/tmp/substack-note-edison.md" },
] as const;

const esc = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const cards = sources.map((source) => {
  const body = readFileSync(source.path, "utf8");
  const result = recommendSourceDistribution({ body, sourceKind: source.kind });
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const platforms = result.platforms.map((item) => `<div class="choice"><span class="pill platform">${esc(item.option)}</span><p>${esc(item.reason)}${item.requiredMedia ? `<small>Requires: ${esc(item.requiredMedia)}</small>` : ""}</p></div>`).join("");
  const media = result.media.length
    ? result.media.map((item) => `<div class="choice"><span class="pill media">${esc(item.option)}</span><p>${esc(item.reason)}</p></div>`).join("")
    : `<div class="choice"><span class="pill none">text only</span><p>${esc(result.mediaRationale)}</p></div>`;
  return `<article><div class="kicker">${esc(source.kind)} · ${words.toLocaleString()} words · inferred ${esc(result.topic)}</div><h2>${esc(source.name)}</h2><h3>Publish here</h3>${platforms}<h3>Use this media</h3>${media}<div class="evidence">Recommendation basis: Source fit. Existing routing and measured performance remain stronger when available.</div></article>`;
}).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source-aware distribution review</title><style>
:root{--ink:#24211c;--muted:#716a5e;--paper:#f5f0e6;--card:#fffdf8;--line:#ded4c1;--blue:#dbeafa;--green:#dff0e5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,sans-serif}main{max-width:980px;margin:0 auto;padding:48px 22px 72px}h1{font:700 38px/1.1 Georgia,serif;margin:0 0 12px}.intro{max-width:760px;color:var(--muted);margin-bottom:28px}.grid{display:grid;gap:20px}article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px;box-shadow:0 8px 22px #56481710}h2{font:700 27px/1.2 Georgia,serif;margin:5px 0 23px}h3{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:22px 0 9px}.kicker,.evidence{font-size:13px;color:var(--muted)}.choice{display:grid;grid-template-columns:145px 1fr;gap:14px;padding:12px 0;border-top:1px solid #eee7d9}.choice p{margin:0}.choice small{display:block;color:var(--muted);margin-top:4px}.pill{display:inline-flex;align-self:start;width:max-content;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700}.platform{background:var(--blue)}.media{background:var(--green)}.none{background:#ece8df}.evidence{margin-top:21px;padding-top:14px;border-top:1px solid var(--line)}@media(max-width:600px){.choice{grid-template-columns:1fr}main{padding-top:30px}}
</style></head><body><main><h1>Where the system would publish each source</h1><p class="intro">This review excludes treatments and generated copy. It evaluates every configured downstream destination, including text, visual, and video-first channels. It does not recommend reposting to the source channel itself. Visual and video destinations name the media transformation they require. Final delivery still fails closed unless a connected provider advertises that destination and media capability.</p><div class="grid">${cards}</div></main></body></html>`;
const output = resolve(process.argv[2] ?? "docs/reviews/source-distribution-recommendations-review.html");
writeFileSync(output, html);
console.log(output);
