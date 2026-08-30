import { cancelPostizPost, createPostizPost, readPostizPost, reconcilePostizPost, type PostizCreateInput, type PostizPost, type PostizTransport } from "./postiz.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export interface CanaryApproval {
  approvedBy: string;
  approvedAt: string;
  evidence: string;
}

export function assertLiveCanaryGate(input: PostizCreateInput, approval: CanaryApproval, env: NodeJS.ProcessEnv = process.env, now = new Date()): void {
  if (env.CANARY_I_MEAN_IT !== "1") throw new Error("live canary blocked: CANARY_I_MEAN_IT=1 is required");
  if (!approval.approvedBy.trim() || !approval.evidence.trim()) throw new Error("live canary blocked: explicit approval evidence is required");
  if (!Number.isFinite(Date.parse(approval.approvedAt))) throw new Error("live canary blocked: approval timestamp is invalid");
  if (Date.parse(input.scheduledAt) <= now.getTime()) throw new Error("live canary blocked: scheduledAt must be in the future");
  if (!["draft", "private"].includes(input.visibility)) throw new Error("live canary blocked: canary visibility must be draft or private; scheduled is prohibited");
}

export interface CanaryRecoveryEvidence {
  provider: "postiz";
  providerObjectId: string;
  at: string;
  phase: "created" | "read" | "cancel" | "reconcile";
  cleanupRequired: boolean;
  error?: string;
}

export interface CanarySafetyOptions {
  cleanupLedgerPath?: string;
  emitRecovery?: (evidence: CanaryRecoveryEvidence) => void;
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
  const created = await createPostizPost(transport, input, now);
  let read!: PostizPost;
  let canceled!: PostizPost;
  let reconciled!: PostizPost;
  let failure: unknown;
  try { appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "created", cleanupRequired: true }, safety); }
  catch (error) { failure = error; }
  try {
    if (!failure) {
      read = await readPostizPost(transport, created.id);
      if (read.id !== created.id) throw new Error("live canary blocked: Postiz read returned a different stable id");
    }
  } catch (error) {
    failure = error;
    appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "read", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
  } finally {
    try { canceled = await cancelPostizPost(transport, created.id); }
    catch (error) {
      failure ??= error;
      appendRecovery({ provider: "postiz", providerObjectId: created.id, at: new Date().toISOString(), phase: "cancel", cleanupRequired: true, error: error instanceof Error ? error.message : String(error) }, safety);
    }
  }
  if (canceled) {
    try { reconciled = await reconcilePostizPost(transport, created.id); }
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
  return { created, read, canceled, reconciled };
}
