import "../util/env.js";
import { POSTPEER_API, extractPostPeerList } from "./queue-view.js";

// Read-only: PostPeer's live post list (GET /v1/posts). PostPeer doesn't publish an official
// "list scheduled posts" endpoint — src/publish/queue-view.ts already hits this same endpoint for
// the unified `npm run queue` view; this reuses its exported base URL + defensive parsing instead
// of guessing PostPeer's undocumented response shape a second time. Used by src/review/reconcile.ts
// to check whether a specific row's logged postId (captured off publish-log.md at schedule time)
// still shows up live. No writes, no cancel.

export interface PostPeerPost {
  id: string;
  scheduledFor?: string;
  status?: string;
  content?: string;
}

export async function fetchScheduledPosts(): Promise<PostPeerPost[]> {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) throw new Error("POSTPEER_API_KEY missing in .env — see docs/setup-tiktok.md");
  const res = await fetch(`${POSTPEER_API}/posts`, { headers: { "x-access-key": key } });
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
