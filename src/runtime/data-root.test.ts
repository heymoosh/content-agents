import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { configuredDataPathOrLegacy, dataRoot, migrateLegacyDataDirectory } from "./data-root.js";

test("dataRoot: under the test runner an unconfigured root is a throwaway directory, never the real one", () => {
  const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
  delete process.env.CONTENT_AGENTS_DATA_ROOT;
  try {
    assert.ok(process.env.NODE_TEST_CONTEXT, "node:test marks its processes");
    const root = dataRoot();
    assert.ok(!root.includes(join(homedir(), ".content-agents")), `real store must not be touched: ${root}`);
    assert.equal(dataRoot(), root, "stable within the process");
    assert.ok(!configuredDataPathOrLegacy("jobs", "x.json").includes(join(homedir(), ".content-agents")));
  } finally {
    if (saved !== undefined) process.env.CONTENT_AGENTS_DATA_ROOT = saved;
  }
});

function directoryFixture(): { caseDir: string; dataRootDir: string; legacyRoot: string; parts: string[]; canonical: string; legacy: string } {
  const caseDir = mkdtempSync(join(tmpdir(), "content-agents-directory-migration-"));
  const dataRootDir = join(caseDir, "canonical-root");
  const legacyRoot = join(caseDir, "legacy-root");
  const parts = ["logs", "gui-jobs"];
  const legacy = join(legacyRoot, ...parts);
  mkdirSync(join(legacy, "nested", "deeper"), { recursive: true });
  writeFileSync(join(legacy, "first.log"), Buffer.from([0, 1, 2, 255]));
  writeFileSync(join(legacy, "nested", "deeper", "second.log"), "complete nested log\n");
  return { caseDir, dataRootDir, legacyRoot, parts, canonical: join(dataRootDir, ...parts), legacy };
}

function assertCompleteTree(canonical: string, legacy: string): void {
  assert.deepEqual(readFileSync(join(canonical, "first.log")), readFileSync(join(legacy, "first.log")));
  assert.deepEqual(
    readFileSync(join(canonical, "nested", "deeper", "second.log")),
    readFileSync(join(legacy, "nested", "deeper", "second.log"))
  );
}

function stagingDirectories(canonical: string): string[] {
  return readdirSync(join(canonical, ".."), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${basename(canonical)}.migrating-`))
    .map((entry) => join(canonical, "..", entry.name));
}

test("migrateLegacyDataDirectory: canonical tree appears only after a complete staged copy", () => {
  const fixture = directoryFixture();
  const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
  process.env.CONTENT_AGENTS_DATA_ROOT = fixture.dataRootDir;
  try {
    const legacyFirst = readFileSync(join(fixture.legacy, "first.log"));
    const legacySecond = readFileSync(join(fixture.legacy, "nested", "deeper", "second.log"));
    let copied = false;
    assert.equal(
      migrateLegacyDataDirectory(fixture.parts, fixture.legacyRoot, {
        cpSync: (from, staging, options) => {
          copied = true;
          cpSync(from, staging, options);
          if (typeof staging !== "string") throw new Error("directory staging path must be a string");
          assert.equal(existsSync(fixture.canonical), false, "readers must not see a directory while its copy is in progress");
          assertCompleteTree(staging, fixture.legacy);
        },
        renameSync: (from, to) => {
          assert.equal(existsSync(fixture.canonical), false, "the canonical path stays absent until the atomic install");
          return renameSync(from, to);
        },
      }),
      fixture.canonical
    );
    assert.equal(copied, true, "the staged copy seam must run");
    assertCompleteTree(fixture.canonical, fixture.legacy);
    assert.deepEqual(readFileSync(join(fixture.legacy, "first.log")), legacyFirst, "migration preserves legacy bytes");
    assert.deepEqual(readFileSync(join(fixture.legacy, "nested", "deeper", "second.log")), legacySecond, "migration preserves nested legacy bytes");
    assert.deepEqual(stagingDirectories(fixture.canonical), [], "successful staging is renamed away");
  } finally {
    if (saved === undefined) delete process.env.CONTENT_AGENTS_DATA_ROOT;
    else process.env.CONTENT_AGENTS_DATA_ROOT = saved;
    rmSync(fixture.caseDir, { recursive: true, force: true });
  }
});

test("migrateLegacyDataDirectory: existing canonical, missing legacy, and same-path inputs retain their precedence", () => {
  const fixture = directoryFixture();
  const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
  process.env.CONTENT_AGENTS_DATA_ROOT = fixture.dataRootDir;
  try {
    mkdirSync(fixture.canonical, { recursive: true });
    writeFileSync(join(fixture.canonical, "first.log"), "pre-existing canonical bytes");
    assert.equal(migrateLegacyDataDirectory(fixture.parts, fixture.legacyRoot), fixture.canonical);
    assert.equal(readFileSync(join(fixture.canonical, "first.log"), "utf8"), "pre-existing canonical bytes");
    assert.equal(existsSync(join(fixture.canonical, "nested", "deeper", "second.log")), false, "a pre-existing partial canonical tree is not guessed or repaired");
    assert.equal(readFileSync(join(fixture.legacy, "first.log"), "utf8"), Buffer.from([0, 1, 2, 255]).toString());

    const missingParts = ["logs", "missing"];
    const missingCanonical = join(fixture.dataRootDir, ...missingParts);
    assert.equal(migrateLegacyDataDirectory(missingParts, fixture.legacyRoot), missingCanonical);
    assert.equal(existsSync(missingCanonical), false, "a missing legacy directory stays absent");

    const sameParts = ["logs", "same-path"];
    const samePath = join(fixture.dataRootDir, ...sameParts);
    assert.equal(migrateLegacyDataDirectory(sameParts, fixture.dataRootDir), samePath);
    assert.equal(existsSync(samePath), false, "identical source and destination are left alone");
  } finally {
    if (saved === undefined) delete process.env.CONTENT_AGENTS_DATA_ROOT;
    else process.env.CONTENT_AGENTS_DATA_ROOT = saved;
    rmSync(fixture.caseDir, { recursive: true, force: true });
  }
});

test("migrateLegacyDataDirectory: failed copies and renames clean their own staging directories and retry", () => {
  for (const failure of ["copy", "rename"] as const) {
    const fixture = directoryFixture();
    const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
    process.env.CONTENT_AGENTS_DATA_ROOT = fixture.dataRootDir;
    try {
      assert.throws(
        () =>
          migrateLegacyDataDirectory(fixture.parts, fixture.legacyRoot, {
            cpSync: (from, staging, options) => {
              cpSync(from, staging, options);
              if (failure === "copy") throw new Error("simulated copy failure");
            },
            renameSync: (from, to) => {
              if (failure === "rename") throw new Error("simulated rename failure");
              return renameSync(from, to);
            },
          }),
        new RegExp(`simulated ${failure} failure`)
      );
      assert.equal(existsSync(fixture.canonical), false, `${failure} failure must not publish a partial tree`);
      assert.deepEqual(stagingDirectories(fixture.canonical), [], `${failure} failure must clean this invocation's staging directory`);

      assert.equal(migrateLegacyDataDirectory(fixture.parts, fixture.legacyRoot), fixture.canonical);
      assertCompleteTree(fixture.canonical, fixture.legacy);
    } finally {
      if (saved === undefined) delete process.env.CONTENT_AGENTS_DATA_ROOT;
      else process.env.CONTENT_AGENTS_DATA_ROOT = saved;
      rmSync(fixture.caseDir, { recursive: true, force: true });
    }
  }
});

test("migrateLegacyDataDirectory: a killed staged copy leaves canonical absent and retries after the normal stale-lock expiry", async () => {
  const fixture = directoryFixture();
  const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
  process.env.CONTENT_AGENTS_DATA_ROOT = fixture.dataRootDir;
  const paused = join(fixture.caseDir, "copy-paused");
  const stagingPath = join(fixture.caseDir, "staging-path");
  const lockPath = `${fixture.canonical}.migration.lock`;
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      [
        'import { cpSync, existsSync, writeFileSync } from "node:fs";',
        'import { pathToFileURL } from "node:url";',
        'const { migrateLegacyDataDirectory } = await import(pathToFileURL(process.env.DATA_ROOT_MODULE).href);',
        'const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
        'migrateLegacyDataDirectory(["logs", "gui-jobs"], process.env.LEGACY_ROOT, {',
        '  cpSync: (from, staging, options) => {',
        '    cpSync(from, staging, options);',
        '    writeFileSync(process.env.STAGING_PATH, staging);',
        '    writeFileSync(process.env.PAUSED, "");',
        '    while (!existsSync(process.env.GO)) nap(10);',
        '  },',
        '  renameSync: () => { throw new Error("killed copy should never rename"); },',
        '});',
      ].join("\n"),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTENT_AGENTS_DATA_ROOT: fixture.dataRootDir,
        DATA_ROOT_MODULE: join(process.cwd(), "src", "runtime", "data-root.ts"),
        LEGACY_ROOT: fixture.legacyRoot,
        PAUSED: paused,
        STAGING_PATH: stagingPath,
        GO: join(fixture.caseDir, "go"),
      },
    }
  );
  const settled = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("error", () => resolve({ code: null, signal: null }));
    child.on("close", (code, signal) => resolve({ code, signal }));
  });
  try {
    for (let attempt = 0; attempt < 300 && !existsSync(paused); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(existsSync(paused), true, "child must reach the middle of its staged copy");
    assert.equal(existsSync(fixture.canonical), false, "a killed copy has not published the canonical path");

    child.kill("SIGKILL");
    const childResult = await settled;
    assert.equal(childResult.signal, "SIGKILL", "the copy process must be reaped before simulating stale-lock recovery");

    const orphan = readFileSync(stagingPath, "utf8");
    assert.equal(existsSync(orphan), true, "abrupt death leaves only a private staging orphan");
    writeFileSync(lockPath, JSON.stringify({ pid: child.pid, createdAt: Date.now() - 5 * 60_000 - 1 }));

    assert.equal(migrateLegacyDataDirectory(fixture.parts, fixture.legacyRoot), fixture.canonical);
    assertCompleteTree(fixture.canonical, fixture.legacy);
    assert.equal(existsSync(orphan), true, "retry must not sweep an unknown private orphan");
    assert.equal(existsSync(fixture.canonical), true);
  } finally {
    child.kill("SIGKILL");
    await settled;
    if (saved === undefined) delete process.env.CONTENT_AGENTS_DATA_ROOT;
    else process.env.CONTENT_AGENTS_DATA_ROOT = saved;
    rmSync(fixture.caseDir, { recursive: true, force: true });
  }
});
