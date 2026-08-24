import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPoolEvidenceFromJson,
  main,
  parsePoolEvidenceArgs,
} from "./pool-evidence-cli.js";
import { buildCatalog, type PatternCatalog } from "./catalog.js";
import type { PatternMiningConfig } from "./types.js";

const CREATOR_BODY = "CREATOR BODY MUST NEVER REACH POOL EVIDENCE OUTPUT";

const config: PatternMiningConfig = {
  niches: ["systems"],
  accounts: [
    {
      platform: "x",
      handle: "@zeta",
      creator: "Zeta",
      niche: "systems",
      followers: null,
      research_pools: ["broad", "niche"],
    },
    {
      platform: "x",
      handle: "@alpha",
      creator: "Alpha",
      niche: "systems",
      followers: null,
    },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

const corpus = [{
  platform: "x",
  handle: "@zeta",
  creator: "Zeta",
  body: CREATOR_BODY,
  url: "https://example.test/zeta",
  collected_at: "2026-08-24T00:00:00.000Z",
}];

const analyses = [{
  platform: "x",
  handle: "@zeta",
  creator: "Zeta",
  research_pools: ["format"],
  body: CREATOR_BODY,
  analyzed_at: "2026-08-24",
}];

function catalog(): PatternCatalog {
  return buildCatalog(config, corpus, analyses);
}

test("parses one explicit JSON source or catalog paths and rejects ambiguous input", () => {
  assert.deepEqual(parsePoolEvidenceArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" },
    paths: {},
    format: "markdown",
  });
  assert.deepEqual(parsePoolEvidenceArgs(["--input", "catalog.json"]), {
    source: { kind: "file", path: "catalog.json" },
    paths: {},
    format: "json",
  });
  assert.deepEqual(parsePoolEvidenceArgs(["--config", "config.yaml", "--corpus", "corpus.jsonl", "--analyses", "analyses.jsonl"]), {
    source: { kind: "catalog-paths", paths: { config: "config.yaml", corpus: "corpus.jsonl", analyses: "analyses.jsonl" } },
    paths: { config: "config.yaml", corpus: "corpus.jsonl", analyses: "analyses.jsonl" },
    format: "json",
  });
  assert.throws(() => parsePoolEvidenceArgs(["--json", "{}", "--input", "catalog.json"]), /exactly one explicit JSON source or catalog paths/);
  assert.throws(() => parsePoolEvidenceArgs(["--format", "html"]), /format must be json or markdown/);
  assert.throws(() => parsePoolEvidenceArgs(["--unknown"]), /unknown argument/);
});

test("builds from a validated catalog JSON object with explicit pools and blocked rows", () => {
  const supplied = {
    ...catalog(),
    rows: catalog().rows.map((row) => ({ ...row, body: CREATOR_BODY })),
    winner: "must not be copied",
    ranking: ["must not be copied"],
  };
  const first = buildPoolEvidenceFromJson(JSON.stringify(supplied));
  const second = buildPoolEvidenceFromJson(JSON.stringify({ ...supplied, rows: [...supplied.rows].reverse() }));

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => [row.accountId, row.pool]), [
    ["x|alpha", null],
    ["x|zeta", "broad"],
    ["x|zeta", "format"],
    ["x|zeta", "niche"],
  ]);
  assert.deepEqual(first.summary, {
    poolCounts: { niche: 1, broad: 1, format: 1 },
    blockedAccounts: ["x|alpha"],
  });
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /CREATOR BODY|winner|ranking/i);
  assert.equal(first.rows.find((row) => row.accountId === "x|alpha")?.readiness.status, "blocked");
  assert.equal(first.rows.find((row) => row.accountId === "x|alpha")?.comparisonReadiness.status, "blocked");
});

test("uses injected catalog loading and output I/O without writing or inferring", () => {
  const writes: string[] = [];
  const errors: string[] = [];
  let loadedPaths: { config?: string; corpus?: string; analyses?: string } | undefined;
  const code = main(
    ["--format", "markdown", "--config", "fixture.yaml", "--corpus", "fixture.jsonl", "--analyses", "fixture-analyses.jsonl"],
    (paths) => {
      loadedPaths = paths;
      return { config, corpus, analyses };
    },
    {
      write: (value) => writes.push(value),
      error: (value) => errors.push(value),
    },
  );

  assert.equal(code, 0);
  assert.deepEqual(loadedPaths, { config: "fixture.yaml", corpus: "fixture.jsonl", analyses: "fixture-analyses.jsonl" });
  assert.equal(errors.length, 0);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /# Pool evidence inventory/);
  assert.match(writes[0] ?? "", /niche 1 \| broad 1 \| format 1/);
  assert.match(writes[0] ?? "", /blocked/);
  assert.doesNotMatch(writes[0] ?? "", /CREATOR BODY|winner|ranking/i);
});

test("fails closed on malformed JSON or catalog shape before normal output", () => {
  assert.throws(() => buildPoolEvidenceFromJson("not json"), /input must be valid JSON/);
  assert.throws(() => buildPoolEvidenceFromJson(JSON.stringify({ rows: [], summary: {} })), /summary\.configuredTargets/);

  const writes: string[] = [];
  const errors: string[] = [];
  const code = main(["--json", "not json"], undefined, {
    write: (value) => writes.push(value),
    error: (value) => errors.push(value),
  });

  assert.equal(code, 1);
  assert.deepEqual(writes, []);
  assert.match(errors.join(""), /input must be valid JSON/);
});
