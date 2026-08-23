// The Venture room's write routes.
//
// The reads PR asserted "a full sweep changes nothing". These are writes, so the same instrument
// is inverted: each route must change exactly the files it claims and nothing else. That is what
// catches a route that quietly rewrites a cache, creates a directory for a slug nobody has, or
// fires a ledger event nobody asked for.
//
// The other half of these tests is the one rule this module exists to hold: every refusal comes
// from the function that owns the rule, and arrives at the caller word for word. Several of them
// assert the exact sentence, because the sentence is the useful part — it tells Muxin what to
// bring instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { handleVentureWrite, VENTURE_WRITE_PATHS, VENTURE_WRITE_ROUTE_COUNT } from "./venture-writes.js";
import { handleVentureRead } from "./venture-reads.js";
import { createArtifact, readArtifact, transitionArtifact, type VentureArtifact } from "../venture/artifacts.js";
import { writeDecision, readDecision } from "../venture/decisions.js";
import { retractArtifact } from "../venture/artifact-lifecycle.js";
import { readCanonEvents, appendCanonEvent } from "../venture/canon.js";
import { INTAKE_QUESTIONS, kickoffVenture, type IntakeAnswers } from "../venture/intake.js";
import { loadRules } from "../venture/rules.js";
import { saveIntakeDraft, readIntakeDrafts } from "./intake-draft.js";

const ROOT_ENV = "CONTENT_AGENTS_TEST_VENTURE_ROOT";
const AT = "2026-08-20T00:00:00.000Z";

function withRoot<T>(fn: (root: string) => T): T {
  const before = process.env[ROOT_ENV];
  const root = mkdtempSync(join(tmpdir(), "venture-writes-test-"));
  process.env[ROOT_ENV] = root;
  try {
    return fn(root);
  } finally {
    if (before === undefined) delete process.env[ROOT_ENV];
    else process.env[ROOT_ENV] = before;
    rmSync(root, { recursive: true, force: true });
  }
}

function post(path: string, body: Record<string, unknown> = {}) {
  const r = handleVentureWrite("POST", path, body);
  assert.ok(r, `no venture write matched ${path}`);
  return r;
}

function ok(path: string, body: Record<string, unknown> = {}): Record<string, unknown> {
  const r = post(path, body);
  assert.equal(r.status, 200, `expected 200 from ${path}, got ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body as Record<string, unknown>;
}

function refusal(path: string, body: Record<string, unknown> = {}): string {
  const r = post(path, body);
  assert.equal(r.status, 400, `expected a refusal from ${path}, got ${r.status}`);
  return String((r.body as { error: string }).error);
}

/** Every file under a tree, by content hash — for asserting exactly which ones a write touched. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(root, p), createHash("sha256").update(readFileSync(p)).digest("hex"));
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed = new Set<string>();
  for (const [p, h] of after) if (before.get(p) !== h) changed.add(p);
  for (const p of before.keys()) if (!after.has(p)) changed.add(p);
  return [...changed].sort();
}

// --- seeding -------------------------------------------------------------------------------------

const SLUG = "wtest";

function kickoff(slug = SLUG): void {
  const answers: IntakeAnswers = {};
  for (const q of INTAKE_QUESTIONS) answers[q.id] = `answer for ${q.id}`;
  kickoffVenture({
    slug,
    answers,
    voice: { writing_samples: ["s"], worldview_statement: "w", natural_phrases: ["p"], refused_phrases_tones: ["r"] },
    scorecard: {
      required_live_posts: 3,
      ongoing_pace: "3 a week",
      views_or_clicks_target: "learning_only",
      opt_in_target: "learning_only",
      response_quality_test: "specific and unprompted",
      sustainability_test: "still enjoyable",
    },
    rules: loadRules(),
    at: AT,
  });
}

function seedArtifact(id: string, kind: Parameters<typeof createArtifact>[2]["artifact_kind"], slug = SLUG): VentureArtifact {
  return createArtifact(slug, loadRules(), {
    artifact_id: id,
    phase: 1,
    artifact_kind: kind,
    title: `title for ${id}`,
    venture_id: slug,
    venture_phase: 1,
    message_id: `m-${id}`,
    at: AT,
  });
}

/** An artifact carried all the way to live_confirmed, the only state a retract may start from. */
function seedLiveArtifact(id: string, slug = SLUG): VentureArtifact {
  seedArtifact(id, "substack-post", slug);
  ok(`/api/venture/${slug}/artifacts/${id}/approve`);
  transitionArtifact(slug, id, { delivery_status: "handed_off" }, AT);
  ok(`/api/venture/${slug}/artifacts/${id}/confirm-live`, { type: "url", value: "https://example.com/live" });
  return readArtifact(slug, id)!;
}

// --- the dispatcher ------------------------------------------------------------------------------

test("the documented path list and the dispatch table are the same size", () => {
  assert.equal(VENTURE_WRITE_PATHS.length, VENTURE_WRITE_ROUTE_COUNT);
});

test("every documented write path actually reaches a handler", () => {
  withRoot(() => {
    kickoff();
    for (const path of VENTURE_WRITE_PATHS) {
      const concrete = path.replace(":slug", SLUG).replace(":findingId", "f1").replace(":id", "x1");
      assert.ok(handleVentureWrite("POST", concrete, {}) !== null, `${path} matched no route`);
    }
  });
});

test("a GET can never reach a write, and a write path is not a read", () => {
  withRoot(() => {
    kickoff();
    assert.equal(handleVentureWrite("GET", `/api/venture/${SLUG}/artifacts/a1/approve`, {}), null);
    assert.equal(handleVentureRead("GET", `/api/venture/${SLUG}/artifacts/a1/approve`), null);
    assert.equal(handleVentureWrite("POST", `/api/venture/${SLUG}/state`, {}), null);
    assert.equal(handleVentureWrite("POST", "/api/jobs", {}), null);
  });
});

// --- slug and id safety --------------------------------------------------------------------------

test("a bad slug is refused by name, and a bad id with it", () => {
  withRoot(() => {
    kickoff();
    for (const bad of ["..", ".", "%2e%2e", ".hidden", "-lead", "Upper", "a b"]) {
      const r = post(`/api/venture/${bad}/artifacts/a1/approve`);
      assert.equal(r.status, 400);
      assert.equal((r.body as { error: string }).error, "bad venture slug");
    }
    for (const bad of ["..", "%2e%2e", "Upper", "a b"]) {
      const r = post(`/api/venture/${SLUG}/artifacts/${bad}/approve`);
      assert.equal(r.status, 400, `id ${bad} should be refused`);
      assert.match((r.body as { error: string }).error, /^bad id:/);
    }
  });
});

test("a multi-segment traversal matches no write route at all", () => {
  withRoot(() => {
    kickoff();
    for (const bad of ["../..", "a/../.."]) {
      assert.equal(handleVentureWrite("POST", `/api/venture/${bad}/pace`, { postsPerWeek: "3" }), null);
      assert.equal(handleVentureWrite("POST", `/api/venture/${SLUG}/artifacts/${bad}/approve`, {}), null);
    }
  });
});

test("an unknown venture 404s, and asking does not create it", () => {
  withRoot((root) => {
    const r = post("/api/venture/ghost/artifacts/a1/approve");
    assert.equal(r.status, 404);
    assert.deepEqual(readdirSync(root), []);
  });
});

// --- artifact lifecycle --------------------------------------------------------------------------

test("approve lands on the delivery_status the artifact kind actually needs", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a-manual", "substack-post");
    seedArtifact("a-none", "product-outline");

    const manual = ok(`/api/venture/${SLUG}/artifacts/a-manual/approve`).artifact as VentureArtifact;
    assert.equal(manual.editorial_status, "approved");
    assert.equal(manual.delivery_status, "ready");

    // delivery_mode "none" must land on not_applicable or state.ts can never see it as complete.
    const none = ok(`/api/venture/${SLUG}/artifacts/a-none/approve`).artifact as VentureArtifact;
    assert.equal(none.delivery_status, "not_applicable");
  });
});

test("discard and restore round-trip, and discard preserves not_applicable", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a1", "substack-post");
    seedArtifact("a-none", "product-outline");

    const discarded = ok(`/api/venture/${SLUG}/artifacts/a1/discard`).artifact as VentureArtifact;
    assert.equal(discarded.editorial_status, "discarded");
    assert.equal(discarded.delivery_status, "cancelled");
    assert.equal(discarded.retraction, null, "a plain discard is not a retraction");

    const restored = ok(`/api/venture/${SLUG}/artifacts/a1/restore`).artifact as VentureArtifact;
    assert.equal(restored.editorial_status, "draft");
    assert.equal(restored.delivery_status, "awaiting_approval");

    const noneDiscarded = ok(`/api/venture/${SLUG}/artifacts/a-none/discard`).artifact as VentureArtifact;
    assert.equal(noneDiscarded.delivery_status, "not_applicable");
  });
});

test("an unknown artifact is refused, not invented", () => {
  withRoot(() => {
    kickoff();
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/nope/approve`), /no such artifact: nope/);
  });
});

// --- confirm-live --------------------------------------------------------------------------------

test("confirm-live records the proof and moves the artifact to live", () => {
  withRoot(() => {
    kickoff();
    const a = seedLiveArtifact("a-live");
    assert.equal(a.delivery_status, "live_confirmed");
    assert.deepEqual(
      { type: a.evidence?.type, value: a.evidence?.value, by: a.evidence?.confirmed_by },
      { type: "url", value: "https://example.com/live", by: "muxin" }
    );
  });
});

test("a below-floor proof is refused by confirmManualDelivery, and the message says what to bring", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a-url", "substack-post"); // min_evidence: url
    ok(`/api/venture/${SLUG}/artifacts/a-url/approve`);
    transitionArtifact(SLUG, "a-url", { delivery_status: "handed_off" }, AT);

    const msg = refusal(`/api/venture/${SLUG}/artifacts/a-url/confirm-live`, { type: "attestation", value: "I posted it" });
    // Verbatim from deliver.ts -- the second half is the useful part.
    assert.match(msg, /needs "url" evidence -- a attestation cannot stand in for it/);
    assert.match(msg, /a link can be re-checked later, a sentence cannot/);
    assert.equal(readArtifact(SLUG, "a-url")?.delivery_status, "handed_off", "a refused confirm must not move it");
  });
});

test("an empty proof value is refused rather than stored as a blank", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a-url", "substack-post");
    ok(`/api/venture/${SLUG}/artifacts/a-url/approve`);
    transitionArtifact(SLUG, "a-url", { delivery_status: "handed_off" }, AT);
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-url/confirm-live`, { type: "url", value: "   " }), /never confirm on Muxin's behalf/);
  });
});

test("a proof that is neither a link nor an attestation is refused at the route", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a-url", "substack-post");
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-url/confirm-live`, { type: "agent", value: "x" }), /either a live link .* or your own sentence/);
  });
});

// --- retract -------------------------------------------------------------------------------------

test("retract records the takedown WITHOUT erasing the evidence that it was live", () => {
  withRoot(() => {
    kickoff();
    const live = seedLiveArtifact("a-live");

    const a = ok(`/api/venture/${SLUG}/artifacts/a-live/retract`, { attestation: "unpublished it, link is dead" }).artifact as VentureArtifact;
    assert.equal(a.editorial_status, "discarded");
    assert.equal(a.delivery_status, "cancelled"); // venture-schema-contract.md §2.2
    assert.deepEqual(a.evidence, live.evidence, "evidence must survive a retract untouched");
    assert.equal(a.retraction?.attestation, "unpublished it, link is dead");
    assert.equal(a.retraction?.retracted_by, "muxin");
    assert.match(a.retraction?.retracted_at ?? "", /^\d{4}-\d{2}-\d{2}T/);

    const retracted = readCanonEvents(SLUG).filter((e) => e.type === "retracted");
    assert.equal(retracted.length, 1);
    assert.equal(retracted[0].fields.artifact, "a-live");
  });
});

test("only something that actually went out can be retracted", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a-draft", "substack-post");
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-draft/retract`, { attestation: "took it down" }), /not live -- only something that actually went out/);

    ok(`/api/venture/${SLUG}/artifacts/a-draft/approve`);
    ok(`/api/venture/${SLUG}/artifacts/a-draft/discard`);
    // A plain discard is discarded x cancelled too, which is exactly why the from-state has to be
    // checked before the transition rather than left to the state machine.
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-draft/retract`, { attestation: "took it down" }), /not live/);
    assert.equal(readArtifact(SLUG, "a-draft")?.retraction ?? null, null);
  });
});

test("a retraction needs Muxin's own sentence", () => {
  withRoot(() => {
    kickoff();
    seedLiveArtifact("a-live");
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-live/retract`, { attestation: "  " }), /needs your own sentence/);
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a-live/retract`, {}), /needs your own sentence/);
    assert.equal(readArtifact(SLUG, "a-live")?.delivery_status, "live_confirmed");
  });
});

test("a retract does not un-clear a checkpoint that had already cleared on it", () => {
  withRoot(() => {
    kickoff();
    seedLiveArtifact("a-live");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, { complete: "1", required: "1" }, AT);
    const before = readCanonEvents(SLUG).filter((e) => e.id === `${SLUG}/checkpoint-1`);

    ok(`/api/venture/${SLUG}/artifacts/a-live/retract`, { attestation: "taken down" });

    // venture-schema-contract.md §2.1: unwinding a cleared checkpoint automatically would rewrite
    // history the venture was already built on. The retracted event is the record instead.
    assert.deepEqual(readCanonEvents(SLUG).filter((e) => e.id === `${SLUG}/checkpoint-1`), before);
  });
});

test("two genuine takedowns are both recorded, but a retried identical call is not doubled", () => {
  withRoot(() => {
    kickoff();
    seedLiveArtifact("a-live");

    // The retried-identical case: same artifact, same instant -> one ledger event, not two. This
    // is why the event id carries `at` rather than being keyed to the artifact alone.
    retractArtifact(SLUG, "a-live", "down once", "2026-08-21T00:00:00.000Z");
    transitionArtifact(SLUG, "a-live", { delivery_status: "live_confirmed" }, AT); // undo, to retry
    retractArtifact(SLUG, "a-live", "down once", "2026-08-21T00:00:00.000Z");
    assert.equal(readCanonEvents(SLUG).filter((e) => e.type === "retracted").length, 1);

    // A real second cycle: restore, put it live again, take it down again at a different time.
    ok(`/api/venture/${SLUG}/artifacts/a-live/restore`);
    ok(`/api/venture/${SLUG}/artifacts/a-live/approve`);
    transitionArtifact(SLUG, "a-live", { delivery_status: "handed_off" }, AT);
    ok(`/api/venture/${SLUG}/artifacts/a-live/confirm-live`, { type: "url", value: "https://example.com/again" });
    ok(`/api/venture/${SLUG}/artifacts/a-live/retract`, { attestation: "down twice" });

    assert.equal(readCanonEvents(SLUG).filter((e) => e.type === "retracted").length, 2);
  });
});

// --- report failed -------------------------------------------------------------------------------

test("a reported failure carries Muxin's own message and no provider", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a1", "substack-post");
    ok(`/api/venture/${SLUG}/artifacts/a1/approve`);
    const a = ok(`/api/venture/${SLUG}/artifacts/a1/failed`, { message: "substack rejected the paste" }).artifact as VentureArtifact;
    assert.equal(a.delivery_status, "failed");
    assert.equal(a.failure?.provider, null); // venture-schema-contract.md §4.1
    assert.equal(a.failure?.message, "substack rejected the paste");
    assert.equal(a.failure?.retryable, true);
  });
});

test("a failure with no reason is refused, and a never-approved artifact cannot fail", () => {
  withRoot(() => {
    kickoff();
    seedArtifact("a1", "substack-post");
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a1/failed`, { message: "  " }), /say what went wrong/);
    // draft:failed is not a legal pair -- the state machine refuses, not the route.
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/a1/failed`, { message: "it broke" }), /invalid venture artifact transition/);
  });
});

// --- research-read findings ----------------------------------------------------------------------

function seedResearchRead(): void {
  createArtifact(SLUG, loadRules(), {
    artifact_id: "p1-read",
    phase: 1,
    artifact_kind: "phase_1_research_read",
    title: "read",
    fields: {
      findings: [
        { finding_id: "f-emergent", finding_origin: "emergent" },
        { finding_id: "f-planned", finding_origin: "planned" },
      ],
    },
    venture_id: SLUG,
    venture_phase: 1,
    message_id: "m-read",
    at: AT,
  });
}

test("a finding is accepted or rejected, and a non-emergent one is refused", () => {
  withRoot(() => {
    kickoff();
    seedResearchRead();

    const a = ok(`/api/venture/${SLUG}/artifacts/p1-read/findings/f-emergent`, { accepted: true }).artifact as VentureArtifact;
    const findings = a.fields?.findings as { finding_id: string; muxin_confirmed_emergent?: boolean }[];
    assert.equal(findings.find((f) => f.finding_id === "f-emergent")?.muxin_confirmed_emergent, true);

    assert.match(refusal(`/api/venture/${SLUG}/artifacts/p1-read/findings/f-planned`, { accepted: true }), /is not emergent/);
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/p1-read/findings/f-nope`, { accepted: true }), /no such finding/);
    assert.match(refusal(`/api/venture/${SLUG}/artifacts/p1-read/findings/f-emergent`, {}), /accepted as true or false/);
  });
});

// --- checkpoint and pace -------------------------------------------------------------------------

test("a checkpoint that is not ready answers 200 with the reason the screen shows", () => {
  withRoot(() => {
    kickoff();
    const result = ok(`/api/venture/${SLUG}/checkpoint/checkpoint-1/clear`).result as { cleared: boolean; reason?: string };
    assert.equal(result.cleared, false);
    assert.match(result.reason ?? "", /no partial pass/);
  });
});

test("an unknown checkpoint is refused by rules.yaml, naming the ones that exist", () => {
  withRoot(() => {
    kickoff();
    assert.match(refusal(`/api/venture/${SLUG}/checkpoint/checkpoint-9/clear`), /no such checkpoint "checkpoint-9"/);
  });
});

test("pace is recorded as Muxin's own words, and an empty one is refused", () => {
  withRoot(() => {
    kickoff();
    assert.match(refusal(`/api/venture/${SLUG}/pace`, { postsPerWeek: "  " }), /say what pace you can keep/);
    ok(`/api/venture/${SLUG}/pace`, { postsPerWeek: "3 a week" });
    const paceEvent = readCanonEvents(SLUG).find((e) => e.type === "pace-recorded");
    assert.ok(paceEvent);
    assert.equal(paceEvent.fields.per_week, "3");
  });
});

// --- decisions -----------------------------------------------------------------------------------

function seedPlatformDecision(): void {
  writeDecision(SLUG, {
    decision_id: "p1-platform-01",
    decision_kind: "platform-recommendation",
    rules_version: loadRules().rules_version,
    input_refs: ["intake:q18"],
    candidates: [
      { candidate_id: "substack", label: "Substack", scores: {}, evidence_refs: [], rationale: "" },
      { candidate_id: "linkedin", label: "LinkedIn", scores: {}, evidence_refs: [], rationale: "" },
    ],
    recommended_candidate_ids: ["substack"],
    at: AT,
  });
}

test("selecting the recommendation works; overriding it without a reason is refused", () => {
  withRoot(() => {
    kickoff();
    seedPlatformDecision();

    const msg = refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["linkedin"] });
    assert.match(msg, /"linkedin" is not the recommended platform \(recommended: substack\)/);
    assert.match(msg, /so the audit trail records why \(rules\.md §5\.1\)/);
    assert.equal(readDecision(SLUG, "p1-platform-01")?.status, "awaiting_user");

    const d = ok(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["linkedin"], overrideReason: "my audience is there" }).decision as {
      selected_candidate_ids: string[];
      override_reason: string | null;
      status: string;
    };
    assert.deepEqual(d.selected_candidate_ids, ["linkedin"]);
    assert.equal(d.override_reason, "my audience is there");
    assert.equal(d.status, "selected");
  });
});

test("a single-pick decision cannot be slipped past the override rule by sending two ids", () => {
  withRoot(() => {
    kickoff();
    seedPlatformDecision();
    const msg = refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["substack", "linkedin"] });
    assert.match(msg, /single-pick platform decision -- send exactly one candidate, got 2/);
    assert.equal(readDecision(SLUG, "p1-platform-01")?.status, "awaiting_user");
  });
});

test("a candidate that does not exist on the record is refused", () => {
  withRoot(() => {
    kickoff();
    seedPlatformDecision();
    const msg = refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["mastodon"] });
    assert.match(msg, /has no candidate "mastodon"/);
    assert.match(msg, /its candidates are: substack, linkedin/);
  });
});

test("an empty selection is refused, and an unknown decision is not invented", () => {
  withRoot(() => {
    kickoff();
    seedPlatformDecision();
    assert.match(refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: [] }), /send the chosen option/);
    assert.match(refusal(`/api/venture/${SLUG}/decisions/p1-nope/select`, { candidateIds: ["x"] }), /no such decision: p1-nope/);
  });
});

test("the ten-idea decision takes rules.yaml's select count, not one", () => {
  withRoot(() => {
    kickoff();
    const rules = loadRules();
    writeDecision(SLUG, {
      decision_id: "p1-ideas-01",
      decision_kind: "idea-ranking",
      rules_version: rules.rules_version,
      input_refs: [],
      candidates: Array.from({ length: rules.idea_ranking.idea_count }, (_, i) => ({
        candidate_id: `idea-${i}`,
        label: `idea ${i}`,
        scores: {},
        evidence_refs: [],
        rationale: "",
        unknown_id: `u-${i}`,
      })),
      recommended_candidate_ids: [],
      at: AT,
    });
    const want = rules.idea_ranking.select_count;
    assert.match(
      refusal(`/api/venture/${SLUG}/decisions/p1-ideas-01/select`, { candidateIds: ["idea-0"] }),
      new RegExp(`requires exactly ${want} selected candidates, got 1`)
    );
    const ids = Array.from({ length: want }, (_, i) => `idea-${i}`);
    assert.deepEqual((ok(`/api/venture/${SLUG}/decisions/p1-ideas-01/select`, { candidateIds: ids }).decision as { selected_candidate_ids: string[] }).selected_candidate_ids, ids);
  });
});

test("the Day 14 decision keeps all of Phase 4's own rules, not just selectDecision's", () => {
  withRoot(() => {
    kickoff();
    const path = `/api/venture/${SLUG}/decisions/p4-day-14-decision/select`;

    // 1. Phase 4 must be unlocked.
    assert.match(refusal(path, { candidateIds: ["continue"], rationale: "going well" }), /phase-3-completed is not recorded yet/);
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/phase-3-completed`, {}, AT);

    // 2. The review must be approved before she decides.
    assert.match(refusal(path, { candidateIds: ["continue"], rationale: "going well" }), /p4-day-14-review is not approved yet/);
    seedArtifact("p4-day-14-review", "day-14-review");
    ok(`/api/venture/${SLUG}/artifacts/p4-day-14-review/approve`);

    // 3. A reason is required (rules.md §8.5).
    assert.match(refusal(path, { candidateIds: ["continue"] }), /a reason is required/);

    // 4. The candidate must be one of rules.yaml's options.
    assert.match(refusal(path, { candidateIds: ["vibes"], rationale: "why not" }), /not one of the Day 14 decision options/);

    // 5. The record is created lazily, here, by this call.
    assert.equal(readDecision(SLUG, "p4-day-14-decision"), undefined);
    const body = ok(path, { candidateIds: ["continue"], rationale: "clicks beat the target" });
    assert.deepEqual((body.decision as { selected_candidate_ids: string[] }).selected_candidate_ids, ["continue"]);
    assert.equal(typeof body.phase4_complete, "boolean");

    // And it is immutable once made.
    assert.match(refusal(path, { candidateIds: ["stop"], rationale: "changed my mind" }), /already selected/i);
  });
});

// --- intake scratch buffer -----------------------------------------------------------------------

test("clearing the intake drafts works before the venture directory exists", () => {
  withRoot((root) => {
    const draftRoot = mkdtempSync(join(tmpdir(), "venture-drafts-test-"));
    try {
      saveIntakeDraft("not-yet-a-venture", 3, "half a thought", draftRoot);
      assert.equal(readIntakeDrafts("not-yet-a-venture", draftRoot).drafts.length, 1);
      // The route itself: no venture/<slug>/ exists, and it must still be reachable (the interview
      // fills the buffer BEFORE kickoff creates the directory).
      const r = post("/api/venture/not-yet-a-venture/intake/drafts/clear");
      assert.equal(r.status, 200);
      assert.deepEqual(readdirSync(root), [], "clearing drafts must not create a venture");
    } finally {
      rmSync(draftRoot, { recursive: true, force: true });
    }
  });
});

// --- exactly the files each write claims ----------------------------------------------------------

test("each write changes exactly the files it claims, and nothing else", () => {
  withRoot((root) => {
    kickoff();
    seedArtifact("a1", "substack-post");
    seedPlatformDecision();

    const cases: { name: string; run: () => void; expect: string[] }[] = [
      { name: "approve", run: () => ok(`/api/venture/${SLUG}/artifacts/a1/approve`), expect: [`${SLUG}/artifacts.jsonl`] },
      { name: "discard", run: () => ok(`/api/venture/${SLUG}/artifacts/a1/discard`), expect: [`${SLUG}/artifacts.jsonl`] },
      { name: "restore", run: () => ok(`/api/venture/${SLUG}/artifacts/a1/restore`), expect: [`${SLUG}/artifacts.jsonl`] },
      {
        name: "select",
        run: () => ok(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["substack"] }),
        expect: [`${SLUG}/decisions.jsonl`],
      },
      { name: "pace", run: () => ok(`/api/venture/${SLUG}/pace`, { postsPerWeek: "3 a week" }), expect: [`${SLUG}/canon.md`] },
      // clearCheckpoint reads through deriveState(), which refreshes the disposable state.md cache
      // even on a REFUSED clear. Pre-existing and deliberate (state.md is never authoritative --
      // canon.md is), but it is a file change, so it is declared rather than hidden.
      {
        name: "checkpoint clear (refused)",
        run: () => ok(`/api/venture/${SLUG}/checkpoint/checkpoint-1/clear`),
        expect: [`${SLUG}/state.md`],
      },
    ];

    for (const c of cases) {
      const before = snapshot(root);
      c.run();
      assert.deepEqual(changedPaths(before, snapshot(root)), c.expect.sort(), `${c.name} touched the wrong files`);
    }
  });
});

test("a refused write changes nothing at all", () => {
  withRoot((root) => {
    kickoff();
    seedArtifact("a1", "substack-post");
    seedPlatformDecision();

    const before = snapshot(root);
    refusal(`/api/venture/${SLUG}/artifacts/a1/retract`, { attestation: "never was live" });
    refusal(`/api/venture/${SLUG}/artifacts/a1/failed`, { message: "not approved yet" });
    refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["linkedin"] });
    refusal(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["mastodon"] });
    refusal(`/api/venture/${SLUG}/pace`, { postsPerWeek: "" });
    post("/api/venture/ghost/artifacts/a1/approve");
    post(`/api/venture/../artifacts/a1/approve`); // single-segment bad slug: refused by name
    handleVentureWrite("POST", `/api/venture/../../artifacts/a1/approve`, {}); // multi-segment: matches nothing

    assert.deepEqual(changedPaths(before, snapshot(root)), []);
  });
});

// --- privacy ---------------------------------------------------------------------------------

test("no write route echoes a raw response quote or a respondent hash", () => {
  withRoot((root) => {
    kickoff();
    const EXACT = "EXACTQUOTESENTINEL-do-not-leak";
    const HASH = "RESPONDENTHASHSENTINEL-do-not-leak";
    writeFileSync(
      join(root, SLUG, "responses.jsonl"),
      JSON.stringify({
        response_id: "r-1",
        source: "survey",
        received_at: AT,
        respondent_hash: HASH,
        target_audience_eligible: true,
        exact_quote: EXACT,
        redacted_quote: "redacted",
        stuck_point: "s",
        desired_outcome: null,
        emotional_intensity: "high",
        cluster_id: null,
        included_in_gate: true,
        exclusion_reason: null,
      }) + "\n"
    );

    seedArtifact("a1", "substack-post");
    seedPlatformDecision();
    const seen = [
      JSON.stringify(ok(`/api/venture/${SLUG}/artifacts/a1/approve`)),
      JSON.stringify(ok(`/api/venture/${SLUG}/decisions/p1-platform-01/select`, { candidateIds: ["substack"] })),
      JSON.stringify(ok(`/api/venture/${SLUG}/checkpoint/checkpoint-1/clear`)),
      JSON.stringify(ok(`/api/venture/${SLUG}/pace`, { postsPerWeek: "3 a week" })),
    ].join("\n");
    assert.ok(!seen.includes(EXACT), "a write route echoed a raw quote");
    assert.ok(!seen.includes(HASH), "a write route echoed a respondent hash");
  });
});
