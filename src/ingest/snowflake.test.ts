import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { xPostTimeIso, linkedinPostTimeIso } from "./snowflake.js";

describe("xPostTimeIso", () => {
  test("decodes a real X post id to the exact creation time (card 6f1a2e9c fixture)", () => {
    // From data/processed/7babd7b0-x-content-2026-07-05.csv -- export Date column read
    // "Sat, Jul 4, 2026" (no time-of-day); the id decodes to the real instant.
    assert.equal(xPostTimeIso("2073539791929376785"), "2026-07-04T22:49:45.559Z");
  });

  test("returns null for a non-numeric id (sha256 fallback used when no id column matched)", () => {
    assert.equal(xPostTimeIso("a1b2c3d4e5f6a7b8"), null);
  });

  test("returns null for empty/missing id", () => {
    assert.equal(xPostTimeIso(""), null);
    assert.equal(xPostTimeIso(null), null);
    assert.equal(xPostTimeIso(undefined), null);
  });

  test("returns null for an id that decodes to an implausibly far-future year", () => {
    assert.equal(xPostTimeIso("99999999999999999999999999999999999999"), null);
  });
});

describe("linkedinPostTimeIso", () => {
  test("decodes a real LinkedIn activity id to the exact creation time (card 6f1a2e9c fixture)", () => {
    // From data/processed/95b435e6-linkedin-analytics-2026-07-12.xlsx -- export Post Publish
    // Date column read "7/1/2026" (no time-of-day); the id decodes to the real instant.
    assert.equal(linkedinPostTimeIso("7478118288640630786"), "2026-07-01T16:12:16.731Z");
  });

  test("decodes further sampled ids matching their export Publish Date", () => {
    assert.equal(linkedinPostTimeIso("7477506759004221440")?.startsWith("2026-06-29"), true);
    assert.equal(linkedinPostTimeIso("7457513121021112320")?.startsWith("2026-05-05"), true);
    assert.equal(linkedinPostTimeIso("7425330657012224001")?.startsWith("2026-02-06"), true); // export: 2/5/2026 PT -> 2/6 UTC
  });

  test("returns null for a non-numeric id (sha256 fallback used when no numeric id in the URL)", () => {
    assert.equal(linkedinPostTimeIso("a1b2c3d4e5f6a7b8"), null);
  });

  test("returns null for empty/missing id", () => {
    assert.equal(linkedinPostTimeIso(""), null);
    assert.equal(linkedinPostTimeIso(null), null);
    assert.equal(linkedinPostTimeIso(undefined), null);
  });
});
