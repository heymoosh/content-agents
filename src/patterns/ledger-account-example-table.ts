import {
  buildAccountReviewLedger,
  readAccountReviewLedger,
  type AccountReviewLedger,
  type AccountReviewLedgerRow,
} from "./account-review-ledger.js";
import { buildAccountExampleTable, type AccountExampleTable, type AccountExampleTableInput } from "./account-table.js";
import { buildComparisonReadiness } from "./comparison-readiness.js";
import type { ReviewMetadataInput } from "./review-metadata.js";
import {
  buildSourceEvidenceLedger,
  type SourceEvidenceLedger,
  type SourceEvidenceLedgerRecord,
} from "./source-evidence-ledger.js";
import type { SourceEvidenceRow } from "./source-evidence.js";
import type { CatalogRow } from "./catalog.js";

/** Durable-ledger join used by the operator-facing account/example table. */
export const LEDGER_ACCOUNT_EXAMPLE_TABLE_VERSION = "ledger-account-example-table-v1" as const;

export interface LedgerAccountExampleTableInput {
  readonly accountLedger: AccountReviewLedger | string;
  readonly sourceLedger: SourceEvidenceLedger | string;
  readonly catalog?: readonly CatalogRow[];
}

export interface LedgerAccountExampleTable {
  readonly kind: "ledger_account_example_table";
  readonly version: typeof LEDGER_ACCOUNT_EXAMPLE_TABLE_VERSION;
  readonly table: AccountExampleTable;
  readonly ledgerSummary: {
    readonly account: AccountReviewLedger["summary"];
    readonly source: SourceEvidenceLedger["summary"];
  };
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyIncluded: false;
  readonly winnerClaimsAllowed: false;
  readonly sideEffects: "none";
}

function currentAccountRows(ledger: AccountReviewLedger): AccountReviewLedgerRow[] {
  const superseded = new Set(ledger.rows.flatMap((row) => row.supersedesId === null ? [] : [row.supersedesId]));
  return ledger.rows.filter((row) => !superseded.has(row.id));
}

function accountReviewInput(row: AccountReviewLedgerRow): ReviewMetadataInput {
  return {
    currentAccountKey: row.currentAccountKey,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    stableAccountId: row.stableAccountId,
    stableAccountIdStatus: row.stableAccountIdStatus,
    topics: list(row.topics),
    focus: list(row.focus),
    nicheLabel: row.nicheLabel,
    researchPoolMembership: row.researchPoolMembership === "unknown" || row.researchPoolMembership === null
      ? row.researchPoolMembership
      : row.researchPoolMembership.map((membership) => ({ ...membership })),
    popularityScope: row.popularityScope,
    sampleScope: row.sampleScope,
    baselineScope: row.baselineScope,
    baselineSource: row.baselineSource,
    medium: row.medium,
    format: row.format,
    audienceSnapshot: row.audienceSnapshot === "unknown" || row.audienceSnapshot === null
      ? null
      : {
        size: row.audienceSnapshot.size === "unknown" ? null : row.audienceSnapshot.size,
        countType: row.audienceSnapshot.countType,
        provenance: row.audienceSnapshot.provenance,
        asOf: row.audienceSnapshot.asOf,
        collectedAt: row.audienceSnapshot.collectedAt,
      },
    evidenceLinks: list(row.evidenceRefs),
    reviewer: row.reviewer,
    reviewNote: row.reviewNote,
    disposition: row.disposition,
    reviewed_at: row.reviewed_at,
    caveats: list(row.caveats),
  };
}

function list(value: readonly string[] | "unknown" | null): string[] | "unknown" | null {
  return value === "unknown" || value === null ? value : [...value];
}

function legacyMetric(row: SourceEvidenceLedgerRecord): SourceEvidenceRow["metric"] {
  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") {
    return { name: row.metricSnapshot === "unknown" ? "unknown" : null, numerator: null, denominator: null, window: null, scope: null };
  }
  return {
    name: row.metricSnapshot.metric,
    numerator: row.metricSnapshot.numerator,
    denominator: row.metricSnapshot.denominator,
    window: row.metricSnapshot.window,
    scope: row.metricSnapshot.scope,
  };
}

/** Convert one validated durable source-ledger fact to the legacy comparison input shape. */
export function sourceEvidenceRow(row: SourceEvidenceLedgerRecord): SourceEvidenceRow {
  const blockers = [...row.readiness.blockers];
  const metricWindow = row.metricSnapshot === null || row.metricSnapshot === "unknown" ? null : row.metricSnapshot.window;
  return {
    id: row.id,
    sourceId: row.sourceId,
    postId: row.postId,
    accountId: row.accountId,
    platform: row.platform,
    medium: row.medium,
    format: row.format,
    pool: row.pool,
    membershipReason: row.membershipReason,
    audienceSizeSnapshot: row.audienceSizeSnapshot,
    metricSnapshot: row.metricSnapshot,
    popularityScope: row.popularityScope,
    sampleScope: row.sampleScope,
    baselineScope: row.baselineScope,
    evidenceLinks: list(row.evidenceRefs),
    baselineSource: row.baselineSource,
    bodyComplete: row.bodyComplete,
    caveats: list(row.caveats),
    provenance: row.provenance,
    observedAt: row.observedAt,
    collectedAt: row.collectedAt,
    reviewStatus: row.reviewStatus,
    status: row.recordStatus,
    lineage: row.lineage,
    handle: null,
    creator: null,
    url: row.url,
    sourceRole: row.sourceRole,
    listing: null,
    window: metricWindow,
    rank: null,
    evidenceLocation: row.evidenceLocation,
    metric: legacyMetric(row),
    selectionRule: row.selectionRule,
    readiness: {
      status: row.readiness.status,
      reason: blockers.length === 0 ? "ready" : blockers.join("; "),
      blockingFields: blockers,
    },
  };
}

function accountLedger(value: AccountReviewLedger | string): AccountReviewLedger {
  if (typeof value === "string") return readAccountReviewLedger(value);
  if (value === null || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error("accountLedger must be an AccountReviewLedger or JSONL text");
  return readAccountReviewLedger(value.rows.map((row) => JSON.stringify(row)).join("\n"));
}

function sourceLedger(value: SourceEvidenceLedger | string): SourceEvidenceLedger {
  if (typeof value === "string") {
    const rows = value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
      try { return JSON.parse(line) as unknown; }
      catch (error) { throw new Error(`sourceLedger JSONL line ${index + 1} is invalid: ${error instanceof Error ? error.message : String(error)}`); }
    });
    return buildSourceEvidenceLedger(rows);
  }
  if (value === null || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error("sourceLedger must be a SourceEvidenceLedger or JSONL text");
  return buildSourceEvidenceLedger(value.rows);
}

function readinessBlockers(
  account: AccountReviewLedger,
  source: SourceEvidenceLedger,
  table: AccountExampleTable,
): string[] {
  const currentAccounts = currentAccountRows(account);
  return [...new Set([
    ...currentAccounts.filter((row) => row.readiness.status !== "ready").flatMap((row) => row.readiness.blockers.map((blocker) => `account ${row.identityKey}: ${blocker}`)),
    ...source.readiness.blockers.map((blocker) => `source ledger: ${blocker}`),
    ...table.rows.filter((row) => row.readiness.status !== "ready").flatMap((row) => row.readiness.blockers.map((blocker) => `table ${row.id}: ${blocker}`)),
  ])].sort((left, right) => left.localeCompare(right));
}

/** Build a deterministic, body-free view from the two durable reviewed-fact ledgers. */
export function buildLedgerAccountExampleTable(input: LedgerAccountExampleTableInput): LedgerAccountExampleTable {
  const account = accountLedger(input.accountLedger);
  const source = sourceLedger(input.sourceLedger);
  const reviews = currentAccountRows(account).map(accountReviewInput);
  const evidence = source.rows.map(sourceEvidenceRow);
  const comparison = buildComparisonReadiness({ reviews, evidence });
  const tableInput: AccountExampleTableInput = { reviews, comparison, catalog: input.catalog };
  const table = buildAccountExampleTable(tableInput);
  const blockers = readinessBlockers(account, source, table);
  return {
    kind: "ledger_account_example_table",
    version: LEDGER_ACCOUNT_EXAMPLE_TABLE_VERSION,
    table,
    ledgerSummary: { account: account.summary, source: source.summary },
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers },
    bodyIncluded: false,
    winnerClaimsAllowed: false,
    sideEffects: "none",
  };
}

export const createLedgerAccountExampleTable = buildLedgerAccountExampleTable;
