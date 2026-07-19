import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { countFutureSlotClaims, lastScoutRun } from "./studio.js";

test("countFutureSlotClaims counts only claims after now, skipping malformed lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-test-"));
  const p = join(dir, "ledger.jsonl");
  try {
    writeFileSync(p, [
      JSON.stringify({ platform: "x", time: "2026-07-20T17:00:00Z" }),
      JSON.stringify({ platform: "bluesky", time: "2026-07-01T17:00:00Z" }),
      "{not json",
      JSON.stringify({ platform: "linkedin", time: "2026-08-01T17:00:00Z" }),
    ].join("\n") + "\n");
    assert.equal(countFutureSlotClaims("2026-07-18T00:00:00Z", p), 2);
    assert.equal(countFutureSlotClaims("2026-07-18T00:00:00Z", join(dir, "missing.jsonl")), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lastScoutRun returns the newest timestamp in the run log", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-test-"));
  const p = join(dir, "run-log.jsonl");
  try {
    writeFileSync(p, [
      JSON.stringify({ timestamp: "2026-07-01T06:00:00Z" }),
      JSON.stringify({ timestamp: "2026-07-10T18:24:19Z" }),
    ].join("\n") + "\n");
    assert.equal(lastScoutRun(p), "2026-07-10T18:24:19Z");
    assert.equal(lastScoutRun(join(dir, "missing.jsonl")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
