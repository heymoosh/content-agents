import type { CatalogRow, PatternCatalog } from "./catalog.js";
import type {
  PoolReviewCoverageArtifact,
  PoolReviewCoverageRow,
  PoolReviewCoverageStatus,
  ReviewedPoolLabels,
} from "./review-pool-coverage.js";

export const POOL_REVIEW_HANDOFF_VERSION = "pool-review-handoff-v1" as const;

export interface PoolReviewHandoffInput {
  readonly catalog: PatternCatalog | readonly CatalogRow[];
  readonly coverage: PoolReviewCoverageArtifact;
}

export interface PoolReviewHandoffRow {
  readonly currentAccountKey: string;
  readonly accountId: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly configured: boolean;
  readonly collected: boolean;
  readonly audience: CatalogRow["audience"];
  readonly niche: string | null;
  readonly topics: string[];
  readonly focus: string[];
  readonly formats: string[];
  readonly mediaForms: string[];
  /** Explicit review metadata only. Catalog researchPools are intentionally absent. */
  readonly reviewedPoolLabels: ReviewedPoolLabels;
  readonly disposition: PoolReviewCoverageRow["disposition"];
  readonly status: PoolReviewCoverageStatus;
  readonly evidenceCount: number;
  readonly blockers: string[];
  readonly nextAction: string;
  readonly bodyIncluded: false;
}

export interface PoolReviewHandoffArtifact {
  readonly kind: "pool_review_handoff";
  readonly version: typeof POOL_REVIEW_HANDOFF_VERSION;
  readonly rows: PoolReviewHandoffRow[];
  readonly summary: {
    readonly total: number;
    readonly explicitPoolReviewRows: number;
    readonly choiceRequiredRows: number;
    readonly reviewed: number;
    readonly pending: number;
    readonly blocked: number;
    readonly unmapped: number;
  };
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
  readonly note: string;
}

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function catalogRows(catalog: PatternCatalog | readonly CatalogRow[]): readonly CatalogRow[] {
  return "rows" in catalog ? catalog.rows : catalog;
}

function coverageByKey(coverage: PoolReviewCoverageArtifact): Map<string, PoolReviewCoverageRow> {
  return new Map([...coverage.rows]
    .sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey))
    .map((row) => [row.currentAccountKey, row]));
}

function missingCoverage(accountKey: string): PoolReviewCoverageRow {
  return {
    currentAccountKey: accountKey,
    platform: "unknown",
    handle: null,
    evidenceCount: 0,
    reviewedPoolLabels: null,
    disposition: null,
    status: "unmapped",
    blockers: ["pool review coverage is missing"],
    nextAction: "run pool review coverage and add explicit review metadata",
  };
}

function explicitPoolChoiceRequired(coverage: PoolReviewCoverageRow): boolean {
  return coverage.status !== "reviewed"
    || coverage.reviewedPoolLabels === null
    || coverage.reviewedPoolLabels === "unknown"
    || coverage.reviewedPoolLabels.length === 0;
}

/**
 * Join account context to the explicit pool-review coverage handoff.
 *
 * Catalog fields provide context only. They never become pool labels, review decisions, or
 * comparison claims. The projection contains no post bodies and performs no I/O or mutation.
 */
export function buildPoolReviewHandoff(input: PoolReviewHandoffInput): PoolReviewHandoffArtifact {
  const byKey = coverageByKey(input.coverage);
  const rows = [...catalogRows(input.catalog)]
    .sort((left, right) => compareValues(left.key, right.key))
    .map((catalogRow): PoolReviewHandoffRow => {
      const coverage = byKey.get(catalogRow.key) ?? missingCoverage(catalogRow.key);
      return {
        currentAccountKey: catalogRow.key,
        accountId: catalogRow.accountId,
        platform: catalogRow.platform,
        handle: catalogRow.handle,
        creator: catalogRow.creator,
        configured: catalogRow.configured,
        collected: catalogRow.collected,
        audience: { ...catalogRow.audience },
        niche: catalogRow.niche,
        topics: [...catalogRow.topics],
        focus: [...catalogRow.focus],
        formats: [...catalogRow.formats],
        mediaForms: [...catalogRow.mediaForms],
        reviewedPoolLabels: coverage.reviewedPoolLabels,
        disposition: coverage.disposition,
        status: coverage.status,
        evidenceCount: catalogRow.evidenceCount,
        blockers: [...coverage.blockers],
        nextAction: coverage.nextAction,
        bodyIncluded: false,
      };
    });

  const summary = {
    total: rows.length,
    explicitPoolReviewRows: rows.filter((row) => row.status === "reviewed" && !explicitPoolChoiceRequired(row)).length,
    choiceRequiredRows: rows.filter(explicitPoolChoiceRequired).length,
    reviewed: rows.filter((row) => row.status === "reviewed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
    unmapped: rows.filter((row) => row.status === "unmapped").length,
  };

  return {
    kind: "pool_review_handoff",
    version: POOL_REVIEW_HANDOFF_VERSION,
    rows,
    summary,
    bodyIncluded: false,
    sideEffects: "none",
    note: "Human pool-review handoff only. Account context is shown for review, while pool labels and review states come only from explicit validated metadata. No creator post bodies, inference, ranking, fetching, approval, persistence, or publishing occurs.",
  };
}

export const createPoolReviewHandoff = buildPoolReviewHandoff;

function markdownText(value: string | number | null): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderPoolReviewHandoffJson(artifact: PoolReviewHandoffArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function renderPoolReviewHandoffMarkdown(artifact: PoolReviewHandoffArtifact): string {
  const audienceText = (row: PoolReviewHandoffRow): string => [
    row.audience.size === null ? null : String(row.audience.size),
    row.audience.countType,
    row.audience.asOf,
    row.audience.provenance,
  ].filter((value): value is string => value !== null && value.length > 0).join("; ");
  const lines = [
    "# Pool review handoff",
    "",
    `- Accounts: ${artifact.summary.total}`,
    `- Explicit pool review: ${artifact.summary.explicitPoolReviewRows}`,
    `- Choice required: ${artifact.summary.choiceRequiredRows}`,
    `- Reviewed / pending / blocked / unmapped: ${artifact.summary.reviewed} / ${artifact.summary.pending} / ${artifact.summary.blocked} / ${artifact.summary.unmapped}`,
    "",
    "| Account | Platform | Handle | Creator | Audience evidence | Niche | Topic / focus | Formats / media forms | Configured / collected | Pool labels | Status | Blockers | Next action |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...artifact.rows.map((row) => `| ${markdownText(row.currentAccountKey)} | ${markdownText(row.platform)} | ${markdownText(row.handle)} | ${markdownText(row.creator)} | ${markdownText(audienceText(row))} | ${markdownText(row.niche)} | ${markdownText([...row.topics, ...row.focus].join(", "))} | ${markdownText([...row.formats, ...row.mediaForms].join(", "))} | ${row.configured ? "yes" : "no"} / ${row.collected ? "yes" : "no"} | ${markdownText(Array.isArray(row.reviewedPoolLabels) ? row.reviewedPoolLabels.join(", ") : row.reviewedPoolLabels)} | ${markdownText(row.status)} | ${markdownText(row.blockers.join(", "))} | ${markdownText(row.nextAction)} |`),
    "",
    `- Note: ${artifact.note}`,
    "",
  ];
  return lines.join("\n");
}

export function renderPoolReviewHandoff(artifact: PoolReviewHandoffArtifact, format: "json" | "markdown" | "both"): string {
  if (format === "json") return renderPoolReviewHandoffJson(artifact);
  if (format === "markdown") return renderPoolReviewHandoffMarkdown(artifact);
  return `${renderPoolReviewHandoffJson(artifact)}\n${renderPoolReviewHandoffMarkdown(artifact)}`;
}
