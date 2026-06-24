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
