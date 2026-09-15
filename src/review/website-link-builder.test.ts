import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWebsiteLink,
  WEBSITE_LINK_MAX_TAG_LENGTH,
  WEBSITE_LINK_SAFE_TAG_PATTERN,
} from "./website-link-builder.js";

const VALID_INPUT = {
  destination: "https://humaninference.ai/essays/magic-outcomes",
  platform: "LinkedIn",
  medium: "social",
  campaign: "magic-outcomes",
  variantId: "linkedin-v1",
  sourcePostId: "src-42",
};

test("a clean build produces the exact tagged link", () => {
  const result = buildWebsiteLink(VALID_INPUT);
  assert.equal(
    result.url,
    "https://humaninference.ai/essays/magic-outcomes?utm_source=linkedin&utm_medium=social&utm_campaign=magic-outcomes&utm_content=linkedin-v1&hi_source_post=src-42",
  );
});

test("accepts a bare site path and keeps other existing query params and drops a hash", () => {
  const result = buildWebsiteLink({
    ...VALID_INPUT,
    destination: "/essays/magic-outcomes?ref=newsletter#section-2",
  });
  assert.ok("url" in result && result.url, "expected a url result");
  const url = new URL((result as { url: string }).url);
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("ref"), "newsletter");
  assert.equal(url.searchParams.get("utm_source"), "linkedin");
});

test("replaces existing utm tags instead of duplicating them", () => {
  const result = buildWebsiteLink({
    ...VALID_INPUT,
    destination:
      "https://humaninference.ai/essays/magic-outcomes?utm_source=old&utm_content=stale&hi_source_post=stale-post",
  });
  assert.ok("url" in result && result.url, "expected a url result");
  const url = new URL((result as { url: string }).url);
  assert.deepEqual(url.searchParams.getAll("utm_source"), ["linkedin"]);
  assert.deepEqual(url.searchParams.getAll("utm_content"), ["linkedin-v1"]);
  assert.deepEqual(url.searchParams.getAll("hi_source_post"), ["src-42"]);
});

test("rejects a non-humaninference.ai host", () => {
  const result = buildWebsiteLink({ ...VALID_INPUT, destination: "https://example.com/essays/x" });
  assert.ok("errors" in result, "expected errors");
  assert.match(result.errors!.destination, /humaninference\.ai/);
});

test("rejects bad characters instead of cleaning them up", () => {
  const result = buildWebsiteLink({ ...VALID_INPUT, campaign: "magic outcomes & more" });
  assert.ok("errors" in result, "expected errors");
  assert.match(result.errors!.campaign, /letters, numbers/);
});

test("rejects a value over 120 characters and does not trim it", () => {
  const result = buildWebsiteLink({ ...VALID_INPUT, variantId: "v".repeat(121) });
  assert.ok("errors" in result, "expected errors");
  assert.match(result.errors!.variantId, /120 characters/);
});

test("normalizes platform, medium and campaign case but keeps IDs as-is", () => {
  const result = buildWebsiteLink({
    ...VALID_INPUT,
    platform: "LinkedIn",
    medium: "Social",
    campaign: "Magic-Outcomes",
    variantId: "LinkedIn-V1",
  });
  assert.ok("url" in result && result.url, "expected a url result");
  const url = new URL((result as { url: string }).url);
  assert.equal(url.searchParams.get("utm_source"), "linkedin");
  assert.equal(url.searchParams.get("utm_medium"), "social");
  assert.equal(url.searchParams.get("utm_campaign"), "magic-outcomes");
  assert.equal(url.searchParams.get("utm_content"), "LinkedIn-V1");
});

test("reports missing required fields", () => {
  const result = buildWebsiteLink({
    destination: "",
    platform: "",
    medium: "",
    campaign: "",
    variantId: "",
    sourcePostId: "",
  });
  assert.ok("errors" in result, "expected errors");
  for (const field of ["destination", "platform", "medium", "campaign", "variantId", "sourcePostId"]) {
    assert.match(result.errors![field], /required/);
  }
});

// Round-trip: every value this function accepts must survive the site's own rules
// (landing-page/site/src/scripts/analytics-context.js), copied here as a fixture.
const SITE_MAX_TAG_LENGTH = 120;
const SITE_SAFE_TAG_PATTERN = /^[A-Za-z0-9._~:/-]+$/;

test("generated tag values survive the site's own SAFE_TAG_PATTERN and length limit", () => {
  assert.equal(WEBSITE_LINK_MAX_TAG_LENGTH, SITE_MAX_TAG_LENGTH);
  assert.equal(WEBSITE_LINK_SAFE_TAG_PATTERN.source, SITE_SAFE_TAG_PATTERN.source);

  const result = buildWebsiteLink(VALID_INPUT);
  assert.ok("url" in result && result.url, "expected a url result");
  const url = new URL((result as { url: string }).url);
  for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "hi_source_post"]) {
    const value = url.searchParams.get(param)!;
    assert.ok(value.length <= SITE_MAX_TAG_LENGTH, `${param} exceeds site length limit`);
    assert.match(value, SITE_SAFE_TAG_PATTERN, `${param} value "${value}" fails the site's safe-tag pattern`);
  }
});
