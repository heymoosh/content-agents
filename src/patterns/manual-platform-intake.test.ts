import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildManualPlatformIntake,
  type ManualMetricSnapshotInput,
  type ManualPlatformIntakeInput,
} from "./manual-platform-intake.js";

const SECRET_BODY = "PRIVATE CREATOR BODY MUST NOT CROSS THIS ADAPTER";

const METRIC_SNAPSHOT: ManualMetricSnapshotInput = {
  metric: "views",
  value: 2400,
  unit: "count",
  numerator: 2400,
  denominator: 12000,
  window: "lifetime",
  scope: "post",
  observedAt: "2026-08-20",
};

function observation(overrides: Partial<ManualPlatformIntakeInput> = {}): ManualPlatformIntakeInput {
  return {
    accountId: " account-1 ",
    postId: " post-1 ",
    platform: "  collectorless-platform  ",
    handle: " @maker ",
    creator: " The Maker ",
    topics: [" civic technology ", "human inference"],
    focus: [" decisions ", "evidence"],
    audienceSnapshot: {
      size: 12000,
      countType: "followers",
      observedAt: "2026-08-20",
      collectedAt: "2026-08-21T12:00:00Z",
      evidenceSource: "profile snapshot",
    },
    medium: " text ",
    format: " short-post ",
    url: " https://example.test/posts/1 ",
    evidenceRefs: [" ref-z ", "ref-a"],
    pool: "niche",
    scope: "niche",
    membershipReason: "The operator selected this post for the named niche question.",
    collectionStatus: "observed",
    metricSnapshot: METRIC_SNAPSHOT,
    observedAt: " 2026-08-20 ",
    collectedAt: " 2026-08-21T12:00:00Z ",
    caveats: [" public count is a snapshot ", "manual transcription not used"],
    body: SECRET_BODY,
    ...overrides,
  };
}

describe("manual platform intake", () => {
  test("keeps valid niche, broad, and format observations explicitly represented", () => {
    for (const pool of ["niche", "broad", "format"] as const) {
      const result = buildManualPlatformIntake(observation({ pool, scope: pool }));

      assert.equal(result.pool, pool);
      assert.equal(result.scope, pool);
      assert.deepEqual(result.readiness, { status: "ready", blockers: [] });
      assert.equal(result.provenance, "manual-operator");
      assert.equal(result.bodyIncluded, false);
      assert.equal(result.sideEffects, "none");
    }
  });

  test("reports missing denominator, URL, and evidence blockers without inventing values", () => {
    const result = buildManualPlatformIntake(observation({
      url: "",
      evidenceRefs: [],
      metricSnapshot: {
        ...METRIC_SNAPSHOT,
        denominator: null,
      },
    }));

    assert.equal(result.url, null);
    assert.ok(result.metricSnapshot && result.metricSnapshot !== "unknown");
    assert.equal(result.metricSnapshot.denominator, null);
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("url"));
    assert.ok(result.readiness.blockers.includes("evidenceRefs"));
    assert.ok(result.readiness.blockers.includes("metricSnapshot.denominator"));
  });

  test("normalization is deterministic, sorted, and does not mutate the input", () => {
    const firstInput = observation({
      topics: ["zeta", " alpha ", "zeta"],
      focus: ["beta", " alpha ", "beta"],
      evidenceRefs: ["z-ref", "a-ref", "z-ref"],
      caveats: ["z caveat", "a caveat", "z caveat"],
    });
    const secondInput = observation({
      topics: [" alpha ", "zeta"],
      focus: [" alpha ", "beta"],
      evidenceRefs: ["a-ref", "z-ref"],
      caveats: ["a caveat", "z caveat"],
    });
    const firstBefore = JSON.stringify(firstInput);

    const first = buildManualPlatformIntake(firstInput);
    const second = buildManualPlatformIntake(secondInput);

    assert.deepEqual(first, second);
    assert.deepEqual(first.topics, ["alpha", "zeta"]);
    assert.deepEqual(first.focus, ["alpha", "beta"]);
    assert.deepEqual(first.evidenceRefs, ["a-ref", "z-ref"]);
    assert.deepEqual(first.caveats, ["a caveat", "z caveat"]);
    assert.equal(JSON.stringify(firstInput), firstBefore);
  });

  test("discards optional body input and never emits it", () => {
    const result = buildManualPlatformIntake(observation({ body: SECRET_BODY }));
    const serialized = JSON.stringify(result);

    assert.equal(Object.hasOwn(result, "body"), false);
    assert.equal(serialized.includes(SECRET_BODY), false);
    assert.equal(result.bodyIncluded, false);
  });

  test("keeps an unsupported platform as a manual observation instead of rejecting it", () => {
    const result = buildManualPlatformIntake(observation({ platform: "never-seen-before" }));

    assert.equal(result.platform, "never-seen-before");
    assert.equal(result.collectionMethod, "manual");
    assert.equal(result.provenance, "manual-operator");
    assert.equal(result.readiness.status, "ready");
  });

  test("does not infer missing collection status or comparison scope", () => {
    const result = buildManualPlatformIntake(observation({ scope: undefined, collectionStatus: undefined }));

    assert.equal(result.pool, "niche");
    assert.equal(result.scope, null);
    assert.equal(result.collectionStatus, null);
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("collectionStatus"));
  });

  test("does not infer scope from a pool-only selectionScope object", () => {
    const result = buildManualPlatformIntake(observation({
      scope: undefined,
      selectionScope: { pool: "niche" },
    }));

    assert.equal(result.pool, "niche");
    assert.equal(result.scope, null);
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("scope"));
  });

  test("preserves explicit nested format, media, evidence, and collection metadata", () => {
    const result = buildManualPlatformIntake({
      account: {
        id: "account-nested",
        platform: "threads",
        handle: "@nested",
        creator: "Nested Creator",
        topics: ["civic technology"],
        focus: ["evidence"],
        audienceSnapshot: {
          size: 5000,
          countType: "followers",
          observedAt: "2026-08-20",
          collectedAt: "2026-08-21",
          evidenceSource: "profile snapshot",
        },
      },
      post: {
        id: "post-nested",
        url: "https://example.test/nested",
        observedAt: "2026-08-20",
        collectedAt: "2026-08-21",
      },
      format: { medium: "image", format: "carousel" },
      media: {
        form: "carousel",
        onscreen_text: "EXPLICIT TITLE",
        description: "four observed slides",
        media_count: 4,
        aspect: "square",
        asset_url: "https://example.test/nested.jpg",
      },
      evidence: {
        evidenceLinks: ["evidence:nested"],
        pool: "format",
        membershipReason: "The operator selected this carousel for format mechanics.",
        metricSnapshot: METRIC_SNAPSHOT,
        popularityScope: "format examples",
        sampleScope: "manual selection",
        baselineScope: "not measured",
        baselineSource: "not collected",
      },
      lineage: [{ recordType: "post", id: "post-nested", relation: "observed" }],
      caveats: [],
      collection: { status: "partial", caveats: ["slide text was observed manually"] },
    });

    assert.equal(result.accountId, "account-nested");
    assert.equal(result.postId, "post-nested");
    assert.equal(result.medium, "image");
    assert.equal(result.format, "carousel");
    assert.deepEqual(result.evidenceLinks, ["evidence:nested"]);
    assert.deepEqual(result.evidence.evidenceLinks, ["evidence:nested"]);
    assert.equal(result.evidence.bodyComplete, false);
    assert.deepEqual(result.lineage, [{ recordType: "post", id: "post-nested", relation: "observed" }]);
    assert.deepEqual(result.evidence.lineage, result.lineage);
    assert.equal(Object.hasOwn(result.evidence, "body"), false);
    assert.equal(result.pool, "format");
    assert.equal(result.media?.form, "carousel");
    assert.equal(result.media?.media_count, 4);
    assert.equal(result.media?.body_is_complete, false);
    assert.equal(result.collectionStatus, "partial");
    assert.deepEqual(result.collectionCaveats, ["slide text was observed manually"]);
    assert.equal(result.collection.status, "partial");
    assert.equal(result.bodyComplete, false);
  });

  test("does not collapse an explicitly supplied scope into the pool", () => {
    const result = buildManualPlatformIntake(observation({ pool: "niche", scope: "broad" }));

    assert.equal(result.pool, "niche");
    assert.equal(result.scope, "broad");
  });

  test("keeps an unrecognized media form unresolved instead of inventing a canonical form", () => {
    const result = buildManualPlatformIntake(observation({ media: { form: "unrecognized-form" } }));

    assert.equal(result.media?.form, null);
    assert.ok(result.readiness.blockers.includes("media.form"));
  });
});
