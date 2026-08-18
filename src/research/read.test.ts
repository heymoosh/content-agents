import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installResearchSchema, writeMetricObservation } from "./store.js";
import { buildResearchReport, renderResearchReport } from "./read.js";

test("research report exposes redacted observations and current metric summaries only", () => {
  const db = new Database(":memory:");
  installResearchSchema(db);
  db.prepare(
    `INSERT INTO research_observations (
      observation_id, source, source_platform, surface, content_item_id, note_id, reply_id,
      published_at, observed_at, captured_at, respondent_hash, exact_text, redacted_text,
      privacy_class
    ) VALUES (?, 'reply', 'substack', 'note', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "o-reply",
    "note-1",
    "note-1",
    "reply-1",
    "2026-08-01T00:00:00Z",
    "2026-08-02T00:00:00Z",
    "2026-08-02T00:00:00Z",
    "raw-respondent-hash",
    "private exact reply text",
    "redacted reply text",
    "private_non_identifying"
  );
  db.prepare(
    `INSERT INTO research_observations (
      observation_id, source, source_platform, surface, content_item_id, note_id, reply_id,
      observed_at, captured_at, respondent_hash, exact_text, redacted_text,
      is_creator_observation, privacy_class
    ) VALUES (?, 'reply', 'substack', 'note', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    "o-creator",
    "note-1",
    "note-1",
    "reply-creator",
    "2026-08-02T00:00:00Z",
    "2026-08-02T00:00:00Z",
    "creator-hash",
    "creator exact reply text",
    "creator redacted reply text",
    "private_non_identifying"
  );
  writeMetricObservation(db, {
    contentItemId: "note-1",
    noteId: "note-1",
    surface: "note",
    metricName: "likes",
    metricValue: 0,
    at: "2026-08-02T00:00:00Z",
  });
  writeMetricObservation(db, {
    contentItemId: "note-1",
    noteId: "note-1",
    surface: "note",
    metricName: "likes",
    metricValue: 3,
    at: "2026-08-03T00:00:00Z",
  });
  writeMetricObservation(db, {
    contentItemId: "note-1",
    noteId: "note-1",
    surface: "note",
    metricName: "views",
    metricValue: null,
    at: "2026-08-03T00:00:00Z",
  });

  const dir = mkdtempSync(join(tmpdir(), "research-report-"));
  const coveragePath = join(dir, "coverage.jsonl");
  writeFileSync(
    coveragePath,
    JSON.stringify({
      run_at: "2026-08-03T00:00:00Z",
      source: "metric",
      window_start: "2026-08-03T00:00:00Z",
      window_end: "2026-08-03T00:00:00Z",
      status: "partial",
      records_captured: 4,
      gap_reason: "views unavailable",
    }) + "\n"
  );

  const report = buildResearchReport(db, coveragePath, "2026-08-04T00:00:00Z");
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("private exact reply text"), false);
  assert.equal(serialized.includes("raw-respondent-hash"), false);
  assert.equal(serialized.includes("creator exact reply text"), false);
  assert.equal(serialized.includes("creator-hash"), false);
  assert.equal(serialized.includes("redacted reply text"), true);
  assert.equal(serialized.includes("creator redacted reply text"), false);
  assert.equal(report.metrics.likes.latest_value, 3);
  assert.equal(report.metrics.views.unmeasured, 1);
  assert.equal(report.note_metrics[0]?.values.likes, 3);
  assert.equal(report.note_metrics[0]?.values.views, null);
  assert.equal(report.reply_observations.length, 1);
  assert.equal(report.creator_reply_observations, 1);
  assert.equal(report.coverage[0]?.status, "partial");

  const markdown = renderResearchReport(report);
  assert.match(markdown, /## Corpus synthesis/);
  assert.match(markdown, /Author replies excluded: 1/);
  assert.match(markdown, /redacted reply text/);
  assert.doesNotMatch(markdown, /private exact reply text|raw-respondent-hash/);

  rmSync(dir, { recursive: true, force: true });
  db.close();
});

test("research report counts prolific respondents once in respondent-level summaries", () => {
  const db = new Database(":memory:");
  installResearchSchema(db);
  const insert = db.prepare(
    `INSERT INTO research_observations (
      observation_id, source, source_platform, surface, note_id, reply_id,
      observed_at, captured_at, respondent_hash, redacted_text, privacy_class
    ) VALUES (?, 'reply', 'substack', 'note', ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run("o-one-a", "note-1", "reply-1", "2026-08-01T00:00:00Z", "2026-08-01T00:00:00Z", "hash-a", "one", "private_non_identifying");
  insert.run("o-one-b", "note-1", "reply-2", "2026-08-01T00:01:00Z", "2026-08-01T00:01:00Z", "hash-a", "two", "private_non_identifying");
  insert.run("o-two", "note-1", "reply-3", "2026-08-01T00:02:00Z", "2026-08-01T00:02:00Z", "hash-b", "three", "private_non_identifying");
  insert.run("o-unknown", "note-1", "reply-4", "2026-08-01T00:03:00Z", "2026-08-01T00:03:00Z", null, "four", "private_non_identifying");

  const report = buildResearchReport(db, "/tmp/no-research-coverage.jsonl", "2026-08-02T00:00:00Z");

  assert.equal(report.reply_observations.length, 4);
  assert.doesNotMatch(JSON.stringify(report), /hash-a|hash-b/);
  assert.deepEqual(report.audience_respondent_summary, {
    observation_count: 4,
    unique_respondents: 2,
    observations_without_respondent_hash: 1,
    max_observations_per_respondent: 2,
    respondent_observation_distribution: { "1": 1, "2": 1 },
  });
  assert.deepEqual(report.largest_audience_thread, {
    observation_count: 4,
    known_respondents: 2,
    observations_without_respondent_hash: 1,
    max_observations_per_respondent: 2,
  });

  const markdown = renderResearchReport(report);
  assert.match(markdown, /Unique audience respondents: 2/);
  assert.match(markdown, /Largest audience thread: 4 observations from 2 known respondents; one respondent contributed 2 observations/);

  db.close();
});
