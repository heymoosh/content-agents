import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import { createArtifact, readArtifact, updateArtifactFields, type ClaimRef } from "./artifacts.js";
import { writeDecision, selectWithOverride, readDecision, type Candidate, type DecisionRecord } from "./decisions.js";
import { phase2Dir } from "./paths.js";
import { requirePhase2Unlocked } from "./phase1.js";
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

// Phase 2 script: scaffolding and gate checks only, same discipline as phase1.ts. Concept
// generation, copy drafting, and the survey fit review are Claude's own judgment work, done
// inline while running .claude/skills/venture/SKILL.md -- this script never calls an LLM itself.
// It reads Claude's output on stdin, validates it mechanically, and refuses to persist anything
// that skips a gate.
//
// usage: tsx src/venture/phase2.ts <subcommand> <slug> [...args] [--stdin]
//
// readStdin/flag/positionalArgs/checkNoEmDash/warnIfNoClaimRefs are shared with phase1.ts -- see
// artifact-lifecycle.ts.

// --- small shared validators -------------------------------------------------------------------

function requireNonEmpty(fields: Record<string, string | undefined | null>): void {
  const missing = Object.entries(fields)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => k);
  if (missing.length) fail(`missing required field(s): ${missing.join(", ")}`);
}

// Writes a manual-kind Phase 2 artifact's structured `fields` out to a real, human-readable
// ready-to-paste-shaped .md file under phase-2-audience/, mirroring exactly what cmdAnnouncementDraft
// already does for its own body file -- and returns the body_path (relative to ventureDir(slug))
// to stamp onto the artifact at createArtifact time. Without this, deliverManual() has nothing to
// read: a manual artifact with fields-only content and no body_path ENOENT-crashes on delivery
// (see deliver.ts). Plain markdown, no invented content beyond what's already in `fields`.
function writePhase2Body(slug: string, artifactId: string, body: string): string {
  mkdirSync(phase2Dir(slug), { recursive: true });
  const relPath = `phase-2-audience/${artifactId}.md`;
  writeFileSync(`${phase2Dir(slug)}/${artifactId}.md`, body.trim() + "\n");
  return relPath;
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

// Shape of a phase_1_research_read finding as persisted by phase1.ts's cmdResearchReadInit --
// only the fields cmdConcepts needs to cross-check a concept candidate's evidence_refs against.
interface ResearchReadFindingRecord {
  finding_id: string;
  finding_origin: "planned" | "emergent";
  muxin_confirmed_emergent: boolean | null;
  signal_quality?: "thin" | "moderate" | "strong";
}

function cmdConcepts(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as ConceptsInput;

  // venture-schema-contract.md §2A: the five-concept decision's input_refs MUST include the
  // research-read artifact id and the continuation decision id it was unlocked by -- same style
  // check as cmdContinuation (phase1.ts) already does for its own input_refs.
  if (!input.input_refs.includes("p1-research-read") || !input.input_refs.includes("p1-continuation-01")) {
    fail(
      `concepts input_refs must include both "p1-research-read" and "p1-continuation-01" ` +
        `(venture-schema-contract.md §2A)`
    );
  }

  if (input.candidates.length !== rules.lead_magnet_concept.concept_count) {
    fail(`expected exactly ${rules.lead_magnet_concept.concept_count} concept candidates, got ${input.candidates.length}`);
  }

  // rules.md §5.6 / venture-schema-contract.md §2C.3: a finding whose muxin_confirmed_emergent is
  // false stays in the record but MUST be excluded from informing Phase 2. And venture-schema-contract.md
  // §2A: a candidate resting on a `signal_quality: "thin"` finding MUST be labeled a hypothesis --
  // cross-checked against the read's own computed label, not just Claude's self-reported
  // thin_evidence flag. requirePhase2Unlocked (already run in dispatch()) guarantees p1-research-read
  // exists by this point -- it's a prerequisite of the reviewed research read that unlocks Phase 2.
  const read = readArtifact(slug, "p1-research-read");
  const findings = ((read?.fields?.findings as ResearchReadFindingRecord[] | undefined) ?? []);
  const findingsById = new Map(findings.map((f) => [f.finding_id, f]));
  const rejectedFindingIds = new Set(
    findings.filter((f) => f.finding_origin === "emergent" && f.muxin_confirmed_emergent === false).map((f) => f.finding_id)
  );

  // Local, per-candidate validation checks -- a plain list run in a loop below instead of a
  // hand-stacked pile of if/fail blocks, so a future check slots in as one more list entry. Not a
  // shared/reusable validator module: this structure is internal to cmdConcepts. Order matches the
  // original sequential checks exactly (factor scores, in factor order, then the three
  // whole-candidate checks), since only the first failing check for a candidate ever surfaces.
  const candidateChecks: { check: (c: ConceptCandidateInput) => boolean; message: (c: ConceptCandidateInput) => string }[] = [
    ...rules.lead_magnet_concept.factors.flatMap((f) => [
      {
        check: (c: ConceptCandidateInput) => typeof c.scores?.[f] !== "number",
        message: (c: ConceptCandidateInput) => `candidate "${c.candidate_id}" is missing a score for factor "${f}"`,
      },
      {
        check: (c: ConceptCandidateInput) => {
          const score = c.scores?.[f];
          return (
            typeof score === "number" &&
            (score < rules.lead_magnet_concept.score_scale.min || score > rules.lead_magnet_concept.score_scale.max)
          );
        },
        message: (c: ConceptCandidateInput) =>
          `candidate "${c.candidate_id}" factor "${f}" score ${c.scores?.[f]} is outside the ` +
          `${rules.lead_magnet_concept.score_scale.min}-${rules.lead_magnet_concept.score_scale.max} scale`,
      },
    ]),
    {
      // rules.md §6.1: a concept resting on thin evidence must be labeled a hypothesis, not
      // presented with the same confidence as a moderate/strong-evidence concept.
      check: (c) => c.thin_evidence === true && c.label_as_hypothesis !== true,
      message: (c) =>
        `candidate "${c.candidate_id}" is marked thin_evidence but is missing label_as_hypothesis: true -- ` +
        `rules.md §6.1 requires a concept resting on thin evidence to be labeled a hypothesis, not ` +
        `presented with the same confidence as a moderate/strong-evidence concept`,
    },
    {
      // rules.md §5.6, venture-schema-contract.md §2C.3: a finding whose muxin_confirmed_emergent
      // is false is excluded from informing Phase 2 concept generation.
      check: (c) => (c.evidence_refs ?? []).some((ref) => rejectedFindingIds.has(ref)),
      message: (c) => {
        const rejectedRefs = (c.evidence_refs ?? []).filter((ref) => rejectedFindingIds.has(ref));
        return (
          `candidate "${c.candidate_id}" cites rejected emergent finding(s) ${rejectedRefs.join(", ")} in ` +
          `evidence_refs -- a finding whose muxin_confirmed_emergent is false is excluded from informing Phase 2 ` +
          `concept generation (rules.md §5.6, venture-schema-contract.md §2C.3)`
        );
      },
    },
    {
      // venture-schema-contract.md §2A: a candidate resting on a signal_quality: "thin" finding
      // must be labeled a hypothesis, cross-checked against the read's own computed label, not
      // just Claude's self-reported thin_evidence flag.
      check: (c) => {
        const citedThin = (c.evidence_refs ?? [])
          .map((ref) => findingsById.get(ref))
          .some((f) => !!f && f.signal_quality === "thin");
        return citedThin && c.label_as_hypothesis !== true;
      },
      message: (c) => {
        const citedThinFindingIds = (c.evidence_refs ?? [])
          .map((ref) => findingsById.get(ref))
          .filter((f): f is ResearchReadFindingRecord => !!f && f.signal_quality === "thin")
          .map((f) => f.finding_id);
        return (
          `candidate "${c.candidate_id}" cites thin-evidence finding(s) ${citedThinFindingIds.join(", ")} in ` +
          `evidence_refs but is missing label_as_hypothesis: true -- a candidate resting on a ` +
          `signal_quality: "thin" finding must be labeled a hypothesis regardless of self-reported ` +
          `thin_evidence (venture-schema-contract.md §2A)`
        );
      },
    },
  ];

  for (const c of input.candidates) {
    for (const { check, message } of candidateChecks) {
      if (check(c)) fail(message(c));
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
  const d = selectWithOverride(slug, "p2-concept-01", candidateId, overrideReason, {
    requiredSelectCount: rules.lead_magnet_concept.select_count,
    ruleCite: "rules.md §6.2",
    candidateLabel: "concept",
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

  const body = [input.intro, ...input.sections, input.action_step, input.feedback_prompt].join("\n\n");
  const bodyPath = writePhase2Body(slug, "p2-lead-magnet", body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-lead-magnet",
    phase: 2,
    artifact_kind: "lead-magnet",
    title: input.title,
    body_path: bodyPath,
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
  claim_refs: ClaimRef[];
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
  warnIfNoClaimRefs(rules, input.claim_refs);

  const landingPageLines = [
    `Headline: ${input.headline}`,
    input.subheadline ? `Subheadline: ${input.subheadline}` : null,
    ``,
    `Benefits:`,
    `- ${input.benefit_1}`,
    `- ${input.benefit_2}`,
    `- ${input.benefit_3}`,
    ``,
    `Button: ${input.button_label}`,
    input.form_intro ? `Form intro: ${input.form_intro}` : null,
    input.thank_you_message ? `Thank you message: ${input.thank_you_message}` : null,
    input.privacy_copy ? `Privacy copy: ${input.privacy_copy}` : null,
  ].filter((l): l is string => l !== null);
  const bodyPath = writePhase2Body(slug, "p2-landing-page", landingPageLines.join("\n"));

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-landing-page",
    phase: 2,
    artifact_kind: "landing-page-copy",
    title: input.headline,
    body_path: bodyPath,
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
    claim_refs: input.claim_refs ?? [],
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

  const fitLines = input.fit_assessment
    .slice()
    .sort((a, b) => a.question_number - b.question_number)
    .map((f) => `- Q${f.question_number}: ${f.fits_chosen_magnet ? "fits" : "does not fit"} -- ${f.note}`);
  const surveyReviewLines = [
    `Existing survey snapshot:`,
    input.existing_survey_snapshot,
    ``,
    `Fit assessment:`,
    ...fitLines,
    ``,
    `Change needed: ${input.change_needed ? "yes" : "no"}`,
    ...(input.recommended_changes?.length ? [``, `Recommended changes:`, ...input.recommended_changes.map((c) => `- ${c}`)] : []),
  ];
  const bodyPath = writePhase2Body(slug, "p2-survey-review", surveyReviewLines.join("\n"));

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-survey-review",
    phase: 2,
    artifact_kind: "survey",
    title: "Survey fit review",
    body_path: bodyPath,
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

  const welcomeEmailLines = [
    `Preview text: ${input.preview_text}`,
    ``,
    input.body,
    ``,
    `${input.lead_magnet_link_text}: ${input.lead_magnet_destination}`,
    ``,
    input.survey_question_or_link,
  ];
  const bodyPath = writePhase2Body(slug, "p2-welcome-email", welcomeEmailLines.join("\n"));

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p2-welcome-email",
    phase: 2,
    artifact_kind: "welcome-email",
    title: input.subject,
    body_path: bodyPath,
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
