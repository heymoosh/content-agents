import "../util/env.js";
import { resolveSeriesDir, readSeriesConfig, chapterNumbers, readChapter, wordCount } from "./_series.js";
import { sentencesOnLine } from "./_format.js";

// Validate fiction chapters before they go up for review.
//   tsx src/fiction/validate.ts <series> [--chapter N]
// Checks: required frontmatter; one-sentence-per-line formatting (so PR comments anchor to a
// passage); word count >= series min_words. Exit non-zero with a list of violations.

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const REQUIRED_FM = ["series", "chapter", "pov", "status"];

function main() {
  const series = process.argv[2];
  if (!series || series.startsWith("--")) {
    console.error("usage: tsx src/fiction/validate.ts <series> [--chapter N]");
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const cfg = readSeriesConfig(dir);
  const minWords = cfg.chapter?.min_words ?? 0;

  const only = flag("--chapter");
  const nums = only ? [Number(only)] : chapterNumbers(dir);
  if (nums.length === 0) {
    console.error("no chapters to validate");
    process.exit(1);
  }

  const violations: string[] = [];
  for (const n of nums) {
    const label = `chapter-${String(n).padStart(2, "0")}`;
    const { fm, body } = readChapter(dir, n);
    for (const k of REQUIRED_FM) {
      if (fm[k] === undefined || fm[k] === null || fm[k] === "") {
        violations.push(`${label}: missing frontmatter "${k}"`);
      }
    }
    // One sentence per line so review comments anchor cleanly. Tolerant: allow up to 2 on a
    // line (short dialogue), flag 3+ as an unformatted blob.
    const lines = body.split("\n");
    lines.forEach((line, i) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      if (sentencesOnLine(t) >= 3) {
        violations.push(`${label}: line ${i + 1} has multiple sentences (one per line for PR review): "${t.slice(0, 60)}…"`);
      }
    });
    const words = wordCount(body);
    if (minWords && words < minWords) {
      violations.push(`${label}: ${words} words < series min_words ${minWords}`);
    }
  }

  if (violations.length) {
    console.error(`VALIDATION FAILED (${violations.length}):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`ok: ${nums.length} chapter(s) valid`);
}

main();
