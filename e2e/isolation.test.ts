import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { changedWorktreePaths, E2E_PHASE3_SLUG, E2E_WRITE_SLUG, EXPENSIVE_REQUESTS, EXPENSIVE_ROUTES, playwrightBrowsersPath, resetDisposableSuiteState, snapshotWorktree } from "./harness.js";
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
