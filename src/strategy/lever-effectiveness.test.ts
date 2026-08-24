import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, type RoutingConfig } from "./route.js";
import { type StrategyConfig } from "./platform-fit.js";
import { type FollowRow as CadenceRow } from "./cadence-fit.js";
import { type Row as FrameRow } from "./frame-fit.js";
import { type Row as CtaRow } from "./cta-fit.js";
import { combineReport, buildReport, formatReport, LEVER_TRACKING_GAPS } from "./lever-effectiveness.js";

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

function strategyCfg(overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return {
    platform_pillar_priors: {},
    thresholds: { lean_in_floor: 1.3 },
    cadence_follow_thresholds: { win_ratio: 1.2 },
    frame_thresholds: { win_ratio: 1.2 },
    cta_thresholds: { win_ratio: 1.2 },
    ...overrides,
  };
}

function freshDb(): Database.Database {
  const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(schema);
  return db;
}

function insertPost(
  db: Database.Database,
  platform: string,
  fields: { source?: string | null; ctaDestination?: string | null; cadenceSource?: string | null },
  postedAt: string,
  likes: number
): void {
  const info = db
    .prepare(
      `INSERT INTO posts (platform, platform_post_id, posted_at, source, cta_destination, cadence_source) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      platform,
      `${platform}-${postedAt}-${Math.random()}`,
      postedAt,
      fields.source ?? null,
      fields.ctaDestination ?? null,
      fields.cadenceSource ?? null
    );
  db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
    info.lastInsertRowid,
    postedAt,
    likes
  );
}

const NOW = Date.parse("2026-08-18T12:00:00.000Z");
const WEEK_MS = 7 * 24 * 3600 * 1000;

function spanCadenceRows(platform: string, cadence_source: string, likes: number): CadenceRow[] {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    cadence_source,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

function spanFrameRows(platform: string, source: string, likes: number): FrameRow[] {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    source,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

function spanCtaRows(platform: string, cta_destination: string, likes: number): CtaRow[] {
  return [0, 2, 4].map((weeksAgo) => ({
    platform,
    cta_destination,
    posted_at: new Date(NOW - weeksAgo * WEEK_MS).toISOString(),
    likes,
    replies: 0,
    reposts: 0,
  }));
}

describe("LEVER_TRACKING_GAPS: fixed A/B entries, never computed", () => {
  test("exactly levers A, B are listed, in order, each with a card id and a non-empty reason", () => {
    assert.deepEqual(
      LEVER_TRACKING_GAPS.map((g) => g.lever),
      ["A", "B"]
    );
    for (const g of LEVER_TRACKING_GAPS) {
      assert.ok(g.cardId.length > 0);
      assert.ok(g.reason.length > 0);
      assert.ok(g.scriptName.startsWith("npm run "));
    }
  });
});

describe("combineReport: composes Lever C (cadence) + Lever D (frame) + Lever E (cta) + the fixed A/B tracking gaps", () => {
  test("empty rows on all sides yield empty cadence/frame/cta arrays but the full tracking-gap list", () => {
    const report = combineReport([], [], [], cfg(), strategyCfg(), NOW);
    assert.deepEqual(report.cadence, []);
    assert.deepEqual(report.frame, []);
    assert.deepEqual(report.cta, []);
    assert.equal(report.trackingGaps.length, 2);
  });

  test("a platform with sufficient cadence-follow data reads override-winning, independent of frame/cta data", () => {
    const cadenceRows = [...spanCadenceRows("x", "override", 20), ...spanCadenceRows("x", "default", 10)]; // ratio 2.0
    const report = combineReport(cadenceRows, [], [], cfg(), strategyCfg(), NOW);
    assert.equal(report.cadence.length, 1);
    assert.equal(report.cadence[0].label, "override-winning");
    assert.deepEqual(report.frame, []);
    assert.deepEqual(report.cta, []);
  });

  test("a platform with sufficient frame data reads frame-winning, independent of cadence/cta data", () => {
    const frameRows = [...spanFrameRows("x", "atomized", 20), ...spanFrameRows("x", CONTROL_RUN_SOURCE, 10)]; // ratio 2.0
    const report = combineReport([], frameRows, [], cfg(), strategyCfg(), NOW);
    assert.equal(report.frame.length, 1);
    assert.equal(report.frame[0].label, "frame-winning");
    assert.deepEqual(report.cadence, []);
    assert.deepEqual(report.cta, []);
  });

  test("a platform with sufficient cta data reads clear-winner, independent of cadence/frame data", () => {
    const ctaRows = [...spanCtaRows("linkedin", "source", 20), ...spanCtaRows("linkedin", "project", 5)]; // ratio 4.0
    const report = combineReport([], [], ctaRows, cfg(), strategyCfg(), NOW);
    assert.equal(report.cta.length, 1);
    assert.equal(report.cta[0].label, "clear-winner");
    assert.deepEqual(report.cadence, []);
    assert.deepEqual(report.frame, []);
  });

  test("all three levers can report real reads in the same call, on different platforms", () => {
    const cadenceRows = [...spanCadenceRows("bluesky", "override", 20), ...spanCadenceRows("bluesky", "default", 10)];
    const frameRows = [...spanFrameRows("x", "atomized", 20), ...spanFrameRows("x", CONTROL_RUN_SOURCE, 10)];
    const ctaRows = [...spanCtaRows("linkedin", "source", 20), ...spanCtaRows("linkedin", "project", 5)];
    const report = combineReport(cadenceRows, frameRows, ctaRows, cfg(), strategyCfg(), NOW);
    assert.equal(report.cadence[0].platform, "bluesky");
    assert.equal(report.frame[0].platform, "x");
    assert.equal(report.cta[0].platform, "linkedin");
  });
});

describe("buildReport: I/O wrapper reads from an injected DB via each lever's own loadRows", () => {
  test("cadence + frame + cta rows loaded from a shared injected DB compose into one report", () => {
    const db = freshDb();
    const d0 = new Date(NOW).toISOString();
    const d2 = new Date(NOW - 2 * WEEK_MS).toISOString();
    const d4 = new Date(NOW - 4 * WEEK_MS).toISOString();
    // Lever C data: bluesky platform, override vs default, >=4wk span, ratio 2.0 -> override-winning.
    insertPost(db, "bluesky", { cadenceSource: "override" }, d0, 20);
    insertPost(db, "bluesky", { cadenceSource: "override" }, d2, 20);
    insertPost(db, "bluesky", { cadenceSource: "override" }, d4, 20);
    insertPost(db, "bluesky", { cadenceSource: "default" }, d0, 10);
    insertPost(db, "bluesky", { cadenceSource: "default" }, d2, 10);
    insertPost(db, "bluesky", { cadenceSource: "default" }, d4, 10);
    // Lever D data: x platform, spin-on vs spin-off, >=4wk span, ratio 2.0 -> frame-winning.
    insertPost(db, "x", { source: "atomized" }, d0, 20);
    insertPost(db, "x", { source: "atomized" }, d2, 20);
    insertPost(db, "x", { source: "atomized" }, d4, 20);
    insertPost(db, "x", { source: CONTROL_RUN_SOURCE }, d0, 10);
    insertPost(db, "x", { source: CONTROL_RUN_SOURCE }, d2, 10);
    insertPost(db, "x", { source: CONTROL_RUN_SOURCE }, d4, 10);
    // Lever E data: linkedin platform, two CTA destinations, >=4wk span, ratio 4.0 -> clear-winner.
    insertPost(db, "linkedin", { ctaDestination: "source" }, d0, 20);
    insertPost(db, "linkedin", { ctaDestination: "source" }, d2, 20);
    insertPost(db, "linkedin", { ctaDestination: "source" }, d4, 20);
    insertPost(db, "linkedin", { ctaDestination: "project" }, d0, 5);
    insertPost(db, "linkedin", { ctaDestination: "project" }, d2, 5);
    insertPost(db, "linkedin", { ctaDestination: "project" }, d4, 5);

    const report = buildReport(db, NOW);
    assert.equal(report.cadence.some((r) => r.platform === "bluesky" && r.label === "override-winning"), true);
    assert.equal(report.frame.some((r) => r.platform === "x" && r.label === "frame-winning"), true);
    assert.equal(report.cta.some((r) => r.platform === "linkedin" && r.label === "clear-winner"), true);
    assert.equal(report.trackingGaps.length, 2);
    db.close();
  });

  test("organic/exploration-only, cadence-untagged rows produce no cadence/frame/cta reads, only the tracking-gap section", () => {
    const db = freshDb();
    const d0 = new Date(NOW).toISOString();
    insertPost(db, "x", { source: "organic" }, d0, 999);
    insertPost(db, "x", { source: EXPLORATION_SOURCE }, d0, 999);
    const report = buildReport(db, NOW);
    assert.deepEqual(report.cadence, []);
    assert.deepEqual(report.frame, []);
    assert.deepEqual(report.cta, []);
    assert.equal(report.trackingGaps.length, 2);
    db.close();
  });
});

describe("formatReport: pure string formatting, no I/O", () => {
  test("names both tracking-gap levers by letter and includes each script name", () => {
    const report = combineReport([], [], [], cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.match(text, /Insufficient tracking \(Levers A\/B\)/);
    assert.match(text, /\| A \|/);
    assert.match(text, /\| B \|/);
    assert.doesNotMatch(text, /\| C \|/);
    assert.match(text, /npm run platform-fit/);
    assert.match(text, /npm run media-fit/);
  });

  test("an override-winning read renders its ratio and n's in the Lever C table", () => {
    const cadenceRows = [...spanCadenceRows("bluesky", "override", 20), ...spanCadenceRows("bluesky", "default", 10)];
    const report = combineReport(cadenceRows, [], [], cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.match(text, /Lever C, cadence-override follow-through/);
    assert.match(text, /\| bluesky \| override winning, keep it \| 2\.00x \| 3 \| 3 \|/);
  });

  test("a frame-winning read renders its ratio and n's in the Lever D table", () => {
    const frameRows = [...spanFrameRows("x", "atomized", 20), ...spanFrameRows("x", CONTROL_RUN_SOURCE, 10)];
    const report = combineReport([], frameRows, [], cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.match(text, /Lever D, spin-frame fit/);
    assert.match(text, /\| x \| spin frame winning, keep it \| 2\.00x \| 3 \| 3 \|/);
  });

  test("a clear-winner cta read renders its destination and ratio in the Lever E table", () => {
    const ctaRows = [...spanCtaRows("linkedin", "source", 20), ...spanCtaRows("linkedin", "project", 5)];
    const report = combineReport([], [], ctaRows, cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.match(text, /Lever E, CTA-destination fit/);
    assert.match(text, /\| linkedin \| source clearly wins \| 4\.00x \|/);
  });

  test("no cadence, frame, or cta rows at all falls back to the explicit no-data guidance line, not a blank table", () => {
    const report = combineReport([], [], [], cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.match(text, /No platform has any cadence_source-tagged posts yet/);
    assert.match(text, /No platform has both a spin-on and a spin-off/);
    assert.match(text, /No platform has any CTA-tagged posts yet/);
  });

  test("never claims a lever-A/B lift number anywhere in the output", () => {
    const report = combineReport([], [], [], cfg(), strategyCfg(), NOW);
    const text = formatReport(report, cfg());
    assert.doesNotMatch(text, /Lever A show \d/);
    assert.doesNotMatch(text, /Lever B show \d/);
  });
});
