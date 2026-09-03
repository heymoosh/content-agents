import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  recordSignalsVentureProposal,
  recordSignalsVentureDecision,
  readSignalsVentureProposals,
  type SignalsVentureProposalInput,
} from "./signals-venture-handoff-store.js";

function proposal(overrides: Partial<SignalsVentureProposalInput> = {}): SignalsVentureProposalInput {
  return {
    id: "learning-1", ventureSlug: "my-venture", sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1",
    title: "Test the opening", factualSummary: "The opening is the bounded uncertainty.", proposedInput: "Compare two openings.",
    rationale: "This is the smallest useful test.", confidence: "medium", evidenceRefs: ["evidence-1"],
    phase: 2, inputKind: "funnel", contentItemRefs: ["item-1"], scope: "one venture",
    sampleSize: { treatment: 10, control: 10 }, provenance: { planDigest: "sha256:plan", interpretationId: "sha256:interpretation" },
    caveats: ["one test"], qualification: "qualified", evidenceStatus: "measured",
    ...overrides,
  };
}

test("Signals Venture proposals are body-free, append-only, and idempotent", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-") );
  const path = join(root, "handoffs.jsonl");
  try {
    const first = recordSignalsVentureProposal(proposal(), path);
    const second = recordSignalsVentureProposal(proposal(), path);
    assert.deepEqual(second, first);
    assert.equal(readFileSync(path, "utf8").trim().split("\n").length, 1);
    assert.equal(JSON.stringify(readSignalsVentureProposals(path)).includes("private"), false);
    assert.equal(readSignalsVentureProposals(path)[0]!.status, "pending");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("decision events preserve adopt, decline, and request-more-evidence, refusing drift and repeats", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-") );
  const path = join(root, "handoffs.jsonl");
  try {
    const p = recordSignalsVentureProposal(proposal(), path);
    const adopted = recordSignalsVentureDecision(p.id, "adopt", "Use this input", path);
    assert.equal(adopted.status, "adopted");
    assert.equal(adopted.muxinRationale, "Use this input");
    assert.throws(() => recordSignalsVentureDecision(p.id, "decline", "changed", path), /already decided/i);
    assert.throws(() => recordSignalsVentureProposal(proposal({ title: "Drifted" }), path), /conflicting|drift/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("request-more-evidence remains a Signals decision and never accepts Venture", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-") );
  const path = join(root, "handoffs.jsonl");
  try {
    const p = recordSignalsVentureProposal(proposal(), path);
    const result = recordSignalsVentureDecision(p.id, "request-more-evidence", "Need a wider sample", path);
    assert.equal(result.status, "more-evidence");
    assert.equal(result.ventureGate, "blocked");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("persisted proposals are revalidated and fail closed when their bytes or digest are corrupt", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-corrupt-"));
  const path = join(root, "handoffs.jsonl");
  try {
    recordSignalsVentureProposal(proposal(), path);
    const event = JSON.parse(readFileSync(path, "utf8"));
    event.proposal.proposedInput = "tampered after persistence";
    writeFileSync(path, `${JSON.stringify(event)}\n`);
    assert.throws(() => readSignalsVentureProposals(path), /digest|invalid/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("proposal event cannot forge an adopted Signals decision outside the append-only decision log", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-forged-state-"));
  const path = join(root, "handoffs.jsonl");
  try {
    recordSignalsVentureProposal(proposal(), path);
    const event = JSON.parse(readFileSync(path, "utf8"));
    event.proposal.status = "adopted";
    event.proposal.muxinRationale = "forged adoption";
    event.proposal.decidedAt = "2026-08-31T00:00:00.000Z";
    event.proposal.ventureGate = "ready";
    writeFileSync(path, `${JSON.stringify(event)}\n`);
    const read = readSignalsVentureProposals(path)[0]!;
    assert.equal(read.status, "pending");
    assert.equal(read.muxinRationale, null);
    assert.equal(read.decidedAt, null);
    assert.equal(read.ventureGate, "blocked");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("evidence tiers cap claim ceilings and only experiment tiers require lineage", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-tiers-"));
  const path = join(root, "handoffs.jsonl");
  try {
    const qualitative = recordSignalsVentureProposal(proposal({ id: "qualitative", evidenceTier: "qualitative", claimCeiling: "resonance", experimentId: "", sourceId: "", variantId: "" }), path);
    assert.equal(qualitative.evidenceTier, "qualitative");
    assert.throws(() => recordSignalsVentureProposal(proposal({ id: "overclaim", evidenceTier: "survey", claimCeiling: "observed-demand" }), path), /exceeds/i);
    assert.throws(() => recordSignalsVentureProposal(proposal({ id: "missing-lineage", evidenceTier: "controlled", claimCeiling: "bounded-comparison", experimentId: "", sourceId: "", variantId: "" }), path), /lineage/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
