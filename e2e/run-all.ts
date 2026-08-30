// One command that runs the whole Studio end-to-end suite and writes a single report.
//
//   npm run test:e2e
//   npm run test:e2e -- D-editorial  # one isolated pass
//
// Deliberately NOT part of `npm test`: that suite is 2085 in-process unit tests and stays fast and
// browser-free. This one boots servers and drives Chromium, and belongs on its own command.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { changedWorktreePaths, E2E_PHASE3_SLUG, playwrightBrowsersPath, resetDisposableSuiteState, snapshotWorktree } from "./harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED_ROOT = join(HERE, "..");

type Row = { pass: string; feature: string; pr?: string; status: string; detail: string };

const PASSES = [
  { name: "A-reads", script: "pass-a-reads.ts", title: "Pass A — every room reads and renders (fixture mode)" },
  { name: "B-writes", script: "pass-b-writes.ts", title: "Pass B — the write flows (real server, worktree-isolated)" },
  { name: "C-383", script: "pass-c-383.ts", title: "Pass C — the phase-gated #383 surfaces" },
  { name: "D-editorial", script: "pass-d-editorial.ts", title: "Pass D — Fiction and Charles editorial writes" },
  { name: "D-content-generation", script: "pass-d-content-generation.ts", title: "Pass D — configured Content generation with a disposable injected engine" },
  { name: "E-notcovered", script: "pass-d-notcovered.ts", title: "Pass E — deliberately NOT covered (model-job routes)" },
];

type DisposableRepo = { root: string; home: string; parent: string };

/** Copy the caller's exact checkout, including dirty edits, without copying git metadata/deps. */
function makeDisposableRepo(): DisposableRepo {
  const parent = mkdtempSync(join(tmpdir(), "content-agents-e2e-"));
  try {
    const root = join(parent, "repo");
    cpSync(SHARED_ROOT, root, {
      recursive: true,
      filter: (source) => source !== join(SHARED_ROOT, ".git") && source !== join(SHARED_ROOT, "node_modules"),
    });
    // The dependency tree is read-only during this suite. A symlink keeps setup cheap; the whole
    // disposable parent is removed in finally, so the link itself can never be left behind.
    if (existsSync(join(SHARED_ROOT, "node_modules"))) {
      symlinkSync(join(SHARED_ROOT, "node_modules"), join(root, "node_modules"), "dir");
    }
    const home = join(parent, "home");
    mkdirSync(home, { recursive: true });
    return { root, home, parent };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
}

function main(): void {
  const requestedPass = process.argv[2];
  const passes = requestedPass ? PASSES.filter((pass) => pass.name === requestedPass) : PASSES;
  if (requestedPass && !passes.length) {
    throw new Error(`Unknown E2E pass ${requestedPass}. Choose one of: ${PASSES.map((pass) => pass.name).join(", ")}`);
  }
  const sharedBefore = snapshotWorktree(SHARED_ROOT);
  const disposable = makeDisposableRepo();
  // HOME below is intentionally disposable for application drafts. Pin Playwright to the cache
  // selected from the real HOME first, so Chromium is reused rather than searched for under the
  // empty temporary draft home. An explicit PLAYWRIGHT_BROWSERS_PATH (including "0") wins.
  const browsersPath = playwrightBrowsersPath();
  const env = {
    ...process.env,
    E2E_REPO_ROOT: disposable.root,
    E2E_DRAFT_HOME: disposable.home,
    HOME: disposable.home,
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
  };
  const configuredEngineToken = randomUUID();
  writeFileSync(join(disposable.root, ".e2e-configured-engine-token"), configuredEngineToken, { mode: 0o600 });
  const ledger = join(disposable.root, "e2e", "results.jsonl");
  // Invoke Node's tsx loader directly. The .bin/tsx launcher opens an IPC pipe and can exit
  // before a detached child is ready, which makes bootServer report a misleading clean exit.
  const tsx = process.execPath;
  const tsxArgs = ["--import", "tsx"];

  // Pass C needs a venture that is genuinely in Phase 3; the committed zz-test-* ventures are
  // canon-only stubs sitting in phase 1, so neither the response gate nor an editable artifact
  // renders on them.
  let anyFailed = false;
  let rows: Row[] = [];
  try {
    // Start from a suite-clean disposable baseline. This removes only known outputs from an
    // earlier run; it never edits the source checkout (including its existing tracker/backlog/
    // review-queue residue).
    resetDisposableSuiteState(disposable.root, disposable.home);
    if (passes.some((pass) => pass.name === "C-383")) {
      const seed = spawnSync(tsx, [...tsxArgs, join(disposable.root, "e2e", "seed-phase3.ts"), E2E_PHASE3_SLUG], {
        cwd: disposable.root,
        stdio: "inherit",
        env,
      });
      if (seed.status !== 0) anyFailed = true;
    }

    for (const p of passes) {
      const r = spawnSync(tsx, [...tsxArgs, join(disposable.root, "e2e", p.script)], {
        cwd: disposable.root,
        stdio: "inherit",
        env: { ...env, E2E_PASS: p.name, ...(p.name === "D-content-generation" ? { CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: configuredEngineToken } : {}) },
      });
      if (r.status !== 0) anyFailed = true;
    }

    rows = existsSync(ledger)
      ? readFileSync(ledger, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l) as Row)
      : [];

    const counts = {
      pass: rows.filter((r) => r.status === "pass").length,
      fail: rows.filter((r) => r.status === "fail").length,
      blocked: rows.filter((r) => r.status === "blocked").length,
    };

    const out: string[] = [
      "# Studio end-to-end results",
      "",
      "Every row below was produced by a real Chromium driving the real server. Nothing here is a",
      "unit test asserting on a returned HTML string.",
      "",
      `**${counts.pass} pass, ${counts.fail} fail, ${counts.blocked} blocked.**`,
      "",
      "Blocked means the suite did not drive the feature, so its end-to-end behaviour is genuinely",
      "unverified rather than quietly counted as passing. Pass E lists every one, with the engine it",
      "runs on and the actual reason it was skipped. Note that cost is NOT the usual reason: nearly",
      "all of these run at $0 on a subscription (`claude -p`, or the local Codex CLI on the ChatGPT",
      "subscription for insights). They are skipped because a model job takes minutes and returns",
      "different words every run, which leaves nothing stable to assert. Only the video render and",
      "the audio-memo transcription genuinely meter.",
      "",
      "**Writes stay disposable.** The suite writes for real inside a temporary repository and draft",
      "home, then removes both. The caller's tracked, untracked, and ignored runtime files are",
      "snapshotted before and after the passes and must remain byte-identical.",
      "",
    ];
    for (const p of passes) {
      const mine = rows.filter((r) => r.pass === p.name);
      if (!mine.length) continue;
      out.push(`## ${p.title}`, "", "| Feature | PR | Verdict | Detail |", "|---|---|---|---|");
      for (const r of mine) {
        out.push(`| ${r.feature} | ${r.pr ?? ""} | ${r.status.toUpperCase()} | ${r.detail.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
      }
      out.push("");
    }
    // Keep the report beside the disposable ledger. Writing e2e/RESULTS.md in the caller's
    // checkout would itself violate the no-byte-changes guarantee (it is gitignored, but still
    // shared state). The report is printed below before this root is removed.
    writeFileSync(join(disposable.root, "e2e", "RESULTS.md"), out.join("\n"));
    console.log(`\nE2E report (disposable root): ${counts.pass} pass, ${counts.fail} fail, ${counts.blocked} blocked\n`);
  } finally {
    const sharedAfter = snapshotWorktree(SHARED_ROOT);
    const changed = changedWorktreePaths(sharedBefore, sharedAfter);
    if (changed.length) {
      anyFailed = true;
      console.error(`\nE2E isolation failure: shared worktree changed (${changed.join(", ")})`);
    } else {
      console.log("E2E isolation: shared worktree byte-identical after disposable passes.");
    }
    // This removes the copied source, generated writes, draft home, and dependency symlink even
    // when a pass crashes. No cleanup command touches the shared checkout.
    rmSync(disposable.parent, { recursive: true, force: true });
  }
  process.exit(anyFailed ? 1 : 0);
}

main();
