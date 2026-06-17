import "../util/env.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { logCost } from "../util/cost-log.js";
import { getProse, getProseNamed } from "../providers/registry.js";
import {
  resolveSeriesDir,
  readSeriesConfig,
  chapterPath,
  nextChapterNumber,
  pad2,
  wordCount,
} from "./_series.js";
import { buildContext } from "./context.js";
import { oneSentencePerLine } from "./_format.js";

// Draft one chapter with the configured prose model (Grok by default). Builds the context
// pack, loads the craft + style system prompt, sends the chapter instructions, writes
// chapters/chapter-NN.md (one sentence per line), logs cost. The /story skill supplies the
// per-chapter beat sheet via --beats / --beats-file (Claude's judgment); without it the model
// advances the story per the outline.
//   tsx src/fiction/draft.ts <series> [--chapter N] [--beats "..."] [--beats-file path] [--prev K]

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function buildSystemPrompt(dir: string, cfg: ReturnType<typeof readSeriesConfig>): string {
  const craft = readFileSync(join(repoRoot, "config", "fiction", "craft.md"), "utf8").trim();
  const styleRef = cfg.narrative?.style_ref ?? "config/fiction/style.yaml";
  const style = existsSync(join(repoRoot, styleRef))
    ? readFileSync(join(repoRoot, styleRef), "utf8").trim()
    : "";
  const overrides: string[] = [];
  if (cfg.narrative?.pov) overrides.push(`POV: ${cfg.narrative.pov}`);
  if (cfg.narrative?.tense) overrides.push(`Tense: ${cfg.narrative.tense}`);
  const target = cfg.chapter?.target_words;
  if (target) overrides.push(`Target length: about ${target} words.`);
  return (
    `${craft}\n\n# NARRATIVE STYLE\n\n${style}` +
    (overrides.length ? `\n\n# THIS SERIES\n\n${overrides.join("\n")}` : "")
  );
}

async function main() {
  const series = process.argv[2];
  if (!series || series.startsWith("--")) {
    console.error('usage: tsx src/fiction/draft.ts <series> [--chapter N] [--beats "..."] [--beats-file path]');
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const cfg = readSeriesConfig(dir);
  const chapterN = flag("--chapter") ? Number(flag("--chapter")) : nextChapterNumber(dir);
  const outPath = chapterPath(dir, chapterN);
  if (existsSync(outPath)) {
    console.error(`chapter ${chapterN} already exists: ${outPath} (use --chapter to target another, or /story --revise to edit)`);
    process.exit(1);
  }

  const prev = flag("--prev") ? Number(flag("--prev")) : 2;
  const context = buildContext(dir, chapterN, prev);
  const system = buildSystemPrompt(dir, cfg);

  const beatsFile = flag("--beats-file");
  const instructions =
    (beatsFile ? readFileSync(beatsFile, "utf8") : flag("--beats")) ??
    `Write chapter ${chapterN}, advancing the story per the outline and canon. End on a hook that makes the reader need the next chapter.`;

  if (cfg.prose === "claude-native") {
    console.error(
      `series "${cfg.slug ?? series}" is prose: claude-native — chapters are composed by the ` +
        `/story skill (Opus plans, ${cfg.writer_model ?? "sonnet"} writes), not by this script. ` +
        `Set prose: to an adapter in src/providers/prose/ to use story:draft.`
    );
    process.exit(1);
  }
  const useNamed = cfg.prose && cfg.prose !== "default";
  const provider = useNamed ? await getProseNamed(cfg.prose as string) : await getProse();
  const { text, costUsd } = await provider.generate({ system, context, instructions });
  logCost({ step: `prose:${provider.name}`, detail: `${cfg.slug ?? series}/chapter-${pad2(chapterN)}`, costUsd });

  const body = oneSentencePerLine(text);
  const pov = cfg.narrative?.pov ?? "";
  const fm =
    `---\n` +
    `series: ${cfg.slug ?? series}\n` +
    `chapter: ${chapterN}\n` +
    `title: ""\n` +
    `pov: "${String(pov).replace(/"/g, '\\"')}"\n` +
    `status: drafting\n` +
    `word_count: ${wordCount(body)}\n` +
    `prose_model: ${provider.name}\n` +
    `generated_at: ${new Date().toISOString()}\n` +
    `---\n\n`;
  writeFileSync(outPath, fm + body + "\n");

  console.log(outPath);
  console.log(`chapter ${chapterN}: ${wordCount(body)} words, $${costUsd.toFixed(4)} (${provider.name})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
