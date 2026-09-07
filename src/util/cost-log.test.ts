import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { dataRoot } from "../runtime/data-root.js";
import { costLogPath, logCost } from "./cost-log.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REAL_LEDGER = join(repoRoot, "data", "cost-log.csv");

function digest(file: string): string | null {
  return existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null;
}

// Muxin's real spend ledger. Nothing in this file may write it; the guard below proves it rather
// than trusting the code under test.
const REAL_LEDGER_BEFORE = digest(REAL_LEDGER);

after(() => {
  assert.equal(digest(REAL_LEDGER), REAL_LEDGER_BEFORE, "data/cost-log.csv is byte-identical across this suite");
});

function withOverride<T>(path: string | undefined, run: () => T): T {
  const saved = process.env.CONTENT_AGENTS_TEST_COST_LOG;
  if (path === undefined) delete process.env.CONTENT_AGENTS_TEST_COST_LOG;
  else process.env.CONTENT_AGENTS_TEST_COST_LOG = path;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.CONTENT_AGENTS_TEST_COST_LOG;
    else process.env.CONTENT_AGENTS_TEST_COST_LOG = saved;
  }
}

// B2. The production destination must not move: the root CLAUDE.md names data/cost-log.csv by
// path. This process is a test context, so the only honest way to observe the production branch is
// a child process that is not one. It resolves the path and prints it; it never calls logCost, and
// the real ledger's digest is checked across the spawn.
test("outside a test context with no override, the cost log resolves to data/cost-log.csv", () => {
  const probeDir = mkdtempSync(join(tmpdir(), "cost-log-probe-"));
  const probe = join(probeDir, "probe.ts");
  writeFileSync(
    probe,
    `import { costLogPath } from ${JSON.stringify(join(HERE, "cost-log.ts"))};\n` +
      `process.stdout.write(costLogPath());\n`,
  );
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.CONTENT_AGENTS_TEST_COST_LOG;
  delete env.CONTENT_AGENTS_DATA_ROOT;
  try {
    const resolved = execFileSync(process.execPath, ["--import", "tsx", probe], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    assert.equal(resolved, REAL_LEDGER, "production still writes the exact path it wrote before this slice");
    assert.equal(digest(REAL_LEDGER), REAL_LEDGER_BEFORE, "resolving the path wrote nothing");
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
});

// B3. Observability: a test can point the log somewhere it can read, and assert the row landed.
// The assertion is on the row read back off disk, not on a spy or a path string.
test("an overridden cost log receives the row a logCost call writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cost-log-override-"));
  const file = join(dir, "nested", "cost-log.csv");
  try {
    withOverride(file, () => {
      assert.equal(costLogPath(), file);
      assert.equal(existsSync(file), false, "nothing exists before the call");
      logCost({ step: "agent:claude", detail: 'a "quoted" label', costUsd: 0.25, engine: "claude" });
      logCost({ step: "outreach:draft", detail: "Acme Co", costUsd: 0, engine: "claude" });
    });

    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    assert.equal(lines.length, 3, "a header plus exactly the two rows written");
    assert.equal(lines[0], "timestamp,step,detail,cost_usd,engine");
    // Fields after the timestamp, which is the only part a caller does not choose.
    assert.equal(lines[1]!.slice(lines[1]!.indexOf(",") + 1), 'agent:claude,"a ""quoted"" label",0.2500,claude');
    assert.equal(lines[2]!.slice(lines[2]!.indexOf(",") + 1), 'outreach:draft,"Acme Co",0.0000,claude');
    assert.match(lines[1]!.split(",")[0]!, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The default a test process gets with no override: the throwaway per-process data root, never the
// checked-in ledger. This is what stops the gate mixing fixture rows into a real financial record.
test("inside a test context with no override, rows land in the throwaway data root", () => {
  withOverride(undefined, () => {
    const path = costLogPath();
    assert.equal(path, join(dataRoot(), "cost-log.csv"));
    assert.notEqual(path, REAL_LEDGER);
    const before = existsSync(path) ? readFileSync(path, "utf8") : "";
    logCost({ step: "outreach:draft", detail: "Acme Co", costUsd: 0, engine: "claude" });
    const after = readFileSync(path, "utf8");
    assert.ok(after.startsWith(before), "logCost only ever appends");
    assert.match(after.trimEnd().split("\n").at(-1)!, /,outreach:draft,"Acme Co",0\.0000,claude$/);
    assert.equal(digest(REAL_LEDGER), REAL_LEDGER_BEFORE, "the real ledger gained nothing");
  });
});

// The header migration for pre-`engine` ledgers still works, and still does not truncate: it is the
// one place logCost rewrites rather than appends, so an isolated log is the place to prove it.
test("a legacy header without an engine column is migrated in place, keeping every existing row", () => {
  const dir = mkdtempSync(join(tmpdir(), "cost-log-legacy-"));
  const file = join(dir, "cost-log.csv");
  writeFileSync(file, "timestamp,step,detail,cost_usd\n2026-01-01T00:00:00.000Z,image:x,\"old row\",1.0000\n");
  try {
    withOverride(file, () => logCost({ step: "tts:y", detail: "new row", costUsd: 0 }));
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    assert.equal(lines[0], "timestamp,step,detail,cost_usd,engine");
    assert.equal(lines[1], '2026-01-01T00:00:00.000Z,image:x,"old row",1.0000,', "the pre-existing row survives");
    assert.match(lines[2]!, /,tts:y,"new row",0\.0000,$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
