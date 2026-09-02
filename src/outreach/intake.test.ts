import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { intakeFromJsa, leadDir, fitFieldLine } from "./intake.js";

// Regression coverage for intake.ts's single most load-bearing rule: --from-jsa MUST refuse an
// unfiltered/bare bulk import (docs/outreach-engine-plan.md, SKILL.md "no accidental full-database
// pull"). Both throw branches in intakeFromJsa() fire before any JSA_DB_PATH/db access or
// filesystem write, so these stay pure, disk-free, and env-independent -- no mkdtemp/cleanup
// needed and no risk of writing into the real outreach/leads/ tree.
describe("intakeFromJsa: --from-jsa refusal guard", () => {
  test("refuses a bare call with no verdict, no name, no limit", () => {
    assert.throws(() => intakeFromJsa({ verdicts: [] }), /requires --verdict/);
  });

  test("refuses when verdicts is empty even if a company name is given", () => {
    assert.throws(
      () => intakeFromJsa({ verdicts: [], companyName: "Acme Co" }),
      /requires --verdict/,
    );
  });

  test("refuses a verdict-only call with neither a company name nor --limit", () => {
    assert.throws(
      () => intakeFromJsa({ verdicts: ["TARGET"] }),
      /requires either a company name argument or --limit N/,
    );
  });

  test("passes the guard (throws a different, downstream error) once verdict + name are both given", () => {
    // Past the guard it hits jsa.ts's real DB lookup, which fails in this env for an unrelated
    // reason (no JSA_DB_PATH / no db file) -- asserting the message is NOT a guard-refusal message
    // is what proves the guard let this request through.
    try {
      intakeFromJsa({ verdicts: ["TARGET"], companyName: "Acme Co" });
      assert.fail("expected a downstream error once past the guard");
    } catch (err) {
      const message = (err as Error).message;
      assert.ok(!/requires --verdict/.test(message));
      assert.ok(!/requires either a company name argument/.test(message));
    }
  });

  test("passes the guard when verdict + limit are both given (no company name)", () => {
    try {
      intakeFromJsa({ verdicts: ["TARGET"], limit: 3 });
      assert.fail("expected a downstream error once past the guard");
    } catch (err) {
      const message = (err as Error).message;
      assert.ok(!/requires --verdict/.test(message));
      assert.ok(!/requires either a company name argument/.test(message));
    }
  });
});

// Peer-kind coverage (pure helpers only -- no I/O, so no real outreach/leads/ folder is ever
// touched by these tests). `intakeManual` itself always writes under the real repoRoot and is
// intentionally not exercised in tests for that reason.
describe("peer-kind intake helpers", () => {
  test("leadDir scaffolds a peer-<slug> folder name, same shape as client/platform", () => {
    const dir = leadDir("peer", "Jane Doe");
    assert.ok(dir.endsWith("outreach/leads/peer-jane-doe"));
  });

  test("fitFieldLine treats peer like client: a classification field, not fit", () => {
    assert.match(fitFieldLine("peer"), /^classification: unclear/);
    assert.match(fitFieldLine("client"), /^classification: unclear/);
    assert.match(fitFieldLine("platform"), /^fit: weak/);
  });
});
