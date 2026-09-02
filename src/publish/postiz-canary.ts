import { cancelPostizPost, createPostizPost, readPostizPost, reconcilePostizPost, reschedulePostizPost, type PostizCreateInput, type PostizPost, type PostizTransport } from "./postiz.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export interface CanaryApproval {
  approvedBy: string;
  approvedAt: string;
  evidence: string;
  /**
   * Muxin's explicit approval (2026-09-02) for a real `schedule` create whose date is far enough out
   * that the immediate cancel always lands first. Without it, only draft canaries are allowed.
   */
  allowScheduled?: boolean;
}

/** A scheduled canary must sit at least this far out so a failed cancel is still recoverable by hand. */
export const SCHEDULED_CANARY_MIN_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

export function assertLiveCanaryGate(input: PostizCreateInput, approval: CanaryApproval, env: NodeJS.ProcessEnv = process.env, now = new Date()): void {
  if (env.CANARY_I_MEAN_IT !== "1") throw new Error("live canary blocked: CANARY_I_MEAN_IT=1 is required");
  if (!approval.approvedBy.trim() || !approval.evidence.trim()) throw new Error("live canary blocked: explicit approval evidence is required");
  if (!Number.isFinite(Date.parse(approval.approvedAt))) throw new Error("live canary blocked: approval timestamp is invalid");
  if (Date.parse(input.scheduledAt) <= now.getTime()) throw new Error("live canary blocked: scheduledAt must be in the future");
  if (input.visibility === "scheduled") {
    if (approval.allowScheduled !== true) throw new Error("live canary blocked: scheduled visibility needs approval.allowScheduled=true; draft is the default");
    if (Date.parse(input.scheduledAt) - now.getTime() < SCHEDULED_CANARY_MIN_LEAD_MS) throw new Error("live canary blocked: a scheduled canary must be at least 7 days out");
  } else if (!["draft", "private"].includes(input.visibility)) {
    throw new Error("live canary blocked: canary visibility must be draft, private, or an approved far-future schedule");
  }
}

export interface CanaryRecoveryEvidence {
  provider: "postiz";
  providerObjectId: string;
  at: string;
  phase: "created" | "read" | "reschedule" | "cancel" | "reconcile";
  cleanupRequired: boolean;
  error?: string;
}

export interface CanarySafetyOptions {
  cleanupLedgerPath?: string;
  emitRecovery?: (evidence: CanaryRecoveryEvidence) => void;
  /** When set, the canary also moves the post to this date (still gated) and reads it back before cancel. */
  rescheduleTo?: string;
}

function appendRecovery(evidence: CanaryRecoveryEvidence, opts: CanarySafetyOptions): void {
  (opts.emitRecovery ?? ((item) => process.stderr.write(`POSTIZ_CANARY_RECOVERY ${JSON.stringify(item)}\n`)))(evidence);
  const path = opts.cleanupLedgerPath ?? migrateLegacyDataFile(["publish", "postiz-canary-cleanup.jsonl"], join(repoRoot, "data"));
  mkdirSync(dirname(path), { recursive: true });
  withFileLock(`${path}.lock`, () => appendFileSync(path, JSON.stringify(evidence) + "\n", { mode: 0o600 }));
}

export interface PostizCanaryResult {
  created: PostizPost;
  read: PostizPost;
  rescheduled?: PostizPost;
  canceled: PostizPost;
  reconciled: PostizPost;
}

/** Called by ~/.claude/verify only after its own fixture and human-attended gates pass. */
export async function runPostizLifecycleCanary(
  transport: PostizTransport,
  input: PostizCreateInput,
  approval: CanaryApproval,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  safety: CanarySafetyOptions = {},
): Promise<PostizCanaryResult> {
  assertLiveCanaryGate(input, approval, env, now);
  if (safety.rescheduleTo) assertLiveCanaryGate({ ...input, scheduledAt: safety.rescheduleTo, visibility: "scheduled" }, approval, env, now);
  const created = await createPostizPost(transport, input, now);
  let read!: PostizPost;
  let rescheduled: PostizPost | undefined;
  let canceled!: PostizPost;
  let reconciled!: PostizPost;
  let failure: unknown;
  try { appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "created", cleanupRequired: true }, safety); }
  catch (error) { failure = error; }
  try {
    if (!failure) {
      read = await readPostizPost(transport, created.id, created.scheduledAt ?? input.scheduledAt);
      if (read.id !== created.id) throw new Error("live canary blocked: Postiz read returned a different stable id");
    }
  } catch (error) {
    failure = error;
    appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "read", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
  }
  try {
    if (!failure && safety.rescheduleTo) {
      const moved = await reschedulePostizPost(transport, { id: created.id, group: read.group }, input, safety.rescheduleTo, now);
      const readBack = await readPostizPost(transport, created.id, safety.rescheduleTo);
      const observed = Date.parse(readBack.scheduledAt ?? "");
      if (observed !== Date.parse(safety.rescheduleTo)) throw new Error(`live canary blocked: Postiz reports ${readBack.scheduledAt} after a reschedule to ${safety.rescheduleTo}`);
      if (readBack.status !== "scheduled") throw new Error(`live canary blocked: Postiz reports ${readBack.status} after a reschedule`);
      rescheduled = { ...readBack, scheduledAt: moved.scheduledAt };
    }
  } catch (error) {
    failure = error;
    appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "reschedule", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
  } finally {
    try { canceled = await cancelPostizPost(transport, created.id); }
    catch (error) {
      failure ??= error;
      appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "cancel", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
    }
  }
  if (canceled) {
    try { reconciled = await reconcilePostizPost(transport, created.id, rescheduled?.scheduledAt ?? created.scheduledAt ?? input.scheduledAt); }
    catch (error) {
      failure ??= error;
      appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "reconcile", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
    }
  }
  if (reconciled && reconciled.status !== "canceled") {
    const error = new Error(`live canary cleanup is not terminal: Postiz reports ${reconciled.status}`);
    failure ??= error;
    appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "reconcile", cleanupRequired: true, error: error.message }, safety);
  }
  if (failure) throw failure;
  appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "reconcile", cleanupRequired: false }, safety);
  return { created, read, ...(rescheduled ? { rescheduled } : {}), canceled, reconciled };
}
