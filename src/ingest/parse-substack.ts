import { parseCsv, findColumn, toInt, toFloat } from "../util/csv.js";
import { sha256Text } from "../util/hash.js";
import { ImportRow, ParseError } from "./types.js";

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
