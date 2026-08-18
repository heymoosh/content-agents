import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { ventureDir } from "./paths.js";

// Exercises the real CLI as a subprocess -- avoids fighting process.argv/stdin mutation across
// tests, and tests the actual contract (exit code, stderr message) rather than an internal call.
const SCRIPT = join(repoRoot, "src", "venture", "phase1.ts");
const SLUG = "zz-test-research-gate";

function runCmd(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

describe("plan-init validation", () => {
  test("rejects a probe referencing an unknown_id not in open_unknowns", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
        probes: [{ unknown_id: "u-does-not-exist", hypothesis: "h", conversation_question: "q", expected_evidence: "e" }],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /isn't in open_unknowns/);
  });

  test("rejects an invalid dimension", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "not_a_real_dimension", description: "d" }],
        probes: [],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid dimension/);
  });

  test("rejects a confirmed_known without evidence_refs or confirmed_by_muxin", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [{ claim: "already known", evidence_refs: [], confirmed_by_muxin: false }],
        open_unknowns: [],
        probes: [],
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /needs non-empty evidence_refs AND confirmed_by_muxin/);
  });

  test("a well-formed plan succeeds and starts unreviewed", () => {
    const r = runCmd(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
        probes: [],
      })
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /STOP: show Muxin this plan/);
  });
});

describe("the G2/G3 gate chain -- drafting is refused until every prior gate clears", () => {
  // Deliberately does NOT call plan-review -- callers opt into that separately so both
  // "unreviewed" and "reviewed" starting states are easy to set up from the same seed.
  function seedUnreviewedPlanAndSelectedPlatform() {
    runCmd(
      "plan-init",
      [],
      JSON.stringify({ confirmed_knowns: [], open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }], probes: [] })
    );
    runCmd(
      "platform",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: [
          { candidate_id: "substack", label: "Substack", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "x", label: "X", scores: {}, evidence_refs: [], rationale: "r" },
        ],
        recommended_candidate_ids: ["substack"],
      })
    );
    runCmd("platform-select", ["substack"]);
  }

  test("ideas is refused before the plan is reviewed, even with a platform selected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    const r = runCmd("ideas", [], "{}");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /reviewed_by_muxin/);
  });

  test("ideas succeeds once the plan is reviewed, and requires exactly the configured idea_count", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const tooFew = runCmd(
      "ideas",
      [],
      JSON.stringify({
        input_refs: [],
        candidates: [{ candidate_id: "idea-1", label: "l", scores: { personal_stake: 1, specificity: 1, identity_signal: 1, easy_reply: 1 }, evidence_refs: [], rationale: "r", unknown_id: "u1" }],
        recommended_candidate_ids: [],
      })
    );
    assert.equal(tooFew.status, 1);
    assert.match(tooFew.stderr, /expected exactly 10/);
  });

  test("draft is refused for a candidate that wasn't one of the three selected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const r = runCmd("draft", ["idea-9", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: "b?", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /was not one of the three Muxin selected/);
  });

  test("draft over the word cap is rejected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const longBody = Array(160).fill("word").join(" ") + "?";
    const r = runCmd("draft", ["idea-1", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: longBody, claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /over the 150-word/);
  });

  test("draft with no reply prompt and no no_cta_reason is rejected", () => {
    seedUnreviewedPlanAndSelectedPlatform();
    runCmd("plan-review", []);
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `idea-${i + 1}`,
      label: `idea ${i + 1}`,
      scores: { personal_stake: 3, specificity: 3, identity_signal: 3, easy_reply: 3 },
      evidence_refs: [],
      rationale: "r",
      unknown_id: `u${i + 1}`,
    }));
    runCmd("ideas", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["idea-1", "idea-2", "idea-3"] }));
    runCmd("select", ["idea-1", "idea-2", "idea-3"]);
    const r = runCmd("draft", ["idea-1", "--kind", "text-post-note"], JSON.stringify({ title: "t", body: "no question mark here.", claim_refs: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /doesn't end with a reply prompt/);
  });
});
