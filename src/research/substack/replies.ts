import type { BrowserContext } from "playwright";

const SUBSTACK_API = "https://substack.com/api/v1/reader";

export interface ReplyHttpResponse {
  ok(): boolean;
  status(): number;
  json(): Promise<unknown>;
}

export interface AuthenticatedRequestContext {
  request: {
    get(url: string): Promise<ReplyHttpResponse>;
  };
}

export interface FetchedReply {
  replyId: string;
  userId: string | null;
  body: string;
  publishedAt: string | null;
  editedAt: string | null;
  parentReplyId: string | null;
  raw: unknown;
}

export interface ReplyTreeCapture {
  branches: FetchedReply[];
  flattenedReplies: FetchedReply[];
  rawPages: unknown[];
  replyBranchCountCaptured: number;
  replyObservationCountCaptured: number;
  pagesFetched: number;
}

export type ReplyTreeFailureKind =
  | "FORBIDDEN"
  | "REPEATED_CURSOR"
  | "ZERO_NEW_IDS"
  | "PAGE_CAP"
  | "PARTIAL_RESULT"
  | "HTTP_ERROR"
  | "MALFORMED_RESPONSE";

export class ReplyTreeError extends Error {
  readonly kind: ReplyTreeFailureKind;
  readonly pagesFetched: number;

  constructor(kind: ReplyTreeFailureKind, message: string, pagesFetched = 0) {
    super(message);
    this.name = "ReplyTreeError";
    this.kind = kind;
    this.pagesFetched = pagesFetched;
  }
}

interface RawComment {
  id?: string | number;
  user_id?: string | number | null;
  userId?: string | number | null;
  body?: unknown;
  date?: unknown;
  edited_at?: unknown;
  editedAt?: unknown;
  ancestor_path?: unknown;
  parent_id?: string | number | null;
}

interface RawBranch {
  comment?: RawComment;
  descendantComments?: unknown[];
}

interface RawReplyPage {
  commentBranches?: RawBranch[];
  moreBranches?: unknown;
  nextCursor?: unknown;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function idOf(comment: RawComment): string | null {
  return comment.id === undefined || comment.id === null ? null : String(comment.id);
}

function parentFromAncestorPath(comment: RawComment, branchRootId: string | null): string | null {
  if (comment.parent_id !== undefined && comment.parent_id !== null) return String(comment.parent_id);
  const path = typeof comment.ancestor_path === "string" ? comment.ancestor_path : "";
  const parts = path.split(/[\/.>,]+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : branchRootId;
}

function unwrapComment(value: unknown): RawComment {
  const object = asObject(value);
  const nested = object.comment;
  return nested && typeof nested === "object" ? (nested as RawComment) : (object as RawComment);
}

function toReply(value: unknown, branchRootId: string | null): FetchedReply {
  const comment = unwrapComment(value);
  const replyId = idOf(comment);
  if (!replyId) throw new ReplyTreeError("MALFORMED_RESPONSE", "Substack reply payload contained a comment without an id");
  return {
    replyId,
    userId: comment.user_id !== undefined && comment.user_id !== null
      ? String(comment.user_id)
      : comment.userId !== undefined && comment.userId !== null
        ? String(comment.userId)
        : null,
    body: typeof comment.body === "string" ? comment.body : "",
    publishedAt: typeof comment.date === "string" ? comment.date : null,
    editedAt:
      typeof comment.edited_at === "string"
        ? comment.edited_at
        : typeof comment.editedAt === "string"
          ? comment.editedAt
          : null,
    parentReplyId: branchRootId && replyId === branchRootId ? null : parentFromAncestorPath(comment, branchRootId),
    raw: comment,
  };
}

function moreBranchCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.length;
  if (value === true) return 1;
  return 0;
}

async function getJson(context: AuthenticatedRequestContext, url: string, pagesFetched: number): Promise<unknown> {
  let response: ReplyHttpResponse;
  try {
    response = await context.request.get(url);
  } catch (cause) {
    throw new ReplyTreeError("HTTP_ERROR", `Substack reply request failed: ${cause instanceof Error ? cause.message : String(cause)}`, pagesFetched);
  }
  if (response.status() === 403) throw new ReplyTreeError("FORBIDDEN", "Substack rejected the authenticated reply request with 403", pagesFetched);
  if (!response.ok()) throw new ReplyTreeError("HTTP_ERROR", `Substack reply request returned HTTP ${response.status()}`, pagesFetched);
  try {
    return await response.json();
  } catch (cause) {
    throw new ReplyTreeError("MALFORMED_RESPONSE", `Substack reply response was not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`, pagesFetched);
  }
}

/**
 * Walk a Note's reply tree through one authenticated BrowserContext request client.
 * The cursor is never decoded or regenerated; it is copied verbatim into the next URL.
 */
export async function fetchSubstackReplyTree(
  noteId: string,
  context: AuthenticatedRequestContext | Pick<BrowserContext, "request">,
  opts: { pageCap?: number; delayMs?: number; sleep?: (milliseconds: number) => Promise<void> } = {}
): Promise<ReplyTreeCapture> {
  const numericId = noteId.replace(/^c-/, "");
  if (!/^\d+$/.test(numericId)) throw new ReplyTreeError("MALFORMED_RESPONSE", "Substack Note id was not numeric");
  const pageCap = opts.pageCap ?? 100;
  if (pageCap < 1) throw new ReplyTreeError("PAGE_CAP", "Substack reply walk requires a positive page cap");
  const seenCursors = new Set<string>();
  const seenIds = new Map<string, FetchedReply>();
  const branchIds = new Set<string>();
  const rawPages: unknown[] = [];
  let cursor: string | undefined;
  let moreBranches = 0;
  let pagesFetched = 0;

  for (let page = 0; page < pageCap; page++) {
    if (page > 0 && opts.delayMs && opts.sleep) await opts.sleep(opts.delayMs);
    const url = new URL(`${SUBSTACK_API}/comment/${numericId}/replies`);
    url.searchParams.set("comment_id", numericId);
    if (cursor !== undefined) url.searchParams.set("cursor", cursor);

    const raw = await getJson(context, url.toString(), pagesFetched);
    rawPages.push(raw);
    pagesFetched++;
    const data = asObject(raw) as RawReplyPage;
    const pageBranches = Array.isArray(data.commentBranches) ? data.commentBranches : null;
    if (!pageBranches) throw new ReplyTreeError("MALFORMED_RESPONSE", "Substack reply response omitted commentBranches", pagesFetched);

    const before = seenIds.size;
    for (const branch of pageBranches) {
      const root = branch?.comment;
      if (!root || typeof root !== "object") throw new ReplyTreeError("MALFORMED_RESPONSE", "Substack reply response contained a branch without a comment", pagesFetched);
      const rootId = idOf(root);
      if (!rootId) throw new ReplyTreeError("MALFORMED_RESPONSE", "Substack reply response contained a branch without an id", pagesFetched);
      branchIds.add(rootId);
      const replies = [root, ...(Array.isArray(branch.descendantComments) ? branch.descendantComments : [])];
      for (const comment of replies) {
        const reply = toReply(comment, rootId);
        if (!seenIds.has(reply.replyId)) seenIds.set(reply.replyId, reply);
      }
    }

    moreBranches = moreBranchCount(data.moreBranches);
    const nextCursor = data.nextCursor === undefined || data.nextCursor === null || data.nextCursor === ""
      ? undefined
      : typeof data.nextCursor === "string"
        ? data.nextCursor
        : String(data.nextCursor);
    if (!nextCursor) {
      if (moreBranches !== 0) throw new ReplyTreeError("PARTIAL_RESULT", "Substack reply response reported more branches without a next cursor", pagesFetched);
      cursor = undefined;
      break;
    }
    if (seenCursors.has(nextCursor) || nextCursor === cursor) {
      throw new ReplyTreeError("REPEATED_CURSOR", "Substack reply response repeated an opaque cursor", pagesFetched);
    }
    if (seenIds.size === before) {
      throw new ReplyTreeError("ZERO_NEW_IDS", "Substack reply page added no new reply ids before advertising another cursor", pagesFetched);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;

    if (page + 1 >= pageCap) {
      throw new ReplyTreeError("PAGE_CAP", "Substack reply walk exhausted its page cap", pagesFetched);
    }
  }

  if (cursor !== undefined) throw new ReplyTreeError("PAGE_CAP", "Substack reply walk exhausted its page cap", pagesFetched);
  const flattenedReplies = [...seenIds.values()];
  const branches = flattenedReplies.filter((reply) => reply.parentReplyId === null);
  return {
    branches,
    flattenedReplies,
    rawPages,
    replyBranchCountCaptured: branchIds.size,
    replyObservationCountCaptured: flattenedReplies.length,
    pagesFetched,
  };
}
