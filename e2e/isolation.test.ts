import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { changedWorktreePaths, E2E_PHASE3_SLUG, E2E_WRITE_SLUG, EXPENSIVE_REQUESTS, EXPENSIVE_ROUTES, partitionIsolationChanges, playwrightBrowsersPath, resetDisposableSuiteState, snapshotWorktree } from "./harness.js";
import { NOT_COVERED } from "./pass-d-notcovered.js";

test("live content generation fails closed outside the disposable injected-engine browser pass", () => {
  const route = "/api/content/generate";
  assert.ok(EXPENSIVE_ROUTES.includes(route));
  assert.ok(NOT_COVERED.some((item) => item.route === `POST ${route}` && /authenticated live CLI/i.test(item.feature)));
});

test("deterministic Fiction passage saves are browser-testable without allowing model jobs", () => {
  assert.ok(!EXPENSIVE_ROUTES.includes("/api/fiction/fix"));
  assert.ok(EXPENSIVE_ROUTES.includes("/api/fiction/draft"));
  assert.ok(EXPENSIVE_ROUTES.includes("/api/fiction/repass"));
  assert.ok(EXPENSIVE_REQUESTS.includes("POST /api/fiction/inbox"));
  assert.ok(EXPENSIVE_REQUESTS.includes("POST /api/fiction/inbox/clarify"));
  assert.ok(!EXPENSIVE_REQUESTS.includes("GET /api/fiction/inbox" as never));
});

test("Playwright cache resolution stays on the real home when E2E HOME is disposable", () => {
  assert.equal(
    playwrightBrowsersPath({}, "/Users/example"),
    "/Users/example/Library/Caches/ms-playwright",
  );
  assert.equal(
    playwrightBrowsersPath({ PLAYWRIGHT_BROWSERS_PATH: "/opt/playwright-cache" }, "/Users/example"),
    "/opt/playwright-cache",
  );
  assert.equal(playwrightBrowsersPath({ PLAYWRIGHT_BROWSERS_PATH: "0" }, "/Users/example"), "0");
});

test("a rerun reset removes only known suite artifacts from the disposable copy", () => {
  const root = mkdtempSync(join(tmpdir(), "content-agents-e2e-reset-"));
  const home = join(root, "home");
  try {
    const owned = [
      join(root, "e2e", "results.jsonl"),
      join(root, "e2e", "RESULTS.md"),
      join(root, "venture", E2E_PHASE3_SLUG, "canon.md"),
      join(root, "venture", E2E_WRITE_SLUG, "intake.md"),
      join(home, ".content-agents", "venture-intake-drafts", `${E2E_WRITE_SLUG}.json`),
      join(home, ".content-agents", "venture-intake-drafts", `${E2E_WRITE_SLUG}.sections.json`),
    ];
    for (const path of owned) {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "suite residue");
    }
    const sentinel = join(root, "data", "outreach", "tracker.jsonl");
    mkdirSync(join(sentinel, ".."), { recursive: true });
    writeFileSync(sentinel, "unrelated baseline\n");

    resetDisposableSuiteState(root, home);
    assert.deepEqual(owned.map(existsSync), owned.map(() => false));
    assert.equal(existsSync(sentinel), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the worktree snapshot catches writes and removals, including ignored-looking data", () => {
  const root = mkdtempSync(join(tmpdir(), "content-agents-e2e-snapshot-"));
  try {
    mkdirSync(join(root, "data", "outreach"), { recursive: true });
    writeFileSync(join(root, "data", "outreach", "tracker.jsonl"), "before\n");
    const before = snapshotWorktree(root);

    writeFileSync(join(root, "data", "outreach", "tracker.jsonl"), "after\n");
    writeFileSync(join(root, "new-untracked-file"), "new\n");
    assert.deepEqual(changedWorktreePaths(before, snapshotWorktree(root)), [
      "data/outreach/tracker.jsonl",
      "new-untracked-file",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dependency and git metadata are outside the byte-change contract", () => {
  const root = mkdtempSync(join(tmpdir(), "content-agents-e2e-snapshot-"));
  try {
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, "node_modules"), { recursive: true });
    writeFileSync(join(root, ".git", "index"), "metadata");
    writeFileSync(join(root, "node_modules", "dependency.js"), "dependency");
    const before = snapshotWorktree(root);
    writeFileSync(join(root, ".git", "index"), "changed metadata");
    writeFileSync(join(root, "node_modules", "dependency.js"), "changed dependency");
    assert.deepEqual(changedWorktreePaths(before, snapshotWorktree(root)), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a changed SQLite sidecar alone does not fail the isolation check", () => {
  const { failing, volatile } = partitionIsolationChanges(["data/analytics.db-wal"]);
  assert.deepEqual(failing, []);
  assert.deepEqual(volatile, ["data/analytics.db-wal"]);
});

test("a changed database file itself still fails the isolation check", () => {
  const { failing, volatile } = partitionIsolationChanges(["data/analytics.db"]);
  assert.deepEqual(failing, ["data/analytics.db"]);
  assert.deepEqual(volatile, []);
});

test("a sidecar change plus a real stray write only fails on the real write", () => {
  const { failing, volatile } = partitionIsolationChanges(["data/analytics.db-wal", "new-untracked-file"]);
  assert.deepEqual(failing, ["new-untracked-file"]);
  assert.deepEqual(volatile, ["data/analytics.db-wal"]);
});

test("partitionIsolationChanges preserves order and drops nothing, across all three sidecar paths", () => {
  const changed = ["b", "data/analytics.db-journal", "data/analytics.db-shm", "data/analytics.db-wal", "e.db"];
  const { failing, volatile } = partitionIsolationChanges(changed);
  assert.deepEqual(failing, ["b", "e.db"]);
  assert.deepEqual(volatile, ["data/analytics.db-journal", "data/analytics.db-shm", "data/analytics.db-wal"]);
  assert.deepEqual([...failing, ...volatile].sort(), [...changed].sort());
});

test("a same-suffix file outside data/analytics.db* still fails the isolation check", () => {
  const { failing, volatile } = partitionIsolationChanges([
    "tmp/leak.db-wal",
    "other.db-shm",
    "nested/data/analytics.db-wal",
  ]);
  assert.deepEqual(failing, ["tmp/leak.db-wal", "other.db-shm", "nested/data/analytics.db-wal"]);
  assert.deepEqual(volatile, []);
});

test("snapshotWorktree/changedWorktreePaths still report a changed SQLite sidecar upstream", () => {
  const root = mkdtempSync(join(tmpdir(), "content-agents-e2e-snapshot-"));
  try {
    mkdirSync(join(root, "data"), { recursive: true });
    writeFileSync(join(root, "data", "analytics.db-wal"), "before\n");
    const before = snapshotWorktree(root);
    writeFileSync(join(root, "data", "analytics.db-wal"), "after\n");
    const changed = changedWorktreePaths(before, snapshotWorktree(root));
    assert.deepEqual(changed, ["data/analytics.db-wal"]);
    // The split into failing/volatile happens downstream of the snapshot, not by excluding the
    // sidecar from what gets recorded as changed in the first place.
    assert.deepEqual(partitionIsolationChanges(changed), { failing: [], volatile: ["data/analytics.db-wal"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
