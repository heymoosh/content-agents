import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules } from "./rules.js";
import {
  createArtifact,
  transitionArtifact,
  updateArtifactFields,
  readArtifact,
  readArtifacts,
  type ClaimRef,
} from "./artifacts.js";
import { writeDecision, selectDecision, readDecision, type Candidate } from "./decisions.js";
import { phase1Dir } from "./paths.js";

// Phase 1 script: scaffolding and gate checks only. Idea generation, ranking, and post drafting
// are Claude's own judgment work, done inline while running .claude/skills/venture/SKILL.md --
// this script never calls an LLM itself. It reads Claude's output on stdin, validates it
// mechanically, and refuses to persist anything that skips a gate.
//
// usage: tsx src/venture/phase1.ts <subcommand> <slug> [...args] [--stdin]

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Strips each named flag AND its following value out of a positional-args array -- naively
// filtering out only strings starting with "--" leaves a multi-word flag VALUE (e.g.
// `--rationale "several words"`, which argv splits into separate entries) sitting in the
// positional list. Caught this the hard way running the real CLI by hand before writing tests.
function positionalArgs(rest: string[], ...knownFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (knownFlags.includes(rest[i])) {
      i++; // skip the flag's value too
      continue;
    }
    out.push(rest[i]);
  }
  return out;
}

function now(): string {
  return new Date().toISOString();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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
  const d = selectDecision(slug, "p1-platform-01", {
    selectedCandidateIds: [candidateId],
    selectedBy: "muxin",
    requiredSelectCount: 1,
    at: now(),
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
  if (input.body.includes("—")) fail(`draft contains an em dash -- config/voice.yaml bans them, no exceptions`);
  const hasReplyPrompt = /\?[\s]*$/.test(input.body.trim());
  if (rules.draft.require_reply_prompt && !hasReplyPrompt && !input.no_cta_reason) {
    fail(
      `draft doesn't end with a reply prompt/question, and no no_cta_reason was recorded -- ` +
        `every required Phase 1 post carries a reply prompt unless "no CTA" is a deliberate, recorded exception`
    );
  }
  if (rules.draft.require_claim_refs && input.claim_refs.length === 0) {
    console.warn(
      `warning: no claim_refs on this draft -- if it makes ANY concrete factual claim, that claim ` +
        `needs a ref to intake:qN or a confirmed_known, or it must be cut/reframed as a hypothesis`
    );
  }

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

// --- approve / discard / restore ------------------------------------------------------------------

function cmdApprove(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId);
  if (!a) fail(`no such artifact: ${artifactId}`);
  const next = transitionArtifact(slug, artifactId, { editorial_status: "approved", delivery_status: "ready" }, now());
  console.log(`${artifactId} approved -- ready for delivery (${next.delivery_mode})`);
}

function cmdDiscard(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId)!;
  const delivery = a.delivery_status === "not_applicable" ? "not_applicable" : "cancelled";
  const next = transitionArtifact(slug, artifactId, { editorial_status: "discarded", delivery_status: delivery }, now());
  console.log(`${artifactId} discarded`);
  return next;
}

function cmdRestore(slug: string, artifactId: string) {
  const a = readArtifact(slug, artifactId)!;
  const delivery = a.delivery_mode === "none" ? "not_applicable" : "awaiting_approval";
  const next = transitionArtifact(slug, artifactId, { editorial_status: "draft", delivery_status: delivery }, now());
  console.log(`${artifactId} restored to draft`);
  return next;
}

function cmdList(slug: string) {
  for (const a of readArtifacts(slug)) {
    console.log(`${a.artifact_id}  ${a.artifact_kind}  ${a.editorial_status}/${a.delivery_status}  "${a.title}"`);
  }
}

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) fail(`usage: tsx src/venture/phase1.ts <plan-init|plan-review|platform|platform-select|ideas|select|draft|approve|discard|restore|list> <slug> [...args]`);
  switch (sub) {
    case "plan-init":
      return cmdPlanInit(slug);
    case "plan-review":
      return cmdPlanReview(slug);
    case "platform":
      return cmdPlatform(slug);
    case "platform-select":
      return cmdPlatformSelect(slug, positionalArgs(rest)[0]);
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
