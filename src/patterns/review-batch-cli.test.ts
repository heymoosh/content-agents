import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewQueueBatchFromJson,
  loadReviewQueue,
  main,
  parseReviewBatchArgs,
  renderReviewQueueBatch,
} from "./review-batch-cli.js";
import type { ReviewQueueArtifact } from "./review-queue.js";

function queue(rows: ReviewQueueArtifact["rows"] = []): ReviewQueueArtifact {
  const statusCounts = { reviewed: 0, pending: 0, blocked: 0, unmapped: 0 };
  let evidenceCount = 0;
  let comparisonEvidenceReady = 0;
  for (const row of rows) {
    statusCounts[row.status] += 1;
    evidenceCount += row.evidenceCount;
    if (row.comparisonEvidenceReady) comparisonEvidenceReady += 1;
  }
  return {
    kind: "account_review_queue",
    version: "account-review-queue-v1",
    rows,
    summary: {
      total: rows.length,
      evidenceCount,
      comparisonEvidenceReady,
      statusCounts,
    },
    sideEffects: "none",
  };
}

function row(currentAccountKey: string, status: "reviewed" | "pending" | "blocked" | "unmapped" = "pending"): ReviewQueueArtifact["rows"][number] {
  return {
    currentAccountKey,
    platform: "fixture",
    handle: `@${currentAccountKey}`,
    creator: "Fixture creator",
    evidenceCount: 2,
    status,
    stableIdPresent: false,
    missingRequiredOverlayFields: ["accountId"],
    comparisonEvidenceReady: false,
    nextReviewAction: "review account metadata",
  };
}

test("parses one explicit source, required pagination, and all formats", () => {
  assert.deepEqual(parseReviewBatchArgs([
    "--json", "{}", "--page-size", "2", "--page-number", "3", "--format", "both",
  ]), {
    source: { kind: "json-string", value: "{}" },
    pageSize: 2,
    pageNumber: 3,
    format: "both",
  });
  assert.deepEqual(parseReviewBatchArgs([
    "--input", "queue.json", "--page-size=2", "--page-number=1", "--format=markdown",
  ]), {
    source: { kind: "file", path: "queue.json" },
    pageSize: 2,
    pageNumber: 1,
    format: "markdown",
  });
  assert.deepEqual(parseReviewBatchArgs([
    "--file", "queue.json", "--page-size", "1", "--page-number", "1",
  ]).source, { kind: "file", path: "queue.json" });
  assert.throws(() => parseReviewBatchArgs(["--json", "{}", "--file", "queue.json", "--page-size", "1", "--page-number", "1"]), /exactly one/i);
  assert.throws(() => parseReviewBatchArgs(["--json", "{}", "--page-size", "1"]), /page-number.*required/i);
  assert.throws(() => parseReviewBatchArgs(["--json", "{}", "--page-number", "1"]), /page-size.*required/i);
});

test("fails closed on malformed queue and pagination JSON", () => {
  const valid = JSON.stringify(queue([row("alpha")]))
    .replace("\"sideEffects\":\"none\"", "\"sideEffects\":\"writes\"");
  assert.throws(() => loadReviewQueue("not json"), /valid JSON/i);
  assert.throws(() => loadReviewQueue("[]"), /object/i);
  assert.throws(() => loadReviewQueue(valid), /sideEffects/i);
  assert.throws(() => loadReviewQueue(JSON.stringify({ ...queue(), rows: [{}] })), /rows\[0\].currentAccountKey/i);
  assert.throws(() => buildReviewQueueBatchFromJson(JSON.stringify(queue()), 0, 1), /positive integer/i);
  assert.throws(() => buildReviewQueueBatchFromJson(JSON.stringify(queue()), 1, 0), /positive integer/i);
  assert.throws(() => buildReviewQueueBatchFromJson(JSON.stringify(queue()), 1.5, 1), /positive integer/i);
  assert.throws(() => buildReviewQueueBatchFromJson(JSON.stringify(queue()), 1, Number.NaN), /positive integer/i);
});

test("renders deterministic, body-free review metadata without mutation or ranking", () => {
  const bodyRow = { ...row("zeta", "blocked"), creatorBody: "PRIVATE CREATOR BODY" } as ReviewQueueArtifact["rows"][number] & { creatorBody: string };
  const source = queue([bodyRow, row("alpha", "pending"), row("reviewed", "reviewed")]);
  const before = JSON.stringify(source);
  const first = buildReviewQueueBatchFromJson(JSON.stringify(source), 2, 1);
  const second = buildReviewQueueBatchFromJson(JSON.stringify(source), 2, 1);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(first.rows.map((item) => item.currentAccountKey), ["alpha", "zeta"]);
  assert.equal(first.humanReviewRequired, true);
  assert.equal(first.sideEffects, "none");
  assert.match(first.note, /does not mutate.*rank accounts.*select winners/i);
  const json = renderReviewQueueBatch(first, "json");
  assert.equal(json.includes("PRIVATE CREATOR BODY"), false);
  assert.equal(json.includes("creatorBody"), false);
  assert.equal(json.includes("winnerSelected"), false);
  assert.equal(json.endsWith("\n"), true);
  assert.equal(renderReviewQueueBatch(first, "both").includes("# Account review queue batch"), true);
});

test("accepts empty page one and rejects later empty pages", () => {
  const empty = JSON.stringify(queue());
  const first = buildReviewQueueBatchFromJson(empty, 2, 1);
  assert.deepEqual(first.page, { number: 1, size: 2, total: 0, totalPages: 0, hasPrevious: false, hasNext: false });
  assert.equal(first.humanReviewRequired, false);
  assert.throws(() => buildReviewQueueBatchFromJson(empty, 2, 2), /exceed total pages/i);
});

test("uses injected file and stdout I/O without writing domain state", async () => {
  let output = "";
  let errors = "";
  const exitCode = await main(["--file", "queue.json", "--page-size", "1", "--page-number", "1", "--format", "markdown"], {
    readFile: async (path) => {
      assert.equal(path, "queue.json");
      return JSON.stringify(queue([row("alpha")]));
    },
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 0);
  assert.equal(errors, "");
  assert.match(output, /# Account review queue batch/);

  const failed = await main(["--json", JSON.stringify(queue()), "--page-size", "1", "--page-number", "2"], {
    readFile: () => { throw new Error("must not read inline JSON"); },
    write: () => { throw new Error("must not write failed output"); },
    error: (value) => { errors += value; },
  });
  assert.equal(failed, 1);
  assert.match(errors, /exceed total pages/i);
});
