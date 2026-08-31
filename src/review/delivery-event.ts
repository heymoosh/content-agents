import { randomUUID } from "node:crypto";

/** Providers which have existed in the publishing pipeline, including retired/compatibility paths. */
export type DeliveryProvider =
  | "typefully"
  | "postpeer"
  | "postiz"
  | "youtube"
  | "substack"
  | "manual"
  | "upload-post";

/** Provider-independent lifecycle. `planned` includes accepted scheduled drafts. */
export type DeliveryState =
  | "planned"
  | "blocked"
  | "delivered"
  | "live"
  | "canceled"
  | "deleted"
  | "failed"
  | "private"
  | "uncertain";

export interface DeliveryEvent {
  schemaVersion: 1;
  eventId: string;
  slug: string;
  rowId: string;
  provider: DeliveryProvider;
  state: DeliveryState;
  /** Time this immutable observation was recorded by content-agents. */
  at: string;
  /** Durable provider correlation fields. */
  providerObjectId?: string;
  providerAccountId?: string | null;
  canonicalUrl?: string;
  plannedFor?: string;
  providerCreatedAt?: string;
  providerUpdatedAt?: string;
  providerPublishedAt?: string;
  error?: string;
  policyVersion?: string;
  origin?: string;
  brand?: string | null;
  deliveryMode?: string;
  policyReason?: string;
  /** Set only when an old ledger record was upgraded during a read. */
  legacyState?: string;
  evidenceKind?: "provider" | "human";
  evidence?: string;
}

const NORMAL_STATES = new Set<DeliveryState>([
  "planned", "blocked", "delivered", "live", "canceled", "deleted", "failed", "private", "uncertain",
]);

export function normalizeDeliveryState(value: unknown): DeliveryState | null {
  if (typeof value !== "string") return null;
  if (NORMAL_STATES.has(value as DeliveryState)) return value as DeliveryState;
  if (value === "scheduling" || value === "scheduled") return "planned";
  if (value === "cleared") return "canceled";
  if (value === "published" || value === "sent" || value === "complete") return "delivered";
  if (value === "live_confirmed") return "live";
  if (value === "cancelled") return "canceled";
  return null;
}

export function normalizeDeliveryProvider(value: unknown): DeliveryProvider | null {
  if (value === "typefully" || value === "postpeer" || value === "postiz" || value === "youtube"
      || value === "substack" || value === "manual" || value === "upload-post") return value;
  return null;
}

/** Upgrade both v1 events and the pre-v1 PublishingStatus lines without rewriting history. */
export function parseDeliveryEvent(value: unknown): DeliveryEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.slug !== "string" || !raw.slug || typeof raw.rowId !== "string" || !raw.rowId
      || typeof raw.at !== "string" || !raw.at) return null;
  const provider = normalizeDeliveryProvider(raw.provider);
  const state = normalizeDeliveryState(raw.state);
  if (!provider || !state) return null;
  const string = (key: string): string | undefined => typeof raw[key] === "string" && raw[key] ? raw[key] as string : undefined;
  const nullableString = (key: string): string | null | undefined => raw[key] === null ? null : string(key);
  const oldState = typeof raw.state === "string" && !NORMAL_STATES.has(raw.state as DeliveryState) ? raw.state : undefined;
  return {
    schemaVersion: 1,
    eventId: string("eventId") ?? `legacy:${raw.slug}/${raw.rowId}:${raw.at}`,
    slug: raw.slug,
    rowId: raw.rowId,
    provider,
    state,
    at: raw.at,
    ...(string("providerObjectId") ?? string("ref") ? { providerObjectId: string("providerObjectId") ?? string("ref") } : {}),
    ...(nullableString("providerAccountId") !== undefined ? { providerAccountId: nullableString("providerAccountId") } : {}),
    ...(string("canonicalUrl") ? { canonicalUrl: string("canonicalUrl") } : {}),
    ...(string("plannedFor") ? { plannedFor: string("plannedFor") } : {}),
    ...(string("providerCreatedAt") ? { providerCreatedAt: string("providerCreatedAt") } : {}),
    ...(string("providerUpdatedAt") ? { providerUpdatedAt: string("providerUpdatedAt") } : {}),
    ...(string("providerPublishedAt") ? { providerPublishedAt: string("providerPublishedAt") } : {}),
    ...(string("error") ? { error: string("error") } : {}),
    ...(string("policyVersion") ? { policyVersion: string("policyVersion") } : {}),
    ...(string("origin") ? { origin: string("origin") } : {}),
    ...(nullableString("brand") !== undefined ? { brand: nullableString("brand") } : {}),
    ...(string("deliveryMode") ? { deliveryMode: string("deliveryMode") } : {}),
    ...(string("policyReason") ? { policyReason: string("policyReason") } : {}),
    ...(raw.evidenceKind === "provider" || raw.evidenceKind === "human" ? { evidenceKind: raw.evidenceKind } : {}),
    ...(string("evidence") ? { evidence: string("evidence") } : {}),
    ...(oldState ? { legacyState: oldState } : {}),
  };
}

export function newDeliveryEvent(event: Omit<DeliveryEvent, "schemaVersion" | "eventId">): DeliveryEvent {
  return { schemaVersion: 1, eventId: randomUUID(), ...event };
}

export interface ProviderStatusObservation {
  provider: DeliveryProvider;
  state: DeliveryState;
  providerObjectId?: string;
  providerAccountId?: string;
  canonicalUrl?: string;
  plannedFor?: string;
  providerCreatedAt?: string;
  providerUpdatedAt?: string;
  providerPublishedAt?: string;
}

/** Normalize the deliberately small common surface returned by all current provider adapters. */
export function normalizeProviderStatus(provider: DeliveryProvider, value: unknown): ProviderStatusObservation {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) if (typeof raw[key] === "string" && raw[key]) return raw[key] as string;
    return undefined;
  };
  const providerStatus = (pick("status", "state") ?? "").toLowerCase().replaceAll("-", "_");
  let state: DeliveryState | null = ["posted", "published", "live", "success", "succeeded"].includes(providerStatus) ? "live" : normalizeDeliveryState(providerStatus);
  if (!state) {
    if (["scheduled", "draft", "queued", "pending", "processing"].includes(providerStatus)) state = "planned";
    else if (["cancelled", "canceled"].includes(providerStatus)) state = "canceled";
    else if (["removed", "deleted"].includes(providerStatus)) state = "deleted";
    else if (["error", "failed", "rejected"].includes(providerStatus)) state = "failed";
    else if (["private", "unlisted"].includes(providerStatus)) state = "private";
    else state = "uncertain";
  }
  const providerObjectId = pick("providerObjectId", "id", "postId", "draftId", "jobId");
  const providerAccountId = pick("providerAccountId", "accountId", "profileId", "channelId");
  const canonicalUrl = pick("canonicalUrl", "url", "postUrl", "permalink");
  const plannedFor = pick("plannedFor", "scheduledFor", "whenIso", "publishAt");
  const providerCreatedAt = pick("providerCreatedAt", "createdAt", "created_at");
  const providerUpdatedAt = pick("providerUpdatedAt", "updatedAt", "updated_at");
  const providerPublishedAt = pick("providerPublishedAt", "publishedAt", "published_at", "postedAt");
  return {
    provider, state,
    ...(providerObjectId ? { providerObjectId } : {}),
    ...(providerAccountId ? { providerAccountId } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(plannedFor ? { plannedFor } : {}),
    ...(providerCreatedAt ? { providerCreatedAt } : {}),
    ...(providerUpdatedAt ? { providerUpdatedAt } : {}),
    ...(providerPublishedAt ? { providerPublishedAt } : {}),
  };
}
