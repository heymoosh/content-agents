import {
  readAccountReviewLedger,
  type AccountReviewLedger,
  type AccountReviewLedgerRow,
  type AccountReviewPoolMembership,
} from "./account-review-ledger.js";
import type { PlatformPoolReviewFact } from "./platform-pool-matrix-repo.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

/** The canonical, body-free read view over current reviewed-account facts. */
export const REVIEWED_ACCOUNT_REGISTRY_VERSION = "reviewed-account-registry-v1" as const;

export interface ReviewedAccountRegistryRow {
  readonly kind: "reviewed_account_registry_row";
  readonly version: typeof REVIEWED_ACCOUNT_REGISTRY_VERSION;
  readonly id: string;
  readonly identityKey: string;
  readonly currentAccountKey: string;
  readonly accountId: string | null;
  readonly platform: string;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly nicheLabel: string | "unknown" | null;
  readonly researchPoolMembership: readonly AccountReviewPoolMembership[] | "unknown" | null;
  readonly popularityScope: string | "unknown" | null;
  readonly sampleScope: string | "unknown" | null;
  readonly baselineScope: string | "unknown" | null;
  readonly baselineSource: string | "unknown" | null;
  readonly medium: string | "unknown" | null;
  readonly format: string | "unknown" | null;
  readonly audienceSnapshot: AccountReviewLedgerRow["audienceSnapshot"];
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly baselineRefs: string[] | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly reviewer: string | "unknown" | null;
  readonly reviewNote: string | "unknown" | null;
  readonly reviewedAt: string | "unknown" | null;
  readonly stableAccountIdStatus: AccountReviewLedgerRow["stableAccountIdStatus"];
  readonly disposition: AccountReviewLedgerRow["disposition"];
  readonly dispositionReason: string | "unknown" | null;
  readonly readiness: AccountReviewLedgerRow["readiness"];
  readonly bodyIncluded: false;
}

export interface ReviewedAccountRegistry {
  readonly kind: "reviewed_account_registry";
  readonly version: typeof REVIEWED_ACCOUNT_REGISTRY_VERSION;
  /** Exactly one current row per append-only account identity. */
  readonly rows: ReviewedAccountRegistryRow[];
  readonly summary: {
    readonly total: number;
    readonly reviewed: number;
    readonly ready: number;
    readonly blocked: number;
    readonly pending: number;
    readonly unmapped: number;
  };
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export interface ReviewedAccountRegistryAdapters {
  readonly metadata: ReviewMetadataInput;
  readonly matrix: PlatformPoolReviewFact;
}

function currentRows(ledger: AccountReviewLedger): AccountReviewLedgerRow[] {
  const superseded = new Set(
    ledger.rows.flatMap((row) => row.supersedesId === null ? [] : [row.supersedesId]),
  );
  return ledger.rows
    .filter((row) => !superseded.has(row.id))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey) || left.id.localeCompare(right.id));
}

function asText(value: string | "unknown" | null): string | "unknown" | null {
  return value;
}

function asList(value: readonly string[] | "unknown" | null): string[] | "unknown" | null {
  return value === "unknown" || value === null ? value : [...value];
}

function asMemberships(
  value: readonly AccountReviewPoolMembership[] | "unknown" | null,
): { pool: string; reason: string }[] | "unknown" | null {
  return value === "unknown" || value === null
    ? value
    : value.map((membership) => ({ pool: membership.pool, reason: membership.reason }));
}

function metadataFor(row: AccountReviewLedgerRow): ReviewMetadataInput {
  return {
    currentAccountKey: row.currentAccountKey,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    stableAccountId: row.stableAccountId,
    stableAccountIdStatus: row.stableAccountIdStatus,
    topics: asList(row.topics),
    focus: asList(row.focus),
    nicheLabel: asText(row.nicheLabel),
    researchPoolMembership: asMemberships(row.researchPoolMembership),
    popularityScope: asText(row.popularityScope),
    sampleScope: asText(row.sampleScope),
    baselineScope: asText(row.baselineScope),
    baselineSource: asText(row.baselineSource),
    medium: asText(row.medium),
    format: asText(row.format),
    audienceSnapshot: row.audienceSnapshot === "unknown" || row.audienceSnapshot === null
      ? null
      : {
        size: row.audienceSnapshot.size === "unknown" ? null : row.audienceSnapshot.size,
        countType: row.audienceSnapshot.countType,
        provenance: row.audienceSnapshot.provenance,
        asOf: row.audienceSnapshot.asOf,
        collectedAt: row.audienceSnapshot.collectedAt,
      },
    evidenceLinks: asList(row.evidenceRefs),
    reviewer: asText(row.reviewer),
    reviewNote: asText(row.reviewNote),
    disposition: row.disposition,
    reviewed_at: asText(row.reviewed_at),
    caveats: asList(row.caveats),
  };
}

function matrixFor(row: AccountReviewLedgerRow): PlatformPoolReviewFact {
  return {
    currentAccountKey: row.currentAccountKey,
    reviewStatus: row.disposition,
    reviewedPoolMembership: asMemberships(row.researchPoolMembership) as PlatformPoolReviewFact["reviewedPoolMembership"],
    medium: asText(row.medium),
    format: asText(row.format),
  };
}

function registryRowFor(row: AccountReviewLedgerRow): ReviewedAccountRegistryRow {
  return {
    kind: "reviewed_account_registry_row",
    version: REVIEWED_ACCOUNT_REGISTRY_VERSION,
    id: row.id,
    identityKey: row.identityKey,
    currentAccountKey: row.currentAccountKey,
    accountId: row.stableAccountId === "unknown" ? null : row.stableAccountId,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    topics: asList(row.topics),
    focus: asList(row.focus),
    nicheLabel: asText(row.nicheLabel),
    researchPoolMembership: row.researchPoolMembership === "unknown" || row.researchPoolMembership === null
      ? row.researchPoolMembership
      : row.researchPoolMembership.map((membership) => ({ ...membership })),
    popularityScope: asText(row.popularityScope),
    sampleScope: asText(row.sampleScope),
    baselineScope: asText(row.baselineScope),
    baselineSource: asText(row.baselineSource),
    medium: asText(row.medium),
    format: asText(row.format),
    audienceSnapshot: row.audienceSnapshot === "unknown" || row.audienceSnapshot === null
      ? row.audienceSnapshot
      : { ...row.audienceSnapshot },
    evidenceRefs: asList(row.evidenceRefs),
    baselineRefs: asList(row.baselineRefs),
    caveats: asList(row.caveats),
    reviewer: asText(row.reviewer),
    reviewNote: asText(row.reviewNote),
    reviewedAt: asText(row.reviewed_at),
    stableAccountIdStatus: row.stableAccountIdStatus,
    disposition: row.disposition,
    dispositionReason: asText(row.dispositionReason),
    readiness: { status: row.readiness.status, blockers: [...row.readiness.blockers] },
    bodyIncluded: false,
  };
}

function ledgerFor(value: AccountReviewLedger | string): AccountReviewLedger {
  if (typeof value === "string") return readAccountReviewLedger(value);
  if (value === null || typeof value !== "object" || !Array.isArray(value.rows)) {
    throw new TypeError("account ledger must be an AccountReviewLedger or JSONL text");
  }
  // Re-parse object input through the persisted-row validator so callers cannot bypass
  // append-only identity, readiness, or body-free checks with a caller-shaped object.
  return readAccountReviewLedger(value.rows.map((row) => JSON.stringify(row)).join("\n"));
}

/** Read one current, explicit registry row per account identity. No catalog field is promoted. */
export function buildReviewedAccountRegistry(value: AccountReviewLedger | string): ReviewedAccountRegistry {
  const ledger = ledgerFor(value);
  const rows = currentRows(ledger).map(registryRowFor);
  const blockers = rows.flatMap((row) => row.readiness.status === "ready" ? [] : [`${row.identityKey}: ${row.readiness.blockers.join(", ")}`]);
  return {
    kind: "reviewed_account_registry",
    version: REVIEWED_ACCOUNT_REGISTRY_VERSION,
    rows,
    summary: {
      total: rows.length,
      reviewed: rows.filter((row) => row.disposition === "reviewed").length,
      ready: rows.filter((row) => row.readiness.status === "ready").length,
      blocked: rows.filter((row) => row.readiness.status === "blocked").length,
      pending: rows.filter((row) => row.disposition === "pending").length,
      unmapped: rows.filter((row) => row.disposition === "unmapped").length,
    },
    readiness: {
      status: blockers.length === 0 ? "ready" : "blocked",
      blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)),
    },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

/** Produce the two existing downstream adapters from the same current ledger row. */
export function adaptReviewedAccountRow(row: ReviewedAccountRegistryRow): ReviewedAccountRegistryAdapters {
  const ledgerRow = {
    ...row,
    reviewed_at: row.reviewedAt,
    reviewNote: row.reviewNote,
    supersedesId: null,
    stableAccountId: row.accountId,
    stableAccountIdStatus: row.stableAccountIdStatus,
  } as unknown as AccountReviewLedgerRow;
  return { metadata: metadataFor(ledgerRow), matrix: matrixFor(ledgerRow) };
}

export const createReviewedAccountRegistry = buildReviewedAccountRegistry;
