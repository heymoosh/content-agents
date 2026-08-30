import { basename } from "node:path";
import { type QueueRow } from "../publish/queue.js";
import { publishText, TEXT_PLATFORMS } from "../publish/typefully.js";
import { publishCards, isQuoteCardRow, cardTarget, basePlatform } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { publishSubstack, isSubstackRow } from "../publish/substack.js";
import { checkReuse } from "../publish/reuse-guard.js";
import { lockOutreachMessageRow } from "../outreach/lock.js";
import { resolveDeliveryPolicy, writeReadyToPaste, type DeliveryPolicyDecision } from "../publish/delivery-policy.js";

// Approve → auto-schedule routing. Which platform scheduler an approved row belongs to. Each check
// calls the OWNING publisher's own exported predicate (isQuoteCardRow, isTikTokRow, isShortRow,
// TEXT_PLATFORMS) instead of re-encoding that publisher's row filter here a second time — so this
// can't silently drift out of sync if a publisher's own definition of "which rows are mine" changes:
//   text (x/linkedin/bluesky, incl. native-video posts) → Typefully (publishText)
//   quote-card / quote-card:<target>                     → cards.ts   (publishCards)
//   tiktok                                               → tiktok.ts  (publishTikTok → scheduleToTikTok)
//   YouTube Short (platform youtube OR format short)     → youtube.ts (publishShorts)
//   substack                                             → substack.ts (publishSubstack)
//   outreach-message (any channel)                       → outreach/lock.ts (lockOutreachMessageRow)
//     -- NOT a scheduler at all (CLAUDE.md rule 2 analog): Approve on this row kind means LOCK,
//     never send/schedule anything. Routed by FORMAT (fixed), not platform, since platform here is
//     the outreach channel (email/linkedin-dm/contact-form/podcast-pitch), not a real destination.
// Returns null for a row no scheduler owns — it just gets the plain approve status (CLAUDE.md rule 2
// is preserved: the row was already set to approve; scheduling only mirrors what /publish would do).
export type ScheduleKind = "text" | "card" | "tiktok" | "video" | "substack" | "outreach-lock";
export function scheduleKind(row: QueueRow): ScheduleKind | null {
  if (TEXT_PLATFORMS.has(row.platform)) return "text";
  if (isQuoteCardRow(row.platform)) return "card";
  if (isTikTokRow(row.platform)) return "tiktok"; // checked before "video" — a tiktok row is also a short
  if (isShortRow(row.platform, row.format)) return "video";
  if (isSubstackRow(row.platform)) return "substack";
  if (row.format === "outreach-message") return "outreach-lock";
  return null;
}

// The five folder-level publish functions the dispatch routes to. Injected (default = the real ones)
// so scheduleApproved is unit-testable WITHOUT any real PostPeer / Upload-Post / YouTube / browser call.
export interface SchedulerDeps {
  publishText: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishCards: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishTikTok: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishShorts: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  publishSubstack: (folder: string, opts: { onlyIds?: string[]; deliveryPolicy?: DeliveryPolicyDecision }) => Promise<unknown[]>;
  lockOutreachMessage: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  /** Test/embedding seam; production always uses the persisted content-request origin. */
  resolveDeliveryPolicy?: typeof resolveDeliveryPolicy;
}
const DEFAULT_SCHEDULER_DEPS: SchedulerDeps = {
  publishText,
  publishCards,
  publishTikTok,
  publishShorts,
  publishSubstack,
  lockOutreachMessage: lockOutreachMessageRow,
};

// Schedule ONE approved row via its platform's existing publish function (scoped by onlyIds),
// mirroring the text path exactly: on success the row's scheduled info comes back; on failure a
// scheduleError is RETURNED (never thrown) so the row stays `approve` and the GUI shows why instead
// of silently losing the approval or crashing the request.
//
// Mirrors the platform key each publisher's own reuse-guard call site derives from a row (cards.ts:
// cardTarget/basePlatform; typefully.ts: the row's own platform; tiktok.ts/youtube.ts/substack.ts: a
// fixed platform name) — so scheduleApproved (below) can recompute the SAME checkReuse() call a
// silently-skipping publisher already made, and recover its real reason instead of a generic one.
// null for a kind the reuse guard never gates (outreach-lock).
function reuseGuardPlatform(kind: ScheduleKind, row: QueueRow): string | null {
  switch (kind) {
    case "text": return row.platform;
    case "card": return cardTarget(row.platform) ?? basePlatform(row.platform);
    case "tiktok": return "tiktok";
    case "video": return "youtube";
    case "substack": return "substack";
    default: return null;
  }
}

// A publisher can also skip a row WITHOUT throwing (the reuse guard) — it just logs a console.warn
// and returns []. That must still surface as a scheduleError, not fall through silently: `done[0]
// ?? null` alone can't tell "no scheduler owns this row" (kind === null, a genuine no-op) apart
// from "a scheduler ran but skipped this row" (kind set, done === []) — and the GUI showed a bare
// "Approved" for both.
export async function scheduleApproved(
  folder: string,
  row: QueueRow,
  deps: SchedulerDeps = DEFAULT_SCHEDULER_DEPS,
  policyDecision?: DeliveryPolicyDecision,
): Promise<{ scheduled: unknown; scheduleError: string | null }> {
  const kind = scheduleKind(row);
  if (!kind) return { scheduled: null, scheduleError: null };
  // Outreach approval locks a message and never contacts a publishing provider.
  if (kind !== "outreach-lock") {
    const provider = kind === "text" || kind === "card" ? "typefully" : kind === "tiktok" ? "postpeer" : kind === "video" ? "youtube" : "substack";
    const policy = policyDecision ?? (deps.resolveDeliveryPolicy ?? resolveDeliveryPolicy)(folder, provider);
    if (policy.mode === "blocked") return { scheduled: null, scheduleError: `delivery policy blocked: ${policy.reason}` };
    if (policy.mode === "manual") return { scheduled: writeReadyToPaste(folder, row, policy), scheduleError: null };
    if (!policy.providerAccountId) return { scheduled: null, scheduleError: "delivery policy blocked: provider account mapping is missing" };
  }
  const fn =
    kind === "text" ? deps.publishText
    : kind === "card" ? deps.publishCards
    : kind === "tiktok" ? deps.publishTikTok
    : kind === "substack" ? deps.publishSubstack
    : kind === "outreach-lock" ? deps.lockOutreachMessage
    : deps.publishShorts;
  try {
    const done = await fn(folder, { onlyIds: [row.id], ...(policyDecision ? { deliveryPolicy: policyDecision } : {}) });
    if (done.length === 0) {
      // The publisher didn't throw, so recompute the check it silently skipped on to find out WHY —
      // when it's the reuse guard, persist a machine-parseable reason (reconcile.ts's
      // reuseGuardEligibility below re-derives "eligible again in N days" from this same shape,
      // reading it back off the row's own notes, days later, with no fs/network call of its own).
      const platform = reuseGuardPlatform(kind, row);
      const reuse = platform ? checkReuse(basename(folder), platform) : { allowed: true };
      if (!reuse.allowed && reuse.lastPlacedAt !== undefined && reuse.minDays !== undefined) {
        return {
          scheduled: null,
          scheduleError: `blocked by reuse guard, last placed to ${platform} ${reuse.lastPlacedAt} (min_reuse_days: ${reuse.minDays})`,
        };
      }
      return {
        scheduled: null,
        scheduleError: "not scheduled: blocked by the reuse guard (check the server log for the reason)",
      };
    }
    return { scheduled: done[0], scheduleError: null };
  } catch (e) {
    return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
  }
}
