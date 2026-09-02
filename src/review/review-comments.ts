import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { configuredDataPathOrLegacy } from "../runtime/data-root.js";

export type ReviewCommentDomain = "fiction" | "charles";

export interface ReviewCommentInput {
  domain: ReviewCommentDomain;
  subject: string;
  body: string;
  operationId?: string;
}

export interface ReviewComment extends ReviewCommentInput {
  id: string;
  createdAt: string;
}

export const REVIEW_COMMENTS_PATH = configuredDataPathOrLegacy("review-comments.jsonl");

export function fictionReviewSubject(series: string, chapter: number): string {
  const slug = required(series, "fiction series", 160);
  if (!Number.isSafeInteger(chapter) || chapter < 1) throw new Error("fiction chapter is invalid");
  return `${slug}:chapter-${chapter}`;
}

export function charlesReviewSubject(id: string): string {
  return required(id, "Charles draft id", 160);
}

function required(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} is too long`);
  return text;
}

function validDomain(value: unknown): ReviewCommentDomain {
  if (value !== "fiction" && value !== "charles") throw new Error("review comment domain is invalid");
  return value;
}

function hasTrailingNewline(path: string): boolean {
  if (!existsSync(path) || statSync(path).size === 0) return true;
  const text = readFileSync(path, "utf8");
  return text.endsWith("\n");
}

export function appendReviewComment(input: ReviewCommentInput, path: string = REVIEW_COMMENTS_PATH): ReviewComment {
  const domain = validDomain(input.domain);
  const subject = required(input.subject, "review comment subject", 240);
  const body = required(input.body, "review comment", 5000);
  const operationId = input.operationId === undefined ? undefined : required(input.operationId, "review comment operation id", 240);
  if (operationId) {
    const existing = listReviewComments(domain, subject, path).find((item) => item.operationId === operationId);
    if (existing) {
      if (existing.body !== body) throw new Error("review comment operation id was already used for different text");
      return existing;
    }
  }
  const record: ReviewComment = {
    id: randomUUID(),
    domain, subject, body, operationId,
    createdAt: new Date().toISOString(),
  };
  mkdirSync(dirname(path), { recursive: true });
  if (!hasTrailingNewline(path)) appendFileSync(path, "\n", { encoding: "utf8", mode: 0o600 });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  return record;
}

export function appendReviewCommentSafe(
  input: ReviewCommentInput,
  path: string = REVIEW_COMMENTS_PATH,
): { comment: ReviewComment | null; warning?: string } {
  try {
    return { comment: appendReviewComment(input, path) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { comment: null, warning: `The primary action succeeded, but review history could not be saved: ${detail}` };
  }
}

export function listReviewComments(domain: ReviewCommentDomain, subject: string, path: string = REVIEW_COMMENTS_PATH): ReviewComment[] {
  const wantedDomain = validDomain(domain);
  const wantedSubject = required(subject, "review comment subject", 240);
  if (!existsSync(path)) return [];
  const out: ReviewComment[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line) as Partial<ReviewComment>;
      if (item.domain !== wantedDomain || item.subject !== wantedSubject) continue;
      if (typeof item.id !== "string" || typeof item.body !== "string" || typeof item.createdAt !== "string") continue;
      out.push(item as ReviewComment);
    } catch { /* Ignore an interrupted/truncated record; later valid appends still read. */ }
  }
  return out;
}

export function listReviewCommentsSafe(
  domain: ReviewCommentDomain,
  subject: string,
  path: string = REVIEW_COMMENTS_PATH,
): ReviewComment[] {
  return listReviewCommentsWithHealth(domain, subject, path).comments;
}

export function listReviewCommentsWithHealth(
  domain: ReviewCommentDomain,
  subject: string,
  path: string = REVIEW_COMMENTS_PATH,
): { comments: ReviewComment[]; warning?: string } {
  try { return { comments: listReviewComments(domain, subject, path) }; }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { comments: [], warning: `Review history is unavailable: ${detail}` };
  }
}
