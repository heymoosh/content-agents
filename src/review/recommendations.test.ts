import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECOMMENDATION_STATES,
  describeRecommendation,
  blockedRecommendationRead,
  recommendationExamplesShown,
  RECOMMENDATION_EXAMPLE_NOTICE,
  FORBIDDEN_RECOMMENDATION_CLAIMS,
  claimsLiveness,
  type RecommendationExample,
  type RecommendationRead,
} from "./recommendations.js";

const sampleExamples: RecommendationExample[] = [
  {
    id: "ex-1",
    platform: "x",
    mechanism: "short-hook",
    whyItCouldFit: "shape only",
    evidence: [{ label: "sample", reference: "fixture", caveat: "illustration" }],
    confidence: "low",
  },
];

test("RECOMMENDATION_STATES has exactly the five states and no available or live member", () => {
  assert.equal(RECOMMENDATION_STATES.length, 5);
  assert.deepEqual([...RECOMMENDATION_STATES], [
    "blocked",
    "insufficient-evidence",
    "awaiting-review",
    "unavailable",
    "empty",
  ]);
  assert.ok(!RECOMMENDATION_STATES.includes("available" as never));
  assert.ok(!RECOMMENDATION_STATES.includes("live" as never));
});

test("describeRecommendation returns non-empty headline and detail for every state", () => {
  for (const state of RECOMMENDATION_STATES) {
    const { headline, detail } = describeRecommendation(state);
    assert.ok(headline.trim().length > 0, `${state} headline empty`);
    assert.ok(detail.trim().length > 0, `${state} detail empty`);
  }
});

test("describeRecommendation copy has no em dash and claims no liveness", () => {
  for (const state of RECOMMENDATION_STATES) {
    const { headline, detail } = describeRecommendation(state);
    assert.ok(!headline.includes("—"), `${state} headline has em dash`);
    assert.ok(!detail.includes("—"), `${state} detail has em dash`);
    assert.equal(claimsLiveness(headline), false, `${state} headline claims liveness`);
    assert.equal(claimsLiveness(detail), false, `${state} detail claims liveness`);
  }
});

test("blockedRecommendationRead is blocked, reviewed-interface, and has no examples", () => {
  const read = blockedRecommendationRead();
  assert.equal(read.availability, "blocked");
  assert.equal(read.source, "reviewed-interface");
  assert.deepEqual(read.examples, []);
  const copy = describeRecommendation("blocked");
  assert.equal(read.headline, copy.headline);
  assert.equal(read.detail, copy.detail);
});

test("recommendationExamplesShown drops examples on reviewed-interface reads", () => {
  const read: RecommendationRead = {
    availability: "blocked",
    source: "reviewed-interface",
    headline: "x",
    detail: "y",
    examples: sampleExamples,
  };
  assert.deepEqual(recommendationExamplesShown(read), []);
});

test("recommendationExamplesShown returns examples for fixture-example reads", () => {
  const read: RecommendationRead = {
    availability: "empty",
    source: "fixture-example",
    headline: "x",
    detail: "y",
    examples: sampleExamples,
  };
  assert.deepEqual(recommendationExamplesShown(read), sampleExamples);
});

test("claimsLiveness is true for each forbidden word and false for near-misses", () => {
  for (const word of FORBIDDEN_RECOMMENDATION_CLAIMS) {
    assert.equal(
      claimsLiveness(`This looks like a ${word} option for the piece.`),
      true,
      `expected true for "${word}"`,
    );
  }
  assert.equal(claimsLiveness("This is a bestseller in its niche."), false);
  assert.equal(claimsLiveness("Check the approvals queue first."), false);
  assert.equal(claimsLiveness("The process is still alive."), false);
  assert.equal(claimsLiveness("It scored top-performingly in the trial."), false);
});

test("RECOMMENDATION_EXAMPLE_NOTICE is honest and claims no liveness", () => {
  assert.ok(RECOMMENDATION_EXAMPLE_NOTICE.trim().length > 0);
  assert.ok(!RECOMMENDATION_EXAMPLE_NOTICE.includes("—"));
  assert.equal(claimsLiveness(RECOMMENDATION_EXAMPLE_NOTICE), false);
});

test("no file under src/review/ contains the forbidden corpus path segment", () => {
  // Build the needle at runtime so this test file does not itself contain the banned substring.
  const needle = ["creator", "content"].join("-");
  const dir = dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
  assert.ok(files.length > 0, "expected at least one .ts file under src/review/");
  for (const name of files) {
    const text = readFileSync(join(dir, name), "utf8");
    assert.ok(!text.includes(needle), `${name} contains ${needle}`);
  }
});
