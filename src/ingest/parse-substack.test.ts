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

// Real payload confirmed 2026-07-04 against Muxin's live account (subs 4->38, views 89->504):
//   { totalSubscribersEnd, totalSubscribersStart, paidSubscribersEnd, paidSubscribersStart,
//     arrEnd, arrStart, totalViewsEnd, totalViewsStart, pledgedArrEnd, pledgedArrStart }
const REAL_PAYLOAD = {
  totalSubscribersEnd: 38,
  totalSubscribersStart: 4,
  paidSubscribersEnd: 0,
  paidSubscribersStart: 0,
  arrEnd: 0,
  arrStart: 0,
  totalViewsEnd: 504,
  totalViewsStart: 89,
  pledgedArrEnd: 0,
  pledgedArrStart: 0,
};

describe("parseSubstackSummary", () => {
  test("extracts the subscriber total into a follower_total row, and growth into follower_delta", () => {
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify(REAL_PAYLOAD));
    assert.equal(rows.length, 2);
    const total = rows.find((r) => r.metricType === "follower_total")!;
    assert.equal(total.platform, "substack");
    assert.equal(total.valueCount, 38);
    assert.equal(total.dimension, null);
    const delta = rows.find((r) => r.metricType === "follower_delta")!;
    assert.equal(delta.valueCount, 34); // 38 - 4
  });

  test("preserves the entire raw payload on the follower_total row (paid/ARR/views, for provenance)", () => {
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify(REAL_PAYLOAD));
    const total = rows.find((r) => r.metricType === "follower_total")!;
    assert.deepEqual(total.raw, REAL_PAYLOAD);
  });

  test("no totalSubscribersStart -> only the follower_total row (growth accrues via snapshots instead)", () => {
    const rows = parseSubstackSummary("substack-summary.json", JSON.stringify({ totalSubscribersEnd: 38 }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].metricType, "follower_total");
  });

  test("throws a clear ParseError when totalSubscribersEnd is missing", () => {
    assert.throws(
      () => parseSubstackSummary("substack-summary.json", JSON.stringify({ totalViewsEnd: 504 })),
      /no "totalSubscribersEnd" number found/
    );
  });

  test("throws on invalid JSON", () => {
    assert.throws(() => parseSubstackSummary("substack-summary.json", "{not json"), /not valid JSON/);
  });
});
