import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { withCoordinatorFileLock } from "./lock.js";

test("serializes coordinator mutations across processes", () => {
  const fixture = mkdtempSync(join(tmpdir(), "studio-coord-lock-"));
  const lockPath = join(fixture, "mutation.lock");
  const markerPath = join(fixture, "second-writer-ran");
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/studio-coord/lock.ts")).href;
  const childScript = `
    import { writeFileSync } from "node:fs";
    import { withCoordinatorFileLock } from ${JSON.stringify(moduleUrl)};
    withCoordinatorFileLock(process.argv[1], () => writeFileSync(process.argv[2], "ran"));
  `;

  try {
    withCoordinatorFileLock(lockPath, () => {
      assert.throws(
        () => execFileSync(process.execPath, [
          "--import", "tsx",
          "--input-type=module",
          "--eval", childScript,
          lockPath,
          markerPath,
        ], { stdio: "pipe" }),
        /Command failed/,
      );
    });
    assert.equal(existsSync(markerPath), false);
    assert.doesNotThrow(() => withCoordinatorFileLock(lockPath, () => undefined));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
