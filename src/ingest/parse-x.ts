import { parseCsv, findColumn, toInt, toFloat } from "../util/csv.js";
import { sha256Text } from "../util/hash.js";
import { ImportRow, ParseError } from "./types.js";

// X (Twitter) analytics "content" CSV export. Column names have drifted over the years,
// so every lookup goes through aliases. Unmatched columns still land in `raw`.
const COLS = {
  id: ["post id", "tweet id"],
  date: ["date", "time", "post date"],
  text: ["post text", "tweet text", "text"],
  url: ["permanent link", "tweet permalink", "post link", "link"],
  impressions: ["impressions"],
  likes: ["likes", "favorites"],
  replies: ["replies"],
  reposts: ["reposts", "retweets", "shares"],
  clicks: ["url clicks", "link clicks", "clicks"],
  newFollows: ["new follows", "follows"],
  engagements: ["engagements"],
  engagementRate: ["engagement rate"],
};

export function parseX(fileName: string, content: string): ImportRow[] {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new ParseError(fileName, "no data rows found");
  const header = rows[0];

  const idx = Object.fromEntries(
    Object.entries(COLS).map(([k, aliases]) => [k, findColumn(header, aliases)])
  ) as Record<keyof typeof COLS, number>;

  if (idx.text === -1 && idx.id === -1) {
    throw new ParseError(
      fileName,
      `no post text or post id column. Columns found: ${header.join(" | ")}`
    );
  }

  return rows.slice(1).map((r) => {
    const get = (k: keyof typeof COLS) => (idx[k] === -1 ? undefined : r[idx[k]]);
    const text = get("text") ?? null;
    const date = get("date") ?? null;
    const id = get("id") || sha256Text(`${text}${date}`).slice(0, 16);
    const raw = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    return {
      platform: "x",
      platformPostId: String(id),
      postedAt: date ? new Date(date).toISOString() : null,
      url: get("url") ?? null,
      contentText: text,
      format: "text",
      metrics: {
        impressions: toInt(get("impressions")),
        likes: toInt(get("likes")),
        replies: toInt(get("replies")),
        reposts: toInt(get("reposts")),
        clicks: toInt(get("clicks")),
        newFollows: toInt(get("newFollows")),
        engagementRate: toFloat(get("engagementRate")),
      },
      raw,
    };
  });
}
