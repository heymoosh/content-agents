import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { withFileLock } from "../runtime/file-lock.js";

/**
 * This is deliberately separate from delivery-event.jsonl. It is a small strict journal for the
 * one fact delivery history cannot establish: a physically new queue identity was approved here,
 * then handed to exactly one provider attempt. Any malformed or incomplete history is untrusted.
 */
export const APPROVAL_SAFETY_JOURNAL_PATH = migrateLegacyDataFile(["approval-dispatch-safety.jsonl"]);

type SafetyEventKind = "created" | "revision_intent" | "revision_committed" | "approval_intent" | "approval_committed" | "status_intent" | "status_committed" | "dispatch_started" | "dispatch_resolved";
interface SafetyEvent {
  version: 1;
  kind: SafetyEventKind;
  slug: string;
  rowId: string;
  fingerprint: string;
  at: string;
  approvalId?: string;
  status?: string;
  previousFingerprint?: string;
  attemptId?: string;
  resolution?: "exists" | "not-created";
}

function key(slug: string, rowId: string): string { return `${slug}/${rowId}`; }

function appendFsynced(path: string, event: SafetyEvent): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  withFileLock(`${path}.lock`, () => {
    let fd: number | undefined;
    try {
      fd = openSync(path, "a", 0o600);
      const bytes = Buffer.from(JSON.stringify(event) + "\n", "utf8");
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(fd, bytes, offset, bytes.length - offset);
        if (written <= 0) throw new Error("approval safety journal did not complete its event write");
        offset += written;
      }
      fsyncSync(fd);
    } finally { if (fd !== undefined) closeSync(fd); }
    // Keep the just-created journal discoverable after a restart as well as its contents durable.
    let directory: number | undefined;
    try { directory = openSync(dirname(path), "r"); fsyncSync(directory); }
    finally { if (directory !== undefined) closeSync(directory); }
  });
}

function parseStrict(path: string): { events: SafetyEvent[]; error: string | null } {
  if (!existsSync(path)) return { events: [], error: null };
  const events: SafetyEvent[] = [];
  for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Partial<SafetyEvent>;
      if (value.version !== 1 || !["created", "revision_intent", "revision_committed", "approval_intent", "approval_committed", "status_intent", "status_committed", "dispatch_started", "dispatch_resolved"].includes(String(value.kind))
        || typeof value.slug !== "string" || !value.slug || typeof value.rowId !== "string" || !value.rowId
        || typeof value.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.fingerprint)
        || typeof value.at !== "string" || Number.isNaN(Date.parse(value.at))
        || ((value.kind === "approval_intent" || value.kind === "approval_committed" || value.kind === "dispatch_started") && typeof value.approvalId !== "string")
        || ((value.kind === "status_intent" || value.kind === "status_committed") && typeof value.status !== "string")
        || ((value.kind === "revision_intent" || value.kind === "revision_committed") && (typeof value.previousFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.previousFingerprint)))
        || ((value.kind === "dispatch_started" || value.kind === "dispatch_resolved") && (typeof value.attemptId !== "string" || !/^[a-f0-9]{64}$/.test(value.attemptId)))
        || (value.kind === "dispatch_resolved" && value.resolution !== "exists" && value.resolution !== "not-created")) {
        return { events: [], error: `approval safety journal is malformed at line ${index + 1}` };
      }
      events.push(value as SafetyEvent);
    } catch { return { events: [], error: `approval safety journal is malformed at line ${index + 1}` }; }
  }
  return { events, error: null };
}

/** Fingerprint the delivery-relevant row cells and the exact derivative bytes. */
export function approvalFingerprint(folder: string, row: Pick<QueueRow, "id" | "platform" | "format" | "asset">): string | null {
  try {
    const asset = resolve(folder, row.asset);
    if (relative(folder, asset).startsWith("..") || relative(folder, asset) === "") return null;
    const bytes = readFileSync(asset);
    return createHash("sha256").update(JSON.stringify({
      id: row.id, platform: row.platform, format: row.format, asset: row.asset,
      assetSha256: createHash("sha256").update(bytes).digest("hex"),
    })).digest("hex");
  } catch { return null; }
}

export function journalPathForLedger(ledgerPath: string): string {
  return join(dirname(ledgerPath), "approval-dispatch-safety.jsonl");
}

/** Record only a physical append whose id was absent before that append. */
export function recordNewQueueRows(folder: string, rows: readonly Pick<QueueRow, "id" | "platform" | "format" | "asset">[], journalPath: string = APPROVAL_SAFETY_JOURNAL_PATH): void {
  // The read-then-append identity decision is one operation. A distinct mutation lock avoids
  // re-entering appendFsynced's short append lock while two append callers race for one id.
  withFileLock(`${journalPath}.mutation.lock`, () => {
    const slug = basename(folder);
    const parsed = parseStrict(journalPath);
    if (parsed.error) throw new Error(parsed.error);
    const known = new Set(parsed.events.filter((event) => event.kind === "created").map((event) => key(event.slug, event.rowId)));
    for (const row of rows) {
      const fingerprint = approvalFingerprint(folder, row);
      // A row without a completed immutable derivative is still appended for its existing caller,
      // but it must remain untrusted. Throwing here would tempt callers to retry an append and
      // manufacture a duplicate identity; absence of a creation event is the conservative result.
      if (!fingerprint) continue;
      if (known.has(key(slug, row.id))) throw new Error(`queue identity ${row.id} was already created and cannot gain fresh provenance`);
      appendFsynced(journalPath, { version: 1, kind: "created", slug, rowId: row.id, fingerprint, at: new Date().toISOString() });
      known.add(key(slug, row.id));
    }
  });
}

function claimPath(slug: string, rowId: string, ledgerPath: string): string {
  const digest = createHash("sha256").update(key(slug, rowId)).digest("hex");
  return join(dirname(ledgerPath), ".publishing-claims", `${digest}.lock`);
}

export function claimPublishingAttempt(slug: string, rowId: string, ledgerPath: string): () => void {
  const target = claimPath(slug, rowId, ledgerPath);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  let fd: number;
  try { fd = openSync(target, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("another Studio process already claimed this publishing attempt; reconcile it before retrying");
    throw error;
  }
  try {
    const bytes = Buffer.from(JSON.stringify({ slug, rowId, claimedAt: new Date().toISOString(), pid: process.pid }) + "\n", "utf8");
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(fd, bytes, offset, bytes.length - offset);
      if (written <= 0) throw new Error("publishing claim did not complete its durable write");
      offset += written;
    }
    fsyncSync(fd);
  }
  finally { closeSync(fd); }
  let directory: number | undefined;
  try { directory = openSync(dirname(target), "r"); fsyncSync(directory); }
  finally { if (directory !== undefined) closeSync(directory); }
  return () => { try { unlinkSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } };
}

export function clearPublishingClaim(slug: string, rowId: string, ledgerPath: string): void {
  try { unlinkSync(claimPath(slug, rowId, ledgerPath)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

export function publishingClaimIsActive(slug: string, rowId: string, ledgerPath: string): boolean {
  const target = claimPath(slug, rowId, ledgerPath);
  if (!existsSync(target)) return false;
  try {
    const claim = JSON.parse(readFileSync(target, "utf8")) as { pid?: unknown; claimedAt?: unknown };
    const claimedAt = typeof claim.claimedAt === "string" ? Date.parse(claim.claimedAt) : Number.NaN;
    if (Number.isInteger(claim.pid)) {
      try { process.kill(Number(claim.pid), 0); return true; }
      catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
    }
    return Number.isNaN(claimedAt) || Date.now() - claimedAt <= 30 * 60_000;
  } catch { return true; }
}

type JournalState = {
  fingerprint: string;
  currentStatus: string;
  approvalId: string | null;
  pendingApproval: { fingerprint: string; approvalId: string } | null;
  pendingStatus: { fingerprint: string; status: string } | null;
  pendingRevision: { fingerprint: string; previousFingerprint: string } | null;
  activeAttempt: string | null;
  lastResolution: "exists" | "not-created" | null;
};

function deriveJournalState(events: SafetyEvent[]): { state: JournalState | null; error: string | null } {
  let state: JournalState | null = null;
  for (const event of events) {
    if (event.kind === "created") {
      if (state) return { state: null, error: "this queue identity has conflicting creation evidence" };
      state = { fingerprint: event.fingerprint, currentStatus: "pending", approvalId: null, pendingApproval: null, pendingStatus: null, pendingRevision: null, activeAttempt: null, lastResolution: null };
      continue;
    }
    if (!state) return { state: null, error: "this queue identity has activity before durable creation evidence" };
    const pending = state.pendingApproval || state.pendingStatus || state.pendingRevision;
    if (event.kind === "revision_intent") {
      if (pending || state.currentStatus === "approve" || state.activeAttempt || event.previousFingerprint !== state.fingerprint) return { state: null, error: "this queue identity has an incomplete or invalid revision transition" };
      state.pendingRevision = { fingerprint: event.fingerprint, previousFingerprint: event.previousFingerprint! };
    } else if (event.kind === "revision_committed") {
      if (!state.pendingRevision || state.pendingRevision.fingerprint !== event.fingerprint || state.pendingRevision.previousFingerprint !== event.previousFingerprint) return { state: null, error: "this queue identity has an interrupted revision transition" };
      state.fingerprint = event.fingerprint;
      state.pendingRevision = null;
    } else if (event.kind === "approval_intent") {
      const expected = state.pendingRevision?.fingerprint ?? state.fingerprint;
      if (state.pendingApproval || state.pendingStatus || event.fingerprint !== expected) return { state: null, error: "this queue identity has an incomplete approval transition" };
      state.pendingApproval = { fingerprint: event.fingerprint, approvalId: event.approvalId! };
    } else if (event.kind === "approval_committed") {
      if (state.pendingRevision) return { state: null, error: "this queue identity committed approval before its revision evidence" };
      if (!state.pendingApproval || state.pendingApproval.fingerprint !== event.fingerprint || state.pendingApproval.approvalId !== event.approvalId) return { state: null, error: "this queue identity has an interrupted approval transition" };
      state.currentStatus = "approve";
      state.approvalId = event.approvalId!;
      state.pendingApproval = null;
    } else if (event.kind === "status_intent") {
      if (pending || event.fingerprint !== state.fingerprint || event.status === "approve") return { state: null, error: "this queue identity has an incomplete status transition" };
      state.pendingStatus = { fingerprint: event.fingerprint, status: event.status! };
    } else if (event.kind === "status_committed") {
      if (!state.pendingStatus || state.pendingStatus.fingerprint !== event.fingerprint || state.pendingStatus.status !== event.status) return { state: null, error: "this queue identity has an interrupted status transition" };
      state.currentStatus = event.status!;
      state.approvalId = null;
      state.pendingStatus = null;
    } else if (event.kind === "dispatch_started") {
      if (pending || state.currentStatus !== "approve" || state.fingerprint !== event.fingerprint || state.approvalId !== event.approvalId || state.activeAttempt) return { state: null, error: "this queue identity has an invalid durable dispatch fence" };
      state.activeAttempt = event.attemptId!;
      state.lastResolution = null;
    } else if (event.kind === "dispatch_resolved") {
      if (pending || !state.activeAttempt || state.activeAttempt !== event.attemptId) return { state: null, error: "this queue identity has a stale or mismatched dispatch reconciliation" };
      state.activeAttempt = null;
      state.lastResolution = event.resolution!;
    }
  }
  if (state && (state.pendingApproval || state.pendingStatus || state.pendingRevision)) return { state: null, error: "this queue identity has an interrupted latest status transition" };
  return { state, error: null };
}

export type ApprovalDispatchDisposition =
  | { kind: "legacy" }
  | { kind: "fresh" }
  | { kind: "reconciled-not-created" }
  | { kind: "blocked"; reason: string };

/** Read the strict journal for scheduling, never treating missing provider history as approval. */
export function approvalDispatchDisposition(folder: string, slug: string, row: QueueRow, ledgerPath: string, journalPath: string = journalPathForLedger(ledgerPath)): ApprovalDispatchDisposition {
  const parsed = parseStrict(journalPath);
  if (parsed.error) return { kind: "blocked", reason: `${parsed.error}; reconcile it before scheduling` };
  const matching = parsed.events.filter((event) => event.slug === slug && event.rowId === row.id);
  if (!matching.length) return { kind: "legacy" };
  const derived = deriveJournalState(matching);
  if (derived.error || !derived.state) return { kind: "blocked", reason: `${derived.error ?? "this queue identity has incomplete provenance"}; reconcile it before scheduling` };
  const fingerprint = approvalFingerprint(folder, row);
  if (!fingerprint || fingerprint !== derived.state.fingerprint) return { kind: "blocked", reason: "this row was not demonstrably created with its current identity; reconcile it before scheduling" };
  if (row.status !== "approve" || derived.state.currentStatus !== "approve" || !derived.state.approvalId) return { kind: "blocked", reason: "this row lacks a complete valid latest approval transition; reconcile it before scheduling" };
  if (derived.state.activeAttempt) return { kind: "blocked", reason: "this row already has a durable dispatch fence; reconcile its provider state before retrying" };
  if (derived.state.lastResolution === "exists") return { kind: "blocked", reason: "this row's latest exact provider reconciliation found an existing object" };
  return { kind: derived.state.lastResolution === "not-created" ? "reconciled-not-created" : "fresh" };
}

/**
 * Called by the status route while holding the exact row claim scheduling uses. A crash between
 * intent, queue write and commit leaves an approved-looking row without a capability, which is
 * intentionally refused. A revision is allowed only for an unattempted, durably created row
 * after a completed non-approval status transition.
 */
export function commitReviewStatus(
  folder: string,
  slug: string,
  id: string,
  status: string | undefined,
  write: () => boolean,
  ledgerPath: string,
  journalPath: string = journalPathForLedger(ledgerPath),
): boolean {
  const release = claimPublishingAttempt(slug, id, ledgerPath);
  try {
    if (status === undefined) return write();
    const row = readQueue(folder).rows.find((item) => item.id === id);
    if (!row) return false;
    const fingerprint = approvalFingerprint(folder, row);
    // Approval itself remains a review action even while an asset is incomplete. It simply does
    // not obtain a fresh scheduling capability until a supported creation path recorded one.
    if (!fingerprint) return write();
    const parsed = parseStrict(journalPath);
    if (parsed.error) return write();
    const matching = parsed.events.filter((event) => event.slug === slug && event.rowId === id);
    const derived = deriveJournalState(matching);
    // Legacy rows may still be reviewed. They simply never acquire new scheduling provenance.
    if (derived.error || !derived.state) return write();
    const revision = derived.state.fingerprint === fingerprint ? null : { fingerprint, previousFingerprint: derived.state.fingerprint };
    if (revision && (status !== "approve" || derived.state.currentStatus === "approve" || derived.state.activeAttempt || derived.state.pendingApproval || derived.state.pendingStatus || derived.state.pendingRevision)) return write();
    const approvalId = createHash("sha256").update(`${key(slug, id)}\0${fingerprint}\0${Date.now()}\0${process.pid}`).digest("hex");
    if (revision) appendFsynced(journalPath, { version: 1, kind: "revision_intent", slug, rowId: id, fingerprint, previousFingerprint: revision.previousFingerprint, at: new Date().toISOString() });
    const eventKind: SafetyEventKind = status === "approve" ? "approval_intent" : "status_intent";
    appendFsynced(journalPath, { version: 1, kind: eventKind, slug, rowId: id, fingerprint, approvalId: status === "approve" ? approvalId : undefined, status: status === "approve" ? undefined : status, at: new Date().toISOString() });
    if (!write()) return false;
    const after = readQueue(folder).rows.find((item) => item.id === id);
    if (!after || after.status !== status || approvalFingerprint(folder, after) !== fingerprint) throw new Error("row changed before approval evidence committed");
    if (revision) appendFsynced(journalPath, { version: 1, kind: "revision_committed", slug, rowId: id, fingerprint, previousFingerprint: revision.previousFingerprint, at: new Date().toISOString() });
    appendFsynced(journalPath, { version: 1, kind: status === "approve" ? "approval_committed" : "status_committed", slug, rowId: id, fingerprint, approvalId: status === "approve" ? approvalId : undefined, status: status === "approve" ? undefined : status, at: new Date().toISOString() });
    return true;
  } finally { release(); }
}

/** Return a refusal reason unless the row owns one unconsumed fresh capability. */
export function approvalSchedulingBlock(folder: string, slug: string, row: QueueRow, ledgerPath: string, journalPath: string = journalPathForLedger(ledgerPath)): string | null {
  const disposition = approvalDispatchDisposition(folder, slug, row, ledgerPath, journalPath);
  if (disposition.kind === "fresh") return null;
  if (disposition.kind === "reconciled-not-created") return "this row requires its exact reconciliation path before a second dispatch";
  return disposition.kind === "legacy"
    ? "this row has no verifiable creation and approval provenance; reconcile it before scheduling"
    : disposition.reason;
}

/** Consume fresh or exactly reconciled eligibility before any external callback. */
export function markDispatchStarted(folder: string, slug: string, row: QueueRow, ledgerPath: string, journalPath: string = journalPathForLedger(ledgerPath)): string {
  const disposition = approvalDispatchDisposition(folder, slug, row, ledgerPath, journalPath);
  if (disposition.kind !== "fresh" && disposition.kind !== "reconciled-not-created") throw new Error(disposition.kind === "legacy" ? "this row has no verifiable creation and approval provenance; reconcile it before scheduling" : disposition.reason);
  const fingerprint = approvalFingerprint(folder, row)!;
  const events = parseStrict(journalPath).events.filter((event) => event.slug === slug && event.rowId === row.id);
  const state = deriveJournalState(events).state!;
  const attemptId = createHash("sha256").update(`${key(slug, row.id)}\0${fingerprint}\0${state.approvalId}\0${Date.now()}\0${process.pid}\0${Math.random()}`).digest("hex");
  appendFsynced(journalPath, { version: 1, kind: "dispatch_started", slug, rowId: row.id, fingerprint, approvalId: state.approvalId!, attemptId, at: new Date().toISOString() });
  return attemptId;
}

/** Persist the exact human or internal proof that the latest fenced attempt did or did not create. */
export function resolveDispatchFence(slug: string, rowId: string, resolution: "exists" | "not-created", ledgerPath: string, journalPath: string = journalPathForLedger(ledgerPath)): boolean {
  const parsed = parseStrict(journalPath);
  if (parsed.error) throw new Error(`${parsed.error}; reconcile it before scheduling`);
  const state = deriveJournalState(parsed.events.filter((event) => event.slug === slug && event.rowId === rowId));
  if (state.error) throw new Error(`${state.error}; reconcile it before scheduling`);
  if (!state.state?.activeAttempt) return false;
  appendFsynced(journalPath, { version: 1, kind: "dispatch_resolved", slug, rowId, fingerprint: state.state.fingerprint, attemptId: state.state.activeAttempt, resolution, at: new Date().toISOString() });
  return true;
}
