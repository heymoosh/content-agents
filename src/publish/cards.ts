import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
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
import { claimSlots, fmtLa } from "./slots.js";
import { checkReuse } from "./reuse-guard.js";
import {
  TEXT_PLATFORMS,
  socialSetId,
  uploadMedia,
  createDraft,
  buildDraftPayload,
  buildPosts,
  loadPlatformMax,
  rowDraftTitle,
} from "./typefully.js";

// Schedule approved `quote-card` (image) rows from a content folder's review queue to
// X/LinkedIn/Bluesky, NATIVELY through Typefully (2026-07-08 rewire — src/publish/typefully.ts's
// uploadMedia + media_ids attach, the same scheduled-draft path text posts already use, proven once
// for an animated mp4). The card PNG is uploaded and attached to the draft; the caption is the row's
// per-platform context derivative. Retires PostPeer/Upload-Post FOR CARDS — PostPeer stays wired for
// TikTok only (src/publish/tiktok.ts, untouched; a genuinely different, video-only relay).
//   tsx src/publish/cards.ts <content-folder>              schedule approved cards
//   tsx src/publish/cards.ts <content-folder> --check      dry run: rows + next slot + CTA plan
//   tsx src/publish/cards.ts <content-folder> --at <ISO>   override the time (one-off / test)
//   tsx src/publish/cards.ts --check                       Typefully auth preflight only
// Needs TYPEFULLY_API_KEY (and optionally TYPEFULLY_SOCIAL_SET_ID) in .env — same as publish:typefully.
//
// Timing comes from the UNIFIED scheduler (src/publish/slots.ts, windowKey `quote-card` in
// config/platforms.yaml) + the shared ledger, so a card never exceeds a platform's per-day slot cap
// (default 1) already claimed by a text post (or another card) that day. The quote line is the verbatim body of
// derivatives/<id>.md (CLAUDE.md rule 1). The article CTA follows config/cta.yaml exactly like text
// (shared cta.ts + buildPosts): inline on inline platforms (Bluesky/LinkedIn), in the first reply on X,
// manual first-comment note on LinkedIn-comment-placement configs — identical to text posts, since a
// card is now just a Typefully draft with an image attached.

// A card row's platform is either legacy `quote-card` (one card image fanned out to every platform in
// a single post — retired, no longer generated; see .claude/skills/atomize/SKILL.md step 7) or the
// current per-platform `quote-card:<target>` (a card whose CAPTION is a spun, context-only text post
// written for that one platform, so a quote never ships out of context). basePlatform strips the
// suffix; cardTarget returns the destination (null when legacy).
export const basePlatform = (p: string): string => p.split(":")[0];
export function cardTarget(rowPlatform: string): string | null {
  const parts = rowPlatform.split(":");
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

// The post BODY (caption) for a card = the body of derivatives/<row.id>.md — the per-platform CONTEXT
// caption (the quote itself lives on the image, rendered from the separate quote-card-N.md definition
// derivative).
function cardCopy(folder: string, rowId: string): { text: string; fm: Record<string, unknown> } {
  const path = join(folder, "derivatives", `${rowId}.md`);
  if (!existsSync(path)) {
    throw new Error(`missing card derivative ${path} — every quote-card row needs derivatives/<id>.md for its caption`);
  }
  const { fm, body } = splitFrontmatter(readFileSync(path, "utf8"));
  const text = body.trim();
  if (!text) throw new Error(`card derivative ${path} has no caption text in its body`);
  return { text, fm };
}

// Exported so serve.ts's scheduleKind() routes to publishCards using this SAME predicate, instead
// of keeping its own independently-maintained copy that could drift out of sync with this one.
export const isQuoteCardRow = (platform: string): boolean => basePlatform(platform) === "quote-card";

function approvedCards(folder: string) {
  const { rows } = readQueue(folder);
  return rows.filter((r) => r.status === "approve" && isQuoteCardRow(r.platform));
}

// Idempotency for a row that already has a live Typefully draft from a prior run. Unlike the old
// PostPeer/Upload-Post path (which posted a row's targets in separate GROUPS and needed
// alreadyLoggedGroup to guard against re-posting a group that already succeeded), a card is now
// ONE draft per row — so the only gap left is a crash between createDraft succeeding and this row's
// status/log write landing. Without this guard, re-running publishCards on a still-`approve` row
// would re-upload the media and create a SECOND live scheduled draft for the same card.
function alreadyLoggedDraft(folder: string, rowId: string): string | null {
  let text: string;
  try {
    text = readFileSync(join(folder, "publish-log.md"), "utf8");
  } catch {
    return null;
  }
  const escaped = rowId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`—\\s+${escaped}\\s+→\\s+typefully draft (\\S+)`);
  let found: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(re);
    if (m) found = m[1]; // last logged wins
  }
  return found;
}

async function runCheck(folder: string | null): Promise<void> {
  console.log("image posts: native Typefully drafts (uploadMedia + media_ids) — x/linkedin/bluesky");

  const cfg = loadCtaConfig();
  const inline = Object.entries(cfg.placement).filter(([, v]) => v === "inline").map(([k]) => k);
  const other = Object.entries(cfg.placement).filter(([, v]) => v !== "inline").map(([k, v]) => `${k}(${v})`);
  console.log(`CTA (config/cta.yaml): inline on [${inline.join(", ")}]; ${other.join(", ") || "none"} placed like text posts (reply/first-comment).`);

  if (folder) {
    const cards = approvedCards(folder);
    console.log(`\n${cards.length} approved quote-card row(s) in ${folder}:`);
    if (cards.length > 0) {
      const canonicalUrl = loadCanonicalUrl(folder);
      const sourceKind = loadSourceKind(folder);
      const ctCfg = loadContentTypesConfig();
      const { labels } = claimSlots({ windowKey: "quote-card", conflictPlatforms: [], count: 1, asset: "(preview)", by: "cards", dryRun: true });
      console.log(`  next free card slot (config/platforms.yaml quote-card cadence): ${labels[0] ?? "next-free-slot"}`);
      for (const c of cards) {
        const imagePath = isAbsolute(c.asset) ? c.asset : join(folder, c.asset);
        const rendered = existsSync(imagePath) ? "rendered" : "NOT RENDERED — run `npm run render -- --still`";
        const { text, fm } = cardCopy(folder, c.id);
        const { ctas } = resolveCtaLines(fm, canonicalUrl, cfg, sourceKind, ctCfg);
        const target = cardTarget(c.platform) ?? "UNSUPPORTED (legacy fan-out — split into quote-card:<x|linkedin|bluesky>)";
        const linkNote = ctas.length > 0 ? `link → ${ctas.map((cta) => cta.url).join(", ")}` : "no link";
        console.log(`  • ${c.id} → ${target}  ${c.asset} (${rendered})  ${linkNote}`);
        console.log(`      caption: ${text.replace(/\s+/g, " ").slice(0, 100)}${text.length > 100 ? "…" : ""}`);
      }
    }
    console.log("");
  }

  try {
    await socialSetId();
    console.log("✓ Typefully auth OK — social set resolved.");
  } catch (e) {
    console.error(`✗ Typefully preflight failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

export interface ScheduledCard {
  id: string;
  platform: string; // destination platform (x | linkedin | bluesky)
  when: string; // human PT label (matches publishText/publishShorts, not a raw ISO string)
  ref: string; // "typefully draft <id>"
}

// Schedule approved quote-card rows from a folder natively through Typefully. Extracted from the
// CLI (like publishText) so the review GUI can schedule ONE row on approve via opts.onlyIds. With no
// opts it behaves exactly as the CLI did — every approved card in the folder — so /publish is unchanged.
export async function publishCards(
  folder: string,
  opts: { onlyIds?: string[]; atOverride?: string; forceReuse?: boolean } = {}
): Promise<ScheduledCard[]> {
  let cards = approvedCards(folder);
  if (opts.onlyIds) cards = cards.filter((r) => opts.onlyIds!.includes(r.id));
  if (cards.length === 0) {
    console.log("no approved quote-card rows in the review queue");
    return [];
  }

  // Reuse guard: per TARGET platform (like publishText's checkReuse(slug, r.platform)), not a
  // shared "quote-card" bucket — bets.md Placed rows are keyed by the row's real destination
  // platform (appendBetPlacement below), so a bucket-wide check would never match and never block
  // anything. Cached per target since several rows in one folder can share a platform.
  // Pass forceReuse to bypass the window and proceed anyway.
  const slug = basename(folder);
  const forceReuse = opts.forceReuse ?? false;
  if (forceReuse) console.log("reuse guard bypassed via --force-reuse, proceeding with publish");
  const reuseByTarget = new Map<string, ReturnType<typeof checkReuse>>();

  const setId = await socialSetId();
  const cfg = loadCtaConfig();
  const ctCfg = loadContentTypesConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const sourceKind = loadSourceKind(folder);
  const maxMap = loadPlatformMax();

  // Validate a `--at` override once (one-off/test; bypasses the scheduler + ledger).
  let atIso: string | null = null;
  if (opts.atOverride) {
    const at = new Date(opts.atOverride);
    if (Number.isNaN(at.getTime())) throw new Error(`--at is not a valid ISO date: ${opts.atOverride}`);
    if (at.getTime() <= Date.now()) throw new Error(`--at is in the past: ${opts.atOverride} — pick a future time`);
    atIso = at.toISOString();
  }

  // One bad row must not strand every OTHER approved card in this folder (mirrors the "keep going
  // past a failing channel" principle already applied one layer up, across channels, in
  // src/publish/all.ts): failures are collected and only raised after every row's been attempted,
  // so valid rows still get scheduled this run.
  const results: ScheduledCard[] = [];
  const failures: string[] = [];
  for (const row of cards) {
    try {
      const target = cardTarget(row.platform); // "x" | "linkedin" | "bluesky" | null (legacy fan-out)
      if (!target) {
        throw new Error(
          `${row.id}: legacy fan-out quote-card row (no ":<platform>" target) can't ship through Typefully, ` +
            `which needs one platform per draft — split it into quote-card:<x|linkedin|bluesky> rows ` +
            `(see .claude/skills/atomize/SKILL.md step 7).`
        );
      }
      if (!TEXT_PLATFORMS.has(target)) {
        throw new Error(`${row.id}: quote-card target "${target}" isn't a Typefully platform (x | linkedin | bluesky)`);
      }

      if (!forceReuse) {
        if (!reuseByTarget.has(target)) reuseByTarget.set(target, checkReuse(slug, target));
        const reuseResult = reuseByTarget.get(target)!;
        if (!reuseResult.allowed) {
          console.warn(`reuse guard: ${reuseResult.reason} — skipping ${row.id}`);
          continue;
        }
      }

      const imagePath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
      if (!existsSync(imagePath)) {
        throw new Error(`missing ${imagePath} — render the card first: npm run render -- --still ${folder}`);
      }

      // Already scheduled on a prior run (createDraft succeeded but this row's status/log write
      // never landed, e.g. a crash mid-run) — reuse that ref instead of creating a duplicate draft.
      const priorRef = alreadyLoggedDraft(folder, row.id);
      if (priorRef) {
        console.log(`  ↳ ${row.id} already scheduled on a prior run (typefully draft ${priorRef}) — skipping re-post`);
        setStatus(folder, row, "published");
        results.push({ id: row.id, platform: target, when: "(scheduled on a prior run)", ref: `typefully draft ${priorRef}` });
        continue;
      }

      // One card slot for this row, de-conflicting against the platform it occupies so it never
      // shares a day with a text post there. `--at` overrides the scheduler for a one-off.
      let scheduledFor: string;
      if (atIso) {
        scheduledFor = atIso;
      } else {
        scheduledFor = claimSlots({
          windowKey: "quote-card",
          conflictPlatforms: [target],
          count: 1,
          asset: `${basename(folder)}/${row.id}`,
          by: "cards",
        }).times[0];
        if (!scheduledFor || scheduledFor === "next-free-slot") {
          throw new Error("no card slot available — give config/platforms.yaml a `quote-card` cadence (posts_per_week + slot_days + slot_time_pst)");
        }
      }

      const { text: caption, fm } = cardCopy(folder, row.id);
      const { ctas, usedFallback } = resolveCtaLines(fm, canonicalUrl, cfg, sourceKind, ctCfg);
      if (usedFallback) {
        console.log(`  ↳ note: ${row.id} cta → homepage (no canonical_url in source.md)`);
      }
      const placement = cfg.placement[target] ?? "inline";
      const { posts, manualComment } = buildPosts(caption, ctas, placement, maxMap[target] ?? Infinity);

      const mediaId = await uploadMedia(setId, imagePath);
      (posts[0] as { text: string; media_ids?: string[] }).media_ids = [mediaId];
      console.log(`  ↳ uploaded ${basename(imagePath)} → media attached to ${row.id}`);

      const draft = await createDraft(
        setId,
        buildDraftPayload({ title: rowDraftTitle(row.id), platformKey: target, posts, publishAt: scheduledFor })
      );

      setStatus(folder, row, "published");
      const placeNote = ctas.length > 0 ? `, cta→${placement}` : "";
      const when = fmtLa(new Date(scheduledFor));
      appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${target}, ${when}${placeNote})`);
      if (manualComment) {
        appendPublishLog(folder, `  ↳ ACTION: add as the first comment on ${row.id} in Typefully → ${manualComment}`);
      }
      const ctaDestination = resolvePrimaryCtaDestination(fm, canonicalUrl, cfg, sourceKind, ctCfg);
      appendBetPlacement(folder, row.id, target, `typefully draft ${draft.id ?? "?"} @ ${when}`, fm, caption, ctaDestination);
      console.log(
        `scheduled: ${row.id} (${target}) → ${when} → typefully draft ${draft.id ?? "?"}${placeNote}` +
          (manualComment ? `\n  ↳ add link as first comment: ${manualComment}` : "")
      );
      results.push({ id: row.id, platform: target, when, ref: `typefully draft ${draft.id ?? "?"}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${row.id}: ${msg}`);
      failures.push(msg);
    }
  }
  if (failures.length > 0) {
    throw new Error(`publishCards: ${failures.length} row(s) failed to schedule:\n${failures.join("\n")}`);
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const forceReuse = args.includes("--force-reuse");
  const atIdx = args.indexOf("--at");
  const atOverride = atIdx !== -1 ? args[atIdx + 1] : undefined;
  const folderArg = args.find((a, i) => !a.startsWith("--") && (atIdx === -1 || i !== atIdx + 1));

  if (isCheck) {
    const folder = folderArg ? (isAbsolute(folderArg) ? folderArg : join(repoRoot, folderArg)) : null;
    await runCheck(folder);
    return;
  }

  if (!folderArg) {
    console.error("usage: tsx src/publish/cards.ts <content-folder> [--check] [--at <ISO>]");
    process.exit(1);
  }
  const folder = isAbsolute(folderArg) ? folderArg : join(repoRoot, folderArg);
  await publishCards(folder, { atOverride, forceReuse });
}

// Run the CLI only when executed directly, so the module can be imported (e.g. in tests) without
// triggering main()/process.exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
