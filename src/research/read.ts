import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import type { CoverageRecord } from "./capture.js";
import type { BrandId } from "../identity/brand.js";

export interface ResearchMetricSummary {
  latest_value: number | null;
  latest_collected_at: string | null;
  measurements: number;
  measured: number;
  unmeasured: number;
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface ResearchReplyRead {
  observation_id: string;
  note_id: string | null;
  reply_id: string | null;
  parent_reply_id: string | null;
  published_at: string | null;
  redacted_text: string | null;
}

export interface ResearchNoteMetricRead {
  content_item_id: string;
  note_id: string | null;
  values: Record<string, number | null>;
}

export interface ResearchRespondentSummary {
  observation_count: number;
  unique_respondents: number;
  observations_without_respondent_hash: number;
  max_observations_per_respondent: number;
  respondent_observation_distribution: Record<string, number>;
}

export interface ResearchThreadSummary {
  observation_count: number;
  known_respondents: number;
  observations_without_respondent_hash: number;
  max_observations_per_respondent: number;
}

export interface ResearchReport {
  generated_at: string;
  observation_counts: Record<string, number>;
  active_observation_counts: Record<string, number>;
  metrics: Record<string, ResearchMetricSummary>;
  note_metrics: ResearchNoteMetricRead[];
  reply_observations: ResearchReplyRead[];
  creator_reply_observations: number;
  audience_respondent_summary: ResearchRespondentSummary;
  largest_audience_thread: ResearchThreadSummary;
  coverage: CoverageRecord[];
}

interface ResearchReplyRow extends ResearchReplyRead {
  respondent_hash: string | null;
}

interface MetricRow {
  observation_id: string;
  source: string;
  content_item_id: string | null;
  note_id: string | null;
  metric_name: string;
  metric_value: number | null;
  collected_at: string | null;
}

interface CoverageLine {
  run_at?: string;
  source?: CoverageRecord["source"];
  window_start?: string;
  window_end?: string;
  status?: CoverageRecord["status"];
  records_captured?: number;
  gap_reason?: string | null;
}

function metricKey(row: MetricRow): string {
  return `${row.source}\u0000${row.metric_name}\u0000${row.content_item_id ?? ""}`;
}

function newerMetric(candidate: MetricRow, current: MetricRow): boolean {
  const candidateTime = candidate.collected_at ?? "";
  const currentTime = current.collected_at ?? "";
  return candidateTime > currentTime || (candidateTime === currentTime && candidate.observation_id > current.observation_id);
}

function latestMetricRows(rows: MetricRow[]): MetricRow[] {
  const latest = new Map<string, MetricRow>();
  for (const row of rows) {
    const key = metricKey(row);
    const current = latest.get(key);
    if (!current || newerMetric(row, current)) latest.set(key, row);
  }
  return [...latest.values()];
}

function metricSummary(rows: MetricRow[]): ResearchMetricSummary {
  const measured = rows.map((row) => row.metric_value).filter((value): value is number => typeof value === "number");
  const total = measured.reduce((sum, value) => sum + value, 0);
  const latest = rows
    .slice()
    .sort((left, right) => {
      const leftAt = left.collected_at ?? "";
      const rightAt = right.collected_at ?? "";
      return rightAt.localeCompare(leftAt) || right.observation_id.localeCompare(left.observation_id);
    })[0];
  return {
    latest_value: latest?.metric_value ?? null,
    latest_collected_at: latest?.collected_at ?? null,
    measurements: rows.length,
    measured: measured.length,
    unmeasured: rows.length - measured.length,
    min: measured.length ? Math.min(...measured) : null,
    max: measured.length ? Math.max(...measured) : null,
    average: measured.length ? total / measured.length : null,
  };
}

function emptyThreadSummary(): ResearchThreadSummary {
  return {
    observation_count: 0,
    known_respondents: 0,
    observations_without_respondent_hash: 0,
    max_observations_per_respondent: 0,
  };
}

function respondentSummary(rows: ResearchReplyRow[]): ResearchRespondentSummary {
  const observationsByRespondent = new Map<string, number>();
  let observationsWithoutRespondentHash = 0;
  for (const row of rows) {
    if (!row.respondent_hash) {
      observationsWithoutRespondentHash++;
      continue;
    }
    observationsByRespondent.set(row.respondent_hash, (observationsByRespondent.get(row.respondent_hash) ?? 0) + 1);
  }
  const respondentObservationDistribution: Record<string, number> = {};
  for (const count of observationsByRespondent.values()) {
    const key = String(count);
    respondentObservationDistribution[key] = (respondentObservationDistribution[key] ?? 0) + 1;
  }
  return {
    observation_count: rows.length,
    unique_respondents: observationsByRespondent.size,
    observations_without_respondent_hash: observationsWithoutRespondentHash,
    max_observations_per_respondent: observationsByRespondent.size ? Math.max(...observationsByRespondent.values()) : 0,
    respondent_observation_distribution: Object.fromEntries(
      Object.entries(respondentObservationDistribution).sort(([left], [right]) => Number(left) - Number(right))
    ),
  };
}

function largestThreadSummary(rows: ResearchReplyRow[]): ResearchThreadSummary {
  const threads = new Map<string, ResearchReplyRow[]>();
  for (const row of rows) {
    const key = row.note_id ?? "__missing_note__";
    const thread = threads.get(key) ?? [];
    thread.push(row);
    threads.set(key, thread);
  }
  let largest = emptyThreadSummary();
  for (const thread of threads.values()) {
    const summary = respondentSummary(thread);
    const candidate: ResearchThreadSummary = {
      observation_count: summary.observation_count,
      known_respondents: summary.unique_respondents,
      observations_without_respondent_hash: summary.observations_without_respondent_hash,
      max_observations_per_respondent: summary.max_observations_per_respondent,
    };
    if (candidate.observation_count > largest.observation_count) largest = candidate;
  }
  return largest;
}

function readCoverage(path: string): CoverageRecord[] {
  if (!existsSync(path)) return [];
  const latest = new Map<string, { runAt: string; record: CoverageRecord }>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let parsed: CoverageLine;
    try {
      parsed = JSON.parse(line) as CoverageLine;
    } catch {
      continue;
    }
    if (!parsed.source || !parsed.window_start || !parsed.window_end || !parsed.status) continue;
    const record: CoverageRecord = {
      source: parsed.source,
      window_start: parsed.window_start,
      window_end: parsed.window_end,
      status: parsed.status,
      records_captured: typeof parsed.records_captured === "number" ? parsed.records_captured : 0,
      gap_reason: parsed.gap_reason ?? null,
    };
    const runAt = parsed.run_at ?? record.window_end;
    const current = latest.get(record.source);
    if (!current || runAt >= current.runAt) latest.set(record.source, { runAt, record });
  }
  return [...latest.values()]
    .sort((left, right) => left.record.source.localeCompare(right.record.source))
    .map(({ record }) => record);
}

export function buildResearchReport(
  db: Database.Database,
  coveragePath: string,
  generatedAt = new Date().toISOString(),
  brandId?: BrandId,
): ResearchReport {
  const brandWhere = brandId ? " WHERE brand_id = ?" : "";
  const brandAnd = brandId ? " AND brand_id = ?" : "";
  const brandArgs = brandId ? [brandId] : [];
  const observationCounts = Object.fromEntries(
    (db.prepare(`SELECT source, COUNT(*) AS count FROM research_observations${brandWhere} GROUP BY source ORDER BY source`).all(...brandArgs) as { source: string; count: number }[])
      .map((row) => [row.source, row.count])
  );
  const activeObservationCounts = Object.fromEntries(
    (db.prepare(
      `SELECT source, COUNT(*) AS count FROM research_observations WHERE superseded_by IS NULL AND deleted_at IS NULL${brandAnd} GROUP BY source ORDER BY source`
    ).all(...brandArgs) as { source: string; count: number }[]).map((row) => [row.source, row.count])
  );

  const allMetricRows = db
    .prepare(
      `SELECT observation_id, source, content_item_id, note_id, metric_name, metric_value, collected_at
       FROM research_observations
       WHERE source IN ('metric', 'subscriber_movement') AND metric_name IS NOT NULL${brandAnd}`
    )
    .all(...brandArgs) as MetricRow[];
  const currentMetricRows = latestMetricRows(allMetricRows);
  const metrics: Record<string, ResearchMetricSummary> = {};
  for (const row of currentMetricRows) {
    const name = row.metric_name;
    const existing = metrics[name];
    const rows = currentMetricRows.filter((candidate) => candidate.metric_name === name);
    if (!existing) metrics[name] = metricSummary(rows);
  }

  const noteMetricMap = new Map<string, ResearchNoteMetricRead>();
  for (const row of currentMetricRows) {
    if (row.source !== "metric" || !row.content_item_id) continue;
    const current = noteMetricMap.get(row.content_item_id) ?? {
      content_item_id: row.content_item_id,
      note_id: row.note_id,
      values: {},
    };
    current.values[row.metric_name] = row.metric_value;
    noteMetricMap.set(row.content_item_id, current);
  }

  const replyRows = db
    .prepare(
      `SELECT observation_id, note_id, reply_id, parent_reply_id, published_at, redacted_text, respondent_hash
       FROM research_observations
       WHERE source = 'reply' AND is_creator_observation = 0 AND superseded_by IS NULL AND deleted_at IS NULL${brandAnd}
       ORDER BY published_at, observation_id`
    )
    .all(...brandArgs) as ResearchReplyRow[];
  const replyObservations = replyRows.map((row): ResearchReplyRead => ({
    observation_id: row.observation_id,
    note_id: row.note_id,
    reply_id: row.reply_id,
    parent_reply_id: row.parent_reply_id,
    published_at: row.published_at,
    redacted_text: row.redacted_text,
  }));
  const creatorReplyObservations = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM research_observations WHERE source = ? AND is_creator_observation = 1 AND superseded_by IS NULL AND deleted_at IS NULL${brandAnd}`
      )
      .get("reply", ...brandArgs) as { count: number }
  ).count;

  return {
    generated_at: generatedAt,
    observation_counts: observationCounts,
    active_observation_counts: activeObservationCounts,
    metrics,
    note_metrics: [...noteMetricMap.values()].sort((left, right) => left.content_item_id.localeCompare(right.content_item_id)),
    reply_observations: replyObservations,
    creator_reply_observations: creatorReplyObservations,
    audience_respondent_summary: respondentSummary(replyRows),
    largest_audience_thread: largestThreadSummary(replyRows),
    // Existing coverage lines predate brand identity. Do not silently assign them to a brand.
    coverage: brandId ? [] : readCoverage(coveragePath),
  };
}

function markdownCell(value: string | number | null): string {
  return String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderResearchReport(report: ResearchReport): string {
  const respondentDistribution = Object.entries(report.audience_respondent_summary.respondent_observation_distribution)
    .map(([observations, respondents]) => `${respondents} with ${observations}`)
    .join(", ");
  const largestAudienceThread = report.largest_audience_thread;
  const synthesis = [
    "## Corpus synthesis",
    "",
    `Audience reply observations: ${report.audience_respondent_summary.observation_count}`,
    `Unique audience respondents: ${report.audience_respondent_summary.unique_respondents}`,
    `Audience observations without respondent hash: ${report.audience_respondent_summary.observations_without_respondent_hash}`,
    `Author replies excluded: ${report.creator_reply_observations}`,
    largestAudienceThread.observation_count
      ? `Largest audience thread: ${largestAudienceThread.observation_count} observations from ${largestAudienceThread.known_respondents} known respondents; one respondent contributed ${largestAudienceThread.max_observations_per_respondent} observations.`
      : "Largest audience thread: 0 observations.",
    `Respondent observation distribution: ${respondentDistribution || "none"} (each entry is respondent count with that many observations).`,
    "",
    "Raw reply observations below remain one row per reply for auditability. Respondent-level counts above use one keyed respondent once, so a prolific participant cannot appear as several people. This is a manual cross-corpus synthesis of the redacted audience replies; it is not a scale classifier and does not assign taxonomy labels.",
    "",
    "### 1. Human meaning, agency, and the AI transition",
    "",
    "Audience replies repeatedly moved beyond capability and productivity toward purpose, dignity, judgment, identity, and what humans should continue choosing to do. The recurring concern is not simply job loss; it is that economic systems may define human worth too narrowly while AI adoption accelerates.",
    "",
    "Implication: people may value tools that help them make deliberate, human-centered choices about AI, rather than tools that optimize every activity by default.",
    "",
    "### 2. Intellectual isolation and discovery of aligned people",
    "",
    "People described difficulty finding an audience for research, ethics, nuance, and socially useful technology. They feel screened out by startup metrics, investor networks, and dominant tech narratives. The largest conversation was primarily about belonging and finding others who share a broader definition of value.",
    "",
    "Implication: discovery and belonging are meaningful needs here, especially for builders and researchers who do not identify with the conventional venture-backed technology path.",
    "",
    "### 3. Economic power, institutional distrust, and opaque systems",
    "",
    "Many replies connected AI concerns to shareholder primacy, wealth concentration, political influence, ownership, labor, and institutional capture. A repeated frustration is that ordinary people can sense the system is shaping their options but cannot easily see how incentives, money, and decisions connect.",
    "",
    "Implication: explanation, provenance, and accountability may matter more than another generic AI assistant. People want complex systems made legible enough to reason about and challenge.",
    "",
    "### 4. The insight-to-action and coordination gap",
    "",
    "A smaller but concrete set of audience replies asked how to move from awareness to action: identify what is possible with one’s current power, choose a lane, find collaborators, create reasons to meet regularly, and build durable community. Others asked what a small group of humans plus an inexpensive AI subscription could actually accomplish.",
    "",
    "Implication: the opportunity is an operational bridge from concern to a bounded next step, collaborators, evidence, and follow-through—not merely more analysis or discussion.",
    "",
    "### 5. Civic understanding and trustworthy public information",
    "",
    "Replies around the voting tool showed interest in issue-based civic information, election transparency, sources, limitations, and understanding why representatives act as they do. The strongest product concern is trust: freshness, explainability, and visible disagreement matter when AI is used to summarize public facts.",
    "",
    "Implication: a civic product should show source dates, uncertainty, provenance, and human-review boundaries instead of presenting a confident answer without an audit trail.",
    "",
    "### 6. Practical, underfunded, human-scale building",
    "",
    "Several people expressed enthusiasm for small tools that improve civic understanding, reduce administrative burden, help niche communities, or make public information easier to use. They see AI as lowering the cost of building, while also arguing that cheaper capability does not fix the incentive system that ignores problems without a large market or exit story.",
    "",
    "Implication: free, low-cost, open, or sustainable-small business models may fit this audience better than a growth-at-all-costs product story.",
    "",
    "### 7. Evidence, translation, and psychological safety",
    "",
    "People asked for concrete studies, research, ethical framing, and guidance rather than fear or hype. They also described stress, overload, polarization, and a lack of public guidance as conditions that make it harder to think clearly about AI.",
    "",
    "Implication: research products should translate evidence into understandable choices and actions while preserving uncertainty; they should not intensify helplessness or outrage without a next step.",
    "",
    "### Guardrails on interpretation",
    "",
    "The corpus is self-selected, includes nested replies, and is concentrated in one large thread. Reply observations are not unique people; use the respondent counts above for person-level interpretation. The corpus does not establish prevalence or willingness to pay. Views were not available from the public feed, and classification remains intentionally deferred until a hand-labeled gold set exists.",
    "",
  ];
  const lines = [
    "# Substack research report",
    "",
    `Generated: ${report.generated_at}`,
    "",
    ...synthesis,
    "## Coverage",
    "",
    "| Source | Status | Records | Gap |",
    "| --- | --- | ---: | --- |",
    ...report.coverage.map((row) => `| ${row.source} | ${row.status} | ${row.records_captured} | ${markdownCell(row.gap_reason)} |`),
    "",
    "## Stored observations",
    "",
    ...Object.entries(report.active_observation_counts).map(([source, count]) => `- ${source}: ${count} active`),
    ...(Object.keys(report.active_observation_counts).length ? [] : ["- none"]),
    "",
    "## Note metrics",
    "",
    "| Metric | Latest | Measured | Unmeasured | Min | Max | Average |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...Object.entries(report.metrics).map(([name, summary]) =>
      `| ${name} | ${markdownCell(summary.latest_value)} | ${summary.measured} | ${summary.unmeasured} | ${markdownCell(summary.min)} | ${markdownCell(summary.max)} | ${markdownCell(summary.average)} |`
    ),
    ...(Object.keys(report.metrics).length ? [] : ["| — | — | 0 | 0 | — | — | — |"]),
    "",
    "## Current reply observations (one row per reply)",
    "",
  ];
  if (report.reply_observations.length === 0) {
    lines.push("No current reply observations.");
  } else {
    for (const observation of report.reply_observations) {
      lines.push(
        `- ${observation.observation_id} · note ${observation.note_id ?? "—"} · reply ${observation.reply_id ?? "—"}: ${markdownCell(observation.redacted_text)}`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
