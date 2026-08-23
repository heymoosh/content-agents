import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { loadRules, assertRulesVersion, artifactKindRule, evidenceMeetsMinimum, requireRulesVersionMatch, RulesVersionMismatchError } from "./rules.js";
import { appendCanonEvent } from "./canon.js";
import { SCORECARD_FIXED } from "./intake.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

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

  test("Phase 3 CTA policy is lead_magnet_or_response_request, matching the locked CTA table", () => {
    assert.equal(rules.cta_policy_by_phase["3"], "lead_magnet_or_response_request");
    assert.match(
      rulesMd,
      /Phase 3 — validate the offer \| Normally the lead magnet or a response request\. Show an offer only after the response gate and the required approvals \(§7\.10\) have cleared\./
    );
  });

  test("response gate: 20 minimum, 30 target eligible unique respondents", () => {
    assert.equal(rules.response_gate.min_eligible_unique, 20);
    assert.equal(rules.response_gate.target_eligible_unique, 30);
    assert.match(rulesMd, /- Minimum: 20\./);
    assert.match(rulesMd, /- Target: 30\./);
  });

  test("problem score: six named factors, 1-5 scale, matching §7.6's numbered list", () => {
    assert.equal(rules.problem_score.factors.length, 6);
    assert.deepEqual(rules.problem_score.factors, [
      "frequency",
      "intensity",
      "time_cost",
      "money_cost",
      "stress_cost",
      "solvability",
    ]);
    assert.equal(rules.problem_score.score_scale.min, 1);
    assert.equal(rules.problem_score.score_scale.max, 5);
    assert.match(rulesMd, /Score every cluster from 1-5 on:/);
    assert.match(rulesMd, /\*\*Frequency:\*\* how often does it appear\?/);
    assert.match(rulesMd, /\*\*Intensity:\*\* how emotional or urgent is the language\?/);
    assert.match(rulesMd, /\*\*Time cost:\*\* how much time does it waste\?/);
    assert.match(rulesMd, /\*\*Money cost:\*\* what money, tools, donations, subscriptions, or support does it waste\?/);
    assert.match(rulesMd, /\*\*Stress cost:\*\* does it create anxiety, cynicism, burnout, or paralysis\?/);
    assert.match(rulesMd, /\*\*Solvability:\*\* can this creator credibly solve a useful part of it in a small first offer\?/);
  });

  test("product outline: five-to-seven sections, matching §7.8", () => {
    assert.equal(rules.product_outline.min_sections, 5);
    assert.equal(rules.product_outline.max_sections, 7);
    assert.match(rulesMd, /contain five to seven concise sections/);
  });

  test("checkpoint-3: product-outline and price-decision required, all live, three decisions required", () => {
    const cp = rules.checkpoints["checkpoint-3"];
    assert.deepEqual(cp.required_artifact_kinds, ["product-outline", "price-decision"]);
    assert.equal(cp.require_all_live, true);
    assert.equal(cp.require_pace_recorded, undefined);
    assert.deepEqual(cp.required_decision_kinds, [
      "problem-selection",
      "transformation-choice",
      "product-format-and-price",
    ]);
    // rules.md §7.10's completion list, and the schema contract's explicit split of the response
    // gate (not a checkpoint) from checkpoint-3/phase_3_completed (a real checkpoint).
    assert.match(rulesMd, /the selected problem is approved/);
    assert.match(rulesMd, /the transformation is approved/);
    assert.match(rulesMd, /the five-to-seven-section outline is approved/);
    assert.match(rulesMd, /the price and pitch are approved/);
    assert.match(
      schemaMd,
      /Clears only when\s*\n\s*the problem, transformation, outline, price, and pitch decision records/
    );
  });

  test("cluster analysis: three-to-five cluster bounds, matching §7.5", () => {
    assert.equal(rules.cluster_analysis.min_clusters, 3);
    assert.equal(rules.cluster_analysis.max_clusters, 5);
    assert.match(rulesMd, /Produce three to five clusters, not a long list of micro-categories\./);
  });

  test("transformation: banned vague verbs match §7.7's named examples", () => {
    assert.deepEqual(rules.transformation.banned_verbs, ["unlock", "elevate", "transform"]);
    // rules.md uses curly quotes around the named verbs -- match loosely on the verbs themselves,
    // not the quote glyphs, so a straight-quote regex here doesn't silently fail to match.
    assert.match(rulesMd, /no vague verbs such as[\s\S]{0,10}unlock/);
    assert.match(rulesMd, /elevate/);
    assert.match(rulesMd, /or[\s\S]{0,10}transform/);
  });

  test("daily operating plan: five canonical jobs sum to 135 minutes, matching §8.1", () => {
    const sum = rules.daily_operating_plan.canonical_jobs.reduce((total, job) => total + job.minutes, 0);
    // The arithmetic guard: canonical_total_minutes must equal the real sum of canonical_jobs, not
    // a hardcoded number that could silently drift from the job list.
    assert.equal(sum, rules.daily_operating_plan.canonical_total_minutes);
    assert.equal(rules.daily_operating_plan.canonical_total_minutes, 135);
    assert.equal(rules.daily_operating_plan.canonical_jobs.length, 5);
    assert.match(rulesMd, /30 minutes for content writing and engagement/);
    assert.match(rulesMd, /30 minutes for tomorrow's posts/);
    assert.match(rulesMd, /30 minutes for feedback analysis/);
    assert.match(rulesMd, /30 minutes for the core offer/);
    assert.match(rulesMd, /15 minutes for direct customer outreach/);
    assert.match(rulesMd, /Total: 2 hours 15 minutes/);
  });

  test("daily operating plan: four modes matching §8.1's recorded-choice options", () => {
    assert.deepEqual(rules.daily_operating_plan.modes, ["canonical", "rotated", "extended_timeline", "revised_scope"]);
    assert.match(rulesMd, /use the canonical daily routine/);
    assert.match(rulesMd, /rotate the five jobs across the week within the available budget/);
    assert.match(rulesMd, /extend the build timeline while preserving the sequence/);
    assert.match(rulesMd, /revise the posting pace or scope/);
  });

  test("day 14 decision: candidates match SCORECARD_FIXED.final_decision_options exactly", () => {
    assert.deepEqual(rules.day_14_decision.candidates, [...SCORECARD_FIXED.final_decision_options]);
    assert.match(rulesMd, /continue;/);
    assert.match(rulesMd, /revise positioning;/);
    assert.match(rulesMd, /revise the lead magnet;/);
    assert.match(rulesMd, /collect more evidence;/);
    assert.match(rulesMd, /- stop\./);
  });

  test("Phase 4 CTA policy is the §1A.1 allowed set, not a single default", () => {
    assert.deepEqual(rules.cta_policy_by_phase["4"], ["lead_magnet_bridge", "approved_offer", "project", "no_cta"]);
    assert.match(
      rulesMd,
      /Phase 4 and later — grow the business \| The relevant lead magnet, an approved offer, a project, or no CTA, chosen by the item's actual purpose\./
    );
  });

  test("phase4_completion is a sibling of checkpoints, not a checkpoint-4 entry", () => {
    assert.deepEqual(rules.phase4_completion.required_artifact_kinds, ["daily-operating-plan", "day-14-review"]);
    assert.deepEqual(rules.phase4_completion.required_decision_kinds, ["daily-operating-plan-choice", "day-14-decision"]);
    assert.equal(rules.phase4_completion.ledger_event_id, "phase-4-completed");
    // thank-you-note is deliberately excluded -- rules.md §8.4 sets no minimum count for it.
    assert.ok(!rules.phase4_completion.required_artifact_kinds.includes("thank-you-note" as never));
    assert.ok(!("checkpoint-4" in rules.checkpoints));
    assert.match(rulesMd, /There is no fourth checkpoint in this draft/);
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

  beforeEach(useTempVentureRoot);
  afterEach(clearTempVentureRoot);

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

  test("product-outline and price-decision are internal, non-publishable, no-evidence artifacts, phase 3", () => {
    for (const kind of ["product-outline", "price-decision"] as const) {
      const r = artifactKindRule(rules, kind);
      assert.equal(r.delivery_mode, "none");
      assert.equal(r.publishable, false);
      assert.equal(r.min_evidence, null);
      assert.equal(r.phase, 3);
    }
  });

  test("daily-operating-plan is internal, non-publishable, no-evidence, phase 4", () => {
    const r = artifactKindRule(rules, "daily-operating-plan");
    assert.equal(r.delivery_mode, "none");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, null);
    assert.equal(r.phase, 4);
  });

  test("thank-you-note is manual with attestation evidence, phase 4", () => {
    const r = artifactKindRule(rules, "thank-you-note");
    assert.equal(r.delivery_mode, "manual");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, "attestation");
    assert.equal(r.phase, 4);
  });

  test("day-14-review is internal, non-publishable, no-evidence, phase 4", () => {
    const r = artifactKindRule(rules, "day-14-review");
    assert.equal(r.delivery_mode, "none");
    assert.equal(r.publishable, false);
    assert.equal(r.min_evidence, null);
    assert.equal(r.phase, 4);
  });

  test("throws on an unknown artifact kind rather than returning undefined", () => {
    assert.throws(() => artifactKindRule(rules, "bogus-kind" as never), /no artifact_kinds entry/);
  });
});

// venture-schema-contract.md §4 calls min_evidence a MINIMUM. It was read as exact equality, which
// made "attestation" a minimum nothing could satisfy: the only confirm path wrote "url", so
// welcome-email and thank-you-note could never be complete and checkpoint 2 could never clear.
describe("evidenceMeetsMinimum -- min_evidence is a floor, not an exact type", () => {
  test("an attestation minimum is cleared by anything that leaves at least as much trace", () => {
    assert.equal(evidenceMeetsMinimum("attestation", "attestation"), true);
    assert.equal(evidenceMeetsMinimum("url", "attestation"), true, "a link is checkable, a sentence is not");
    assert.equal(evidenceMeetsMinimum("agent", "attestation"), true);
  });

  test("an attestation alone never stands in for a checkable proof", () => {
    assert.equal(evidenceMeetsMinimum("attestation", "url"), false);
    assert.equal(evidenceMeetsMinimum("attestation", "agent"), false);
  });

  // §4: "An agent confirmation and Muxin's own word are not the same fact and must not look the
  // same." So the order is partial. url and agent both clear an attestation floor and neither
  // stands in for the other.
  test("url and agent are not interchangeable with each other", () => {
    assert.equal(evidenceMeetsMinimum("url", "url"), true);
    assert.equal(evidenceMeetsMinimum("agent", "agent"), true);
    assert.equal(evidenceMeetsMinimum("agent", "url"), false, "the system posting is not her pasting");
    assert.equal(evidenceMeetsMinimum("url", "agent"), false, "her word is not a provider post id");
  });

  test("a kind that declares no minimum takes any evidence", () => {
    for (const t of ["url", "agent", "attestation"] as const) {
      assert.equal(evidenceMeetsMinimum(t, null), true);
    }
  });

  // The two kinds the bug made unsatisfiable, read straight off rules.yaml so a future rubric edit
  // has to face this test.
  test("every kind's declared minimum is satisfiable by a proof the confirm path can write", () => {
    for (const kind of ["welcome-email", "thank-you-note"] as const) {
      const min = artifactKindRule(rules, kind).min_evidence;
      assert.equal(min, "attestation");
      assert.equal(evidenceMeetsMinimum("attestation", min), true, `${kind} must accept an attestation`);
    }
  });
});
