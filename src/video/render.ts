import "../util/env.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { logCost } from "../util/cost-log.js";
import { getImage, getTTS, getBroll, isEnabled, type ImageProfile } from "../providers/registry.js";
import { charsToWordCaptions } from "./captions.js";
import { charsOrWhisper } from "./align.js";

// Render assets for a content folder.
//   tsx src/video/render.ts --still <content-folder> --quote <derivative-name>
//   tsx src/video/render.ts --render-video <content-folder>   (storyboard-driven; gated on approval)
//   tsx src/video/render.ts --video <content-folder>          (low-level; expects the two files below)
// --video mode expects:
//   derivatives/video-script.md      (the spoken script)
//   video/image-prompts.txt          (one image prompt per line)
// --render-video derives both of those from an APPROVED video/storyboard.md, then runs --video.

const PUBLIC_DIR = join(repoRoot, "remotion", "public");
const ENTRY = join(repoRoot, "remotion", "index.ts");

function resolveFolder(arg: string): string {
  const dir = isAbsolute(arg) ? arg : join(repoRoot, arg);
  if (!existsSync(join(dir, "source.md"))) {
    throw new Error(`not a content folder (no source.md): ${dir}`);
  }
  return dir;
}

function readDerivative(folder: string, name: string): string {
  const path = join(folder, "derivatives", `${name}.md`);
  if (!existsSync(path)) throw new Error(`derivative not found: ${path}`);
  return splitFrontmatter(readFileSync(path, "utf8")).body;
}

function remotion(args: string[]): void {
  execFileSync("npx", ["remotion", ...args], { cwd: repoRoot, stdio: "inherit" });
}

async function withJob<T>(fn: (jobDir: string, jobName: string) => Promise<T>): Promise<T> {
  const jobName = `job-${Date.now().toString(36)}`;
  const jobDir = join(PUBLIC_DIR, jobName);
  mkdirSync(jobDir, { recursive: true });
  try {
    // await so the finally (jobDir cleanup) runs AFTER the async body finishes,
    // not the instant fn() returns its pending promise.
    return await fn(jobDir, jobName);
  } finally {
    rmSync(jobDir, { recursive: true, force: true });
  }
}

// Named quote-card color schemes (house palette: cream/ink/persimmon/teal/ochre — memory:
// image-style-newyorker). Consistent branding: every card uses DEFAULT_SCHEME unless its
// frontmatter pins one with `scheme:`. The New Yorker DNA (serif type, keyline, ornament,
// rule, small-caps attribution) is constant; only the three colors change per scheme.
const CARD_SCHEMES: Record<string, { paper: string; ink: string; accent: string }> = {
  classic: { paper: "#f2ead9", ink: "#1a1a1a", accent: "#e2552f" }, // beige paper, ink, persimmon
  "teal-accent": { paper: "#f2ead9", ink: "#1a1a1a", accent: "#2f7e7e" }, // beige paper, ink, teal
  "teal-block": { paper: "#2f7e7e", ink: "#f2ead9", accent: "#d8a23a" }, // teal paper, cream type, ochre
  ink: { paper: "#1a1a1a", ink: "#f2ead9", accent: "#2f7e7e" }, // dark paper, cream type, teal
};
const DEFAULT_SCHEME = "classic";

function resolveScheme(fm: Record<string, unknown>): { paper: string; ink: string; accent: string } {
  const name = typeof fm.scheme === "string" ? fm.scheme.toLowerCase() : "";
  return CARD_SCHEMES[name] ?? CARD_SCHEMES[DEFAULT_SCHEME];
}

async function renderStill(
  folder: string,
  quoteName: string,
  profile?: ImageProfile
): Promise<void> {
  const { fm, body: quote } = splitFrontmatter(
    readFileSync(join(folder, "derivatives", `${quoteName}.md`), "utf8")
  );
  const slug = basename(folder);

  await withJob(async (jobDir, jobName) => {
    // Quote cards are purely typographic (New Yorker style), no illustration background.
    // (Muxin's call, June 2026: "just quotes, not illustrations.") The quote IS the design, so
    // we skip the quote-card background image-gen entirely (the --pro/--hero profile and the
    // image-model policy still apply to video b-roll, just not to quote cards).
    const props = { quote, attribution: "Muxin Li", ...resolveScheme(fm) };
    const propsFile = join(jobDir, "props.json");
    writeFileSync(propsFile, JSON.stringify(props));
    const outPath = join(folder, "images", `${quoteName}.png`);
    mkdirSync(join(folder, "images"), { recursive: true });
    remotion(["still", ENTRY, "QuoteCard", outPath, `--props=${propsFile}`]);
    console.log(`quote card: ${outPath}`);
  });
}

async function renderVideo(folder: string, profile?: ImageProfile): Promise<void> {
  const script = readDerivative(folder, "video-script");
  const slug = basename(folder);
  const videoDir = join(folder, "video");
  mkdirSync(videoDir, { recursive: true });

  const promptsFile = join(videoDir, "image-prompts.txt");
  if (!existsSync(promptsFile)) {
    throw new Error(
      `missing ${promptsFile} — write one B-roll image prompt per line (done during /atomize, step 7).`
    );
  }
  const prompts = readFileSync(promptsFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (prompts.length === 0) throw new Error(`${promptsFile} is empty`);

  await withJob(async (jobDir, jobName) => {
    // 1. TTS
    const tts = await getTTS();
    const audioPath = join(videoDir, "voiceover.mp3");
    const { charTimestamps, costUsd: ttsCost } = await tts.synthesize({
      text: script,
      outPath: audioPath,
    });
    logCost({ step: `tts:${tts.name}`, detail: slug, costUsd: ttsCost });

    // Providers without char timestamps (e.g. Kokoro) get a Whisper forced-alignment pass.
    const aligned = await charsOrWhisper(charTimestamps, audioPath);
    writeFileSync(join(videoDir, "alignment.json"), JSON.stringify(aligned));

    // 2. Captions
    const captions = charsToWordCaptions(aligned);
    writeFileSync(join(videoDir, "captions.json"), JSON.stringify(captions, null, 2));
    const durationMs = captions[captions.length - 1].endMs + 800;

    // 3. Images
    const { provider: image, params: imageParams } = await getImage(profile);
    const imageNames: string[] = [];
    for (let i = 0; i < prompts.length; i++) {
      const outPath = join(folder, "images", `video-${i + 1}.png`);
      if (!existsSync(outPath)) {
        const { costUsd } = await image.generate({
          prompt: prompts[i],
          aspect: "9:16",
          outPath,
          params: imageParams,
        });
        logCost({ step: `image:${image.name}`, detail: `${slug}/video-${i + 1}`, costUsd });
      }
      const jobImg = `img-${i + 1}.png`;
      copyFileSync(outPath, join(jobDir, jobImg));
      imageNames.push(`${jobName}/${jobImg}`);
    }

    // 4. Render
    copyFileSync(audioPath, join(jobDir, "voiceover.mp3"));
    const props = {
      audio: `${jobName}/voiceover.mp3`,
      images: imageNames,
      captions,
      durationMs,
    };
    const propsFile = join(jobDir, "props.json");
    writeFileSync(propsFile, JSON.stringify(props));

    const mp4 = join(videoDir, "short.mp4");
    remotion(["render", ENTRY, "Short", mp4, `--props=${propsFile}`]);
    remotion([
      "still",
      ENTRY,
      "Short",
      join(videoDir, "thumbnail.png"),
      `--props=${propsFile}`,
      "--frame=15",
    ]);
    writeFileSync(join(videoDir, "transcript.txt"), script + "\n");

    console.log(`video: ${mp4} (${(durationMs / 1000).toFixed(1)}s)`);
    for (const f of ["thumbnail.png", "transcript.txt", "captions.json"]) {
      console.log(`  + video/${f}`);
    }
    if (!existsSync(join(videoDir, "title.txt"))) {
      console.log(`  ⚠ video/title.txt and description.txt not written yet (done during /atomize)`);
    }
  });
}

// Read the status of the storyboard row in review-queue.md (the canonical approval gate).
// Columns: id | platform | format | asset | native | brand | cta | status | notes.
function storyboardStatus(folder: string): string | null {
  const queuePath = join(folder, "review-queue.md");
  if (!existsSync(queuePath)) return null;
  for (const line of readFileSync(queuePath, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is empty (leading |); shift so format=cells[3], status=cells[8].
    if (cells[3] === "storyboard") return cells[8] ?? "";
  }
  return null;
}

// Derive the low-level render inputs from an APPROVED storyboard, then run --video.
async function renderVideoFromStoryboard(folder: string, profile?: ImageProfile): Promise<void> {
  const sbPath = join(folder, "video", "storyboard.md");
  if (!existsSync(sbPath)) {
    throw new Error(`missing ${sbPath} — run /atomize step 7a to write the storyboard first.`);
  }

  const status = storyboardStatus(folder);
  if (status === null) {
    throw new Error(
      `no storyboard row in ${join(folder, "review-queue.md")} — run /atomize step 7a first.`
    );
  }
  if (status !== "approve") {
    throw new Error(
      `storyboard not approved (status="${status}") — review video/storyboard.md and set the ` +
        `storyboard row to "approve" in review-queue.md before rendering. No paid generation runs until then.`
    );
  }

  const { fm, body } = splitFrontmatter(readFileSync(sbPath, "utf8"));

  // Script = everything under "## Script" up to the next "## " heading.
  const scriptMatch = body.match(/##\s+Script\s*\n([\s\S]*?)(?:\n##\s|$)/);
  const script = scriptMatch?.[1].trim();
  if (!script) throw new Error(`${sbPath}: could not find a "## Script" section`);

  // Visual prompts = every "- visual:" line, in order.
  const visuals = body
    .split("\n")
    .map((l) => l.match(/^\s*-\s*visual:\s*(.+)$/i)?.[1]?.trim())
    .filter((v): v is string => Boolean(v));
  if (visuals.length === 0) {
    throw new Error(`${sbPath}: no "- visual:" lines found — each scene needs one.`);
  }

  // derivatives/video-script.md (validate.ts exempts video-script from source_lines).
  const scriptPath = join(folder, "derivatives", "video-script.md");
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  const sourceRef = fm.source_ref ? String(fm.source_ref) : "video/storyboard.md";
  writeFileSync(
    scriptPath,
    `---\nplatform: video-script\nsource_ref: ${sourceRef}\n---\n\n${script}\n`
  );

  // video/image-prompts.txt (one per line — what --video reads).
  mkdirSync(join(folder, "video"), { recursive: true });
  writeFileSync(join(folder, "video", "image-prompts.txt"), visuals.join("\n") + "\n");

  console.log(`derived from storyboard: ${visuals.length} scene(s) → image-prompts.txt + video-script.md`);
  await renderVideo(folder, profile);
}

// TTS the script, align, and write captions — shared by the animated render path.
async function synthVoiceAndCaptions(
  videoDir: string,
  script: string,
  slug: string
): Promise<{ audioPath: string; captions: ReturnType<typeof charsToWordCaptions>; durationMs: number }> {
  const tts = await getTTS();
  const audioPath = join(videoDir, "voiceover.mp3");
  const { charTimestamps, costUsd } = await tts.synthesize({ text: script, outPath: audioPath });
  logCost({ step: `tts:${tts.name}`, detail: slug, costUsd });
  const aligned = await charsOrWhisper(charTimestamps, audioPath);
  writeFileSync(join(videoDir, "alignment.json"), JSON.stringify(aligned));
  const captions = charsToWordCaptions(aligned);
  writeFileSync(join(videoDir, "captions.json"), JSON.stringify(captions, null, 2));
  const durationMs = captions[captions.length - 1].endMs + 800;
  return { audioPath, captions, durationMs };
}

// ANIMATED engine: the storyboard's scene visuals become keyframe stills; the video provider
// (Kling) animates BETWEEN consecutive keyframes; the clips are stitched under the voiceover +
// captions. `keyframesOnly` generates just the stills and stops, so they can be approved before
// any paid animation. Gated on the same approved storyboard row as the image-motion path.
async function renderAnimatedFromStoryboard(
  folder: string,
  profile?: ImageProfile,
  keyframesOnly = false
): Promise<void> {
  const sbPath = join(folder, "video", "storyboard.md");
  if (!existsSync(sbPath)) throw new Error(`missing ${sbPath} — write the storyboard first (/video).`);
  if (storyboardStatus(folder) !== "approve") {
    throw new Error(
      `storyboard not approved (status="${storyboardStatus(folder) ?? "missing"}") — approve it in ` +
        `review-queue.md before rendering. No paid generation runs until then.`
    );
  }

  const { fm, body } = splitFrontmatter(readFileSync(sbPath, "utf8"));
  const script = body.match(/##\s+Script\s*\n([\s\S]*?)(?:\n##\s|$)/)?.[1].trim();
  if (!script) throw new Error(`${sbPath}: could not find a "## Script" section`);
  const visuals = body
    .split("\n")
    .map((l) => l.match(/^\s*-\s*visual:\s*(.+)$/i)?.[1]?.trim())
    .filter((v): v is string => Boolean(v));
  if (visuals.length < 2) {
    throw new Error(`${sbPath}: animated mode needs ≥2 scene "- visual:" keyframes (got ${visuals.length}).`);
  }

  const slug = basename(folder);
  const videoDir = join(folder, "video");
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(join(folder, "images"), { recursive: true });
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  const sourceRef = fm.source_ref ? String(fm.source_ref) : "video/storyboard.md";
  writeFileSync(
    join(folder, "derivatives", "video-script.md"),
    `---\nplatform: video-script\nsource_ref: ${sourceRef}\n---\n\n${script}\n`
  );

  // 1. Keyframe stills — one per scene visual; the frames you approve before any Kling spend.
  // Consistency: default to Nano Banana Pro (reference-image conditioning) so the character +
  // style hold across scenes. Each keyframe references an anchor (a user-supplied
  // images/reference.* if present, else scene 1) plus the previous frame for local continuity.
  const kfProfile: ImageProfile = profile ?? "pro";
  const { provider: image, params: imageParams } = await getImage(kfProfile);
  const userRef = ["reference.png", "reference.jpg", "reference.jpeg"]
    .map((n) => join(folder, "images", n))
    .find((p) => existsSync(p));
  if (userRef) console.log(`character reference: ${userRef}`);
  const keyframes: string[] = [];
  for (let i = 0; i < visuals.length; i++) {
    const kfPath = join(folder, "images", `keyframe-${i + 1}.png`);
    if (!existsSync(kfPath)) {
      const refs = [
        ...new Set(
          [userRef ?? keyframes[0], keyframes[i - 1]].filter((p): p is string => Boolean(p))
        ),
      ];
      const { costUsd } = await image.generate({
        prompt: visuals[i],
        aspect: "9:16",
        outPath: kfPath,
        params: imageParams,
        referenceImages: refs,
      });
      logCost({ step: `image:${image.name}`, detail: `${slug}/keyframe-${i + 1}`, costUsd });
    }
    keyframes.push(kfPath);
  }
  console.log(`keyframes: ${keyframes.length} stills → ${join(folder, "images")}`);
  if (keyframesOnly) {
    console.log("--keyframes-only: review the keyframe-*.png stills, then re-run without the flag to animate.");
    return;
  }

  // 2. Voice + captions.
  const { audioPath, captions, durationMs } = await synthVoiceAndCaptions(videoDir, script, slug);

  // 3. Animate between consecutive keyframes; clip length sized to fill the voiceover.
  const fps = 30;
  const numClips = keyframes.length - 1;
  const perClipSec = Math.min(8, Math.max(3, Math.round(durationMs / 1000 / numClips)));
  const { provider: broll, params: brollParams } = await getBroll();
  const clipsDir = join(videoDir, "clips");
  mkdirSync(clipsDir, { recursive: true });

  await withJob(async (jobDir, jobName) => {
    const clipNames: string[] = [];
    const clipFrames: number[] = [];
    for (let i = 0; i < numClips; i++) {
      const clipPath = join(clipsDir, `clip-${i + 1}.mp4`);
      if (!existsSync(clipPath)) {
        const { costUsd } = await broll.interpolate({
          prompt: `Smooth, gentle motion transitioning into: ${visuals[i + 1]}`,
          firstFramePath: keyframes[i],
          lastFramePath: keyframes[i + 1],
          aspect: "9:16",
          durationSeconds: perClipSec,
          outPath: clipPath,
          params: brollParams,
        });
        logCost({ step: `video-broll:${broll.name}`, detail: `${slug}/clip-${i + 1}`, costUsd });
      }
      const jobClip = `clip-${i + 1}.mp4`;
      copyFileSync(clipPath, join(jobDir, jobClip));
      clipNames.push(`${jobName}/${jobClip}`);
      clipFrames.push(perClipSec * fps);
    }

    copyFileSync(audioPath, join(jobDir, "voiceover.mp3"));
    const props = {
      audio: `${jobName}/voiceover.mp3`,
      clips: clipNames,
      clipFrames,
      captions,
      durationMs,
    };
    const propsFile = join(jobDir, "props.json");
    writeFileSync(propsFile, JSON.stringify(props));

    const mp4 = join(videoDir, "short.mp4");
    remotion(["render", ENTRY, "AnimatedShort", mp4, `--props=${propsFile}`]);
    remotion([
      "still",
      ENTRY,
      "AnimatedShort",
      join(videoDir, "thumbnail.png"),
      `--props=${propsFile}`,
      "--frame=15",
    ]);
    writeFileSync(join(videoDir, "transcript.txt"), script + "\n");
    console.log(
      `animated video: ${mp4} (${numClips} Kling clip(s) @ ${perClipSec}s, ${(durationMs / 1000).toFixed(1)}s total)`
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  // Image model profile: cheap default (Riverflow), or --pro / --hero step-ups (config/providers.yaml).
  const profile: ImageProfile | undefined = args.includes("--hero")
    ? "hero"
    : args.includes("--pro")
      ? "pro"
      : undefined;
  if (mode === "--still") {
    const folder = resolveFolder(args[1]);
    const quoteIdx = args.indexOf("--quote");
    const quoteName = quoteIdx !== -1 ? args[quoteIdx + 1] : "quote-card-1";
    await renderStill(folder, quoteName, profile);
  } else if (mode === "--render-video") {
    const folder = resolveFolder(args[1]);
    if (args.includes("--animated")) {
      await renderAnimatedFromStoryboard(folder, profile, args.includes("--keyframes-only"));
    } else {
      await renderVideoFromStoryboard(folder, profile);
    }
  } else if (mode === "--video") {
    await renderVideo(resolveFolder(args[1]), profile);
  } else {
    console.error(
      "usage:\n  tsx src/video/render.ts --still <content-folder> [--quote <name>] [--pro|--hero]\n  tsx src/video/render.ts --render-video <content-folder> [--pro|--hero]            (image-motion B-roll)\n  tsx src/video/render.ts --render-video <content-folder> --animated [--keyframes-only] [--pro|--hero]\n  tsx src/video/render.ts --video <content-folder> [--pro|--hero]"
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
