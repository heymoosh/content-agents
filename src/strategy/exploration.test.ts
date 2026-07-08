import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { loadConfig, loadData, type RoutingConfig } from "./route.js";
import {
  EXPLORATION_PLATFORMS,
  appendExplorationLedger,
  formatExplorationCoverage,
  loadExplorationData,
  nextExplorationProbe,
  readExplorationLedger,
  untestedPillars,
  type ExplorationLedgerEntry,
} from "./exploration.js";

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

const PILLARS_FIXTURE = ["human-ai", "claude-code", "civic-tech", "career-work", "builder", "other"];

describe("untestedPillars: derived live from config/routing.yaml's defaults, never hardcoded", () => {
  test("a platform's untested set is every pillar whose defaults list omits it", () => {
    const c = cfg({
      defaults: {
        "human-ai": ["linkedin"],
        "claude-code": ["linkedin"],
        "civic-tech": ["bluesky"],
        "career-work": ["x"],
        builder: [],
        other: [],
      },
    });
    assert.deepEqual(untestedPillars("linkedin", c, PILLARS_FIXTURE), ["civic-tech", "career-work", "builder", "other"]);
    assert.deepEqual(untestedPillars("bluesky", c, PILLARS_FIXTURE), ["human-ai", "claude-code", "career-work", "builder", "other"]);
  });

  test("a platform every pillar already defaults to has an empty untested set", () => {
    const c = cfg({ defaults: Object.fromEntries(PILLARS_FIXTURE.map((p) => [p, ["x"]])) });
    assert.deepEqual(untestedPillars("x", c, PILLARS_FIXTURE), []);
  });

  test("recomputes automatically when a pillar has no defaults entry at all (treated as untested everywhere)", () => {
    const c = cfg({ defaults: {} });
    assert.deepEqual(untestedPillars("linkedin", c, PILLARS_FIXTURE), PILLARS_FIXTURE);
  });

  test("against the LIVE config/routing.yaml: LinkedIn misses civic-tech + other, Bluesky misses career-work + builder + other (today's editorial defaults)", () => {
    const live = loadConfig();
    assert.deepEqual(untestedPillars("linkedin", live, PILLARS_FIXTURE), ["civic-tech", "other"]);
    assert.deepEqual(untestedPillars("bluesky", live, PILLARS_FIXTURE), ["career-work", "builder", "other"]);
    // X gets all 6 pillars by default today — no gap to explore, which is why it's excluded below.
    assert.deepEqual(untestedPillars("x", live, PILLARS_FIXTURE), []);
    assert.deepEqual(EXPLORATION_PLATFORMS, ["linkedin", "bluesky"]);
  });
});

describe("nextExplorationProbe: longest-since-last-probe selection, gated to once per calendar month per platform", () => {
  const c = cfg({ defaults: { "human-ai": ["linkedin"], "claude-code": ["linkedin"] } }); // civic-tech/career-work/builder/other untested on linkedin

  test("a fresh/empty ledger picks the first untested pillar (never-probed ties broken by pillar order)", () => {
    const pick = nextExplorationProbe("linkedin", c, [], new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.ok(pick);
    assert.equal(pick!.platform, "linkedin");
    assert.equal(pick!.pillar, "civic-tech");
    assert.deepEqual(pick!.untested, ["civic-tech", "career-work", "builder", "other"]);
  });

  test("never-probed outranks a pillar probed long ago (never-probed = longest possible wait)", () => {
    const entries: ExplorationLedgerEntry[] = [
      { platform: "linkedin", pillar: "civic-tech", probedAt: "2025-01-01T00:00:00.000Z" }, // ancient, but a real prior probe
    ];
    const pick = nextExplorationProbe("linkedin", c, entries, new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.equal(pick!.pillar, "career-work", "still-never-probed pillar wins over a probed-but-ancient one");
  });

  test("picks the OLDEST-probed pillar among ones that have all been probed at least once", () => {
    const entries: ExplorationLedgerEntry[] = [
      { platform: "linkedin", pillar: "civic-tech", probedAt: "2026-03-01T00:00:00.000Z" },
      { platform: "linkedin", pillar: "career-work", probedAt: "2026-05-01T00:00:00.000Z" },
      { platform: "linkedin", pillar: "builder", probedAt: "2026-01-01T00:00:00.000Z" },
      { platform: "linkedin", pillar: "other", probedAt: "2026-06-01T00:00:00.000Z" },
    ];
    const pick = nextExplorationProbe("linkedin", c, entries, new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.equal(pick!.pillar, "builder", "builder's Jan probe is the oldest of the four");
  });

  test("returns null once the platform already used its slot for the current calendar month", () => {
    const entries: ExplorationLedgerEntry[] = [
      { platform: "linkedin", pillar: "civic-tech", probedAt: "2026-07-02T00:00:00.000Z" },
    ];
    const pick = nextExplorationProbe("linkedin", c, entries, new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.equal(pick, null);
  });

  test("a new calendar month re-opens the slot, and the never-probed pillar still wins", () => {
    const entries: ExplorationLedgerEntry[] = [
      { platform: "linkedin", pillar: "civic-tech", probedAt: "2026-06-02T00:00:00.000Z" }, // last month
    ];
    const pick = nextExplorationProbe("linkedin", c, entries, new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.ok(pick);
    assert.equal(pick!.pillar, "career-work", "never-probed pillar still outranks last month's civic-tech probe");
  });

  test("a platform with no untested pillars (all covered by defaults) returns null", () => {
    const allCovered = cfg({ defaults: Object.fromEntries(PILLARS_FIXTURE.map((p) => [p, ["x"]])) });
    assert.equal(nextExplorationProbe("x", allCovered, [], new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE), null);
  });

  test("entries for a DIFFERENT platform never affect this platform's monthly gate or ranking", () => {
    const entries: ExplorationLedgerEntry[] = [
      { platform: "bluesky", pillar: "civic-tech", probedAt: "2026-07-05T00:00:00.000Z" }, // this month, but bluesky
    ];
    const pick = nextExplorationProbe("linkedin", c, entries, new Date("2026-07-07T00:00:00.000Z"), PILLARS_FIXTURE);
    assert.ok(pick, "linkedin's slot is untouched by bluesky's probe");
    assert.equal(pick!.pillar, "civic-tech");
  });
});

describe("exploration ledger: JSONL read + append, same convention as data/notes-spread-ledger.jsonl", () => {
  const TEST_LEDGER = join(repoRoot, "data", ".exploration-ledger-test.jsonl");

  after(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  test("readExplorationLedger on a missing file returns an empty array, no throw", () => {
    assert.deepEqual(readExplorationLedger(join(repoRoot, "data", ".exploration-ledger-nonexistent.jsonl")), []);
  });

  test("appendExplorationLedger writes a line that readExplorationLedger picks back up", () => {
    const entry: ExplorationLedgerEntry = { platform: "linkedin", pillar: "civic-tech", probedAt: "2026-07-07T00:00:00.000Z" };
    appendExplorationLedger(entry, TEST_LEDGER);
    const entries = readExplorationLedger(TEST_LEDGER);
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], entry);
  });

  test("append is cumulative (append-only), a second entry doesn't overwrite the first", () => {
    const second: ExplorationLedgerEntry = { platform: "bluesky", pillar: "career-work", probedAt: "2026-07-07T01:00:00.000Z" };
    appendExplorationLedger(second, TEST_LEDGER);
    const entries = readExplorationLedger(TEST_LEDGER);
    assert.equal(entries.length, 2);
    assert.equal(entries[1].platform, "bluesky");
  });
});

describe("data separation: exploration-probe rows never feed route.ts's main resonance figures, but DO feed their own bucket", () => {
  function freshDb(): Database.Database {
    const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");
    const db = new Database(":memory:");
    db.exec(schema);
    return db;
  }

  function insertPost(
    db: Database.Database,
    platform: string,
    pillar: string,
    source: string | null,
    postedAt: string,
    likes: number
  ): void {
    const info = db
      .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, pillar, source) VALUES (?, ?, ?, ?, ?)`)
      .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, pillar, source);
    db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts) VALUES (?, ?, ?, 0, 0)`).run(
      info.lastInsertRowid,
      postedAt,
      likes
    );
  }

  test("route.ts's loadData excludes source='exploration-probe' rows from the pillar/platform cells", () => {
    const db = freshDb();
    // Two normal linkedin/civic-tech posts (organic) + one exploration-probe post with a very
    // different (much higher) engagement — if it leaked in, the cell's avg would move a lot.
    insertPost(db, "linkedin", "civic-tech", "organic", "2026-06-01T00:00:00.000Z", 10);
    insertPost(db, "linkedin", "civic-tech", "organic", "2026-06-08T00:00:00.000Z", 12);
    insertPost(db, "linkedin", "civic-tech", "exploration-probe", "2026-06-15T00:00:00.000Z", 1000);

    const data = loadData(undefined, db);
    const cell = data.cells.get("linkedin|civic-tech")!;
    assert.equal(cell.n, 2, "the exploration-probe row must not be counted in n");
    assert.equal(cell.avg_eng, 11, "avg must be computed from only the two organic posts (10, 12) -> 11");
    db.close();
  });

  test("loadExplorationData reads ONLY source='exploration-probe' rows, into their own bucket", () => {
    const db = freshDb();
    insertPost(db, "linkedin", "civic-tech", "organic", "2026-06-01T00:00:00.000Z", 999); // must be excluded here
    insertPost(db, "linkedin", "civic-tech", "exploration-probe", "2026-06-10T00:00:00.000Z", 4);
    insertPost(db, "linkedin", "civic-tech", "exploration-probe", "2026-06-20T00:00:00.000Z", 6);

    const cells = loadExplorationData(db);
    const cell = cells.get("linkedin|civic-tech")!;
    assert.equal(cell.n, 2, "only the two exploration-probe posts count");
    assert.equal(cell.avg_eng, 5, "avg of the two exploration posts (4, 6) -> 5, the organic 999 must not leak in");
    db.close();
  });

  test("a post with NULL source is treated as a normal (non-exploration) post by loadData", () => {
    const db = freshDb();
    insertPost(db, "bluesky", "human-ai", null, "2026-06-01T00:00:00.000Z", 5);
    const data = loadData(undefined, db);
    assert.equal(data.cells.get("bluesky|human-ai")!.n, 1);
    db.close();
  });
});

describe("formatExplorationCoverage: n>=3 gate before /strategy surfaces anything", () => {
  const c = cfg({ defaults: { "human-ai": ["linkedin"] } }); // civic-tech untested on linkedin (among others)

  test("a bucket below n=3 is not surfaced at all", () => {
    const cells = new Map([["linkedin|civic-tech", { n: 2, avg_eng: 10 }]]);
    const report = formatExplorationCoverage(cells, c);
    assert.match(report, /No untested pillar has reached n>=3/);
    assert.doesNotMatch(report, /civic-tech/);
  });

  test("a bucket at n=3 is surfaced with its n and avg engagement", () => {
    const cells = new Map([["linkedin|civic-tech", { n: 3, avg_eng: 7.5 }]]);
    const report = formatExplorationCoverage(cells, c);
    assert.match(report, /\| linkedin \| civic-tech \| 3 \| 7\.5 \|/);
  });

  test("only untested pillar/platform cells are ever considered, even if data exists for an assigned pair", () => {
    // human-ai IS a linkedin default, so even n>=3 there must never appear in this report.
    const cells = new Map([
      ["linkedin|human-ai", { n: 10, avg_eng: 50 }],
      ["linkedin|civic-tech", { n: 3, avg_eng: 7.5 }],
    ]);
    const report = formatExplorationCoverage(cells, c);
    assert.doesNotMatch(report, /human-ai/);
    assert.match(report, /civic-tech/);
  });
});
