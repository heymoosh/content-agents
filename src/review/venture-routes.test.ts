// The Venture room's read routes, and the two new venture reads they needed.
//
// Three of these tests are not about "does it return the right shape" at all — they are the
// guarantees the routes exist to hold, and each one caught (or would have caught) a real problem:
//
//   - "a full sweep leaves the venture tree byte-identical" is what surfaced that deriveState()
//     writes state.md and mkdirSync's the venture directory, so a GET for an unknown slug used to
//     CREATE it. That is why computeState()/formatStatusReadOnly() exist.
//   - "no route can leak response content" pins the privacy line at responses.ts:14-15: raw quotes
//     and respondent hashes are gitignored, same treatment as data/analytics.db. Redacted quotes
//     are a deliberate exception — /clusters is built out of them.
//   - the traversal tests pin the slug allowlist. `?slug=../../..` was a real fixed bug here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { handleVentureRead, VENTURE_READ_PATHS, screenStatusText } from "./venture-reads.js";
import { listVentures, ventureRoot } from "../venture/paths.js";
import { INTAKE_QUESTIONS, readIntakeAnswers, kickoffVenture, type IntakeAnswers } from "../venture/intake.js";
import { loadRules } from "../venture/rules.js";
import { appendCanonEvent } from "../venture/canon.js";
import { createArtifact } from "../venture/artifacts.js";

const ROOT_ENV = "CONTENT_AGENTS_TEST_VENTURE_ROOT";

/** Run `fn` against an empty throwaway venture root, then delete it. */
function withRoot<T>(fn: (root: string) => T): T {
  const before = process.env[ROOT_ENV];
  const root = mkdtempSync(join(tmpdir(), "venture-routes-test-"));
  process.env[ROOT_ENV] = root;
  try {
    return fn(root);
  } finally {
    if (before === undefined) delete process.env[ROOT_ENV];
    else process.env[ROOT_ENV] = before;
    rmSync(root, { recursive: true, force: true });
  }
}

/** Read against the REAL repo venture/ tree (for the tracked zz-test-* fixtures). */
function withRealRoot<T>(fn: () => T): T {
  const before = process.env[ROOT_ENV];
  delete process.env[ROOT_ENV];
  try {
    return fn();
  } finally {
    if (before !== undefined) process.env[ROOT_ENV] = before;
  }
}

function get(path: string) {
  const r = handleVentureRead("GET", path);
  assert.ok(r, `no venture read matched ${path}`);
  return r;
}

function body(path: string): Record<string, unknown> {
  return get(path).body as Record<string, unknown>;
}

// Content hash + size + mtime for every file under a directory. Comparing this around a request
// sweep is the honest version of "the working tree is clean": the tests run in a temp root, so
// `git status` would prove nothing about them.
function snapshotTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        out.push(`dir ${relative(root, p)}`);
        walk(p);
      } else {
        const st = statSync(p);
        const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
        out.push(`file ${relative(root, p)} ${st.size} ${st.mtimeMs} ${sha}`);
      }
    }
  };
  walk(root);
  return out;
}

// --- seeding -------------------------------------------------------------------------------------

// Three sentinels that must be told apart by the privacy test. exact_quote and respondent_hash may
// never appear in any route's output; redacted_quote legitimately may, but only via /clusters.
const EXACT_SENTINEL = "EXACTQUOTESENTINEL-do-not-leak";
const HASH_SENTINEL = "RESPONDENTHASHSENTINEL-do-not-leak";
const REDACTED_SENTINEL = "REDACTEDQUOTESENTINEL-safe-to-show";

function seedVenture(root: string, slug: string): string {
  const dir = join(root, slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function seedResponses(dir: string, count: number): void {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(
      JSON.stringify({
        response_id: `r-${i}`,
        source: "survey",
        received_at: "2026-08-01T00:00:00.000Z",
        respondent_hash: `${HASH_SENTINEL}-${i}`,
        target_audience_eligible: true,
        exact_quote: `${EXACT_SENTINEL}-${i}`,
        redacted_quote: `${REDACTED_SENTINEL}-${i}`,
        stuck_point: "stuck point",
        desired_outcome: null,
        emotional_intensity: "high",
        cluster_id: null,
        included_in_gate: true,
        exclusion_reason: null,
      })
    );
  }
  writeFileSync(join(dir, "responses.jsonl"), lines.join("\n") + "\n");
}

// The gate and cluster panels only render from Phase 3, and current_phase is derived from cleared
// checkpoints -- so a test that wants either has to walk the venture there through canon, the same
// way a real run would.
function reachPhase3(dir: string, slug: string): void {
  appendCanonEvent(slug, "checkpoint-cleared", `${slug}/checkpoint-1`, {}, "2026-08-02T00:00:00.000Z");
  appendCanonEvent(slug, "checkpoint-cleared", `${slug}/checkpoint-2`, {}, "2026-08-02T00:00:00.000Z");
  void dir;
}

function fullAnswers(): IntakeAnswers {
  const a: IntakeAnswers = {};
  for (const q of INTAKE_QUESTIONS) a[q.id] = `answer for ${q.id}`;
  return a;
}

function kickoff(slug: string, answers: IntakeAnswers): void {
  kickoffVenture({
    slug,
    answers,
    voice: {
      writing_samples: ["a sample"],
      worldview_statement: "a worldview",
      natural_phrases: ["a phrase"],
      refused_phrases_tones: ["a refused tone"],
    },
    scorecard: {
      required_live_posts: 3,
      ongoing_pace: "3 a week",
      views_or_clicks_target: "learning_only",
      opt_in_target: "learning_only",
      response_quality_test: "specific and unprompted",
      sustainability_test: "still enjoyable at day 14",
    },
    rules: loadRules(),
    at: "2026-08-01T00:00:00.000Z",
  });
}

// --- listVentures --------------------------------------------------------------------------------

test("listVentures returns [] on an empty tree, and slug-sorted directories once ventures exist", () => {
  withRoot((root) => {
    assert.deepEqual(listVentures(), []);
    seedVenture(root, "zeta");
    seedVenture(root, "alpha");
    writeFileSync(join(root, "rules.yaml"), "not a venture\n"); // a file, not a directory
    mkdirSync(join(root, ".DS_Store_dir"));
    assert.deepEqual(listVentures(), ["alpha", "zeta"]);
  });
});

test("listVentures never creates the venture root it was asked about", () => {
  withRoot((root) => {
    const missing = join(root, "nested", "gone");
    process.env[ROOT_ENV] = missing;
    assert.deepEqual(listVentures(), []);
    assert.equal(ventureRoot(), missing);
    assert.deepEqual(readdirSync(root), []);
  });
});

test("GET /api/venture/list answers with the slugs", () => {
  withRoot((root) => {
    seedVenture(root, "one");
    seedVenture(root, "two");
    const b = body("/api/venture/list");
    assert.equal(b.ok, true);
    assert.deepEqual(b.ventures, ["one", "two"]);
  });
});

// --- readIntakeAnswers ---------------------------------------------------------------------------

test("readIntakeAnswers rounds every one of the 25 answers back, verbatim", () => {
  withRoot((root) => {
    const answers: IntakeAnswers = {};
    for (const q of INTAKE_QUESTIONS) answers[q.id] = `verbatim ${q.id}: **bold** and ## hash and (parens?)`;
    // A multi-line answer, and one that repeats an earlier question's exact wording — both are
    // things a line-matching or naive-regex parser gets wrong.
    answers.q7 = "first line\n\nsecond paragraph\n- a bullet";
    answers.q9 = `she said "${INTAKE_QUESTIONS[0].question}" back to me`;
    seedVenture(root, "roundtrip");
    kickoff("roundtrip", answers);

    const back = readIntakeAnswers("roundtrip");
    assert.ok(back);
    assert.equal(Object.keys(back).length, 25);
    for (const q of INTAKE_QUESTIONS) assert.equal(back[q.id], answers[q.id], `${q.id} did not round-trip`);
  });
});

test("readIntakeAnswers is undefined when there is no intake yet, not a map of blanks", () => {
  withRoot((root) => {
    seedVenture(root, "no-intake");
    assert.equal(readIntakeAnswers("no-intake"), undefined);
    // No transcript panel at all, rather than 25 blank rows. (The dedicated /intake/answers route
    // is gone; the answers reach the room only inside the thread now.)
    const thread = body("/api/venture/no-intake/thread").thread as { messages: { kind: string }[] };
    assert.equal(thread.messages.filter((m) => m.kind === "quotes").length, 0);
  });
});

test("readIntakeAnswers is undefined for a file that is not in renderIntakeMd's format", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "hand-written");
    writeFileSync(join(dir, "intake.md"), "# Intake\n\nsomeone typed notes here instead\n");
    assert.equal(readIntakeAnswers("hand-written"), undefined);
  });
});

test("readIntakeAnswers parses the tracked zz-test-phase4 fixture", () => {
  withRealRoot(() => {
    const back = readIntakeAnswers("zz-test-phase4");
    assert.ok(back, "venture/zz-test-phase4/intake.md should parse");
    assert.equal(Object.keys(back).length, 25);
    assert.equal(back.q1, "answer to q1");
    assert.equal(back.q18, "answer to q18"); // the platform read the room needs
    assert.equal(back.q25, "answer to q25"); // bounded by "## Voice evidence", not by a next marker
  });
});

// --- the routes ----------------------------------------------------------------------------------

// Everything the eight deleted routes returned still has to reach the room, so each one's content
// is re-asserted here as a property of the thread rather than of its own URL.
test("the thread carries what the eight deleted routes used to return", () => {
  withRoot((root) => {
    seedVenture(root, "full");
    kickoff("full", fullAnswers());

    const b = body("/api/venture/full/thread");
    assert.equal(b.ok, true);
    const t = b.thread as {
      slug: string; phase: number; statusText: string; elapsedDays: number | null;
      messages: { kind: string; text?: string; lines?: { answer: string }[] }[];
      refs: { name: string; stamp: string }[];
    };
    // ...state + status
    assert.equal(t.slug, "full");
    assert.equal(t.phase, 1);
    assert.match(t.statusText, /^full: Phase 1/);
    assert.ok(!t.statusText.includes(" -- "), "status text must not keep a double hyphen where an em dash was stripped");
    assert.equal(screenStatusText("zz-test-phase2 -- Phase 2"), "zz-test-phase2: Phase 2");
    assert.equal(
      screenStatusText("recorded -- ready to clear Checkpoint 1."),
      "recorded: ready to clear Checkpoint 1.",
    );
    // ...canon
    assert.equal(t.messages.filter((m) => m.kind === "receipt").length, 1);
    // ...artifacts and decisions: nothing drafted yet, so no cards and no choice panels
    assert.equal(t.messages.filter((m) => m.kind === "card" || m.kind === "choice").length, 0);
    // ...rules_version, on the thread's own refs
    assert.ok(t.refs.some((r) => r.stamp === loadRules().rules_version));
    // ...intake answers, in the quotes panel
    const quotes = t.messages.find((m) => m.kind === "quotes");
    assert.ok(quotes?.lines?.length === 25);
    assert.equal(quotes.lines[0].answer, "answer for q1");
  });
});

test("the eight granular reads are still gone, and the rest 404 like any unknown path", () => {
  withRoot((root) => {
    seedVenture(root, "full");
    for (const gone of ["state", "artifacts", "decisions", "canon", "gate", "clusters", "rules", "intake/answers"]) {
      assert.equal(handleVentureRead("GET", `/api/venture/full/${gone}`), null, `${gone} should no longer be a route`);
    }
    // Five now: the canonical document index/read pair joins the thread and artifact-body read.
    // editor needs ONE artifact's text, and the thread does not inline body files. Everything the
    // deleted eight returned is still inside the thread, which is what this list is guarding.
    assert.deepEqual(VENTURE_READ_PATHS, [
      "/api/venture/list",
      "/api/venture/:slug/documents",
      "/api/venture/:slug/thread",
      "/api/venture/:slug/artifacts/:id/body",
      "/api/venture/:slug/documents/:id",
    ]);
  });
});

test("a venture with nothing recorded yet answers 200 with an honest empty thread, not 404", () => {
  withRoot((root) => {
    seedVenture(root, "brand-new");
    const r = get("/api/venture/brand-new/thread");
    assert.equal(r.status, 200);
    const t = (r.body as { thread: { messages: { kind: string }[]; rail: unknown[] } }).thread;
    // No receipts, no cards, no transcript, no clusters -- just where the venture is.
    assert.deepEqual(t.messages.map((m) => m.kind), ["rail", "said", "rail", "checkpoint"]);
    assert.deepEqual(t.rail, []);
  });
});

test("the canonical document index exposes expected phase documents with honest missing, empty, and ready states", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "library");
    createArtifact("library", loadRules(), {
      artifact_id: "p1-research-plan", phase: 1, artifact_kind: "phase_1_research_plan",
      title: "Phase 1 research plan", fields: { confirmed_knowns: [{ claim: "A durable finding" }] },
      venture_id: "library", venture_phase: 1, message_id: "p1-research-plan", at: "2026-08-20T00:00:00.000Z",
    });
    createArtifact("library", loadRules(), {
      artifact_id: "p4-operating-plan", phase: 4, artifact_kind: "daily-operating-plan",
      title: "Daily operating plan", body_path: "phase-4-operations/p4-operating-plan.md",
      venture_id: "library", venture_phase: 4, message_id: "p4-operating-plan", at: "2026-08-20T00:00:00.000Z",
    });
    mkdirSync(join(dir, "phase-4-operations"), { recursive: true });
    writeFileSync(join(dir, "phase-4-operations", "p4-operating-plan.md"), "");
    writeFileSync(join(dir, "cluster-analysis.json"), JSON.stringify({ analyzed_at: "2026-08-20", clusters: [] }));

    const r = get("/api/venture/library/documents");
    assert.equal(r.status, 200);
    const docs = (r.body as { documents: Array<{ id: string; phase: number; title: string; path: string; state: string }> }).documents;
    assert.deepEqual(docs.map((d) => d.id), [
      "research-plan", "research-read", "cluster-analysis", "transformation", "product-outline",
      "price-decision", "operating-plan", "day-14-review",
    ]);
    assert.deepEqual(docs.find((d) => d.id === "research-plan"), {
      id: "research-plan", phase: 1, title: "Research plan and confirmed knowns", path: "artifacts.jsonl", state: "ready",
    });
    assert.equal(docs.find((d) => d.id === "research-read")?.state, "missing");
    assert.equal(docs.find((d) => d.id === "cluster-analysis")?.state, "ready");
    assert.equal(docs.find((d) => d.id === "operating-plan")?.state, "empty");
  });
});

test("a canonical document read returns content from its durable backing file", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "readable");
    createArtifact("readable", loadRules(), {
      artifact_id: "p3-product-outline", phase: 3, artifact_kind: "product-outline", title: "Product outline",
      body_path: "phase-3-offer/p3-product-outline.md", venture_id: "readable", venture_phase: 3,
      message_id: "p3-product-outline", at: "2026-08-20T00:00:00.000Z",
    });
    mkdirSync(join(dir, "phase-3-offer"), { recursive: true });
    writeFileSync(join(dir, "phase-3-offer", "p3-product-outline.md"), "# The actual outline\n\nDurable words.\n");

    const r = get("/api/venture/readable/documents/product-outline");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      ok: true,
      document: {
        id: "product-outline", phase: 3, title: "Product outline",
        path: "phase-3-offer/p3-product-outline.md", state: "ready",
        content: "# The actual outline\n\nDurable words.\n",
      },
    });
  });
});

test("canonical document reads refuse unknown ids and body paths that escape the venture", () => {
  withRoot((root) => {
    seedVenture(root, "safe");
    createArtifact("safe", loadRules(), {
      artifact_id: "p3-product-outline", phase: 3, artifact_kind: "product-outline", title: "Product outline",
      body_path: "../outside.md", venture_id: "safe", venture_phase: 3, message_id: "p3-product-outline",
      at: "2026-08-20T00:00:00.000Z",
    });
    writeFileSync(join(root, "outside.md"), "must not escape");
    assert.equal(get("/api/venture/safe/documents/not-a-document").status, 404);
    const escaped = get("/api/venture/safe/documents/product-outline");
    assert.equal(escaped.status, 400);
    assert.match((escaped.body as { error: string }).error, /outside venture directory/);
  });
});

test("canonical document reads refuse an in-venture symlink whose target escapes the venture", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "symlinked");
    const outside = join(root, "outside-secret.md");
    writeFileSync(outside, "must not escape through a symlink");
    mkdirSync(join(dir, "phase-3-offer"), { recursive: true });
    symlinkSync(outside, join(dir, "phase-3-offer", "p3-product-outline.md"));
    createArtifact("symlinked", loadRules(), {
      artifact_id: "p3-product-outline", phase: 3, artifact_kind: "product-outline", title: "Product outline",
      body_path: "phase-3-offer/p3-product-outline.md", venture_id: "symlinked", venture_phase: 3,
      message_id: "p3-product-outline", at: "2026-08-20T00:00:00.000Z",
    });

    const escaped = get("/api/venture/symlinked/documents/product-outline");
    assert.equal(escaped.status, 400);
    assert.match((escaped.body as { error: string }).error, /outside venture directory/);
    assert.ok(!JSON.stringify(escaped.body).includes("must not escape through a symlink"));
  });
});

test("one escaping document stays row-local in the index and does not hide healthy catalog rows", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "partly-corrupt");
    const outside = join(root, "outside-secret.md");
    writeFileSync(outside, "must not leak into the document index");
    mkdirSync(join(dir, "phase-3-offer"), { recursive: true });
    symlinkSync(outside, join(dir, "phase-3-offer", "p3-product-outline.md"));
    createArtifact("partly-corrupt", loadRules(), {
      artifact_id: "p3-product-outline", phase: 3, artifact_kind: "product-outline", title: "Product outline",
      body_path: "phase-3-offer/p3-product-outline.md", venture_id: "partly-corrupt", venture_phase: 3,
      message_id: "p3-product-outline", at: "2026-08-20T00:00:00.000Z",
    });

    const index = get("/api/venture/partly-corrupt/documents");
    assert.equal(index.status, 200);
    const docs = (index.body as { documents: Array<{ id: string; state: string; error?: string }> }).documents;
    assert.equal(docs.length, 8);
    assert.equal(docs.find((d) => d.id === "product-outline")?.state, "unavailable");
    assert.equal(docs.find((d) => d.id === "research-plan")?.state, "missing");
    assert.match(docs.find((d) => d.id === "product-outline")?.error ?? "", /outside venture directory/);
    assert.ok(!JSON.stringify(index.body).includes("must not leak into the document index"));
  });
});

test("an unknown slug 404s, distinct from a known slug with no data", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "exists");
    // The parameterized read needs a real id to be 200 on, so the venture gets one artifact with a
    // body file. The point of the test is unchanged: an unknown SLUG must 404 on every read, and a
    // known one must not, whichever kind of read it is.
    createArtifact("exists", loadRules(), {
      artifact_id: "a-1", phase: 1, artifact_kind: "text-post-note", title: "t",
      body_path: "phase-1-attention/a-1.md", venture_id: "exists", venture_phase: 1, message_id: "m",
      at: "2026-08-20T00:00:00.000Z",
    });
    mkdirSync(join(dir, "phase-1-attention"), { recursive: true });
    writeFileSync(join(dir, "phase-1-attention", "a-1.md"), "the drafted words\n");

    for (const path of VENTURE_READ_PATHS.filter((p) => p.includes(":slug"))) {
      const tail = path.replace("/api/venture/:slug/", "").replace(":id", path.includes("documents") ? "product-outline" : "a-1");
      const unknown = get(`/api/venture/never-made/${tail}`);
      assert.equal(unknown.status, 404, `${tail} should 404 for an unknown slug`);
      assert.equal((unknown.body as { ok: boolean }).ok, false);
      assert.equal(get(`/api/venture/exists/${tail}`).status, 200, `${tail} should be 200 for a known slug`);
    }
  });
});

test("a 404 for an unknown slug does not bring that venture into existence", () => {
  withRoot((root) => {
    assert.equal(get("/api/venture/ghost/thread").status, 404);
    assert.deepEqual(readdirSync(root), []);
  });
});

test("the dispatcher declines anything that is not one of its reads", () => {
  assert.equal(handleVentureRead("POST", "/api/venture/x/state"), null); // writes are a later PR
  assert.equal(handleVentureRead("GET", "/api/venture/x/intake/drafts"), null); // intake-draft's own route
  assert.equal(handleVentureRead("GET", "/api/venture/x/intake/3/draft"), null);
  assert.equal(handleVentureRead("GET", "/api/venture/x/approve"), null);
  assert.equal(handleVentureRead("GET", "/api/jobs"), null);
  assert.equal(handleVentureRead("GET", "/api/venture/x"), null);
});

// --- slug safety ---------------------------------------------------------------------------------

test("a single-segment bad slug is refused by name, before it reaches the filesystem", () => {
  withRoot(() => {
    for (const bad of ["..", ".", "%2e%2e", "%2e%2e%2f%2e%2e", ".hidden", "-leading", "_leading", "Upper", "a b", "a.b", "a%2fb"]) {
      const r = get(`/api/venture/${bad}/thread`);
      assert.equal(r.status, 400, `slug ${JSON.stringify(bad)} should be refused`);
      assert.equal((r.body as { error: string }).error, "bad venture slug");
    }
  });
});

test("a multi-segment traversal matches no read at all — it can never be answered", () => {
  withRoot(() => {
    for (const bad of ["../..", "../../..", "a/../..", "../../../etc"]) {
      // The slug is one path segment by construction, so this cannot even present as a slug.
      assert.equal(handleVentureRead("GET", `/api/venture/${bad}/thread`), null, `${bad} should match nothing`);
    }
  });
});

test("a traversal is never answered from a venture outside the root", () => {
  withRoot((root) => {
    // A real venture one level up from the configured root: reachable only if the guard leaks.
    const inner = join(root, "inner");
    mkdirSync(inner, { recursive: true });
    seedVenture(root, "secret");
    process.env[ROOT_ENV] = inner;
    const escape = relative(inner, join(root, "secret")); // "../secret"
    const r = handleVentureRead("GET", `/api/venture/${escape}/thread`);
    assert.ok(r === null || r.status >= 400, "a path that escapes the venture root must never be answered");
  });
});

// --- privacy ---------------------------------------------------------------------------------

// The gate panel replaces the /gate route. It still carries counts and only counts: the panel's own
// key list is asserted in venture-thread.test.ts, and the leak sweep below covers the content half.
function gatePanel(slug: string): { have: number; need: number; opened: boolean } | undefined {
  const t = body(`/api/venture/${slug}/thread`).thread as { messages: { kind: string; have?: number; need?: number; opened?: boolean }[] };
  const g = t.messages.find((m) => m.kind === "gate");
  return g as { have: number; need: number; opened: boolean } | undefined;
}

test("the gate panel counts eligible people, and a venture with none reports a measured zero", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "gated");
    kickoff("gated", fullAnswers());
    reachPhase3(dir, "gated");
    seedResponses(dir, 4);
    assert.equal(gatePanel("gated")?.have, 4); // measured, not "some"

    const quiet = seedVenture(root, "quiet");
    kickoff("quiet", fullAnswers());
    reachPhase3(quiet, "quiet");
    assert.deepEqual({ have: gatePanel("quiet")?.have, opened: gatePanel("quiet")?.opened }, { have: 0, opened: false });
  });
});

test("no route can leak a raw quote or a respondent hash", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "private");
    seedResponses(dir, 25);
    kickoff("private", fullAnswers());
    writeFileSync(
      join(dir, "cluster-analysis.json"),
      JSON.stringify({
        analyzed_at: "2026-08-02T00:00:00.000Z",
        clusters: [{ cluster_id: "c1", label: "a problem", evidence: [`${REDACTED_SENTINEL}-0`], stuck_point: "s", desired_outcome: null, visible_consequences: null }],
      })
    );

    const seen: Record<string, string> = { "/api/venture/list": JSON.stringify(body("/api/venture/list")) };
    for (const path of VENTURE_READ_PATHS.filter((p) => p.includes(":slug"))) {
      const real = path.replace(":slug", "private");
      seen[real] = JSON.stringify(body(real));
    }

    for (const [path, text] of Object.entries(seen)) {
      assert.ok(!text.includes(EXACT_SENTINEL), `${path} leaked a raw quote`);
      assert.ok(!text.includes(HASH_SENTINEL), `${path} leaked a respondent hash`);
    }
    // The redacted quote is the deliberate exception, and it reaches exactly two routes: /clusters,
    // and /thread once the venture is far enough along to render the problem panel (the thread
    // composes the same cluster read). Widened here knowingly rather than left to pass by accident
    // — this venture is Phase 1, so /thread does not carry it yet, and the Phase 3 case is asserted
    // in its own test below.
    // The redacted quote is the deliberate exception and now reaches exactly one route: /thread,
    // once the venture is far enough along to render the problem panel. That case has its own test
    // below; this venture is Phase 1, so nothing here should carry it.
    for (const [path, text] of Object.entries(seen)) {
      assert.ok(!text.includes(REDACTED_SENTINEL), `${path} should not carry response text at all`);
    }
  });
});

test("the thread carries redacted cluster quotes but never a raw one or a respondent hash", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "deep");
    kickoff("deep", fullAnswers());
    seedResponses(dir, 25);
    // Far enough along that the thread renders the problem panel at all.
    writeFileSync(join(dir, "canon.md"), readFileSync(join(dir, "canon.md"), "utf8") +
      `- 2026-08-20T00:00:00.000Z **checkpoint-cleared** \`deep/checkpoint-1\`\n` +
      `- 2026-08-20T00:00:00.000Z **checkpoint-cleared** \`deep/checkpoint-2\`\n`);
    writeFileSync(
      join(dir, "cluster-analysis.json"),
      JSON.stringify({
        analyzed_at: "2026-08-20T00:00:00.000Z",
        clusters: [{ cluster_id: "c1", label: "a problem", count: 3, evidence: [`${REDACTED_SENTINEL}-0`], stuck_point: "s", desired_outcome: null, visible_consequences: null }],
      })
    );

    const thread = JSON.stringify(body("/api/venture/deep/thread"));
    assert.ok(thread.includes(REDACTED_SENTINEL), "the problem panel is built out of the redacted quotes");
    assert.ok(!thread.includes(EXACT_SENTINEL), "the thread leaked a raw quote");
    assert.ok(!thread.includes(HASH_SENTINEL), "the thread leaked a respondent hash");
  });
});

// --- read-only -----------------------------------------------------------------------------------

test("a full sweep of every route leaves the venture tree byte-identical", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "untouched");
    kickoff("untouched", fullAnswers());
    seedResponses(dir, 3);
    seedVenture(root, "second");

    const before = snapshotTree(root);
    for (let pass = 0; pass < 2; pass++) {
      body("/api/venture/list");
      for (const path of VENTURE_READ_PATHS.filter((p) => p.includes(":slug"))) {
        for (const slug of ["untouched", "second", "never-made"]) {
          handleVentureRead("GET", path.replace(":slug", slug));
        }
      }
    }
    assert.deepEqual(snapshotTree(root), before, "a read route wrote to the venture tree");
    // Named explicitly: deriveState()'s state.md cache is the one that used to appear here.
    assert.ok(!before.some((l) => l.includes("state.md")));
    assert.ok(!snapshotTree(root).some((l) => l.includes("state.md")));
  });
});
