import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The structural version of the wall: a Muxin-only field (reviewed_by_muxin, confirmed_by_muxin,
// selected_by: "muxin") must be settable from exactly ONE place -- the explicit CLI command that
// represents Muxin's own action -- and nowhere else. This is a blunt source-grep, not a type-level
// guarantee, but it catches the easy mistake: a script that defaults a gate field to true, or
// that writes it in more than one code path.

const VENTURE_DIR = join(import.meta.dirname);

function sourceFiles(): string[] {
  return readdirSync(VENTURE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(VENTURE_DIR, f));
}

function countLiteralAssignments(text: string, pattern: RegExp): number {
  return [...text.matchAll(new RegExp(pattern, "g"))].length;
}

describe("self-stamp: Muxin-only fields are set from exactly one place", () => {
  const REVIEWED_TRUE = /reviewed_by_muxin:\s*true\b/;
  const CONFIRMED_TRUE = /confirmed_by_muxin:\s*true\b/;

  test("reviewed_by_muxin: true appears exactly once across all of src/venture/*.ts (cmdPlanReview only)", () => {
    let total = 0;
    const hits: string[] = [];
    for (const file of sourceFiles()) {
      const n = countLiteralAssignments(readFileSync(file, "utf8"), REVIEWED_TRUE);
      if (n > 0) hits.push(`${file.split("/").pop()} (${n})`);
      total += n;
    }
    assert.equal(total, 1, `expected exactly one legitimate setter (cmdPlanReview), found: ${hits.join(", ") || "none"}`);
    assert.ok(readFileSync(join(VENTURE_DIR, "phase1.ts"), "utf8").match(REVIEWED_TRUE), "the one setter must be in phase1.ts");
  });

  test("confirmed_by_muxin: true as a literal assignment never appears in source (only ever comes from Claude-supplied stdin JSON, never hardcoded)", () => {
    for (const file of sourceFiles()) {
      assert.equal(
        countLiteralAssignments(readFileSync(file, "utf8"), CONFIRMED_TRUE),
        0,
        `${file} hardcodes confirmed_by_muxin: true -- this must only ever come from Claude's stdin JSON, checked against evidence, never asserted by the script itself`
      );
    }
  });

  test("selectDecision rejects selected_by values other than the literal string \"muxin\"", () => {
    const decisionsSrc = readFileSync(join(VENTURE_DIR, "decisions.ts"), "utf8");
    assert.match(decisionsSrc, /selectedBy\s*as\s*string\)\s*===\s*"system"/);
  });
});
