/**
 * Unit tests for src/publish/slots.ts — the atomic ledger rewrite (writeLedgerAtomic),
 * releaseClaims (drops specific claims, e.g. an orphaned future claim --sync finds), and the
 * migration that carries the pre-data-root ledger forward.
 *
 * Strategy: the ledger path is NOT hardcoded. ledgerPath() honours CONTENT_AGENTS_TEST_LEDGER, so
 * every block here points it at a fixture inside a throwaway directory. Nothing in this file reads
 * or writes the repository's own data/publish-schedule.jsonl — which holds Muxin's real historical
 * claims — and the last test in the file proves that with a digest taken before anything ran.
 * The suite also sets CONTENT_AGENTS_TEST_LEGACY_LEDGER process-wide, so even a block that
 * deliberately exercises the migration cannot reach the real legacy file.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, readdirSync, existsSync, unlinkSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import {
  readLedger,
  ledgerPath,
  pruneLedger,
  releaseClaims,
  writeLedgerAtomic,
  claimSlots,
  fmtLa,
  loadApprovedOverrides,
  cadenceSourceFor,
  loadSchedule,
  type Claim,
  type PlatformSchedule,
} from "./slots.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Muxin's real ledger. Referenced ONLY to hash it, never to read claims from or write to. */
const REAL_LEDGER = join(repoRoot, "data", "publish-schedule.jsonl");
function realLedgerDigest(): string {
  return existsSync(REAL_LEDGER)
    ? createHash("sha256").update(readFileSync(REAL_LEDGER)).digest("hex")
    : "absent";
}
const REAL_LEDGER_BEFORE = realLedgerDigest();

// Every fixture this file writes lives here, never in the repository's own data/ tree.
const SCRATCH = mkdtempSync(join(tmpdir(), "slice5o-slots-"));

// A legacy ledger that does not exist. ledgerPath() falls back to the real data/publish-schedule.jsonl
// when this is unset, and under NODE_TEST_CONTEXT an unconfigured data root is a throwaway directory,
// so an unset override would have this suite copying Muxin's real file into a temp dir. Blocks that
// test the migration point this at their own fixture instead.
process.env.CONTENT_AGENTS_TEST_LEGACY_LEDGER = join(SCRATCH, "no-legacy-ledger-here.jsonl");

const LEDGER = join(SCRATCH, "publish-schedule.jsonl");

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-01",
    time: "2026-08-01T17:00:00.000Z",
    asset: "test-fixture/x",
    by: "test",
    ...overrides,
  };
}

function seedLedger(claims: Claim[]): void {
  writeFileSync(LEDGER, claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "");
}

describe("slots.ts: writeLedgerAtomic + releaseClaims", () => {
  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(LEDGER)) unlinkSync(LEDGER);
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("writeLedgerAtomic replaces the ledger content on success", () => {
    const claims = [claim({ asset: "a" }), claim({ asset: "b" })];
    writeLedgerAtomic(claims);
    assert.deepEqual(readLedger(), claims);
  });

  test("writeLedgerAtomic writes an empty file for an empty claim list", () => {
    seedLedger([claim()]);
    writeLedgerAtomic([]);
    assert.equal(readFileSync(LEDGER, "utf8"), "");
  });

  test("writeLedgerAtomic never truncates the real ledger if the tmp write throws mid-write", () => {
    const original = [claim({ asset: "keep-me" })];
    seedLedger(original);
    const before = readFileSync(LEDGER, "utf8");

    assert.throws(
      () =>
        writeLedgerAtomic([claim({ asset: "should-never-land" })], {
          writeFileSync: () => {
            throw new Error("simulated crash mid-write");
          },
          renameSync: () => {
            throw new Error("should not be reached");
          },
        }),
      /simulated crash mid-write/
    );

    assert.equal(readFileSync(LEDGER, "utf8"), before, "real ledger must be untouched, not truncated");
  });

  test("writeLedgerAtomic never truncates the real ledger if rename fails after a good tmp write", () => {
    const original = [claim({ asset: "keep-me-2" })];
    seedLedger(original);
    const before = readFileSync(LEDGER, "utf8");

    assert.throws(
      () =>
        writeLedgerAtomic([claim({ asset: "should-never-land-2" })], {
          writeFileSync,
          renameSync: () => {
            throw new Error("simulated rename failure");
          },
        }),
      /simulated rename failure/
    );

    assert.equal(readFileSync(LEDGER, "utf8"), before, "real ledger must be untouched when rename fails");
  });

  test("pruneLedger drops past claims and keeps future ones (still atomic via writeLedgerAtomic)", () => {
    const now = new Date("2026-07-08T12:00:00.000Z").getTime();
    const past = claim({ asset: "past", time: new Date(now - 86_400_000).toISOString() });
    const future = claim({ asset: "future", time: new Date(now + 86_400_000).toISOString() });
    seedLedger([past, future]);

    const result = pruneLedger(now);
    assert.deepEqual(result, { removed: 1, kept: 1 });
    assert.deepEqual(readLedger(), [future]);
  });

  test("releaseClaims removes exactly the matching claims and leaves the rest", () => {
    const a = claim({ asset: "release-a" });
    const b = claim({ asset: "release-b" });
    const c = claim({ asset: "release-c" });
    seedLedger([a, b, c]);

    const result = releaseClaims([b]);
    assert.deepEqual(result, { removed: 1, removedClaims: [b] });
    assert.deepEqual(readLedger(), [a, c]);
  });

  test("releaseClaims is a no-op (and does not write) when given an empty list", () => {
    seedLedger([claim({ asset: "untouched" })]);
    const before = readFileSync(LEDGER, "utf8");
    const result = releaseClaims([]);
    assert.deepEqual(result, { removed: 0, removedClaims: [] });
    assert.equal(readFileSync(LEDGER, "utf8"), before);
  });

  test("releaseClaims is a no-op when the claim isn't in the ledger", () => {
    seedLedger([claim({ asset: "stays" })]);
    const result = releaseClaims([claim({ asset: "not-present" })]);
    assert.deepEqual(result, { removed: 0, removedClaims: [] });
    assert.equal(readLedger().length, 1);
  });

  test("releaseClaims only reports claims actually found in the ledger, even if toRelease asked for more", () => {
    const present = claim({ asset: "present" });
    seedLedger([present]);
    const result = releaseClaims([present, claim({ asset: "already-gone" })]);
    assert.deepEqual(result, { removed: 1, removedClaims: [present] }, "must not echo back a claim it never actually removed");
    assert.deepEqual(readLedger(), []);
  });

  test("releaseClaims removes only as many identical-identity rows as requested, not every matching row", () => {
    const dup = claim({ asset: "dup/x" });
    seedLedger([dup, dup]); // two ledger rows sharing identical platform/day/time/asset/by

    const result = releaseClaims([dup]);
    assert.deepEqual(result, { removed: 1, removedClaims: [dup] });
    assert.deepEqual(readLedger(), [dup], "one identical row must survive — only one release was requested");
  });
});

/**
 * Unit tests for claimSlots — the DST-aware Pacific-time date math, weekly volume caps, and
 * daily-uniqueness-per-platform enforcement that decides every post's actual send time.
 *
 * claimSlots accepts test-only `now` and `schedule` overrides (added for this test suite) so no
 * mocking of Date or the real config/platforms.yaml is needed. The ledger is isolated to a fixture
 * file via CONTENT_AGENTS_TEST_LEDGER, same isolation mechanism as the tests above.
 */
describe("slots.ts: claimSlots", () => {
  const TEST_LEDGER = join(SCRATCH, "test-fixture-claim-slots-ledger.jsonl");

  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  beforeEach(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  const DAILY: PlatformSchedule = { postsPerWeek: 99, days: [0, 1, 2, 3, 4, 5, 6], timePst: "09:00" };

  // Monday-of-week key in LA time, independently reimplemented from the documented spec (a claim
  // occupies one Mon-Sun LA week for the postsPerWeek cap) — not a copy of slots.ts's private
  // weekKey(), so it actually verifies the cap logic rather than restating it.
  function mondayKeyLA(iso: string): string {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = WD[parts.weekday];
    const back = (weekday + 6) % 7; // days since Monday
    const y = +parts.year;
    const mo = +parts.month;
    const d = +parts.day;
    return new Date(Date.UTC(y, mo - 1, d - back)).toISOString().slice(0, 10);
  }

  function laDayLA(iso: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(iso));
  }

  test("windowKey with no configured cadence falls back to next-free-slot", () => {
    const { times, labels } = claimSlots({
      windowKey: "no-such-platform",
      conflictPlatforms: ["no-such-platform"],
      count: 2,
      asset: "test/asset",
      by: "test",
      schedule: {},
    });
    assert.deepEqual(times, ["next-free-slot", "next-free-slot"]);
    assert.deepEqual(labels, ["next-free-slot", "next-free-slot"]);
  });

  test("only claims days allowed by slot_days (Wed-only cadence)", () => {
    const schedule: Record<string, PlatformSchedule> = {
      p: { postsPerWeek: 99, days: [3], timePst: "09:00" }, // Wed only
    };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 3,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 3);
    const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" });
    for (const t of times) assert.equal(wdFmt.format(new Date(t)), "Wed", `${t} should land on a Wednesday`);
  });

  test("claims land at the configured slot_time_pst wall-clock hour in LA", () => {
    const schedule: Record<string, PlatformSchedule> = { p: { ...DAILY, timePst: "14:45" } };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 1,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    const hmFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    assert.equal(hmFmt.format(new Date(times[0])), "14:45");
  });

  test("DST-aware: the same 09:00 PT wall-clock time lands at different UTC hours in PDT vs PST", () => {
    const schedule: Record<string, PlatformSchedule> = { p: DAILY };
    const summer = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 1,
      asset: "summer",
      by: "test",
      schedule,
      now: new Date("2026-07-01T12:00:00.000Z"), // PDT (UTC-7)
    });
    const winter = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 1,
      asset: "winter",
      by: "test",
      schedule,
      now: new Date("2026-01-01T12:00:00.000Z"), // PST (UTC-8)
    });
    assert.equal(new Date(summer.times[0]).getUTCHours(), 16, "09:00 PDT = 16:00 UTC");
    assert.equal(new Date(winter.times[0]).getUTCHours(), 17, "09:00 PST = 17:00 UTC");
  });

  test("weekly volume cap: postsPerWeek limits claims to one per Mon-Sun LA week", () => {
    const schedule: Record<string, PlatformSchedule> = { p: { ...DAILY, postsPerWeek: 1 } };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 5,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 5);
    const weeks = times.map(mondayKeyLA);
    assert.equal(new Set(weeks).size, 5, `each claim must land in a distinct week, got weeks: ${weeks.join(", ")}`);
  });

  test("daily uniqueness: a conflict platform already claimed on a day blocks that day for a different windowKey", () => {
    const schedule: Record<string, PlatformSchedule> = { a: DAILY, c: DAILY };
    const now = new Date("2026-07-06T12:00:00.000Z");

    // First claim: windowKey "a", conflicting with "b" too -> records day D1 for both a and b.
    const first = claimSlots({ windowKey: "a", conflictPlatforms: ["a", "b"], count: 1, asset: "first", by: "test", schedule, now });
    const d1 = laDayLA(first.times[0]);

    // Second claim: windowKey "c", conflicting with "b" -> day D1 is blocked (taken by "b"),
    // so it must skip to the very next day (daily cadence, nothing else blocking).
    const second = claimSlots({ windowKey: "c", conflictPlatforms: ["b"], count: 1, asset: "second", by: "test", schedule, now });
    const d2 = laDayLA(second.times[0]);

    assert.notEqual(d2, d1, "second claim must not reuse the day already taken by conflict platform b");
  });

  test("a day already in the past (before now) is never claimed", () => {
    const schedule: Record<string, PlatformSchedule> = { p: DAILY };
    const now = new Date("2026-07-06T12:00:00.000Z");
    const { times } = claimSlots({ windowKey: "p", conflictPlatforms: ["p"], count: 1, asset: "a", by: "test", schedule, now });
    assert.ok(new Date(times[0]).getTime() > now.getTime(), "claimed time must be strictly after now");
  });

  test("dryRun computes times without writing to the ledger", () => {
    const schedule: Record<string, PlatformSchedule> = { p: DAILY };
    claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 1,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
      dryRun: true,
    });
    assert.equal(existsSync(TEST_LEDGER), false, "dryRun must not create/append the ledger");
  });

  test("claims persist across separate claimSlots calls via the shared ledger", () => {
    const schedule: Record<string, PlatformSchedule> = { p: { ...DAILY, postsPerWeek: 1 } };
    const now = new Date("2026-07-06T12:00:00.000Z");
    const first = claimSlots({ windowKey: "p", conflictPlatforms: ["p"], count: 1, asset: "first", by: "test", schedule, now });
    const second = claimSlots({ windowKey: "p", conflictPlatforms: ["p"], count: 1, asset: "second", by: "test", schedule, now });
    assert.notEqual(mondayKeyLA(second.times[0]), mondayKeyLA(first.times[0]), "second run must respect the cap already claimed by the first");
  });

  test("labels are human-readable PT strings matching the claimed times", () => {
    const schedule: Record<string, PlatformSchedule> = { p: DAILY };
    const { times, labels } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 1,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.match(labels[0], /PT$/);
    assert.equal(labels[0], fmtLa(new Date(times[0])));
  });

  test("default behavior unchanged: a platform with no maxSlotsPerDay still caps at 1 claim per PT-day", () => {
    const schedule: Record<string, PlatformSchedule> = { p: DAILY };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 2,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 2);
    assert.notEqual(laDayLA(times[0]), laDayLA(times[1]), "with no maxSlotsPerDay set, two claims must land on different PT-days");
  });

  test("maxSlotsPerDay > 1 lets a platform claim multiple slots on the same PT-day, spaced across the day", () => {
    const schedule: Record<string, PlatformSchedule> = { p: { ...DAILY, maxSlotsPerDay: 3 } };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 3,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 3);
    const days = times.map(laDayLA);
    assert.equal(new Set(days).size, 1, `all 3 claims should land on the same PT-day, got days: ${days.join(", ")}`);

    const hmFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const hms = times.map((t) => hmFmt.format(new Date(t)));
    assert.equal(new Set(hms).size, 3, `all 3 claims should land at distinct times, got: ${hms.join(", ")}`);
  });

  test("maxSlotsPerDay > 1 rolls over to the next PT-day once the day's slots are exhausted", () => {
    const schedule: Record<string, PlatformSchedule> = { p: { ...DAILY, maxSlotsPerDay: 2 } };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p"],
      count: 3,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 3);
    const days = times.map(laDayLA);
    assert.equal(new Set(days).size, 2, `3 claims at max 2/day should span exactly 2 PT-days, got days: ${days.join(", ")}`);
  });

  test("maxSlotsPerDay > 1 on the windowKey still respects a conflict platform capped at 1/day", () => {
    const schedule: Record<string, PlatformSchedule> = {
      p: { ...DAILY, maxSlotsPerDay: 3 },
      q: DAILY, // conflict platform, no override -> still capped at 1/day
    };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p", "q"],
      count: 3,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 3);
    const days = times.map(laDayLA);
    assert.equal(new Set(days).size, 3, "conflict platform q (capped at 1/day) forces each claim onto a distinct day");
  });

  test("spacing accounts for a stricter conflict-platform cap, not just windowKey's own maxSlotsPerDay", () => {
    const schedule: Record<string, PlatformSchedule> = {
      p: { ...DAILY, maxSlotsPerDay: 5 },
      q: { ...DAILY, maxSlotsPerDay: 2 }, // tighter cap -> the group can only land 2/day, not 5
    };
    const { times } = claimSlots({
      windowKey: "p",
      conflictPlatforms: ["p", "q"],
      count: 2,
      asset: "a",
      by: "test",
      schedule,
      now: new Date("2026-07-06T12:00:00.000Z"),
    });
    assert.equal(times.length, 2);
    assert.equal(laDayLA(times[0]), laDayLA(times[1]), "both claims should land on the same PT-day (2 <= q's cap)");

    const hmFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // DAILY anchors at 09:00; spaced for the achievable count of 2 (not windowKey p's own cap of 5),
    // the second slot should land at 16:30 (halfway to midnight), not 12:00 (5-way spacing).
    assert.equal(hmFmt.format(new Date(times[1])), "16:30", "second slot must be spaced for the group's real 2/day cap, not p's own 5/day cap");
  });
});

// Strategy lever C (card ed23f712): config/schedule-overrides.yaml layered onto loadSchedule().
// CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES points loadApprovedOverrides()/loadSchedule() at an
// isolated fixture file (same convention as CONTENT_AGENTS_TEST_LEDGER above), so these tests
// never touch the real config/schedule-overrides.yaml.
describe("slots.ts: loadApprovedOverrides — approved/missing/malformed handling", () => {
  const FIXTURE = join(SCRATCH, "test-schedule-overrides.yaml");

  before(() => {
    process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES = FIXTURE;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES;
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
  });

  test("approved: true returns the overrides block", () => {
    writeFileSync(FIXTURE, `approved: true\ngenerated: "2026-07-15"\noverrides:\n  x:\n    posts_per_week: 8\n`);
    const overrides = loadApprovedOverrides();
    assert.deepEqual(overrides, { x: { posts_per_week: 8 } });
  });

  test("approved: false returns no overrides, even with a populated overrides block", () => {
    writeFileSync(FIXTURE, `approved: false\ngenerated: "2026-07-15"\noverrides:\n  x:\n    posts_per_week: 8\n`);
    assert.deepEqual(loadApprovedOverrides(), {});
  });

  test("a missing file returns no overrides", () => {
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
    assert.deepEqual(loadApprovedOverrides(), {});
  });

  test("a malformed file returns no overrides instead of throwing", () => {
    writeFileSync(FIXTURE, `approved: true\n  overrides: [this is not valid yaml`);
    assert.deepEqual(loadApprovedOverrides(), {});
  });
});

// Strategy lever C follow-through (epic 2ce597d7): cadenceSourceFor is what
// src/publish/typefully.ts calls at slot-claim time to decide the 'override' | 'default' marker
// it stamps onto that platform's Placed-log row (queue.ts's appendBetPlacement cadenceSource
// param). Reuses the exact same loadApprovedOverrides() source loadSchedule() consults, so it can
// never disagree with what loadSchedule() actually did for that platform.
describe("slots.ts: cadenceSourceFor — 'override' only when an approved override exists for that platform", () => {
  const FIXTURE = join(SCRATCH, "test-schedule-overrides.yaml");

  before(() => {
    process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES = FIXTURE;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES;
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
  });

  test("an approved override listing the platform reads 'override'", () => {
    writeFileSync(FIXTURE, `approved: true\ngenerated: "2026-08-18"\noverrides:\n  x:\n    posts_per_week: 8\n`);
    assert.equal(cadenceSourceFor("x"), "override");
  });

  test("approved: true but the platform isn't listed in overrides reads 'default'", () => {
    writeFileSync(FIXTURE, `approved: true\ngenerated: "2026-08-18"\noverrides:\n  x:\n    posts_per_week: 8\n`);
    assert.equal(cadenceSourceFor("linkedin"), "default");
  });

  test("approved: false reads 'default' even when the platform is listed in overrides", () => {
    writeFileSync(FIXTURE, `approved: false\ngenerated: "2026-08-18"\noverrides:\n  x:\n    posts_per_week: 8\n`);
    assert.equal(cadenceSourceFor("x"), "default");
  });

  test("a missing overrides file reads 'default'", () => {
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
    assert.equal(cadenceSourceFor("x"), "default");
  });
});

describe("slots.ts: loadSchedule() layers an approved override over config/platforms.yaml", () => {
  const FIXTURE = join(SCRATCH, "test-schedule-overrides.yaml");

  before(() => {
    process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES = FIXTURE;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_SCHEDULE_OVERRIDES;
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
  });

  // Each test starts from a clean (no fixture file) state, so an earlier test's leftover
  // fixture never leaks into the "baseline" a later test captures.
  beforeEach(() => {
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
  });

  test("an approved override changes postsPerWeek/timePst for its platform; other platforms are untouched", () => {
    const baseline = loadSchedule(); // real config/platforms.yaml, no override file present yet
    const baseX = baseline.x;
    assert.ok(baseX, "config/platforms.yaml must have a schedulable x entry for this test to be meaningful");

    writeFileSync(
      FIXTURE,
      `approved: true\ngenerated: "2026-07-15"\noverrides:\n  x:\n    posts_per_week: ${baseX.postsPerWeek + 2}\n    slot_time_pst: "05:00"\n`
    );
    const overridden = loadSchedule();
    assert.equal(overridden.x.postsPerWeek, baseX.postsPerWeek + 2);
    assert.equal(overridden.x.timePst, "05:00");
    assert.equal(overridden.x.days.length, baseX.days.length, "slot_days is untouched — out of lever C's scope");

    if (baseline.linkedin) {
      assert.deepEqual(overridden.linkedin, baseline.linkedin, "a platform absent from overrides is completely unchanged");
    }
  });

  test("approved: false leaves loadSchedule()'s output identical to the no-override baseline", () => {
    const baseline = loadSchedule();
    writeFileSync(FIXTURE, `approved: false\ngenerated: "2026-07-15"\noverrides:\n  x:\n    posts_per_week: 99\n`);
    assert.deepEqual(loadSchedule(), baseline);
  });

  test("no fixture file at all leaves loadSchedule()'s output identical to the no-override baseline", () => {
    const baseline = loadSchedule();
    if (existsSync(FIXTURE)) unlinkSync(FIXTURE);
    assert.deepEqual(loadSchedule(), baseline);
  });
});

/**
 * SLICE-5O Lane A: the ledger's pre-data-root claims survive the move.
 *
 * Operational state moved out of the checkout to dataRoot(). Eleven stores call
 * migrateLegacyDataFile to carry their in-checkout file forward; the slot ledger did not, so the
 * first publish run after the move would start from an empty ledger and place a second post into a
 * slot Muxin had already claimed. These tests assert on the CLAIMS a read returns, never on a path
 * string or a spy — a wrong path reads an empty ledger and looks perfectly healthy.
 *
 * Every block here drives the real resolution (CONTENT_AGENTS_TEST_LEDGER unset) but pins both ends
 * of the migration at fixtures: CONTENT_AGENTS_DATA_ROOT for the canonical end,
 * CONTENT_AGENTS_TEST_LEGACY_LEDGER for the legacy end.
 */
describe("slots.ts: pre-data-root ledger migration", () => {
  const CANONICAL_PARTS = ["scheduler", "publish-schedule.jsonl"];
  let saved: Record<string, string | undefined>;
  let caseDir: string;
  let legacyFile: string;
  let dataRootDir: string;

  const serialize = (claims: Claim[]): string => claims.map((c) => JSON.stringify(c)).join("\n") + "\n";
  const digest = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

  before(() => {
    saved = {
      ledger: process.env.CONTENT_AGENTS_TEST_LEDGER,
      legacy: process.env.CONTENT_AGENTS_TEST_LEGACY_LEDGER,
      dataRoot: process.env.CONTENT_AGENTS_DATA_ROOT,
    };
  });

  after(() => {
    if (saved.ledger === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEDGER = saved.ledger;
    if (saved.legacy === undefined) delete process.env.CONTENT_AGENTS_TEST_LEGACY_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEGACY_LEDGER = saved.legacy;
    if (saved.dataRoot === undefined) delete process.env.CONTENT_AGENTS_DATA_ROOT;
    else process.env.CONTENT_AGENTS_DATA_ROOT = saved.dataRoot;
  });

  beforeEach(() => {
    caseDir = mkdtempSync(join(SCRATCH, "case-"));
    legacyFile = join(caseDir, "legacy", "publish-schedule.jsonl");
    dataRootDir = join(caseDir, "data-root");
    mkdirSync(dirname(legacyFile), { recursive: true });
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    process.env.CONTENT_AGENTS_TEST_LEGACY_LEDGER = legacyFile;
    process.env.CONTENT_AGENTS_DATA_ROOT = dataRootDir;
  });

  // A1
  test("with no canonical ledger, a read returns the claims held by the pre-move legacy file", () => {
    const historical = [
      claim({ platform: "linkedin", day: "2026-07-09", time: "2026-07-09T16:00:00.000Z", asset: "content/real-essay/linkedin", by: "typefully" }),
      claim({ platform: "bluesky", day: "2026-07-10", time: "2026-07-10T17:30:00.000Z", asset: "content/real-essay/card", by: "cards" }),
    ];
    writeFileSync(legacyFile, serialize(historical));
    assert.equal(existsSync(join(dataRootDir, ...CANONICAL_PARTS)), false, "canonical ledger must not exist yet");

    assert.deepEqual(readLedger(), historical, "the July claims must be visible to the scheduler after the move");
  });

  // A1, second half: the claims come back from the CANONICAL file, not by still reading the legacy
  // one. Deleting the legacy file after the migration must change nothing.
  test("after the migration the claims are read from the canonical location, not the legacy file", () => {
    const historical = [claim({ asset: "content/real-essay/x", by: "typefully" })];
    writeFileSync(legacyFile, serialize(historical));

    assert.deepEqual(readLedger(), historical);
    assert.equal(existsSync(join(dataRootDir, ...CANONICAL_PARTS)), true, "the claims must now live under dataRoot()");

    unlinkSync(legacyFile);
    assert.deepEqual(readLedger(), historical, "with the legacy file gone the claims must still be there");
  });

  // A2
  test("the legacy file still exists and is byte-identical after the migration", () => {
    const historical = [claim({ asset: "content/real-essay/bluesky", by: "cards" })];
    writeFileSync(legacyFile, serialize(historical));
    const before = digest(legacyFile);

    readLedger();
    // A write after the migration must land on the canonical file only.
    writeLedgerAtomic([...historical, claim({ asset: "content/new/x" })]);

    assert.equal(existsSync(legacyFile), true, "the migration copies forward, it never moves or deletes");
    assert.equal(digest(legacyFile), before, "the legacy file must be byte-identical");
  });

  // A3
  test("a legacy file never overwrites a canonical ledger that already exists", () => {
    const canonicalClaims = [claim({ asset: "canonical/keep-me", by: "typefully" })];
    const legacyClaims = [claim({ asset: "legacy/must-not-win", by: "cards" })];
    mkdirSync(join(dataRootDir, "scheduler"), { recursive: true });
    writeFileSync(join(dataRootDir, ...CANONICAL_PARTS), serialize(canonicalClaims));
    writeFileSync(legacyFile, serialize(legacyClaims));
    const legacyBefore = digest(legacyFile);

    assert.deepEqual(readLedger(), canonicalClaims, "the canonical ledger wins; the legacy file must not clobber it");
    assert.equal(digest(legacyFile), legacyBefore, "and the legacy file is left alone");
  });

  // A3, the same guard under the path that actually claims slots rather than a bare read.
  test("claimSlots sees the migrated claims and does not reuse a day the legacy ledger already claimed", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");
    const schedule: Record<string, PlatformSchedule> = {
      p: { postsPerWeek: 99, days: [0, 1, 2, 3, 4, 5, 6], timePst: "09:00" },
    };
    // Claim tomorrow (2026-07-07 PT) in the legacy ledger only.
    writeFileSync(
      legacyFile,
      serialize([claim({ platform: "p", day: "2026-07-07", time: "2026-07-07T16:00:00.000Z", asset: "legacy/already-placed", by: "typefully" })])
    );

    const { times } = claimSlots({ windowKey: "p", conflictPlatforms: ["p"], count: 1, asset: "new", by: "test", schedule, now });
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(times[0]));
    assert.notEqual(day, "2026-07-07", "the day the pre-move ledger already claimed must not be handed out again");
  });

  // A4
  test("with no test override the canonical path is still <dataRoot>/scheduler/publish-schedule.jsonl", () => {
    assert.equal(ledgerPath(), join(dataRootDir, ...CANONICAL_PARTS));
  });

  // A4, outside a test context and with no CONTENT_AGENTS_DATA_ROOT: a child process with neither
  // NODE_TEST_CONTEXT nor a configured data root resolves through the real homedir() formula. HOME
  // points at a throwaway directory so this never writes into Muxin's own ~/.content-agents.
  test("outside a test context the production path resolves under the data root and the migration reaches it", () => {
    const historical = [claim({ asset: "content/real-essay/production", by: "typefully" })];
    writeFileSync(legacyFile, serialize(historical));
    const home = join(caseDir, "home");
    mkdirSync(home, { recursive: true });

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      SLOTS_MODULE: join(repoRoot, "src", "publish", "slots.ts"),
      CONTENT_AGENTS_TEST_LEGACY_LEDGER: legacyFile,
    };
    delete env.NODE_TEST_CONTEXT;
    delete env.CONTENT_AGENTS_DATA_ROOT;
    delete env.CONTENT_AGENTS_TEST_LEDGER;

    const script = [
      'import { pathToFileURL } from "node:url";',
      'const mod = await import(pathToFileURL(process.env.SLOTS_MODULE).href);',
      'process.stdout.write(JSON.stringify({ path: mod.ledgerPath(), claims: mod.readLedger() }));',
    ].join("\n");
    const run = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    });
    assert.equal(run.status, 0, `child failed: ${run.stderr}`);

    const out = JSON.parse(run.stdout.slice(run.stdout.indexOf("{"))) as { path: string; claims: Claim[] };
    assert.ok(out.path.startsWith(join(home, ".content-agents")), `expected a path under the data root, got ${out.path}`);
    assert.ok(out.path.endsWith(join("scheduler", "publish-schedule.jsonl")), `expected the canonical filename, got ${out.path}`);
    assert.deepEqual(out.claims, historical, "a production-shaped run must see the pre-move claims");
  });

  // R1, and the sharper of the two failures it covers: no concurrency needed. The migration used to
  // copy straight onto the canonical path, so a process killed mid-copy left a truncated file there
  // — and the fast-path `existsSync(canonical)` guard then suppressed the migration forever, losing
  // the rest of the real claims silently. The staged copy makes the canonical path all-or-nothing.
  test("an interrupted migration leaves no partial canonical ledger, and the next read returns the complete claim set", () => {
    const historical = [
      claim({ asset: "content/real-essay/one", by: "typefully" }),
      claim({ asset: "content/real-essay/two", by: "cards" }),
      claim({ asset: "content/real-essay/three", by: "typefully" }),
    ];
    writeFileSync(legacyFile, serialize(historical));
    const canonical = join(dataRootDir, ...CANONICAL_PARTS);

    // A copy that writes a truncated prefix and then dies, which is the state a kill mid-copy leaves.
    assert.throws(
      () =>
        migrateLegacyDataFile(CANONICAL_PARTS, dirname(legacyFile), [basename(legacyFile)], {
          copyFileSync: (from, to) => {
            writeFileSync(to, readFileSync(from).subarray(0, 40));
            throw new Error("killed mid-copy");
          },
          renameSync: () => {
            throw new Error("should not be reached");
          },
        }),
      /killed mid-copy/
    );

    assert.equal(existsSync(canonical), false, "a partial file must never be visible at the canonical path");
    assert.deepEqual(
      readdirSync(join(dataRootDir, "scheduler")).filter((name) => name.endsWith(".migrating")),
      [],
      "the partial staging file must not be left behind"
    );
    assert.deepEqual(readLedger(), historical, "the next read must return every claim, not the truncated prefix");
  });

  // R1's concurrent case. Two real processes migrate the same ledger at once. The interleaving is
  // forced with an injected pause inside process A's copy rather than left to natural timing — a
  // timing-only version of this test would be flaky and would usually pass for the wrong reason.
  // A holds the migration lock with a half-written staging file; B then reads the ledger and claims
  // a slot. B must never see a partial claim set, and B's claim must still be there after A finishes.
  //
  // The deterministic regression detector for the staged copy is the interrupted-migration test
  // above, not this one: this one only catches the pre-repair behaviour when B actually reads inside
  // A's pause. It is also not flake-free — B waits on the migration lock, whose own 10s timeout can
  // expire on a badly loaded machine. What it must never do is HANG, so A is released and both
  // children are killed and reaped in a `finally`, on every path including the failure ones.
  test("concurrent first use: neither process sees a partial ledger, and a claim placed during the migration survives", async () => {
    const historical = [
      claim({ asset: "content/real-essay/one", by: "typefully" }),
      claim({ asset: "content/real-essay/two", by: "cards" }),
      claim({ asset: "content/real-essay/three", by: "typefully" }),
    ];
    writeFileSync(legacyFile, serialize(historical));

    const paused = join(caseDir, "a-paused");
    const go = join(caseDir, "go");
    const bStarted = join(caseDir, "b-started");
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CONTENT_AGENTS_DATA_ROOT: dataRootDir,
      CONTENT_AGENTS_TEST_LEGACY_LEDGER: legacyFile,
      DATA_ROOT_MODULE: join(repoRoot, "src", "runtime", "data-root.ts"),
      SLOTS_MODULE: join(repoRoot, "src", "publish", "slots.ts"),
      LEGACY_DIR: dirname(legacyFile),
      LEGACY_NAME: basename(legacyFile),
      PAUSED: paused,
      GO: go,
      B_STARTED: bStarted,
    };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.CONTENT_AGENTS_TEST_LEDGER;

    type ChildResult = { code: number | null; stdout: string; stderr: string };
    const children: ReturnType<typeof spawn>[] = [];
    const settled: Promise<ChildResult>[] = [];
    const run = (script: string): Promise<ChildResult> => {
      const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
        cwd: repoRoot,
        env: childEnv,
      });
      children.push(child);
      const done = new Promise<ChildResult>((resolve) => {
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => (stdout += String(d)));
        child.stderr?.on("data", (d) => (stderr += String(d)));
        // `error` fires instead of `close` when the spawn itself fails, so resolve on both or a
        // failed spawn would leave this promise pending forever.
        child.on("error", (err) => resolve({ code: null, stdout, stderr: `${stderr}${err.message}` }));
        child.on("close", (code) => resolve({ code, stdout, stderr }));
      });
      settled.push(done);
      return done;
    };

    const aScript = [
      'import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";',
      'import { pathToFileURL } from "node:url";',
      'const { migrateLegacyDataFile } = await import(pathToFileURL(process.env.DATA_ROOT_MODULE).href);',
      'const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
      'migrateLegacyDataFile(["scheduler", "publish-schedule.jsonl"], process.env.LEGACY_DIR, [process.env.LEGACY_NAME], {',
      '  copyFileSync: (from, to) => {',
      '    const bytes = readFileSync(from);',
      '    writeFileSync(to, bytes.subarray(0, 40));',   // a visibly partial destination
      '    writeFileSync(process.env.PAUSED, "");',
      '    while (!existsSync(process.env.GO)) nap(10);',
      '    writeFileSync(to, bytes);',
      '  },',
      '  renameSync,',
      '});',
    ].join("\n");

    const bScript = [
      'import { writeFileSync } from "node:fs";',
      'import { pathToFileURL } from "node:url";',
      'const m = await import(pathToFileURL(process.env.SLOTS_MODULE).href);',
      'writeFileSync(process.env.B_STARTED, "");',
      'const read = m.readLedger();',
      'm.claimSlots({ windowKey: "p", conflictPlatforms: ["p"], count: 1, asset: "b-new", by: "test",',
      '  schedule: { p: { postsPerWeek: 99, days: [0, 1, 2, 3, 4, 5, 6], timePst: "09:00" } },',
      '  now: new Date("2026-07-06T12:00:00.000Z") });',
      'process.stdout.write(JSON.stringify({ read }));',
    ].join("\n");

    const nap = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (path: string, label: string): Promise<void> => {
      // 15s is far past a tsx cold start; the point of the cap is that a child that never arrives
      // fails this test rather than parking the gate.
      for (let i = 0; i < 300 && !existsSync(path); i++) await nap(50);
      assert.equal(existsSync(path), true, `timed out waiting for ${label}`);
    };

    try {
      const aDone = run(aScript);
      await waitFor(paused, "process A to reach the middle of its copy");
      const bDone = run(bScript);
      await waitFor(bStarted, "process B to start");
      await nap(250); // B is now inside readLedger(), blocked on the migration lock A holds.
      writeFileSync(go, "");
      const [a, b] = await Promise.all([aDone, bDone]);

      assert.equal(a.code, 0, `process A failed: ${a.stderr}`);
      assert.equal(b.code, 0, `process B failed: ${b.stderr}`);

      const observed = JSON.parse(b.stdout.slice(b.stdout.indexOf("{"))) as { read: Claim[] };
      assert.deepEqual(observed.read, historical, "process B must never observe a half-migrated ledger");

      const final = readLedger();
      assert.deepEqual(final.slice(0, historical.length), historical, "the migrated claims must all still be there");
      assert.equal(final.some((c) => c.asset === "b-new"), true, "the claim B placed must not be overwritten by A finishing its copy");
    } finally {
      // Every failure path above leaves A parked in its `while (!existsSync(GO))` loop. Write GO so
      // it can finish on its own, then kill both regardless — a child that already exited ignores
      // this — and await the close handlers so nothing is left running or unreaped. Without this a
      // child that never starts turns a bounded test failure into a hung `npm run check`.
      try {
        writeFileSync(go, "");
      } catch {
        /* the case directory may already be gone; killing below is the real guarantee */
      }
      for (const child of children) child.kill("SIGKILL");
      await Promise.all(settled);
    }
  });
});

// Last in the file, so it runs after every block above. A clean `git status` would only prove the
// real ledger was RESTORED; this proves it was never written in the first place.
describe("slots.test.ts leaves Muxin's real publish ledger alone", () => {
  after(() => {
    rmSync(SCRATCH, { recursive: true, force: true });
  });

  test("data/publish-schedule.jsonl is byte-identical to what it was before this suite ran", () => {
    assert.equal(realLedgerDigest(), REAL_LEDGER_BEFORE);
  });
});
