import "../util/env.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { logCost } from "../util/cost-log.js";
import { getTextPolish } from "../providers/registry.js";

// Draft the spoken script for a vertical short with the configured text-polish provider
// (claude-cli by default → Muxin's subscription, $0). This is /video step 3, the scoped
// exception to extraction-first (CLAUDE.md rule 1): a hook-first script drafted from the
// essay's IDEAS, reviewed as TEXT in the storyboard before any render. Writes
// video/script-draft.md; the /video skill storyboards it into video/storyboard.md.
//   tsx src/video/script.ts <content-folder> [--model haiku]
// --model sets the Claude alias for this run (default sonnet; haiku is fine for a short script).

const SCRIPT_INSTRUCTIONS = [
  "You write short-form video scripts for Muxin Li, a product manager who writes about AI, work, and society.",
  "Turn the source essay's IDEAS into a spoken script for a 60-90 second vertical short (about 150-230 words).",
  "",
  "Rules:",
  "- Hook in the FIRST line: a sharp, specific claim or question that stops the scroll. No throat-clearing.",
  "- One clear through-line. Build it in 4-6 short spoken beats, then land a memorable closing line.",
  "- This is the SPOKEN script only: what a voice says. No scene directions, no visual notes, no timestamps.",
  "- Muxin's voice (config/voice.yaml): plain, direct, a smart colleague talking. NO em dashes (use periods,",
  "  commas, colons, or parentheses). No AI tells, no 'here's the thing', no hype, no corporate polish.",
  "- Draw only from the essay's actual ideas and stance. Do not invent facts, stats, or claims it never makes.",
].join("\n");

// Pure builder, exported for tests: the instruction prompt the provider drafts against.
export function buildScriptInstructions(): string {
  return SCRIPT_INSTRUCTIONS;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// The material to draft from: the essay body, plus the picked extracts if /atomize wrote them.
export function loadSourceMaterial(folder: string): string {
  const source = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8")).body.trim();
  const extractsPath = join(folder, "extracts.md");
  const extracts = existsSync(extractsPath) ? readFileSync(extractsPath, "utf8").trim() : "";
  return extracts ? `${source}\n\n# Picked extracts (strongest lines)\n\n${extracts}` : source;
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg || folderArg.startsWith("--")) {
    console.error("usage: tsx src/video/script.ts <content-folder> [--model haiku]");
    process.exit(1);
  }
  const folder = isAbsolute(folderArg) ? folderArg : join(repoRoot, folderArg);
  if (!existsSync(join(folder, "source.md"))) {
    console.error(`no source.md in ${folder} — run /atomize (or /video) on a content folder first`);
    process.exit(1);
  }

  const modelFlag = flag("--model");
  if (modelFlag) process.env.CLAUDE_POLISH_MODEL = modelFlag;

  const draft = loadSourceMaterial(folder);
  const provider = await getTextPolish();
  const { text, costUsd } = await provider.polish({
    draft,
    platform: "video-script",
    instructions: buildScriptInstructions(),
  });
  logCost({ step: `text-polish:${provider.name}`, detail: `${folderArg}/video-script`, costUsd });

  const videoDir = join(folder, "video");
  mkdirSync(videoDir, { recursive: true });
  const outPath = join(videoDir, "script-draft.md");
  writeFileSync(
    outPath,
    `---\nkind: video-script-draft\nmodel: ${provider.name}:${(process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim()}\n---\n\n${text.trim()}\n`
  );
  console.log(outPath);
  console.log(`drafted script: ${text.trim().split(/\s+/).length} words, $${costUsd.toFixed(4)} (${provider.name})`);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
