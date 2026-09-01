import { readdirSync, readFileSync, renameSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { openDb, repoRoot } from "../db/db.js";
import { sha256File } from "../util/hash.js";
import { ImportRow, AudienceRow } from "./types.js";
import { parseX } from "./parse-x.js";
import {
  parseSubstack,
  parseSubstackExport,
  parseSubstackAudience,
  parseSubstackSummary,
  isSubstackSummaryFile,
} from "./parse-substack.js";
import { parseLinkedIn, parseLinkedInAudience } from "./parse-linkedin.js";
import { validateMeasurementBinding, type BrandId } from "../identity/brand.js";

const INBOX = join(repoRoot, "data", "inbox");
const PROCESSED = join(repoRoot, "data", "processed");
const PLATFORMS = ["x", "linkedin", "substack"] as const;

function toMediaType(format: ImportRow["format"]): "text" | "quote-card" | "video" | "note" | "unknown" {
  switch (format) {
    case "video": return "video";
    case "image": return "quote-card";
    case "text":
    case "thread":
    case "newsletter": return "text";
    default: return "unknown";
  }
}

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
      // The aggregate summary JSON carries audience rows only, no per-post rows (see parseAudienceFor).
      if (isSubstackSummaryFile(name)) return [];
      // A full export is an unpacked folder (posts.csv + per-post event logs); a loose stats
      // download is a single CSV. Handle both.
      return isDir ? parseSubstackExport(path) : parseSubstack(name, readFileSync(path, "utf8"));
    default:
      throw new Error(`unknown platform folder: ${platform}`);
  }
}

// Audience-level rows (follower totals / demographics) alongside the per-post data. Only LinkedIn
// (xlsx) and Substack (export folder) carry any; X and Bluesky-CSV produce none here.
async function parseAudienceFor(platform: string, path: string, isDir: boolean): Promise<AudienceRow[]> {
  const name = basename(path);
  if (platform === "linkedin" && [".xlsx", ".xls"].includes(extname(name).toLowerCase())) {
    return parseLinkedInAudience(name, readFileSync(path));
  }
  if (platform === "substack" && isDir) {
    return parseSubstackAudience(path);
  }
  if (platform === "substack" && isSubstackSummaryFile(name)) {
    return parseSubstackSummary(name, readFileSync(path, "utf8"));
  }
  return [];
}

export interface ImportMeasurementBinding { brandId: BrandId; providerAccountId: string }

export async function runImport(binding: ImportMeasurementBinding): Promise<void> {
  const identity = validateMeasurementBinding(binding);
  const db = openDb();
  const now = new Date().toISOString();

  const upsertPost = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format, media_type, brand_id, provider_account_id)
    VALUES (@platform, @platformPostId, @postedAt, @url, @contentText, @format, @mediaType, @brandId, @providerAccountId)
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      posted_at = COALESCE(excluded.posted_at, posts.posted_at),
      url = COALESCE(excluded.url, posts.url),
      content_text = COALESCE(excluded.content_text, posts.content_text),
      format = COALESCE(excluded.format, posts.format),
      media_type = COALESCE(excluded.media_type, posts.media_type),
      brand_id = COALESCE(posts.brand_id, excluded.brand_id),
      provider_account_id = COALESCE(posts.provider_account_id, excluded.provider_account_id)
    WHERE (posts.brand_id IS NULL OR posts.brand_id = excluded.brand_id)
      AND (posts.provider_account_id IS NULL OR posts.provider_account_id = excluded.provider_account_id)
    RETURNING id
  `);
  const insertMetrics = db.prepare(`
    INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, clicks, new_follows, engagement_rate, raw_json, brand_id, provider_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudience = db.prepare(`
    INSERT OR IGNORE INTO audience (platform, captured_at, as_of_date, metric_type, dimension, value_label, value_count, value_pct, source_file, raw_json, brand_id, provider_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seenImport = db.prepare("SELECT 1 FROM imports WHERE sha256 = ?");
  const insertImport = db.prepare(
    "INSERT INTO imports (sha256, file_name, platform, imported_at, row_count, brand_id, provider_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
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
        const audienceRows = await parseAudienceFor(platform, path, isDir);
        const tx = db.transaction(() => {
          for (const row of rows) {
            const stored = upsertPost.get({ ...row, mediaType: toMediaType(row.format), brandId: identity.brandId, providerAccountId: identity.providerAccountId }) as { id: number } | undefined;
            if (!stored) throw new Error(`identity conflict for ${row.platform}/${row.platformPostId}`);
            const { id } = stored;
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
              JSON.stringify(row.raw), identity.brandId, identity.providerAccountId
            );
          }
          for (const a of audienceRows) {
            insertAudience.run(
              a.platform,
              a.capturedAt,
              a.asOfDate,
              a.metricType,
              a.dimension,
              a.valueLabel,
              a.valueCount,
              a.valuePct,
              a.sourceFile,
              JSON.stringify(a.raw), identity.brandId, identity.providerAccountId
            );
          }
          insertImport.run(hash, file, platform, now, rows.length, identity.brandId, identity.providerAccountId);
        });
        tx();
        mkdirSync(PROCESSED, { recursive: true });
        renameSync(path, join(PROCESSED, `${hash.slice(0, 8)}-${file}`));
        const audNote = audienceRows.length ? ` + ${audienceRows.length} audience rows` : "";
        console.log(`imported: ${platform}/${file} → ${rows.length} rows${audNote}`);
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

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  const cliValue = (flag: string): string | undefined => {
    const index = cliArgs.indexOf(flag);
    return index >= 0 ? cliArgs[index + 1] : undefined;
  };
  const brandId = cliValue("--brand");
  const providerAccountId = cliValue("--account");
  if (!brandId || !providerAccountId) {
    throw new Error("analytics import requires --brand <human-inference|charles|fiction> and --account <non-secret-provider-account-id>");
  }
  await runImport(validateMeasurementBinding({ brandId, providerAccountId }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
