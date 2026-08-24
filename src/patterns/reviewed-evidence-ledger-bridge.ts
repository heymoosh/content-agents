/**
 * Pure seam between the reviewed-evidence intake report and the two append-only ledgers.
 *
 * This file intentionally owns no I/O. It projects explicit fields only, retains the intake
 * readiness/blocker trail beside the append inputs, and fails closed when an envelope contains
 * body, model, PII, ranking, or winner material.
 */

export type IntakeScalar = string | "unknown" | null;
export type IntakeNumber = number | "unknown" | null;

export interface ReviewedEvidenceIntakeReport {
  readonly kind: "reviewed_evidence_intake";
  readonly version: "reviewed-evidence-intake-v1";
  readonly rows: {
    readonly accounts: readonly ReviewedAccountIntakeRow[];
    readonly evidence: readonly ReviewedSourceEvidenceIntakeRow[];
    readonly baselines: readonly ReviewedBaselineIntakeRow[];
  };
  readonly summary: unknown;
  readonly readiness: unknown;
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export interface ReviewedAccountIntakeRow {
  readonly kind: "reviewed_account_intake_row";
  readonly version: "reviewed-evidence-intake-v1";
  readonly id: string;
  readonly currentAccountKey: IntakeScalar;
  readonly platform: IntakeScalar;
  readonly handle: IntakeScalar;
  readonly creator: IntakeScalar;
  readonly stableAccountId: IntakeScalar;
  readonly stableAccountIdStatus: IntakeScalar;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly nicheLabel: IntakeScalar;
  readonly researchPoolMembership: readonly { readonly pool: "niche" | "broad" | "format"; readonly reason: string }[] | "unknown" | null;
  readonly popularityScope: IntakeScalar;
  readonly sampleScope: IntakeScalar;
  readonly baselineScope: IntakeScalar;
  readonly baselineSource: IntakeScalar;
  readonly medium: IntakeScalar;
  readonly format: IntakeScalar;
  readonly audienceSnapshot: ReviewedAudienceSnapshot | "unknown" | null;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly reviewer: IntakeScalar;
  readonly reviewedAt: IntakeScalar;
  readonly disposition: "pending" | "reviewed" | "blocked" | "unmapped" | null;
  readonly dispositionReason: IntakeScalar;
  readonly readiness: ReviewedReadiness;
  readonly bodyIncluded: false;
  readonly [key: string]: unknown;
}

export interface ReviewedAudienceSnapshot {
  readonly size: IntakeNumber;
  readonly countType: IntakeScalar;
  readonly provenance: IntakeScalar;
  readonly asOf: IntakeScalar;
  readonly collectedAt: IntakeScalar;
}

export interface ReviewedMetricSnapshot {
  readonly metric: IntakeScalar;
  readonly value: IntakeNumber;
  readonly unit: IntakeScalar;
  readonly numerator: IntakeNumber;
  readonly denominator: IntakeNumber;
  readonly window: IntakeScalar;
  readonly scope: IntakeScalar;
  readonly observedAt: IntakeScalar;
}

export interface ReviewedReadiness {
  readonly status: "ready" | "blocked" | "unmapped";
  readonly blockers: readonly string[];
}

export interface ReviewedSourceEvidenceIntakeRow {
  readonly kind: "reviewed_source_evidence_intake_row";
  readonly version: "reviewed-evidence-intake-v1";
  readonly id: IntakeScalar;
  readonly sourceId: IntakeScalar;
  readonly postId: IntakeScalar;
  readonly accountId: IntakeScalar;
  readonly platform: IntakeScalar;
  readonly medium: IntakeScalar;
  readonly format: IntakeScalar;
  readonly pool: "niche" | "broad" | "format" | null;
  readonly membershipReason: IntakeScalar;
  readonly audienceSizeSnapshot: ReviewedAudienceSnapshot | "unknown" | null;
  readonly metricSnapshot: ReviewedMetricSnapshot | "unknown" | null;
  readonly comparisonClaimed: boolean | null;
  readonly popularityScope: IntakeScalar;
  readonly sampleScope: IntakeScalar;
  readonly baselineScope: IntakeScalar;
  readonly baselineSource: IntakeScalar;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly bodyComplete: boolean | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly provenance: IntakeScalar;
  readonly observedAt: IntakeScalar;
  readonly collectedAt: IntakeScalar;
  readonly reviewStatus: IntakeScalar;
  readonly status: IntakeScalar;
  readonly lineage: readonly { readonly recordType: string; readonly id: string; readonly relation: string }[] | "unknown" | null;
  readonly readiness: ReviewedReadiness;
  readonly bodyIncluded: false;
  readonly [key: string]: unknown;
}

export interface ReviewedBaselineIntakeRow {
  readonly id: IntakeScalar;
  readonly readiness: ReviewedReadiness;
  readonly [key: string]: unknown;
}

/** Account projection; rows with null required fields remain visibly blocked until a caller completes them. */
export interface AccountReviewInput {
  readonly id: string;
  readonly currentAccountKey: IntakeScalar;
  readonly platform: IntakeScalar;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly stableAccountId: string | null;
  readonly stableAccountIdStatus: "confirmed" | "unconfirmed" | "blocked" | "unmapped" | null;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly nicheLabel: IntakeScalar;
  readonly researchPoolMembership: ReviewedAccountIntakeRow["researchPoolMembership"];
  readonly popularityScope: IntakeScalar;
  readonly sampleScope: IntakeScalar;
  readonly baselineScope: IntakeScalar;
  readonly baselineSource: IntakeScalar;
  readonly medium: IntakeScalar;
  readonly format: IntakeScalar;
  readonly audienceSnapshot: ReviewedAudienceSnapshot | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly baselineRefs: string[] | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly reviewer: IntakeScalar;
  readonly reviewNote: IntakeScalar;
  readonly disposition: "reviewed" | "pending" | "blocked" | "unmapped" | null;
  readonly dispositionReason: IntakeScalar;
  readonly reviewed_at: IntakeScalar;
  readonly supersedesId: null;
}

/** A body-free source ledger record input; blocked rows may retain a null evidence id. */
export type SourceEvidenceLedgerRecordInput = Record<string, unknown> & {
  readonly kind: "source_evidence_ledger_record";
  readonly version: "source-evidence-ledger-v1";
  readonly id: string | null;
  readonly evidenceId: string | null;
  readonly bodyIncluded: false;
};

export interface ReviewedEvidenceLedgerBridge {
  readonly accountReviewInputs: AccountReviewInput[];
  readonly sourceEvidenceRecordInputs: SourceEvidenceLedgerRecordInput[];
  /** Baseline rows stay intact for the separate baseline-measurement-ledger projection. */
  readonly baselineIntakeRows: ReviewedBaselineIntakeRow[];
  readonly blockers: Array<{ readonly kind: "account" | "evidence" | "baseline"; readonly id: string | null; readonly blockers: string[] }>;
}

const FORBIDDEN = new Set([
  "body", "bodytext", "postbody", "posttext", "creatorbody", "rawbody", "transcript", "transcripttext", "caption", "content", "text",
  "model", "modelname", "modelversion", "prompt", "completion", "generatedby", "llm", "email", "phone", "phonenumber", "address", "ip", "ipaddress", "pii",
  "ranking", "rank", "score", "scores", "winner", "winners", "selectedwinner", "winnerclaim",
]);

function keyName(key: string): string { return key.replace(/[_-]/g, "").toLowerCase(); }

function rejectForbidden(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`${path} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) { value.forEach((item, index) => rejectForbidden(item, `${path}[${index}]`, seen)); return; }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(keyName(key))) throw new Error(`${path}.${key} is unsupported; body, model, PII, ranking, and winner fields are not accepted`);
    rejectForbidden(nested, `${path}.${key}`, seen);
  }
}

function scalar(value: IntakeScalar): string | null { return value === "unknown" ? null : value; }
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => copy(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, copy(nested)])) as T;
  return value;
}

function accountInput(row: ReviewedAccountIntakeRow, baselineRefs: string[] | "unknown" | null): AccountReviewInput {
  const stableStatus = row.stableAccountIdStatus === "confirmed" || row.stableAccountIdStatus === "unconfirmed" || row.stableAccountIdStatus === "blocked" || row.stableAccountIdStatus === "unmapped"
    ? row.stableAccountIdStatus : null;
  return {
    id: row.id, currentAccountKey: row.currentAccountKey, platform: row.platform,
    handle: scalar(row.handle), creator: scalar(row.creator), stableAccountId: scalar(row.stableAccountId), stableAccountIdStatus: stableStatus,
    topics: copy(row.topics), focus: copy(row.focus), nicheLabel: row.nicheLabel, researchPoolMembership: copy(row.researchPoolMembership),
    popularityScope: row.popularityScope, sampleScope: row.sampleScope, baselineScope: row.baselineScope, baselineSource: row.baselineSource,
    medium: row.medium, format: row.format, audienceSnapshot: copy(row.audienceSnapshot), evidenceRefs: copy(row.evidenceRefs), baselineRefs,
    caveats: copy(row.caveats), reviewer: row.reviewer, reviewNote: row.dispositionReason, disposition: row.disposition, dispositionReason: row.dispositionReason,
    reviewed_at: row.reviewedAt, supersedesId: null,
  };
}

function sourceInput(row: ReviewedSourceEvidenceIntakeRow, baselineRefs: string[] | "unknown" | null): SourceEvidenceLedgerRecordInput {
  const evidenceId = scalar(row.id);
  return {
    kind: "source_evidence_ledger_record", version: "source-evidence-ledger-v1", id: evidenceId, evidenceId,
    sourceId: row.sourceId, postId: row.postId, accountId: row.accountId, platform: row.platform,
    url: null, locator: null, sourceRole: null, evidenceLocation: null, comparisonClaimed: row.comparisonClaimed,
    pool: row.pool, membershipReason: row.membershipReason, nicheLabel: null, topics: null, focus: null, medium: row.medium, format: row.format,
    audienceSizeSnapshot: copy(row.audienceSizeSnapshot), metricSnapshot: copy(row.metricSnapshot), popularityScope: row.popularityScope,
    sampleScope: row.sampleScope, observedAt: row.observedAt, collectedAt: row.collectedAt, selectionRule: null, baselineScope: row.baselineScope,
    provenance: row.provenance, evidenceRefs: copy(row.evidenceRefs), evidenceLinks: copy(row.evidenceLinks), baselineRefs, baselineSource: row.baselineSource,
    bodyComplete: row.bodyComplete, reviewStatus: row.reviewStatus, recordStatus: row.status, caveats: copy(row.caveats), lineage: copy(row.lineage),
    readiness: copy(row.readiness), bodyIncluded: false,
  };
}

function blockers(kind: "account" | "evidence" | "baseline", id: string | null, row: { readonly readiness: ReviewedReadiness }): ReviewedEvidenceLedgerBridge["blockers"][number] | null {
  if (row.readiness.blockers.length === 0) return null;
  return { kind, id, blockers: [...new Set(row.readiness.blockers)].sort((left, right) => left.localeCompare(right)) };
}

export function bridgeReviewedEvidenceIntake(report: ReviewedEvidenceIntakeReport): ReviewedEvidenceLedgerBridge {
  rejectForbidden(report, "report");
  if (report.kind !== "reviewed_evidence_intake" || report.version !== "reviewed-evidence-intake-v1") throw new Error("unsupported reviewed evidence intake report");
  const accountRows = [...report.rows.accounts].sort((a, b) => a.id.localeCompare(b.id));
  const evidenceRows = [...report.rows.evidence].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  const baselineRows = [...report.rows.baselines].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  const baselineRefsByAccount = new Map<string, string[]>();
  for (const row of baselineRows) {
    const id = scalar(row.id);
    const accountId = typeof row.accountId === "string" ? row.accountId : null;
    if (id === null || accountId === null) continue;
    const refs = baselineRefsByAccount.get(accountId) ?? [];
    refs.push(id);
    baselineRefsByAccount.set(accountId, refs);
  }
  for (const refs of baselineRefsByAccount.values()) refs.sort((left, right) => left.localeCompare(right));
  const blockerRows = [
    ...accountRows.map((row) => blockers("account", row.id, row)),
    ...evidenceRows.map((row) => blockers("evidence", scalar(row.id), row)),
    ...baselineRows.map((row) => blockers("baseline", scalar(row.id), row)),
  ].filter((row): row is ReviewedEvidenceLedgerBridge["blockers"][number] => row !== null)
    .sort((a, b) => a.kind.localeCompare(b.kind) || String(a.id ?? "").localeCompare(String(b.id ?? "")));
  return {
    accountReviewInputs: accountRows.map((row) => accountInput(row, baselineRefsByAccount.get(scalar(row.stableAccountId) ?? scalar(row.currentAccountKey) ?? "") ?? null)),
    sourceEvidenceRecordInputs: evidenceRows.map((row) => sourceInput(row, baselineRefsByAccount.get(scalar(row.accountId) ?? "") ?? null)),
    baselineIntakeRows: baselineRows.map((row) => copy(row)),
    blockers: blockerRows,
  };
}

export const buildReviewedEvidenceLedgerBridge = bridgeReviewedEvidenceIntake;
