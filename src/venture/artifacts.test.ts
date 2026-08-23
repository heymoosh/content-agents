import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createArtifact,
  transitionArtifact,
  updateArtifactFields,
  readArtifact,
  readArtifacts,
  readyForDelivery,
  isValidCombination,
  InvalidTransitionError,
  type VentureArtifact,
} from "./artifacts.js";
import { loadRules, type VentureRules } from "./rules.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

const SLUG = "zz-test-artifacts";
let rules: VentureRules;

beforeEach(useTempVentureRoot);

beforeEach(() => {
  rules = loadRules();
});

afterEach(clearTempVentureRoot);

function baseInput(overrides: Partial<Parameters<typeof createArtifact>[2]> = {}) {
  return {
    artifact_id: "p1-idea-01",
    phase: 1,
    artifact_kind: "substack-post" as const,
    title: "test post",
    venture_id: SLUG,
    venture_phase: 1,
    message_id: "msg-idea-01",
    at: "2026-08-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("isValidCombination -- full editorial x delivery matrix", () => {
  const valid: [string, string][] = [
    ["draft", "not_applicable"],
    ["draft", "awaiting_approval"],
    ["approved", "ready"],
    ["approved", "handed_off"],
    ["approved", "live_confirmed"],
    ["approved", "failed"],
    ["approved", "not_applicable"],
    ["discarded", "cancelled"],
    ["discarded", "not_applicable"],
    ["discarded", "live_confirmed"],
  ];
  for (const [e, d] of valid) {
    test(`${e}:${d} is valid`, () => {
      assert.equal(isValidCombination(e as never, d as never), true);
    });
  }

  const invalid: [string, string][] = [
    ["approved", "awaiting_approval"],
    ["discarded", "ready"],
    ["discarded", "handed_off"],
    ["draft", "ready"],
    ["draft", "handed_off"],
    ["draft", "live_confirmed"],
  ];
  for (const [e, d] of invalid) {
    test(`${e}:${d} is invalid`, () => {
      assert.equal(isValidCombination(e as never, d as never), false);
    });
  }
});

describe("createArtifact -- stamps delivery_mode/publishable from the kind table", () => {
  test("substack-post: manual, not publishable, starts draft/awaiting_approval", () => {
    const a = createArtifact(SLUG, rules, baseInput());
    assert.equal(a.delivery_mode, "manual");
    assert.equal(a.publishable, false);
    assert.equal(a.editorial_status, "draft");
    assert.equal(a.delivery_status, "awaiting_approval");
  });

  test("text-post-note: app, publishable", () => {
    const a = createArtifact(SLUG, rules, baseInput({ artifact_id: "p1-idea-02", artifact_kind: "text-post-note" }));
    assert.equal(a.delivery_mode, "app");
    assert.equal(a.publishable, true);
  });

  test("phase_1_research_plan (delivery_mode none) starts not_applicable, not awaiting_approval", () => {
    const a = createArtifact(
      SLUG,
      rules,
      baseInput({ artifact_id: "p1-research-plan", artifact_kind: "phase_1_research_plan" })
    );
    assert.equal(a.delivery_mode, "none");
    assert.equal(a.delivery_status, "not_applicable");
  });

  test("claim_refs defaults to an empty array when omitted", () => {
    const a = createArtifact(SLUG, rules, baseInput());
    assert.deepEqual(a.claim_refs, []);
  });

  test("claim_refs is stored when provided", () => {
    const a = createArtifact(
      SLUG,
      rules,
      baseInput({ claim_refs: [{ claim: "built it in 4 days", ref: "intake:q17" }] })
    );
    assert.deepEqual(a.claim_refs, [{ claim: "built it in 4 days", ref: "intake:q17" }]);
  });
});

describe("transitionArtifact -- rejects invalid transitions, accepts valid ones", () => {
  test("draft:awaiting_approval -> approved:awaiting_approval is rejected (must move delivery too)", () => {
    createArtifact(SLUG, rules, baseInput());
    assert.throws(
      () => transitionArtifact(SLUG, "p1-idea-01", { editorial_status: "approved" }, "2026-08-19T01:00:00.000Z"),
      InvalidTransitionError
    );
  });

  test("draft:awaiting_approval -> approved:ready is accepted", () => {
    createArtifact(SLUG, rules, baseInput());
    const next = transitionArtifact(
      SLUG,
      "p1-idea-01",
      { editorial_status: "approved", delivery_status: "ready" },
      "2026-08-19T01:00:00.000Z"
    );
    assert.equal(next.editorial_status, "approved");
    assert.equal(next.delivery_status, "ready");
  });

  test("discarded:ready is rejected -- a discarded pending item must become cancelled, not stay ready", () => {
    createArtifact(SLUG, rules, baseInput());
    transitionArtifact(SLUG, "p1-idea-01", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    assert.throws(
      () => transitionArtifact(SLUG, "p1-idea-01", { editorial_status: "discarded" }, "t2"),
      InvalidTransitionError
    );
  });

  test("readArtifact returns the latest transition, not the original create", () => {
    createArtifact(SLUG, rules, baseInput());
    transitionArtifact(SLUG, "p1-idea-01", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    const a = readArtifact(SLUG, "p1-idea-01");
    assert.equal(a?.editorial_status, "approved");
  });

  test("readArtifacts folds to one row per artifact_id even with multiple transitions", () => {
    createArtifact(SLUG, rules, baseInput());
    transitionArtifact(SLUG, "p1-idea-01", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    transitionArtifact(SLUG, "p1-idea-01", { delivery_status: "handed_off" }, "t2");
    const all = readArtifacts(SLUG);
    assert.equal(all.length, 1);
    assert.equal(all[0].delivery_status, "handed_off");
  });
});

describe("updateArtifactFields -- structured-artifact field edits, separate from the state machine", () => {
  test("patches a key inside fields without touching editorial/delivery status", () => {
    createArtifact(
      SLUG,
      rules,
      baseInput({ artifact_id: "p1-plan", artifact_kind: "phase_1_research_plan", fields: { plan_version: 1 } })
    );
    const next = updateArtifactFields(SLUG, "p1-plan", { reviewed_by_muxin: true }, "t1");
    assert.equal(next.fields?.reviewed_by_muxin, true);
    assert.equal(next.fields?.plan_version, 1);
    assert.equal(next.editorial_status, "draft"); // untouched
  });

  test("readArtifact reflects the latest fields patch", () => {
    createArtifact(SLUG, rules, baseInput({ artifact_id: "p1-plan", artifact_kind: "phase_1_research_plan" }));
    updateArtifactFields(SLUG, "p1-plan", { reviewed_by_muxin: false }, "t1");
    updateArtifactFields(SLUG, "p1-plan", { reviewed_by_muxin: true }, "t2");
    const a = readArtifact(SLUG, "p1-plan");
    assert.equal(a?.fields?.reviewed_by_muxin, true);
  });
});

describe("readyForDelivery -- each condition alone is insufficient", () => {
  function withStatus(overrides: Partial<VentureArtifact>): VentureArtifact {
    return {
      artifact_id: "x",
      phase: 1,
      artifact_kind: "text-post-note",
      title: "t",
      body_path: null,
      checkpoint_id: null,
      fields: null,
      delivery_mode: "app",
      publishable: true,
      editorial_status: "approved",
      delivery_status: "ready",
      evidence: null,
      failure: null,
      origin_type: "venture",
      venture_id: SLUG,
      venture_phase: 1,
      message_id: "m",
      cta_id: null,
      rules_version: rules.rules_version,
      probe_id: null,
      unknown_id: null,
      claim_refs: [],
      created_at: "t",
      updated_at: "t",
      ...overrides,
    };
  }

  test("app-kind: approved + ready + publishable -> true", () => {
    assert.equal(readyForDelivery(withStatus({})), true);
  });

  test("app-kind: publishable false alone blocks it even if approved+ready", () => {
    assert.equal(readyForDelivery(withStatus({ publishable: false })), false);
  });

  test("app-kind: not approved blocks it even if ready+publishable", () => {
    assert.equal(readyForDelivery(withStatus({ editorial_status: "draft", delivery_status: "awaiting_approval" })), false);
  });

  test("app-kind: not ready blocks it even if approved+publishable", () => {
    assert.equal(readyForDelivery(withStatus({ delivery_status: "handed_off" })), false);
  });

  test("manual-kind (substack-post): approved + ready is sufficient despite publishable=false", () => {
    assert.equal(
      readyForDelivery(withStatus({ delivery_mode: "manual", publishable: false, artifact_kind: "substack-post" })),
      true
    );
  });

  test("manual-kind: not approved still blocks it", () => {
    assert.equal(
      readyForDelivery(
        withStatus({
          delivery_mode: "manual",
          publishable: false,
          artifact_kind: "substack-post",
          editorial_status: "draft",
          delivery_status: "awaiting_approval",
        })
      ),
      false
    );
  });

  test("none-kind is never deliverable", () => {
    assert.equal(
      readyForDelivery(withStatus({ delivery_mode: "none", publishable: false, delivery_status: "not_applicable" })),
      false
    );
  });
});
