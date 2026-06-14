import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

// Parse and update the review-queue.md markdown table.
// Columns: | id | platform | format | asset | native | brand | cta | status | notes |

export interface QueueRow {
  id: string;
  platform: string;
  format: string;
  asset: string;
  status: string;
  notes: string;
  lineIndex: number;
}

export function readQueue(folder: string): { rows: QueueRow[]; lines: string[] } {
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  const rows: QueueRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*id\s*\|/i.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is empty (leading |); expect 9 data cells
    if (cells.length < 10) continue;
    rows.push({
      id: cells[1],
      platform: cells[2],
      format: cells[3],
      asset: cells[4].replace(/\[.*?\]\((.*?)\)/, "$1"),
      status: cells[8].toLowerCase(),
      notes: cells[9],
      lineIndex: i,
    });
  }
  return { rows, lines };
}

export function setStatus(folder: string, row: QueueRow, status: string): void {
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  const cells = lines[row.lineIndex].split("|");
  cells[8] = ` ${status} `;
  lines[row.lineIndex] = cells.join("|");
  writeFileSync(path, lines.join("\n"));
}

export function appendPublishLog(folder: string, entry: string): void {
  const path = join(folder, "publish-log.md");
  let existing = "";
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    existing = "# Publish log\n\n";
  }
  writeFileSync(path, existing + `- ${new Date().toISOString()} — ${entry}\n`);
}

// The bets ledger closes the strategy → publish → outcome loop. /strategy creates "bet" blocks
// from each brief's recommendations; /publish appends an append-only "placed" row here every time
// an asset ships, so next cycle /strategy can match the published post back to its analytics
// outcome (then `npm run link-bet` stamps posts.bet_id and `npm run grade-bets` scores the bet).
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

const BETS_HEADER = `# Bets ledger

Append-only record that closes the strategy → publish → outcome loop.

- **Bets** are created by \`/strategy\` from each brief's recommendations (DO_MORE / TEST / DO_LESS).
- **Placed log** rows are appended deterministically by \`/publish\` when an asset ships. They are
  the raw material \`/strategy\` uses next cycle to match a published post back to its analytics row
  (then \`npm run link-bet\` stamps \`posts.bet_id\`, and \`npm run grade-bets\` scores each bet).

Never hand-delete placed rows. \`/strategy\` grades bets in the Bets section; this log stays.

## Bets

<!-- /strategy writes bet blocks here: ## bet:YYYY-MM-DD-NNN with type/status/underperform_streak -->

## Placed log
`;

// Append a "placed" row to briefs/bets.md. Deterministic, append-only, deduped on
// (content-folder, row id) so re-running /publish never double-records. fm/body come from the
// derivative's frontmatter so the row carries from_brief + directives_applied (the attribution
// atomize wrote) plus a text prefix used as the later match key against analytics exports.
export function appendBetPlacement(
  folder: string,
  rowId: string,
  platform: string,
  ref: string,
  fm: Record<string, unknown> = {},
  body = ""
): void {
  mkdirSync(dirname(BETS_PATH), { recursive: true });
  let existing = "";
  try {
    existing = readFileSync(BETS_PATH, "utf8");
  } catch {
    existing = BETS_HEADER;
  }
  const key = `${basename(folder)}/${rowId}`;
  if (existing.includes(`[${key}]`)) return; // already recorded — keep /publish a no-op
  const fromBrief = fm.from_brief ? ` | from_brief: ${String(fm.from_brief)}` : "";
  const dir = fm.directives_applied;
  const directives = dir
    ? ` | directives: ${Array.isArray(dir) ? dir.join(", ") : String(dir)}`
    : "";
  const prefix = body ? ` | "${body.replace(/\s+/g, " ").trim().slice(0, 80)}"` : "";
  const line = `- placed ${new Date().toISOString()} [${key}] ${platform} → ${ref}${fromBrief}${directives}${prefix}`;
  writeFileSync(BETS_PATH, existing.replace(/\n*$/, "\n") + line + "\n");
}
