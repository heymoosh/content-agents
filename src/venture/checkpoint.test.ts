import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { recordPace, clearCheckpoint } from "./checkpoint.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { ventureDir } from "./paths.js";
import { hasCanonEvent, readCanonEvents } from "./canon.js";
import { loadRules, type ArtifactKind, type VentureRules } from "./rules.js";

const SLUG = "zz-test-checkpoint";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

function seedRequired(rules: VentureRules, id: string) {
  createArtifact(SLUG, rules, {
    artifact_id: id,
    phase: 1,
    artifact_kind: "text-post-note",
    title: id,
    checkpoint_id: "checkpoint-1",
    venture_id: SLUG,
    venture_phase: 1,
    message_id: `msg-${id}`,
    at: "t0",
  });
}

function makeLive(id: string) {
  transitionArtifact(SLUG, id, { editorial_status: "approved", delivery_status: "ready" }, "t1");
  transitionArtifact(SLUG, id, { delivery_status: "live_confirmed", evidence: { type: "agent", value: "r", confirmed_by: "agent" } }, "t2");
}

describe("clearCheckpoint -- checkpoint-1", () => {
  test("refuses with 2/3 live -- no partial pass", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    recordPace(SLUG, "5/week", "t3");
    const r = clearCheckpoint(SLUG, "checkpoint-1", "t4");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /2\/3/);
  });

  test("refuses with 3/3 live but no pace recorded", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    const r = clearCheckpoint(SLUG, "checkpoint-1", "t4");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /pace not recorded/);
  });

  test("clears with 3/3 live and pace recorded, writes the canon event", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    recordPace(SLUG, "5/week", "t3");
    const r = clearCheckpoint(SLUG, "checkpoint-1", "t4");
    assert.equal(r.cleared, true);
    assert.equal(r.alreadyCleared, false);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-1`), true);
  });

  test("rerunning clear after it already cleared is idempotent", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    recordPace(SLUG, "5/week", "t3");
    clearCheckpoint(SLUG, "checkpoint-1", "t4");
    const r2 = clearCheckpoint(SLUG, "checkpoint-1", "t5");
    assert.equal(r2.cleared, true);
    assert.equal(r2.alreadyCleared, true);
  });
});

describe("recordPace", () => {
  test("is idempotent on repeat calls", () => {
    const first = recordPace(SLUG, "5/week", "t0");
    const second = recordPace(SLUG, "5/week", "t1");
    assert.equal(first.alreadyRecorded, false);
    assert.equal(second.alreadyRecorded, true);
  });
});

describe("clearCheckpoint -- checkpoint-2", () => {
  const KINDS: ArtifactKind[] = ["lead-magnet", "landing-page-copy", "welcome-email", "survey"];

  function seedCp2(rules: VentureRules, kind: ArtifactKind, id: string) {
    createArtifact(SLUG, rules, {
      artifact_id: id,
      phase: 2,
      artifact_kind: kind,
      title: id,
      checkpoint_id: "checkpoint-2",
      venture_id: SLUG,
      venture_phase: 2,
      message_id: `msg-${id}`,
      at: "t0",
    });
  }

  function correctEvidenceFor(kind: ArtifactKind): "url" | "attestation" {
    return kind === "welcome-email" ? "attestation" : "url";
  }

  function makeCp2Live(id: string, kind: ArtifactKind) {
    transitionArtifact(SLUG, id, { editorial_status: "approved", delivery_status: "ready" }, "t1");
    transitionArtifact(
      SLUG,
      id,
      { delivery_status: "live_confirmed", evidence: { type: correctEvidenceFor(kind), value: "r", confirmed_by: "muxin" } },
      "t2"
    );
  }

  test("refuses with 3 of 4 kinds live -- no partial pass, and no pace ever recorded", () => {
    const rules = loadRules();
    seedCp2(rules, "lead-magnet", "lm");
    seedCp2(rules, "landing-page-copy", "lp");
    seedCp2(rules, "welcome-email", "we");
    makeCp2Live("lm", "lead-magnet");
    makeCp2Live("lp", "landing-page-copy");
    makeCp2Live("we", "welcome-email");
    const r = clearCheckpoint(SLUG, "checkpoint-2", "t4");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /3\/4/);
  });

  test("clears with all 4 kinds live, without any pace being recorded", () => {
    const rules = loadRules();
    for (const kind of KINDS) seedCp2(rules, kind, kind);
    for (const kind of KINDS) makeCp2Live(kind, kind);
    const r = clearCheckpoint(SLUG, "checkpoint-2", "t4");
    assert.equal(r.cleared, true);
    assert.equal(r.alreadyCleared, false);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-2`), true);
    // checkpoint-1's pace requirement must not leak into checkpoint-2: no pace was ever
    // recorded above, and clearing still succeeded.
  });

  test("rerunning clear on checkpoint-2 after it already cleared is idempotent", () => {
    const rules = loadRules();
    for (const kind of KINDS) seedCp2(rules, kind, kind);
    for (const kind of KINDS) makeCp2Live(kind, kind);
    clearCheckpoint(SLUG, "checkpoint-2", "t4");
    const r2 = clearCheckpoint(SLUG, "checkpoint-2", "t5");
    assert.equal(r2.cleared, true);
    assert.equal(r2.alreadyCleared, true);
    // No duplicate canon event: exactly one checkpoint-cleared line for checkpoint-2.
    const clears = readCanonEvents(SLUG).filter((e) => e.id === `${SLUG}/checkpoint-2`);
    assert.equal(clears.length, 1);
  });

  test("clearCheckpoint on an unknown checkpoint id fails loudly naming the bad id", () => {
    assert.throws(() => clearCheckpoint(SLUG, "checkpoint-9", "t0"), /checkpoint-9/);
  });
});

// Proves the delivery_mode: "none" fix in state.ts's checkArtifact: product-outline and
// price-decision (rules.yaml, phase 3) never receive a delivery_status other than
// "not_applicable" (createArtifact stamps it at draft time and there is no delivery step to
// confirm), so "approved" + "not_applicable" must count as live -- and checkpoint-1/checkpoint-2's
// existing manual/app artifacts (covered above) must keep requiring "live_confirmed" unchanged.
//
// NOTE: this exercises today's actual clearCheckpoint, which writes the ledger event as
// `<slug>/checkpoint-3` uniformly (same as every other checkpoint id). venture-schema-contract.md
// §5.3 names the real event `<slug>/phase-3-completed` -- whether clearCheckpoint should special-
// case checkpoint-3 to match is an open question left to whichever work package wires the
// decision-record check into this function's predicate (see rules.yaml's checkpoint-3 comment).
describe("clearCheckpoint -- checkpoint-3 (delivery_mode: none)", () => {
  const KINDS: ArtifactKind[] = ["product-outline", "price-decision"];

  function seedCp3(rules: VentureRules, kind: ArtifactKind, id: string) {
    createArtifact(SLUG, rules, {
      artifact_id: id,
      phase: 3,
      artifact_kind: kind,
      title: id,
      checkpoint_id: "checkpoint-3",
      venture_id: SLUG,
      venture_phase: 3,
      message_id: `msg-${id}`,
      at: "t0",
    });
  }

  test("a fresh product-outline/price-decision artifact is draft:not_applicable, not live yet", () => {
    const rules = loadRules();
    seedCp3(rules, "product-outline", "po");
    const r = clearCheckpoint(SLUG, "checkpoint-3", "t1");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /0\/2/);
  });

  test("approving alone (no delivery step exists) is enough to count as live -- approved:not_applicable", () => {
    const rules = loadRules();
    seedCp3(rules, "product-outline", "po");
    seedCp3(rules, "price-decision", "pd");
    // No delivery_status patch at all -- mode "none" artifacts have no delivery step to confirm.
    transitionArtifact(SLUG, "po", { editorial_status: "approved" }, "t1");
    transitionArtifact(SLUG, "pd", { editorial_status: "approved" }, "t1");
    const r = clearCheckpoint(SLUG, "checkpoint-3", "t2");
    assert.equal(r.cleared, true);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-3`), true);
  });

  test("1 of 2 approved does not clear -- no partial pass, same as checkpoint-1/checkpoint-2", () => {
    const rules = loadRules();
    seedCp3(rules, "product-outline", "po");
    seedCp3(rules, "price-decision", "pd");
    transitionArtifact(SLUG, "po", { editorial_status: "approved" }, "t1");
    // pd left in draft:not_applicable.
    const r = clearCheckpoint(SLUG, "checkpoint-3", "t2");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /1\/2/);
  });

  test("a checkpoint-1 manual/app artifact still requires live_confirmed, not merely not_applicable -- the fix is scoped to delivery_mode: none", () => {
    const rules = loadRules();
    seedRequired(rules, "reg");
    // Approve only -- delivery never confirmed live. text-post-note is delivery_mode "app", not
    // "none", so this must NOT count as live under the same fix that lets checkpoint-3 pass above.
    transitionArtifact(SLUG, "reg", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    const r = clearCheckpoint(SLUG, "checkpoint-1", "t2");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /0\/3/);
  });
});
