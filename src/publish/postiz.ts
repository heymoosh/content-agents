export type PostizDestination = "x" | "linkedin" | "bluesky" | "mastodon" | "threads" | "facebook" | "instagram" | "tiktok" | "youtube" | "substack";
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
  reason: "disabled" | "unknown-identifier" | "no-text-baseline";
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

/** A media object already registered with the instance through `uploadPostizMedia` (`POST /public/v1/upload`). */
export interface PostizMediaRef {
  id: string;
  path: string;
}

export interface PostizCreateInput {
  destination: PostizDestination;
  accountId: string;
  content: string;
  /** Remote media URLs are refused: Postiz media must be registered first (see `uploadPostizMedia`). */
  mediaUrls?: readonly string[];
  media?: readonly PostizMediaRef[];
  scheduledAt: string;
  visibility: "draft" | "private" | "scheduled";
  /** Provider settings merged over the per-destination defaults (`__type` is always server-injected). */
  providerSettings?: Record<string, unknown>;
}

/** Identity of an existing unpublished Postiz post, needed to edit or move it in place. */
export interface PostizExistingPost {
  id: string;
  group?: string;
}

export interface PostizPost {
  id: string;
  url: string | null;
  status: "draft" | "scheduled" | "private" | "published" | "canceled" | "failed" | "unknown";
  scheduledAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  /** Postiz rotates the group on every public-API save; cancel resolves it by post id, so it is informational. */
  group?: string;
  accountId?: string;
  content?: string;
  settings?: Record<string, unknown>;
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
  const integration = item.integration && typeof item.integration === "object" ? (item.integration as Record<string, unknown>) : {};
  let settings: Record<string, unknown> | undefined;
  if (typeof item.settings === "string") { try { const parsed = JSON.parse(item.settings); if (parsed && typeof parsed === "object") settings = parsed; } catch { /* opaque */ } }
  else if (item.settings && typeof item.settings === "object") settings = item.settings as Record<string, unknown>;
  return {
    id: requiredString(item.id ?? item._id, "stable post id"),
    url: typeof (item.url ?? item.postUrl ?? item.releaseURL) === "string" ? String(item.url ?? item.postUrl ?? item.releaseURL) : null,
    status: normalizeStatus(item.status ?? item.state),
    scheduledAt: typeof (item.scheduledAt ?? item.publishDate) === "string" ? String(item.scheduledAt ?? item.publishDate) : null,
    ...(optionalString(item.group) ? { group: optionalString(item.group) } : {}),
    ...(optionalString(integration.id, item.integrationId) ? { accountId: optionalString(integration.id, item.integrationId) } : {}),
    ...(typeof item.content === "string" ? { content: item.content } : {}),
    ...(settings ? { settings } : {}),
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

const KNOWN_DESTINATIONS: readonly PostizDestination[] = ["x", "linkedin", "bluesky", "mastodon", "threads", "facebook", "instagram", "tiktok", "youtube", "substack"];

/**
 * Destinations whose Postiz provider accepts a text-only post (per each provider's live
 * `GET /integration-settings/:id` rules). Instagram, TikTok, and YouTube require media at Postiz's
 * own `validatePosts` step, which runs only for non-draft creates, so a draft canary cannot prove
 * them and a `schedule` create there without media would 400 at validation.
 */
const TEXT_BASELINE_DESTINATIONS: ReadonlySet<PostizDestination> = new Set(["x", "linkedin", "bluesky", "mastodon", "threads", "facebook"]);

/** Media a destination accepts once an upload lifecycle is verified for the instance (provider rules). */
const MEDIA_DESTINATIONS: Readonly<Record<PostizDestination, readonly PostizMedia[]>> = {
  x: ["text", "image", "video"], linkedin: ["text", "image", "video"], bluesky: ["text", "image", "video"],
  mastodon: ["text", "image", "video"], threads: ["text", "image", "video"], facebook: ["text", "image", "video"],
  instagram: ["image", "video"], tiktok: ["image", "video"], youtube: ["video"], substack: ["text"],
};

/**
 * Required provider settings for a non-draft create, taken from each channel's live
 * `GET /integration-settings/:id` JSON schema (`required` lists). Postiz validates these only when
 * `type !== 'draft'`, so a draft canary never exercises them; a `schedule` create without them 400s.
 * Callers override any key through `providerSettings`. `__type` is injected server-side.
 */
export function defaultProviderSettings(destination: PostizDestination): Record<string, unknown> {
  switch (destination) {
    case "x": return { who_can_reply_post: "everyone" };
    case "facebook": return { post_type: "post" };
    case "instagram": return { post_type: "post" };
    case "youtube": return { title: "", type: "public" };
    case "tiktok": return {
      privacy_level: "PUBLIC_TO_EVERYONE", duet: false, stitch: false, comment: true, autoAddMusic: "no",
      brand_content_toggle: false, brand_organic_toggle: false, content_posting_method: "DIRECT_POST",
    };
    default: return {};
  }
}

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
 * destination that takes text-only posts is registered as text-only; the public API documents no
 * upload path, so image/video stay unsupported until a live upload lifecycle is verified.
 * Media-required destinations (instagram, tiktok, youtube) are recorded as `no-text-baseline`,
 * because Postiz validates provider rules only for non-draft creates. Disabled rows are dropped and unrecognized identifiers (for
 * example `linkedin-page`, `facebook`) are recorded, never mapped to a destination.
 */
export interface FetchPostizCapabilitiesOptions {
  /**
   * Set only after `uploadPostizMedia` has passed a live lifecycle on this instance (recorded in the
   * master status doc); then every enabled known destination advertises its provider media list.
   */
  mediaUploadVerified?: boolean;
}

export async function fetchPostizCapabilities(transport: PostizTransport, now = new Date(), opts: FetchPostizCapabilitiesOptions = {}): Promise<PostizCapabilityRegistry> {
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
    if (opts.mediaUploadVerified) {
      capabilities.push({ destination, media: MEDIA_DESTINATIONS[destination], accountId, accountLabel, localMediaUpload: true });
      continue;
    }
    if (!TEXT_BASELINE_DESTINATIONS.has(destination)) { unrecognized.push({ identifier, accountId, accountLabel, reason: "no-text-baseline" }); continue; }
    // Media stays off until the instance's upload lifecycle has been proven live (`mediaUploadVerified`).
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
  if (destination === "facebook") return "unsupported";
  if (destination === "tiktok" && media === "video") return "postpeer";
  if (destination === "youtube" && media === "video") return "youtube";
  if (destination === "substack" && media === "text") return "substack";
  return "unsupported";
}

function assertSafeCreate(input: PostizCreateInput, now = new Date()): void {
  if (!input.accountId.trim()) throw new Error("Postiz account id is required");
  if (!input.content.trim() && !input.media?.length) throw new Error("Postiz content is required");
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
function createBody(input: PostizCreateInput, existing?: PostizExistingPost, mode: "draft" | "schedule" | "update" = input.visibility === "draft" ? "draft" : "schedule"): Record<string, unknown> {
  if (input.mediaUrls?.length) throw new Error("Postiz media must be registered with uploadPostizMedia first; remote URLs are refused");
  if (input.visibility === "private") throw new Error("Postiz has no private visibility; use draft");
  for (const ref of input.media ?? []) {
    if (!ref.id?.trim() || !ref.path?.trim()) throw new Error("Postiz media refs need the id and path returned by the upload route");
  }
  const settings = mode === "draft" ? {} : { ...defaultProviderSettings(input.destination), ...(input.providerSettings ?? {}) };
  if (mode !== "draft") {
    if (input.destination === "youtube" && !String(settings.title ?? "").trim()) throw new Error("Postiz YouTube posts need providerSettings.title");
    if (!TEXT_BASELINE_DESTINATIONS.has(input.destination) && !input.media?.length) throw new Error(`Postiz ${input.destination} posts require media`);
  }
  return {
    type: mode,
    date: input.scheduledAt,
    shortLink: false,
    tags: [],
    posts: [{
      integration: { id: input.accountId },
      ...(existing?.group ? { group: existing.group } : {}),
      value: [{ ...(existing ? { id: existing.id } : {}), content: input.content, image: (input.media ?? []).map((ref) => ({ id: ref.id, path: ref.path })) }],
      ...(Object.keys(settings).length ? { settings } : {}),
    }],
  };
}

async function postPosts(transport: PostizTransport, body: Record<string, unknown>): Promise<string> {
  const response = await transport.request("/api/public/v1/posts", { method: "POST", body: JSON.stringify(body) });
  const first = record(Array.isArray(response) ? response[0] : response);
  return requiredString(first.postId ?? first.id, "stable post id");
}

/**
 * Register a local file with the instance (`POST /public/v1/upload`, multipart field `file`) and
 * return the `{ id, path }` media ref Postiz expects inside `posts[].value[].image`. Public API
 * accepts jpeg/png/gif/webp/avif/bmp/tiff images and mp4 video; there is no public delete for media.
 */
export async function uploadPostizMedia(transport: PostizTransport, file: { bytes: Uint8Array; filename: string; mime: string }): Promise<PostizMediaRef> {
  if (!file.bytes.length) throw new Error("Postiz upload needs a non-empty file");
  const form = new FormData();
  form.append("file", new Blob([file.bytes.slice().buffer as ArrayBuffer], { type: file.mime }), file.filename);
  // Let fetch set the multipart boundary: an explicit Content-Type would break the body.
  const response = record(await transport.request("/api/public/v1/upload", { method: "POST", body: form, headers: { "Content-Type": "" } }));
  return { id: requiredString(response.id, "media id"), path: requiredString(response.path, "media path") };
}

export async function createPostizPost(transport: PostizTransport, input: PostizCreateInput, now = new Date()): Promise<PostizPost> {
  assertSafeCreate(input, now);
  const body = createBody(input);
  const id = await postPosts(transport, body);
  return { id, url: null, status: body.type === "draft" ? "draft" : "scheduled", scheduledAt: input.scheduledAt };
}

/**
 * Move an unpublished post to a new date. Postiz's public API has no change-date route; the
 * documented path is to re-POST the same create body with `value[0].id` (and the current `group`)
 * and `type: 'schedule'`. The repository upserts the row in place (same stable id, new group),
 * rewrites `publishDate`, `content`, `image`, and `settings` from the body, and the service
 * restarts the post's publish workflow (`workflowIdConflictPolicy: TERMINATE_EXISTING`), so the
 * old timer cannot fire. Because the body overwrites content and media, the caller must pass the
 * full original input from local state: the list endpoint does not return `image`.
 * Postiz refuses to reschedule an already-published post unless `republish` is sent; this adapter
 * never sends it.
 */
export async function reschedulePostizPost(transport: PostizTransport, existing: PostizExistingPost, input: PostizCreateInput, scheduledAt: string, now = new Date()): Promise<PostizPost> {
  const next = { ...input, scheduledAt, visibility: "scheduled" as const };
  assertSafeCreate(next, now);
  const id = await postPosts(transport, createBody(next, { id: requiredString(existing.id, "post id"), group: existing.group }, "schedule"));
  if (id !== existing.id) throw new Error(`Postiz reschedule returned a different stable id (${id} vs ${existing.id})`);
  return { id, url: null, status: "scheduled", scheduledAt };
}

/**
 * Edit content, media, or settings in place without restarting the publish workflow
 * (`type: 'update'`). The body still writes `publishDate`, so the date must be the post's current
 * date: a changed date here would move the row but leave the running timer on the old time. Any
 * date change goes through `reschedulePostizPost`.
 */
export async function updatePostizPost(transport: PostizTransport, existing: PostizExistingPost & { scheduledAt: string }, input: PostizCreateInput, now = new Date()): Promise<PostizPost> {
  if (Date.parse(input.scheduledAt) !== Date.parse(existing.scheduledAt)) throw new Error("Postiz update cannot change the date; use reschedulePostizPost");
  assertSafeCreate(input, now);
  const id = await postPosts(transport, createBody(input, { id: requiredString(existing.id, "post id"), group: existing.group }, "update"));
  if (id !== existing.id) throw new Error(`Postiz update returned a different stable id (${id} vs ${existing.id})`);
  return { id, url: null, status: input.visibility === "draft" ? "draft" : "scheduled", scheduledAt: input.scheduledAt };
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
