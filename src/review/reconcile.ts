import type { QueueRow } from "../publish/queue.js";
import { TEXT_PLATFORMS, type TypefullyScheduled } from "../publish/typefully.js";
import { isQuoteCardRow } from "../publish/cards.js";
import { isTikTokRow } from "../publish/tiktok.js";
import type { PostPeerPost } from "../publish/postpeer-status.js";
import { fmtLa } from "../publish/slots.js";

// Live Typefully/PostPeer schedule reconciliation for the review GUI (read-only — never pushes or
// cancels anything).
//
// CORRELATION STRATEGY: review-queue.md rows and publish-log.md never store a provider draft/post
// id (readQueue()'s QueueRow has no such field — see src/publish/queue.ts). The only place a
// provider ref is persisted at all is the free-text line publish-log.md's appendPublishLog() writes
// at schedule time, keyed by row id — so every provider is matched the same way: findLoggedRef
// parses the most recently logged ref for the row (`typefully draft <id>`, `postpeer post <id>`, or
// `upload-post job <id>` — see typefully.ts, tiktok.ts, and, for quote-cards scheduled before the
// 2026-07-08 Typefully rewire, cards.ts's old PostPeer/Upload-Post log lines), then we check whether
// that exact id still shows up in the relevant provider's live list (matched by provider-assigned
// id, never by the row-derived draft title — row ids like "x-1" repeat across content folders, so
// title alone can't disambiguate which folder's row a live draft belongs to).
// A row with no logged ref, or whose logged ref isn't found live, is a mismatch — that's the
// unscheduled/drifted case this reconciliation exists to flag. A row logged via a provider this
// module has no live check for (e.g. the retired Upload-Post card failover) is "unavailable", not a
// false "mismatch" — it just means this check can't confirm it either way.
//
// Quote-cards (2026-07-08): cards.ts now ships x/linkedin/bluesky cards as native Typefully drafts,
// same as text — so a card row reconciles via the Typefully branch below UNLESS its most recently
// logged ref is still a PRE-rewire PostPeer/Upload-Post line (real historical data — e.g.
// content/2026-06-16-building-an-innovation-nation/publish-log.md), in which case it falls through
// to the legacy PostPeer branch so old published cards don't misreport a false mismatch.

export type ReconcileState = "scheduled" | "mismatch" | "not-applicable" | "unavailable";

export interface ReconciledStatus {
  provider: "typefully" | "postpeer" | "upload-post" | null;
  state: ReconcileState;
  when?: string; // human PT label, from the provider's live data — the source of truth, not a cached guess
  reason?: string;
}

export interface LiveProviderState {
  typefullyDrafts: TypefullyScheduled[] | null; // null = fetch failed / credentials missing
  typefullyError?: string;
  postpeerPosts: PostPeerPost[] | null;
  postpeerError?: string;
}

// publish-log.md's text for one folder, read once per /api/queue call (see src/review/serve.ts).
// `error` carries a non-ENOENT read failure (permissions, fd exhaustion, ...) so reconcileRow can
// report "unavailable" instead of silently treating an unreadable log the same as "never logged".
export interface PublishLogRead {
  text: string;
  error?: string;
}

// Rows Muxin has approved: "approve" (approval clicked, may not have actually scheduled yet — e.g.
// the auto-scheduler failed) or "published" (the GUI/CLI publisher believes it scheduled this row).
// Both are worth checking against the live provider — a "published" row can still drift if its
// draft/post was later cancelled or deleted outside this pipeline.
const APPROVED_STATUSES = new Set(["approve", "published"]);

export function needsReconciliation(row: QueueRow): boolean {
  if (!APPROVED_STATUSES.has(row.status)) return false;
  return TEXT_PLATFORMS.has(row.platform) || isQuoteCardRow(row.platform) || isTikTokRow(row.platform);
}

export interface LoggedRef {
  provider: "typefully" | "postpeer" | "upload-post";
  refId: string;
}

// Parse a folder's publish-log.md text for the MOST RECENT logged provider ref for one row id.
// Every appendPublishLog() line has the shape `- <ISO> — <rowId> → ...`; the provider ref rides in
// free text after that (`typefully draft <id>`, `postpeer post <id>`, or `upload-post job <id>`) —
// see typefully.ts (createDraft), tiktok.ts (scheduleToTikTok), cards.ts (publishCards). Pure string
// parsing, no fs here — the caller supplies the log text. A row-matching line whose ref format isn't
// recognized RESETS `found` to null rather than leaving an earlier ref in place — otherwise a row
// rescheduled through a provider
// this parser doesn't recognize (e.g. postpeer → upload-post) would silently keep reporting its
// stale, superseded ref instead of reflecting what actually happened most recently.
export function findLoggedRef(logText: string, rowId: string): LoggedRef | null {
  const rowRe = /^-\s+\S+\s+—\s+(\S+)\s+→\s+/;
  let found: LoggedRef | null = null;
  for (const line of logText.split("\n")) {
    const m = line.match(rowRe);
    if (!m || m[1] !== rowId) continue;
    const draftM = line.match(/typefully draft (\S+)/);
    const postM = line.match(/postpeer post (\S+)/);
    const uploadM = line.match(/upload-post job (\S+)/);
    if (draftM) found = { provider: "typefully", refId: draftM[1] };
    else if (postM) found = { provider: "postpeer", refId: postM[1] };
    else if (uploadM) found = { provider: "upload-post", refId: uploadM[1] };
    else found = null;
  }
  return found;
}

// A row the reuse guard silently skipped at schedule time never gets logged to publish-log.md at
// all (see src/review/serve.ts's scheduleApproved), so it falls into the generic "no logged
// Typefully draft id" mismatch below — which reads as broken/lost, not "temporarily blocked, will
// resolve itself". scheduleApproved persists the reuse-guard reason into the row's own notes column
// in this exact shape when that happens; detect it here and report a live day-count instead. Pure:
// only reads the row's own notes string and does date arithmetic, no fs/network — same contract as
// the rest of this module.
const REUSE_GUARD_NOTE = /blocked by reuse guard, last placed to (\S+) (\S+) \(min_reuse_days: (\d+)\)/;

function reuseGuardEligibility(notes: string): string | null {
  const m = notes.match(REUSE_GUARD_NOTE);
  if (!m) return null;
  const [, platform, lastPlacedIso, minDaysStr] = m;
  const lastMs = Date.parse(lastPlacedIso);
  if (Number.isNaN(lastMs)) return null;
  const minDays = Number(minDaysStr);
  const daysSince = (Date.now() - lastMs) / 86_400_000;
  const daysRemaining = Math.ceil(minDays - daysSince);
  if (daysRemaining <= 0) return null; // window has actually elapsed since — let the normal mismatch stand
  return `blocked by reuse guard for ${platform}, eligible again in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
}

// fmtLa throws on an invalid/unparseable date (Intl.DateTimeFormat rejects an Invalid Date) — a
// single malformed timestamp from either provider must degrade this ONE row, never crash the whole
// /api/queue response (there's no per-row error boundary above this call). Returns undefined rather
// than throwing when `iso` is missing or unparseable.
function safeWhen(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return fmtLa(d);
}

// Reconcile ONE row against the live provider state already fetched (fetch once per /api/queue
// call, matched here per row — see src/review/serve.ts). Pure/sync: no network, no fs.
export function reconcileRow(row: QueueRow, publishLog: PublishLogRead, live: LiveProviderState): ReconciledStatus {
  if (!needsReconciliation(row)) return { provider: null, state: "not-applicable" };
  // Text rows and quote-cards both schedule through Typefully now (cards.ts, 2026-07-08 rewire).
  // Only TikTok is left on PostPeer.
  const throughTypefully = TEXT_PLATFORMS.has(row.platform) || isQuoteCardRow(row.platform);
  const provider = throughTypefully ? "typefully" : "postpeer";
  if (publishLog.error) {
    return { provider, state: "unavailable", reason: publishLog.error };
  }
  const logged = findLoggedRef(publishLog.text, row.id);

  // A quote-card row's MOST RECENT log line is still a pre-rewire PostPeer/Upload-Post entry (old
  // published data) — reconcile it via the legacy branch below instead of reporting a false
  // "no logged Typefully draft id" mismatch on a row that was never meant to have one.
  const legacyCardLog = isQuoteCardRow(row.platform) && logged && logged.provider !== "typefully";

  if (throughTypefully && !legacyCardLog) {
    if (live.typefullyDrafts === null) {
      return { provider: "typefully", state: "unavailable", reason: live.typefullyError ?? "could not reach Typefully" };
    }
    if (!logged || logged.provider !== "typefully") {
      const reuseReason = reuseGuardEligibility(row.notes ?? "");
      if (reuseReason) {
        return { provider: "typefully", state: "mismatch", reason: reuseReason };
      }
      return { provider: "typefully", state: "mismatch", reason: "no logged Typefully draft id found for this row" };
    }
    const match = live.typefullyDrafts.find((d) => d.id === logged.refId);
    if (!match) {
      return { provider: "typefully", state: "mismatch", reason: "no matching scheduled draft found in Typefully" };
    }
    return { provider: "typefully", state: "scheduled", when: safeWhen(match.whenIso) };
  }

  // isTikTokRow — schedules through PostPeer. Legacy quote-card rows (legacyCardLog above) can also
  // land here: pre-rewire cards could fail over to Upload-Post (config/providers.yaml `image_post`,
  // now retired), which this module has no live check for — report "unavailable" for that case
  // instead of a false "mismatch" drift alarm.
  if (logged?.provider === "upload-post") {
    return {
      provider: "upload-post",
      state: "unavailable",
      reason:
        "scheduled via the retired upload-post failover (no live adapter since PR #130). Check/cancel by hand at upload-post.com",
    };
  }
  if (live.postpeerPosts === null) {
    return { provider: "postpeer", state: "unavailable", reason: live.postpeerError ?? "could not reach PostPeer" };
  }
  if (!logged || logged.provider !== "postpeer") {
    return { provider: "postpeer", state: "mismatch", reason: "no scheduled PostPeer post recorded for this row" };
  }
  const match = live.postpeerPosts.find((p) => p.id === logged.refId);
  if (!match) {
    return { provider: "postpeer", state: "mismatch", reason: `logged PostPeer post ${logged.refId} not found in the live scheduled posts` };
  }
  return {
    provider: "postpeer",
    state: "scheduled",
    when: safeWhen(match.scheduledFor),
  };
}
