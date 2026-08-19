import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import { createArtifact, readArtifact, updateArtifactFields, type ClaimRef } from "./artifacts.js";
import { writeDecision, selectDecision, readDecision, type Candidate, type DecisionRecord } from "./decisions.js";
import { phase2Dir } from "./paths.js";
import { requirePhase2Unlocked } from "./phase1.js";
import { fail, now, cmdApprove, cmdDiscard, cmdRestore, cmdList } from "./artifact-lifecycle.js";

// Phase 2 script: scaffolding and gate checks only, same discipline as phase1.ts. Concept
// generation, copy drafting, and the survey fit review are Claude's own judgment work, done
// inline while running .claude/skills/venture/SKILL.md -- this script never calls an LLM itself.
// It reads Claude's output on stdin, validates it mechanically, and refuses to persist anything
// that skips a gate.
//
// usage: tsx src/venture/phase2.ts <subcommand> <slug> [...args] [--stdin]

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Strips each named flag AND its following value out of a positional-args array -- see phase1.ts
// for why the naive "just filter out strings starting with --" approach breaks on a multi-word
// flag value.
function positionalArgs(rest: string[], ...knownFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (knownFlags.includes(rest[i])) {
      i++;
      continue;
    }
    out.push(rest[i]);
  }
  return out;
}

// --- small shared validators -------------------------------------------------------------------

function requireNonEmpty(fields: Record<string, string | undefined | null>): void {
  const missing = Object.entries(fields)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => k);
  if (missing.length) fail(`missing required field(s): ${missing.join(", ")}`);
}

function checkNoEmDash(fields: Record<string, string | string[] | undefined>): void {
  for (const [key, val] of Object.entries(fields)) {
    if (!val) continue;
    const text = Array.isArray(val) ? val.join(" ") : val;
    if (text.includes("—")) fail(`draft field "${key}" contains an em dash -- config/voice.yaml bans them, no exceptions`);
  }
}

function warnIfNoClaimRefs(rules: ReturnType<typeof loadRules>, claimRefs: ClaimRef[] | undefined): void {
  if (rules.draft.require_claim_refs && (claimRefs?.length ?? 0) === 0) {
    console.warn(
      `warning: no claim_refs on this draft -- if it makes ANY concrete factual claim, that claim ` +
        `needs a ref to intake:qN or a confirmed_known, or it must be cut/reframed as a hypothesis`
    );
  }
}

// --- concepts: the five-lead-magnet-concept decision (rules.md §6.2) ----------------------------

interface ConceptCandidateInput {
  candidate_id: string;
  label: string;
  scores: Record<string, number>;
  evidence_refs: string[];
  rationale: string;
  // Either signal works; validated for consistency below. thin_evidence is the input-side flag
  // Claude sets when a concept rests on a thin phase_1_research_read finding; label_as_hypothesis
  // is the Candidate field (decisions.ts) that actually persists onto the written record.
  thin_evidence?: boolean;
  label_as_hypothesis?: boolean;
}

interface ConceptsInput {
  input_refs: string[];
  candidates: ConceptCandidateInput[];
  recommended_candidate_ids: string[];
}

function cmdConcepts(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as ConceptsInput;

  if (input.candidates.length !== rules.lead_magnet_concept.concept_count) {
    fail(`expected exactly ${rules.lead_magnet_concept.concept_count} concept candidates, got ${input.candidates.length}`);
  }
  for (const c of input.candidates) {
    for (const f of rules.lead_magnet_concept.factors) {
      const score = c.scores?.[f];
      if (typeof score !== "number") fail(`candidate "${c.candidate_id}" is missing a score for factor "${f}"`);
      if (score < rules.lead_magnet_concept.score_scale.min || score > rules.lead_magnet_concept.score_scale.max) {
        fail(
          `candidate "${c.candidate_id}" factor "${f}" score ${score} is outside the ` +
            `${rules.lead_magnet_concept.score_scale.min}-${rules.lead_magnet_concept.score_scale.max} scale`
        );
      }
    }
    if (c.thin_evidence === true && c.label_as_hypothesis !== true) {
      fail(
        `candidate "${c.candidate_id}" is marked thin_evidence but is missing label_as_hypothesis: true -- ` +
          `rules.md §6.1 requires a concept resting on thin evidence to be labeled a hypothesis, not ` +
          `presented with the same confidence as a moderate/strong-evidence concept`
      );
    }
  }

  const candidates: Candidate[] = input.candidates.map((c) => ({
    candidate_id: c.candidate_id,
    label: c.label,
    scores: c.scores,
    evidence_refs: c.evidence_refs,
    rationale: c.rationale,
    label_as_hypothesis: c.label_as_hypothesis ?? false,
  }));

  const d = writeDecision(slug, {
    decision_id: "p2-concept-01",
    decision_kind: "lead-magnet-concept",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} (${d.candidates.length} concepts) -- STOP: show Muxin the ranked concepts`);
}

function cmdConceptSelect(slug: string, candidateId: string) {
  const rules = loadRules();
  const overrideReason = flag("--override-reason");
  const current = readDecision(slug, "p2-concept-01");
  const isOverride = !!current && !current.recommended_candidate_ids.includes(candidateId);
  if (isOverride && !overrideReason?.trim()) {
    fail(
      `"${candidateId}" is not the recommended concept (recommended: ${current!.recommended_candidate_ids.join(", ")}) -- ` +
        `overriding the recommendation requires --override-reason "..." so the audit trail records why (rules.md §6.2)`
    );
  }
  const d = selectDecision(slug, "p2-concept-01", {
    selectedCandidateIds: [candidateId],
    selectedBy: "muxin",
    overrideReason: isOverride ? overrideReason : null,
    requiredSelectCount: rules.lead_magnet_concept.select_count,
    at: now(),
  });
  console.log(`concept selected: ${d.selected_candidate_ids[0]}`);
}

function requireConceptSelected(slug: string): DecisionRecord {
  const d = readDecision(slug, "p2-concept-01");
  if (!d || d.status !== "selected") {
    fail(`refusing: lead-magnet-concept is not selected. Run "concept-select" first.`);
  }
  return d;
}

// --- magnet-draft: the lead-magnet artifact (rules.md §6.3) --------------------------------------

interface MagnetDraftInput {
  title: string;
  intro: string;
  sections: string[];
  action_step: string;
  feedback_prompt: string;
  claim_refs: ClaimRef[];
}

function cmdMagnetDraft(slug: string) {
  requireConceptSelected(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as MagnetDraftInput;

  requireNonEmpty({
    title: input.title,
    intro: input.intro,
    action_step: input.action_step,
    feedback_prompt: input.feedback_prompt,
  });
  if (!Array.isArray(input.sections) || input.sections.length === 0 || input.sections.some((s) => !s?.trim())) {
    fail(`sections must be a non-empty array of non-empty strings`);
  }
  checkNoEmDash({
    title: input.title,
    intro: input.intro,
    sections: input.sections,
    action_step: input.action_step,
    feedback_prompt: input.feedback_prompt,
  });
  warnIfNoClaimRefs(rules, input.claim_refs);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-lead-magnet",
    phase: 2,
    artifact_kind: "lead-magnet",
    title: input.title,
    checkpoint_id: "checkpoint-2",
    venture_id: slug,
    venture_phase: 2,
    message_id: "p2-lead-magnet",
    fields: {
      title: input.title,
      intro: input.intro,
      sections: input.sections,
      action_step: input.action_step,
      feedback_prompt: input.feedback_prompt,
    },
    claim_refs: input.claim_refs ?? [],
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (lead-magnet, ${input.sections.length} sections) -- awaiting Muxin's approval`);
}

// --- landing-page-draft: the landing-page-copy artifact (rules.md §6.4) --------------------------

interface LandingPageDraftInput {
  headline: string;
  subheadline?: string;
  benefit_1: string;
  benefit_2: string;
  benefit_3: string;
  button_label: string;
  form_intro?: string;
  thank_you_message?: string;
  privacy_copy?: string;
}

function cmdLandingPageDraft(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as LandingPageDraftInput;

  if (!readArtifact(slug, "p2-lead-magnet")) {
    console.warn(
      `warning: no lead-magnet artifact found yet -- landing page copy normally references the ` +
        `magnet's promise, but drafting it first is not a hard requirement (rules.md §6.4)`
    );
  }

  // The PDF's normative minimum only (rules.md §6.4). form_intro/thank_you_message/privacy_copy
  // are the built capture layer's optional support fields -- never force-filled, never treated as
  // a validation failure when absent (venture-schema-contract.md §2B).
  requireNonEmpty({
    headline: input.headline,
    benefit_1: input.benefit_1,
    benefit_2: input.benefit_2,
    benefit_3: input.benefit_3,
    button_label: input.button_label,
  });
  checkNoEmDash({
    headline: input.headline,
    subheadline: input.subheadline,
    benefit_1: input.benefit_1,
    benefit_2: input.benefit_2,
    benefit_3: input.benefit_3,
    button_label: input.button_label,
    form_intro: input.form_intro,
    thank_you_message: input.thank_you_message,
    privacy_copy: input.privacy_copy,
  });

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-landing-page",
    phase: 2,
    artifact_kind: "landing-page-copy",
    title: input.headline,
    checkpoint_id: "checkpoint-2",
    venture_id: slug,
    venture_phase: 2,
    message_id: "p2-landing-page",
    fields: {
      headline: input.headline,
      subheadline: input.subheadline ?? null,
      benefit_1: input.benefit_1,
      benefit_2: input.benefit_2,
      benefit_3: input.benefit_3,
      button_label: input.button_label,
      form_intro: input.form_intro ?? null,
      thank_you_message: input.thank_you_message ?? null,
      privacy_copy: input.privacy_copy ?? null,
    },
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (landing-page-copy) -- awaiting Muxin's approval`);
}

// --- survey-review / survey-review-approve: the survey fit review (rules.md §6.5, amended) -------

interface FitAssessmentEntry {
  question_number: 1 | 2 | 3 | 4;
  fits_chosen_magnet: boolean;
  note: string;
}

interface SurveyReviewInput {
  existing_survey_snapshot: string;
  fit_assessment: FitAssessmentEntry[];
  recommended_changes: string[];
  change_needed: boolean;
}

function cmdSurveyReview(slug: string) {
  requireConceptSelected(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as SurveyReviewInput;

  if (!input.existing_survey_snapshot?.trim()) fail(`existing_survey_snapshot must be non-empty`);
  if (!Array.isArray(input.fit_assessment) || input.fit_assessment.length !== 4) {
    fail(
      `fit_assessment must have exactly 4 entries, one per question in ` +
        `venture/existing-survey-humaninference.md, got ${input.fit_assessment?.length ?? 0}`
    );
  }
  const seen = new Set<number>();
  for (const entry of input.fit_assessment) {
    if (![1, 2, 3, 4].includes(entry.question_number)) {
      fail(`fit_assessment entry has an invalid question_number "${entry.question_number}" -- must be 1, 2, 3, or 4`);
    }
    if (seen.has(entry.question_number)) {
      fail(`fit_assessment has a duplicate question_number "${entry.question_number}" -- must cover 1-4 exactly once each`);
    }
    seen.add(entry.question_number);
  }
  if (seen.size !== 4) {
    fail(`fit_assessment must cover question_number 1 through 4 exactly once each, got {${[...seen].join(", ")}}`);
  }

  const anyMismatch = input.fit_assessment.some((f) => f.fits_chosen_magnet === false);
  if (anyMismatch) {
    if (!input.recommended_changes?.length) {
      fail(`at least one fit_assessment entry has fits_chosen_magnet: false -- recommended_changes must be non-empty`);
    }
    if (input.change_needed !== true) {
      fail(`at least one fit_assessment entry has fits_chosen_magnet: false -- change_needed must be true`);
    }
  } else if (input.change_needed !== false) {
    fail(`every fit_assessment entry has fits_chosen_magnet: true -- change_needed must be false`);
  }

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-survey-review",
    phase: 2,
    artifact_kind: "survey",
    title: "Survey fit review",
    checkpoint_id: "checkpoint-2",
    venture_id: slug,
    venture_phase: 2,
    message_id: "p2-survey-review",
    fields: {
      existing_survey_snapshot: input.existing_survey_snapshot,
      fit_assessment: input.fit_assessment,
      recommended_changes: input.recommended_changes ?? [],
      change_needed: input.change_needed,
      reviewed_by_muxin: false,
      reviewed_at: null,
    },
    at: now(),
  });
  console.log(`wrote ${artifact.artifact_id} -- STOP: show Muxin this fit review before running survey-review-approve`);
}

// The ONLY setter of the survey artifact's own reviewed_by_muxin -- distinct from
// research-read-review's, which reviews a different artifact (p1-research-read). Deliberately not
// reusing that function; see self-stamp.test.ts for the structural check on this.
function cmdSurveyReviewApprove(slug: string) {
  const updated = updateArtifactFields(slug, "p2-survey-review", { reviewed_by_muxin: true, reviewed_at: now() }, now());
  console.log(`p2-survey-review reviewed_by_muxin=${updated.fields?.reviewed_by_muxin}`);
}

// --- welcome-email-draft: the welcome-email artifact (rules.md §6.6) ------------------------------

interface WelcomeEmailDraftInput {
  subject: string;
  preview_text: string;
  body: string;
  lead_magnet_link_text: string;
  lead_magnet_destination: string;
  survey_question_or_link: string;
  claim_refs: ClaimRef[];
}

function requireMagnetAndSurveyExist(slug: string): void {
  const missing: string[] = [];
  if (!readArtifact(slug, "p2-lead-magnet")) missing.push("lead-magnet");
  const survey = readArtifact(slug, "p2-survey-review");
  if (!survey) missing.push("survey");
  if (missing.length) {
    fail(
      `refusing: welcome-email-draft requires both a lead-magnet and a survey artifact to exist ` +
        `first -- missing: ${missing.join(", ")} (rules.md §6.6)`
    );
  }
  if (survey && survey.fields?.reviewed_by_muxin !== true) {
    fail(
      `refusing: welcome-email-draft requires the survey fit review to be reviewed_by_muxin first -- ` +
        `p2-survey-review exists but hasn't been approved yet. Run "survey-review-approve" (rules.md §6.6)`
    );
  }
}

function cmdWelcomeEmailDraft(slug: string) {
  requireMagnetAndSurveyExist(slug);
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as WelcomeEmailDraftInput;

  requireNonEmpty({
    subject: input.subject,
    preview_text: input.preview_text,
    body: input.body,
    lead_magnet_link_text: input.lead_magnet_link_text,
    lead_magnet_destination: input.lead_magnet_destination,
    survey_question_or_link: input.survey_question_or_link,
  });
  checkNoEmDash({
    subject: input.subject,
    preview_text: input.preview_text,
    body: input.body,
    lead_magnet_link_text: input.lead_magnet_link_text,
    survey_question_or_link: input.survey_question_or_link,
  });
  warnIfNoClaimRefs(rules, input.claim_refs);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-welcome-email",
    phase: 2,
    artifact_kind: "welcome-email",
    title: input.subject,
    checkpoint_id: "checkpoint-2",
    venture_id: slug,
    venture_phase: 2,
    message_id: "p2-welcome-email",
    fields: {
      subject: input.subject,
      preview_text: input.preview_text,
      body: input.body,
      lead_magnet_link_text: input.lead_magnet_link_text,
      lead_magnet_destination: input.lead_magnet_destination,
      survey_question_or_link: input.survey_question_or_link,
    },
    claim_refs: input.claim_refs ?? [],
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (welcome-email) -- awaiting Muxin's approval`);
}

// --- announcement-draft: the (optional) text-post-announcement artifact (rules.md §6.7) ----------

interface AnnouncementDraftInput {
  title: string;
  body: string;
  claim_refs: ClaimRef[];
  // Self-report that this post naturally bridges to the lead magnet, matching Phase 2's CTA
  // policy (cta_policy_by_phase["2"], rules.md §1A.1). Mirrors the reply-prompt/no_cta_reason
  // discipline cmdDraft applies to Phase 1's cta_policy_by_phase["1"] -- a body-text regex can
  // reliably detect "ends with a question mark", but it cannot reliably detect "naturally bridges
  // to the lead magnet", so that judgment is self-reported here instead and refused only when
  // neither the bridge flag nor a deliberate no_cta_reason is present.
  bridges_to_lead_magnet?: boolean;
  no_cta_reason?: string;
}

function cmdAnnouncementDraft(slug: string) {
  if (!readArtifact(slug, "p2-lead-magnet")) {
    fail(`refusing: announcement-draft requires a lead-magnet artifact to exist first (rules.md §6.7)`);
  }
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as AnnouncementDraftInput;

  requireNonEmpty({ title: input.title, body: input.body });
  checkNoEmDash({ title: input.title, body: input.body });

  const ctaPolicy = rules.cta_policy_by_phase["2"];
  if (ctaPolicy === "lead_magnet_bridge" && !input.bridges_to_lead_magnet && !input.no_cta_reason?.trim()) {
    fail(
      `draft doesn't confirm it bridges to the lead magnet (bridges_to_lead_magnet: true), and no ` +
        `no_cta_reason was recorded -- Phase 2's CTA policy is "${ctaPolicy}" (rules.md §1A.1): a ` +
        `natural bridge to the lead magnet is required unless this is a deliberate, recorded exception`
    );
  }
  warnIfNoClaimRefs(rules, input.claim_refs);

  mkdirSync(phase2Dir(slug), { recursive: true });
  const bodyPath = `phase-2-audience/p2-announcement.md`;
  writeFileSync(`${phase2Dir(slug)}/p2-announcement.md`, input.body.trim() + "\n");

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-announcement",
    phase: 2,
    artifact_kind: "text-post-announcement",
    title: input.title,
    body_path: bodyPath,
    checkpoint_id: null, // deliberately NOT checkpoint-2 -- the announcement is optional (rules.md §6.8)
    venture_id: slug,
    venture_phase: 2,
    message_id: "p2-announcement",
    claim_refs: input.claim_refs ?? [],
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (text-post-announcement) -- awaiting Muxin's approval`);
}

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) {
    fail(
      `usage: tsx src/venture/phase2.ts <concepts|concept-select|magnet-draft|landing-page-draft|` +
        `survey-review|survey-review-approve|welcome-email-draft|announcement-draft|approve|discard|` +
        `restore|list> <slug> [...args]`
    );
  }
  const rules = loadRules();
  requireRulesVersionMatch(slug, rules);
  // Nothing in this file runs before BOTH gates pass -- see phase1.ts's requirePhase2Unlocked for
  // why the phase-1-research-continuation decision, not just Checkpoint 1, is the real gate.
  requirePhase2Unlocked(slug);
  switch (sub) {
    case "concepts":
      return cmdConcepts(slug);
    case "concept-select":
      return cmdConceptSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "magnet-draft":
      return cmdMagnetDraft(slug);
    case "landing-page-draft":
      return cmdLandingPageDraft(slug);
    case "survey-review":
      return cmdSurveyReview(slug);
    case "survey-review-approve":
      return cmdSurveyReviewApprove(slug);
    case "welcome-email-draft":
      return cmdWelcomeEmailDraft(slug);
    case "announcement-draft":
      return cmdAnnouncementDraft(slug);
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
// one-line message via fail(), never an uncaught stack trace dump. Mirrors phase1.ts's main().
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
