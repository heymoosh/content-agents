import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";

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

export type PlatformSchedule = { postsPerWeek: number; days: number[]; timePst: string };

export function loadSchedule(): Record<string, PlatformSchedule> {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
      platforms?: Record<string, { posts_per_week?: number; slot_days?: string[]; slot_time_pst?: string }>;
    };
    const out: Record<string, PlatformSchedule> = {};
    for (const [k, v] of Object.entries(cfg.platforms ?? {})) {
      if (!v.posts_per_week || !v.slot_days || !v.slot_time_pst) continue;
      const days = v.slot_days
        .map((s) => WEEKDAYS[s.toLowerCase().slice(0, 3)])
        .filter((n): n is number => n !== undefined);
      if (days.length) out[k] = { postsPerWeek: v.posts_per_week, days, timePst: v.slot_time_pst };
    }
    return out;
  } catch {
    return {};
  }
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

const LEDGER = join(repoRoot, "data", "publish-schedule.jsonl");
interface Claim {
  platform: string;
  day: string; // LA YYYY-MM-DD
  time: string; // ISO
  asset: string;
  by: string;
}

function readLedger(): Claim[] {
  if (!existsSync(LEDGER)) return [];
  return readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Claim);
}

function appendLedger(claims: Claim[]): void {
  if (!claims.length) return;
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, claims.map((c) => JSON.stringify(c)).join("\n") + "\n");
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
}): { times: string[]; labels: string[] } {
  const schedule = loadSchedule();
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

  const ledger = readLedger();
  const takenDay = new Set<string>(); // "platform|day" occupied
  const weekCount: Record<string, Record<string, number>> = {}; // platform → week → count
  for (const p of relevant) weekCount[p] = {};
  for (const c of ledger) {
    if (!relevant.includes(c.platform)) continue;
    takenDay.add(`${c.platform}|${c.day}`);
    const [y, mo, d] = c.day.split("-").map(Number);
    const wd = laParts(laWallToInstant(y, mo, d, 12, 0)).weekday;
    const wk = weekKey(y, mo, d, wd);
    weekCount[c.platform][wk] = (weekCount[c.platform][wk] ?? 0) + 1;
  }

  const [hh, mm] = sched.timePst.split(":").map(Number);
  const now = new Date();
  const newClaims: Claim[] = [];
  const times: string[] = [];
  const labels: string[] = [];

  for (let offset = 1; offset <= 365 && times.length < opts.count; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const { year, month, day, weekday } = laParts(probe);
    if (!sched.days.includes(weekday)) continue;
    const wk = weekKey(year, month, day, weekday);
    const dk = dayKey(year, month, day);
    // Day is valid only if EVERY relevant platform is under its weekly cap and free that day.
    const blocked = relevant.some((p) => (weekCount[p][wk] ?? 0) >= cap[p] || takenDay.has(`${p}|${dk}`));
    if (blocked) continue;
    const instant = laWallToInstant(year, month, day, hh, mm);
    if (instant.getTime() <= now.getTime()) continue;

    const iso = instant.toISOString();
    times.push(iso);
    labels.push(fmtLa(instant));
    for (const p of relevant) {
      weekCount[p][wk] = (weekCount[p][wk] ?? 0) + 1;
      takenDay.add(`${p}|${dk}`);
      newClaims.push({ platform: p, day: dk, time: iso, asset: opts.asset, by: opts.by });
    }
  }

  if (!opts.dryRun) appendLedger(newClaims);
  return { times, labels };
}
