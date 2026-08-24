import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeasurementRun,
  measurementRowKey,
  renderMeasurementRunJson,
  renderMeasurementRunMarkdown,
  type MeasurementRunInput,
} from "./measurement-run.js";
import { main, parseMeasurementRunArgs } from "./measurement-run-cli.js";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account: { id: "@Reviewed Account", reviewStatus: "reviewed" },
    target: { id: " Target/One ", reviewStatus: "reviewed" },
    platform: "reddit",
    route: { route: "reddit/public-search", method: "api", disposition: "supported" },
    samplePolicy: {
      selection: "reviewed",
      requiredCount: 3,
      observedCount: 3,
      terms: ["2026-Q3"],
      confirmation: "confirmed",
    },
    collectionWindow: {
      start: "2026-08-01",
      end: "2026-08-31",
      timezone: "America/Chicago",
      term: "2026-08",
    },
    operator: "muxin",
    evidenceRefs: ["evidence://z", "evidence://a"],
    baseline: { id: "/new-baseline-2026-08", term: "2026-08", evidenceRefs: ["baseline://a"] },
    result: { status: "measured", evidenceRefs: ["evidence://a"] },
    blockers: [],
    caveats: ["manual review of target scope"],
    ...overrides,
  };
}

function input(rows: readonly Record<string, unknown>[]): MeasurementRunInput {
  return { rows } as unknown as MeasurementRunInput;
}

test("builds deterministic, normalized rows with explicit execution fields", () => {
  const original = input([
    row({ account: { id: "@Zeta", reviewStatus: "reviewed" }, target: { id: "B", reviewStatus: "reviewed" } }),
    row({ account: { id: "@alpha", reviewStatus: "reviewed" }, target: { id: "A", reviewStatus: "reviewed" } }),
  ]);
  const snapshot = structuredClone(original);
  const first = buildMeasurementRun(original);
  const second = buildMeasurementRun({ rows: [...original.rows].reverse() });

  assert.deepEqual(first, second);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(first.rows.map((item) => item.key), [
    measurementRowKey("alpha", "a"),
    measurementRowKey("zeta", "b"),
  ]);
  assert.equal(first.rows[0]?.accountId, "alpha");
  assert.equal(first.rows[0]?.targetId, "a");
  assert.equal(first.rows[0]?.platform, "reddit");
  assert.deepEqual(first.rows[0]?.route, { route: "reddit/public-search", method: "api", disposition: "supported" });
  assert.deepEqual(first.rows[0]?.samplePolicy, {
    selection: "reviewed",
    requiredCount: 3,
    observedCount: 3,
    terms: ["2026-Q3"],
    confirmation: "confirmed",
  });
  assert.deepEqual(first.rows[0]?.collectionWindow, {
    start: "2026-08-01",
    end: "2026-08-31",
    timezone: "America/Chicago",
    term: "2026-08",
  });
  assert.equal(first.rows[0]?.operator, "muxin");
  assert.deepEqual(first.rows[0]?.evidenceRefs, ["evidence://a", "evidence://z"]);
  assert.equal(first.rows[0]?.baselineId, "/new-baseline-2026-08");
  assert.equal(first.rows[0]?.baselineTerm, "2026-08");
  assert.equal(first.rows[0]?.status, "measured");
  assert.equal(first.rows[0]?.sideEffects, "none");
  assert.equal(JSON.stringify(first).match(/body|model|winner|ranking/gi), null);
});

test("blocks insufficient, mixed-term, unconfirmed, and winner-only samples without filling facts", () => {
  const result = buildMeasurementRun(input([
    row({
      samplePolicy: { selection: "winner-only", requiredCount: 3, observedCount: 1, terms: ["old", "new"], confirmation: "unconfirmed" },
      baseline: { id: null, term: null, evidenceRefs: [] },
      result: { status: "measured", evidenceRefs: [] },
    }),
  ]));
  const [item] = result.rows;
  assert.equal(item?.status, "blocked");
  assert.deepEqual(item?.result, { status: "blocked", evidenceRefs: [] });
  assert.equal(item?.baselineId, null);
  assert.equal(item?.baselineTerm, null);
  assert.ok(item?.blockers.includes("sample is insufficient: 1 of 3 observed"));
  assert.ok(item?.blockers.includes("sample uses mixed terms"));
  assert.ok(item?.blockers.includes("sample is unconfirmed"));
  assert.ok(item?.blockers.includes("winner-only sample is not admissible"));
  assert.ok(item?.blockers.includes("baseline ID is missing"));
  assert.ok(item?.blockers.includes("baseline term is missing"));
  assert.ok(item?.blockers.includes("measured result has no evidence refs"));
});

test("keeps supported Reddit explicit and leaves manual or unsupported platforms blocked", () => {
  const result = buildMeasurementRun(input([
    row({ account: { id: "manual", reviewStatus: "reviewed" }, target: { id: "one", reviewStatus: "reviewed" }, platform: "x", route: { route: "timeline", method: "manual", disposition: "manual" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "unsupported", reviewStatus: "reviewed" }, target: { id: "one", reviewStatus: "reviewed" }, platform: "pinterest", route: { route: "search", method: "api", disposition: "supported" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "reddit", reviewStatus: "reviewed" }, target: { id: "one", reviewStatus: "reviewed" }, platform: "reddit", route: { route: "reddit/public-posts", method: "api", disposition: "supported" }, result: { status: "planned", evidenceRefs: [] } }),
  ]));
  const manual = result.rows.find((item) => item.accountId === "manual");
  const unsupported = result.rows.find((item) => item.accountId === "unsupported");
  const reddit = result.rows.find((item) => item.accountId === "reddit");

  assert.equal(manual?.status, "blocked");
  assert.equal(manual?.route.disposition, "manual");
  assert.ok(manual?.blockers.includes("manual route requires operator-collected evidence"));
  assert.equal(unsupported?.status, "unsupported");
  assert.equal(unsupported?.route.disposition, "unsupported");
  assert.ok(unsupported?.blockers.includes("route is not an explicitly supported route"));
  assert.equal(reddit?.status, "planned");
  assert.equal(reddit?.route.disposition, "supported");
});

test("surfaces a deterministic next action without claiming baseline readiness", () => {
  const result = buildMeasurementRun(input([
    row({ account: { id: "measured", reviewStatus: "reviewed" }, target: { id: "target", reviewStatus: "reviewed" } }),
    row({ account: { id: "planned", reviewStatus: "reviewed" }, target: { id: "target", reviewStatus: "reviewed" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "manual", reviewStatus: "reviewed" }, target: { id: "target", reviewStatus: "reviewed" }, platform: "x", route: { route: "timeline", method: "manual", disposition: "manual" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "unsupported", reviewStatus: "reviewed" }, target: { id: "target", reviewStatus: "reviewed" }, platform: "pinterest", route: { route: "search", method: "api", disposition: "supported" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "unconfirmed", reviewStatus: "unconfirmed" }, target: { id: "target", reviewStatus: "reviewed" }, result: { status: "planned", evidenceRefs: [] } }),
    row({ account: { id: "blocked", reviewStatus: "reviewed" }, target: { id: "target", reviewStatus: "reviewed" }, baseline: { id: null, term: null, evidenceRefs: [] }, result: { status: "planned", evidenceRefs: [] } }),
  ]));

  const actions = new Map(result.rows.map((item) => [item.accountId, item.nextAction]));
  assert.deepEqual(Object.fromEntries(actions), {
    blocked: "resolve_blockers",
    manual: "collect_manual_evidence",
    measured: "record_explicit_baseline_fact",
    planned: "run_supported_route",
    unconfirmed: "confirm_identity",
    unsupported: "stop_unsupported_route",
  });
  assert.doesNotMatch(JSON.stringify(result), /best|viral|winner|baseline-ready|baselineReady|median|ratio/i);
});

test("supports the full status vocabulary and preserves explicit result references", () => {
  const statuses = ["planned", "in_progress", "measured", "blocked", "unconfirmed"] as const;
  const rows = statuses.map((status, index) => row({
    account: { id: `account-${index}`, reviewStatus: status === "unconfirmed" ? "unconfirmed" : "reviewed" },
    target: { id: "target", reviewStatus: "reviewed" },
    result: { status, evidenceRefs: status === "measured" ? ["result://one"] : [] },
    samplePolicy: { selection: "reviewed", requiredCount: 1, observedCount: 1, terms: ["term"], confirmation: "confirmed" },
  }));
  const result = buildMeasurementRun(input(rows));
  assert.deepEqual(result.rows.map((item) => item.status), ["planned", "in_progress", "measured", "blocked", "unconfirmed"]);
  assert.deepEqual(result.rows.find((item) => item.status === "measured")?.result.evidenceRefs, ["result://one"]);
  assert.equal(result.summary.statusCounts.unsupported, 0);
});

test("rejects unknown nested fields, including body/model/winner-shaped fields", () => {
  for (const [path, poisoned] of [
    ["route.body", row({ route: { route: "reddit/public-search", method: "api", disposition: "supported", body: "private" } })],
    ["samplePolicy.model", row({ samplePolicy: { selection: "reviewed", requiredCount: 3, observedCount: 3, terms: ["term"], confirmation: "confirmed", model: "never" } })],
    ["baseline.winner", row({ baseline: { id: "baseline", term: "term", evidenceRefs: [], winner: true } })],
  ] as const) {
    assert.throws(() => buildMeasurementRun(input([poisoned])), new RegExp(`${path}|unsupported|unknown`, "i"));
  }
});

test("renders deterministic JSON and Markdown, and the CLI only emits output", () => {
  const manifest = buildMeasurementRun(input([row()]));
  assert.equal(renderMeasurementRunJson(manifest), `${JSON.stringify(manifest, null, 2)}\n`);
  const markdown = renderMeasurementRunMarkdown(manifest);
  assert.match(markdown, /\| Key \| Account \| Target \| Platform \| Route \| Method \| Status \|/);
  assert.match(markdown, /reddit\/public-search/);
  assert.match(markdown, /No collection, network, model, ranking, or winner side effects/);

  assert.deepEqual(parseMeasurementRunArgs(["--json", JSON.stringify(input([row()])), "--format", "markdown"]), {
    source: { kind: "json", value: JSON.stringify(input([row()])) },
    format: "markdown",
  });
  const writes: string[] = [];
  const errors: string[] = [];
  const exitCode = main(["--json", JSON.stringify(input([row()])), "--format", "json"], {
    write: (value) => writes.push(value),
    error: (value) => errors.push(value),
  });
  assert.equal(exitCode, 0);
  assert.equal(errors.length, 0);
  assert.equal(writes.length, 1);
  assert.equal(writes[0], renderMeasurementRunJson(manifest));
});
