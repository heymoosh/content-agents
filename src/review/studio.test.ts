import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  countFutureSlotClaims,
  lastScoutRun,
  charlesNeedsYou,
  ventureNeedsYou,
  buildStudioHome,
  clipOnWord,
  type NeedsYouItem,
  quoteOnce,
} from "./studio.js";
import { jobs } from "./jobs.js";

// Rooms renderStudio's .ny-go click handler opens: special-cased content/outreach/followups,
// otherwise setRoom(room) for the nav buttons (fiction, charles, venture, signals, studio).
const RENDER_STUDIO_ROOMS = new Set([
  "content",
  "outreach",
  "followups",
  "fiction",
  "charles",
  "venture",
  "signals",
  "studio",
]);

const VENTURE_ROOT_ENV = "CONTENT_AGENTS_TEST_VENTURE_ROOT";

function withVentureRoot<T>(fn: (root: string) => T): T {
  const before = process.env[VENTURE_ROOT_ENV];
  const root = mkdtempSync(join(tmpdir(), "studio-venture-"));
  process.env[VENTURE_ROOT_ENV] = root;
  try {
    return fn(root);
  } finally {
    if (before === undefined) delete process.env[VENTURE_ROOT_ENV];
    else process.env[VENTURE_ROOT_ENV] = before;
    rmSync(root, { recursive: true, force: true });
  }
}

function writeCharlesQueue(root: string, rows: { id: string; type: string; file: string; status: string; notes: string }[]): void {
  mkdirSync(join(root, "posts", "one-liners"), { recursive: true });
  for (const r of rows) {
    const abs = join(root, r.file);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, `body of ${r.id}\n`);
  }
  writeFileSync(
    join(root, "review-queue.md"),
    [
      "| id | type | file | status | notes |",
      "|----|------|------|--------|-------|",
      ...rows.map((r) => `| ${r.id} | ${r.type} | ${r.file} | ${r.status} | ${r.notes} |`),
      "",
    ].join("\n"),
  );
}

test("countFutureSlotClaims counts only claims after now, skipping malformed lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-test-"));
  const p = join(dir, "ledger.jsonl");
  try {
    writeFileSync(p, [
      JSON.stringify({ platform: "x", time: "2026-07-20T17:00:00Z" }),
      JSON.stringify({ platform: "bluesky", time: "2026-07-01T17:00:00Z" }),
      "{not json",
      JSON.stringify({ platform: "linkedin", time: "2026-08-01T17:00:00Z" }),
    ].join("\n") + "\n");
    assert.equal(countFutureSlotClaims("2026-07-18T00:00:00Z", p), 2);
    assert.equal(countFutureSlotClaims("2026-07-18T00:00:00Z", join(dir, "missing.jsonl")), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lastScoutRun returns the newest timestamp in the run log", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-test-"));
  const p = join(dir, "run-log.jsonl");
  try {
    writeFileSync(p, [
      JSON.stringify({ timestamp: "2026-07-01T06:00:00Z" }),
      JSON.stringify({ timestamp: "2026-07-10T18:24:19Z" }),
    ].join("\n") + "\n");
    assert.equal(lastScoutRun(p), "2026-07-10T18:24:19Z");
    assert.equal(lastScoutRun(join(dir, "missing.jsonl")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a pending Charles draft produces exactly one needsYou row; approve and discard produce none", () => {
  const pendingRoot = mkdtempSync(join(tmpdir(), "studio-charles-"));
  const settledRoot = mkdtempSync(join(tmpdir(), "studio-charles-"));
  try {
    writeCharlesQueue(pendingRoot, [
      { id: "dapper", type: "one-liner", file: "posts/one-liners/dapper.md", status: "pending", notes: "mood" },
    ]);
    const pending = charlesNeedsYou(pendingRoot);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].room, "charles");
    assert.equal(pending[0].urgent, false);
    assert.match(pending[0].text, /waiting on your yes/);

    writeCharlesQueue(settledRoot, [
      { id: "ok", type: "one-liner", file: "posts/one-liners/ok.md", status: "approve", notes: "" },
      { id: "no", type: "essay", file: "posts/essays/no.md", status: "discard", notes: "" },
    ]);
    assert.deepEqual(charlesNeedsYou(settledRoot), []);
  } finally {
    rmSync(pendingRoot, { recursive: true, force: true });
    rmSync(settledRoot, { recursive: true, force: true });
  }
});

test("a missing Charles directory produces no row and does not throw", () => {
  assert.deepEqual(charlesNeedsYou(join(tmpdir(), "studio-charles-missing-" + Date.now())), []);
});

test("Venture awaiting_user decisions and draft artifacts produce a needsYou row; settled ones do not", () => {
  withVentureRoot((root) => {
    assert.deepEqual(ventureNeedsYou(), []);

    const slug = "studio-test-venture";
    const dir = join(root, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "decisions.jsonl"),
      JSON.stringify({
        decision_id: "p1-platform-01",
        decision_kind: "platform-recommendation",
        rules_version: "test",
        input_refs: [],
        candidates: [{ candidate_id: "substack", label: "Substack", scores: {}, evidence_refs: [], rationale: "" }],
        recommended_candidate_ids: ["substack"],
        selected_candidate_ids: [],
        selected_by: null,
        override_reason: null,
        rationale: null,
        status: "awaiting_user",
        created_at: "2026-08-01T00:00:00Z",
        decided_at: null,
      }) + "\n",
    );
    const withDecision = ventureNeedsYou();
    assert.equal(withDecision.length, 1);
    assert.equal(withDecision[0].room, "venture");
    assert.equal(withDecision[0].urgent, false);
    assert.match(withDecision[0].text, /decision/i);

    writeFileSync(join(dir, "decisions.jsonl"), "");
    writeFileSync(
      join(dir, "artifacts.jsonl"),
      JSON.stringify({
        artifact_id: "p1-essay-01",
        title: "a draft",
        artifact_kind: "substack-post",
        editorial_status: "draft",
        delivery_status: "awaiting_approval",
        delivery_mode: "manual",
        venture_phase: 1,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }) + "\n",
    );
    const withDraft = ventureNeedsYou();
    assert.equal(withDraft.length, 1);
    assert.equal(withDraft[0].room, "venture");
    assert.match(withDraft[0].text, /draft/i);

    writeFileSync(
      join(dir, "artifacts.jsonl"),
      JSON.stringify({
        artifact_id: "p1-essay-01",
        title: "approved",
        artifact_kind: "substack-post",
        editorial_status: "approved",
        delivery_status: "ready",
        delivery_mode: "manual",
        venture_phase: 1,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }) + "\n",
    );
    writeFileSync(
      join(dir, "decisions.jsonl"),
      JSON.stringify({
        decision_id: "p1-platform-01",
        decision_kind: "platform-recommendation",
        rules_version: "test",
        input_refs: [],
        candidates: [],
        recommended_candidate_ids: [],
        selected_candidate_ids: ["substack"],
        selected_by: "muxin",
        override_reason: null,
        rationale: null,
        status: "selected",
        created_at: "2026-08-01T00:00:00Z",
        decided_at: "2026-08-02T00:00:00Z",
      }) + "\n",
    );
    assert.deepEqual(ventureNeedsYou(), []);
  });
});

test("a missing Venture root produces no row and does not throw", () => {
  withVentureRoot((root) => {
    // Point at a path under the temp root that was never created.
    process.env[VENTURE_ROOT_ENV] = join(root, "does-not-exist");
    assert.deepEqual(ventureNeedsYou(), []);
  });
});

test("every needsYou room from buildStudioHome is one renderStudio dispatches", async () => {
  const home = await buildStudioHome();
  for (const row of home.needsYou) {
    assert.ok(RENDER_STUDIO_ROOMS.has(row.room), `unhandled room key: ${row.room}`);
  }
});

test("no needsYou text contains an em dash or emoji", async () => {
  const pendingRoot = mkdtempSync(join(tmpdir(), "studio-charles-"));
  try {
    writeCharlesQueue(pendingRoot, [
      { id: "dapper", type: "one-liner", file: "posts/one-liners/dapper.md", status: "pending", notes: "" },
    ]);
    const rows: NeedsYouItem[] = [
      ...charlesNeedsYou(pendingRoot),
      ...(withVentureRoot((root) => {
        const dir = join(root, "v");
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "decisions.jsonl"),
          JSON.stringify({
            decision_id: "d1",
            decision_kind: "platform-recommendation",
            rules_version: "t",
            input_refs: [],
            candidates: [],
            recommended_candidate_ids: [],
            selected_candidate_ids: [],
            selected_by: null,
            override_reason: null,
            rationale: null,
            status: "awaiting_user",
            created_at: "2026-08-01T00:00:00Z",
            decided_at: null,
          }) + "\n",
        );
        return ventureNeedsYou();
      })),
      ...(await buildStudioHome()).needsYou,
    ];
    for (const row of rows) {
      for (const field of [row.text, row.detail, row.label, row.action] as string[]) {
        assert.ok(!/\u2014/.test(field), `em dash in ${JSON.stringify(field)}`);
        assert.ok(!/\p{Extended_Pictographic}/u.test(field), `emoji in ${JSON.stringify(field)}`);
      }
    }
  } finally {
    rmSync(pendingRoot, { recursive: true, force: true });
  }
});

test("Fiction is deliberately absent from needsYou (no durable waiting-on-her state in fiction.ts)", async () => {
  const home = await buildStudioHome();
  assert.equal(home.needsYou.filter((n) => (n.room as string) === "fiction").length, 0);
});

test("clipOnWord: cuts on a word boundary with a single ellipsis, not mid-word", () => {
  assert.equal(clipOnWord("short", 90), "short");
  assert.equal(clipOnWord("", 90), "");
  const long = "a strong general information architecture across all 68 contested contests in the region";
  const clipped = clipOnWord(long, 40);
  assert.equal(clipped, "a strong general information…");
  assert.ok(!clipped.includes("..."), "must use a single ellipsis character, not three periods");
  const mid = clipOnWord("across all 68 contested contests tomorrow", 28);
  assert.equal(mid, "across all 68 contested…");
  assert.ok(!mid.includes("con…") && !mid.includes("contested con"), mid);
});

test("a running job with null elapsedMs does not invent 0m 00s; a measured one still shows the clock", async () => {
  jobs.length = 0;
  try {
    jobs.push({
      id: "studio-elapsed-null",
      kind: "text",
      label: "FIXTURE: unmeasured run",
      arg: "x",
      status: "running",
      slugs: [],
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      lastStdoutLine: null,
      steps: [],
      stepTotal: null,
      step: 0,
      failedAtStep: null,
      retryable: false,
      ask: null,
      answer: null,
    });
    const unmeasured = await buildStudioHome();
    const unmeasuredLine = unmeasured.team.find((t) => t.state === "working")?.line ?? "";
    assert.match(unmeasuredLine, /FIXTURE: unmeasured run/);
    assert.ok(!unmeasuredLine.includes("0m 00s"), "null elapsed must not render as a zero clock");
    assert.match(unmeasuredLine, /started, time not measured yet/);

    jobs.length = 0;
    jobs.push({
      id: "studio-elapsed-real",
      kind: "text",
      label: "FIXTURE: measured run",
      arg: "x",
      status: "running",
      slugs: [],
      error: null,
      createdAt: Date.now(),
      startedAt: Date.now() - 185_000,
      finishedAt: null,
      lastStdoutLine: null,
      steps: [],
      stepTotal: null,
      step: 0,
      failedAtStep: null,
      retryable: false,
      ask: null,
      answer: null,
    });
    const measured = await buildStudioHome();
    const measuredLine = measured.team.find((t) => t.state === "working")?.line ?? "";
    assert.match(measuredLine, /FIXTURE: measured run · 3m 05s/);
  } finally {
    jobs.length = 0;
  }
});

// A Substack note's title usually arrives already wrapped in quotes, and the Content needs-you row
// wrapped it again: From """Why do we seem to fear AI more than we fear power?""".
test("quoteOnce wraps a title in exactly one pair of quotes", () => {
  assert.equal(quoteOnce("A plain title"), '"A plain title"');
  assert.equal(quoteOnce('"Already quoted"'), '"Already quoted"');
  assert.equal(quoteOnce("“Curly quoted”"), '"Curly quoted"');
  assert.equal(quoteOnce('  "Padded"  '), '"Padded"');
  assert.equal(quoteOnce('""Doubled""'), '"Doubled"');
  assert.equal(quoteOnce('He said "no" out loud'), '"He said "no" out loud"');
});

test("clipOnWord repairs a flattened em dash and never cuts mid-word", () => {
  assert.equal(clipOnWord("Upworthy, ex-MoveOn.org -- the strongest connection", 200),
    "Upworthy, ex-MoveOn.org: the strongest connection");
  assert.equal(clipOnWord("a hyphenated-word stays whole", 200), "a hyphenated-word stays whole");
  const clipped = clipOnWord("Building FundingPath.ai for non-dilutive capital and grants", 30);
  assert.ok(clipped.endsWith("…"), `expected an ellipsis, got ${clipped}`);
  assert.ok(!/\w…$/.test(clipped.replace(/\s\S*…$/, "")), "must not cut mid-word");
  assert.ok(clipped.length <= 32, `too long: ${clipped}`);
});
