import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { safeSlug, ventureDir, requireVentureDir, VENTURE_ROOT } from "./paths.js";

describe("safeSlug", () => {
  test("accepts a bare slug", () => {
    assert.equal(safeSlug("voter-choice"), "voter-choice");
  });

  test("rejects a slug containing a path separator", () => {
    assert.throws(() => safeSlug("../../etc/passwd"), /bad venture slug/);
    assert.throws(() => safeSlug("foo/bar"), /bad venture slug/);
    assert.throws(() => safeSlug("foo\\bar"), /bad venture slug/);
  });

  test("rejects a slug containing ..", () => {
    assert.throws(() => safeSlug("..hidden"), /bad venture slug/);
  });

  test("rejects an empty slug", () => {
    assert.throws(() => safeSlug(""), /bad venture slug/);
  });
});

describe("ventureDir", () => {
  test("joins under VENTURE_ROOT", () => {
    assert.equal(ventureDir("voter-choice"), `${VENTURE_ROOT}/voter-choice`);
  });

  test("a traversal slug never escapes VENTURE_ROOT even indirectly", () => {
    assert.throws(() => ventureDir("../../../tmp/evil"), /bad venture slug/);
  });
});

describe("requireVentureDir", () => {
  test("throws for a venture that doesn't exist on disk", () => {
    assert.throws(() => requireVentureDir("zz-definitely-does-not-exist"), /no such venture/);
  });
});
