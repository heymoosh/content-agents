import assert from "node:assert/strict";
import test from "node:test";
import type { CommentLearningView } from "./comment-learning.js";
import { buildLearningBundle, renderLearningBundleMarkdown, type LearningBundleProposalInput } from "./learning-bundle.js";
import type { SourceEvidenceRow } from "../patterns/source-evidence.js";

const lineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };

const learningView: CommentLearningView = {
  kind: "grow_comment_learning_view",
  version: "grow-comment-learning-v1",
  hypotheses: [
    {
      id: "funnel-1",
      type: "lead",
      signal: "qualified_inquiry",
      qualification: "qualified",
      confidence: "high",
      lineage,
      evidenceRefs: ["funnel-evidence"],
      sourceRecordIds: ["funnel-1"],
      muxinDecision: "pending",
    },
    {
      id: "comment-1",
      type: "product",
      signal: "comment",
      qualification: "uncertain",
      confidence: "low",
      lineage,
      evidenceRefs: ["comment-evidence"],
      sourceRecordIds: ["comment-1"],
      muxinDecision: "pending",
    },
  ],
  muxinDecision: "pending",
  readiness: { status: "ready", blockers: [] },
  autoClaimsDemand: false,
  ventureArtifacts: false,
  sideEffects: "none",
};

const feedEvidence = (overrides: Partial<SourceEvidenceRow> = {}): SourceEvidenceRow => ({
  id: "feed-1", sourceId: "source-1", postId: "post-1", accountId: "account-1",
  platform: "linkedin", medium: "text", format: "short post", pool: "niche",
  membershipReason: "reviewed niche membership", audienceSizeSnapshot: null,
  metricSnapshot: { metric: "reactions", value: 240, unit: "count", numerator: 240, denominator: 10000, window: "lifetime", scope: "post", observedAt: "2026-08-23" },
  popularityScope: "niche creators on LinkedIn", sampleScope: "fixed reviewed sample", baselineScope: "LinkedIn /new baseline",
  evidenceLinks: ["https://example.test/post-1"], baselineSource: "baseline-ledger", bodyComplete: true,
  caveats: ["fixture"], provenance: "reviewed post snapshot", observedAt: "2026-08-23", collectedAt: "2026-08-23",
  reviewStatus: "reviewed", status: "ready", lineage: [{ recordType: "source", id: "source-1", relation: "evidences" }],
  handle: "creator-1", creator: "Creator 1", url: "https://example.test/post-1", sourceRole: "niche creator",
  listing: "fixed reviewed sample", window: "lifetime", rank: 1, evidenceLocation: "public post",
  metric: { name: "reactions", numerator: 240, denominator: 10000, window: "lifetime", scope: "post" }, selectionRule: "fixed reviewed sample",
  readiness: { status: "ready", reason: "complete", blockingFields: [] }, ...overrides,
});

const proposal = (overrides: Partial<LearningBundleProposalInput> = {}): LearningBundleProposalInput => ({
  id: "proposal-1", type: "lead", statement: "Test a focused workflow offer.", basisRecordIds: ["funnel-1"], feedContextIds: ["feed-1"],
  scope: "LinkedIn civic technology audience", sampleSize: 1, caveats: ["fixture only"], qualification: "qualified", muxinDecision: "pending", lineage,
  ...overrides,
});

test("joins a qualified funnel hypothesis to reviewed feed context without creating demand or Venture artifacts", () => {
  const bundle = buildLearningBundle({ lineage, learningView, feedEvidence: [feedEvidence()], proposals: [proposal()] });

  assert.equal(bundle.summary.ready, 1);
  assert.equal(bundle.proposals[0]?.readiness.status, "ready");
  assert.equal(bundle.proposals[0]?.status, "qualified");
  assert.equal(bundle.autoClaimsDemand, false);
  assert.equal(bundle.ventureArtifacts, false);
  assert.deepEqual(bundle.proposals[0]?.basisHypotheses[0], {
    id: "funnel-1", signal: "qualified_inquiry", qualification: "qualified", evidenceRefs: ["funnel-evidence"],
  });
  assert.equal(JSON.stringify(bundle).includes("creator body"), false);
});

test("keeps a comment-only hypothesis reviewable without treating comments as qualified demand", () => {
  const bundle = buildLearningBundle({
    lineage, learningView, feedEvidence: [],
    proposals: [proposal({ id: "comment-proposal", type: "product", basisRecordIds: ["comment-1"], feedContextIds: [], qualification: "hypothesis" })],
  });

  assert.equal(bundle.proposals[0]?.readiness.status, "ready");
  assert.equal(bundle.proposals[0]?.status, "hypothesis");
  assert.equal(bundle.proposals[0]?.feedContext.blockers.length, 0);
});

test("requires an evidence-backed funnel or business basis for qualified status", () => {
  const commentClaim = buildLearningBundle({
    lineage, learningView, feedEvidence: [],
    proposals: [proposal({ id: "comment-claim", basisRecordIds: ["comment-1"], feedContextIds: [], qualification: "qualified" })],
  });
  assert.equal(commentClaim.proposals[0]?.readiness.status, "blocked");
  assert.ok(commentClaim.proposals[0]?.readiness.blockers.includes("qualified status requires an evidence-backed funnel or business basis"));

  const feedOnlyClaim = buildLearningBundle({
    lineage, learningView, feedEvidence: [feedEvidence()],
    proposals: [proposal({ id: "feed-only-claim", basisRecordIds: [], qualification: "qualified" })],
  });
  assert.equal(feedOnlyClaim.proposals[0]?.readiness.status, "blocked");
  assert.ok(feedOnlyClaim.proposals[0]?.readiness.blockers.includes("qualified status requires an evidence-backed funnel or business basis"));
});

test("blocks qualified claims when feed context is missing or belongs to another source lineage", () => {
  const missing = buildLearningBundle({ lineage, learningView, feedEvidence: [], proposals: [proposal()] });
  assert.equal(missing.proposals[0]?.readiness.status, "blocked");
  assert.ok(missing.proposals[0]?.readiness.blockers.includes("feed context evidence is missing"));

  const mismatched = buildLearningBundle({ lineage, learningView, feedEvidence: [feedEvidence({ sourceId: "other-source", lineage: [{ recordType: "source", id: "other-source", relation: "evidences" }] })], proposals: [proposal()] });
  assert.equal(mismatched.proposals[0]?.readiness.status, "blocked");
  assert.ok(mismatched.proposals[0]?.readiness.blockers.includes("feed context source lineage does not match bundle"));
});

test("preserves adopted and declined decisions while keeping incomplete proposals blocked", () => {
  const bundle = buildLearningBundle({
    lineage, learningView, feedEvidence: [feedEvidence({ bodyComplete: false })],
    proposals: [proposal({ id: "adopted", muxinDecision: "adopted" }), proposal({ id: "declined", muxinDecision: "declined", qualification: "hypothesis", feedContextIds: [] })],
  });
  assert.equal(bundle.summary.adopted, 1);
  assert.equal(bundle.proposals.find((item) => item.id === "adopted")?.readiness.status, "blocked");
  assert.ok(bundle.proposals.find((item) => item.id === "adopted")?.readiness.blockers.includes("adopted proposal is blocked until its evidence is complete"));
  assert.equal(bundle.proposals.find((item) => item.id === "declined")?.muxinDecision, "declined");
  assert.match(renderLearningBundleMarkdown(bundle), /Feed context is descriptive evidence only/);
});

test("rejects duplicate proposal ids and mismatched proposal lineage", () => {
  assert.throws(() => buildLearningBundle({ lineage, learningView, feedEvidence: [], proposals: [proposal(), proposal()] }), /duplicate id/);
  const bundle = buildLearningBundle({ lineage, learningView, feedEvidence: [], proposals: [proposal({ lineage: { ...lineage, variantId: "other-variant" }, feedContextIds: [], qualification: "hypothesis" })] });
  assert.ok(bundle.proposals[0]?.readiness.blockers.includes("proposal lineage does not match bundle lineage"));
});
