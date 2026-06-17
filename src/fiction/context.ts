import "../util/env.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveSeriesDir,
  characterSheets,
  chapterNumbers,
  readChapter,
  readIfExists,
  nextChapterNumber,
} from "./_series.js";

// Assemble the context pack handed to the prose model: bible + outline + canon + character
// sheets + the last few full chapters (+ a note that earlier ones live in canon). It is a
// discrete, inspectable input — print it, eyeball it, then draft.
//   tsx src/fiction/context.ts <series> [--chapter N] [--prev K]

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function buildContext(dir: string, chapterN: number, prev = 2): string {
  const parts: string[] = [];

  parts.push(`# STORY BIBLE\n\n${readIfExists(join(dir, "bible.md"))}`);

  const outline = readIfExists(join(dir, "outline.md"));
  if (outline) parts.push(`# OUTLINE (loose, may change)\n\n${outline}`);

  parts.push(`# CANON (established, do not contradict)\n\n${readIfExists(join(dir, "canon.md"))}`);

  const sheets = characterSheets(dir);
  if (sheets.length) {
    parts.push(
      `# CHARACTER SHEETS\n\n` +
        sheets.map((s) => `## ${s.name}\n\n${s.text}`).join("\n\n")
    );
  }

  // Prior chapters: full text of the last `prev` before chapterN; earlier ones are summarized
  // in canon, so we don't blow the context window re-sending the whole book.
  const priorNums = chapterNumbers(dir).filter((n) => n < chapterN);
  const recent = priorNums.slice(-prev);
  const older = priorNums.slice(0, -prev);
  if (older.length) {
    parts.push(
      `# EARLIER CHAPTERS\n\nChapters ${older.join(", ")} happened already; their established ` +
        `facts are in CANON above. Stay consistent with them.`
    );
  }
  for (const n of recent) {
    const { body } = readChapter(dir, n);
    parts.push(`# CHAPTER ${n} (full text — immediately precedes this one)\n\n${body}`);
  }
  if (priorNums.length === 0) {
    parts.push(`# THIS IS CHAPTER ${chapterN} — the opening of the story.`);
  }

  return parts.join("\n\n---\n\n");
}

function main() {
  const series = process.argv[2];
  if (!series || series.startsWith("--")) {
    console.error("usage: tsx src/fiction/context.ts <series> [--chapter N] [--prev K]");
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const chapterN = flag("--chapter") ? Number(flag("--chapter")) : nextChapterNumber(dir);
  const prev = flag("--prev") ? Number(flag("--prev")) : 2;
  process.stdout.write(buildContext(dir, chapterN, prev) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
