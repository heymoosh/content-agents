import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch, type VentureRules } from "./rules.js";
import { createArtifact, readArtifact, type ClaimRef } from "./artifacts.js";
import { writeDecision, selectWithOverride, selectDecision, readDecision, type Candidate, type DecisionRecord } from "./decisions.js";
import { phase3Dir, clusterAnalysisPath, ventureDir } from "./paths.js";
import {
  ingestResponse,
  correctResponse,
  readResponses,
  getResponseGateState,
  type ResponseCorrectionPatch,
  type ResponseSource,
  type EmotionalIntensity,
} from "./responses.js";
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

// Phase 3 script: scaffolding and gate checks only, same discipline as phase1.ts/phase2.ts.
// Semantic clustering, problem scoring, the transformation sentence, the outline, and the price/
// pitch are Claude's own judgment work, done inline while running .claude/skills/venture/SKILL.md
// -- this script never calls an LLM itself. It reads Claude's output on stdin, validates it
// mechanically, and refuses to persist anything that skips a gate.
//
// usage: tsx src/venture/phase3.ts <subcommand> <slug> [...args] [--stdin]
//
// readStdin/flag/positionalArgs/checkNoEmDash/warnIfNoClaimRefs are shared with phase1.ts/
// phase2.ts -- see artifact-lifecycle.ts.

// --- the response gate (rules.md §7.3) -----------------------------------------------------------
//
// This is the one gate that must never be bypassed by a command added later without thinking about
// it -- exactly the bug class a prior Phase 1 audit caught (a gate that exists in the data model but
// isn't actually wired into the thing it's supposed to gate). So it is NOT called individually
// inside each command below; it is applied once, in dispatch(), to every subcommand except the
// small allowlist in GATE_EXEMPT_SUBCOMMANDS -- a new subcommand is gated by default, and has to be
// deliberately added to the allowlist to opt out, not the other way around.

export function requireResponseGateOpen(slug: string): void {
  const gate = getResponseGateState(slug);
  if (gate.state !== "opened") {
    fail(
      `refusing: the Phase 3 response gate is not open yet -- have ${gate.have} of ${gate.need} eligible ` +
        `unique respondents (target ${gate.target}). Posting and response collection continue below the ` +
        `gate, but the system MUST NOT choose the core problem, outline the product, or set the price ` +
        `(rules.md §7.3, §11 items 10-11).`
    );
  }
}

// response-ingest/response-correct/response-gate-status are a different concern from the
// cluster/problem/transformation/outline/price analysis pipeline (raw response intake, not
// analysis) and are deliberately NOT gated by requireResponseGateOpen -- gating response intake on
// the gate it exists to open would be circular. "list" is the generic artifact-lifecycle read
// command, also exempt as a status/read command.
const GATE_EXEMPT_SUBCOMMANDS = new Set(["response-ingest", "response-correct", "response-gate-status", "list"]);

// --- small shared helpers -------------------------------------------------------------------------

function requireNonEmpty(fields: Record<string, string | undefined | null>): void {
  const missing = Object.entries(fields)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => k);
  if (missing.length) fail(`missing required field(s): ${missing.join(", ")}`);
}

// A mechanical substring check, same shape as artifact-lifecycle.ts's checkNoEmDash -- deliberately
// NOT applied to audience-derived text (a cluster's redacted evidence quotes): rules.md §7.4 says
// preserve the audience's exact wording, so running a copy-quality check against their own words
// would force rewriting language that isn't Claude's to rewrite. Only applied to Claude-authored
// user-facing copy: the transformation sentence and the price pitch paragraph.
function checkBannedVerbs(rules: VentureRules, fields: Record<string, string | undefined>): void {
  for (const [key, text] of Object.entries(fields)) {
    if (!text) continue;
    const lower = text.toLowerCase();
    const hit = rules.transformation.banned_verbs.find((v) => lower.includes(v));
    if (hit) {
      fail(
        `field "${key}" contains the banned vague verb "${hit}" -- rules.md §7.7 bans vague verbs such ` +
          `as "unlock," "elevate," or "transform" from user-facing copy, no exceptions`
      );
    }
  }
}

// Lightweight, on purpose (rules.md §7.7 wants "one plain transformation sentence," not a grammar
// checker) -- splits on a terminal-punctuation-then-whitespace boundary and refuses more than one
// resulting segment.
function checkSingleSentence(field: string, text: string): void {
  const parts = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((p) => p.trim().length > 0);
  if (parts.length > 1) {
    fail(
      `${field} must be a single sentence (rules.md §7.7: "one plain transformation sentence") -- got ` +
        `${parts.length} sentence-like segments`
    );
  }
}

// Guards against silently overwriting an already-made decision (rules.md §11 item 15: never
// silently rewrite a user's final selection). writeDecision has no built-in "already selected"
// check (unlike selectDecision, which throws DecisionAlreadySelectedError) -- a bare re-run of a
// decision-writing command would otherwise revert an already-selected decision back to
// awaiting_user, discarding Muxin's choice.
function refuseIfDecisionSelected(slug: string, decisionId: string, label: string): void {
  const d = readDecision(slug, decisionId);
  if (d?.status === "selected") {
    fail(
      `refusing: ${decisionId} (${label}) is already selected -- re-running this command would silently ` +
        `overwrite data underneath an already-made decision (rules.md §11 item 15). If this genuinely ` +
        `needs to change, that's a product question for Muxin, not a rerun.`
    );
  }
}

// Same concern as refuseIfDecisionSelected, for artifacts: createArtifact always writes
// editorial_status: "draft", so re-running a draft command after Muxin already approved the
// artifact would silently revert the approval.
function refuseIfArtifactApproved(slug: string, artifactId: string): void {
  const a = readArtifact(slug, artifactId);
  if (a?.editorial_status === "approved") {
    fail(
      `refusing: ${artifactId} is already approved -- re-running this draft command would silently ` +
        `revert it to draft, discarding the approval (rules.md §11 item 15). Discard it first if it ` +
        `genuinely needs to be redrafted.`
    );
  }
}

function writePhase3Body(slug: string, artifactId: string, body: string): string {
  mkdirSync(phase3Dir(slug), { recursive: true });
  const relPath = `phase-3-offer/${artifactId}.md`;
  writeFileSync(`${phase3Dir(slug)}/${artifactId}.md`, body.trim() + "\n");
  return relPath;
}

// --- cluster analysis storage (rules.md §7.5, venture-schema-contract.md §5.4) --------------------
//
// Storage choice: a dedicated JSON file (paths.ts's clusterAnalysisPath), not an artifact and not
// an addition to responses.jsonl. Reasoning:
//   - Not an artifact: ArtifactKind (rules.ts) has no "cluster-analysis" entry, and rules.yaml's
//     checkpoint-3.required_artifact_kinds is fixed at [product-outline, price-decision] by WP0 --
//     a cluster analysis was never meant to be one of checkpoint-3's required, deliverable
//     artifacts. It has no delivery step to confirm and nothing to approve/discard; it's read-model
//     data that feeds problem-score, same role responses.jsonl already plays for cluster/response
//     data.
//   - Not folded into responses.jsonl: the per-response audit trail (which response landed in which
//     cluster) is already fully covered by correctResponse's own append-only history on each
//     response record (§7.5 item 5's "response-to-cluster audit trail") -- this file only needs the
//     aggregate, re-derivable-if-lost, per-cluster summary: count (computed from actual
//     assignments, never caller-supplied -- see cmdCluster), redacted evidence, stuck point,
//     desired outcome, visible consequences (the exact shape venture-schema-contract.md §5.4
//     describes as the redacted analysis output a normal venture read exposes).
//   - A plain JSON object, not JSONL: unlike responses/artifacts/decisions, there is exactly one
//     "current" cluster analysis per venture (cmdCluster overwrites it wholesale on a correction,
//     same one-shot-snapshot treatment state.md gets relative to canon.md's ledger) -- no
//     append-only history is needed on top of what responses.jsonl already keeps.
//   - Gitignored (.gitignore), same privacy posture as responses.jsonl: `evidence` holds redacted
//     but still audience-derived quotes.

export interface ClusterSummary {
  cluster_id: string;
  label: string;
  count: number; // derived from actual assignments, never caller-supplied (rules.md §11 item 4)
  evidence: string[]; // redacted_quote text only, never exact_quote
  stuck_point: string;
  desired_outcome: string | null;
  visible_consequences: string | null;
}

export interface ClusterAnalysis {
  analyzed_at: string;
  clusters: ClusterSummary[];
}

export function readClusterAnalysis(slug: string): ClusterAnalysis | null {
  const path = clusterAnalysisPath(slug);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ClusterAnalysis;
}

function writeClusterAnalysis(slug: string, analysis: ClusterAnalysis): void {
  mkdirSync(ventureDir(slug), { recursive: true });
  writeFileSync(clusterAnalysisPath(slug), JSON.stringify(analysis, null, 2) + "\n");
}

function requireClusterAnalysisExists(slug: string): ClusterAnalysis {
  const analysis = readClusterAnalysis(slug);
  if (!analysis) fail(`refusing: no cluster analysis found -- run "cluster" first (rules.md §7.5)`);
  return analysis!;
}

// --- cluster: group responses into 3-5 problems (rules.md §7.5) -----------------------------------

interface ClusterDefInput {
  cluster_id: string;
  label: string;
  evidence: string[]; // redacted quotes Claude selected as representative -- never exact_quote
  stuck_point: string;
  desired_outcome?: string | null;
  visible_consequences?: string | null;
}

interface ClusterAssignmentInput {
  response_id: string;
  cluster_id: string;
}

interface ClusterInput {
  clusters: ClusterDefInput[];
  assignments: ClusterAssignmentInput[];
}

function cmdCluster(slug: string) {
  const rules = loadRules();
  refuseIfDecisionSelected(slug, "p3-problem-01", "problem-selection");
  const input = JSON.parse(readStdin()) as ClusterInput;

  const { min_clusters, max_clusters } = rules.cluster_analysis;
  if (!Array.isArray(input.clusters) || input.clusters.length < min_clusters || input.clusters.length > max_clusters) {
    fail(
      `expected ${min_clusters}-${max_clusters} clusters (rules.md §7.5: "three to five clusters, not a ` +
        `long list of micro-categories"), got ${input.clusters?.length ?? 0}`
    );
  }
  const clusterIds = new Set(input.clusters.map((c) => c.cluster_id));
  if (clusterIds.size !== input.clusters.length) fail(`clusters contain a duplicate cluster_id`);
  for (const c of input.clusters) {
    if (!c.cluster_id?.trim()) fail(`a cluster is missing cluster_id`);
    if (!c.label?.trim()) fail(`cluster "${c.cluster_id}" is missing a label`);
    if (!c.stuck_point?.trim()) fail(`cluster "${c.cluster_id}" is missing a stuck_point`);
    if (!Array.isArray(c.evidence) || c.evidence.length === 0) {
      fail(`cluster "${c.cluster_id}" must carry at least one evidence entry (a redacted quote)`);
    }
  }

  // Coverage: every included_in_gate response must land in exactly one declared cluster -- no
  // orphans, no double-assignment, no assignment naming an excluded/nonexistent response, and no
  // assignment naming an undeclared cluster_id (rules.md §7.5 items 3/5).
  const responses = readResponses(slug);
  const includedIds = new Set(responses.filter((r) => r.included_in_gate).map((r) => r.response_id));
  const responseById = new Map(responses.map((r) => [r.response_id, r]));

  const seenResponseIds = new Set<string>();
  const assignedByCluster = new Map<string, string[]>();
  for (const a of input.assignments ?? []) {
    const response = responseById.get(a.response_id);
    if (!response) fail(`assignment references unknown response_id "${a.response_id}"`);
    if (!response!.included_in_gate) {
      fail(
        `assignment references response "${a.response_id}", which is not included_in_gate -- only ` +
          `included responses are clustered (rules.md §7.4)`
      );
    }
    if (seenResponseIds.has(a.response_id)) fail(`response "${a.response_id}" is assigned to more than one cluster`);
    seenResponseIds.add(a.response_id);
    if (!clusterIds.has(a.cluster_id)) {
      fail(`assignment for response "${a.response_id}" names cluster_id "${a.cluster_id}", which isn't one of the declared clusters`);
    }
    const list = assignedByCluster.get(a.cluster_id) ?? [];
    list.push(a.response_id);
    assignedByCluster.set(a.cluster_id, list);
  }
  const missing = [...includedIds].filter((id) => !seenResponseIds.has(id));
  if (missing.length) {
    fail(`every included response must be assigned to exactly one cluster -- missing: ${missing.join(", ")} (rules.md §7.5)`);
  }

  const at = now();
  // Writes cluster_id onto each response record -- this IS §7.5 item 5's response-to-cluster audit
  // trail, via responses.jsonl's own append-only history, not a separate log.
  for (const a of input.assignments) {
    correctResponse(slug, a.response_id, { cluster_id: a.cluster_id }, at);
  }

  const analysis: ClusterAnalysis = {
    analyzed_at: at,
    clusters: input.clusters.map((c) => ({
      cluster_id: c.cluster_id,
      label: c.label,
      count: (assignedByCluster.get(c.cluster_id) ?? []).length,
      evidence: c.evidence,
      stuck_point: c.stuck_point,
      desired_outcome: c.desired_outcome ?? null,
      visible_consequences: c.visible_consequences ?? null,
    })),
  };
  writeClusterAnalysis(slug, analysis);
  console.log(
    `wrote cluster-analysis.json (${analysis.clusters.length} clusters, ${seenResponseIds.size} responses assigned) -- ` +
      `STOP: show Muxin the clusters before problem-score`
  );
}

// --- problem-score / problem-select: the problem-selection decision (rules.md §7.6) ---------------

interface ProblemScoreInput {
  input_refs: string[];
  candidates: Candidate[];
  recommended_candidate_ids: string[];
}

function cmdProblemScore(slug: string) {
  const rules = loadRules();
  refuseIfDecisionSelected(slug, "p3-problem-01", "problem-selection");
  const analysis = requireClusterAnalysisExists(slug);
  const input = JSON.parse(readStdin()) as ProblemScoreInput;

  const clusterIds = new Set(analysis.clusters.map((c) => c.cluster_id));
  const candidateIds = (input.candidates ?? []).map((c) => c.candidate_id);
  if (new Set(candidateIds).size !== candidateIds.length) fail(`candidates contain a duplicate candidate_id`);
  if (candidateIds.length !== clusterIds.size || candidateIds.some((id) => !clusterIds.has(id))) {
    fail(`candidates must be exactly the stored clusters {${[...clusterIds].join(", ")}}, got {${candidateIds.join(", ")}}`);
  }
  for (const c of input.candidates) {
    for (const f of rules.problem_score.factors) {
      const score = c.scores?.[f];
      if (typeof score !== "number") fail(`candidate "${c.candidate_id}" is missing a score for factor "${f}"`);
      if (score < rules.problem_score.score_scale.min || score > rules.problem_score.score_scale.max) {
        fail(
          `candidate "${c.candidate_id}" factor "${f}" score ${score} is outside the ` +
            `${rules.problem_score.score_scale.min}-${rules.problem_score.score_scale.max} scale`
        );
      }
    }
  }
  if (!input.recommended_candidate_ids || input.recommended_candidate_ids.length !== 1) {
    fail(
      `problem-selection recommends exactly one problem (rules.md §7.6: "The system recommends one ` +
        `problem"), got ${input.recommended_candidate_ids?.length ?? 0}`
    );
  }
  if (!input.input_refs?.length) fail(`input_refs must be non-empty`);

  const d = writeDecision(slug, {
    decision_id: "p3-problem-01",
    decision_kind: "problem-selection",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} (${d.candidates.length} scored clusters) -- STOP: show Muxin the scored problems`);
}

function cmdProblemSelect(slug: string, candidateId: string) {
  const overrideReason = flag("--override-reason");
  const d = selectWithOverride(slug, "p3-problem-01", candidateId, overrideReason, {
    requiredSelectCount: 1,
    ruleCite: "rules.md §7.6",
    candidateLabel: "problem cluster",
  });
  console.log(`problem selected: ${d.selected_candidate_ids[0]}`);
}

function requireProblemSelected(slug: string): DecisionRecord {
  const d = readDecision(slug, "p3-problem-01");
  if (!d || d.status !== "selected") {
    fail(`refusing: problem-selection is not selected. Run "problem-score" then "problem-select" first (rules.md §7.6).`);
  }
  return d!;
}

// --- transformation-draft / transformation-select: the transformation-choice decision (rules.md §7.7)
//
// Per decisions.ts's DecisionKind comment (WP0): transformation-choice is a single system-proposed
// sentence Muxin edits and approves, not a ranked pick -- modeled as a decision record with exactly
// one candidate (its `label` holds the sentence), selected with plain selectDecision() rather than
// selectWithOverride(), since there is no second candidate to override. transformation-select
// therefore takes no candidate_id argument (unlike problem-select/price-select) -- there is only
// ever one, so asking for it would be pointless friction, not meaningful audit trail.

interface TransformationDraftInput {
  sentence: string;
  rationale?: string;
  claim_refs?: ClaimRef[];
}

function cmdTransformationDraft(slug: string) {
  const rules = loadRules();
  requireProblemSelected(slug);
  refuseIfDecisionSelected(slug, "p3-transformation-01", "transformation-choice");
  const input = JSON.parse(readStdin()) as TransformationDraftInput;

  requireNonEmpty({ sentence: input.sentence });
  checkNoEmDash({ sentence: input.sentence });
  checkBannedVerbs(rules, { sentence: input.sentence });
  checkSingleSentence("sentence", input.sentence);
  warnIfNoClaimRefs(rules, input.claim_refs);

  const d = writeDecision(slug, {
    decision_id: "p3-transformation-01",
    decision_kind: "transformation-choice",
    rules_version: rules.rules_version,
    input_refs: ["p3-problem-01"],
    candidates: [
      {
        candidate_id: "transformation-01",
        label: input.sentence,
        scores: {},
        evidence_refs: (input.claim_refs ?? []).map((c) => c.ref),
        rationale: input.rationale ?? "",
      },
    ],
    recommended_candidate_ids: ["transformation-01"],
    at: now(),
  });
  console.log(`wrote ${d.decision_id} -- STOP: show Muxin the transformation sentence for editing and approval`);
}

function cmdTransformationSelect(slug: string) {
  const d = readDecision(slug, "p3-transformation-01");
  if (!d) fail(`refusing: no transformation-choice decision found. Run "transformation-draft" first.`);
  const selected = selectDecision(slug, "p3-transformation-01", {
    selectedCandidateIds: [d!.candidates[0].candidate_id],
    selectedBy: "muxin",
    requiredSelectCount: 1,
    at: now(),
  });
  console.log(`transformation approved: "${selected.candidates[0].label}"`);
}

function requireTransformationApproved(slug: string): DecisionRecord {
  const d = readDecision(slug, "p3-transformation-01");
  if (!d || d.status !== "selected") {
    fail(
      `refusing: transformation-choice is not selected. Run "transformation-draft" then ` +
        `"transformation-select" first (rules.md §7.7).`
    );
  }
  return d!;
}

// --- outline-draft: the product-outline artifact (rules.md §7.8) ----------------------------------

interface OutlineDraftInput {
  transformation_sentence: string;
  sections: string[];
  format: string;
  claim_refs?: ClaimRef[];
}

function cmdOutlineDraft(slug: string) {
  const rules = loadRules();
  const transformationDecision = requireTransformationApproved(slug);
  refuseIfArtifactApproved(slug, "p3-product-outline");
  const input = JSON.parse(readStdin()) as OutlineDraftInput;

  // The approved sentence is frozen once selected -- outline-draft must carry it forward exactly,
  // never silently re-derive or re-word it (rules.md §11 item 15).
  const approvedSentence = transformationDecision.candidates[0].label;
  if (input.transformation_sentence !== approvedSentence) {
    fail(
      `outline's transformation_sentence does not match the approved transformation-choice candidate ` +
        `exactly -- approved: ${JSON.stringify(approvedSentence)}, got: ` +
        `${JSON.stringify(input.transformation_sentence)}. To change the sentence, run a new ` +
        `transformation-draft before outline-draft, not a silent edit here.`
    );
  }
  if (
    !Array.isArray(input.sections) ||
    input.sections.length < rules.product_outline.min_sections ||
    input.sections.length > rules.product_outline.max_sections
  ) {
    fail(
      `outline must have ${rules.product_outline.min_sections}-${rules.product_outline.max_sections} ` +
        `sections (rules.md §7.8), got ${input.sections?.length ?? 0}`
    );
  }
  if (input.sections.some((s) => !s?.trim())) fail(`sections must all be non-empty`);
  requireNonEmpty({ format: input.format });
  checkNoEmDash({ sections: input.sections, format: input.format });
  warnIfNoClaimRefs(rules, input.claim_refs);

  const body = [
    `Transformation: ${approvedSentence}`,
    ``,
    `Format: ${input.format}`,
    ``,
    ...input.sections.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");
  const bodyPath = writePhase3Body(slug, "p3-product-outline", body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p3-product-outline",
    phase: 3,
    artifact_kind: "product-outline",
    title: "Product outline",
    body_path: bodyPath,
    checkpoint_id: "checkpoint-3",
    venture_id: slug,
    venture_phase: 3,
    message_id: "p3-product-outline",
    fields: {
      transformation_sentence: approvedSentence,
      sections: input.sections,
      format: input.format,
    },
    claim_refs: input.claim_refs ?? [],
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (product-outline, ${input.sections.length} sections) -- awaiting Muxin's approval`);
}

function requireOutlineApproved(slug: string) {
  const a = readArtifact(slug, "p3-product-outline");
  if (!a || a.editorial_status !== "approved") {
    fail(
      `refusing: p3-product-outline is not approved. Run "outline-draft" then ` +
        `"approve ${slug} p3-product-outline" first (rules.md §7.9).`
    );
  }
  return a!;
}

// --- price / price-select / price-draft: product-format-and-price decision + price-decision artifact
// (rules.md §7.9) --------------------------------------------------------------------------------
//
// Two records, mirroring Phase 2's concepts -> concept-select -> magnet-draft shape: `price` writes
// a ranked product-format-and-price DECISION (the considered range -- candidates ARE the price/
// format options, e.g. "$79 self-paced PDF" vs "$149 email course"), Muxin selects one via
// selectWithOverride (same override-reason discipline as problem/concept/platform selects), then
// `price-draft` produces the price-decision ARTIFACT with the schema's structured fields. This is
// NOT optional plumbing: rules.yaml's checkpoint-3.required_decision_kinds includes
// "product-format-and-price" (a real decision_kind, distinct from the price-decision artifact_kind)
// -- an artifact-only design would leave checkpoint-3 permanently unclearable.

interface PriceOptionsInput {
  input_refs: string[];
  candidates: Candidate[];
  recommended_candidate_ids: string[];
}

function cmdPrice(slug: string) {
  const rules = loadRules();
  requireOutlineApproved(slug);
  refuseIfDecisionSelected(slug, "p3-price-01", "product-format-and-price");
  const input = JSON.parse(readStdin()) as PriceOptionsInput;

  if (!Array.isArray(input.candidates) || input.candidates.length < 2) {
    fail(`product-format-and-price needs meaningful alternatives (the "considered range," rules.md §7.9), not just one candidate`);
  }
  for (const c of input.candidates) {
    if (!c.label?.trim()) fail(`candidate "${c.candidate_id}" is missing a label`);
    if (!c.rationale?.trim()) fail(`candidate "${c.candidate_id}" is missing a rationale`);
  }
  if (!input.recommended_candidate_ids || input.recommended_candidate_ids.length !== 1) {
    fail(
      `product-format-and-price recommends exactly one price (rules.md §7.9: "one recommended price"), ` +
        `got ${input.recommended_candidate_ids?.length ?? 0}`
    );
  }
  if (!input.input_refs?.length) fail(`input_refs must be non-empty`);

  const d = writeDecision(slug, {
    decision_id: "p3-price-01",
    decision_kind: "product-format-and-price",
    rules_version: rules.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    at: now(),
  });
  console.log(`wrote ${d.decision_id} (${d.candidates.length} price/format options) -- STOP: show Muxin the considered range`);
}

function cmdPriceSelect(slug: string, candidateId: string) {
  const overrideReason = flag("--override-reason");
  const d = selectWithOverride(slug, "p3-price-01", candidateId, overrideReason, {
    requiredSelectCount: 1,
    ruleCite: "rules.md §7.9",
    candidateLabel: "price/format option",
  });
  console.log(`price/format selected: ${d.selected_candidate_ids[0]}`);
}

function requirePriceSelected(slug: string): DecisionRecord {
  const d = readDecision(slug, "p3-price-01");
  if (!d || d.status !== "selected") {
    fail(`refusing: product-format-and-price is not selected. Run "price" then "price-select" first (rules.md §7.9).`);
  }
  return d!;
}

// $49 is not an invented guard figure -- it is the civic-tech worked example's documented price
// (docs/venture-schema-contract.md §9 item 1: "...or the `$49` price"; rules.md §7.9 "The runtime
// MUST NOT seed a price from a worked example," §11 item 13). This mechanically catches only that
// one documented figure. It CANNOT detect a different seeded number from some other fixture this
// repo doesn't (yet) name in writing -- that remains an editorial/skill-prompt-level discipline
// (never reading the worked example into context in the first place -- see SKILL.md's "Throughout"
// section), not something a script alone can fully verify. Said plainly rather than pretending a
// broader check exists: this is a narrow, documented tripwire, not a general anti-seeding proof.
const WORKED_EXAMPLE_PRICE = 49;

interface ScenarioMathInput {
  illustrative: true;
  digital_product_conversion_pct?: number;
  service_conversion_pct?: number;
  note?: string;
}

interface PriceDraftInput {
  recommended_price: number;
  considered_range: string;
  reasoning: string;
  known_uncertainty: string;
  pitch_paragraph: string;
  scenario_math?: ScenarioMathInput | null;
  claim_refs?: ClaimRef[];
}

function cmdPriceDraft(slug: string) {
  const rules = loadRules();
  requireOutlineApproved(slug);
  requirePriceSelected(slug);
  refuseIfArtifactApproved(slug, "p3-price-decision");
  const input = JSON.parse(readStdin()) as PriceDraftInput;

  if (typeof input.recommended_price !== "number" || !(input.recommended_price > 0)) {
    fail(`recommended_price must be a positive number`);
  }
  if (input.recommended_price === WORKED_EXAMPLE_PRICE) {
    fail(
      `recommended_price is exactly $${WORKED_EXAMPLE_PRICE} -- that is the civic-tech worked example's ` +
        `documented price (docs/venture-schema-contract.md §9 item 1), and rules.md §7.9 requires the ` +
        `runtime MUST NOT seed a price from a worked example. If $${WORKED_EXAMPLE_PRICE} is genuinely ` +
        `the right price for THIS venture's own response analysis, that's a coincidence worth ` +
        `double-checking by hand, not something this script waves through automatically.`
    );
  }
  requireNonEmpty({
    considered_range: input.considered_range,
    reasoning: input.reasoning,
    known_uncertainty: input.known_uncertainty,
    pitch_paragraph: input.pitch_paragraph,
  });
  checkNoEmDash({
    considered_range: input.considered_range,
    reasoning: input.reasoning,
    known_uncertainty: input.known_uncertainty,
    pitch_paragraph: input.pitch_paragraph,
  });
  // The pitch is the one piece of user-facing copy this command produces (rules.md §7.7's vague-verb
  // ban is scoped to "user-facing copy") -- reasoning/known_uncertainty/considered_range are internal
  // working notes, not copy a subscriber will read, so the banned-verb check doesn't apply to them.
  checkBannedVerbs(rules, { pitch_paragraph: input.pitch_paragraph });
  if (input.scenario_math && input.scenario_math.illustrative !== true) {
    fail(
      `scenario_math.illustrative must be exactly true -- rules.md §7.9: optional scenario math MUST ` +
        `be clearly labeled illustrative, never presented as a forecast or promise`
    );
  }
  warnIfNoClaimRefs(rules, input.claim_refs);

  const body = [
    `Recommended price: ${input.recommended_price}`,
    `Considered range: ${input.considered_range}`,
    ``,
    `Reasoning: ${input.reasoning}`,
    ``,
    `Known uncertainty: ${input.known_uncertainty}`,
    ``,
    `Pitch:`,
    input.pitch_paragraph,
  ].join("\n");
  const bodyPath = writePhase3Body(slug, "p3-price-decision", body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p3-price-decision",
    phase: 3,
    artifact_kind: "price-decision",
    title: `Price: ${input.recommended_price}`,
    body_path: bodyPath,
    checkpoint_id: "checkpoint-3",
    venture_id: slug,
    venture_phase: 3,
    message_id: "p3-price-decision",
    fields: {
      recommended_price: input.recommended_price,
      considered_range: input.considered_range,
      reasoning: input.reasoning,
      known_uncertainty: input.known_uncertainty,
      pitch_paragraph: input.pitch_paragraph,
      scenario_math: input.scenario_math ?? null,
    },
    claim_refs: input.claim_refs ?? [],
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (price-decision, $${input.recommended_price}) -- awaiting Muxin's approval`);
}

// --- response-ingest / response-correct / response-gate-status: the response-log CLI wrapper ------
//
// WP1 (src/venture/responses.ts) built the response log itself but deliberately left it with no CLI
// surface. These three commands are that surface -- a different concern from the cluster/problem/
// transformation/outline/price analysis pipeline above (raw response intake, not analysis), kept in
// their own section and exempt from requireResponseGateOpen (see GATE_EXEMPT_SUBCOMMANDS).

interface ResponseIngestInput {
  source: ResponseSource;
  received_at: string;
  raw_identifier?: { platform: string; stable_user_id: string | number } | null;
  target_audience_eligible: boolean;
  exact_quote: string;
  redacted_quote: string;
  stuck_point: string;
  desired_outcome?: string | null;
  emotional_intensity: EmotionalIntensity;
  exclusion_reason?: string | null;
  response_id?: string;
}

function cmdResponseIngest(slug: string) {
  const input = JSON.parse(readStdin()) as ResponseIngestInput;
  requireNonEmpty({
    source: input.source,
    received_at: input.received_at,
    exact_quote: input.exact_quote,
    redacted_quote: input.redacted_quote,
    stuck_point: input.stuck_point,
    emotional_intensity: input.emotional_intensity,
  });
  const result = ingestResponse(
    slug,
    {
      source: input.source,
      receivedAt: input.received_at,
      rawIdentifier: input.raw_identifier
        ? { platform: input.raw_identifier.platform, stableUserId: input.raw_identifier.stable_user_id }
        : null,
      targetAudienceEligible: input.target_audience_eligible,
      exactQuote: input.exact_quote,
      redactedQuote: input.redacted_quote,
      stuckPoint: input.stuck_point,
      desiredOutcome: input.desired_outcome ?? null,
      emotionalIntensity: input.emotional_intensity,
      exclusionReason: input.exclusion_reason ?? null,
      responseId: input.response_id,
    },
    now()
  );
  // Confirmation only -- deliberately NEVER echoes exact_quote/redacted_quote back
  // (venture-schema-contract.md §5.4: "returns only a confirmation ... never the raw text back to
  // the caller").
  console.log(
    `ingested ${result.record.response_id} (likely_duplicate=${result.likelyDuplicate}) -- gate ` +
      `${result.gate.state} ${result.gate.have}/${result.gate.need} (target ${result.gate.target})`
  );
}

function cmdResponseCorrect(slug: string, responseId: string) {
  if (!responseId) fail(`usage: tsx src/venture/phase3.ts response-correct <slug> <response_id>`);
  const patch = JSON.parse(readStdin()) as ResponseCorrectionPatch;
  const updated = correctResponse(slug, responseId, patch, now());
  console.log(
    `corrected ${updated.response_id} (included_in_gate=${updated.included_in_gate}, ` +
      `cluster_id=${updated.cluster_id ?? "none"})`
  );
}

function cmdResponseGateStatus(slug: string) {
  const gate = getResponseGateState(slug);
  console.log(
    `response gate: ${gate.state} -- ${gate.have}/${gate.need} eligible unique respondents ` +
      `(target ${gate.target})${gate.opened_at ? `, opened ${gate.opened_at}` : ""}`
  );
}

// --- dispatch ---------------------------------------------------------------------------------

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) {
    fail(
      `usage: tsx src/venture/phase3.ts <response-ingest|response-correct|response-gate-status|` +
        `cluster|problem-score|problem-select|transformation-draft|transformation-select|` +
        `outline-draft|price|price-select|price-draft|approve|discard|restore|list> <slug> [...args]`
    );
  }
  const rules = loadRules();
  requireRulesVersionMatch(slug, rules);
  if (!GATE_EXEMPT_SUBCOMMANDS.has(sub)) {
    requireResponseGateOpen(slug);
  }
  switch (sub) {
    case "response-ingest":
      return cmdResponseIngest(slug);
    case "response-correct":
      return cmdResponseCorrect(slug, positionalArgs(rest)[0]);
    case "response-gate-status":
      return cmdResponseGateStatus(slug);
    case "cluster":
      return cmdCluster(slug);
    case "problem-score":
      return cmdProblemScore(slug);
    case "problem-select":
      return cmdProblemSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "transformation-draft":
      return cmdTransformationDraft(slug);
    case "transformation-select":
      return cmdTransformationSelect(slug);
    case "outline-draft":
      return cmdOutlineDraft(slug);
    case "price":
      return cmdPrice(slug);
    case "price-select":
      return cmdPriceSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "price-draft":
      return cmdPriceDraft(slug);
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
// one-line message via fail(), never an uncaught stack trace dump. Mirrors phase1.ts/phase2.ts's
// main().
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
