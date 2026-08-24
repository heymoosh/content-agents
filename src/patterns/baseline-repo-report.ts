import {
  buildBaselineGapReport,
  type BaselineGapReport,
  type BaselineGapTarget,
} from "./baseline-gap-report.js";
import { PLATFORMS, type AccountBaseline, type AccountSeed, type PatternMiningConfig, type Platform } from "./types.js";

export const BASELINE_REPO_REPORT_VERSION = "baseline-repo-report-v1" as const;

export type BaselineRepoTarget = Pick<AccountSeed, "platform" | "handle" | "niche"> & {
  readonly topics?: readonly string[];
  readonly focus?: readonly string[];
  readonly topic?: string | null;
  readonly sampleSize?: number | null;
  readonly minAgeDays?: number | null;
  readonly method?: string | null;
  readonly caveats?: readonly string[];
};

export type BaselineRepoTargetSource = PatternMiningConfig | readonly BaselineRepoTarget[];

export type BaselineRepoRow = BaselineGapReport["rows"][number] & {
  readonly niche: string;
  readonly topics: string[];
};

export interface BaselineRepoReport {
  readonly kind: "baseline_repo_report";
  readonly version: typeof BASELINE_REPO_REPORT_VERSION;
  readonly rows: BaselineRepoRow[];
  readonly blockedTargets: readonly {
    readonly platform: Platform;
    readonly creator: string;
    readonly niche: string;
    readonly reason: "handle_not_confirmed";
  }[];
  readonly summary: BaselineGapReport["summary"];
  readonly sideEffects: "none";
  readonly note: string;
}

function fail(message: string): never {
  throw new TypeError(`invalid baseline repo target: ${message}`);
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value.trim();
}

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    fail(`${field} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

function targetArray(source: BaselineRepoTargetSource): readonly BaselineRepoTarget[] {
  if (Array.isArray(source)) return source;
  if (source === null || typeof source !== "object" || !("accounts" in source) || !Array.isArray(source.accounts)) {
    fail("source must be a target array or PatternMiningConfig with accounts");
  }
  return source.accounts;
}

function isConfigSource(source: BaselineRepoTargetSource): source is PatternMiningConfig {
  return !Array.isArray(source);
}

function normalizeTarget(raw: BaselineRepoTarget, index: number): { target: BaselineGapTarget; niche: string; topics: string[] } {
  if (raw === null || typeof raw !== "object") fail(`targets[${index}] must be an object`);
  if (!PLATFORMS.includes(raw.platform as Platform)) fail(`targets[${index}].platform is unsupported`);
  const platform = raw.platform;
  const handle = nonEmptyString(raw.handle, `targets[${index}].handle`);
  const niche = nonEmptyString(raw.niche, `targets[${index}].niche`);
  const topics = stringList(raw.topics, `targets[${index}].topics`);
  const focus = stringList(raw.focus, `targets[${index}].focus`);
  if (raw.sampleSize !== undefined && raw.sampleSize !== null && (!Number.isInteger(raw.sampleSize) || raw.sampleSize <= 0)) fail(`targets[${index}].sampleSize must be a positive integer or null`);
  if (raw.minAgeDays !== undefined && raw.minAgeDays !== null && (!Number.isInteger(raw.minAgeDays) || raw.minAgeDays < 0)) fail(`targets[${index}].minAgeDays must be a non-negative integer or null`);
  if (raw.method !== undefined && raw.method !== null) nonEmptyString(raw.method, `targets[${index}].method`);
  const target: BaselineGapTarget = {
    platform,
    handle,
    topic: raw.topic === undefined || raw.topic === null ? null : nonEmptyString(raw.topic, `targets[${index}].topic`),
    focus,
    sampleSize: raw.sampleSize,
    minAgeDays: raw.minAgeDays,
    method: raw.method,
    caveats: raw.caveats === undefined ? undefined : stringList(raw.caveats, `targets[${index}].caveats`),
  };
  return { target, niche, topics };
}

export function buildBaselineRepoReport(
  source: BaselineRepoTargetSource,
  baselines: readonly AccountBaseline[],
): BaselineRepoReport {
  if (!Array.isArray(baselines)) fail("baselines must be an array");
  const configuredTargets = targetArray(source);
  const configAccounts = isConfigSource(source) ? source.accounts : [];
  const blockedTargets = isConfigSource(source)
    ? configAccounts.flatMap((raw) => raw.handle === null
      ? [{ platform: raw.platform, creator: nonEmptyString(raw.creator, "creator"), niche: nonEmptyString(raw.niche, "niche"), reason: "handle_not_confirmed" as const }]
      : [])
    : [];
  const normalized = (isConfigSource(source) ? configuredTargets.filter((raw) => raw.handle !== null) : configuredTargets)
    .map(normalizeTarget);
  const gapReport = buildBaselineGapReport(normalized.map(({ target }) => target), baselines);
  const metadata = new Map(normalized.map(({ target, niche, topics }) => [
    `${target.platform}|${target.handle.trim().replace(/^@/, "").toLowerCase()}`,
    { niche, topics },
  ]));
  return {
    kind: "baseline_repo_report",
    version: BASELINE_REPO_REPORT_VERSION,
    rows: gapReport.rows.map((row) => {
      const details = metadata.get(row.accountKey);
      if (!details) fail(`no metadata for ${row.accountKey}`);
      return { ...row, niche: details.niche, topics: [...details.topics] };
    }),
    summary: gapReport.summary,
    blockedTargets,
    sideEffects: "none",
    note: gapReport.note,
  };
}

export const createBaselineRepoReport = buildBaselineRepoReport;
