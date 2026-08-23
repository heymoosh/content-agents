// One command that runs the whole Studio end-to-end suite and writes a single report.
//
//   npm run test:e2e
//
// Deliberately NOT part of `npm test`: that suite is 2085 in-process unit tests and stays fast and
// browser-free. This one boots servers and drives Chromium, and belongs on its own command.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LEDGER = join(HERE, "results.jsonl");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

type Row = { pass: string; feature: string; pr?: string; status: string; detail: string };

const PASSES = [
  { name: "A-reads", script: "pass-a-reads.ts", title: "Pass A — every room reads and renders (fixture mode)" },
  { name: "B-writes", script: "pass-b-writes.ts", title: "Pass B — the write flows (real server, worktree-isolated)" },
  { name: "C-383", script: "pass-c-383.ts", title: "Pass C — the phase-gated #383 surfaces" },
  { name: "D-notcovered", script: "pass-d-notcovered.ts", title: "Pass D — deliberately NOT covered (model-job routes)" },
];

function main(): void {
  rmSync(LEDGER, { force: true });

  // Pass C needs a venture that is genuinely in Phase 3; the committed zz-test-* ventures are
  // canon-only stubs sitting in phase 1, so neither the response gate nor an editable artifact
  // renders on them.
  rmSync(join(ROOT, "venture", "e2e-phase3"), { recursive: true, force: true });
  spawnSync(TSX, [join(HERE, "seed-phase3.ts"), "e2e-phase3"], { cwd: ROOT, stdio: "inherit" });

  let anyFailed = false;
  for (const p of PASSES) {
    const r = spawnSync(TSX, [join(HERE, p.script)], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, E2E_PASS: p.name },
    });
    if (r.status !== 0) anyFailed = true;
  }

  const rows: Row[] = existsSync(LEDGER)
    ? readFileSync(LEDGER, "utf8")
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
    "unverified rather than quietly counted as passing. Pass D lists every one, with the engine it",
    "runs on and the actual reason it was skipped. Note that cost is NOT the usual reason: nearly",
    "all of these run at $0 on a subscription (`claude -p`, or the local Codex CLI on the ChatGPT",
    "subscription for insights). They are skipped because a model job takes minutes and returns",
    "different words every run, which leaves nothing stable to assert. Only the video render and",
    "the audio-memo transcription genuinely meter.",
    "",
    "**Run it in a disposable worktree.** The suite writes for real by design — review-queue.md",
    "statuses, tracker.jsonl events, a backlog card, two seeded ventures — so it is not idempotent",
    "and a second run starts from the first run's leavings. One known consequence: the mark-sent",
    "assertion scans the whole tracker file, so on a rerun it would also match an earlier run's",
    "event.",
    "",
  ];
  for (const p of PASSES) {
    const mine = rows.filter((r) => r.pass === p.name);
    if (!mine.length) continue;
    out.push(`## ${p.title}`, "", "| Feature | PR | Verdict | Detail |", "|---|---|---|---|");
    for (const r of mine) {
      out.push(`| ${r.feature} | ${r.pr ?? ""} | ${r.status.toUpperCase()} | ${r.detail.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
    }
    out.push("");
  }
  writeFileSync(join(HERE, "RESULTS.md"), out.join("\n"));
  console.log(`\nWrote e2e/RESULTS.md — ${counts.pass} pass, ${counts.fail} fail, ${counts.blocked} blocked\n`);
  process.exit(anyFailed ? 1 : 0);
}

main();
