/** Pure, human-gated task for preparing a response to an observed platform comment. */
export const APPROVED_REPLY_TASK_VERSION = "approved-reply-task-v1" as const;

export interface ApprovedReplyTaskInput { readonly [key: string]: unknown; }
export interface ApprovedReplyTaskReadiness { readonly status: "ready" | "blocked"; readonly blockers: string[]; }
export interface ApprovedReplyTask {
  readonly kind: "approved_reply_task";
  readonly version: typeof APPROVED_REPLY_TASK_VERSION;
  readonly id: string;
  readonly commentObservationId: string;
  readonly draftText: string;
  readonly replyPurpose: string;
  readonly claimRefs: string[];
  readonly targetPlatform: string;
  readonly humanDecision: "pending" | "approve" | "decline";
  readonly decidedBy: "muxin" | null;
  readonly decidedAt: string | null;
  readonly deliveryStatus: "not_sent" | "sent";
  readonly sentAt: string | null;
  readonly lineage: Array<{ recordType: string; id: string; relation: string | null }>;
  readonly status: "pending" | "approved" | "declined" | "sent";
  readonly readiness: ApprovedReplyTaskReadiness;
  readonly autoSend: false;
  readonly autoPublish: false;
  readonly sideEffects: "none";
}

export class ApprovedReplyTaskValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ApprovedReplyTaskValidationError"; }
}
type RecordValue = Record<string, unknown>;
function record(value: unknown, field: string): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ApprovedReplyTaskValidationError(`${field} must be an object`);
  return value as RecordValue;
}
function alias(input: RecordValue, camel: string, snake: string): unknown { return input[camel] ?? input[snake]; }
function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ApprovedReplyTaskValidationError(`${field} is required`);
  return value.trim();
}
function preservedText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ApprovedReplyTaskValidationError(`${field} is required`);
  return value;
}
function optionalText(value: unknown, field: string): string | null { return value === undefined || value === null ? null : requiredText(value, field); }
function timestamp(value: unknown, field: string): string | null {
  const text = optionalText(value, field);
  if (text === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.exec(text);
  if (match === null) {
    throw new ApprovedReplyTaskValidationError(`${field} must be a valid timestamp`);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new ApprovedReplyTaskValidationError(`${field} must be a valid timestamp`);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new ApprovedReplyTaskValidationError(`${field} must be a valid timestamp`);
  }
  return date.toISOString();
}
function sortedUniqueStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new ApprovedReplyTaskValidationError(`${field} must be an array`);
  return [...new Set(value.map((entry, index) => requiredText(entry, `${field}[${index}]`)))].sort((a, b) => a.localeCompare(b));
}
function normalizeLineage(value: unknown): Array<{ recordType: string; id: string; relation: string | null }> {
  if (!Array.isArray(value)) throw new ApprovedReplyTaskValidationError("lineage must be an array");
  const rows = value.map((entry, index) => {
    const item = record(entry, `lineage[${index}]`);
    return {
      recordType: requiredText(item.recordType ?? item.record_type, `lineage[${index}].recordType`),
      id: requiredText(item.id, `lineage[${index}].id`),
      relation: item.relation === undefined || item.relation === null ? null : requiredText(item.relation, `lineage[${index}].relation`),
    };
  });
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) unique.set(JSON.stringify([row.recordType, row.id, row.relation]), row);
  return [...unique.values()].sort((a, b) => a.recordType.localeCompare(b.recordType) || a.id.localeCompare(b.id) || (a.relation ?? "").localeCompare(b.relation ?? ""));
}
function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const normalized = requiredText(value, field).toLowerCase().replace(/[- ]/g, "_") as T;
  if (!allowed.includes(normalized)) throw new ApprovedReplyTaskValidationError(`${field} must be one of ${allowed.join(", ")}`);
  return normalized;
}
function assess(task: Pick<ApprovedReplyTask, "humanDecision" | "decidedBy" | "decidedAt" | "deliveryStatus" | "sentAt" | "status">): ApprovedReplyTaskReadiness {
  const blockers: string[] = [];
  if (task.humanDecision === "pending") blockers.push("human decision is pending");
  if (task.humanDecision === "decline") blockers.push("human decision is declined");
  if (task.humanDecision === "approve" && task.decidedBy !== "muxin") blockers.push("human approval must be recorded by Muxin");
  if (task.humanDecision === "approve" && task.decidedAt === null) blockers.push("human approval timestamp is missing");
  if (task.humanDecision === "approve" && task.status !== "approved" && task.status !== "sent") blockers.push("approved reply task status is missing");
  if (task.deliveryStatus === "sent" && task.sentAt === null) blockers.push("sent delivery timestamp is missing");
  if (task.deliveryStatus === "sent" && task.status !== "sent") blockers.push("sent delivery requires sent status");
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] };
}

export function normalizeApprovedReplyTask(input: ApprovedReplyTaskInput): ApprovedReplyTask {
  const source = record(input, "input");
  const humanDecision = enumValue(alias(source, "humanDecision", "human_decision"), "humanDecision", ["pending", "approve", "decline"] as const);
  const deliveryStatus = enumValue(alias(source, "deliveryStatus", "delivery_status"), "deliveryStatus", ["not_sent", "sent"] as const);
  const status = enumValue(alias(source, "status", "status"), "status", ["pending", "approved", "declined", "sent"] as const);
  const decidedByText = optionalText(alias(source, "decidedBy", "decided_by"), "decidedBy");
  const decidedBy = decidedByText === null ? null : enumValue(decidedByText, "decidedBy", ["muxin"] as const);
  const decidedAt = timestamp(alias(source, "decidedAt", "decided_at"), "decidedAt");
  const sentAt = timestamp(alias(source, "sentAt", "sent_at"), "sentAt");
  if (humanDecision === "pending" && (decidedBy !== null || decidedAt !== null)) throw new ApprovedReplyTaskValidationError("pending humanDecision cannot have decidedBy or decidedAt");
  if (deliveryStatus === "not_sent" && sentAt !== null) throw new ApprovedReplyTaskValidationError("not_sent delivery cannot have sentAt");
  if (deliveryStatus === "sent" && (humanDecision !== "approve" || decidedBy !== "muxin" || decidedAt === null)) throw new ApprovedReplyTaskValidationError("sent delivery requires explicit human approval and decision");
  if (deliveryStatus === "sent" && sentAt === null) throw new ApprovedReplyTaskValidationError("sentAt is required for sent delivery");
  if (humanDecision !== "pending" && (decidedBy === null || decidedAt === null)) throw new ApprovedReplyTaskValidationError("decidedBy and decidedAt are required for a human decision");
  if (status === "sent" && deliveryStatus !== "sent") throw new ApprovedReplyTaskValidationError("sent status requires sent delivery");
  if (status === "approved" && humanDecision !== "approve") throw new ApprovedReplyTaskValidationError("approved status requires human approval");
  if (status === "declined" && humanDecision !== "decline") throw new ApprovedReplyTaskValidationError("declined status requires a declined decision");
  if (status === "pending" && humanDecision !== "pending") throw new ApprovedReplyTaskValidationError("pending status requires a pending decision");
  const task = {
    kind: "approved_reply_task" as const,
    version: APPROVED_REPLY_TASK_VERSION,
    id: requiredText(source.id, "id"),
    commentObservationId: requiredText(alias(source, "commentObservationId", "comment_observation_id"), "commentObservationId"),
    draftText: preservedText(alias(source, "draftText", "draft_text"), "draftText"),
    replyPurpose: requiredText(alias(source, "replyPurpose", "reply_purpose"), "replyPurpose"),
    claimRefs: sortedUniqueStrings(alias(source, "claimRefs", "claim_refs"), "claimRefs"),
    targetPlatform: requiredText(alias(source, "targetPlatform", "target_platform"), "targetPlatform").toLowerCase(),
    humanDecision,
    decidedBy,
    decidedAt,
    deliveryStatus,
    sentAt,
    lineage: normalizeLineage(source.lineage),
    status,
    readiness: { status: "blocked" as const, blockers: [] },
    autoSend: false as const,
    autoPublish: false as const,
    sideEffects: "none" as const,
  };
  return { ...task, readiness: assess(task) };
}

export function assessApprovedReplyTaskReadiness(task: ApprovedReplyTask): ApprovedReplyTaskReadiness { return assess(task); }

export const buildApprovedReplyTask = normalizeApprovedReplyTask;
export const createApprovedReplyTask = normalizeApprovedReplyTask;
