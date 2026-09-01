import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  appendOutcomeRow,
  appendOutcomeRowsForBrand,
  assessOutcomeRow,
  buildBusinessOutcome,
  buildFunnelEvent,
  readOutcomeLedger,
  type BusinessOutcomeInput,
  type FunnelEventInput,
  type OutcomeRow,
} from "./outcome-ledger.js";
import {
  buildOutcomeLedgerFromJson,
  main as outcomeLedgerMain,
  renderOutcomeLedgerMarkdown,
} from "./outcome-ledger-cli.js";

const COMMON = {
  observedAt: "2026-08-24T10:00:00Z",
  collectedAt: "2026-08-24T10:05:00Z",
  metric: "event_count",
  value: 1,
  unit: "event",
  numerator: 1,
  denominator: 100,
  scope: { platform: "substack", surface: "note", contentItemId: "item-1" },
  window: { startAt: "2026-08-24T09:00:00Z", endAt: "2026-08-24T10:00:00Z" },
  sourceNote: "analytics export row 4",
  evidenceRefs: ["evidence:analytics:row-4"],
  lineage: [
    { recordType: "publish", id: "publish-1", relation: "measured-from" },
    { recordType: "content_item", id: "item-1", relation: "origin" },
  ],
  caveats: ["account-level collection; no identity claim"],
  status: "measured",
} as const;

function funnelInput(overrides: Partial<FunnelEventInput> = {}): FunnelEventInput {
  return {
    ...COMMON,
    id: "funnel-1",
    eventType: "opt_in",
    respondentHash: null,
    attribution: [
      {
        contentItemId: "item-1",
        touchType: "last",
        touchAt: "2026-08-24T09:59:00Z",
        confidence: "medium",
        attributionReason: null,
      },
    ],
    ...overrides,
  };
}

function businessInput(overrides: Partial<BusinessOutcomeInput> = {}): BusinessOutcomeInput {
  return {
    ...COMMON,
    id: "business-1",
    outcomeType: "purchase",
    value: 49,
    unit: "usd",
    currency: "USD",
    qualification: { status: "confirmed", rule: "checkout confirmation" },
    contentItemRefs: ["item-1"],
    funnelEventRefs: ["funnel-1"],
    attribution: [
      {
        contentItemId: "item-1",
        touchType: "self_reported",
        touchAt: "2026-08-24T09:59:00Z",
        confidence: "low",
        attributionReason: null,
      },
    ],
    ...overrides,
  };
}

test("builds immutable, body-free funnel facts with explicit measurement metadata", () => {
  const row = buildFunnelEvent(funnelInput());

  assert.equal(row.recordType, "funnel_event");
  assert.equal(row.family, "funnel");
  assert.equal(row.eventType, "opt_in");
  assert.equal(row.observedAt, COMMON.observedAt);
  assert.equal(row.collectedAt, COMMON.collectedAt);
  assert.deepEqual(row.window, COMMON.window);
  assert.deepEqual(row.scope, COMMON.scope);
  assert.equal(Object.isFrozen(row), true);
  assert.equal(Object.isFrozen(row.attribution[0]), true);

  assert.throws(() => {
    (row as { value: number }).value = 2;
  }, TypeError);
  assert.equal(JSON.stringify(row).match(/body|commentBody|email|phone|model|ranking|winner|causality|strategy/gi), null);
});

test("keeps business outcomes as a separate family and preserves qualification as a fact", () => {
  const row = buildBusinessOutcome(businessInput());

  assert.equal(row.recordType, "business_outcome");
  assert.equal(row.family, "business");
  assert.equal(row.outcomeType, "purchase");
  assert.deepEqual(row.contentItemRefs, ["item-1"]);
  assert.deepEqual(row.funnelEventRefs, ["funnel-1"]);
  assert.deepEqual(row.qualification, { status: "confirmed", rule: "checkout confirmation" });
  assert.deepEqual(row.caveats, COMMON.caveats);
});

test("requires explicit unknown attribution and blocks ambiguous or incomplete evidence", () => {
  const unknown = buildFunnelEvent(funnelInput({
    attribution: [
      {
        contentItemId: null,
        touchType: "unknown",
        touchAt: COMMON.observedAt,
        confidence: "low",
        attributionReason: "no referrer captured",
      },
    ],
  }));
  assert.equal(unknown.attribution[0].contentItemId, null);
  assert.equal(unknown.attribution[0].attributionReason, "no referrer captured");

  assert.throws(() => buildFunnelEvent(funnelInput({
    attribution: [{
      contentItemId: null,
      touchType: "unknown",
      touchAt: COMMON.observedAt,
      confidence: "low",
      attributionReason: null,
    }],
  })), /attributionReason/);

  const ambiguous = buildFunnelEvent(funnelInput({
    attribution: [
      { contentItemId: "item-1", touchType: "last", touchAt: COMMON.observedAt, confidence: "medium", attributionReason: null },
      { contentItemId: "item-2", touchType: "last", touchAt: COMMON.observedAt, confidence: "medium", attributionReason: null },
    ],
  }));
  assert.equal(assessOutcomeRow(ambiguous).status, "blocked");
  assert.match(assessOutcomeRow(ambiguous).blockers.join("; "), /ambiguous/i);

  const missingEvidence = buildBusinessOutcome(businessInput({ evidenceRefs: [], lineage: [] }));
  const assessment = assessOutcomeRow(missingEvidence);
  assert.equal(assessment.status, "blocked");
  assert.match(assessment.blockers.join("; "), /evidence|lineage/i);
});

test("rejects unknown allowlist keys and body or PII fields", () => {
  assert.throws(() => buildFunnelEvent({ ...funnelInput(), body: "private text" } as FunnelEventInput & { body: string }), /body|unknown field/i);
  assert.throws(() => buildFunnelEvent({ ...funnelInput(), email: "person@example.test" } as FunnelEventInput & { email: string }), /email|unknown field/i);
  assert.throws(() => buildBusinessOutcome({ ...businessInput(), winner: "item-1" } as BusinessOutcomeInput & { winner: string }), /winner|unknown field/i);
});

test("accepts the contract's snake_case input spellings and emits one canonical shape", () => {
  const source = funnelInput() as unknown as Record<string, unknown>;
  const {
    observedAt: _observedAt,
    collectedAt: _collectedAt,
    sourceNote: _sourceNote,
    evidenceRefs: _evidenceRefs,
    eventType: _eventType,
    respondentHash: _respondentHash,
    ...rest
  } = source;
  const row = buildFunnelEvent({
    ...rest,
    observed_at: COMMON.observedAt,
    collected_at: COMMON.collectedAt,
    source_note: COMMON.sourceNote,
    evidence_refs: COMMON.evidenceRefs,
    event_type: "opt_in",
    respondent_hash: null,
  } as unknown as FunnelEventInput);
  assert.equal(row.observedAt, COMMON.observedAt);
  assert.equal(row.collectedAt, COMMON.collectedAt);
  assert.equal(row.eventType, "opt_in");
  assert.deepEqual(row.evidenceRefs, COMMON.evidenceRefs);
});

test("appends revisions without editing or deleting prior rows", () => {
  const directory = mkdtempSync(join(tmpdir(), "outcome-ledger-"));
  const path = join(directory, "outcomes.jsonl");
  try {
    const original = buildFunnelEvent(funnelInput());
    appendOutcomeRow(original, path);
    const revision = buildFunnelEvent(funnelInput({ id: "funnel-2", supersedesId: original.id, value: 2, numerator: 2 }));
    appendOutcomeRow(revision, path);

    const rows = readOutcomeLedger(path);
    assert.deepEqual(rows.map((row) => row.id), ["funnel-1", "funnel-2"]);
    assert.equal(rows[0].value, 1);
    assert.equal(rows[1].supersedesId, "funnel-1");
    assert.equal(readFileSync(path, "utf8").trim().split("\n").length, 2);
    assert.throws(() => appendOutcomeRow(buildFunnelEvent(funnelInput({ id: "funnel-3", supersedesId: "missing" })), path), /supersedes/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("brand-scoped ingestion stamps canonical identity and is atomic across duplicate batches", () => {
  const directory = mkdtempSync(join(tmpdir(), "outcome-ledger-brand-"));
  const path = join(directory, "outcomes.jsonl");
  try {
    const rows = [buildFunnelEvent(funnelInput({ denominator: null })), buildBusinessOutcome(businessInput())];
    appendOutcomeRowsForBrand(rows, "human-inference", path);
    assert.deepEqual(readOutcomeLedger(path).map((row) => row.brandId), ["human-inference", "human-inference"]);

    assert.throws(() => appendOutcomeRowsForBrand(rows, "human-inference", path), /already exists/i);
    assert.equal(readFileSync(path, "utf8").trim().split("\n").length, 2);
    assert.throws(
      () => appendOutcomeRowsForBrand([buildFunnelEvent(funnelInput({ id: "foreign", brandId: "charles", denominator: null }))], "human-inference", path),
      /brand/i,
    );
    assert.throws(
      () => appendOutcomeRowsForBrand([buildFunnelEvent(funnelInput({ id: "cross-brand-revision", brandId: "charles", supersedesId: "funnel-1", denominator: null }))], "charles", path),
      /same brand/i,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI produces deterministic JSON and Markdown without writing domain state", async () => {
  const envelope = JSON.stringify({
    rows: [businessInput(), funnelInput()],
  });
  const first = buildOutcomeLedgerFromJson(envelope);
  const second = buildOutcomeLedgerFromJson(envelope);
  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => row.id), ["business-1", "funnel-1"]);
  assert.equal(first.familyCounts.attention, 0);
  assert.equal(first.familyCounts.conversation, 0);
  assert.equal(first.familyCounts.audience, 0);
  assert.equal(first.familyCounts.funnel, 1);
  assert.equal(first.familyCounts.business, 1);

  const markdown = renderOutcomeLedgerMarkdown(first);
  assert.match(markdown, /## Outcome families/);
  assert.match(markdown, /\| funnel \| 1 \|/);
  assert.match(markdown, /\| business \| 1 \|/);
  assert.doesNotMatch(markdown, /winner|causality|strategy change|venture qualification/i);

  let output = "";
  let errors = "";
  const code = await outcomeLedgerMain(["--json", envelope, "--format", "json"], {
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(code, 0);
  assert.equal(errors, "");
  assert.equal(output, `${JSON.stringify(first, null, 2)}\n`);
});

test("CLI fails closed for malformed or body-bearing envelopes", () => {
  assert.throws(() => buildOutcomeLedgerFromJson(JSON.stringify({ rows: [{ ...funnelInput(), body: "text" }] })), /body|unknown field/i);
  assert.equal(
    buildOutcomeLedgerFromJson(JSON.stringify({ rows: [{ ...funnelInput(), evidenceRefs: [] }] })).readiness.status,
    "blocked",
  );
  assert.equal(
    buildOutcomeLedgerFromJson(JSON.stringify({ rows: [{ ...funnelInput(), attribution: [] }] })).readiness.status,
    "blocked",
  );
});

// Keep the type in this file exercised so the test remains useful if the union changes.
const _outcomeRowTypeCheck: OutcomeRow | null = null;
void _outcomeRowTypeCheck;
