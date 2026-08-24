import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSourceEvidenceFromJson,
  main,
  parseSourceEvidenceArgs,
  renderSourceEvidence,
  renderSourceEvidenceJson,
  renderSourceEvidenceMarkdown,
} from "./source-evidence-cli.js";
import { buildSourceEvidence } from "./source-evidence.js";

const PRIVATE_BODY = "PRIVATE CREATOR BODY MUST NEVER BE EMITTED";

const corpus = [
  {
    id: "post-ready",
    source_id: "source-ready",
    post_id: "post-ready",
    account_id: "account-ready",
    platform: "x",
    handle: "@ready",
    creator: "Ready Account",
    url: "https://example.test/ready",
    body: PRIVATE_BODY,
    medium: "text",
    format: "short-post",
    audience_size_snapshot: {
      size: 1000,
      count_type: "followers",
      observed_at: "2026-08-20",
      collected_at: "2026-08-21",
      evidence_source: "profile snapshot",
    },
    metric_snapshot: {
      metric: "views",
      value: 2500,
      unit: "views",
      numerator: 2500,
      denominator: 1000,
      window: "2026-08-01/2026-08-31",
      scope: "account-baseline",
      observed_at: "2026-08-20",
    },
    popularity_scope: "ready-account",
    sample_scope: "explicit ready listing",
    baseline_scope: "same-account posts in observation window",
    baseline_source: "ready baseline ledger",
    evidence_links: ["fixture://evidence/ready"],
    body_is_complete: true,
    caveats: ["fixture caveat"],
    provenance: "fixture collector",
    observed_at: "2026-08-20",
    collected_at: "2026-08-21",
    review_status: "reviewed",
    status: "current",
    lineage: [{ record_type: "source", id: "source-ready", relation: "observes" }],
  },
  {
    id: "post-pending",
    source_id: "source-pending",
    post_id: "post-pending",
    platform: "x",
    body: PRIVATE_BODY,
    review_status: "pending",
    status: "draft",
  },
];

const analyses = [
  {
    id: "evidence-ready",
    source_id: "source-ready",
    post_id: "post-ready",
    account_id: "account-ready",
    pool_memberships: [{ pool: "niche", reason: "explicit niche review" }],
    evidence_location: "record:ready",
    selection_rule: "explicit fixture listing",
  },
  {
    id: "evidence-pending",
    source_id: "source-pending",
    post_id: "post-pending",
    pool_memberships: [],
  },
];

const envelope = JSON.stringify({
  corpus,
  analyses,
  winner: "must not be inferred or emitted",
});

test("requires one explicit JSON/file envelope and supports every output format", () => {
  assert.deepEqual(parseSourceEvidenceArgs(["--json", envelope]), {
    source: { kind: "json-string", value: envelope },
    format: "json",
  });
  assert.deepEqual(parseSourceEvidenceArgs(["--file", "evidence.json", "--format", "both"]), {
    source: { kind: "file", path: "evidence.json" },
    format: "both",
  });
  assert.deepEqual(parseSourceEvidenceArgs(["--input", "evidence.json", "--format", "markdown"]), {
    source: { kind: "file", path: "evidence.json" },
    format: "markdown",
  });

  assert.throws(() => parseSourceEvidenceArgs([]), /exactly one of --json or --file\/--input is required/);
  assert.throws(() => parseSourceEvidenceArgs(["--json", envelope, "--file", "evidence.json"]), /exactly one/);
  assert.throws(() => parseSourceEvidenceArgs(["--json", envelope, "--format", "html"]), /format must be json, markdown, or both/);
  assert.throws(() => parseSourceEvidenceArgs(["--json", envelope, "--unknown"]), /unknown argument/);
});

test("builds the explicit envelope through buildSourceEvidence and preserves blocked metadata without bodies", () => {
  const expected = buildSourceEvidence(corpus, analyses);
  const first = buildSourceEvidenceFromJson(envelope);
  const second = buildSourceEvidenceFromJson(JSON.stringify({
    corpus: [...corpus].reverse(),
    analyses: [...analyses].reverse(),
  }));

  assert.deepEqual(first, expected);
  assert.deepEqual(first, second);
  assert.deepEqual(first.summary, {
    ready: 1,
    blocked: 1,
    pools: { niche: 1, broad: 0, format: 0 },
  });
  const readyRow = first.rows.find((row) => row.sourceId === "source-ready");
  const pendingRow = first.rows.find((row) => row.sourceId === "source-pending");
  assert.equal(readyRow?.pool, "niche");
  assert.equal(readyRow?.metricSnapshot && readyRow.metricSnapshot !== "unknown" && readyRow.metricSnapshot.metric, "views");
  assert.equal(pendingRow?.reviewStatus, "pending");
  assert.equal(pendingRow?.readiness.status, "blocked");
  assert.ok(pendingRow?.readiness.blockingFields.includes("pool"));

  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /PRIVATE CREATOR BODY|winner|ranking/i);
});

test("renders explicit pool, scope, metric, review, and readiness metadata only", () => {
  const report = buildSourceEvidenceFromJson(envelope);
  const json = renderSourceEvidenceJson(report);
  const markdown = renderSourceEvidenceMarkdown(report);
  const poisoned = structuredClone(report) as typeof report & Record<string, unknown>;
  poisoned.winner = "must not be rendered";
  poisoned.ranking = ["must not be rendered"];
  Object.assign(poisoned.rows[0] as typeof poisoned.rows[number] & Record<string, unknown>, {
    body: PRIVATE_BODY,
    winner: "must not be rendered",
  });

  assert.deepEqual(JSON.parse(json), report);
  assert.match(markdown, /^# Source\/post evidence inventory/m);
  assert.match(markdown, /Pool: niche \(explicit niche review\)/);
  assert.match(markdown, /Popularity scope: ready-account/);
  assert.match(markdown, /Sample scope: explicit ready listing/);
  assert.match(markdown, /Baseline scope: same-account posts in observation window/);
  assert.match(markdown, /Metric: views = 2500 views/);
  assert.match(markdown, /Readiness: blocked/);
  assert.match(markdown, /Blocking fields: .*pool/);
  assert.doesNotMatch(json, /PRIVATE CREATOR BODY|winner|ranking/i);
  assert.doesNotMatch(markdown, /PRIVATE CREATOR BODY|winner|ranking/i);
  assert.doesNotMatch(renderSourceEvidenceJson(poisoned), /PRIVATE CREATOR BODY|winner|ranking/i);
  assert.doesNotMatch(renderSourceEvidenceMarkdown(poisoned), /PRIVATE CREATOR BODY|winner|ranking/i);
  assert.equal(renderSourceEvidence(report, "both"), `${json}\n${markdown}`);
});

test("injects file and output I/O, and fails closed before writing on invalid input", () => {
  const writes: string[] = [];
  const errors: string[] = [];
  const readPaths: string[] = [];
  const io = {
    readFile: (path: string) => {
      readPaths.push(path);
      return envelope;
    },
    write: (value: string) => writes.push(value),
    error: (value: string) => errors.push(value),
  };

  assert.equal(main(["--file", "/virtual/evidence.json", "--format", "markdown"], io), 0);
  assert.deepEqual(readPaths, ["/virtual/evidence.json"]);
  assert.equal(writes.length, 1);
  assert.equal(errors.length, 0);
  assert.match(writes[0] ?? "", /# Source\/post evidence inventory/);

  const malformedWrites: string[] = [];
  const malformedErrors: string[] = [];
  assert.equal(main(["--json", JSON.stringify({ corpus: {}, analyses: [] })], {
    write: (value: string) => malformedWrites.push(value),
    error: (value: string) => malformedErrors.push(value),
  }), 1);
  assert.deepEqual(malformedWrites, []);
  assert.match(malformedErrors.join(""), /corpus must be an array/);
});
