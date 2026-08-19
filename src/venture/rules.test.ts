import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { loadRules, assertRulesVersion, artifactKindRule, requireRulesVersionMatch, RulesVersionMismatchError } from "./rules.js";
import { appendCanonEvent } from "./canon.js";
import { ventureDir } from "./paths.js";

// The anti-drift mechanism venture-build-plan.md §F requires: every threshold/enum/predicate
// venture/rules.yaml encodes must match what venture/rules.md's prose currently states. This
// reads the raw prose and asserts on substrings/numbers rather than parsing markdown structurally
// -- brittle to rewording, which is the point: a rules.md edit that changes a number without a
// matching rules.yaml edit should fail this test, not slide through silently.

const rulesMd = readFileSync(join(repoRoot, "venture", "rules.md"), "utf8");
const schemaMd = readFileSync(join(repoRoot, "docs", "venture-schema-contract.md"), "utf8");
const rules = loadRules();

describe("rules.yaml parity with rules.md prose", () => {
  test("rules_version and source hashes match rules.md's stated values", () => {
    assert.match(rulesMd, /Rules version:\*\*\s*`([^`]+)`/);
    const [, statedVersion] = rulesMd.match(/Rules version:\*\*\s*`([^`]+)`/)!;
    assert.equal(statedVersion, rules.rules_version);
    assert.match(rulesMd, new RegExp(rules.sources.starter_kit_sha256));
    assert.match(rulesMd, new RegExp(rules.sources.welsh_note_sha256));
  });

  test("platform recommendation: exactly three filters, single-platform-only", () => {
    assert.equal(rules.platform_recommendation.filters.length, 3);
    assert.equal(rules.platform_recommendation.single_primary_platform, true);
    assert.match(rulesMd, /MUST recommend one primary platform/);
    assert.match(rulesMd, /MUST NOT recommend a multi-platform launch/);
  });

  test("idea ranking: ten ideas, four factors, three selected, 1-5 scale", () => {
    assert.equal(rules.idea_ranking.idea_count, 10);
    assert.equal(rules.idea_ranking.factors.length, 4);
    assert.equal(rules.idea_ranking.select_count, 3);
    assert.equal(rules.idea_ranking.score_scale.min, 1);
    assert.equal(rules.idea_ranking.score_scale.max, 5);
    assert.match(rulesMd, /Generate ten distinct ideas/);
    assert.match(rulesMd, /Let the user select exactly three/);
    assert.match(rulesMd, /use a 1-5 scale/);
  });

  test("distinct-unknown-coverage rationale requirement matches §5.2's corrective pass", () => {
    assert.equal(rules.idea_ranking.require_rationale_on_unknown_overlap, true);
    assert.match(rulesMd, /decision record's\s*\n?`rationale` MUST state why/);
  });

  test("draft constraints: 150-word cap, reply prompt required by default", () => {
    assert.equal(rules.draft.post_max_words, 150);
    assert.match(rulesMd, /remain below 150 words/);
    assert.equal(rules.draft.require_reply_prompt, true);
    assert.match(rulesMd, /every required Phase 1 post\s+carries a reply prompt/);
  });

  test("checkpoint-1: three artifacts, all live, pace recorded -- no partial pass", () => {
    const cp = rules.checkpoints["checkpoint-1"];
    assert.equal(cp.required_artifact_count, 3);
    assert.equal(cp.require_all_live, true);
    assert.equal(cp.require_pace_recorded, true);
    assert.match(rulesMd, /exactly three required Phase 1 posts are editorially approved/);
    assert.match(rulesMd, /all three are confirmed live with evidence/);
    assert.match(rulesMd, /the ongoing pace is recorded/);
    assert.match(rulesMd, /Approval alone does not clear the checkpoint/);
  });

  test("Phase 1 CTA policy is reply_prompt, matching the locked CTA table", () => {
    assert.equal(rules.cta_policy_by_phase["1"], "reply_prompt");
    assert.match(rulesMd, /Phase 1 — test the problem \| Reply prompt by default/);
  });

  test("research-plan gate: confirmed_by_muxin required, four unknown dimensions", () => {
    assert.equal(rules.research_plan.require_confirmed_by_muxin, true);
    assert.equal(rules.research_plan.unknown_dimensions.length, 4);
    assert.match(rulesMd, /carrying an explicit `confirmed_by_muxin` flag/);
    assert.match(rulesMd, /MUST be reviewed by Muxin before any probe is drafted into a post/);
  });

  test("lead-magnet concept rubric: five concepts, six factors, 1-5 scale, one selected", () => {
    assert.equal(rules.lead_magnet_concept.concept_count, 5);
    assert.equal(rules.lead_magnet_concept.factors.length, 6);
    assert.equal(rules.lead_magnet_concept.score_scale.min, 1);
    assert.equal(rules.lead_magnet_concept.score_scale.max, 5);
    assert.equal(rules.lead_magnet_concept.select_count, 1);
    assert.match(rulesMd, /Generate five lead-magnet concepts/);
    assert.match(rulesMd, /is it one of the first obstacles in the audience's journey/); // early_problem
    assert.match(rulesMd, /does it solve one specific problem/); // narrowness
    assert.match(rulesMd, /do people already feel this problem/); // frustration
    assert.match(rulesMd, /can the reader use it in under 10 minutes/); // fast_win
    assert.match(rulesMd, /can this creator help credibly/); // proof_fit
    assert.match(rulesMd, /will the signup and follow-up question teach the venture what people need next/); // research_value
    assert.match(rulesMd, /use a visible 1-5 scale for comparison/);
    assert.match(rulesMd, /The system recommends one concept\. Muxin selects or overrides it\./);
  });

  test("research-continuation decision: three candidates matching §5.6's gate", () => {
    assert.equal(rules.research_continuation.candidates.length, 3);
    assert.deepEqual(rules.research_continuation.candidates, [
      "more_probes",
      "proceed_with_evidence",
      "proceed_as_hypothesis",
    ]);
    assert.match(rulesMd, /`more_probes`/);
    assert.match(rulesMd, /`proceed_with_evidence`/);
    assert.match(rulesMd, /`proceed_as_hypothesis`/);
  });

  test("research-read required sources: eight channels, matching §5.6's ingest list", () => {
    assert.equal(rules.research_read.required_sources.length, 8);
    assert.match(rulesMd, /Substack native metrics \(views, likes, restacks\)/);
    assert.match(rulesMd, /essay comments/);
    assert.match(rulesMd, /Note replies/);
    assert.match(rulesMd, /DMs/);
    assert.match(rulesMd, /email replies/);
    assert.match(rulesMd, /subscriber-count movement/);
    assert.match(rulesMd, /follow-up questions from readers/);
    assert.match(rulesMd, /the creator's own qualitative observations/);
    // the literal enum tokens are schema-contract.md's, not rules.md's prose -- §2C.3
    for (const source of rules.research_read.required_sources) {
      assert.match(schemaMd, new RegExp(`"${source}"`));
    }
  });

  test("research-read signal-quality rubric: eight named factors, matching §5.6/§2C.4", () => {
    assert.equal(rules.research_read.signal_quality_factors.length, 8);
    assert.match(
      rulesMd,
      /each of the eight factors \(audience fit, specificity, an\s*\nexplicit stuck point, requested help, a follow-up question, recurrence, a behavioral action, and\s*\nexposure context\)/
    );
    for (const factor of rules.research_read.signal_quality_factors) {
      assert.match(schemaMd, new RegExp(`\`${factor}\``));
    }
  });

  test("checkpoint-2: four required artifact kinds, all live, announcement excluded", () => {
    const cp = rules.checkpoints["checkpoint-2"];
    assert.deepEqual(cp.required_artifact_kinds, ["lead-magnet", "landing-page-copy", "welcome-email", "survey"]);
    assert.equal(cp.require_all_live, true);
    assert.equal(cp.require_pace_recorded, undefined);
    assert.match(rulesMd, /the lead magnet is available at its delivery destination/);
    assert.match(rulesMd, /the landing page accepts and stores an email/);
    assert.match(rulesMd, /the post-signup survey stores one tested answer against the subscriber/);
    assert.match(rulesMd, /the welcome email is active and delivers the lead magnet/);
    assert.match(rulesMd, /The announcement is not required to clear the checkpoint/);
  });

  test("Phase 2 CTA policy is lead_magnet_bridge, matching the locked CTA table", () => {
    assert.equal(rules.cta_policy_by_phase["2"], "lead_magnet_bridge");
    assert.match(rulesMd, /Phase 2 — build the owned audience \| Bridge to the relevant active lead magnet\./);
  });
});

describe("assertRulesVersion", () => {
  test("passes when the stamped version matches the loaded rules", () => {
    assert.doesNotThrow(() => assertRulesVersion(rules.rules_version, rules));
  });

  test("throws RulesVersionMismatchError naming both versions on a mismatch", () => {
    assert.throws(
      () => assertRulesVersion("some-other-version", rules),
      (err: unknown) => {
        assert.ok(err instanceof RulesVersionMismatchError);
        assert.match((err as Error).message, /some-other-version/);
        assert.match((err as Error).message, new RegExp(rules.rules_version));
        return true;
      }
    );
  });
});

describe("requireRulesVersionMatch", () => {
  const SLUG = "zz-test-rules-version-match";

  afterEach(() => {
    rmSync(ventureDir(SLUG), { recursive: true, force: true });
  });

  test("no-ops before a kickoff event exists", () => {
    assert.doesNotThrow(() => requireRulesVersionMatch(SLUG, rules));
  });

  test("no-ops when the venture's stamped version matches what's loaded", () => {
    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: rules.rules_version }, "t0");
    assert.doesNotThrow(() => requireRulesVersionMatch(SLUG, rules));
  });

  test("throws RulesVersionMismatchError when the venture was kicked off under a different version", () => {
    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: "some-old-version" }, "t0");
    assert.throws(
      () => requireRulesVersionMatch(SLUG, rules),
      (err: unknown) => err instanceof RulesVersionMismatchError
    );
  });
});

describe("artifactKindRule", () => {
  test("substack-post is manual, not publishable, url evidence", () => {
    const r = artifactKindRule(rules, "substack-post");
    assert.equal(r.delivery_mode, "manual");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, "url");
  });

  test("text-post-note is app-delivered, publishable, agent evidence", () => {
    const r = artifactKindRule(rules, "text-post-note");
    assert.equal(r.delivery_mode, "app");
    assert.equal(r.publishable, true);
    assert.equal(r.min_evidence, "agent");
  });

  test("phase_1_research_read is an internal, non-publishable artifact with no evidence", () => {
    const r = artifactKindRule(rules, "phase_1_research_read");
    assert.equal(r.delivery_mode, "none");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, null);
    assert.equal(r.phase, 1);
  });

  test("lead-magnet, landing-page-copy, and survey are manual with url evidence, phase 2", () => {
    for (const kind of ["lead-magnet", "landing-page-copy", "survey"] as const) {
      const r = artifactKindRule(rules, kind);
      assert.equal(r.delivery_mode, "manual");
      assert.equal(r.publishable, false);
      assert.equal(r.min_evidence, "url");
      assert.equal(r.phase, 2);
    }
  });

  test("welcome-email is manual with attestation evidence, phase 2", () => {
    const r = artifactKindRule(rules, "welcome-email");
    assert.equal(r.delivery_mode, "manual");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, "attestation");
    assert.equal(r.phase, 2);
  });

  test("throws on an unknown artifact kind rather than returning undefined", () => {
    assert.throws(() => artifactKindRule(rules, "product-outline" as never), /no artifact_kinds entry/);
  });
});
