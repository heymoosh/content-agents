import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createGrowVariantManifest, type GrowTreatmentDefinition } from "./variants.js";

const plan = {
  source: {
    descriptor: { kind: "local-file", path: "content/essay/source.md" },
    preservation: "required",
    provenance: "descriptor-retained",
  },
  platforms: ["x", "substack"],
  reviewGate: { required: true, before: "publish", approvalOwner: "human" },
  experiment: {
    variables: [
      { name: "format", options: ["post", "thread"] },
    ],
  },
} as const;

describe("createGrowVariantManifest", () => {
  test("keeps the existing planning-only expansion contract", () => {
    const treatments: GrowTreatmentDefinition[] = [
      { id: "short-text", medium: "text", formats: ["thread", "post"], reason: "Match the platform's native reading pattern." },
      { id: "voice", medium: "audio", format: "short", reason: "Test whether spoken delivery changes response quality." },
    ];

    const manifest = createGrowVariantManifest(plan, treatments);

    assert.equal(manifest.candidates.length, 6);
    assert.deepEqual(
      manifest.candidates.map(({ platform, medium, format }) => `${platform}/${medium}/${format}`),
      [
        "substack/audio/short",
        "substack/text/post",
        "substack/text/thread",
        "x/audio/short",
        "x/text/post",
        "x/text/thread",
      ],
    );
    assert.equal(manifest.candidates[0]?.status, "needs-human-review");
    assert.match(manifest.candidates[0]?.reviewRequirement ?? "", /human/i);
    assert.equal(manifest.generatesCopy, false);
    assert.equal(manifest.sideEffects, "none");
    assert.equal("copy" in (manifest.candidates[0] ?? {}), false);
  });

  test("carries and normalizes the evidence-aware blueprint handoff", () => {
    const [candidate] = createGrowVariantManifest(plan, [{
      id: "patterned-post",
      medium: "text",
      format: "post",
      reason: " Use the observed question-led opener structure. ",
      evidenceStatus: "supported",
      audienceScope: " independent builders ",
      cta: " reply ",
      responseIntent: " Invite a concrete example. ",
      experimentId: " exp-7 ",
      voiceCheck: "pending",
      originalityCheck: "passed",
      patternRefs: [" pattern-7", "pattern-7"],
      evidenceRefs: [" evidence-2", "evidence-1"],
      patternEvidenceRefs: [{
        patternId: "pattern-7",
        sourceId: "source-2",
        evidenceLocation: " lines 9-11 ",
        pool: "niche",
        scope: " topic sample ",
        metricSnapshot: {
          denominator: 10,
          name: "replies",
          numerator: 3,
          observedAt: "2026-08-20",
          scope: "topic sample",
          window: "2026-08-01/2026-08-20",
        },
        selectionRule: " strong reply rate ",
        originalityReview: "passed",
        caveats: [" sample is small ", "sample is small"],
      }],
      experimentVariables: { length: "short", opener: "question" },
    }]).candidates;

    assert.equal(candidate?.evidenceStatus, "supported");
    assert.equal(candidate?.audienceScope, "independent builders");
    assert.equal(candidate?.cta, "reply");
    assert.equal(candidate?.responseIntent, "Invite a concrete example.");
    assert.equal(candidate?.experimentId, "exp-7");
    assert.equal(candidate?.voiceCheck, "pending");
    assert.equal(candidate?.originalityCheck, "passed");
    assert.deepEqual(candidate?.patternRefs, ["pattern-7"]);
    assert.deepEqual(candidate?.evidenceRefs, ["evidence-1", "evidence-2"]);
    assert.deepEqual(candidate?.patternEvidenceRefs, [{
      patternId: "pattern-7",
      sourceId: "source-2",
      evidenceLocation: "lines 9-11",
      pool: "niche",
      scope: "topic sample",
      metricSnapshot: {
        denominator: 10,
        name: "replies",
        numerator: 3,
        observedAt: "2026-08-20",
        scope: "topic sample",
        window: "2026-08-01/2026-08-20",
      },
      selectionRule: "strong reply rate",
      originalityReview: "passed",
      caveats: ["sample is small"],
    }]);
    assert.deepEqual(candidate?.experimentVariables, {
      format: "post",
      length: "short",
      medium: "text",
      opener: "question",
      platform: "substack",
    });
    assert.deepEqual(candidate?.humanGate, {
      required: true,
      before: "publish",
      approvalOwner: "human",
      status: "pending",
    });
    assert.equal(candidate?.readiness.status, "blocked");
    assert.ok(candidate?.readiness.blockingFields.includes("voiceCheck"));
    assert.ok(candidate?.readiness.blockingFields.includes("humanGate"));
  });

  test("marks omitted evidence and review decisions blocked instead of ready", () => {
    const [candidate] = createGrowVariantManifest(plan, [{
      medium: "text",
      format: "post",
      reason: "Baseline treatment.",
    }]).candidates;

    assert.equal(candidate?.evidenceStatus, "blocked");
    assert.equal(candidate?.audienceScope, null);
    assert.equal(candidate?.cta, "none");
    assert.equal(candidate?.responseIntent, null);
    assert.equal(candidate?.experimentId, null);
    assert.equal(candidate?.voiceCheck, "pending");
    assert.equal(candidate?.originalityCheck, "pending");
    assert.equal(candidate?.readiness.status, "blocked");
    assert.ok(candidate?.readiness.blockingFields.includes("evidenceStatus"));
    assert.ok(candidate?.readiness.blockingFields.includes("audienceScope"));
    assert.ok(candidate?.readiness.blockingFields.includes("responseIntent"));
    assert.ok(candidate?.readiness.blockingFields.includes("experimentId"));
    assert.ok(candidate?.readiness.blockingFields.includes("humanGate"));
  });

  test("rejects invalid evidence or human-review states and incomplete source refs", () => {
    const base = { medium: "text", format: "post", reason: "Baseline treatment." };

    assert.throws(
      () => createGrowVariantManifest(plan, [{ ...base, evidenceStatus: "invented" as "supported" }]),
      /evidence status/i,
    );
    assert.throws(
      () => createGrowVariantManifest(plan, [{ ...base, voiceCheck: "approved" as "pending" }]),
      /voice check/i,
    );
    assert.throws(
      () => createGrowVariantManifest(plan, [{
        ...base,
        patternEvidenceRefs: [{
          patternId: "pattern-7",
          sourceId: "",
          evidenceLocation: "lines 1-2",
          pool: "niche",
          scope: "topic sample",
          metricSnapshot: { name: "replies" },
          selectionRule: "top examples",
          originalityReview: "pending",
          caveats: [],
        }],
      }]),
      /source id/i,
    );
    assert.throws(
      () => createGrowVariantManifest(plan, [{
        ...base,
        patternEvidenceRefs: [{
          patternId: "pattern-7",
          sourceId: "source-7",
          evidenceLocation: "lines 1-2",
          pool: "niche",
          scope: "topic sample",
          metricSnapshot: { name: "replies" },
          selectionRule: "top examples",
          originalityReview: "pending",
          caveats: [],
        }],
      }]),
      /metric snapshot/i,
    );
  });

  test("is deterministic for reordered treatments, refs, and variables", () => {
    const one = createGrowVariantManifest(plan, [{
      id: "test",
      medium: "text",
      formats: ["thread", "post"],
      reason: "Compare two formats.",
      evidenceStatus: "hypothesis",
      audienceScope: "builders",
      cta: "none",
      responseIntent: "Observe unsolicited replies.",
      experimentId: "exp-1",
      patternRefs: ["p2", "p1"],
      evidenceRefs: ["e2", "e1"],
      experimentVariables: { z: "last", a: "first" },
    }]);
    const two = createGrowVariantManifest(plan, [{
      experimentVariables: { a: "first", z: "last" },
      evidenceRefs: ["e1", "e2"],
      patternRefs: ["p1", "p2"],
      experimentId: " exp-1 ",
      responseIntent: "Observe unsolicited replies.",
      cta: " none ",
      audienceScope: " builders ",
      evidenceStatus: "hypothesis",
      reason: "Compare two formats.",
      formats: ["post", "thread"],
      medium: "text",
      id: "test",
    }]);

    assert.deepEqual(one, two);
  });
});
