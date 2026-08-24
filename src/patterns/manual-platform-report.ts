import type {
  ManualCollectionStatus,
  ManualPlatformIntake,
} from "./manual-platform-intake.js";

export const MANUAL_PLATFORM_REPORT_VERSION = "manual-platform-report-v1" as const;
export const MANUAL_PLATFORM_REPORT_NOTE =
  "Descriptive coverage only. This report does not rank creators, infer best accounts, fetch data, copy body text, or treat unranked observations as winners." as const;

export type ManualReportValue = string | "unknown" | null;

export interface ManualPlatformReportCount {
  readonly value: string;
  readonly count: number;
}

export interface ManualPlatformReportStatusCount {
  readonly status: ManualCollectionStatus | "missing";
  readonly count: number;
}

export interface ManualPlatformReportPlatformRow {
  readonly platform: ManualReportValue;
  readonly count: number;
  readonly collectionStatuses: readonly ManualPlatformReportStatusCount[];
}

export interface ManualPlatformReportMissingCounts {
  readonly scope: number;
  readonly topic: number;
  readonly focus: number;
  readonly popularity: number;
  readonly sample: number;
  readonly baseline: number;
}

export interface ManualPlatformReportBodyCounts {
  readonly included: number;
  readonly complete: number;
}

export interface ManualPlatformReport {
  readonly kind: "manual_platform_report";
  readonly version: typeof MANUAL_PLATFORM_REPORT_VERSION;
  readonly note: typeof MANUAL_PLATFORM_REPORT_NOTE;
  readonly observationCount: number;
  readonly platforms: readonly ManualPlatformReportPlatformRow[];
  readonly collectionStatuses: readonly ManualPlatformReportStatusCount[];
  readonly missing: ManualPlatformReportMissingCounts;
  readonly body: ManualPlatformReportBodyCounts;
  readonly roles: readonly ManualPlatformReportCount[];
  readonly pools: readonly ManualPlatformReportCount[];
  readonly sideEffects: "none";
}

type MutablePlatform = {
  readonly platform: ManualReportValue;
  count: number;
  statuses: Map<string, number>;
};

type LooseRecord = Record<string, unknown>;

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function missingList(value: readonly string[] | "unknown" | null): boolean {
  return value === null || value === "unknown" || value.length === 0;
}

function reportValue(value: unknown): ManualReportValue {
  if (value === "unknown") return "unknown";
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function keyFor(value: ManualReportValue): string {
  return value === null ? "" : value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareReportValues(left: ManualReportValue, right: ManualReportValue): number {
  return compareStrings(keyFor(left), keyFor(right));
}

function statusOf(value: ManualCollectionStatus | null): ManualCollectionStatus | "missing" {
  return value ?? "missing";
}

function countEntries(counts: Map<string, number>): ManualPlatformReportCount[] {
  return [...counts.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([value, count]) => ({ value, count }));
}

function statusEntries(counts: Map<string, number>): ManualPlatformReportStatusCount[] {
  return [...counts.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([status, count]) => ({ status: status as ManualCollectionStatus | "missing", count }));
}

function explicitCount(records: readonly ManualPlatformIntake[], field: string): ManualPlatformReportCount[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = reportValue((record as unknown as LooseRecord)[field]);
    if (value === null || value === "unknown") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return countEntries(counts);
}

function platformRows(records: readonly ManualPlatformIntake[]): ManualPlatformReportPlatformRow[] {
  const platforms = new Map<string, MutablePlatform>();
  for (const record of records) {
    const platform = reportValue(record.platform);
    const key = JSON.stringify(platform);
    const row = platforms.get(key) ?? { platform, count: 0, statuses: new Map<string, number>() };
    row.count += 1;
    const status = statusOf(record.collectionStatus);
    row.statuses.set(status, (row.statuses.get(status) ?? 0) + 1);
    platforms.set(key, row);
  }
  return [...platforms.values()]
    .sort((left, right) => compareReportValues(left.platform, right.platform))
    .map((row) => ({
      platform: row.platform,
      count: row.count,
      collectionStatuses: statusEntries(row.statuses),
    }));
}

function missingCounts(records: readonly ManualPlatformIntake[]): ManualPlatformReportMissingCounts {
  return records.reduce<ManualPlatformReportMissingCounts>((counts, record) => ({
    scope: counts.scope + (isMissing(record.scope) ? 1 : 0),
    topic: counts.topic + (missingList(record.topics) ? 1 : 0),
    focus: counts.focus + (missingList(record.focus) ? 1 : 0),
    popularity: counts.popularity + (isMissing(record.popularityScope) ? 1 : 0),
    sample: counts.sample + (isMissing(record.sampleScope) ? 1 : 0),
    baseline: counts.baseline + (isMissing(record.baselineScope) || isMissing(record.baselineSource) ? 1 : 0),
  }), { scope: 0, topic: 0, focus: 0, popularity: 0, sample: 0, baseline: 0 });
}

export function buildManualPlatformReport(records: readonly ManualPlatformIntake[]): ManualPlatformReport {
  const collectionStatuses = new Map<string, number>();
  for (const record of records) {
    const status = statusOf(record.collectionStatus);
    collectionStatuses.set(status, (collectionStatuses.get(status) ?? 0) + 1);
  }
  const included = records.filter((record) => record.bodyIncluded).length;
  const complete = records.filter((record) => record.bodyComplete).length;
  return {
    kind: "manual_platform_report",
    version: MANUAL_PLATFORM_REPORT_VERSION,
    note: MANUAL_PLATFORM_REPORT_NOTE,
    observationCount: records.length,
    platforms: platformRows(records),
    collectionStatuses: statusEntries(collectionStatuses),
    missing: missingCounts(records),
    body: { included, complete },
    roles: explicitCount(records, "role"),
    pools: explicitCount(records, "pool"),
    sideEffects: "none",
  };
}

export const createManualPlatformReport = buildManualPlatformReport;

export function renderManualPlatformReportJson(report: ManualPlatformReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderManualPlatformReportMarkdown(report: ManualPlatformReport): string {
  const lines = [
    "# Manual platform observation report",
    "",
    report.note,
    "",
    `Observations: ${report.observationCount}`,
    "",
    "## Platforms",
    "",
    "| Platform | Observations | Collection statuses |",
    "| --- | ---: | --- |",
    ...report.platforms.map((row) => [
      row.platform ?? "(missing)",
      String(row.count),
      row.collectionStatuses.map((status) => `${status.status}: ${status.count}`).join(", "),
    ].map((cell) => cell.replaceAll("|", "\\|")).join(" | ").replace(/^/, "| ").concat(" |")),
    "",
    "## Coverage gaps",
    "",
    `- Missing scope: ${report.missing.scope}`,
    `- Missing topic: ${report.missing.topic}`,
    `- Missing focus: ${report.missing.focus}`,
    `- Missing popularity facts: ${report.missing.popularity}`,
    `- Missing sample facts: ${report.missing.sample}`,
    `- Missing baseline facts: ${report.missing.baseline}`,
    `- Body included: ${report.body.included}`,
    `- Body complete: ${report.body.complete}`,
    "",
    `Roles explicitly present: ${formatCounts(report.roles)}`,
    `Pools explicitly present: ${formatCounts(report.pools)}`,
    "",
  ];
  return lines.join("\n");
}

function formatCounts(counts: readonly ManualPlatformReportCount[]): string {
  return counts.length === 0 ? "none" : counts.map((entry) => `${entry.value} (${entry.count})`).join(", ");
}
