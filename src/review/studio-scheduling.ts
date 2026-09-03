import { basename, extname, join, isAbsolute, sep } from "node:path";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { appendBetPlacement, appendPublishLog, setStatus, type QueueRow } from "../publish/queue.js";
import { buildPosts, loadPlatformMax, publishText, TEXT_PLATFORMS } from "../publish/typefully.js";
import { loadCanonicalUrl, loadContentTypesConfig, loadCtaConfig, loadSourceKind, resolveCtaLines, resolvePrimaryCtaDestination } from "../publish/cta.js";
import { publishCards, isQuoteCardRow, cardTarget, basePlatform, cardCopy } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { publishSubstack, isSubstackRow } from "../publish/substack.js";
import { checkReuse } from "../publish/reuse-guard.js";
import { lockOutreachMessageRow } from "../outreach/lock.js";
import { assertProviderDispatch, resolveDeliveryIntent, resolveDeliveryPolicy, writeReadyToPaste, type DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { claimSlots, fmtLa, laDayKey, releaseClaims } from "../publish/slots.js";
import {
  createPostizPost,
  createPostizTransport,
  fetchPostizCapabilities,
  postizMediaUploadVerified,
  resolveConfiguredPostizCapability,
  selectDeliveryRoute,
  uploadPostizMedia,
  type PostizCreateInput,
  type DeliveryRoute,
  type PostizCapability,
  type PostizCapabilityRegistry,
  type PostizDestination,
  type PostizMedia,
  type PostizMediaRef,
  type PostizTransport,
} from "../publish/postiz.js";

// Approve → auto-schedule routing. Which platform scheduler an approved row belongs to. Each check
// calls the OWNING publisher's own exported predicate (isQuoteCardRow, isTikTokRow, isShortRow,
// TEXT_PLATFORMS) instead of re-encoding that publisher's row filter here a second time — so this
// can't silently drift out of sync if a publisher's own definition of "which rows are mine" changes:
//   text (x/linkedin/bluesky, incl. native-video posts) → Typefully (publishText)
//   quote-card / quote-card:<target>                     → cards.ts   (publishCards)
//   tiktok                                               → tiktok.ts  (publishTikTok → scheduleToTikTok)
//   YouTube Short (platform youtube OR format short)     → youtube.ts (publishShorts)
//   substack                                             → substack.ts (publishSubstack)
//   outreach-message (any channel)                       → outreach/lock.ts (lockOutreachMessageRow)
//     -- NOT a scheduler at all (CLAUDE.md rule 2 analog): Approve on this row kind means LOCK,
//     never send/schedule anything. Routed by FORMAT (fixed), not platform, since platform here is
//     the outreach channel (email/linkedin-dm/contact-form/podcast-pitch), not a real destination.
// Returns null for a row no scheduler owns — it just gets the plain approve status (CLAUDE.md rule 2
// is preserved: the row was already set to approve; scheduling only mirrors what /publish would do).
export type ScheduleKind = "text" | "card" | "tiktok" | "video" | "substack" | "outreach-lock" | "media";
export const isConfiguredMediaRow = (row: Pick<QueueRow, "format" | "asset">): boolean =>
  (row.format === "image" || row.format === "video") && /^(media-stages|configured-media)\//.test(row.asset);
export function scheduleKind(row: QueueRow): ScheduleKind | null {
  if (isQuoteCardRow(row.platform)) return "card";
  // Configured-media image/video rows (any destination, e.g. instagram/facebook, or a text-platform
  // destination like linkedin/x) — checked BEFORE the TEXT_PLATFORMS check below so a text-platform
  // destination doesn't misroute a configured image/video row to the text scheduler (which would try
  // to read the rendered asset file as markdown body text). Storyboard rows are excluded on purpose:
  // they aren't a postable asset yet (that's the video-script/render pipeline, not this dispatch).
  // Gated on the asset path (not just format) so this never swallows the separate, older
  // /video-pipeline row shape ({x|linkedin|bluesky, format: "video", asset: "video/short.mp4"} — a
  // genuine native-video Typefully post, see serve.test.ts's "qvid-x" rows) — only jobs.ts's
  // configured-media writer ever produces a media-stages/ or configured-media/ asset.
  // Also checked before tiktok/short: the PostPeer/YouTube legacy handlers read video/short.mp4, not
  // row.asset, so a configured tiktok/youtube video row must never fall back to them.
  if (isConfiguredMediaRow(row)) return "media";
  if (isTikTokRow(row.platform)) return "tiktok"; // checked before "video" — a tiktok row is also a short
  if (isShortRow(row.platform, row.format)) return "video";
  if (TEXT_PLATFORMS.has(row.platform)) return "text";
  if (isSubstackRow(row.platform)) return "substack";
  if (row.format === "outreach-message") return "outreach-lock";
  return null;
}

// The five folder-level publish functions the dispatch routes to. Injected (default = the real ones)
// so scheduleApproved is unit-testable WITHOUT any real PostPeer / Upload-Post / YouTube / browser call.
export interface SchedulerDeps {
  publishText: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishCards: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishTikTok: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishShorts: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishSubstack: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  lockOutreachMessage: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  /** Test/embedding seam; production always uses the persisted content-request origin. */
  resolveDeliveryPolicy?: typeof resolveDeliveryPolicy;
  fetchPostizRegistry?: () => Promise<PostizCapabilityRegistry>;
  publishPostiz?: (folder: string, row: QueueRow, capability: PostizCapability, policy: DeliveryPolicyDecision) => Promise<unknown>;
  postizEnv?: NodeJS.ProcessEnv;
}
const DEFAULT_SCHEDULER_DEPS: SchedulerDeps = {
  publishText,
  publishCards,
  publishTikTok,
  publishShorts,
  publishSubstack,
  lockOutreachMessage: lockOutreachMessageRow,
};

export interface SelectedSchedulingProvider {
  provider: Exclude<DeliveryRoute, "unsupported">;
  postizCapability?: PostizCapability;
}

function postizShape(row: QueueRow): { destination: PostizDestination; media: PostizMedia } | null {
  const destination = (isQuoteCardRow(row.platform) ? cardTarget(row.platform) ?? basePlatform(row.platform) : row.platform) as PostizDestination;
  if (!["x", "linkedin", "bluesky", "mastodon", "threads", "facebook", "instagram", "tiktok", "youtube", "substack"].includes(destination)) return null;
  const media: PostizMedia = row.format === "image" ? "image" : row.format === "video" || row.format === "short" ? "video" : "text";
  return { destination, media };
}

function legacyProvider(kind: ScheduleKind): SelectedSchedulingProvider {
  // "media" (configured-media image/video rows not owned by a quote-card/short/tiktok scheduler)
  // has no Typefully/PostPeer/YouTube fallback — Postiz is the only route, so an unconfigured
  // instance falls back to manual ready-to-paste, same as outreach-lock's non-schedulable rows.
  if (kind === "media") return { provider: "manual" as never };
  return { provider: kind === "text" || kind === "card" ? "typefully" : kind === "tiktok" ? "postpeer" : kind === "video" ? "youtube" : "substack" };
}

/** Discover configured Postiz support first; fallback is allowed only after an authoritative unsupported result. */
export async function selectConfiguredProvider(row: QueueRow, deps: Pick<SchedulerDeps, "fetchPostizRegistry" | "postizEnv"> = {}): Promise<SelectedSchedulingProvider> {
  const kind = scheduleKind(row);
  if (!kind || kind === "outreach-lock") return { provider: "manual" as never };
  const shape = postizShape(row);
  const env = deps.postizEnv ?? process.env;
  const configured = Boolean(deps.fetchPostizRegistry || (env.POSTIZ_BASE_URL?.trim() && env.POSTIZ_API_KEY?.trim()));
  if (!configured || !shape) return legacyProvider(kind);
  let registry: PostizCapabilityRegistry;
  try {
    registry = deps.fetchPostizRegistry
      ? await deps.fetchPostizRegistry()
      : await fetchPostizCapabilities(createPostizTransport(env), new Date(), { mediaUploadVerified: postizMediaUploadVerified(env) });
  } catch (error) {
    // A transport/config failure is not authoritative evidence that Postiz lacks the capability.
    // Fail closed so an ambiguous discovery result cannot silently bypass the Postiz-first route.
    throw new Error(`Postiz capability discovery failed; provider route is uncertain: ${error instanceof Error ? error.message : String(error)}`);
  }
  const requiresLocalMediaUpload = shape.media !== "text" && !/^https?:\/\//.test(row.asset);
  const route = selectDeliveryRoute(registry, shape.destination, shape.media, { requiresLocalMediaUpload });
  // "media" rows have no legacy Typefully/PostPeer/YouTube/Substack handler wired for them (the
  // dispatch table at the bottom of scheduleApproved has no "media" case), so any non-Postiz
  // outcome — including an incidental legacy-route match selectDeliveryRoute would offer a
  // text/card/video/substack kind — falls back to manual ready-to-paste instead of a route this
  // row's kind can't actually use.
  if (route === "unsupported") {
    if (kind === "media") return legacyProvider(kind);
    throw new Error(`no delivery provider supports ${shape.destination}/${shape.media}`);
  }
  if (route !== "postiz") return kind === "media" ? legacyProvider(kind) : { provider: route };
  return { provider: "postiz", postizCapability: resolveConfiguredPostizCapability(registry, shape.destination, shape.media, env) };
}

const MEDIA_MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4" };

/** Postiz's own per-channel limits (live `GET /integration-settings/:id`, 2026-09-02) for channels config/platforms.yaml does not cap. */
const POSTIZ_MAX_CHARS: Partial<Record<PostizDestination, number>> = { mastodon: 500, threads: 500, facebook: 63206, instagram: 2200, tiktok: 2000, youtube: 5000, x: 4000, linkedin: 3000, bluesky: 300 };

/**
 * Per-destination maximum images/media items Postiz will actually send in one post. Source: Postiz's
 * own provider code (github.com/gitroomhq/postiz-app, main branch, fetched 2026-09-02,
 * libraries/nestjs-libraries/src/integrations/social/<destination>.provider.ts) —
 *   x: `@Rules` decorator + handled API error both say "maximum of 4 items per post" (x.provider.ts)
 *   bluesky: `@Rules('Bluesky can have maximum 1 video or 4 pictures in one post')` (bluesky.provider.ts)
 *   instagram: carousel validation refuses fewer than 2 or more than 10 attachments (instagram.provider.ts)
 * facebook/linkedin/mastodon/threads enforce no client-side cap in Postiz's own provider code (it
 * forwards whatever array length it's given), so those four fall back to the platforms' own published
 * per-post attachment limits: facebook 10, linkedin 20, mastodon 4, threads 20.
 */
export const POSTIZ_MAX_IMAGES: Partial<Record<PostizDestination, number>> = {
  x: 4, bluesky: 4, instagram: 10, facebook: 10, linkedin: 20, mastodon: 4, threads: 20, tiktok: 35,
};
// tiktok: Postiz forwards photo posts to TikTok's Content Posting API, whose published limit is 35 images.

interface ConfiguredCarouselManifest {
  readonly version: string;
  readonly slides: readonly string[];
}

function readCarouselManifest(folder: string, manifestRelPath: string): ConfiguredCarouselManifest {
  const manifestAbs = isAbsolute(manifestRelPath) ? manifestRelPath : join(folder, manifestRelPath);
  if (!existsSync(manifestAbs)) throw new Error(`missing ${manifestAbs}; render it before scheduling`);
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(manifestAbs, "utf8")); }
  catch { throw new Error(`carousel manifest ${manifestAbs} is not valid JSON`); }
  const manifest = parsed as Partial<ConfiguredCarouselManifest> | null;
  if (!manifest || manifest.version !== "configured-carousel-v1") {
    throw new Error(`carousel manifest ${manifestAbs} has an unrecognized or missing version`);
  }
  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0 || !manifest.slides.every((s) => typeof s === "string" && s.trim())) {
    throw new Error(`carousel manifest ${manifestAbs} must list one or more non-empty slide paths`);
  }
  for (const slide of manifest.slides) {
    if (isAbsolute(slide) || slide.split(/[\\/]/).includes("..")) {
      throw new Error(`carousel manifest ${manifestAbs} references an unsafe slide path: ${slide}`);
    }
  }
  return { version: manifest.version, slides: manifest.slides };
}

/** Uploads every slide of a configured carousel, in order, refusing a manifest that exceeds the destination's cap. */
async function uploadCarouselMedia(folder: string, manifestRelPath: string, destination: PostizDestination, transport: PostizTransport): Promise<PostizMediaRef[]> {
  const { slides } = readCarouselManifest(folder, manifestRelPath);
  const cap = POSTIZ_MAX_IMAGES[destination];
  if (cap === undefined) throw new Error(`no carousel image cap is known for ${destination}; add it to POSTIZ_MAX_IMAGES before sending multi-image posts there`);
  if (slides.length > cap) {
    throw new Error(`carousel has ${slides.length} slides, more than ${destination} allows (max ${cap})`);
  }
  // Validate every slide (existence, containment, type) before the first upload so a bad manifest
  // never leaves orphaned media in Postiz's library (it has no public delete route).
  const root = realpathSync(folder);
  const files = slides.map((slide) => {
    const slideAbs = join(folder, slide);
    if (!existsSync(slideAbs)) throw new Error(`missing carousel slide ${slideAbs}; render it before scheduling`);
    if (!realpathSync(slideAbs).startsWith(root + sep)) throw new Error(`carousel slide ${slide} resolves outside the content folder`);
    const mime = MEDIA_MIME[extname(slideAbs).toLowerCase()];
    if (!mime || !mime.startsWith("image/")) throw new Error(`carousel slide ${slide} is not a supported image type`);
    return { slideAbs, mime };
  });
  const refs: PostizMediaRef[] = [];
  for (const { slideAbs, mime } of files) {
    refs.push(await uploadPostizMedia(transport, { bytes: new Uint8Array(readFileSync(slideAbs)), filename: basename(slideAbs), mime }));
  }
  return refs;
}

/**
 * The caption for a non-quote-card configured-media row (single image, carousel, or video) — the
 * verbatim body of derivatives/<row.id>.md, same file jobs.ts writes for every configured variant
 * (CLAUDE.md rule 1: extraction-first, never composed here). Quote-card rows keep cardCopy instead
 * (see planPostizDispatch) because their caption is a distinct per-platform context derivative, not
 * this one.
 */
function derivativeCaption(folder: string, rowId: string): { text: string; fm: Record<string, unknown> } {
  const path = join(folder, "derivatives", `${rowId}.md`);
  if (!existsSync(path)) {
    throw new Error(`missing derivative ${path}; every configured media row needs derivatives/<id>.md for its caption`);
  }
  const { fm, body } = splitFrontmatter(readFileSync(path, "utf8"));
  const text = body.trim();
  if (!text) throw new Error(`derivative ${path} has no caption text in its body`);
  return { text, fm };
}

export interface PostizDispatchPlan {
  input: PostizCreateInput;
  fm: Record<string, unknown>;
  body: string;
  ctaDestination: string | null;
  placement: string;
  ctaCount: number;
}

/**
 * Place the derivative's CTA line(s) exactly as the Typefully path does (`buildPosts`, cta.yaml
 * placement): inline appends to the body, reply/comment become follow-up `value[]` entries, which
 * Postiz posts as thread replies or, on LinkedIn, as the first comment.
 */
function placeCtas(folder: string, destination: PostizDestination, fm: Record<string, unknown>, body: string): { content: string; followUps: string[]; ctaDestination: string | null; placement: string; ctaCount: number } {
  const cfg = loadCtaConfig();
  const ctCfg = loadContentTypesConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const sourceKind = loadSourceKind(folder);
  const { ctas } = resolveCtaLines(fm, canonicalUrl, cfg, sourceKind, ctCfg);
  const placement = cfg.placement[destination] ?? "inline";
  const max = loadPlatformMax()[destination] ?? POSTIZ_MAX_CHARS[destination] ?? Infinity;
  const { posts, manualComment } = buildPosts(body, ctas, placement, max);
  const followUps = [...posts.slice(1).map((p) => p.text), ...(manualComment ? [manualComment] : [])];
  const ctaDestination = resolvePrimaryCtaDestination(fm, canonicalUrl, cfg, sourceKind, ctCfg);
  return { content: posts[0]?.text ?? body, followUps, ctaDestination: ctaDestination === null ? null : String(ctaDestination), placement, ctaCount: ctas.length };
}

/**
 * Build the exact Postiz body for a queue row from local state: text rows send the derivative body,
 * quote cards send the card caption plus the rendered PNG, video rows send the rendered mp4 with the
 * title from `video/title.txt`. Text and card rows carry the source CTA placed per cta.yaml.
 * Rebuilt the same way for a reschedule, because Postiz's in-place save overwrites content and
 * media and its list endpoint returns neither.
 */
export async function buildPostizInput(folder: string, row: QueueRow, accountId: string, scheduledAt: string, transport: PostizTransport): Promise<PostizCreateInput> {
  return (await planPostizDispatch(folder, row, accountId, scheduledAt, transport)).input;
}

export async function planPostizDispatch(folder: string, row: QueueRow, accountId: string, scheduledAt: string, transport: PostizTransport): Promise<PostizDispatchPlan> {
  const shape = postizShape(row);
  if (!shape) throw new Error(`Postiz does not recognize destination/media for ${row.id}`);
  const base = { destination: shape.destination, accountId, scheduledAt, visibility: "scheduled" as const };
  if (shape.media === "text") {
    const raw = readFileSync(join(folder, row.asset), "utf8");
    const { fm, body } = row.asset.endsWith(".md") ? splitFrontmatter(raw) : { fm: {}, body: raw };
    const text = body.trim();
    if (!text) throw new Error(`derivative ${row.asset} has no body text`);
    const placed = placeCtas(folder, shape.destination, fm, text);
    return { input: { ...base, content: placed.content, ...(placed.followUps.length ? { followUps: placed.followUps } : {}) }, fm, body: text, ctaDestination: placed.ctaDestination, placement: placed.placement, ctaCount: placed.ctaCount };
  }
  if (/^https?:\/\//.test(row.asset)) throw new Error("Postiz media must be a rendered local file; remote URLs are not registered");
  const isCard = isQuoteCardRow(row.platform);
  if (shape.media === "image") {
    // Quote cards keep their own per-platform context caption (cardCopy); every other configured
    // image row (single or carousel) is captioned from its own derivative markdown, never composed
    // here (CLAUDE.md rule 1). Resolved BEFORE any upload so a caption failure leaves no orphaned media.
    const { text, fm } = isCard ? cardCopy(folder, row.id) : derivativeCaption(folder, row.id);
    const placed = placeCtas(folder, shape.destination, fm, text);
    const media = row.asset.endsWith("carousel-manifest.json")
      ? await uploadCarouselMedia(folder, row.asset, shape.destination, transport)
      : [await uploadSingleMedia(folder, row.asset, transport)];
    return { input: { ...base, content: placed.content, media, ...(placed.followUps.length ? { followUps: placed.followUps } : {}) }, fm, body: text, ctaDestination: placed.ctaDestination, placement: placed.placement, ctaCount: placed.ctaCount };
  }
  const titlePath = join(folder, "video", "title.txt");
  const legacyTitle = existsSync(titlePath) ? readFileSync(titlePath, "utf8").trim() : "";
  if (!isCard) {
    // Same rule as the image branch: a non-card configured video row is captioned from its own
    // derivative, run through the same CTA placement as text/image rows. video/title.txt still
    // wins when present (the storyboard/shorts pipeline writes it); otherwise the title is the
    // derivative's first non-empty line (derivativeCaption already refuses an empty body).
    const { text, fm } = derivativeCaption(folder, row.id);
    const placed = placeCtas(folder, shape.destination, fm, text);
    const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    const title = legacyTitle || firstLine;
    const media = [await uploadSingleMedia(folder, row.asset, transport)]; // after caption/title resolution: no orphaned upload on failure
    const out = { input: { ...base, content: placed.content, media, ...(placed.followUps.length ? { followUps: placed.followUps } : {}) }, fm, body: text, ctaDestination: placed.ctaDestination, placement: placed.placement, ctaCount: placed.ctaCount };
    if (shape.destination === "youtube") {
      if (!title) throw new Error("YouTube via Postiz needs video/title.txt or a derivative body for a title");
      return { ...out, input: { ...out.input, providerSettings: { title: /#shorts/i.test(title) ? title : `${title} #Shorts`, type: "public" } } };
    }
    if (shape.destination === "tiktok") return { ...out, input: { ...out.input, providerSettings: { title: title.slice(0, 90) } } };
    return out;
  }
  const media = [await uploadSingleMedia(folder, row.asset, transport)];
  // Quote-card (animated) video rows: unchanged legacy behavior — captioned from video/title.txt +
  // video/description.txt (or row.notes), no source CTA (the card image itself carries the quote).
  const descPath = join(folder, "video", "description.txt");
  const description = existsSync(descPath) ? readFileSync(descPath, "utf8").trim() : row.notes.trim();
  const video = { fm: {}, body: description || legacyTitle, ctaDestination: null, placement: "none", ctaCount: 0 };
  if (shape.destination === "youtube") {
    if (!legacyTitle) throw new Error("YouTube via Postiz needs video/title.txt");
    return { ...video, input: { ...base, content: description || legacyTitle, media, providerSettings: { title: /#shorts/i.test(legacyTitle) ? legacyTitle : `${legacyTitle} #Shorts`, type: "public" } } };
  }
  if (shape.destination === "tiktok") return { ...video, input: { ...base, content: description || legacyTitle || row.id, media, providerSettings: { title: (legacyTitle || description).slice(0, 90) } } };
  return { ...video, input: { ...base, content: description || legacyTitle || row.id, media } };
}

async function uploadSingleMedia(folder: string, assetRelPath: string, transport: PostizTransport): Promise<PostizMediaRef> {
  const mediaPath = isAbsolute(assetRelPath) ? assetRelPath : join(folder, assetRelPath);
  if (!existsSync(mediaPath)) throw new Error(`missing ${mediaPath}; render it before scheduling`);
  const mime = MEDIA_MIME[extname(mediaPath).toLowerCase()];
  if (!mime) throw new Error(`Postiz cannot upload ${extname(mediaPath) || "an extensionless file"}`);
  return uploadPostizMedia(transport, { bytes: new Uint8Array(readFileSync(mediaPath)), filename: basename(mediaPath), mime });
}

export async function defaultPublishPostiz(folder: string, row: QueueRow, capability: PostizCapability, policy: DeliveryPolicyDecision, transportFactory: () => PostizTransport = createPostizTransport): Promise<unknown> {
  assertProviderDispatch(folder, "postiz", policy);
  const shape = postizShape(row);
  if (!shape) throw new Error(`Postiz does not recognize destination/media for ${row.id}`);
  const { times, labels } = claimSlots({ windowKey: shape.destination, conflictPlatforms: [shape.destination], count: 1, asset: row.asset, by: "postiz" });
  if (!times[0] || times[0] === "next-free-slot") throw new Error(`Postiz requires an explicit future slot for ${shape.destination}`);
  const transport: PostizTransport = transportFactory();
  let plan: Awaited<ReturnType<typeof planPostizDispatch>>;
  let post: Awaited<ReturnType<typeof createPostizPost>>;
  try {
    plan = await planPostizDispatch(folder, row, capability.accountId, times[0], transport);
    post = await createPostizPost(transport, plan.input);
  } catch (error) {
    // The slot was claimed before the provider call. A failed create (rate limit, validation,
    // transport) must give it back, or every retry walks the calendar forward and leaves orphans.
    releaseClaims([{ platform: shape.destination, day: laDayKey(new Date(times[0])), time: times[0], asset: row.asset, by: "postiz" }]);
    throw error;
  }
  // Same bookkeeping as the Typefully/cards publishers: queue status, publish log, and the bets
  // Placed row (CTA destination included) so grading and tag-source see this placement.
  setStatus(folder, row, "published");
  const placeNote = plan.ctaCount > 0 ? `, cta→${plan.placement}` : "";
  appendPublishLog(folder, `${row.id} → postiz post ${post.id} (${shape.destination}, ${labels[0]}${placeNote})`);
  appendBetPlacement(folder, row.id, shape.destination, `postiz post ${post.id} @ ${labels[0]}`, plan.fm, plan.body, plan.ctaDestination);
  return {
    id: row.id, platform: shape.destination, when: labels[0], ref: post.id,
    providerObjectId: post.id, providerAccountId: capability.accountId,
    canonicalUrl: post.url ?? undefined, plannedFor: post.scheduledAt ?? times[0],
    providerCreatedAt: post.createdAt ?? undefined, providerUpdatedAt: post.updatedAt ?? undefined,
    providerPublishedAt: post.publishedAt ?? undefined, status: post.status, policyVersion: policy.policyVersion,
  };
}

// Schedule ONE approved row via its platform's existing publish function (scoped by onlyIds),
// mirroring the text path exactly: on success the row's scheduled info comes back; on failure a
// scheduleError is RETURNED (never thrown) so the row stays `approve` and the GUI shows why instead
// of silently losing the approval or crashing the request.
//
// Mirrors the platform key each publisher's own reuse-guard call site derives from a row (cards.ts:
// cardTarget/basePlatform; typefully.ts: the row's own platform; tiktok.ts/youtube.ts/substack.ts: a
// fixed platform name) — so scheduleApproved (below) can recompute the SAME checkReuse() call a
// silently-skipping publisher already made, and recover its real reason instead of a generic one.
// null for a kind the reuse guard never gates (outreach-lock).
function reuseGuardPlatform(kind: ScheduleKind, row: QueueRow): string | null {
  switch (kind) {
    case "text": return row.platform;
    case "card": return cardTarget(row.platform) ?? basePlatform(row.platform);
    case "tiktok": return "tiktok";
    case "video": return "youtube";
    case "substack": return "substack";
    default: return null;
  }
}

// A publisher can also skip a row WITHOUT throwing (the reuse guard) — it just logs a console.warn
// and returns []. That must still surface as a scheduleError, not fall through silently: `done[0]
// ?? null` alone can't tell "no scheduler owns this row" (kind === null, a genuine no-op) apart
// from "a scheduler ran but skipped this row" (kind set, done === []) — and the GUI showed a bare
// "Approved" for both.
export async function scheduleApproved(
  folder: string,
  row: QueueRow,
  deps: SchedulerDeps = DEFAULT_SCHEDULER_DEPS,
  policyDecision?: DeliveryPolicyDecision,
): Promise<{ scheduled: unknown; scheduleError: string | null }> {
  const kind = scheduleKind(row);
  if (!kind) return { scheduled: null, scheduleError: null };
  // Outreach approval locks a message and never contacts a publishing provider.
  let selected: SelectedSchedulingProvider | undefined;
  if (kind !== "outreach-lock") {
    // Blocked/manual origin policy is provider-independent and must run before any capability
    // discovery. Besides being faster, this guarantees those origins make zero network calls.
    // Use the legacy route only as a provisional provider name; provider-authorized origins are
    // resolved again below after the actual Postiz-first route is known.
    const provisionalProvider = legacyProvider(kind).provider;
    const provisionalPolicy = policyDecision
      ?? (deps.resolveDeliveryPolicy
        ? deps.resolveDeliveryPolicy(folder, provisionalProvider)
        : resolveDeliveryIntent(folder, provisionalProvider));
    if (provisionalPolicy.mode === "blocked") {
      return { scheduled: null, scheduleError: `delivery policy blocked: ${provisionalPolicy.reason}` };
    }
    if (provisionalPolicy.mode === "manual") {
      return { scheduled: writeReadyToPaste(folder, row, provisionalPolicy), scheduleError: null };
    }
    // Injected scheduler dependencies are a hermetic test/embedding seam. They opt into Postiz
    // only by supplying an explicit registry or env; ambient credentials must not trigger network.
    const providerDeps = deps === DEFAULT_SCHEDULER_DEPS || deps.fetchPostizRegistry || deps.postizEnv
      ? deps
      : { ...deps, postizEnv: {} };
    try {
      selected = policyDecision?.provider === "postiz"
        ? await selectConfiguredProvider(row, providerDeps)
        : policyDecision ? { provider: policyDecision.provider as SelectedSchedulingProvider["provider"] } : await selectConfiguredProvider(row, providerDeps);
    }
    catch (e) { return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) }; }
    const provider = selected.provider;
    const policy = policyDecision ?? (deps.resolveDeliveryPolicy && provider === provisionalProvider
      ? provisionalPolicy
      : (deps.resolveDeliveryPolicy ?? resolveDeliveryPolicy)(folder, provider));
    if (policy.mode === "blocked") return { scheduled: null, scheduleError: `delivery policy blocked: ${policy.reason}` };
    if (policy.mode === "manual") return { scheduled: writeReadyToPaste(folder, row, policy), scheduleError: null };
    if (!policy.providerAccountId) return { scheduled: null, scheduleError: "delivery policy blocked: provider account mapping is missing" };
    if (provider === "postiz") {
      const capability = selected.postizCapability;
      if (!capability) return { scheduled: null, scheduleError: "configured Postiz capability was not retained for scheduling" };
      try {
        return { scheduled: await (deps.publishPostiz ?? defaultPublishPostiz)(folder, row, capability, policy), scheduleError: null };
      } catch (e) { return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) }; }
    }
    // "media" rows have no legacy publisher below (no Typefully/PostPeer/YouTube/Substack handler
    // knows this row shape) — every non-"postiz"/"manual"/"blocked" outcome above is a caller
    // error (e.g. an explicit policyDecision naming a legacy provider this kind can't use).
    if (kind === "media") return { scheduled: null, scheduleError: `delivery policy resolved ${provider} for a media row, but media rows are Postiz-only` };
  }
  const fn =
    kind === "text" ? deps.publishText
    : kind === "card" ? deps.publishCards
    : kind === "tiktok" ? deps.publishTikTok
    : kind === "substack" ? deps.publishSubstack
    : kind === "outreach-lock" ? deps.lockOutreachMessage
    : deps.publishShorts;
  try {
    const done = await fn(folder, { onlyIds: [row.id], ...(policyDecision ? { deliveryPolicy: policyDecision } : {}) });
    if (done.length === 0) {
      // The publisher didn't throw, so recompute the check it silently skipped on to find out WHY —
      // when it's the reuse guard, persist a machine-parseable reason (reconcile.ts's
      // reuseGuardEligibility below re-derives "eligible again in N days" from this same shape,
      // reading it back off the row's own notes, days later, with no fs/network call of its own).
      const platform = reuseGuardPlatform(kind, row);
      const reuse = platform ? checkReuse(basename(folder), platform) : { allowed: true };
      if (!reuse.allowed && reuse.lastPlacedAt !== undefined && reuse.minDays !== undefined) {
        return {
          scheduled: null,
          scheduleError: `blocked by reuse guard, last placed to ${platform} ${reuse.lastPlacedAt} (min_reuse_days: ${reuse.minDays})`,
        };
      }
      return {
        scheduled: null,
        scheduleError: "not scheduled: blocked by the reuse guard (check the server log for the reason)",
      };
    }
    return { scheduled: done[0], scheduleError: null };
  } catch (e) {
    return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
  }
}
