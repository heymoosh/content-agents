import type { AccountBaseline } from "./types.js";
import type { SourceEvidenceRow } from "./source-evidence.js";
import { validateReviewMetadata, type NormalizedReviewMetadataRecord, type ReviewMetadataInput } from "./review-metadata.js";

/** A fail-closed, body-free comparison of explicit niche/broad/format evidence. */
export const POOL_BEST_REPORT_VERSION = "pool-best-report-v1" as const;

export interface PoolBestReportInput {
  readonly evidence: readonly SourceEvidenceRow[];
  readonly reviews: readonly ReviewMetadataInput[];
  readonly baselines: readonly AccountBaseline[];
  /** The declared minimum number of comparable examples required before a winner is named. */
  readonly minimumComparableCandidates: number;
}

export interface PoolBestCandidate {
  readonly id: string;
  readonly accountId: string | null;
  readonly exampleId: string | null;
  readonly platform: string | null;
  readonly pool: SourceEvidenceRow["pool"];
  readonly nicheLabel: string | null;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly topics: string[] | null;
  readonly focus: string[] | null;
  readonly medium: string | null;
  readonly format: string | null;
  readonly metric: {
    readonly name: string | null;
    readonly value: number | null;
    readonly unit: string | null;
    readonly numerator: number | null;
    readonly denominator: number | null;
    readonly window: string | null;
    readonly scope: string | null;
    readonly observedAt: string | null;
  };
  readonly baseline: {
    readonly metric: AccountBaseline["metric"] | null;
    readonly terms: AccountBaseline["terms"] | null;
    readonly median: number | null;
    readonly sampleSize: number | null;
    readonly source: string | null;
    readonly windowStart: string | null;
    readonly windowEnd: string | null;
    readonly collectedAt: string | null;
  };
  readonly multiple: number | null;
  readonly rank: number | null;
  readonly claimStatus: "winner" | "candidate" | "not_claimed";
  readonly evidenceLinks: string[];
  readonly caveats: string[];
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly bodyIncluded: false;
}

export interface PoolBestGroup {
  readonly key: string;
  readonly platform: string | null;
  readonly pool: SourceEvidenceRow["pool"];
  readonly nicheLabel: string | null;
  readonly medium: string | null;
  readonly format: string | null;
  readonly metric: string | null;
  readonly unit: string | null;
  readonly window: string | null;
  readonly scope: string | null;
  readonly popularityScope: string | null;
  readonly sampleScope: string | null;
  readonly baselineScope: string | null;
  readonly baselineSource: string | null;
  readonly baselineTerms: AccountBaseline["terms"] | null;
  readonly baselineWindowStart: string | null;
  readonly baselineWindowEnd: string | null;
  readonly candidateIds: string[];
  readonly eligibleCandidateIds: string[];
  readonly bestExampleIds: string[];
  readonly bestCreators: readonly { readonly id: string; readonly handle: string | null; readonly creator: string | null }[];
  readonly status: "winner" | "blocked";
  readonly blockers: string[];
}

export interface PoolBestReport {
  readonly kind: "pool_best_report";
  readonly version: typeof POOL_BEST_REPORT_VERSION;
  readonly minimumComparableCandidates: number;
  readonly candidates: PoolBestCandidate[];
  readonly groups: PoolBestGroup[];
  readonly summary: {
    readonly groups: number;
    readonly winnerGroups: number;
    readonly blockedGroups: number;
    readonly eligibleCandidates: number;
  };
  readonly sideEffects: "none";
  readonly bodyIncluded: false;
}

interface ReviewState {
  readonly record: NormalizedReviewMetadataRecord | null;
  readonly blockers: string[];
}

function fail(message: string): never {
  throw new TypeError(`invalid pool-best input: ${message}`);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function nullableText(value: unknown): string | null {
  return value === "unknown" ? null : text(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function selectedBaselineLabel(value: string | null): boolean {
  return value !== null && /\b(?:sibling|winner|winners|top|selected)\b/i.test(value);
}

function list(value: unknown): string[] | null {
  if (value === "unknown" || value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim()))].sort();
}

function baselineKey(platform: string, handle: string): string {
  return `${platform.trim().toLowerCase()}|${handle.trim().replace(/^@/, "").toLowerCase()}`;
}

function reviewKey(review: NormalizedReviewMetadataRecord): string {
  return review.stableAccountId ?? review.currentAccountKey;
}

function reviewIndex(reviews: readonly ReviewMetadataInput[]): Map<string, ReviewState> {
  const result = new Map<string, ReviewState>();
  for (const [index, input] of reviews.entries()) {
    const validation = validateReviewMetadata(input);
    const record = validation.normalized;
    const key = reviewKey(record);
    if (result.has(key) || result.has(record.currentAccountKey)) fail(`reviews[${index}] duplicates ${key}`);
    const blockers = [
      ...validation.errors.map((error) => `account metadata is invalid: ${error}`),
      ...validation.blockingFields.map((field) => `account metadata ${field} is incomplete`),
      ...(record.disposition === "reviewed" ? [] : [`account metadata is ${record.disposition}`]),
    ];
    const state = { record, blockers: [...new Set(blockers)].sort() };
    result.set(key, state);
    result.set(record.currentAccountKey, state);
  }
  return result;
}

function reviewFor(index: Map<string, ReviewState>, accountId: string | null): ReviewState {
  if (accountId === null || accountId === "unknown") return { record: null, blockers: ["account metadata is unreviewed"] };
  return index.get(accountId) ?? { record: null, blockers: ["account metadata is unreviewed"] };
}

function baselineIndex(baselines: readonly AccountBaseline[]): Map<string, AccountBaseline> {
  const result = new Map<string, AccountBaseline>();
  for (const [index, baseline] of baselines.entries()) {
    if (typeof baseline !== "object" || baseline === null) fail(`baselines[${index}] must be an object`);
    if (typeof baseline.platform !== "string" || typeof baseline.handle !== "string") fail(`baselines[${index}] needs platform and handle`);
    result.set(baselineKey(baseline.platform, baseline.handle), baseline);
  }
  return result;
}

function metricFact(row: SourceEvidenceRow): PoolBestCandidate["metric"] {
  const value = row.metricSnapshot;
  if (value === null || value === "unknown") {
    return { name: null, value: null, unit: null, numerator: null, denominator: null, window: null, scope: null, observedAt: null };
  }
  return {
    name: nullableText(value.metric),
    value: numberValue(value.value),
    unit: nullableText(value.unit),
    numerator: numberValue(value.numerator),
    denominator: numberValue(value.denominator),
    window: nullableText(value.window),
    scope: nullableText(value.scope),
    observedAt: nullableText(value.observedAt),
  };
}

function baselineFact(baseline: AccountBaseline | undefined): PoolBestCandidate["baseline"] {
  return {
    metric: baseline?.metric ?? null,
    terms: baseline && Array.isArray(baseline.terms) ? [...baseline.terms] : null,
    median: baseline ? numberValue(baseline.median) : null,
    sampleSize: baseline ? numberValue(baseline.sample_size) : null,
    source: baseline ? text(baseline.method) : null,
    windowStart: baseline ? nullableText(baseline.window_start) : null,
    windowEnd: baseline ? nullableText(baseline.window_end) : null,
    collectedAt: baseline ? nullableText(baseline.collected_at) : null,
  };
}

function candidateFor(
  row: SourceEvidenceRow,
  reviewState: ReviewState,
  baseline: AccountBaseline | undefined,
): PoolBestCandidate {
  const review = reviewState.record;
  const metric = metricFact(row);
  const baselineView = baselineFact(baseline);
  const blockers = [...reviewState.blockers];
  if (row.id === null || row.id === "unknown") blockers.push("evidence id is missing");
  if (row.accountId === null || row.accountId === "unknown") blockers.push("account id is missing");
  if (row.platform === null || row.platform === "unknown") blockers.push("platform is missing");
  if (row.pool === null) blockers.push("pool membership is missing");
  if (row.membershipReason === null || row.membershipReason === "unknown") blockers.push("pool membership reason is missing");
  if (row.medium === null || row.medium === "unknown") blockers.push("medium is missing");
  if (row.format === null || row.format === "unknown") blockers.push("format is missing");
  if (row.popularityScope === null || row.popularityScope === "unknown") blockers.push("popularity scope is missing");
  if (row.sampleScope === null || row.sampleScope === "unknown") blockers.push("selection rule is missing");
  if (row.baselineScope === null || row.baselineScope === "unknown") blockers.push("baseline scope is missing");
  if (row.baselineSource === null || row.baselineSource === "unknown") blockers.push("baseline source is missing");
  if (selectedBaselineLabel(nullableText(row.baselineScope)) || selectedBaselineLabel(nullableText(row.baselineSource))
    || selectedBaselineLabel(baselineView.source)) blockers.push("baseline is a selected or winners-only sample");
  if (row.provenance === null || row.provenance === "unknown") blockers.push("evidence provenance is missing");
  if (row.observedAt === null || row.observedAt === "unknown" || row.collectedAt === null || row.collectedAt === "unknown") blockers.push("evidence dates are missing");
  if (row.evidenceLinks === null || row.evidenceLinks === "unknown" || row.evidenceLinks.length === 0) blockers.push("evidence links are missing");
  if (!Array.isArray(row.caveats)) blockers.push("caveats are missing");
  if (row.bodyComplete !== true) blockers.push("body-complete evidence is required");
  if (row.status !== "ready" || row.reviewStatus !== "reviewed" || row.readiness.status !== "ready") blockers.push("source evidence is not reviewed and ready");
  if (metric.name === null || metric.value === null || metric.unit === null || metric.numerator === null || metric.denominator === null
    || metric.window === null || metric.scope === null || metric.observedAt === null) blockers.push("metric snapshot is incomplete");
  if (metric.value !== null && metric.value < 0) blockers.push("metric value cannot be negative");
  if (metric.denominator !== null && metric.denominator <= 0) blockers.push("metric denominator must be positive");
  if (baseline === undefined) blockers.push("recorded baseline is missing");
  if (baselineView.terms === null || baselineView.terms.length === 0) blockers.push("recorded baseline terms are missing");
  if (baselineView.terms && baselineView.terms.some((term) => term !== "views" && term !== "likes" && term !== "comments" && term !== "shares")) blockers.push("recorded baseline terms are invalid");
  if (baselineView.metric === "views" && JSON.stringify(baselineView.terms) !== JSON.stringify(["views"])) blockers.push("recorded baseline terms do not match views");
  if (baselineView.metric === "engagement" && (baselineView.terms?.length === 0 || baselineView.terms?.includes("views"))) blockers.push("recorded baseline terms do not match engagement");
  if (baselineView.metric === null || baselineView.median === null || baselineView.sampleSize === null || baselineView.source === null
    || baselineView.windowStart === null || baselineView.windowEnd === null || baselineView.collectedAt === null) blockers.push("recorded baseline is incomplete");
  if (baselineView.sampleSize !== null && baselineView.sampleSize <= 0) blockers.push("recorded baseline sample must be positive");
  if (baselineView.median !== null && baselineView.median <= 0) blockers.push("recorded baseline median must be positive");
  if (metric.name !== null && baselineView.metric !== null && metric.name !== baselineView.metric) blockers.push("metric does not match recorded baseline");
  if (review && row.platform !== null && row.platform !== "unknown" && review.platform !== row.platform) blockers.push("platform does not match reviewed account metadata");
  if (review && row.medium !== null && row.medium !== "unknown" && review.medium !== row.medium) blockers.push("medium does not match reviewed account metadata");
  if (review && row.format !== null && row.format !== "unknown" && review.format !== row.format) blockers.push("format does not match reviewed account metadata");
  if (review && row.pool !== null && review.researchPoolMembership !== null && review.researchPoolMembership !== "unknown"
    && !review.researchPoolMembership.some((membership) => membership.pool === row.pool)) blockers.push("pool is not an explicit membership on reviewed account metadata");
  if (row.pool === "niche" && (review?.nicheLabel === null || review?.nicheLabel === "unknown")) blockers.push("niche label is missing");
  if (review?.handle === null && row.handle === null && review?.creator === null && row.creator === null) blockers.push("creator or handle is missing");

  const multiple = blockers.length === 0 && baselineView.median !== null && metric.value !== null
    ? metric.value / baselineView.median
    : null;
  return {
    id: row.id === null || row.id === "unknown" ? "unknown" : row.id,
    accountId: row.accountId === "unknown" ? null : row.accountId,
    exampleId: row.id === "unknown" ? null : row.id,
    platform: nullableText(row.platform),
    pool: row.pool,
    nicheLabel: review?.nicheLabel === "unknown" ? null : review?.nicheLabel ?? null,
    handle: review?.handle ?? nullableText(row.handle),
    creator: review?.creator ?? nullableText(row.creator),
    topics: list(review?.topics),
    focus: list(review?.focus),
    medium: nullableText(row.medium),
    format: nullableText(row.format),
    metric,
    baseline: baselineView,
    multiple,
    rank: null,
    claimStatus: "not_claimed",
    evidenceLinks: row.evidenceLinks === "unknown" || row.evidenceLinks === null ? [] : [...row.evidenceLinks].sort(),
    caveats: Array.isArray(row.caveats) ? [...row.caveats].sort() : [],
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)].sort() },
    bodyIncluded: false,
  };
}

function groupKey(candidate: PoolBestCandidate, row: SourceEvidenceRow): string {
  const nicheLabel = candidate.pool === "niche" ? candidate.nicheLabel : "not-applicable";
  const values = [candidate.platform, candidate.pool, nicheLabel, candidate.medium, candidate.format,
    candidate.metric.name, candidate.metric.unit, candidate.metric.denominator, candidate.metric.window, candidate.metric.scope,
    candidate.baseline.metric, candidate.baseline.terms?.join(","), candidate.baseline.windowStart, candidate.baseline.windowEnd,
    row.popularityScope, row.sampleScope, row.baselineScope, row.baselineSource];
  return values.every((value) => value !== null && value !== undefined && value !== "unknown")
    ? values.map((value) => String(value)).join("\u0000")
    : `blocked\u0000${candidate.id}`;
}

function rankGroup(candidates: PoolBestCandidate[], minimum: number, rows: readonly SourceEvidenceRow[]): { candidates: PoolBestCandidate[]; group: PoolBestGroup } {
  const first = candidates[0];
  const source = rows.find((row) => row.id === first.id);
  const blockers = [...new Set(candidates.flatMap((candidate) => candidate.readiness.blockers))].sort();
  if (candidates.some((candidate) => candidate.readiness.status === "blocked")) blockers.push("comparison set contains blocked evidence");
  if (candidates.length < minimum) blockers.push(`fewer than ${minimum} comparable candidates`);
  const ordered = [...candidates].sort((left, right) => (right.multiple ?? -Infinity) - (left.multiple ?? -Infinity) || left.id.localeCompare(right.id));
  const valid = blockers.length === 0;
  const winners = valid ? ordered.filter((candidate) => candidate.multiple === ordered[0]?.multiple) : [];
  const winnerIds = new Set(winners.map((candidate) => candidate.id));
  const ranked = ordered.map((candidate, index) => {
    const rank = valid ? ordered.findIndex((other) => other.multiple === candidate.multiple) + 1 : null;
    return { ...candidate, rank, claimStatus: valid ? (winnerIds.has(candidate.id) ? "winner" : "candidate") : "not_claimed" } as PoolBestCandidate;
  });
  const bestCreators = winners.map((candidate) => ({ id: candidate.id, handle: candidate.handle, creator: candidate.creator }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const nicheLabel = first.pool === "niche" ? first.nicheLabel : null;
  return {
    candidates: ranked,
    group: {
      key: groupKey(first, source ?? ({} as SourceEvidenceRow)),
      platform: first.platform,
      pool: first.pool,
      nicheLabel,
      medium: first.medium,
      format: first.format,
      metric: first.metric.name,
      unit: first.metric.unit,
      window: first.metric.window,
      scope: first.metric.scope,
      popularityScope: source ? nullableText(source.popularityScope) : null,
      sampleScope: source ? nullableText(source.sampleScope) : null,
      baselineScope: source ? nullableText(source.baselineScope) : null,
      baselineSource: source ? nullableText(source.baselineSource) : null,
      baselineTerms: first.baseline.terms,
      baselineWindowStart: first.baseline.windowStart,
      baselineWindowEnd: first.baseline.windowEnd,
      candidateIds: candidates.map((candidate) => candidate.id).sort(),
      eligibleCandidateIds: candidates.filter((candidate) => candidate.readiness.status === "ready").map((candidate) => candidate.id).sort(),
      bestExampleIds: winners.map((candidate) => candidate.id).sort(),
      bestCreators,
      status: valid ? "winner" : "blocked",
      blockers: [...new Set(blockers)].sort(),
    },
  };
}

/** Compare only directly comparable, reviewed source/post facts. No bodies or inferred winners enter the report. */
export function buildPoolBestReport(input: PoolBestReportInput): PoolBestReport {
  if (!Number.isInteger(input.minimumComparableCandidates) || input.minimumComparableCandidates < 2) {
    fail("minimumComparableCandidates must be an integer of at least 2");
  }
  const reviews = reviewIndex(input.reviews);
  const baselines = baselineIndex(input.baselines);
  const rowsById = new Map<string, SourceEvidenceRow>();
  const candidates = input.evidence.map((row) => {
    if (row.id !== null && row.id !== "unknown") {
      if (rowsById.has(row.id)) fail(`evidence id is duplicated: ${row.id}`);
      rowsById.set(row.id, row);
    }
    const reviewState = reviewFor(reviews, row.accountId === "unknown" ? null : row.accountId);
    const review = reviewState.record;
    const baseline = review?.handle && review.platform ? baselines.get(baselineKey(review.platform, review.handle)) : undefined;
    return { candidate: candidateFor(row, reviewState, baseline), row };
  });
  const groups = new Map<string, { candidates: PoolBestCandidate[]; rows: SourceEvidenceRow[] }>();
  for (const item of candidates) {
    const key = groupKey(item.candidate, item.row);
    const group = groups.get(key) ?? { candidates: [], rows: [] };
    group.candidates.push(item.candidate);
    group.rows.push(item.row);
    groups.set(key, group);
  }
  const ranked = [...groups.values()]
    .map((group) => rankGroup(group.candidates, input.minimumComparableCandidates, group.rows))
    .sort((left, right) => left.group.key.localeCompare(right.group.key));
  const orderedCandidates = ranked.flatMap((group) => group.candidates).sort((left, right) => left.id.localeCompare(right.id));
  const orderedGroups = ranked.map((group) => group.group);
  return {
    kind: "pool_best_report",
    version: POOL_BEST_REPORT_VERSION,
    minimumComparableCandidates: input.minimumComparableCandidates,
    candidates: orderedCandidates,
    groups: orderedGroups,
    summary: {
      groups: orderedGroups.length,
      winnerGroups: orderedGroups.filter((group) => group.status === "winner").length,
      blockedGroups: orderedGroups.filter((group) => group.status === "blocked").length,
      eligibleCandidates: orderedCandidates.filter((candidate) => candidate.readiness.status === "ready").length,
    },
    sideEffects: "none",
    bodyIncluded: false,
  };
}

export const createPoolBestReport = buildPoolBestReport;

function markdown(value: string | number | null): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

export function renderPoolBestReportJson(report: PoolBestReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderPoolBestReportMarkdown(report: PoolBestReport): string {
  const lines = [
    "# Pool best report",
    "",
    `Minimum comparable candidates: ${report.minimumComparableCandidates}`,
    `Groups: ${report.summary.groups}; winner groups: ${report.summary.winnerGroups}; blocked groups: ${report.summary.blockedGroups}`,
    "",
    "| Status | Platform | Pool | Niche label | Medium | Format | Metric | Best examples | Best creators | Blockers |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.groups.map((group) => `| ${group.status} | ${markdown(group.platform)} | ${markdown(group.pool)} | ${markdown(group.nicheLabel)} | ${markdown(group.medium)} | ${markdown(group.format)} | ${markdown(group.metric)} ${markdown(group.unit)} | ${markdown(group.bestExampleIds.join(", "))} | ${markdown(group.bestCreators.map((creator) => creator.creator ?? creator.handle ?? creator.id).join(", "))} | ${markdown(group.blockers.join("; "))} |`),
    "",
    "This is a body-free comparison of explicit reviewed source/post evidence. Blocked groups are not winner claims; exact ties remain ties.",
  ];
  return `${lines.join("\n")}\n`;
}
