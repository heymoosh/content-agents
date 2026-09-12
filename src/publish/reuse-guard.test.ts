/**
 * Unit tests for src/publish/reuse-guard.ts — checkReuse window math.
 *
 * Strategy: checkReuse reads briefs/bets.md from a hardcoded path (join(repoRoot, "briefs/bets.md")).
 * We can't inject that path, so the before/after hooks write controlled fixture lines to the real
 * bets.md and restore the original on teardown.
 *
 * checkReuse accepts a minDaysOverride param that skips the platforms.yaml lookup, which makes most
 * window-math tests fully deterministic without touching config. The per-platform test deliberately
 * omits the override so it exercises the real config/platforms.yaml lookup.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReuse, checkReuseForRow, resolveVariantDays } from "./reuse-guard.js";
import { loadPlatforms, platformsConfigSchema, type PlatformsConfig } from "../config/platforms.js";

// Compute repo root the same way db.ts does: dirname(this file) = src/publish → ../.. = repo root
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BETS_PATH = join(mkdtempSync(join(tmpdir(), "reuse-guard-brand-")), "human-inference-bets.md");

// Unique test slugs — chosen to be impossible to collide with real placed-log entries.
const SLUG_WINDOW = "test-fixture-9999-rg-window";
const SLUG_PLATFORM = "test-fixture-9999-rg-platform";

const now = Date.now();
const fiveDaysAgo   = new Date(now - 5  * 86_400_000).toISOString(); // inside 30-day window
const fortyDaysAgo  = new Date(now - 40 * 86_400_000).toISOString(); // outside 30-day window
const twentyDaysAgo = new Date(now - 20 * 86_400_000).toISOString(); // outside x(14) but inside linkedin(60)

// Fixture lines that look exactly like real placed-log entries so the regex matches them.
const FIXTURE_LINES = `
- placed ${fiveDaysAgo} [${SLUG_WINDOW}/x-1] x → test fixture inside window
- placed ${fortyDaysAgo} [${SLUG_WINDOW}/linkedin-1] linkedin → test fixture outside window
- placed ${twentyDaysAgo} [${SLUG_PLATFORM}/x-1] x → test fixture platform-x 20d
- placed ${twentyDaysAgo} [${SLUG_PLATFORM}/linkedin-1] linkedin → test fixture platform-linkedin 20d
`;

let savedBets: string | null = null;

describe("reuse-guard: checkReuse window math", () => {
  before(() => {
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = BETS_PATH;
    savedBets = existsSync(BETS_PATH) ? readFileSync(BETS_PATH, "utf8") : null;
    // Append fixture lines so real bets data is undisturbed (avoids test-vs-reality bleed).
    writeFileSync(BETS_PATH, (savedBets ?? "") + "\n" + FIXTURE_LINES);
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    // Restore exactly what was there (or remove if bets.md didn't exist).
    if (savedBets === null) {
      // file didn't exist before — but briefs/bets.md always exists in this repo, leave it as-is
      writeFileSync(BETS_PATH, "");
    } else {
      writeFileSync(BETS_PATH, savedBets);
    }
  });

  test("blocked when last placement is inside min_reuse_days window", () => {
    // SLUG_WINDOW placed on x 5 days ago; override min=30 → 5 < 30 → blocked
    const result = checkReuse(SLUG_WINDOW, "x", 30);
    assert.equal(result.allowed, false, "should be blocked (5 days < 30)");
    assert.ok(result.reason !== undefined, "should have a reason string");
    assert.ok(result.reason!.includes(SLUG_WINDOW), "reason should name the slug");
    assert.ok(
      typeof result.daysSince === "number" && result.daysSince < 30,
      `daysSince (${result.daysSince}) should be < 30`
    );
    assert.ok(result.lastPlacedAt !== undefined, "should record the last placement timestamp");
  });

  test("allowed when last placement is outside min_reuse_days window", () => {
    // SLUG_WINDOW placed on linkedin 40 days ago; override min=30 → 40 > 30 → allowed
    const result = checkReuse(SLUG_WINDOW, "linkedin", 30);
    assert.equal(result.allowed, true, "should be allowed (40 days > 30)");
    assert.ok(result.reason === undefined, "should have no reason when allowed");
    assert.ok(
      typeof result.daysSince === "number" && result.daysSince > 30,
      `daysSince (${result.daysSince}) should be > 30`
    );
  });

  test("allowed when no prior placement exists for slug", () => {
    const result = checkReuse("no-such-slug-ever-placed-anywhere", "x", 30);
    assert.equal(result.allowed, true, "unknown slug should be allowed");
    assert.equal(result.lastPlacedAt, undefined, "no lastPlacedAt for unknown slug");
    assert.equal(result.daysSince, undefined, "no daysSince for unknown slug");
  });

  test("allowed when prior placement is for a different platform", () => {
    // SLUG_WINDOW has only x and linkedin placements — bluesky has none
    const result = checkReuse(SLUG_WINDOW, "bluesky", 30);
    assert.equal(result.allowed, true, "no bluesky placement → allowed");
  });

  test("per-platform min_reuse_days from platforms.yaml honored: x(14) vs linkedin(60) with 20-day-old placement", () => {
    // Both SLUG_PLATFORM/x and SLUG_PLATFORM/linkedin were placed 20 days ago.
    // config/platforms.yaml: x.min_reuse_days = 14, linkedin.min_reuse_days = 60
    // 20 > 14 → x: allowed
    // 20 < 60 → linkedin: blocked
    const xResult = checkReuse(SLUG_PLATFORM, "x"); // no override: reads real config
    assert.equal(
      xResult.allowed,
      true,
      `x (min=14) with 20-day placement should be allowed, got: ${xResult.reason}`
    );

    const liResult = checkReuse(SLUG_PLATFORM, "linkedin"); // no override: reads real config
    assert.equal(
      liResult.allowed,
      false,
      `linkedin (min=60) with 20-day placement should be blocked`
    );
    assert.ok(liResult.reason?.includes("linkedin"), "linkedin block reason should mention platform");
  });
});

/**
 * SLICE-6Z — the two windows. Two different derivatives of one essay are two different posts, and
 * the guard now tells them apart:
 *   same slug + same platform + SAME row id      → min_reuse_days, still a refusal
 *   same slug + same platform + DIFFERENT row id → min_variant_days, deferrable to a date
 *
 * Every case pins its own fixture timestamps and passes an explicit `now`, so nothing here depends
 * on wall-clock drift. Fixtures live in their own throwaway file; briefs/ is never written.
 */
const VARIANT_BETS_PATH = join(mkdtempSync(join(tmpdir(), "reuse-guard-variant-")), "bets.md");
const VSLUG = "test-fixture-9999-rg-variant";
const NOW = Date.parse("2026-09-12T00:00:00.000Z");
const AN_HOUR_AGO = new Date(NOW - 3_600_000).toISOString();
const TEN_DAYS_AGO = new Date(NOW - 10 * 86_400_000).toISOString();

const placedLine = (slug: string, rowId: string, platform: string, iso: string): string =>
  `- placed ${iso} [${slug}/${rowId}] ${platform} → postiz post pz-0 @ earlier\n`;

/** A PlatformsConfig with only the fields resolveVariantDays reads, so precedence is testable
 *  without editing Muxin's live config/platforms.yaml from a test. */
const cfgWith = (over: { min_variant_days?: number; platforms?: Record<string, { min_variant_days?: number }> }) => ({
  platforms: (over.platforms ?? {}) as PlatformsConfig["platforms"],
  communities: {},
  spin_angles: {},
  ...(over.min_variant_days !== undefined ? { min_variant_days: over.min_variant_days } : {}),
}) as PlatformsConfig;

describe("reuse-guard: the variant window spaces a different derivative instead of refusing it", () => {
  let savedPath: string | undefined;

  before(() => {
    savedPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = VARIANT_BETS_PATH;
  });

  after(() => {
    if (savedPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = savedPath;
    rmSync(dirname(VARIANT_BETS_PATH), { recursive: true, force: true });
  });

  // The exact case that prompted this slice: bluesky-2 placed, bluesky-1 scheduled an hour later.
  test("a DIFFERENT row an hour after a placement defers to lastPlacement + min_variant_days", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    const r = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-1", now: NOW });
    assert.equal(r.allowed, false, "not placeable right now");
    assert.equal(r.deferrable, true, "but it has a date, so it is a deferral and not a refusal");
    assert.equal(r.minVariantDays, 7, "top-level min_variant_days from config/platforms.yaml");
    assert.equal(
      r.earliestAllowedAt,
      new Date(Date.parse(AN_HOUR_AGO) + 7 * 86_400_000).toISOString(),
      "the window opens exactly min_variant_days after the last placement"
    );
    assert.equal(r.minDays, undefined, "a deferral must not advertise a min_reuse_days refusal window");
  });

  test("the SAME row an hour after its own placement still refuses, with today's message and window", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    const r = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-2", now: NOW });
    assert.equal(r.allowed, false);
    assert.ok(!r.deferrable, "re-placing an identical post has no safe date");
    assert.equal(r.earliestAllowedAt, undefined);
    assert.equal(r.minDays, 21, "bluesky's own min_reuse_days, unchanged by this slice");
    assert.match(r.reason ?? "", /min_reuse_days: 21/);
  });

  // The behavior change this slice is actually for: 10 days is past the 7-day variant window but
  // still inside bluesky's 21-day re-publish window, so the merged guard used to refuse it.
  test("a DIFFERENT row past the variant window is allowed even though min_reuse_days has not elapsed", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", TEN_DAYS_AGO)}`);
    const variant = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-1", now: NOW });
    assert.equal(variant.allowed, true, "10 days > min_variant_days 7");

    const sameRow = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-2", now: NOW });
    assert.equal(sameRow.allowed, false, "10 days < min_reuse_days 21 for the identical post");
  });

  test("platforms stay independent: a bluesky placement never defers or blocks x", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    const r = checkReuseForRow(VSLUG, "x", { rowId: "x-1", now: NOW });
    assert.equal(r.allowed, true);
    assert.equal(r.deferrable, undefined);
    assert.equal(r.lastPlacedAt, undefined);
  });

  test("a slug with no prior placement is allowed immediately", () => {
    writeFileSync(VARIANT_BETS_PATH, "# Placed log\n");
    const r = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-1", now: NOW });
    assert.equal(r.allowed, true);
    assert.equal(r.deferrable, undefined);
    assert.equal(r.earliestAllowedAt, undefined);
  });

  // Row-unaware callers must be bit-for-bit unchanged: they cannot honor a spacing floor, so the
  // fail-closed reading for them is the old merged refusal.
  test("checkReuse without a row id keeps the merged single-window refusal", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", TEN_DAYS_AGO)}`);
    const legacy = checkReuse(VSLUG, "bluesky");
    assert.equal(legacy.allowed, false, "merged behavior: any row of the slug blocks for min_reuse_days");
    assert.equal(legacy.minDays, 21);
    assert.equal(legacy.deferrable, undefined);
    assert.equal(checkReuseForRow(VSLUG, "bluesky", { now: NOW }).allowed, false, "same when no rowId is supplied");
  });

  test("an unreadable minVariantDaysOverride window is honored so the floor can be pinned in tests", () => {
    writeFileSync(VARIANT_BETS_PATH, `# Placed log\n${placedLine(VSLUG, "bluesky-2", "bluesky", TEN_DAYS_AGO)}`);
    const r = checkReuseForRow(VSLUG, "bluesky", { rowId: "bluesky-1", minVariantDaysOverride: 30, now: NOW });
    assert.equal(r.allowed, false);
    assert.equal(r.deferrable, true);
    assert.equal(r.earliestAllowedAt, new Date(Date.parse(TEN_DAYS_AGO) + 30 * 86_400_000).toISOString());
  });
});

describe("reuse-guard: min_variant_days precedence", () => {
  test("a platform's own min_variant_days wins over the top-level default", () => {
    assert.equal(resolveVariantDays("bluesky", cfgWith({ min_variant_days: 9, platforms: { bluesky: { min_variant_days: 3 } } })), 3);
  });

  test("the top-level key applies to a platform with no override of its own", () => {
    assert.equal(resolveVariantDays("bluesky", cfgWith({ min_variant_days: 9, platforms: { bluesky: {} } })), 9);
  });

  test("a config with neither falls back to the named constant", () => {
    assert.equal(resolveVariantDays("bluesky", cfgWith({})), 7);
  });

  // Load-bearing for the config edit itself: the shipped value has to come off the real YAML
  // through loadPlatforms(), not merely coincide with the constant fallback. `min_variant_days`
  // reads back undefined if the key is absent from config/platforms.yaml or dropped by the loader.
  test("the real config/platforms.yaml supplies the top-level default", () => {
    assert.equal(loadPlatforms().min_variant_days, 7, "config/platforms.yaml carries min_variant_days: 7");
    assert.equal(resolveVariantDays("bluesky"), 7);
  });
});

/**
 * SLICE-6Z repair round. Both windows have to fail CLOSED, which here means the LONG window and a
 * refusal. Two ways the short window could be reached without anyone deciding it should be:
 *   - identity this process does not actually know (a blank id cell, which readQueue delivers as ""
 *     rather than undefined, or a differently-cased id that an exact compare would miss);
 *   - a `min_variant_days` of 0 or less, which makes `daysSince < minVariantDays` always false.
 */
describe("reuse-guard: unknown or differently-cased row identity falls closed", () => {
  const IDENT_BETS = join(mkdtempSync(join(tmpdir(), "reuse-guard-identity-")), "bets.md");
  const ISLUG = "test-fixture-9999-rg-identity";
  let savedPath: string | undefined;

  before(() => {
    savedPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = IDENT_BETS;
    // One placement of x-1 an hour ago. x's min_reuse_days is 14, min_variant_days is 7, so the two
    // windows give opposite answers here and every case below can only pass on the right one.
    writeFileSync(IDENT_BETS, `# Placed log\n${placedLine(ISLUG, "x-1", "x", AN_HOUR_AGO)}`);
  });

  after(() => {
    if (savedPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = savedPath;
    rmSync(dirname(IDENT_BETS), { recursive: true, force: true });
  });

  const strict = (rowId: string | undefined, label: string): void => {
    const r = checkReuseForRow(ISLUG, "x", { rowId, now: NOW });
    assert.equal(r.allowed, false, `${label} must not be placeable`);
    assert.ok(!r.deferrable, `${label} must take the strict window, not the 7-day variant window`);
    assert.equal(r.earliestAllowedAt, undefined, `${label} must not hand back a spacing date`);
    assert.equal(r.minDays, 14, `${label} must be judged against x's own min_reuse_days`);
    assert.match(r.reason ?? "", /min_reuse_days: 14/);
  };

  test("an omitted row id refuses on min_reuse_days", () => strict(undefined, "omitted id"));
  test("an EMPTY row id refuses on min_reuse_days", () => strict("", "empty id"));
  test("a WHITESPACE-ONLY row id refuses on min_reuse_days", () => strict("   ", "whitespace id"));
  test("a differently-cased row id is the SAME row and refuses on min_reuse_days", () => strict("X-1", "upper-cased id"));
  test("a padded row id is the SAME row and refuses on min_reuse_days", () => strict(" x-1 ", "padded id"));

  // The other direction, so the normalization above cannot pass by matching everything: a genuinely
  // different row whose id merely shares a prefix is still a different post and is spaced, not refused.
  test("a prefix neighbour (x-1 vs x-11) stays two different rows and defers", () => {
    const r = checkReuseForRow(ISLUG, "x", { rowId: "x-11", now: NOW });
    assert.equal(r.allowed, false);
    assert.equal(r.deferrable, true, "x-11 is a different derivative, so it is spaced");
    assert.equal(r.earliestAllowedAt, new Date(Date.parse(AN_HOUR_AGO) + 7 * 86_400_000).toISOString());
  });
});

describe("reuse-guard: a non-positive min_variant_days never means zero spacing", () => {
  const cases: { label: string; cfg: PlatformsConfig }[] = [
    { label: "per-platform 0", cfg: cfgWith({ platforms: { x: { min_variant_days: 0 } } }) },
    { label: "per-platform negative", cfg: cfgWith({ platforms: { x: { min_variant_days: -5 } } }) },
    { label: "top-level 0", cfg: cfgWith({ min_variant_days: 0, platforms: { x: {} } }) },
    { label: "top-level negative", cfg: cfgWith({ min_variant_days: -5, platforms: { x: {} } }) },
  ];
  for (const c of cases) {
    test(`${c.label} resolves to the named fallback, not to no window at all`, () => {
      assert.equal(resolveVariantDays("x", c.cfg), 7, "an unusable value is treated as absent");
    });
  }

  test("a non-positive per-platform value falls through to a usable top-level value", () => {
    assert.equal(resolveVariantDays("x", cfgWith({ min_variant_days: 9, platforms: { x: { min_variant_days: 0 } } })), 9);
  });

  // The window the guard actually applies, not just the number the resolver returns: a zero window
  // would make a different derivative immediately allowed, which is the defect being closed.
  test("a zero override still spaces a different derivative instead of allowing it", () => {
    const savedPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    const bets = join(mkdtempSync(join(tmpdir(), "reuse-guard-zero-")), "bets.md");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = bets;
    try {
      writeFileSync(bets, `# Placed log\n${placedLine("zero-window-slug", "x-1", "x", AN_HOUR_AGO)}`);
      const r = checkReuseForRow("zero-window-slug", "x", { rowId: "x-2", minVariantDaysOverride: 0, now: NOW });
      assert.equal(r.allowed, false, "a zero window must not make this immediately placeable");
      assert.equal(r.deferrable, true);
      assert.equal(r.minVariantDays, 7, "the unusable override is ignored and config supplies the window");
    } finally {
      if (savedPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
      else process.env.CONTENT_AGENTS_TEST_BETS_PATH = savedPath;
      rmSync(dirname(bets), { recursive: true, force: true });
    }
  });

  // Layer one of the defense in depth: loadYamlConfig throws on a schema failure (it returns its
  // fallback only for a missing file), so a non-positive value in the real YAML never loads at all.
  test("the schema rejects a non-positive min_variant_days before the resolver ever sees it", () => {
    assert.equal(platformsConfigSchema.safeParse({ min_variant_days: 0 }).success, false);
    assert.equal(platformsConfigSchema.safeParse({ min_variant_days: -1 }).success, false);
    assert.equal(platformsConfigSchema.safeParse({ platforms: { x: { min_variant_days: 0 } } }).success, false);
    assert.equal(platformsConfigSchema.safeParse({ min_variant_days: 7 }).success, true);
  });
});
