/**
 * Unit tests for src/publish/slots.ts — the atomic ledger rewrite (writeLedgerAtomic) and
 * releaseClaims (drops specific claims, e.g. an orphaned future claim --sync finds).
 *
 * Strategy: the ledger path is hardcoded (join(repoRoot, "data", "publish-schedule.jsonl")), same
 * as reuse-guard.test.ts's bets.md problem. before/after hooks save the real file and restore it
 * on teardown so real local ledger data is never lost.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readLedger,
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
const LEDGER = join(repoRoot, "data", "publish-schedule.jsonl");

let savedLedger: string | null = null;
let savedExisted = false;

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
    savedExisted = existsSync(LEDGER);
    savedLedger = savedExisted ? readFileSync(LEDGER, "utf8") : null;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (savedExisted) writeFileSync(LEDGER, savedLedger ?? "");
    else if (existsSync(LEDGER)) unlinkSync(LEDGER);
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
  const TEST_LEDGER = join(repoRoot, "data", "test-fixture-claim-slots-ledger.jsonl");

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
  const FIXTURE = join(repoRoot, "data", "test-schedule-overrides.yaml");

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
  const FIXTURE = join(repoRoot, "data", "test-schedule-overrides.yaml");

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
  const FIXTURE = join(repoRoot, "data", "test-schedule-overrides.yaml");

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
