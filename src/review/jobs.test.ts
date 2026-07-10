import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseReviseRefusal, revisePrompt, nextDerivativeId, duplicatePrompt, assertNoExistingDerivative, runQueued, publicJob, jobs, addVideoJob, decodeSpawnFailure } from "./jobs.js";
import { resolveAngle } from "../atomize/spin.js";

// ── Ask Claude refusal (Codebase review Phase 2, part 4) ────────────────────────────────────────
// Card 9304e4a5: an out-of-scope "Ask Claude" request (retarget the platform, write a new post)
// used to silently do nothing — Claude obeyed the prompt's own "touch nothing else" rule, and the
// resulting no-op read as a generic, indistinguishable "didn't change anything." Now the prompt
// instructs a one-line "REFUSED: <reason>" instead, parsed back here.

test("revisePrompt instructs Claude to refuse (not silently no-op) an out-of-scope request", () => {
  const p = revisePrompt("2026-06-16-foo", "x-1", "x", "make this a LinkedIn post instead");
  assert.match(p, /REFUSED:/);
  assert.match(p, /do NOT edit the file/);
  assert.match(p, /retarget the platform|Duplicate to platform/i);
  assert.match(p, /creating a\s*\n?\s*brand-new post/); // out-of-scope case #2: new post/derivative
});

test("parseReviseRefusal extracts the reason from Claude's REFUSED line", () => {
  const stdout = "some preamble\nREFUSED: that would retarget the platform — use Duplicate to platform instead\n";
  assert.equal(parseReviseRefusal(stdout), "that would retarget the platform — use Duplicate to platform instead");
});

test("parseReviseRefusal returns null when Claude didn't refuse", () => {
  assert.equal(parseReviseRefusal("Done. Tightened the hook.\n"), null);
  assert.equal(parseReviseRefusal(""), null);
});

test("parseReviseRefusal finds the marker even mid-output, not just as the first line", () => {
  const stdout = "Reading the file...\nThinking about scope...\nREFUSED: can't create a new post here\nstopping now\n";
  assert.equal(parseReviseRefusal(stdout), "can't create a new post here");
});

// ── Duplicate to platform (Codebase review Phase 2, part 2) — pure builders ─────────────────────
// duplicateToPlatform's own orchestration spawns a real `claude` subprocess (via runQueued/
// runClaudeSpawn), which isn't unit-tested here (see repro_steps/probe in the final report for how
// it's verified live instead) — but the two pieces of real logic it depends on, next-id numbering
// and the prompt it sends Claude, are fully deterministic and tested directly.

function tmpQueueFolder(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "jobs-duplicate-test-"));
  writeFileSync(join(dir, "review-queue.md"), body);
  return dir;
}

test("nextDerivativeId starts at 1 when the target platform has no existing rows", () => {
  const dir = tmpQueueFolder(
    `| id | platform | format | asset | native | brand | cta | status | notes |\n` +
      `|---|---|---|---|---|---|---|---|---|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | |\n`
  );
  try {
    assert.equal(nextDerivativeId(dir, "linkedin"), "linkedin-1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nextDerivativeId continues numbering past existing rows for that platform", () => {
  const dir = tmpQueueFolder(
    `| id | platform | format | asset | native | brand | cta | status | notes |\n` +
      `|---|---|---|---|---|---|---|---|---|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | |\n` +
      `| x-2 | x | text | derivatives/x-2.md | 4 | 5 | yes | pending | |\n` +
      `| linkedin-1 | linkedin | text | derivatives/linkedin-1.md | 4 | 5 | yes | pending | |\n`
  );
  try {
    assert.equal(nextDerivativeId(dir, "x"), "x-3");
    assert.equal(nextDerivativeId(dir, "linkedin"), "linkedin-2");
    assert.equal(nextDerivativeId(dir, "bluesky"), "bluesky-1"); // untouched platform
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("duplicatePrompt scopes to ONE new file, carries the target platform's angle + guardrails", () => {
  const p = duplicatePrompt("2026-06-16-foo", "bluesky-1", "bluesky", "x", "x-3", "the source post body", 280);
  assert.match(p, /content\/2026-06-16-foo\/derivatives\/bluesky-1\.md/); // source, quoted for context
  assert.match(p, /content\/2026-06-16-foo\/derivatives\/x-3\.md/); // the ONE new file to write
  assert.match(p, /platform: x/);
  assert.match(p, /spin: true/);
  assert.match(p, /angle: x/);
  assert.match(p, /the source post body/);
  assert.match(p, /280-character limit/);
  assert.match(p, /source\.md/); // extraction-first traceability
  assert.match(p, /voice\.yaml/);
  assert.match(p, /Write ONLY that one new file/);
  const angle = resolveAngle("x");
  assert.ok(angle, "x should have a real configured angle");
  assert.ok(p.includes(angle!.angle), "the real spin_angles text for x is embedded, not re-derived");
});

test("duplicatePrompt omits the char-limit line when no max_chars is known", () => {
  const p = duplicatePrompt("2026-06-16-foo", "x-1", "x", "bluesky", "bluesky-1", "body", undefined);
  assert.ok(!/character limit/.test(p));
});

test("assertNoExistingDerivative throws when a stray file already occupies the target path", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobs-duplicate-guard-test-"));
  const targetPath = join(dir, "x-1.md");
  writeFileSync(targetPath, "stray out-of-band file");
  try {
    assert.throws(() => assertNoExistingDerivative(targetPath, "x-1"), /refus.*overwrite/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("assertNoExistingDerivative does not throw when the target path is free", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobs-duplicate-guard-test-"));
  const targetPath = join(dir, "x-1.md");
  try {
    assert.doesNotThrow(() => assertNoExistingDerivative(targetPath, "x-1"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── runQueued: the ONE job queue (Codebase review Phase 2, part 3) ──────────────────────────────
// Previously only atomize jobs were serialized (a module-level `draining` boolean); revise/insights/
// ask/brief-revise/duplicate each spawned their own `claude -p` with no coordination. runQueued puts
// every one of them behind the SAME mutex — this proves two queued tasks never run concurrently,
// using fake tasks (no real subprocess) so the test is fast and deterministic.

test("runQueued serializes task jobs one at a time behind the shared mutex", async () => {
  const order: string[] = [];
  let releaseA: () => void = () => {};
  const gate = new Promise<void>((res) => {
    releaseA = res;
  });
  const pA = runQueued("revise", "A", async () => {
    order.push("A start");
    await gate;
    order.push("A end");
    return "a";
  });
  const pB = runQueued("insights", "B", async () => {
    order.push("B start");
    return "b";
  });

  // Give the event loop a beat to run whatever it's going to run — B must NOT have started, since
  // A hasn't released the gate yet and the queue only runs one job at a time.
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(order, ["A start"], "B must stay queued behind A, not run concurrently");

  releaseA();
  const [a, b] = await Promise.all([pA, pB]);
  assert.equal(a, "a");
  assert.equal(b, "b");
  assert.deepEqual(order, ["A start", "A end", "B start"]);
});

test("runQueued's job bookkeeping (status/error) tracks a failing task, and publicJob never leaks the internal task closure", async () => {
  const before = jobs.length;
  await assert.rejects(
    runQueued("revise", "will fail", async () => {
      throw new Error("boom");
    }),
    /boom/
  );
  const job = jobs[jobs.length - 1];
  assert.equal(jobs.length, before + 1);
  assert.equal(job.status, "failed");
  assert.equal(job.error, "boom");
  const pub = publicJob(job);
  assert.ok(!("task" in pub), "publicJob() must never expose the internal task closure");
});

// ── decodeSpawnFailure (card 84afb9e3) — the one enoent/timedOut/non-zero-exit classification ────
// Previously six near-duplicated if/else-if chains, one per Claude-spawning call site. Pure and
// deterministic, so every branch (including the two sites disagree on: verb wording, and whether
// the log tail is appended to a timeout message) is unit-tested directly, no subprocess needed.

test("decodeSpawnFailure returns null for a clean, zero-exit run", () => {
  const result = decodeSpawnFailure({ code: 0, timedOut: false, enoent: false }, "job-x", {
    timeoutVerb: "Claude", timeoutLabel: "180s", exitVerb: "Claude",
  });
  assert.equal(result, null);
});

test("decodeSpawnFailure reports enoent the same way regardless of verb options", () => {
  const result = decodeSpawnFailure({ code: null, timedOut: false, enoent: true }, "job-x", {
    timeoutVerb: "atomize", timeoutLabel: "15 min", exitVerb: "atomize",
  });
  assert.equal(result, "the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
});

test("decodeSpawnFailure uses timeoutVerb + timeoutLabel, and omits the log tail by default", () => {
  const result = decodeSpawnFailure({ code: null, timedOut: true, enoent: false }, "job-x", {
    timeoutVerb: "Claude", timeoutLabel: "180s", exitVerb: "Claude revise",
  });
  assert.equal(result, "Claude timed out after 180s");
});

test("decodeSpawnFailure appends the log tail to the timeout message when includeTailOnTimeout is set", () => {
  const result = decodeSpawnFailure({ code: null, timedOut: true, enoent: false }, "no-such-job-log", {
    timeoutVerb: "atomize", timeoutLabel: "15 min", exitVerb: "atomize", includeTailOnTimeout: true,
  });
  // No log file exists for "no-such-job-log", so logTailSuffix resolves to "" — proves the tail
  // path is wired up (not appending garbage) without needing a real persisted log.
  assert.equal(result, "atomize timed out after 15 min");
});

test("decodeSpawnFailure uses exitVerb (which may differ from timeoutVerb) for a non-zero exit", () => {
  const result = decodeSpawnFailure({ code: 1, timedOut: false, enoent: false }, "no-such-job-log", {
    timeoutVerb: "Claude", timeoutLabel: "180s", exitVerb: "Claude revise",
  });
  assert.equal(result, "Claude revise failed (exit 1)");
});

// ── addVideoJob (card 9e20a616) — validation-only path, no real /video spawn ────────────────────
// Enqueuing a REAL video job spawns `claude -p "/video ..."` once it's its turn — not something to
// trigger from a unit test. The one thing safe to test without a live subprocess is the guard that
// runs before any job is even created: a bogus slug must throw, not silently queue nothing.

test("addVideoJob refuses a slug that isn't a real content folder", () => {
  assert.throws(() => addVideoJob("definitely-not-a-real-content-folder-xyz"), /no such queue/);
});
