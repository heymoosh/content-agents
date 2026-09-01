import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { loadConfig, loadData, type RoutingConfig } from "./route.js";
import {
  appendControlLedger,
  assignedPairs,
  formatControlCoverage,
  loadControlData,
  nextControlRun,
  readControlLedger,
  type ControlRunLedgerEntry,
} from "./spin-control.js";

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

const PILLARS_FIXTURE = ["human-ai", "claude-code", "civic-tech", "career-work", "builder", "other"];

describe("assignedPairs: derived live from config/routing.yaml's defaults, never hardcoded", () => {
  test("flattens every pillar/platform pair listed in defaults, in pillar then platform order", () => {
    const c = cfg({
      defaults: {
        "human-ai": ["x", "linkedin"],
        "claude-code": ["x"],
        "civic-tech": [],
      },
    });
    assert.deepEqual(assignedPairs(c, ["human-ai", "claude-code", "civic-tech"]), [
      { pillar: "human-ai", platform: "x" },
      { pillar: "human-ai", platform: "linkedin" },
      { pillar: "claude-code", platform: "x" },
    ]);
  });

  test("a pillar with no defaults entry contributes no pairs", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    assert.deepEqual(assignedPairs(c, ["human-ai", "other"]), [{ pillar: "human-ai", platform: "x" }]);
  });

  test("against the LIVE config/routing.yaml: 26 assigned pairs across 6 pillars, including community targets", () => {
    const live = loadConfig();
    const pairs = assignedPairs(live, PILLARS_FIXTURE);
    assert.equal(pairs.length, 26);
    assert.ok(pairs.some((p) => p.pillar === "human-ai" && p.platform === "x"));
    assert.ok(pairs.some((p) => p.pillar === "civic-tech" && p.platform === "community:democratic-resilience"));
    assert.ok(pairs.some((p) => p.pillar === "other" && p.platform === "x"));
  });
});

describe("nextControlRun: longest-since-last-control selection, gated to ONE pick per calendar month OVERALL", () => {
  const c = cfg({
    defaults: {
      "human-ai": ["x"],
      "claude-code": ["linkedin"],
    },
  }); // two assigned pairs: human-ai/x, claude-code/linkedin

  test("a fresh/empty ledger picks the first assigned pair (never-run ties broken by pair order)", () => {
    const pick = nextControlRun(c, [], new Date("2026-07-07T00:00:00.000Z"), ["human-ai", "claude-code"]);
    assert.ok(pick);
    assert.equal(pick!.pillar, "human-ai");
    assert.equal(pick!.platform, "x");
  });

  test("never-run outranks a pair controlled long ago (never-run = longest possible wait)", () => {
    const entries: ControlRunLedgerEntry[] = [
      { pillar: "human-ai", platform: "x", ranAt: "2025-01-01T00:00:00.000Z" }, // ancient, but a real prior run
    ];
    const pick = nextControlRun(c, entries, new Date("2026-07-07T00:00:00.000Z"), ["human-ai", "claude-code"]);
    assert.equal(pick!.pillar, "claude-code", "still-never-run pair wins over a run-but-ancient one");
    assert.equal(pick!.platform, "linkedin");
  });

  test("picks the OLDEST-run pair among pairs that have all run at least once", () => {
    const entries: ControlRunLedgerEntry[] = [
      { pillar: "human-ai", platform: "x", ranAt: "2026-05-01T00:00:00.000Z" },
      { pillar: "claude-code", platform: "linkedin", ranAt: "2026-01-01T00:00:00.000Z" },
    ];
    const pick = nextControlRun(c, entries, new Date("2026-07-07T00:00:00.000Z"), ["human-ai", "claude-code"]);
    assert.equal(pick!.pillar, "claude-code", "claude-code's Jan run is older than human-ai's May run");
  });

  test("returns null once ANY pair has already run a control this calendar month (gate is OVERALL, not per-pair)", () => {
    const entries: ControlRunLedgerEntry[] = [
      { pillar: "human-ai", platform: "x", ranAt: "2026-07-02T00:00:00.000Z" },
    ];
    // claude-code/linkedin has never run, but the monthly slot is already used by human-ai/x this month.
    const pick = nextControlRun(c, entries, new Date("2026-07-07T00:00:00.000Z"), ["human-ai", "claude-code"]);
    assert.equal(pick, null);
  });

  test("a new calendar month re-opens the slot, and the still-never-run pair wins", () => {
    const entries: ControlRunLedgerEntry[] = [
      { pillar: "human-ai", platform: "x", ranAt: "2026-06-02T00:00:00.000Z" }, // last month
    ];
    const pick = nextControlRun(c, entries, new Date("2026-07-07T00:00:00.000Z"), ["human-ai", "claude-code"]);
    assert.ok(pick);
    assert.equal(pick!.pillar, "claude-code", "never-run pair still outranks last month's human-ai run");
  });

  test("no assigned pairs at all returns null", () => {
    const empty = cfg({ defaults: {} });
    assert.equal(nextControlRun(empty, [], new Date("2026-07-07T00:00:00.000Z"), ["human-ai"]), null);
  });
});

describe("spin-control ledger: JSONL read + append, same convention as data/notes-spread-ledger.jsonl", () => {
  const TEST_LEDGER = join(repoRoot, "data", ".spin-control-ledger-test.jsonl");

  before(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  after(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  test("readControlLedger on a missing file returns an empty array, no throw", () => {
    assert.deepEqual(readControlLedger(join(repoRoot, "data", ".spin-control-ledger-nonexistent.jsonl")), []);
  });

  test("malformed JSON lines in the ledger are skipped gracefully", () => {
    const malformedPath = join(repoRoot, "data", ".spin-control-ledger-malformed.jsonl");
    const valid: ControlRunLedgerEntry = { pillar: "human-ai", platform: "x", ranAt: "2026-07-07T00:00:00.000Z" };
    writeFileSync(malformedPath, JSON.stringify(valid) + "\nNOT_VALID_JSON\n");
    try {
      const entries = readControlLedger(malformedPath);
      assert.equal(entries.length, 1, "the malformed line should be silently skipped");
      assert.deepEqual(entries[0], valid);
    } finally {
      if (existsSync(malformedPath)) unlinkSync(malformedPath);
    }
  });

  test("appendControlLedger writes a line that readControlLedger picks back up", () => {
    const entry: ControlRunLedgerEntry = { pillar: "human-ai", platform: "x", ranAt: "2026-07-07T00:00:00.000Z" };
    appendControlLedger(entry, TEST_LEDGER);
    const entries = readControlLedger(TEST_LEDGER);
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], entry);
  });

  test("append is cumulative (append-only), a second entry doesn't overwrite the first", () => {
    const second: ControlRunLedgerEntry = { pillar: "claude-code", platform: "linkedin", ranAt: "2026-07-07T01:00:00.000Z" };
    appendControlLedger(second, TEST_LEDGER);
    const entries = readControlLedger(TEST_LEDGER);
    assert.equal(entries.length, 2);
    assert.equal(entries[1].pillar, "claude-code");
  });
});

describe("loadControlData: reads ONLY source='spin-control-run' rows, into their own bucket", () => {
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
      .prepare(`INSERT INTO posts (platform, platform_post_id, posted_at, pillar, source, brand_id, provider_account_id) VALUES (?, ?, ?, ?, ?, 'human-inference', 'test/account')`)
      .run(platform, `${platform}-${postedAt}-${Math.random()}`, postedAt, pillar, source);
    db.prepare(`INSERT INTO metrics (post_id, captured_at, likes, replies, reposts, brand_id, provider_account_id) VALUES (?, ?, ?, 0, 0, 'human-inference', 'test/account')`).run(
      info.lastInsertRowid,
      postedAt,
      likes
    );
  }

  test("loadControlData excludes non-control rows and reports only the control bucket", () => {
    const db = freshDb();
    insertPost(db, "x", "human-ai", "organic", "2026-06-01T00:00:00.000Z", 999); // must be excluded
    insertPost(db, "x", "human-ai", "spin-control-run", "2026-06-10T00:00:00.000Z", 4);
    insertPost(db, "x", "human-ai", "spin-control-run", "2026-06-20T00:00:00.000Z", 6);

    const cells = loadControlData(db, undefined, { brandId: "human-inference" });
    const cell = cells.get("x|human-ai")!;
    assert.equal(cell.n, 2, "only the two control-run posts count");
    assert.equal(cell.avg_eng, 5, "avg of the two control posts (4, 6) -> 5, the organic 999 must not leak in");
    db.close();
  });
});

describe("formatControlCoverage: n>=3 gate before /strategy surfaces anything", () => {
  const c = cfg({ defaults: { "human-ai": ["x"] } });

  test("a bucket below n=3 is not surfaced at all", () => {
    const cells = new Map([["x|human-ai", { n: 2, avg_eng: 10 }]]);
    const report = formatControlCoverage(cells, c, ["human-ai"]);
    assert.match(report, /No assigned pair has reached n>=3/);
    assert.doesNotMatch(report, /\| x \| human-ai \|/);
  });

  test("a bucket at n=3 is surfaced with its n and avg engagement", () => {
    const cells = new Map([["x|human-ai", { n: 3, avg_eng: 7.5 }]]);
    const report = formatControlCoverage(cells, c, ["human-ai"]);
    assert.match(report, /\| x \| human-ai \| 3 \| 7\.5 \|/);
  });
});
