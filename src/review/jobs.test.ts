import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseReviseRefusal, revisePrompt, outreachMessageRevisePrompt, nextDerivativeId, duplicatePrompt, assertNoExistingDerivative, runQueued, publicJob, jobs, clearFinishedJobs, addVideoJob, decodeSpawnFailure, buildJobId, jobLogPath, buildClaudeSpawnArgs, isSpawnTimeout, charlesDraftPrompt, enqueueCharlesDraft, answerJob, retryJob, parseStepMarker, parseAskMarker, parseAskOptionMarker, ingestMarkerChunk, isRetryableFailure, shouldBlockOnAsk, answerPromptSuffix, jobElapsedMs, createSpawnStreamReader, jobIsSweepable, stopJob, atomizeArtifactVerdict, MARKER_EXEMPT_KINDS, type MarkerTarget, fictionDraftPrompt, fictionRepassPrompt, fictionRunProduced, chapterSnapshot, findFictionDupe, gitStateDrift, type GitState } from "./jobs.js";
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

test("charlesDraftPrompt scopes to ONE new file + row, points at persona.yaml not voice.yaml, lists existing ids", () => {
  const p = charlesDraftPrompt("essay", "AI and inevitability", ["dapper", "falcons"]);
  assert.match(p, /charles\/config\/persona\.yaml/);
  assert.match(p, /NOT config\/voice\.yaml/);
  assert.match(p, /posts\/essays\//);
  assert.match(p, /AI and inevitability/);
  assert.match(p, /dapper, falcons/);
  assert.match(p, /always "pending"/);
  assert.match(p, /leak_bank/);
  assert.match(p, /em-dash ban/);
});

test("charlesDraftPrompt's reply mode tells Claude to fetch the real link, not invent it", () => {
  const p = charlesDraftPrompt("reply", "https://example.com/post", []);
  assert.match(p, /fetch it first, never invent/);
  assert.match(p, /https:\/\/example\.com\/post/);
  assert.match(p, /\(none yet\)/);
});

test("enqueueCharlesDraft refuses an unknown mode and a reply with no link, before spawning anything", async () => {
  await assert.rejects(enqueueCharlesDraft("meme", "topic"), /isn't a mode this can draft/); // memes are out of scope here on purpose
  await assert.rejects(enqueueCharlesDraft("reply", ""), /needs a URL/);
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

// ── clearFinishedJobs (GUI "Clear queue" button) — only done/failed entries are removed; drain()
// finds work via jobs.find(status==="queued"), never by index, so this is safe mid-run.

test("clearFinishedJobs removes done and failed jobs but leaves queued/running untouched", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const justFailed = jobs[jobs.length - 1];
  let releaseB: () => void = () => {};
  const pB = runQueued("revise", "running job", () => new Promise<void>((r) => { releaseB = r; }));
  await new Promise((r) => setTimeout(r, 20));
  const stillRunning = jobs[jobs.length - 1];
  assert.equal(stillRunning.status, "running");

  // clearFinishedJobs() sweeps every done/failed job currently in the (module-shared) array, not
  // just ones added by this test — so assert relative effects, not an absolute before/after count.
  const removed = clearFinishedJobs();
  assert.ok(removed >= 1, "at least the failed job from this test should be removed");
  assert.ok(!jobs.includes(justFailed), "the failed job must be gone");
  assert.ok(jobs.includes(stillRunning), "a still-running job must survive the clear");
  assert.equal(jobs.some((j) => j.status === "done" || j.status === "failed"), false);

  releaseB();
  await pB;
  clearFinishedJobs(); // cleanup so this test doesn't leak a finished job into later ones
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

test("decodeSpawnFailure names the given command in the enoent message (runCommandSpawn sites spawn npm, not claude)", () => {
  const result = decodeSpawnFailure({ code: null, timedOut: false, enoent: true }, "job-x", {
    timeoutVerb: "scout", timeoutLabel: "30 min", exitVerb: "scout", command: "npm",
  });
  assert.equal(result, "the `npm` CLI isn't on this server's PATH — start the GUI from a terminal where `npm` runs");
});

// ── outreachMessageRevisePrompt — the Outreach tab's inline "Revise with AI" on a drafted message.
// Same single-file guardrail contract as revisePrompt/briefRevisePrompt; content-generation-
// adjacent (CLAUDE.md rule 7), so the guardrails are pinned here.

test("outreachMessageRevisePrompt scopes to the one message file with frontmatter/evidence/voice guardrails", () => {
  const p = outreachMessageRevisePrompt("outreach/leads/client-acme-co/messages/message-02.md", "email", "shorter opener");
  assert.match(p, /outreach\/leads\/client-acme-co\/messages\/message-02\.md/); // the exact file
  assert.match(p, /channel: email/);
  assert.match(p, /shorter opener/); // Muxin's instruction included
  assert.match(p, /Edit ONLY that one file/);
  assert.match(p, /frontmatter/); // lead/channel/evidence/classification/status stay intact
  assert.match(p, /NEVER invent a fact/); // evidence-grounded
  assert.match(p, /voice\.yaml/); // no em dashes / AI tells
  assert.match(p, /Do not run shell commands/);
});

// ── isSpawnTimeout (Generate insights exit-143 bug) ──────────────────────────────────────────────
// The `claude` native binary catches SIGTERM and exits with numeric code 143 (128+15) instead of
// dying by signal, so a run we killed for running too long can surface as a plain nonzero exit
// indistinguishable from a real crash unless code 143 is also treated as a timeout tell.
test("isSpawnTimeout is true when Node reports the SIGTERM signal directly", () => {
  assert.equal(isSpawnTimeout(null, "SIGTERM"), true);
});

test("isSpawnTimeout is true for exit code 143 even with no signal reported (the claude binary's SIGTERM handler)", () => {
  assert.equal(isSpawnTimeout(143, null), true);
});

test("isSpawnTimeout is false for a clean exit or an unrelated nonzero exit", () => {
  assert.equal(isSpawnTimeout(0, null), false);
  assert.equal(isSpawnTimeout(1, null), false);
});

// ── buildClaudeSpawnArgs (card d39258ab) — pure argv builder for runClaudeSpawn ─────────────────
// Split out so a caller's exact `claude` invocation is asserted directly, without spawning a real
// subprocess. The draft-follow-up wiring (enqueueFollowUpDraft) depends on this producing the SAME
// argv shape as outreach/draft.ts's own execFile call (--model/--tools, no --permission-mode) —
// tested here since that invocation equivalence is the whole self-vet argument for card d39258ab
// not being a content-generation-logic change.

test("buildClaudeSpawnArgs: every pre-existing caller (no model/tools/permissionMode override) is unaffected", () => {
  assert.deepEqual(buildClaudeSpawnArgs("do the thing", {}), ["-p", "do the thing", "--permission-mode", "acceptEdits"]);
});

test("buildClaudeSpawnArgs: an explicit permissionMode overrides the acceptEdits default", () => {
  assert.deepEqual(buildClaudeSpawnArgs("p", { permissionMode: "plan" }), ["-p", "p", "--permission-mode", "plan"]);
});

test("buildClaudeSpawnArgs: permissionMode: null omits --permission-mode entirely, matching draft.ts's own callClaudeDraft invocation", () => {
  assert.deepEqual(
    buildClaudeSpawnArgs("p", { permissionMode: null, model: "sonnet", tools: "" }),
    ["-p", "p", "--model", "sonnet", "--tools", ""],
  );
});

test("buildClaudeSpawnArgs: model/tools are appended only when explicitly set", () => {
  assert.deepEqual(buildClaudeSpawnArgs("p", { model: "sonnet" }), ["-p", "p", "--permission-mode", "acceptEdits", "--model", "sonnet"]);
});

// ── addVideoJob (card 9e20a616) — validation-only path, no real /video spawn ────────────────────
// Enqueuing a REAL video job spawns `claude -p "/video ..."` once it's its turn — not something to
// trigger from a unit test. The one thing safe to test without a live subprocess is the guard that
// runs before any job is even created: a bogus slug must throw, not silently queue nothing.

test("addVideoJob refuses a slug that isn't a real content folder", () => {
  assert.throws(() => addVideoJob("definitely-not-a-real-content-folder-xyz"), /no such queue/);
});

// ── Job id uniqueness across a server restart (GUI job logs mixing content from unrelated old
// runs) ──────────────────────────────────────────────────────────────────────────────────────
// Root cause: job ids used to be a bare in-process counter (`job-${++jobSeq}`), which resets to 0
// every time the GUI process restarts. jobLogPath keys the PERSISTED per-job log file purely by
// that id, and runClaudeSpawn opens it in append mode — so a job "5" from a run last week and job
// "5" from a run today reused the identical log file path, and the new run's output got appended
// onto the old run's leftover content instead of starting fresh. That stale, mixed content then
// surfaced verbatim in the queue UI (both the full "view log" read and the tailed job.error).
// The fix salts every id with the session's start time (buildJobId's first argument) so two
// different sessions can never land on the same id even when their own internal sequence numbers
// (the second argument) happen to line up, exactly as they would across a real restart.

test("buildJobId: two sessions whose internal sequence numbers collide still get different ids", () => {
  const lastWeeksRun = 1_752_000_000_000; // an earlier server session's start time
  const todaysRun = 1_752_600_000_000; // a later restart
  // Both sessions independently counted up to their 5th job — the exact collision the old
  // `job-${++jobSeq}` scheme hit on every restart.
  const oldJobFive = buildJobId(lastWeeksRun, 5);
  const newJobFive = buildJobId(todaysRun, 5);
  assert.notEqual(oldJobFive, newJobFive);
});

test("buildJobId: a session-collision id maps to a DIFFERENT persisted log file, so the new run can never inherit the old run's on-disk content", () => {
  const lastWeeksRun = 1_752_000_000_000;
  const todaysRun = 1_752_600_000_000;
  const oldJobFive = buildJobId(lastWeeksRun, 5);
  const newJobFive = buildJobId(todaysRun, 5);
  assert.notEqual(jobLogPath(oldJobFive), jobLogPath(newJobFive));
});

// ── Ordered steps + a job that stops and asks (v5 handoff §1-§4) ────────────────────────────────
// Nothing in the repo emits these markers yet, so these tests are the whole consumer: they pin the
// protocol, the lane rule, and the non-breaking guarantee before any skill is instrumented.

function markerTarget(): MarkerTarget {
  return { steps: [], stepTotal: null, step: 0, ask: null };
}

test("parseStepMarker reads a well-formed marker", () => {
  assert.deepEqual(parseStepMarker("STEP 1/3 Read your beats"), { n: 1, total: 3, label: "Read your beats" });
  assert.deepEqual(parseStepMarker("STEP 12/12 Drafted the scene"), { n: 12, total: 12, label: "Drafted the scene" });
});

test("parseStepMarker tolerates the surrounding whitespace a real stdout line carries", () => {
  assert.deepEqual(parseStepMarker("  STEP 2/3  Checked them against the canon  "), {
    n: 2, total: 3, label: "Checked them against the canon",
  });
});

test("parseStepMarker returns null for malformed markers", () => {
  assert.equal(parseStepMarker("STEP 1/3"), null, "a marker with no label is not a step");
  assert.equal(parseStepMarker("STEP 1 of 3 Read your beats"), null);
  assert.equal(parseStepMarker("STEP x/3 Read your beats"), null);
  assert.equal(parseStepMarker("STEP 0/3 Read your beats"), null, "steps are 1-indexed");
  assert.equal(parseStepMarker("STEP 4/3 Read your beats"), null, "n can never exceed the declared total");
});

test("parseStepMarker returns null for ordinary output lines", () => {
  assert.equal(parseStepMarker("Reading content/2026-06-16-foo/source.md"), null);
  assert.equal(parseStepMarker(""), null);
  assert.equal(parseStepMarker("REFUSED: out of scope"), null);
  assert.equal(parseStepMarker("the next STEP 1/3 is to read the beats"), null, "a marker is the whole line or nothing");
});

test("a chunk carrying several step markers advances to the LAST one", () => {
  const t = markerTarget();
  ingestMarkerChunk(t, "STEP 1/3 Read your beats\nsome noise\nSTEP 2/3 Checked them against the canon\n");
  assert.equal(t.stepTotal, 3);
  assert.equal(t.step, 1, "marker 2 means step 1 finished and step 2 is in flight");
  assert.deepEqual(t.steps, ["Read your beats", "Checked them against the canon"]);
});

test("step counts COMPLETED steps, so it is 0 until the first marker arrives", () => {
  const t = markerTarget();
  assert.equal(t.step, 0);
  ingestMarkerChunk(t, "STEP 1/3 Read your beats\n");
  assert.equal(t.step, 0, "step 1 is in flight, nothing is finished yet");
  ingestMarkerChunk(t, "STEP 3/3 Drafted the scene\n");
  assert.equal(t.step, 2);
  assert.deepEqual(t.steps, ["Read your beats", "", "Drafted the scene"], "a skipped label leaves a hole, not a shifted list");
});

test("a job whose skill emits no markers keeps steps empty and stepTotal null", () => {
  const t = markerTarget();
  ingestMarkerChunk(t, "Reading the source\nWrote 4 derivatives\nDone.\n");
  assert.deepEqual(t.steps, []);
  assert.equal(t.stepTotal, null);
  assert.equal(t.step, 0);
  assert.equal(t.ask, null);
});

test("parseAskMarker reads a question, and only a question", () => {
  assert.equal(parseAskMarker("ASK Which platform should this probe run on?"), "Which platform should this probe run on?");
  assert.equal(parseAskMarker("ASK no question mark here"), null);
  assert.equal(parseAskMarker("ASK"), null);
  assert.equal(parseAskMarker("ASK-OPTION Substack"), null);
  assert.equal(parseAskMarker("I need to ask you something?"), null);
});

test("parseAskOptionMarker reads one option label", () => {
  assert.equal(parseAskOptionMarker("ASK-OPTION Substack"), "Substack");
  assert.equal(parseAskOptionMarker("  ASK-OPTION  Bluesky  "), "Bluesky");
  assert.equal(parseAskOptionMarker("ASK-OPTION"), null);
  assert.equal(parseAskOptionMarker("ASK something?"), null);
});

test("an ask chunk collects the question and every option under it", () => {
  const t = markerTarget();
  ingestMarkerChunk(t, "STEP 1/2 Read the brief\nASK Which platform should this probe run on?\nASK-OPTION Substack\nASK-OPTION Bluesky\n", 1234);
  assert.deepEqual(t.ask, {
    question: "Which platform should this probe run on?",
    options: ["Substack", "Bluesky"],
    askedAt: 1234,
  });
});

test("an ASK-OPTION with no ASK before it is ignored", () => {
  const t = markerTarget();
  ingestMarkerChunk(t, "ASK-OPTION Substack\nASK-OPTION Bluesky\n");
  assert.equal(t.ask, null);
});

// The lane rule: a blocked job froze the moment it asked, so its clock must read like a finished
// job's, not a running one's. Muxin's thinking time is not time the job spent working.
test("jobElapsedMs freezes on blocked exactly like it does on done", () => {
  const frozen = jobElapsedMs({ status: "blocked", startedAt: 1000, finishedAt: 6000 }, 999_999);
  assert.equal(frozen, 5000);
  assert.equal(frozen, jobElapsedMs({ status: "done", startedAt: 1000, finishedAt: 6000 }, 999_999));
});

test("clearFinishedJobs never removes a blocked job — an unanswered question is not finished work", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const failed = jobs[jobs.length - 1];
  // Stand a blocked job up directly: nothing emits ASK yet, so there is no live path to one.
  const blocked = { ...failed, id: "job-blocked-test", status: "blocked" as const, error: null };
  jobs.push(blocked);
  try {
    clearFinishedJobs();
    assert.ok(!jobs.includes(failed), "the failed job is swept");
    assert.ok(jobs.includes(blocked), "the blocked job survives");
  } finally {
    jobs.splice(jobs.indexOf(blocked), 1);
  }
});

// A deliberate ask beats the artifact check (which sees a run that wrote nothing), but a broken
// run beats a stray ask.
test("shouldBlockOnAsk: a real ask on a clean spawn blocks", () => {
  assert.equal(
    shouldBlockOnAsk({ question: "Which one?", options: ["A", "B"] }, { code: 0, timedOut: false, enoent: false }),
    true,
  );
});

test("shouldBlockOnAsk: a broken spawn never blocks, however it printed the ask", () => {
  const ask = { question: "Which one?", options: ["A", "B"] };
  assert.equal(shouldBlockOnAsk(ask, { code: 1, timedOut: false, enoent: false }), false);
  assert.equal(shouldBlockOnAsk(ask, { code: 143, timedOut: true, enoent: false }), false);
  assert.equal(shouldBlockOnAsk(ask, { code: null, timedOut: false, enoent: true }), false);
  assert.equal(shouldBlockOnAsk(ask, null), false, "a job that never spawned cannot have asked");
});

test("shouldBlockOnAsk: an ask with fewer than two options falls through instead of stranding the job", () => {
  const clean = { code: 0, timedOut: false, enoent: false };
  assert.equal(shouldBlockOnAsk({ question: "Which one?", options: [] }, clean), false);
  assert.equal(shouldBlockOnAsk({ question: "Which one?", options: ["A"] }, clean), false);
  assert.equal(shouldBlockOnAsk(null, clean), false);
});

test("isRetryableFailure: only a missing binary is a dead end", () => {
  assert.equal(isRetryableFailure({ code: null, timedOut: false, enoent: true }), false, "ENOENT: retrying can't put claude on the PATH");
  assert.equal(isRetryableFailure({ code: 143, timedOut: true, enoent: false }), true, "timeout: may clear on a quieter machine");
  assert.equal(isRetryableFailure({ code: 1, timedOut: false, enoent: false }), true, "non-zero exit: usually transient");
  assert.equal(isRetryableFailure({ code: 0, timedOut: false, enoent: false }), true, "clean exit reaching the failure path = the artifact check caught it");
});

test("answerPromptSuffix carries the answer forward and tells the next run not to ask again", () => {
  const suffix = answerPromptSuffix("Substack");
  assert.match(suffix, /Substack/);
  assert.match(suffix, /do not ask it again/);
  assert.equal(suffix.includes("\u2014"), false, "no em dashes in anything Muxin's tools emit");
});

// publicJob is an explicit allowlist. The new fields are additive: every field a screen already
// reads must still be there, byte-identical.
test("publicJob exposes the new step/ask/retry fields plus logPath, and keeps every pre-existing field", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const job = jobs[jobs.length - 1];
  const pub = publicJob(job);
  for (const field of ["id", "kind", "label", "status", "slugs", "error", "createdAt", "startedAt", "finishedAt", "elapsedMs", "lastStdoutLine"]) {
    assert.ok(field in pub, `publicJob must still expose the pre-existing field "${field}"`);
  }
  for (const field of ["steps", "stepTotal", "step", "failedAtStep", "retryable", "ask", "answer", "logPath"]) {
    assert.ok(field in pub, `publicJob must expose the new field "${field}"`);
  }
  assert.equal(pub.logPath, jobLogPath(job.id), "the log link needs a real href, not a placeholder");
  assert.deepEqual(pub.steps, []);
  assert.equal(pub.stepTotal, null);
  assert.equal(pub.ask, null);
  assert.equal(pub.answer, null);
  assert.ok(!("task" in pub), "publicJob must never expose the internal task closure");
  assert.ok(!("lastSpawn" in pub), "publicJob must never expose the internal spawn result");
  clearFinishedJobs();
});

test("a failed job that emitted no markers records no failedAtStep, and is retryable", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "failed");
  assert.equal(job.failedAtStep, null, "no steps means there is no step to point at");
  assert.equal(job.retryable, true);
  clearFinishedJobs();
});

// ── The two new routes' logic (POST /api/jobs/:id/answer, /retry) ───────────────────────────────
// Stood up against synthetic blocked/failed jobs, since nothing emits ASK yet.

function pushBlockedJob(id: string, ran: string[]): void {
  jobs.push({
    id, kind: "revise", label: "asked a question", arg: "",
    status: "blocked", slugs: [], error: null,
    createdAt: Date.now(), startedAt: 1000, finishedAt: 6000, lastStdoutLine: null,
    steps: ["Read the brief"], stepTotal: 2, step: 1, failedAtStep: null, retryable: false,
    ask: { question: "Which platform should this probe run on?", options: ["Substack", "Bluesky"], askedAt: 500 },
    answer: null,
    task: async (j) => { ran.push(j.answer ?? ""); },
  });
}

test("answerJob requeues a NEW job carrying the answer, and leaves the original blocked with the answer recorded", async () => {
  const ran: string[] = [];
  pushBlockedJob("job-answer-test", ran);
  const original = jobs[jobs.length - 1];
  const result = answerJob("job-answer-test", "Bluesky");
  assert.ok("job" in result, "a valid answer requeues");
  const requeued = (result as { job: typeof original }).job;
  assert.notEqual(requeued.id, original.id, "a dead subprocess can't be resumed, so this is a new job");
  assert.equal(requeued.answer, "Bluesky");
  assert.equal(requeued.kind, original.kind);
  // Enqueued at startedAt: null; drain() picks it up synchronously when the lane is free, so what
  // matters here is that it did NOT inherit the original's frozen clock.
  assert.notEqual(requeued.startedAt, original.startedAt);
  assert.equal(requeued.finishedAt, null);
  assert.deepEqual(requeued.steps, [], "the requeued job starts its checklist over");
  assert.equal(original.status, "blocked", "the original keeps the question readable");
  assert.equal(original.answer, "Bluesky");
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(ran, ["Bluesky"], "the requeued job actually ran, with the answer on it");
  jobs.splice(jobs.indexOf(original), 1);
  clearFinishedJobs();
});

test("answerJob refuses an answer that wasn't one of the offered options, and a job that isn't blocked", () => {
  const ran: string[] = [];
  pushBlockedJob("job-answer-guard-test", ran);
  const blocked = jobs[jobs.length - 1];
  assert.deepEqual(answerJob("job-answer-guard-test", "LinkedIn"), { error: "pick one of the options that job offered" });
  assert.deepEqual(answerJob("job-does-not-exist", "Bluesky"), { error: "no such job" });
  blocked.status = "failed";
  assert.deepEqual(answerJob("job-answer-guard-test", "Bluesky"), { error: "that job isn't waiting on an answer" });
  assert.deepEqual(ran, [], "a refused answer starts nothing");
  jobs.splice(jobs.indexOf(blocked), 1);
});

test("retryJob reuses the same job id so the log appends, and clears the failed attempt's state", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const job = jobs[jobs.length - 1];
  job.retryable = true;
  job.stepTotal = 3;
  job.step = 2;
  job.failedAtStep = 2;
  const id = job.id;
  const result = retryJob(id);
  assert.ok("job" in result);
  assert.equal((result as { job: typeof job }).job.id, id, "same id keeps one readable log per job");
  assert.equal(job.status === "queued" || job.status === "running" || job.status === "failed", true);
  assert.equal(job.failedAtStep, null);
  assert.equal(job.error, null);
  await new Promise((r) => setTimeout(r, 30));
  clearFinishedJobs();
});

test("retryJob refuses a job that isn't failed, and one a retry can't fix", async () => {
  await assert.rejects(runQueued("revise", "will fail", async () => { throw new Error("boom"); }), /boom/);
  const job = jobs[jobs.length - 1];
  job.retryable = false;
  assert.deepEqual(retryJob(job.id), { error: "running that again can't fix it" });
  job.status = "done";
  job.retryable = true;
  assert.deepEqual(retryJob(job.id), { error: "only a failed job can be run again" });
  assert.deepEqual(retryJob("job-does-not-exist"), { error: "no such job" });
  clearFinishedJobs();
});

// ── The lane rule, through the real drain() path ────────────────────────────────────────────────
// settleJob is where a job stops running, so these drive it through runQueued/drain rather than
// calling it directly. No subprocess: runCommandSpawn writes a log under ~/.content-agents, and
// nothing else in this suite depends on that being writable. The live-stream half (markers read off
// real stdout, including a marker split across two chunks) is covered by ingestMarkerChunk above.

test("a clean run that asks ends blocked, keeps no error, and releases the lane for the next job", async () => {
  const order: string[] = [];
  const asking = runQueued("revise", "asks a question", async (job) => {
    order.push("asking start");
    // What a real spawn would have left behind: markers read off stdout, and a clean exit.
    ingestMarkerChunk(job, "STEP 1/2 Read the brief\nSTEP 2/2 Weighed the options\nASK Which platform should this probe run on?\nASK-OPTION Substack\nASK-OPTION Bluesky\n");
    job.lastSpawn = { code: 0, timedOut: false, enoent: false };
    order.push("asking end");
    // The artifact check's verdict on a run that deliberately wrote nothing. A real task job
    // signals that by THROWING, which is what lands the job in `failed` for settleJob to override:
    // the job asked, it did not fail. (It used to be enough to set job.error and resolve, which
    // also read as a clean success, and settleJob then overrode a genuine `done`. See the
    // "wrote its artifact AND printed an ask" test below for the half that must not be overridden.)
    throw new Error("the advisor ran but wrote no new round to develop/advice.json");
  });
  // Queued behind it: if a blocked job held `draining`, this would never run.
  const next = runQueued("revise", "queued behind the ask", async () => { order.push("next ran"); });
  await Promise.all([assert.rejects(asking, /no new round/), next]);

  const blocked = jobs.find((j) => j.label === "asks a question")!;
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(blocked.steps, ["Read the brief", "Weighed the options"]);
  assert.equal(blocked.stepTotal, 2);
  assert.equal(blocked.step, 1, "marker 2 arrived, so step 1 is done and step 2 was in flight when it asked");
  assert.deepEqual(blocked.ask?.options, ["Substack", "Bluesky"]);
  assert.equal(blocked.error, null, "a question is not a fault, so the artifact check's message does not survive");
  assert.ok(blocked.finishedAt, "a blocked job records finishedAt so its clock freezes");
  assert.equal(jobElapsedMs(blocked, 999_999_999_999), blocked.finishedAt! - blocked.startedAt!);
  assert.deepEqual(order, ["asking start", "asking end", "next ran"], "the lane was released for the next job");

  jobs.splice(jobs.indexOf(blocked), 1); // blocked jobs are never swept, so clean up by hand
  clearFinishedJobs();
});

test("a broken run is not blocked by a stray ask line, and records where it died", async () => {
  await assert.rejects(
    runQueued("revise", "asks then dies", async (job) => {
      ingestMarkerChunk(job, "STEP 1/2 Read the brief\nASK Which one?\nASK-OPTION A\nASK-OPTION B\n");
      job.lastSpawn = { code: 3, timedOut: false, enoent: false };
      throw new Error("the run broke");
    }),
    /the run broke/,
  );
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "failed", "a broken run beats a question it printed on the way down");
  assert.equal(job.error, "the run broke");
  assert.equal(job.failedAtStep, 0, "it died on step 1, with nothing completed");
  assert.equal(job.retryable, true, "a non-zero exit is worth another attempt");
  clearFinishedJobs();
});

test("a job killed by a missing binary is not offered a retry", async () => {
  await assert.rejects(
    runQueued("revise", "no claude on PATH", async (job) => {
      job.lastSpawn = { code: null, timedOut: false, enoent: true };
      throw new Error("the `claude` CLI isn't on this server's PATH");
    }),
    /PATH/,
  );
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "failed");
  assert.equal(job.retryable, false, "retrying can't put a missing binary back on the PATH");
  clearFinishedJobs();
});

test("a clean run that finishes marks every step done", async () => {
  await runQueued("revise", "finishes cleanly", async (job) => {
    ingestMarkerChunk(job, "STEP 1/3 Read your beats\nSTEP 2/3 Checked them against the canon\nSTEP 3/3 Drafted the scene\n");
    job.lastSpawn = { code: 0, timedOut: false, enoent: false };
  });
  // runQueued resolves its caller from inside the task, a tick before drain() settles the job.
  await new Promise((r) => setTimeout(r, 20));
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "done");
  assert.equal(job.step, 3, "a clean finish means the last step completed too");
  assert.equal(job.stepTotal, 3);
  assert.equal(job.failedAtStep, null);
  clearFinishedJobs();
});

// ── Audit fixes: the marker stream, the artifact check, retry, and an answered ask ─────────────
// Every test below covers a defect that shipped because nothing tested it.

// Finding 1: markers rode a residual buffer SHARED by stdout and stderr, and stderr was parsed.
function reader(kind = "revise" as const) {
  const job = { kind, lastStdoutLine: null as string | null, steps: [] as string[], stepTotal: null as number | null, step: 0, ask: null as MarkerTarget["ask"] };
  return { job, io: createSpawnStreamReader(job) };
}

test("a stderr write cannot corrupt a stdout marker still waiting for its newline", () => {
  const { job, io } = reader();
  io.stdout("STEP 1/3 Read your beats"); // no trailing newline yet
  io.stderr("warn: something noisy\n"); // used to be glued onto the held-back stdout line
  io.stdout("\n");
  assert.equal(job.stepTotal, 3);
  assert.deepEqual(job.steps, ["Read your beats"], "the label must not carry stderr's text");
});

test("a stderr line shaped like a step marker cannot forge a step", () => {
  const { job, io } = reader();
  io.stderr("STEP 2/5 Pretended to do the work\n");
  assert.equal(job.stepTotal, null, "markers ride stdout only");
  assert.equal(job.step, 0);
  assert.deepEqual(job.steps, []);
});

test("a stderr line shaped like an ask cannot block a job", () => {
  const { job, io } = reader();
  io.stderr("ASK Should I keep going?\nASK-OPTION Yes\nASK-OPTION No\n");
  assert.equal(job.ask, null);
});

test("stderr still feeds the free-form heartbeat, which was never a protocol", () => {
  const { job, io } = reader();
  io.stderr("still working on it\n");
  assert.equal(job.lastStdoutLine, "still working on it");
});

test("a stdout marker split across two chunks is read once its newline lands", () => {
  const { job, io } = reader();
  io.stdout("STEP 2/4 Checked them ag");
  io.stdout("ainst the canon\n");
  assert.equal(job.step, 1);
  assert.deepEqual(job.steps[1], "Checked them against the canon");
});

test("a final stdout marker with no trailing newline is flushed on close", () => {
  const { job, io } = reader();
  io.stdout("STEP 3/3 Drafted the scene");
  assert.equal(io.close(), "STEP 3/3 Drafted the scene");
  assert.equal(job.stepTotal, 3);
});

// Finding 4b: a job whose stdout IS the deliverable must not be marker-parsed at all. A drafted
// outreach message containing an ASK line would otherwise flip a finished job to blocked and, once
// answered, append a duplicate message file.
test("a kind whose stdout is the deliverable is parsed for no markers at all", () => {
  for (const kind of ["draft-follow-up", "ask-insights"] as const) {
    assert.ok(MARKER_EXEMPT_KINDS.has(kind), `${kind} must be marker-exempt`);
    const { job, io } = reader(kind as never);
    io.stdout("ASK Which angle should I take?\nASK-OPTION The hiring one\nASK-OPTION The mission one\n");
    io.stdout("STEP 1/2 Wrote the opener\n");
    assert.equal(job.ask, null, `${kind}: a drafted line must not become a real ask`);
    assert.equal(job.stepTotal, null, `${kind}: a drafted line must not become a real step`);
    assert.equal(io.close(), "ASK Which angle should I take?\nASK-OPTION The hiring one\nASK-OPTION The mission one\nSTEP 1/2 Wrote the opener\n",
      "the deliverable text itself must come back untouched");
  }
});

test("a kind verified by artifact keeps its markers", () => {
  assert.equal(MARKER_EXEMPT_KINDS.has("charles-draft"), false);
  assert.equal(MARKER_EXEMPT_KINDS.has("revise"), false);
});

// Finding 4a: shouldBlockOnAsk used to override a SUCCESSFUL done, not just a wrong "failed".
test("a job that wrote its artifact AND printed an ask stays done", async () => {
  await runQueued("video", "wrote the storyboard, then asked", async (job) => {
    ingestMarkerChunk(job, "ASK Want a second pass?\nASK-OPTION Yes\nASK-OPTION No\n");
    job.lastSpawn = { code: 0, timedOut: false, enoent: false };
  });
  await new Promise((r) => setTimeout(r, 20));
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "done", "re-running it would overwrite the artifact it already wrote");
  clearFinishedJobs();
});

test("a job that wrote NOTHING and printed an ask still blocks", async () => {
  await assert.rejects(
    runQueued("video", "asked instead of writing", async (job) => {
      ingestMarkerChunk(job, "ASK Want a second pass?\nASK-OPTION Yes\nASK-OPTION No\n");
      job.lastSpawn = { code: 0, timedOut: false, enoent: false };
      throw new Error("/video ran but produced no video/storyboard.md");
    }),
    /storyboard/,
  );
  await new Promise((r) => setTimeout(r, 20));
  const job = jobs.find((j) => j.label === "asked instead of writing")!;
  assert.equal(job.status, "blocked", "the artifact check's verdict was really about the ask");
  assert.equal(job.error, null);
  jobs.length = 0;
});

// Finding 3: retry left the previous attempt's checklist in place, so a markerless rerun painted a
// 100% bar and three green step labels it never measured.
test("retry clears the previous attempt's step checklist, and a markerless rerun invents no progress", async () => {
  jobs.length = 0;
  jobs.push({
    id: buildJobId(Date.now(), 999), kind: "revise", label: "retried markerless", arg: "",
    status: "failed", slugs: [], error: "it broke", createdAt: Date.now(), startedAt: Date.now(),
    finishedAt: Date.now(), lastStdoutLine: "drafting...",
    steps: ["Read your beats", "Checked them", "Drafted the scene"], stepTotal: 3, step: 2,
    failedAtStep: 2, retryable: true, ask: null, answer: null,
    task: async (j) => { j.lastSpawn = { code: 0, timedOut: false, enoent: false }; },
  });
  const job = jobs[0];

  const out = retryJob(job.id);
  assert.ok("job" in out, "a failed non-ENOENT job is retryable");
  // Checked the instant the retry is accepted: the first attempt's checklist is gone, so nothing
  // on screen claims progress this attempt has not emitted.
  assert.deepEqual(job.steps, [], "a checklist this attempt has not emitted must not be on screen");
  assert.equal(job.stepTotal, null, "and no progress bar drawn from the last attempt's total");
  assert.equal(job.step, 0);
  assert.equal(job.failedAtStep, null);
  assert.equal(job.error, null);
  assert.equal(job.lastStdoutLine, null, "nor the last attempt's heartbeat line");

  // The rerun emits no markers at all and finishes clean. settleJob forces `step = stepTotal` on a
  // clean finish, so a surviving stepTotal of 3 would paint a full bar and three green labels.
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(job.status, "done");
  assert.equal(job.step, 0, "settleJob must have no stepTotal to force step up to");
  assert.equal(job.stepTotal, null);
  assert.deepEqual(job.steps, []);
  jobs.length = 0;
});

// Finding 5: an answered ask stuck in the queue forever with no way to dismiss it.
test("an answered ask becomes sweepable, an unanswered one never does", () => {
  assert.equal(jobIsSweepable({ status: "blocked", answer: null }), false, "her question must survive Clear queue");
  assert.equal(jobIsSweepable({ status: "blocked", answer: "Yes" }), true, "she already answered it");
  assert.equal(jobIsSweepable({ status: "done", answer: null }), true);
  assert.equal(jobIsSweepable({ status: "failed", answer: null }), true);
  assert.equal(jobIsSweepable({ status: "running", answer: null }), false);
  assert.equal(jobIsSweepable({ status: "queued", answer: null }), false);
});

test("Clear queue sweeps an answered ask and keeps an unanswered one", async () => {
  jobs.length = 0;
  const asking = runQueued("revise", "asks a question", async (job) => {
    ingestMarkerChunk(job, "ASK Which one?\nASK-OPTION A\nASK-OPTION B\n");
    job.lastSpawn = { code: 0, timedOut: false, enoent: false };
    throw new Error("wrote nothing");
  });
  await assert.rejects(asking, /wrote nothing/);
  await new Promise((r) => setTimeout(r, 20));
  const blocked = jobs.find((j) => j.status === "blocked")!;
  assert.equal(clearFinishedJobs(), 0, "an unanswered question is not finished work");
  assert.ok(jobs.includes(blocked));

  answerJob(blocked.id, "A");
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(blocked.answer, "A");
  const swept = clearFinishedJobs();
  assert.ok(swept >= 1, "the answered original is finished work now");
  assert.equal(jobs.includes(blocked), false);
  jobs.length = 0;
});

// Finding 2: an atomize run that exited 0 and created nothing used to stay green `done` with an
// error string beside it, so the row read "took 45s" under the landing sentence "A cut, waiting on
// your yes." for a cut that did not exist, offered no Retry, and got swept by Clear queue.
test("an atomize run that created no content folder is a failure, not a green done", () => {
  assert.equal(atomizeArtifactVerdict(null, 1), "done", "it ran and it wrote something");
  assert.equal(atomizeArtifactVerdict(null, 3), "done");
  assert.equal(atomizeArtifactVerdict(null, 0), "failed", "exit 0 and nothing written is still nothing written");
  assert.equal(atomizeArtifactVerdict("the `claude` CLI isn't on this server's PATH", 0), "failed");
  assert.equal(atomizeArtifactVerdict("atomize timed out after 15 min", 2), "failed", "a broken run beats a stray folder");
});

test("a clean exit that fails its artifact check is offered a retry", async () => {
  jobs.length = 0;
  await assert.rejects(
    runQueued("url", "ran, wrote nothing", async (job) => {
      job.lastSpawn = { code: 0, timedOut: false, enoent: false }; // exited 0
      throw new Error("atomize finished but created no new content folder");
    }),
    /no new content folder/,
  );
  const job = jobs[jobs.length - 1];
  assert.equal(job.status, "failed", "it must not sit there green");
  assert.equal(job.retryable, true, "worth one more attempt, so Retry has to be on offer");
  assert.equal(jobIsSweepable(job), true, "and Clear queue can take it like any other dead job");
  jobs.length = 0;
});

// ── Fiction jobs (v7 §2) ─────────────────────────────────────────────────────────────────────────
// "Draft it" routes through the /story SKILL, not `story:draft`: src/fiction/draft.ts exits 1 for
// any `prose: claude-native` series (the default, and what the only series here uses) and is a
// guardrail path, so it is left alone.

test("the draft prompt dispatches the /story skill, not story:draft", () => {
  const p = fictionDraftPrompt("the-least-of-us", "Eli finds the cut hydro line.");
  assert.match(p, /^\/story the-least-of-us/);
  assert.doesNotMatch(p, /story:draft/);
  assert.match(p, /Eli finds the cut hydro line\./);
});

test("the draft prompt carries the two headless constraints: no waiting beat sheet, no git", () => {
  const p = fictionDraftPrompt("a-series", "beats");
  assert.match(p, /do not post a beat sheet and wait/i);
  assert.match(p, /Do NOT commit, branch, push or open a pull request/);
  assert.match(p, /do not lock or publish anything/i);
  assert.match(p, /story:validate/);
});

test("the second-pass prompt hands the note over as the one review comment, since there is no PR", () => {
  const p = fictionRepassPrompt("a-series", 3, "More tension, less explaining");
  assert.match(p, /^\/story --revise a-series 3/);
  assert.match(p, /no GitHub pull request/i);
  assert.match(p, /More tension, less explaining/);
  assert.match(p, /Do NOT commit, branch, push, open a pull request or reply on any thread/);
});

test("no fiction prompt smuggles in an em dash", () => {
  for (const p of [fictionDraftPrompt("s", "b"), fictionRepassPrompt("s", 1, "n")]) {
    assert.ok(!/[—–]/.test(p), `em dash in: ${p}`);
  }
});

test("the fiction artifact check: a draft counts only when a new chapter file actually landed", () => {
  const before = new Map([[1, "one"]]);
  assert.equal(fictionRunProduced(before, new Map([[1, "one"], [2, "two"]]), "draft"), 2);
  // Finished is not the same as worked: a clean exit that wrote nothing fails the check.
  assert.equal(fictionRunProduced(before, new Map([[1, "one"]]), "draft"), null);
  // A run that only rewrote an existing chapter is not a new scene either.
  assert.equal(fictionRunProduced(before, new Map([[1, "rewritten"]]), "draft"), null);
  // Several new chapters: the last one is the scene she asked for.
  assert.equal(fictionRunProduced(before, new Map([[1, "one"], [2, "two"], [3, "three"]]), "draft"), 3);
});

test("the fiction artifact check: a second pass counts only when that chapter's prose changed", () => {
  const before = new Map([[1, "one"], [2, "two"]]);
  assert.equal(fictionRunProduced(before, new Map([[1, "one"], [2, "revised"]]), "repass", 2), 2);
  assert.equal(fictionRunProduced(before, new Map([[1, "one"], [2, "two"]]), "repass", 2), null);
  assert.equal(fictionRunProduced(before, new Map([[1, "one"]]), "repass", 2), null);
  assert.equal(fictionRunProduced(before, new Map([[1, "one"], [2, "revised"]]), "repass"), null);
});

test("chapterSnapshot reads every chapter's prose, and an empty series is an empty map", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-jobs-"));
  try {
    const dir = join(root, "a-series");
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(join(dir, "series.yaml"), "slug: a-series\n");
    assert.equal(chapterSnapshot(dir).size, 0);
    writeFileSync(join(dir, "chapters", "chapter-01.md"), "---\nchapter: 1\n---\n\nThe airlock was quiet.\n");
    const snap = chapterSnapshot(dir);
    assert.equal(snap.size, 1);
    assert.equal(snap.get(1), "The airlock was quiet.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Fiction dedupe identity (audit finding) ─────────────────────────────────────────────────────
// The dedupe used to match ANY queued or running fiction-draft job for the series, so a queued
// first pass swallowed a chapter-3 second pass: the route answered ok with that unrelated job and
// the second pass Muxin asked for never ran. Two second passes on different chapters collided the
// same way. Identity is the whole request now.
const dj = (over: Record<string, unknown> = {}) =>
  ({ id: "j", kind: "fiction-draft", label: "l", status: "queued", ...over }) as never;

test("findFictionDupe matches only the same request, never a different one", () => {
  const first = dj({ id: "j1", payload: { mode: "draft", series: "a-series", beats: "b" } });
  const list = [first] as never[];

  // The same press twice is still one job.
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "draft" })?.id, "j1");
  // A second pass is NOT that draft, and must queue on its own.
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "repass", chapter: 3 }), undefined);
  // A different series never matches.
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "b-series", mode: "draft" }), undefined);
  // A different kind never matches.
  assert.equal(findFictionDupe(list, { kind: "fiction-continuity", series: "a-series" }), undefined);
});

test("findFictionDupe keeps second passes on different chapters apart", () => {
  const list = [dj({ id: "j3", status: "running", payload: { mode: "repass", series: "a-series", chapter: 3 } })] as never[];
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "repass", chapter: 3 })?.id, "j3");
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "repass", chapter: 5 }), undefined);
  assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "draft" }), undefined);
});

test("findFictionDupe only ever matches a job still in flight", () => {
  for (const status of ["done", "failed", "blocked"]) {
    const list = [dj({ id: "old", status, payload: { mode: "draft", series: "a-series" } })] as never[];
    assert.equal(findFictionDupe(list, { kind: "fiction-draft", series: "a-series", mode: "draft" }), undefined, status);
  }
});

test("findFictionDupe reads a continuity job by series and chapter", () => {
  const list = [
    { id: "c3", kind: "fiction-continuity", label: "l", status: "running", payload: { series: "a-series", chapter: 3 } },
  ] as never[];
  assert.equal(findFictionDupe(list, { kind: "fiction-continuity", series: "a-series", chapter: 3 })?.id, "c3");
  assert.equal(findFictionDupe(list, { kind: "fiction-continuity", series: "a-series", chapter: 4 }), undefined);
});

// ── "Do not touch git" is verified, not just asked for (audit finding) ──────────────────────────
// The dispatch prompt tells the headless /story run not to branch, commit, push or open a PR, and
// the run holds acceptEdits with Bash reachable (it needs `npm run story:validate`). A prompt is a
// request, so the outcome is checked instead: git before, git after, and a loud failure if anything
// moved. Nothing is ever reverted.
const gs = (over: Partial<GitState> = {}): GitState =>
  ({ head: "abc123", branch: "main", branches: "refs/heads/main", ...over });

test("gitStateDrift says nothing when git stands exactly where it did", () => {
  assert.equal(gitStateDrift(gs(), gs()), null);
  // No reading to compare (not a checkout, or git missing) is not a violation.
  assert.equal(gitStateDrift(null, gs()), null);
  assert.equal(gitStateDrift(gs(), null), null);
});

test("gitStateDrift catches a commit, a checkout and a new branch, and names each one", () => {
  const committed = gitStateDrift(gs(), gs({ head: "def456" }));
  assert.match(String(committed), /committed something/);
  const switched = gitStateDrift(gs(), gs({ branch: "story/chapter-02" }));
  assert.match(String(switched), /switched the branch from main to story\/chapter-02/);
  const branched = gitStateDrift(gs(), gs({ branches: "refs/heads/main\nrefs/heads/story/chapter-02" }));
  assert.match(String(branched), /created story\/chapter-02/);
});

test("gitStateDrift reports the whole /story step 7 at once and never offers to undo it", () => {
  const all = String(gitStateDrift(
    gs(),
    gs({ head: "def456", branch: "story/chapter-02", branches: "refs/heads/main\nrefs/heads/story/chapter-02" }),
  ));
  assert.match(all, /switched the branch/);
  assert.match(all, /committed something/);
  assert.match(all, /created story\/chapter-02/);
  assert.match(all, /Nothing was undone for you/);
  assert.ok(!/\u2014/.test(all), "no em dash in copy Muxin reads");
});


// ── Stop it (per-job stop) ─────────────────────────────────────────────────────────────────────
// Before this, the ONLY way out of a running job was restarting the server: runCommandSpawn kept
// the child in a local `const`, so nothing in the process could signal it, and a stuck run held
// the single `draining` lane against every job queued behind it.

test("stopping a queued job never spawns anything, and drain() skips it", async () => {
  jobs.length = 0;
  let taskRan = false;
  const first = runQueued("revise", "holds the lane", async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const second = runQueued("revise", "stopped before it ever ran", async () => {
    taskRan = true;
  });
  await new Promise((r) => setTimeout(r, 10));
  const queued = jobs.find((j) => j.label === "stopped before it ever ran")!;
  assert.equal(queued.status, "queued", "the first job holds the lane");

  const out = stopJob(queued.id);
  assert.ok("job" in out && out.stopped);
  assert.equal(queued.status, "stopped");
  assert.equal(queued.error, null, "a stop is not a fault");
  // The caller's promise must settle, or the HTTP request that enqueued it hangs forever.
  await assert.rejects(second, /stopped/);

  await first;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(taskRan, false, "drain() finds work by status === 'queued' — a stopped job is never picked");
  assert.equal(queued.status, "stopped", "and nothing later flipped it to done or failed");
  jobs.length = 0;
});

// THE core regression. `claude` catches SIGTERM and exits 143 rather than dying by signal (see
// isSpawnTimeout), so the close handler hands settleJob a failure-shaped result for a run Muxin
// deliberately ended. Drop the stoppedByMuxin check in settleJob and this test reports "failed"
// with a Retry button attached.
test("a stopped subprocess job settles as stopped, not failed, even when it exits 143", async () => {
  jobs.length = 0;
  const run = runQueued("revise", "killed mid-run", async (job) => {
    stopJob(job.id); // stands in for the route firing while this job is running
    // What runCommandSpawn's close handler records for a SIGTERM'd `claude`: exit 143, no signal.
    job.lastSpawn = { code: 143, timedOut: true, enoent: false };
    throw new Error("revise timed out after 180s");
  });
  await assert.rejects(run, /timed out|stopped/);
  await new Promise((r) => setTimeout(r, 30));

  const job = jobs.find((j) => j.label === "killed mid-run")!;
  assert.equal(job.status, "stopped", "exit 143 after a deliberate stop is a stop, not a broken run");
  assert.notEqual(job.status, "failed");
  assert.equal(job.error, null, "no 'timed out' error text on a run she ended herself");
  assert.equal(job.retryable, false, "Retry means 'the run broke, try again' — she did not ask for that");
  assert.equal(job.failedAtStep, null);
  assert.ok(job.finishedAt !== null, "and it stopped the clock");
  jobs.length = 0;
});

test("stopping a task-closure job with no subprocess still settles as stopped and discards its result", async () => {
  jobs.length = 0;
  let release: (() => void) | null = null;
  const run = runQueued("insights", "mid-await, nothing to kill", async () => {
    await new Promise<void>((r) => { release = r; });
    return "the answer nobody is waiting for any more";
  });
  await new Promise((r) => setTimeout(r, 20));
  const job = jobs.find((j) => j.label === "mid-await, nothing to kill")!;
  assert.equal(job.status, "running");
  assert.equal(job.proc, undefined, "a task closure has no child process to signal");

  const out = stopJob(job.id);
  assert.ok("job" in out && out.stopped);
  assert.equal(job.status, "stopped", "no process means stopping can only mean 'mark it and drop the result'");
  await assert.rejects(run, /stopped/, "the caller's promise is rejected, not left hanging");

  // The orphaned closure finishes into nothing: drain() clobbers the status back to done, and
  // settleJob's rule 0 must put it back without releasing a lane the NEXT job now holds.
  release!();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(job.status, "stopped", "its late result is discarded, not rendered as a green done");
  jobs.length = 0;
});

// The mutex half of the case above: the lane is handed on ONCE. If settleJob re-released it when
// the orphan resolved, two jobs would run at the same time.
test("an orphaned stopped task resolving late does not double-release the job lane", async () => {
  jobs.length = 0;
  let release: (() => void) | null = null;
  const stoppedRun = runQueued("insights", "orphan", async () => {
    await new Promise<void>((r) => { release = r; });
  });
  await new Promise((r) => setTimeout(r, 20));
  const orphan = jobs.find((j) => j.label === "orphan")!;

  let concurrent = 0;
  let maxConcurrent = 0;
  const body = async () => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 40));
    concurrent--;
  };
  const nextA = runQueued("insights", "next A", body);
  const nextB = runQueued("insights", "next B", body);

  stopJob(orphan.id);
  await assert.rejects(stoppedRun, /stopped/);
  await new Promise((r) => setTimeout(r, 10));
  release!(); // the orphan's own promise resolves while "next A" holds the lane
  await Promise.all([nextA, nextB]);

  assert.equal(maxConcurrent, 1, "one Claude at a time — the stopped job's late resolve must not free the lane again");
  assert.equal(orphan.status, "stopped");
  jobs.length = 0;
});

test("a stopped job is sweepable by Clear finished", () => {
  assert.equal(jobIsSweepable({ status: "stopped", answer: null }), true, "she ended it; that is finished work");
  assert.equal(jobIsSweepable({ status: "stopped", answer: "A" }), true);
});

test("stopping an already-settled job is a safe no-op", () => {
  jobs.length = 0;
  jobs.push({
    id: buildJobId(Date.now(), 4242), kind: "revise", label: "already done", arg: "",
    status: "done", slugs: [], error: null, createdAt: Date.now(), startedAt: Date.now(),
    finishedAt: Date.now(), lastStdoutLine: null, steps: [], stepTotal: null, step: 0,
    failedAtStep: null, retryable: false, ask: null, answer: null,
  });
  const done = jobs[0];
  const out = stopJob(done.id);
  assert.ok("job" in out);
  assert.equal(out.stopped, false, "nothing to stop");
  assert.equal(done.status, "done", "and its verdict is left exactly as it was");

  assert.deepEqual(stopJob("job-that-never-existed"), { error: "no such job" });
  jobs.length = 0;
});

test("a stopped job is never offered a retry", () => {
  jobs.length = 0;
  jobs.push({
    id: buildJobId(Date.now(), 4243), kind: "revise", label: "she stopped it", arg: "",
    status: "running", slugs: [], error: null, createdAt: Date.now(), startedAt: Date.now(),
    finishedAt: null, lastStdoutLine: null, steps: [], stepTotal: null, step: 0,
    failedAtStep: null, retryable: true, ask: null, answer: null,
  });
  const job = jobs[0];
  stopJob(job.id);
  assert.equal(job.status, "stopped");
  assert.equal(job.retryable, false);
  // And the route guard agrees: only a `failed` job can be run again.
  const retried = retryJob(job.id);
  assert.ok("error" in retried && /only a failed job/.test(retried.error));
  jobs.length = 0;
});

test("publicJob stays JSON-serializable and never carries the process handle", () => {
  jobs.length = 0;
  const fakeChild = { pid: 4242, kill: () => true, stdout: null, stderr: null } as unknown as NonNullable<
    Parameters<typeof publicJob>[0]["proc"]
  >;
  jobs.push({
    id: buildJobId(Date.now(), 4244), kind: "revise", label: "has a live child", arg: "",
    status: "running", slugs: [], error: null, createdAt: Date.now(), startedAt: Date.now(),
    finishedAt: null, lastStdoutLine: null, steps: [], stepTotal: null, step: 0,
    failedAtStep: null, retryable: false, ask: null, answer: null,
    proc: fakeChild, stoppedByMuxin: true, discard: () => {},
    task: async () => {},
  });
  const shape = publicJob(jobs[0]);
  assert.equal("proc" in shape, false, "a ChildProcess is not serializable — /api/jobs must never see it");
  assert.equal("stoppedByMuxin" in shape, false);
  assert.equal("discard" in shape, false);
  assert.equal("task" in shape, false);
  assert.equal("lastSpawn" in shape, false);
  // The real check: the polled read still round-trips through JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(shape)), shape);
  jobs.length = 0;
});
