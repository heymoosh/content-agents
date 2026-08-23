import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { repoRoot } from "../db/db.js";

// ── rule 5: no em dash reaches the screen ────────────────────────────────────────────────────────
// Root CLAUDE.md rule 5 and config/voice.yaml ban the em dash from every word a human reads. Every
// module below prints a markdown report that Muxin reads in her terminal and that /strategy folds
// into briefs/YYYY-MM-DD-strategy-brief.md; snapshot.ts's data-confidence table is rendered
// verbatim by the review GUI's Signals room on top of that. None of it is covered by a rendered
// output test, so this is a source-level guard instead: it parses each file with the TypeScript
// scanner and looks inside string and template literals only. Comments keep their em dashes (nobody
// reads those on screen). If this test fails, do not just delete the dash: rewrite the sentence
// with a period, a comma, a colon, or parentheses, whichever sounds right read aloud.
//
// This is deliberately the same shape as the guard over src/review/signals.ts (added in PR #376,
// still open when this landed), an explicit filename list and an identical visitor, so the two can
// be folded into one shared guard later without rewriting either.
const EM_DASH = "—";
const STRATEGY_REPORT_MODULES = [
  "angle-refresh.ts",
  "audience.ts",
  "cadence-fit.ts",
  "cta-fit.ts",
  "exploration.ts",
  "frame-fit.ts",
  "grade-bets.ts",
  "lever-effectiveness.ts",
  "media-fit.ts",
  "origin-compare.ts",
  "platform-fit.ts",
  "resonance.ts",
  "route.ts",
  "routing-drift.ts",
  "snapshot.ts",
  "spin-control.ts",
];

test("no string a strategy report can print carries an em dash", () => {
  for (const file of STRATEGY_REPORT_MODULES) {
    const path = join(repoRoot, "src", "strategy", file);
    const source = ts.createSourceFile(file, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const offenders: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        if (node.text.includes(EM_DASH)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          offenders.push(`${file}:${line + 1} ${node.text.trim()}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.deepEqual(offenders, [], `em dash in a string a reader can see:\n${offenders.join("\n")}`);
  }
});
