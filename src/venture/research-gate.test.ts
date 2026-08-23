import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { appendCanonEvent } from "./canon.js";
import { readArtifact } from "./artifacts.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

// Exercises the real CLI as a subprocess -- avoids fighting process.argv/stdin mutation across
// tests, and tests the actual contract (exit code, stderr message) rather than an internal call.
const SCRIPT = join(repoRoot, "src", "venture", "phase1.ts");
const SLUG = "zz-test-research-gate";

function runCmd(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeEach(useTempVentureRoot);

afterEach(clearTempVentureRoot);

describe("plan-init validation", () => {
  test("rejects a probe referencing an unknown_id not in open_unknowns", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
        probes: [{ unknown_id: "u-does-not-exist", hypothesis: "h", conversation_question: "q", expected_evidence: "e" }],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /isn't in open_unknowns/);
  });

  test("rejects an invalid dimension", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "not_a_real_dimension", description: "d" }],
        probes: [],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid dimension/);
  });

  test("rejects a confirmed_known without evidence_refs or confirmed_by_muxin", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [{ claim: "already known", evidence_refs: [], confirmed_by_muxin: false }],
        open_unknowns: [],
        probes: [],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /needs non-empty evidence_refs AND confirmed_by_muxin/);
  });

  test("a well-formed plan succeeds and starts unreviewed", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
        probes: [],
      })
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /STOP: show Muxin this plan/);
  });
});

describe("platform-select override reason", () => {
  function seedRecommendation() {
    runCmd(
      "platform",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: [
          { candidate_id: "substack", label: "Substack", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "x", label: "X", scores: {}, evidence_refs: [], rationale: "r" },
        ],
        recommended_candidate_ids: ["substack"],
      })
    );
  }

  test("selecting the recommended candidate needs no override reason", () => {
    seedRecommendation();
    const r = runCmd("platform-select", ["substack"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /platform selected: substack/);
  });

  test("selecting a non-recommended candidate without --override-reason is refused", () => {
    seedRecommendation();
    const r = runCmd("platform-select", ["x"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--override-reason/);
  });

  test("selecting a non-recommended candidate with --override-reason succeeds and records it", () => {
    seedRecommendation();
    const r = runCmd("platform-select", ["x", "--override-reason", "audience already lives on X"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /platform selected: x/);
  });
});

describe("the G2/G3 gate chain -- drafting is refused until every prior gate clears", () => {
  // Deliberately does NOT call plan-review -- callers opt into that separately so both
  // "unreviewed" and "reviewed" starting states are easy to set up from the same seed.
  function seedUnreviewedPlanAndSelectedPlatform() {
    runCmd(
      "plan-init",
      [],
      JSON.stringify({ confirmed_knowns: [], open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }], probes: [] })
    );
    runCmd(
      "platform",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: [
          { candidate_id: "substack", label: "Substack", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "x", label: "X", scores: {}, evidence_refs: [], rationale: "r" },
        ],
        recommended_candidate_ids: ["substack"],
      })
    );
    runCmd("platform-select", ["substack"]);
  }

  test("ideas is refused before the plan is reviewed, even with a platform selected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    const r = runCmd("ideas", [], "{}");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /reviewed_by_muxin/);
  });

  test("ideas succeeds once the plan is reviewed, and requires exactly the configured idea_count", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const tooFew = runCmd(
      "ideas",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: [{ candidate_id: "idea-1", label: "l", scores: { personal_stake: 1, specificity: 1, identity_signal: 1, easy_reply: 1 }, evidence_refs: [], rationale: "r", unknown_id: "u1" }],
        recommended_candidate_ids: [],
      })
    );
    assert.equal(tooFew.status, 1);
    assert.match(tooFew.stderr, /expected exactly 10/);
  });

  test("draft is refused for a candidate that wasn't one of the three selected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const r = runCmd("draft", ["idea-9", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: "b?", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /was not one of the three Muxin selected/);
  });

  test("draft over the word cap is rejected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const longBody = Array(160).fill("word").join(" ") + "?";
    const r = runCmd("draft", ["idea-1", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: longBody, claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /over the 150-word/);
  });

  test("draft with no reply prompt and no no_cta_reason is rejected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const r = runCmd("draft", ["idea-1", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: "no question mark here.", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /doesn't end with a reply prompt/);
  });
});

// --- research-read-init / research-read-review / continuation / requirePhase2Unlocked --------

const REQUIRED_SOURCES = [
  "note_reply",
  "essay_comment",
  "metric",
  "subscriber_movement",
  "dm",
  "email",
  "follow_up_question",
  "creator_observation",
];
const SIGNAL_FACTORS = [
  "audience_fit",
  "specificity",
  "explicit_stuck_point",
  "requested_help",
  "follow_up_question",
  "recurrence",
  "behavioral_action",
  "exposure_context",
];

function seedCheckpoint1(): void {
  appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "2026-08-19T00:00:00.000Z");
}

function seedActivePlan(): void {
  runCmd(
    "plan-init",
    [],
    JSON.stringify({
      confirmed_knowns: [],
      open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
      probes: [],
    })
  );
}

function fullCollectionCoverage(): { source: string; status: string }[] {
  return REQUIRED_SOURCES.map((source) => ({ source, status: "complete" }));
}

function fullRationale(): { factor: string; status: string; evidence_refs: string[] }[] {
  return SIGNAL_FACTORS.map((factor) => ({ factor, status: "present", evidence_refs: ["obs:o-1"] }));
}

function wellFormedFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    finding_id: "f-001",
    finding_origin: "planned",
    unknown_ids: ["u1"],
    evidence_refs: ["obs:o-1"],
    signal_quality_rationale: fullRationale(),
    ...overrides,
  };
}

describe("research-read-init", () => {
  test("refused before Checkpoint 1 clears", () => {
    seedActivePlan();
    const r = runCmd(
      "research-read-init",
      [],
      JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [wellFormedFinding()] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /checkpoint-1 has not cleared/);
  });

  test("missing a collection_coverage source entry is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const coverage = fullCollectionCoverage().filter((c) => c.source !== "dm");
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: coverage, findings: [wellFormedFinding()] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing required source "dm"/);
  });

  test("a partial status with no gap_reason is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const coverage = fullCollectionCoverage().map((c) => (c.source === "dm" ? { source: "dm", status: "partial" } : c));
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: coverage, findings: [wellFormedFinding()] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /has status "partial" but no gap_reason/);
  });

  test("an unavailable status with no gap_reason is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const coverage = fullCollectionCoverage().map((c) =>
      c.source === "essay_comment" ? { source: "essay_comment", status: "unavailable" } : c
    );
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: coverage, findings: [wellFormedFinding()] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /has status "unavailable" but no gap_reason/);
  });

  test("an emergent finding with both empty unknown_ids and empty emergent_description is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({ finding_origin: "emergent", unknown_ids: [] });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /emergent_description/);
  });

  test("an emergent finding with an emergent_description but empty unknown_ids succeeds", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({
      finding_origin: "emergent",
      unknown_ids: [],
      emergent_description: "something nobody anticipated",
    });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 0);
  });

  test("a planned finding referencing an unknown_id not in the active plan is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({ unknown_ids: ["u-does-not-exist"] });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /isn't in the active phase_1_research_plan's open_unknowns/);
  });

  test("incomplete signal_quality_rationale (missing a required factor) is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const rationale = fullRationale().filter((r) => r.factor !== "exposure_context");
    const finding = wellFormedFinding({ signal_quality_rationale: rationale });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing a signal_quality_rationale entry for factor "exposure_context"/);
  });

  test("a present/absent rationale factor with no evidence_refs is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const rationale = fullRationale().map((r) => (r.factor === "recurrence" ? { ...r, evidence_refs: [] } : r));
    const finding = wellFormedFinding({ signal_quality_rationale: rationale });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /factor "recurrence" is "present" but has no evidence_refs/);
  });

  test("an unknown rationale factor status may cite no evidence_refs", () => {
    seedCheckpoint1();
    seedActivePlan();
    const rationale = fullRationale().map((r) => (r.factor === "recurrence" ? { factor: "recurrence", status: "unknown", evidence_refs: [] } : r));
    const finding = wellFormedFinding({ signal_quality_rationale: rationale });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 0);
  });

  test("a well-formed payload succeeds and starts reviewed_by_muxin: false with muxin_confirmed_emergent forced null", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({
      finding_origin: "emergent",
      unknown_ids: [],
      emergent_description: "a surprise",
      muxin_confirmed_emergent: true, // caller-supplied true -- must be ignored and forced null
    });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /wrote p1-research-read/);
    const artifact = readArtifact(SLUG, "p1-research-read");
    assert.equal(artifact?.fields?.reviewed_by_muxin, false);
    const findings = artifact?.fields?.findings as { muxin_confirmed_emergent: unknown }[];
    assert.equal(findings[0].muxin_confirmed_emergent, null);
  });

  test("duplicate finding_id is rejected", () => {
    seedCheckpoint1();
    seedActivePlan();
    const findings = [wellFormedFinding(), wellFormedFinding()];
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /duplicate finding_id "f-001"/);
  });
});

// Finding #2a: signal_quality is now computed and persisted per finding, against the
// venture-schema-contract.md §2C.4 "Recommended default threshold" -- PROPOSED, not yet
// Muxin-confirmed as a hard rule. Exercised via the CLI's written artifact, same discipline as
// the rest of this file.
describe("signal_quality computation (finding #2a)", () => {
  function rationaleWith(statuses: Record<string, "present" | "absent" | "unknown">): { factor: string; status: string; evidence_refs: string[] }[] {
    return SIGNAL_FACTORS.map((factor) => {
      const status = statuses[factor] ?? "absent";
      return { factor, status, evidence_refs: status === "unknown" ? [] : ["obs:o-1"] };
    });
  }

  function signalQualityFor(rationale: { factor: string; status: string; evidence_refs: string[] }[]): string {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({ signal_quality_rationale: rationale });
    const r = runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    assert.equal(r.status, 0, r.stderr);
    const artifact = readArtifact(SLUG, "p1-research-read");
    const findings = artifact?.fields?.findings as { signal_quality: string }[];
    return findings[0].signal_quality;
  }

  test("audience_fit present + all 7 others present -> strong", () => {
    const rationale = rationaleWith(Object.fromEntries(SIGNAL_FACTORS.map((f) => [f, "present"])));
    assert.equal(signalQualityFor(rationale), "strong");
  });

  test("audience_fit present + exactly 3 others present -> strong", () => {
    const rationale = rationaleWith({
      audience_fit: "present",
      specificity: "present",
      explicit_stuck_point: "present",
      requested_help: "present",
    });
    assert.equal(signalQualityFor(rationale), "strong");
  });

  test("audience_fit present + 1 other present -> moderate", () => {
    const rationale = rationaleWith({ audience_fit: "present", specificity: "present" });
    assert.equal(signalQualityFor(rationale), "moderate");
  });

  test("audience_fit unknown + 2 others present -> moderate", () => {
    const rationale = rationaleWith({ audience_fit: "unknown", specificity: "present", requested_help: "present" });
    assert.equal(signalQualityFor(rationale), "moderate");
  });

  test("everything absent -> thin", () => {
    const rationale = rationaleWith({});
    assert.equal(signalQualityFor(rationale), "thin");
  });

  test("audience_fit absent even with 3 others present -> thin", () => {
    const rationale = rationaleWith({
      audience_fit: "absent",
      specificity: "present",
      explicit_stuck_point: "present",
      requested_help: "present",
    });
    assert.equal(signalQualityFor(rationale), "thin");
  });
});

describe("research-read-confirm-emergent", () => {
  function seedResearchRead(): void {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({ finding_origin: "emergent", unknown_ids: [], emergent_description: "a surprise" });
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
  }

  test("confirming true is recorded on the named finding", () => {
    seedResearchRead();
    const r = runCmd("research-read-confirm-emergent", ["f-001", "true"]);
    assert.equal(r.status, 0);
    const artifact = readArtifact(SLUG, "p1-research-read");
    const findings = artifact?.fields?.findings as { finding_id: string; muxin_confirmed_emergent: unknown }[];
    assert.equal(findings.find((f) => f.finding_id === "f-001")?.muxin_confirmed_emergent, true);
  });

  test("refuses a planned (non-emergent) finding", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding(); // finding_origin: "planned" by default
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    const r = runCmd("research-read-confirm-emergent", ["f-001", "true"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is not emergent/);
  });

  test("refuses an unknown finding_id", () => {
    seedResearchRead();
    const r = runCmd("research-read-confirm-emergent", ["no-such-finding", "true"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no such finding/);
  });
});

describe("research-read-review", () => {
  function seedResearchReadWithEmergent(): void {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding({ finding_origin: "emergent", unknown_ids: [], emergent_description: "a surprise" });
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
  }

  test("refused when an emergent finding's muxin_confirmed_emergent is still null", () => {
    seedResearchReadWithEmergent();
    const r = runCmd("research-read-review", []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /every emergent finding to be confirmed/);
    assert.match(r.stderr, /f-001/);
    assert.match(r.stderr, /research-read-confirm-emergent/);
    const artifact = readArtifact(SLUG, "p1-research-read");
    assert.equal(artifact?.fields?.reviewed_by_muxin, false);
  });

  test("succeeds once the emergent finding is confirmed true", () => {
    seedResearchReadWithEmergent();
    runCmd("research-read-confirm-emergent", ["f-001", "true"]);
    const r = runCmd("research-read-review", []);
    assert.equal(r.status, 0);
    const artifact = readArtifact(SLUG, "p1-research-read");
    assert.equal(artifact?.fields?.reviewed_by_muxin, true);
  });

  test("succeeds once the emergent finding is confirmed false (an explicit no still counts as confirmed)", () => {
    seedResearchReadWithEmergent();
    runCmd("research-read-confirm-emergent", ["f-001", "false"]);
    const r = runCmd("research-read-review", []);
    assert.equal(r.status, 0);
    const artifact = readArtifact(SLUG, "p1-research-read");
    assert.equal(artifact?.fields?.reviewed_by_muxin, true);
  });

  test("planned findings never need confirmation -- review succeeds with only a planned finding present", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding(); // finding_origin: "planned" by default
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    const r = runCmd("research-read-review", []);
    assert.equal(r.status, 0);
  });
});

describe("continuation", () => {
  function seedReviewedResearchRead(): void {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding();
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    runCmd("research-read-review", []);
  }

  function candidatesFor(ids: string[]): Record<string, unknown>[] {
    return ids.map((id) => ({ candidate_id: id, label: id, scores: {}, evidence_refs: [], rationale: "r" }));
  }

  test("is refused before the research read is reviewed", () => {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding();
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    const r = runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: candidatesFor(["more_probes", "proceed_with_evidence", "proceed_as_hypothesis"]),
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is not reviewed_by_muxin/);
  });

  test("rejects a candidate set that isn't exactly the three fixed ids (missing one)", () => {
    seedReviewedResearchRead();
    const r = runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: candidatesFor(["more_probes", "proceed_with_evidence"]),
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /continuation candidates must be exactly/);
  });

  test("rejects a candidate set containing an id outside the fixed three", () => {
    seedReviewedResearchRead();
    const r = runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: candidatesFor(["more_probes", "proceed_with_evidence", "not_a_real_candidate"]),
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /continuation candidates must be exactly/);
  });

  test("rejects missing input_refs to the active plan/read artifacts", () => {
    seedReviewedResearchRead();
    const r = runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: candidatesFor(["more_probes", "proceed_with_evidence", "proceed_as_hypothesis"]),
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /input_refs must include both/);
  });

  test("a well-formed continuation decision succeeds", () => {
    seedReviewedResearchRead();
    const r = runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: candidatesFor(["more_probes", "proceed_with_evidence", "proceed_as_hypothesis"]),
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /wrote p1-continuation-01/);
  });
});

describe("requirePhase2Unlocked (via the check-phase2-unlock CLI smoke command)", () => {
  function seedReviewedResearchReadAndContinuation(): void {
    seedCheckpoint1();
    seedActivePlan();
    const finding = wellFormedFinding();
    runCmd("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    runCmd("research-read-review", []);
    runCmd(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: [
          { candidate_id: "more_probes", label: "more_probes", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "proceed_with_evidence", label: "proceed_with_evidence", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "proceed_as_hypothesis", label: "proceed_as_hypothesis", scores: {}, evidence_refs: [], rationale: "r" },
        ],
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
  }

  test("refuses when the continuation decision doesn't exist", () => {
    const r = runCmd("check-phase2-unlock", []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is not selected yet/);
  });

  test("refuses when selected as more_probes", () => {
    seedReviewedResearchReadAndContinuation();
    // "more_probes" isn't the recommended candidate in this seed, so selecting it needs
    // --override-reason -- same audit-trail discipline as platform-select.
    runCmd("continuation-select", ["more_probes", "--override-reason", "evidence too thin on all three unknowns"]);
    const r = runCmd("check-phase2-unlock", []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /selected "more_probes"/);
  });

  test("allows when selected as proceed_with_evidence", () => {
    seedReviewedResearchReadAndContinuation();
    runCmd("continuation-select", ["proceed_with_evidence"]);
    const r = runCmd("check-phase2-unlock", []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /phase 2 unlocked/);
  });

  test("allows when selected as proceed_as_hypothesis", () => {
    seedReviewedResearchReadAndContinuation();
    runCmd(
      "continuation-select",
      ["proceed_as_hypothesis", "--override-reason", "evidence is thin but time-boxed"]
    );
    const r = runCmd("check-phase2-unlock", []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /phase 2 unlocked/);
  });
});
