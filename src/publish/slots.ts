import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { loadPlatforms } from "../config/platforms.js";
import { dataPath } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

// The shared cadence scheduler — one source of truth for WHEN every post goes out, used by both
// text (Typefully) and quote cards (image relays). It extends main's per-run cadence (config/
// platforms.yaml posts_per_week + slot_days + slot_time_pst, DST-aware PT) with a persistent slot
// ledger (data/publish-schedule.jsonl) so claims survive across /publish runs AND across streams.
// That closes the "Phase 2" gap main flagged: a platform never exceeds its per-day slot cap (default
// 1, raised via a platform's `max_slots_per_day`) on the same LA day, whether posts come from text,
// cards, or a separate run.
//
// Model: each post claims one of a platform's per-day slots (default 1; `max_slots_per_day` raises
// it, spacing extra slots across the day) on the LA calendar day it lands on. A `windowKey` (a
// platforms.yaml entry) supplies the candidate days/time and a weekly volume cap; `conflictPlatforms`
// are the real platforms the post occupies (deduped against the ledger and recorded so later posts
// respect those platforms' own caps). Text: windowKey == platform == the one conflict platform.
// Cards: windowKey "quote-card" supplies card days/time; conflictPlatforms are the platforms the card
// fans out to.

const TZ = "America/Los_Angeles";
const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// maxSlotsPerDay is optional (not defaulted to 1 here) so callers/tests that construct a
// PlatformSchedule without it keep compiling; claimSlots treats an absent value as 1.
export type PlatformSchedule = { postsPerWeek: number; days: number[]; timePst: string; maxSlotsPerDay?: number };

// Strategy lever C (card ed23f712): config/schedule-overrides.yaml, written by
// `npm run cadence-fit -- --write` (src/strategy/cadence-fit.ts). It only ever adjusts
// postsPerWeek/timePst for platforms it lists, and ONLY while `approved: true` there -- Muxin sets
// that herself after reviewing the proposed numbers. A missing, malformed, or `approved: false`
// file leaves loadSchedule()'s YAML-derived output completely unchanged (today's behavior).
interface ScheduleOverridesFile {
  approved: boolean;
  overrides: Record<string, { posts_per_week?: number; slot_time_pst?: string }>;
}

// Resolved lazily, and overridable via env (same CONTENT_AGENTS_TEST_* convention as ledgerPath()
// above) so tests can point this at an isolated fixture file instead of the real
// config/schedule-overrides.yaml.
function overridesPath(): string {
  return process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES ?? join(repoRoot, "config", "schedule-overrides.yaml");
}

// Exported for direct unit testing of the approved/missing/malformed handling, independent of
// loadPlatforms()'s real config/platforms.yaml.
export function loadApprovedOverrides(): ScheduleOverridesFile["overrides"] {
  const path = overridesPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = parse(readFileSync(path, "utf8")) as Partial<ScheduleOverridesFile> | null;
    if (!parsed?.approved) return {};
    return parsed.overrides ?? {};
  } catch {
    console.error("config/schedule-overrides.yaml: failed to parse — ignoring overrides this run.");
    return {};
  }
}

// Strategy lever C follow-through (epic 2ce597d7): tells a caller whether a given platform's
// cadence, AT THE MOMENT OF THE CALL, is being driven by an active config/schedule-overrides.yaml
// entry or the static config/platforms.yaml default — the "which path did THIS publish actually
// take" answer lever-effectiveness.ts's LEVER_TRACKING_GAPS previously flagged as missing for
// Lever C. Reuses loadApprovedOverrides() (the exact same source loadSchedule() itself consults),
// so this can never disagree with what loadSchedule() actually did for that platform.
export function cadenceSourceFor(platform: string): "override" | "default" {
  return loadApprovedOverrides()[platform] ? "override" : "default";
}

export function loadSchedule(): Record<string, PlatformSchedule> {
  const overrides = loadApprovedOverrides();
  const out: Record<string, PlatformSchedule> = {};
  for (const [k, v] of Object.entries(loadPlatforms().platforms)) {
    const override = overrides[k];
    const postsPerWeek = override?.posts_per_week ?? v.posts_per_week;
    const timePst = override?.slot_time_pst ?? v.slot_time_pst;
    if (!postsPerWeek || !v.slot_days || !timePst) continue;
    const days = v.slot_days
      .map((s) => WEEKDAYS[s.toLowerCase().slice(0, 3)])
      .filter((n): n is number => n !== undefined);
    if (days.length) {
      out[k] = { postsPerWeek, days, timePst, maxSlotsPerDay: v.max_slots_per_day };
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

/** LA calendar day (YYYY-MM-DD) of an instant, the ledger's `day` key. */
export function laDayKey(d: Date): string {
  const { year, month, day } = laParts(d);
  return dayKey(year, month, day);
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
export function ledgerPath(): string {
  return process.env.CONTENT_AGENTS_TEST_LEDGER ?? dataPath("scheduler", "publish-schedule.jsonl");
}

function withLedgerLock<T>(fn: () => T): T { return withFileLock(`${ledgerPath()}.lock`, fn); }

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
  return withLedgerLock(() => {
  const claims = readLedger();
  const future = claims.filter((c) => new Date(c.time).getTime() > nowMs);
  const removed = claims.length - future.length;
  if (removed > 0) writeLedgerAtomic(future);
  return { removed, kept: future.length };
  });
}

function claimKey(c: Claim): string {
  return `${c.platform}|${c.day}|${c.time}|${c.asset}|${c.by}`;
}

// Release specific claims from the ledger — e.g. --sync dropping a future claim reconcile() found
// "claimed but not live" (a run claimed a slot and aborted before the post it was for actually
// happened, so nothing will ever fill it). Matches by full claim identity; the ledger has no
// synthetic id. Counts occurrences of each identity in `toRelease` rather than using a Set of keys,
// so two ledger rows that happen to share identical identity (e.g. a claim race) aren't both wiped
// out when only one of them was actually requested. Returns the claims ACTUALLY found + removed (not
// just `toRelease` echoed back) — the ledger is shared across runs/streams, so by the time this
// re-reads it, some of `toRelease` may already be gone (or never were there); callers must not assume
// every requested release landed.
export function releaseClaims(toRelease: Claim[]): { removed: number; removedClaims: Claim[] } {
  if (!toRelease.length) return { removed: 0, removedClaims: [] };
  return withLedgerLock(() => {
  const claims = readLedger();
  const toDrop = new Map<string, number>();
  for (const c of toRelease) toDrop.set(claimKey(c), (toDrop.get(claimKey(c)) ?? 0) + 1);
  const removedClaims: Claim[] = [];
  const remaining: Claim[] = [];
  for (const c of claims) {
    const key = claimKey(c);
    const left = toDrop.get(key) ?? 0;
    if (left > 0) {
      toDrop.set(key, left - 1);
      removedClaims.push(c);
    } else {
      remaining.push(c);
    }
  }
  if (removedClaims.length > 0) writeLedgerAtomic(remaining);
  return { removed: removedClaims.length, removedClaims };
  });
}

/**
 * Move one claim to a new time in a single locked rewrite: the old identity is released and the
 * new one appended, so a crash between the two steps cannot leave both or neither. `to.day` is the
 * LA calendar day of `to.time`, computed by the caller the same way claimSlots labels days.
 */
export function moveClaim(from: Claim, to: { time: string; day: string }, opts: { dryRun?: boolean; schedule?: Record<string, PlatformSchedule> } = {}): { moved: boolean; claim: Claim } {
  const claim: Claim = { ...from, time: to.time, day: to.day };
  const apply = (): { moved: boolean; claim: Claim } => {
    const claims = readLedger();
    const index = claims.findIndex((c) => claimKey(c) === claimKey(from));
    // The destination day must still have room under the platform's per-day cap, not counting the
    // claim being moved; an explicit time is Muxin's choice but never a second post on a full day.
    const maxPerDay = (opts.schedule ?? loadSchedule())[from.platform]?.maxSlotsPerDay ?? 1;
    const taken = claims.filter((c, i) => i !== index && c.platform === from.platform && c.day === to.day).length;
    if (taken >= maxPerDay) throw new Error(`${from.platform} already has ${taken} post${taken === 1 ? "" : "s"} claimed on ${to.day} (max ${maxPerDay}); pick another day`);
    if (opts.dryRun) return { moved: index !== -1, claim };
    if (index === -1) claims.push(claim); else claims.splice(index, 1, claim);
    writeLedgerAtomic(claims);
    return { moved: index !== -1, claim };
  };
  return opts.dryRun ? apply() : withLedgerLock(apply);
}

function appendLedger(claims: Claim[]): void {
  if (!claims.length) return;
  const ledger = ledgerPath();
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, claims.map((c) => JSON.stringify(c)).join("\n") + "\n");
}

// Increment a platform's tally at `key` in a platform → key → count map.
function bump(counts: Record<string, Record<string, number>>, platform: string, key: string): void {
  counts[platform][key] = (counts[platform][key] ?? 0) + 1;
}

// Claim `count` slots. Candidate days + time + weekly cap come from `windowKey` (a platforms.yaml
// cadence entry); each claimed day must have room (under every relevant platform's max_slots_per_day,
// default 1) for EVERY `conflictPlatforms` entry, and is recorded against the windowKey (for the
// volume cap) and each conflict platform (for its own per-day cap). `dryRun` computes without
// recording. Returns ISO times (or "next-free-slot" for a windowKey with no cadence — Typefully's
// fallback).
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
  if (!opts.dryRun) return withLedgerLock(() => computeClaimSlots(opts, true));
  return computeClaimSlots(opts, false);
}

function computeClaimSlots(opts: Parameters<typeof claimSlots>[0], commit: boolean): { times: string[]; labels: string[] } {
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
  const weekKeyByDay: Record<string, string> = {}; // memoized so N same-day claims don't redo the DST-aware lookup N times
  for (const c of ledger) {
    if (!relevant.includes(c.platform)) continue;
    bump(daySlotCount, c.platform, c.day);
    if (!(c.day in weekKeyByDay)) {
      const [y, mo, d] = c.day.split("-").map(Number);
      const wd = laParts(laWallToInstant(y, mo, d, 12, 0)).weekday;
      weekKeyByDay[c.day] = weekKey(y, mo, d, wd);
    }
    bump(weekCount, c.platform, weekKeyByDay[c.day]);
  }

  const [hh, mm] = sched.timePst.split(":").map(Number);
  // Every slot claimed this call adds one row to EVERY relevant platform at once, so the group can
  // never land more slots on one day than its tightest member's own cap — spacing must target that
  // achievable count, not just windowKey's own (higher) ceiling, or slots cluster near the anchor
  // instead of spreading across the day.
  const dayMaxSlots = Math.min(...relevant.map((p) => maxPerDay[p]));
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
      const { hh: slotHh, mm: slotMm } = slotTimeForIndex(hh, mm, dayMaxSlots, slotIndex);
      const instant = laWallToInstant(year, month, day, slotHh, slotMm);
      if (instant.getTime() <= now.getTime()) break;

      const iso = instant.toISOString();
      times.push(iso);
      labels.push(fmtLa(instant));
      for (const p of relevant) {
        bump(weekCount, p, wk);
        bump(daySlotCount, p, dk);
        newClaims.push({ platform: p, day: dk, time: iso, asset: opts.asset, by: opts.by });
      }
    }
  }

  if (commit) appendLedger(newClaims);
  return { times, labels };
}
