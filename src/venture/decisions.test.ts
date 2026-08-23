import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  writeDecision,
  selectDecision,
  readDecision,
  DecisionAlreadySelectedError,
  SystemSelectionRejectedError,
  UnknownOverlapRequiresRationaleError,
  type Candidate,
} from "./decisions.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

const SLUG = "zz-test-decisions";

beforeEach(useTempVentureRoot);

afterEach(clearTempVentureRoot);

function candidates(n: number, unknownIds: (string | null)[] = []): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    candidate_id: `idea-${i + 1}`,
    label: `idea ${i + 1}`,
    scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
    evidence_refs: ["intake:q11"],
    rationale: "test",
    unknown_id: unknownIds[i] ?? null,
  }));
}

describe("writeDecision", () => {
  test("starts awaiting_user with nothing selected", () => {
    const d = writeDecision(SLUG, {
      decision_id: "p1-ideas-01",
      decision_kind: "idea-ranking",
      rules_version: "v1",
      input_refs: [],
      candidates: candidates(10),
      recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"],
      at: "t0",
    });
    assert.equal(d.status, "awaiting_user");
    assert.deepEqual(d.selected_candidate_ids, []);
    assert.equal(d.selected_by, null);
  });
});

describe("selectDecision -- the G3 gate fix", () => {
  function seedTenIdeas(unknownIds: (string | null)[] = []) {
    return writeDecision(SLUG, {
      decision_id: "p1-ideas-01",
      decision_kind: "idea-ranking",
      rules_version: "v1",
      input_refs: [],
      candidates: candidates(10, unknownIds),
      recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"],
      at: "t0",
    });
  }

  test("selected_by 'system' is rejected outright -- nothing auto-selects", () => {
    seedTenIdeas();
    assert.throws(
      () =>
        selectDecision(SLUG, "p1-ideas-01", {
          selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
          selectedBy: "system" as never,
          at: "t1",
        }),
      SystemSelectionRejectedError
    );
  });

  test("selectedBy 'muxin' with the required count succeeds", () => {
    seedTenIdeas();
    const d = selectDecision(SLUG, "p1-ideas-01", {
      selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
      selectedBy: "muxin",
      requiredSelectCount: 3,
      at: "t1",
    });
    assert.equal(d.status, "selected");
    assert.deepEqual(d.selected_candidate_ids, ["idea-1", "idea-2", "idea-3"]);
  });

  test("wrong candidate count is rejected when requiredSelectCount is enforced", () => {
    seedTenIdeas();
    assert.throws(() =>
      selectDecision(SLUG, "p1-ideas-01", {
        selectedCandidateIds: ["idea-1", "idea-2"],
        selectedBy: "muxin",
        requiredSelectCount: 3,
        at: "t1",
      })
    );
  });

  test("already-selected decision cannot be selected again -- immutable", () => {
    seedTenIdeas();
    selectDecision(SLUG, "p1-ideas-01", {
      selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
      selectedBy: "muxin",
      requiredSelectCount: 3,
      at: "t1",
    });
    assert.throws(
      () =>
        selectDecision(SLUG, "p1-ideas-01", {
          selectedCandidateIds: ["idea-4", "idea-5", "idea-6"],
          selectedBy: "muxin",
          requiredSelectCount: 3,
          at: "t2",
        }),
      DecisionAlreadySelectedError
    );
  });

  test("two selected ideas sharing an unknown_id without rationale is rejected", () => {
    seedTenIdeas(["u1", "u1", "u2"]);
    assert.throws(
      () =>
        selectDecision(SLUG, "p1-ideas-01", {
          selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
          selectedBy: "muxin",
          requiredSelectCount: 3,
          at: "t1",
        }),
      UnknownOverlapRequiresRationaleError
    );
  });

  test("the same overlap WITH a rationale is accepted and recorded", () => {
    seedTenIdeas(["u1", "u1", "u2"]);
    const d = selectDecision(SLUG, "p1-ideas-01", {
      selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
      selectedBy: "muxin",
      requiredSelectCount: 3,
      rationale: "deliberately testing u1 twice from two angles",
      at: "t1",
    });
    assert.equal(d.rationale, "deliberately testing u1 twice from two angles");
  });

  test("no overlap needs no rationale", () => {
    seedTenIdeas(["u1", "u2", "u3"]);
    const d = selectDecision(SLUG, "p1-ideas-01", {
      selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
      selectedBy: "muxin",
      requiredSelectCount: 3,
      at: "t1",
    });
    assert.equal(d.status, "selected");
  });

  test("readDecision reflects the selection after selectDecision", () => {
    seedTenIdeas(["u1", "u2", "u3"]);
    selectDecision(SLUG, "p1-ideas-01", {
      selectedCandidateIds: ["idea-1", "idea-2", "idea-3"],
      selectedBy: "muxin",
      requiredSelectCount: 3,
      at: "t1",
    });
    const d = readDecision(SLUG, "p1-ideas-01");
    assert.equal(d?.selected_by, "muxin");
  });
});
