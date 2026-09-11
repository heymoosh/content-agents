import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { approvalDispatchDisposition, claimPublishingAttempt, clearPublishingClaim, markDispatchStarted, publishingClaimIsActive, resolveDispatchFence } from "./approval-provenance.js";
import { scheduleApproved, scheduleKind, selectConfiguredProvider, type DispatchMode, type ScheduleKind, type SchedulerDeps } from "./studio-scheduling.js";
import { postizRateLimitRetryAt } from "../publish/postiz.js";
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
    const fd = openSync(path, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  });
}

/** Scheduling treats every ledger line as security-relevant; the display reader stays tolerant. */
function strictPublishingLedgerError(path: string): string | null {
  if (!existsSync(path)) return null;
  for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    try { if (!parseDeliveryEvent(JSON.parse(line))) return `publishing ledger is malformed at line ${index + 1}`; }
    catch { return `publishing ledger is malformed at line ${index + 1}`; }
  }
  return null;
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
  if (publishingClaimIsActive(slug, rowId, path)) throw new Error("this provider call is still active in another Studio process");
  // A dead retained claim means the prior callback may have completed while its terminal ledger
  // write failed. Resolution is the only path allowed to retire that claim.
  clearPublishingClaim(slug, rowId, path);
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
    resolveDispatchFence(slug, rowId, resolution, path);
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
  // A Typefully unscheduled draft deliberately returns a human display word ("unscheduled") but
  // has no provider time. Persisting that word as plannedFor would falsely imply a schedule.
  const autoPublishes = item.autoPublishes !== false;
  const plannedFor = autoPublishes && typeof (item.plannedFor ?? item.when) === "string" && (item.plannedFor ?? item.when)
    ? String(item.plannedFor ?? item.when)
    : undefined;
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
  dispatchMode: DispatchMode = "scheduled",
): Promise<{ scheduled: unknown; scheduleError: string | null; publishing: PublishingStatus }> {
  const releaseClaim = claimPublishingAttempt(slug, row.id, path);
  let releaseAfterAttempt = true;
  try {
    // The argument was read before an async click or drain pass. Under the SAME claim used for
    // the external call, re-read the queue and all strict safety evidence instead of trusting it.
    const liveRow = readQueue(folder).rows.find((item) => item.id === row.id);
    if (!liveRow || liveRow.status !== "approve") throw new Error("this row is no longer currently approved");
    const kind = scheduleKind(liveRow);
    if (!kind) throw new Error("no publishing provider owns this row");
    if (dispatchMode === "unscheduled-draft" && kind !== "text") {
      throw new Error("unscheduled drafts are only supported for Typefully text rows");
    }
    const ledgerError = strictPublishingLedgerError(path);
    if (ledgerError) throw new Error(`${ledgerError}; reconcile it before scheduling`);
    const prior = readPublishingStatuses(path)[publishingKey(slug, liveRow.id)];
    const disposition = approvalDispatchDisposition(folder, slug, liveRow, path);
    if (disposition.kind === "blocked") throw new Error(disposition.reason);
    const retryBlocked = publishingRetryBlock(slug, liveRow, path);
    if (prior && retryBlocked) throw new Error(retryBlocked);
    if (!prior && disposition.kind !== "fresh" && disposition.kind !== "reconciled-not-created") {
      throw new Error(retryBlocked ?? "this row has no verifiable creation and approval provenance; reconcile it before scheduling");
    }
    // Resolved before provider selection on purpose. The seam stands in for the whole external
    // provider round trip, and discovery is part of that round trip: selecting a real provider
    // first would make a disposable browser run reach out to a live provider (and fail on its
    // credentials) before it ever got here. The seam's own gate is what keeps this safe — a
    // one-run token, a marker file inside the disposable repo, and E2E_REPO_ROOT resolving to the
    // executing checkout — so a normal server can never take this branch.
    const injected = disposableProviderOutcome(liveRow);
    let provider: PublishingProvider;
    try {
      provider = injected
        ? injected.provider
        : dispatchMode === "unscheduled-draft"
        ? "typefully"
        : (schedule === scheduleApproved || selectionDeps) && kind !== "outreach-lock"
        ? (await selectConfiguredProvider(liveRow, selectionDeps)).provider
        : providerForKind(kind);
    } catch (error) {
      // Provider discovery happens before dispatch. Persist that exact boundary so an approved row
      // is not stranded with an empty ledger, while keeping retries safe: no provider write could
      // have happened yet, so `failed` truthfully permits another explicit approval attempt.
      const message = `provider selection failed before dispatch; no provider request was made: ${error instanceof Error ? error.message : String(error)}`;
      const status: PublishingStatus = {
        slug, rowId: liveRow.id, provider: providerForKind(kind), state: "failed",
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
      const status: PublishingStatus = { slug, rowId: liveRow.id, provider, state: "blocked", at: new Date().toISOString(), error: `delivery policy blocked: ${policy.reason}`, ...audit };
      appendPublishingStatus(status, path);
      return { scheduled: null, scheduleError: status.error ?? null, publishing: status };
    }
    const fencedAttempt = disposition.kind === "fresh" || disposition.kind === "reconciled-not-created"
      ? markDispatchStarted(folder, slug, liveRow, path)
      : null;
    // This fsynced uncertain event is the pre-callback fence for known-safe retries. For fresh
    // rows the stricter dispatch_started journal entry above is already permanent as well.
    try {
      appendPublishingStatus({ slug, rowId: liveRow.id, provider, state: "uncertain", at: new Date().toISOString(), ...audit }, path);
    } catch (error) {
      // No provider callback has happened yet. An exact durable no-effect event permits recovery
      // only if it also succeeds; otherwise keep the claim and the dispatch fence for review.
      if (fencedAttempt) {
        try { resolveDispatchFence(slug, liveRow.id, "not-created", path); }
        catch { releaseAfterAttempt = false; }
      }
      throw error;
    }
    // Once this callback begins, a thrown callback or failed terminal write must retain the
    // durable claim. A future process has to reconcile the exact fenced attempt first.
    releaseAfterAttempt = false;
    const result = injected
      ? { scheduled: injected.scheduled, scheduleError: injected.scheduleError }
      : await schedule(folder, liveRow, undefined, policy, dispatchMode);
    const status: PublishingStatus = result.scheduleError
      ? {
          slug, rowId: liveRow.id, provider,
          // A Postiz 429 comes from the throttler guard ahead of the controller: nothing was created,
          // so `failed` is truthful and keeps the row retry-eligible for the background drainer.
          // Any other failure stays `uncertain` because the provider may have accepted the call.
          state: result.scheduleError.startsWith("blocked by reuse guard") ? "blocked"
            : postizRateLimitRetryAt(result.scheduleError) ? "failed" : "uncertain",
          at: new Date().toISOString(), error: result.scheduleError,
          ...audit,
        }
      : (() => {
          const normalized = normalizeProviderStatus(provider, result.scheduled);
          const observedState = normalized.state === "uncertain" ? acceptedState(result.scheduled) : normalized.state;
          return { slug, rowId: liveRow.id, provider, state: observedState, at: new Date().toISOString(), ...audit, ...details(provider, result.scheduled) };
        })();
    try {
      appendPublishingStatus(status, path);
    } catch (error) {
      const created = details(provider, result.scheduled).providerObjectId;
      const providerEvidence = created ? `provider returned ${provider} object ${created}` : `provider returned a result`;
      throw new Error(`${providerEvidence}, but terminal publishing-status persistence failed; do not retry automatically and reconcile this exact attempt: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (fencedAttempt && postizRateLimitRetryAt(result.scheduleError)) {
      // Postiz's documented throttle response proves this exact call created nothing.
      resolveDispatchFence(slug, liveRow.id, "not-created", path);
    }
    releaseAfterAttempt = true;
    return { ...result, publishing: status };
  } finally {
    if (releaseAfterAttempt) releaseClaim();
  }
}
