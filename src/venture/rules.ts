import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// venture/rules.md is the prose authority and does NOT execute. A phase script loads ONLY
// venture/rules.yaml, via this module. Never parse rules.md at runtime -- src/venture/rules.test.ts
// is the parity check that keeps the two from drifting.

export type ArtifactKind = "substack-post" | "text-post-note" | "phase_1_research_plan";

export interface ArtifactKindRule {
  delivery_mode: "manual" | "app" | "none";
  publishable: boolean;
  min_evidence: "url" | "agent" | null;
  phase: number;
}

export interface VentureRules {
  rules_version: string;
  sources: { starter_kit_sha256: string; welsh_note_sha256: string };
  artifact_kinds: Record<ArtifactKind, ArtifactKindRule>;
  platform_recommendation: {
    filters: string[];
    single_primary_platform: boolean;
  };
  research_plan: {
    unknown_dimensions: string[];
    require_confirmed_by_muxin: boolean;
  };
  idea_ranking: {
    idea_count: number;
    factors: string[];
    score_scale: { min: number; max: number };
    select_count: number;
    bank_remainder: boolean;
    require_rationale_on_unknown_overlap: boolean;
  };
  draft: {
    post_max_words: number;
    require_reply_prompt: boolean;
    require_claim_refs: boolean;
  };
  cta_policy_by_phase: Record<string, string>;
  phase_1_pace: { recommended_posts_per_week: number };
  checkpoints: {
    "checkpoint-1": {
      required_artifact_count: number;
      require_all_live: boolean;
      require_pace_recorded: boolean;
    };
  };
}

export const RULES_PATH = join(repoRoot, "venture", "rules.yaml");

export function loadRules(): VentureRules {
  return parse(readFileSync(RULES_PATH, "utf8")) as VentureRules;
}

export class RulesVersionMismatchError extends Error {
  constructor(stamped: string, loaded: string) {
    super(
      `venture rules version mismatch: this venture was kicked off under "${stamped}", but ` +
        `venture/rules.yaml currently loads "${loaded}". Do not run phase scripts against a ` +
        `venture stamped with a different rules version -- either the venture predates a rules ` +
        `revision, or rules.yaml regressed. Resolve before continuing.`
    );
    this.name = "RulesVersionMismatchError";
  }
}

// Called by anything that has both a venture's stamped kickoff version (from canon.md, once
// src/venture/canon.ts exists) and the currently-loaded rules. Throws loudly on mismatch rather
// than silently applying the wrong rubric to an in-flight venture.
export function assertRulesVersion(stampedVersion: string, rules: VentureRules): void {
  if (stampedVersion !== rules.rules_version) {
    throw new RulesVersionMismatchError(stampedVersion, rules.rules_version);
  }
}

export function artifactKindRule(rules: VentureRules, kind: ArtifactKind): ArtifactKindRule {
  const rule = rules.artifact_kinds[kind];
  if (!rule) {
    throw new Error(`no artifact_kinds entry for "${kind}" in venture/rules.yaml`);
  }
  return rule;
}
