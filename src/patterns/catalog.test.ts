import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, renderCatalogJson, renderCatalogMarkdown } from "./catalog.js";
import type { CorpusEntry, PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["civic-democracy", "building-solopreneur"],
  accounts: [
    { platform: "x", handle: "@uncollected", creator: "Uncollected", niche: "civic-democracy", followers: null },
    {
      platform: "x", handle: "@collected", creator: "Collected", niche: "building-solopreneur", followers: 1200,
      topics: ["civic-democracy", "labor"], focus: ["long-form", "systems"], research_pools: ["niche", "broad", "format", "unknown"],
    },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

function post(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "x-collected-1",
    platform: "x",
    handle: "@collected",
    creator: "Collected",
    niche: "building-solopreneur",
    url: "https://example.test/1",
    posted_at: "2026-08-01",
    collected_at: "2026-08-20T00:00:00.000Z",
    kind: "text",
    body: "A complete post",
    transcript_source: null,
    metrics: { views: 4000, likes: 100, comments: null, shares: null, followers: 1200 },
    ...overrides,
  };
}

test("catalog keeps configured targets distinct from collected evidence and aggregates nullable facts", () => {
  const catalog = buildCatalog(config, [
    post({ media: { form: "image", body_is_complete: true }, notes: "followers 1200 from profile, retrieved 2026-08-20; search-biased sample" } as Partial<CorpusEntry>),
    post({
      id: "x-collected-2",
      url: "https://example.test/2",
      collected_at: "2026-08-21T00:00:00.000Z",
      kind: "video",
      body: "",
      transcript_source: "captions",
      niche: "civic-democracy",
      media: { form: "short-video", body_is_complete: false },
    } as Partial<CorpusEntry>),
  ], [
    {
      id: "x-collected-1", platform: "x", handle: "@collected", niche: "building-solopreneur",
      analyzed_at: "2026-08-22", admissible: true, body_complete: true,
      format: "About 22,100 characters, long-form essay with short paragraphs and no hashtags.",
      popularity_scope: "niche", popularity: 100, popularity_metric: "views",
      sample_scope: "search-biased", provenance: "sample was found by search",
    },
    {
      id: "x-collected-2", platform: "x", handle: "@collected", niche: "civic-democracy",
      analyzed_at: "2026-08-23", admissible: false, body_complete: false,
      popularity_scope: "platform-wide", popularity: null, popularity_metric: null,
      baseline_source: "timeline-window",
    },
  ]);

  assert.deepEqual(catalog.rows.map((row) => row.key), ["x|collected", "x|uncollected"]);
  const collected = catalog.rows[0];
  assert.equal(collected.accountId, "x|collected");
  assert.equal(collected.accountIdStatus, "derived");
  assert.equal(collected.niche, "building-solopreneur");
  assert.equal(collected.configured, true);
  assert.equal(collected.collected, true);
  assert.equal(collected.evidenceCount, 2);
  assert.equal(collected.admissibleCount, 1);
  assert.equal(collected.bodyCompleteCount, 1);
  assert.equal(collected.bodyIncompleteCount, 1);
  assert.deepEqual(collected.topics, ["civic-democracy", "labor"]);
  assert.deepEqual(collected.focus, ["long-form", "systems"]);
  assert.deepEqual(collected.researchPools, ["broad", "format", "niche"]);
  assert.deepEqual(collected.formats, ["image", "short-video", "text", "video"]);
  assert.deepEqual(collected.mediaForms, ["image", "short-video"]);
  assert.deepEqual(collected.popularityScopes, ["niche", "platform-wide"]);
  assert.deepEqual(collected.sampleScopes, ["search-biased"]);
  assert.deepEqual(collected.baselineSources, ["timeline-window"]);
  assert.equal(collected.audience.size, 1200);
  assert.equal(collected.audience.countType, "followers");
  assert.equal(collected.audience.provenance, "followers 1200 from profile, retrieved 2026-08-20; search-biased sample");
  assert.equal(collected.lastCollectedAt, "2026-08-21T00:00:00.000Z");
  assert.equal(collected.lastAnalyzedAt, "2026-08-23");

  const markdown = renderCatalogMarkdown(catalog);
  assert.match(markdown, /Audience \(size\/type\/as-of\)/);
  assert.match(markdown, /Popularity scope\(s\)/);
  assert.match(markdown, /Account ID/);
  assert.match(markdown, /Focus/);
  assert.match(markdown, /Research pool\(s\)/);
  assert.match(markdown, /Sample scope\(s\)/);
  assert.match(markdown, /Baseline source\(s\)/);
  assert.match(markdown, /Topics/);
  assert.match(markdown, /Formats/);
  assert.match(markdown, /Media/);
  assert.match(markdown, /Evidence\/admissible\/complete/);
  assert.match(markdown, /Caveats/);
  assert.match(markdown, /1,200 followers \(2026-08-20\)/);
  assert.match(markdown, /niche, platform-wide/);
  assert.match(markdown, /search-biased/);
  assert.match(markdown, /timeline-window/);
  assert.match(markdown, /Niche label/);
  assert.match(markdown, /building-solopreneur/);
  assert.match(markdown, /civic-democracy, labor/);
  assert.match(markdown, /image, short-video, text, video/);
  assert.match(markdown, /2 \/ 1 \/ 1/);
  assert.match(markdown, /followers 1200 from profile/);

  const uncollected = catalog.rows[1];
  assert.equal(uncollected.configured, true);
  assert.equal(uncollected.collected, false);
  assert.equal(uncollected.evidenceCount, 0);
  assert.equal(uncollected.audience.size, null);
  assert.deepEqual(uncollected.popularityScopes, []);
  assert.deepEqual(uncollected.focus, []);
  assert.deepEqual(uncollected.researchPools, []);
  assert.deepEqual(uncollected.sampleScopes, []);
  assert.deepEqual(uncollected.baselineSources, []);

  assert.equal(renderCatalogJson(config, [post()], []), renderCatalogJson(config, [post()], []));
});
