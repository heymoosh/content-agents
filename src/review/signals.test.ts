import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import ts from "typescript";
import { repoRoot } from "../db/db.js";
import {
  parseBriefSignals,
  latestBriefFile,
  readSignals,
  appendBacklogCard,
  readOutcomeFamilies,
  readResearchReport,
  suppressionInputs,
  RESEARCH_COVERAGE_FILENAME,
} from "./signals.js";
import { buildBusinessOutcome, buildFunnelEvent } from "../grow/outcome-ledger.js";

const BRIEF = `# Strategy Brief

## Data confidence

| Channel | Posts | Weeks of data | Status |
|---|---|---|---|
| bluesky | 73 | 28 | OK |
| threads | 3 | 2 | INSUFFICIENT (<4 wks) — directional only |

## Recommendations

1. **[DO MORE] Lean into Substack Notes, and spread them.** Notes out-engage essays by multiples
   for a fraction of the effort.
2. **[TEST] The pipeline beats hand-posting on X.** Tiny sample (n=6). If it holds to n≥10,
   let the pipeline feed it.

The funnel goal is unchanged.

## Directives for atomization
`;

// BOTH wordings of the INSUFFICIENT status must parse, forever. src/strategy/snapshot.ts wrote the
// em-dash form until 2026-08-23 and the comma form after (root CLAUDE.md rule 5), and briefs already
// in briefs/ are never rewritten. The status cell is captured as free text rather than matched
// against a literal, so this is a guard on that staying true, not on the wording itself.
test("parseBriefSignals reads the INSUFFICIENT status in both the old and the current wording", () => {
  const table = (status: string) =>
    ["## Data confidence", "", "| Channel | Posts | Weeks of data | Status |", "|---|---|---|---|", `| threads | 3 | 2 | ${status} |`, ""].join("\n");
  const oldForm = parseBriefSignals(table("INSUFFICIENT (<4 wks) — directional only")).confidence[0];
  const newForm = parseBriefSignals(table("INSUFFICIENT (<4 wks), directional only")).confidence[0];
  for (const read of [oldForm, newForm]) {
    assert.equal(read.channel, "threads");
    assert.equal(read.posts, 3);
    assert.equal(read.weeks, 2);
    assert.match(read.status, /INSUFFICIENT/);
  }
  // the wording is carried through verbatim, never normalized to one form or the other
  assert.equal(oldForm.status, "INSUFFICIENT (<4 wks) — directional only");
  assert.equal(newForm.status, "INSUFFICIENT (<4 wks), directional only");
});

test("parseBriefSignals reads the confidence table and the marked recommendations", () => {
  const { confidence, recommendations } = parseBriefSignals(BRIEF);
  assert.deepEqual(confidence[0], { channel: "bluesky", posts: 73, weeks: 28, status: "OK" });
  assert.match(confidence[1].status, /INSUFFICIENT/);
  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].type, "DO MORE");
  assert.equal(recommendations[0].title, "Lean into Substack Notes, and spread them");
  assert.match(recommendations[0].rationale, /fraction of the effort/);
  assert.equal(recommendations[1].type, "TEST");
});

test("latestBriefFile picks the newest dated brief", () => {
  const dir = mkdtempSync(join(tmpdir(), "signals-test-"));
  try {
    writeFileSync(join(dir, "2026-06-16-strategy-brief.md"), "x");
    writeFileSync(join(dir, "2026-06-24-strategy-brief.md"), "x");
    writeFileSync(join(dir, "bets.md"), "x");
    assert.equal(latestBriefFile(dir), "2026-06-24-strategy-brief.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readSignals reads only the selected brand directory and reports brand-qualified provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-brand-test-"));
  try {
    mkdirSync(join(root, "human-inference"), { recursive: true });
    mkdirSync(join(root, "charles"), { recursive: true });
    writeFileSync(join(root, "2026-08-31-strategy-brief.md"), BRIEF.replace("bluesky", "legacy"));
    writeFileSync(join(root, "human-inference", "2026-08-30-strategy-brief.md"), BRIEF.replace("bluesky", "x"));
    writeFileSync(join(root, "charles", "2026-08-29-strategy-brief.md"), BRIEF.replace("bluesky", "linkedin"));

    const charles = readSignals("charles", root);
    assert.equal(charles.briefPath, "briefs/charles/2026-08-29-strategy-brief.md");
    assert.equal(charles.confidence[0]?.channel, "linkedin");
    assert.equal(readSignals("fiction", root).briefPath, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("appendBacklogCard appends a prose_kanban card once, refusing a duplicate title", () => {
  const dir = mkdtempSync(join(tmpdir(), "signals-test-"));
  const p = join(dir, "backlog.md");
  try {
    writeFileSync(p, "# Backlog\n\n**Existing card**\n- STATUS: Backlog\n");
    const r = appendBacklogCard({ title: "Lead X posts with the audit hook", detail: "[DO MORE] ran 3x", briefPath: "briefs/b.md", date: "2026-07-18" }, p);
    assert.equal(r.ok, true);
    const text = readFileSync(p, "utf8");
    assert.match(text, /\*\*Lead X posts with the audit hook\*\*/);
    assert.match(text, /- STATUS: Backlog\n<!-- card-id: [0-9a-f-]+ -->/);
    assert.match(text, /Signals room adjustment, sent by Muxin 2026-07-18/);
    const dup = appendBacklogCard({ title: "Lead X posts with the audit hook", detail: "again", briefPath: null, date: "2026-07-18" }, p);
    assert.equal(dup.ok, false);
    assert.match(dup.error!, /already/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Card D: the four outcome families ──────────────────────────────────────────────────────────

function fixtureDb(opts: { research?: boolean } = {}): Database.Database {
  const db = new Database(":memory:");
  if (opts.research === false) {
    db.exec(
      readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8")
        .split("-- Account-level research evidence.")[0]
    );
  } else {
    db.exec(readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8"));
  }
  return db;
}

function seedPost(
  db: Database.Database,
  post: { id: number; platform: string; posted_at: string },
  metrics?: Partial<Record<"impressions" | "likes" | "replies" | "reposts" | "new_follows", number>>,
  capturedAt = "2026-08-10T00:00:00Z"
): void {
  db.prepare("INSERT INTO posts (id, platform, posted_at) VALUES (?, ?, ?)").run(post.id, post.platform, post.posted_at);
  if (!metrics) return;
  db.prepare(
    `INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, new_follows)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    post.id,
    capturedAt,
    metrics.impressions ?? null,
    metrics.likes ?? null,
    metrics.replies ?? null,
    metrics.reposts ?? null,
    metrics.new_follows ?? null
  );
}

test("attention and conversation read real numbers from the latest metrics capture per post", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 1200, likes: 9, replies: 4, reposts: 2 });
    // A second, later capture of the SAME post must replace the first, never add to it.
    db.prepare(
      "INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(1, "2026-08-11T00:00:00Z", 1500, 11, 4, 2);
    seedPost(db, { id: 2, platform: "bluesky", posted_at: "2026-07-15T00:00:00Z" }, { impressions: 340, likes: 1, replies: 0, reposts: 0 });

    const families = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.equal(families.attention.impressions.state, "measured");
    assert.deepEqual(families.attention.impressions, {
      state: "measured",
      value: 1840,
      records_measured: 2,
      records_unmeasured: 0,
    });
    assert.deepEqual(families.conversation.likes, { state: "measured", value: 12, records_measured: 2, records_unmeasured: 0 });
    // A genuine zero is a measurement, not an absence.
    assert.deepEqual(families.conversation.replies, { state: "measured", value: 4, records_measured: 2, records_unmeasured: 0 });
    assert.equal(families.never_collapsed, true);
    assert.equal("total" in families, false);
  } finally {
    db.close();
  }
});

test("brand-scoped outcomes never read another brand's posts, metrics, audience, or research", () => {
  const db = fixtureDb();
  try {
    const insertPost = db.prepare(
      "INSERT INTO posts (id, platform, posted_at, brand_id, provider_account_id) VALUES (?, 'x', ?, ?, ?)"
    );
    insertPost.run(1, "2026-07-01T00:00:00Z", "human-inference", "hi/x");
    insertPost.run(2, "2026-07-02T00:00:00Z", "charles", "charles/x");
    const insertMetric = db.prepare(
      `INSERT INTO metrics (post_id, captured_at, impressions, likes, brand_id, provider_account_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertMetric.run(1, "2026-08-10T00:00:00Z", 100, 4, "human-inference", "hi/x");
    insertMetric.run(1, "2026-08-11T00:00:00Z", 9999, 99, "charles", "charles/x");
    insertMetric.run(2, "2026-08-10T00:00:00Z", 25, 2, "charles", "charles/x");
    db.prepare(
      `INSERT INTO audience (platform, captured_at, metric_type, value_count, brand_id, provider_account_id)
       VALUES ('x', ?, 'follower_total', ?, ?, ?)`
    ).run("2026-08-10T00:00:00Z", 500, "human-inference", "hi/x");
    const insertResearch = db.prepare(
      `INSERT INTO research_observations (
         observation_id, source, source_platform, observed_at, captured_at, privacy_class,
         brand_id, provider_account_id
       ) VALUES (?, 'reply', 'substack', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z',
         'private_non_identifying', ?, ?)`
    );
    insertResearch.run("hi-reply", "human-inference", "hi/substack");
    insertResearch.run("charles-reply", "charles", "charles/substack");

    const human = readOutcomeFamilies(db, {
      brandId: "human-inference",
      generatedAt: "2026-08-12T00:00:00Z",
    });
    assert.equal(human.attention.impressions.state, "measured");
    assert.equal(human.attention.impressions.value, 100);
    assert.equal(human.conversation.likes.state, "measured");
    assert.equal(human.conversation.likes.value, 4);
    assert.equal(human.conversation.research_observations.state, "measured");
    assert.equal(human.conversation.research_observations.value, 1);
    assert.equal(human.audience.follower_total.state, "measured");
    assert.equal(human.audience.follower_total.value, 500);

    const charles = readOutcomeFamilies(db, {
      brandId: "charles",
      generatedAt: "2026-08-12T00:00:00Z",
    });
    assert.equal(charles.attention.impressions.state, "measured");
    assert.equal(charles.attention.impressions.value, 25);
    assert.equal(charles.conversation.research_observations.state, "measured");
    assert.equal(charles.conversation.research_observations.value, 1);
    assert.equal(charles.audience.follower_total.state, "not_measured");
  } finally {
    db.close();
  }
});

test("a brand with audience and research but no posts keeps those families measured", () => {
  const db = fixtureDb();
  try {
    db.prepare(
      `INSERT INTO audience (platform, captured_at, metric_type, value_count, brand_id, provider_account_id)
       VALUES ('substack', '2026-08-10T00:00:00Z', 'follower_total', 42, 'charles', 'charles/substack')`
    ).run();
    db.prepare(
      `INSERT INTO research_observations (
         observation_id, source, source_platform, observed_at, captured_at, privacy_class,
         brand_id, provider_account_id
       ) VALUES ('charles-only-reply', 'reply', 'substack', '2026-08-10T00:00:00Z',
         '2026-08-10T00:00:00Z', 'private_non_identifying', 'charles', 'charles/substack')`
    ).run();

    const read = readOutcomeFamilies(db, { brandId: "charles", generatedAt: "2026-08-12T00:00:00Z" });
    assert.equal(read.attention.impressions.state, "not_measured");
    assert.equal(read.conversation.research_observations.state, "measured");
    assert.equal(read.conversation.research_observations.value, 1);
    assert.equal(read.audience.follower_total.state, "measured");
    assert.equal(read.audience.follower_total.value, 42);
  } finally {
    db.close();
  }
});

test("a post with no metrics row counts as unmeasured rather than as a zero", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "x", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 500 });
    seedPost(db, { id: 2, platform: "x", posted_at: "2026-07-02T00:00:00Z" });
    const families = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.deepEqual(families.attention.impressions, {
      state: "measured",
      value: 500,
      records_measured: 1,
      records_unmeasured: 1,
    });
  } finally {
    db.close();
  }
});

test("saves and comments report as absent, never as zero", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { likes: 3 });
    const { conversation } = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.equal(conversation.saves.state, "not_measured");
    assert.equal(conversation.comments.state, "not_measured");
    assert.equal("value" in conversation.saves, false);
    assert.equal("value" in conversation.comments, false);
    assert.match((conversation.saves as { reason: string }).reason, /no saves column/);
    assert.match((conversation.comments as { reason: string }).reason, /no comments column/);
  } finally {
    db.close();
  }
});

test("conversation folds in the four conversational research sources, actives only", () => {
  const db = fixtureDb();
  try {
    const insert = db.prepare(
      `INSERT INTO research_observations (
         observation_id, source, source_platform, observed_at, captured_at, privacy_class,
         superseded_by, deleted_at
       ) VALUES (?, ?, 'substack', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z', 'private_non_identifying', ?, ?)`
    );
    insert.run("o-1", "reply", null, null);
    insert.run("o-2", "reply", null, null);
    insert.run("o-3", "dm", null, null);
    insert.run("o-4", "follow_up_question", null, null);
    insert.run("o-5", "comment", null, null);
    insert.run("o-6", "reply", "o-1", null); // superseded: not active
    insert.run("o-7", "reply", null, "2026-08-02T00:00:00Z"); // tombstoned: not active
    insert.run("o-8", "creator_observation", null, null); // not a conversational source

    const { conversation } = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.deepEqual(conversation.research_observations, {
      state: "measured",
      value: 5,
      records_measured: 4,
      records_unmeasured: 0,
    });
    assert.deepEqual(conversation.research_observations_by_source, {
      comment: 1,
      dm: 1,
      follow_up_question: 1,
      reply: 2,
    });
  } finally {
    db.close();
  }
});

test("without a research_observations table the conversation research half is absent, not zero", () => {
  const db = fixtureDb({ research: false });
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { likes: 2 });
    const { conversation } = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.equal(conversation.research_observations.state, "not_measured");
    assert.deepEqual(conversation.research_observations_by_source, {});
  } finally {
    db.close();
  }
});

test("audience splits measured follower growth from unmeasurable visits and opt-ins", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "substack", posted_at: "2026-06-01T00:00:00Z" }, { new_follows: 7 });
    seedPost(db, { id: 2, platform: "substack", posted_at: "2026-07-01T00:00:00Z" }, { new_follows: 4 });
    const aud = db.prepare(
      `INSERT INTO audience (platform, captured_at, metric_type, dimension, value_count)
       VALUES (?, ?, ?, NULL, ?)`
    );
    aud.run("substack", "2026-07-01T00:00:00Z", "follower_total", 900);
    aud.run("substack", "2026-08-01T00:00:00Z", "follower_total", 950); // newest wins; totals never sum
    aud.run("substack", "2026-08-01T00:00:00Z", "follower_delta", 11);

    const { audience } = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.deepEqual(audience.new_follows, { state: "measured", value: 11, records_measured: 2, records_unmeasured: 0 });
    assert.deepEqual(audience.follower_total, { state: "measured", value: 950, records_measured: 1, records_unmeasured: 0 });
    assert.deepEqual(audience.follower_delta, { state: "measured", value: 11, records_measured: 1, records_unmeasured: 0 });
    // The unmeasurable half stays unmeasurable, and the family is never rolled into one figure.
    assert.equal(audience.landing_visits.state, "not_measured");
    assert.equal(audience.opt_ins.state, "not_measured");
    assert.equal(audience.survey_responses.state, "not_measured");
    assert.match((audience.landing_visits as { reason: string }).reason, /no eligible brand-scoped event_count fact/);
    assert.equal("total" in audience, false);
    assert.match(audience.partial_note, /not summed into one audience figure/);
  } finally {
    db.close();
  }
});

test("business returns only its empty state, with every sub-metric unmeasured", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 100, likes: 5 });
    const { business } = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    for (const key of ["qualified_inquiries", "calls", "opportunities", "purchases"] as const) {
      assert.equal(business[key].state, "not_measured", `${key} must be unmeasured`);
      assert.equal("value" in business[key], false, `${key} must carry no number`);
    }
    assert.equal(
      business.empty_state,
      "No eligible reviewed business-outcome facts are recorded for this selected brand. This is unmeasured, not zero."
    );
  } finally {
    db.close();
  }
});

test("brand-scoped canonical outcome facts measure landing, opt-in, and business families without cross-brand leakage", () => {
  const db = fixtureDb();
  try {
    const common = {
      observedAt: "2026-08-24T10:00:00Z", collectedAt: "2026-08-24T10:05:00Z",
      metric: "event_count", value: 1, unit: "event", numerator: 1, denominator: null,
      scope: { channel: "landing-page" }, window: { startAt: "2026-08-24T09:00:00Z", endAt: "2026-08-24T10:00:00Z" },
      sourceNote: "reviewed export", evidenceRefs: ["export:row-1"],
      lineage: [{ recordType: "source_export", id: "export-1", relation: "measured-from" }],
      caveats: [], status: "measured",
    } as const;
    const attribution = [{ contentItemId: null, touchType: "unknown" as const, touchAt: common.observedAt, confidence: "low" as const, attributionReason: "source export had no UTM" }];
    const rows = [
      buildFunnelEvent({ ...common, id: "visit-hi", brandId: "human-inference", eventType: "visit", respondentHash: null, value: 7, numerator: 7, attribution }),
      buildFunnelEvent({ ...common, id: "optin-hi", brandId: "human-inference", eventType: "opt_in", respondentHash: null, value: 2, numerator: 2, attribution }),
      buildFunnelEvent({ ...common, id: "visit-charles", brandId: "charles", eventType: "visit", respondentHash: null, value: 99, numerator: 99, attribution }),
      buildBusinessOutcome({ ...common, id: "purchase-hi", brandId: "human-inference", outcomeType: "purchase", value: 49, unit: "USD", currency: "USD", qualification: { status: "confirmed", rule: "checkout receipt" }, contentItemRefs: [], funnelEventRefs: ["optin-hi"], attribution }),
    ];

    const human = readOutcomeFamilies(db, { brandId: "human-inference", generatedAt: "2026-08-25T00:00:00Z", outcomeRows: rows });
    assert.deepEqual(human.audience.landing_visits, { state: "measured", value: 7, records_measured: 1, records_unmeasured: 0 });
    assert.deepEqual(human.audience.opt_ins, { state: "measured", value: 2, records_measured: 1, records_unmeasured: 0 });
    assert.deepEqual(human.business.purchases, { state: "measured", value: 1, records_measured: 1, records_unmeasured: 0 });
    assert.equal(human.business.empty_state, null);
    assert.match(human.audience.partial_note, /separate measurements/i);
    assert.equal(human.business.qualified_inquiries.state, "not_measured");

    const charles = readOutcomeFamilies(db, { brandId: "charles", generatedAt: "2026-08-25T00:00:00Z", outcomeRows: rows });
    assert.deepEqual(charles.audience.landing_visits, { state: "measured", value: 99, records_measured: 1, records_unmeasured: 0 });
    assert.equal(charles.audience.opt_ins.state, "not_measured");
    assert.equal(charles.business.purchases.state, "not_measured");
  } finally {
    db.close();
  }
});

test("outcome revisions replace superseded facts and legacy unassigned rows remain excluded", () => {
  const db = fixtureDb();
  try {
    const common = {
      observedAt: "2026-08-24T10:00:00Z", collectedAt: "2026-08-24T10:05:00Z", metric: "event_count",
      unit: "event", numerator: null, denominator: null, scope: { channel: "landing-page" },
      window: { startAt: "2026-08-24T09:00:00Z", endAt: "2026-08-24T10:00:00Z" }, sourceNote: "reviewed export",
      evidenceRefs: ["export:row-1"], lineage: [{ recordType: "source_export", id: "export-1", relation: "measured-from" }], caveats: [], status: "measured",
      eventType: "visit" as const, respondentHash: null,
      attribution: [{ contentItemId: null, touchType: "unknown" as const, touchAt: "2026-08-24T10:00:00Z", confidence: "low" as const, attributionReason: "no UTM" }],
    };
    const original = buildFunnelEvent({ ...common, id: "visit-old", brandId: "human-inference", value: 3 });
    const replacement = buildFunnelEvent({ ...common, id: "visit-new", brandId: "human-inference", value: 5, supersedesId: "visit-old" });
    const legacy = buildFunnelEvent({ ...common, id: "visit-legacy", value: 100 });
    const read = readOutcomeFamilies(db, { brandId: "human-inference", outcomeRows: [original, replacement, legacy] });
    assert.deepEqual(read.audience.landing_visits, { state: "measured", value: 5, records_measured: 1, records_unmeasured: 0 });
    assert.equal(read.excluded_unassigned.outcomes, 1);
  } finally {
    db.close();
  }
});

test("Signals count cards ignore exact rate facts retained for Experiment", () => {
  const db = fixtureDb();
  try {
    const rate = buildFunnelEvent({
      id: "visit-rate", brandId: "human-inference", eventType: "visit", observedAt: "2026-08-24T10:00:00Z", collectedAt: "2026-08-24T10:05:00Z",
      metric: "visits-per-1000-impressions", value: 4.1, unit: "rate", numerator: 4.1, denominator: 1000,
      scope: { channel: "landing-page" }, window: { startAt: "2026-08-24T09:00:00Z", endAt: "2026-08-24T10:00:00Z" }, sourceNote: "attributed analytics",
      evidenceRefs: ["export:rate"], lineage: [{ recordType: "source_export", id: "rate", relation: "measured-from" }], caveats: [], status: "measured", respondentHash: null,
      attribution: [{ contentItemId: null, touchType: "unknown", touchAt: "2026-08-24T10:00:00Z", confidence: "low", attributionReason: "aggregate rate" }],
    });
    const read = readOutcomeFamilies(db, { brandId: "human-inference", outcomeRows: [rate] });
    assert.equal(read.audience.landing_visits.state, "not_measured");
    assert.match((read.audience.landing_visits as { reason: string }).reason, /no eligible brand-scoped event_count fact/);
    assert.match(read.audience.partial_note, /part has no source/i);
    assert.doesNotMatch(read.audience.partial_note, /landing visits and opt-ins remain separate measurements/i);
  } finally { db.close(); }
});

test("the sample rule is the repo's own 4-week INSUFFICIENT bar, stated in the shape", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-05-01T00:00:00Z" }, { impressions: 10 });
    seedPost(db, { id: 2, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 10 });
    seedPost(db, { id: 3, platform: "threads", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 10 });
    seedPost(db, { id: 4, platform: "threads", posted_at: "2026-07-08T00:00:00Z" }, { impressions: 10 });

    const families = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    assert.deepEqual(families.sample_rule.kind, "weeks_of_data");
    assert.equal(families.sample_rule.threshold_weeks, 4);
    assert.match(families.sample_rule.source, /snapshot\.ts/);
    const byPlatform = Object.fromEntries(families.confidence.map((c) => [c.platform, c]));
    assert.equal(byPlatform.bluesky.sufficient, true);
    assert.equal(byPlatform.bluesky.status, "OK");
    assert.equal(byPlatform.threads.sufficient, false);
    assert.match(byPlatform.threads.status, /INSUFFICIENT/);
  } finally {
    db.close();
  }
});

test("a suppression caller can only ever see attention and conversation", () => {
  const db = fixtureDb();
  try {
    seedPost(db, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { impressions: 10, likes: 1 });
    const families = readOutcomeFamilies(db, { generatedAt: "2026-08-12T00:00:00Z" });
    const inputs = suppressionInputs(families);
    assert.deepEqual(Object.keys(inputs).sort(), ["attention", "conversation"]);
    assert.equal("audience" in inputs, false);
    assert.equal("business" in inputs, false);
  } finally {
    db.close();
  }
});

test("the research report degrades honestly when RESEARCH_HASH_KEY is unset", () => {
  const db = fixtureDb();
  try {
    const read = readResearchReport(db, { hashKey: undefined });
    if (read.state !== "unavailable") throw new Error("expected an unavailable read");
    assert.equal(read.capture_configured, false);
    assert.equal(read.report, null);
    assert.match(read.reason, /RESEARCH_HASH_KEY is not set/);
  } finally {
    db.close();
  }
});

test("an empty table with the key set reads as configured-but-empty, not as a zero measurement", () => {
  const db = fixtureDb();
  try {
    const read = readResearchReport(db, { hashKey: "test-key" });
    if (read.state !== "unavailable") throw new Error("expected an unavailable read");
    assert.equal(read.capture_configured, true);
    assert.match(read.reason, /has not recorded anything yet/);
  } finally {
    db.close();
  }
});

test("the research report exposes the redacted read once observations exist", () => {
  const db = fixtureDb();
  const dir = mkdtempSync(join(tmpdir(), "signals-research-"));
  try {
    db.prepare(
      `INSERT INTO research_observations (
         observation_id, source, source_platform, surface, note_id, reply_id, published_at,
         observed_at, captured_at, respondent_hash, exact_text, redacted_text, privacy_class
       ) VALUES (?, 'reply', 'substack', 'note', ?, ?, ?, ?, ?, ?, ?, ?, 'private_non_identifying')`
    ).run(
      "o-reply",
      "note-1",
      "reply-1",
      "2026-08-01T00:00:00Z",
      "2026-08-02T00:00:00Z",
      "2026-08-02T00:00:00Z",
      "secret-hash",
      "the exact private text",
      "the redacted text"
    );
    const read = readResearchReport(db, { hashKey: "test-key", coveragePath: join(dir, "coverage.jsonl") });
    if (read.state !== "available") throw new Error("expected an available read");
    assert.equal(read.capture_configured, true);
    const serialized = JSON.stringify(read.report);
    assert.match(serialized, /the redacted text/);
    // The redacted path never leaks exact text or a raw respondent hash.
    assert.doesNotMatch(serialized, /the exact private text/);
    assert.doesNotMatch(serialized, /secret-hash/);
    assert.equal(read.report.active_observation_counts.reply, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the redacted research report is brand-scoped and excludes legacy unassigned observations", () => {
  const db = fixtureDb();
  try {
    const insert = db.prepare(
      `INSERT INTO research_observations (
         observation_id, source, source_platform, observed_at, captured_at, privacy_class,
         redacted_text, brand_id, provider_account_id
       ) VALUES (?, 'reply', 'substack', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z',
         'private_non_identifying', ?, ?, ?)`
    );
    insert.run("human", "human text", "human-inference", "hi/substack");
    insert.run("charles", "charles text", "charles", "charles/substack");
    insert.run("legacy", "legacy text", null, null);

    const read = readResearchReport(db, { brandId: "charles", hashKey: "test-key" });
    if (read.state !== "available") throw new Error("expected an available read");
    const serialized = JSON.stringify(read.report);
    assert.match(serialized, /charles text/);
    assert.doesNotMatch(serialized, /human text|legacy text/);
    assert.deepEqual(read.report.coverage, []);
  } finally {
    db.close();
  }
});

test("the coverage filename stays in step with src/research/capture.ts", () => {
  const capture = readFileSync(join(repoRoot, "src", "research", "capture.ts"), "utf8");
  assert.match(capture, new RegExp(`COVERAGE_PATH = join\\(RESEARCH_DIR, "${RESEARCH_COVERAGE_FILENAME}"\\)`));
});

// Regression guard. Every number in the Signals design prototype is fiction: its sample values
// (4,180 / 37 / 12 / 1) and its sample thresholds (500 / 20 / 30 / 25) appear in no repo document.
// This repo never renders a claim it did not measure, and an invented threshold is as bad as an
// invented duration, so none of them may appear in the source.
test("none of the design prototype's invented numbers appear in the signals source", () => {
  const source = readFileSync(join(repoRoot, "src", "review", "signals.ts"), "utf8");
  for (const invented of ["4180", "4,180", "500", "37", "20", "25", "30"]) {
    assert.doesNotMatch(
      source,
      new RegExp(`(?<![\\d,.])${invented.replace(",", ",")}(?![\\d,.])`),
      `${invented} is a prototype fiction and must not appear in src/review/signals.ts`
    );
  }
});

test("an empty research table reads as unmeasured, but a populated one with no conversation reads as a real zero", () => {
  // schema.sql always creates research_observations, so its existence proves nothing about whether
  // capture ever ran. Empty means we never looked; populated-but-nonconversational means nobody
  // replied, which is a genuine measurement of zero.
  const empty = fixtureDb();
  try {
    seedPost(empty, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { likes: 1 });
    const read = readOutcomeFamilies(empty, { generatedAt: "2026-08-12T00:00:00Z" }).conversation;
    assert.equal(read.research_observations.state, "not_measured");
    assert.match((read.research_observations as { reason: string }).reason, /unmeasured, not zero replies/);
  } finally {
    empty.close();
  }

  const populated = fixtureDb();
  try {
    seedPost(populated, { id: 1, platform: "bluesky", posted_at: "2026-07-01T00:00:00Z" }, { likes: 1 });
    populated
      .prepare(
        `INSERT INTO research_observations (
           observation_id, source, source_platform, observed_at, captured_at, privacy_class
         ) VALUES ('o-1', 'creator_observation', 'substack', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z', 'public')`
      )
      .run();
    const read = readOutcomeFamilies(populated, { generatedAt: "2026-08-12T00:00:00Z" }).conversation;
    assert.deepEqual(read.research_observations, {
      state: "measured",
      value: 0,
      records_measured: 0,
      records_unmeasured: 0,
    });
  } finally {
    populated.close();
  }
});

// ── rule 5: no em dash reaches the screen ────────────────────────────────────────────────────────
// Root CLAUDE.md rule 5 and config/voice.yaml ban the em dash from every word a human reads, and
// two separate routes had been carrying one to Muxin's screen. The Signals room renders the review
// modules' `reason` and `source` strings verbatim, fetched at runtime, so no static page test ever
// sees them. The strategy modules print the markdown reports she reads in her terminal and that
// /strategy folds into briefs/YYYY-MM-DD-strategy-brief.md; snapshot.ts's data-confidence table is
// then rendered verbatim by the Signals room on top of that, and route.ts's rationale strings land
// in each content folder's routing.md, which she reads directly and which the Content room renders.
//
// This is a source-level guard over all of it: it parses each file with the TypeScript scanner and
// looks inside string and template literals only. Comments keep their em dashes (nobody reads those
// on screen), and treatment.ts's routing-heading regex keeps its em dashes too (it MATCHES a
// heading Muxin's own files already carry, it does not print one). If this test fails, do not just
// delete the dash: rewrite the sentence with a period, a comma, a colon, or parentheses, whichever
// sounds right read aloud.
const EM_DASH = "—";
const READER_FACING_MODULES: { dir: string; files: string[] }[] = [
  { dir: "review", files: ["signals.ts", "treatment.ts", "fixtures.ts"] },
  // The two cron routines print a run summary Muxin reads in the job log.
  { dir: "cron", files: ["bluesky-mentions.ts", "notes-daily.ts"] },
  {
    dir: "strategy",
    files: [
      "angle-refresh.ts",
      "audience.ts",
      "cadence-fit.ts",
      "cta-fit.ts",
      "exploration.ts",
      "frame-fit.ts",
      "grade-bets.ts",
      "lever-effectiveness.ts",
      "media-fit.ts",
      "origin-compare.ts",
      "platform-fit.ts",
      "resonance.ts",
      "route.ts",
      "routing-drift.ts",
      "snapshot.ts",
      "spin-control.ts",
    ],
  },
];

test("no string a reader-facing module can print carries an em dash", () => {
  for (const { dir, files } of READER_FACING_MODULES) {
    for (const file of files) {
      const path = join(repoRoot, "src", dir, file);
      const source = ts.createSourceFile(file, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      const offenders: string[] = [];
      const visit = (node: ts.Node): void => {
        if (
          ts.isStringLiteralLike(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          if (node.text.includes(EM_DASH)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            offenders.push(`${dir}/${file}:${line + 1} ${node.text.trim()}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      assert.deepEqual(offenders, [], `em dash in a string a reader can see:\n${offenders.join("\n")}`);
    }
  }
});
