import type { Opener, OpenerWarning } from "./types.js";

export const OPENER_REPORT_VERSION = "opener-report-v1" as const;
export type OpenerReportStatus = "blocked" | "ready" | "review";

export interface OpenerReportRow {
  readonly id: string;
  readonly corpus_entry_id: string;
  readonly platform: Opener["platform"];
  readonly creator: string;
  readonly handle: string;
  readonly sourceUrl: string;
  readonly performance: Opener["performance"];
  readonly verbatim_ok: boolean;
  readonly warnings: readonly OpenerWarning[];
  readonly status: OpenerReportStatus;
  /** Exact captured text, retained only as explicitly labeled source evidence. */
  readonly sourceEvidence: { readonly opener_text: string; readonly onscreen_title: string | null };
}

export interface OpenerReportStatusCounts {
  readonly blocked: number;
  readonly ready: number;
  readonly review: number;
}

export interface OpenerReportGroup {
  readonly platform: Opener["platform"];
  readonly rows: readonly OpenerReportRow[];
  readonly statusCounts: OpenerReportStatusCounts;
}

export interface OpenerReport {
  readonly kind: "opener_operator_report";
  readonly version: typeof OPENER_REPORT_VERSION;
  readonly rows: readonly OpenerReportRow[];
  readonly groups: readonly OpenerReportGroup[];
  readonly summary: { readonly total: number; readonly statusCounts: OpenerReportStatusCounts };
  readonly policyNote: string;
  readonly sideEffects: "none";
}

const BLOCKING_WARNINGS = new Set<OpenerWarning["code"]>([
  "substance-outside-body",
  "short-body",
  "media-first-platform",
]);

const POLICY_NOTE =
  "Common hook mad-lib adaptation is allowed downstream. Creator-body copying and winner inference are not authorized by this report.";

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function statusFor(opener: Opener): OpenerReportStatus {
  if (opener.warnings.some((warning) => BLOCKING_WARNINGS.has(warning.code))) return "blocked";
  return opener.warnings.length === 0 ? "ready" : "review";
}

function countStatuses(rows: readonly OpenerReportRow[]): OpenerReportStatusCounts {
  const counts = { blocked: 0, ready: 0, review: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

function rowFor(opener: Opener): OpenerReportRow {
  return {
    id: opener.id,
    corpus_entry_id: opener.corpus_entry_id,
    platform: opener.platform,
    creator: opener.creator,
    handle: opener.handle,
    sourceUrl: opener.url,
    performance: { ...opener.performance },
    verbatim_ok: opener.verbatim_ok,
    warnings: opener.warnings.map((warning) => ({ ...warning })),
    status: statusFor(opener),
    sourceEvidence: { opener_text: opener.opener_text, onscreen_title: opener.onscreen_title },
  };
}

/** Build a body-free, deterministic operator view over already-normalized opener records. */
export function buildOpenerReport(openers: readonly Opener[]): OpenerReport {
  const rows = openers.map(rowFor).sort((left, right) => compare(left.id, right.id));
  const platforms = [...new Set(rows.map((row) => row.platform))].sort(compare);
  const groups = platforms.map((platform) => {
    const groupRows = rows.filter((row) => row.platform === platform);
    return { platform, rows: groupRows, statusCounts: countStatuses(groupRows) };
  });
  return {
    kind: "opener_operator_report",
    version: OPENER_REPORT_VERSION,
    rows,
    groups,
    summary: { total: rows.length, statusCounts: countStatuses(rows) },
    policyNote: POLICY_NOTE,
    sideEffects: "none",
  };
}

export function renderOpenerReportJson(report: OpenerReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownCell(value: string | number | boolean | null): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function warningText(warnings: readonly OpenerWarning[]): string {
  return warnings.length === 0 ? "none" : warnings.map((warning) => `${warning.code}: ${warning.note}`).join("; ");
}

function sourceEvidenceText(row: OpenerReportRow): string {
  return `opener_text: ${row.sourceEvidence.opener_text}\nonscreen_title: ${row.sourceEvidence.onscreen_title ?? "null"}`;
}

/** Render the same body-free report for a human operator; source text is visibly evidence. */
export function renderOpenerReportMarkdown(report: OpenerReport): string {
  const counts = report.summary.statusCounts;
  const lines = [
    "# Opener operator report",
    "",
    `Rows: ${report.summary.total} | blocked ${counts.blocked} | ready ${counts.ready} | review ${counts.review}`,
    `Policy: ${report.policyNote}`,
    "",
    "| Status | Platform | Creator | Handle | Source URL | Source ID | Performance | Verbatim allowed | Warnings | Source evidence (verbatim) |",
    "|---|---|---|---|---|---|---|---:|---|---|",
    ...report.rows.map((row) => {
      const performance = `${row.performance.multiple ?? "null"} / ${row.performance.metric ?? "null"} / ${row.performance.note}`;
      return `| ${row.status} | ${markdownCell(row.platform)} | ${markdownCell(row.creator)} | ${markdownCell(row.handle)} | ${markdownCell(row.sourceUrl)} | ${markdownCell(row.corpus_entry_id)} | ${markdownCell(performance)} | ${row.verbatim_ok} | ${markdownCell(warningText(row.warnings))} | ${markdownCell(sourceEvidenceText(row))} |`;
    }),
    "",
    "## Platform groups",
    "",
    ...report.groups.map((group) => `- ${group.platform}: ${group.rows.length} rows (blocked ${group.statusCounts.blocked}, ready ${group.statusCounts.ready}, review ${group.statusCounts.review})`),
    "",
    report.policyNote,
    "",
  ];
  return lines.join("\n");
}
