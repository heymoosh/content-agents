// Long untreated controls (owner decision 2026-09-15, master status G16): an original that is
// longer than one post is not rejected, it is chained into a thread of posts on platforms that
// support one. The derivative file keeps the exact original bytes and carries
// `posts_as_thread: true`; the split happens deterministically at publish time, so the words stay
// exactly the author's and only the whitespace at each break is dropped. Nothing is added: no
// "1/5" counters, no ellipses.

/** Platforms whose publish routes (Typefully posts[], Postiz value[] follow-ups) chain posts as replies. */
export const THREAD_PLATFORMS: readonly string[] = ["x", "bluesky", "threads", "mastodon"];

/**
 * Split `body` into posts of at most `max` characters, breaking at a paragraph, then a sentence,
 * then a word. Returns null when a single word is longer than `max`, the only text that cannot be
 * chained without altering it.
 */
export function splitThread(body: string, max: number): string[] | null {
  let rest = body.trim();
  const posts: string[] = [];
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    // Prefer the natural break, but not one that would leave a stub post far shorter than the limit.
    const cut = lastCut(window, /\n\s*\n/g, "start", max / 2)
      ?? lastCut(window, /[.!?]["'”’)\]]*(?=\s)/g, "end", max / 3)
      ?? lastCut(window, /\s+/g, "start", 1);
    if (cut === null) return null;
    posts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  posts.push(rest);
  return posts;
}

function lastCut(window: string, pattern: RegExp, side: "start" | "end", minLength: number): number | null {
  let cut: number | null = null;
  for (const match of window.matchAll(pattern)) {
    const at = side === "start" ? match.index : match.index + match[0].length;
    if (at >= minLength && at <= window.length - 1) cut = at;
  }
  return cut;
}
