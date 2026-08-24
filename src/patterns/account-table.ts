import { validateReviewMetadata, type NormalizedReviewMetadataRecord, type ReviewMetadataInput } from "./review-metadata.js";
import type { ComparisonReadinessInventory, ComparisonReadinessRow } from "./comparison-readiness.js";
import type { CatalogRow } from "./catalog.js";

/** A body-free, read-only account/example handoff for comparison review. */
export const ACCOUNT_EXAMPLE_TABLE_VERSION = "account-example-table-v1" as const;

export interface AccountExampleTableInput {
  readonly reviews: readonly ReviewMetadataInput[];
  readonly comparison: ComparisonReadinessInventory;
  /** Optional catalog rollup for display-only creator/handle context. */
  readonly catalog?: readonly CatalogRow[];
}

export interface AccountExampleRow {
  readonly kind: "account_example_row";
  readonly version: typeof ACCOUNT_EXAMPLE_TABLE_VERSION;
  readonly id: string;
  readonly accountId: string | null;
  readonly exampleId: string | null;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly sourceId: string | null;
  readonly postId: string | null;
  readonly accountSizeSnapshot: NormalizedReviewMetadataRecord["audienceSnapshot"];
  readonly topics: string[] | null;
  readonly focus: string[] | null;
  readonly platform: string | null;
  readonly medium: string | null;
  readonly format: string | null;
  readonly pool: ComparisonReadinessRow["pool"];
  readonly popularityScope: string | null;
  readonly sampleScope: string | null;
  readonly baselineScope: string | null;
  readonly baselineSource: string | null;
  readonly evidenceLinks: string[];
  readonly caveats: string[] | null;
  readonly reviewStatus: "reviewed" | "pending" | "blocked" | "unmapped" | "unreviewed";
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyIncluded: false;
}

export interface AccountExampleTable {
  readonly kind: "account_example_table";
  readonly version: typeof ACCOUNT_EXAMPLE_TABLE_VERSION;
  readonly rows: AccountExampleRow[];
  readonly summary: { ready: number; blocked: number };
  readonly sideEffects: "none";
}

function nullable(value: string | "unknown" | null): string | null {
  return value === null || value === "unknown" ? null : value;
}

function copyList(value: string[] | "unknown" | null): string[] | null {
  return value === null || value === "unknown" ? null : [...value];
}

function reviewKey(review: NormalizedReviewMetadataRecord): string {
  return review.stableAccountId ?? review.currentAccountKey;
}

function stableRecord(value: object): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function reviewFor(reviews: readonly NormalizedReviewMetadataRecord[], accountId: string | null): NormalizedReviewMetadataRecord | null {
  if (accountId === null || accountId === "unknown") return null;
  return reviews.find((review) => reviewKey(review) === accountId || review.currentAccountKey === accountId) ?? null;
}

function catalogFor(catalog: readonly CatalogRow[], accountId: string | null): CatalogRow | null {
  if (accountId === null || accountId === "unknown") return null;
  return catalog.find((row) => row.accountId === accountId || row.key === accountId) ?? null;
}

function metadataBlockers(review: NormalizedReviewMetadataRecord | null): string[] {
  if (review === null) return ["account metadata is unreviewed"];
  const validation = validateReviewMetadata(review);
  const blockers = validation.blockingFields.map((field) => `account metadata ${field} is incomplete`);
  if (validation.errors.length) blockers.push(...validation.errors.map((error) => `account metadata is invalid: ${error}`));
  if (review.disposition !== "reviewed") blockers.push("account metadata is not reviewed");
  return blockers;
}

function rowFor(
  example: ComparisonReadinessRow,
  review: NormalizedReviewMetadataRecord | null,
  catalog: CatalogRow | null,
): AccountExampleRow {
  const blockers = [...metadataBlockers(review), ...example.readiness.blockers];
  const evidenceLinks = new Set<string>(example.evidenceLinks);
  for (const link of review?.evidenceLinks ?? []) if (typeof link === "string") evidenceLinks.add(link);
  const caveats = new Set<string>(example.caveats);
  for (const caveat of review?.caveats ?? []) if (typeof caveat === "string") caveats.add(caveat);
  const status = review?.disposition ?? "unreviewed";
  return {
    kind: "account_example_row",
    version: ACCOUNT_EXAMPLE_TABLE_VERSION,
    id: example.id,
    accountId: nullable(example.accountId),
    exampleId: nullable(example.evidenceId),
    handle: review?.handle ?? catalog?.handle ?? null,
    creator: catalog?.creator ?? review?.creator ?? null,
    sourceId: nullable(example.sourceId),
    postId: nullable(example.postId),
    accountSizeSnapshot: review?.audienceSnapshot ? { ...review.audienceSnapshot } : null,
    topics: copyList(review?.topics ?? null),
    focus: copyList(review?.focus ?? null),
    platform: nullable(review?.platform ?? example.platform),
    medium: nullable(review?.medium ?? example.medium),
    format: nullable(review?.format ?? example.format),
    pool: example.pool,
    // Source/post evidence is authoritative for comparison scope. Account overlay values remain
    // available in the review record but must not overwrite the evidence denominator here.
    popularityScope: example.popularityScope,
    sampleScope: example.sampleScope,
    baselineScope: example.baselineScope,
    baselineSource: example.baselineSource,
    evidenceLinks: [...evidenceLinks].sort(),
    caveats: [...caveats].sort(),
    reviewStatus: status,
    readiness: {
      status: blockers.length === 0 && example.readiness.status === "ready" ? "ready" : "blocked",
      blockers: [...new Set(blockers)].sort(),
    },
    bodyIncluded: false,
  };
}

export function buildAccountExampleTable(input: AccountExampleTableInput): AccountExampleTable {
  const reviews = input.reviews.map((review) => validateReviewMetadata(review).normalized)
    .sort((left, right) => reviewKey(left).localeCompare(reviewKey(right)) || stableRecord(left).localeCompare(stableRecord(right)));
  const rows = [...input.comparison.rows]
    .sort((left, right) => left.id.localeCompare(right.id) || stableRecord(left).localeCompare(stableRecord(right)))
    .map((example) => {
      const accountId = nullable(example.accountId);
      return rowFor(example, reviewFor(reviews, accountId), catalogFor(input.catalog ?? [], accountId));
    });
  const ready = rows.filter((row) => row.readiness.status === "ready").length;
  return {
    kind: "account_example_table",
    version: ACCOUNT_EXAMPLE_TABLE_VERSION,
    rows,
    summary: { ready, blocked: rows.length - ready },
    sideEffects: "none",
  };
}

export const createAccountExampleTable = buildAccountExampleTable;
