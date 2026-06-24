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
}

const UA = { "user-agent": "content-agents/0.1" };

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
}
interface FeedItem {
  type?: string;
  entity_key?: string;
  context?: { type?: string };
  comment?: FeedComment;
}

async function resolveUserId(handle: string): Promise<{ id: number; handle: string; name: string }> {
  const h = handle.replace(/^@/, "").trim();
  const res = await fetch(`https://substack.com/api/v1/user/${encodeURIComponent(h)}/public_profile`, {
    headers: UA,
  });
  if (!res.ok) throw new Error(`Substack profile fetch failed for @${h} → ${res.status}`);
  const prof = (await res.json()) as { id?: number; handle?: string; name?: string };
  if (!prof.id) throw new Error(`could not resolve Substack user id for @${h} (is the handle right?)`);
  return { id: prof.id, handle: prof.handle ?? h, name: prof.name ?? h };
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

export async function fetchSubstackNotes(handle: string, opts: { limit?: number } = {}): Promise<FetchedNote[]> {
  const limit = opts.limit ?? 20;
  const { id, handle: resolvedHandle } = await resolveUserId(handle);

  const out: FetchedNote[] = [];
  let cursor: string | undefined;
  // The reader feed mixes notes with the user's latest posts; page until we have `limit` notes
  // or the feed runs out. Cap pages so a sparse feed can't loop forever.
  for (let page = 0; page < 25 && out.length < limit; page++) {
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
      });
      if (out.length >= limit) break;
    }
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return out;
}
