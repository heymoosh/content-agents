/**
 * A bounded, read-only execution manifest for reviewed measurement work.
 *
 * This module records an operator's explicit route and evidence plan. It does not fetch a page,
 * invoke a model, inspect creator bodies, infer account metadata, calculate a winner, or write a
 * manifest. Unsupported and manual routes remain visible so a coordinator can hand them to a
 * human instead of silently widening the collection surface.
 */

export const MEASUREMENT_RUN_VERSION = "measurement-run-v1" as const;

export const MEASUREMENT_RUN_STATUSES = [
  "planned",
  "in_progress",
  "measured",
  "blocked",
  "unconfirmed",
  "unsupported",
] as const;

export type MeasurementRunStatus = (typeof MEASUREMENT_RUN_STATUSES)[number];
export type MeasurementReviewStatus = "reviewed" | "unconfirmed" | "blocked" | "unmapped";
export type MeasurementRouteMethod = "api" | "browser" | "manual";
export type MeasurementRouteDisposition = "supported" | "manual" | "unsupported";
export type MeasurementSampleSelection = "reviewed" | "declared" | "winner-only" | "unknown";
export type MeasurementSampleConfirmation = "confirmed" | "unconfirmed";
export type MeasurementRunNextAction =
  | "confirm_identity"
  | "collect_manual_evidence"
  | "resolve_blockers"
  | "run_supported_route"
  | "record_explicit_baseline_fact"
  | "stop_unsupported_route";

export interface MeasurementRunIdentityInput {
  readonly id: string;
  readonly reviewStatus: MeasurementReviewStatus;
}

export interface MeasurementRunRouteInput {
  readonly route: string;
  readonly method: MeasurementRouteMethod;
  readonly disposition: MeasurementRouteDisposition;
}

export interface MeasurementRunSamplePolicyInput {
  readonly selection: MeasurementSampleSelection;
  readonly requiredCount: number | null;
  readonly observedCount: number | null;
  readonly terms: readonly string[];
  readonly confirmation: MeasurementSampleConfirmation;
}

export interface MeasurementRunCollectionWindowInput {
  readonly start: string | null;
  readonly end: string | null;
  readonly timezone: string | null;
  readonly term: string | null;
}

export interface MeasurementRunBaselineInput {
  readonly id: string | null;
  readonly term: string | null;
  readonly evidenceRefs: readonly string[];
}

export interface MeasurementRunResultInput {
  readonly status: MeasurementRunStatus;
  readonly evidenceRefs: readonly string[];
}

export interface MeasurementRunInputRow {
  readonly account: MeasurementRunIdentityInput;
  readonly target: MeasurementRunIdentityInput;
  readonly platform: string;
  readonly route: MeasurementRunRouteInput;
  readonly samplePolicy: MeasurementRunSamplePolicyInput;
  readonly collectionWindow: MeasurementRunCollectionWindowInput;
  readonly operator: string;
  readonly evidenceRefs: readonly string[];
  readonly baseline: MeasurementRunBaselineInput;
  readonly result: MeasurementRunResultInput;
  readonly blockers: readonly string[];
  readonly caveats: readonly string[];
}

export interface MeasurementRunInput {
  readonly rows: readonly MeasurementRunInputRow[];
}

export interface MeasurementRunIdentity {
  readonly id: string;
  readonly reviewStatus: MeasurementReviewStatus;
}

export interface MeasurementRunRoute {
  readonly route: string;
  readonly method: MeasurementRouteMethod;
  readonly disposition: MeasurementRouteDisposition;
}

export interface MeasurementRunSamplePolicy {
  readonly selection: MeasurementSampleSelection;
  readonly requiredCount: number | null;
  readonly observedCount: number | null;
  readonly terms: string[];
  readonly confirmation: MeasurementSampleConfirmation;
}

export interface MeasurementRunCollectionWindow {
  readonly start: string | null;
  readonly end: string | null;
  readonly timezone: string | null;
  readonly term: string | null;
}

export interface MeasurementRunResult {
  readonly status: MeasurementRunStatus;
  readonly evidenceRefs: string[];
}

export interface MeasurementRunReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: string[];
}

export interface MeasurementRunRow {
  readonly kind: "measurement_run_row";
  readonly version: typeof MEASUREMENT_RUN_VERSION;
  readonly key: string;
  readonly accountId: string;
  readonly targetId: string;
  readonly account: MeasurementRunIdentity;
  readonly target: MeasurementRunIdentity;
  readonly platform: string;
  readonly route: MeasurementRunRoute;
  readonly samplePolicy: MeasurementRunSamplePolicy;
  readonly collectionWindow: MeasurementRunCollectionWindow;
  readonly operator: string;
  readonly evidenceRefs: string[];
  readonly baselineId: string | null;
  readonly baselineTerm: string | null;
  readonly baselineEvidenceRefs: string[];
  readonly result: MeasurementRunResult;
  readonly status: MeasurementRunStatus;
  readonly blockers: string[];
  readonly caveats: string[];
  readonly readiness: MeasurementRunReadiness;
  readonly nextAction: MeasurementRunNextAction;
  readonly sideEffects: "none";
}

export interface MeasurementRunSummary {
  readonly rows: number;
  readonly statusCounts: Record<MeasurementRunStatus, number>;
  readonly readyRows: number;
  readonly blockedRows: number;
  readonly supportedRoutes: number;
  readonly manualRoutes: number;
  readonly unsupportedRoutes: number;
}

export interface MeasurementRunManifest {
  readonly kind: "measurement_run_manifest";
  readonly version: typeof MEASUREMENT_RUN_VERSION;
  readonly rows: MeasurementRunRow[];
  readonly summary: MeasurementRunSummary;
  readonly sideEffects: "none";
}

export class MeasurementRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementRunValidationError";
  }
}

type LooseRecord = Record<string, unknown>;

const REVIEW_STATUSES = new Set<MeasurementReviewStatus>(["reviewed", "unconfirmed", "blocked", "unmapped"]);
const ROUTE_METHODS = new Set<MeasurementRouteMethod>(["api", "browser", "manual"]);
const ROUTE_DISPOSITIONS = new Set<MeasurementRouteDisposition>(["supported", "manual", "unsupported"]);
const SAMPLE_SELECTIONS = new Set<MeasurementSampleSelection>(["reviewed", "declared", "winner-only", "unknown"]);
const SAMPLE_CONFIRMATIONS = new Set<MeasurementSampleConfirmation>(["confirmed", "unconfirmed"]);
const SUPPORTED_REDDIT_ROUTES = new Set([
  "reddit/public-posts|api",
  "reddit/public-search|api",
  "public-posts|api",
  "public-search|api",
]);

const ROW_KEYS = [
  "account",
  "target",
  "platform",
  "route",
  "samplePolicy",
  "collectionWindow",
  "operator",
  "evidenceRefs",
  "baseline",
  "result",
  "blockers",
  "caveats",
] as const;

const IDENTITY_KEYS = ["id", "reviewStatus"] as const;
const ROUTE_KEYS = ["route", "method", "disposition"] as const;
const SAMPLE_KEYS = ["selection", "requiredCount", "observedCount", "terms", "confirmation"] as const;
const WINDOW_KEYS = ["start", "end", "timezone", "term"] as const;
const BASELINE_KEYS = ["id", "term", "evidenceRefs"] as const;
const RESULT_KEYS = ["status", "evidenceRefs"] as const;

function fail(message: string): never {
  throw new MeasurementRunValidationError(message);
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown, path: string): LooseRecord {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function exactKeys(value: LooseRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${path}.${key} is unsupported or unknown`);
  }
}

function required(value: LooseRecord, key: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${path}.${key} is required`);
  return value[key];
}

function text(value: unknown, path: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") fail(`${path} must be a string${nullable ? " or null" : ""}`);
  const normalized = value.trim();
  if (normalized === "") fail(`${path} must not be empty`);
  return normalized;
}

function normalizedIdentity(value: unknown, path: string): string {
  const normalized = text(value, path)!.toLowerCase().replace(/^@+/, "").replace(/\/+$/, "");
  if (normalized === "") fail(`${path} must contain an identity`);
  return normalized;
}

function optionalText(value: unknown, path: string): string | null {
  return text(value, path, true);
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, path: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) fail(`${path} must be one of: ${[...allowed].join(", ")}`);
  return value as T;
}

function integer(value: unknown, path: string, nullable: boolean, minimum: number): number | null {
  if (value === null && nullable) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    fail(`${path} must be an integer >= ${minimum}${nullable ? " or null" : ""}`);
  }
  return value;
}

function refs(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(`${path} must be an array of strings`);
  const normalized = value.map((item, index) => text(item, `${path}[${index}]`)!);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function textList(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(`${path} must be an array of strings`);
  const normalized = value.map((item, index) => text(item, `${path}[${index}]`)!);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function normalizeIdentity(value: unknown, path: string): MeasurementRunIdentity {
  const record = object(value, path);
  exactKeys(record, IDENTITY_KEYS, path);
  return {
    id: normalizedIdentity(required(record, "id", path), `${path}.id`),
    reviewStatus: enumValue(required(record, "reviewStatus", path), REVIEW_STATUSES, `${path}.reviewStatus`),
  };
}

function normalizeRoute(value: unknown, path: string, platform: string): MeasurementRunRoute {
  const record = object(value, path);
  exactKeys(record, ROUTE_KEYS, path);
  const route = text(required(record, "route", path), `${path}.route`)!.toLowerCase().replace(/^\/+/, "");
  const method = enumValue(text(required(record, "method", path), `${path}.method`)!.toLowerCase(), ROUTE_METHODS, `${path}.method`);
  const requestedDisposition = enumValue(required(record, "disposition", path), ROUTE_DISPOSITIONS, `${path}.disposition`);
  const explicitSupported = platform === "reddit" && SUPPORTED_REDDIT_ROUTES.has(`${route}|${method}`);
  const disposition = requestedDisposition === "supported" && !explicitSupported ? "unsupported" : requestedDisposition;
  return { route, method, disposition };
}

function normalizeSamplePolicy(value: unknown, path: string): MeasurementRunSamplePolicy {
  const record = object(value, path);
  exactKeys(record, SAMPLE_KEYS, path);
  return {
    selection: enumValue(required(record, "selection", path), SAMPLE_SELECTIONS, `${path}.selection`),
    requiredCount: integer(required(record, "requiredCount", path), `${path}.requiredCount`, true, 1),
    observedCount: integer(required(record, "observedCount", path), `${path}.observedCount`, true, 0),
    terms: textList(required(record, "terms", path), `${path}.terms`),
    confirmation: enumValue(required(record, "confirmation", path), SAMPLE_CONFIRMATIONS, `${path}.confirmation`),
  };
}

function normalizeCollectionWindow(value: unknown, path: string): MeasurementRunCollectionWindow {
  const record = object(value, path);
  exactKeys(record, WINDOW_KEYS, path);
  return {
    start: optionalText(required(record, "start", path), `${path}.start`),
    end: optionalText(required(record, "end", path), `${path}.end`),
    timezone: optionalText(required(record, "timezone", path), `${path}.timezone`),
    term: optionalText(required(record, "term", path), `${path}.term`),
  };
}

function normalizeBaseline(value: unknown, path: string): { id: string | null; term: string | null; evidenceRefs: string[] } {
  const record = object(value, path);
  exactKeys(record, BASELINE_KEYS, path);
  return {
    id: optionalText(required(record, "id", path), `${path}.id`),
    term: optionalText(required(record, "term", path), `${path}.term`),
    evidenceRefs: refs(required(record, "evidenceRefs", path), `${path}.evidenceRefs`),
  };
}

function normalizeResult(value: unknown, path: string): MeasurementRunResult {
  const record = object(value, path);
  exactKeys(record, RESULT_KEYS, path);
  return {
    status: enumValue(required(record, "status", path), new Set(MEASUREMENT_RUN_STATUSES), `${path}.status`),
    evidenceRefs: refs(required(record, "evidenceRefs", path), `${path}.evidenceRefs`),
  };
}

function normalizeInputRow(value: unknown, index: number): MeasurementRunInputRow {
  const path = `rows[${index}]`;
  const record = object(value, path);
  exactKeys(record, ROW_KEYS, path);
  const platform = normalizedIdentity(required(record, "platform", path), `${path}.platform`);
  const account = normalizeIdentity(required(record, "account", path), `${path}.account`);
  const target = normalizeIdentity(required(record, "target", path), `${path}.target`);
  const route = normalizeRoute(required(record, "route", path), `${path}.route`, platform);
  const samplePolicy = normalizeSamplePolicy(required(record, "samplePolicy", path), `${path}.samplePolicy`);
  const collectionWindow = normalizeCollectionWindow(required(record, "collectionWindow", path), `${path}.collectionWindow`);
  const operator = text(required(record, "operator", path), `${path}.operator`)!;
  const evidenceRefs = refs(required(record, "evidenceRefs", path), `${path}.evidenceRefs`);
  const baseline = normalizeBaseline(required(record, "baseline", path), `${path}.baseline`);
  const result = normalizeResult(required(record, "result", path), `${path}.result`);
  const blockers = textList(required(record, "blockers", path), `${path}.blockers`);
  const caveats = textList(required(record, "caveats", path), `${path}.caveats`);
  return { account, target, platform, route, samplePolicy, collectionWindow, operator, evidenceRefs, baseline, result, blockers, caveats };
}

function nextAction(
  account: MeasurementRunIdentity,
  target: MeasurementRunIdentity,
  route: MeasurementRunRoute,
  status: MeasurementRunStatus,
  blockers: readonly string[],
): MeasurementRunNextAction {
  if (route.disposition === "unsupported") return "stop_unsupported_route";
  if (route.disposition === "manual") return "collect_manual_evidence";
  if (account.reviewStatus !== "reviewed" || target.reviewStatus !== "reviewed") return "confirm_identity";
  if (blockers.length > 0) return "resolve_blockers";
  if (status === "measured") return "record_explicit_baseline_fact";
  return "run_supported_route";
}

function buildRow(input: MeasurementRunInputRow, index: number): MeasurementRunRow {
  const account = normalizeIdentity(input.account, `rows[${index}].account`);
  const target = normalizeIdentity(input.target, `rows[${index}].target`);
  const platform = normalizedIdentity(input.platform, `rows[${index}].platform`);
  const route = normalizeRoute(input.route, `rows[${index}].route`, platform);
  const samplePolicy = normalizeSamplePolicy(input.samplePolicy, `rows[${index}].samplePolicy`);
  const collectionWindow = normalizeCollectionWindow(input.collectionWindow, `rows[${index}].collectionWindow`);
  const operator = text(input.operator, `rows[${index}].operator`)!;
  const evidenceRefs = refs(input.evidenceRefs, `rows[${index}].evidenceRefs`);
  const baseline = normalizeBaseline(input.baseline, `rows[${index}].baseline`);
  const requestedResult = normalizeResult(input.result, `rows[${index}].result`);
  const blockers = new Set(textList(input.blockers, `rows[${index}].blockers`));
  const caveats = textList(input.caveats, `rows[${index}].caveats`);

  if (account.reviewStatus === "unconfirmed") blockers.add("account identity is unconfirmed");
  if (account.reviewStatus === "blocked") blockers.add("account identity is blocked");
  if (account.reviewStatus === "unmapped") blockers.add("account identity is unmapped");
  if (target.reviewStatus === "unconfirmed") blockers.add("target identity is unconfirmed");
  if (target.reviewStatus === "blocked") blockers.add("target identity is blocked");
  if (target.reviewStatus === "unmapped") blockers.add("target identity is unmapped");
  if (route.disposition === "supported" && !SUPPORTED_REDDIT_ROUTES.has(`${route.route}|${route.method}`)) blockers.add("route is not an explicitly supported route");
  if (route.disposition === "manual") blockers.add("manual route requires operator-collected evidence");
  if (route.disposition === "unsupported") blockers.add("route is not an explicitly supported route");
  if (samplePolicy.requiredCount === null) blockers.add("minimum sample is not declared");
  if (samplePolicy.observedCount === null) blockers.add("sample count is unknown");
  if (samplePolicy.requiredCount !== null && samplePolicy.observedCount !== null && samplePolicy.observedCount < samplePolicy.requiredCount) blockers.add(`sample is insufficient: ${samplePolicy.observedCount} of ${samplePolicy.requiredCount} observed`);
  if (samplePolicy.terms.length === 0) blockers.add("sample term is missing");
  if (samplePolicy.terms.length > 1) blockers.add("sample uses mixed terms");
  if (samplePolicy.confirmation === "unconfirmed") blockers.add("sample is unconfirmed");
  if (samplePolicy.selection === "winner-only") blockers.add("winner-only sample is not admissible");
  if (samplePolicy.selection === "unknown") blockers.add("sample selection is unknown");
  if (collectionWindow.start === null) blockers.add("collection window start is missing");
  if (collectionWindow.timezone === null) blockers.add("collection window timezone is missing");
  if (collectionWindow.term === null) blockers.add("collection window term is missing");
  if (baseline.id === null) blockers.add("baseline ID is missing");
  if (baseline.term === null) blockers.add("baseline term is missing");
  if (requestedResult.status === "measured" && requestedResult.evidenceRefs.length === 0) blockers.add("measured result has no evidence refs");
  if (requestedResult.status === "unconfirmed") blockers.add("result is unconfirmed");
  if (requestedResult.status === "blocked") blockers.add("result is explicitly blocked");
  if (requestedResult.status === "unsupported") blockers.add("result is unsupported");

  const blockerList = [...blockers].sort((left, right) => left.localeCompare(right));
  const key = measurementRowKey(account.id, target.id);
  const identityUnconfirmed = account.reviewStatus === "unconfirmed" || target.reviewStatus === "unconfirmed";
  const unconfirmedOnly = (identityUnconfirmed || requestedResult.status === "unconfirmed")
    && blockerList.every((blocker) => /identity is unconfirmed|result is unconfirmed/.test(blocker));
  let status: MeasurementRunStatus;
  if (route.disposition === "unsupported") status = "unsupported";
  else if (route.disposition === "manual") status = "blocked";
  else if (unconfirmedOnly) status = "unconfirmed";
  else if (blockerList.length > 0) status = "blocked";
  else status = requestedResult.status;
  const action = nextAction(account, target, route, status, blockerList);

  return {
    kind: "measurement_run_row",
    version: MEASUREMENT_RUN_VERSION,
    key,
    accountId: account.id,
    targetId: target.id,
    account,
    target,
    platform,
    route,
    samplePolicy,
    collectionWindow,
    operator,
    evidenceRefs,
    baselineId: baseline.id,
    baselineTerm: baseline.term,
    baselineEvidenceRefs: baseline.evidenceRefs,
    result: { status, evidenceRefs: requestedResult.evidenceRefs },
    status,
    blockers: blockerList,
    caveats,
    readiness: { status: blockerList.length === 0 ? "ready" : "blocked", blockers: blockerList },
    nextAction: action,
    sideEffects: "none",
  };
}

export function normalizeMeasurementRunInput(value: unknown): MeasurementRunInput {
  const record = object(value, "input");
  exactKeys(record, ["rows"], "input");
  const rows = required(record, "rows", "input");
  if (!Array.isArray(rows)) fail("input.rows must be an array");
  return { rows: rows.map((item, index) => normalizeInputRow(item, index)) };
}

export function normalizeMeasurementIdentity(value: string): string {
  return normalizedIdentity(value, "identity");
}

export function measurementRowKey(accountId: string, targetId: string): string {
  return `account=${normalizeMeasurementIdentity(accountId)}|target=${normalizeMeasurementIdentity(targetId)}`;
}

export function buildMeasurementRun(input: MeasurementRunInput): MeasurementRunManifest {
  const normalized = normalizeMeasurementRunInput(input);
  const rows = normalized.rows.map((row, index) => buildRow(row, index));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.key)) fail(`duplicate measurement identity: ${row.key}`);
    seen.add(row.key);
  }
  rows.sort((left, right) => left.key.localeCompare(right.key));
  const statusCounts = Object.fromEntries(MEASUREMENT_RUN_STATUSES.map((status) => [status, 0])) as Record<MeasurementRunStatus, number>;
  let readyRows = 0;
  let supportedRoutes = 0;
  let manualRoutes = 0;
  let unsupportedRoutes = 0;
  for (const row of rows) {
    statusCounts[row.status] += 1;
    if (row.readiness.status === "ready") readyRows += 1;
    if (row.route.disposition === "supported") supportedRoutes += 1;
    else if (row.route.disposition === "manual") manualRoutes += 1;
    else unsupportedRoutes += 1;
  }
  return {
    kind: "measurement_run_manifest",
    version: MEASUREMENT_RUN_VERSION,
    rows,
    summary: {
      rows: rows.length,
      statusCounts,
      readyRows,
      blockedRows: rows.length - readyRows,
      supportedRoutes,
      manualRoutes,
      unsupportedRoutes,
    },
    sideEffects: "none",
  };
}

export function renderMeasurementRunJson(manifest: MeasurementRunManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  return String(value).replace(/[`|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderMeasurementRunMarkdown(manifest: MeasurementRunManifest): string {
  const lines = [
    "# Measurement run manifest",
    "",
    `Rows: ${manifest.summary.rows}; ready: ${manifest.summary.readyRows}; blocked: ${manifest.summary.blockedRows}`,
    "",
    "| Key | Account | Target | Platform | Route | Method | Status | Next action | Baseline | Evidence refs | Blockers | Caveats |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...manifest.rows.map((row) => `| ${markdownText(row.key)} | ${markdownText(row.accountId)} | ${markdownText(row.targetId)} | ${markdownText(row.platform)} | ${markdownText(row.route.route)} | ${markdownText(row.route.method)} | ${markdownText(row.status)} | ${markdownText(row.nextAction)} | ${markdownText(row.baselineId)} / ${markdownText(row.baselineTerm)} | ${markdownText(row.evidenceRefs.join(", "))} | ${markdownText(row.blockers.join(", "))} | ${markdownText(row.caveats.join(", "))} |`),
    "",
    "This is a body-free, model-free, read-only manifest. No collection, network, model, ranking, or winner side effects are performed.",
    "",
  ];
  return lines.join("\n");
}
