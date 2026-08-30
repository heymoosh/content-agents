export type PostizDestination = "x" | "linkedin" | "bluesky" | "mastodon" | "threads" | "tiktok" | "youtube" | "substack";
export type PostizMedia = "text" | "image" | "video";

export interface PostizCapability {
  destination: PostizDestination;
  media: readonly PostizMedia[];
  accountId: string;
  accountLabel: string;
  /** True only when the discovered instance explicitly advertises local media registration. */
  localMediaUpload?: boolean;
}

export interface PostizCapabilityRegistry {
  fetchedAt: string;
  capabilities: readonly PostizCapability[];
}

export type DeliveryRoute = "postiz" | "typefully" | "postpeer" | "youtube" | "substack" | "unsupported";

export interface PostizTransport {
  request(path: string, init?: RequestInit): Promise<unknown>;
}

export interface PostizCreateInput {
  destination: PostizDestination;
  accountId: string;
  content: string;
  mediaUrls?: readonly string[];
  scheduledAt: string;
  visibility: "draft" | "private" | "scheduled";
}

export interface PostizPost {
  id: string;
  url: string | null;
  status: "draft" | "scheduled" | "private" | "published" | "canceled" | "failed" | "unknown";
  scheduledAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Postiz returned an invalid object");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Postiz response is missing ${field}`);
  return value.trim();
}

function normalizeStatus(value: unknown): PostizPost["status"] {
  const status = String(value ?? "").toLowerCase();
  if (["draft", "scheduled", "private", "published", "canceled", "failed"].includes(status)) return status as PostizPost["status"];
  return "unknown";
}

function normalizePost(value: unknown): PostizPost {
  const item = record(value);
  const optionalString = (...values: unknown[]): string | undefined => {
    const value = values.find((entry) => typeof entry === "string" && entry);
    return typeof value === "string" ? value : undefined;
  };
  return {
    id: requiredString(item.id ?? item._id, "stable post id"),
    url: typeof (item.url ?? item.postUrl) === "string" ? String(item.url ?? item.postUrl) : null,
    status: normalizeStatus(item.status ?? item.state),
    scheduledAt: typeof (item.scheduledAt ?? item.publishDate) === "string" ? String(item.scheduledAt ?? item.publishDate) : null,
    ...(optionalString(item.createdAt, item.created_at) ? { createdAt: optionalString(item.createdAt, item.created_at) } : {}),
    ...(optionalString(item.updatedAt, item.updated_at) ? { updatedAt: optionalString(item.updatedAt, item.updated_at) } : {}),
    ...(optionalString(item.publishedAt, item.published_at, item.postedAt) ? { publishedAt: optionalString(item.publishedAt, item.published_at, item.postedAt) } : {}),
  };
}

/** Build a transport for the configured self-hosted instance. No module-level network calls. */
export function createPostizTransport(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): PostizTransport {
  const base = env.POSTIZ_BASE_URL?.trim().replace(/\/$/, "");
  const key = env.POSTIZ_API_KEY?.trim();
  if (!base || !key) throw new Error("POSTIZ_BASE_URL and POSTIZ_API_KEY are required");
  return {
    async request(path, init = {}) {
      const response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
      });
      if (!response.ok) throw new Error(`Postiz ${init.method ?? "GET"} ${path} failed (${response.status})`);
      if (response.status === 204) return {};
      return response.json();
    },
  };
}

/** The connected instance is authoritative: no destination is assumed supported. */
export async function fetchPostizCapabilities(transport: PostizTransport, now = new Date()): Promise<PostizCapabilityRegistry> {
  const payload = await transport.request("/api/public/v1/integrations");
  const values = Array.isArray(payload) ? payload : (record(payload).integrations ?? record(payload).data);
  if (!Array.isArray(values)) throw new Error("Postiz capability response has no integrations list");
  const capabilities = values.map((raw): PostizCapability => {
    const item = record(raw);
    const destination = requiredString(item.destination ?? item.platform ?? item.identifier, "integration destination") as PostizDestination;
    const mediaRaw = item.media ?? item.capabilities;
    if (!Array.isArray(mediaRaw) || !mediaRaw.every((entry) => typeof entry === "string")) {
      throw new Error(`Postiz integration ${destination} has no explicit media capabilities`);
    }
    return {
      destination,
      media: mediaRaw.map(String) as PostizMedia[],
      accountId: requiredString(item.accountId ?? item.id, "integration account id"),
      accountLabel: requiredString(item.accountLabel ?? item.name ?? item.username, "integration account label"),
      // The public adapter has no documented upload/registration endpoint. Do not turn a generic
      // provider capability string into permission to invent one or a fake public URL.
    };
  });
  return { fetchedAt: now.toISOString(), capabilities };
}

export function supportsPostiz(registry: PostizCapabilityRegistry, destination: PostizDestination, media: PostizMedia): boolean {
  return registry.capabilities.some((entry) => entry.destination === destination && entry.media.includes(media));
}

export function resolveConfiguredPostizCapability(
  registry: PostizCapabilityRegistry,
  destination: PostizDestination,
  media: PostizMedia,
  env: NodeJS.ProcessEnv = process.env,
): PostizCapability {
  const configured = env.POSTIZ_ACCOUNT_ID?.trim();
  if (!configured) throw new Error("POSTIZ_ACCOUNT_ID is required to select a discovered instance account");
  const match = registry.capabilities.find((entry) => entry.accountId === configured && entry.destination === destination && entry.media.includes(media));
  if (!match) throw new Error(`configured Postiz account does not advertise ${destination}/${media}`);
  return match;
}

/** Exceptions are considered only when live registry evidence says Postiz is unsupported. */
export function selectDeliveryRoute(
  registry: PostizCapabilityRegistry,
  destination: PostizDestination,
  media: PostizMedia,
  opts: { requiresLocalMediaUpload?: boolean } = {},
): DeliveryRoute {
  const postiz = registry.capabilities.some((entry) => entry.destination === destination && entry.media.includes(media)
    && (!opts.requiresLocalMediaUpload || entry.localMediaUpload === true));
  if (postiz) return "postiz";
  if (["x", "linkedin", "bluesky"].includes(destination) && ["text", "image"].includes(media)) return "typefully";
  if (destination === "tiktok" && media === "video") return "postpeer";
  if (destination === "youtube" && media === "video") return "youtube";
  if (destination === "substack" && media === "text") return "substack";
  return "unsupported";
}

function assertSafeCreate(input: PostizCreateInput, now = new Date()): void {
  if (!input.accountId.trim()) throw new Error("Postiz account id is required");
  if (!input.content.trim()) throw new Error("Postiz content is required");
  const scheduled = Date.parse(input.scheduledAt);
  if (!Number.isFinite(scheduled) || scheduled <= now.getTime()) throw new Error("Postiz posts must be scheduled in the future");
  if (!["draft", "private", "scheduled"].includes(input.visibility)) throw new Error("instant public Postiz posts are prohibited");
}

export async function createPostizPost(transport: PostizTransport, input: PostizCreateInput, now = new Date()): Promise<PostizPost> {
  assertSafeCreate(input, now);
  return normalizePost(await transport.request("/api/public/v1/posts", { method: "POST", body: JSON.stringify(input) }));
}

export async function readPostizPost(transport: PostizTransport, id: string): Promise<PostizPost> {
  return normalizePost(await transport.request(`/api/public/v1/posts/${encodeURIComponent(requiredString(id, "post id"))}`));
}

export async function cancelPostizPost(transport: PostizTransport, id: string): Promise<PostizPost> {
  const stableId = requiredString(id, "post id");
  const response = await transport.request(`/api/public/v1/posts/${encodeURIComponent(stableId)}`, { method: "DELETE" });
  const item = record(response);
  return Object.keys(item).length ? normalizePost(item) : { id: stableId, url: null, status: "canceled", scheduledAt: null };
}

export async function reconcilePostizPost(transport: PostizTransport, id: string): Promise<PostizPost> {
  return readPostizPost(transport, id);
}
