import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendSourceDistribution } from "./source-distribution.js";

test("long civic and AI essays get source-specific platform and visual recommendations", () => {
  const body = `${"AI systems, democracy, civic power, community, politics, and social change. ".repeat(90)}\n# One\n# Two\n# Three`;
  const result = recommendSourceDistribution({ body, sourceKind: "substack-essay" });
  assert.deepEqual(result.platforms.map((item) => item.option), ["bluesky", "linkedin", "x", "mastodon", "threads", "instagram", "tiktok", "youtube"]);
  assert.deepEqual(result.media.map((item) => item.option), ["image-carousel", "static-quote-card", "short-video-script"]);
  assert.equal(result.platforms.find((item) => item.option === "tiktok")?.requiredMedia, "short-video-script");
  assert.match(result.platforms[0]!.reason, /civic|technology/i);
});

test("reflective career and purpose essays lead with LinkedIn and Threads", () => {
  const body = `${"My career, work, happiness, purpose, and the good life. ".repeat(90)}\n# Meaning\n# Work`;
  const result = recommendSourceDistribution({ body, sourceKind: "substack-essay" });
  assert.deepEqual(result.platforms.map((item) => item.option), ["linkedin", "threads", "x", "bluesky", "mastodon", "instagram", "tiktok", "youtube"]);
  assert.deepEqual(result.media.map((item) => item.option), ["static-quote-card", "short-video-script"]);
  assert.match(result.platforms[0]!.reason, /career|professional/i);
});

test("short Substack Notes recommend conversational text platforms and no media", () => {
  const result = recommendSourceDistribution({
    body: "Edison said he found 1,000 ways not to build a lightbulb. Most attempts fail.",
    sourceKind: "substack-note",
  });
  assert.deepEqual(result.platforms.map((item) => item.option), ["x", "threads", "bluesky", "mastodon", "linkedin"]);
  assert.deepEqual(result.media, []);
  assert.match(result.mediaRationale, /complete short-form|no media/i);
});
