import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPlatformTreatmentBlueprint,
  type PlatformTreatmentBlueprintInputRow,
} from "./platform-treatment-blueprint.js";

function mechanism(id: string, name: string): NonNullable<PlatformTreatmentBlueprintInputRow["mechanisms"]["hook"]> {
  return {
    id,
    name,
    sequence: ["claim", "consequence", "response"],
    sourceSlots: ["claim", "example", "point-of-view"],
    nativeAffordances: ["reply prompt"],
  };
}

function row(overrides: Partial<PlatformTreatmentBlueprintInputRow> = {}): PlatformTreatmentBlueprintInputRow {
  return {
    id: "blueprint:x:short-post:ai-building",
    overlayKind: "hypothesis",
    platform: "x",
    medium: "text",
    format: "short-post",
    evidencePool: "niche",
    niche: "ai-building",
    topic: "AI workflows for one-person businesses",
    analysisRefs: ["analysis:x-example"],
    sourceRefs: ["source:x-example"],
    baselineRefs: ["baseline:x-account"],
    discoverySurfaces: ["home feed", "search"],
    responseIntent: "reply or repost with a concrete example",
    mechanisms: {
      hook: mechanism("hook:concrete-consequence", "concrete consequence opener"),
      structure: mechanism("structure:compressed-case", "compressed case arc"),
      retentionPayoff: mechanism("retention:open-loop", "open loop with a specific payoff"),
      cta: mechanism("cta:reply-example", "invite a useful example"),
      format: mechanism("format:short-post", "short post with a clear stopping point"),
    },
    patternRefs: ["pattern:concrete-consequence"],
    hookTemplateRefs: ["hook:concrete-consequence"],
    platformConfigRef: "config/platforms.yaml#platforms.x",
    spinAngleRef: "spin:original-substance",
    evidenceStatus: "hypothesis",
    caveats: ["Observed signal, not a platform-wide rule."],
    reviewStatus: "pending",
    originalityStatus: "pending",
    reviewer: null,
    reviewedAt: null,
    ...overrides,
  };
}

test("projects explicit platform, pool, topic, and mechanism rows deterministically", () => {
  const inputs = [row(), row({
    id: "blueprint:linkedin:document:civic-tech",
    overlayKind: "reviewed",
    platform: "linkedin",
    format: "document",
    evidencePool: "broad",
    niche: null,
    topic: "public-interest technology",
    analysisRefs: ["analysis:linkedin-example"],
    sourceRefs: ["source:linkedin-example"],
    mechanisms: {
      ...row().mechanisms,
      format: mechanism("format:document", "document with a saveable sequence"),
    },
    evidenceStatus: "supported",
    reviewStatus: "passed",
    originalityStatus: "passed",
    reviewer: "muxin",
    reviewedAt: "2026-08-24T12:00:00Z",
  })];
  const first = buildPlatformTreatmentBlueprint(inputs);
  const second = buildPlatformTreatmentBlueprint([...inputs].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((item) => `${item.platform}/${item.medium}/${item.format}/${item.evidencePool}`), [
    "linkedin/text/document/broad",
    "x/text/short-post/niche",
  ]);
  assert.equal(first.rows[0]?.readiness.status, "ready");
  assert.equal(first.rows[1]?.readiness.status, "blocked");
  assert.deepEqual(first.rows[1]?.readiness.blockers, [
    "evidence status is hypothesis",
    "originality status is pending",
    "overlay kind is hypothesis",
    "review status is pending",
    "reviewedAt is missing",
    "reviewer is missing",
  ]);
  assert.equal(first.bodyIncluded, false);
  assert.equal(first.generatesCopy, false);
  assert.equal(first.creatorBodyCopyAllowed, false);
  assert.equal(first.winnerClaimsAllowed, false);
  assert.equal(first.universalViralityClaimAllowed, false);
  assert.equal(first.sideEffects, "none");
});

test("keeps missing evidence visible and blocks niche rows without a niche label", () => {
  const result = buildPlatformTreatmentBlueprint([row({
    evidencePool: "niche",
    niche: null,
    analysisRefs: [],
    sourceRefs: [],
    baselineRefs: [],
    topic: null,
  })]);

  assert.equal(result.rows[0]?.readiness.status, "blocked");
  assert.deepEqual(result.rows[0]?.readiness.blockers, [
    "analysis refs are missing",
    "baseline refs are missing",
    "evidence status is hypothesis",
    "niche label is missing for niche evidence",
    "originality status is pending",
    "overlay kind is hypothesis",
    "review status is pending",
    "reviewedAt is missing",
    "reviewer is missing",
    "source refs are missing",
    "topic is missing",
  ]);
});

test("rejects duplicate identities, unknown fields, and creator-body fields", () => {
  assert.throws(() => buildPlatformTreatmentBlueprint([row(), row()]), /duplicate platform\/medium\/pool\/topic identity/i);
  assert.throws(() => buildPlatformTreatmentBlueprint([row({ body: "creator text" } as never)]), /body.*unsupported|creator-body/i);
  assert.throws(() => buildPlatformTreatmentBlueprint([row({ prompt: "write it" } as never)]), /prompt.*unsupported|model/i);
  assert.throws(() => buildPlatformTreatmentBlueprint([row({ mechanisms: { ...row().mechanisms, hook: { ...mechanism("bad", "bad"), sequence: ["hook", 2] as never } } })]), /sequence.*string/i);
});
