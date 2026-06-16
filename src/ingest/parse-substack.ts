import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parseCsv, findColumn, toInt, toFloat } from "../util/csv.js";
import { sha256Text } from "../util/hash.js";
import { ImportRow, AudienceRow, ParseError } from "./types.js";

// Substack post-stats CSV (from the dashboard's posts export). Aliases cover the
// full-export `posts.csv` and the stats table download.
const COLS = {
  id: ["post id", "post_id", "id"],
  title: ["title", "post title"],
  date: ["post date", "post_date", "date", "published at", "email_sent_at"],
  url: ["url", "post url", "web link"],
  opens: ["opens", "unique opens", "opened"],
  openRate: ["open rate", "open_rate"],
  clicks: ["clicks", "unique clicks"],
  views: ["views", "web views", "total views"],
  newSubs: ["new subscriptions", "new subscribers", "signups", "subscriptions driven"],
  likes: ["likes", "reactions"],
  comments: ["comments"],
  shares: ["shares", "restacks"],
};

// Full Substack export FOLDER (the .zip unpacked): `posts.csv` is a manifest with no metrics;
// the real engagement lives in per-post event logs under `posts/<id>.opens.csv` and
// `posts/<id>.delivers.csv` (one row per open / delivery). We count those events per post and
// map: impressions = emails delivered (reach), engagementRate = opens / delivered (open rate).
// Substack exports have no per-post likes/comments/clicks here, so those stay null.
const safeIso = (d: string | null | undefined): string | null => {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
};

export function parseSubstackExport(dir: string): ImportRow[] {
  const postsCsv = join(dir, "posts.csv");
  if (!existsSync(postsCsv)) throw new ParseError(basename(dir), "no posts.csv in Substack export folder");
  const rows = parseCsv(readFileSync(postsCsv, "utf8"));
  if (rows.length < 2) throw new ParseError("posts.csv", "no data rows found");
  const header = rows[0];
  const ci = {
    id: findColumn(header, ["post_id", "post id", "id"]),
    date: findColumn(header, ["post_date", "post date", "email_sent_at", "date"]),
    published: findColumn(header, ["is_published", "published"]),
    title: findColumn(header, ["title"]),
    url: findColumn(header, ["url", "web link", "post url"]),
  };
  if (ci.id === -1 || ci.title === -1) {
    throw new ParseError("posts.csv", `missing post_id/title. Columns found: ${header.join(" | ")}`);
  }

  const postsDir = join(dir, "posts");
  let statFiles: string[] = [];
  try {
    statFiles = readdirSync(postsDir);
  } catch {
    statFiles = [];
  }
  // Event logs hold one row per event — a subscriber can open multiple times — so count DISTINCT
  // emails for a true unique-opens / unique-delivered figure (falls back to row count if no email
  // column). Without this, open rate can exceed 100%.
  const countUnique = (file: string): number | null => {
    const p = join(postsDir, file);
    if (!existsSync(p)) return null;
    const data = parseCsv(readFileSync(p, "utf8"));
    if (data.length < 2) return 0;
    const ix = findColumn(data[0], ["email"]);
    if (ix === -1) return data.length - 1;
    const seen = new Set<string>();
    for (const row of data.slice(1)) {
      const v = (row[ix] ?? "").trim().toLowerCase();
      if (v) seen.add(v);
    }
    return seen.size;
  };

  const out: ImportRow[] = [];
  for (const r of rows.slice(1)) {
    const id = r[ci.id];
    const title = ci.title === -1 ? "" : r[ci.title] ?? "";
    const published = ci.published === -1 ? "true" : r[ci.published] ?? "";
    if (!id) continue;
    if (!/^(true|1|yes)$/i.test(String(published).trim())) continue; // skip drafts
    if (!title.trim()) continue; // skip empty/untitled
    // posts.csv post_id is "<numericId>.<slug>"; the event-log files are named "<numericId>.*.csv".
    const numId = String(id).match(/^\d+/)?.[0] ?? String(id);
    const opens = statFiles.includes(`${numId}.opens.csv`) ? countUnique(`${numId}.opens.csv`) : null;
    const delivered = statFiles.includes(`${numId}.delivers.csv`) ? countUnique(`${numId}.delivers.csv`) : null;
    out.push({
      platform: "substack",
      platformPostId: numId,
      postedAt: safeIso(ci.date === -1 ? null : r[ci.date]),
      url: ci.url === -1 ? null : r[ci.url] || null,
      contentText: title,
      format: "newsletter",
      metrics: {
        impressions: delivered, // emails delivered = reach
        likes: null,
        replies: null,
        reposts: null,
        clicks: null,
        newFollows: null,
        engagementRate: opens != null && delivered ? opens / delivered : null, // open rate
      },
      raw: { ...Object.fromEntries(header.map((h, i) => [h, r[i]])), _opens: opens, _delivered: delivered },
    });
  }
  if (out.length === 0) throw new ParseError("posts.csv", "no published posts with stats found");
  return out;
}

// Substack audience from the export's email_list.*.csv: subscriber TOTAL + free/paid tier split.
// Substack exposes no real demographics — tier is the only "breakdown" available.
export function parseSubstackAudience(dir: string): AudienceRow[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const listFile = files.find((f) => /^email_list.*\.csv$/i.test(f));
  if (!listFile) return [];
  const rows = parseCsv(readFileSync(join(dir, listFile), "utf8"));
  if (rows.length < 2) return [];
  const header = rows[0];
  const ai = findColumn(header, ["active_subscription", "active subscription"]);
  const fp = findColumn(header, ["first_payment_at", "first payment at"]);

  let total = 0;
  let paid = 0;
  for (const r of rows.slice(1)) {
    if (r.length === 1 && !r[0]) continue;
    total++;
    const active = ai >= 0 && /^(true|1|yes)$/i.test((r[ai] ?? "").trim());
    const paidAt = fp >= 0 && (r[fp] ?? "").trim() !== "";
    if (active || paidAt) paid++;
  }
  if (total === 0) return [];

  const capturedAt = new Date().toISOString();
  const base = { platform: "substack" as const, capturedAt, sourceFile: listFile, asOfDate: null };
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  return [
    { ...base, metricType: "follower_total", dimension: null, valueLabel: null, valueCount: total, valuePct: null, raw: {} },
    { ...base, metricType: "demographic", dimension: "tier", valueLabel: "paid", valueCount: paid, valuePct: pct(paid), raw: {} },
    { ...base, metricType: "demographic", dimension: "tier", valueLabel: "free", valueCount: total - paid, valuePct: pct(total - paid), raw: {} },
  ];
}

export function parseSubstack(fileName: string, content: string): ImportRow[] {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new ParseError(fileName, "no data rows found");
  const header = rows[0];

  const idx = Object.fromEntries(
    Object.entries(COLS).map(([k, aliases]) => [k, findColumn(header, aliases)])
  ) as Record<keyof typeof COLS, number>;

  if (idx.title === -1) {
    throw new ParseError(
      fileName,
      `no title column. Columns found: ${header.join(" | ")}`
    );
  }

  return rows.slice(1).map((r) => {
    const get = (k: keyof typeof COLS) => (idx[k] === -1 ? undefined : r[idx[k]]);
    const title = get("title") ?? null;
    const date = get("date") ?? null;
    const id = get("id") || sha256Text(`${title}${date}`).slice(0, 16);
    const raw = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    // impressions ≈ opens + web views (best available reach proxy for a newsletter)
    const opens = toInt(get("opens"));
    const views = toInt(get("views"));
    return {
      platform: "substack",
      platformPostId: String(id),
      postedAt: date ? new Date(date).toISOString() : null,
      url: get("url") ?? null,
      contentText: title,
      format: "newsletter",
      metrics: {
        impressions: opens != null || views != null ? (opens ?? 0) + (views ?? 0) : null,
        likes: toInt(get("likes")),
        replies: toInt(get("comments")),
        reposts: toInt(get("shares")),
        clicks: toInt(get("clicks")),
        newFollows: toInt(get("newSubs")),
        engagementRate: toFloat(get("openRate")),
      },
      raw,
    };
  });
}
