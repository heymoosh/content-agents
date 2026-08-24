import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_REVIEW_LEDGER_VERSION,
  AccountReviewLedgerValidationError,
  appendAccountReviewRow,
  buildAccountReviewLedger,
  readAccountReviewLedger,
  type AccountReviewInput,
} from "./account-review-ledger.js";
import {
  main as accountReviewLedgerMain,
  parseAccountReviewLedgerArgs,
  renderAccountReviewLedgerJson,
  renderAccountReviewLedgerMarkdown,
} from "./account-review-ledger-cli.js";

function account(overrides: Partial<AccountReviewInput> = {}): AccountReviewInput {
  return {
    id: "review-001",
    currentAccountKey: "linkedin|alice",
    platform: "linkedin",
    handle: "@alice",
    creator: "Alice Example",
    stableAccountId: "account:alice",
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology", "public institutions"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [
      { pool: "broad", reason: "Explicitly selected as a broad-platform comparison account." },
      { pool: "format", reason: "Explicitly selected for short text format mechanics." },
      { pool: "niche", reason: "Explicitly selected for civic technology topic coverage." },
    ],
    popularityScope: "reviewed niche and broad account sample",
    sampleScope: "2026-08 reviewed top-post sample",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "baseline:linkedin:2026-08",
    medium: "text",
    format: "short text post",
    audienceSnapshot: {
      size: 12000,
      countType: "followers",
      provenance: "human-reviewed profile snapshot",
      asOf: "2026-08-23",
      collectedAt: "2026-08-24",
    },
    evidenceRefs: ["evidence:account:alice", "evidence:sample:alice"],
    baselineRefs: ["baseline:linkedin:2026-08"],
    caveats: ["Audience size is a point-in-time snapshot."],
    reviewer: "muxin",
    reviewNote: "Human-reviewed account metadata.",
    disposition: "reviewed",
    dispositionReason: "Explicitly reviewed for the account/example table.",
    reviewed_at: "2026-08-24T12:00:00.000Z",
    supersedesId: null,
    ...overrides,
  };
}

test("builds a deterministic, body-free row from explicit human metadata", () => {
  const first = buildAccountReviewLedger([account()]);
  const second = buildAccountReviewLedger([account({ researchPoolMembership: [...account().researchPoolMembership as never[]].reverse() as never })]);
  const row = first.rows[0];

  assert.deepEqual(first, second);
  assert.equal(first.version, ACCOUNT_REVIEW_LEDGER_VERSION);
  assert.equal(row?.identityKey, "stable:account:alice");
  assert.equal(row?.bodyIncluded, false);
  assert.equal(row?.readiness.status, "ready");
  assert.deepEqual(row?.researchPoolMembership, [
    { pool: "broad", reason: "Explicitly selected as a broad-platform comparison account." },
    { pool: "format", reason: "Explicitly selected for short text format mechanics." },
    { pool: "niche", reason: "Explicitly selected for civic technology topic coverage." },
  ]);
  assert.equal(JSON.stringify(first).includes("body text"), false);
  assert.equal(first.summary.currentRows, 1);
  assert.equal(first.summary.readyRows, 1);
});

test("keeps incomplete and unmapped rows visible while failing readiness closed", () => {
  const result = buildAccountReviewLedger([account({
    id: "review-unmapped",
    stableAccountId: null,
    stableAccountIdStatus: "unmapped",
    topics: "unknown",
    focus: null,
    nicheLabel: "unknown",
    researchPoolMembership: null,
    audienceSnapshot: "unknown",
    evidenceRefs: null,
    baselineRefs: null,
    reviewer: null,
    reviewed_at: null,
    disposition: "unmapped",
    dispositionReason: "Account identity could not be confirmed.",
  })]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.disposition, "unmapped");
  assert.equal(result.rows[0]?.readiness.status, "blocked");
  assert.ok(result.rows[0]?.readiness.blockers.includes("stableAccountId"));
  assert.ok(result.rows[0]?.readiness.blockers.includes("topics"));
  assert.ok(result.rows[0]?.readiness.blockers.includes("evidenceRefs"));
  assert.equal(result.summary.unmappedRows, 1);
  assert.equal(result.summary.blockedRows, 1);
});

test("rejects unknown, inferred, body, model, ranking, and winner fields", () => {
  assert.throws(
    () => buildAccountReviewLedger([account({ model: "gpt" } as never)]),
    (error: unknown) => error instanceof AccountReviewLedgerValidationError && /model.*unsupported/i.test(error.message),
  );
  assert.throws(
    () => buildAccountReviewLedger([account({ creatorBio: "bio" } as never)]),
    /creatorBio.*body-free/i,
  );
  assert.throws(
    () => buildAccountReviewLedger([account({ researchPoolMembership: [{ pool: "viral", reason: "inferred" }] as never })]),
    /pool.*niche.*broad.*format/i,
  );
  assert.throws(
    () => buildAccountReviewLedger([account({ audienceSnapshot: { ...account().audienceSnapshot as object, ranking: 1 } as never })]),
    /ranking.*unsupported/i,
  );
});

test("rejects duplicate account roots instead of choosing a creator or winner", () => {
  assert.throws(
    () => buildAccountReviewLedger([account(), account({ id: "review-002", reviewNote: "conflicting second row" })]),
    /duplicate account identity.*stable:account:alice/i,
  );
});

test("appends corrections through injected JSONL I/O and rejects in-place mutation", () => {
  let jsonl = "";
  const writes: string[] = [];
  const io = {
    readJsonl: () => jsonl,
    appendJsonl: (value: string) => {
      writes.push(value);
      jsonl += value;
    },
  };

  const first = appendAccountReviewRow(io, account());
  const beforeCorrection = jsonl;
  const second = appendAccountReviewRow(io, account({
    id: "review-002",
    topics: ["public procurement"],
    supersedesId: "review-001",
    reviewNote: "Corrected topic focus after human re-review.",
  }));

  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(writes[0]!).bodyIncluded, false);
  assert.equal(second.rows.length, 2);
  assert.equal(second.summary.currentRows, 1);
  assert.equal(second.rows[1]?.supersedesId, "review-001");
  assert.equal(second.rows[1]?.readiness.status, "ready");
  assert.equal(beforeCorrection + writes[1], jsonl);
  assert.deepEqual(readAccountReviewLedger(jsonl), second);
  assert.throws(
    () => appendAccountReviewRow(io, account({ id: "review-003", supersedesId: null })),
    /already exists.*supersedes current row.*review-002/i,
  );
  assert.throws(
    () => appendAccountReviewRow(io, account({ id: "review-002", supersedesId: "review-002" })),
    /duplicate row id/i,
  );
});

test("rejects tampered persisted readiness and preserves deterministic row order", () => {
  const ledger = buildAccountReviewLedger([
    account({ id: "review-z", currentAccountKey: "linkedin|zeta", stableAccountId: "account:zeta" }),
    account({ id: "review-a", currentAccountKey: "linkedin|alpha", stableAccountId: "account:alpha" }),
  ].map((row) => ({ ...row, supersedesId: null })) as AccountReviewInput[]);

  assert.deepEqual(ledger.rows.map((row) => row.identityKey), ["stable:account:alpha", "stable:account:zeta"]);
  const lines = ledger.rows.map((row) => JSON.stringify(row)).join("\n");
  assert.deepEqual(readAccountReviewLedger(lines), ledger);
  const tampered = { ...ledger.rows[0], readiness: { status: "ready", blockers: ["forged"] } };
  assert.throws(() => readAccountReviewLedger(JSON.stringify(tampered)), /readiness\.blockers is stale or invalid/);
  assert.throws(() => readAccountReviewLedger(`${JSON.stringify({ ...ledger.rows[0], ranking: 1 })}\n`), /ranking.*unsupported/);
});

test("renders deterministic JSON and Markdown and supports injected CLI append I/O", () => {
  const ledger = buildAccountReviewLedger([account()]);
  assert.deepEqual(
    renderAccountReviewLedgerJson(ledger),
    renderAccountReviewLedgerJson(buildAccountReviewLedger([account()])),
  );
  const markdown = renderAccountReviewLedgerMarkdown(ledger);
  assert.match(markdown, /Account review ledger/);
  assert.match(markdown, /civic technology/);
  assert.match(markdown, /niche/);
  assert.match(markdown, /body-free/);
  assert.equal(markdown.includes("creator body"), false);

  assert.deepEqual(parseAccountReviewLedgerArgs(["--file", "ledger.jsonl", "--append-json", "{}", "--format", "both"]), {
    source: { kind: "file", path: "ledger.jsonl" },
    appendJson: "{}",
    format: "both",
  });
  assert.throws(() => parseAccountReviewLedgerArgs(["--jsonl", "{}", "--append-json", "{}"]), /requires --file/);

  let jsonl = "";
  let output = "";
  let error = "";
  const exitCode = accountReviewLedgerMain([
    "--file", "ledger.jsonl", "--append-json", JSON.stringify(account()), "--format", "both",
  ], {
    readFile: () => jsonl,
    appendFile: (_path, value) => { jsonl += value; },
    write: (value) => { output += value; },
    error: (value) => { error += value; },
  });
  assert.equal(exitCode, 0);
  assert.equal(error, "");
  assert.equal(readAccountReviewLedger(jsonl).rows.length, 1);
  assert.match(output, /"cliVersion": "account-review-ledger-cli-v1"/);
  assert.match(output, /# Account review ledger/);
});
