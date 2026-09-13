import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import type { QueueRow } from "../publish/queue.js";
import { renderPage } from "./page.js";
import { enrich } from "./rows.js";

type StudioRow = ReturnType<typeof enrich>;
type StudioPiece = { requestId: string; rows: StudioRow[] };

function queueRow(id: string, format: string, asset: string): QueueRow {
  return {
    id,
    platform: "bluesky",
    format,
    asset,
    status: "pending",
    notes: "",
    lineIndex: 1,
  };
}

function contentRequestPiecesFromPage(): (pieces: StudioPiece[]) => StudioPiece[] {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
  const start = script.indexOf("function contentRequestPieces(");
  const end = script.indexOf("\nfunction reviewVisiblePieces(", start);
  assert.ok(start >= 0 && end > start, "the shared Content and Publishing row shaper is present");
  return new Function(`${script.slice(start, end)}; return contentRequestPieces;`)() as (pieces: StudioPiece[]) => StudioPiece[];
}

test("Content and Publishing omit a quote-card row until its referenced image exists", () => {
  const folder = mkdtempSync(join(tmpdir(), "content-agents-missing-image-"));
  try {
    mkdirSync(join(folder, "images"));
    mkdirSync(join(folder, "derivatives"));
    mkdirSync(join(folder, "media-stages"));
    writeFileSync(join(folder, "images", "rendered.png"), "rendered");
    writeFileSync(join(folder, "derivatives", "text-1.md"), "A text post.\n");
    writeFileSync(join(folder, "media-stages", "staged.json"), '{"media":"image"}\n');

    const missing = queueRow("quote-card-missing", "image", "images/missing.png");
    const rendered = queueRow("quote-card-rendered", "image", "images/rendered.png");
    const staged = queueRow("quote-card-staged", "image", "media-stages/staged.json");
    const text = queueRow("text-1", "text", "derivatives/text-1.md");
    const live = { typefullyDrafts: [], postpeerPosts: [] };
    const visiblePieces = contentRequestPiecesFromPage();
    const stagedRow = enrich(folder, "example", staged, { text: "" }, live);
    assert.equal(stagedRow.kind, "image");
    assert.equal(stagedRow.hasAsset, false);
    assert.equal(stagedRow.assetUrl, undefined);
    assert.deepEqual(stagedRow.mediaStage, { media: "image" });

    const before = visiblePieces([{
      requestId: "request-1",
      rows: [
        enrich(folder, "example", missing, { text: "" }, live),
        enrich(folder, "example", rendered, { text: "" }, live),
        stagedRow,
        enrich(folder, "example", text, { text: "" }, live),
      ],
    }]);
    assert.deepEqual(
      before[0].rows.map((row) => row.id),
      ["quote-card-rendered", "quote-card-staged", "text-1"],
      "a missing image row is absent while rendered image, inspectable stage, and text rows remain",
    );

    writeFileSync(join(folder, "images", "missing.png"), "now rendered");
    const after = visiblePieces([{
      requestId: "request-1",
      rows: [
        enrich(folder, "example", missing, { text: "" }, live),
        enrich(folder, "example", rendered, { text: "" }, live),
        stagedRow,
        enrich(folder, "example", text, { text: "" }, live),
      ],
    }]);
    assert.deepEqual(
      after[0].rows.map((row) => row.id),
      ["quote-card-missing", "quote-card-rendered", "quote-card-staged", "text-1"],
      "the same quote-card row appears after its image reaches disk",
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
