import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import {
  createArtifact,
  updateArtifactFields,
  updateResearchReadFinding,
  readArtifact,
  type ClaimRef,
} from "./artifacts.js";
import { writeDecision, selectDecision, selectWithOverride, readDecision, type Candidate } from "./decisions.js";
import { phase1Dir } from "./paths.js";
import { hasCanonEvent } from "./canon.js";
import {
  fail,
  now,
  cmdApprove,
  cmdDiscard,
  cmdRestore,
  cmdList,
  readStdin,
  flag,
  positionalArgs,
  checkNoEmDash,
  warnIfNoClaimRefs,
} from "./artifact-lifecycle.js";

// Phase 1 script: scaffolding and gate checks only. Idea generation, ranking, and post drafting
// are Claude's own judgment work, done inline while running .claude/skills/venture/SKILL.md --
// this script never calls an LLM itself. It reads Claude's output on stdin, validates it
// mechanically, and refuses to persist anything that skips a gate.
//
// usage: tsx src/venture/phase1.ts <subcommand> <slug> [...args] [--stdin]
//
// readStdin/flag/positionalArgs are shared with phase2.ts -- see artifact-lifecycle.ts.

// --- plan-init: writes the phase_1_research_plan artifact ------------------------------------

interface PlanInitInput {
  confirmed_knowns: { claim: string; evidence_refs: string[]; confirmed_by_muxin: boolean }[];
  open_unknowns: { unknown_id: string; dimension: string; description: string; priority?: number }[];
  probes: { unknown_id: string; hypothesis: string; conversation_question: string; expected_evidence: string }[];
}

function cmdPlanInit(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as PlanInitInput;

  const validDimensions = new Set(rules.research_plan.unknown_dimensions);
  for (const u of input.open_unknowns) {
    if (!validDimensions.has(u.dimension)) {
      fail(`open_unknowns entry "${u.unknown_id}" has an invalid dimension "${u.dimension}" (valid: ${[...validDimensions].join(", ")})`);
    }
  }
  for (const c of input.confirmed_knowns) {
    if (rules.research_plan.require_confirmed_by_muxin && (!c.evidence_refs?.length || c.confirmed_by_muxin !== true)) {
      fail(
        `confirmed_knowns entry "${c.claim}" needs non-empty evidence_refs AND confirmed_by_muxin set true -- ` +
          `an AI-asserted "already known" with no citation and no confirmation does not count`
      );
    }
  }
  const unknownIds = new Set(input.open_unknowns.map((u) => u.unknown_id));
  for (const p of input.probes) {
    if (!unknownIds.has(p.unknown_id)) {
      fail(`probe references unknown_id "${p.unknown_id}" which isn't in open_unknowns`);
    }
  }

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p1-research-plan",
    phase: 1,
    artifact_kind: "phase_1_research_plan",
    title: "Phase 1 research plan",
    venture_id: slug,
    venture_phase: 1,
    message_id: "p1-research-plan",
    fields: { ...input, plan_version: 1, reviewed_by_muxin: false },
    at: now(),
  });
  console.log(`wrote ${artifact.artifact_id} -- STOP: show Muxin this plan before drafting any idea`);
  console.log(`review with: tsx src/venture/phase1.ts plan-review ${slug}`);
}

// --- plan-review: Muxin's explicit gate ---------------------------------------------------------

function cmdPlanReview(slug: string) {
  const updated = updateArtifactFields(slug, "p1-research-plan", { reviewed_by_muxin: true, reviewed_at: now() }, now());
  console.log(`p1-research-plan reviewed_by_muxin=${updated.fields?.reviewed_by_muxin}`);
}

function requirePlanReviewed(slug: string): void {
  const plan = readArtifact(slug, "p1-research-plan");
  if (!plan || plan.fields?.reviewed_by_muxin !== true) {
    fail(
      `refusing: p1-research-plan is not reviewed_by_muxin. Run "plan-review" (Muxin's explicit ` +
        `act) before drafting any idea. This gate exists precisely so a system-drafted plan can't ` +
        `authorize itself.`
    );
  }
}

// --- platform: the platform-recommendation decision ---------------------------------------------

interface DecisionInitInput {
  input_refs: string[];
  candidates: Candidate[];
  recommended_candidate_ids: string[];
}

function cmdPlatform(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as DecisionInitInput;
  if (input.candidates.length < 2) fail(`platform-recommendation needs meaningful alternatives, not just one candidate`);
  const d = writeDecision(slug, {
    decision_id: "p1-platform-01",
    decision_kind: "platform-recommendation",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} -- awaiting Muxin's platform selection`);
}

function cmdPlatformSelect(slug: string, candidateId: string) {
  const overrideReason = flag("--override-reason");
  const d = selectWithOverride(slug, "p1-platform-01", candidateId, overrideReason, {
    requiredSelectCount: 1,
    ruleCite: "rules.md §5.1",
    candidateLabel: "platform",
  });
  console.log(`platform selected: ${d.selected_candidate_ids[0]}`);
}

function requirePlatformSelected(slug: string): void {
  const d = readDecision(slug, "p1-platform-01");
  if (!d || d.status !== "selected") {
    fail(`refusing: platform-recommendation is not selected. Run "platform-select" first.`);
  }
}

// --- ideas: the ten-idea decision ----------------------------------------------------------------

function cmdIdeas(slug: string) {
  requirePlatformSelected(slug);
  requirePlanReviewed(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as DecisionInitInput;
  if (input.candidates.length !== rules.idea_ranking.idea_count) {
    fail(`expected exactly ${rules.idea_ranking.idea_count} idea candidates, got ${input.candidates.length}`);
  }
  for (const c of input.candidates) {
    for (const f of rules.idea_ranking.factors) {
      if (typeof c.scores[f] !== "number") fail(`candidate "${c.candidate_id}" is missing a score for factor "${f}"`);
    }
    if (!c.unknown_id) fail(`candidate "${c.candidate_id}" must name the unknown_id it probes`);
  }
  const d = writeDecision(slug, {
    decision_id: "p1-ideas-01",
    decision_kind: "idea-ranking",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} (${d.candidates.length} ideas) -- STOP: show Muxin the ranked ideas`);
}

function cmdSelect(slug: string, candidateIds: string[]) {
  const rules = loadRules();
  const rationale = flag("--rationale");
  const d = selectDecision(slug, "p1-ideas-01", {
    selectedCandidateIds: candidateIds,
    selectedBy: "muxin",
    requiredSelectCount: rules.idea_ranking.select_count,
    rationale,
    at: now(),
  });
  console.log(`selected: ${d.selected_candidate_ids.join(", ")}`);
}

// --- draft: one post at a time --------------------------------------------------------------------

interface DraftInput {
  title: string;
  body: string; // already in body -> cta/reply-bridge -> hook order per rules §3.1
  claim_refs: ClaimRef[];
  no_cta_reason?: string;
}

function cmdDraft(slug: string, candidateId: string) {
  const kind = flag("--kind");
  if (kind !== "substack-post" && kind !== "text-post-note") {
    fail(`--kind must be substack-post or text-post-note`);
  }
  const rules = loadRules();
  const ideas = readDecision(slug, "p1-ideas-01");
  if (!ideas || ideas.status !== "selected") fail(`refusing: p1-ideas-01 is not selected yet`);
  if (!ideas.selected_candidate_ids.includes(candidateId)) {
    fail(`refusing: "${candidateId}" was not one of the three Muxin selected (${ideas.selected_candidate_ids.join(", ")})`);
  }
  const candidate = ideas.candidates.find((c) => c.candidate_id === candidateId)!;

  const input = JSON.parse(readStdin()) as DraftInput;
  const wordCount = input.body.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > rules.draft.post_max_words) {
    fail(`draft is ${wordCount} words, over the ${rules.draft.post_max_words}-word Phase 1 cap`);
  }
  checkNoEmDash({ body: input.body });
  const hasReplyPrompt = /\?[\s]*$/.test(input.body.trim());
  if (rules.draft.require_reply_prompt && !hasReplyPrompt && !input.no_cta_reason) {
    fail(
      `draft doesn't end with a reply prompt/question, and no no_cta_reason was recorded -- ` +
        `every required Phase 1 post carries a reply prompt unless "no CTA" is a deliberate, recorded exception`
    );
  }
  warnIfNoClaimRefs(rules, input.claim_refs);

  mkdirSync(phase1Dir(slug), { recursive: true });
  const bodyPath = `phase-1-attention/${candidateId}.md`;
  writeFileSync(`${phase1Dir(slug)}/${candidateId}.md`, input.body.trim() + "\n");

  const artifact = createArtifact(slug, rules, {
    artifact_id: candidateId,
    phase: 1,
    artifact_kind: kind,
    title: input.title,
    body_path: bodyPath,
    checkpoint_id: "checkpoint-1",
    venture_id: slug,
    venture_phase: 1,
    message_id: `msg-${candidateId}`,
    probe_id: candidateId,
    unknown_id: candidate.unknown_id ?? null,
    claim_refs: input.claim_refs,
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (${kind}, ${wordCount} words) -- awaiting Muxin's approval`);
}

// --- approve / discard / restore / list -------------------------------------------------------
// Extracted to artifact-lifecycle.ts (imported above) so phase2.ts can reuse the exact same
// editorial-state-machine logic without duplicating it. See dispatch() below for the call sites.

// --- research-read-init: writes the phase_1_research_read artifact (rules.md §5.6) -------------
//
// Note on shape: this command's stdin payload uses `signal_quality_rationale` as an ARRAY of
// { factor, status, evidence_refs } entries, not the object-keyed-by-factor-name shape shown in
// docs/venture-schema-contract.md §2C.4's illustrative JSON. Both express the same information;
// the array shape is what's validated and persisted here. A future normalization pass (or
// phase2.ts) can reshape it if the object-keyed form is needed elsewhere.

interface CollectionCoverageInput {
  source: string;
  status: "complete" | "partial" | "unavailable" | "not_checked";
  gap_reason?: string;
}

interface SignalQualityFactorInput {
  factor: string;
  status: "present" | "absent" | "unknown";
  evidence_refs: string[];
}

interface ResearchReadFindingInput {
  finding_id: string;
  finding_origin: "planned" | "emergent";
  unknown_ids: string[];
  emergent_description?: string;
  evidence_refs: string[];
  signal_quality_rationale: SignalQualityFactorInput[];
  lead_magnet_implications?: string;
  muxin_confirmed_emergent?: boolean | null; // always forced null on write, see below
  signal_quality?: "thin" | "moderate" | "strong"; // ignored on input, always computed on write, see below
}

interface ResearchReadInitInput {
  collection_coverage: CollectionCoverageInput[];
  findings: ResearchReadFindingInput[];
}

// venture-schema-contract.md §2C.4's "Recommended default threshold" -- PROPOSED, not yet
// Muxin-confirmed as a hard rule (same status the doc gives the old Checkpoint-2 predicate and
// survey-path proposals before she confirmed those separately). Implemented here as the schema's
// own recommended default so `signal_quality` is at least computed the same way every time,
// instead of being left for Claude to self-report -- but flag this threshold to Muxin for
// sign-off; a build package should surface it prominently, not bury it as a settled rule.
export function computeSignalQuality(rationale: SignalQualityFactorInput[]): "thin" | "moderate" | "strong" {
  const audienceFit = rationale.find((r) => r.factor === "audience_fit")?.status;
  const otherPresentCount = rationale.filter((r) => r.factor !== "audience_fit" && r.status === "present").length;
  if (audienceFit === "present" && otherPresentCount >= 3) return "strong";
  if ((audienceFit === "present" || audienceFit === "unknown") && otherPresentCount >= 1 && otherPresentCount <= 2) {
    return "moderate";
  }
  return "thin";
}

function requireCheckpoint1Cleared(slug: string): void {
  if (!hasCanonEvent(slug, `${slug}/checkpoint-1`)) {
    fail(
      `refusing: checkpoint-1 has not cleared for "${slug}" -- the research read can't run until all ` +
        `three required Phase 1 posts are approved, confirmed live, and pace is recorded (rules.md §5.5)`
    );
  }
}

function cmdResearchReadInit(slug: string) {
  requireCheckpoint1Cleared(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as ResearchReadInitInput;

  const coverageBySource = new Map(input.collection_coverage.map((c) => [c.source, c]));
  for (const source of rules.research_read.required_sources) {
    const entry = coverageBySource.get(source);
    if (!entry) fail(`collection_coverage is missing required source "${source}" (rules.md §5.6)`);
    if (entry.status !== "complete" && !entry.gap_reason?.trim()) {
      fail(
        `collection_coverage source "${source}" has status "${entry.status}" but no gap_reason -- a ` +
          `non-complete status must say why (venture-schema-contract.md §2C.3)`
      );
    }
  }

  // Active plan, to validate a `planned` finding's unknown_ids actually exist.
  const plan = readArtifact(slug, "p1-research-plan");
  const openUnknownIds = new Set(
    ((plan?.fields?.open_unknowns as { unknown_id: string }[] | undefined) ?? []).map((u) => u.unknown_id)
  );

  const seenFindingIds = new Set<string>();
  for (const f of input.findings) {
    if (seenFindingIds.has(f.finding_id)) fail(`duplicate finding_id "${f.finding_id}"`);
    seenFindingIds.add(f.finding_id);

    if (f.finding_origin !== "planned" && f.finding_origin !== "emergent") {
      fail(`finding "${f.finding_id}" has an invalid finding_origin "${f.finding_origin}" (must be "planned" or "emergent")`);
    }
    if (f.finding_origin === "planned") {
      if (!f.unknown_ids?.length) fail(`planned finding "${f.finding_id}" must name at least one unknown_id`);
      for (const uid of f.unknown_ids) {
        if (!openUnknownIds.has(uid)) {
          fail(
            `finding "${f.finding_id}" references unknown_id "${uid}" which isn't in the active ` +
              `phase_1_research_plan's open_unknowns`
          );
        }
      }
    }
    if (f.finding_origin === "emergent" && !f.unknown_ids?.length && !f.emergent_description?.trim()) {
      fail(
        `emergent finding "${f.finding_id}" has no unknown_ids and no emergent_description -- an emergent ` +
          `finding must describe what was found (venture-schema-contract.md §2C.3)`
      );
    }

    const scoredFactors = new Set((f.signal_quality_rationale ?? []).map((r) => r.factor));
    for (const factor of rules.research_read.signal_quality_factors) {
      if (!scoredFactors.has(factor)) {
        fail(
          `finding "${f.finding_id}" is missing a signal_quality_rationale entry for factor "${factor}" ` +
            `(venture-schema-contract.md §2C.4)`
        );
      }
    }
    for (const r of f.signal_quality_rationale ?? []) {
      if (r.status !== "present" && r.status !== "absent" && r.status !== "unknown") {
        fail(`finding "${f.finding_id}" factor "${r.factor}" has invalid status "${r.status}"`);
      }
      if (r.status !== "unknown" && !r.evidence_refs?.length) {
        fail(
          `finding "${f.finding_id}" factor "${r.factor}" is "${r.status}" but has no evidence_refs -- only ` +
            `"unknown" may cite nothing (venture-schema-contract.md §2C.4)`
        );
      }
    }
  }

  // Never trust caller-supplied true/false for a Muxin-only field -- forced null regardless of
  // what the input JSON says, same discipline as plan-init's confirmed_by_muxin. signal_quality is
  // likewise never trusted from the input (if present at all) -- always recomputed from the
  // rationale that was just validated above, so the label can never drift from its own evidence.
  const findings = input.findings.map((f) => ({
    ...f,
    muxin_confirmed_emergent: null,
    signal_quality: computeSignalQuality(f.signal_quality_rationale),
  }));

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p1-research-read",
    phase: 1,
    artifact_kind: "phase_1_research_read",
    title: "Phase 1 research read",
    venture_id: slug,
    venture_phase: 1,
    message_id: "p1-research-read",
    fields: { collection_coverage: input.collection_coverage, findings, reviewed_by_muxin: false, reviewed_at: null },
    at: now(),
  });
  console.log(`wrote ${artifact.artifact_id} -- STOP: show Muxin this read before selecting a continuation`);
  console.log(`review with: tsx src/venture/phase1.ts research-read-review ${slug}`);
}

// --- research-read-confirm-emergent: the ONLY caller of updateResearchReadFinding ----------------

function cmdResearchReadConfirmEmergent(slug: string, findingId: string, confirmedRaw: string) {
  if (confirmedRaw !== "true" && confirmedRaw !== "false") {
    fail(`usage: research-read-confirm-emergent <slug> <finding_id> <true|false>`);
  }
  updateResearchReadFinding(slug, "p1-research-read", findingId, confirmedRaw === "true", now());
  console.log(`finding ${findingId} muxin_confirmed_emergent=${confirmedRaw}`);
}

// --- research-read-review: Muxin's explicit gate --------------------------------------------------

// An emergent finding needs Muxin's explicit yes/no before it can shape Phase 2 (rules.md §5.6) --
// refuses the whole-read review if any emergent finding is still sitting at its written-time null.
// `planned` findings never carry this field's obligation; only "emergent" is checked.
function requireEmergentFindingsConfirmed(slug: string): void {
  const read = readArtifact(slug, "p1-research-read");
  const findings = (read?.fields?.findings as
    | { finding_id: string; finding_origin: string; muxin_confirmed_emergent?: boolean | null }[]
    | undefined) ?? [];
  const unconfirmed = findings
    .filter((f) => f.finding_origin === "emergent" && f.muxin_confirmed_emergent === null)
    .map((f) => f.finding_id);
  if (unconfirmed.length) {
    fail(
      `refusing: research-read-review requires every emergent finding to be confirmed first -- ` +
        `unconfirmed finding_id(s): ${unconfirmed.join(", ")}. Run "research-read-confirm-emergent" ` +
        `for each (rules.md §5.6)`
    );
  }
}

function cmdResearchReadReview(slug: string) {
  requireEmergentFindingsConfirmed(slug);
  const updated = updateArtifactFields(slug, "p1-research-read", { reviewed_by_muxin: true, reviewed_at: now() }, now());
  console.log(`p1-research-read reviewed_by_muxin=${updated.fields?.reviewed_by_muxin}`);
}

function requireResearchReadReviewed(slug: string): void {
  const read = readArtifact(slug, "p1-research-read");
  if (!read || read.fields?.reviewed_by_muxin !== true) {
    fail(
      `refusing: p1-research-read is not reviewed_by_muxin. Run "research-read-review" (Muxin's explicit ` +
        `act) before selecting a continuation.`
    );
  }
}

// --- continuation: the phase-1-research-continuation decision (rules.md §5.6) --------------------

function cmdContinuation(slug: string) {
  requireResearchReadReviewed(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as DecisionInitInput;

  const expected = new Set(rules.research_continuation.candidates);
  const gotIds = input.candidates.map((c) => c.candidate_id);
  const got = new Set(gotIds);
  if (got.size !== gotIds.length) fail(`continuation candidates contain a duplicate candidate_id`);
  if (got.size !== expected.size || [...expected].some((id) => !got.has(id))) {
    fail(
      `continuation candidates must be exactly {${[...expected].join(", ")}}, got {${gotIds.join(", ")}} (rules.md §5.6)`
    );
  }
  if (!input.input_refs.includes("p1-research-plan") || !input.input_refs.includes("p1-research-read")) {
    fail(`continuation input_refs must include both "p1-research-plan" and "p1-research-read"`);
  }

  const d = writeDecision(slug, {
    decision_id: "p1-continuation-01",
    decision_kind: "phase-1-research-continuation",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} -- STOP: Muxin selects more_probes, proceed_with_evidence, or proceed_as_hypothesis`);
}

function cmdContinuationSelect(slug: string, candidateId: string) {
  const overrideReason = flag("--override-reason");
  const d = selectWithOverride(slug, "p1-continuation-01", candidateId, overrideReason, {
    requiredSelectCount: 1,
    ruleCite: "rules.md §5.6",
    candidateLabel: "continuation candidate",
    overridePhrase: "overriding requires",
  });
  console.log(`continuation selected: ${d.selected_candidate_ids[0]}`);
}

// Exported for phase2.ts (next work package) to call before any Phase 2 concept generation.
// Refuses via fail() (process.exit(1)) exactly like every other gate in this file -- see the
// "check-phase2-unlock" CLI smoke command below for how this is exercised as a subprocess test.
export function requirePhase2Unlocked(slug: string): void {
  const d = readDecision(slug, "p1-continuation-01");
  if (!d || d.status !== "selected") {
    fail(
      `refusing: phase-1-research-continuation is not selected yet -- Phase 2 concept generation cannot ` +
        `begin until Muxin selects proceed_with_evidence or proceed_as_hypothesis (rules.md §5.6)`
    );
  }
  const selected = d.selected_candidate_ids[0];
  if (selected === "more_probes") {
    fail(
      `refusing: phase-1-research-continuation selected "more_probes" -- this routes the venture back ` +
        `into more Phase 1 idea generation instead of unlocking Phase 2 (rules.md §5.6)`
    );
  }
  if (selected !== "proceed_with_evidence" && selected !== "proceed_as_hypothesis") {
    fail(`refusing: unrecognized phase-1-research-continuation candidate "${selected}"`);
  }
}

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) {
    fail(
      `usage: tsx src/venture/phase1.ts <plan-init|plan-review|platform|platform-select|ideas|select|draft|` +
        `approve|discard|restore|list|research-read-init|research-read-confirm-emergent|research-read-review|` +
        `continuation|continuation-select|check-phase2-unlock> <slug> [...args]`
    );
  }
  requireRulesVersionMatch(slug, loadRules());
  switch (sub) {
    case "plan-init":
      return cmdPlanInit(slug);
    case "plan-review":
      return cmdPlanReview(slug);
    case "platform":
      return cmdPlatform(slug);
    case "platform-select":
      return cmdPlatformSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "ideas":
      return cmdIdeas(slug);
    case "select":
      return cmdSelect(slug, positionalArgs(rest, "--rationale"));
    case "draft":
      return cmdDraft(slug, positionalArgs(rest, "--kind")[0]);
    case "approve":
      return cmdApprove(slug, positionalArgs(rest)[0]);
    case "discard":
      return void cmdDiscard(slug, positionalArgs(rest)[0]);
    case "restore":
      return void cmdRestore(slug, positionalArgs(rest)[0]);
    case "list":
      return cmdList(slug);
    case "research-read-init":
      return cmdResearchReadInit(slug);
    case "research-read-confirm-emergent": {
      const [findingId, confirmed] = positionalArgs(rest);
      return cmdResearchReadConfirmEmergent(slug, findingId, confirmed);
    }
    case "research-read-review":
      return cmdResearchReadReview(slug);
    case "continuation":
      return cmdContinuation(slug);
    case "continuation-select":
      return cmdContinuationSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "check-phase2-unlock":
      requirePhase2Unlocked(slug);
      return void console.log(`phase 2 unlocked for ${slug}`);
    default:
      fail(`unknown subcommand: ${sub}`);
  }
}

// Every gate refusal in this file throws a plain Error -- caught here and printed as a clean
// one-line message via fail(), never an uncaught stack trace dump.
export function main() {
  try {
    dispatch();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
