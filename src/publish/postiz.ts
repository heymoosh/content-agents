export type PostizDestination = "x" | "linkedin" | "bluesky" | "mastodon" | "threads" | "instagram" | "tiktok" | "youtube" | "substack";
export type PostizMedia = "text" | "image" | "video";

export interface PostizCapability {
  destination: PostizDestination;
  media: readonly PostizMedia[];
  accountId: string;
  accountLabel: string;
  /** True only when the discovered instance explicitly advertises local media registration. */
  localMediaUpload?: boolean;
}

export interface PostizUnrecognizedIntegration {
  identifier: string;
  accountId: string;
  accountLabel: string;
  reason: "disabled" | "unknown-identifier";
}

export interface PostizCapabilityRegistry {
  fetchedAt: string;
  capabilities: readonly PostizCapability[];
  /** Discovered rows that were deliberately not mapped to a destination; surfaced, never routed. */
  unrecognized?: readonly PostizUnrecognizedIntegration[];
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
  // Post rows from `GET /public/v1/posts` carry Prisma's State enum: QUEUE | DRAFT | PUBLISHED | ERROR.
  if (status === "queue") return "scheduled";
  if (status === "error") return "failed";
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
    url: typeof (item.url ?? item.postUrl ?? item.releaseURL) === "string" ? String(item.url ?? item.postUrl ?? item.releaseURL) : null,
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
        // Postiz's public-API middleware passes the raw Authorization header value to its API-key lookup
        // (public.auth.middleware.ts); a `Bearer ` prefix is rejected as an invalid key.
        headers: { Authorization: key, "Content-Type": "application/json", ...init.headers },
      });
      if (!response.ok) {
        const body = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error(`Postiz ${init.method ?? "GET"} ${path} failed (${response.status})${body ? `: ${body}` : ""}`);
      }
      if (response.status === 204) return {};
      return response.json();
    },
  };
}

const KNOWN_DESTINATIONS: readonly PostizDestination[] = ["x", "linkedin", "bluesky", "mastodon", "threads", "instagram", "tiktok", "youtube", "substack"];

function asDestination(value: string): PostizDestination | null {
  return (KNOWN_DESTINATIONS as readonly string[]).includes(value) ? (value as PostizDestination) : null;
}

/**
 * The connected instance is authoritative: no destination is assumed supported.
 *
 * The self-hosted public endpoint (`GET /public/v1/integrations`, public.integrations.controller.ts)
 * returns a bare array of `{ id, name, identifier, picture, disabled, profile, customer }` and no
 * media capability list. When an explicit `media`/`capabilities` array is present it is honored as
 * before. When it is absent, an enabled integration whose `identifier` exactly matches a known
 * destination is registered as text-only: text is the baseline every connected provider accepts,
 * and the public API documents no upload path, so image/video stay unsupported until a live
 * upload lifecycle is verified. Disabled rows are dropped and unrecognized identifiers (for
 * example `linkedin-page`, `facebook`) are recorded, never mapped to a destination.
 */
export async function fetchPostizCapabilities(transport: PostizTransport, now = new Date()): Promise<PostizCapabilityRegistry> {
  const payload = await transport.request("/api/public/v1/integrations");
  const values = Array.isArray(payload) ? payload : (record(payload).integrations ?? record(payload).data);
  if (!Array.isArray(values)) throw new Error("Postiz capability response has no integrations list");
  const capabilities: PostizCapability[] = [];
  const unrecognized: PostizUnrecognizedIntegration[] = [];
  for (const raw of values) {
    const item = record(raw);
    const identifier = requiredString(item.destination ?? item.platform ?? item.identifier, "integration destination");
    const accountId = requiredString(item.accountId ?? item.id, "integration account id");
    const accountLabel = requiredString(item.accountLabel ?? item.name ?? item.username, "integration account label");
    if (item.disabled === true) { unrecognized.push({ identifier, accountId, accountLabel, reason: "disabled" }); continue; }
    const mediaRaw = item.media ?? item.capabilities;
    if (mediaRaw !== undefined) {
      if (!Array.isArray(mediaRaw) || !mediaRaw.every((entry) => typeof entry === "string")) {
        throw new Error(`Postiz integration ${identifier} has no explicit media capabilities`);
      }
      const destination = asDestination(identifier);
      if (!destination) { unrecognized.push({ identifier, accountId, accountLabel, reason: "unknown-identifier" }); continue; }
      capabilities.push({ destination, media: mediaRaw.map(String) as PostizMedia[], accountId, accountLabel });
      continue;
    }
    const destination = asDestination(identifier);
    if (!destination) { unrecognized.push({ identifier, accountId, accountLabel, reason: "unknown-identifier" }); continue; }
    // The public adapter has no documented upload/registration endpoint. Do not turn a generic
    // provider capability string into permission to invent one or a fake public URL.
    capabilities.push({ destination, media: ["text"], accountId, accountLabel });
  }
  return { fetchedAt: now.toISOString(), capabilities, ...(unrecognized.length ? { unrecognized } : {}) };
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

/**
 * Postiz's public create contract (`POST /public/v1/posts`, CreatePostDto): `type`, `date`, `shortLink`,
 * `tags`, and `posts[].value[].image` are all required, and each post names its channel by
 * `integration.id`; `settings.__type` is injected server-side from the integration. Only `draft`
 * (stored as DRAFT, no publish workflow is started) and `schedule` exist; Postiz has no private
 * visibility, so it is refused rather than silently downgraded. The response is a bare array of
 * `{ postId, integration }`.
 */
function createBody(input: PostizCreateInput): Record<string, unknown> {
  if (input.mediaUrls?.length) throw new Error("Postiz media posts are unsupported until a live upload lifecycle is verified");
  const type = input.visibility === "draft" ? "draft" : input.visibility === "scheduled" ? "schedule" : null;
  if (!type) throw new Error("Postiz has no private visibility; use draft");
  return {
    type,
    date: input.scheduledAt,
    shortLink: false,
    tags: [],
    posts: [{ integration: { id: input.accountId }, value: [{ content: input.content, image: [] }] }],
  };
}

export async function createPostizPost(transport: PostizTransport, input: PostizCreateInput, now = new Date()): Promise<PostizPost> {
  assertSafeCreate(input, now);
  const body = createBody(input);
  const response = await transport.request("/api/public/v1/posts", { method: "POST", body: JSON.stringify(body) });
  const first = record(Array.isArray(response) ? response[0] : response);
  return {
    id: requiredString(first.postId ?? first.id, "stable post id"),
    url: null,
    status: body.type === "draft" ? "draft" : "scheduled",
    scheduledAt: input.scheduledAt,
  };
}

/** Postiz exposes no read-by-id route; posts are listed by publish-date window (`GET /public/v1/posts`). */
const READ_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

function listWindow(around: string | undefined, now: Date): string {
  const parsed = around ? Date.parse(around) : NaN;
  const center = Number.isFinite(parsed) ? parsed : now.getTime();
  const startDate = new Date(center - READ_WINDOW_MS).toISOString();
  const endDate = new Date(center + READ_WINDOW_MS).toISOString();
  return `/api/public/v1/posts?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}

/**
 * Find a post by stable id within the publish-date window around `around` (the known scheduled time,
 * defaulting to now). Returns null when absent. Deleted posts are soft-deleted (`deletedAt`) and the
 * list filters them out, so absence after a cancel is the only cancellation signal Postiz offers.
 */
export async function findPostizPost(transport: PostizTransport, id: string, around?: string, now = new Date()): Promise<PostizPost | null> {
  const stableId = requiredString(id, "post id");
  const response = record(await transport.request(listWindow(around, now)));
  const rows = Array.isArray(response.posts) ? response.posts : [];
  const match = rows.find((row) => typeof row === "object" && row !== null && (row as Record<string, unknown>).id === stableId);
  return match ? normalizePost(match) : null;
}

export async function readPostizPost(transport: PostizTransport, id: string, around?: string, now = new Date()): Promise<PostizPost> {
  const post = await findPostizPost(transport, id, around, now);
  if (!post) throw new Error(`Postiz post ${id} was not found in the publish-date window`);
  return post;
}

/** `DELETE /public/v1/posts/:id` soft-deletes the post's group and returns only `{ id }`. */
export async function cancelPostizPost(transport: PostizTransport, id: string): Promise<PostizPost> {
  const stableId = requiredString(id, "post id");
  await transport.request(`/api/public/v1/posts/${encodeURIComponent(stableId)}`, { method: "DELETE" });
  return { id: stableId, url: null, status: "canceled", scheduledAt: null };
}

/** Terminal cleanup is proven by absence from the list window; a still-listed post reports its live state. */
export async function reconcilePostizPost(transport: PostizTransport, id: string, around?: string, now = new Date()): Promise<PostizPost> {
  return (await findPostizPost(transport, id, around, now)) ?? { id: requiredString(id, "post id"), url: null, status: "canceled", scheduledAt: null };
}
