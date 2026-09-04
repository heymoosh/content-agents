import type { CharlesPost } from "./charles.js";

export type CharlesPage = "input" | "needs-review" | "approved" | "all";

export function charlesPostsForPage(posts: CharlesPost[], page: CharlesPage): CharlesPost[] {
  if (page === "needs-review") return posts.filter((post) => post.status === "pending" || post.status === "revise");
  if (page === "approved") return posts.filter((post) => post.status === "approve");
  if (page === "all") return posts;
  return [];
}

// ---------------------------------------------------------------------------
// Combined review layout (decision 11, slice 3). DOM-free mirrors of the client functions of the
// same name in page.ts's <script>: grouping keys off the DURABLE group id each queue item carries
// (charles-queue.ts charlesGroupId), never off titles or text. Kept here so node:test can pin the
// grouping and the layout skeleton without a browser.

/** The slice of a room-queue item the grouping needs (room-queue.ts CharlesQueuePayload). */
export interface CharlesQueueItemView {
  captureId: string;
  state?: string;
  createdAt?: string;
  payload: { kind: string; groupId?: string | null; outputs?: ReadonlyArray<{ type: string; ordinal: number; status: string; postId: string | null }> };
}

export interface CharlesReviewGroup<P extends { id: string; type: string; status: string } = CharlesPost> {
  /** DOM key: the durable group id, or `post:<id>` for a legacy row with no group. */
  key: string;
  groupId: string | null;
  captureId: string | null;
  title: string;
  /** Plain-language rollup, e.g. "partially-complete · 2 of 3 drafted · 1 approved". */
  summary: string;
  essay: P | null;
  /** The shorter outputs, by ordinal, rendered stacked below the essay. */
  others: P[];
  /** Every rendered output in layout order: essay first, then `others`. */
  outputs: P[];
}

function outputsSummary(state: string | undefined, total: number, drafted: number, approved: number, offPage: number): string {
  const parts = [state || "pending", drafted + " of " + total + " drafted"];
  if (approved) parts.push(approved + " approved");
  if (offPage) parts.push(offPage + " outside this page");
  return parts.join(" · ");
}

/** The slice of a group output the ordering and resume helpers need (room-queue.ts CharlesGroupOutput). */
export interface CharlesOutputRef { ordinal?: number; postId?: string | null }

/**
 * Deterministic output order: by ordinal, a missing or non-finite ordinal sorting LAST (Infinity, which no real ordinal can equal), then by
 * postId (empty last) so duplicate or absent ordinals still land in one documented, stable order.
 */
export function charlesOutputOrder(a: CharlesOutputRef, b: CharlesOutputRef): number {
  const oa = Number.isFinite(a.ordinal) ? (a.ordinal as number) : Number.POSITIVE_INFINITY;
  const ob = Number.isFinite(b.ordinal) ? (b.ordinal as number) : Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa - ob;
  const pa = a.postId || "", pb = b.postId || "";
  if (pa === pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  return pa < pb ? -1 : 1;
}

/**
 * Resume target for a group: the drafted output with the LOWEST ordinal whose post is loaded, or
 * null when nothing in the group has drafted yet (the caller then returns to the composer).
 */
export function charlesResumeOutput<O extends CharlesOutputRef>(outputs: ReadonlyArray<O>, postIds: ReadonlySet<string> | { has(id: string): boolean }): O | null {
  return [...outputs].sort(charlesOutputOrder).find((output) => Boolean(output.postId) && postIds.has(output.postId as string)) || null;
}

/**
 * Group the review room's posts by durable capture group for one page. A group shows whenever ANY
 * of its drafted outputs passes the page filter, and then shows ALL its drafted outputs (that is the
 * combined review: a half-approved group reads as half-approved instead of splitting across pages).
 * Legacy posts no group points at fall back to a one-post pseudo-group, so nothing is dropped.
 * room-queue.ts keeps ONE item per captureId (projectCapture returns the existing row) and the group
 * id derives from the captureId (charles-queue.ts charlesGroupId), so a groupId appears once. A
 * repeat is handled defensively: the first row that actually yields drafted outputs wins, and a
 * later row for the same group is skipped rather than rendered twice.
 */
export function charlesReviewGroups<P extends { id: string; type: string; status: string }>(
  posts: P[], items: ReadonlyArray<CharlesQueueItemView>, page: CharlesPage, titleFor?: (captureId: string) => string,
): CharlesReviewGroup<P>[] {
  const visibleIds = new Set(charlesPostsForPage(posts as unknown as CharlesPost[], page).map((post) => post.id));
  const byId = new Map(posts.map((post) => [post.id, post] as const));
  const claimed = new Set<string>();
  const seenGroups = new Set<string>();
  const groups: CharlesReviewGroup<P>[] = [];
  for (const item of items) {
    if (!item.payload || item.payload.kind !== "charles" || !item.payload.groupId || seenGroups.has(item.payload.groupId)) continue;
    const outputs = [...(item.payload.outputs || [])].sort(charlesOutputOrder);
    const drafted = outputs.map((output) => (output.postId && !claimed.has(output.postId) ? byId.get(output.postId) : undefined)).filter((post): post is P => Boolean(post));
    if (!drafted.length || !drafted.some((post) => visibleIds.has(post.id))) continue;
    // Claim the group only once a row actually yields outputs, so a duplicate row that carries the
    // drafts is not shadowed by an earlier empty one.
    seenGroups.add(item.payload.groupId);
    for (const post of drafted) claimed.add(post.id);
    const essay = drafted.find((post) => post.type === "essay") || null;
    const others = drafted.filter((post) => post !== essay);
    const approved = drafted.filter((post) => post.status === "approve").length;
    const offPage = drafted.filter((post) => !visibleIds.has(post.id)).length;
    const title = ((titleFor ? titleFor(item.captureId) : "") || "").replace(/\s+/g, " ").trim().slice(0, 90) || "(captured thought)";
    groups.push({
      key: item.payload.groupId, groupId: item.payload.groupId, captureId: item.captureId, title,
      summary: outputsSummary(item.state, outputs.length, drafted.length, approved, offPage),
      essay, others, outputs: essay ? [essay, ...others] : others,
    });
  }
  for (const post of posts) {
    if (claimed.has(post.id) || !visibleIds.has(post.id)) continue;
    groups.push({
      key: "post:" + post.id, groupId: null, captureId: null, title: post.id, summary: "legacy draft · no capture group",
      essay: post.type === "essay" ? post : null, others: post.type === "essay" ? [] : [post], outputs: [post],
    });
  }
  return groups;
}

export interface CharlesOutputHtml {
  id: string;
  /** Pre-escaped fragments: the caller owns per-output header, body, actions, and history HTML. */
  head: string;
  body: string;
  actions: string;
}

function attr(value: string): string {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The group container skeleton. The essay, when present, sits first in its own bounded scroll
 * window (`.charles-essay-window`, max-height + overflow-y:auto in page.ts's CSS) with a
 * `.charles-focus` trigger that opens the shared focus dialog for editing; the shorter outputs stack
 * below it as siblings inside `.charles-group-stack`. A group with no essay renders only the stack.
 */
export function charlesGroupHtml(group: { key: string; groupId: string | null; title: string; summary: string }, essay: CharlesOutputHtml | null, others: CharlesOutputHtml[]): string {
  const output = (o: CharlesOutputHtml, isEssay: boolean) =>
    '<article class="charles-output' + (isEssay ? " charles-output-essay" : "") + '" data-charles-output="' + attr(o.id) + '">' + o.head +
      (isEssay
        ? '<div class="charles-essay-window charles-body">' + o.body + '</div><div class="actions" style="margin-top:8px"><button type="button" class="charles-focus" data-act="focus">Open in focus mode</button></div>'
        : '<div class="charles-body">' + o.body + '</div>') +
      o.actions + '</article>';
  return '<section class="charles-group" data-group-key="' + attr(group.key) + '"' + (group.groupId ? ' data-group-id="' + attr(group.groupId) + '"' : "") + '>' +
    '<header class="charles-group-head"><span class="wb-label">' + (group.groupId ? "GROUP" : "DRAFT") + ' · ' + attr(group.title) + '</span><span class="src">' + attr(group.summary) + '</span></header>' +
    (essay ? output(essay, true) : "") +
    (others.length ? '<div class="charles-group-stack">' + others.map((o) => output(o, false)).join("") + '</div>' : "") +
    '</section>';
}
