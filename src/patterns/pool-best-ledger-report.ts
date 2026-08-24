import {
  buildPoolBestReport,
  type PoolBestReport,
} from "./pool-best-report.js";
import type { AccountBaseline } from "./types.js";
import {
  buildSourceEvidenceLedger,
  type SourceEvidenceLedger,
} from "./source-evidence-ledger.js";
import {
  adaptReviewedAccountRow,
  buildReviewedAccountRegistry,
  type ReviewedAccountRegistry,
} from "./reviewed-account-registry.js";
import { sourceEvidenceRow } from "./ledger-account-example-table.js";

/** Durable-ledger adapter for the fail-closed niche/broad/format best comparison. */
export const POOL_BEST_LEDGER_REPORT_VERSION = "pool-best-ledger-report-v1" as const;

export interface PoolBestLedgerReportInput {
  readonly accountLedger: Parameters<typeof buildReviewedAccountRegistry>[0];
  readonly sourceLedger: SourceEvidenceLedger | string;
  readonly baselines: readonly AccountBaseline[];
  readonly minimumComparableCandidates: number;
}

export interface PoolBestLedgerReport {
  readonly kind: "pool_best_ledger_report";
  readonly version: typeof POOL_BEST_LEDGER_REPORT_VERSION;
  readonly registry: ReviewedAccountRegistry;
  readonly comparison: PoolBestReport;
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

function sourceLedgerFor(value: SourceEvidenceLedger | string): SourceEvidenceLedger {
  if (typeof value === "string") {
    const rows = value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
      try { return JSON.parse(line) as unknown; }
      catch (error) { throw new TypeError(`source ledger JSONL line ${index + 1} is invalid: ${error instanceof Error ? error.message : String(error)}`); }
    });
    return buildSourceEvidenceLedger(rows);
  }
  if (value === null || typeof value !== "object" || !Array.isArray(value.rows)) {
    throw new TypeError("source ledger must be a SourceEvidenceLedger or JSONL text");
  }
  return buildSourceEvidenceLedger(value.rows);
}

/** Consume the same append-only account/source facts used by the account table. */
export function buildPoolBestLedgerReport(input: PoolBestLedgerReportInput): PoolBestLedgerReport {
  const registry = buildReviewedAccountRegistry(input.accountLedger);
  const source = sourceLedgerFor(input.sourceLedger);
  const reviews = registry.rows.map((row) => adaptReviewedAccountRow(row).metadata);
  const evidence = source.rows.map(sourceEvidenceRow);
  const comparison = buildPoolBestReport({
    evidence,
    reviews,
    baselines: input.baselines,
    minimumComparableCandidates: input.minimumComparableCandidates,
  });
  const blockers = [
    ...registry.readiness.blockers.map((blocker) => `registry: ${blocker}`),
    ...(evidence.length === 0 ? ["source ledger has no comparison evidence"] : []),
    ...comparison.groups
      .filter((group) => group.status === "blocked")
      .flatMap((group) => group.blockers.map((blocker) => `comparison ${group.key}: ${blocker}`)),
  ];
  return {
    kind: "pool_best_ledger_report",
    version: POOL_BEST_LEDGER_REPORT_VERSION,
    registry,
    comparison,
    readiness: {
      status: blockers.length === 0 ? "ready" : "blocked",
      blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)),
    },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export const createPoolBestLedgerReport = buildPoolBestLedgerReport;
