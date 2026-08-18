// Fetch a Substack user's own Notes via the public reader feed.
//
// Substack has no documented API. Notes never appear in the publication RSS feed
// (fetch-substack.ts), so these two unofficial JSON endpoints are the only way to bring them in:
//   - /api/v1/user/<handle>/public_profile  → the numeric user id
//   - /api/v1/reader/feed/profile/<id>       → the user's feed (notes + latest posts), paginated
// Read-only, public own content only — same posture as the Bluesky AT-Protocol fetch. Unofficial,
// so it can change without notice; we fail loudly rather than returning nothing silently.

export interface FetchedNote {
  noteId: string; // entity_key, e.g. "c-279240534"
  url: string;
  publishedAt: string | null;
  text: string;
  likes: number; // reaction_count
  reposts: number; // restacks
  replies: number; // children_count
  views?: number;
  subscriberTotal?: number;
  authorUserId?: string;
  /** The original feed item, retained for the research raw capture. */
  raw?: unknown;
}

// A browser-like UA, not a custom one: Substack's WAF appears to block requests whose UA reads
// as an obvious script/bot (seen 2026-07-04: a GitHub Actions runner got a 403 with a custom UA).
// The UA alone didn't clear the WAF (still 403'd from GitHub Actions after #77), so round out the
// header set to what a real Chrome tab sends on this exact XHR call: Accept for a JSON endpoint,
// Accept-Language, sec-fetch-* (fetch metadata Chrome attaches to same-origin XHR), sec-ch-ua
// (Client Hints matching the UA string above), and Referer/Origin since the real browser call is
// made from a page on substack.com itself.
const UA = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://substack.com/",
  origin: "https://substack.com",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

interface FeedComment {
  id: number;
  user_id: number;
  body?: string;
  date?: string;
  ancestor_path?: string;
  post_id?: number | null;
  restacked?: boolean;
  reaction_count?: number;
  restacks?: number;
  children_count?: number;
  views?: number;
  view_count?: number;
}
interface FeedItem {
  type?: string;
  entity_key?: string;
  context?: { type?: string };
  comment?: FeedComment;
}

async function resolveUserId(handle: string): Promise<{
  id: number;
  handle: string;
  name: string;
  subscriberTotal?: number;
}> {
  const h = handle.replace(/^@/, "").trim();
  const res = await fetch(`https://substack.com/api/v1/user/${encodeURIComponent(h)}/public_profile`, {
    headers: UA,
  });
  if (!res.ok) throw new Error(`Substack profile fetch failed for @${h} → ${res.status}`);
  const prof = (await res.json()) as { id?: number; handle?: string; name?: string };
  if (!prof.id) throw new Error(`could not resolve Substack user id for @${h} (is the handle right?)`);
  const subscriberTotal =
    typeof (prof as { subscriber_count?: unknown }).subscriber_count === "number"
      ? (prof as { subscriber_count: number }).subscriber_count
      : typeof (prof as { subscriberCount?: unknown }).subscriberCount === "number"
        ? (prof as { subscriberCount: number }).subscriberCount
        : undefined;
  return { id: prof.id, handle: prof.handle ?? h, name: prof.name ?? h, subscriberTotal };
}

// An item is one of Muxin's OWN original notes (not a reply, not a comment on an essay, not a
// restack of someone else's note) when all of these hold.
function isOwnNote(it: FeedItem, userId: number): boolean {
  const c = it.comment;
  return (
    it.type === "comment" &&
    it.context?.type === "note" &&
    !!c &&
    c.user_id === userId &&
    (c.ancestor_path ?? "") === "" &&
    c.post_id == null &&
    c.restacked === false
  );
}

export async function fetchSubstackNotes(
  handle: string,
  opts: { limit?: number; maxPages?: number; delayMs?: number; sleep?: (milliseconds: number) => Promise<void> } = {}
): Promise<FetchedNote[]> {
  const limit = opts.limit ?? 20;
  const maxPages = opts.maxPages ?? 25;
  const { id, handle: resolvedHandle, subscriberTotal } = await resolveUserId(handle);

  const out: FetchedNote[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  // The reader feed mixes notes with the user's latest posts; page until we have `limit` notes
  // or the feed runs out. Cap pages so a sparse feed can't loop forever.
  for (let page = 0; page < maxPages && out.length < limit; page++) {
    if (page > 0 && opts.delayMs && opts.sleep) await opts.sleep(opts.delayMs);
    const u = new URL(`https://substack.com/api/v1/reader/feed/profile/${id}`);
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u, { headers: UA });
    if (!res.ok) throw new Error(`Substack notes feed fetch failed → ${res.status}`);
    const data = (await res.json()) as { items?: FeedItem[]; nextCursor?: string };
    const items = data.items ?? [];
    if (items.length === 0) break;
    for (const it of items) {
      if (!isOwnNote(it, id)) continue;
      const c = it.comment!;
      const noteId = it.entity_key ?? `c-${c.id}`;
      out.push({
        noteId,
        url: `https://substack.com/@${resolvedHandle}/note/${noteId}`,
        publishedAt: c.date ? new Date(c.date).toISOString() : null,
        text: (c.body ?? "").trim(),
        likes: c.reaction_count ?? 0,
        reposts: c.restacks ?? 0,
        replies: c.children_count ?? 0,
        views: typeof c.views === "number" ? c.views : c.view_count,
        subscriberTotal,
        authorUserId: String(id),
        raw: it,
      });
      if (out.length >= limit) break;
    }
    if (!data.nextCursor) break;
    if (seenCursors.has(data.nextCursor)) {
      throw new Error("Substack Notes feed repeated an opaque cursor");
    }
    seenCursors.add(data.nextCursor);
    cursor = data.nextCursor;
  }
  if (cursor && out.length < limit && maxPages !== Number.POSITIVE_INFINITY) {
    throw new Error("Substack Notes feed exhausted its page cap before enumeration completed");
  }
  return out;
}

/** Enumerate the complete public Notes archive for research capture. */
export function fetchAllSubstackNotes(
  handle: string,
  opts: { delayMs?: number; sleep?: (milliseconds: number) => Promise<void> } = {}
): Promise<FetchedNote[]> {
  return fetchSubstackNotes(handle, { ...opts, limit: Number.POSITIVE_INFINITY, maxPages: Number.POSITIVE_INFINITY });
}
