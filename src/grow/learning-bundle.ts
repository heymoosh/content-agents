import type { BlueprintLineage } from "../review/learning-packet.js";
import type { SourceEvidenceRow } from "../patterns/source-evidence.js";
import type { CommentLearningHypothesis, CommentLearningView } from "./comment-learning.js";

/** Pure join from explicit Signals hypotheses to reviewed feed context. */
export const LEARNING_BUNDLE_VERSION = "grow-learning-bundle-v1" as const;

export type LearningBundleType = "product" | "lead";
export type LearningBundleQualification = "hypothesis" | "qualified";
export type LearningBundleDecision = "pending" | "adopted" | "declined";

export interface LearningBundleProposalInput {
  readonly id: string;
  readonly type: LearningBundleType;
  readonly statement: string;
  readonly basisRecordIds: readonly string[];
  readonly feedContextIds: readonly string[];
  readonly scope: string;
  readonly sampleSize: number;
  readonly caveats: readonly string[];
  readonly qualification: LearningBundleQualification;
  readonly muxinDecision: LearningBundleDecision;
  readonly lineage: BlueprintLineage;
}

export interface LearningBundleProposal extends LearningBundleProposalInput {
  readonly basisHypotheses: readonly Pick<CommentLearningHypothesis, "id" | "signal" | "qualification" | "evidenceRefs">[];
  readonly feedContext: { readonly ids: string[]; readonly blockers: string[] };
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly status: "hypothesis" | "qualified";
}

export interface LearningBundle {
  readonly kind: "grow_learning_bundle";
  readonly version: typeof LEARNING_BUNDLE_VERSION;
  readonly lineage: BlueprintLineage;
  readonly proposals: LearningBundleProposal[];
  readonly summary: { readonly total: number; readonly ready: number; readonly blocked: number; readonly adopted: number };
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly sideEffects: "none";
}

export interface LearningBundleInput {
  readonly lineage: BlueprintLineage;
  readonly learningView: CommentLearningView;
  readonly feedEvidence: readonly SourceEvidenceRow[];
  readonly proposals: readonly LearningBundleProposalInput[];
}

function fail(message: string): never {
  throw new TypeError(`invalid learning bundle input: ${message}`);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value.trim();
}

function sameLineage(left: BlueprintLineage, right: BlueprintLineage): boolean {
  return left.sourceId === right.sourceId && left.variantId === right.variantId && left.experimentId === right.experimentId;
}

function uniqueStrings(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.trim() === "")) fail(`${field} must contain non-empty strings`);
  return [...new Set(values.map((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
}

function feedIdSet(rows: readonly SourceEvidenceRow[]): Map<string, SourceEvidenceRow> {
  const result = new Map<string, SourceEvidenceRow>();
  for (const row of rows) {
    for (const value of [row.id, row.sourceId, row.postId]) {
      if (value !== null && value !== "unknown") result.set(value, row);
    }
  }
  return result;
}

function feedBlockers(row: SourceEvidenceRow | undefined, bundleLineage: BlueprintLineage): string[] {
  if (row === undefined) return ["feed context evidence is missing"];
  const blockers: string[] = [];
  if (row.sourceId !== bundleLineage.sourceId) blockers.push("feed context source lineage does not match bundle");
  if (row.lineage === null || row.lineage === "unknown" || row.lineage.length === 0) {
    blockers.push("feed context lineage is missing");
  } else if (!row.lineage.some((reference) => reference.recordType === "source" && reference.id === bundleLineage.sourceId)) {
    blockers.push("feed context source lineage does not match bundle");
  }
  if (row.readiness.status !== "ready" || row.status !== "ready" || row.reviewStatus !== "reviewed") blockers.push("feed context is not reviewed and ready");
  if (row.bodyComplete !== true) blockers.push("feed context is not body-complete evidence");
  if (row.pool === null || row.membershipReason === null || row.membershipReason === "unknown") blockers.push("feed context pool membership is incomplete");
  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") blockers.push("feed context metric is missing");
  else if ([row.metricSnapshot.metric, row.metricSnapshot.value, row.metricSnapshot.unit, row.metricSnapshot.numerator,
    row.metricSnapshot.denominator, row.metricSnapshot.window, row.metricSnapshot.scope, row.metricSnapshot.observedAt]
    .some((value) => value === null || value === "unknown")) blockers.push("feed context metric is incomplete");
  if (row.evidenceLinks === null || row.evidenceLinks === "unknown" || row.evidenceLinks.length === 0) blockers.push("feed context evidence links are missing");
  if (row.provenance === null || row.provenance === "unknown" || row.observedAt === null || row.observedAt === "unknown" || row.collectedAt === null || row.collectedAt === "unknown") blockers.push("feed context provenance or dates are missing");
  return [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
}

function hypothesisView(hypothesis: CommentLearningHypothesis): Pick<CommentLearningHypothesis, "id" | "signal" | "qualification" | "evidenceRefs"> {
  return { id: hypothesis.id, signal: hypothesis.signal, qualification: hypothesis.qualification, evidenceRefs: [...hypothesis.evidenceRefs].sort() };
}

function proposalFor(
  input: LearningBundleProposalInput,
  bundleLineage: BlueprintLineage,
  learningView: CommentLearningView,
  feedIndex: Map<string, SourceEvidenceRow>,
): LearningBundleProposal {
  const blockers: string[] = [];
  const basisRecordIds = uniqueStrings(input.basisRecordIds, `proposals[${input.id}].basisRecordIds`);
  const feedContextIds = uniqueStrings(input.feedContextIds, `proposals[${input.id}].feedContextIds`);
  const statement = text(input.statement, `proposals[${input.id}].statement`);
  const scope = text(input.scope, `proposals[${input.id}].scope`);
  if (!Number.isInteger(input.sampleSize) || input.sampleSize < 1) fail(`proposals[${input.id}].sampleSize must be a positive integer`);
  if (input.type !== "product" && input.type !== "lead") fail(`proposals[${input.id}].type must be product or lead`);
  if (input.qualification !== "hypothesis" && input.qualification !== "qualified") fail(`proposals[${input.id}].qualification is invalid`);
  if (input.muxinDecision !== "pending" && input.muxinDecision !== "adopted" && input.muxinDecision !== "declined") fail(`proposals[${input.id}].muxinDecision is invalid`);
  if (!sameLineage(input.lineage, bundleLineage)) blockers.push("proposal lineage does not match bundle lineage");
  if (basisRecordIds.length === 0) blockers.push("basis record ids are missing");
  const hypothesisById = new Map(learningView.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis]));
  const basisHypotheses = basisRecordIds.flatMap((id) => {
    const hypothesis = hypothesisById.get(id);
    if (!hypothesis) {
      blockers.push(`basis hypothesis ${id} is missing`);
      return [];
    }
    if (!sameLineage(hypothesis.lineage, bundleLineage)) blockers.push(`basis hypothesis ${id} lineage does not match bundle`);
    if (hypothesis.evidenceRefs.length === 0) blockers.push(`basis hypothesis ${id} evidence is missing`);
    return [hypothesisView(hypothesis)];
  });
  const feedBlockerList = feedContextIds.flatMap((id) => feedBlockers(feedIndex.get(id), bundleLineage));
  blockers.push(...feedBlockerList);
  if (input.qualification === "qualified" && !basisHypotheses.some((hypothesis) =>
    hypothesis.qualification === "qualified" && ["qualified_inquiry", "call", "opportunity", "purchase"].includes(hypothesis.signal))) {
    blockers.push("qualified status requires an evidence-backed funnel or business basis");
  }
  if (input.muxinDecision === "adopted" && blockers.length > 0) blockers.push("adopted proposal is blocked until its evidence is complete");
  const uniqueBlockers = [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
  return {
    ...input,
    id: text(input.id, "proposal.id"),
    statement,
    basisRecordIds,
    feedContextIds,
    scope,
    caveats: uniqueStrings(input.caveats, `proposals[${input.id}].caveats`),
    basisHypotheses,
    feedContext: { ids: feedContextIds, blockers: [...new Set(feedBlockerList)].sort((left, right) => left.localeCompare(right)) },
    readiness: { status: uniqueBlockers.length === 0 ? "ready" : "blocked", blockers: uniqueBlockers },
    status: input.qualification,
  };
}

/** Assemble explicit learning proposals without creating feedback, experiment, or Venture records. */
export function buildLearningBundle(input: LearningBundleInput): LearningBundle {
  const lineage = {
    sourceId: text(input.lineage.sourceId, "lineage.sourceId"),
    variantId: text(input.lineage.variantId, "lineage.variantId"),
    experimentId: text(input.lineage.experimentId, "lineage.experimentId"),
  };
  const feedIndex = feedIdSet(input.feedEvidence);
  const ids = new Set<string>();
  const proposals = input.proposals.map((proposal) => {
    const id = text(proposal.id, "proposal.id");
    if (ids.has(id)) fail(`proposals contain duplicate id ${id}`);
    ids.add(id);
    return proposalFor({ ...proposal, id }, lineage, input.learningView, feedIndex);
  }).sort((left, right) => left.id.localeCompare(right.id));
  return {
    kind: "grow_learning_bundle",
    version: LEARNING_BUNDLE_VERSION,
    lineage,
    proposals,
    summary: {
      total: proposals.length,
      ready: proposals.filter((proposal) => proposal.readiness.status === "ready").length,
      blocked: proposals.filter((proposal) => proposal.readiness.status === "blocked").length,
      adopted: proposals.filter((proposal) => proposal.muxinDecision === "adopted").length,
    },
    autoClaimsDemand: false,
    ventureArtifacts: false,
    sideEffects: "none",
  };
}

export const createLearningBundle = buildLearningBundle;

export function renderLearningBundleJson(bundle: LearningBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function renderLearningBundleMarkdown(bundle: LearningBundle): string {
  const lines = [
    "# Learning bundle",
    "",
    `Proposals: ${bundle.summary.total}; ready: ${bundle.summary.ready}; blocked: ${bundle.summary.blocked}; adopted: ${bundle.summary.adopted}`,
    "",
    "| Status | Decision | Type | Qualification | Statement | Basis | Feed context | Blockers |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...bundle.proposals.map((proposal) => `| ${proposal.readiness.status} | ${proposal.muxinDecision} | ${proposal.type} | ${proposal.qualification} | ${proposal.statement.replaceAll("|", "\\|")} | ${proposal.basisRecordIds.join(", ")} | ${proposal.feedContextIds.join(", ") || "null"} | ${proposal.readiness.blockers.join("; ") || "null"} |`),
    "",
    "Feed context is descriptive evidence only. Comment, feed, and attention signals do not prove demand or willingness to pay; no Venture artifact is created here.",
  ];
  return `${lines.join("\n")}\n`;
}
