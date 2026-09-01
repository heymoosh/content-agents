import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";
import type { QueueRow } from "../publish/queue.js";
import { scheduleApproved, scheduleKind, selectConfiguredProvider, type ScheduleKind, type SchedulerDeps } from "./studio-scheduling.js";
import { resolveDeliveryPolicy, type DeliveryBrand, type DeliveryMode, type DeliveryProvider as PolicyDeliveryProvider } from "../publish/delivery-policy.js";
import {
  newDeliveryEvent,
  parseDeliveryEvent,
  type DeliveryEvent,
  type DeliveryProvider,
  type DeliveryState,
  normalizeProviderStatus,
} from "./delivery-event.js";

export type PublishingState = DeliveryState | "scheduling" | "scheduled" | "cleared";
export type PublishingResolution = "exists" | "not-created";
export type PublishingProvider = DeliveryProvider;
export interface PublishingStatus {
  slug: string;
  rowId: string;
  provider: PublishingProvider;
  state: PublishingState;
  at: string;
  plannedFor?: string;
  ref?: string;
  error?: string;
  policyVersion?: string;
  origin?: string;
  brand?: DeliveryBrand | null;
  deliveryMode?: DeliveryMode;
  providerAccountId?: string | null;
  policyReason?: string;
  schemaVersion?: 1;
  eventId?: string;
  providerObjectId?: string;
  canonicalUrl?: string;
  providerCreatedAt?: string;
  providerUpdatedAt?: string;
  providerPublishedAt?: string;
  legacyState?: string;
  evidenceKind?: "provider" | "human";
  evidence?: string;
}

type DisposableProviderOutcome = { provider: "typefully"; scheduled: unknown; scheduleError: string | null };

/**
 * Hermetic browser-only provider seam. Both a one-run secret and a matching marker inside the
 * disposable repository are required, and E2E_REPO_ROOT must resolve to the executing checkout.
 * A normal server (including one pointed at the real checkout) therefore cannot enter this path.
 */
export function disposableProviderOutcome(
  row: Pick<QueueRow, "id">,
  env: NodeJS.ProcessEnv = process.env,
  root: string = repoRoot,
): DisposableProviderOutcome | null {
  const token = env.CONTENT_AGENTS_E2E_SCHEDULING_TOKEN;
  const disposableRoot = env.E2E_REPO_ROOT;
  if (!token || !disposableRoot) return null;
  try {
    if (realpathSync(disposableRoot) !== realpathSync(root)) return null;
  } catch { return null; }
  const marker = join(root, ".e2e-scheduling-token");
  if (!existsSync(marker) || readFileSync(marker, "utf8") !== token) return null;
  if (row.id === "e2e-provider-success") {
    return { provider: "typefully", scheduled: { draftId: "e2e-provider-object", when: "Sep 2 at 9:00 AM", plannedFor: "2026-09-02T14:00:00.000Z" }, scheduleError: null };
  }
  if (row.id === "e2e-provider-failure") {
    return { provider: "typefully", scheduled: null, scheduleError: "injected provider timeout" };
  }
  return null;
}

export const PUBLISHING_STATUS_PATH = migrateLegacyDataFile(["publishing-status.jsonl"]);
export function publishingKey(slug: string, rowId: string): string { return `${slug}/${rowId}`; }

function claimPath(slug: string, rowId: string, ledgerPath: string): string {
  const digest = createHash("sha256").update(publishingKey(slug, rowId)).digest("hex");
  return join(dirname(ledgerPath), ".publishing-claims", `${digest}.lock`);
}

function claimPublishingAttempt(slug: string, rowId: string, ledgerPath: string): () => void {
  const target = claimPath(slug, rowId, ledgerPath);
  mkdirSync(dirname(target), { recursive: true });
  let fd: number;
  try { fd = openSync(target, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("another Studio process already claimed this publishing attempt; reconcile it before retrying");
    throw error;
  }
  try { writeFileSync(fd, JSON.stringify({ slug, rowId, claimedAt: new Date().toISOString(), pid: process.pid }) + "\n"); }
  finally { closeSync(fd); }
  return () => { try { unlinkSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } };
}

function clearPublishingClaim(slug: string, rowId: string, ledgerPath: string): void {
  try { unlinkSync(claimPath(slug, rowId, ledgerPath)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

function publishingClaimIsActive(slug: string, rowId: string, ledgerPath: string): boolean {
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

export function providerForKind(kind: ScheduleKind): PolicyDeliveryProvider {
  if (kind === "text" || kind === "card") return "typefully";
  if (kind === "tiktok") return "postpeer";
  if (kind === "video") return "youtube";
  if (kind === "substack") return "substack";
  return "manual";
}

export function appendPublishingStatus(status: PublishingStatus, path: string = PUBLISHING_STATUS_PATH): void {
  const normalized = parseDeliveryEvent(status);
  if (!normalized) throw new Error(`invalid publishing status event for ${status.slug}/${status.rowId}`);
  const { schemaVersion: _schemaVersion, eventId: _eventId, ...eventFields } = normalized;
  const event = status.schemaVersion === 1 && status.eventId ? normalized : newDeliveryEvent(eventFields);
  withFileLock(`${path}.lock`, () => {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      const current = readFileSync(path, "utf8");
      if (current.length > 0 && !current.endsWith("\n")) appendFileSync(path, "\n", { encoding: "utf8", mode: 0o600 });
    }
    appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
  });
}

export function readPublishingHistory(path: string = PUBLISHING_STATUS_PATH): DeliveryEvent[] {
  if (!existsSync(path)) return [];
  const events: DeliveryEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = parseDeliveryEvent(JSON.parse(line));
      if (event) events.push(event);
    } catch { /* retain all complete earlier append-only events */ }
  }
  return events;
}

export function readPublishingStatuses(path: string = PUBLISHING_STATUS_PATH): Record<string, PublishingStatus> {
  const latest: Record<string, PublishingStatus> = {};
  for (const event of readPublishingHistory(path)) {
    latest[publishingKey(event.slug, event.rowId)] = {
      ...event,
      ...(event.providerObjectId ? { ref: event.providerObjectId } : {}),
      brand: (event.brand as DeliveryBrand | null | undefined),
      deliveryMode: (event.deliveryMode as DeliveryMode | undefined),
    };
  }
  return latest;
}

export function publishingRetryBlock(slug: string, row: QueueRow, path: string = PUBLISHING_STATUS_PATH): string | null {
  if (row.status === "published" || row.status === "locked") return "this row was already scheduled or locked";
  const existing = readPublishingStatuses(path)[publishingKey(slug, row.id)];
  if (existing && ["scheduling", "scheduled", "planned", "delivered", "live", "private", "uncertain"].includes(existing.state)) {
    return `this row already has a ${existing.state} publishing attempt; reconcile it before retrying`;
  }
  if (row.status === "approve" && existing?.state !== "blocked" && existing?.state !== "cleared"
      && existing?.state !== "canceled" && existing?.state !== "deleted" && existing?.state !== "failed") {
    return "this row is already approved; reconcile its provider state before retrying";
  }
  return null;
}

/** Human reconciliation after checking the provider; neither resolution contacts a provider. */
export function resolvePublishingAttempt(
  slug: string,
  rowId: string,
  resolution: PublishingResolution,
  details: { ref?: string; plannedFor?: string; provider?: PublishingProvider } = {},
  path: string = PUBLISHING_STATUS_PATH,
): PublishingStatus {
  const hadClaim = existsSync(claimPath(slug, rowId, path));
  if (hadClaim) {
    if (publishingClaimIsActive(slug, rowId, path)) throw new Error("this provider call is still active in another Studio process");
    clearPublishingClaim(slug, rowId, path);
  }
  // Acquire the SAME row lock used by scheduling, then re-read. If scheduling finishes first,
  // its latest `scheduled` event wins and resolution is refused; if it is still running, the
  // active claim above/refused wx acquisition wins. There is no check-then-append gap.
  const releaseClaim = claimPublishingAttempt(slug, rowId, path);
  try {
    const existing = readPublishingStatuses(path)[publishingKey(slug, rowId)];
    if (!existing || (existing.state !== "uncertain" && existing.state !== "scheduling")) {
      throw new Error("this row has no uncertain publishing attempt to reconcile");
    }
    const provider = existing.provider ?? details.provider;
    if (!provider) throw new Error("the uncertain publishing provider is unknown");
    const status: PublishingStatus = resolution === "exists"
      ? {
          slug, rowId, provider, state: "planned", at: new Date().toISOString(),
          ...(details.ref?.trim() ? { providerObjectId: details.ref.trim(), ref: details.ref.trim() } : {}),
          ...(details.plannedFor?.trim() ? { plannedFor: details.plannedFor.trim() } : {}),
        }
      : {
          slug, rowId, provider, state: "canceled", at: new Date().toISOString(),
          error: "Muxin checked the provider and confirmed that nothing was created; retry is allowed",
        };
    appendPublishingStatus(status, path);
    return status;
  } finally {
    releaseClaim();
  }
}

export function recordHumanDeliveryEvidence(
  slug: string,
  rowId: string,
  state: Extract<DeliveryState, "delivered" | "live" | "canceled" | "deleted" | "failed" | "private">,
  details: { evidence: string; canonicalUrl?: string; providerPublishedAt?: string },
  path: string = PUBLISHING_STATUS_PATH,
): PublishingStatus {
  if (!details.evidence.trim()) throw new Error("human delivery evidence is required");
  const releaseClaim = claimPublishingAttempt(slug, rowId, path);
  try {
    const existing = readPublishingStatuses(path)[publishingKey(slug, rowId)];
    if (!existing) throw new Error("this row has no publishing attempt to reconcile");
    const status: PublishingStatus = {
      ...existing, state, at: new Date().toISOString(), evidenceKind: "human", evidence: details.evidence.trim(),
      ...(details.canonicalUrl?.trim() ? { canonicalUrl: details.canonicalUrl.trim() } : {}),
      ...(details.providerPublishedAt?.trim() ? { providerPublishedAt: details.providerPublishedAt.trim() } : {}),
      schemaVersion: undefined, eventId: undefined, error: undefined,
    };
    appendPublishingStatus(status, path);
    return status;
  } finally { releaseClaim(); }
}

function stableProviderObjectId(provider: PublishingProvider, raw: string): string {
  const value = raw.trim();
  if (provider === "typefully") return value.replace(/^typefully\s+draft\s+/i, "");
  if (provider === "postpeer") return value.replace(/^(?:tiktok\s+)?postpeer\s+post\s+/i, "");
  if (provider === "youtube") {
    try {
      const url = new URL(value);
      const shortId = url.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1];
      return shortId ?? url.searchParams.get("v") ?? value;
    } catch { return value; }
  }
  return value;
}

function details(provider: PublishingProvider, value: unknown): Omit<ReturnType<typeof normalizeProviderStatus>, "provider" | "state"> & { ref?: string } {
  if (!value || typeof value !== "object") return {};
  const item = value as Record<string, unknown>;
  const plannedFor = typeof (item.plannedFor ?? item.when) === "string" && (item.plannedFor ?? item.when) ? String(item.plannedFor ?? item.when) : undefined;
  const rawRef = item.ref ?? item.draftId;
  const ref = typeof rawRef === "string" && rawRef ? stableProviderObjectId(provider, rawRef) : undefined;
  const string = (key: string): string | undefined => typeof item[key] === "string" && item[key] ? item[key] as string : undefined;
  return {
    ...(plannedFor ? { plannedFor } : {}), ...(ref ? { ref, providerObjectId: ref } : {}),
    ...(string("providerObjectId") ? { providerObjectId: stableProviderObjectId(provider, string("providerObjectId")!) } : {}),
    ...(string("providerAccountId") ? { providerAccountId: string("providerAccountId") } : {}),
    ...(string("canonicalUrl") ? { canonicalUrl: string("canonicalUrl") } : {}),
    ...(string("providerCreatedAt") ? { providerCreatedAt: string("providerCreatedAt") } : {}),
    ...(string("providerUpdatedAt") ? { providerUpdatedAt: string("providerUpdatedAt") } : {}),
    ...(string("providerPublishedAt") ? { providerPublishedAt: string("providerPublishedAt") } : {}),
  };
}

function acceptedState(value: unknown): PublishingState {
  return value && typeof value === "object" && (value as Record<string, unknown>).autoPublishes === false ? "private" : "planned";
}

/**
 * Persist intent before the provider call. Scheduled/uncertain attempts cannot be blindly retried:
 * the provider may already have accepted them even if the HTTP response was lost.
 */
export async function scheduleApprovedOnce(
  folder: string,
  slug: string,
  row: QueueRow,
  schedule: typeof scheduleApproved = scheduleApproved,
  path: string = PUBLISHING_STATUS_PATH,
  selectionDeps?: Pick<SchedulerDeps, "fetchPostizRegistry" | "postizEnv">,
): Promise<{ scheduled: unknown; scheduleError: string | null; publishing: PublishingStatus }> {
  const kind = scheduleKind(row);
  if (!kind) throw new Error("no publishing provider owns this row");
  const releaseClaim = claimPublishingAttempt(slug, row.id, path);
  try {
    // Re-check after the atomic claim: another process may have completed between the caller's
    // UI read and this process acquiring the lock.
    const blocked = publishingRetryBlock(slug, row, path);
    if (blocked) throw new Error(blocked);
    const injected = disposableProviderOutcome(row);
    if (injected) {
      const audit = {
        policyVersion: "delivery-policy-v1" as const, origin: "human-inference" as const,
        brand: "human-inference" as const, deliveryMode: "provider" as const,
        providerAccountId: "e2e/typefully", policyReason: "disposable browser provider outcome",
      };
      appendPublishingStatus({ slug, rowId: row.id, provider: injected.provider, state: "uncertain", at: new Date().toISOString(), ...audit }, path);
      const status: PublishingStatus = injected.scheduleError
        ? { slug, rowId: row.id, provider: injected.provider, state: "uncertain", at: new Date().toISOString(), error: injected.scheduleError, ...audit }
        : { slug, rowId: row.id, provider: injected.provider, state: "planned", at: new Date().toISOString(), ...audit, ...details(injected.provider, injected.scheduled) };
      appendPublishingStatus(status, path);
      return { scheduled: injected.scheduled, scheduleError: injected.scheduleError, publishing: status };
    }
    let provider: PublishingProvider;
    try {
      provider = (schedule === scheduleApproved || selectionDeps) && kind !== "outreach-lock"
        ? (await selectConfiguredProvider(row, selectionDeps)).provider
        : providerForKind(kind);
    } catch (error) {
      // Provider discovery happens before dispatch. Persist that exact boundary so an approved row
      // is not stranded with an empty ledger, while keeping retries safe: no provider write could
      // have happened yet, so `failed` truthfully permits another explicit approval attempt.
      const message = `provider selection failed before dispatch; no provider request was made: ${error instanceof Error ? error.message : String(error)}`;
      const status: PublishingStatus = {
        slug, rowId: row.id, provider: providerForKind(kind), state: "failed",
        at: new Date().toISOString(), error: message,
      };
      appendPublishingStatus(status, path);
      return { scheduled: null, scheduleError: message, publishing: status };
    }
    const policy = kind === "outreach-lock"
      ? { policyVersion: "delivery-policy-v1" as const, origin: "unknown" as const, brand: null, provider: "manual" as const, providerAccountId: null, mode: "manual" as const, reason: "outreach approval locks copy for human sending and never dispatches a publishing provider" }
      : resolveDeliveryPolicy(folder, provider);
    const audit = {
      policyVersion: policy.policyVersion, origin: policy.origin, brand: policy.brand,
      deliveryMode: policy.mode, providerAccountId: policy.providerAccountId, policyReason: policy.reason,
    };
    if (policy.mode === "blocked") {
      const status: PublishingStatus = { slug, rowId: row.id, provider, state: "blocked", at: new Date().toISOString(), error: `delivery policy blocked: ${policy.reason}`, ...audit };
      appendPublishingStatus(status, path);
      return { scheduled: null, scheduleError: status.error ?? null, publishing: status };
    }
    appendPublishingStatus({ slug, rowId: row.id, provider, state: "uncertain", at: new Date().toISOString(), ...audit }, path);
    const result = await schedule(folder, row, undefined, policy);
    const status: PublishingStatus = result.scheduleError
      ? {
          slug, rowId: row.id, provider,
          state: result.scheduleError.startsWith("blocked by reuse guard") ? "blocked" : "uncertain",
          at: new Date().toISOString(), error: result.scheduleError,
          ...audit,
        }
      : (() => {
          const normalized = normalizeProviderStatus(provider, result.scheduled);
          const observedState = normalized.state === "uncertain" ? acceptedState(result.scheduled) : normalized.state;
          return { slug, rowId: row.id, provider, state: observedState, at: new Date().toISOString(), ...audit, ...details(provider, result.scheduled) };
        })();
    appendPublishingStatus(status, path);
    return { ...result, publishing: status };
  } finally {
    releaseClaim();
  }
}
