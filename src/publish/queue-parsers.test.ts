import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// review-queue.md's 10-column table used to be decoded by hard-coded cells[N] offsets in three
// independent places (src/publish/queue.ts, src/review/serve.ts, src/video/render.ts). Now only
// queue.ts parses it; serve.ts and render.ts route through queue.ts's exports instead of
// reimplementing their own cells[N] indexing. This guards against a fourth parser creeping back in.

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..", "..");

test("serve.ts no longer indexes review-queue.md cells by hand", () => {
  const src = readFileSync(join(repoRoot, "src", "review", "serve.ts"), "utf8");
  assert.equal(/cells\[/.test(src), false);
});

test("render.ts no longer indexes review-queue.md cells by hand", () => {
  const src = readFileSync(join(repoRoot, "src", "video", "render.ts"), "utf8");
  assert.equal(/cells\[/.test(src), false);
});
