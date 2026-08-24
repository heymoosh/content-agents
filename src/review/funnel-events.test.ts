import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  assessFunnelEvent,
  normalizeFunnelEvent,
  type FunnelEventInput,
  type FunnelEventType,
} from "./funnel-events.js";

const lineage = [
  { recordType: "variant", id: "variant-1", relation: "published-as" },
  { recordType: "experiment", id: "experiment-1", relation: "measured-by" },
];

function event(overrides: Partial<FunnelEventInput> = {}): FunnelEventInput {
  return {
    id: " funnel-1 ",
    eventType: "purchase",
    occurredAt: "2026-08-24T15:00:00.000Z",
    collectedAt: "2026-08-24T15:01:00.000Z",
    respondentHash: null,
  value: null,
  sourceNote: "checkout confirmation supplied by the operator",
  status: "observed",
    attribution: [{
      contentItemId: "post-1",
      touchType: "last",
      touchAt: "2026-08-24T14:59:00.000Z",
      confidence: "medium",
      unattributedReason: null,
    }],
    evidenceRefs: [" evidence:z ", "evidence:a", "evidence:z"],
    lineage,
    ...overrides,
  };
}

describe("normalizeFunnelEvent", () => {
  test("supports every canonical event type without changing the event family", () => {
    const types: FunnelEventType[] = [
      "visit",
      "opt_in",
      "survey_response",
      "qualified_inquiry",
      "call",
      "opportunity",
      "purchase",
    ];

    for (const eventType of types) {
      const normalized = normalizeFunnelEvent(event({ eventType }));
      assert.equal(normalized.kind, "funnel_event");
      assert.equal(normalized.eventType, eventType);
    }
  });

  test("normalizes all touch types and enforces the explicit unknown shape", () => {
    for (const touchType of ["first", "last", "assisted", "self_reported"] as const) {
      const normalized = normalizeFunnelEvent(event({
        attribution: [{
          contentItemId: " content-1 ",
          touchType,
          touchAt: "2026-08-24T14:59:00.000Z",
          confidence: "high",
          unattributedReason: null,
        }],
      }));
      assert.deepEqual(normalized.attribution[0], {
        contentItemId: "content-1",
        touchType,
        touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "high",
        unattributedReason: null,
      });
    }

    const unknown = normalizeFunnelEvent(event({
      attribution: [{
        contentItemId: null,
        touchType: "unknown",
        touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "low",
        unattributedReason: "no referrer was captured",
      }],
    }));
    assert.deepEqual(unknown.attribution[0], {
      contentItemId: null,
      touchType: "unknown",
      touchAt: "2026-08-24T14:59:00.000Z",
      confidence: "low",
      unattributedReason: "no referrer was captured",
    });
  });

  test("preserves null value, explicit lineage, and sorted unique evidence refs", () => {
    const normalized = normalizeFunnelEvent(event());

    assert.equal(normalized.id, "funnel-1");
    assert.equal(normalized.value, null);
    assert.equal(normalized.status, "observed");
    assert.deepEqual(normalized.evidenceRefs, ["evidence:a", "evidence:z"]);
    assert.deepEqual(normalized.lineage, lineage);
    assert.equal(normalized.sideEffects, "none");
    assert.equal("winner" in normalized, false);
    assert.equal("demand" in normalized, false);
  });

  test("normalization is deterministic and does not mutate caller-owned arrays", () => {
    const input = event({
      evidenceRefs: ["evidence:z", "evidence:a", "evidence:z"],
      lineage: [...lineage].reverse(),
    });
    const first = normalizeFunnelEvent(input);
    const second = normalizeFunnelEvent(input);

    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.deepEqual(input.evidenceRefs, ["evidence:z", "evidence:a", "evidence:z"]);
    assert.deepEqual(input.lineage, [...lineage].reverse());
  });

  test("rejects invalid ids, dates, enums, and attribution pairings", () => {
    const invalid: Array<[string, FunnelEventInput, RegExp]> = [
      ["event id", event({ id: "   " }), /id.*required/i],
      ["event date", event({ occurredAt: "yesterday" }), /occurredAt.*ISO|valid/i],
      ["collection date", event({ collectedAt: "2026-99-99T00:00:00Z" }), /collectedAt.*ISO|valid/i],
      ["event status", event({ status: "   " }), /status.*required/i],
      ["event type", event({ eventType: "like" as FunnelEventType }), /eventType.*one of/i],
      ["touch type", event({ attribution: [{
        contentItemId: "post-1", touchType: "assist" as never,
        touchAt: "2026-08-24T14:59:00.000Z", confidence: "medium", unattributedReason: null,
      }] }), /touchType.*one of/i],
      ["unknown content", event({ attribution: [{
        contentItemId: "post-1", touchType: "unknown", touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "low", unattributedReason: "no referrer",
      }] }), /unknown.*contentItemId.*null/i],
      ["unknown reason", event({ attribution: [{
        contentItemId: null, touchType: "unknown", touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "low", unattributedReason: null,
      }] }), /require.*unattributedReason/i],
      ["known content", event({ attribution: [{
        contentItemId: null, touchType: "last", touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "medium", unattributedReason: "not applicable",
      }] }), /require.*contentItemId/i],
      ["known reason", event({ attribution: [{
        contentItemId: "post-1", touchType: "last", touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "medium", unattributedReason: "should be null",
      }] }), /unattributedReason.*null/i],
    ];

    for (const [label, input, matcher] of invalid) {
      assert.throws(() => normalizeFunnelEvent(input), matcher, label);
    }
  });
});

describe("assessFunnelEvent", () => {
  test("reports a complete event as ready without inferring a winner or demand", () => {
    const assessment = assessFunnelEvent(normalizeFunnelEvent(event()));

    assert.deepEqual(assessment, { status: "ready", blockers: [] });
  });

  test("blocks missing evidence, lineage, and explicit attribution conservatively", () => {
    const normalized = normalizeFunnelEvent(event({
      evidenceRefs: [],
      lineage: null,
      attribution: [],
    }));
    const assessment = assessFunnelEvent(normalized);

    assert.equal(assessment.status, "blocked");
    assert.deepEqual(assessment.blockers, [
      "attribution is missing",
      "evidenceRefs are missing",
      "lineage is missing",
    ]);
  });

  test("does not treat a low-confidence or unknown touch as a readiness failure", () => {
    const assessment = assessFunnelEvent(normalizeFunnelEvent(event({
      attribution: [{
        contentItemId: null,
        touchType: "unknown",
        touchAt: "2026-08-24T14:59:00.000Z",
        confidence: "low",
        unattributedReason: "homepage visit did not identify a post",
      }],
    })));

    assert.deepEqual(assessment, { status: "ready", blockers: [] });
  });
});
