import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";
import { loadPlatforms } from "../config/platforms.js";

// The shared cadence scheduler — one source of truth for WHEN every post goes out, used by both
// text (Typefully) and quote cards (image relays). It extends main's per-run cadence (config/
// platforms.yaml posts_per_week + slot_days + slot_time_pst, DST-aware PT) with a persistent slot
// ledger (data/publish-schedule.jsonl) so claims survive across /publish runs AND across streams.
// That closes the "Phase 2" gap main flagged: a platform never gets two posts on the same LA day,
// whether they come from text, cards, or a separate run.
//
// Model: each post occupies one LA calendar day per platform it lands on (daily uniqueness). A
// `windowKey` (a platforms.yaml entry) supplies the candidate days/time and a weekly volume cap;
// `conflictPlatforms` are the real platforms the post occupies (deduped against the ledger and
// recorded so later posts avoid those days). Text: windowKey == platform == the one conflict
// platform. Cards: windowKey "quote-card" supplies card days/time; conflictPlatforms are the
// platforms the card fans out to.

const TZ = "America/Los_Angeles";
const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// maxSlotsPerDay is optional (not defaulted to 1 here) so callers/tests that construct a
// PlatformSchedule without it keep compiling; claimSlots treats an absent value as 1.
export type PlatformSchedule = { postsPerWeek: number; days: number[]; timePst: string; maxSlotsPerDay?: number };

export function loadSchedule(): Record<string, PlatformSchedule> {
  const out: Record<string, PlatformSchedule> = {};
  for (const [k, v] of Object.entries(loadPlatforms().platforms)) {
    if (!v.posts_per_week || !v.slot_days || !v.slot_time_pst) continue;
    const days = v.slot_days
      .map((s) => WEEKDAYS[s.toLowerCase().slice(0, 3)])
      .filter((n): n is number => n !== undefined);
    if (days.length) {
      out[k] = { postsPerWeek: v.posts_per_week, days, timePst: v.slot_time_pst, maxSlotsPerDay: v.max_slots_per_day };
    }
  }
  return out;
}

// --- LA timezone helpers (DST-aware), ported from main's typefully cadence scheduler ---

function laParts(d: Date): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, weekday: WEEKDAYS[String(p.weekday).toLowerCase()] };
}

function laOffsetMs(d: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = +p.hour === 24 ? 0 : +p.hour;
  return Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second) - d.getTime();
}

function laWallToInstant(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  return new Date(guess - laOffsetMs(new Date(guess)));
}

function dayKey(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Wall-clock hh:mm for the Nth (0-indexed) slot of a day that allows maxSlotsPerDay slots. Slot 0
// always lands exactly at the configured anchor (today's single-slot behavior, unchanged). Later
// slots space evenly across the remaining time until midnight, so they stay later in the day and
// never spill into the next calendar day.
function slotTimeForIndex(hh: number, mm: number, maxSlotsPerDay: number, slotIndex: number): { hh: number; mm: number } {
  if (maxSlotsPerDay <= 1 || slotIndex === 0) return { hh, mm };
  const anchorMinutes = hh * 60 + mm;
  const intervalMinutes = Math.max(1, Math.floor((24 * 60 - anchorMinutes) / maxSlotsPerDay));
  const total = Math.min(24 * 60 - 1, anchorMinutes + slotIndex * intervalMinutes);
  return { hh: Math.floor(total / 60), mm: total % 60 };
}

// Monday-of-week key (LA) for the posts_per_week cap.
function weekKey(y: number, mo: number, d: number, weekday: number): string {
  const back = (weekday + 6) % 7; // days since Monday
  return new Date(Date.UTC(y, mo - 1, d - back)).toISOString().slice(0, 10);
}

export function fmtLa(d: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d) + " PT"
  );
}

// --- ledger (append-only JSONL of every claimed (platform, LA day)) ---

// Resolved lazily (not a top-level const) so tests can point it at an isolated file via
// CONTENT_AGENTS_TEST_LEDGER before exercising claimSlots/pruneLedger/releaseClaims, instead of
// racing each other against the real, shared data/publish-schedule.jsonl.
function ledgerPath(): string {
  return process.env.CONTENT_AGENTS_TEST_LEDGER ?? join(repoRoot, "data", "publish-schedule.jsonl");
}

export interface Claim {
  platform: string;
  day: string; // LA YYYY-MM-DD
  time: string; // ISO
  asset: string;
  by: string;
}

// Read back every claim in the shared ledger. Exported so the unified queue view (queue-view.ts)
// can reconcile live service state against what we claimed, without re-implementing the claim logic.
// Skips (rather than throws on) a line that fails to parse — appendLedger's appendFileSync isn't
// atomic, so a crash mid-append can leave a truncated final line; one bad line shouldn't take down
// every ledger consumer (claimSlots, pruneLedger, releaseClaims, --sync) until someone hand-edits it.
export function readLedger(): Claim[] {
  const ledger = ledgerPath();
  if (!existsSync(ledger)) return [];
  const claims: Claim[] = [];
  for (const line of readFileSync(ledger, "utf8").split("\n").filter(Boolean)) {
    try {
      claims.push(JSON.parse(line) as Claim);
    } catch {
      console.error(`publish-schedule.jsonl: skipping unparseable line: ${line.slice(0, 120)}`);
    }
  }
  return claims;
}

// Atomic ledger rewrite: write to a temp file in the same directory, then rename() over the real
// path — rename() is atomic on the same filesystem, so a crash between the two steps leaves an
// orphaned temp file but never truncates the real ledger. `deps` exists only so tests can inject a
// throwing write/rename and prove the real file survives; production callers never pass it.
export function writeLedgerAtomic(
  claims: Claim[],
  deps: { writeFileSync: typeof writeFileSync; renameSync: typeof renameSync } = { writeFileSync, renameSync }
): void {
  const ledger = ledgerPath();
  mkdirSync(dirname(ledger), { recursive: true });
  const content = claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "";
  const tmp = `${ledger}.${process.pid}.tmp`;
  deps.writeFileSync(tmp, content);
  deps.renameSync(tmp, ledger);
}

// Compact the ledger by dropping claims whose scheduled time has already passed (the unified queue
// view's `--sync`). Past claims have either published or lapsed downstream, so they no longer
// constrain new claims; keeping the file to FUTURE slots only keeps it honest and small. Append-only
// during normal runs; this and releaseClaims are the only intentional rewrites.
export function pruneLedger(nowMs: number = Date.now()): { removed: number; kept: number } {
  const claims = readLedger();
  const future = claims.filter((c) => new Date(c.time).getTime() > nowMs);
  const removed = claims.length - future.length;
  if (removed > 0) writeLedgerAtomic(future);
  return { removed, kept: future.length };
}

function claimKey(c: Claim): string {
  return `${c.platform}|${c.day}|${c.time}|${c.asset}|${c.by}`;
}

// Release specific claims from the ledger — e.g. --sync dropping a future claim reconcile() found
// "claimed but not live" (a run claimed a slot and aborted before the post it was for actually
// happened, so nothing will ever fill it). Matches by full claim identity; the ledger has no
// synthetic id. Returns the claims ACTUALLY found + removed (not just `toRelease` echoed back) —
// the ledger is shared across runs/streams, so by the time this re-reads it, some of `toRelease`
// may already be gone (or never were there); callers must not assume every requested release landed.
export function releaseClaims(toRelease: Claim[]): { removed: number; removedClaims: Claim[] } {
  if (!toRelease.length) return { removed: 0, removedClaims: [] };
  const claims = readLedger();
  const drop = new Set(toRelease.map(claimKey));
  const removedClaims = claims.filter((c) => drop.has(claimKey(c)));
  const remaining = claims.filter((c) => !drop.has(claimKey(c)));
  if (removedClaims.length > 0) writeLedgerAtomic(remaining);
  return { removed: removedClaims.length, removedClaims };
}

function appendLedger(claims: Claim[]): void {
  if (!claims.length) return;
  const ledger = ledgerPath();
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, claims.map((c) => JSON.stringify(c)).join("\n") + "\n");
}

// Claim `count` slots. Candidate days + time + weekly cap come from `windowKey` (a platforms.yaml
// cadence entry); each claimed day must be free (no existing ledger claim) for EVERY
// `conflictPlatforms` entry, and is recorded against the windowKey (for the volume cap) and each
// conflict platform (for daily uniqueness). `dryRun` computes without recording. Returns ISO times
// (or "next-free-slot" for a windowKey with no cadence — Typefully's fallback).
export function claimSlots(opts: {
  windowKey: string;
  conflictPlatforms: string[];
  count: number;
  asset: string;
  by: string;
  dryRun?: boolean;
  schedule?: Record<string, PlatformSchedule>; // test-only override; defaults to loadSchedule()
  now?: Date; // test-only override; defaults to new Date()
}): { times: string[]; labels: string[] } {
  const schedule = opts.schedule ?? loadSchedule();
  const sched = schedule[opts.windowKey];
  if (!sched) {
    return { times: Array(opts.count).fill("next-free-slot"), labels: Array(opts.count).fill("next-free-slot") };
  }

  // Every platform this claim touches: the windowKey (its weekly volume cap + candidate days) plus
  // the conflict platforms (each enforces ITS OWN weekly cap + daily uniqueness, so a card can't
  // push a platform past its posts_per_week or share a day with a text post there). A platform with
  // no cadence cap is limited only by daily uniqueness.
  const relevant = [...new Set([opts.windowKey, ...opts.conflictPlatforms])];
  const cap: Record<string, number> = {};
  for (const p of relevant) cap[p] = schedule[p]?.postsPerWeek ?? Infinity;

  // Per-platform max claimed slots on one PT-day. Absent (no config, or no cadence entry at all,
  // e.g. a conflictPlatforms entry like "b" in the tests) defaults to 1 — today's daily-uniqueness
  // behavior, unchanged unless a platform explicitly opts into more.
  const maxPerDay: Record<string, number> = {};
  for (const p of relevant) maxPerDay[p] = schedule[p]?.maxSlotsPerDay ?? 1;

  const ledger = readLedger();
  const daySlotCount: Record<string, Record<string, number>> = {}; // platform → day → claims taken
  const weekCount: Record<string, Record<string, number>> = {}; // platform → week → count
  for (const p of relevant) {
    daySlotCount[p] = {};
    weekCount[p] = {};
  }
  for (const c of ledger) {
    if (!relevant.includes(c.platform)) continue;
    daySlotCount[c.platform][c.day] = (daySlotCount[c.platform][c.day] ?? 0) + 1;
    const [y, mo, d] = c.day.split("-").map(Number);
    const wd = laParts(laWallToInstant(y, mo, d, 12, 0)).weekday;
    const wk = weekKey(y, mo, d, wd);
    weekCount[c.platform][wk] = (weekCount[c.platform][wk] ?? 0) + 1;
  }

  const [hh, mm] = sched.timePst.split(":").map(Number);
  const windowMaxSlotsPerDay = maxPerDay[opts.windowKey];
  const now = opts.now ?? new Date();
  const newClaims: Claim[] = [];
  const times: string[] = [];
  const labels: string[] = [];

  for (let offset = 1; offset <= 365 && times.length < opts.count; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const { year, month, day, weekday } = laParts(probe);
    if (!sched.days.includes(weekday)) continue;
    const wk = weekKey(year, month, day, weekday);
    const dk = dayKey(year, month, day);

    // Claim as many slots as this day still has room for (bounded by every relevant platform's
    // weekly cap and its own per-day max), before moving on to the next candidate day.
    while (times.length < opts.count) {
      const blocked = relevant.some(
        (p) => (weekCount[p][wk] ?? 0) >= cap[p] || (daySlotCount[p][dk] ?? 0) >= maxPerDay[p]
      );
      if (blocked) break;

      const slotIndex = daySlotCount[opts.windowKey][dk] ?? 0;
      const { hh: slotHh, mm: slotMm } = slotTimeForIndex(hh, mm, windowMaxSlotsPerDay, slotIndex);
      const instant = laWallToInstant(year, month, day, slotHh, slotMm);
      if (instant.getTime() <= now.getTime()) break;

      const iso = instant.toISOString();
      times.push(iso);
      labels.push(fmtLa(instant));
      for (const p of relevant) {
        weekCount[p][wk] = (weekCount[p][wk] ?? 0) + 1;
        daySlotCount[p][dk] = (daySlotCount[p][dk] ?? 0) + 1;
        newClaims.push({ platform: p, day: dk, time: iso, asset: opts.asset, by: opts.by });
      }
    }
  }

  if (!opts.dryRun) appendLedger(newClaims);
  return { times, labels };
}
