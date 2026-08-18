import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { canonPath, ventureDir } from "./paths.js";

// venture/<slug>/canon.md is the append-only ledger and the AUTHORITY for checkpoint state
// (never state.md, which is a derived cache -- see state.ts). Every event has a deterministic
// event_id so a rerun is a no-op, never a duplicate or an error.
//
// Grammar (one event per line, under a `## Ledger` heading; anything outside that heading is
// free prose and not parsed):
//   - <ISO8601> **<event_type>** `<event_id>` — k1=v1 k2=v2 ...

export interface CanonEvent {
  at: string;
  type: string;
  id: string;
  fields: Record<string, string>;
}

const LEDGER_HEADING = "## Ledger";
const EVENT_LINE_RE = /^-\s+(\S+)\s+\*\*([^*]+)\*\*\s+`([^`]+)`(?:\s+—\s+(.*))?$/;

function parseFields(rest: string | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!rest) return fields;
  for (const m of rest.matchAll(/(\S+?)=(\S+)/g)) fields[m[1]] = m[2];
  return fields;
}

function formatFields(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

export function readCanonEvents(slug: string): CanonEvent[] {
  const path = canonPath(slug);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const ledgerStart = text.indexOf(LEDGER_HEADING);
  if (ledgerStart === -1) return [];
  const ledgerText = text.slice(ledgerStart + LEDGER_HEADING.length);
  const events: CanonEvent[] = [];
  for (const line of ledgerText.split("\n")) {
    const m = line.match(EVENT_LINE_RE);
    if (!m) continue;
    events.push({ at: m[1], type: m[2], id: m[3], fields: parseFields(m[4]) });
  }
  return events;
}

export function hasCanonEvent(slug: string, eventId: string): boolean {
  return readCanonEvents(slug).some((e) => e.id === eventId);
}

export function findCanonEvent(slug: string, eventId: string): CanonEvent | undefined {
  return readCanonEvents(slug).find((e) => e.id === eventId);
}

// Idempotent: recording an already-present event_id is a no-op (returns alreadyRecorded: true)
// rather than a duplicate line or a thrown error, so a retried/resumed script never corrupts
// the ledger.
export function appendCanonEvent(
  slug: string,
  eventType: string,
  eventId: string,
  fields: Record<string, string>,
  at: string
): { alreadyRecorded: boolean } {
  if (hasCanonEvent(slug, eventId)) return { alreadyRecorded: true };
  const dir = ventureDir(slug);
  mkdirSync(dir, { recursive: true });
  const path = canonPath(slug);
  if (!existsSync(path)) {
    writeFileSync(path, `# Canon\n\n${LEDGER_HEADING}\n\n`);
  } else {
    const text = readFileSync(path, "utf8");
    if (!text.includes(LEDGER_HEADING)) {
      appendFileSync(path, `\n${LEDGER_HEADING}\n\n`);
    }
  }
  const line = `- ${at} **${eventType}** \`${eventId}\`${
    Object.keys(fields).length ? ` — ${formatFields(fields)}` : ""
  }\n`;
  appendFileSync(path, line);
  return { alreadyRecorded: false };
}
