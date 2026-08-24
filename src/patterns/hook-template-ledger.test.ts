import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readHookTemplateLedger,
  toGrowHookTemplate,
  type HookTemplateRecord,
} from "./hook-template-ledger.js";

function row(overrides: Partial<HookTemplateRecord> = {}): HookTemplateRecord {
  return {
    id: "hook:contrast",
    name: "Contrast opener",
    mechanism: "Set an expected assumption beside the specific reversal.",
    platforms: ["linkedin", "x"],
    niches: ["civic-engagement", "building"],
    formats: ["text-post", "thread"],
    slots: ["claim", "contrast", "point-of-view"],
    sourceRefs: [{
      sourceId: "hook-patterns.md#row-1",
      location: "curated library row 1",
      kind: "library-row",
      evidenceStatus: "measured",
      caveats: ["mechanism is abstracted from the library; no wording is retained"],
    }],
    review: "passed",
    originality: "passed",
    evidenceStatus: "supported",
    adaptationNote: "Use Muxin's supplied claim and point of view; write the wording from scratch.",
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    ...overrides,
  };
}

function jsonl(...values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n");
}

test("reads valid JSONL, filters by platform/niche/format, and reports evidence counts", () => {
  const result = readHookTemplateLedger(jsonl(row(), row({
    id: "hook:question",
    name: "Question opener",
    platforms: ["substack"],
    niches: ["inner-journey"],
    formats: ["essay"],
    slots: ["question"],
    sourceRefs: [{
      sourceId: "opener-1",
      location: "source evidence",
      kind: "opener-evidence",
      evidenceStatus: "unmeasured",
      caveats: ["single sighting"],
    }],
    evidenceStatus: "hypothesis",
  })), { platform: "linkedin", niche: "building", format: "text-post" });
  assert.deepEqual(result.rows.map((value) => value.id), ["hook:contrast"]);
  assert.deepEqual(result.summary, { total: 1, reviewed: 1, unreviewed: 0, measured: 1 });
  assert.equal(result.generatesCopy, false);
  assert.equal(result.creatorBodyCopyAllowed, false);
  assert.equal(result.sideEffects, "none");
});

test("missing or blank JSONL is an empty deterministic body-free view", () => {
  const result = readHookTemplateLedger("\n  \n");
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.summary, { total: 0, reviewed: 0, unreviewed: 0, measured: 0 });
  assert.equal(Object.isFrozen(result), true);
});

test("sorts rows and nested metadata deterministically regardless of input order", () => {
  const first = row({
    id: "hook:z",
    platforms: ["x", "linkedin"],
    niches: ["building", "civic-engagement"],
    formats: ["thread", "text-post"],
    slots: ["point-of-view", "claim", "contrast"],
  });
  const second = row({ id: "hook:a", name: "Earlier" });
  const one = readHookTemplateLedger(jsonl(first, second));
  const two = readHookTemplateLedger(jsonl(second, first));
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.deepEqual(one.rows.map((value) => value.id), ["hook:a", "hook:z"]);
  assert.deepEqual(one.rows[1]?.slots, ["claim", "contrast", "point-of-view"]);
});

test("excludes unreviewed rows by default and includes them only by explicit opt-in", () => {
  const pending = row({ id: "hook:pending", review: "pending" });
  const failed = row({ id: "hook:failed", originality: "failed" });
  const json = jsonl(pending, failed);
  assert.deepEqual(readHookTemplateLedger(json).rows, []);
  const result = readHookTemplateLedger(json, { includeUnreviewed: true });
  assert.deepEqual(result.rows.map((value) => value.id), ["hook:failed", "hook:pending"]);
  assert.deepEqual(result.summary, { total: 2, reviewed: 0, unreviewed: 2, measured: 2 });
});

test("rejects malformed, incomplete, duplicated, and invalid records", () => {
  assert.throws(() => readHookTemplateLedger("not json"), /not valid JSON/);
  assert.throws(() => readHookTemplateLedger(jsonl(row({ sourceRefs: [] }))), /sourceRefs must not be empty/);
  assert.throws(() => readHookTemplateLedger(jsonl(row(), row())), /duplicate hook template id/);
  assert.throws(() => readHookTemplateLedger(jsonl(row({ platforms: ["unknown" as never] }))), /supported platform/);
  assert.throws(() => readHookTemplateLedger(jsonl(row({ review: "approved" as never }))), /must be one of/);
  assert.throws(() => readHookTemplateLedger(jsonl({ ...row(), sourceRefs: [{ ...row().sourceRefs[0], body: "verbatim" }] })), /forbidden/);
  assert.throws(() => readHookTemplateLedger(jsonl({ ...row(), winner: null })), /forbidden/);
});

test("accepts unmeasured evidence without inventing performance", () => {
  const result = readHookTemplateLedger(jsonl(row({
    evidenceStatus: "hypothesis",
    sourceRefs: [{
      sourceId: "library-1",
      location: "row 1",
      kind: "library-row",
      evidenceStatus: "unmeasured",
      caveats: ["needs platform baseline"],
    }],
  })));
  assert.equal(result.rows[0]?.evidenceStatus, "hypothesis");
  assert.equal(result.summary.measured, 0);
  assert.equal("score" in (result.rows[0] ?? {}), false);
});

test("bridges only metadata into Grow and keeps the common-hook adaptation boundary explicit", () => {
  const record = row();
  const template = toGrowHookTemplate(record);
  assert.deepEqual(template, {
    ref: "hook:contrast",
    slotRefs: ["claim", "contrast", "point-of-view"],
    adaptationNote: "Use Muxin's supplied claim and point of view; write the wording from scratch.",
  });
  assert.equal("mechanism" in template, false);
  assert.equal("body" in template, false);
  assert.equal("creatorBodyCopyAllowed" in template, false);
  assert.notEqual(template.slotRefs, record.slots);
});

test("returns frozen nested arrays so callers cannot mutate the read view", () => {
  const result = readHookTemplateLedger(jsonl(row()));
  assert.equal(Object.isFrozen(result.rows), true);
  assert.equal(Object.isFrozen(result.rows[0]), true);
  assert.equal(Object.isFrozen(result.rows[0]?.sourceRefs), true);
  assert.throws(() => {
    (result.rows as HookTemplateRecord[]).push(row({ id: "hook:other" }));
  }, TypeError);
});
