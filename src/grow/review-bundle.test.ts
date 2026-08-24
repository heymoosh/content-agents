import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrowReviewBundle,
  type GrowReviewBundleInput,
} from "./review-bundle.js";

const refs = {
  source: { recordType: "source", id: "source-1", relation: "origin" },
  cut: { recordType: "cut", id: "cut-1", relation: "selected-from-source" },
  variant: { recordType: "variant", id: "variant-1", relation: "formatted-cut" },
  publish: { recordType: "publish", id: "publish-1", relation: "delivery-record" },
} as const;

const lineage = [
  refs.variant,
  refs.source,
  refs.publish,
  refs.cut,
] as const;

function bundle(overrides: Partial<GrowReviewBundleInput> = {}): GrowReviewBundleInput {
  return {
    id: "bundle-1",
    sourceRef: refs.source,
    cutRef: refs.cut,
    variantRefs: [refs.variant],
    publishRefs: [refs.publish],
    lineage,
    evidenceStatus: "supported",
    evidenceRefs: ["evidence-z", "evidence-a", "evidence-a"],
    voiceCheck: "passed",
    originalityCheck: "passed",
    humanDecision: {
      status: "candidate",
      decidedBy: null,
      decidedAt: null,
      note: null,
    },
    readiness: {
      status: "ready",
      blockingFields: [],
      reason: "All prerequisites are present.",
    },
    ...overrides,
  };
}

describe("buildGrowReviewBundle", () => {
  test("normalizes a reference-only candidate and preserves lineage/evidence/readiness", () => {
    const result = buildGrowReviewBundle(bundle());

    assert.equal(result.version, "grow-review-bundle-v1");
    assert.equal(result.status, "candidate");
    assert.deepEqual(result.sourceRef, refs.source);
    assert.deepEqual(result.cutRef, refs.cut);
    assert.deepEqual(result.variantRefs, [refs.variant]);
    assert.deepEqual(result.publishRefs, [refs.publish]);
    assert.deepEqual(result.lineage, [refs.cut, refs.publish, refs.source, refs.variant]);
    assert.deepEqual(result.evidenceRefs, ["evidence-a", "evidence-z"]);
    assert.equal(result.evidenceStatus, "supported");
    assert.equal(result.voiceCheck, "passed");
    assert.equal(result.originalityCheck, "passed");
    assert.equal(result.readiness.status, "blocked");
    assert.deepEqual(result.readiness.blockingFields, ["humanReview"]);
    assert.equal(result.generatesCopy, false);
    assert.equal(result.sideEffects, "none");
    assert.equal("copy" in result, false);
    assert.equal("body" in result, false);
  });

  test("approves only with complete evidence, checks, lineage, and an explicit human decision", () => {
    const result = buildGrowReviewBundle(bundle({
      humanDecision: {
        status: "approved",
        decidedBy: "muxin",
        decidedAt: "2026-08-23T15:00:00.000Z",
        note: "Approved for the declared treatment.",
      },
    }));

    assert.equal(result.status, "approved");
    assert.equal(result.readiness.status, "ready");
    assert.deepEqual(result.readiness.blockingFields, []);
    assert.deepEqual(result.humanDecision, {
      status: "approved",
      decidedBy: "muxin",
      decidedAt: "2026-08-23T15:00:00.000Z",
      note: "Approved for the declared treatment.",
    });
  });

  test("keeps approval blocked for non-Muxin decisions or incomplete lineage", () => {
    assert.throws(
      () => buildGrowReviewBundle(bundle({
        humanDecision: {
          status: "approved",
          decidedBy: "system",
          decidedAt: "2026-08-23T15:00:00.000Z",
          note: null,
        },
      })),
      /muxin/i,
    );
    assert.throws(
      () => buildGrowReviewBundle(bundle({
        lineage: null,
        humanDecision: {
          status: "approved",
          decidedBy: "muxin",
          decidedAt: "2026-08-23T15:00:00.000Z",
          note: null,
        },
      })),
      /lineage/i,
    );
  });

  test("allows shorthand lineage IDs while preserving a blocked state when required IDs are absent", () => {
    const result = buildGrowReviewBundle(bundle({
      lineage: { sourceId: "source-1", cutId: "cut-1", variantId: "variant-1" },
      humanDecision: {
        status: "approved",
        decidedBy: "muxin",
        decidedAt: "2026-08-23T15:00:00.000Z",
        note: null,
      },
    }));
    assert.equal(result.readiness.status, "ready");
    assert.deepEqual(result.lineage, [
      { recordType: "cut", id: "cut-1", relation: null },
      { recordType: "source", id: "source-1", relation: null },
      { recordType: "variant", id: "variant-1", relation: null },
    ]);
  });

  test("refuses an asserted approval when evidence, originality, voice, or human review is missing", () => {
    for (const [field, value, message] of [
      ["evidenceStatus", "blocked", /evidence/i],
      ["evidenceRefs", [], /evidence/i],
      ["voiceCheck", "pending", /voice/i],
      ["originalityCheck", "not-run", /originality/i],
      ["humanDecision", { status: "candidate", decidedBy: null, decidedAt: null, note: null }, /human review/i],
    ] as const) {
      const overrides: Partial<GrowReviewBundleInput> = { [field]: value };
      if (field !== "humanDecision") {
        overrides.humanDecision = {
          status: "approved",
          decidedBy: "muxin",
          decidedAt: "2026-08-23T15:00:00.000Z",
          note: null,
        };
      } else {
        overrides.humanDecision = null;
        overrides.status = "approved";
      }
      assert.throws(
        () => buildGrowReviewBundle(bundle(overrides)),
        message,
        `expected ${field} to block approval`,
      );
    }
  });

  test("keeps rejected and needs-another-pass as explicit human outcomes", () => {
    for (const status of ["rejected", "needs-another-pass"] as const) {
      const result = buildGrowReviewBundle(bundle({
        evidenceStatus: "blocked",
        evidenceRefs: [],
        humanDecision: {
          status,
          decidedBy: "muxin",
          decidedAt: "2026-08-23T15:00:00.000Z",
          note: status === "rejected" ? "Not a fit." : "Rework the cut.",
        },
      }));

      assert.equal(result.status, status);
      assert.equal(result.humanDecision.status, status);
      assert.equal(result.readiness.status, "blocked");
      assert.ok(result.readiness.blockingFields.includes("evidenceStatus"));
    }
  });

  test("uses explicit null/blocked states and is deterministic for reordered inputs", () => {
    const first = buildGrowReviewBundle(bundle({
      publishRefs: null,
      evidenceStatus: undefined,
      evidenceRefs: undefined,
      lineage: null,
      voiceCheck: undefined,
      originalityCheck: undefined,
      readiness: null,
    }));
    const second = buildGrowReviewBundle({
      ...bundle({
        publishRefs: [],
        evidenceStatus: "blocked",
        evidenceRefs: [],
        lineage: [],
        voiceCheck: "pending",
        originalityCheck: "pending",
        readiness: { status: "blocked", blockingFields: ["lineage"], reason: "Missing lineage." },
      }),
      variantRefs: [{ ...refs.variant }],
    });

    assert.equal(first.publishRefs, null);
    assert.equal(first.lineage, null);
    assert.equal(first.evidenceStatus, "blocked");
    assert.deepEqual(first.evidenceRefs, []);
    assert.equal(first.voiceCheck, "pending");
    assert.equal(first.originalityCheck, "pending");
    assert.equal(first.readiness.status, "blocked");
    assert.deepEqual(first, second);
  });
});
