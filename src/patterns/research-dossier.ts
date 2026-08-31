import { createHash } from "node:crypto";

export const RESEARCH_DOSSIER_VERSION = "research-dossier-v2" as const;

export type ResearchDossierIntendedUse = "observation" | "hypothesis" | "experiment_input";
export type ResearchDossierDisposition = ResearchDossierIntendedUse | "revise" | "reject";
export type EvidencePool = "niche" | "broad" | "format";

export interface ResearchQuestion {
  id: string;
  text: string;
  intendedUse: ResearchDossierIntendedUse;
}

export interface ResearchSelectionPolicy {
  description: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
}

export interface ResearchEvidenceInput {
  id: string;
  accountId: string;
  sourceId: string;
  postId: string;
  platform: string;
  pool: EvidencePool;
  membershipReason: string;
  popularityScope: string;
  sampleScope: string;
  baselineScope: string;
  baselineRef: string;
  metric: {
    name: string;
    numerator: number | null;
    denominator: number | null;
    observedAt: string;
  };
  evidenceLinks: string[];
  provenance: string;
  collectedAt: string;
  caveats: string[];
  reviewStatus: "reviewed";
  reviewedBy: "Muxin";
  reviewedAt: string;
}

export interface ResearchBaselineInput {
  id: string;
  accountId: string;
  metric: string;
  numerator: number;
  denominator: number;
  windowStart: string;
  windowEnd: string;
  method: string;
  source: string;
  evidenceRefs: string[];
  caveats: string[];
  reviewStatus: "reviewed";
  reviewedBy: "Muxin";
  reviewedAt: string;
}

export interface ResearchEvidenceSelection {
  evidenceId: string;
  disposition: "include" | "exclude";
  reason: string;
}

export interface ResearchPatternSummaryInput {
  id: string;
  statement: string;
  evidenceRefs: string[];
  caveats: string[];
  originality: {
    status: "passed" | "pending" | "failed";
    checkedAgainstEvidenceRefs: string[];
    note: string;
    checkedBy: "Muxin";
    checkedAt: string;
    method: string;
  };
}

export interface ResearchDossierInput {
  question: ResearchQuestion;
  selectionPolicy: ResearchSelectionPolicy;
  evidence: ResearchEvidenceInput[];
  baselines: ResearchBaselineInput[];
  selections: ResearchEvidenceSelection[];
  summaries: ResearchPatternSummaryInput[];
}

export type ResearchEvidenceProposal = Omit<ResearchEvidenceInput, "reviewStatus" | "reviewedBy" | "reviewedAt">;
export type ResearchBaselineProposal = Omit<ResearchBaselineInput, "reviewStatus" | "reviewedBy" | "reviewedAt">;
export type ResearchOriginalityProposal = Omit<ResearchPatternSummaryInput["originality"], "status" | "checkedBy" | "checkedAt">;
export type ResearchPatternSummaryProposal = Omit<ResearchPatternSummaryInput, "originality"> & {
  originality: ResearchOriginalityProposal;
};

export interface ResearchDossierProposalInput {
  question: ResearchQuestion;
  selectionPolicy: ResearchSelectionPolicy;
  evidence: ResearchEvidenceProposal[];
  baselines: ResearchBaselineProposal[];
  selections: ResearchEvidenceSelection[];
  summaries: ResearchPatternSummaryProposal[];
}

export interface ResearchDossierReviewPacket {
  kind: "research_dossier_review_packet";
  version: "research-dossier-review-v1";
  proposal: ResearchDossierProposalInput;
  reviewStatus: "pending_muxin_evidence_review";
  bodyIncluded: false;
  winnerClaimsAllowed: false;
  digest: string;
}

export interface ResearchDossierEvidenceReviewDecision {
  reviewedBy: "Muxin";
  reviewedAt: string;
  packetDigest: string;
  policyApproved: true;
  evidenceApprovals: string[];
  baselineApprovals: string[];
  originalityApprovals: string[];
  note: string;
}

export type ResearchDossierEvidenceReviewReceipt = ResearchDossierEvidenceReviewDecision;

export interface ResearchDossierDecision {
  decidedBy: "Muxin";
  decidedAt: string;
  disposition: ResearchDossierDisposition;
  note: string;
  dossierDigest: string;
}

export interface ResearchDossier {
  kind: "research_dossier";
  version: typeof RESEARCH_DOSSIER_VERSION;
  question: ResearchQuestion;
  selectionPolicy: ResearchSelectionPolicy;
  boundedEvidence: {
    included: ResearchEvidenceInput[];
    excluded: Array<{ evidenceId: string; reason: string }>;
  };
  baselines: ResearchBaselineInput[];
  summaries: ResearchPatternSummaryInput[];
  citations: Array<{ evidenceId: string; links: string[]; provenance: string }>;
  evidenceReviewPacket: ResearchDossierReviewPacket | null;
  evidenceReview: ResearchDossierEvidenceReviewReceipt | null;
  usabilityDecision: ResearchDossierDecision | null;
  readiness: {
    status: "pending_muxin_review" | "usable" | "revision_requested" | "rejected";
    blockers: string[];
  };
  bodyIncluded: false;
  winnerClaimsAllowed: false;
  digest: string;
}

type UnknownRecord = Record<string, unknown>;

const INPUT_KEYS = new Set(["question", "selectionPolicy", "evidence", "baselines", "selections", "summaries"]);
const DOSSIER_KEYS = new Set(["kind", "version", "question", "selectionPolicy", "boundedEvidence", "baselines", "summaries", "citations", "evidenceReviewPacket", "evidenceReview", "usabilityDecision", "readiness", "bodyIncluded", "winnerClaimsAllowed", "digest"]);
const QUESTION_KEYS = new Set(["id", "text", "intendedUse"]);
const POLICY_KEYS = new Set(["description", "inclusionCriteria", "exclusionCriteria"]);
const BOUNDED_KEYS = new Set(["included", "excluded"]);
const EVIDENCE_KEYS = new Set(["id", "accountId", "sourceId", "postId", "platform", "pool", "membershipReason", "popularityScope", "sampleScope", "baselineScope", "baselineRef", "metric", "evidenceLinks", "provenance", "collectedAt", "caveats", "reviewStatus", "reviewedBy", "reviewedAt"]);
const METRIC_KEYS = new Set(["name", "numerator", "denominator", "observedAt"]);
const BASELINE_KEYS = new Set(["id", "accountId", "metric", "numerator", "denominator", "windowStart", "windowEnd", "method", "source", "evidenceRefs", "caveats", "reviewStatus", "reviewedBy", "reviewedAt"]);
const SUMMARY_KEYS = new Set(["id", "statement", "evidenceRefs", "caveats", "originality"]);
const ORIGINALITY_KEYS = new Set(["status", "checkedAgainstEvidenceRefs", "note", "checkedBy", "checkedAt", "method"]);
const EXCLUSION_KEYS = new Set(["evidenceId", "reason"]);
const CITATION_KEYS = new Set(["evidenceId", "links", "provenance"]);
const READINESS_KEYS = new Set(["status", "blockers"]);
const EVIDENCE_REVIEW_KEYS = new Set(["reviewedBy", "reviewedAt", "packetDigest", "policyApproved", "evidenceApprovals", "baselineApprovals", "originalityApprovals", "note"]);
const PROPOSAL_EVIDENCE_KEYS = new Set([...EVIDENCE_KEYS].filter((key) => key !== "reviewStatus" && key !== "reviewedBy" && key !== "reviewedAt"));
const PROPOSAL_BASELINE_KEYS = new Set([...BASELINE_KEYS].filter((key) => key !== "reviewStatus" && key !== "reviewedBy" && key !== "reviewedAt"));
const PROPOSAL_ORIGINALITY_KEYS = new Set([...ORIGINALITY_KEYS].filter((key) => key !== "status" && key !== "checkedBy" && key !== "checkedAt"));
const SELECTION_KEYS = new Set(["evidenceId", "disposition", "reason"]);
const FORBIDDEN_KEYS = new Set([
  "body", "creatorBody", "postBody", "rawBody", "transcript", "opener", "hook", "winner", "ranking", "score",
]);

function fail(message: string): never {
  throw new TypeError(`invalid research dossier: ${message}`);
}

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as UnknownRecord;
}

function assertExactKeys(value: unknown, allowed: Set<string>, label: string): UnknownRecord {
  const row = record(value, label);
  for (const key of Object.keys(row)) if (!allowed.has(key)) fail(`unknown field ${label}.${key}`);
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(row, key)) fail(`missing field ${label}.${key}`);
  return row;
}

function recordArray(value: unknown, label: string): UnknownRecord[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

function assertDossierShape(value: unknown): void {
  const dossier = assertExactKeys(value, DOSSIER_KEYS, "dossier");
  assertExactKeys(dossier.question, QUESTION_KEYS, "dossier.question");
  assertExactKeys(dossier.selectionPolicy, POLICY_KEYS, "dossier.selectionPolicy");
  const bounded = assertExactKeys(dossier.boundedEvidence, BOUNDED_KEYS, "dossier.boundedEvidence");
  for (const [index, evidence] of recordArray(bounded.included, "dossier.boundedEvidence.included").entries()) {
    const row = assertExactKeys(evidence, EVIDENCE_KEYS, `dossier.boundedEvidence.included[${index}]`);
    assertExactKeys(row.metric, METRIC_KEYS, `dossier.boundedEvidence.included[${index}].metric`);
  }
  for (const [index, exclusion] of recordArray(bounded.excluded, "dossier.boundedEvidence.excluded").entries()) {
    assertExactKeys(exclusion, EXCLUSION_KEYS, `dossier.boundedEvidence.excluded[${index}]`);
  }
  for (const [index, baseline] of recordArray(dossier.baselines, "dossier.baselines").entries()) {
    assertExactKeys(baseline, BASELINE_KEYS, `dossier.baselines[${index}]`);
  }
  for (const [index, summary] of recordArray(dossier.summaries, "dossier.summaries").entries()) {
    const row = assertExactKeys(summary, SUMMARY_KEYS, `dossier.summaries[${index}]`);
    assertExactKeys(row.originality, ORIGINALITY_KEYS, `dossier.summaries[${index}].originality`);
  }
  for (const [index, citation] of recordArray(dossier.citations, "dossier.citations").entries()) {
    assertExactKeys(citation, CITATION_KEYS, `dossier.citations[${index}]`);
  }
  if (dossier.evidenceReview !== null) assertExactKeys(dossier.evidenceReview, EVIDENCE_REVIEW_KEYS, "dossier.evidenceReview");
  assertExactKeys(dossier.readiness, READINESS_KEYS, "dossier.readiness");
}

function rejectUnsupported(value: unknown, label: string, topLevel = false): void {
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsupported(item, `${label}[${index}]`));
    return;
  }
  const row = value as UnknownRecord;
  for (const key of Object.keys(row)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`unsupported ${key} field at ${label}`);
    if (topLevel && !INPUT_KEYS.has(key)) fail(`unsupported ${key} field at ${label}`);
    rejectUnsupported(row[key], `${label}.${key}`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be a non-empty string`);
  return value.trim();
}

function strings(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const result = value.map((item, index) => text(item, `${label}[${index}]`));
  if (!allowEmpty && result.length === 0) fail(`${label} must not be empty`);
  if (new Set(result).size !== result.length) fail(`${label} must contain unique values`);
  return result.sort();
}

function webLinks(value: unknown, label: string): string[] {
  const links = strings(value, label);
  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      fail(`${label} must contain absolute http or https URLs`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") fail(`${label} must contain absolute http or https URLs`);
  }
  return links;
}

function timestamp(value: unknown, label: string): string {
  const raw = text(value, label);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) fail(`${label} must be a valid timestamp`);
  return new Date(parsed).toISOString();
}

function nonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${label} must be a non-negative number`);
  return value;
}

function positive(value: unknown, label: string): number {
  const result = nonNegative(value, label);
  if (result === 0) fail(`${label} must be greater than zero`);
  return result;
}

function normalizeQuestion(value: ResearchQuestion): ResearchQuestion {
  const row = record(value, "question");
  const intendedUse = row.intendedUse;
  if (!new Set(["observation", "hypothesis", "experiment_input"]).has(intendedUse as string)) fail("question.intendedUse is invalid");
  return { id: text(row.id, "question.id"), text: text(row.text, "question.text"), intendedUse: intendedUse as ResearchDossierIntendedUse };
}

function normalizeEvidence(value: ResearchEvidenceInput, index: number): ResearchEvidenceInput {
  const row = record(value, `evidence[${index}]`);
  const metric = record(row.metric, `evidence[${index}].metric`);
  const pool = row.pool;
  if (!new Set(["niche", "broad", "format"]).has(pool as string)) fail(`evidence[${index}].pool must be explicit`);
  if (row.reviewStatus !== "reviewed") fail(`evidence[${index}].reviewStatus must be reviewed`);
  if (row.reviewedBy !== "Muxin") fail(`evidence[${index}].reviewedBy must be Muxin`);
  if (metric.denominator === null || metric.denominator === undefined) fail(`evidence[${index}].metric.denominator is required`);
  return {
    id: text(row.id, `evidence[${index}].id`),
    accountId: text(row.accountId, `evidence[${index}].accountId`),
    sourceId: text(row.sourceId, `evidence[${index}].sourceId`),
    postId: text(row.postId, `evidence[${index}].postId`),
    platform: text(row.platform, `evidence[${index}].platform`),
    pool: pool as EvidencePool,
    membershipReason: text(row.membershipReason, `evidence[${index}].membershipReason`),
    popularityScope: text(row.popularityScope, `evidence[${index}].popularityScope`),
    sampleScope: text(row.sampleScope, `evidence[${index}].sampleScope`),
    baselineScope: text(row.baselineScope, `evidence[${index}].baselineScope`),
    baselineRef: text(row.baselineRef, `evidence[${index}].baselineRef`),
    metric: {
      name: text(metric.name, `evidence[${index}].metric.name`),
      numerator: nonNegative(metric.numerator, `evidence[${index}].metric.numerator`),
      denominator: positive(metric.denominator, `evidence[${index}].metric.denominator`),
      observedAt: timestamp(metric.observedAt, `evidence[${index}].metric.observedAt`),
    },
    evidenceLinks: webLinks(row.evidenceLinks, `evidence[${index}].evidenceLinks`),
    provenance: text(row.provenance, `evidence[${index}].provenance`),
    collectedAt: timestamp(row.collectedAt, `evidence[${index}].collectedAt`),
    caveats: strings(row.caveats, `evidence[${index}].caveats`),
    reviewStatus: "reviewed",
    reviewedBy: "Muxin",
    reviewedAt: timestamp(row.reviewedAt, `evidence[${index}].reviewedAt`),
  };
}

function normalizeBaseline(value: ResearchBaselineInput, index: number): ResearchBaselineInput {
  const row = record(value, `baselines[${index}]`);
  if (row.reviewStatus !== "reviewed") fail(`baselines[${index}].reviewStatus must be reviewed`);
  if (row.reviewedBy !== "Muxin") fail(`baselines[${index}].reviewedBy must be Muxin`);
  return {
    id: text(row.id, `baselines[${index}].id`),
    accountId: text(row.accountId, `baselines[${index}].accountId`),
    metric: text(row.metric, `baselines[${index}].metric`),
    numerator: nonNegative(row.numerator, `baselines[${index}].numerator`),
    denominator: positive(row.denominator, `baselines[${index}].denominator`),
    windowStart: timestamp(row.windowStart, `baselines[${index}].windowStart`),
    windowEnd: timestamp(row.windowEnd, `baselines[${index}].windowEnd`),
    method: text(row.method, `baselines[${index}].method`),
    source: text(row.source, `baselines[${index}].source`),
    evidenceRefs: strings(row.evidenceRefs, `baselines[${index}].evidenceRefs`),
    caveats: strings(row.caveats, `baselines[${index}].caveats`),
    reviewStatus: "reviewed",
    reviewedBy: "Muxin",
    reviewedAt: timestamp(row.reviewedAt, `baselines[${index}].reviewedAt`),
  };
}

function normalizeSummary(value: ResearchPatternSummaryInput, index: number, includedIds: Set<string>): ResearchPatternSummaryInput {
  const row = record(value, `summaries[${index}]`);
  const originality = record(row.originality, `summaries[${index}].originality`);
  if (originality.status !== "passed") fail(`summaries[${index}].originality must be passed`);
  if (originality.checkedBy !== "Muxin") fail(`summaries[${index}].originality.checkedBy must be Muxin`);
  const evidenceRefs = strings(row.evidenceRefs, `summaries[${index}].evidenceRefs`);
  for (const ref of evidenceRefs) if (!includedIds.has(ref)) fail(`summaries[${index}] references unknown evidence ${ref}`);
  const checked = strings(originality.checkedAgainstEvidenceRefs, `summaries[${index}].originality.checkedAgainstEvidenceRefs`);
  if (checked.length !== evidenceRefs.length || checked.some((ref, refIndex) => ref !== evidenceRefs[refIndex])) {
    fail(`summaries[${index}].originality must cover every cited evidence row`);
  }
  return {
    id: text(row.id, `summaries[${index}].id`),
    statement: text(row.statement, `summaries[${index}].statement`),
    evidenceRefs,
    caveats: strings(row.caveats, `summaries[${index}].caveats`),
    originality: {
      status: "passed",
      checkedAgainstEvidenceRefs: checked,
      note: text(originality.note, `summaries[${index}].originality.note`),
      checkedBy: "Muxin",
      checkedAt: timestamp(originality.checkedAt, `summaries[${index}].originality.checkedAt`),
      method: text(originality.method, `summaries[${index}].originality.method`),
    },
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as UnknownRecord).forEach(freeze);
  }
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const row = value as UnknownRecord;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
}

function digestPayload(dossier: Omit<ResearchDossier, "digest" | "readiness" | "usabilityDecision">): string {
  return `sha256:${createHash("sha256").update(stableJson(dossier)).digest("hex")}`;
}

const SYNTHETIC_REVIEW_TIME = "1970-01-01T00:00:00.000Z";

function proposalDigest(packet: Omit<ResearchDossierReviewPacket, "digest">): string {
  return `sha256:${createHash("sha256").update(stableJson(packet)).digest("hex")}`;
}

function approvalSet(value: unknown, expected: readonly string[], label: string): string[] {
  const approved = strings(value, label, expected.length === 0).sort();
  const wanted = [...expected].sort();
  if (stableJson(approved) !== stableJson(wanted)) fail(`${label} must approve every exact reviewed id`);
  return approved;
}

/**
 * Normalize a proposed evidence set without stamping it as human-reviewed. Internally, fixed
 * synthetic review values let the existing dossier validator exercise every evidence, baseline,
 * selection, citation, and originality invariant. Those values are stripped before the packet is
 * returned and never cross the review boundary.
 */
export function buildResearchDossierReviewPacket(value: ResearchDossierProposalInput): ResearchDossierReviewPacket {
  rejectUnsupported(value, "proposal", true);
  const source = assertExactKeys(value, INPUT_KEYS, "proposal");
  assertExactKeys(source.question, QUESTION_KEYS, "proposal.question");
  assertExactKeys(source.selectionPolicy, POLICY_KEYS, "proposal.selectionPolicy");
  if (!Array.isArray(source.evidence) || !Array.isArray(source.baselines) || !Array.isArray(source.selections) || !Array.isArray(source.summaries)) {
    fail("proposal evidence, baselines, selections, and summaries must be arrays");
  }
  const proposalEvidence = source.evidence.map((raw, index) => {
    const row = assertExactKeys(raw, PROPOSAL_EVIDENCE_KEYS, `proposal.evidence[${index}]`);
    assertExactKeys(row.metric, METRIC_KEYS, `proposal.evidence[${index}].metric`);
    return row as unknown as ResearchEvidenceProposal;
  });
  const proposalBaselines = source.baselines.map((raw, index) => assertExactKeys(raw, PROPOSAL_BASELINE_KEYS, `proposal.baselines[${index}]`) as unknown as ResearchBaselineProposal);
  const proposalSelections = source.selections.map((raw, index) => assertExactKeys(raw, SELECTION_KEYS, `proposal.selections[${index}]`) as unknown as ResearchEvidenceSelection);
  const proposalSummaries = source.summaries.map((raw, index) => {
    const row = assertExactKeys(raw, SUMMARY_KEYS, `proposal.summaries[${index}]`);
    const originality = assertExactKeys(row.originality, PROPOSAL_ORIGINALITY_KEYS, `proposal.summaries[${index}].originality`);
    return { ...(row as unknown as Omit<ResearchPatternSummaryProposal, "originality">), originality: originality as unknown as ResearchOriginalityProposal };
  });
  const synthetic: ResearchDossierInput = {
    question: source.question as ResearchQuestion,
    selectionPolicy: source.selectionPolicy as ResearchSelectionPolicy,
    evidence: proposalEvidence.map((row) => ({
      ...row,
      reviewStatus: "reviewed",
      reviewedBy: "Muxin",
      reviewedAt: SYNTHETIC_REVIEW_TIME,
    })),
    baselines: proposalBaselines.map((row) => ({
      ...row,
      reviewStatus: "reviewed",
      reviewedBy: "Muxin",
      reviewedAt: SYNTHETIC_REVIEW_TIME,
    })),
    selections: proposalSelections,
    summaries: proposalSummaries.map((summary) => ({
        ...summary,
        originality: {
          ...summary.originality,
          status: "passed",
          checkedBy: "Muxin",
          checkedAt: SYNTHETIC_REVIEW_TIME,
        },
      })),
  };
  buildResearchDossier(synthetic);

  const normalizedEvidence = synthetic.evidence.map((row, index) => {
    const { reviewStatus: _status, reviewedBy: _by, reviewedAt: _at, ...proposal } = normalizeEvidence(row, index);
    return proposal;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const normalizedBaselines = synthetic.baselines.map((row, index) => {
    const { reviewStatus: _status, reviewedBy: _by, reviewedAt: _at, ...proposal } = normalizeBaseline(row, index);
    return proposal;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const includedIds = new Set(synthetic.selections.filter((row) => row.disposition === "include").map((row) => row.evidenceId));
  const normalizedSummaries = synthetic.summaries.map((row, index) => {
    const normalized = normalizeSummary(row, index, includedIds);
    const { status: _status, checkedBy: _by, checkedAt: _at, ...originality } = normalized.originality;
    return { ...normalized, originality };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const dossier = buildResearchDossier(synthetic);
  const proposal: ResearchDossierProposalInput = {
    question: dossier.question,
    selectionPolicy: dossier.selectionPolicy,
    evidence: normalizedEvidence,
    baselines: normalizedBaselines,
    selections: synthetic.selections.map((row) => ({
      evidenceId: text(row.evidenceId, "proposal.selections.evidenceId"),
      disposition: row.disposition,
      reason: text(row.reason, "proposal.selections.reason"),
    })).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    summaries: normalizedSummaries,
  };
  const core: Omit<ResearchDossierReviewPacket, "digest"> = {
    kind: "research_dossier_review_packet",
    version: "research-dossier-review-v1",
    proposal,
    reviewStatus: "pending_muxin_evidence_review",
    bodyIncluded: false,
    winnerClaimsAllowed: false,
  };
  return freeze({ ...core, digest: proposalDigest(core) });
}

/** Apply only a complete, digest-bound approval. Revise/reject leaves the packet pending. */
export function recordResearchDossierEvidenceReview(
  packet: ResearchDossierReviewPacket,
  value: ResearchDossierEvidenceReviewDecision,
): ResearchDossier {
  const supplied = record(packet, "reviewPacket");
  if (supplied.kind !== "research_dossier_review_packet" || supplied.version !== "research-dossier-review-v1"
    || supplied.reviewStatus !== "pending_muxin_evidence_review" || supplied.bodyIncluded !== false
    || supplied.winnerClaimsAllowed !== false) fail("review packet contract is invalid");
  const canonical = buildResearchDossierReviewPacket(supplied.proposal as ResearchDossierProposalInput);
  if (supplied.digest !== canonical.digest || stableJson(supplied) !== stableJson(canonical)) {
    fail("review packet digest does not match; packet may have been tampered with");
  }
  const decision = assertExactKeys(value, EVIDENCE_REVIEW_KEYS, "evidenceReview");
  if (decision.reviewedBy !== "Muxin") fail("evidenceReview.reviewedBy must be Muxin");
  if (decision.packetDigest !== canonical.digest) fail("evidenceReview.packetDigest must match the reviewed packet digest");
  if (decision.policyApproved !== true) fail("evidenceReview.policyApproved must be true");
  const reviewedAt = timestamp(decision.reviewedAt, "evidenceReview.reviewedAt");
  const note = text(decision.note, "evidenceReview.note");
  const evidenceApprovals = approvalSet(decision.evidenceApprovals, canonical.proposal.evidence.map((row) => row.id), "evidenceReview.evidenceApprovals");
  const baselineApprovals = approvalSet(decision.baselineApprovals, canonical.proposal.baselines.map((row) => row.id), "evidenceReview.baselineApprovals");
  const originalityApprovals = approvalSet(decision.originalityApprovals, canonical.proposal.summaries.map((row) => row.id), "evidenceReview.originalityApprovals");

  const dossier = buildResearchDossier({
    ...canonical.proposal,
    evidence: canonical.proposal.evidence.map((row) => ({ ...row, reviewStatus: "reviewed", reviewedBy: "Muxin", reviewedAt })),
    baselines: canonical.proposal.baselines.map((row) => ({ ...row, reviewStatus: "reviewed", reviewedBy: "Muxin", reviewedAt })),
    summaries: canonical.proposal.summaries.map((row) => ({
      ...row,
      originality: { ...row.originality, status: "passed", checkedBy: "Muxin", checkedAt: reviewedAt },
    })),
  });
  const evidenceReview: ResearchDossierEvidenceReviewReceipt = {
    reviewedBy: "Muxin",
    reviewedAt,
    packetDigest: canonical.digest,
    policyApproved: true,
    evidenceApprovals,
    baselineApprovals,
    originalityApprovals,
    note,
  };
  const { digest: _digest, readiness, usabilityDecision, ...withoutDigest } = dossier;
  const core = { ...withoutDigest, evidenceReviewPacket: canonical, evidenceReview };
  return freeze({ ...core, readiness, usabilityDecision, digest: digestPayload(core) });
}

export function buildResearchDossier(input: ResearchDossierInput): ResearchDossier {
  rejectUnsupported(input, "input", true);
  const source = record(input, "input");
  const question = normalizeQuestion(source.question as ResearchQuestion);
  const policy = record(source.selectionPolicy, "selectionPolicy");
  const selectionPolicy: ResearchSelectionPolicy = {
    description: text(policy.description, "selectionPolicy.description"),
    inclusionCriteria: strings(policy.inclusionCriteria, "selectionPolicy.inclusionCriteria"),
    exclusionCriteria: strings(policy.exclusionCriteria, "selectionPolicy.exclusionCriteria"),
  };
  if (!Array.isArray(source.evidence) || source.evidence.length === 0) fail("evidence must be a non-empty array");
  if (!Array.isArray(source.baselines) || source.baselines.length === 0) fail("baselines must be a non-empty array");
  if (!Array.isArray(source.selections)) fail("selections must be an array");
  if (!Array.isArray(source.summaries) || source.summaries.length === 0) fail("summaries must be a non-empty array");

  const evidence = source.evidence.map((value, index) => normalizeEvidence(value as ResearchEvidenceInput, index));
  const evidenceIds = new Set<string>();
  for (const row of evidence) {
    if (evidenceIds.has(row.id)) fail(`duplicate evidence id ${row.id}`);
    evidenceIds.add(row.id);
  }
  const baselines = source.baselines.map((value, index) => normalizeBaseline(value as ResearchBaselineInput, index));
  const baselineById = new Map<string, ResearchBaselineInput>();
  for (const row of baselines) {
    if (baselineById.has(row.id)) fail(`duplicate baseline id ${row.id}`);
    baselineById.set(row.id, row);
  }
  for (const row of evidence) {
    const baseline = baselineById.get(row.baselineRef);
    if (!baseline) fail(`evidence ${row.id} references missing baseline ${row.baselineRef}`);
    if (baseline.accountId !== row.accountId || baseline.metric !== row.metric.name) fail(`evidence ${row.id} baseline scope does not match`);
  }

  const selectionById = new Map<string, ResearchEvidenceSelection>();
  for (const [index, value] of source.selections.entries()) {
    const row = record(value, `selections[${index}]`);
    const evidenceId = text(row.evidenceId, `selections[${index}].evidenceId`);
    if (!evidenceIds.has(evidenceId)) fail(`selection references unknown evidence ${evidenceId}`);
    if (selectionById.has(evidenceId)) fail(`duplicate selection for ${evidenceId}`);
    if (row.disposition !== "include" && row.disposition !== "exclude") fail(`selections[${index}].disposition is invalid`);
    selectionById.set(evidenceId, { evidenceId, disposition: row.disposition, reason: text(row.reason, `selections[${index}].reason`) });
  }
  for (const id of evidenceIds) if (!selectionById.has(id)) fail(`selection is required for evidence ${id}`);

  const included = evidence.filter((row) => selectionById.get(row.id)?.disposition === "include").sort((a, b) => a.id.localeCompare(b.id));
  if (included.length === 0) fail("at least one evidence row must be included");
  const includedIds = new Set(included.map((row) => row.id));
  const excluded = evidence
    .filter((row) => selectionById.get(row.id)?.disposition === "exclude")
    .map((row) => ({ evidenceId: row.id, reason: selectionById.get(row.id)!.reason }))
    .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const summaries = source.summaries.map((value, index) => normalizeSummary(value as ResearchPatternSummaryInput, index, includedIds)).sort((a, b) => a.id.localeCompare(b.id));
  const summarizedEvidenceIds = new Set(summaries.flatMap((summary) => summary.evidenceRefs));
  for (const id of includedIds) if (!summarizedEvidenceIds.has(id)) fail(`included evidence ${id} is not cited by any summary`);
  const usedBaselines = baselines.filter((row) => included.some((item) => item.baselineRef === row.id)).sort((a, b) => a.id.localeCompare(b.id));
  const core: Omit<ResearchDossier, "digest" | "readiness" | "usabilityDecision"> = {
    kind: "research_dossier",
    version: RESEARCH_DOSSIER_VERSION,
    question,
    selectionPolicy,
    boundedEvidence: { included, excluded },
    baselines: usedBaselines,
    summaries,
    citations: included.map((row) => ({ evidenceId: row.id, links: row.evidenceLinks, provenance: row.provenance })),
    evidenceReviewPacket: null,
    evidenceReview: null,
    bodyIncluded: false,
    winnerClaimsAllowed: false,
  };
  const dossier: ResearchDossier = {
    ...core,
    usabilityDecision: null,
    readiness: { status: "pending_muxin_review", blockers: ["Muxin usability decision is required"] },
    digest: digestPayload(core),
  };
  return freeze(dossier);
}

export function recordResearchDossierDecision(dossier: ResearchDossier, input: ResearchDossierDecision): ResearchDossier {
  assertDossierShape(dossier);
  if (dossier.kind !== "research_dossier" || dossier.version !== RESEARCH_DOSSIER_VERSION || dossier.bodyIncluded !== false || dossier.winnerClaimsAllowed !== false) {
    fail("dossier contract is invalid");
  }
  if (dossier.usabilityDecision !== null) fail("dossier already has a usability decision");
  if (dossier.evidenceReviewPacket === null || dossier.evidenceReview === null) {
    fail("digest-bound Muxin evidence review packet and receipt are required before a usability decision");
  }
  if (dossier.readiness.status !== "pending_muxin_review"
    || stableJson(dossier.readiness.blockers) !== stableJson(["Muxin usability decision is required"])) {
    fail("only a canonical pending dossier may receive a decision");
  }
  const includedIds = new Set<string>();
  for (const row of dossier.boundedEvidence.included) {
    if (includedIds.has(row.id)) fail(`duplicate evidence id ${row.id}`);
    includedIds.add(row.id);
  }
  const normalizedExclusions = dossier.boundedEvidence.excluded.map((value, index) => ({
    evidenceId: text(value.evidenceId, `dossier.boundedEvidence.excluded[${index}].evidenceId`),
    reason: text(value.reason, `dossier.boundedEvidence.excluded[${index}].reason`),
  })).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const exclusionIds = new Set<string>();
  for (const row of normalizedExclusions) {
    if (includedIds.has(row.evidenceId)) fail(`excluded evidence ${row.evidenceId} is also included`);
    if (exclusionIds.has(row.evidenceId)) fail(`duplicate excluded evidence id ${row.evidenceId}`);
    exclusionIds.add(row.evidenceId);
  }
  const canonicalReviewed = recordResearchDossierEvidenceReview(dossier.evidenceReviewPacket, dossier.evidenceReview);
  const { digest: _canonicalDigest, readiness: _canonicalReadiness, usabilityDecision: _canonicalDecision, ...canonicalReviewedCore } = canonicalReviewed;
  const { digest: _suppliedDigest, readiness: _suppliedReadiness, usabilityDecision: _suppliedDecision, ...suppliedReviewedCore } = dossier;
  if (stableJson(canonicalReviewedCore) !== stableJson(suppliedReviewedCore)) {
    fail("dossier does not canonically match its evidence review packet and receipt");
  }
  const rebuilt = buildResearchDossier({
    question: dossier.question,
    selectionPolicy: dossier.selectionPolicy,
    evidence: dossier.boundedEvidence.included,
    baselines: dossier.baselines,
    selections: dossier.boundedEvidence.included.map((row) => ({ evidenceId: row.id, disposition: "include", reason: "canonical included dossier row" })),
    summaries: dossier.summaries,
  });
  const canonicalComponents = {
    question: rebuilt.question,
    selectionPolicy: rebuilt.selectionPolicy,
    included: rebuilt.boundedEvidence.included,
    excluded: normalizedExclusions,
    baselines: rebuilt.baselines,
    summaries: rebuilt.summaries,
    citations: rebuilt.citations,
  };
  const suppliedComponents = {
    question: dossier.question,
    selectionPolicy: dossier.selectionPolicy,
    included: dossier.boundedEvidence.included,
    excluded: dossier.boundedEvidence.excluded,
    baselines: dossier.baselines,
    summaries: dossier.summaries,
    citations: dossier.citations,
  };
  if (stableJson(canonicalComponents) !== stableJson(suppliedComponents)) fail("dossier values are not canonical");
  const { digest, readiness: _readiness, usabilityDecision: _decision, ...core } = dossier;
  const expectedDigest = digestPayload(core);
  if (digest !== expectedDigest) fail("dossier digest does not match; dossier may have been tampered with");
  const row = record(input, "decision");
  if (row.decidedBy !== "Muxin") fail("decision.decidedBy must be Muxin");
  if (row.dossierDigest !== digest) fail("decision.dossierDigest must match the reviewed dossier digest");
  const disposition = row.disposition;
  if (!new Set(["observation", "hypothesis", "experiment_input", "revise", "reject"]).has(disposition as string)) fail("decision.disposition is invalid");
  const decision: ResearchDossierDecision = {
    decidedBy: "Muxin",
    decidedAt: timestamp(row.decidedAt, "decision.decidedAt"),
    disposition: disposition as ResearchDossierDisposition,
    note: text(row.note, "decision.note"),
    dossierDigest: digest,
  };
  const status = disposition === "revise" ? "revision_requested" : disposition === "reject" ? "rejected" : "usable";
  return freeze({ ...dossier, usabilityDecision: decision, readiness: { status, blockers: [] } });
}

/**
 * Replays both human-review gates and every canonical digest check before a downstream
 * consumer is allowed to treat a serialized dossier as reviewed evidence.
 */
export function validateUsableResearchDossier(value: unknown): ResearchDossier {
  assertDossierShape(value);
  const dossier = value as ResearchDossier;
  if (dossier.readiness.status !== "usable" || dossier.readiness.blockers.length !== 0 || dossier.usabilityDecision === null) {
    fail("dossier must have a usable Muxin decision");
  }
  if (!new Set<ResearchDossierDisposition>(["observation", "hypothesis", "experiment_input"]).has(dossier.usabilityDecision.disposition)) {
    fail("dossier usability decision does not authorize downstream evidence use");
  }
  const pending: ResearchDossier = {
    ...dossier,
    usabilityDecision: null,
    readiness: { status: "pending_muxin_review", blockers: ["Muxin usability decision is required"] },
  };
  const replayed = recordResearchDossierDecision(pending, dossier.usabilityDecision);
  if (stableJson(replayed) !== stableJson(dossier)) fail("usable dossier does not canonically replay its review decisions");
  return replayed;
}
