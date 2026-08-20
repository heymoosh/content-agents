import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import {
  ingestResponse,
  correctResponse,
  readResponses,
  readResponse,
  countEligibleUnique,
  getResponseGateState,
  type ResponseRecord,
} from "./responses.js";
import { ventureDir } from "./paths.js";
import { hasCanonEvent, findCanonEvent, readCanonEvents } from "./canon.js";

const SLUG = "zz-test-responses";
const originalKey = process.env.RESEARCH_HASH_KEY;

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
  if (originalKey === undefined) delete process.env.RESEARCH_HASH_KEY;
  else process.env.RESEARCH_HASH_KEY = originalKey;
});

function baseInput(overrides: Partial<Parameters<typeof ingestResponse>[1]> = {}) {
  return {
    source: "survey" as const,
    receivedAt: "2026-08-19T00:00:00.000Z",
    targetAudienceEligible: true,
    exactQuote: "I waste an hour every week on this.",
    redactedQuote: "I waste [TIME] on this.",
    stuckPoint: "manual weekly cleanup",
    emotionalIntensity: "medium" as const,
    ...overrides,
  };
}

// ---- countEligibleUnique: pure, file-I/O-free ----

describe("countEligibleUnique", () => {
  function record(overrides: Partial<ResponseRecord>): ResponseRecord {
    return {
      response_id: "r-x",
      source: "survey",
      received_at: "t",
      respondent_hash: "hash-a",
      target_audience_eligible: true,
      exact_quote: "q",
      redacted_quote: "q",
      stuck_point: "s",
      desired_outcome: null,
      emotional_intensity: "low",
      cluster_id: null,
      included_in_gate: true,
      exclusion_reason: null,
      ...overrides,
    };
  }

  test("dedupes by respondent_hash", () => {
    const records = [
      record({ response_id: "r-1", respondent_hash: "h1" }),
      record({ response_id: "r-2", respondent_hash: "h1" }),
      record({ response_id: "r-3", respondent_hash: "h2" }),
    ];
    assert.equal(countEligibleUnique(records), 2);
  });

  test("excludes ineligible responses even if unique", () => {
    const records = [
      record({ response_id: "r-1", respondent_hash: "h1", target_audience_eligible: false }),
      record({ response_id: "r-2", respondent_hash: "h2" }),
    ];
    assert.equal(countEligibleUnique(records), 1);
  });

  test("excludes responses not included in the gate, regardless of eligibility", () => {
    const records = [
      record({ response_id: "r-1", respondent_hash: "h1", included_in_gate: false, exclusion_reason: "unverifiable" }),
      record({ response_id: "r-2", respondent_hash: "h2" }),
    ];
    assert.equal(countEligibleUnique(records), 1);
  });

  test("empty input counts zero", () => {
    assert.equal(countEligibleUnique([]), 0);
  });
});

// ---- ingestResponse ----

describe("ingestResponse", () => {
  test("writes a response record with a hashed respondent when a raw identifier is given, never persisting the raw value", () => {
    process.env.RESEARCH_HASH_KEY = "test-only-key";
    const { record } = ingestResponse(SLUG, baseInput({ rawIdentifier: { platform: "substack", stableUserId: "42" } }), "t0");
    assert.equal(record.target_audience_eligible, true);
    assert.equal(record.included_in_gate, true);
    assert.equal(record.exclusion_reason, null);
    assert.ok(/^[0-9a-f]{64}$/.test(record.respondent_hash), "expected a 64-hex-char HMAC-SHA256 digest");
    const raw = JSON.stringify(readResponses(SLUG));
    assert.ok(!raw.includes("42"), "raw identifier must never be persisted to responses.jsonl");
  });

  test("with no raw identifier, treats the response as its own unique respondent", () => {
    const a = ingestResponse(SLUG, baseInput(), "t0");
    const b = ingestResponse(SLUG, baseInput(), "t1");
    assert.notEqual(a.record.respondent_hash, b.record.respondent_hash);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 2);
  });

  test("same raw identifier across two ingests dedupes to one respondent and flags likely-duplicate", () => {
    process.env.RESEARCH_HASH_KEY = "test-only-key";
    const first = ingestResponse(SLUG, baseInput({ rawIdentifier: { platform: "substack", stableUserId: "7" } }), "t0");
    const second = ingestResponse(
      SLUG,
      baseInput({ source: "dm", rawIdentifier: { platform: "substack", stableUserId: "7" } }),
      "t1"
    );
    assert.equal(first.likelyDuplicate, false);
    assert.equal(second.likelyDuplicate, true);
    assert.equal(first.record.respondent_hash, second.record.respondent_hash);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 1);
  });

  test("an email identifier that only differs by case/whitespace still dedupes to one respondent", () => {
    // Regression test: respondentHash() hashes stableUserId byte-for-byte with no normalization,
    // so a human-transcribed email typed once as "Jane@Example.com" and once as
    // " jane@example.com " used to hash to two different respondents and over-count toward the
    // response gate. ingestResponse now canonicalizes (trim + lowercase) before hashing.
    process.env.RESEARCH_HASH_KEY = "test-only-key";
    const first = ingestResponse(SLUG, baseInput({ rawIdentifier: { platform: "email", stableUserId: "Jane@Example.com" } }), "t0");
    const second = ingestResponse(
      SLUG,
      baseInput({ source: "dm", rawIdentifier: { platform: "email", stableUserId: " jane@example.com " } }),
      "t1"
    );
    assert.equal(second.likelyDuplicate, true);
    assert.equal(first.record.respondent_hash, second.record.respondent_hash);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 1);
  });

  test("an explicit exclusion_reason marks the response excluded from the gate", () => {
    const { record } = ingestResponse(SLUG, baseInput({ exclusionReason: "ineligible", targetAudienceEligible: false }), "t0");
    assert.equal(record.included_in_gate, false);
    assert.equal(record.exclusion_reason, "ineligible");
    assert.equal(countEligibleUnique(readResponses(SLUG)), 0);
  });

  test("re-ingesting an existing response_id folds to one line and does not double-count it toward the gate", () => {
    for (let i = 0; i < 19; i++) {
      ingestResponse(SLUG, baseInput({ responseId: `r-dbl-${i}` }), `t${i}`);
    }
    assert.equal(getResponseGateState(SLUG).have, 19);
    // Re-ingest an existing id with no rawIdentifier -- naively appending the unfolded record
    // onto the pre-read `existing` array would mint a second, distinct no-id- hash for this same
    // response_id and misread as 20 unique respondents.
    ingestResponse(SLUG, baseInput({ responseId: "r-dbl-0" }), "t-reingest");
    const gate = getResponseGateState(SLUG);
    assert.equal(gate.have, 19, "a re-ingest of an existing response_id must fold, not double-count");
    assert.equal(gate.state, "closed");
  });
});

// ---- response gate state + response_gate_opened ledger event ----

describe("response gate", () => {
  function ingestNUniqueEligible(n: number, atPrefix: string) {
    for (let i = 0; i < n; i++) {
      ingestResponse(SLUG, baseInput({ responseId: `r-${atPrefix}-${i}` }), `${atPrefix}-${i}`);
    }
  }

  test("closed below 20 eligible unique respondents", () => {
    ingestNUniqueEligible(19, "a");
    const gate = getResponseGateState(SLUG);
    assert.equal(gate.state, "closed");
    assert.equal(gate.have, 19);
    assert.equal(gate.need, 20);
    assert.equal(gate.target, 30);
    assert.equal(gate.opened_at, null);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/response-gate-opened`), false);
  });

  test("opens exactly at 20 (19 -> 20 crossing) and records response_gate_opened", () => {
    ingestNUniqueEligible(19, "b");
    assert.equal(getResponseGateState(SLUG).state, "closed");
    ingestResponse(SLUG, baseInput({ responseId: "r-b-20th" }), "t-20th");
    const gate = getResponseGateState(SLUG);
    assert.equal(gate.state, "opened");
    assert.equal(gate.have, 20);
    assert.ok(hasCanonEvent(SLUG, `${SLUG}/response-gate-opened`));
    const event = findCanonEvent(SLUG, `${SLUG}/response-gate-opened`);
    assert.equal(event?.fields.eligible_unique, "20");
  });

  test("does NOT open on 20 raw rows that dedupe to fewer than 20 unique eligible respondents", () => {
    process.env.RESEARCH_HASH_KEY = "test-only-key";
    for (let i = 0; i < 20; i++) {
      // Same identifier every time -> one unique respondent no matter how many rows.
      ingestResponse(SLUG, baseInput({ responseId: `r-dup-${i}`, rawIdentifier: { platform: "substack", stableUserId: "same-person" } }), `t${i}`);
    }
    const gate = getResponseGateState(SLUG);
    assert.equal(gate.have, 1);
    assert.equal(gate.state, "closed");
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/response-gate-opened`), false);
  });

  test("does NOT open when responses are ineligible even at 20+ raw unique rows", () => {
    for (let i = 0; i < 25; i++) {
      ingestResponse(SLUG, baseInput({ responseId: `r-inel-${i}`, targetAudienceEligible: false }), `t${i}`);
    }
    const gate = getResponseGateState(SLUG);
    assert.equal(gate.have, 0);
    assert.equal(gate.state, "closed");
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/response-gate-opened`), false);
  });

  test("response_gate_opened fires exactly once even across repeated threshold crossings", () => {
    ingestNUniqueEligible(20, "c");
    assert.ok(hasCanonEvent(SLUG, `${SLUG}/response-gate-opened`));
    const firstEvent = findCanonEvent(SLUG, `${SLUG}/response-gate-opened`);

    // Drop below threshold via correction, then cross it again with a fresh ingest.
    const all = readResponses(SLUG);
    for (const r of all.slice(0, 5)) {
      correctResponse(SLUG, r.response_id, { exclusion_reason: "ineligible" }, "t-correct");
    }
    assert.equal(countEligibleUnique(readResponses(SLUG)), 15);
    assert.equal(getResponseGateState(SLUG).state, "opened", "the ledger event is a one-way fact, not a live gauge");

    ingestNUniqueEligible(6, "c2"); // back to 21 eligible unique
    ingestResponse(SLUG, baseInput({ responseId: "r-c-extra" }), "t-extra");

    const events = readCanonEvents(SLUG).filter((e) => e.id === `${SLUG}/response-gate-opened`);
    assert.equal(events.length, 1, "response_gate_opened must fire exactly once");
    assert.equal(events[0].at, firstEvent?.at);
  });
});

// ---- correctResponse ----

describe("correctResponse", () => {
  test("edits cluster_id, target_audience_eligible, exclusion_reason, stuck_point, desired_outcome", () => {
    const { record } = ingestResponse(SLUG, baseInput(), "t0");
    const corrected = correctResponse(
      SLUG,
      record.response_id,
      {
        cluster_id: "cluster-1",
        target_audience_eligible: false,
        exclusion_reason: "ineligible",
        stuck_point: "corrected stuck point",
        desired_outcome: "corrected desired outcome",
      },
      "t1"
    );
    assert.equal(corrected.cluster_id, "cluster-1");
    assert.equal(corrected.target_audience_eligible, false);
    assert.equal(corrected.exclusion_reason, "ineligible");
    assert.equal(corrected.included_in_gate, false);
    assert.equal(corrected.stuck_point, "corrected stuck point");
    assert.equal(corrected.desired_outcome, "corrected desired outcome");
    // exact_quote is never touched by a correction
    assert.equal(corrected.exact_quote, record.exact_quote);
  });

  test("clearing exclusion_reason back to null re-includes the response in the gate", () => {
    const { record } = ingestResponse(SLUG, baseInput({ exclusionReason: "unverifiable" }), "t0");
    assert.equal(record.included_in_gate, false);
    const corrected = correctResponse(SLUG, record.response_id, { exclusion_reason: null }, "t1");
    assert.equal(corrected.included_in_gate, true);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 1);
  });

  test("throws on an unknown response_id", () => {
    assert.throws(() => correctResponse(SLUG, "r-does-not-exist", { cluster_id: "c" }, "t0"), /no such response/);
  });

  test("merge_with_response_id makes two records dedupe as the same respondent", () => {
    const a = ingestResponse(SLUG, baseInput({ responseId: "r-merge-a" }), "t0");
    const b = ingestResponse(SLUG, baseInput({ responseId: "r-merge-b" }), "t1");
    assert.notEqual(a.record.respondent_hash, b.record.respondent_hash);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 2);

    const merged = correctResponse(SLUG, "r-merge-b", { merge_with_response_id: "r-merge-a" }, "t2");
    assert.equal(merged.respondent_hash, a.record.respondent_hash);
    assert.equal(countEligibleUnique(readResponses(SLUG)), 1);
    // response_id "r-merge-a" itself is untouched
    assert.equal(readResponse(SLUG, "r-merge-a")?.respondent_hash, a.record.respondent_hash);
  });

  test("merging with itself throws", () => {
    const { record } = ingestResponse(SLUG, baseInput(), "t0");
    assert.throws(() => correctResponse(SLUG, record.response_id, { merge_with_response_id: record.response_id }, "t1"), /itself/);
  });

  test("merging with a nonexistent response_id throws", () => {
    const { record } = ingestResponse(SLUG, baseInput(), "t0");
    assert.throws(
      () => correctResponse(SLUG, record.response_id, { merge_with_response_id: "r-does-not-exist" }, "t1"),
      /no such response to merge with/
    );
  });
});
