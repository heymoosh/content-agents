import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  assertGoldScorePassed,
  buildClassificationPrompt,
  validateClassifierOutput,
  validateTaxonomy,
  writeClassification,
  type ClassificationFields,
} from "./classification.js";
import { installResearchSchema } from "./store.js";

function taxonomy(id = "test-taxonomy", version = "1") {
  return validateTaxonomy({
    taxonomy_id: id,
    version,
    dimensions: {
      topic_labels: { kind: "multi_label", allow_abstain: true, max_labels: 3, labels: [{ id: "topic", description: "A topic" }] },
      emotional_frame: { kind: "single_label", allow_abstain: true, labels: [{ id: "concerned", description: "Concerned" }] },
      desired_help: { kind: "single_label", allow_abstain: true, labels: [{ id: "act", description: "Wants to act" }] },
      behavior_audience_role: { kind: "single_label", allow_abstain: true, derived_from: "expressed_behavior_only", labels: [{ id: "doer", description: "Says they will do something" }] },
      stuck_point: { kind: "free_text", allow_abstain: true, max_words: 25, labels: [] },
    },
  });
}

const goodFields = {
  topic_labels: { value: ["topic"], confidence: "high", abstained: false, evidence_span: "this topic" },
  emotional_frame: { value: "concerned", confidence: "medium", abstained: false, evidence_span: "I am worried" },
  desired_help: { value: "act", confidence: "high", abstained: false, evidence_span: "I will act" },
  behavior_audience_role: { value: "doer", confidence: "high", abstained: false, evidence_span: "I will act" },
  stuck_point: { value: "I do not know the next step", confidence: "medium", abstained: false, evidence_span: "I do not know the next step" },
} satisfies ClassificationFields;

test("taxonomy is venture-specific and behavior roles reject sensitive inference", () => {
  assert.throws(
    () => validateTaxonomy({
      taxonomy_id: "bad",
      version: 1,
      dimensions: {
        topic_labels: { kind: "multi_label", allow_abstain: true, labels: [] },
        emotional_frame: { kind: "single_label", allow_abstain: true, labels: [] },
        desired_help: { kind: "single_label", allow_abstain: true, labels: [] },
        behavior_audience_role: { kind: "single_label", allow_abstain: true, derived_from: "expressed_behavior_only", labels: [{ id: "x", description: "A political identity" }] },
        stuck_point: { kind: "free_text", allow_abstain: true, labels: [] },
      },
    }),
    /political identity/
  );
});

test("classifier output is closed over taxonomy labels and requires evidence receipts", () => {
  const result = validateClassifierOutput({ fields: { ...goodFields, emotional_frame: { ...goodFields.emotional_frame, value: "unknown" } } }, taxonomy());
  assert.equal(result.ok, false);
  assert.equal(result.fields.emotional_frame.abstained, true);
  assert.equal(result.fields.desired_help.abstained, true, "schema failure abstains the whole observation");
});

test("classification prompt redacts contact details and marks third-party text as untrusted data", () => {
  const prompt = buildClassificationPrompt("Note context", "Email me at person@example.com https://example.com/?id=123", "hash-only", taxonomy());
  assert.match(prompt, /UNTRUSTED_REPLY_TEXT/);
  assert.doesNotMatch(prompt, /person@example\.com/);
  assert.doesNotMatch(prompt, /\?id=123/);
  assert.match(prompt, /hash-only/);
});

test("one observation may carry classifications under two taxonomies, and same-taxonomy reclassification supersedes", () => {
  const db = new Database(":memory:");
  installResearchSchema(db);
  db.prepare("INSERT INTO research_observations (observation_id, source, source_platform, observed_at, captured_at, exact_text, redacted_text, privacy_class) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("o-1", "reply", "substack", "2026-08-01", "2026-08-01", "text", "text", "private_non_identifying");
  const a = taxonomy("a");
  const b = taxonomy("b");
  writeClassification(db, { observationId: "o-1", taxonomy: a, fields: goodFields, status: "classified" });
  writeClassification(db, { observationId: "o-1", taxonomy: b, fields: goodFields, status: "classified" });
  writeClassification(db, { observationId: "o-1", taxonomy: a, fields: goodFields, status: "classified", reclassify: true });
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM research_observations").get() as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM research_observation_classifications").get() as { count: number }).count, 3);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM research_observation_classifications WHERE taxonomy_id = 'a' AND supersedes_classification_id IS NULL").get() as { count: number }).count, 1);
  db.close();
});

test("all gold-set thresholds are required before scale classification", () => {
  assert.throws(() => assertGoldScorePassed({
    desired_help: 1,
    emotional_frame: 1,
    behavior_audience_role: 0.75,
    topic_labels: 1,
    stuck_point: 1,
    ambiguous_abstention_rate: 1,
    ambiguous_confident_wrong_rate: 0.11,
  }), /thresholds/);
  assert.doesNotThrow(() => assertGoldScorePassed({
    desired_help: 0.8,
    emotional_frame: 0.7,
    behavior_audience_role: 0.75,
    topic_labels: 0.6,
    stuck_point: 0.7,
    ambiguous_abstention_rate: 0.8,
    ambiguous_confident_wrong_rate: 0.1,
  }));
});
