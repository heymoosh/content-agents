import "../util/env.js";
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "../util/frontmatter.js";
import { resolveSeriesDir, chapterPath, pad2, readSeriesConfig } from "./_series.js";
import { reflowParagraphs } from "./_format.js";

// Lock an approved chapter into the story: flip its status to `approved`, append a continuity
// entry to canon.md, and emit a Substack-ready paste file (prose reflowed into paragraphs).
// The continuity summary is Claude's judgment — the /story skill pipes it in on stdin, or
// passes --summary. Updating individual character-sheet state is also the skill's job.
//   tsx src/fiction/canon.ts <series> <chapter> [--summary "..."] [--stdin]

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const series = process.argv[2];
  const chapterArg = process.argv[3];
  if (!series || !chapterArg || series.startsWith("--") || chapterArg.startsWith("--")) {
    console.error("usage: tsx src/fiction/canon.ts <series> <chapter> [--summary \"...\"] [--stdin]");
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const cfg = readSeriesConfig(dir);
  const n = Number(chapterArg);
  const chPath = chapterPath(dir, n);
  if (!existsSync(chPath)) {
    console.error(`no chapter ${n}: ${chPath}`);
    process.exit(1);
  }

  const raw = readFileSync(chPath, "utf8");
  const { fm, body } = splitFrontmatter(raw);
  const title = String(fm.title ?? "").trim();

  // 1) Flip status → approved in the chapter frontmatter (rewrite the fm block).
  const updated = raw.replace(/^(---\n[\s\S]*?\nstatus:\s*)[^\n]*(\n)/, `$1approved$2`);
  writeFileSync(chPath, updated === raw ? raw.replace(/^---\n/, `---\nstatus: approved\n`) : updated);

  // 2) Append a continuity entry to canon.md.
  const entryBody = process.argv.includes("--stdin")
    ? readFileSync(0, "utf8").trim()
    : (flag("--summary") ?? "- (continuity notes pending — fill in what this chapter established)");
  const heading = `\n### Chapter ${n}${title ? ` — ${title}` : ""} (locked ${new Date().toISOString().slice(0, 10)})\n\n`;
  appendFileSync(join(dir, "canon.md"), heading + entryBody.trim() + "\n");

  // 3) Emit the Substack-ready paste file (one-sentence-per-line reflowed into paragraphs).
  const pasteDir = join(dir, "ready-to-paste");
  mkdirSync(pasteDir, { recursive: true });
  const heads = title ? `${title}\n\n` : "";
  writeFileSync(join(pasteDir, `chapter-${pad2(n)}.txt`), heads + reflowParagraphs(body) + "\n");

  console.log(`locked chapter ${n}${title ? ` (${title})` : ""} for "${cfg.title ?? cfg.slug ?? series}"`);
  console.log(`  canon.md updated, ready-to-paste/chapter-${pad2(n)}.txt written`);
}

main();
