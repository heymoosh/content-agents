import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { loadCtaConfig, loadCanonicalUrl, loadSourceKind, resolveCta, appendCtaLine, type CtaConfig } from "./cta.js";
import { claimSlots } from "./slots.js";
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

// Quote line for a card = the verbatim body of derivatives/<row.id>.md. fm carries cta / cta_label
// (for the link) plus from_brief / directives_applied (for the bet placement row).
function cardCopy(folder: string, rowId: string): { quote: string; fm: Record<string, unknown> } {
  const path = join(folder, "derivatives", `${rowId}.md`);
  if (!existsSync(path)) {
    throw new Error(`missing card derivative ${path} — every quote-card row needs derivatives/<id>.md for its caption`);
  }
  const { fm, body } = splitFrontmatter(readFileSync(path, "utf8"));
  const quote = body.trim();
  if (!quote) throw new Error(`card derivative ${path} has no quote text in its body`);
  return { quote, fm };
}

function approvedCards(folder: string) {
  const { rows } = readQueue(folder);
  return rows.filter((r) => r.status === "approve" && r.platform === "quote-card");
}

// The destinations + caption for one card: inline-link group and/or no-link group per cta.yaml.
function planGroups(
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
        const { url } = resolveCta(cardCopy(folder, c.id).fm, canonicalUrl, cfg, sourceKind);
        console.log(`  • ${c.id}  ${c.asset} (${rendered})  ${url ? `link → ${url}` : "no link"}`);
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

  const cards = approvedCards(folder);
  if (cards.length === 0) {
    console.log("no approved quote-card rows in the review queue");
    return;
  }

  // Reuse guard: check if this slug was already published as a quote-card recently.
  // Pass --force-reuse to bypass the window and proceed anyway.
  const slug = basename(folder);
  if (forceReuse) {
    console.log("reuse guard bypassed via --force-reuse, proceeding with publish");
  } else {
    const reuseResult = checkReuse(slug, "quote-card");
    if (!reuseResult.allowed) {
      console.warn(`reuse guard: ${reuseResult.reason} — skipping cards`);
      return;
    }
  }

  const provider = await loadProvider();
  const allTargets = await provider.listTargets();
  const cfg = loadCtaConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const sourceKind = loadSourceKind(folder);

  // Claim a slot per card from the unified scheduler (windowKey `quote-card`), de-conflicting
  // against each target platform so a card never shares a day with a text post there. `--at`
  // overrides for a one-off/test (bypasses the scheduler + ledger).
  let times: string[];
  if (atOverride) {
    const at = new Date(atOverride);
    if (Number.isNaN(at.getTime())) throw new Error(`--at is not a valid ISO date: ${atOverride}`);
    if (at.getTime() <= Date.now()) throw new Error(`--at is in the past: ${atOverride} — pick a future time`);
    times = cards.map(() => at.toISOString());
  } else {
    times = claimSlots({
      windowKey: "quote-card",
      conflictPlatforms: conflictPlatforms(allTargets),
      count: cards.length,
      asset: `${basename(folder)}/cards`,
      by: "cards",
    }).times;
  }

  for (let i = 0; i < cards.length; i++) {
    const row = cards[i];
    const imagePath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    if (!existsSync(imagePath)) {
      throw new Error(`missing ${imagePath} — render the card first: npm run render -- --still ${folder}`);
    }
    const scheduledFor = times[i];
    if (!scheduledFor || scheduledFor === "next-free-slot") {
      throw new Error("no card slot available — give config/platforms.yaml a `quote-card` cadence (posts_per_week + slot_days + slot_time_pst)");
    }
    const { quote, fm } = cardCopy(folder, row.id);
    const { url: ctaUrl, label: ctaLabel, usedFallback } = resolveCta(fm, canonicalUrl, cfg, sourceKind);
    if (usedFallback) {
      console.log(`  ↳ note: ${row.id} cta:source → homepage (no canonical_url in source.md)`);
    }

    const groups = planGroups(quote, allTargets, ctaUrl, ctaLabel, cfg);
    const refs: string[] = [];
    for (const g of groups) {
      const dest = g.targets.map((t) => t.platform).join("+");
      const link = g.caption.includes("\n") ? " +link" : "";
      const ref = await provider.scheduleImagePost({ imagePath, caption: g.caption, scheduledFor, targets: g.targets });
      refs.push(ref);
      appendPublishLog(folder, `${row.id} → ${provider.providerName} ${ref} [${dest}${link}] (scheduled ${scheduledFor})`);
    }
    setStatus(folder, row, "published");
    appendBetPlacement(folder, row.id, row.platform, `${refs.join(" | ")} @ ${scheduledFor}`, fm, quote);
    console.log(`scheduled: ${row.id} → ${provider.providerName} ${refs.join(" | ")} @ ${scheduledFor}`);
  }
}

// Run the CLI only when executed directly, so the module can be imported (e.g. in tests) without
// triggering main()/process.exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
