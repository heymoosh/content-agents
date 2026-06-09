import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
