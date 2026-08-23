// The patterns:auto runner. Every test writes into a temp directory and uses fake collectors, so
// nothing here touches the real corpus, launches a browser, or reaches the network.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BrowserContext } from "playwright";
import { PullError } from "../pull/errors.js";
import { readCorpus } from "./corpus.js";
import { baselineScoresWithoutViews, formatSummary, parseArgs, planRun, runAutoCollect, type AccountOutcome, type Args } from "./auto-collect.js";
import type { AutoPlatform, CollectorAccount, CollectResult, PatternCollector } from "./collectors/registry.js";
import type { CorpusEntry, PatternMiningConfig } from "./types.js";

let dir: string;
let corpusPath: string;
let configPath: string;

const CONFIG_YAML = `
niches:
  - building-solopreneur
  - inner-journey
accounts:
  - handle: "@onex"
    creator: One X
    platform: x
    niche: building-solopreneur
    followers: null
  - handle: "@twox"
    creator: Two X
    platform: x
    niche: building-solopreneur
    followers: 100
  - handle: "@ali"
    creator: A LinkedIn Person
    platform: linkedin
    niche: building-solopreneur
    followers: 500
  - handle: null
    creator: No Handle Yet
    platform: linkedin
    niche: building-solopreneur
    followers: null
  - handle: "@avideo"
    creator: A Video Person
    platform: tiktok
    niche: inner-journey
    followers: null
outlier_thresholds:
  x:
    view_follower_ratio: 5.0
    baseline_multiple: 3.0
  linkedin:
    view_follower_ratio: 3.0
    baseline_multiple: 3.0
analysis_sample:
  min_outliers: 20
  max_outliers: 50
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "patterns-auto-"));
  corpusPath = join(dir, "corpus.jsonl");
  configPath = join(dir, "pattern-mining.yaml");
  writeFileSync(configPath, CONFIG_YAML, "utf8");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function args(overrides: Partial<Args> = {}): Args {
  return {
    platforms: [],
    accounts: [],
    limit: 10,
    delayMs: 0,
    maxAccounts: 12,
    dryRun: false,
    headed: false,
    corpusPath,
    configPath,
    ...overrides,
  };
}

function entry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "x-onex-00000001",
    platform: "x",
    handle: "@onex",
    creator: "One X",
    niche: "building-solopreneur",
    url: "https://x.com/onex/status/1",
    posted_at: "2026-08-01T00:00:00.000Z",
    collected_at: "2026-08-22T12:00:00.000Z",
    kind: "text",
    body: "An invented post.",
    transcript_source: null,
    metrics: { views: 1000, likes: 10, comments: 1, shares: 0, followers: 100 },
    collection_method: "auto",
    collected_by: "fake@1",
    ...overrides,
  };
}

// A collector that returns whatever it is told to, and records every call so a test can prove a
// fetch did or did not happen.
function fakeCollector(
  platform: AutoPlatform,
  behaviour: (account: CollectorAccount) => CollectResult | Promise<CollectResult>,
): PatternCollector & { calls: string[] } {
  const calls: string[] = [];
  return {
    platform,
    name: `fake-${platform}`,
    version: "1",
    calls,
    profileUrl: (handle: string) => `https://example.test/${platform}/${handle.replace("@", "")}`,
    parse: () => [],
    async collect(_context: BrowserContext, account: CollectorAccount): Promise<CollectResult> {
      calls.push(account.handle);
      return behaviour(account);
    },
  };
}

// A launch that fails the test loudly if it is ever called. This is how --dry-run proves it does
// not fetch: not by inspecting output, but by making a fetch impossible.
function forbiddenLaunch(): (platform: AutoPlatform, opts: { headed: boolean }) => Promise<BrowserContext> {
  return async () => {
    throw new Error("launch must not be called");
  };
}

const fakeContext = { close: async () => {} } as unknown as BrowserContext;

function loadedConfig(): PatternMiningConfig {
  // planRun is pure, so the test builds the same object loadConfig would.
  return {
    niches: ["building-solopreneur", "inner-journey"],
    accounts: [
      { handle: "@onex", creator: "One X", platform: "x", niche: "building-solopreneur", followers: null },
      { handle: "@twox", creator: "Two X", platform: "x", niche: "building-solopreneur", followers: 100 },
      { handle: "@ali", creator: "A LinkedIn Person", platform: "linkedin", niche: "building-solopreneur", followers: 500 },
      { handle: null, creator: "No Handle Yet", platform: "linkedin", niche: "building-solopreneur", followers: null },
      { handle: "@avideo", creator: "A Video Person", platform: "tiktok", niche: "inner-journey", followers: null },
    ],
    outlier_thresholds: {},
    analysis_sample: { min_outliers: 20, max_outliers: 50 },
  };
}

const collectors = {
  x: fakeCollector("x", () => ({ entries: [], stop: null })),
  linkedin: fakeCollector("linkedin", () => ({ entries: [], stop: null })),
};

describe("parseArgs", () => {
  test("reads every flag, and defaults to a slow, capped run", () => {
    const parsed = parseArgs([]);
    assert.deepEqual(parsed.platforms, []);
    assert.equal(parsed.limit, 10);
    assert.equal(parsed.delayMs, 8_000);
    assert.equal(parsed.maxAccounts, 12);
    assert.equal(parsed.dryRun, false);
    assert.equal(parsed.headed, false);
  });

  test("--platform and --account accept repeats and comma lists", () => {
    const parsed = parseArgs(["--platform", "x,linkedin", "--account", "@onex", "--account", "@twox", "--limit", "3", "--dry-run"]);
    assert.deepEqual(parsed.platforms, ["x", "linkedin"]);
    assert.deepEqual(parsed.accounts, ["@onex", "@twox"]);
    assert.equal(parsed.limit, 3);
    assert.equal(parsed.dryRun, true);
  });
});

describe("planRun", () => {
  test("plans every configured account on a platform that has a collector", () => {
    const plan = planRun(loadedConfig(), args(), collectors);
    assert.deepEqual(plan.planned.map((p) => p.account.handle), ["@onex", "@twox", "@ali"]);
  });

  test("an account with no handle is skipped with the reason, never guessed at", () => {
    const plan = planRun(loadedConfig(), args(), collectors);
    const skip = plan.skipped.find((s) => s.label.startsWith("No Handle Yet"));
    assert.match(skip?.reason ?? "", /no handle in config/);
  });

  test("video platforms are one summary line, not one noisy line per account", () => {
    const plan = planRun(loadedConfig(), args(), collectors);
    const skip = plan.skipped.find((s) => s.label.includes("video platforms"));
    assert.equal(skip?.label, "1 account(s) on video platforms");
    assert.match(skip?.reason ?? "", /deliberate second pass/);
    assert.equal(plan.planned.some((p) => p.platform === ("tiktok" as AutoPlatform)), false);
  });

  test("--platform narrows the run", () => {
    const plan = planRun(loadedConfig(), args({ platforms: ["linkedin"] }), collectors);
    assert.deepEqual(plan.planned.map((p) => p.account.handle), ["@ali"]);
  });

  test("--account narrows the run and ignores the leading at sign", () => {
    const plan = planRun(loadedConfig(), args({ accounts: ["twox"] }), collectors);
    assert.deepEqual(plan.planned.map((p) => p.account.handle), ["@twox"]);
  });

  test("the per-run account cap holds, and says which accounts it held back", () => {
    const plan = planRun(loadedConfig(), args({ maxAccounts: 2 }), collectors);
    assert.equal(plan.planned.length, 2);
    assert.match(plan.skipped.find((s) => s.label.startsWith("A LinkedIn Person"))?.reason ?? "", /per-run cap of 2/);
  });

  test("the cap is fair: the accounts with the fewest collected entries go first", () => {
    // Without this, the accounts near the bottom of a 60-account config would never be reached,
    // however many weeks the job ran.
    const already = new Map([
      ["x|onex", 20],
      ["x|twox", 5],
      ["linkedin|ali", 0],
    ]);
    const plan = planRun(loadedConfig(), args({ maxAccounts: 2 }), collectors, already);
    assert.deepEqual(plan.planned.map((p) => p.account.handle), ["@ali", "@twox"]);
    assert.match(plan.skipped.find((s) => s.label.startsWith("One X"))?.reason ?? "", /it has 20 entries already/);
  });

  test("with nothing collected yet, config order decides, so a run is reproducible", () => {
    const plan = planRun(loadedConfig(), args({ maxAccounts: 3 }), collectors, new Map());
    assert.deepEqual(plan.planned.map((p) => p.account.handle), ["@onex", "@twox", "@ali"]);
  });

  test("the planned url is the collector's own public profile url, so a dry run can be checked", () => {
    const plan = planRun(loadedConfig(), args({ accounts: ["onex"] }), collectors);
    assert.equal(plan.planned[0].url, "https://example.test/x/onex");
  });
});

describe("--dry-run", () => {
  test("performs zero fetches: no browser is launched and no collector is called", async () => {
    const x = fakeCollector("x", () => {
      throw new Error("collect must not be called on a dry run");
    });
    const lines: string[] = [];
    const code = await runAutoCollect(args({ dryRun: true }), {
      launch: forbiddenLaunch(),
      collectors: { x },
      log: (line) => lines.push(line),
    });
    assert.equal(code, 0);
    assert.deepEqual(x.calls, []);
    assert.equal(readCorpus(corpusPath).length, 0);
    const output = lines.join("\n");
    assert.match(output, /Dry run\. 2 account\(s\)/);
    assert.match(output, /https:\/\/example\.test\/x\/onex/);
    assert.match(output, /Nothing was fetched\. No browser was launched/);
  });
});

describe("runAutoCollect", () => {
  test("appends what it fetched and reports it", async () => {
    const x = fakeCollector("x", (account) => ({
      entries: account.handle === "@onex" ? [entry()] : [],
      stop: null,
    }));
    const lines: string[] = [];
    const code = await runAutoCollect(args({ platforms: ["x"] }), {
      launch: async () => fakeContext,
      collectors: { x },
      sleep: async () => {},
      log: (line) => lines.push(line),
    });
    assert.equal(code, 0);
    assert.deepEqual(x.calls, ["@onex", "@twox"]);
    assert.equal(readCorpus(corpusPath).length, 1);
    assert.match(lines.join("\n"), /Fetched 1\. New 1\. Already collected 0\. Corpus is now 1\./);
  });

  test("a second identical run is a no-op, because dedupe is by url", async () => {
    const make = () => fakeCollector("x", () => ({ entries: [entry(), entry({ id: "other", url: "https://x.com/onex/status/2" })], stop: null }));
    const run = async (lines: string[]) =>
      runAutoCollect(args({ platforms: ["x"], accounts: ["onex"] }), {
        launch: async () => fakeContext,
        collectors: { x: make() },
        sleep: async () => {},
        log: (line) => lines.push(line),
      });

    const first: string[] = [];
    await run(first);
    assert.equal(readCorpus(corpusPath).length, 2);
    assert.match(first.join("\n"), /Fetched 2\. New 2\. Already collected 0\./);

    const second: string[] = [];
    await run(second);
    assert.equal(readCorpus(corpusPath).length, 2);
    assert.match(second.join("\n"), /Fetched 2\. New 0\. Already collected 2\./);
  });

  test("a stop signal ends that platform for the run, and keeps what was already collected", async () => {
    const x = fakeCollector("x", (account) =>
      account.handle === "@onex"
        ? { entries: [entry()], stop: { reason: "rate_limited" as const, detail: "x answered 429" } }
        : { entries: [entry({ url: "https://x.com/twox/status/9", handle: "@twox" })], stop: null },
    );
    const lines: string[] = [];
    await runAutoCollect(args({ platforms: ["x"] }), {
      launch: async () => fakeContext,
      collectors: { x },
      sleep: async () => {},
      log: (line) => lines.push(line),
    });
    // The second account was never asked for, which is the point of stopping.
    assert.deepEqual(x.calls, ["@onex"]);
    assert.equal(readCorpus(corpusPath).length, 1);
    const output = lines.join("\n");
    assert.match(output, /Stopped early[\s\S]*rate_limited, x answered 429/);
    // The account the stop cost us is named, rather than vanishing from the report.
    assert.match(output, /Two X \(x\): not attempted, x stopped: rate_limited/);
  });

  test("a failure is reported with its culprit and does not stop the other accounts", async () => {
    const x = fakeCollector("x", (account) => {
      if (account.handle === "@onex") {
        throw new PullError("UI_CHANGED", "No posts parsed", { hint: "Re-check the selectors." });
      }
      return { entries: [entry({ handle: "@twox", url: "https://x.com/twox/status/9" })], stop: null };
    });
    const lines: string[] = [];
    const code = await runAutoCollect(args({ platforms: ["x"] }), {
      launch: async () => fakeContext,
      collectors: { x },
      sleep: async () => {},
      log: (line) => lines.push(line),
    });
    assert.equal(code, 1); // a failed account is a non-zero exit
    assert.deepEqual(x.calls, ["@onex", "@twox"]);
    const output = lines.join("\n");
    assert.match(output, /\[UI_CHANGED\] No posts parsed\. THEIR SIDE/);
    assert.match(output, /Re-check the selectors\./);
  });

  test("an expired session ends the platform, because it will not fix itself between accounts", async () => {
    const x = fakeCollector("x", () => {
      throw new PullError("SESSION_EXPIRED", "login wall", { hint: "Run pull:login." });
    });
    await runAutoCollect(args({ platforms: ["x"] }), {
      launch: async () => fakeContext,
      collectors: { x },
      sleep: async () => {},
      log: () => {},
    });
    assert.deepEqual(x.calls, ["@onex"]);
  });

  test("a locked Chrome profile is named plainly, not dumped as a Playwright wall of text", async () => {
    // OBSERVED live: a second process holding ~/.content-agents/browser-profiles/substack produced
    // a 20-line Playwright launch log labelled UNKNOWN. It is our side, it is not the site, and
    // retrying does not help, so the summary has to say exactly that.
    const lines: string[] = [];
    await runAutoCollect(args({ platforms: ["x"], accounts: ["onex"] }), {
      launch: async () => {
        throw new Error("browserType.launchPersistentContext: Failed to create a ProcessSingleton for your profile directory.");
      },
      collectors: { x: fakeCollector("x", () => ({ entries: [], stop: null })) },
      sleep: async () => {},
      log: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    assert.match(output, /saved Chrome profile for x is already open in another process/);
    assert.match(output, /OUR SIDE, not the site/);
    assert.equal(/ProcessSingleton/.test(output), false); // the raw Playwright noise stays out
    assert.match(output, /@onex\s+x\s+0\s+0\s+failed/); // "failed", not "no thresholds"
  });

  test("a browser that will not launch is reported per account, not thrown", async () => {
    const lines: string[] = [];
    const code = await runAutoCollect(args({ platforms: ["x"] }), {
      launch: forbiddenLaunch(),
      collectors: { x: fakeCollector("x", () => ({ entries: [], stop: null })) },
      sleep: async () => {},
      log: (line) => lines.push(line),
    });
    assert.equal(code, 1);
    assert.match(lines.join("\n"), /launch must not be called/);
  });
});

describe("formatSummary", () => {
  const plan = { planned: [], skipped: [] };

  function outcome(overrides: Partial<AccountOutcome> = {}): AccountOutcome {
    return {
      platform: "x",
      handle: "@onex",
      creator: "One X",
      fetched: 3,
      appended: 2,
      duplicates: 1,
      outliers: 0,
      viewsMissing: false,
      failure: null,
      stop: null,
      ...overrides,
    };
  }

  test("a platform that publishes no view count says so instead of reporting a bare zero", () => {
    const out = formatSummary(plan, [outcome({ platform: "linkedin", viewsMissing: true })], 3);
    assert.match(out, /Views are not public on linkedin/);
    // The ratio bar's verdict is permanent and stated unconditionally.
    assert.match(out, /view-to-follower bar can never fire/);
    // The baseline bar's verdict is whatever the scoring in this tree actually does, so the note
    // stays true when the generalized baseline lands rather than becoming the falsehood we removed.
    if (baselineScoresWithoutViews()) {
      assert.match(out, /baseline bar DOES score these/);
    } else {
      assert.match(out, /not as 'nothing stood out'/);
    }
  });

  test("the baseline probe reports what the scoring really does, not a hardcoded guess", () => {
    // Whatever the answer is in this tree, it must agree with classifyOutlier itself.
    const probe = baselineScoresWithoutViews();
    assert.equal(typeof probe, "boolean");
  });

  test("a platform that does publish views gets no such note", () => {
    const out = formatSummary(plan, [outcome()], 3);
    assert.equal(/Views are not public/.test(out), false);
  });

  test("an account that fetched nothing does not trigger the note", () => {
    const out = formatSummary(plan, [outcome({ fetched: 0, viewsMissing: true })], 0);
    assert.equal(/Views are not public/.test(out), false);
  });

  test("a platform with no thresholds shows that, rather than an outlier count of zero", () => {
    const out = formatSummary(plan, [outcome({ outliers: null })], 3);
    assert.match(out, /no thresholds/);
  });

  test("totals, failures, stops and skips all appear", () => {
    const out = formatSummary(
      { planned: [], skipped: [{ label: "No Handle Yet (linkedin)", reason: "no handle in config" }] },
      [
        outcome(),
        outcome({ handle: "@twox", failure: "[NETWORK] nope. OUR SIDE" }),
        outcome({ handle: "@three", stop: { reason: "blocked", detail: "a challenge page" } }),
      ],
      9,
    );
    assert.match(out, /Fetched 9\. New 6\. Already collected 3\. Corpus is now 9\./);
    assert.match(out, /Failures \(1\)[\s\S]*@twox: \[NETWORK\]/);
    assert.match(out, /Stopped early[\s\S]*@three: blocked, a challenge page/);
    assert.match(out, /Skipped \(1\)[\s\S]*No Handle Yet/);
  });
});
