import { basename, join } from "node:path";
import { readFileSync } from "node:fs";
import { type QueueRow } from "../publish/queue.js";
import { publishText, TEXT_PLATFORMS } from "../publish/typefully.js";
import { publishCards, isQuoteCardRow, cardTarget, basePlatform } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { publishSubstack, isSubstackRow } from "../publish/substack.js";
import { checkReuse } from "../publish/reuse-guard.js";
import { lockOutreachMessageRow } from "../outreach/lock.js";
import { assertProviderDispatch, resolveDeliveryIntent, resolveDeliveryPolicy, writeReadyToPaste, type DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { claimSlots } from "../publish/slots.js";
import {
  createPostizPost,
  createPostizTransport,
  fetchPostizCapabilities,
  resolveConfiguredPostizCapability,
  selectDeliveryRoute,
  type DeliveryRoute,
  type PostizCapability,
  type PostizCapabilityRegistry,
  type PostizDestination,
  type PostizMedia,
  type PostizTransport,
} from "../publish/postiz.js";

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
  fetchPostizRegistry?: () => Promise<PostizCapabilityRegistry>;
  publishPostiz?: (folder: string, row: QueueRow, capability: PostizCapability, policy: DeliveryPolicyDecision) => Promise<unknown>;
  postizEnv?: NodeJS.ProcessEnv;
}
const DEFAULT_SCHEDULER_DEPS: SchedulerDeps = {
  publishText,
  publishCards,
  publishTikTok,
  publishShorts,
  publishSubstack,
  lockOutreachMessage: lockOutreachMessageRow,
};

export interface SelectedSchedulingProvider {
  provider: Exclude<DeliveryRoute, "unsupported">;
  postizCapability?: PostizCapability;
}

function postizShape(row: QueueRow): { destination: PostizDestination; media: PostizMedia } | null {
  const destination = (isQuoteCardRow(row.platform) ? cardTarget(row.platform) ?? basePlatform(row.platform) : row.platform) as PostizDestination;
  if (!["x", "linkedin", "bluesky", "mastodon", "threads", "tiktok", "youtube", "substack"].includes(destination)) return null;
  const media: PostizMedia = row.format === "image" ? "image" : row.format === "video" || row.format === "short" ? "video" : "text";
  return { destination, media };
}

function legacyProvider(kind: ScheduleKind): SelectedSchedulingProvider {
  return { provider: kind === "text" || kind === "card" ? "typefully" : kind === "tiktok" ? "postpeer" : kind === "video" ? "youtube" : "substack" };
}

/** Discover configured Postiz support first; fallback is allowed only after an authoritative unsupported result. */
export async function selectConfiguredProvider(row: QueueRow, deps: Pick<SchedulerDeps, "fetchPostizRegistry" | "postizEnv"> = {}): Promise<SelectedSchedulingProvider> {
  const kind = scheduleKind(row);
  if (!kind || kind === "outreach-lock") return { provider: "manual" as never };
  const shape = postizShape(row);
  const env = deps.postizEnv ?? process.env;
  const configured = Boolean(deps.fetchPostizRegistry || (env.POSTIZ_BASE_URL?.trim() && env.POSTIZ_API_KEY?.trim()));
  if (!configured || !shape) return legacyProvider(kind);
  let registry: PostizCapabilityRegistry;
  try {
    registry = deps.fetchPostizRegistry
      ? await deps.fetchPostizRegistry()
      : await fetchPostizCapabilities(createPostizTransport(env));
  } catch (error) {
    // A transport/config failure is not authoritative evidence that Postiz lacks the capability.
    // Fail closed so an ambiguous discovery result cannot silently bypass the Postiz-first route.
    throw new Error(`Postiz capability discovery failed; provider route is uncertain: ${error instanceof Error ? error.message : String(error)}`);
  }
  const requiresLocalMediaUpload = shape.media !== "text" && !/^https?:\/\//.test(row.asset);
  const route = selectDeliveryRoute(registry, shape.destination, shape.media, { requiresLocalMediaUpload });
  if (route === "unsupported") throw new Error(`no delivery provider supports ${shape.destination}/${shape.media}`);
  if (route !== "postiz") return { provider: route };
  return { provider: "postiz", postizCapability: resolveConfiguredPostizCapability(registry, shape.destination, shape.media, env) };
}

async function defaultPublishPostiz(folder: string, row: QueueRow, capability: PostizCapability, policy: DeliveryPolicyDecision): Promise<unknown> {
  assertProviderDispatch(folder, "postiz", policy);
  const shape = postizShape(row);
  if (!shape) throw new Error(`Postiz does not recognize destination/media for ${row.id}`);
  if (shape.media !== "text" && !/^https?:\/\//.test(row.asset)) throw new Error("Postiz local media upload was selected without an implemented registration adapter");
  const path = join(folder, row.asset);
  const raw = shape.media === "text" ? readFileSync(path, "utf8") : row.notes;
  const content = row.asset.endsWith(".md") ? splitFrontmatter(raw).body.trim() : raw.trim() || row.id;
  const { times, labels } = claimSlots({ windowKey: shape.destination, conflictPlatforms: [shape.destination], count: 1, asset: row.asset, by: "postiz" });
  if (!times[0] || times[0] === "next-free-slot") throw new Error(`Postiz requires an explicit future slot for ${shape.destination}`);
  const transport: PostizTransport = createPostizTransport();
  const post = await createPostizPost(transport, {
    destination: shape.destination,
    accountId: capability.accountId,
    content,
    scheduledAt: times[0],
    visibility: "scheduled",
    ...(shape.media !== "text" && /^https?:\/\//.test(row.asset) ? { mediaUrls: [row.asset] } : {}),
  });
  return {
    id: row.id, platform: shape.destination, when: labels[0], ref: post.id,
    providerObjectId: post.id, providerAccountId: capability.accountId,
    canonicalUrl: post.url ?? undefined, plannedFor: post.scheduledAt ?? times[0],
    providerCreatedAt: post.createdAt ?? undefined, providerUpdatedAt: post.updatedAt ?? undefined,
    providerPublishedAt: post.publishedAt ?? undefined, status: post.status, policyVersion: policy.policyVersion,
  };
}

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
  let selected: SelectedSchedulingProvider | undefined;
  if (kind !== "outreach-lock") {
    // Blocked/manual origin policy is provider-independent and must run before any capability
    // discovery. Besides being faster, this guarantees those origins make zero network calls.
    // Use the legacy route only as a provisional provider name; provider-authorized origins are
    // resolved again below after the actual Postiz-first route is known.
    const provisionalProvider = legacyProvider(kind).provider;
    const provisionalPolicy = policyDecision
      ?? (deps.resolveDeliveryPolicy
        ? deps.resolveDeliveryPolicy(folder, provisionalProvider)
        : resolveDeliveryIntent(folder, provisionalProvider));
    if (provisionalPolicy.mode === "blocked") {
      return { scheduled: null, scheduleError: `delivery policy blocked: ${provisionalPolicy.reason}` };
    }
    if (provisionalPolicy.mode === "manual") {
      return { scheduled: writeReadyToPaste(folder, row, provisionalPolicy), scheduleError: null };
    }
    // Injected scheduler dependencies are a hermetic test/embedding seam. They opt into Postiz
    // only by supplying an explicit registry or env; ambient credentials must not trigger network.
    const providerDeps = deps === DEFAULT_SCHEDULER_DEPS || deps.fetchPostizRegistry || deps.postizEnv
      ? deps
      : { ...deps, postizEnv: {} };
    try {
      selected = policyDecision?.provider === "postiz"
        ? await selectConfiguredProvider(row, providerDeps)
        : policyDecision ? { provider: policyDecision.provider as SelectedSchedulingProvider["provider"] } : await selectConfiguredProvider(row, providerDeps);
    }
    catch (e) { return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) }; }
    const provider = selected.provider;
    const policy = policyDecision ?? (deps.resolveDeliveryPolicy && provider === provisionalProvider
      ? provisionalPolicy
      : (deps.resolveDeliveryPolicy ?? resolveDeliveryPolicy)(folder, provider));
    if (policy.mode === "blocked") return { scheduled: null, scheduleError: `delivery policy blocked: ${policy.reason}` };
    if (policy.mode === "manual") return { scheduled: writeReadyToPaste(folder, row, policy), scheduleError: null };
    if (!policy.providerAccountId) return { scheduled: null, scheduleError: "delivery policy blocked: provider account mapping is missing" };
    if (provider === "postiz") {
      const capability = selected.postizCapability;
      if (!capability) return { scheduled: null, scheduleError: "configured Postiz capability was not retained for scheduling" };
      try {
        return { scheduled: await (deps.publishPostiz ?? defaultPublishPostiz)(folder, row, capability, policy), scheduleError: null };
      } catch (e) { return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) }; }
    }
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
