import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveFictionStudioSeriesDir } from "../review/fiction-jobs.js";

test("the Studio resolver accepts a canonical repository slug", () => {
  assert.match(resolveFictionStudioSeriesDir("the-least-of-us"), /\/stories\/the-least-of-us$/);
});

test("the Studio resolver rejects an absolute lookalike before its basename can enter a tool grant", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-series-escape-"));
  const crafted = join(root, "series) && touch escaped");
  try {
    mkdirSync(crafted);
    writeFileSync(join(crafted, "series.yaml"), "slug: crafted\n");
    assert.throws(() => resolveFictionStudioSeriesDir(crafted), /safe slug directly under stories/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
