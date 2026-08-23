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
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { handleVentureRead, VENTURE_READ_PATHS } from "./venture-reads.js";
import { listVentures, ventureRoot } from "../venture/paths.js";
import { INTAKE_QUESTIONS, readIntakeAnswers, kickoffVenture, type IntakeAnswers } from "../venture/intake.js";
import { loadRules } from "../venture/rules.js";

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
    const b = body("/api/venture/no-intake/intake/answers");
    assert.equal(b.ok, true);
    assert.equal(b.answers, null); // "never interviewed", distinct from "answered with nothing"
    assert.equal((b.questions as unknown[]).length, 25);
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

test("every read route answers a seeded venture", () => {
  withRoot((root) => {
    seedVenture(root, "full");
    kickoff("full", fullAnswers());

    const state = body("/api/venture/full/state");
    assert.equal(state.ok, true);
    assert.equal((state.state as { slug: string }).slug, "full");
    assert.equal((state.state as { current_phase: number }).current_phase, 1);
    assert.match(String(state.status), /^full -- Phase 1/);

    assert.deepEqual(body("/api/venture/full/artifacts").artifacts, []);
    assert.deepEqual(body("/api/venture/full/decisions").decisions, []);

    const canon = body("/api/venture/full/canon").events as { type: string }[];
    assert.equal(canon.length, 1);
    assert.equal(canon[0].type, "kickoff");

    const rules = body("/api/venture/full/rules");
    const real = loadRules();
    assert.equal(rules.rules_version, real.rules_version);
    assert.deepEqual(rules.sources, {
      starter_kit_sha256: real.sources.starter_kit_sha256,
      welsh_note_sha256: real.sources.welsh_note_sha256,
    });
    // The trimmed shape only — never the whole rubric.
    assert.deepEqual(Object.keys(rules).sort(), ["ok", "rules_version", "sources"]);

    const answers = body("/api/venture/full/intake/answers").answers as IntakeAnswers;
    assert.equal(answers.q1, "answer for q1");
  });
});

test("a venture with nothing recorded yet answers 200 with honest empties, not 404", () => {
  withRoot((root) => {
    seedVenture(root, "brand-new");
    for (const path of ["artifacts", "decisions", "canon"]) {
      const r = get(`/api/venture/brand-new/${path}`);
      assert.equal(r.status, 200, `${path} should be 200`);
    }
    assert.deepEqual(body("/api/venture/brand-new/artifacts").artifacts, []);
    assert.deepEqual(body("/api/venture/brand-new/canon").events, []);
    assert.equal(body("/api/venture/brand-new/clusters").clusters, null);
  });
});

test("an unknown slug 404s, distinct from a known slug with no data", () => {
  withRoot((root) => {
    seedVenture(root, "exists");
    for (const path of VENTURE_READ_PATHS.filter((p) => p.includes(":slug"))) {
      const tail = path.replace("/api/venture/:slug/", "");
      const unknown = get(`/api/venture/never-made/${tail}`);
      assert.equal(unknown.status, 404, `${tail} should 404 for an unknown slug`);
      assert.equal((unknown.body as { ok: boolean }).ok, false);
      assert.equal(get(`/api/venture/exists/${tail}`).status, 200, `${tail} should be 200 for a known slug`);
    }
  });
});

test("a 404 for an unknown slug does not bring that venture into existence", () => {
  withRoot((root) => {
    assert.equal(get("/api/venture/ghost/state").status, 404);
    assert.equal(get("/api/venture/ghost/artifacts").status, 404);
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
      const r = get(`/api/venture/${bad}/state`);
      assert.equal(r.status, 400, `slug ${JSON.stringify(bad)} should be refused`);
      assert.equal((r.body as { error: string }).error, "bad venture slug");
    }
  });
});

test("a multi-segment traversal matches no read at all — it can never be answered", () => {
  withRoot(() => {
    for (const bad of ["../..", "../../..", "a/../..", "../../../etc"]) {
      // The slug is one path segment by construction, so this cannot even present as a slug.
      assert.equal(handleVentureRead("GET", `/api/venture/${bad}/state`), null, `${bad} should match nothing`);
      assert.equal(handleVentureRead("GET", `/api/venture/${bad}/canon`), null, `${bad} should match nothing`);
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
    const r = handleVentureRead("GET", `/api/venture/${escape}/canon`);
    assert.ok(r === null || r.status >= 400, "a path that escapes the venture root must never be answered");
  });
});

// --- privacy ---------------------------------------------------------------------------------

test("the gate route returns counts and never a response", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "gated");
    seedResponses(dir, 4);
    const gate = body("/api/venture/gated/gate").gate as Record<string, unknown>;
    assert.deepEqual(Object.keys(gate).sort(), ["have", "need", "opened_at", "state", "target"]);
    assert.equal(gate.have, 4); // measured, not "some"
    assert.equal(gate.state, "closed");
    assert.equal(gate.opened_at, null);
  });
});

test("a venture with zero responses reports have: 0 — a measured zero, not an absence", () => {
  withRoot((root) => {
    seedVenture(root, "quiet");
    const gate = body("/api/venture/quiet/gate").gate as { have: number; state: string };
    assert.equal(gate.have, 0);
    assert.equal(gate.state, "closed");
  });
});

test("/clusters is null before the analysis exists, and passes it through once it does", () => {
  withRoot((root) => {
    const dir = seedVenture(root, "clustered");
    seedResponses(dir, 4);
    assert.equal(body("/api/venture/clustered/clusters").clusters, null);

    writeFileSync(
      join(dir, "cluster-analysis.json"),
      JSON.stringify({
        analyzed_at: "2026-08-02T00:00:00.000Z",
        clusters: [{ cluster_id: "c1", label: "a problem", evidence: [`${REDACTED_SENTINEL}-0`], stuck_point: "s", desired_outcome: null, visible_consequences: null }],
      })
    );
    const clusters = body("/api/venture/clustered/clusters").clusters as { clusters: unknown[] };
    assert.equal(clusters.clusters.length, 1);
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
    const REDACTED_OK = ["/clusters", "/thread"];
    assert.ok(seen["/api/venture/private/clusters"].includes(REDACTED_SENTINEL));
    for (const [path, text] of Object.entries(seen)) {
      if (REDACTED_OK.some((p) => path.endsWith(p))) continue;
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
