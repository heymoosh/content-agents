// The weekly pattern-mining job. Every test injects a fake runner, so no npm command ever spawns
// and nothing touches the network. The run report goes to a temp directory, never to the real
// data/patterns.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TEXT_PLATFORMS,
  buildSteps,
  formatReport,
  main,
  summarize,
  writeRunReport,
  type RunReport,
  type Step,
} from "./patterns-weekly.js";

let dir: string;
let reportPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "patterns-weekly-"));
  reportPath = join(dir, "weekly-runs.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Records what it was asked to run and returns the code the test asked for.
function fakeRunner(codes: Record<string, number> = {}) {
  const calls: Step[] = [];
  const run = (step: Step): number => {
    calls.push(step);
    return codes[step.name] ?? 0;
  };
  return { calls, run };
}

describe("buildSteps", () => {
  test("runs one collector step per text platform, then discovery", () => {
    const steps = buildSteps(false);
    assert.equal(steps.length, TEXT_PLATFORMS.length + 1);
    for (const [i, platform] of TEXT_PLATFORMS.entries()) {
      assert.deepEqual(steps[i].args, ["run", "patterns:auto", "--", "--platform", platform]);
    }
    assert.deepEqual(steps.at(-1)?.args, ["run", "patterns:discover", "--"]);
  });

  test("collects the three text platforms and no video platform", () => {
    const platforms = buildSteps(false).flatMap((s) => s.args.filter((a) => !a.startsWith("--")));
    for (const video of ["tiktok", "youtube", "instagram"]) {
      assert.ok(!platforms.includes(video), `${video} must not be collected: video is not built`);
    }
    assert.deepEqual(TEXT_PLATFORMS, ["x", "linkedin", "substack"]);
  });

  test("--dry-run is passed through to every step", () => {
    for (const step of buildSteps(true)) {
      assert.ok(step.args.includes("--dry-run"), `${step.name} must forward --dry-run`);
    }
  });
});

describe("main", () => {
  test("a platform failing does not stop the platforms after it", () => {
    const runner = fakeRunner({ "collect linkedin": 1 });
    const code = main([], {
      runner: runner.run,
      reportPath,
      corpusCount: () => 0,
    });
    assert.deepEqual(
      runner.calls.map((c) => c.name),
      ["collect x", "collect linkedin", "collect substack", "discover new accounts (proposes only)"],
    );
    assert.equal(code, 1, "a failed step makes the run exit non-zero");
  });

  test("a clean run exits zero", () => {
    const runner = fakeRunner();
    assert.equal(main([], { runner: runner.run, reportPath, corpusCount: () => 3 }), 0);
  });

  test("a dry run still walks every step but writes no report", () => {
    const runner = fakeRunner();
    main(["--dry-run"], { runner: runner.run, reportPath, corpusCount: () => 0 });
    assert.equal(runner.calls.length, TEXT_PLATFORMS.length + 1);
    assert.ok(!existsSync(reportPath), "a dry run must not write the run report");
  });

  test("a real run appends one report line, and a second run appends another", () => {
    const runner = fakeRunner();
    let count = 0;
    main([], { runner: runner.run, reportPath, corpusCount: () => count++ });
    main([], { runner: runner.run, reportPath, corpusCount: () => count++ });
    const lines = readFileSync(reportPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]) as RunReport;
    assert.equal(first.new_entries, 1);
    assert.equal(first.dry_run, false);
    assert.deepEqual(first.failed, []);
  });
});

// The Chrome profile lock is the reason these tests exist. launchPersistentContext takes an
// EXCLUSIVE lock per profile directory, and there is one profile per platform, so two steps
// touching the same platform at the same instant would fail on the lock rather than on anything
// legible. Sequencing is the guarantee; these tests are what makes a future "let us speed this up"
// refactor fail here instead of at 3am in a launchd log.
describe("steps run one at a time (Chrome profile lock)", () => {
  test("every step finishes before the next one starts", () => {
    const events: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    main([], {
      runner: (step) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        events.push(`enter ${step.name}`);
        events.push(`exit ${step.name}`);
        inFlight--;
        return 0;
      },
      reportPath,
      corpusCount: () => 0,
    });
    assert.equal(maxInFlight, 1, "two steps were in flight at once; the profile lock would fail");
    assert.deepEqual(events, [
      "enter collect x",
      "exit collect x",
      "enter collect linkedin",
      "exit collect linkedin",
      "enter collect substack",
      "exit collect substack",
      "enter discover new accounts (proposes only)",
      "exit discover new accounts (proposes only)",
    ]);
  });

  test("no two steps name the same platform, and discovery runs after all of them", () => {
    const steps = buildSteps(false);
    const platformArgs = steps.flatMap((s) => {
      const i = s.args.indexOf("--platform");
      return i >= 0 ? [s.args[i + 1]] : [];
    });
    assert.equal(new Set(platformArgs).size, platformArgs.length, "a platform profile is opened twice");
    // Discovery walks every platform itself, so it can only be safe as the last step.
    assert.match(steps.at(-1)!.name, /^discover/);
  });

  test("the whole run is synchronous, so nothing can be left in flight", () => {
    // main returns a number, not a promise. That is the structural half of the guarantee: a
    // synchronous run cannot start step 2 before step 1 has returned. If this ever becomes
    // Promise<number>, the steps can overlap and collide on a profile lock.
    const result = main([], { runner: () => 0, reportPath, corpusCount: () => 0 });
    assert.equal(typeof result, "number");
    // Typecheck backs this up: `result instanceof Promise` does not compile, because the compiler
    // already knows main returns a number. This assertion is the runtime half.
  });
});

describe("summarize", () => {
  test("names every failed step and counts what the corpus gained", () => {
    const report = summarize(
      [
        { name: "collect x", code: 0 },
        { name: "collect linkedin", code: 1 },
      ],
      { before: 12, after: 19 },
      { dryRun: false, ranAt: "2026-08-22T00:00:00.000Z" },
    );
    assert.deepEqual(report.failed, ["collect linkedin"]);
    assert.equal(report.new_entries, 7);
    assert.equal(report.ran_at, "2026-08-22T00:00:00.000Z");
  });

  test("a repeat run over an already-collected week reports zero new entries", () => {
    const report = summarize([{ name: "collect x", code: 0 }], { before: 40, after: 40 }, { dryRun: false });
    assert.equal(report.new_entries, 0, "dedupe by url makes a second run a no-op");
  });
});

describe("formatReport", () => {
  const base: RunReport = {
    ran_at: "2026-08-22T00:00:00.000Z",
    dry_run: false,
    steps: [{ name: "collect x", code: 0 }],
    failed: [],
    corpus_before: 5,
    corpus_after: 8,
    new_entries: 3,
  };

  test("says what a blocked platform means instead of just failing", () => {
    const text = formatReport({ ...base, steps: [{ name: "collect linkedin", code: 1 }], failed: ["collect linkedin"] });
    assert.match(text, /collect linkedin/);
    assert.match(text, /blocked or rate limited/);
  });

  test("always says discovery proposes rather than adds", () => {
    assert.match(formatReport(base), /PROPOSED, never added/);
    assert.match(formatReport(base), /--approve/);
  });

  test("a dry run does not claim a corpus change", () => {
    const text = formatReport({ ...base, dry_run: true });
    assert.match(text, /nothing was fetched/);
    assert.ok(!text.includes("entries (3 new)"));
  });

  test("no em dashes anywhere in the output (CLAUDE.md rule 5)", () => {
    const text = formatReport({ ...base, failed: ["collect x"] });
    assert.ok(!text.includes("—"), "em dash found in run report output");
  });
});

describe("writeRunReport", () => {
  test("creates the directory when the corpus folder does not exist yet", () => {
    const nested = join(dir, "patterns", "weekly-runs.jsonl");
    writeRunReport(
      { ran_at: "2026-08-22T00:00:00.000Z", dry_run: false, steps: [], failed: [], corpus_before: 0, corpus_after: 0, new_entries: 0 },
      nested,
    );
    assert.ok(existsSync(nested));
  });
});
