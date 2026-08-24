import assert from "node:assert/strict";
import { test } from "node:test";
import {
  main,
  parseCommentIntakeArgs,
  type CommentIntakeCliIo,
} from "./comment-intake-cli.js";

const lineage = {
  sourceId: "source-1",
  variantId: "variant-1",
  experimentId: "experiment-1",
};

const rawBody = "PRIVATE COMMENT BODY MUST NOT APPEAR BY DEFAULT";

function intake(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "comment-record-1",
    contentItemId: "content-item-1",
    lineage,
    commentId: "remote-comment-1",
    platform: "Substack",
    surface: "Essay",
    comment: { text: rawBody, redactionRequested: false },
    observedAt: "2026-08-24T12:00:00Z",
    sourceNoteRef: "note:manual-1",
    evidenceRefs: ["evidence:2", "evidence:1", "evidence:2"],
    moderation: { status: "reviewed", note: "checked by operator" },
    consent: { status: "public_context", note: null },
    ...overrides,
  };
}

function io(fileContents = ""): { io: CommentIntakeCliIo; reads: string[]; writes: string[]; errors: string[] } {
  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  return {
    reads,
    writes,
    errors,
    io: {
      readFile: (path) => {
        reads.push(path);
        return fileContents;
      },
      write: (value) => {
        writes.push(value);
      },
      error: (value) => {
        errors.push(value);
      },
    },
  };
}

test("renders a deterministic body-free operator projection by default", async () => {
  const first = io();
  const second = io();
  const args = ["--json", JSON.stringify(intake()), "--format", "json"];

  assert.equal(await main(args, first.io), 0);
  assert.equal(await main(args, second.io), 0);
  assert.equal(first.writes[0], second.writes[0]);

  const projection = JSON.parse(first.writes[0] ?? "") as Record<string, any>;
  assert.equal(projection.kind, "comment_intake_operator_view");
  assert.equal(projection.summary.text, null);
  assert.deepEqual(projection.source.evidenceRefs, ["evidence:1", "evidence:2", "note:manual-1"]);
  assert.equal(projection.readiness.status, "ready");
  assert.deepEqual(projection.readiness.blockers, []);
  assert.equal(projection.ventureHandoff.ventureGate, "blocked");
  assert.equal(projection.ventureHandoff.readiness.status, "blocked");
  assert.equal(projection.summary.autoClaimsDemand, false);
  assert.equal(projection.summary.productIdea, null);
  assert.equal(projection.sideEffects, "none");
  assert.equal(Object.hasOwn(projection, "commentObservation"), false);
  assert.equal(Object.hasOwn(projection, "commentText"), false);
  assert.equal(first.writes[0]?.includes(rawBody), false);
  assert.deepEqual(first.errors, []);
});

test("reads exactly one injected file and supports Markdown and both formats", async () => {
  const injected = io(JSON.stringify(intake()));
  const markdownExit = await main(["--file", "intake.json", "--format", "markdown"], injected.io);

  assert.equal(markdownExit, 0);
  assert.deepEqual(injected.reads, ["intake.json"]);
  assert.equal(injected.writes.length, 1);
  assert.match(injected.writes[0] ?? "", /^# Comment intake operator view/);
  assert.match(injected.writes[0] ?? "", /Source note: note:manual-1/);
  assert.match(injected.writes[0] ?? "", /Venture gate: blocked/);
  assert.doesNotMatch(injected.writes[0] ?? "", new RegExp(rawBody));

  const both = io();
  const bothExit = await main(["--json", JSON.stringify(intake()), "--format", "both"], both.io);
  assert.equal(bothExit, 0);
  assert.match(both.writes[0] ?? "", /\n---\n/);
  assert.match(both.writes[0] ?? "", /# Comment intake operator view/);
});

test("requires exactly one explicit JSON or file source", () => {
  assert.throws(() => parseCommentIntakeArgs([]), /exactly one of --json or --file is required/);
  assert.throws(
    () => parseCommentIntakeArgs(["--json", JSON.stringify(intake()), "--file", "intake.json"]),
    /exactly one of --json or --file is allowed/,
  );
  assert.throws(() => parseCommentIntakeArgs(["--file", "intake.json", "--format", "html"]), /format must be json, markdown, or both/);
  assert.throws(() => parseCommentIntakeArgs(["--json", JSON.stringify(intake()), "--unknown"]), /unknown argument/);
});

test("fails closed without partial output for invalid moderation, consent, lineage, or evidence", async () => {
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ["moderation", { moderation: { status: "not_reviewed" } }, /moderation posture is not reviewed/],
    ["consent", { consent: { status: "unknown" } }, /consent posture is unresolved/],
    ["lineage", { lineage: { sourceId: "source-1", variantId: "", experimentId: "experiment-1" } }, /source, variant, and experiment lineage references are required/],
    ["evidence", { evidenceRefs: ["evidence:1", " "] }, /evidence references must be non-empty strings/],
  ];

  for (const [, overrides, expected] of cases) {
    const injected = io();
    const exitCode = await main(["--json", JSON.stringify(intake(overrides))], injected.io);
    assert.equal(exitCode, 1);
    assert.deepEqual(injected.writes, []);
    assert.equal(injected.errors.length, 1);
    assert.match(injected.errors[0] ?? "", expected);
  }
});

test("exposes only normalized raw or redacted text with an explicit opt-in", async () => {
  const defaultOutput = io();
  await main(["--json", JSON.stringify(intake())], defaultOutput.io);
  assert.equal(defaultOutput.writes[0]?.includes(rawBody), false);

  const optedIn = io();
  assert.equal(
    await main(["--json", JSON.stringify(intake()), "--include-comment-text"], optedIn.io),
    0,
  );
  const rawProjection = JSON.parse(optedIn.writes[0] ?? "") as Record<string, any>;
  assert.equal(rawProjection.commentText, rawBody);
  assert.equal(rawProjection.commentTextKind, "raw");

  const redacted = "[private detail removed]";
  const redactedOutput = io();
  await main([
    "--json",
    JSON.stringify(intake({ comment: { text: rawBody, redactedText: redacted, redactionRequested: true } })),
    "--include-comment-text",
  ], redactedOutput.io);
  const redactedProjection = JSON.parse(redactedOutput.writes[0] ?? "") as Record<string, any>;
  assert.equal(redactedProjection.commentText, redacted);
  assert.equal(redactedProjection.commentTextKind, "redacted");
  assert.equal(redactedOutput.writes[0]?.includes(rawBody), false);
});
