import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import { clearCheckpoint, recordPace } from "./checkpoint.js";
import { confirmManualDelivery } from "./deliver.js";
import {
  OBSERVATION_ROLES_CLEARING_CONTROLLED_GATES,
  deriveArtifactEvidenceRole,
  deriveEvidenceRole,
  describeEvidenceRole,
  observationMayClearControlledGate,
  readEvidenceLink,
  readEvidenceLinks,
  resolveVentureProbeId,
  ventureKickoffAt,
  writeEvidenceLink,
} from "./evidence-links.js";
import { evidenceLinksPath } from "./paths.js";
import { getResponseGateState, ingestResponse } from "./responses.js";
import { loadRules, type VentureRules } from "./rules.js";
import { computeState } from "./state.js";
import {
  clearTempVentureRoot,
  useTempVentureRoot,
} from "./test-venture-root.js";

const SLUG = "zz-test-evidence-links";
const KICKOFF = "2026-08-01T00:00:00.000Z";
const BEFORE = "2026-03-14T09:00:00.000Z";
const AFTER = "2026-08-10T09:00:00.000Z";

beforeEach(useTempVentureRoot);
afterEach(clearTempVentureRoot);

function kickoff(slug = SLUG, at = KICKOFF): void {
  appendCanonEvent(
    slug,
    "kickoff",
    `${slug}/kickoff`,
    { rules_version: loadRules().rules_version },
    at,
  );
}

function seedPost(
  rules: VentureRules,
  id: string,
  opts: { slug?: string; probeId?: string; at?: string } = {},
): void {
  createArtifact(opts.slug ?? SLUG, rules, {
    artifact_id: id,
    phase: 1,
    artifact_kind: "substack-post",
    title: id,
    checkpoint_id: "checkpoint-1",
    venture_id: opts.slug ?? SLUG,
    venture_phase: 1,
    message_id: `msg-${id}`,
    probe_id: opts.probeId,
    at: opts.at ?? AFTER,
  });
}

/** Approve, hand off, and confirm live by hand -- the manual delivery path Phase 1 posts use. */
function makeLive(
  id: string,
  opts: { slug?: string; at?: string; publishedAt?: string } = {},
): void {
  const slug = opts.slug ?? SLUG;
  const at = opts.at ?? AFTER;
  transitionArtifact(
    slug,
    id,
    { editorial_status: "approved", delivery_status: "ready" },
    at,
  );
  transitionArtifact(slug, id, { delivery_status: "handed_off" }, at);
  confirmManualDelivery(
    slug,
    id,
    {
      type: "url",
      value: `https://example.com/${id}`,
      publishedAt: opts.publishedAt,
    },
    at,
  );
}

describe("deriveEvidenceRole -- the rule from venture-schema-contract.md §5.4b", () => {
  test("published before kickoff is historical_prior, even when it matches a probe", () => {
    const v = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: BEFORE,
      observedAt: AFTER,
      probeId: "p1-idea-03",
    });
    assert.equal(v.role, "historical_prior");
    assert.equal(v.basis?.rule, "published_before_kickoff");
    // Rule 1 is unconditional and checked first: nothing published before the venture existed can
    // be that venture's controlled probe, so the probe id is not carried onto the basis.
    assert.equal(v.basis?.probe_id, null);
  });

  test("published after kickoff as one of this venture's probes is current_probe", () => {
    const v = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: AFTER,
      observedAt: null,
      probeId: "p1-idea-03",
    });
    assert.equal(v.role, "current_probe");
    assert.equal(v.basis?.rule, "matches_venture_probe");
    assert.equal(v.basis?.probe_id, "p1-idea-03");
  });

  test("published after kickoff but not a probe is current_organic", () => {
    const v = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: AFTER,
      observedAt: null,
      probeId: null,
    });
    assert.equal(v.role, "current_organic");
    assert.equal(v.basis?.rule, "published_after_kickoff_not_a_probe");
  });

  test("a null published_at falls back to observed_at, not to a guess", () => {
    const dm = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: null,
      observedAt: BEFORE,
      probeId: null,
    });
    assert.equal(dm.role, "historical_prior");
    assert.equal(dm.basis?.published_at, BEFORE);
  });

  test("an undatable observation is undetermined, never defaulted to a role", () => {
    const noTimes = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: null,
      observedAt: null,
      probeId: null,
    });
    assert.equal(noTimes.role, null);
    assert.match(noTimes.reason, /neither a published_at nor an observed_at/);

    const unparseable = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: "t0",
      observedAt: null,
      probeId: null,
    });
    assert.equal(unparseable.role, null);
    assert.match(unparseable.reason, /not a readable date/);
  });

  test("no kickoff means no role -- nothing can be dated relative to a venture that has none", () => {
    const v = deriveEvidenceRole({
      kickoffAt: null,
      publishedAt: AFTER,
      observedAt: null,
      probeId: null,
    });
    assert.equal(v.role, null);
    assert.match(v.reason, /no kickoff event/);
  });

  test("describeEvidenceRole always says why, so a role can never render bare", () => {
    const hist = deriveEvidenceRole({
      kickoffAt: KICKOFF,
      publishedAt: BEFORE,
      observedAt: null,
      probeId: null,
    });
    const text = describeEvidenceRole(hist);
    assert.match(text, /historical/);
    assert.ok(text.includes(BEFORE) && text.includes(KICKOFF));
  });
});

describe("evidence-links.jsonl -- the per-venture store", () => {
  test("the same observation gets different roles in two ventures, and is stored once per venture", () => {
    const earlier = "zz-test-evidence-early";
    const later = "zz-test-evidence-late";
    kickoff(earlier, "2026-02-01T00:00:00.000Z");
    kickoff(later, "2026-08-01T00:00:00.000Z");

    const input = {
      link_id: "el-001",
      observation_id: "o-001",
      published_at: BEFORE,
    };
    const a = writeEvidenceLink(earlier, input, AFTER);
    const b = writeEvidenceLink(later, input, AFTER);

    assert.equal(a.evidence_role, "current_organic");
    assert.equal(b.evidence_role, "historical_prior");
    assert.equal(a.observation_id, b.observation_id);
    // One observation, two links -- never two copies of the text (contract §5.4a test 13).
    assert.equal(readEvidenceLinks(earlier).length, 1);
    assert.equal(readEvidenceLinks(later).length, 1);
  });

  test("a caller-supplied evidence_role or research_plan_version is rejected, not honored", () => {
    kickoff();
    for (const field of [
      "evidence_role",
      "evidence_role_basis",
      "research_plan_version",
    ]) {
      assert.throws(
        () =>
          writeEvidenceLink(
            SLUG,
            {
              link_id: "el-x",
              observation_id: "o-x",
              published_at: BEFORE,
              [field]: "current_probe",
            } as never,
            AFTER,
          ),
        new RegExp(`${field} is derived, not declared`),
      );
    }
    assert.equal(readEvidenceLinks(SLUG).length, 0);
  });

  test("an undetermined role is written excluded, with the reason, rather than guessed", () => {
    kickoff();
    const link = writeEvidenceLink(
      SLUG,
      { link_id: "el-002", observation_id: "o-002" },
      AFTER,
    );
    assert.equal(link.evidence_role, null);
    assert.equal(link.evidence_role_basis, null);
    assert.equal(link.included_in_research_read, false);
    assert.match(link.exclusion_reason ?? "", /could not be determined/);
  });

  test("a link resolving to one of this venture's probes reads current_probe", () => {
    const rules = loadRules();
    kickoff();
    seedPost(rules, "post-a", { probeId: "p1-idea-03" });
    assert.equal(resolveVentureProbeId(SLUG, "msg-post-a"), "p1-idea-03");
    assert.equal(resolveVentureProbeId(SLUG, "someone-elses-note"), null);

    const link = writeEvidenceLink(
      SLUG,
      {
        link_id: "el-003",
        observation_id: "o-003",
        published_at: AFTER,
        content_item_id: "msg-post-a",
      },
      AFTER,
    );
    assert.equal(link.evidence_role, "current_probe");
    assert.equal(link.evidence_role_basis?.probe_id, "p1-idea-03");
  });

  test("writes are append-only and fold to the latest line per link_id", () => {
    kickoff();
    writeEvidenceLink(
      SLUG,
      { link_id: "el-004", observation_id: "o-004", published_at: AFTER },
      AFTER,
    );
    writeEvidenceLink(
      SLUG,
      {
        link_id: "el-004",
        observation_id: "o-004",
        published_at: AFTER,
        target_audience_fit: "confirmed",
      },
      AFTER,
    );
    const lines = readFileSync(evidenceLinksPath(SLUG), "utf8")
      .trim()
      .split("\n");
    assert.equal(lines.length, 2);
    assert.equal(readEvidenceLinks(SLUG).length, 1);
    assert.equal(
      readEvidenceLink(SLUG, "el-004")?.target_audience_fit,
      "confirmed",
    );
  });

  test("ventureKickoffAt reads canon.md, the authority", () => {
    assert.equal(ventureKickoffAt(SLUG), null);
    kickoff();
    assert.equal(ventureKickoffAt(SLUG), KICKOFF);
  });
});

describe("historical evidence never clears a gate that requires controlled collection", () => {
  test("no role at all may clear one -- the rule is stated as code, not left as an absence", () => {
    assert.deepEqual([...OBSERVATION_ROLES_CLEARING_CONTROLLED_GATES], []);
    for (const role of [
      "historical_prior",
      "current_probe",
      "current_organic",
    ] as const) {
      assert.equal(observationMayClearControlledGate(role), false);
    }
  });

  test("Checkpoint 1: a pre-kickoff post does not count, a post published in the venture does", () => {
    const rules = loadRules();
    kickoff();
    seedPost(rules, "post-a");
    seedPost(rules, "post-b");
    seedPost(rules, "post-c");
    makeLive("post-a");
    makeLive("post-b");
    // Confirmed today, but it went public in March -- before this venture existed.
    makeLive("post-c", { publishedAt: BEFORE });
    recordPace(SLUG, "3/week", AFTER);

    const cp = computeState(SLUG).checkpoints["checkpoint-1"];
    assert.equal(cp.complete_count, 2);
    assert.equal(cp.required_count, 3);
    const blocked = cp.blocking.find((b) => b.artifact_id === "post-c");
    assert.ok(blocked, "the historical post is named as the blocker");
    assert.match(blocked!.reason, /historical: published 2026-03-14/);
    assert.match(blocked!.reason, /before this venture kicked off 2026-08-01/);

    const refusal = clearCheckpoint(SLUG, "checkpoint-1", AFTER);
    assert.equal(refusal.cleared, false);
    assert.match(refusal.reason ?? "", /2\/3 required artifacts/);

    // Replacing it with a post actually published in the venture opens the same gate.
    makeLive("post-c");
    assert.equal(
      computeState(SLUG).checkpoints["checkpoint-1"].complete_count,
      3,
    );
    assert.equal(clearCheckpoint(SLUG, "checkpoint-1", AFTER).cleared, true);
  });

  test("Checkpoint 2 is untouched -- only a checkpoint declaring require_current_evidence filters", () => {
    const rules = loadRules();
    assert.equal(
      rules.checkpoints["checkpoint-1"].require_current_evidence,
      true,
    );
    assert.ok(!rules.checkpoints["checkpoint-2"].require_current_evidence);
    assert.ok(!rules.checkpoints["checkpoint-3"].require_current_evidence);
  });

  test("an artifact that cannot be dated is not thereby called historical", () => {
    const rules = loadRules();
    kickoff();
    seedPost(rules, "post-a", { at: "t0" });
    transitionArtifact(
      SLUG,
      "post-a",
      { editorial_status: "approved", delivery_status: "ready" },
      "t1",
    );
    transitionArtifact(
      SLUG,
      "post-a",
      {
        delivery_status: "live_confirmed",
        evidence: { type: "url", value: "https://example.com/a" },
      },
      "t2",
    );
    const verdict = deriveArtifactEvidenceRole(
      computeState(SLUG).checkpoints["checkpoint-1"].required[0],
      ventureKickoffAt(SLUG),
    );
    assert.equal(verdict.role, null);
    // Undetermined is not historical: it still counts, and the screen would say it is undetermined.
    assert.equal(
      computeState(SLUG).checkpoints["checkpoint-1"].complete_count,
      1,
    );
  });

  test("the Phase 3 response gate counts responses.jsonl and nothing else", () => {
    const originalKey = process.env.RESEARCH_HASH_KEY;
    process.env.RESEARCH_HASH_KEY = "test-only-key";
    try {
      kickoff();
      for (let i = 0; i < 3; i++) {
        ingestResponse(
          SLUG,
          {
            source: "survey",
            receivedAt: AFTER,
            rawIdentifier: {
              platform: "substack",
              stableUserId: `person-${i}`,
            },
            targetAudienceEligible: true,
            exactQuote: "q",
            redactedQuote: "q",
            stuckPoint: "s",
            emotionalIntensity: "medium",
            responseId: `r-${i}`,
          },
          AFTER,
        );
      }
      const before = getResponseGateState(SLUG);
      assert.equal(before.have, 3);

      // Twenty-five pre-kickoff observations linked in -- more than the gate's own minimum of 20.
      for (let i = 0; i < 25; i++) {
        const link = writeEvidenceLink(
          SLUG,
          {
            link_id: `el-${i}`,
            observation_id: `o-${i}`,
            published_at: BEFORE,
            target_audience_fit: "confirmed",
          },
          AFTER,
        );
        assert.equal(link.evidence_role, "historical_prior");
      }

      const after = getResponseGateState(SLUG);
      assert.equal(
        after.have,
        3,
        "linked historical evidence moves the eligible-unique count by zero",
      );
      assert.equal(after.state, "closed");
      assert.equal(after.need, before.need);
    } finally {
      if (originalKey === undefined) delete process.env.RESEARCH_HASH_KEY;
      else process.env.RESEARCH_HASH_KEY = originalKey;
    }
  });

  test("the response gate's module has no path to the evidence-link store", () => {
    // Structural, not incidental: if someone wires observations into the gate later, this fails.
    const src = readFileSync(
      new URL("./responses.ts", import.meta.url),
      "utf8",
    );
    assert.ok(!/from "\.\/evidence-links\.js"/.test(src));
    assert.ok(!/evidenceLinksPath/.test(src));
  });
});
