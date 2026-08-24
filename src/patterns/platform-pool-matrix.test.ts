import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlatformPoolMatrix,
  renderPlatformPoolMatrixJson,
  renderPlatformPoolMatrixMarkdown,
} from "./platform-pool-matrix.js";
import type { PlatformPoolMatrixTarget } from "./platform-pool-matrix.js";

function target(overrides: Partial<PlatformPoolMatrixTarget> = {}): PlatformPoolMatrixTarget {
  return {
    id: "x-niche-text-short-a",
    platform: "x",
    researchPool: "niche",
    medium: "text",
    format: "short post",
    configured: true,
    collected: true,
    reviewStatus: "reviewed",
    baselineReady: true,
    blockers: [],
    ...overrides,
  };
}

describe("buildPlatformPoolMatrix", () => {
  test("groups explicit dimensions and preserves every coverage state", () => {
    const matrix = buildPlatformPoolMatrix([
      target({ id: "x-niche-text-short-b", configured: false, collected: false, reviewStatus: "unreviewed", baselineReady: false, blockers: ["target not configured"] }),
      target({ id: "x-niche-text-short-a" }),
      target({ id: "linkedin-broad-video-null", platform: "linkedin", researchPool: "broad", medium: "video", format: null, collected: false, reviewStatus: "blocked", baselineReady: false, blockers: ["duplicate review metadata"] }),
    ]);

    assert.deepEqual(matrix.cells.map((cell) => [cell.platform, cell.researchPool, cell.medium, cell.format, cell.total, cell.configured, cell.collected, cell.reviewed, cell.baselineReady, cell.blocked, cell.unreviewed, cell.gaps]), [
      ["linkedin", "broad", "video", null, 1, 1, 0, 0, 0, 1, 0, { notConfigured: 0, notCollected: 1, notReviewed: 1, baselineNotReady: 1 }],
      ["x", "niche", "text", "short post", 2, 1, 1, 1, 1, 0, 1, { notConfigured: 1, notCollected: 1, notReviewed: 1, baselineNotReady: 1 }],
    ]);
    assert.deepEqual(matrix.summary, {
      total: 3, configured: 2, collected: 1, reviewed: 1, baselineReady: 1, blocked: 1, unreviewed: 1,
      gaps: { notConfigured: 1, notCollected: 2, notReviewed: 2, baselineNotReady: 2 },
    });
    assert.equal(matrix.bodyIncluded, false);
    assert.equal(matrix.sideEffects, "none");
  });

  test("does not infer labels or creator rankings", () => {
    const matrix = buildPlatformPoolMatrix([target({ id: "z", medium: null, format: null, blockers: ["labels absent"] })]);
    assert.equal(matrix.cells[0]?.medium, null);
    assert.equal(matrix.cells[0]?.format, null);
    assert.deepEqual(matrix.targets[0], target({ id: "z", medium: null, format: null, blockers: ["labels absent"] }));
    assert.equal(JSON.stringify(matrix).includes("creator"), false);
  });
});

test("JSON and Markdown renderers are deterministic and body-free", () => {
  const matrix = buildPlatformPoolMatrix([target()]);
  assert.equal(renderPlatformPoolMatrixJson(matrix), renderPlatformPoolMatrixJson(matrix));
  const markdown = renderPlatformPoolMatrixMarkdown(matrix);
  assert.match(markdown, /Platform × research-pool coverage matrix/);
  assert.match(markdown, /baseline-ready/);
  assert.match(markdown, /Missing labels are not inferred/);
  assert.match(markdown, /does not identify best creators/);
});
