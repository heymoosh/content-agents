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

// Naive brace-matched extraction of one named function's source text, so a check below can
// carve it out of the rest of a file and scan the remainder in isolation. Good enough for this
// blunt structural check -- not a parser, just enough to isolate one function body.
function extractFunctionSource(text: string, functionName: string): string {
  const start = text.indexOf(`function ${functionName}`);
  if (start === -1) return "";
  const braceStart = text.indexOf("{", start);
  let depth = 0;
  let end = braceStart;
  for (; end < text.length; end++) {
    if (text[end] === "{") depth++;
    else if (text[end] === "}") {
      depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }
  }
  return text.slice(start, end);
}

describe("self-stamp: Muxin-only fields are set from exactly one place", () => {
  const REVIEWED_TRUE = /reviewed_by_muxin:\s*true\b/;
  const CONFIRMED_TRUE = /confirmed_by_muxin:\s*true\b/;
  const CONFIRMED_EMERGENT = /muxin_confirmed_emergent:\s*(true|false)\b/;

  test("reviewed_by_muxin: true appears exactly three times across all of src/venture/*.ts (cmdPlanReview and cmdResearchReadReview in phase1.ts, cmdSurveyReviewApprove in phase2.ts only)", () => {
    let total = 0;
    const hits: string[] = [];
    for (const file of sourceFiles()) {
      const n = countLiteralAssignments(readFileSync(file, "utf8"), REVIEWED_TRUE);
      if (n > 0) hits.push(`${file.split("/").pop()} (${n})`);
      total += n;
    }
    assert.equal(
      total,
      3,
      `expected exactly three legitimate setters (cmdPlanReview, cmdResearchReadReview, cmdSurveyReviewApprove), found: ${hits.join(", ") || "none"}`
    );
    assert.equal(
      countLiteralAssignments(readFileSync(join(VENTURE_DIR, "phase1.ts"), "utf8"), REVIEWED_TRUE),
      2,
      "both Phase 1 setters must be in phase1.ts, and nowhere else"
    );
    assert.equal(
      countLiteralAssignments(readFileSync(join(VENTURE_DIR, "phase2.ts"), "utf8"), REVIEWED_TRUE),
      1,
      "the survey-review-approve setter must be in phase2.ts, and nowhere else"
    );
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

  test("muxin_confirmed_emergent literal true/false assignments never appear outside updateResearchReadFinding's own implementation", () => {
    let totalOutside = 0;
    const hits: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
      const scanText = file.endsWith("artifacts.ts")
        ? text.replace(extractFunctionSource(text, "updateResearchReadFinding"), "")
        : text;
      const n = countLiteralAssignments(scanText, CONFIRMED_EMERGENT);
      if (n > 0) hits.push(`${file.split("/").pop()} (${n})`);
      totalOutside += n;
    }
    assert.equal(
      totalOutside,
      0,
      `muxin_confirmed_emergent true/false assignment found outside updateResearchReadFinding: ${hits.join(", ") || "none"} -- no other code path may silently confirm an emergent finding`
    );
  });

  test("selectDecision rejects selected_by values other than the literal string \"muxin\"", () => {
    const decisionsSrc = readFileSync(join(VENTURE_DIR, "decisions.ts"), "utf8");
    assert.match(decisionsSrc, /selectedBy\s*as\s*string\)\s*===\s*"system"/);
  });
});
