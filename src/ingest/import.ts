import { readdirSync, readFileSync, renameSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { openDb, repoRoot } from "../db/db.js";
import { sha256File } from "../util/hash.js";
import { ImportRow } from "./types.js";
import { parseX } from "./parse-x.js";
import { parseSubstack, parseSubstackExport } from "./parse-substack.js";
import { parseLinkedIn } from "./parse-linkedin.js";

const INBOX = join(repoRoot, "data", "inbox");
const PROCESSED = join(repoRoot, "data", "processed");
const PLATFORMS = ["x", "linkedin", "substack"] as const;

async function parseEntry(platform: string, path: string, isDir: boolean): Promise<ImportRow[]> {
  const name = basename(path);
  switch (platform) {
    case "x":
      return parseX(name, readFileSync(path, "utf8"));
    case "linkedin":
      if (![".xlsx", ".xls"].includes(extname(name).toLowerCase())) {
        throw new Error(`LinkedIn drop must be the .xlsx analytics export (got ${name}).`);
      }
      return parseLinkedIn(name, readFileSync(path));
    case "substack":
      // A full export is an unpacked folder (posts.csv + per-post event logs); a loose stats
      // download is a single CSV. Handle both.
      return isDir ? parseSubstackExport(path) : parseSubstack(name, readFileSync(path, "utf8"));
    default:
      throw new Error(`unknown platform folder: ${platform}`);
  }
}

export async function runImport(): Promise<void> {
  const db = openDb();
  const now = new Date().toISOString();

  const upsertPost = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format)
    VALUES (@platform, @platformPostId, @postedAt, @url, @contentText, @format)
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      posted_at = COALESCE(excluded.posted_at, posts.posted_at),
      url = COALESCE(excluded.url, posts.url),
      content_text = COALESCE(excluded.content_text, posts.content_text),
      format = COALESCE(excluded.format, posts.format)
    RETURNING id
  `);
  const insertMetrics = db.prepare(`
    INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, clicks, new_follows, engagement_rate, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seenImport = db.prepare("SELECT 1 FROM imports WHERE sha256 = ?");
  const insertImport = db.prepare(
    "INSERT INTO imports (sha256, file_name, platform, imported_at, row_count) VALUES (?, ?, ?, ?, ?)"
  );

  let totalFiles = 0;
  let totalRows = 0;

  for (const platform of PLATFORMS) {
    const dir = join(INBOX, platform);
    let entries: { name: string; isDir: boolean }[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }));
    } catch {
      continue;
    }
    for (const { name: file, isDir } of entries) {
      const path = join(dir, file);
      // A Substack export folder has no single file to hash — use its posts.csv manifest.
      const hashSource = isDir && platform === "substack" ? join(path, "posts.csv") : path;
      try {
        const hash = sha256File(hashSource);
        if (seenImport.get(hash)) {
          console.log(`skip (already imported): ${platform}/${file}`);
          continue;
        }
        const rows = await parseEntry(platform, path, isDir);
        const tx = db.transaction((rows: ImportRow[]) => {
          for (const row of rows) {
            const { id } = upsertPost.get(row) as { id: number };
            insertMetrics.run(
              id,
              now,
              row.metrics.impressions,
              row.metrics.likes,
              row.metrics.replies,
              row.metrics.reposts,
              row.metrics.clicks,
              row.metrics.newFollows,
              row.metrics.engagementRate,
              JSON.stringify(row.raw)
            );
          }
          insertImport.run(hash, file, platform, now, rows.length);
        });
        tx(rows);
        mkdirSync(PROCESSED, { recursive: true });
        renameSync(path, join(PROCESSED, `${hash.slice(0, 8)}-${file}`));
        console.log(`imported: ${platform}/${file} → ${rows.length} rows`);
        totalFiles++;
        totalRows += rows.length;
      } catch (e) {
        // Isolate failures: a bad file in one platform must not abort the others.
        console.error(`skip (failed): ${platform}/${file} — ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log(
    totalFiles === 0
      ? "nothing to import (inbox empty or all files already imported)"
      : `done: ${totalFiles} file(s), ${totalRows} row(s)`
  );
  db.close();
}

runImport().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
