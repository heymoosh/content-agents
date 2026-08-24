import assert from "node:assert/strict";
import test from "node:test";

import {
  appendSourceEvidenceLedgerRecord,
  appendSourceEvidenceLedgerRecords,
  assertComparableSourceEvidenceRecord,
  buildSourceEvidenceLedger,
  normalizeSourceEvidenceLedgerRecord,
  readSourceEvidenceLedger,
  type SourceEvidenceLedgerPersistence,
} from "./source-evidence-ledger.js";
import {
  main,
  parseSourceEvidenceLedgerArgs,
  renderSourceEvidenceLedgerMarkdown,
} from "./source-evidence-ledger-cli.js";

type Fixture = Record<string, unknown>;

function evidence(overrides: Fixture = {}): Fixture {
  return {
    id: "evidence-alpha",
    sourceId: "source-alpha",
    postId: "post-alpha",
    accountId: "account-alpha",
    platform: "x",
    pool: "niche",
    membershipReason: "Muxin reviewed this account for the human-inference niche pool",
    nicheLabel: "human inference",
    topics: ["civic technology", "decision-making"],
    focus: ["how people make decisions"],
    medium: "text",
    format: "short post",
    metricSnapshot: {
      metric: "views",
      value: 3200,
      unit: "views",
      numerator: 3200,
      denominator: 12000,
      window: "2026-08-01/2026-08-20",
      scope: "source post",
      observedAt: "2026-08-20",
    },
    popularityScope: "human inference creators on X",
    sampleScope: "fixed reviewed source-post set",
    observedAt: "2026-08-20",
    collectedAt: "2026-08-21T00:00:00Z",
    selectionRule: "top observed examples from the fixed reviewed source-post set",
    provenance: "reviewed source evidence record",
    evidenceRefs: ["evidence://post/alpha", "capture://post/alpha"],
    baselineRefs: ["baseline://x/new/2026-08-22"],
    baselineSource: "X /new measured baseline",
    bodyComplete: true,
    reviewStatus: "reviewed",
    status: "current",
    caveats: ["public metric snapshot; denominator is account audience at observation time"],
    lineage: [{ recordType: "source", id: "source-alpha", relation: "observes" }],
    ...overrides,
  };
}

function memoryPersistence(initial = ""): SourceEvidenceLedgerPersistence & { value: string } {
  const persistence = {
    value: initial,
    read() { return this.value; },
    append(value: string) { this.value += value; },
  };
  return persistence;
}

test("normalizes the existing source-evidence shape into a durable body-free record", () => {
  const row = normalizeSourceEvidenceLedgerRecord(evidence());

  assert.equal(row.kind, "source_evidence_ledger_record");
  assert.equal(row.evidenceId, "evidence-alpha");
  assert.equal(row.postId, "post-alpha");
  assert.equal(row.accountId, "account-alpha");
  assert.deepEqual(row.topics, ["civic technology", "decision-making"]);
  assert.deepEqual(row.evidenceRefs, ["capture://post/alpha", "evidence://post/alpha"]);
  assert.deepEqual(row.baselineRefs, ["baseline://x/new/2026-08-22"]);
  assert.equal(row.readiness.status, "ready");
  assert.deepEqual(row.readiness.blockers, []);
  assert.equal(row.bodyIncluded, false);
  assert.equal("body" in row, false);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE CREATOR BODY|model output|winner/i);
});

test("keeps incomplete and unreviewed rows visible but rejects them from comparison", () => {
  const ledger = buildSourceEvidenceLedger([
    evidence({ id: "evidence-blocked", pool: undefined, metricSnapshot: undefined, bodyComplete: false, reviewStatus: "pending" }),
  ]);

  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0]?.readiness.status, "blocked");
  assert.ok(ledger.rows[0]?.readiness.blockers.some((blocker) => blocker.startsWith("pool:")));
  assert.ok(ledger.rows[0]?.readiness.blockers.includes("metricSnapshot"));
  assert.ok(ledger.rows[0]?.readiness.blockers.includes("bodyComplete"));
  assert.ok(ledger.rows[0]?.readiness.blockers.includes("reviewStatus"));
  assert.equal(ledger.summary.unreviewed, 1);
  assert.throws(() => assertComparableSourceEvidenceRecord(evidence({ pool: null })), /not comparison-ready/);
});

test("requires explicit pool membership and never infers it from niche labels", () => {
  const row = normalizeSourceEvidenceLedgerRecord(evidence({ pool: null, membershipReason: null }));
  assert.equal(row.pool, null);
  assert.equal(row.nicheLabel, "human inference");
  assert.ok(row.readiness.blockers.some((blocker) => blocker.includes("explicit membership")));
  assert.throws(() => normalizeSourceEvidenceLedgerRecord(evidence({ researchPoolMembership: [{ pool: "niche", reason: "inferred" }] })), /unknown field|inferred/i);
});

test("rejects unknown, body, model, PII, ranking, and winner fields before persistence", () => {
  for (const field of ["unexpected", "body", "model", "email", "ranking", "winner"]) {
    assert.throws(() => normalizeSourceEvidenceLedgerRecord(evidence({ [field]: "poison" })), new RegExp(field, "i"));
  }
});

test("rejects duplicate IDs and in-place edits while allowing blocked rows to remain append-only", () => {
  const persistence = memoryPersistence();
  const first = appendSourceEvidenceLedgerRecord(evidence(), persistence);
  assert.equal(first.readiness.status, "ready");
  assert.throws(() => appendSourceEvidenceLedgerRecord(evidence({ format: "edited" }), persistence), /already exists|in-place edits/);

  appendSourceEvidenceLedgerRecords([evidence({ id: "evidence-pending", reviewStatus: "pending", bodyComplete: false })], persistence);
  const rows = readSourceEvidenceLedger(persistence);
  assert.deepEqual(rows.map((row) => row.evidenceId), ["evidence-alpha", "evidence-pending"]);
  assert.equal(rows[1]?.readiness.status, "blocked");
});

test("builds a deterministic, non-mutating ledger and rejects duplicate IDs", () => {
  const rows = [evidence({ id: "evidence-zeta" }), evidence({ id: "evidence-alpha" })];
  const snapshot = structuredClone(rows);
  const first = buildSourceEvidenceLedger(rows);
  const second = buildSourceEvidenceLedger([...rows].reverse());

  assert.deepEqual(rows, snapshot);
  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => row.evidenceId), ["evidence-alpha", "evidence-zeta"]);
  assert.throws(() => buildSourceEvidenceLedger([evidence(), evidence()]), /duplicate evidence id/);
});

test("renders deterministic Markdown inspection without body or winner material", () => {
  const ledger = buildSourceEvidenceLedger([evidence({ id: "evidence-alpha|pipe", caveats: ["line one", "line|two"] })]);
  const markdown = renderSourceEvidenceLedgerMarkdown(ledger);

  assert.match(markdown, /# Source evidence ledger/);
  assert.match(markdown, /\| Evidence ID \| Post ID \| Account ID \| Platform \| Pool \|/);
  assert.match(markdown, /evidence-alpha\\\|pipe/);
  assert.match(markdown, /body-free evidence view/);
  assert.doesNotMatch(markdown, /PRIVATE CREATOR BODY|\"winner\"|\"model\"/i);
});

test("CLI parses inspection and append options and appends through injected I/O", () => {
  assert.deepEqual(parseSourceEvidenceLedgerArgs(["--file", "input.json", "--format", "both", "--append", "ledger.jsonl"]), {
    source: { kind: "file", path: "input.json" },
    format: "both",
    appendPath: "ledger.jsonl",
  });

  const writes: string[] = [];
  const errors: string[] = [];
  const files = new Map<string, string>([["input.json", JSON.stringify({ rows: [evidence()] })]]);
  const exitCode = main(["--file", "input.json", "--format", "markdown", "--append", "ledger.jsonl"], {
    readFile: (path) => files.get(path) ?? "",
    appendFile: (path, value) => files.set(path, `${files.get(path) ?? ""}${value}`),
    write: (value) => writes.push(value),
    error: (value) => errors.push(value),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(errors, []);
  assert.match(writes[0] ?? "", /# Source evidence ledger/);
  assert.match(files.get("ledger.jsonl") ?? "", /source_evidence_ledger_record/);
  assert.doesNotMatch(files.get("ledger.jsonl") ?? "", /PRIVATE CREATOR BODY|\"winner\"|\"model\"/i);
});
