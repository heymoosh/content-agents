import "../util/env.js";
import { readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog } from "./queue.js";

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
  for (const row of approved) {
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const platformKey = row.platform === "x" ? "x" : row.platform; // typefully platform keys: x, linkedin, bluesky
    const draft = await api(`/social-sets/${setId}/drafts`, {
      method: "POST",
      body: JSON.stringify({
        draft_title: `${row.id} (content-agents)`,
        publish_at: "next-free-slot",
        platforms: {
          [platformKey]: {
            enabled: true,
            posts: [{ text: body }],
          },
        },
      }),
    }) as { id?: string | number; share_url?: string };
    setStatus(folder, row, "published");
    appendPublishLog(folder, `${row.id} → typefully draft ${draft.id ?? "?"} (${row.platform}, next-free-slot)`);
    console.log(`scheduled: ${row.id} (${row.platform}) → typefully draft ${draft.id ?? "?"}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
