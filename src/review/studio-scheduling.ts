import { basename, extname, join, isAbsolute, sep } from "node:path";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { appendBetPlacement, appendPublishLog, setStatus, type QueueRow } from "../publish/queue.js";
import { buildPosts, loadPlatformMax, publishText, TEXT_PLATFORMS } from "../publish/typefully.js";
import { loadCanonicalUrl, loadContentTypesConfig, loadCtaConfig, loadSourceKind, resolveCtaLines, resolvePrimaryCtaDestination } from "../publish/cta.js";
import { publishCards, isQuoteCardRow, cardTarget, basePlatform, cardCopy, isConfiguredMediaAsset, mediaFallbackTarget } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { publishSubstack, isSubstackRow } from "../publish/substack.js";
import { checkReuseForRow } from "../publish/reuse-guard.js";
import { lockOutreachMessageRow } from "../outreach/lock.js";
import { assertProviderDispatch, resolveDeliveryIntent, resolveDeliveryPolicy, writeReadyToPaste, type DeliveryBrand, type DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { claimSlots, fmtLa, laDayKey, releaseClaims } from "../publish/slots.js";
import {
  createPostizPost,
  createPostizTransport,
  fetchPostizCapabilities,
  postizMediaUploadVerified,
  PostizRateLimitError,
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
/** `unscheduled-draft` is an explicit Typefully-only intent, never a fallback scheduling route. */
export type DispatchMode = "scheduled" | "unscheduled-draft";
export const isConfiguredMediaRow = (row: Pick<QueueRow, "format" | "asset">): boolean =>
  (row.format === "image" || row.format === "video") && isConfiguredMediaAsset(row.asset);
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
  publishText: (folder: string, opts: {
    onlyIds?: string[];
    noSchedule?: boolean;
    /** This adapter defers completion so publishing-status can persist the provider id first. */
    deferNoScheduleCompletion?: boolean;
    deliveryPolicy?: DeliveryPolicyDecision;
  }) => Promise<unknown[]>;
  publishCards: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishTikTok: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishShorts: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishSubstack: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  lockOutreachMessage: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  /** Test/embedding seam; production always uses the persisted content-request origin. */
  resolveDeliveryPolicy?: typeof resolveDeliveryPolicy;
  fetchPostizRegistry?: () => Promise<PostizCapabilityRegistry>;
  /** `earliestAt` is the reuse guard's spacing floor for a deferred row: the slot claim must land
   *  at or after it. Absent means no floor, today's behavior. */
  publishPostiz?: (folder: string, row: QueueRow, capability: PostizCapability, policy: DeliveryPolicyDecision, earliestAt?: string) => Promise<unknown>;
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

/**
 * Postiz stays the FIRST choice for every kind. This names the route to use when Postiz is not an
 * option at all — either it is unconfigured, or discovery authoritatively said it cannot take this
 * destination/media shape.
 *
 * For "media" (configured-media image/video rows not owned by a quote-card/short/tiktok scheduler)
 * the backup is Typefully, but only for the rows Typefully can actually take: a rendered single
 * image on x/linkedin/bluesky (cards.ts's mediaFallbackTarget). Everything else — a video row, a
 * carousel, instagram/threads/tiktok/facebook/mastodon/youtube — keeps the manual ready-to-paste
 * path it has today, same as outreach-lock's non-schedulable rows.
 */
function legacyProvider(kind: ScheduleKind, row?: QueueRow): SelectedSchedulingProvider {
  if (kind === "media") {
    return row && mediaFallbackTarget(row) ? { provider: "typefully" } : { provider: "manual" as never };
  }
  return { provider: kind === "text" || kind === "card" ? "typefully" : kind === "tiktok" ? "postpeer" : kind === "video" ? "youtube" : "substack" };
}

/**
 * SLICE-7B. What Muxin is told when discovery is authoritative and does not list the channel.
 *
 * A text row used to be handed to Typefully in exactly this case, so an x row landed on a
 * different provider than its bluesky and threads siblings, with no planned time, no ledger
 * signal and no message. Discovery already knows the real reason, so say it and say the fix.
 */
function postizChannelNotConnected(destination: PostizDestination): string {
  return `Postiz does not have ${destination} connected, so this row has nowhere to go. Connect ${destination} in Postiz, add its account id to POSTIZ_ACCOUNT_IDS, then approve the row again.`;
}

/** Discover configured Postiz support first; fallback is allowed only after an authoritative unsupported result. */
export async function selectConfiguredProvider(row: QueueRow, deps: Pick<SchedulerDeps, "fetchPostizRegistry" | "postizEnv"> = {}): Promise<SelectedSchedulingProvider> {
  const kind = scheduleKind(row);
  if (!kind || kind === "outreach-lock") return { provider: "manual" as never };
  const shape = postizShape(row);
  const env = deps.postizEnv ?? process.env;
  const baseUrl = env.POSTIZ_BASE_URL?.trim();
  const apiKey = env.POSTIZ_API_KEY?.trim();
  // SLICE-7B. Neither variable set is a deployment CHOICE: this repo still has to run with no
  // Postiz at all, so legacy routing below is untouched for that case. Exactly one of them set is
  // a broken configuration, not a choice, and it used to look identical to "no Postiz" and send
  // the row quietly to Typefully. Name the variable to fix instead. Only the names appear here,
  // never a value.
  if (!deps.fetchPostizRegistry && Boolean(baseUrl) !== Boolean(apiKey)) {
    const present = baseUrl ? "POSTIZ_BASE_URL" : "POSTIZ_API_KEY";
    const missing = baseUrl ? "POSTIZ_API_KEY" : "POSTIZ_BASE_URL";
    throw new Error(`Postiz is only half configured: ${present} is set but ${missing} is not. Set ${missing} to schedule through Postiz, or clear ${present} to schedule without it.`);
  }
  const configured = Boolean(deps.fetchPostizRegistry || (baseUrl && apiKey));
  // Trigger 1 of 3 for the media backup route: Postiz is not configured at all, so nothing was
  // ever sent to it and a second route cannot double-post.
  if (!configured || !shape) return legacyProvider(kind, row);
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
  // Trigger 2 of 3: discovery is authoritative and says Postiz cannot take this destination/media
  // shape. No create was attempted, so the backup route cannot double-post. A "media" row still
  // only ever reaches Typefully through legacyProvider's own eligibility test — an incidental
  // postpeer/youtube/substack route selectDeliveryRoute would offer another kind is not a handler
  // this row shape can use, so those keep the manual ready-to-paste path.
  if (route === "unsupported") {
    if (kind === "media") return legacyProvider(kind, row);
    if (shape.media === "text") throw new Error(postizChannelNotConnected(shape.destination));
    throw new Error(`no delivery provider supports ${shape.destination}/${shape.media}`);
  }
  if (route !== "postiz") return kind === "media" ? legacyProvider(kind, row) : { provider: route };
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

export async function defaultPublishPostiz(
  folder: string,
  row: QueueRow,
  capability: PostizCapability,
  policy: DeliveryPolicyDecision,
  transportFactory: () => PostizTransport = createPostizTransport,
  // The reuse guard's spacing floor for a deferred row. Handed to the SAME unified scheduler every
  // other claim goes through, as its `now`, so the first free slot it returns is already past the
  // variant window. There is deliberately no second slot-picking implementation here: cadence,
  // per-day caps and the shared ledger stay entirely slots.ts's job.
  earliestAt?: string,
): Promise<unknown> {
  assertProviderDispatch(folder, "postiz", policy);
  const shape = postizShape(row);
  if (!shape) throw new Error(`Postiz does not recognize destination/media for ${row.id}`);
  const floorMs = earliestAt ? Date.parse(earliestAt) : NaN;
  if (earliestAt && Number.isNaN(floorMs)) throw new Error(`the reuse guard handed back an unreadable spacing date for ${row.id}: ${earliestAt}`);
  const { times, labels } = claimSlots({
    windowKey: shape.destination, conflictPlatforms: [shape.destination], count: 1, asset: row.asset, by: "postiz",
    ...(earliestAt ? { now: new Date(Math.max(Date.now(), floorMs)) } : {}),
  });
  // Fails closed for a deferral too: "next-free-slot" means the provider would pick the time, which
  // is exactly the spacing this row was deferred to get. No slot means say so, never report a
  // schedule that was not achieved.
  if (!times[0] || times[0] === "next-free-slot") {
    throw new Error(earliestAt
      ? `could not place ${row.id}, no free ${shape.destination} slot on or after ${fmtLa(new Date(floorMs))}`
      : `Postiz requires an explicit future slot for ${shape.destination}`);
  }
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
  // Plain spacing note for a deferred row, so the Studio result and the folder's own publish log
  // both say why this one landed a week out instead of tomorrow.
  const spacingNote = earliestAt
    ? `Spaced from an earlier post from this piece on ${shape.destination}. First free slot past the spacing window is ${labels[0]}.`
    : undefined;
  appendPublishLog(folder, `${row.id} → postiz post ${post.id} (${shape.destination}, ${labels[0]}${placeNote})${spacingNote ? ` ${spacingNote}` : ""}`);
  appendBetPlacement(folder, row.id, shape.destination, `postiz post ${post.id} @ ${labels[0]}`, plan.fm, plan.body, plan.ctaDestination);
  return {
    ...(spacingNote ? { spacingNote } : {}),
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
    // A media row on the Typefully backup route goes through publishCards, whose reuse-guard call
    // site keys on the destination platform — which for a configured-media row is row.platform.
    case "media": return row.platform;
    case "tiktok": return "tiktok";
    case "video": return "youtube";
    case "substack": return "substack";
    default: return null;
  }
}

/** Wording for a guard skip whose reason this process cannot re-derive (no keyed platform, or the
 *  guard now answers "allowed" — i.e. the publisher skipped the row for some other reason). */
const REUSE_GUARD_UNSPECIFIED = "not scheduled: blocked by the reuse guard (check the server log for the reason)";

/**
 * The reuse guard's verdict for ONE row: allowed, refused outright, or deferred to a date.
 *
 * One function serves both callers on purpose: the Postiz PRE-FLIGHT in scheduleApproved (which must
 * decide before anything is claimed or created) and runPublisher's after-the-fact recovery (which
 * explains a publisher that already skipped silently). Keying and wording therefore cannot drift
 * into two versions, and the Content page reads one message however the refusal was reached.
 *
 * `deferred` is the different-derivative case: same slug, same platform, a DIFFERENT row inside
 * `min_variant_days`. It is not a refusal, it is a date. Only the pre-flight can act on it (it owns
 * the slot claim); the recovery branch turns it into an honest "not scheduled" message, because by
 * then the publisher has already declined.
 */
type GuardVerdict =
  | { kind: "allowed" }
  | { kind: "refused"; message: string }
  | { kind: "deferred"; platform: string; earliestAt: string; lastPlacedAt: string; minVariantDays: number };

function reuseGuardVerdict(folder: string, kind: ScheduleKind, row: QueueRow, brand: DeliveryBrand | null): GuardVerdict {
  const platform = reuseGuardPlatform(kind, row);
  if (!platform) return { kind: "allowed" };
  // The brand comes from the delivery policy decision already in scope at both call sites, never
  // from the guard's own `human-inference` default: reading Charles's rows against Human
  // Inference's Placed log is the silent-substitution bug this parameter exists to close. A
  // decision that resolved no brand fails CLOSED rather than falling back — every route that
  // reaches the guard has already passed the policy's provider/account checks, so a null here is a
  // caller bug, not a Muxin path.
  if (!brand) return { kind: "refused", message: "not scheduled: the delivery policy resolved no brand, so the reuse guard has no Placed log to check" };
  // row.id is what splits the two windows: the same row again keeps min_reuse_days and is refused,
  // a different derivative of the same piece gets min_variant_days and is spaced.
  const reuse = checkReuseForRow(basename(folder), platform, { rowId: row.id, brandId: brand });
  if (reuse.allowed) return { kind: "allowed" };
  if (reuse.deferrable && reuse.earliestAllowedAt && reuse.lastPlacedAt && reuse.minVariantDays !== undefined) {
    return { kind: "deferred", platform, earliestAt: reuse.earliestAllowedAt, lastPlacedAt: reuse.lastPlacedAt, minVariantDays: reuse.minVariantDays };
  }
  // Machine-parseable shape: reconcile.ts's reuseGuardEligibility re-derives "eligible again in N
  // days" from this exact string, read back off the row's own notes days later with no fs/network
  // call of its own. Do not reword it without updating that reader.
  return {
    kind: "refused",
    message: reuse.lastPlacedAt !== undefined && reuse.minDays !== undefined
      ? `blocked by reuse guard, last placed to ${platform} ${reuse.lastPlacedAt} (min_reuse_days: ${reuse.minDays})`
      : REUSE_GUARD_UNSPECIFIED,
  };
}

function reuseGuardBlock(folder: string, kind: ScheduleKind, row: QueueRow, brand: DeliveryBrand | null): string | null {
  const verdict = reuseGuardVerdict(folder, kind, row, brand);
  if (verdict.kind === "allowed") return null;
  if (verdict.kind === "refused") return verdict.message;
  // Reached only from the recovery branch, and only for a publisher that does not yet understand
  // deferral (it returned [] rather than spacing the post itself). Reporting the real reason beats
  // the generic wording, and it never claims a schedule that did not happen.
  return `not scheduled: another post from this piece already went to ${verdict.platform} on ${verdict.lastPlacedAt}. This one can go out from ${verdict.earliestAt} (min_variant_days: ${verdict.minVariantDays})`;
}

export type ScheduleOutcome = {
  scheduled: unknown;
  scheduleError: string | null;
  /**
   * SLICE-7A. Why this attempt failed, as a typed discriminant rather than message text. It says
   * what is PROVEN about provider state, never merely that the reuse guard spoke.
   *
   * `"no-provider-request"` — provably ahead of every call that could create, schedule or modify a
   *   provider object, and ahead of every slot claim: no publisher invoked, no create sent.
   *   Read-only capability discovery may already have run, the same boundary
   *   `publishing-status.ts` already calls "no provider request was made" for a failure during
   *   provider selection. Effect: ledger `blocked`, and the durable dispatch fence resolves
   *   `not-created`.
   *
   * `"publisher-declined"` — the reuse guard is the reason, but the publisher was ALREADY invoked
   *   and returned nothing. Provider state is NOT proven: an empty result is not evidence that no
   *   object was created. Effect: ledger `blocked`, and the fence is RETAINED. This value must
   *   never reach `resolveDispatchFence`. `blocked` is deliberately resolve-ineligible, so no
   *   human can clear the fence and re-run a publisher that may already hold an object.
   *
   * Absent is the safe default and must stay that way: `uncertain`, fence retained.
   */
  refusal?: "no-provider-request" | "publisher-declined";
};
type FolderPublisher = (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;

/**
 * A Postiz create failure is only safe to retry on a second route when it is unambiguous that
 * NOTHING was created. The rate-limit rejection is the one such outcome: Postiz's throttler guard
 * (90 creates/hour, instance-wide) runs before the create controller, so the post never reached it.
 * Everything else — a validation 400, a 5xx, a socket hang-up after the request left — may or may
 * not have created the draft, and re-sending it elsewhere is how one approved row ships twice.
 *
 * ONLY the typed error counts. Message text is not evidence of provenance: an error raised anywhere
 * else that merely quotes recognized rate-limit wording would otherwise authorize a second provider
 * for a create that may already have succeeded. This runs inside scheduleApproved's own catch, on
 * the raw error `deps.publishPostiz` threw, so the type is still intact here — nothing has been
 * flattened to a string yet. If a future path genuinely loses the type before this point, restore a
 * structured marker on the error rather than widening this test back to string matching.
 */
function isPostizNothingCreated(error: unknown): boolean {
  return error instanceof PostizRateLimitError;
}

// Run one folder publisher for a single row, turning a silent reuse-guard skip into a real
// scheduleError. A publisher can skip a row WITHOUT throwing (the reuse guard) — it just logs a
// console.warn
// and returns []. That must still surface as a scheduleError, not fall through silently: `done[0]
// ?? null` alone can't tell "no scheduler owns this row" (kind === null, a genuine no-op) apart
// from "a scheduler ran but skipped this row" (kind set, done === []) — and the GUI showed a bare
// "Approved" for both.
async function runPublisher(
  fn: FolderPublisher,
  folder: string,
  row: QueueRow,
  kind: ScheduleKind,
  // The identity the recovery guard reads placements under. Kept SEPARATE from `deliveryPolicy`,
  // which is the publisher's authorization: at the non-Postiz tail below `deliveryPolicy` is the
  // caller's optional override while the resolved policy — the one that actually named the brand —
  // is a different value. Reading the brand off the override would drop it whenever no override
  // was supplied, which is the common case.
  brand: DeliveryBrand | null,
  deliveryPolicy?: DeliveryPolicyDecision,
): Promise<ScheduleOutcome> {
  // SLICE-7C PRE-FLIGHT reuse guard, the non-Postiz twin of the one in scheduleApproved below, and
  // the reason every route can now make the same claim. It sits OUTSIDE the try on purpose, ahead
  // of the only call in this function that can reach a provider: `fn` is the folder publisher, and
  // nothing before it creates, schedules or modifies a provider object or claims a slot. So a
  // refusal here is provably ahead of every one of those, exactly as the Postiz pre-flight is, and
  // carries the same typed no-provider-request signal.
  //
  // A DEFERRED verdict is not a refusal and deliberately does nothing here: these publishers own
  // their own spacing, so control falls through unchanged and no earliest-allowed floor is handed
  // to them. The recovery branch below still turns their silent skip into an honest message.
  //
  // Scope of "ahead of every provider call": it is ahead of every call on THE ROUTE THIS PRE-FLIGHT
  // GUARDS, which is the route `fn` names. One compound path reaches here with an earlier attempt
  // already behind it: a media row whose Postiz pre-flight allowed, whose create then failed with
  // PostizRateLimitError, and which took SLICE-5J's Typefully backup into scheduleMediaViaTypefully
  // and so into this function. On that path Postiz was contacted and defaultPublishPostiz did claim
  // a slot before releasing it. A refusal here is still truthfully no-provider-request for the whole
  // attempt, but the reason is the backup's own entry condition rather than anything this line
  // knows: isPostizNothingCreated admits ONLY the typed rate-limit rejection, whose throttler runs
  // ahead of Postiz's create controller, and the claim was released on the way out. So nothing was
  // created, no slot is held, and `fn` has not run. Widen that entry condition and this scoping
  // note stops holding.
  const preflight = reuseGuardVerdict(folder, kind, row, brand);
  if (preflight.kind === "refused") return { scheduled: null, scheduleError: preflight.message, refusal: "no-provider-request" };
  try {
    const done = await fn(folder, { onlyIds: [row.id], ...(deliveryPolicy ? { deliveryPolicy } : {}) });
    if (done.length === 0) {
      // The publisher didn't throw, so recompute the check it silently skipped on to find out WHY.
      // Still reached, and still necessary, with the pre-flight above in place: a publisher can
      // return [] for reasons the guard knows nothing about, and a DEFERRED row reaches the
      // publisher by design and may still be declined by it. What the pre-flight removes from this
      // branch is only the refused case, which can no longer get this far.
      // `publisher-declined`, never `no-provider-request`: `fn` already ran. This branch emits the
      // SAME same-row refusal wording the pre-flight does, so without the discriminant a reader
      // could not tell a refusal raised before any dispatch from one recovered after a publisher
      // was invoked. It keeps the row at `blocked`, which is resolve-ineligible, and keeps its
      // fence, so nobody can clear it and re-run a publisher that may already hold an object.
      return { scheduled: null, scheduleError: reuseGuardBlock(folder, kind, row, brand) ?? REUSE_GUARD_UNSPECIFIED, refusal: "publisher-declined" };
    }
    return { scheduled: done[0], scheduleError: null };
  } catch (e) {
    return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Send an eligible configured-media image row down the Typefully backup route (publishCards, whose
 * per-row work is already exactly this: rendered image + derivatives/<id>.md caption + a claimed
 * slot + the reuse guard + a native scheduled draft). Reached ONLY from the three trigger points in
 * scheduleApproved; it never decides for itself that Postiz failed.
 *
 * The typefully policy is resolved fresh here: a caller-supplied decision for `postiz` authorizes
 * Postiz, not Typefully, so it cannot carry over to a different provider.
 */
async function scheduleMediaViaTypefully(
  folder: string,
  row: QueueRow,
  deps: SchedulerDeps,
  policyDecision: DeliveryPolicyDecision | undefined,
): Promise<ScheduleOutcome> {
  const supplied = policyDecision?.provider === "typefully" ? policyDecision : undefined;
  const policy = supplied ?? (deps.resolveDeliveryPolicy ?? resolveDeliveryPolicy)(folder, "typefully");
  if (policy.mode === "blocked") return { scheduled: null, scheduleError: `delivery policy blocked: ${policy.reason}` };
  if (policy.mode === "manual") return { scheduled: writeReadyToPaste(folder, row, policy), scheduleError: null };
  if (!policy.providerAccountId) return { scheduled: null, scheduleError: "delivery policy blocked: provider account mapping is missing" };
  return runPublisher(deps.publishCards, folder, row, "media", policy.brand, supplied);
}

export async function scheduleApproved(
  folder: string,
  row: QueueRow,
  deps: SchedulerDeps = DEFAULT_SCHEDULER_DEPS,
  policyDecision?: DeliveryPolicyDecision,
  dispatchMode: DispatchMode = "scheduled",
): Promise<ScheduleOutcome> {
  const kind = scheduleKind(row);
  if (!kind) return { scheduled: null, scheduleError: null };
  if (dispatchMode === "unscheduled-draft" && kind !== "text") {
    return { scheduled: null, scheduleError: "unscheduled drafts are only supported for Typefully text rows" };
  }
  // Outreach approval locks a message and never contacts a publishing provider.
  let selected: SelectedSchedulingProvider | undefined;
  // Hoisted out of the block below so the tail dispatch reads the SAME resolved policy's brand the
  // Postiz pre-flight does — one value, one source, so the two guard paths cannot drift apart.
  // Stays null only for `outreach-lock`, the one kind reuseGuardPlatform never keys, so the guard
  // returns before the brand is consulted at all.
  let resolvedBrand: DeliveryBrand | null = null;
  if (kind !== "outreach-lock") {
    // Blocked/manual origin policy is provider-independent and must run before any capability
    // discovery. Besides being faster, this guarantees those origins make zero network calls.
    // Use the legacy route only as a provisional provider name; provider-authorized origins are
    // resolved again below after the actual Postiz-first route is known.
    const provisionalProvider = legacyProvider(kind, row).provider;
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
      // An explicit unscheduled draft has one supported provider and must never probe Postiz or
      // choose a scheduled fallback. The Typefully policy is still checked below before its write.
      selected = dispatchMode === "unscheduled-draft"
        ? { provider: "typefully" }
        : policyDecision?.provider === "postiz"
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
    resolvedBrand = policy.brand;
    if (provider === "postiz") {
      // PRE-FLIGHT reuse guard — Postiz is the sixth caller. typefully.ts, cards.ts, tiktok.ts,
      // youtube.ts and substack.ts each ask the guard before they create anything; the Postiz path
      // asked nobody, so an approved row inside its reuse window was placed anyway (what kept a
      // duplicate off the wire was only setStatus taking a placed row out of `approve`).
      //
      // It sits HERE, at the top of the one branch every Postiz row passes through, for two reasons:
      //   - before defaultPublishPostiz, so no slot is claimed and data/publish-schedule.jsonl is
      //     untouched for a row that will not ship;
      //   - before the try/catch below, so a refusal can never be mistaken for SLICE-5J's
      //     "Postiz provably created nothing" and re-sent down the Typefully backup route. A guard
      //     block means do not place this row ANYWHERE, not try the other provider.
      // SLICE-7C: non-Postiz routes are gated too, but in runPublisher rather than here, because
      // that is the one place all of them pass through. Their own publishers still check as well;
      // the earlier ask is what makes a refusal provably pre-dispatch on those routes instead of
      // only recoverable after the fact.
      //
      // A DEFERRED verdict is not a refusal. Re-placing the same row still stops here; a different
      // derivative of the same piece carries on with a spacing floor, and the existing scheduler
      // picks the first free slot past it.
      const verdict = reuseGuardVerdict(folder, kind, row, resolvedBrand);
      // The one site in this file that is provably ahead of every provider create: it returns
      // before publishPostizFn, before defaultPublishPostiz claims a slot, and before any backup
      // route opens. So it can carry the typed no-provider-request signal, which is what lets
      // publishing-status.ts record `blocked` and clear the dispatch fence instead of stranding
      // the row. runPublisher's recovery branch deliberately does NOT set it: by the time it runs
      // the publisher was already invoked, and an empty result is not proof it created nothing.
      if (verdict.kind === "refused") return { scheduled: null, scheduleError: verdict.message, refusal: "no-provider-request" };
      const earliestAt = verdict.kind === "deferred" ? verdict.earliestAt : undefined;
      const capability = selected.postizCapability;
      if (!capability) return { scheduled: null, scheduleError: "configured Postiz capability was not retained for scheduling" };
      try {
        const publishPostizFn = deps.publishPostiz
          ?? ((f: string, r: QueueRow, c: PostizCapability, p: DeliveryPolicyDecision, e?: string) => defaultPublishPostiz(f, r, c, p, undefined, e));
        return { scheduled: await publishPostizFn(folder, row, capability, policy, earliestAt), scheduleError: null };
      } catch (e) {
        // Trigger 3 of 3, and the ONLY one that runs after Postiz was actually contacted: a
        // rate-limit rejection, whose guard runs before the create controller, so nothing was
        // created and the slot was released. Every other create failure is AMBIGUOUS — Postiz may
        // already hold the draft — so it returns its scheduleError and never takes a second route.
        if (kind === "media" && mediaFallbackTarget(row) && isPostizNothingCreated(e)) {
          return scheduleMediaViaTypefully(folder, row, deps, policyDecision);
        }
        return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
      }
    }
    // A media row reaches a non-Postiz provider only as the Typefully backup route for a row
    // Typefully can take (triggers 1 and 2, decided in selectConfiguredProvider). Any other
    // non-"postiz"/"manual"/"blocked" outcome is a caller error — e.g. an explicit policyDecision
    // naming a legacy provider no handler knows how to use for this row shape.
    if (kind === "media") {
      if (provider === "typefully" && mediaFallbackTarget(row)) return scheduleMediaViaTypefully(folder, row, deps, policyDecision);
      return { scheduled: null, scheduleError: `delivery policy resolved ${provider} for a media row, but media rows are Postiz-only` };
    }
  }
  const fn =
    kind === "text" ? deps.publishText
    : kind === "card" ? deps.publishCards
    : kind === "tiktok" ? deps.publishTikTok
    : kind === "substack" ? deps.publishSubstack
    : kind === "outreach-lock" ? deps.lockOutreachMessage
    : deps.publishShorts;
  if (dispatchMode === "unscheduled-draft") {
    // SLICE-7C: this branch calls deps.publishText directly rather than through runPublisher, so it
    // needs the pre-flight in its own right. Same argument, same place in the order: ahead of the
    // only provider call on the route, and ahead of any slot claim (publishText claims its own).
    const preflight = reuseGuardVerdict(folder, kind, row, resolvedBrand);
    if (preflight.kind === "refused") return { scheduled: null, scheduleError: preflight.message, refusal: "no-provider-request" };
    try {
      const done = await deps.publishText(folder, {
        onlyIds: [row.id],
        noSchedule: true,
        deferNoScheduleCompletion: true,
        ...(policyDecision ? { deliveryPolicy: policyDecision } : {}),
      });
      // The second post-publisher recovery site, and the same rule as runPublisher's: publishText
      // has already been invoked here, so this is `publisher-declined`. Leaving it unmarked would
      // reopen the same defect at this route. Reached now only when the pre-flight above allowed or
      // deferred the row and publishText declined it anyway, which proves nothing about what it
      // created.
      if (done.length === 0) return { scheduled: null, scheduleError: reuseGuardBlock(folder, kind, row, resolvedBrand) ?? REUSE_GUARD_UNSPECIFIED, refusal: "publisher-declined" };
      return { scheduled: done[0], scheduleError: null };
    } catch (error) {
      return { scheduled: null, scheduleError: error instanceof Error ? error.message : String(error) };
    }
  }
  return runPublisher(fn, folder, row, kind, resolvedBrand, policyDecision);
}
