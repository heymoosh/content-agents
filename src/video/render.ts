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
import { getImage, getTTS, isEnabled } from "../providers/registry.js";
import { charsToWordCaptions } from "./captions.js";

// Render assets for a content folder.
//   tsx src/video/render.ts --still <content-folder> --quote <derivative-name>
//   tsx src/video/render.ts --video <content-folder>
// Video mode expects:
//   derivatives/video-script.md      (the spoken script — written during /atomize)
//   video/image-prompts.txt          (one image prompt per line — written during /atomize)

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

function withJob<T>(fn: (jobDir: string, jobName: string) => T): T {
  const jobName = `job-${Date.now().toString(36)}`;
  const jobDir = join(PUBLIC_DIR, jobName);
  mkdirSync(jobDir, { recursive: true });
  try {
    return fn(jobDir, jobName);
  } finally {
    rmSync(jobDir, { recursive: true, force: true });
  }
}

async function renderStill(folder: string, quoteName: string): Promise<void> {
  const quote = readDerivative(folder, quoteName);
  const slug = basename(folder);

  await withJob(async (jobDir, jobName) => {
    let bgImage: string | null = null;
    if (isEnabled("image") && process.env.GEMINI_API_KEY) {
      const provider = await getImage();
      const promptFile = join(folder, "images", `${quoteName}-prompt.txt`);
      const prompt = existsSync(promptFile)
        ? readFileSync(promptFile, "utf8").trim()
        : "abstract soft gradient texture, deep indigo and warm amber, minimal, atmospheric, no text, no people";
      const bgPath = join(jobDir, "bg.png");
      const { costUsd } = await provider.generate({ prompt, aspect: "1:1", outPath: bgPath });
      logCost({ step: `image:${provider.name}`, detail: `${slug}/${quoteName}-bg`, costUsd });
      bgImage = `${jobName}/bg.png`;
    } else {
      console.log("image provider disabled or GEMINI_API_KEY missing — rendering gradient-only card");
    }

    const props = { quote, attribution: "Muxin Li", bgImage };
    const propsFile = join(jobDir, "props.json");
    writeFileSync(propsFile, JSON.stringify(props));
    const outPath = join(folder, "images", `${quoteName}.png`);
    mkdirSync(join(folder, "images"), { recursive: true });
    remotion(["still", ENTRY, "QuoteCard", outPath, `--props=${propsFile}`]);
    console.log(`quote card: ${outPath}`);
  });
}

async function renderVideo(folder: string): Promise<void> {
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
    if (!charTimestamps) {
      throw new Error(
        `${tts.name} returned no character timestamps — captions need alignment. ` +
          `Add a forced-alignment step (whisper.cpp) or use a provider with timestamps.`
      );
    }
    writeFileSync(join(videoDir, "alignment.json"), JSON.stringify(charTimestamps));

    // 2. Captions
    const captions = charsToWordCaptions(charTimestamps);
    writeFileSync(join(videoDir, "captions.json"), JSON.stringify(captions, null, 2));
    const durationMs = captions[captions.length - 1].endMs + 800;

    // 3. Images
    const image = await getImage();
    const imageNames: string[] = [];
    for (let i = 0; i < prompts.length; i++) {
      const outPath = join(folder, "images", `video-${i + 1}.png`);
      if (!existsSync(outPath)) {
        const { costUsd } = await image.generate({
          prompt: prompts[i],
          aspect: "9:16",
          outPath,
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

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode === "--still") {
    const folder = resolveFolder(args[1]);
    const quoteIdx = args.indexOf("--quote");
    const quoteName = quoteIdx !== -1 ? args[quoteIdx + 1] : "quote-card-1";
    await renderStill(folder, quoteName);
  } else if (mode === "--video") {
    await renderVideo(resolveFolder(args[1]));
  } else {
    console.error(
      "usage:\n  tsx src/video/render.ts --still <content-folder> [--quote <name>]\n  tsx src/video/render.ts --video <content-folder>"
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
