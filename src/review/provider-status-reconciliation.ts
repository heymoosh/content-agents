import {
  normalizeProviderStatus,
  type DeliveryEvent,
  type DeliveryProvider,
} from "./delivery-event.js";
import {
  appendPublishingStatus,
  readPublishingStatuses,
  type PublishingStatus,
} from "./publishing-status.js";
import { createPostizTransport, readPostizPost, type PostizTransport } from "../publish/postiz.js";
import { fetchScheduledDrafts } from "../publish/typefully.js";
import { fetchScheduledPosts } from "../publish/postpeer-status.js";
import { listScheduledUploads } from "../publish/youtube.js";

export type ProviderStatusReader = (status: PublishingStatus) => Promise<unknown>;
export type ProviderStatusReaders = Partial<Record<DeliveryProvider, ProviderStatusReader>>;

function observationChanged(previous: PublishingStatus, next: PublishingStatus): boolean {
  return ["state", "error", "providerObjectId", "providerAccountId", "canonicalUrl", "plannedFor", "providerUpdatedAt", "providerPublishedAt"]
    .some((key) => previous[key as keyof PublishingStatus] !== next[key as keyof PublishingStatus]);
}

export interface DefaultStatusReaderDeps {
  postizTransport?: PostizTransport;
  fetchTypefully?: typeof fetchScheduledDrafts;
  fetchPostpeer?: typeof fetchScheduledPosts;
  fetchYoutube?: typeof listScheduledUploads;
}

function comparableProviderId(provider: DeliveryProvider, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (provider === "typefully") return value.replace(/^typefully\s+draft\s+/i, "");
  if (provider === "postpeer") return value.replace(/^(?:tiktok\s+)?postpeer\s+post\s+/i, "");
  if (provider === "youtube") {
    try {
      const url = new URL(value);
      return url.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1] ?? url.searchParams.get("v") ?? value;
    } catch { return value; }
  }
  return value;
}

/** Production readers for providers with authoritative read APIs. Others remain explicitly unavailable. */
export function createDefaultProviderStatusReaders(deps: DefaultStatusReaderDeps = {}): ProviderStatusReaders {
  return {
    postiz: async (status) => readPostizPost(deps.postizTransport ?? createPostizTransport(), status.providerObjectId ?? status.ref ?? "", status.plannedFor),
    typefully: async (status) => {
      const id = comparableProviderId("typefully", status.providerObjectId ?? status.ref);
      const item = (await (deps.fetchTypefully ?? fetchScheduledDrafts)()).find((entry) => comparableProviderId("typefully", entry.id) === id);
      return item
        ? { ...item, id: item.id, status: "scheduled", scheduledFor: item.whenIso }
        : { id, status: "unknown", reconciliationError: "Typefully scheduled-list absence cannot distinguish live, canceled, deleted, or failed; human reconciliation is required" };
    },
    postpeer: async (status) => {
      const id = comparableProviderId("postpeer", status.providerObjectId ?? status.ref);
      return (await (deps.fetchPostpeer ?? fetchScheduledPosts)()).find((entry) => comparableProviderId("postpeer", entry.id) === id) ?? { id, status: "unknown" };
    },
    youtube: async (status) => {
      const id = comparableProviderId("youtube", status.providerObjectId ?? status.ref);
      const item = (await (deps.fetchYoutube ?? listScheduledUploads)()).find((entry) => comparableProviderId("youtube", entry.videoId) === id);
      return item
        ? { id: item.videoId, status: "scheduled", scheduledFor: item.publishAt }
        : { id, status: "unknown", reconciliationError: "YouTube scheduled-list absence cannot distinguish live, private, deleted, or failed; human reconciliation is required" };
    },
    manual: async (status) => ({ id: status.providerObjectId ?? status.ref, status: status.state, url: status.canonicalUrl }),
  };
}

export async function reconcileConfiguredProviderStatuses(path?: string, deps: DefaultStatusReaderDeps = {}): Promise<DeliveryEvent[]> {
  return reconcileProviderStatuses(createDefaultProviderStatusReaders(deps), path);
}

/**
 * Read each provider object once and append one immutable observation. This never schedules,
 * recreates, or retries a provider write. Missing readers are explicit unavailable evidence.
 */
export async function reconcileProviderStatuses(
  readers: ProviderStatusReaders,
  path?: string,
  now: () => Date = () => new Date(),
): Promise<DeliveryEvent[]> {
  const statuses = readPublishingStatuses(path);
  const appended: DeliveryEvent[] = [];
  for (const status of Object.values(statuses)) {
    if (!status.providerObjectId && !status.ref) continue;
    const reader = readers[status.provider];
    if (!reader) {
      const unavailable: PublishingStatus = {
        ...status, state: "uncertain", at: now().toISOString(),
        error: `authoritative ${status.provider} status reader is unavailable`,
        schemaVersion: undefined, eventId: undefined,
      };
      if (!observationChanged(status, unavailable)) continue;
      appendPublishingStatus(unavailable, path);
      appended.push(readPublishingStatuses(path)[`${status.slug}/${status.rowId}`] as DeliveryEvent);
      continue;
    }
    try {
      const rawObservation = await reader(status);
      const observation = normalizeProviderStatus(status.provider, rawObservation);
      const reconciliationError = rawObservation && typeof rawObservation === "object"
        && typeof (rawObservation as Record<string, unknown>).reconciliationError === "string"
        ? (rawObservation as Record<string, unknown>).reconciliationError as string : undefined;
      const observedAccount = observation.providerAccountId;
      const accountMismatch = Boolean(status.providerAccountId && observedAccount && status.providerAccountId !== observedAccount);
      const next: PublishingStatus = {
        ...status,
        ...observation,
        // A provider object seen under a different account is evidence, not terminal proof.
        state: accountMismatch ? "uncertain" : observation.state,
        at: now().toISOString(),
        providerObjectId: observation.providerObjectId ?? status.providerObjectId ?? status.ref,
        // Never let an observation erase or replace the scheduled authoritative identity.
        providerAccountId: status.providerAccountId ?? observation.providerAccountId,
        canonicalUrl: observation.canonicalUrl ?? status.canonicalUrl,
        schemaVersion: undefined,
        eventId: undefined,
        error: accountMismatch
          ? `observed provider account ${observedAccount} does not match scheduled account ${status.providerAccountId}; uncertain evidence retained`
          : observation.state === "uncertain"
          ? reconciliationError ?? `authoritative ${status.provider} status is ambiguous; human reconciliation is required`
          : undefined,
      };
      if (!observationChanged(status, next)) continue;
      appendPublishingStatus(next, path);
      appended.push(readPublishingStatuses(path)[`${status.slug}/${status.rowId}`] as DeliveryEvent);
    } catch (error) {
      const uncertain: PublishingStatus = {
        ...status, state: "uncertain", at: now().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        schemaVersion: undefined, eventId: undefined,
      };
      if (!observationChanged(status, uncertain)) continue;
      appendPublishingStatus(uncertain, path);
      appended.push(readPublishingStatuses(path)[`${status.slug}/${status.rowId}`] as DeliveryEvent);
    }
  }
  return appended;
}
