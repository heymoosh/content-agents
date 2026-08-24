import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoolBestReport, renderPoolBestReportMarkdown } from "./pool-best-report.js";
import type { AccountBaseline } from "./types.js";
import type { ReviewMetadataInput } from "./review-metadata.js";
import type { SourceEvidenceRow } from "./source-evidence.js";

const review = (name: string, pool: "niche" | "broad", nicheLabel = "civic technology"): ReviewMetadataInput => ({
  currentAccountKey: `linkedin:${name}`,
  platform: "linkedin",
  handle: name,
  stableAccountId: `account-${name}`,
  stableAccountIdStatus: "reviewed",
  topics: ["human inference", "civic technology"],
  focus: ["how people make decisions"],
  nicheLabel,
  researchPoolMembership: [{ pool, reason: `Muxin reviewed ${pool} membership for ${name}.` }],
  popularityScope: pool === "niche" ? "civic technology creators on LinkedIn" : "LinkedIn platform examples",
  sampleScope: "fixed reviewed source-post set",
  baselineScope: "LinkedIn /new baseline",
  baselineSource: "baseline-ledger",
  medium: "text",
  format: "short post",
  audienceSnapshot: { size: 10000, countType: "followers", provenance: "profile snapshot", asOf: "2026-08-20", collectedAt: "2026-08-21" },
  evidenceLinks: [`evidence://${name}`],
  reviewer: "muxin",
  reviewNote: "reviewed fixture",
  disposition: "reviewed",
  reviewed_at: "2026-08-23T12:00:00Z",
  caveats: ["fixture evidence"],
});

const evidence = (name: string, value: number, pool: "niche" | "broad" = "niche", overrides: Partial<SourceEvidenceRow> = {}): SourceEvidenceRow => ({
  id: `evidence-${name}`,
  sourceId: `source-${name}`,
  postId: `post-${name}`,
  accountId: `account-${name}`,
  platform: "linkedin",
  medium: "text",
  format: "short post",
  pool,
  membershipReason: `reviewed ${pool} membership`,
  audienceSizeSnapshot: { size: 10000, countType: "followers", observedAt: "2026-08-20", collectedAt: "2026-08-21", evidenceSource: "profile" },
  metricSnapshot: { metric: "views", value, unit: "views", numerator: value, denominator: 10000, window: "2026-08", scope: "post", observedAt: "2026-08-22" },
  popularityScope: pool === "niche" ? "civic technology creators on LinkedIn" : "LinkedIn platform examples",
  sampleScope: "fixed reviewed source-post set",
  baselineScope: "LinkedIn /new baseline",
  evidenceLinks: [`evidence://${name}`],
  baselineSource: "baseline-ledger",
  bodyComplete: true,
  caveats: ["fixture evidence"],
  provenance: "reviewed post snapshot",
  observedAt: "2026-08-22",
  collectedAt: "2026-08-23",
  reviewStatus: "reviewed",
  status: "ready",
  lineage: [{ recordType: "source", id: `source-${name}`, relation: "observes" }],
  handle: name,
  creator: name[0]?.toUpperCase() + name.slice(1),
  url: `https://example.test/${name}`,
  sourceRole: "reviewed example",
  listing: "fixed reviewed source-post set",
  window: "2026-08",
  rank: 1,
  evidenceLocation: "public post",
  metric: { name: "views", numerator: value, denominator: 10000, window: "2026-08", scope: "post" },
  selectionRule: "fixed reviewed source-post set",
  readiness: { status: "ready", reason: "complete", blockingFields: [] },
  ...overrides,
});

const baseline = (name: string, median = 100, metric: AccountBaseline["metric"] = "views"): AccountBaseline => ({
  platform: "linkedin",
  handle: name,
  metric,
  terms: metric === "views" ? ["views"] : ["likes", "comments"],
  median,
  sample_size: 10,
  window_start: "2026-08-01",
  window_end: "2026-08-20",
  scores: [median, median, median],
  followers: 10000,
  method: "settled /new sample",
  collected_at: "2026-08-21T00:00:00Z",
});

test("reports the best niche example and creator only inside a declared comparable set", () => {
  const report = buildPoolBestReport({
    evidence: [evidence("alice", 300), evidence("bob", 100)],
    reviews: [review("alice", "niche"), review("bob", "niche")],
    baselines: [baseline("alice"), baseline("bob")],
    minimumComparableCandidates: 2,
  });

  assert.equal(report.summary.winnerGroups, 1);
  assert.deepEqual(report.groups[0]?.bestExampleIds, ["evidence-alice"]);
  assert.deepEqual(report.groups[0]?.bestCreators, [{ id: "evidence-alice", handle: "alice", creator: "Alice" }]);
  assert.equal(report.candidates.find((candidate) => candidate.id === "evidence-alice")?.multiple, 3);
  assert.equal(report.candidates.find((candidate) => candidate.id === "evidence-alice")?.claimStatus, "winner");
  assert.equal(report.candidates.find((candidate) => candidate.id === "evidence-alice")?.bodyIncluded, false);
  assert.equal(JSON.stringify(report).includes("creator body"), false);
});

test("keeps broad platform and separate niche labels from being mixed", () => {
  const report = buildPoolBestReport({
    evidence: [
      evidence("civic", 300, "niche"),
      evidence("health", 500, "niche"),
      evidence("broad-a", 700, "broad"),
      evidence("broad-b", 600, "broad"),
    ],
    reviews: [review("civic", "niche", "civic technology"), review("health", "niche", "health systems"), review("broad-a", "broad"), review("broad-b", "broad")],
    baselines: [baseline("civic"), baseline("health"), baseline("broad-a"), baseline("broad-b")],
    minimumComparableCandidates: 2,
  });
  assert.equal(report.groups.length, 3);
  assert.deepEqual(report.groups.map((group) => group.nicheLabel), [null, "civic technology", "health systems"]);
  assert.equal(report.groups.find((group) => group.pool === "broad")?.bestExampleIds[0], "evidence-broad-a");
});

test("exact ties remain ties and are not broken by creator or account size", () => {
  const report = buildPoolBestReport({
    evidence: [evidence("alice", 300), evidence("bob", 300)],
    reviews: [review("alice", "niche"), review("bob", "niche")],
    baselines: [baseline("alice"), baseline("bob")],
    minimumComparableCandidates: 2,
  });
  assert.deepEqual(report.groups[0]?.bestExampleIds, ["evidence-alice", "evidence-bob"]);
  assert.deepEqual(report.candidates.map((candidate) => [candidate.id, candidate.rank]), [["evidence-alice", 1], ["evidence-bob", 1]]);
});

test("blocks missing review, baseline, and metric facts instead of naming a winner", () => {
  const report = buildPoolBestReport({
    evidence: [evidence("pending", 900, "niche"), evidence("missing-baseline", 800, "niche"), evidence("metric-mismatch", 700, "niche")],
    reviews: [
      { ...review("pending", "niche"), disposition: "pending", reviewed_at: null },
      review("missing-baseline", "niche"),
      review("metric-mismatch", "niche"),
    ],
    baselines: [baseline("metric-mismatch", 100, "engagement")],
    minimumComparableCandidates: 2,
  });
  assert.equal(report.summary.winnerGroups, 0);
  assert.equal(report.summary.blockedGroups, 3);
  assert.ok(report.candidates.every((candidate) => candidate.claimStatus === "not_claimed"));
  assert.ok(report.candidates.some((candidate) => candidate.readiness.blockers.includes("account metadata is pending")));
  assert.ok(report.candidates.some((candidate) => candidate.readiness.blockers.includes("recorded baseline is missing")));
  assert.ok(report.candidates.some((candidate) => candidate.readiness.blockers.includes("metric does not match recorded baseline")));
  assert.match(renderPoolBestReportMarkdown(report), /Blocked groups/);
});

test("blocks a zero recorded baseline instead of producing an infinite multiple", () => {
  const report = buildPoolBestReport({
    evidence: [evidence("zero-a", 100), evidence("zero-b", 50)],
    reviews: [review("zero-a", "niche"), review("zero-b", "niche")],
    baselines: [baseline("zero-a", 0), baseline("zero-b", 0)],
    minimumComparableCandidates: 2,
  });
  assert.equal(report.groups[0]?.status, "blocked");
  assert.ok(report.candidates.every((candidate) => candidate.multiple === null));
  assert.ok(report.candidates.every((candidate) => candidate.readiness.blockers.includes("recorded baseline median must be positive")));
});

test("blocks an explicitly sibling or winners-only baseline even when numbers are present", () => {
  const report = buildPoolBestReport({
    evidence: [evidence("selected-a", 100, "niche", { baselineSource: "top winners listing" }), evidence("selected-b", 50, "niche", { baselineSource: "top winners listing" })],
    reviews: [review("selected-a", "niche"), review("selected-b", "niche")],
    baselines: [baseline("selected-a"), baseline("selected-b")],
    minimumComparableCandidates: 2,
  });
  assert.equal(report.summary.winnerGroups, 0);
  assert.ok(report.candidates.every((candidate) => candidate.readiness.blockers.includes("baseline is a selected or winners-only sample")));
});
