import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  approveCharlesPersonaProposal, digestCharlesPersona, proposeCharlesPersonaEdit,
  readCharlesPersona, readCharlesPersonaProposals, rejectCharlesPersonaProposal,
} from "./charles-persona.js";

const productionPersona = readFileSync(new URL("../../charles/config/persona.yaml", import.meta.url), "utf8");

function fixture(): { root: string; proposalsPath: string; brief: string } {
  const root = mkdtempSync(join(tmpdir(), "charles-persona-"));
  mkdirSync(join(root, "config"), { recursive: true });
  const brief = "**PERSONA**\n\nMuxin's exact source brief.\n";
  writeFileSync(join(root, "config", "persona.yaml"), productionPersona);
  writeFileSync(join(root, "config", "persona-brief.md"), brief);
  return { root, proposalsPath: join(root, "state", "persona-proposals.jsonl"), brief };
}

function editedPersona(label = "Charles the Reviewed"): string {
  return productionPersona.replace('short_name: "Charles"', `short_name: "${label}"`);
}

test("saving a persona edit creates a digest-bound old/new proposal without mutating production", () => {
  const f = fixture();
  try {
    const after = editedPersona();
    const proposal = proposeCharlesPersonaEdit(after, "muxin", { ...f, now: "2026-08-31T10:00:00.000Z" });
    assert.equal(proposal.status, "pending");
    assert.equal(proposal.beforeYaml, productionPersona);
    assert.equal(proposal.afterYaml, after);
    assert.equal(proposal.beforeDigest, digestCharlesPersona(productionPersona));
    assert.equal(proposal.afterDigest, digestCharlesPersona(after));
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
    assert.equal(readCharlesPersonaProposals(f.proposalsPath)[0].payloadDigest, proposal.payloadDigest);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("approval atomically applies the exact reviewed bytes and is idempotent while the brief stays byte-exact", () => {
  const f = fixture();
  try {
    const after = editedPersona();
    const proposal = proposeCharlesPersonaEdit(after, "muxin", { ...f, now: "2026-08-31T10:00:00.000Z" });
    const applied = approveCharlesPersonaProposal(proposal.id, "Reviewed the exact YAML delta", "muxin", { ...f, now: "2026-08-31T10:01:00.000Z" });
    assert.equal(applied.status, "applied");
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), after);
    assert.equal(readFileSync(join(f.root, "config", "persona-brief.md"), "utf8"), f.brief);
    const retry = approveCharlesPersonaProposal(proposal.id, "retry", "muxin", { ...f, now: "2026-08-31T10:02:00.000Z" });
    assert.equal(retry.status, "applied");
    assert.equal(readCharlesPersonaProposals(f.proposalsPath).length, 1);
    assert.equal(readCharlesPersona({ root: f.root, proposalsPath: f.proposalsPath }).yaml, after);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("an interrupted approval recovers idempotently from the exact atomically-written YAML", () => {
  const f = fixture();
  try {
    const after = editedPersona();
    const proposal = proposeCharlesPersonaEdit(after, "muxin", f);
    assert.throws(() => approveCharlesPersonaProposal(proposal.id, "reviewed", "muxin", {
      ...f,
      afterPersonaRename: () => { throw new Error("simulated process interruption"); },
    }), /simulated process interruption/);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), after);
    assert.equal(readCharlesPersonaProposals(f.proposalsPath)[0].status, "approved");
    assert.equal(approveCharlesPersonaProposal(proposal.id, "retry", "muxin", f).status, "applied");
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), after);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("stale production YAML fails closed instead of overwriting an unreviewed change", () => {
  const f = fixture();
  try {
    const proposal = proposeCharlesPersonaEdit(editedPersona(), "muxin", f);
    const concurrent = editedPersona("Charles changed elsewhere");
    writeFileSync(join(f.root, "config", "persona.yaml"), concurrent);
    assert.throws(() => approveCharlesPersonaProposal(proposal.id, "reviewed", "muxin", f), /stale persona proposal/);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), concurrent);
    assert.equal(readCharlesPersonaProposals(f.proposalsPath)[0].status, "pending");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("tampered proposal payload and malformed ledger both fail closed", () => {
  const f = fixture();
  try {
    const proposal = proposeCharlesPersonaEdit(editedPersona(), "muxin", f);
    const ledger = readFileSync(f.proposalsPath, "utf8");
    writeFileSync(f.proposalsPath, ledger.replace("Charles the Reviewed", "Charles was Tampered"));
    assert.throws(() => approveCharlesPersonaProposal(proposal.id, "reviewed", "muxin", f), /event digest mismatch|tampered persona proposal/);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
    writeFileSync(f.proposalsPath, "{not-json}\n");
    assert.throws(() => readCharlesPersonaProposals(f.proposalsPath), /malformed persona proposal ledger/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("tampered approval transitions fail closed instead of becoming authority", () => {
  const f = fixture();
  try {
    const proposal = proposeCharlesPersonaEdit(editedPersona(), "muxin", f);
    approveCharlesPersonaProposal(proposal.id, "Reviewed exact old and new YAML", "muxin", f);
    const ledger = readFileSync(f.proposalsPath, "utf8");
    writeFileSync(f.proposalsPath, ledger.replace("Reviewed exact old and new YAML", "review evidence was altered"));
    assert.throws(() => readCharlesPersonaProposals(f.proposalsPath), /event digest mismatch/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("malformed, schema-invalid, and leak-source-stripping edits are refused before proposal creation", () => {
  const f = fixture();
  try {
    assert.throws(() => proposeCharlesPersonaEdit("identity: [", "muxin", f), /malformed persona YAML/);
    assert.throws(() => proposeCharlesPersonaEdit("identity: {}\n", "muxin", f), /schema-invalid persona/);
    const stripped = editedPersona().replace(
      'source: "https://www.endcitizensunited.org/unrig-washington"',
      "source: null",
    );
    assert.throws(() => proposeCharlesPersonaEdit(stripped, "muxin", f), /source retention failed/);
    const invalidUrl = editedPersona().replace(
      'source: "https://www.endcitizensunited.org/unrig-washington"',
      'source: "javascript:alert(1)"',
    );
    assert.throws(() => proposeCharlesPersonaEdit(invalidUrl, "muxin", f), /valid HTTP\(S\) URL/);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
    assert.equal(readCharlesPersonaProposals(f.proposalsPath).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("rejection is idempotent and changes neither persona file nor persona brief", () => {
  const f = fixture();
  try {
    const proposal = proposeCharlesPersonaEdit(editedPersona(), "muxin", f);
    assert.equal(rejectCharlesPersonaProposal(proposal.id, "Keep the current characterization", "muxin", f).status, "rejected");
    assert.equal(rejectCharlesPersonaProposal(proposal.id, "retry", "muxin", f).status, "rejected");
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
    assert.equal(readFileSync(join(f.root, "config", "persona-brief.md"), "utf8"), f.brief);
    assert.throws(() => approveCharlesPersonaProposal(proposal.id, "changed mind", "muxin", f), /rejected/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
