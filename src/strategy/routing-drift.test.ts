import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import type { LoadedData, RoutingConfig } from "./route.js";
import { detectDrift, formatDriftFlags, hasNoSpinControl, runDriftCheck } from "./routing-drift.js";

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

// n=5, weeks=5 clear the sample floor (min_posts_for_data=3, weeks>=4) in every fixture below.
function windowData(avgEng: number, baseline: number, platform = "x", pillar = "human-ai"): LoadedData {
  return {
    cells: new Map([[`${platform}|${pillar}`, { n: 5, avg_eng: avgEng }]]),
    weeks: new Map([[platform, 5]]),
    baselines: new Map([[platform, baseline]]),
  };
}

function emptyWindow(): LoadedData {
  return { cells: new Map(), weeks: new Map(), baselines: new Map() };
}

const noControl = () => false;

describe("detectDrift: only flags a divergence that PERSISTS across BOTH independent windows", () => {
  test("diverging in only ONE of the two windows does NOT flag", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } }); // x is a default -> underperforming-assigned is the direction to watch
    // Window 1 (recent): well below threshold. Window 2 (prior): comfortably above threshold.
    const windows = [windowData(1, 10), windowData(20, 10)]; // scores 0.1 and 2.0
    const flags = detectDrift(["human-ai"], c, windows, noControl);
    assert.deepEqual(flags, []);
  });

  test("diverging in BOTH windows independently DOES flag, with correct n / windowsChecked / no-spin fields", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const windows = [windowData(1, 10), windowData(2, 10)]; // scores 0.1 and 0.2, both < 0.4
    const flags = detectDrift(["human-ai"], c, windows, () => true);
    assert.equal(flags.length, 1);
    const [flag] = flags;
    assert.equal(flag.pillar, "human-ai");
    assert.equal(flag.platform, "x");
    assert.equal(flag.direction, "underperforming-assigned");
    assert.equal(flag.n, 10, "n is the combined sample count across both windows (5 + 5)");
    assert.equal(flag.windowsChecked, 2);
    assert.equal(flag.noSpinControlAvailable, true);
  });

  test("a platform NOT in defaults persistently scoring high in both windows flags overperforming-unassigned", () => {
    const c = cfg({ defaults: { "human-ai": ["linkedin"] } }); // x is not a default here
    const windows = [windowData(20, 10), windowData(15, 10)]; // scores 2.0 and 1.5, both >= 0.4
    const flags = detectDrift(["human-ai"], c, windows, noControl);
    assert.equal(flags.length, 1);
    assert.equal(flags[0].direction, "overperforming-unassigned");
    assert.equal(flags[0].noSpinControlAvailable, false);
  });

  test("a platform tracking its default assignment (in defaults, scoring at/above threshold) never flags", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const windows = [windowData(20, 10), windowData(15, 10)]; // scores 2.0 and 1.5 -> matches its assignment
    assert.deepEqual(detectDrift(["human-ai"], c, windows, noControl), []);
  });

  test("either window failing the sample floor (n/weeks) means no flag, even if the other window diverges", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const windows = [windowData(1, 10), emptyWindow()]; // second window has no data at all
    assert.deepEqual(detectDrift(["human-ai"], c, windows, noControl), []);
  });
});

describe("formatDriftFlags: markdown rendering", () => {
  test("no flags renders a clean all-clear, not a vacuous table", () => {
    const report = formatDriftFlags([]);
    assert.match(report, /^## Routing drift flags/);
    assert.match(report, /No persistent divergences/);
  });

  test("a flag renders pillar, platform, direction, n, windows checked, no-spin availability", () => {
    const report = formatDriftFlags([
      { pillar: "human-ai", platform: "x", direction: "underperforming-assigned", n: 10, windowsChecked: 2, noSpinControlAvailable: true },
    ]);
    assert.match(report, /\| human-ai \| x \| underperforming-assigned \| 10 \| 2 \| yes \|/);
  });
});

describe("hasNoSpinControl: reuses origin-compare.ts's source='atomized' classification", () => {
  function freshDb(): Database.Database {
    const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");
    const db = new Database(":memory:");
    db.exec(schema);
    return db;
  }

  function insertPost(db: Database.Database, platform: string, pillar: string, source: string, postedAt: string) {
    db.prepare(
      `INSERT INTO posts (platform, platform_post_id, posted_at, pillar, source) VALUES (?, ?, ?, ?, ?)`
    ).run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, pillar, source);
  }

  test("true when a verbatim ('atomized') post exists for the pillar/platform pair in range", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "atomized", "2026-06-15T00:00:00.000Z");
    const range = { startMs: new Date("2026-06-01").getTime(), endMs: new Date("2026-07-01").getTime() };
    assert.equal(hasNoSpinControl(db, "human-ai", "x", range), true);
    db.close();
  });

  test("false when only 'atomized-spin' or 'organic' posts exist (no verbatim control)", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "atomized-spin", "2026-06-15T00:00:00.000Z");
    insertPost(db, "x", "human-ai", "organic", "2026-06-16T00:00:00.000Z");
    const range = { startMs: new Date("2026-06-01").getTime(), endMs: new Date("2026-07-01").getTime() };
    assert.equal(hasNoSpinControl(db, "human-ai", "x", range), false);
    db.close();
  });

  test("false when the only verbatim post falls outside the given range", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "atomized", "2026-01-01T00:00:00.000Z");
    const range = { startMs: new Date("2026-06-01").getTime(), endMs: new Date("2026-07-01").getTime() };
    assert.equal(hasNoSpinControl(db, "human-ai", "x", range), false);
    db.close();
  });
});

describe("zero-write guarantee: --flags mode never touches config/routing.yaml or config/platforms.yaml", () => {
  test("running the full drift check against the real config leaves both files untouched", () => {
    const routingPath = join(repoRoot, "config", "routing.yaml");
    const platformsPath = join(repoRoot, "config", "platforms.yaml");
    const before = { routing: readFileSync(routingPath, "utf8"), platforms: readFileSync(platformsPath, "utf8") };
    const beforeMtime = { routing: statSync(routingPath).mtimeMs, platforms: statSync(platformsPath).mtimeMs };

    const cfgForRun = cfg({ defaults: { "human-ai": ["x", "linkedin", "bluesky"] } });
    runDriftCheck(["human-ai"], cfgForRun);

    assert.equal(readFileSync(routingPath, "utf8"), before.routing, "routing.yaml must be byte-for-byte unchanged");
    assert.equal(readFileSync(platformsPath, "utf8"), before.platforms, "platforms.yaml must be byte-for-byte unchanged");
    assert.equal(statSync(routingPath).mtimeMs, beforeMtime.routing, "routing.yaml must not have been touched (mtime unchanged)");
    assert.equal(statSync(platformsPath).mtimeMs, beforeMtime.platforms, "platforms.yaml must not have been touched (mtime unchanged)");
  });
});
