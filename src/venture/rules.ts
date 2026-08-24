import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { findCanonEvent } from "./canon.js";
import type { DecisionKind } from "./decisions.js";

// venture/rules.md is the prose authority and does NOT execute. A phase script loads ONLY
// venture/rules.yaml, via this module. Never parse rules.md at runtime -- src/venture/rules.test.ts
// is the parity check that keeps the two from drifting.

export type ArtifactKind =
  | "substack-post"
  | "text-post-note"
  | "phase_1_research_plan"
  | "phase_1_research_read"
  | "lead-magnet"
  | "landing-page-copy"
  | "welcome-email"
  | "survey"
  | "text-post-announcement"
  | "product-outline"
  | "price-decision"
  | "daily-operating-plan"
  | "day-14-review"
  | "thank-you-note";

export interface ArtifactKindRule {
  delivery_mode: "manual" | "app" | "none";
  publishable: boolean;
  min_evidence: "url" | "agent" | "attestation" | null;
  phase: number;
}

// venture-schema-contract.md §4 calls min_evidence a MINIMUM, so this is a floor, not an exact
// type. `attestation` is the weakest proof -- Muxin's word with no addressable trace -- and both
// `url` and `agent` clear it, because each leaves something checkable later.
//
// `url` and `agent` are NOT interchangeable with each other. §4: "An agent confirmation and Muxin's
// own word are not the same fact and must not look the same." A kind that wants a provider's post
// id is not satisfied by her saying she pasted a link, and a kind she pastes herself is not
// satisfied by the system claiming it posted. So the order is partial, not total:
//
//   min "attestation" -> attestation, url or agent
//   min "url"         -> url
//   min "agent"       -> agent
//
// Read exact equality before this existed, which made `welcome-email` (min_evidence: attestation,
// the one kind with no addressable trace at all) impossible to satisfy: the only confirm path
// writes `url`, `url !== "attestation"`, and it blocked checkpoint 2 forever.
export function evidenceMeetsMinimum(
  type: "url" | "agent" | "attestation",
  minimum: ArtifactKindRule["min_evidence"],
): boolean {
  if (!minimum) return true;
  if (type === minimum) return true;
  return minimum === "attestation";
}

// checkpoint-1 style: N of any required-checkpoint_id artifact (required_artifact_count).
// checkpoint-2/checkpoint-3 style: exactly one live artifact per named kind (required_artifact_kinds).
// A checkpoint rule uses exactly one of the two count shapes, never both.
export interface CheckpointRule {
  required_artifact_count?: number;
  required_artifact_kinds?: string[];
  require_all_live: boolean;
  require_pace_recorded?: boolean;
  // checkpoint-3 only (rules.md §7.10 / venture-schema-contract.md §5.3): the decision_kinds that
  // must be `selected` before this checkpoint clears, alongside required_artifact_kinds' artifacts
  // being approved+live. Read by state.ts's checkpointArtifactState (Work Package 3) -- a required
  // decision kind with no `selected` DecisionRecord for the slug blocks the checkpoint exactly like
  // a missing required artifact kind does.
  required_decision_kinds?: DecisionKind[];
  // checkpoint-1 only today (rules.yaml). "This checkpoint requires controlled collection": an
  // artifact whose evidence is derived `historical_prior` -- it points at something that went
  // public BEFORE this venture kicked off -- does not count toward it (venture/rules.md §5.6,
  // venture-schema-contract.md §5.4b, v5 handoff §9.6). Checkpoint 1 is the gate that is supposed
  // to prove three posts were freshly drafted, approved and confirmed live THROUGH this venture,
  // so a pre-venture win clearing it would make the gate mean nothing. Checkpoints that don't
  // declare it are unaffected -- checkpoint-2's attestation-backed kinds in particular.
  require_current_evidence?: boolean;
  // Overrides the ledger event id this checkpoint clears/reads as, from the default
  // `<slug>/<checkpointId>` (checkpoint-1, checkpoint-2) to `<slug>/<ledger_event_id>`. Only
  // checkpoint-3 sets this (venture-schema-contract.md §5.3 names the real event
  // `<slug>/phase-3-completed`, distinct from the generic `<slug>/checkpoint-<n>` pattern the other
  // two checkpoints use) -- resolves the open question WP0 left in this field's earlier comment.
  ledger_event_id?: string;
}

// Phase 4 ends in the Day 14 review, a human decision, not a fourth checkpoint (rules.md §8.5/§8.6,
// venture-schema-contract.md §5.3: "There is no checkpoint-4"). This is a deliberately DIFFERENT
// type from CheckpointRule, not a fourth entry under `checkpoints` -- so it can never be passed into
// checkpoint.ts's clearCheckpoint(), which only knows rules.checkpoints keys and the
// checkpoint-1/checkpoint-2/checkpoint-3 ledger-event shape. Phase 4 completion is read, never
// "cleared" the way a checkpoint is.
export interface Phase4CompletionRule {
  required_artifact_kinds: ArtifactKind[];
  required_decision_kinds: DecisionKind[];
  ledger_event_id: string;
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
  // Phases 1-3 each carry one static CTA value. Phase 4 does not (rules.md §1A.1's table): the CTA
  // is "the relevant lead magnet, an approved offer, a project, or no CTA, chosen by the item's
  // actual purpose" -- a SET of allowed values, not one default. cta_policy_by_phase["4"] is
  // therefore the array of allowed values; a later work package's phase4.ts picks one per item.
  cta_policy_by_phase: Record<string, string | string[]>;
  phase_1_pace: { recommended_posts_per_week: number };
  checkpoints: Record<string, CheckpointRule>;
  // Phase 4 ends with the Day 14 review's human decision, not a checkpoint -- kept as a sibling of
  // `checkpoints`, never a key inside it. See Phase4CompletionRule's comment.
  phase4_completion: Phase4CompletionRule;
  lead_magnet_concept: {
    concept_count: number;
    factors: string[];
    score_scale: { min: number; max: number };
    select_count: number;
  };
  research_continuation: {
    candidates: string[];
  };
  research_read: {
    required_sources: string[];
    signal_quality_factors: string[];
  };
  // rules.md §7.3 -- the response gate's eligible-unique-respondent thresholds. Read-model shape
  // (`response_gate: { state, have, need, target, opened_at }`, venture-schema-contract.md §5.1)
  // and the ledger event that fires at `min_eligible_unique` are Work Package 1's job; this is only
  // the static threshold data.
  response_gate: {
    min_eligible_unique: number;
    target_eligible_unique: number;
  };
  // rules.md §7.6 -- the six-factor problem score, each 1-5. Matches a `problem-selection`
  // decision's kind-specific `candidates[].scores` shape (venture-schema-contract.md §2A).
  problem_score: {
    factors: string[];
    score_scale: { min: number; max: number };
  };
  // rules.md §7.8 -- the product outline's section-count bounds.
  product_outline: {
    min_sections: number;
    max_sections: number;
  };
  // rules.md §7.5 -- "three to five clusters, not a long list of micro-categories."
  cluster_analysis: {
    min_clusters: number;
    max_clusters: number;
  };
  // rules.md §7.7 -- the vague verbs rules.md names as banned from the transformation sentence's
  // (and, by the same "user-facing copy" standard, the price pitch's) user-facing copy. rules.md's
  // own list is illustrative ("such as"), not closed -- these three are the only ones its prose
  // actually names, so they're the only ones a mechanical substring check can cite back to it.
  transformation: {
    banned_verbs: string[];
  };
  // rules.md §8.1 -- the PDF's canonical five-job daily routine, and the four recorded-choice
  // modes offered when the intake time budget doesn't fit it.
  daily_operating_plan: {
    canonical_jobs: { label: string; minutes: number }[];
    canonical_total_minutes: number;
    modes: string[];
  };
  // rules.md §8.5 -- the Day 14 review's final decision. Candidates match
  // src/venture/intake.ts's SCORECARD_FIXED.final_decision_options exactly (parity-tested in
  // rules.test.ts); the system never recommends one (rules.md: "Muxin makes one final decision").
  day_14_decision: {
    candidates: string[];
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

// venture/rules.yaml can change between when a venture was kicked off and when a later phase
// script runs against it. Called at the top of every venture CLI's dispatch -- refuses rather
// than silently applying a revised rubric to an in-flight venture. No-ops before kickoff exists
// (the command's own not-found error is the right one to surface there).
export function requireRulesVersionMatch(slug: string, rules: VentureRules): void {
  const kickoff = findCanonEvent(slug, `${slug}/kickoff`);
  if (!kickoff?.fields.rules_version) return;
  assertRulesVersion(kickoff.fields.rules_version, rules);
}

export function artifactKindRule(rules: VentureRules, kind: ArtifactKind): ArtifactKindRule {
  const rule = rules.artifact_kinds[kind];
  if (!rule) {
    throw new Error(`no artifact_kinds entry for "${kind}" in venture/rules.yaml`);
  }
  return rule;
}
