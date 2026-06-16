import "../util/env.js";
import { readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";

// Push approved text posts (x / linkedin / bluesky) from a content folder's review queue
// to Typefully as SCHEDULED DRAFTS (next free slot) — never instant publish.
//   tsx src/publish/typefully.ts <content-folder>
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

// CTA placement per platform (config/cta.yaml). Keeps the link out of the body where the
// platform algorithm penalizes in-post links (X, LinkedIn) — see Platform Reference.
function loadCtaPlacement(): Record<string, string> {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "cta.yaml"), "utf8")) as {
      placement?: Record<string, string>;
    };
    return cfg.placement ?? {};
  } catch {
    return {};
  }
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

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/typefully.ts <content-folder>");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const { rows } = readQueue(folder);
  const approved = rows.filter((r) => r.status === "approve" && TEXT_PLATFORMS.has(r.platform));
  if (approved.length === 0) {
    console.log("no approved x/linkedin/bluesky rows in the review queue");
    return;
  }

  const setId = await socialSetId();
  const placementMap = loadCtaPlacement();
  const maxMap = loadPlatformMax();
  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const platformKey = row.platform === "x" ? "x" : row.platform; // typefully platform keys: x, linkedin, bluesky

    const rawCta = typeof fm.cta === "string" ? fm.cta.trim() : "";
    const ctaUrl = rawCta && rawCta.toLowerCase() !== "none" ? rawCta : null;
    const ctaLabel = typeof fm.cta_label === "string" ? fm.cta_label : "";
    const placement = placementMap[row.platform] ?? "inline";
    const { posts, manualComment } = buildPosts(body, ctaUrl, ctaLabel, placement, maxMap[row.platform] ?? Infinity);

    const draft = await api(`/social-sets/${setId}/drafts`, {
      method: "POST",
      body: JSON.stringify({
        draft_title: `${row.id} (content-agents)`,
        publish_at: "next-free-slot",
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
    appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${row.platform}, next-free-slot${placeNote})`);
    if (manualComment) {
      appendPublishLog(folder, `  ↳ ACTION: add as the first comment on ${row.id} in Typefully → ${manualComment}`);
    }
    appendBetPlacement(folder, row.id, row.platform, `typefully draft ${draft.id ?? "?"}`, fm, body);
    console.log(
      `scheduled: ${row.id} (${row.platform}) → typefully draft ${draft.id ?? "?"}${placeNote}` +
        (manualComment ? `\n  ↳ add link as first comment: ${manualComment}` : "")
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
