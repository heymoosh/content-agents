// Signals room data layer (Content Studio Riff 3e): deterministic reads of the latest strategy
// brief — the per-channel data-confidence table and the [DO MORE]/[TEST]/[DO LESS]
// recommendations — plus the one write this room owns: sending an adjustment to the repo's own
// backlog (docs/content-agents-backlog.md, Muxin's chosen target, 2026-07-17) as a prose_kanban
// card for the conductor pipeline to groom and build. Nothing here adopts anything by itself.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { repoRoot } from "../db/db.js";
import { buildResearchReport, type ResearchReport } from "../research/read.js";
import type { BrandId } from "../identity/brand.js";

export interface ChannelConfidence {
  channel: string;
  posts: number;
  weeks: number;
  status: string; // "OK" or the INSUFFICIENT wording, verbatim from the brief
}

export interface BriefRecommendation {
  type: "DO MORE" | "TEST" | "DO LESS";
  title: string;
  rationale: string;
}

export interface SignalsRead {
  briefPath: string | null; // repo-relative, null when no brief exists yet
  briefDate: string | null;
  confidence: ChannelConfidence[];
  recommendations: BriefRecommendation[];
}

export function latestBriefFile(briefsDir: string = join(repoRoot, "briefs")): string | null {
  if (!existsSync(briefsDir)) return null;
  const files = readdirSync(briefsDir).filter((f) => /^\d{4}-\d{2}-\d{2}-strategy-brief\.md$/.test(f)).sort();
  return files.length ? files[files.length - 1] : null;
}

// Pure, exported for tests: parse the two Signals sections out of a brief's markdown.
export function parseBriefSignals(text: string): { confidence: ChannelConfidence[]; recommendations: BriefRecommendation[] } {
  const confidence: ChannelConfidence[] = [];
  const confSection = text.split(/^## Data confidence\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  for (const line of confSection.split("\n")) {
    const m = line.match(/^\|\s*([a-z][\w-]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\|/);
    if (m) confidence.push({ channel: m[1], posts: Number(m[2]), weeks: Number(m[3]), status: m[4].trim() });
  }
  const recommendations: BriefRecommendation[] = [];
  const recSection = text.split(/^## Recommendations\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const lines = recSection.split("\n");
  let current: BriefRecommendation | null = null;
  for (const line of lines) {
    const m = line.match(/^\d+\.\s+\*\*\[(DO MORE|TEST|DO LESS)\]\s*(.+?)\*\*\s*(.*)$/);
    if (m) {
      if (current) recommendations.push(current);
      current = { type: m[1] as BriefRecommendation["type"], title: m[2].trim().replace(/\.$/, ""), rationale: m[3].trim() };
      continue;
    }
    if (current) {
      if (/^\s*$/.test(line) && current.rationale) {
        recommendations.push(current);
        current = null;
      } else if (line.trim()) {
        current.rationale = `${current.rationale} ${line.trim()}`.trim();
      }
    }
  }
  if (current) recommendations.push(current);
  return { confidence, recommendations };
}

export function readSignals(brandId: BrandId, briefsRoot: string = join(repoRoot, "briefs")): SignalsRead {
  const briefsDir = join(briefsRoot, brandId);
  const file = latestBriefFile(briefsDir);
  if (!file) return { briefPath: null, briefDate: null, confidence: [], recommendations: [] };
  const parsed = parseBriefSignals(readFileSync(join(briefsDir, file), "utf8"));
  return {
    briefPath: `briefs/${brandId}/${file}`,
    briefDate: file.slice(0, 10),
    ...parsed,
  };
}

export const BACKLOG_PATH = join(repoRoot, "docs", "content-agents-backlog.md");

// Append ONE prose_kanban card for an adjustment Muxin chose to send. Dedupe by exact title —
// a double-click must not file the card twice. The card lands in Backlog (never To Do); the
// conductor pipeline's grooming decides everything after that.
export function appendBacklogCard(
  opts: { title: string; detail: string; briefPath: string | null; date: string },
  path: string = BACKLOG_PATH,
): { ok: boolean; error?: string } {
  if (!existsSync(path)) return { ok: false, error: `no backlog file at ${path}` };
  const text = readFileSync(path, "utf8");
  if (text.includes(`**${opts.title}**`)) return { ok: false, error: "already on the backlog" };
  const card = [
    ``,
    `**${opts.title}**`,
    `- ORIGIN: Signals room adjustment, sent by Muxin ${opts.date}${opts.briefPath ? ` (from ${opts.briefPath})` : ""}. The system works out where it applies (formatter default, skill prose, a check) and tracks whether it held.`,
    `- ${opts.detail}`,
    `- STATUS: Backlog`,
    `<!-- card-id: ${randomUUID()} -->`,
    ``,
  ].join("\n");
  writeFileSync(path, text.replace(/\n+$/, "\n") + card);
  return { ok: true };
}

// ── Card D: the four outcome families ──────────────────────────────────────────────────────────
//
// `docs/venture-schema-contract.md` §5.8 (lines 1634-1653) maps records to the four families
// Muxin named in `docs/content-studio-vision.md`: attention (did people see it), conversation
// (did people reply, comment, save it), audience (did it bring a landing visit or an opt-in),
// business (did it lead to a call, an inquiry, a sale). Two rules from that section govern
// everything below:
//
//   1. "This mapping is read-time, not a fifth record" (contract:1650-1651). Nothing here writes
//      the families to disk. This is a read that groups data that already exists.
//   2. "A pillar- or platform-suppression recommendation reads engagement (attention +
//      conversation) only" (contract:1652-1653; venture/rules.md §1A rules 4 and 6). Audience and
//      business outcomes must never be read into a "this pillar is underperforming" call, because
//      a low-attention item can still be a business win. `SuppressionInputs` below is the
//      structural expression of that: it is the ONLY type that hands a suppression caller
//      families, and it can only ever hold two of them.
//
// The contract names `signal-snapshot` and `funnel-events.jsonl` as the source records. Neither
// exists in this codebase yet, so each family is implemented against what really exists and every
// sub-metric says which state it is in: measured (a real number, zero included), or not measured
// at all (no source exists to measure it). Collapsing "we measured zero" into "we have no way to
// measure this" is the exact failure this read exists to prevent, so the two are different
// variants of `MetricRead` and there is no code path that turns one into the other.
//
// Signals reads `data/analytics.db` and never `venture/<slug>/` (contract:1343-1347): those are
// one venture's private working state, and a read that depended on them would break the moment
// there were two ventures or none.

/**
 * One sub-metric, in exactly one of three states. `measured` covers a real zero — a post that
 * genuinely got no replies reads `{ state: "measured", value: 0 }`, which is a different fact
 * from `not_measured`, where no source for the number exists at all.
 */
export type MetricRead =
  | {
      state: "measured";
      value: number;
      /**
       * Records the value was actually read from, NOT always posts, despite the name. What one
       * record is depends on which producer built this read:
       *   sumColumn()           one post whose latest metrics row carried a non-null value here.
       *   conversationResearch() one observation SOURCE (comment, dm, follow_up_question, reply)
       *                         that returned a row, not one observation and not one post.
       *   audienceTotals()      one audience capture row carrying a non-null value_count.
       * The GUI calls these "records" on screen for that reason, and the field now says the same
       * word (PR #376 documented the mismatch and deferred the rename until page.ts was free).
       */
      records_measured: number;
      /**
       * Records counted but unreadable: no metrics row, or a null in this column. Counted so a
       * missing value is never silently zeroed. Same record definition as records_measured above.
       */
      records_unmeasured: number;
    }
  | { state: "not_measured"; reason: string };

/** Per-platform data confidence, mirroring `src/strategy/snapshot.ts:84`'s convention. */
export interface PlatformConfidence {
  platform: string;
  posts: number;
  weeks: number;
  /** "OK" once a platform clears the 4-week bar, otherwise the INSUFFICIENT wording. */
  status: string;
  sufficient: boolean;
}

/** Which sample rule was applied, stated in the return shape rather than left implicit. */
export interface SampleRule {
  kind: "weeks_of_data";
  threshold_weeks: number;
  source: string;
}

export interface AttentionFamily {
  family: "attention";
  question: string;
  impressions: MetricRead;
}

export interface ConversationFamily {
  family: "conversation";
  question: string;
  likes: MetricRead;
  replies: MetricRead;
  reposts: MetricRead;
  /** No `saves` column exists in `src/db/schema.sql`. Absent, never zero. */
  saves: MetricRead;
  /** No `comments` column exists either; per-post comments are not ingested. */
  comments: MetricRead;
  /** Active research observations from the redacted account-level path (contract §5.4b). */
  research_observations: MetricRead;
  /** Per-source breakdown behind `research_observations`, so the count is auditable. */
  research_observations_by_source: Record<string, number>;
}

export interface AudienceFamily {
  family: "audience";
  question: string;
  /** Deliberately NOT summed into one figure: half of this family has no source at all. */
  new_follows: MetricRead;
  follower_total: MetricRead;
  follower_delta: MetricRead;
  landing_visits: MetricRead;
  opt_ins: MetricRead;
  survey_responses: MetricRead;
  /** Plain-language note that this family is part measured, part unmeasurable today. */
  partial_note: string;
}

export interface BusinessFamily {
  family: "business";
  question: string;
  qualified_inquiries: MetricRead;
  calls: MetricRead;
  opportunities: MetricRead;
  purchases: MetricRead;
  /** The empty state IS the deliverable here — this copy is the whole card. */
  empty_state: string;
}

export interface OutcomeFamilies {
  generated_at: string;
  attention: AttentionFamily;
  conversation: ConversationFamily;
  audience: AudienceFamily;
  business: BusinessFamily;
  confidence: PlatformConfidence[];
  sample_rule: SampleRule;
  /**
   * There is deliberately no combined score, no weighting and no total across the four families.
   * `venture/rules.md` §1A rule 5: they "stay four separate outcome families. Nothing in Venture
   * or Signals collapses them into one score."
   */
  never_collapsed: true;
  /** Rows retained only for audit visibility; legacy rows are never assigned to a brand. */
  excluded_unassigned: { posts: number; metrics: number; audience: number; research: number };
  brand_id?: BrandId;
}

/**
 * The ONLY families a pillar- or platform-suppression recommendation may read
 * (`docs/venture-schema-contract.md:1652-1653`, `venture/rules.md` §1A rules 4 and 6). Audience
 * and business are structurally out of reach: a caller that types its input as this cannot see
 * them, so it cannot suppress a pillar over a lead it never saw.
 */
export type SuppressionInputs = Pick<OutcomeFamilies, "attention" | "conversation">;

/** Narrowing helper for a suppression caller: hands over engagement only, by construction. */
export function suppressionInputs(families: OutcomeFamilies): SuppressionInputs {
  return { attention: families.attention, conversation: families.conversation };
}

// The 4-week bar is the repo's own convention (root CLAUDE.md: "Channels with <4 weeks of data
// must be flagged INSUFFICIENT in briefs"), computed the same way in src/strategy/snapshot.ts:84.
// No new threshold is invented here; nothing in the design prototype's sample numbers is used.
const THRESHOLD_WEEKS = 4;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const SAMPLE_RULE: SampleRule = {
  kind: "weeks_of_data",
  threshold_weeks: THRESHOLD_WEEKS,
  source:
    "the repo's existing INSUFFICIENT rule (root CLAUDE.md; computed in src/strategy/snapshot.ts:84). Under four weeks of data on a channel is directional only",
};

// Mirrors src/strategy/snapshot.ts:7-11. `metrics` holds one row per capture per post, so a plain
// SUM would double-count every post that has been captured more than once. Duplicated rather than
// imported because snapshot.ts calls main() at module scope and would print a whole report on
// import; src/strategy/** is a guardrail path, so it is left untouched.
const LATEST_METRICS = `
  SELECT m.* FROM metrics m
  JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
    ON m.post_id = lm.post_id AND m.captured_at = lm.mc
`;

interface FamilyPostRow {
  platform: string;
  posted_at: string | null;
  impressions: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  new_follows: number | null;
}

type NumericPostField = "impressions" | "likes" | "replies" | "reposts" | "new_follows";

/** Sum one column across posts, counting how many posts actually carried a value. */
function sumColumn(rows: FamilyPostRow[], field: NumericPostField): MetricRead {
  let value = 0;
  let measured = 0;
  for (const row of rows) {
    const cell = row[field];
    if (typeof cell === "number") {
      value += cell;
      measured += 1;
    }
  }
  return { state: "measured", value, records_measured: measured, records_unmeasured: rows.length - measured };
}

/** Weeks of data per platform, computed exactly as src/strategy/snapshot.ts:78-85 does it. */
function platformConfidence(rows: FamilyPostRow[], now: number): PlatformConfidence[] {
  const platforms = [...new Set(rows.map((r) => r.platform))].sort();
  return platforms.map((platform) => {
    const dates = rows
      .filter((r) => r.platform === platform && r.posted_at)
      .map((r) => new Date(r.posted_at!).getTime())
      .filter((t) => Number.isFinite(t));
    const weeks = dates.length
      ? Math.max(1, Math.round((Math.min(now, Math.max(...dates)) - Math.min(...dates)) / WEEK_MS))
      : 0;
    const sufficient = weeks >= THRESHOLD_WEEKS;
    return {
      platform,
      posts: dates.length,
      weeks,
      status: sufficient ? "OK" : `INSUFFICIENT (<${THRESHOLD_WEEKS} wks), directional only`,
      sufficient,
    };
  });
}

/** The conversational sources §5.8 names for the Conversation family's research half. */
export const CONVERSATION_RESEARCH_SOURCES = ["comment", "dm", "follow_up_question", "reply"] as const;

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table));
}

/**
 * Active (not superseded, not tombstoned) observation counts for the four conversational sources,
 * matching src/research/read.ts's active semantics. Counts only — redacted reply text stays behind
 * buildResearchReport()'s redacted account-level path and never reaches this aggregate.
 */
function conversationResearch(db: Database.Database, brandId?: BrandId): { total: MetricRead; bySource: Record<string, number> } {
  if (!tableExists(db, "research_observations")) {
    return {
      total: {
        state: "not_measured",
        reason:
          "no research_observations table in this database, so the Substack reply-signal capture has never run here",
      },
      bySource: {},
    };
  }
  // The table almost always EXISTS on the real database — schema.sql creates it and openDb() execs
  // schema.sql — so its existence proves nothing about whether capture ever ran. An empty table is
  // "we never looked", not "nobody replied", and reporting it as a measured zero would be exactly
  // the collapse this read exists to prevent. Once ANY observation exists, capture has run, and a
  // zero conversational count is then a real measurement.
  const where = brandId ? " WHERE brand_id = ?" : "";
  const args = brandId ? [brandId] : [];
  const observations = (
    db.prepare(`SELECT COUNT(*) AS count FROM research_observations${where}`).get(...args) as { count: number }
  ).count;
  if (observations === 0) {
    const configured = Boolean(process.env.RESEARCH_HASH_KEY && process.env.RESEARCH_HASH_KEY.trim());
    return {
      total: {
        state: "not_measured",
        reason: configured
          ? "the research_observations table is empty. Capture is configured but has not recorded anything yet, so this is unmeasured, not zero replies"
          : "RESEARCH_HASH_KEY is not set, so research capture cannot write observations (src/research/store.ts:26) and the table is empty. That is unmeasured, not zero replies",
      },
      bySource: {},
    };
  }
  const placeholders = CONVERSATION_RESEARCH_SOURCES.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT source, COUNT(*) AS count FROM research_observations
        WHERE source IN (${placeholders}) AND superseded_by IS NULL AND deleted_at IS NULL${brandId ? " AND brand_id = ?" : ""}
        GROUP BY source ORDER BY source`
    )
    .all(...CONVERSATION_RESEARCH_SOURCES, ...(brandId ? [brandId] : [])) as { source: string; count: number }[];
  const bySource: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    bySource[row.source] = row.count;
    total += row.count;
  }
  return {
    total: { state: "measured", value: total, records_measured: rows.length, records_unmeasured: 0 },
    bySource,
  };
}

// Why audience is only half measurable: there is no landing-page analytics ingest anywhere in this
// repo — no source writes a visit, an opt-in or a survey response into data/analytics.db — so those
// three read not_measured while follower growth reads as the real number it is.
const NO_LANDING_INGEST =
  "no landing-page analytics ingest exists in this repo. Nothing writes visits, opt-ins or survey responses to data/analytics.db, so this is unmeasured, not zero";

// Why business is entirely empty: src/strategy/cta-fit.ts:10 and :166 (echoed at
// src/strategy/frame-fit.ts:10) record that no click or conversion metric survives ingest — clicks
// sums to about forty across 1,229 metric rows and is NULL on linkedin and bluesky. There is no
// funnel-events record anywhere in the codebase to read a purchase or an inquiry from.
const NO_FUNNEL_SOURCE =
  "no funnel record exists. Nothing in this repo captures a qualified inquiry, a call, an opportunity or a purchase, and no click/conversion metric survives ingest (src/strategy/cta-fit.ts:10)";

const BUSINESS_EMPTY_STATE =
  "Until the landing page is live and taking payment there is nothing to measure here. It stays this way, not a zero.";

/**
 * Follower growth from the `audience` table's scalar rows. `follower_total` takes the newest
 * capture per platform (a total is a level, not something to add across captures); `follower_delta`
 * sums the deltas, which is what a delta is for.
 */
function audienceTotals(db: Database.Database, brandId?: BrandId): { followerTotal: MetricRead; followerDelta: MetricRead } {
  if (!tableExists(db, "audience")) {
    const reason = "no audience table in this database, so no follower export has been ingested here";
    return { followerTotal: { state: "not_measured", reason }, followerDelta: { state: "not_measured", reason } };
  }
  const totals = db
    .prepare(
        `SELECT a.platform, a.value_count FROM audience a
        JOIN (SELECT platform, MAX(captured_at) AS mc FROM audience
               WHERE metric_type = 'follower_total'${brandId ? " AND brand_id = ?" : ""} GROUP BY platform) la
          ON a.platform = la.platform AND a.captured_at = la.mc
        WHERE a.metric_type = 'follower_total' AND a.dimension IS NULL${brandId ? " AND a.brand_id = ?" : ""}`
    )
    .all(...(brandId ? [brandId, brandId] : [])) as { platform: string; value_count: number | null }[];
  const deltas = db
    .prepare(`SELECT value_count FROM audience WHERE metric_type = 'follower_delta' AND dimension IS NULL${brandId ? " AND brand_id = ?" : ""}`)
    .all(...(brandId ? [brandId] : [])) as { value_count: number | null }[];

  const roll = (source: { value_count: number | null }[]): MetricRead => {
    if (brandId && source.length === 0) {
      return { state: "not_measured", reason: `no assigned audience captures for ${brandId}` };
    }
    let value = 0;
    let measured = 0;
    for (const row of source) {
      if (typeof row.value_count === "number") {
        value += row.value_count;
        measured += 1;
      }
    }
    return { state: "measured", value, records_measured: measured, records_unmeasured: source.length - measured };
  };
  return { followerTotal: roll(totals), followerDelta: roll(deltas) };
}

/**
 * Group what `data/analytics.db` really holds into the contract's four outcome families. Read-only:
 * this writes nothing, and there is no fifth record.
 *
 * The db handle is injected (as `buildResearchReport` does) so a fixture database can be read in
 * tests; callers in the server pass `openDb()` and close it themselves.
 */
export function readOutcomeFamilies(
  db: Database.Database,
  opts: { generatedAt?: string; now?: number; brandId?: BrandId } = {}
): OutcomeFamilies {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const now = opts.now ?? Date.parse(generatedAt);
  const rows = db
    .prepare(
      opts.brandId
        ? `SELECT p.platform, p.posted_at, m.impressions, m.likes, m.replies, m.reposts, m.new_follows
             FROM posts p
             LEFT JOIN metrics m ON m.rowid = (
               SELECT m2.rowid FROM metrics m2
                WHERE m2.post_id = p.id
                  AND m2.brand_id = p.brand_id
                  AND m2.provider_account_id = p.provider_account_id
                ORDER BY m2.captured_at DESC, m2.rowid DESC LIMIT 1
             )
            WHERE p.brand_id = ?`
        : `SELECT p.platform, p.posted_at, m.impressions, m.likes, m.replies, m.reposts, m.new_follows
             FROM posts p LEFT JOIN (${LATEST_METRICS}) m ON m.post_id = p.id`
    )
    .all(...(opts.brandId ? [opts.brandId] : [])) as FamilyPostRow[];
  const research = conversationResearch(db, opts.brandId);
  const audienceRoll = audienceTotals(db, opts.brandId);
  const excluded_unassigned = {
    posts: Number((db.prepare("SELECT COUNT(*) AS count FROM posts WHERE brand_id IS NULL").get() as { count: number }).count),
    metrics: Number((db.prepare("SELECT COUNT(*) AS count FROM metrics WHERE brand_id IS NULL").get() as { count: number }).count),
    audience: Number((db.prepare("SELECT COUNT(*) AS count FROM audience WHERE brand_id IS NULL").get() as { count: number }).count),
    research: tableExists(db, "research_observations") ? Number((db.prepare("SELECT COUNT(*) AS count FROM research_observations WHERE brand_id IS NULL").get() as { count: number }).count) : 0,
  };

  const result: OutcomeFamilies = {
    generated_at: generatedAt,
    attention: {
      family: "attention",
      question: "Did people see it?",
      impressions: sumColumn(rows, "impressions"),
    },
    conversation: {
      family: "conversation",
      question: "Did people reply, comment, save, share, or DM?",
      likes: sumColumn(rows, "likes"),
      replies: sumColumn(rows, "replies"),
      reposts: sumColumn(rows, "reposts"),
      saves: {
        state: "not_measured",
        reason: "the metrics table has no saves column (src/db/schema.sql), because no platform export ingests saves",
      },
      comments: {
        state: "not_measured",
        reason:
          "the metrics table has no comments column (src/db/schema.sql), so per-post comments are not ingested; replies are a separate column and are reported above",
      },
      research_observations: research.total,
      research_observations_by_source: research.bySource,
    },
    audience: {
      family: "audience",
      question: "Did it bring a landing visit, an opt-in, subscriber growth, or a survey response?",
      new_follows: sumColumn(rows, "new_follows"),
      follower_total: audienceRoll.followerTotal,
      follower_delta: audienceRoll.followerDelta,
      landing_visits: { state: "not_measured", reason: NO_LANDING_INGEST },
      opt_ins: { state: "not_measured", reason: NO_LANDING_INGEST },
      survey_responses: {
        state: "not_measured",
        reason:
          "survey responses live inside a venture's own responses.jsonl, which Signals must never read (docs/venture-schema-contract.md:1343-1347)",
      },
      partial_note:
        "Part of this family is measured and part has no source at all. Follower and subscriber growth are real numbers. Landing visits and opt-ins are not, so they are not summed into one audience figure.",
    },
    business: {
      family: "business",
      question: "Did it lead to a qualified inquiry, a call, an opportunity, or a purchase?",
      qualified_inquiries: { state: "not_measured", reason: NO_FUNNEL_SOURCE },
      calls: { state: "not_measured", reason: NO_FUNNEL_SOURCE },
      opportunities: { state: "not_measured", reason: NO_FUNNEL_SOURCE },
      purchases: { state: "not_measured", reason: NO_FUNNEL_SOURCE },
      empty_state: BUSINESS_EMPTY_STATE,
    },
    confidence: platformConfidence(rows, now),
    sample_rule: SAMPLE_RULE,
    never_collapsed: true,
    excluded_unassigned,
    ...(opts.brandId ? { brand_id: opts.brandId } : {}),
  };
  // An explicitly selected brand with no assigned rows is not a measured zero. This is the
  // honest cold-start state for Charles/Fiction and for any newly-created account.
  if (opts.brandId && rows.length === 0) {
    const empty = (reason: string): MetricRead => ({ state: "not_measured", reason });
    result.attention.impressions = empty(`${opts.brandId} has no assigned posts or provider observations yet; this brand is not measured`);
    result.conversation.likes = empty("no assigned posts for this brand");
    result.conversation.replies = empty("no assigned posts for this brand");
    result.conversation.reposts = empty("no assigned posts for this brand");
    result.audience.new_follows = empty("no assigned posts for this brand");
    result.confidence = [];
  }
  return result;
}

// ── The redacted research read, reachable from the GUI ─────────────────────────────────────────
//
// `src/research/read.ts` already implements the contract's redacted account-level path (§5.4b):
// aggregate counts, `redacted_text` only, never `exact_text` and never a raw `respondent_hash`.
// Until now nothing in the review GUI could reach it. This wrapper is what `/api/research/report`
// serves.
//
// Same file as src/research/capture.ts's COVERAGE_PATH. Duplicated rather than imported because
// capture.ts loads playwright at module scope (via src/pull/browser.ts) and this read never
// launches a browser. `researchCoverageFilename()` is asserted against capture.ts in the tests so
// the two cannot drift apart silently.
export const RESEARCH_COVERAGE_FILENAME = "substack-notes-coverage.jsonl";
export const RESEARCH_COVERAGE_PATH = join(repoRoot, "data", "research", RESEARCH_COVERAGE_FILENAME);

export type ResearchReportRead =
  | {
      state: "available";
      /** True when RESEARCH_HASH_KEY is set, i.e. capture is configured to write new observations. */
      capture_configured: boolean;
      report: ResearchReport;
    }
  | {
      state: "unavailable";
      capture_configured: boolean;
      /** Plain-language reason. Never a report full of zeros standing in for "we never looked". */
      reason: string;
      report: null;
    };

/**
 * Read the redacted research report, degrading to an honest empty read rather than to zeros.
 *
 * Two different absences are reported differently. `capture_configured: false` means
 * `RESEARCH_HASH_KEY` is unset, so `src/research/store.ts:26` refuses to write observations at all
 * and nothing could ever have been captured. An empty table with the key set means capture is
 * configured but has not run or found anything yet. Neither is a measurement of zero replies.
 */
export function readResearchReport(
  db: Database.Database,
  opts: { coveragePath?: string; generatedAt?: string; hashKey?: string | undefined; brandId?: BrandId } = {}
): ResearchReportRead {
  const coveragePath = opts.coveragePath ?? RESEARCH_COVERAGE_PATH;
  const hashKey = "hashKey" in opts ? opts.hashKey : process.env.RESEARCH_HASH_KEY;
  const captureConfigured = Boolean(hashKey && hashKey.trim());
  if (!tableExists(db, "research_observations")) {
    return {
      state: "unavailable",
      capture_configured: captureConfigured,
      reason: "no research_observations table in this database, so research capture has never run here",
      report: null,
    };
  }
  const observations = (
    db.prepare(`SELECT COUNT(*) AS count FROM research_observations${opts.brandId ? " WHERE brand_id = ?" : ""}`)
      .get(...(opts.brandId ? [opts.brandId] : [])) as { count: number }
  ).count;
  if (observations === 0) {
    return {
      state: "unavailable",
      capture_configured: captureConfigured,
      reason: captureConfigured
        ? `${opts.brandId ? `${opts.brandId} has no assigned research observations. ` : "The research_observations table is empty. "}Capture is configured but has not recorded anything yet`
        : `RESEARCH_HASH_KEY is not set, so research capture cannot write observations (src/research/store.ts:26)${opts.brandId ? ` for ${opts.brandId}` : " and the table is empty"}`,
      report: null,
    };
  }
  return {
    state: "available",
    capture_configured: captureConfigured,
    report: buildResearchReport(db, coveragePath, opts.generatedAt, opts.brandId),
  };
}
