import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { loadCtaConfig, loadCanonicalUrl, loadSourceKind, resolveCta, appendCtaLine, type CtaConfig } from "./cta.js";
import { claimSlots, fmtLa } from "./slots.js";
import { checkReuse } from "./reuse-guard.js";

// Schedule approved `quote-card` (image) rows from a content folder's review queue to the social
// platforms, via the swappable image-post provider chosen in config/providers.yaml (`image_post:
// postpeer` primary, `upload-post` failover on quota). Cards are SCHEDULED, never instant — the
// provider dashboard is the second safety net (cancel there before a card fires to test).
//   tsx src/publish/cards.ts <content-folder>              schedule approved cards
//   tsx src/publish/cards.ts <content-folder> --check      dry run: rows + next slot + CTA plan
//   tsx src/publish/cards.ts <content-folder> --at <ISO>   override the time (one-off / test)
//   tsx src/publish/cards.ts --check                       provider auth/account preflight only
//
// Timing comes from the UNIFIED scheduler (src/publish/slots.ts, windowKey `quote-card` in
// config/platforms.yaml) + the shared ledger, so a card never lands on a platform the same day a
// text post (or another card) already did. The quote line is the verbatim body of
// derivatives/<id>.md (CLAUDE.md rule 1). The article CTA follows config/cta.yaml exactly like text
// (shared cta.ts): link INLINE on inline platforms (Bluesky/LinkedIn), OMITTED where placement is
// `reply` (X) — the relays can't post a reply, so omitting dodges X's penalty. PNG is images/<id>.png
// (rendered by `npm run render -- --still <folder>`, gitignored).

interface ImageTarget {
  platform: string;
  accountId?: string;
}

interface ImagePostProvider {
  providerName: string;
  listTargets(): Promise<ImageTarget[]>;
  scheduleImagePost(a: {
    imagePath: string;
    caption: string;
    scheduledFor: string;
    targets: ImageTarget[];
  }): Promise<string>;
  check(): Promise<void>;
}

const PROVIDERS: Record<string, () => Promise<ImagePostProvider>> = {
  postpeer: () => import("./image-post/postpeer.js").then((m) => m as unknown as ImagePostProvider),
  "upload-post": () => import("./image-post/upload-post.js").then((m) => m as unknown as ImagePostProvider),
};

function imagePostName(): string {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "providers.yaml"), "utf8")) as {
      image_post?: string;
    };
    return (cfg.image_post ?? "postpeer").trim();
  } catch {
    return "postpeer";
  }
}

async function loadProvider(): Promise<ImagePostProvider> {
  const name = imagePostName();
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `config/providers.yaml image_post: "${name}" is not a known image-post provider (postpeer | upload-post)`
    );
  }
  return factory();
}

// config/cta.yaml + the scheduler key X as "x"; PostPeer reports it as "twitter". Map a provider
// platform → the shared platform key used for CTA placement and slot de-confliction.
function platformKey(platform: string): string {
  return platform.toLowerCase() === "twitter" ? "x" : platform.toLowerCase();
}

// The real platforms a card occupies (deduped, mapped to shared keys) — what the scheduler
// de-conflicts against so a card never lands on a platform a text post already took that day.
function conflictPlatforms(targets: ImageTarget[]): string[] {
  return [...new Set(targets.map((t) => platformKey(t.platform)))];
}

// Split targets by cta.yaml placement: `inline` platforms get the link in the caption; everything
// else (e.g. X's `reply`) gets no link, since the relays can't post a reply/first-comment and an
// in-body link on X eats a 30-50% reach penalty.
function splitByPlacement(targets: ImageTarget[], cfg: CtaConfig): { withLink: ImageTarget[]; noLink: ImageTarget[] } {
  const withLink: ImageTarget[] = [];
  const noLink: ImageTarget[] = [];
  for (const t of targets) {
    const placement = cfg.placement[platformKey(t.platform)] ?? "inline";
    (placement === "inline" ? withLink : noLink).push(t);
  }
  return { withLink, noLink };
}

// A card row's platform is either legacy `quote-card` (one card fanned out to every connected
// account) or per-platform `quote-card:<target>` (the current model: a card whose CAPTION is a
// spun, context-only text post written for that one platform, so a quote never ships out of
// context). basePlatform strips the suffix; cardTarget returns the destination (null when legacy).
export const basePlatform = (p: string): string => p.split(":")[0];
export function cardTarget(rowPlatform: string): string | null {
  const parts = rowPlatform.split(":");
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

// The post BODY for a card = the body of derivatives/<row.id>.md. For a `quote-card:<target>` row
// that's the per-platform CONTEXT caption (the quote itself lives on the image, rendered from the
// separate quote-card-N.md definition derivative); for a legacy `quote-card` row it's the quote.
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

// The destinations + caption for one card: inline-link group and/or no-link group per cta.yaml.
export function planGroups(
  quote: string,
  targets: ImageTarget[],
  ctaUrl: string | null,
  ctaLabel: string,
  cfg: CtaConfig
): { caption: string; targets: ImageTarget[] }[] {
  if (!ctaUrl) return [{ caption: quote, targets }];
  const { withLink, noLink } = splitByPlacement(targets, cfg);
  const groups: { caption: string; targets: ImageTarget[] }[] = [];
  if (withLink.length) groups.push({ caption: appendCtaLine(quote, ctaUrl, ctaLabel), targets: withLink });
  if (noLink.length) groups.push({ caption: quote, targets: noLink });
  return groups;
}

// Escape a string for literal use inside a RegExp — dest joins platforms with "+", a regex metachar.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Idempotency for the multi-group posting loop below. A card row posts its targets in GROUPS
// (inline-link group + no-link group). If group 1 posts+logs but group 2 then THROWS, the row stays
// `approve`, so the next /publish re-enters the loop — without this guard it would RE-POST the
// already-successful group 1 (a real duplicate public post to Bluesky/LinkedIn). Given the current
// publish-log.md text, this returns the logged provider ref for THIS row's group identified by its
// exact `dest` platform-set, so the loop can reuse that ref instead of calling the provider again.
//
// Parses cards.ts's OWN log-line shape only: `- <ISO> — <rowId> → <provider> <ref> [<dest>[ +link]]
// (scheduled ...)` (written by appendPublishLog above). The `[dest]` bracket is unique to this file —
// typefully.ts/tiktok.ts use a bracket-less shape, and findLoggedRef (reconcile.ts) keys only on
// rowId with no dest concept, so it can't tell one group's ref from another's here. Pure string in,
// no fs — the caller supplies the log text. Match is EXACT: a partial or superset dest returns null
// (only the identical platform set counts as "already posted"), so a group that was NOT actually
// posted is never wrongly skipped. Returns null when the row+dest has no logged line.
export function alreadyLoggedGroup(logText: string, rowId: string, dest: string): string | null {
  const re = new RegExp(
    `^-\\s+\\S+\\s+—\\s+${escapeRe(rowId)}\\s+→\\s+\\S+\\s+(.+?)\\s+\\[${escapeRe(dest)}(?: \\+link)?\\]`
  );
  let found: string | null = null;
  for (const line of logText.split("\n")) {
    const m = line.match(re);
    if (m) found = m[1]; // last logged wins, mirroring findLoggedRef
  }
  return found;
}

// The row's publish-log.md text (for the idempotency check), or "" when the file doesn't exist yet
// (first run — nothing has been posted). Same folder/filename convention as appendPublishLog.
function readPublishLog(folder: string): string {
  try {
    return readFileSync(join(folder, "publish-log.md"), "utf8");
  } catch {
    return "";
  }
}

async function runCheck(folder: string | null): Promise<void> {
  const name = imagePostName();
  console.log(`image_post provider (config/providers.yaml): ${name}`);

  const cfg = loadCtaConfig();
  const inline = Object.entries(cfg.placement).filter(([, v]) => v === "inline").map(([k]) => k);
  const other = Object.entries(cfg.placement).filter(([, v]) => v !== "inline").map(([k, v]) => `${k}(${v})`);
  console.log(`CTA (config/cta.yaml): link inline on [${inline.join(", ")}]; omitted on [${other.join(", ")}] (relays can't reply/comment).`);

  if (folder) {
    const cards = approvedCards(folder);
    console.log(`\n${cards.length} approved quote-card row(s) in ${folder}:`);
    if (cards.length > 0) {
      const canonicalUrl = loadCanonicalUrl(folder);
      const sourceKind = loadSourceKind(folder);
      const { labels } = claimSlots({ windowKey: "quote-card", conflictPlatforms: [], count: 1, asset: "(preview)", by: "cards", dryRun: true });
      console.log(`  next free card slot (config/platforms.yaml quote-card cadence): ${labels[0] ?? "next-free-slot"}`);
      for (const c of cards) {
        const imagePath = isAbsolute(c.asset) ? c.asset : join(folder, c.asset);
        const rendered = existsSync(imagePath) ? "rendered" : "NOT RENDERED — run `npm run render -- --still`";
        const { text, fm } = cardCopy(folder, c.id);
        const { url } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
        const target = cardTarget(c.platform) ?? "all platforms";
        console.log(`  • ${c.id} → ${target}  ${c.asset} (${rendered})  ${url ? `link → ${url}` : "no link"}`);
        console.log(`      caption: ${text.replace(/\s+/g, " ").slice(0, 100)}${text.length > 100 ? "…" : ""}`);
      }
    }
    console.log("");
  }

  const provider = await loadProvider();
  try {
    await provider.check();
  } catch (e) {
    console.error(`✗ ${name} preflight failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

export interface ScheduledCard {
  id: string;
  platform: string; // destination platform (single target) or "quote-card" for legacy fan-out
  when: string; // human PT label (matches publishText/publishShorts, not a raw ISO string)
  ref: string; // provider post ref(s)
}

// Schedule approved quote-card rows from a folder to the image relays. Extracted from the CLI (like
// publishText) so the review GUI can schedule ONE row on approve via opts.onlyIds. With no opts it
// behaves exactly as the CLI did — every approved card in the folder — so /publish is unchanged.
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

  // Reuse guard: check if this slug was already published as a quote-card recently.
  // Pass forceReuse to bypass the window and proceed anyway.
  const slug = basename(folder);
  if (opts.forceReuse) {
    console.log("reuse guard bypassed via --force-reuse, proceeding with publish");
  } else {
    const reuseResult = checkReuse(slug, "quote-card");
    if (!reuseResult.allowed) {
      console.warn(`reuse guard: ${reuseResult.reason} — skipping cards`);
      return [];
    }
  }

  const provider = await loadProvider();
  const allTargets = await provider.listTargets();
  const cfg = loadCtaConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const sourceKind = loadSourceKind(folder);

  // Validate a `--at` override once (one-off/test; bypasses the scheduler + ledger).
  let atIso: string | null = null;
  if (opts.atOverride) {
    const at = new Date(opts.atOverride);
    if (Number.isNaN(at.getTime())) throw new Error(`--at is not a valid ISO date: ${opts.atOverride}`);
    if (at.getTime() <= Date.now()) throw new Error(`--at is in the past: ${opts.atOverride} — pick a future time`);
    atIso = at.toISOString();
  }

  const results: ScheduledCard[] = [];
  for (let i = 0; i < cards.length; i++) {
    const row = cards[i];
    const target = cardTarget(row.platform); // "x" | "linkedin" | "bluesky" | null (legacy fan-out)
    const imagePath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    if (!existsSync(imagePath)) {
      throw new Error(`missing ${imagePath} — render the card first: npm run render -- --still ${folder}`);
    }

    // Where this row posts: the single target's connected account(s), or every account (legacy).
    const rowTargets = target ? allTargets.filter((t) => platformKey(t.platform) === target) : allTargets;
    if (rowTargets.length === 0) {
      console.warn(`  ⚠ ${row.id}: no connected ${target} account on ${provider.providerName} — skipping`);
      continue;
    }

    // One card slot for this row, de-conflicting against the platform(s) it occupies so it never
    // shares a day with a text post there. `--at` overrides the scheduler for a one-off.
    let scheduledFor: string;
    if (atIso) {
      scheduledFor = atIso;
    } else {
      scheduledFor = claimSlots({
        windowKey: "quote-card",
        conflictPlatforms: conflictPlatforms(rowTargets),
        count: 1,
        asset: `${basename(folder)}/${row.id}`,
        by: "cards",
      }).times[0];
      if (!scheduledFor || scheduledFor === "next-free-slot") {
        throw new Error("no card slot available — give config/platforms.yaml a `quote-card` cadence (posts_per_week + slot_days + slot_time_pst)");
      }
    }

    const { text: caption, fm } = cardCopy(folder, row.id);
    const { url: ctaUrl, label: ctaLabel, usedFallback } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
    if (usedFallback) {
      console.log(`  ↳ note: ${row.id} cta:source → homepage (no canonical_url in source.md)`);
    }

    const groups = planGroups(caption, rowTargets, ctaUrl, ctaLabel, cfg);
    const priorLog = readPublishLog(folder); // prior runs' log lines, for the per-group idempotency check
    const refs: string[] = [];
    for (const g of groups) {
      // Sorted so `dest` is stable regardless of provider.listTargets()'s return order — a retry run
      // whose provider lists connected accounts in a different order must still produce the SAME
      // dest string as the original run, or the idempotency check below misses the match and re-posts.
      const dest = g.targets.map((t) => t.platform).sort().join("+");
      // If a prior run already posted+logged THIS exact group but then threw on a later group, the
      // row is still `approve` and we're re-entering this loop — reuse the logged ref, don't re-post.
      const priorRef = alreadyLoggedGroup(priorLog, row.id, dest);
      if (priorRef) {
        console.log(`  ↳ ${row.id} [${dest}] already scheduled on a prior run (${priorRef}) — skipping re-post`);
        refs.push(priorRef);
        continue;
      }
      const link = g.caption.includes("\n") ? " +link" : "";
      const ref = await provider.scheduleImagePost({ imagePath, caption: g.caption, scheduledFor, targets: g.targets });
      refs.push(ref);
      appendPublishLog(folder, `${row.id} → ${provider.providerName} ${ref} [${dest}${link}] (scheduled ${scheduledFor})`);
    }
    setStatus(folder, row, "published");
    // Record the placement under the ACTUAL destination platform, with the CAPTION as the match key,
    // so tag-source attributes the card post per platform (and fm.spin → the `| spin` marker →
    // classified atomized-spin). Legacy fan-out rows keep the shared "quote-card" key.
    const betPlatform = target ?? "quote-card";
    appendBetPlacement(folder, row.id, betPlatform, `${refs.join(" | ")} @ ${scheduledFor}`, fm, caption);
    console.log(`scheduled: ${row.id} (${target ?? "all platforms"}) → ${provider.providerName} ${refs.join(" | ")} @ ${scheduledFor}`);
    results.push({ id: row.id, platform: betPlatform, when: fmtLa(new Date(scheduledFor)), ref: refs.join(" | ") });
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
