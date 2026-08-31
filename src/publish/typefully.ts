import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
import { loadPlatforms } from "../config/platforms.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import {
  loadCtaConfig,
  loadCanonicalUrl,
  loadSourceKind,
  loadContentTypesConfig,
  resolveCtaLines,
  resolvePrimaryCtaDestination,
} from "./cta.js";
import { claimSlots, fmtLa, cadenceSourceFor } from "./slots.js";
import { checkReuse } from "./reuse-guard.js";
import { fetchWithRetry, type FetchRetryOptions } from "../util/fetch-retry.js";
import { assertProviderDispatch, type DeliveryPolicyDecision } from "./delivery-policy.js";

// Push approved text posts (x / linkedin / bluesky) from a content folder's review queue to
// Typefully as SCHEDULED DRAFTS — never instant publish. Each post gets an EXPLICIT publish time
// from the UNIFIED scheduler (src/publish/slots.ts + config/platforms.yaml cadence + the shared
// slot ledger), so text and cards never exceed a platform's per-day slot cap (default 1) on the same
// day — across runs and streams. Platforms without a cadence fall back to Typefully "next-free-slot".
//   tsx src/publish/typefully.ts <content-folder> | --list
// Needs TYPEFULLY_API_KEY (and optionally TYPEFULLY_SOCIAL_SET_ID) in .env.

const BASE = "https://api.typefully.com/v2";
// Exported so serve.ts's scheduleKind() routes to publishText using this SAME set, instead of
// keeping its own independently-maintained copy that could drift out of sync with this one.
export const TEXT_PLATFORMS = new Set(["x", "linkedin", "bluesky", "mastodon", "threads"]);

async function api(path: string, init?: RequestInit, retryOpts?: FetchRetryOptions): Promise<unknown> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY missing in .env (generate at typefully.com settings)");
  const res = await fetchWithRetry(
    `${BASE}${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    },
    retryOpts
  );
  if (res.status === 402) {
    throw new Error(
      "Typefully returned 402 — API drafts need a paid plan (or the account is paused). " +
        "Check typefully.com/pricing, or switch the publish path to Postiz (see docs/setup-typefully.md)."
    );
  }
  if (!res.ok) throw new Error(`typefully ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

export async function socialSetId(): Promise<string> {
  if (process.env.TYPEFULLY_SOCIAL_SET_ID) return process.env.TYPEFULLY_SOCIAL_SET_ID;
  const sets = (await api("/social-sets")) as { results?: { id: string | number; name?: string }[] } | { id: string | number }[];
  const list = Array.isArray(sets) ? sets : sets.results ?? [];
  if (list.length === 0) throw new Error("no Typefully social sets — connect your accounts at typefully.com first");
  const id = String(list[0].id);
  if (list.length > 1) {
    console.log(`multiple social sets found; using first (${id}). Pin with TYPEFULLY_SOCIAL_SET_ID in .env.`);
  }
  return id;
}

// Upload a media file (mp4/mov/png/jpg/gif) to Typefully via its presigned-S3 flow, returning the
// media_id to attach to a post. Used for native video posts (e.g. animated quote cards) and, since
// the 2026-07-08 rewire, native quote-card image posts (src/publish/cards.ts).
export async function uploadMedia(setId: string, filePath: string): Promise<string> {
  // Creates a real Typefully media object — a lost-response network error or 5xx must not retry
  // this and risk an orphaned duplicate upload consuming Typefully's media quota.
  const { media_id, upload_url } = (await api(
    `/social-sets/${setId}/media/upload`,
    { method: "POST", body: JSON.stringify({ file_name: basename(filePath) }) },
    { retryOnNetworkError: false }
  )) as { media_id?: string; upload_url?: string };
  if (!media_id || !upload_url) {
    throw new Error(`typefully media/upload returned no media_id/upload_url for ${filePath}`);
  }
  // PUT the raw bytes to the presigned URL — NO auth or content-type headers (the signature validates it).
  const put = await fetchWithRetry(upload_url, { method: "PUT", body: readFileSync(filePath) });
  if (!put.ok) {
    throw new Error(`media upload PUT failed (${basename(filePath)}): ${put.status} ${await put.text()}`);
  }
  return media_id;
}

export function loadPlatformMax(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(loadPlatforms().platforms)) out[k] = v.max_chars ?? Infinity;
  return out;
}

// Build the Typefully `posts` array, placing the CTA link(s) per config so the body stays clean.
// Returns a manual-comment string when the platform needs the link added by hand (LinkedIn).
// Exported so cards.ts (native quote-card image posts) places its CTA link identically to text
// posts instead of re-deriving reply/comment/inline placement a second time.
//
// `ctas` is a LIST (Smarter routing, card 6dcaee98): a derivative can match 2+ content types, and
// every applicable CTA stacks as its own line with a blank line between — never picking one
// winner. An empty list behaves exactly like the old "no CTA" case; a single-entry list renders
// identically to the old ctaUrl/ctaLabel contract.
export function buildPosts(
  body: string,
  ctas: { url: string; label: string }[],
  placement: string,
  max: number
): { posts: { text: string }[]; manualComment: string | null } {
  if (ctas.length === 0) return { posts: [{ text: body }], manualComment: null };
  const ctaBlock = ctas.map((c) => `${c.label} ${c.url}`.trim()).join("\n\n");

  if (placement === "comment") {
    // LinkedIn: links are suppressed in-body and the API can't post a first comment for us.
    return { posts: [{ text: body }], manualComment: ctaBlock };
  }
  if (placement === "inline") {
    const combined = `${body}\n\n${ctaBlock}`;
    if (combined.length <= max) return { posts: [{ text: combined }], manualComment: null };
    if (ctaBlock.length <= max) return { posts: [{ text: body }, { text: ctaBlock }], manualComment: null }; // would overflow → reply
    // Stacked CTAs even alone overflow max → one reply post per CTA instead of a truncated block.
    return { posts: [{ text: body }, ...ctas.map((c) => ({ text: `${c.label} ${c.url}`.trim() }))], manualComment: null };
  }
  // "reply" (X) or any unknown placement → link(s) in the first reply, split into one post per
  // CTA when 2+ stacked CTAs would overflow that platform's max as a single combined block.
  if (ctaBlock.length <= max) return { posts: [{ text: body }, { text: ctaBlock }], manualComment: null };
  return { posts: [{ text: body }, ...ctas.map((c) => ({ text: `${c.label} ${c.url}`.trim() }))], manualComment: null };
}

// Build the JSON body for POST /drafts. When `publishAt` is null we OMIT `publish_at` entirely,
// which makes Typefully save an UNSCHEDULED draft (status not "scheduled", no scheduled_date) that
// will NOT auto-post — it sits in the queue until a human schedules/publishes it. When `publishAt`
// is a value (ISO time or "next-free-slot"), the draft IS scheduled and auto-fires at that time.
// Exported so the unscheduled-draft contract is unit-testable and reused (notes-daily path).
export function buildDraftPayload(opts: {
  title: string;
  platformKey: string;
  posts: { text: string }[];
  publishAt: string | null; // null/undefined → unscheduled saved draft (no auto-post)
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    draft_title: opts.title,
    platforms: { [opts.platformKey]: { enabled: true, posts: opts.posts } },
  };
  if (opts.publishAt) payload.publish_at = opts.publishAt;
  return payload;
}

// Create a Typefully draft, retrying on "processing" (an uploaded video/image can still be
// transcoding for a few seconds after uploadMedia returns). Exported so cards.ts (native
// quote-card image posts) retries identically instead of drifting from publishText's behavior.
export async function createDraft(
  setId: string,
  payload: Record<string, unknown>
): Promise<{ id?: string | number; share_url?: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await api(
        `/social-sets/${setId}/drafts`,
        { method: "POST", body: JSON.stringify(payload) },
        // Creates a real scheduled draft — a lost-response network error OR a 5xx must not
        // retry this and risk a duplicate scheduled post landing later (a 5xx can arrive after
        // Typefully already committed the draft). Only 429 still retries (an explicit
        // rejection, never processed).
        { retryOnNetworkError: false }
      )) as { id?: string | number; share_url?: string };
    } catch (e) {
      if (attempt < 12 && /processing/i.test((e as Error).message)) {
        if (attempt === 0) console.log(`  ↳ media still transcoding, waiting…`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
  }
}

// The draft title publishText gives every row it schedules — the ONE identifier that ties a live
// Typefully draft back to a specific review-queue.md row (Typefully has no other place to stash a
// caller-supplied id). Exported so src/review/reconcile.ts matches a row to its live draft by this
// exact string instead of re-deriving the format and risking drift.
export function rowDraftTitle(rowId: string): string {
  return `${rowId} (content-agents)`;
}

// Cancel (delete) a scheduled Typefully draft, given the id createDraft returned — the same id
// logged to publish-log.md as `typefully draft <id>` and reconcile.ts's findLoggedRef/reconcileRow
// match a live draft by (see rowDraftTitle above). Used by the review GUI's "Cancel" action
// (src/review/rows.ts cancelScheduled) so a mistakenly-approved or now-stale row can actually be
// pulled from Typefully instead of only unscheduled locally.
//
// GUESS, unverified: Typefully's public docs (docs/setup-typefully.md) only cover draft creation —
// no delete-draft endpoint is documented anywhere this repo references. This follows the same REST
// shape as every other /social-sets/{setId}/drafts call above (DELETE .../drafts/{draftId}) rather
// than a confirmed endpoint. If Typefully's real API differs, the error below at least surfaces the
// actual HTTP status/body instead of failing silently — flag this for a live smoke-test before
// relying on it. Doesn't use the shared api() helper: api() always calls res.json(), which would
// throw on a DELETE's likely-empty response body.
//
// A 404 (already gone — e.g. Muxin already canceled it by hand in the Typefully UI) is treated as
// success, not an error: the end state either way is "no longer scheduled", which is what the
// caller actually wants. retryOnNetworkError: false — a lost-response network error or 5xx leaves
// real ambiguity about whether the delete landed; retrying a DELETE is safe to repeat, but silently
// swallowing a genuine failure as a false "canceled" is worse than surfacing it once.
export async function cancelDraft(draftId: string): Promise<void> {
  const setId = await socialSetId();
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY missing in .env (generate at typefully.com settings)");
  const res = await fetchWithRetry(
    `${BASE}/social-sets/${setId}/drafts/${draftId}`,
    { method: "DELETE", headers: { authorization: `Bearer ${key}` } },
    { retryOnNetworkError: false }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`typefully DELETE /social-sets/${setId}/drafts/${draftId} → ${res.status} ${await res.text()}`);
  }
}

// Read-only: the live Typefully scheduled-draft queue, normalized for the unified view + --list.
// No writes. Exported so queue-view.ts can merge it with the other channels. `id` is the draft id
// Typefully itself assigns (also the one logged to publish-log.md as `typefully draft <id>`) — the
// stable, provider-unique key src/review/reconcile.ts matches a row against, since `title` alone
// (row-id-derived) isn't guaranteed unique across different content folders.
export type TypefullyScheduled = { id: string; whenIso: string; platforms: string[]; title: string };

// Typefully v2 uses limit/offset pagination ({ count, limit, offset, next, previous, results },
// max limit 50 per their API docs) — a bare array response has no `next` and is always a single page.
const DRAFTS_PAGE_LIMIT = 50;
const DRAFTS_MAX_PAGES = 10; // sane upper bound so a pathological account can't loop forever / hammer the API

export async function fetchScheduledDrafts(): Promise<TypefullyScheduled[]> {
  const setId = await socialSetId();
  const all: TypefullyDraft[] = [];
  let offset = 0;
  for (let page = 0; page < DRAFTS_MAX_PAGES; page++) {
    const res = (await api(`/social-sets/${setId}/drafts?limit=${DRAFTS_PAGE_LIMIT}&offset=${offset}`)) as
      | { results?: TypefullyDraft[]; next?: string | null }
      | TypefullyDraft[];
    const list = Array.isArray(res) ? res : res.results ?? [];
    all.push(...list);
    offset += list.length; // advance by what actually came back, not the requested limit
    if (!Array.isArray(res) && res.next) {
      if (page + 1 >= DRAFTS_MAX_PAGES) {
        // A truncated live list is more dangerous than an unreachable one: reconcile() (queue-view.ts)
        // trusts a successful return as complete and will release ledger claims it can't match — the
        // exact orphan-release misfire this pagination fix is closing. Throwing routes this the same
        // way a network failure already does (caller marks the source unreachable / uncheckable)
        // instead of silently handing back a partial list that looks complete.
        throw new Error(
          `fetchScheduledDrafts: hit the ${DRAFTS_MAX_PAGES}-page cap (${all.length} drafts fetched) — more scheduled drafts exist and were not fetched`
        );
      }
      continue;
    }
    break;
  }
  // Dedup by draft id: offset-based pagination against a live, mutating draft list can return the
  // same draft twice if one is created/rescheduled between page fetches.
  const deduped = [...new Map(all.map((d) => [String(d.id), d] as const)).values()];
  return deduped
    .filter((d) => d.scheduled_date && (d.status === "scheduled" || new Date(d.scheduled_date) > new Date()))
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
    .map((d) => ({
      id: String(d.id),
      whenIso: d.scheduled_date!,
      platforms: (
        [
          ["x", d.x_post_enabled],
          ["linkedin", d.linkedin_post_enabled],
          ["bluesky", d.bluesky_post_enabled],
          ["threads", d.threads_post_enabled],
          ["mastodon", d.mastodon_post_enabled],
        ] as const
      )
        .filter(([, v]) => v)
        .map(([k]) => k),
      title: String(d.draft_title ?? d.id),
    }));
}

// Read-only: list what's currently scheduled in Typefully (sanity-check the queue). No writes.
//   tsx src/publish/typefully.ts --list
async function runList(): Promise<void> {
  const scheduled = await fetchScheduledDrafts();
  if (!scheduled.length) {
    console.log("No scheduled drafts found in Typefully.");
    return;
  }
  console.log(`Scheduled in Typefully (${scheduled.length}), times in PT:`);
  for (const d of scheduled) {
    console.log(`  ${fmtLa(new Date(d.whenIso))}  [${d.platforms.join(",") || "?"}]  ${d.title}`);
  }
}

type TypefullyDraft = {
  id: string | number;
  draft_title?: string;
  scheduled_date?: string | null;
  status?: string;
  x_post_enabled?: boolean;
  linkedin_post_enabled?: boolean;
  bluesky_post_enabled?: boolean;
  threads_post_enabled?: boolean;
  mastodon_post_enabled?: boolean;
};

export interface ScheduledRow {
  id: string;
  platform: string;
  when: string; // human PT label, or "unscheduled"
  plannedFor: string | null; // exact provider/ledger timestamp; null for an unscheduled draft
  draftId: string;
  manualComment: string | null;
}

// Publish approved text rows (x/linkedin/bluesky) to Typefully as scheduled drafts. Extracted from
// the CLI so the review GUI can schedule ONE row on approve (opts.onlyIds). With no opts it behaves
// exactly as the CLI did — every approved text row in the folder — so the CLI + notes-daily paths
// are unchanged.
export async function publishText(
  folder: string,
  opts: { onlyIds?: string[]; noSchedule?: boolean; forceReuse?: boolean; deliveryPolicy?: DeliveryPolicyDecision } = {}
): Promise<ScheduledRow[]> {
  const { rows } = readQueue(folder);
  let approved = rows.filter((r) => r.status === "approve" && TEXT_PLATFORMS.has(r.platform));
  if (opts.onlyIds) approved = approved.filter((r) => opts.onlyIds!.includes(r.id));
  if (approved.length === 0) {
    console.log("no approved x/linkedin/bluesky rows in the review queue");
    return [];
  }
  assertProviderDispatch(folder, "typefully", opts.deliveryPolicy);

  // UNSCHEDULED-draft mode (opts.noSchedule): skip claimSlots + OMIT publish_at, so drafts are saved
  // UNSCHEDULED and will NOT auto-post — they sit in Typefully until a human schedules them. Used by
  // the daily notes cloud routine (src/cron/notes-daily.ts) so nothing fires automatically.
  const noSchedule = opts.noSchedule ?? false;

  // Reuse guard: skip platforms where this slug was published too recently.
  const slug = basename(folder);
  const forceReuse = opts.forceReuse ?? false;
  if (forceReuse) {
    console.log("reuse guard bypassed via --force-reuse, proceeding with publish");
  } else {
    const reuseByPlatform = new Map<string, ReturnType<typeof checkReuse>>();
    for (const r of approved) {
      if (!reuseByPlatform.has(r.platform)) {
        reuseByPlatform.set(r.platform, checkReuse(slug, r.platform));
      }
    }
    for (const [, res] of reuseByPlatform) {
      if (!res.allowed) console.warn(`reuse guard: ${res.reason} — skipping`);
    }
    approved = approved.filter((r) => reuseByPlatform.get(r.platform)?.allowed !== false);
    if (approved.length === 0) {
      console.log("no rows to publish: all platforms blocked by the reuse guard");
      return [];
    }
  }

  const setId = await socialSetId();
  const cfg = loadCtaConfig();
  const ctCfg = loadContentTypesConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const sourceKind = loadSourceKind(folder);
  const maxMap = loadPlatformMax();

  // Claim an explicit publish time per row from the unified scheduler (config/platforms.yaml
  // cadence + shared ledger). Rows of a platform fill consecutive free slots; the ledger keeps
  // them from colliding with cards or a separate run. Platforms with no cadence → "next-free-slot".
  // In --no-schedule mode we skip this entirely: no slot is claimed and publish_at stays unset.
  const byPlatform: Record<string, typeof approved> = {};
  for (const r of approved) (byPlatform[r.platform] ??= []).push(r);
  const slotByRow = new Map<string, string>(); // rowId → ISO publish_at | "next-free-slot"
  const whenByRow = new Map<string, string>(); // rowId → human label for logs
  // Strategy lever C follow-through (epic 2ce597d7): records, per platform, whether THIS run's
  // claim actually used an active config/schedule-overrides.yaml entry or the static default —
  // appendBetPlacement below stamps it onto the Placed-log row so tag-source.ts can persist it to
  // posts.cadence_source. Only this text-platform path determines it (see queue.ts's comment).
  const cadenceSourceByRow = new Map<string, "override" | "default">();
  if (noSchedule) {
    console.log("Unscheduled-draft mode (--no-schedule): no slots claimed, drafts saved without a publish time.");
  } else {
    for (const [platform, rowsP] of Object.entries(byPlatform)) {
      const { times, labels } = claimSlots({
        windowKey: platform,
        conflictPlatforms: [platform],
        count: rowsP.length,
        asset: `${basename(folder)}/${platform}`,
        by: "typefully",
      });
      const cadenceSource = cadenceSourceFor(platform);
      rowsP.forEach((r, i) => {
        slotByRow.set(r.id, times[i] ?? "next-free-slot");
        whenByRow.set(r.id, labels[i] ?? "next-free-slot");
        cadenceSourceByRow.set(r.id, cadenceSource);
      });
    }
    console.log("Cadence schedule (PT):");
    for (const [platform, rowsP] of Object.entries(byPlatform)) {
      console.log(`  ${platform}:`);
      for (const r of rowsP) console.log(`    ${r.id} → ${whenByRow.get(r.id)}`);
    }
  }

  const results: ScheduledRow[] = [];
  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const platformKey = row.platform === "x" ? "x" : row.platform; // typefully platform keys: x, linkedin, bluesky

    // Resolve the CTA line(s) (shared funnel layer — src/publish/cta.ts), then place them per
    // cta.yaml. A derivative can carry 2+ stacked CTAs when it matched multiple content types.
    const { ctas, usedFallback } = resolveCtaLines(fm, canonicalUrl, cfg, sourceKind, ctCfg);
    if (usedFallback) console.log(`  ↳ note: ${row.id} used the configured CTA fallback`);
    const placement = cfg.placement[row.platform] ?? "inline";
    const { posts, manualComment } = buildPosts(body, ctas, placement, maxMap[row.platform] ?? Infinity);

    // Attach a video/image if the derivative declares one (frontmatter `media:`), e.g. an animated
    // quote card → native video post. Uploaded once and attached to the first post.
    const mediaRef = typeof fm.media === "string" ? fm.media.trim() : "";
    if (mediaRef) {
      const mediaPath = isAbsolute(mediaRef) ? mediaRef : join(folder, mediaRef);
      if (!existsSync(mediaPath)) throw new Error(`media for ${row.id} not found: ${mediaPath}`);
      const mediaId = await uploadMedia(setId, mediaPath);
      (posts[0] as { text: string; media_ids?: string[] }).media_ids = [mediaId];
      console.log(`  ↳ uploaded ${basename(mediaPath)} → media attached to ${row.id}`);
    }

    // Scheduled mode → claimed slot (or "next-free-slot"). Unscheduled mode → publishAt = null,
    // so buildDraftPayload omits publish_at and Typefully saves a non-firing draft.
    const publishAt = noSchedule ? null : slotByRow.get(row.id) ?? "next-free-slot";
    const when = noSchedule ? "unscheduled" : whenByRow.get(row.id) ?? "next-free-slot";
    const draft = await createDraft(
      setId,
      buildDraftPayload({ title: rowDraftTitle(row.id), platformKey, posts, publishAt })
    );
    setStatus(folder, row, "published");
    const placeNote = ctas.length > 0 ? `, cta→${placement}` : "";
    appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${row.platform}, ${when}${placeNote})`);
    if (manualComment) {
      appendPublishLog(folder, `  ↳ ACTION: add as the first comment on ${row.id} in Typefully → ${manualComment}`);
    }
    const ctaDestination = resolvePrimaryCtaDestination(fm, canonicalUrl, cfg, sourceKind, ctCfg);
    appendBetPlacement(
      folder,
      row.id,
      row.platform,
      `typefully draft ${draft.id ?? "?"} @ ${when}`,
      fm,
      body,
      ctaDestination,
      cadenceSourceByRow.get(row.id) ?? null
    );
    const verb = noSchedule ? "saved (unscheduled)" : "scheduled";
    console.log(
      `${verb}: ${row.id} (${row.platform}) → ${when} → typefully draft ${draft.id ?? "?"}${placeNote}` +
        (manualComment ? `\n  ↳ add link as first comment: ${manualComment}` : "")
    );
    results.push({ id: row.id, platform: row.platform, when, plannedFor: publishAt, draftId: String(draft.id ?? "?"), manualComment });
  }
  return results;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/typefully.ts <content-folder> | --list");
    process.exit(1);
  }
  if (arg === "--list") {
    await runList();
    return;
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const noSchedule =
    process.argv.includes("--no-schedule") ||
    (process.env.TYPEFULLY_SCHEDULE ?? "").toLowerCase() === "off";
  const forceReuse = process.argv.includes("--force-reuse");
  if (noSchedule || forceReuse) throw new Error("legacy scheduling overrides are unavailable on the unified capability-selected publish path");
  const { publishApprovedViaConfiguredProviders } = await import("./unified-cli.js");
  await publishApprovedViaConfiguredProviders(folder, "text");
}

// Run the CLI only when executed directly, so the module can be imported (fetchScheduledDrafts)
// without triggering main()/process.exit. Matches tiktok.ts / cards.ts / youtube.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
