import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildOpenerReport, renderOpenerReportJson, renderOpenerReportMarkdown } from "./opener-report.js";
import type { Opener } from "./types.js";

function opener(overrides: Partial<Opener> = {}): Opener {
  return {
    id: "opener-x-a-1",
    corpus_entry_id: "x-a-1",
    platform: "x",
    creator: "A",
    handle: "@a",
    url: "https://example.test/1",
    opener_text: "A source opener\nsecond line",
    onscreen_title: null,
    kind: "text",
    performance: { multiple: 2, metric: "views", note: "2.0x a measured baseline" },
    verbatim_ok: false,
    warnings: [],
    collected_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildOpenerReport", () => {
  test("projects source evidence and produces deterministic status counts and groups", () => {
    const report = buildOpenerReport([
      opener({ id: "opener-z-1", corpus_entry_id: "z-1", platform: "linkedin", creator: "Z", handle: "@z", warnings: [{ code: "missing-onscreen-title", note: "record it" }] }),
      opener({ id: "opener-x-2", corpus_entry_id: "x-2", warnings: [{ code: "short-body", note: "may be media" }] }),
      opener({ id: "opener-x-3", corpus_entry_id: "x-3", warnings: [{ code: "truncated-body", note: "body incomplete" }] }),
    ]);

    assert.deepEqual(report.summary.statusCounts, { blocked: 1, ready: 0, review: 2 });
    assert.deepEqual(report.groups.map((group) => [group.platform, group.rows.map((row) => row.id), group.statusCounts]), [
      ["linkedin", ["opener-z-1"], { blocked: 0, ready: 0, review: 1 }],
      ["x", ["opener-x-2", "opener-x-3"], { blocked: 1, ready: 0, review: 1 }],
    ]);
    assert.equal(report.rows[0].sourceEvidence.opener_text, "A source opener\nsecond line");
    assert.equal(report.sideEffects, "none");
  });

  test("does not infer winners or rank by performance", () => {
    const report = buildOpenerReport([opener({ id: "low", performance: { multiple: 1, metric: "views", note: "low" } }), opener({ id: "high", performance: { multiple: 99, metric: "views", note: "high" } })]);
    assert.deepEqual(report.rows.map((row) => row.id), ["high", "low"]);
    assert.match(report.policyNote, /mad-lib adaptation/);
    assert.match(report.policyNote, /winner inference are not authorized/);
  });
});

test("renderers are stable and clearly label source evidence", () => {
  const report = buildOpenerReport([opener()]);
  const json = renderOpenerReportJson(report);
  const markdown = renderOpenerReportMarkdown(report);
  assert.equal(json, renderOpenerReportJson(report));
  assert.match(markdown, /Source evidence \(verbatim\)/);
  assert.doesNotMatch(markdown, /Full post bodies/);
  assert.match(markdown, /mad-lib adaptation/);
  assert.doesNotMatch(json, /full post body/);
});
