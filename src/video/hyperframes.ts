import { writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

// The `--motion` engine's renderer. HyperFrames (HeyGen, Apache-2.0) turns HTML/CSS/JS into a
// deterministic MP4 via headless Chrome — free, local, frame-accurate. We use it for the SILENT
// motion-graphics VISUAL (scene stills choreographed with Ken Burns + crossfades); the Kokoro
// voice + captions are layered on afterward by the existing Remotion AnimatedShort composition.
// Pinned to the same version the bake-off used so renders stay reproducible.
const HF_VERSION = "0.7.5";

// Build a HyperFrames composition (index.html) that sequences the scene stills: each is a
// full-frame layer with a slow Ken Burns push (alternating direction), and each successive scene
// crossfades in over the previous. No CSS filters — they trip HyperFrames' capture size limit.
function buildMotionComposition(stillNames: string[], durationMs: number): string {
  const totalSec = durationMs / 1000;
  const n = stillNames.length;
  const sceneSec = totalSec / n;
  const fade = Math.min(0.7, sceneSec * 0.4);

  const layers = stillNames
    .map(
      (name, i) =>
        `      <div class="scene" id="scene-${i}"><img src="assets/${name}" alt="" /></div>`
    )
    .join("\n");

  const tweens = stillNames
    .map((_, i) => {
      const start = i * sceneSec;
      const zoomIn = i % 2 === 0;
      const fromS = zoomIn ? 1.0 : 1.1;
      const toS = zoomIn ? 1.1 : 1.0;
      const panX = i % 2 === 0 ? 2.2 : -2.2;
      // continuous Ken Burns across the whole piece (keeps motion alive under the crossfades)
      const ken = `tl.fromTo("#scene-${i} img", { scale: ${fromS}, xPercent: ${-panX} }, { scale: ${toS}, xPercent: ${panX}, duration: ${totalSec.toFixed(2)}, ease: "none" }, 0);`;
      // scene 0 starts visible; each later scene fades in over the previous (later DOM = on top)
      const fadeIn =
        i === 0
          ? `gsap.set("#scene-0", { opacity: 1 });`
          : `gsap.set("#scene-${i}", { opacity: 0 });\n      tl.to("#scene-${i}", { opacity: 1, duration: ${fade.toFixed(2)}, ease: "power1.inOut" }, ${Math.max(0, start - fade / 2).toFixed(2)});`;
      return `      ${ken}\n      ${fadeIn}`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #f2ead9; }
      #card { width: 1080px; height: 1920px; position: relative; overflow: hidden; }
      .scene { position: absolute; inset: 0; width: 1080px; height: 1920px; }
      .scene img { width: 1080px; height: 1920px; object-fit: cover; display: block; }
    </style>
  </head>
  <body>
    <div id="card" data-composition-id="main" data-start="0" data-duration="${totalSec.toFixed(2)}" data-width="1080" data-height="1920">
${layers}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweens}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const HF_CONFIG = JSON.stringify(
  {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  },
  null,
  2
);

export interface CardData {
  quote: string;
  attribution: string;
  source?: string;
  paper: string;
  ink: string;
  accent: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Build a HyperFrames composition for a square (1:1) quote card — word-by-word slot reveal.
// Each WORD lives inside an overflow:hidden slot and rises up through it as a unit.
// No fading, no character splitting — one whole word appears at a time, at reading pace.
// Quote mark drops with elastic bounce → words build one per slot at ~0.30 s each →
// teal rule wipes in → byline settles. Matches the static Remotion card design exactly.
function buildCardMotionComposition(data: CardData, durationMs: number): string {
  const len = data.quote.length;
  const words = data.quote.trim().split(/\s+/);
  const wordCount = words.length;
  const fontSize = len > 160 ? 50 : len > 110 ? 60 : len > 70 ? 72 : 88;
  // Slot height clips each word as it rises — line-height px + descender room
  const slotH = Math.round(fontSize * 1.45);
  const serif = "'Didot', 'Bodoni 72', 'Hoefler Text', Georgia, 'Times New Roman', serif";
  const hasSource = !!(data.source && data.source.length > 0);

  // Each word is an overflow:hidden slot (.ws); the word itself (.wc) rises up through it.
  // Spaces between .ws spans are real text nodes so lines wrap naturally.
  const wordHtml = words
    .map((w) => `<span class="ws"><span class="wc">${esc(w)}</span></span>`)
    .join(" ");

  // Timing: one word every 0.30 s at reading pace
  const wordStagger = 0.30;
  const wordDur = 0.32;
  const wordsStart = 0.35;
  const lastWordStart = wordsStart + (wordCount - 1) * wordStagger;
  const wordsEnd = lastWordStart + wordDur;
  const ruleAt = wordsEnd + 0.20;
  const bylineAt = ruleAt + 0.42;
  const minSec = bylineAt + 0.38 + (hasSource ? 0.40 : 0) + 3.2;
  const totalSec = Math.max(durationMs / 1000, minSec);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1080px; overflow: hidden; background: ${data.paper}; }
      #card { width: 1080px; height: 1080px; position: relative; display: flex; justify-content: center; align-items: center; }
      #b1 { position: absolute; inset: 44px; border: 1.5px solid ${data.ink}; }
      #b2 { position: absolute; inset: 52px; border: 0.75px solid ${data.ink}; opacity: 0.55; }
      #cb { position: relative; max-width: 820px; padding: 0 80px; text-align: center; color: ${data.ink}; }
      #qm { font-family: ${serif}; font-size: 116px; line-height: 0.66; color: ${data.accent}; height: 64px; margin-bottom: 6px; }
      #qt { font-family: ${serif}; font-size: ${fontSize}px; line-height: 1.32; font-weight: 400; letter-spacing: 0.005em; }
      .ws { display: inline-block; overflow: hidden; vertical-align: bottom; height: ${slotH}px; }
      .wc { display: inline-block; white-space: nowrap; }
      #rl { width: 56px; height: 2px; background: ${data.accent}; margin: 48px auto 22px; }
      #at { font-family: ${serif}; font-size: 26px; text-transform: uppercase; letter-spacing: 0.32em; color: ${data.ink}; padding-left: 0.32em; }
      ${hasSource ? `#sl { position: absolute; bottom: 80px; left: 0; right: 0; text-align: center; font-family: ${serif}; font-size: 32px; text-transform: uppercase; letter-spacing: 0.08em; color: ${data.ink}; white-space: nowrap; }` : ""}
    </style>
  </head>
  <body>
    <div id="card" data-composition-id="main" data-start="0" data-duration="${totalSec.toFixed(2)}" data-width="1080" data-height="1080">
      <div id="b1"></div>
      <div id="b2"></div>
      <div id="cb">
        <div id="qm">&ldquo;</div>
        <div id="qt">${wordHtml}</div>
        <div id="rl"></div>
        <div id="at">${esc(data.attribution)}</div>
      </div>
      ${hasSource ? `<div id="sl">${esc(data.source!)}</div>` : ""}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // Each word starts below its slot (hidden by overflow:hidden on .ws)
      gsap.set(".wc", { y: "110%" });
      gsap.set("#qm", { opacity: 0, y: -55, transformOrigin: "50% 100%" });
      gsap.set("#rl", { scaleX: 0, opacity: 0, transformOrigin: "0% 50%" });
      gsap.set("#at", { opacity: 0, y: 18 });
      ${hasSource ? 'gsap.set("#sl", { opacity: 0 });' : ""}

      // Quote mark drops from above with elastic bounce
      tl.to("#qm", { opacity: 1, y: 0, duration: 0.30, ease: "elastic.out(1.1, 0.55)" }, 0.0);
      // Each word rises through its slot — one per 0.30 s, matching reading pace
      tl.to(".wc", { y: "0%", duration: ${wordDur.toFixed(2)}, stagger: ${wordStagger.toFixed(2)}, ease: "power3.out" }, ${wordsStart.toFixed(2)});
      // Teal rule wipes in from the left
      tl.to("#rl", { opacity: 1, scaleX: 1, duration: 0.30, ease: "power3.out" }, ${ruleAt.toFixed(2)});
      // Byline rises in
      tl.to("#at", { opacity: 0.8, y: 0, duration: 0.36, ease: "power2.out" }, ${bylineAt.toFixed(2)});
      ${hasSource ? `tl.to("#sl", { opacity: 0.55, duration: 0.32, ease: "power1.in" }, ${(bylineAt + 0.42).toFixed(2)});` : ""}
      // Anchor end
      tl.to("#card", { opacity: 1, duration: 0.001 }, ${(totalSec - 0.001).toFixed(3)});

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}


// Render an animated MP4 companion for a quote card from its text content — kinetic typographic
// reveal, no image. Free, local, deterministic — same HyperFrames toolchain as renderMotionBg.
// Default 5 s: snappy editorial reveal (text animates in over ~2.5s) + 2.5s reading hold.
export function renderCardAnimation(data: CardData, outPath: string, durationMs = 5_000): void {
  const proj = join(tmpdir(), `hf-card-${Date.now().toString(36)}`);
  const assets = join(proj, "assets");
  mkdirSync(assets, { recursive: true });
  try {
    writeFileSync(join(proj, "hyperframes.json"), HF_CONFIG);
    writeFileSync(join(proj, "index.html"), buildCardMotionComposition(data, durationMs));
    execFileSync("npx", ["--yes", `hyperframes@${HF_VERSION}`, "render"], {
      cwd: proj,
      stdio: ["ignore", "inherit", "inherit"],
    });
    const rendersDir = join(proj, "renders");
    const mp4 = existsSync(rendersDir)
      ? readdirSync(rendersDir)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => join(rendersDir, f))
          .sort()
          .pop()
      : undefined;
    if (!mp4) throw new Error(`HyperFrames produced no mp4 in ${rendersDir}`);
    copyFileSync(mp4, outPath);
    console.log(`hyperframes: animated card → ${basename(outPath)}`);
  } finally {
    rmSync(proj, { recursive: true, force: true });
  }
}

// Render the silent motion-graphics visual from the scene stills to `outPath` (an mp4).
export function renderMotionBg(stillPaths: string[], durationMs: number, outPath: string): void {
  const proj = join(tmpdir(), `hf-motion-${Date.now().toString(36)}`);
  const assets = join(proj, "assets");
  mkdirSync(assets, { recursive: true });
  try {
    const names = stillPaths.map((p, i) => {
      const name = `still-${i}.png`;
      copyFileSync(p, join(assets, name));
      return name;
    });
    writeFileSync(join(proj, "hyperframes.json"), HF_CONFIG);
    writeFileSync(join(proj, "index.html"), buildMotionComposition(names, durationMs));

    execFileSync("npx", ["--yes", `hyperframes@${HF_VERSION}`, "render"], {
      cwd: proj,
      stdio: ["ignore", "inherit", "inherit"],
    });

    const rendersDir = join(proj, "renders");
    const mp4 = existsSync(rendersDir)
      ? readdirSync(rendersDir)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => join(rendersDir, f))
          .sort()
          .pop()
      : undefined;
    if (!mp4) throw new Error(`HyperFrames produced no mp4 in ${rendersDir}`);
    copyFileSync(mp4, outPath);
    console.log(`hyperframes: motion visual → ${basename(outPath)}`);
  } finally {
    rmSync(proj, { recursive: true, force: true });
  }
}
