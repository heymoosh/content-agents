import type { PatternCatalog } from "./catalog.js";
import type { ReviewMetadataRecord } from "./review-metadata.js";

export type ReviewInputTemplateRow = ReviewMetadataRecord;

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Build blank, body-free review rows for every catalog account, including uncollected accounts. */
export function buildReviewInputTemplate(catalog: PatternCatalog): ReviewInputTemplateRow[] {
  return catalog.rows
    .map((row): ReviewInputTemplateRow => ({
      currentAccountKey: row.key,
      platform: row.platform,
      handle: row.handle,
      creator: null,
      stableAccountId: null,
      stableAccountIdStatus: "needs-review",
      topics: null,
      focus: null,
      nicheLabel: null,
      researchPoolMembership: null,
      popularityScope: null,
      sampleScope: null,
      baselineScope: null,
      baselineSource: null,
      medium: null,
      format: null,
      audienceSnapshot: null,
      evidenceLinks: null,
      reviewer: null,
      reviewNote: null,
      disposition: "pending",
      reviewed_at: null,
      caveats: null,
    }))
    .sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey));
}

export function renderReviewInputTemplateJson(catalog: PatternCatalog): string {
  return `${JSON.stringify(buildReviewInputTemplate(catalog), null, 2)}\n`;
}
