import {
  buildLedgerAccountExampleTable,
  type LedgerAccountExampleTable,
} from "./ledger-account-example-table.js";
import {
  buildPlatformPoolMatrixRepoReport,
  type PlatformPoolBaselineFact,
  type PlatformPoolMatrixRepoReport,
} from "./platform-pool-matrix-repo.js";
import type { PatternCatalog } from "./catalog.js";
import type { AccountReviewLedger } from "./account-review-ledger.js";
import type { SourceEvidenceLedger } from "./source-evidence-ledger.js";
import {
  adaptReviewedAccountRow,
  buildReviewedAccountRegistry,
  type ReviewedAccountRegistry,
} from "./reviewed-account-registry.js";

/** Durable reviewed-account registry joined to the operator matrix and example table. */
export const REVIEWED_ACCOUNT_REGISTRY_REPORT_VERSION = "reviewed-account-registry-report-v1" as const;

export interface ReviewedAccountRegistryReportInput {
  readonly accountLedger: AccountReviewLedger | string;
  readonly sourceLedger: SourceEvidenceLedger | string;
  readonly catalog: PatternCatalog;
  readonly baselines?: readonly PlatformPoolBaselineFact[] | ReadonlyMap<string, unknown>;
}

export interface ReviewedAccountRegistryReport {
  readonly kind: "reviewed_account_registry_report";
  readonly version: typeof REVIEWED_ACCOUNT_REGISTRY_REPORT_VERSION;
  readonly registry: ReviewedAccountRegistry;
  readonly accountExamples: LedgerAccountExampleTable;
  readonly platformPoolMatrix: PlatformPoolMatrixRepoReport;
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  /** This bridge is evidence/readiness only; it never selects a best account. */
  readonly winnerClaimsAllowed: false;
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

function blockersFor(report: {
  readonly registry: ReviewedAccountRegistry;
  readonly accountExamples: LedgerAccountExampleTable;
  readonly platformPoolMatrix: PlatformPoolMatrixRepoReport;
}): string[] {
  const blockers = [
    ...report.registry.readiness.blockers.map((blocker) => `registry: ${blocker}`),
    ...report.accountExamples.readiness.blockers.map((blocker) => `account examples: ${blocker}`),
    ...report.platformPoolMatrix.blockedTargets.flatMap((target) => target.blockers.map((blocker) => `matrix ${target.id}: ${blocker}`)),
    ...report.platformPoolMatrix.targets.flatMap((target) => target.blockers.map((blocker) => `matrix ${target.id}: ${blocker}`)),
  ];
  return [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
}

/** Join only explicit durable facts. Catalog research-pool labels remain context, never evidence. */
export function buildReviewedAccountRegistryReport(
  input: ReviewedAccountRegistryReportInput,
): ReviewedAccountRegistryReport {
  const registry = buildReviewedAccountRegistry(input.accountLedger);
  const accountExamples = buildLedgerAccountExampleTable({
    accountLedger: input.accountLedger,
    sourceLedger: input.sourceLedger,
    catalog: input.catalog.rows,
  });
  const platformPoolMatrix = buildPlatformPoolMatrixRepoReport(input.catalog, {
    reviews: registry.rows.map((row) => adaptReviewedAccountRow(row).matrix),
    baselines: input.baselines,
  });
  const readinessBlockers = blockersFor({ registry, accountExamples, platformPoolMatrix });
  return {
    kind: "reviewed_account_registry_report",
    version: REVIEWED_ACCOUNT_REGISTRY_REPORT_VERSION,
    registry,
    accountExamples,
    platformPoolMatrix,
    readiness: {
      status: readinessBlockers.length === 0 ? "ready" : "blocked",
      blockers: readinessBlockers,
    },
    winnerClaimsAllowed: false,
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export const createReviewedAccountRegistryReport = buildReviewedAccountRegistryReport;
