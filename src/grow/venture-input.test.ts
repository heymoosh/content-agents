import assert from "node:assert/strict";
import test from "node:test";

type VentureInputModule = typeof import("./venture-input.js");
type VentureInputCliModule = typeof import("./venture-input-cli.js");

async function loadModule(): Promise<VentureInputModule> {
  const module = await import("./venture-input.js").catch(() => ({} as VentureInputModule));
  assert.equal(typeof module.createVentureInputPointer, "function", "venture-input must export createVentureInputPointer");
  return module;
}

async function loadCliModule(): Promise<VentureInputCliModule> {
  const module = await import("./venture-input-cli.js").catch(() => ({} as VentureInputCliModule));
  assert.equal(typeof module.parseVentureInputArgs, "function", "venture-input-cli must export parseVentureInputArgs");
  return module;
}

function pointerInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "vi-001",
    ventureId: "venture-alpha",
    phase: 2,
    inputKind: "audience-evidence",
    sourceRecordRefs: ["record:observation-001"],
    evidenceRefs: ["evidence:reply-001"],
    contentItemRefs: ["content:note-001"],
    scope: "Replies to the Phase 1 probe about the audience's stuck point",
    sampleSize: 1,
    provenance: "Content research observation link, captured by the Content lane",
    caveats: ["One response is directional, not representative."],
    contentHumanDecision: {
      status: "approved",
      decidedBy: "muxin",
      decisionRef: "content-decision:001",
      decidedAt: "2026-08-24T12:00:00.000Z",
    },
    ventureGate: {
      status: "open",
      gateRef: "venture-gate:phase-2-input",
    },
    ventureDecision: {
      outcome: "accept",
      factRef: "venture-fact:001",
      independent: true,
      evidenceRefs: ["venture-evidence:001"],
      decidedAt: "2026-08-24T12:05:00.000Z",
    },
    status: "ready",
    lineage: {
      owner: "content",
      pointerId: "vi-001",
      ventureId: "venture-alpha",
      phase: 2,
      inputKind: "audience-evidence",
      sourceRecordRefs: ["record:observation-001"],
      evidenceRefs: ["evidence:reply-001"],
      contentItemRefs: ["content:note-001"],
    },
    ...overrides,
  };
}

test("creates a complete body-free Content-owned pointer and freezes the read result", async () => {
  const { createVentureInputPointer, VENTURE_INPUT_POINTER_FIELDS } = await loadModule();
  const source = pointerInput();
  const pointer = createVentureInputPointer(source);

  assert.deepEqual(VENTURE_INPUT_POINTER_FIELDS, [
    "id", "ventureId", "phase", "inputKind", "sourceRecordRefs", "evidenceRefs", "contentItemRefs",
    "scope", "sampleSize", "provenance", "caveats", "contentHumanDecision", "ventureGate",
    "ventureDecision", "status", "lineage",
  ]);
  assert.deepEqual(pointer, source);
  assert.equal(Object.isFrozen(pointer), true);
  assert.equal(Object.isFrozen(pointer.lineage), true);
  assert.equal(Object.isFrozen(pointer.sourceRecordRefs), true);
  assert.equal(Object.hasOwn(pointer, "body"), false);
  assert.equal(Object.hasOwn(pointer, "comment"), false);
  assert.throws(() => {
    (pointer as { status: string }).status = "rejected";
  }, TypeError);
});

test("requires exact identity, evidence, scope, sample size, caveats, and lineage", async () => {
  const { createVentureInputPointer } = await loadModule();
  for (const field of ["id", "evidenceRefs", "scope", "sampleSize", "caveats", "lineage"]) {
    const incomplete = pointerInput();
    delete incomplete[field];
    assert.throws(() => createVentureInputPointer(incomplete), new RegExp(field));
  }

  assert.throws(
    () => createVentureInputPointer(pointerInput({ body: "private content" })),
    /body.*allowlist|allowlist.*body/i,
  );
  assert.throws(
    () => createVentureInputPointer(pointerInput({ lineage: { ...pointerInput().lineage as object, comment: "reply text" } })),
    /comment.*allowlist|allowlist.*comment/i,
  );
  assert.throws(
    () => createVentureInputPointer(pointerInput({ model: { name: "unknown" } })),
    /model.*allowlist|allowlist.*model/i,
  );
  assert.throws(
    () => createVentureInputPointer(pointerInput({ ranking: 1 })),
    /ranking.*allowlist|allowlist.*ranking/i,
  );
  assert.throws(
    () => createVentureInputPointer(pointerInput({ winner: true })),
    /winner.*allowlist|allowlist.*winner/i,
  );
  assert.throws(
    () => createVentureInputPointer(pointerInput({ lineage: { ...pointerInput().lineage as object, pointerId: "wrong-id" } })),
    /lineage.*pointerId|pointerId.*lineage/i,
  );
});

test("keeps Content approval, Venture gate, and Venture decision independent", async () => {
  const { createVentureInputPointer, assessVentureInputReadiness } = await loadModule();
  const pending = createVentureInputPointer(pointerInput({
    contentHumanDecision: { status: "pending", decidedBy: null, decisionRef: null, decidedAt: null },
    ventureDecision: null,
    status: "hypothesis",
  }));
  const pendingReadiness = assessVentureInputReadiness(pending);
  assert.equal(pendingReadiness.status, "hypothesis");
  assert.equal(pendingReadiness.ready, false);
  assert.match(pendingReadiness.blockers.join("; "), /Muxin approval/i);
  assert.match(pendingReadiness.blockers.join("; "), /independent Venture decision/i);

  const approvedWithoutVentureDecision = createVentureInputPointer(pointerInput({ ventureDecision: null, status: "hypothesis" }));
  const blockedReadiness = assessVentureInputReadiness(approvedWithoutVentureDecision);
  assert.equal(blockedReadiness.ready, false);
  assert.equal(blockedReadiness.status, "hypothesis");
  assert.match(blockedReadiness.blockers.join("; "), /independent Venture decision/i);

  const accepted = createVentureInputPointer(pointerInput());
  const acceptedReadiness = assessVentureInputReadiness(accepted);
  assert.equal(acceptedReadiness.ready, true);
  assert.equal(acceptedReadiness.status, "ready");
  assert.deepEqual(acceptedReadiness.ventureDecision, { outcome: "accept", factRef: "venture-fact:001" });

  const requested = createVentureInputPointer(pointerInput({
    ventureDecision: {
      outcome: "request-more-evidence",
      factRef: "venture-fact:002",
      independent: true,
      evidenceRefs: ["venture-evidence:002"],
      decidedAt: "2026-08-24T12:05:00.000Z",
    },
    status: "needs-more-evidence",
  }));
  assert.equal(assessVentureInputReadiness(requested).status, "needs-more-evidence");
  assert.equal(assessVentureInputReadiness(requested).ready, false);

  assert.throws(() => createVentureInputPointer(pointerInput({
    contentHumanDecision: { status: "approved", decidedBy: "system", decisionRef: "x", decidedAt: "2026-08-24T12:00:00.000Z" },
  })), /Muxin/i);
  assert.throws(() => createVentureInputPointer(pointerInput({
    ventureDecision: {
      outcome: "accept",
      factRef: "venture-fact:003",
      independent: false,
      evidenceRefs: ["venture-evidence:003"],
      decidedAt: "2026-08-24T12:05:00.000Z",
    },
  })), /independent/i);
});

test("comments alone remain a hypothesis or need more evidence", async () => {
  const { createVentureInputPointer, assessVentureInputReadiness } = await loadModule();
  const commentOnly = createVentureInputPointer(pointerInput({
    inputKind: "comment-only",
    sourceRecordRefs: ["comment:reply-001"],
    evidenceRefs: ["evidence:comment-001"],
    contentItemRefs: [],
    status: "needs-more-evidence",
    ventureDecision: null,
    contentHumanDecision: { status: "approved", decidedBy: "muxin", decisionRef: "content-decision:002", decidedAt: "2026-08-24T12:00:00.000Z" },
    lineage: {
      owner: "content", pointerId: "vi-001", ventureId: "venture-alpha", phase: 2, inputKind: "comment-only",
      sourceRecordRefs: ["comment:reply-001"], evidenceRefs: ["evidence:comment-001"], contentItemRefs: [],
    },
  }));
  assert.equal(assessVentureInputReadiness(commentOnly).ready, false);
  assert.equal(assessVentureInputReadiness(commentOnly).status, "needs-more-evidence");
  assert.match(assessVentureInputReadiness(commentOnly).blockers.join("; "), /comment/i);

  assert.throws(() => createVentureInputPointer(pointerInput({
    inputKind: "audience-evidence",
    sourceRecordRefs: ["comment:reply-001"],
    evidenceRefs: ["evidence:comment-001"],
    status: "ready",
    lineage: {
      owner: "content", pointerId: "vi-001", ventureId: "venture-alpha", phase: 2, inputKind: "audience-evidence",
      sourceRecordRefs: ["comment:reply-001"], evidenceRefs: ["evidence:comment-001"], contentItemRefs: ["content:note-001"],
    },
  })), /hypothesis|needs-more-evidence|comment/i);
});

test("rejects duplicate identities and in-place changes to an append-only sequence", async () => {
  const { createVentureInputPointer, assertUniqueVentureInputIds, assertAppendOnlyVentureInputs } = await loadModule();
  const first = createVentureInputPointer(pointerInput());
  const second = createVentureInputPointer(pointerInput({
    id: "vi-002",
    lineage: { ...pointerInput().lineage as object, pointerId: "vi-002" },
  }));
  assertUniqueVentureInputIds([first, second]);
  assert.throws(() => assertUniqueVentureInputIds([first, first]), /unique|duplicate/i);
  assertAppendOnlyVentureInputs([first], [first, second]);
  assert.throws(
    () => assertAppendOnlyVentureInputs([first], [createVentureInputPointer(pointerInput({ scope: "changed" }))]),
    /append-only|changed|immutable/i,
  );
});

test("renders deterministic JSON and Markdown and performs no domain writes", async () => {
  const cli = await loadCliModule();
  const input = JSON.stringify({ pointer: pointerInput() });
  const parsed = cli.buildVentureInputReadinessFromJson(input);
  assert.equal(cli.renderVentureInputJson(parsed), cli.renderVentureInputJson(parsed));
  assert.match(cli.renderVentureInputJson(parsed), /"venture_input_readiness"/);
  const markdown = cli.renderVentureInputMarkdown(parsed);
  assert.match(markdown, /# Venture input readiness/);
  assert.match(markdown, /Status: ready/);
  assert.match(markdown, /Read-only: yes/);
  assert.match(markdown, /Side effects: none/);
  assert.equal(/\b(?:body|comment|model|ranking|winner)\b/i.test(JSON.stringify(parsed)), false);

  let output = "";
  let errors = "";
  let reads = 0;
  const exitCode = await cli.main(["--json", input, "--format", "both"], {
    readFile: async () => { reads += 1; return input; },
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 0);
  assert.equal(reads, 0);
  assert.equal(errors, "");
  assert.match(output, /Venture input readiness/);
  assert.match(output, /venture_input_readiness/);
});

test("CLI rejects ambiguous sources and malformed pointers without writing", async () => {
  const cli = await loadCliModule();
  assert.throws(() => cli.parseVentureInputArgs(["--json", "{}", "--file", "input.json"]), /exactly one/i);
  assert.throws(() => cli.buildVentureInputReadinessFromJson("{\"pointer\":{}}"), /id|pointer/i);

  let output = "";
  let errors = "";
  const exitCode = await cli.main(["--json", "not-json"], {
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 1);
  assert.equal(output, "");
  assert.match(errors, /valid JSON/i);
});
