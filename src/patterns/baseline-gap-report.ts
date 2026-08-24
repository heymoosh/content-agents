import { accountKey } from "./corpus.js";
import type { AccountBaseline, Platform } from "./types.js";

export const BASELINE_GAP_REPORT_VERSION = "baseline-gap-report-v1" as const;

export interface BaselineGapTarget {
  readonly platform: Platform;
  readonly handle: string;
  readonly topic?: string | null;
  readonly focus?: readonly string[] | null;
  readonly sampleSize?: number | null;
  readonly minAgeDays?: number | null;
  readonly method?: string | null;
  readonly caveats?: readonly string[];
}

export interface BaselineGapMeasured {
  readonly sampleSize: number;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly method: string;
  readonly collectedAt: string;
}

export interface BaselineGapRow {
  readonly accountKey: string;
  readonly platform: Platform;
  readonly handle: string;
  readonly topic: string | null;
  readonly focus: string[];
  readonly action: "measure_baseline" | "already_measured";
  readonly requiredRoute: "/new";
  readonly sampleSize: number | null;
  readonly minAgeDays: number | null;
  readonly method: string | null;
  readonly caveats: string[];
  readonly measured: BaselineGapMeasured | null;
}

export interface BaselineGapReport {
  readonly kind: "baseline_gap_report";
  readonly version: typeof BASELINE_GAP_REPORT_VERSION;
  readonly rows: BaselineGapRow[];
  readonly summary: {
    readonly total: number;
    readonly needsMeasurement: number;
    readonly alreadyMeasured: number;
  };
  readonly sideEffects: "none";
  readonly note: string;
}

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeTarget(target: BaselineGapTarget): BaselineGapTarget {
  if (typeof target.handle !== "string" || target.handle.trim() === "") {
    throw new Error("baseline target handle must be a non-empty string");
  }
  if (target.sampleSize !== undefined && target.sampleSize !== null &&
      (!Number.isInteger(target.sampleSize) || target.sampleSize <= 0)) {
    throw new Error("baseline target sampleSize must be a positive integer or null");
  }
  if (target.minAgeDays !== undefined && target.minAgeDays !== null &&
      (!Number.isInteger(target.minAgeDays) || target.minAgeDays < 0)) {
    throw new Error("baseline target minAgeDays must be a non-negative integer or null");
  }
  return {
    ...target,
    handle: target.handle.trim(),
    topic: target.topic?.trim() || null,
    focus: [...new Set((target.focus ?? []).map((value) => value.trim()).filter(Boolean))].sort(compareValues),
    caveats: [...new Set((target.caveats ?? []).map((value) => value.trim()).filter(Boolean))].sort(compareValues),
  };
}

function measuredBaseline(baseline: AccountBaseline): BaselineGapMeasured {
  return {
    sampleSize: baseline.sample_size,
    windowStart: baseline.window_start,
    windowEnd: baseline.window_end,
    method: baseline.method,
    collectedAt: baseline.collected_at,
  };
}

/**
 * Projects the explicit baseline ledger against explicit targets. This is a plan for measurement,
 * not a collector: it never writes, fetches, manufactures a median, or calls a winners-only
 * sample a baseline. The route is deliberately fixed to `/new`, the unbiased route used by the
 * Reddit collector and the handoff.
 */
export function buildBaselineGapReport(
  targets: readonly BaselineGapTarget[],
  baselines: readonly AccountBaseline[],
): BaselineGapReport {
  const index = new Map(baselines.map((baseline) => [accountKey(baseline), baseline]));
  const rows = targets
    .map(normalizeTarget)
    .sort((left, right) => compareValues(
      accountKey({ platform: left.platform, handle: left.handle }),
      accountKey({ platform: right.platform, handle: right.handle }),
    ))
    .map((target): BaselineGapRow => {
      const baseline = index.get(accountKey({ platform: target.platform, handle: target.handle }));
      return {
        accountKey: accountKey({ platform: target.platform, handle: target.handle }),
        platform: target.platform,
        handle: target.handle,
        topic: target.topic ?? null,
        focus: [...(target.focus ?? [])],
        action: baseline ? "already_measured" : "measure_baseline",
        requiredRoute: "/new",
        sampleSize: target.sampleSize ?? null,
        minAgeDays: target.minAgeDays ?? null,
        method: target.method ?? null,
        caveats: [...(target.caveats ?? [])],
        measured: baseline ? measuredBaseline(baseline) : null,
      };
    });
  const needsMeasurement = rows.filter((row) => row.action === "measure_baseline").length;
  return {
    kind: "baseline_gap_report",
    version: BASELINE_GAP_REPORT_VERSION,
    rows,
    summary: {
      total: rows.length,
      needsMeasurement,
      alreadyMeasured: rows.length - needsMeasurement,
    },
    sideEffects: "none",
    note: "Descriptive baseline plan only. Each measure_baseline row requires an actual settled sample from /new; no median or winner claim is inferred here.",
  };
}

export const createBaselineGapReport = buildBaselineGapReport;

export function renderBaselineGapReportJson(report: BaselineGapReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownText(value: string | number | null): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderBaselineGapReportMarkdown(report: BaselineGapReport): string {
  const lines = [
    "# Baseline measurement gaps",
    "",
    `- Targets: ${report.summary.total}`,
    `- Need measurement: ${report.summary.needsMeasurement}`,
    `- Already measured: ${report.summary.alreadyMeasured}`,
    "- Route: `/new` only",
    "",
    "| Account | Platform | Handle | Topic | Focus | Action | Sample size | Min age days | Measured sample | Caveats |",
    "|---|---|---|---|---|---|---:|---:|---:|---|",
    ...report.rows.map((row) => `| ${markdownText(row.accountKey)} | ${markdownText(row.platform)} | ${markdownText(row.handle)} | ${markdownText(row.topic)} | ${markdownText(row.focus.join(", "))} | ${row.action} | ${markdownText(row.sampleSize)} | ${markdownText(row.minAgeDays)} | ${markdownText(row.measured?.sampleSize ?? null)} | ${markdownText(row.caveats.join("; "))} |`),
    "",
    `Note: ${report.note}`,
    "",
  ];
  return lines.join("\n");
}
