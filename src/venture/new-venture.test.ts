import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { ventureDir, intakePath } from "./paths.js";
import { INTAKE_QUESTIONS } from "./intake.js";

const SCRIPT = join(repoRoot, "src", "venture", "new-venture.ts");
const SLUG = "zz-test-new-venture";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

function run(stdin: string) {
  const r = spawnSync("npx", ["tsx", SCRIPT, SLUG], { cwd: repoRoot, input: stdin, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("venture:new CLI", () => {
  test("refuses with missing answers", () => {
    const r = run(JSON.stringify({ answers: { q1: "only one" }, voice: {} }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /intake incomplete/);
    assert.equal(existsSync(intakePath(SLUG)), false);
  });

  test("kicks off with all 25 answers and prints the next step", () => {
    const answers: Record<string, string> = {};
    for (const q of INTAKE_QUESTIONS) answers[q.id] = `a-${q.id}`;
    const voice = { writing_samples: [], worldview_statement: "w", natural_phrases: [], refused_phrases_tones: [] };
    const r = run(JSON.stringify({ answers, voice }));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /kicked off/);
    assert.match(r.stdout, /plan-init/);
    assert.equal(existsSync(intakePath(SLUG)), true);
  });
});
