import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseSubstackSummary, isSubstackSummaryFile } from "./parse-substack.js";

describe("isSubstackSummaryFile", () => {
  test("matches the puller's summary filename", () => {
    assert.equal(isSubstackSummaryFile("substack-summary-2026-07-04.json"), true);
    assert.equal(isSubstackSummaryFile("substack-summary.json"), true);
  });
  test("does not match the per-post stats CSV or the export folder", () => {
    assert.equal(isSubstackSummaryFile("substack-stats-2026-07-04.csv"), false);
    assert.equal(isSubstackSummaryFile("email_list.csv"), false);
    assert.equal(isSubstackSummaryFile("posts.csv"), false);
  });
});

describe("parseSubstackSummary", () => {
  test("extracts the subscriber total into a follower_total audience row", () => {
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify({ subscriberCount: 38 }));
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.platform, "substack");
    assert.equal(r.metricType, "follower_total");
    assert.equal(r.valueCount, 38);
    assert.equal(r.dimension, null);
  });

  test("finds the subscriber count even when nested, and preserves views + raw payload", () => {
    const payload = { stats: { totalViews: 504, subscribers: 38 }, meta: { range: 365 } };
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify(payload));
    const total = rows.find((r) => r.metricType === "follower_total")!;
    assert.equal(total.valueCount, 38);
    assert.equal(total.raw._totalViews, 504);
    // Entire payload is preserved for provenance / future fields.
    assert.deepEqual((total.raw as any).meta, { range: 365 });
  });

  test("emits a follower_delta row when the payload exposes growth directly", () => {
    const rows = parseSubstackSummary(
      "substack-summary.json",
      JSON.stringify({ subscriberCount: 38, subscriberGrowth: 34 })
    );
    const delta = rows.find((r) => r.metricType === "follower_delta");
    assert.ok(delta, "expected a follower_delta row");
    assert.equal(delta!.valueCount, 34);
  });

  test("no growth key -> only the follower_total row (growth accrues via snapshots instead)", () => {
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify({ subscriberCount: 38 }));
    assert.equal(rows.filter((r) => r.metricType === "follower_delta").length, 0);
  });

  test("throws a clear ParseError when no subscriber-like key is present", () => {
    assert.throws(
      () => parseSubstackSummary("substack-summary.json", JSON.stringify({ nothing: 1 })),
      /no subscriber total found/
    );
  });

  test("throws on invalid JSON", () => {
    assert.throws(() => parseSubstackSummary("substack-summary.json", "{not json"), /not valid JSON/);
  });
});
