import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";

// Upload approved video rows to YouTube as Shorts (private by default — flip to public
// in YouTube Studio after a spot-check, or set YOUTUBE_PRIVACY=public).
//   tsx src/publish/youtube.ts <content-folder>
// Needs YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN — see docs/setup-youtube-oauth.md.

async function accessToken(): Promise<string> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error("YouTube OAuth env vars missing — see docs/setup-youtube-oauth.md");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      refresh_token: YOUTUBE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function uploadShort(videoPath: string, title: string, description: string): Promise<string> {
  const token = await accessToken();
  const metadata = {
    snippet: { title, description, categoryId: "28" }, // 28 = Science & Technology
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY ?? "private",
      selfDeclaredMadeForKids: false,
    },
  };
  const boundary = "content-agents-upload";
  const head = Buffer.from(
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n--${boundary}\r\ncontent-type: video/mp4\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, readFileSync(videoPath), tail]);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
        "content-length": String(body.length),
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/youtube.ts <content-folder>");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  const { rows } = readQueue(folder);
  const approved = rows.filter(
    (r) => r.status === "approve" && (r.platform === "youtube" || r.format === "short")
  );
  if (approved.length === 0) {
    console.log("no approved video rows in the review queue");
    return;
  }

  const videoPath = join(folder, "video", "short.mp4");
  const titlePath = join(folder, "video", "title.txt");
  const descPath = join(folder, "video", "description.txt");
  for (const p of [videoPath, titlePath, descPath]) {
    if (!existsSync(p)) throw new Error(`missing ${p}`);
  }
  let title = readFileSync(titlePath, "utf8").trim();
  if (!/#shorts/i.test(title)) title = `${title} #Shorts`;
  const description = readFileSync(descPath, "utf8").trim();

  // The short's attribution lives in the video-script derivative's frontmatter (if present).
  const scriptPath = join(folder, "derivatives", "video-script.md");
  const { fm } = existsSync(scriptPath)
    ? splitFrontmatter(readFileSync(scriptPath, "utf8"))
    : { fm: {} as Record<string, unknown> };

  for (const row of approved) {
    const videoId = await uploadShort(videoPath, title, description);
    const url = `https://youtube.com/shorts/${videoId}`;
    setStatus(folder, row, "published");
    appendPublishLog(folder, `${row.id} → youtube ${url} (privacy: ${process.env.YOUTUBE_PRIVACY ?? "private"})`);
    appendBetPlacement(folder, row.id, "youtube", url, fm, title);
    console.log(`uploaded: ${url}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
