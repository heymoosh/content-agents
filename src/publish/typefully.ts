import "../util/env.js";
import { readFileSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { loadCtaConfig, loadCanonicalUrl, resolveCta } from "./cta.js";
import { claimSlots, fmtLa } from "./slots.js";

// Push approved text posts (x / linkedin / bluesky) from a content folder's review queue to
// Typefully as SCHEDULED DRAFTS — never instant publish. Each post gets an EXPLICIT publish time
// from the UNIFIED scheduler (src/publish/slots.ts + config/platforms.yaml cadence + the shared
// slot ledger), so text and cards never double-book a platform on the same day — across runs and
// streams. Platforms without a cadence fall back to Typefully "next-free-slot".
//   tsx src/publish/typefully.ts <content-folder> | --list
// Needs TYPEFULLY_API_KEY (and optionally TYPEFULLY_SOCIAL_SET_ID) in .env.

const BASE = "https://api.typefully.com/v2";
const TEXT_PLATFORMS = new Set(["x", "linkedin", "bluesky"]);

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) throw new Error("TYPEFULLY_API_KEY missing in .env (generate at typefully.com settings)");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 402) {
    throw new Error(
      "Typefully returned 402 — API drafts need a paid plan (or the account is paused). " +
        "Check typefully.com/pricing, or switch the publish path to Postiz (see docs/setup-typefully.md)."
    );
  }
  if (!res.ok) throw new Error(`typefully ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function socialSetId(): Promise<string> {
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

function loadPlatformMax(): Record<string, number> {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
      platforms?: Record<string, { max_chars?: number }>;
    };
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg.platforms ?? {})) out[k] = v.max_chars ?? Infinity;
    return out;
  } catch {
    return {};
  }
}

// Build the Typefully `posts` array, placing the CTA link per config so the body stays clean.
// Returns a manual-comment string when the platform needs the link added by hand (LinkedIn).
function buildPosts(
  body: string,
  ctaUrl: string | null,
  ctaLabel: string,
  placement: string,
  max: number
): { posts: { text: string }[]; manualComment: string | null } {
  if (!ctaUrl) return { posts: [{ text: body }], manualComment: null };
  const ctaLine = `${ctaLabel} ${ctaUrl}`.trim();

  if (placement === "comment") {
    // LinkedIn: links are suppressed in-body and the API can't post a first comment for us.
    return { posts: [{ text: body }], manualComment: ctaLine };
  }
  if (placement === "inline") {
    const combined = `${body}\n\n${ctaLine}`;
    if (combined.length <= max) return { posts: [{ text: combined }], manualComment: null };
    return { posts: [{ text: body }, { text: ctaLine }], manualComment: null }; // would overflow → reply
  }
  // "reply" (X) or any unknown placement → link in the first reply
  return { posts: [{ text: body }, { text: ctaLine }], manualComment: null };
}

// Read-only: list what's currently scheduled in Typefully (sanity-check the queue). No writes.
//   tsx src/publish/typefully.ts --list
async function runList(): Promise<void> {
  const setId = await socialSetId();
  const res = (await api(`/social-sets/${setId}/drafts?limit=50`)) as
    | { results?: TypefullyDraft[] }
    | TypefullyDraft[];
  const list = Array.isArray(res) ? res : res.results ?? [];
  const scheduled = list
    .filter((d) => d.scheduled_date && (d.status === "scheduled" || new Date(d.scheduled_date) > new Date()))
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime());
  if (!scheduled.length) {
    console.log("No scheduled drafts found in Typefully.");
    return;
  }
  console.log(`Scheduled in Typefully (${scheduled.length}), times in PT:`);
  for (const d of scheduled) {
    const plats =
      [
        ["x", d.x_post_enabled],
        ["linkedin", d.linkedin_post_enabled],
        ["bluesky", d.bluesky_post_enabled],
        ["threads", d.threads_post_enabled],
        ["mastodon", d.mastodon_post_enabled],
      ]
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",") || "?";
    console.log(`  ${fmtLa(new Date(d.scheduled_date!))}  [${plats}]  ${d.draft_title ?? d.id}`);
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
  const { rows } = readQueue(folder);
  const approved = rows.filter((r) => r.status === "approve" && TEXT_PLATFORMS.has(r.platform));
  if (approved.length === 0) {
    console.log("no approved x/linkedin/bluesky rows in the review queue");
    return;
  }

  const setId = await socialSetId();
  const cfg = loadCtaConfig();
  const canonicalUrl = loadCanonicalUrl(folder);
  const maxMap = loadPlatformMax();

  // Claim an explicit publish time per row from the unified scheduler (config/platforms.yaml
  // cadence + shared ledger). Rows of a platform fill consecutive free slots; the ledger keeps
  // them from colliding with cards or a separate run. Platforms with no cadence → "next-free-slot".
  const byPlatform: Record<string, typeof approved> = {};
  for (const r of approved) (byPlatform[r.platform] ??= []).push(r);
  const slotByRow = new Map<string, string>(); // rowId → ISO publish_at | "next-free-slot"
  const whenByRow = new Map<string, string>(); // rowId → human label for logs
  for (const [platform, rowsP] of Object.entries(byPlatform)) {
    const { times, labels } = claimSlots({
      windowKey: platform,
      conflictPlatforms: [platform],
      count: rowsP.length,
      asset: `${basename(folder)}/${platform}`,
      by: "typefully",
    });
    rowsP.forEach((r, i) => {
      slotByRow.set(r.id, times[i] ?? "next-free-slot");
      whenByRow.set(r.id, labels[i] ?? "next-free-slot");
    });
  }
  console.log("Cadence schedule (PT):");
  for (const [platform, rowsP] of Object.entries(byPlatform)) {
    console.log(`  ${platform}:`);
    for (const r of rowsP) console.log(`    ${r.id} → ${whenByRow.get(r.id)}`);
  }

  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const platformKey = row.platform === "x" ? "x" : row.platform; // typefully platform keys: x, linkedin, bluesky

    // Resolve the CTA link (shared funnel layer — src/publish/cta.ts), then place it per cta.yaml.
    const { url: ctaUrl, label: ctaLabel, usedFallback } = resolveCta(fm, canonicalUrl, cfg);
    if (usedFallback) {
      console.log(`  ↳ note: ${row.id} cta:source → homepage (no canonical_url in source.md)`);
    }
    const placement = cfg.placement[row.platform] ?? "inline";
    const { posts, manualComment } = buildPosts(body, ctaUrl, ctaLabel, placement, maxMap[row.platform] ?? Infinity);

    const publishAt = slotByRow.get(row.id) ?? "next-free-slot";
    const when = whenByRow.get(row.id) ?? "next-free-slot";
    const draft = await api(`/social-sets/${setId}/drafts`, {
      method: "POST",
      body: JSON.stringify({
        draft_title: `${row.id} (content-agents)`,
        publish_at: publishAt,
        platforms: {
          [platformKey]: {
            enabled: true,
            posts,
          },
        },
      }),
    }) as { id?: string | number; share_url?: string };
    setStatus(folder, row, "published");
    const placeNote = ctaUrl ? `, cta→${placement}` : "";
    appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${row.platform}, ${when}${placeNote})`);
    if (manualComment) {
      appendPublishLog(folder, `  ↳ ACTION: add as the first comment on ${row.id} in Typefully → ${manualComment}`);
    }
    appendBetPlacement(folder, row.id, row.platform, `typefully draft ${draft.id ?? "?"} @ ${when}`, fm, body);
    console.log(
      `scheduled: ${row.id} (${row.platform}) → ${when} → typefully draft ${draft.id ?? "?"}${placeNote}` +
        (manualComment ? `\n  ↳ add link as first comment: ${manualComment}` : "")
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
