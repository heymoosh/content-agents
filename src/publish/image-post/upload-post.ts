import "../../util/env.js";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// Upload-Post image adapter — the BACKUP quote-card publisher, swapped in by setting
// config/providers.yaml `image_post: upload-post` when PostPeer's quota runs out. Same interface
// as src/publish/image-post/postpeer.ts (providerName / scheduleImagePost / check) so cards.ts can
// pick either by name.
//
// Like PostPeer it fans a card out EVERYWHERE: target platforms are auto-discovered from the
// profile's connected, image-capable accounts (video-only TikTok/YouTube excluded). Upload-Post
// differs in mechanics: one multipart POST does upload + create (no presign), auth is
// `Authorization: Apikey <key>`, the post is addressed to a named profile (`user`) plus a
// `platform[]` list, and scheduling uses `scheduled_date` (ISO-8601) + `timezone`. Free tier is 10
// posts/mo. Note Upload-Post names X "x" (not "twitter"). Docs: https://docs.upload-post.com/api
//
// Needs UPLOAD_POST_API_KEY + UPLOAD_POST_USER (the profile name). UPLOAD_POST_PLATFORMS overrides
// the auto-discovered fan-out with a comma list.

const API = "https://api.upload-post.com/api";

export const providerName = "upload-post";

// Connected platforms that can't take a still image — excluded from the card fan-out.
const VIDEO_ONLY = new Set(["tiktok", "youtube"]);

interface Profile {
  username?: string;
  social_accounts?: Record<string, unknown>;
}

function apiKey(): string {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new Error("UPLOAD_POST_API_KEY missing in .env (get one at upload-post.com)");
  return key;
}

function profileName(): string {
  const user = process.env.UPLOAD_POST_USER;
  if (!user) throw new Error("UPLOAD_POST_USER missing in .env — the Upload-Post profile name to post as");
  return user;
}

async function fetchProfile(): Promise<Profile> {
  const res = await fetch(`${API}/uploadposts/users`, { headers: { Authorization: `Apikey ${apiKey()}` } });
  if (!res.ok) {
    throw new Error(`upload-post uploadposts/users → ${res.status} ${await res.text()} (401 = bad/missing UPLOAD_POST_API_KEY)`);
  }
  const json = (await res.json()) as { profiles?: Profile[]; users?: Profile[] };
  const profiles = json.profiles ?? json.users ?? [];
  const want = profileName();
  const match = profiles.find((p) => p.username === want);
  if (!match) {
    throw new Error(`UPLOAD_POST_USER=${want} is not among your Upload-Post profiles (${profiles.map((p) => p.username).join(", ") || "none"})`);
  }
  return match;
}

// Image-capable platforms connected to a profile = every social_accounts key with a connected
// value that isn't video-only.
function connectedImagePlatforms(p: Profile): string[] {
  return Object.entries(p.social_accounts ?? {})
    .filter(([k, v]) => v && v !== "" && !VIDEO_ONLY.has(k.toLowerCase()))
    .map(([k]) => k.toLowerCase());
}

// The platforms a card can fan out to: UPLOAD_POST_PLATFORMS override if set, else auto-discovered.
async function imageTargets(): Promise<string[]> {
  const override = process.env.UPLOAD_POST_PLATFORMS?.trim();
  if (override) return override.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const targets = connectedImagePlatforms(await fetchProfile());
  if (targets.length === 0) {
    throw new Error(`no image-capable accounts connected to Upload-Post profile ${profileName()} — connect one in the dashboard.`);
  }
  return targets;
}

// Every connected image account a card can fan out to. cards.ts calls this, then groups the targets
// by CTA placement and schedules each group with its own caption.
export async function listTargets(): Promise<{ platform: string }[]> {
  return (await imageTargets()).map((platform) => ({ platform }));
}

// Schedule one quote card to a given set of platforms in a single multipart POST. The PNG is
// uploaded as a `photos[]` file part; scheduled_date makes Upload-Post return 202 + a job_id.
// SCHEDULED, never instant.
export async function scheduleImagePost(args: {
  imagePath: string;
  caption: string;
  scheduledFor: string;
  targets: { platform: string }[];
}): Promise<string> {
  const targets = args.targets.map((t) => t.platform);
  const fd = new FormData();
  fd.append("user", profileName());
  for (const p of targets) fd.append("platform[]", p);
  fd.append(
    "photos[]",
    new Blob([readFileSync(args.imagePath)], { type: "image/png" }),
    basename(args.imagePath)
  );
  fd.append("title", args.caption);
  fd.append("scheduled_date", args.scheduledFor);
  fd.append("timezone", "UTC");

  const res = await fetch(`${API}/upload_photos`, {
    method: "POST",
    headers: { Authorization: `Apikey ${apiKey()}` }, // let fetch set the multipart boundary
    body: fd,
  });
  if (res.status === 402 || res.status === 429) {
    throw new Error(
      `Upload-Post returned ${res.status} — likely the free tier (10 posts/mo) is exhausted; ` +
        `upgrade at upload-post.com or switch config/providers.yaml image_post back to postpeer. ` +
        `Do not work around it. Body: ${await res.text()}`
    );
  }
  if (!res.ok) throw new Error(`upload-post upload_photos → ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { job_id?: string; request_id?: string; success?: boolean };
  const ref = json.job_id ?? json.request_id;
  const dest = targets.join("+");
  return ref ? `upload-post job ${ref} → ${dest}` : `upload-post (scheduled) → ${dest}`;
}

// Read-only preflight: confirm the API key authenticates, the profile exists, and show which
// connected accounts a card will fan out to. No upload, no post, no quota. Called by cards.ts --check.
export async function check(): Promise<void> {
  const p = await fetchProfile();
  const connected = connectedImagePlatforms(p);
  console.log(`Upload-Post auth OK — profile ${p.username}`);
  const override = process.env.UPLOAD_POST_PLATFORMS?.trim();
  const targets = override ? override.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : connected;
  if (targets.length === 0) {
    console.error(`✗ no image-capable accounts connected to ${p.username} — connect one in the Upload-Post dashboard.`);
    process.exit(1);
  }
  console.log(`✓ cards fan out to ${targets.length} image account(s): ${targets.join(", ")}`);
}
