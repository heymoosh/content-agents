// Charles desk (Build 4): reads charles/review-queue.md + the draft files it points at, and lets
// Muxin approve / revise / discard / edit in place — the same review contract as every other
// room, just against a 5-column table instead of the main pipeline's 10-column one (see
// charles/CLAUDE.md). Nothing here posts anything; approving just flips the status cell. Muxin
// still pastes the approved draft to Substack herself. Also serves her original persona brief
// (verbatim, not the distilled persona.yaml) for a one-click copy to hand to another tool.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";

export const CHARLES_DIR = join(repoRoot, "charles");

const STATUSES = new Set(["pending", "approve", "revise", "discard"]);

export interface CharlesRow {
  id: string;
  type: string;
  file: string; // charles/-relative path
  status: string;
  notes: string;
  engine?: string;
}

export interface CharlesPost extends CharlesRow {
  body: string;
}

function queuePath(root: string): string {
  return join(root, "review-queue.md");
}

function parseQueueTable(text: string): CharlesRow[] {
  const rows: CharlesRow[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5 || cells[0] === "id" || /^-+$/.test(cells[0])) continue;
    rows.push({ id: cells[0], type: cells[1], file: cells[2], status: cells[3], notes: cells[4], engine: cells[5] || undefined });
  }
  return rows;
}

function readQueue(root: string): CharlesRow[] {
  const path = queuePath(root);
  if (!existsSync(path)) return [];
  return parseQueueTable(readFileSync(path, "utf8"));
}

// The path-traversal guard every read/write funnels through: the file must be the exact path the
// row already named, and must resolve inside charles/ — never a client-invented path.
function resolveDraft(root: string, row: CharlesRow): string {
  const abs = join(root, row.file);
  if (!abs.startsWith(root) || row.file.includes("..")) throw new Error("bad draft path");
  return abs;
}

function findRow(root: string, id: string): CharlesRow {
  const row = readQueue(root).find((r) => r.id === id);
  if (!row) throw new Error("no such post: " + id);
  return row;
}

function readDraft(root: string, row: CharlesRow): CharlesPost {
  const abs = resolveDraft(root, row);
  const body = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  return { ...row, body };
}

export function listCharlesPosts(root: string = CHARLES_DIR): CharlesPost[] {
  return readQueue(root).map((row) => readDraft(root, row));
}

export function readCharlesPost(id: string, root: string = CHARLES_DIR): CharlesPost {
  return readDraft(root, findRow(root, id));
}

export function saveCharlesPost(id: string, body: string, root: string = CHARLES_DIR): void {
  const row = findRow(root, id);
  const abs = resolveDraft(root, row);
  if (!existsSync(abs)) throw new Error("no such draft file: " + row.file);
  if (!body.trim()) throw new Error("refusing to save an empty draft");
  writeFileSync(abs, body.replace(/\n*$/, "\n"));
}

export function setCharlesStatus(id: string, status: string, notes?: string, root: string = CHARLES_DIR): void {
  if (!STATUSES.has(status)) throw new Error("bad status: " + status);
  findRow(root, id); // 404s before touching the file
  const path = queuePath(root);
  const lines = readFileSync(path, "utf8").split("\n");
  let found = false;
  const out = lines.map((line) => {
    if (!line.trim().startsWith("|")) return line;
    const cells = line.split("|");
    if (cells.length < 7 || cells[1].trim() !== id) return line;
    found = true;
    cells[4] = ` ${status} `;
    if (notes !== undefined) cells[5] = ` ${notes} `;
    return cells.join("|");
  });
  if (!found) throw new Error("no such post in queue: " + id);
  writeFileSync(path, out.join("\n"));
}

/** Add the selected engine as a sixth, backward-compatible queue column. */
export function stampCharlesEngine(id: string, engine: string, root: string = CHARLES_DIR): void {
  const path = queuePath(root);
  const lines = readFileSync(path, "utf8").split("\n");
  let found = false;
  const out = lines.map((line) => {
    if (!line.trim().startsWith("|")) return line;
    const cells = line.split("|");
    if (cells.length < 7 || cells[1].trim() !== id) return line;
    found = true;
    if (cells.length >= 8) cells[6] = ` ${engine} `;
    else cells.splice(cells.length - 1, 0, ` ${engine} `);
    return cells.join("|");
  });
  if (!found) throw new Error("no such post in queue: " + id);
  writeFileSync(path, out.join("\n"));
}

// Muxin's original persona brief, verbatim — for a one-click copy to another tool. Never a
// drafting input itself (persona.yaml is what /charles's own prompts read).
export function readPersonaBrief(root: string = CHARLES_DIR): string {
  const path = join(root, "config", "persona-brief.md");
  if (!existsSync(path)) throw new Error("no persona-brief.md on file yet");
  return readFileSync(path, "utf8");
}
