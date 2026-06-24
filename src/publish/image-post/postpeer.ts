import "../../util/env.js";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// PostPeer image-post adapter — the PRIMARY quote-card publisher (config/providers.yaml:
// `image_post: postpeer`). Mirrors src/publish/tiktok.ts: same `x-access-key` auth, same
// `https://api.postpeer.dev/v1` base, same two-step `media/upload` presign → PUT bytes → `POST
// /posts`. The only differences are image mediaItems (`type:"image"` + altText, mime image/png)
// and fan-out to every connected image account instead of the single TikTok account.
//
// A card posts EVERYWHERE: one /posts call fans it to all connected, image-capable accounts
// (PostPeer accepts a platforms array). Targets are auto-discovered from /connect/integrations, so
// no per-platform account ids live in .env — connect accounts in the PostPeer dashboard and they're
// picked up. Video-only platforms (TikTok, YouTube) are never targeted; POSTPEER_IMAGE_PLATFORMS
// can narrow the fan-out to a comma list of platform strings (e.g. "bluesky") for a careful test.
//
// Needs POSTPEER_API_KEY. List/verify targets with `npm run publish:cards -- --check`.

const API = "https://api.postpeer.dev/v1";

export const providerName = "postpeer";

// PostPeer platform strings that can't take a still image — excluded from the card fan-out.
// (Note PostPeer names X "twitter", not "x".)
const VIDEO_ONLY = new Set(["tiktok", "youtube"]);

interface Integration {
  id?: string;
  platform?: string;
  platformUserId?: string;
}

function apiKey(): string {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) throw new Error("POSTPEER_API_KEY missing in .env — see docs/setup-tiktok.md");
  return key;
}

async function listIntegrations(): Promise<Integration[]> {
  const res = await fetch(`${API}/connect/integrations`, { headers: { "x-access-key": apiKey() } });
  if (!res.ok) {
    throw new Error(`postpeer connect/integrations → ${res.status} ${await res.text()} (401 = bad/missing POSTPEER_API_KEY)`);
  }
  const json = (await res.json()) as { integrations?: Integration[] };
  return json.integrations ?? [];
}

// Optional allowlist (comma list of platform strings) to narrow the fan-out; null = post everywhere.
function platformAllowlist(): Set<string> | null {
  const raw = process.env.POSTPEER_IMAGE_PLATFORMS?.trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean));
}

// Every connected, image-capable account to fan a card out to: all integrations except video-only
// platforms, optionally narrowed by POSTPEER_IMAGE_PLATFORMS.
export function selectTargets(accounts: Integration[]): { platform: string; accountId: string }[] {
  const allow = platformAllowlist();
  return accounts
    .filter((i) => i.id && i.platform && !VIDEO_ONLY.has(i.platform.toLowerCase()))
    .filter((i) => !allow || allow.has(i.platform!.toLowerCase()))
    .map((i) => ({ platform: i.platform as string, accountId: i.id as string }));
}

// Every connected image account a card can fan out to. cards.ts calls this, then groups the targets
// by CTA placement and schedules each group with its own caption — so the provider never decides
// the destination set itself.
export async function listTargets(): Promise<{ platform: string; accountId: string }[]> {
  const targets = selectTargets(await listIntegrations());
  if (targets.length === 0) {
    const allow = platformAllowlist();
    throw new Error(
      "no image-capable PostPeer accounts connected" +
        (allow ? ` matching POSTPEER_IMAGE_PLATFORMS=${[...allow].join(",")}` : "") +
        " — connect one in the PostPeer dashboard (`npm run publish:cards -- --check` lists them)."
    );
  }
  return targets;
}

// Two-step upload: ask PostPeer for a presigned URL, PUT the PNG bytes to it, get a public URL.
// The presign response nests the URLs under `data` (same shape tiktok.ts handles).
export async function uploadImage(imagePath: string): Promise<string> {
  const presign = await fetch(`${API}/media/upload`, {
    method: "POST",
    headers: { "x-access-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ filename: basename(imagePath), mimeType: "image/png" }),
  });
  if (!presign.ok) throw new Error(`postpeer media/upload → ${presign.status} ${await presign.text()}`);
  const body = (await presign.json()) as {
    data?: { uploadUrl?: string; publicUrl?: string };
    uploadUrl?: string;
    publicUrl?: string;
  };
  const { uploadUrl, publicUrl } = body.data ?? body;
  if (!uploadUrl || !publicUrl) throw new Error("postpeer media/upload returned no uploadUrl/publicUrl");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: readFileSync(imagePath),
  });
  if (!put.ok) throw new Error(`postpeer presigned PUT → ${put.status} ${await put.text()}`);
  return publicUrl;
}

// Schedule one quote card to a given set of image accounts. scheduledFor is a full UTC ISO
// timestamp (RFC3339 with Z) — PostPeer validates `scheduledFor` as date-time; we pass timezone
// "UTC" alongside it, exactly like tiktok.ts. SCHEDULED, never instant.
export async function scheduleImagePost(args: {
  imagePath: string;
  caption: string;
  scheduledFor: string;
  targets: { platform: string; accountId?: string }[];
}): Promise<string> {
  const targets = args.targets;
  const mediaUrl = await uploadImage(args.imagePath);
  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers: { "x-access-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({
      // PostPeer's mediaItems schema is strict ({type, url} only) — it 400s on an altText property.
      // The quote text rides in `content`, so screen readers still get it from the post body.
      content: args.caption,
      mediaItems: [{ type: "image", url: mediaUrl }],
      platforms: targets.map((t) => ({ platform: t.platform, accountId: t.accountId })),
      scheduledFor: args.scheduledFor,
      timezone: "UTC",
    }),
  });
  if (res.status === 402 || res.status === 429) {
    throw new Error(
      `PostPeer returned ${res.status} — likely the free-tier posts (20/mo) are exhausted; top up ` +
        `never-expiring credits at postpeer.dev, or switch config/providers.yaml image_post to ` +
        `upload-post. Do not work around it. Body: ${await res.text()}`
    );
  }
  if (!res.ok) throw new Error(`postpeer posts → ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { postId?: string };
  const dest = targets.map((t) => t.platform).join("+");
  return json.postId ? `postpeer post ${json.postId} → ${dest}` : `postpeer (scheduled) → ${dest}`;
}

// Read-only preflight: confirm the API key authenticates and show which connected accounts a card
// will fan out to. No upload, no post, no quota. Called by cards.ts --check.
export async function check(): Promise<void> {
  const accounts = await listIntegrations();
  console.log(`PostPeer auth OK — ${accounts.length} connected account(s):`);
  for (const a of accounts) {
    console.log(`  • ${a.platform ?? "?"}  id=${a.id ?? "?"}  user=${a.platformUserId ?? "?"}`);
  }
  const targets = selectTargets(accounts);
  if (targets.length === 0) {
    const allow = platformAllowlist();
    console.error(
      "✗ no image-capable accounts to post to" +
        (allow ? ` matching POSTPEER_IMAGE_PLATFORMS=${[...allow].join(",")}` : "") +
        " — connect an image account (Bluesky / X / LinkedIn / …) in the PostPeer dashboard."
    );
    process.exit(1);
  }
  console.log(`✓ cards fan out to ${targets.length} image account(s): ${targets.map((t) => t.platform).join(", ")}`);
}
