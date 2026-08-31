import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSignalsRecommendationRead, recommendContentPreselection, summarizePerformance, type PerformanceObservation } from "./signals-recommendations.js";

const data: PerformanceObservation[] = [
  { topic: "convenience", platform: "bluesky", media: "image", format: "summary", score: 8, measured: true, sample: "live", weeks: 8 },
  { topic: "convenience", platform: "bluesky", media: "image", format: "thread", score: 0, measured: true, sample: "live", weeks: 8 },
  { topic: "convenience", platform: "substack", media: "text", format: "summary", score: 5, measured: false, sample: "sample", weeks: 2 },
];

describe("signals recommendations", () => {
  test("summarizes actionable measured performance and distinguishes sample/live and unmeasured from zero", () => {
    const read = summarizePerformance(data, { topic: "convenience" });
    assert.equal(read.sufficient, true);
    assert.equal(read.top.platform, "bluesky");
    assert.equal(read.top.media, "image");
    assert.equal(read.top.format, "summary");
    assert.equal(read.top.score, 8);
    assert.equal(read.top.sample, "live");
    assert.equal(read.unmeasured, 1);
    assert.equal(read.zeroMeasured, 1);
    assert.match(read.action, /Use|lean|summary/i);
  });

  test("uses safe cold-start defaults when evidence is insufficient", () => {
    const read = summarizePerformance(data.map((item) => ({ ...item, weeks: 2 })), { topic: "new" });
    assert.equal(read.sufficient, false);
    assert.equal(read.top.source, "cold-start-default");
    assert.deepEqual(read.top, { topic: "new", platform: "bluesky", media: "static-quote-card", format: "summary", score: null, sample: "default", source: "cold-start-default" });
  });

  test("returns explanations and recommendations that callers can override", () => {
    const result = recommendContentPreselection(data, { topic: "convenience" });
    assert.equal(result.platforms.find((item) => item.option === "bluesky")?.recommended, true);
    assert.match(result.platforms.find((item) => item.option === "bluesky")?.explanation ?? "", /live/i);
    assert.equal(result.media.some((item) => item.option === "image" && item.recommended), true);
    assert.equal(result.overridable, true);
  });

  test("provides an honest sample read for Signals and separate cold-start defaults for real requests", () => {
    const read = buildSignalsRecommendationRead();
    assert.equal(read.performance.summary.top.sample, "sample");
    assert.equal(read.performance.summary.top.source, "measured-evidence");
    assert.equal(read.contentDefaults.summary.top.sample, "default");
    assert.equal(read.contentDefaults.summary.top.source, "cold-start-default");
    assert.equal(read.contentDefaults.overridable, true);
  });
});
