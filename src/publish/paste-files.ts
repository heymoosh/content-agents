import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog } from "./queue.js";

// Emit ready-to-paste files for platforms with no API (community posts, Substack teasers).
//   tsx src/publish/paste-files.ts <content-folder>

const PASTE_PLATFORMS = new Set(["community", "substack"]);

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/paste-files.ts <content-folder>");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const { rows } = readQueue(folder);
  const approved = rows.filter((r) => r.status === "approve" && PASTE_PLATFORMS.has(r.platform));
  if (approved.length === 0) {
    console.log("no approved community/substack rows in the review queue");
    return;
  }

  const outDir = join(folder, "ready-to-paste");
  mkdirSync(outDir, { recursive: true });
  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const target = String(fm.community ?? row.platform);
    const outPath = join(outDir, `${row.id}.txt`);
    writeFileSync(outPath, `# paste into: ${target}\n# delete these two header lines before posting\n\n${body}\n`);
    setStatus(folder, row, "published");
    appendPublishLog(folder, `${row.id} → ready-to-paste/${row.id}.txt (${target})`);
    console.log(`ready to paste: ${outPath} (${target})`);
  }
}

main();
