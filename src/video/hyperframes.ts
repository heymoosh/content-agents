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
  // Optional verbatim span of `quote` to land in the accent color with a scale/weight pop.
  // MUST be a contiguous substring of `quote` (extraction-first: no composed copy). If absent
  // or not found, the card auto-picks the closing clause so every card still gets one accent beat.
  emphasis?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Normalize a token for emphasis matching (strip surrounding punctuation, lowercase).
function normWord(w: string): string {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for",
  "is", "are", "was", "were", "be", "been", "it", "its", "that", "this", "as", "from",
  "not", "no", "do", "does", "can", "we", "you", "they", "i", "he", "she", "with", "so",
  "what", "who", "which", "than", "then", "only", "have", "has", "had", "about",
]);

// Choose which words (by index) land in the accent color. Extraction-first: the phrase is always a
// contiguous run of words already in the quote. Prefer the caller's verbatim `emphasis`; else fall
// back to the quote's CLOSING clause (after the last sentence break, capped to a tidy 2–4 words),
// which is where Muxin's lines tend to land their point. Returns a Set of word indices to accent.
function pickEmphasisIndices(words: string[], emphasis?: string): Set<number> {
  const norm = words.map(normWord);
  // 1. Honor an explicit verbatim emphasis span if it matches a contiguous run.
  if (emphasis && emphasis.trim()) {
    const want = emphasis.trim().split(/\s+/).map(normWord).filter(Boolean);
    if (want.length) {
      for (let i = 0; i + want.length <= words.length; i++) {
        let ok = true;
        for (let j = 0; j < want.length; j++) {
          if (norm[i + j] !== want[j]) { ok = false; break; }
        }
        if (ok) {
          const out = new Set<number>();
          for (let j = 0; j < want.length; j++) out.add(i + j);
          return out;
        }
      }
    }
  }
  // 2. Fallback: the closing clause. Find the start of the final sentence/clause (after the last
  // word that ends in . ; : before the tail), then take its meaningful words (drop trailing stop
  // words), capped to the last 4 so the accent beat stays tight.
  let clauseStart = 0;
  for (let i = 0; i < words.length - 1; i++) {
    if (/[.;:]$/.test(words[i].trim())) clauseStart = i + 1;
  }
  let end = words.length - 1;
  while (end > clauseStart && STOP.has(norm[end])) end--; // drop trailing stop words
  let start = Math.max(clauseStart, end - 3);
  while (start < end && STOP.has(norm[start])) start++; // trim leading stop words
  const out = new Set<number>();
  for (let i = start; i <= end; i++) out.add(i);
  return out;
}

// A self-contained SVG film-grain tile as a data URI, used as a tiling background-image on the
// paper. feTurbulence is rendered INTO the bitmap (it is not a live CSS `filter:` on the captured
// node, which trips HyperFrames' size limit) — so it stays free, local, and capture-safe. The
// grain is faint (low opacity, fine fractal noise) so it reads as paper tooth, not static.
function grainDataUri(): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/></filter>` +
    `<rect width='160' height='160' filter='url(%23n)' opacity='0.05'/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

// Build a HyperFrames composition for a square (1:1) quote card — editorial print look + kinetic
// reveal. Screen-print paper (subtle grain + a warm vignette), a high-contrast display serif, an
// OVERSIZED accent quotation mark, a hairline rule + tracked "MUXIN LI" byline footer. Each word
// rises through an overflow:hidden slot AND fades in on eased timing (reading-pace stagger kept),
// then the chosen verbatim emphasis phrase lands in the accent color with a scale/weight pop and a
// hairline accent underline swipes beneath it. Matches the static Remotion card's DNA, dialed up.
function buildCardMotionComposition(data: CardData, durationMs: number): string {
  const len = data.quote.length;
  const words = data.quote.trim().split(/\s+/);
  const wordCount = words.length;
  const fontSize = len > 160 ? 50 : len > 110 ? 60 : len > 70 ? 72 : 88;
  // Slot height clips each word as it rises — line-height px + descender room
  const slotH = Math.round(fontSize * 1.45);
  const serif = "'Didot', 'Bodoni 72', 'Hoefler Text', Georgia, 'Times New Roman', serif";
  const hasSource = !!(data.source && data.source.length > 0);

  // Which words land in the accent color (extraction-first: always a contiguous verbatim run).
  const emph = pickEmphasisIndices(words, data.emphasis);
  // The accent-underline swipe spans only the emphasis run; place it as a flowing inline group so
  // the rule sits exactly under those words wherever they wrap.
  const emphIdx = [...emph].sort((a, b) => a - b);
  const emphStart = emphIdx[0];
  const emphEnd = emphIdx[emphIdx.length - 1];

  // Each word is an overflow:hidden slot (.ws); the word itself (.wc) rises + fades through it.
  // Emphasis words carry .em (accent color + heavier weight); the run is wrapped in #emph so one
  // underline swipe can sit under the whole phrase. Spaces between slots are real text nodes so
  // lines wrap naturally.
  let wordHtml = "";
  for (let i = 0; i < words.length; i++) {
    if (i === emphStart) wordHtml += `<span id="emph"><span id="emul"></span>`;
    const cls = emph.has(i) ? "ws em" : "ws";
    wordHtml += `<span class="${cls}"><span class="wc">${esc(words[i])}</span></span>`;
    if (i === emphEnd) wordHtml += `</span>`;
    if (i < words.length - 1) wordHtml += " ";
  }

  // Timing: one word every 0.30 s at reading pace
  const wordStagger = 0.30;
  const wordDur = 0.36;
  const wordsStart = 0.45;
  const lastWordStart = wordsStart + (wordCount - 1) * wordStagger;
  const wordsEnd = lastWordStart + wordDur;
  // The emphasis pop fires as its last word settles; underline swipes right after.
  const popAt = wordsStart + emphEnd * wordStagger + wordDur * 0.5;
  const emulAt = popAt + 0.18;
  const ruleAt = wordsEnd + 0.30;
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
      #card { width: 1080px; height: 1080px; position: relative; display: flex; justify-content: center; align-items: center; background: ${data.paper}; }
      /* Paper tooth: faint film grain tile + a warm vignette so the off-white reads as printed stock. */
      #grain { position: absolute; inset: 0; background-image: url("${grainDataUri()}"); background-repeat: repeat; opacity: 0.9; pointer-events: none; }
      #vig { position: absolute; inset: 0; background: radial-gradient(120% 120% at 50% 42%, transparent 55%, rgba(0,0,0,0.10) 100%); pointer-events: none; }
      #b1 { position: absolute; inset: 44px; border: 1.5px solid ${data.ink}; }
      #b2 { position: absolute; inset: 52px; border: 0.75px solid ${data.ink}; opacity: 0.55; }
      #cb { position: relative; max-width: 840px; padding: 0 80px; text-align: center; color: ${data.ink}; }
      /* Oversized opening quotation mark — the lead-in ornament, pulled tight above the quote. */
      #qm { font-family: ${serif}; font-size: 200px; line-height: 0.62; font-weight: 700; color: ${data.accent}; height: 96px; margin-bottom: 2px; }
      #qt { font-family: ${serif}; font-size: ${fontSize}px; line-height: 1.34; font-weight: 500; letter-spacing: 0.004em; }
      .ws { display: inline-block; overflow: hidden; vertical-align: bottom; height: ${slotH}px; }
      .wc { display: inline-block; white-space: nowrap; }
      .em .wc { color: ${data.accent}; font-weight: 700; }
      /* Emphasis run wrapper: hosts the underline swipe directly under the accent phrase. */
      #emph { position: relative; display: inline; }
      #emul { position: absolute; left: 0; right: 0; bottom: -2px; height: 4px; background: ${data.accent}; border-radius: 2px; transform-origin: 0% 50%; }
      #rl { width: 64px; height: 2px; background: ${data.accent}; margin: 50px auto 22px; }
      #at { font-family: ${serif}; font-size: 27px; text-transform: uppercase; letter-spacing: 0.34em; font-weight: 600; color: ${data.ink}; padding-left: 0.34em; }
      ${hasSource ? `#sl { position: absolute; bottom: 80px; left: 0; right: 0; text-align: center; font-family: ${serif}; font-size: 32px; text-transform: uppercase; letter-spacing: 0.08em; color: ${data.ink}; white-space: nowrap; }` : ""}
    </style>
  </head>
  <body>
    <div id="card" data-composition-id="main" data-start="0" data-duration="${totalSec.toFixed(2)}" data-width="1080" data-height="1080">
      <div id="grain"></div>
      <div id="vig"></div>
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

      // Each word starts below its slot (clipped by overflow:hidden on .ws) and transparent.
      gsap.set(".wc", { yPercent: 110, opacity: 0 });
      gsap.set("#qm", { opacity: 0, y: -60, scale: 0.7, transformOrigin: "50% 100%" });
      gsap.set("#emul", { scaleX: 0, opacity: 0 });
      gsap.set("#rl", { scaleX: 0, opacity: 0, transformOrigin: "0% 50%" });
      gsap.set("#at", { opacity: 0, y: 18 });
      ${hasSource ? 'gsap.set("#sl", { opacity: 0 });' : ""}

      // Oversized quote mark settles in with an elastic drop + scale.
      tl.to("#qm", { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "elastic.out(1.05, 0.6)" }, 0.0);
      // Each word RISES through its slot and FADES in together — eased, never a hard cut.
      tl.to(".wc", { yPercent: 0, opacity: 1, duration: ${wordDur.toFixed(2)}, stagger: ${wordStagger.toFixed(2)}, ease: "power3.out" }, ${wordsStart.toFixed(2)});
      // The emphasis phrase lands with a brief scale/weight pop as it settles.
      tl.fromTo("#emph", { scale: 1 }, { scale: 1.08, duration: 0.22, ease: "back.out(2.2)", transformOrigin: "50% 100%" }, ${popAt.toFixed(2)});
      tl.to("#emph", { scale: 1, duration: 0.28, ease: "power2.out" }, ">-0.02");
      // Accent underline swipes left→right beneath the emphasis phrase.
      tl.to("#emul", { opacity: 1, scaleX: 1, duration: 0.34, ease: "power3.out" }, ${emulAt.toFixed(2)});
      // House rule wipes in from the left.
      tl.to("#rl", { opacity: 1, scaleX: 1, duration: 0.32, ease: "power3.out" }, ${ruleAt.toFixed(2)});
      // Byline rises in.
      tl.to("#at", { opacity: 0.85, y: 0, duration: 0.36, ease: "power2.out" }, ${bylineAt.toFixed(2)});
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
