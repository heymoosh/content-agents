import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { ventureDir } from "./paths.js";
import { appendCanonEvent } from "./canon.js";
import { readArtifact } from "./artifacts.js";
import { readDecision } from "./decisions.js";
import { ingestResponse } from "./responses.js";
import { readClusterAnalysis } from "./phase3.js";

// Exercises the real CLI as a subprocess, same discipline as phase2.test.ts/research-gate.test.ts
// (avoids fighting process.argv/stdin mutation across tests, tests the actual contract).
const SCRIPT = join(repoRoot, "src", "venture", "phase3.ts");
const SLUG = "zz-test-phase3";

function runCmd(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Arrange-step subprocess calls are expected to succeed. Without this check, a subprocess that
// dies for an environmental reason fails silently and the test's own assertion later fails on
// stale/default state with a confusing, unrelated error instead of the real cause -- the exact
// regression WP1's own test suite caught (see phase2.test.ts's identical helper).
function must(r: { status: number | null; stdout: string; stderr: string }, label: string): typeof r {
  assert.equal(r.status, 0, `${label} failed (exit ${r.status}): ${r.stderr}`);
  return r;
}

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

// ---- seeding helpers ----
// Response-gate seeding uses ingestResponse() directly (in-process), not the response-ingest CLI --
// 20 subprocess spawns per test would make the suite glacial for no coverage gain, since
// responses.test.ts already covers ingestResponse's own contract exhaustively. The CLI itself gets
// its own direct describe block below.

function baseResponseInput(overrides: Partial<Parameters<typeof ingestResponse>[1]> = {}) {
  return {
    source: "survey" as const,
    receivedAt: "2026-08-19T00:00:00.000Z",
    targetAudienceEligible: true,
    exactQuote: "I waste an hour every week untangling this.",
    redactedQuote: "I waste [TIME] untangling this.",
    stuckPoint: "manual weekly cleanup",
    emotionalIntensity: "medium" as const,
    ...overrides,
  };
}

function seedResponseGateOpen(n = 20): void {
  for (let i = 0; i < n; i++) {
    ingestResponse(SLUG, baseResponseInput({ responseId: `r-${i}` }), `t${i}`);
  }
}

// 20 responses split across 3 clusters: r-0..r-9 -> cluster-1, r-10..r-14 -> cluster-2,
// r-15..r-19 -> cluster-3.
function wellFormedClusterInput(): Record<string, unknown> {
  const assignments = [
    ...Array.from({ length: 10 }, (_, i) => ({ response_id: `r-${i}`, cluster_id: "cluster-1" })),
    ...Array.from({ length: 5 }, (_, i) => ({ response_id: `r-${10 + i}`, cluster_id: "cluster-2" })),
    ...Array.from({ length: 5 }, (_, i) => ({ response_id: `r-${15 + i}`, cluster_id: "cluster-3" })),
  ];
  return {
    clusters: [
      {
        cluster_id: "cluster-1",
        label: "Overwhelm and lack of direction",
        evidence: ["I waste [TIME] untangling this."],
        stuck_point: "manual weekly cleanup",
        desired_outcome: "a repeatable system",
        visible_consequences: "burnout",
      },
      {
        cluster_id: "cluster-2",
        label: "Tooling gaps",
        evidence: ["I waste [TIME] untangling this."],
        stuck_point: "manual weekly cleanup",
        desired_outcome: "fewer manual steps",
        visible_consequences: "wasted money on tools that don't fit",
      },
      {
        cluster_id: "cluster-3",
        label: "No feedback loop",
        evidence: ["I waste [TIME] untangling this."],
        stuck_point: "manual weekly cleanup",
        desired_outcome: "confidence in the plan",
        visible_consequences: "second-guessing",
      },
    ],
    assignments,
  };
}

function seedClusterWritten(): void {
  seedResponseGateOpen();
  must(runCmd("cluster", [], JSON.stringify(wellFormedClusterInput())), "cluster");
}

const PROBLEM_FACTORS = ["frequency", "intensity", "time_cost", "money_cost", "stress_cost", "solvability"];

function threeProblemCandidates(overrides: Record<string, unknown>[] = []): Record<string, unknown>[] {
  const base = ["cluster-1", "cluster-2", "cluster-3"].map((id) => ({
    candidate_id: id,
    label: id,
    scores: Object.fromEntries(PROBLEM_FACTORS.map((f) => [f, 3])),
    evidence_refs: [],
    rationale: "r",
  }));
  for (const o of overrides) {
    const idx = base.findIndex((c) => c.candidate_id === o.candidate_id);
    if (idx >= 0) base[idx] = { ...base[idx], ...o };
  }
  return base;
}

function seedProblemSelected(): void {
  seedClusterWritten();
  must(
    runCmd(
      "problem-score",
      [],
      JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1"] })
    ),
    "problem-score"
  );
  must(runCmd("problem-select", ["cluster-1"]), "problem-select");
}

const TRANSFORMATION_SENTENCE = "Go from scattered weekly cleanup to one repeatable system in two weeks.";

function seedTransformationSelected(): void {
  seedProblemSelected();
  must(runCmd("transformation-draft", [], JSON.stringify({ sentence: TRANSFORMATION_SENTENCE, rationale: "r", claim_refs: [] })), "transformation-draft");
  must(runCmd("transformation-select", []), "transformation-select");
}

function wellFormedOutlineInput(): Record<string, unknown> {
  return {
    transformation_sentence: TRANSFORMATION_SENTENCE,
    sections: ["Orientation", "Diagnosis", "Core method", "Application", "Action plan"],
    format: "self-paced PDF guide",
    claim_refs: [],
  };
}

function seedOutlineApproved(): void {
  seedTransformationSelected();
  must(runCmd("outline-draft", [], JSON.stringify(wellFormedOutlineInput())), "outline-draft");
  must(runCmd("approve", ["p3-product-outline"]), "approve outline");
}

function wellFormedPriceOptions(): Record<string, unknown> {
  return {
    input_refs: ["p3-product-outline"],
    candidates: [
      { candidate_id: "price-79", label: "$79 self-paced PDF", scores: {}, evidence_refs: [], rationale: "matches audience economics" },
      { candidate_id: "price-129", label: "$129 with a live Q&A", scores: {}, evidence_refs: [], rationale: "higher-touch option" },
    ],
    recommended_candidate_ids: ["price-79"],
  };
}

function seedPriceSelected(): void {
  seedOutlineApproved();
  must(runCmd("price", [], JSON.stringify(wellFormedPriceOptions())), "price");
  must(runCmd("price-select", ["price-79"]), "price-select");
}

function wellFormedPriceDraftInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recommended_price: 79,
    considered_range: "$59 to $149",
    reasoning: "Matches audience economics and the strength of creator proof.",
    known_uncertainty: "First price test for this audience, no prior conversion data.",
    pitch_paragraph: "A short guide to fix one broken weekly workflow, built from what this audience actually described.",
    claim_refs: [],
    ...overrides,
  };
}

// ==== response gate: blanket dispatch-level gating ====

describe("response gate: blanket dispatch-level gating", () => {
  test("cluster refused before the gate opens, naming have/need", () => {
    seedResponseGateOpen(5);
    const r = runCmd("cluster", [], JSON.stringify(wellFormedClusterInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /response gate is not open yet -- have 5 of 20/);
  });

  test("cluster refused with zero responses ingested", () => {
    const r = runCmd("cluster", [], JSON.stringify(wellFormedClusterInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /have 0 of 20/);
  });

  test("approve is gated too (blanket dispatch gate covers it, not just analysis commands)", () => {
    const r = runCmd("approve", ["p3-product-outline"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /response gate is not open yet/);
  });

  test("list is exempt from the gate (a status/read command)", () => {
    const r = runCmd("list", []);
    assert.equal(r.status, 0);
  });

  test("response-gate-status is exempt from the gate", () => {
    seedResponseGateOpen(3);
    const r = runCmd("response-gate-status", []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /closed -- 3\/20/);
  });

  test("all Phase 3 analysis commands succeed once the gate is open (20 eligible)", () => {
    seedResponseGateOpen(20);
    const r = runCmd("cluster", [], JSON.stringify(wellFormedClusterInput()));
    assert.equal(r.status, 0, r.stderr);
  });
});

// ==== cluster ====

describe("cluster validation", () => {
  test("fewer than 3 clusters is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: unknown[] };
    input.clusters = input.clusters.slice(0, 2);
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /expected 3-5 clusters/);
  });

  test("more than 5 clusters is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: Record<string, unknown>[]; assignments: unknown[] };
    for (let i = 4; i <= 6; i++) {
      input.clusters.push({ cluster_id: `cluster-${i}`, label: "extra", evidence: ["e"], stuck_point: "s" });
    }
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /expected 3-5 clusters/);
  });

  test("duplicate cluster_id is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: Record<string, unknown>[]; assignments: unknown[] };
    input.clusters[1] = { ...input.clusters[1], cluster_id: "cluster-1" };
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /duplicate cluster_id/);
  });

  test("a cluster with no evidence is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: Record<string, unknown>[]; assignments: unknown[] };
    input.clusters[0] = { ...input.clusters[0], evidence: [] };
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must carry at least one evidence entry/);
  });

  test("an assignment referencing an unknown response_id is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: Record<string, unknown>[] };
    input.assignments.push({ response_id: "r-does-not-exist", cluster_id: "cluster-1" });
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /references unknown response_id "r-does-not-exist"/);
  });

  test("an assignment naming an undeclared cluster_id is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: Record<string, unknown>[] };
    input.assignments[0] = { ...input.assignments[0], cluster_id: "cluster-nope" };
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /names cluster_id "cluster-nope", which isn't one of the declared clusters/);
  });

  test("a response assigned twice is refused", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: Record<string, unknown>[] };
    input.assignments.push({ response_id: "r-0", cluster_id: "cluster-2" });
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /"r-0" is assigned to more than one cluster/);
  });

  test("an orphan response (never assigned) is refused, naming it", () => {
    seedResponseGateOpen();
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: Record<string, unknown>[] };
    input.assignments = input.assignments.filter((a) => a.response_id !== "r-19");
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing: r-19/);
  });

  test("an assignment referencing an excluded (not included_in_gate) response is refused", () => {
    seedResponseGateOpen(19);
    // r-19 is ineligible and thus never included_in_gate -- included count stays at 19, so the
    // gate itself is still closed. Open it with one more eligible response, then try to assign
    // the ineligible one too.
    ingestResponse(SLUG, baseResponseInput({ responseId: "r-19", targetAudienceEligible: false, exclusionReason: "ineligible" }), "t19");
    ingestResponse(SLUG, baseResponseInput({ responseId: "r-20" }), "t20");
    const input = wellFormedClusterInput() as { clusters: unknown[]; assignments: Record<string, unknown>[] };
    input.assignments = input.assignments.filter((a) => a.response_id !== "r-19");
    input.assignments.push({ response_id: "r-19", cluster_id: "cluster-3" }, { response_id: "r-20", cluster_id: "cluster-3" });
    const r = runCmd("cluster", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /references response "r-19", which is not included_in_gate/);
  });

  test("a well-formed cluster input succeeds, writes cluster-analysis.json with derived counts, and stamps cluster_id on every response", () => {
    seedResponseGateOpen();
    const r = runCmd("cluster", [], JSON.stringify(wellFormedClusterInput()));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /wrote cluster-analysis.json \(3 clusters, 20 responses assigned\)/);

    const analysis = readClusterAnalysis(SLUG);
    assert.ok(analysis);
    assert.equal(analysis!.clusters.length, 3);
    const byId = Object.fromEntries(analysis!.clusters.map((c) => [c.cluster_id, c]));
    assert.equal(byId["cluster-1"].count, 10);
    assert.equal(byId["cluster-2"].count, 5);
    assert.equal(byId["cluster-3"].count, 5);
  });

  test("cluster refuses to re-run once problem-selection is already selected", () => {
    seedProblemSelected();
    const r = runCmd("cluster", [], JSON.stringify(wellFormedClusterInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-problem-01 \(problem-selection\) is already selected/);
  });
});

// ==== problem-score / problem-select ====

describe("problem-score validation", () => {
  test("refused with no cluster analysis yet", () => {
    seedResponseGateOpen();
    const r = runCmd(
      "problem-score",
      [],
      JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1"] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no cluster analysis found -- run "cluster" first/);
  });

  test("candidate set not matching the stored clusters is refused", () => {
    seedClusterWritten();
    const candidates = threeProblemCandidates().slice(0, 2);
    const r = runCmd("problem-score", [], JSON.stringify({ input_refs: ["cluster-analysis"], candidates, recommended_candidate_ids: ["cluster-1"] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /candidates must be exactly the stored clusters/);
  });

  test("a candidate missing a factor score is refused", () => {
    seedClusterWritten();
    const candidates = threeProblemCandidates();
    delete (candidates[0].scores as Record<string, number>).solvability;
    const r = runCmd("problem-score", [], JSON.stringify({ input_refs: ["cluster-analysis"], candidates, recommended_candidate_ids: ["cluster-1"] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing a score for factor "solvability"/);
  });

  test("a factor score out of the 1-5 scale is refused", () => {
    seedClusterWritten();
    const candidates = threeProblemCandidates();
    (candidates[0].scores as Record<string, number>).intensity = 9;
    const r = runCmd("problem-score", [], JSON.stringify({ input_refs: ["cluster-analysis"], candidates, recommended_candidate_ids: ["cluster-1"] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /outside the 1-5 scale/);
  });

  test("more than one recommended candidate is refused", () => {
    seedClusterWritten();
    const r = runCmd(
      "problem-score",
      [],
      JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1", "cluster-2"] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /recommends exactly one problem/);
  });

  test("a well-formed problem-score succeeds", () => {
    seedClusterWritten();
    const r = runCmd(
      "problem-score",
      [],
      JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1"] })
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /wrote p3-problem-01 \(3 scored clusters\)/);
  });
});

describe("problem-select override reason", () => {
  test("selecting a non-recommended candidate without --override-reason is refused", () => {
    seedClusterWritten();
    must(
      runCmd(
        "problem-score",
        [],
        JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1"] })
      ),
      "problem-score"
    );
    const r = runCmd("problem-select", ["cluster-2"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--override-reason/);
  });

  test("selecting the recommended candidate needs no override reason", () => {
    seedClusterWritten();
    must(
      runCmd(
        "problem-score",
        [],
        JSON.stringify({ input_refs: ["cluster-analysis"], candidates: threeProblemCandidates(), recommended_candidate_ids: ["cluster-1"] })
      ),
      "problem-score"
    );
    const r = runCmd("problem-select", ["cluster-1"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /problem selected: cluster-1/);
  });
});

// ==== transformation-draft / transformation-select ====

describe("transformation-draft", () => {
  test("refused before a problem is selected", () => {
    seedClusterWritten();
    const r = runCmd("transformation-draft", [], JSON.stringify({ sentence: TRANSFORMATION_SENTENCE, claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /problem-selection is not selected/);
  });

  test("a banned vague verb is refused", () => {
    seedProblemSelected();
    const r = runCmd("transformation-draft", [], JSON.stringify({ sentence: "Go from scattered notes to a fully unlocked workflow.", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /banned vague verb "unlock"/);
  });

  test("a two-sentence input is refused", () => {
    seedProblemSelected();
    const r = runCmd(
      "transformation-draft",
      [],
      JSON.stringify({ sentence: "Go from scattered notes to one system. This will help a lot.", claim_refs: [] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must be a single sentence/);
  });

  test("an em dash is refused", () => {
    seedProblemSelected();
    const r = runCmd("transformation-draft", [], JSON.stringify({ sentence: "Go from scattered notes — to one system.", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /em dash/);
  });

  test("a well-formed sentence succeeds", () => {
    seedProblemSelected();
    const r = runCmd("transformation-draft", [], JSON.stringify({ sentence: TRANSFORMATION_SENTENCE, claim_refs: [] }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /wrote p3-transformation-01/);
  });

  test("refuses to re-run once already selected", () => {
    seedTransformationSelected();
    const r = runCmd("transformation-draft", [], JSON.stringify({ sentence: TRANSFORMATION_SENTENCE, claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-transformation-01 \(transformation-choice\) is already selected/);
  });
});

describe("transformation-select", () => {
  test("refused with no transformation-draft yet", () => {
    seedProblemSelected();
    const r = runCmd("transformation-select", []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no transformation-choice decision found/);
  });

  test("approves the sole candidate", () => {
    seedProblemSelected();
    must(runCmd("transformation-draft", [], JSON.stringify({ sentence: TRANSFORMATION_SENTENCE, claim_refs: [] })), "transformation-draft");
    const r = runCmd("transformation-select", []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp(`transformation approved: "${TRANSFORMATION_SENTENCE}"`));
    const d = readDecision(SLUG, "p3-transformation-01");
    assert.equal(d?.status, "selected");
  });
});

// ==== outline-draft ====

describe("outline-draft", () => {
  test("refused before the transformation is approved", () => {
    seedProblemSelected();
    const r = runCmd("outline-draft", [], JSON.stringify(wellFormedOutlineInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /transformation-choice is not selected/);
  });

  test("a transformation_sentence that doesn't match the approved one exactly is refused", () => {
    seedTransformationSelected();
    const input = { ...wellFormedOutlineInput(), transformation_sentence: "A different sentence entirely." };
    const r = runCmd("outline-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not match the approved transformation-choice candidate exactly/);
  });

  test("fewer than 5 sections is refused", () => {
    seedTransformationSelected();
    const input = { ...wellFormedOutlineInput(), sections: ["a", "b"] };
    const r = runCmd("outline-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /outline must have 5-7 sections/);
  });

  test("more than 7 sections is refused", () => {
    seedTransformationSelected();
    const input = { ...wellFormedOutlineInput(), sections: Array.from({ length: 8 }, (_, i) => `section ${i}`) };
    const r = runCmd("outline-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /outline must have 5-7 sections/);
  });

  test("a well-formed outline succeeds and carries checkpoint_id checkpoint-3", () => {
    seedTransformationSelected();
    const r = runCmd("outline-draft", [], JSON.stringify(wellFormedOutlineInput()));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /drafted p3-product-outline \(product-outline, 5 sections\)/);
    const artifact = readArtifact(SLUG, "p3-product-outline");
    assert.equal(artifact?.checkpoint_id, "checkpoint-3");
    assert.equal(artifact?.phase, 3);
    assert.equal(artifact?.fields?.transformation_sentence, TRANSFORMATION_SENTENCE);
  });

  test("refuses to re-run once already approved", () => {
    seedOutlineApproved();
    const r = runCmd("outline-draft", [], JSON.stringify(wellFormedOutlineInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-product-outline is already approved/);
  });
});

// ==== price / price-select / price-draft ====

describe("price (product-format-and-price decision)", () => {
  test("refused before the outline is approved", () => {
    seedTransformationSelected();
    const r = runCmd("price", [], JSON.stringify(wellFormedPriceOptions()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-product-outline is not approved/);
  });

  test("fewer than 2 candidates is refused", () => {
    seedOutlineApproved();
    const input = wellFormedPriceOptions() as { candidates: unknown[] };
    input.candidates = input.candidates.slice(0, 1);
    const r = runCmd("price", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /needs meaningful alternatives/);
  });

  test("a well-formed price options write succeeds", () => {
    seedOutlineApproved();
    const r = runCmd("price", [], JSON.stringify(wellFormedPriceOptions()));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /wrote p3-price-01 \(2 price\/format options\)/);
  });
});

describe("price-select override reason", () => {
  test("a non-recommended pick without --override-reason is refused", () => {
    seedOutlineApproved();
    must(runCmd("price", [], JSON.stringify(wellFormedPriceOptions())), "price");
    const r = runCmd("price-select", ["price-129"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--override-reason/);
  });
});

describe("price-draft", () => {
  test("refused before the outline is approved (even with nothing else run)", () => {
    seedTransformationSelected();
    const r = runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-product-outline is not approved/);
  });

  test("refused before price-select has run", () => {
    seedOutlineApproved();
    const r = runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /product-format-and-price is not selected/);
  });

  test("recommended_price exactly $49 (the civic-tech worked-example price) is refused", () => {
    seedPriceSelected();
    const r = runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput({ recommended_price: 49 })));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /civic-tech worked example's documented price/);
  });

  test("a banned vague verb in the pitch paragraph is refused", () => {
    seedPriceSelected();
    const r = runCmd(
      "price-draft",
      [],
      JSON.stringify(wellFormedPriceDraftInput({ pitch_paragraph: "This guide will unlock your best week yet." }))
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /banned vague verb "unlock"/);
  });

  test("scenario_math without illustrative: true is refused", () => {
    seedPriceSelected();
    const r = runCmd(
      "price-draft",
      [],
      JSON.stringify(wellFormedPriceDraftInput({ scenario_math: { digital_product_conversion_pct: 2 } }))
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /scenario_math.illustrative must be exactly true/);
  });

  test("a well-formed price-draft succeeds with the schema's structured fields", () => {
    seedPriceSelected();
    const r = runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput()));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /drafted p3-price-decision \(price-decision, \$79\)/);
    const artifact = readArtifact(SLUG, "p3-price-decision");
    assert.equal(artifact?.checkpoint_id, "checkpoint-3");
    assert.equal(artifact?.fields?.recommended_price, 79);
    assert.equal(artifact?.fields?.considered_range, "$59 to $149");
    assert.ok(artifact?.fields?.reasoning);
    assert.ok(artifact?.fields?.known_uncertainty);
    assert.ok(artifact?.fields?.pitch_paragraph);
  });

  test("refuses to re-run once already approved", () => {
    seedPriceSelected();
    must(runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput())), "price-draft");
    must(runCmd("approve", ["p3-price-decision"]), "approve price-decision");
    const r = runCmd("price-draft", [], JSON.stringify(wellFormedPriceDraftInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p3-price-decision is already approved/);
  });
});

// ==== response-ingest / response-correct / response-gate-status CLI ====

describe("response-ingest CLI", () => {
  test("never echoes exact_quote or redacted_quote back in its confirmation", () => {
    const input = {
      source: "survey",
      received_at: "2026-08-19T00:00:00.000Z",
      target_audience_eligible: true,
      exact_quote: "SUPER-SECRET-EXACT-QUOTE-TEXT",
      redacted_quote: "REDACTED-QUOTE-MARKER-TEXT",
      stuck_point: "manual weekly cleanup",
      emotional_intensity: "medium",
    };
    const r = runCmd("response-ingest", [], JSON.stringify(input));
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /SUPER-SECRET-EXACT-QUOTE-TEXT/);
    assert.doesNotMatch(r.stdout, /REDACTED-QUOTE-MARKER-TEXT/);
    assert.doesNotMatch(r.stderr, /SUPER-SECRET-EXACT-QUOTE-TEXT/);
    assert.match(r.stdout, /ingested r-/);
    assert.match(r.stdout, /gate closed 1\/20/);
  });

  test("is exempt from the response gate (works with the gate closed)", () => {
    const r = runCmd(
      "response-ingest",
      [],
      JSON.stringify({
        source: "email",
        received_at: "2026-08-19T00:00:00.000Z",
        target_audience_eligible: true,
        exact_quote: "q",
        redacted_quote: "r",
        stuck_point: "s",
        emotional_intensity: "low",
      })
    );
    assert.equal(r.status, 0);
  });

  test("missing a required field is refused", () => {
    const r = runCmd(
      "response-ingest",
      [],
      JSON.stringify({ source: "survey", received_at: "t", target_audience_eligible: true, exact_quote: "", redacted_quote: "r", stuck_point: "s", emotional_intensity: "low" })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing required field\(s\): exact_quote/);
  });
});

describe("response-correct CLI", () => {
  test("corrects a response's cluster_id and reports it back", () => {
    must(
      runCmd(
        "response-ingest",
        [],
        JSON.stringify({
          source: "survey",
          received_at: "t",
          response_id: "r-correct-1",
          target_audience_eligible: true,
          exact_quote: "q",
          redacted_quote: "r",
          stuck_point: "s",
          emotional_intensity: "low",
        })
      ),
      "response-ingest"
    );
    const r = runCmd("response-correct", ["r-correct-1"], JSON.stringify({ cluster_id: "cluster-9" }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /corrected r-correct-1 \(included_in_gate=true, cluster_id=cluster-9\)/);
  });
});

describe("response-gate-status CLI", () => {
  test("reports opened state with opened_at once the gate has fired", () => {
    seedResponseGateOpen();
    const r = runCmd("response-gate-status", []);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /response gate: opened -- 20\/20 eligible unique respondents \(target 30\), opened/);
  });
});

// ==== stale rules_version at the phase3.ts entry point ====

describe("stale rules_version refusal (re-tests requireRulesVersionMatch at this new CLI entry point)", () => {
  test("a venture kicked off under a different rules_version is refused, naming both versions", () => {
    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: "some-old-venture-rules-version" }, "t0");
    const r = runCmd("list", []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /venture rules version mismatch/);
    assert.match(r.stderr, /some-old-venture-rules-version/);
  });
});

// ==== approve/discard/restore/list reuse (artifact-lifecycle.ts, exercised end-to-end here) ====

describe("approve/discard/restore/list reuse", () => {
  test("approving a delivery_mode:none artifact through the real CLI path lands on not_applicable, not ready", () => {
    // Regression test: cmdApprove used to hardcode delivery_status:"ready" for every artifact,
    // including delivery_mode:"none" ones (Phase 3's product-outline/price-decision). Since these
    // never go through a delivery step, "ready" could never advance to "live_confirmed", so
    // state.ts's completion check (which requires not_applicable for delivery_mode:"none") saw
    // them as permanently incomplete -- checkpoint-3 could never clear through the real approve
    // path. seedOutlineApproved() already calls the real "approve" command; this asserts its
    // actual delivery_status instead of only checking the command exited 0.
    seedOutlineApproved();
    const outline = readArtifact(SLUG, "p3-product-outline");
    assert.equal(outline?.delivery_mode, "none");
    assert.equal(outline?.editorial_status, "approved");
    assert.equal(outline?.delivery_status, "not_applicable");
  });

  test("approve, discard, and restore round-trip a Phase 3 artifact via the shared artifact-lifecycle commands", () => {
    seedOutlineApproved();
    const discardResult = runCmd("discard", ["p3-product-outline"]);
    assert.equal(discardResult.status, 0);
    assert.equal(readArtifact(SLUG, "p3-product-outline")?.editorial_status, "discarded");

    const restoreResult = runCmd("restore", ["p3-product-outline"]);
    assert.equal(restoreResult.status, 0);
    assert.equal(readArtifact(SLUG, "p3-product-outline")?.editorial_status, "draft");

    const listResult = runCmd("list", []);
    assert.equal(listResult.status, 0);
    assert.match(listResult.stdout, /p3-product-outline\s+product-outline/);
  });
});
