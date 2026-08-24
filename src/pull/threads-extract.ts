// Threads post extraction: pure functions over raw JSON payloads, no I/O and no model anywhere
// in the path. `src/pull/platforms/threads.ts` does the browsing and hands the payloads here.
//
// ── WHY A STRUCTURAL WALK AND NOT AN ENVELOPE PARSER ────────────────────────────────
// Threads is Instagram's media schema under a different app (its internal codename, "barcelona",
// is all over the markup). The envelope around a post moves whenever Meta reshuffles its Relay
// queries, but the media object inside it is stable: a `user.username`, a `code` shortcode, a
// `caption.text`, `like_count`, `taken_at`, `carousel_media`, `text_post_app_info`. So we walk
// every JSON payload we were handed and pick out anything with that signature, rather than
// hardcoding a path that breaks on the next deploy.
//
// ── HONESTY NOTE, READ BEFORE TRUSTING THIS FILE ────────────────────────────────────
// The field names above are reconstructed from the Instagram-family schema. They have NOT been
// verified against a live logged-in Threads response, because building this needed a session
// nobody had yet. The first `npm run pull -- threads --headed` run is what corrects them: when the
// walk finds nothing, the puller dumps every captured payload to ~/.content-agents/pull-diagnostics
// and fails with UI_CHANGED, so the real shape is on disk to read rather than guessed at twice.

import type { MediaAspect, MediaForm } from "../patterns/types.js";

// One slide of an image or carousel post. `alt` is Meta's OWN auto-generated accessibility
// caption, which is a machine description of the picture ("May be an image of text that says...").
// It is NEVER the typeset on-screen text, so it never becomes `media.onscreen_text`. It goes in
// `media.description` labelled as what it is.
export interface ThreadsSlide {
  url: string | null;
  alt: string | null;
}

// One post as it came off the payload, before it is shaped into a corpus entry.
export interface ThreadsPost {
  code: string;
  url: string;
  username: string;
  creator: string | null;
  body: string;
  postedAt: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  views: number | null;
  followers: number | null;
  form: MediaForm;
  mediaCount: number | null;
  slides: ThreadsSlide[];
  assetUrl: string | null;
  durationSeconds: number | null;
  hasCaptions: boolean | null;
  aspect: MediaAspect | null;
  quotesAnotherPost: boolean;
  // Set on anything that is not the account's own standalone post. The puller drops these, and
  // counts them, rather than letting a reply or a repost be staged as the creator's own words.
  isReply: boolean;
  isRepost: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

// Pull every `<script type="application/json">` payload out of a page's raw HTML. Threads ships
// its server-rendered state in these blobs. A blob that will not parse is skipped in silence,
// because the page carries plenty that is not ours (config, i18n, feature flags).
export function jsonBlobsFromHtml(html: string): unknown[] {
  const blobs: unknown[] = [];
  const re = /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blobs.push(JSON.parse(match[1]));
    } catch {
      /* not ours */
    }
  }
  return blobs;
}

// The signature of a Threads/Instagram media object: an author, a shortcode, and at least one
// thing only a post carries. Deliberately narrow. A false positive here stages garbage, and a
// false negative only means the diagnostics dump gets read.
function looksLikePost(node: Record<string, unknown>): boolean {
  const user = node.user;
  if (!isRecord(user) || !str(user.username)) return false;
  if (!str(node.code)) return false;
  return (
    node.caption !== undefined ||
    node.like_count !== undefined ||
    node.taken_at !== undefined ||
    node.text_post_app_info !== undefined
  );
}

// Walk anything and collect every media object in it, deduped by shortcode.
//
// Document order is preserved on purpose. A Threads profile feed is reverse-chronological and
// there is no sort-by-top anywhere on the platform, so "the first N found" has to mean "the N most
// recent posts" and not "whichever N the traversal happened to reach first". Children are pushed
// in reverse so popping walks them forwards. Iterative rather than recursive, because a captured
// Relay store nests deeply enough to matter.
export function findPostNodes(payload: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const stack: unknown[] = [payload];
  // Guard against the cyclic references a captured Relay store can carry.
  const visited = new Set<object>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      if (visited.has(node)) continue;
      visited.add(node);
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    if (!isRecord(node)) continue;
    if (visited.has(node)) continue;
    visited.add(node);
    if (looksLikePost(node)) {
      const code = str(node.code) as string;
      if (!seen.has(code)) {
        seen.add(code);
        found.push(node);
      }
    }
    const values = Object.values(node);
    for (let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
  }
  return found;
}

function slidesOf(node: Record<string, unknown>): ThreadsSlide[] {
  const media = Array.isArray(node.carousel_media) ? node.carousel_media : [node];
  const slides: ThreadsSlide[] = [];
  for (const item of media) {
    if (!isRecord(item)) continue;
    const versions = item.image_versions2;
    let url: string | null = null;
    if (isRecord(versions) && Array.isArray(versions.candidates)) {
      // The candidates are ordered largest first, and the largest is the one worth reading.
      const best = versions.candidates.find((c) => isRecord(c) && str((c as Record<string, unknown>).url));
      if (isRecord(best)) url = str(best.url);
    }
    const alt = str(item.accessibility_caption);
    if (url || alt) slides.push({ url, alt });
  }
  return slides;
}

function stableUrl(value: unknown): string | null {
  const url = str(value);
  return url !== null && /^https?:\/\//i.test(url) ? url : null;
}

function mediaAssetUrlOf(node: Record<string, unknown>, slides: ThreadsSlide[]): string | null {
  const imageUrl = slides.map((slide) => stableUrl(slide.url)).find((url): url is string => url !== null);
  if (imageUrl) return imageUrl;

  if (Array.isArray(node.video_versions)) {
    for (const version of node.video_versions) {
      if (!isRecord(version)) continue;
      const url = stableUrl(version.url);
      if (url) return url;
    }
  }
  return null;
}

function aspectOf(node: Record<string, unknown>): MediaAspect | null {
  const width = num(node.original_width);
  const height = num(node.original_height);
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio > 1.15) return "horizontal";
  if (ratio < 0.87) return "vertical";
  return "square";
}

// Threads carries no long-form video, but MEDIA_FORMS splits short-video from video on purpose, so
// the split is made on a real duration and never on the platform's reputation. An unknown duration
// stays the broader "video" rather than being upgraded to a claim about length.
const SHORT_VIDEO_MAX_SECONDS = 60;

function formOf(node: Record<string, unknown>, slides: ThreadsSlide[], duration: number | null, quotes: boolean): MediaForm {
  const isCarousel = Array.isArray(node.carousel_media) && node.carousel_media.length > 1;
  const hasVideo = Array.isArray(node.video_versions) && node.video_versions.length > 0;
  const info = isRecord(node.text_post_app_info) ? node.text_post_app_info : null;
  const hasLink = info !== null && info.link_preview_attachment != null;
  const hasImage = slides.length > 0;

  const parts = [isCarousel || hasImage, hasVideo, quotes].filter(Boolean).length;
  if (parts > 1) return "mixed";
  if (isCarousel) return "carousel";
  if (hasVideo) return duration !== null && duration <= SHORT_VIDEO_MAX_SECONDS ? "short-video" : "video";
  if (hasImage) return "image";
  if (quotes) return "repost-with-comment";
  if (hasLink) return "link-preview";
  return "text-only";
}

export function threadsUrl(username: string, code: string): string {
  return `https://www.threads.com/@${username}/post/${code}`;
}

// Shape one raw media object into a ThreadsPost. Returns null when the node is too incomplete to
// describe honestly (no author, no shortcode).
export function toThreadsPost(node: Record<string, unknown>): ThreadsPost | null {
  const user = isRecord(node.user) ? node.user : null;
  const username = user ? str(user.username) : null;
  const code = str(node.code);
  if (!username || !code) return null;

  const info = isRecord(node.text_post_app_info) ? node.text_post_app_info : null;
  const share = info && isRecord(info.share_info) ? info.share_info : null;
  const quotesAnotherPost = share !== null && share.quoted_post != null;
  const isRepost = share !== null && share.reposted_post != null;
  const isReply =
    (info !== null && (info.reply_to_author != null || str(info.reply_to_author_username) !== null)) ||
    node.reply_to_author != null ||
    node.reply_to_post_id != null;

  const caption = isRecord(node.caption) ? str(node.caption.text) : null;
  const takenAt = num(node.taken_at);
  const slides = slidesOf(node);
  const duration = num(node.video_duration);
  const form = formOf(node, slides, duration, quotesAnotherPost);
  const carousel = Array.isArray(node.carousel_media) ? node.carousel_media.length : null;

  return {
    code,
    url: str(node.permalink) ?? threadsUrl(username, code),
    username,
    creator: str(user?.full_name),
    body: caption ?? "",
    postedAt: takenAt === null ? null : new Date(takenAt * 1000).toISOString(),
    likes: num(node.like_count),
    // Threads counts replies where the corpus counts comments, and reposts where it counts shares.
    replies: num(info?.direct_reply_count) ?? num(node.reply_count),
    reposts: num(info?.repost_count) ?? num(node.repost_count),
    // Threads shows a view count to a post's own author. Whether one is public to a stranger is
    // unverified, so it is recorded only when the payload literally hands one over, never inferred.
    views: num(info?.view_count) ?? num(node.view_count) ?? num(node.play_count),
    followers: num(user?.follower_count),
    form,
    mediaCount: carousel !== null && carousel > 1 ? carousel : null,
    slides,
    assetUrl: mediaAssetUrlOf(node, slides),
    durationSeconds: duration,
    // A burned-in or served caption track is not something the media object states plainly, so
    // this stays unknown rather than being answered from the presence of a video.
    hasCaptions: null,
    aspect: aspectOf(node),
    quotesAnotherPost,
    isReply,
    isRepost,
  };
}

// A post is the account's OWN standalone post only when the author matches, and it is neither a
// reply nor a repost of someone else. This filter exists because staging another person's words
// under a creator's name has already happened once in this project, on LinkedIn, and cost a full
// re-collection. Order the checks so the message says which rule fired.
export function ownPostReason(post: ThreadsPost, handle: string): string | null {
  const want = handle.trim().replace(/^@/, "").toLowerCase();
  if (post.username.trim().toLowerCase() !== want) {
    return `written by @${post.username}, not @${want}`;
  }
  if (post.isRepost) return "a repost of someone else's post, not their own words";
  if (post.isReply) return "a reply, not a standalone post";
  return null;
}

// Whether `body` alone is the whole post. Only a post with no media at all can be true here.
// Everything else has substance sitting in an image, in slides 2..n, in a video, or in a quoted
// post, and none of that is collected, so the flag says so and the analysis step stays honest.
export function bodyIsComplete(form: MediaForm, body: string): boolean {
  return form === "text-only" && body.trim().length > 0;
}

// Plain words about what was actually seen, including the method. Never a guess at text that could
// not be read, and Meta's auto-alt is labelled as Meta's, so nobody later mistakes it for the
// creator's typeset headline.
export function describeMedia(post: ThreadsPost, slideDir: string | null): string {
  const parts: string[] = [];
  switch (post.form) {
    case "text-only":
      parts.push("no attached media on the post payload");
      break;
    case "carousel":
      parts.push(`a carousel of ${post.mediaCount ?? post.slides.length} slides`);
      break;
    case "image":
      parts.push("a single attached image");
      break;
    case "video":
    case "short-video":
      parts.push(post.durationSeconds === null ? "an attached video of unknown length" : `an attached video of ${post.durationSeconds}s`);
      break;
    case "link-preview":
      parts.push("a link preview card");
      break;
    case "repost-with-comment":
      parts.push("the creator's own words quoting another post");
      break;
    case "mixed":
      parts.push("more than one form on one post: see the counts above");
      break;
    default:
      parts.push(`form recorded as ${post.form}`);
  }
  parts.push("form determined from the post's own JSON payload in a logged-in session, not from a screenshot");

  if (post.form !== "text-only" && post.form !== "link-preview") {
    parts.push(
      "the on-screen text typeset onto these images was NOT extracted: nothing here can read words off a picture, so onscreen_text stays null"
    );
  }
  const alts = post.slides.map((s) => s.alt).filter((a): a is string => a !== null);
  if (alts.length > 0) {
    parts.push(`Meta's own auto-generated alt text (a machine description of the picture, not the typeset headline): ${alts.join(" | ")}`);
  }
  if (slideDir) {
    // An absolute path on purpose, and named as one, because the entire reason the slides are
    // downloaded is that a human opens the folder and reads the words off them by hand.
    parts.push(`slide images downloaded so the words on them can be read by hand, paste this path into Finder: ${slideDir}`);
  }
  return parts.join(". ") + ".";
}

// The staged record `npm run patterns:collect` validates. Deliberately the raw JSON shape rather
// than CorpusEntry, because id and collected_at are collect.ts's to fill in.
export interface StagedThreadsEntry {
  platform: "threads";
  handle: string;
  creator: string;
  niche: string;
  url: string;
  posted_at: string | null;
  kind: "text" | "video";
  body: string;
  transcript_source: "caption" | null;
  metrics: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    followers: number | null;
  };
  media: {
    form: MediaForm;
    onscreen_text: string | null;
    description: string | null;
    duration_seconds: number | null;
    media_count: number | null;
    has_captions: boolean | null;
    aspect: MediaAspect | null;
    asset_url: string | null;
    body_is_complete: boolean;
  };
  notes?: string;
}

export interface StageOptions {
  handle: string;
  creator: string;
  niche: string;
  slideDir?: string | null;
  notes?: string;
}

export interface StageResult {
  entry: StagedThreadsEntry | null;
  skipped: string | null;
}

// Shape one post into a staged entry, or say plainly why it cannot be staged.
//
// The one refusal that matters: `validateEntry` requires a non-empty body, so a wordless image or
// carousel post cannot enter the corpus at all. It is skipped and counted. Padding the body with
// a description to get it past the gate would put text in the corpus that the creator never wrote.
export function stageEntry(post: ThreadsPost, opts: StageOptions): StageResult {
  const notOwn = ownPostReason(post, opts.handle);
  if (notOwn) return { entry: null, skipped: notOwn };

  const body = post.body.trim();
  if (body === "") {
    return {
      entry: null,
      skipped: `no caption text at all (form: ${post.form}), and the corpus refuses an empty body rather than let a description stand in for one`,
    };
  }

  const isVideo = post.form === "video" || post.form === "short-video";
  const slideDir = opts.slideDir ?? null;
  // Preserve only provenance already handed to us: the downloaded slide directory when one was
  // written, otherwise the first explicit media URL from the source payload. This records where
  // the media can be recovered later without fetching anything here or making any claim about its
  // contents.
  const assetUrl =
    slideDir !== null && slideDir.trim() !== ""
      ? slideDir
      : post.assetUrl;

  const entry: StagedThreadsEntry = {
    platform: "threads",
    handle: `@${post.username}`,
    creator: opts.creator || post.creator || post.username,
    niche: opts.niche,
    url: post.url,
    posted_at: post.postedAt,
    // A video entry has to say what `body` really is. There is no spoken-transcript route on
    // Threads, so the honest answer is "caption", singular: written words, not speech.
    kind: isVideo ? "video" : "text",
    body,
    transcript_source: isVideo ? "caption" : null,
    metrics: {
      views: post.views,
      likes: post.likes,
      comments: post.replies,
      shares: post.reposts,
      followers: post.followers,
    },
    media: {
      form: post.form,
      onscreen_text: null,
      description: describeMedia(post, slideDir),
      duration_seconds: post.durationSeconds,
      media_count: post.mediaCount,
      has_captions: post.hasCaptions,
      aspect: post.aspect,
      asset_url: assetUrl,
      body_is_complete: bodyIsComplete(post.form, body),
    },
  };
  if (opts.notes) entry.notes = opts.notes;
  return { entry, skipped: null };
}
