import "../util/env.js";
import { POSTPEER_API, extractPostPeerList } from "./queue-view.js";
import { fetchWithRetry, type FetchRetryOptions } from "../util/fetch-retry.js";

// PostPeer's live post list (GET /v1/posts) — and, since the cancel-scheduled-posts card, the one
// write this module makes: cancelPost (DELETE /v1/posts/{id}). PostPeer doesn't publish an official
// API doc; src/publish/queue-view.ts already hits the list endpoint for the unified `npm run queue`
// view, so fetchScheduledPosts reuses its exported base URL + defensive parsing instead of guessing
// PostPeer's undocumented response shape a second time. Used by src/review/reconcile.ts to check
// whether a specific row's logged postId (captured off publish-log.md at schedule time) still shows
// up live, and by src/review/rows.ts's cancelScheduled (the review GUI's "Cancel" action) to
// actually pull a row's live post.

export interface PostPeerPost {
  id: string;
  scheduledFor?: string;
  status?: string;
  content?: string;
}

export async function fetchScheduledPosts(retryOpts?: FetchRetryOptions): Promise<PostPeerPost[]> {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) throw new Error("POSTPEER_API_KEY missing in .env — see docs/setup-tiktok.md");
  const res = await fetchWithRetry(`${POSTPEER_API}/posts`, { headers: { "x-access-key": key } }, retryOpts);
  if (!res.ok) throw new Error(`postpeer GET /posts → ${res.status} ${await res.text()}`);
  const json = await res.json();
  return extractPostPeerList(json)
    .map((p) => ({
      id: String(p.id ?? p.postId ?? ""),
      scheduledFor: typeof p.scheduledFor === "string" ? p.scheduledFor : undefined,
      status: typeof p.status === "string" ? p.status : undefined,
      content: typeof p.content === "string" ? p.content : undefined,
    }))
    .filter((p) => p.id);
}

// Cancel (delete) a scheduled PostPeer post, given the id fetchScheduledPosts/tiktok.ts's
// scheduleToTikTok logged as `postpeer post <id>` in publish-log.md (see src/review/reconcile.ts's
// findLoggedRef). Used by the review GUI's "Cancel" action (src/review/rows.ts cancelScheduled).
//
// GUESS, unverified: like the list endpoint above, this has no official PostPeer API doc to confirm
// against — DELETE /v1/posts/{id} follows the same REST convention as GET /v1/posts rather than a
// confirmed endpoint. Flag for a live smoke-test before relying on it. A 404 (already gone — e.g.
// canceled by hand in the PostPeer dashboard) is treated as success: the end state either way is
// "no longer scheduled". retryOnNetworkError: false, same reasoning as typefully.ts's cancelDraft —
// a DELETE is safe to repeat but a real failure shouldn't silently read as "canceled".
export async function cancelPost(postId: string): Promise<void> {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) throw new Error("POSTPEER_API_KEY missing in .env — see docs/setup-tiktok.md");
  const res = await fetchWithRetry(
    `${POSTPEER_API}/posts/${postId}`,
    { method: "DELETE", headers: { "x-access-key": key } },
    { retryOnNetworkError: false }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`postpeer DELETE /posts/${postId} → ${res.status} ${await res.text()}`);
  }
}
