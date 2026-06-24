import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { claimSlots } from "./slots.js";

// Schedule approved `tiktok` rows to TikTok via PostPeer (a sanctioned API relay that holds
// TikTok's audited Content Posting access — we never touch TikTok's API or a browser directly).
//   tsx src/publish/tiktok.ts <content-folder>
// Needs POSTPEER_API_KEY + POSTPEER_TIKTOK_ACCOUNT_ID — see docs/setup-tiktok.md.
//
// One render fans out to two video destinations: youtube.ts handles the short row, this handles
// the `tiktok` row. Caption = video/title.txt verbatim (extraction-first).
//
// NOTE: TikTok's "made with AI" label is a per-post toggle in the app's upload screen, which the
// API bypasses — and PostPeer doesn't expose the flag. Our shorts are AI-assisted, so disclose in
// the caption (video/title.txt) or post AI-heavy shorts by hand. See docs/setup-tiktok.md.

const API = "https://api.postpeer.dev/v1";

function apiKey(): string {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) throw new Error("POSTPEER_API_KEY missing in .env — see docs/setup-tiktok.md");
  return key;
}

// Resolve scheduled time(s) from the UNIFIED scheduler (slots.ts, windowKey "tiktok"), so TikTok
// shares ONE cadence + ledger with text and cards — no channel double-books a PT day. PostPeer
// validates `scheduledFor` as RFC3339 (must carry the `Z`/offset); we send full UTC ISO + timezone
// "UTC". Precedence: TIKTOK_SCHEDULE_AT (explicit ISO, manual one-off) → the "tiktok" cadence in
// config/platforms.yaml → TIKTOK_SCHEDULE_LEAD_MIN out (default 60) when no cadence is configured.
function resolveTimes(count: number, asset: string): string[] {
  const at = process.env.TIKTOK_SCHEDULE_AT?.trim();
  if (at) {
    const when = new Date(at);
    if (Number.isNaN(when.getTime())) throw new Error(`TIKTOK_SCHEDULE_AT is not a valid ISO date: ${at}`);
    if (when.getTime() <= Date.now()) throw new Error(`TIKTOK_SCHEDULE_AT is in the past: ${at} — TikTok needs a future time`);
    return Array(count).fill(when.toISOString());
  }
  const { times } = claimSlots({ windowKey: "tiktok", conflictPlatforms: ["tiktok"], count, asset, by: "tiktok" });
  return times.map((t, i) => {
    if (t && t !== "next-free-slot") return t; // got a cadence slot from the shared scheduler
    const leadMin = Number(process.env.TIKTOK_SCHEDULE_LEAD_MIN ?? "60"); // no tiktok cadence → lead-time fallback
    if (Number.isNaN(leadMin) || leadMin <= 0) {
      throw new Error(`TIKTOK_SCHEDULE_LEAD_MIN must be a positive number, got: ${process.env.TIKTOK_SCHEDULE_LEAD_MIN}`);
    }
    return new Date(Date.now() + leadMin * 60_000 + i * 86_400_000).toISOString();
  });
}

// Two-step upload: ask PostPeer for a presigned URL, PUT the bytes to it, get back a public URL.
// The presign response nests the URLs under `data`.
export async function uploadVideo(videoPath: string): Promise<string> {
  const presign = await fetch(`${API}/media/upload`, {
    method: "POST",
    headers: { "x-access-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ filename: "short.mp4", mimeType: "video/mp4" }),
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
    headers: { "content-type": "video/mp4" },
    body: readFileSync(videoPath),
  });
  if (!put.ok) throw new Error(`postpeer presigned PUT → ${put.status} ${await put.text()}`);
  return publicUrl;
}

export async function scheduleToTikTok(videoPath: string, caption: string, scheduledFor: string): Promise<string> {
  const accountId = process.env.POSTPEER_TIKTOK_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("POSTPEER_TIKTOK_ACCOUNT_ID missing in .env — list your PostPeer accounts to get it (docs/setup-tiktok.md)");
  }

  const mediaUrl = await uploadVideo(videoPath);
  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers: { "x-access-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({
      content: caption,
      mediaItems: [{ type: "video", url: mediaUrl }],
      platforms: [{ platform: "tiktok", accountId }],
      scheduledFor,
      timezone: "UTC",
    }),
  });
  if (res.status === 402 || res.status === 429) {
    throw new Error(
      `PostPeer returned ${res.status} — likely the free-tier posts (20/mo) are exhausted; top up ` +
        `never-expiring credits at postpeer.dev. Do not work around it. Body: ${await res.text()}`
    );
  }
  if (!res.ok) throw new Error(`postpeer posts → ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { postId?: string };
  return json.postId ? `postpeer post ${json.postId}` : "postpeer (scheduled)";
}

// Read-only preflight: confirm the API key authenticates and POSTPEER_TIKTOK_ACCOUNT_ID is a
// connected TikTok account. No upload, no post, no quota. Run `npm run publish:tiktok -- --check`.
async function runCheck(): Promise<void> {
  const res = await fetch(`${API}/connect/integrations`, { headers: { "x-access-key": apiKey() } });
  if (!res.ok) {
    throw new Error(`postpeer connect/integrations → ${res.status} ${await res.text()} (401 = bad/missing POSTPEER_API_KEY)`);
  }
  const json = (await res.json()) as { integrations?: { id?: string; platform?: string; platformUserId?: string }[] };
  const accounts = json.integrations ?? [];
  console.log(`PostPeer auth OK — ${accounts.length} connected account(s):`);
  for (const a of accounts) {
    console.log(`  • ${a.platform ?? "?"}  id=${a.id ?? "?"}  user=${a.platformUserId ?? "?"}`);
  }

  const want = process.env.POSTPEER_TIKTOK_ACCOUNT_ID;
  if (!want) {
    console.error("✗ POSTPEER_TIKTOK_ACCOUNT_ID not set — copy a tiktok id from above into .env.");
    process.exit(1);
  }
  const match = accounts.find((a) => a.id === want);
  if (!match) {
    console.error(`✗ POSTPEER_TIKTOK_ACCOUNT_ID=${want} is not among your connected accounts.`);
    process.exit(1);
  }
  if (match.platform !== "tiktok") {
    console.error(`✗ POSTPEER_TIKTOK_ACCOUNT_ID=${want} is connected but platform is "${match.platform}", not tiktok.`);
    process.exit(1);
  }
  console.log(`✓ POSTPEER_TIKTOK_ACCOUNT_ID=${want} is a connected TikTok account — ready to schedule.`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/tiktok.ts <content-folder> | --check");
    process.exit(1);
  }
  if (arg === "--check") {
    await runCheck();
    return;
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const { rows } = readQueue(folder);
  const approved = rows.filter((r) => r.status === "approve" && r.platform === "tiktok");
  if (approved.length === 0) {
    console.log("no approved tiktok rows in the review queue");
    return;
  }

  const videoPath = join(folder, "video", "short.mp4");
  const titlePath = join(folder, "video", "title.txt");
  for (const p of [videoPath, titlePath]) {
    if (!existsSync(p)) throw new Error(`missing ${p}`);
  }
  const caption = readFileSync(titlePath, "utf8").trim();

  // The short's attribution lives in the video-script derivative's frontmatter (if present).
  const scriptPath = join(folder, "derivatives", "video-script.md");
  const { fm } = existsSync(scriptPath)
    ? splitFrontmatter(readFileSync(scriptPath, "utf8"))
    : { fm: {} as Record<string, unknown> };

  const times = resolveTimes(approved.length, `${basename(folder)}/tiktok`);
  for (let i = 0; i < approved.length; i++) {
    const row = approved[i];
    const scheduledFor = times[i];
    const ref = await scheduleToTikTok(videoPath, caption, scheduledFor);
    setStatus(folder, row, "published");
    appendPublishLog(folder, `${row.id} → tiktok ${ref} (scheduled ${scheduledFor})`);
    appendBetPlacement(folder, row.id, "tiktok", `${ref} @ ${scheduledFor}`, fm, caption);
    console.log(`scheduled: ${row.id} → tiktok ${ref} @ ${scheduledFor}`);
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
