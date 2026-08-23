import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { intakePath } from "./paths.js";
import { INTAKE_QUESTIONS } from "./intake.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

const SCRIPT = join(repoRoot, "src", "venture", "new-venture.ts");
const SLUG = "zz-test-new-venture";

beforeEach(useTempVentureRoot);

afterEach(clearTempVentureRoot);

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

  test("refuses with an incomplete scorecard", () => {
    const answers: Record<string, string> = {};
    for (const q of INTAKE_QUESTIONS) answers[q.id] = `a-${q.id}`;
    const voice = { writing_samples: [], worldview_statement: "w", natural_phrases: [], refused_phrases_tones: [] };
    const r = run(JSON.stringify({ answers, voice, scorecard: { required_live_posts: 3 } }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Day 14 scorecard/);
    assert.equal(existsSync(intakePath(SLUG)), false);
  });

  test("kicks off with all 25 answers + a complete scorecard, and prints the next step", () => {
    const answers: Record<string, string> = {};
    for (const q of INTAKE_QUESTIONS) answers[q.id] = `a-${q.id}`;
    const voice = { writing_samples: [], worldview_statement: "w", natural_phrases: [], refused_phrases_tones: [] };
    const scorecard = {
      required_live_posts: 3,
      ongoing_pace: "5 posts/week",
      views_or_clicks_target: "learning_only",
      opt_in_target: "learning_only",
      response_quality_test: "at least one specific reply per post",
      sustainability_test: "fits the declared time budget",
    };
    const r = run(JSON.stringify({ answers, voice, scorecard }));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /kicked off/);
    assert.match(r.stdout, /plan-init/);
    assert.equal(existsSync(intakePath(SLUG)), true);
  });
});
