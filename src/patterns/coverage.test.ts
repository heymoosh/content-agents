import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog } from "./catalog.js";
import { buildCoverageReport, renderCoverageJson, renderCoverageMarkdown } from "./coverage.js";
import type { CorpusEntry, PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["civic-democracy", "labor"],
  accounts: [
    { platform: "x", handle: "@unknown", creator: "Unknown", niche: "civic-democracy", followers: null },
    { platform: "youtube", handle: "@researched", creator: "Researched", niche: "labor", topics: ["labor"], followers: 100, research_pools: ["broad"] },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

function post(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "youtube-researched-1",
    platform: "youtube",
    handle: "@researched",
    creator: "Researched",
    niche: "labor",
    url: "https://example.test/1",
    posted_at: "2026-08-01",
    collected_at: "2026-08-20T00:00:00.000Z",
    kind: "video",
    body: "A complete post",
    transcript_source: "captions",
    metrics: { views: 4000, likes: 100, comments: null, shares: null, followers: 100 },
    ...overrides,
  };
}

test("coverage sorts cells and preserves null dimensions instead of inferring research pools", () => {
  const catalog = buildCatalog(config, [post()], [
    {
      platform: "youtube", handle: "@researched", niche: "labor", analyzed_at: "2026-08-22",
      admissible: true, body_complete: true, format: "video", popularity_scope: "platform-wide",
    },
  ]);

  const report = buildCoverageReport({ ...catalog, rows: [...catalog.rows].reverse() });

  assert.deepEqual(report.accountRows.map((row) => row.accountId), ["x|unknown", "youtube|researched"]);
  assert.deepEqual(report.accountRows[0], {
    accountId: "x|unknown", platform: "x", handle: "@unknown", creator: "Unknown", niche: "civic-democracy",
    audience: { size: null, countType: null, provenance: null, asOf: null },
    topics: [], focus: [], researchPools: [], popularityScopes: [], sampleScopes: [],
    baselineSources: [], formats: [], evidenceCount: 0, caveats: [],
  });
  assert.deepEqual(report.accountRows[1], {
    accountId: "youtube|researched", platform: "youtube", handle: "@researched", creator: "Researched", niche: "labor",
    audience: { size: 100, countType: "followers", provenance: null, asOf: null },
    topics: ["labor"], focus: [], researchPools: ["broad"], popularityScopes: ["platform-wide"],
    sampleScopes: [], baselineSources: [], formats: ["video"], evidenceCount: 1, caveats: [],
  });

  assert.deepEqual(report.cells.map((cell) => [cell.platform, cell.researchPool, cell.topic, cell.format, cell.evidenceState]), [
    ["x", null, null, null, "none"],
    ["youtube", "broad", "labor", "video", "present"],
  ]);
  assert.deepEqual(report.cells[0], {
    platform: "x", researchPool: null, topic: null, format: null, evidenceState: "none",
    accountCount: 1, evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0,
  });
  assert.equal(report.summary.accountCount, 2);
  assert.equal(report.summary.evidenceCount, 1);
  assert.deepEqual(report.gaps.noResearchPoolAccountIds, ["x|unknown"]);
  assert.deepEqual(report.gaps.noPopularityScopeAccountIds, ["x|unknown"]);
  assert.deepEqual(report.gaps.noTopicAccountIds, ["x|unknown"]);
  assert.deepEqual(report.gaps.noFocusAccountIds, ["x|unknown", "youtube|researched"]);
  assert.deepEqual(report.gaps.noSampleScopeAccountIds, ["x|unknown", "youtube|researched"]);
  assert.deepEqual(report.gaps.noBaselineSourceAccountIds, ["x|unknown", "youtube|researched"]);
  assert.equal(report.cells.some((cell) => cell.researchPool === "niche"), false);
});

test("coverage renderers are deterministic and expose gaps", () => {
  const report = buildCoverageReport(buildCatalog(config));
  const json = renderCoverageJson(report);
  const markdown = renderCoverageMarkdown(report);

  assert.equal(json, renderCoverageJson(report));
  assert.match(markdown, /No research pool: 1 account/);
  assert.match(markdown, /No popularity scope: 2 accounts/);
  assert.match(markdown, /## Account inventory/);
  assert.match(markdown, /\| Account \| Platform \| Handle \| Creator \| Niche label \| Audience size/);
  assert.match(markdown, /x \| null \| null \| null \| none/);
  assert.match(markdown, /No topic: 1 account/);
});
