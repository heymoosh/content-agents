import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, type PatternCatalog } from "./catalog.js";
import {
  buildReviewInputTemplate,
  renderReviewInputTemplateJson,
} from "./review-input-template.js";
import type { PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["systems"],
  accounts: [
    { platform: "x", handle: "@zeta", creator: "Zeta", niche: "systems", followers: null },
    { platform: "x", handle: "@alpha", creator: "Alpha", niche: "systems", followers: null },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

function catalog(): PatternCatalog {
  return buildCatalog(config, [{
    platform: "x",
    handle: "@zeta",
    creator: "Zeta",
    body: "PRIVATE CORPUS BODY MUST NOT APPEAR",
    url: "https://example.test/zeta",
    collected_at: "2026-08-24T00:00:00.000Z",
  }]);
}

test("builds a deterministic, body-free template for every catalog key", () => {
  const first = renderReviewInputTemplateJson(catalog());
  const second = renderReviewInputTemplateJson({ ...catalog(), rows: [...catalog().rows].reverse() });

  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), [
    {
      currentAccountKey: "x|alpha",
      platform: "x",
      handle: "@alpha",
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
    },
    {
      currentAccountKey: "x|zeta",
      platform: "x",
      handle: "@zeta",
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
    },
  ]);
  assert.match(first, /x\|alpha/);
  assert.match(first, /x\|zeta/);
  assert.doesNotMatch(first, /PRIVATE CORPUS BODY/);
  assert.doesNotMatch(first, /Zeta|Alpha|systems/);
  assert.deepEqual(buildReviewInputTemplate(catalog()).map((row) => row.currentAccountKey), ["x|alpha", "x|zeta"]);
});
