import type { QueueRow } from "../publish/queue.js";
import { TEXT_PLATFORMS, type TypefullyScheduled } from "../publish/typefully.js";
import { isQuoteCardRow } from "../publish/cards.js";
import { isTikTokRow } from "../publish/tiktok.js";
import type { PostPeerPost } from "../publish/postpeer-status.js";
import type { PostizPost } from "../publish/postiz.js";
import { fmtLa } from "../publish/slots.js";
import type { DeliveryProvider, DeliveryState } from "./delivery-event.js";
import type { PublishingStatus } from "./publishing-status.js";

// Live Typefully/PostPeer schedule reconciliation for the review GUI (read-only — never pushes or
// cancels anything).
//
// CORRELATION STRATEGY: review-queue.md rows and publish-log.md never store a provider draft/post
// id (readQueue()'s QueueRow has no such field — see src/publish/queue.ts). The only place a
// provider ref is persisted at all is the free-text line publish-log.md's appendPublishLog() writes
// at schedule time, keyed by row id — so every provider is matched the same way: findLoggedRef
// parses the most recently logged ref for the row (`typefully draft <id>`, `postpeer post <id>`,
// `postiz post <id>`, or `upload-post job <id>` — see typefully.ts, tiktok.ts, and, for quote-cards scheduled before the
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
  provider: DeliveryProvider | null;
  state: ReconcileState;
  deliveryState?: DeliveryState;
  providerObjectId?: string;
  providerAccountId?: string | null;
  canonicalUrl?: string;
  providerUpdatedAt?: string;
  providerPublishedAt?: string;
  when?: string; // human PT label, from the provider's live data — the source of truth, not a cached guess
  reason?: string;
}

export interface LiveProviderState {
  typefullyDrafts: TypefullyScheduled[] | null; // null = fetch failed / credentials missing
  typefullyError?: string;
  postpeerPosts: PostPeerPost[] | null;
  postpeerError?: string;
  // Postiz posts looked up for the refs this pass actually needed (src/review/rows.ts).
  // undefined = not fetched yet this cycle, null = fetch failed / credentials missing. Both are
  // "no evidence", and both report "unavailable" below, never a mismatch.
  postizPosts?: PostizPost[] | null;
  postizError?: string;
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

// Postiz statuses that mean the post still exists AND has not fired yet, so cancelling it is the
// repair Muxin actually wants. "published" is deliberately NOT here: page.ts renders
// "✕ Cancel scheduled post" on exactly state === "scheduled", and that button soft-deletes through
// cancelPostizPost, so admitting an already-live post here would offer to delete a post that is
// already out under Muxin's byline, with no undo.
const POSTIZ_CANCELABLE_STATUSES = new Set(["draft", "scheduled", "private"]);

export function needsReconciliation(row: QueueRow): boolean {
  if (!APPROVED_STATUSES.has(row.status)) return false;
  return TEXT_PLATFORMS.has(row.platform) || isQuoteCardRow(row.platform) || isTikTokRow(row.platform);
}

export interface LoggedRef {
  provider: "typefully" | "postpeer" | "postiz" | "upload-post";
  refId: string;
  /** The ISO stamp appendPublishLog wrote on the line, i.e. when this row was scheduled. */
  loggedAt?: string;
  /** The planned publish time recovered from the line's human PT label, when it carries one. */
  plannedAt?: string;
}

// appendPublishLog writes the planned time as a human PT label from fmtLa (src/publish/slots.ts):
// "Sat, Sep 12, 6:30 PM PT". It carries no year, so the year is taken from the line's own ISO stamp.
// This exists for ONE consumer: Postiz has no read-by-id route, only a publish-date window list, so
// a lookup centered on "now" silently misses a post planned further out than that window and the
// row can then never be confirmed or cancelled. The CLI reconciler centers on the planned time the
// same way (provider-status-reconciliation.ts passes status.plannedFor).
const PT_LABEL = /\b[A-Z][a-z]{2}, ([A-Z][a-z]{2}) (\d{1,2}), (\d{1,2}):(\d{2})\s?(AM|PM) PT\b/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function plannedAtFromLogLine(line: string, loggedAtIso: string | undefined): string | undefined {
  const anchor = loggedAtIso ? Date.parse(loggedAtIso) : NaN;
  if (!Number.isFinite(anchor)) return undefined;
  const m = line.match(PT_LABEL);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1]);
  if (month < 0) return undefined;
  const day = Number(m[2]);
  const minute = Number(m[4]);
  let hour = Number(m[3]) % 12;
  if (m[5] === "PM") hour += 12;
  // Pick the year whose result sits closest to when the line was written: a row is always scheduled
  // shortly before its planned time, and this also handles a December to January rollover. PT's real
  // offset (PST vs PDT) is deliberately approximated at -08:00, because the only consumer is a
  // 90-day-wide lookup window that one hour cannot move.
  const baseYear = new Date(anchor).getUTCFullYear();
  let best = Number.NaN;
  for (const year of [baseYear - 1, baseYear, baseYear + 1]) {
    const candidate = Date.UTC(year, month, day, hour + 8, minute);
    if (Number.isNaN(best) || Math.abs(candidate - anchor) < Math.abs(best - anchor)) best = candidate;
  }
  return new Date(best).toISOString();
}

// Parse a folder's publish-log.md text for the MOST RECENT logged provider ref for one row id.
// Every appendPublishLog() line has the shape `- <ISO> — <rowId> → ...`; the provider ref rides in
// free text after that (`typefully draft <id>`, `postpeer post <id>`, `postiz post <id>`, or
// `upload-post job <id>`) — see typefully.ts (createDraft), tiktok.ts (scheduleToTikTok),
// cards.ts (publishCards), studio-scheduling.ts (the Studio Postiz scheduler). Pure string
// parsing, no fs here — the caller supplies the log text. A row-matching line whose ref format isn't
// recognized RESETS `found` to null rather than leaving an earlier ref in place — otherwise a row
// rescheduled through a provider
// this parser doesn't recognize (e.g. postpeer → upload-post) would silently keep reporting its
// stale, superseded ref instead of reflecting what actually happened most recently.
export function findLoggedRef(logText: string, rowId: string): LoggedRef | null {
  const rowRe = /^-\s+(\S+)\s+—\s+(\S+)\s+→\s+/;
  let found: LoggedRef | null = null;
  for (const line of logText.split("\n")) {
    const m = line.match(rowRe);
    if (!m || m[2] !== rowId) continue;
    const loggedAt = m[1];
    const draftM = line.match(/typefully draft (\S+)/);
    const postM = line.match(/postpeer post (\S+)/);
    const postizM = line.match(/postiz post (\S+)/);
    const uploadM = line.match(/upload-post job (\S+)/);
    if (draftM) found = { provider: "typefully", refId: draftM[1] };
    else if (postM) found = { provider: "postpeer", refId: postM[1] };
    else if (postizM) {
      const plannedAt = plannedAtFromLogLine(line, loggedAt);
      found = { provider: "postiz", refId: postizM[1], loggedAt, ...(plannedAt ? { plannedAt } : {}) };
    }
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
//
// This reader covers the REFUSAL case only, which is the one the guard still produces: re-placing
// the SAME row inside its platform's `min_reuse_days`. The guard's other window, a DIFFERENT
// derivative of the same piece inside `min_variant_days`, is a deferral, not a refusal: that row is
// scheduled past the window and never lands here with a blocked note at all. The deferral's own
// wording deliberately carries neither "blocked by reuse guard" nor "min_reuse_days", so it cannot
// be mistaken for a refusal and reported with a countdown it does not have.
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
function reconcileAuthoritative(status: PublishingStatus): ReconciledStatus {
  const normalized = status.state === "scheduling" || status.state === "scheduled" ? "planned"
    : status.state === "cleared" ? "canceled" : status.state;
  const deliveryState = normalized as DeliveryState;
  const common = {
    provider: status.provider,
    deliveryState,
    ...(status.providerObjectId ?? status.ref ? { providerObjectId: status.providerObjectId ?? status.ref } : {}),
    ...(status.providerAccountId !== undefined ? { providerAccountId: status.providerAccountId } : {}),
    ...(status.canonicalUrl ? { canonicalUrl: status.canonicalUrl } : {}),
    ...(status.providerUpdatedAt ? { providerUpdatedAt: status.providerUpdatedAt } : {}),
    ...(status.providerPublishedAt ? { providerPublishedAt: status.providerPublishedAt } : {}),
  };
  if (deliveryState === "planned" || deliveryState === "delivered" || deliveryState === "live" || deliveryState === "private") {
    return { ...common, state: "scheduled", when: safeWhen(status.providerPublishedAt ?? status.plannedFor) };
  }
  if (deliveryState === "uncertain") return { ...common, state: "unavailable", reason: status.error ?? "provider outcome is uncertain" };
  return { ...common, state: "mismatch", reason: status.error ?? `authoritative delivery event is ${deliveryState}` };
}

export function reconcileRow(
  row: QueueRow,
  publishLog: PublishLogRead,
  live: LiveProviderState,
  publishingStatus?: PublishingStatus,
): ReconciledStatus {
  if (!needsReconciliation(row)) return { provider: null, state: "not-applicable" };
  // The structured append-only event is authoritative. Free-text parsing below exists only for
  // pre-event history and is deliberately marked unavailable when its provider cannot be checked.
  if (publishingStatus) return reconcileAuthoritative(publishingStatus);
  // Text rows and quote-cards both schedule through Typefully now (cards.ts, 2026-07-08 rewire).
  // Only TikTok is left on PostPeer.
  const throughTypefully = TEXT_PLATFORMS.has(row.platform) || isQuoteCardRow(row.platform);
  const provider = throughTypefully ? "typefully" : "postpeer";
  if (publishLog.error) {
    return { provider, state: "unavailable", reason: publishLog.error };
  }
  const logged = findLoggedRef(publishLog.text, row.id);

  // Postiz (src/review/studio-scheduling.ts logs `postiz post <id>`) is matched the same way, by
  // provider-assigned id, and is checked BEFORE the platform-derived typefully/postpeer split: a
  // Postiz-scheduled bluesky/threads/x row is a text platform, so without this it would fall into
  // the Typefully branch and report a false "no logged Typefully draft id" mismatch.
  //
  // Postiz has no read-by-id route. The only read it offers is a publish-date window list, and a
  // deleted post is soft-deleted and filtered out of that list, so absence there cannot tell a live
  // post from a canceled, deleted, or never-created one. Absence is reported as "unavailable" and
  // never as a mismatch or a confirmed cancellation, the same posture the CLI reconciler takes
  // (src/review/provider-status-reconciliation.ts).
  if (logged?.provider === "postiz") {
    const base = { provider: "postiz" as const, providerObjectId: logged.refId };
    if (live.postizPosts === null || live.postizPosts === undefined) {
      return {
        ...base,
        state: "unavailable",
        deliveryState: "uncertain",
        reason: live.postizError ?? "could not reach Postiz",
      };
    }
    const match = live.postizPosts.find((p) => p.id === logged.refId);
    if (!match) {
      return {
        ...base,
        state: "unavailable",
        deliveryState: "uncertain",
        reason:
          "Postiz did not list this post. Postiz hides deleted posts from that list, so absence cannot tell a live post from a canceled one. Check it by hand in Postiz.",
      };
    }
    if (match.status === "unknown") {
      return {
        ...base,
        state: "unavailable",
        deliveryState: "uncertain",
        reason: "Postiz listed this post with a status this pipeline does not recognize",
      };
    }
    // Already live. There is nothing scheduled left to cancel, so this must not reach "scheduled".
    if (match.status === "published") {
      return {
        ...base,
        state: "unavailable",
        deliveryState: "live",
        ...(match.accountId ? { providerAccountId: match.accountId } : {}),
        ...(match.url ? { canonicalUrl: match.url } : {}),
        reason: "Postiz already published this post, so there is no scheduled post left to cancel",
      };
    }
    if (!POSTIZ_CANCELABLE_STATUSES.has(match.status)) {
      return { ...base, state: "mismatch", reason: `Postiz reports this post as ${match.status}` };
    }
    return {
      ...base,
      state: "scheduled",
      ...(match.accountId ? { providerAccountId: match.accountId } : {}),
      when: safeWhen(match.scheduledAt ?? undefined),
    };
  }

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
