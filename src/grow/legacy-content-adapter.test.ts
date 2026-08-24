import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptLegacyContentFolder,
  buildLegacyGrowPlan,
  type LegacyContentAdapterResult,
} from "./legacy-content-adapter.js";

function withTempFolder(run: (folder: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "content-agents-legacy-grow-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeQueue(folder: string, rows: readonly string[]): void {
  writeFileSync(join(folder, "review-queue.md"), [
    "# Review queue",
    "",
    "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n"));
}

function assertBodyFree(value: unknown): void {
  const forbidden = /^(body|bodytext|postbody|sourcebody|content|copy|generatedcopy|transcript|exactopener)$/i;
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (entry === null || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      assert.equal(forbidden.test(key), false, `body-like key leaked: ${key}`);
      visit(child);
    }
  };
  visit(value);
}

test("adapts source, extract/non-extract cuts, queue rows, and publish evidence into stable Grow refs", () => {
  withTempFolder((folder) => {
    mkdirSync(join(folder, "cuts", "short"), { recursive: true });
    writeFileSync(join(folder, "source.md"), "---\ntitle: A thought\n---\n\nMuxin's original thought\n");
    writeFileSync(join(folder, "cuts", "short", "cut.md"), "---\nlens: short\n---\n\nMuxin's short cut\n");
    writeQueue(folder, [
      "| extract-1 | youtube | text | derivatives/extract-1.md | — | — | — | pending | needs review | from /cycle |",
      "| short/short-1 | tiktok | short | derivatives/short-short-1.md | — | — | — | approved | ready | from GUI queue |",
    ]);
    writeFileSync(join(folder, "publish-log.md"), [
      "# Publish log",
      "",
      "- 2026-08-24T12:00:00.000Z — short/short-1 → provider draft 123",
      "",
    ].join("\n"));

    const result = adaptLegacyContentFolder(folder);
    assert.equal(result.slug, folder.split("/").at(-1));
    assert.equal(result.sourceRef.id, `source:${result.slug}`);
    assert.deepEqual(result.cuts.map((cut) => cut.lens), ["extract", "short"]);
    assert.deepEqual(result.cuts[0].variants.map((variant) => variant.rowId), ["extract-1"]);
    assert.deepEqual(result.cuts[1].variants.map((variant) => variant.rowId), ["short/short-1"]);
    assert.equal(result.cuts[1].variants[0].status, "published");
    assert.deepEqual(result.publishLog.publishedVariantIds, ["short/short-1"]);
    assert.equal(result.cuts[1].cutRef.id, `cut:${result.slug}:short`);
    assert.equal(result.cuts[1].variantRefs[0].id, `variant:${result.slug}:short/short-1`);
    assert.equal(result.bodyIncluded, false);
    assert.equal(result.sideEffects, "none");
    assertBodyFree(result);
  });
});

test("keeps legacy missing lineage and missing files blocked instead of inferring Grow readiness", () => {
  withTempFolder((folder) => {
    writeQueue(folder, [
      "| legacy-1 | linkedin | text | derivatives/legacy-1.md | — | — | — | published | old row |",
      "| legacy-2 | reddit | text | derivatives/legacy-2.md | — | — | — | discard | old row | from /cycle |",
    ]);

    const result: LegacyContentAdapterResult = adaptLegacyContentFolder(folder);
    const extract = result.cuts.find((cut) => cut.lens === "extract");
    assert.ok(extract);
    assert.equal(extract.sourceStatus, "blocked");
    assert.equal(extract.cutStatus, "blocked");
    assert.deepEqual(extract.variants.map((variant) => variant.status), ["published", "discarded"]);
    assert.ok(extract.blockers.includes("source.md is missing"));
    assert.ok(extract.blockers.includes("cut artifact is missing"));
    assert.ok(extract.blockers.includes("Muxin cut decision is not persisted in the legacy folder"));

    const plan = buildLegacyGrowPlan(result, "extract");
    assert.equal(plan.winner, null);
    assert.equal(plan.generatesCopy, false);
    assert.equal(plan.sideEffects, "none");
    assert.equal(plan.readiness.status, "blocked");
    assert.ok(plan.readiness.blockers.includes("source record is not marked ready"));
    assert.ok(plan.readiness.blockers.includes("cut record is not marked ready"));
    assert.ok(plan.readiness.blockers.includes("Muxin cut decision is pending"));
    assertBodyFree(plan);
  });
});
