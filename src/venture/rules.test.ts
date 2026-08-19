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

  test("throws on an unknown artifact kind rather than returning undefined", () => {
    assert.throws(() => artifactKindRule(rules, "lead-magnet" as never), /no artifact_kinds entry/);
  });
});
