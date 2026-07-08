import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

// Parse and update the review-queue.md markdown table.
// Columns: | id | platform | format | asset | native | brand | cta | status | notes | origin |
// `origin` is the 10th column, added 2026-07-04 — rows written before then have no origin cell.

// Which pipeline created this row. Exactly one of these three, or undefined for a row written
// before this field existed (or one carrying a value we don't recognize) — never guessed.
export const QUEUE_ORIGINS = ["from /cycle", "reply to mention", "from GUI queue"] as const;
export type QueueOrigin = (typeof QUEUE_ORIGINS)[number];

export interface QueueRow {
  id: string;
  platform: string;
  format: string;
  asset: string;
  status: string;
  notes: string;
  origin?: QueueOrigin;
  lineIndex: number;
}

function parseOrigin(cell: string | undefined): QueueOrigin | undefined {
  const value = cell?.trim();
  return QUEUE_ORIGINS.find((o) => o === value);
}

// True for a review-queue.md line that's an actual data row — not blank, not the header row,
// not the `|---|---|` separator row. Shared by every reader/writer below so they can't drift on
// what counts as a row to parse.
function isDataRow(line: string): boolean {
  return line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*id\s*\|/i.test(line);
}

export function readQueue(folder: string): { rows: QueueRow[]; lines: string[] } {
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  const rows: QueueRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isDataRow(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is empty (leading |); expect 9 data cells, plus an optional 10th (origin)
    if (cells.length < 10) continue;
    rows.push({
      id: cells[1],
      platform: cells[2],
      format: cells[3],
      asset: cells[4].replace(/\[.*?\]\((.*?)\)/, "$1"),
      status: cells[8].toLowerCase(),
      notes: cells[9],
      origin: parseOrigin(cells[10]),
      lineIndex: i,
    });
  }
  return { rows, lines };
}

export function setStatus(folder: string, row: QueueRow, status: string): void {
  // Matched by id (via writeCell), not row.lineIndex — callers read `row` before doing async work
  // (upload retries, provider calls), during which the table can shift; a stale line index would
  // silently overwrite the wrong row.
  writeCell(folder, row.id, { status });
}

export interface QueueCellUpdate {
  status?: string;
  notes?: string;
}

// A blank cell is a single space ("| |"), matching how every other row in a fresh review-queue.md
// is written — not the two spaces `` ` ${""} ` `` would produce. Only a non-empty value gets the
// space-padded form.
function formatCell(value: string): string {
  return value === "" ? " " : ` ${value} `;
}

// Rewrite one row's status and/or notes cell in review-queue.md, matched by id rather than a
// line index — for a caller that only has the row's id on hand (e.g. the review GUI's REST
// endpoint, which receives an id from the browser, not a freshly-read QueueRow). Preserves every
// other cell, including origin, untouched. The one write path the review GUI's /api/status
// handler routes through instead of reimplementing its own cells[N] offsets.
export function writeCell(folder: string, id: string, updates: QueueCellUpdate): boolean {
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isDataRow(line)) continue;
    const cells = line.split("|");
    // Same minimum readQueue() requires (cells[0] leading "" + 9 data cells) — a row readQueue()
    // can see should never be silently unwritable here.
    if (cells.length < 10) continue;
    if (cells[1].trim() !== id) continue;
    // Both fields come off an untrusted HTTP request body — strip stray pipes/newlines from
    // either one so neither can shift the row's column boundaries.
    if (updates.status !== undefined) cells[8] = formatCell(updates.status.replace(/[|\n\r]/g, " ").trim());
    if (updates.notes !== undefined) cells[9] = formatCell(updates.notes.replace(/[|\n\r]/g, " ").trim());
    lines[i] = cells.join("|");
    writeFileSync(path, lines.join("\n"));
    return true;
  }
  return false;
}

// Status of the (at most one) storyboard row in folder's review-queue.md — the render gate
// src/video/render.ts checks before any paid generation runs. Routed through readQueue so this
// stays in lockstep with every other reader of the table instead of re-parsing cells by hand.
export function storyboardRowStatus(folder: string): string | null {
  if (!existsSync(join(folder, "review-queue.md"))) return null;
  const row = readQueue(folder).rows.find((r) => r.format === "storyboard");
  return row ? row.status : null;
}

// Force every row in folder's review-queue.md to carry `origin`, overwriting whatever the
// /atomize subprocess wrote (or failed to write) for it. Called right after a GUI-triggered
// atomize job finishes, on a folder we know with certainty came from that job — a code-side
// guarantee that doesn't depend on the SKILL.md-driven run correctly detecting ATOMIZE_ORIGIN
// and hand-transcribing it into every row it authors.
export function stampOrigin(folder: string, origin: QueueOrigin): void {
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isDataRow(line)) continue;
    const cells = line.split("|");
    if (cells.length < 11) continue; // not a data row
    const stamped = ` ${origin} `;
    if (cells.length === 11) cells.splice(cells.length - 1, 0, stamped); // legacy row: insert the column
    else cells[cells.length - 2] = stamped; // already has one: overwrite it
    lines[i] = cells.join("|");
  }
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
  // Spin marker (audience-fit experiment, docs/spin-experiment.md): tag-source reads this back
  // to classify the post 'atomized-spin' instead of 'atomized'. Placed BEFORE the quoted prefix
  // so tag-source's end-anchored quote regex still finds the text at the line's tail.
  const spin = fm.spin ? ` | spin` : "";
  // Spin-control-run marker (card f444f440, src/strategy/spin-control.ts): tag-source reads this
  // back to classify the post source = 'spin-control-run' instead of 'atomized'/'atomized-spin',
  // so route.ts's loadData() can exclude it from the pillar/platform resonance figures. Same
  // placement rule as spin — before the quoted prefix.
  const controlRun = fm.control_run ? ` | control-run` : "";
  const prefix = body ? ` | "${body.replace(/\s+/g, " ").trim().slice(0, 80)}"` : "";
  const line = `- placed ${new Date().toISOString()} [${key}] ${platform} → ${ref}${fromBrief}${directives}${spin}${controlRun}${prefix}`;
  writeFileSync(BETS_PATH, existing.replace(/\n*$/, "\n") + line + "\n");
}
