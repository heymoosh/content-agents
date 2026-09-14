import type Database from "better-sqlite3";
import type { BrandId } from "../identity/brand.js";

type Post = {
  id: number; platform: string; posted_at: string | null; url: string | null;
  content_text: string | null; pillar: string | null; format: string | null;
  captured_at: string | null; impressions: number | null; replies: number | null;
};
type Measure = { value: number | null; measured: number; missing: number };

function measure(rows: Post[], key: "impressions" | "replies"): Measure {
  const values = rows.map(row => row[key]).filter((v): v is number => v !== null);
  return { value: values.length ? values.reduce((sum, v) => sum + v, 0) : null, measured: values.length, missing: rows.length - values.length };
}

function groups(rows: Post[], key: "pillar" | "format") {
  return [...new Set(rows.map(row => row[key]).filter((v): v is string => !!v))].sort().map(label => {
    const members = rows.filter(row => row[key] === label);
    return { label, posts: members.length, replies: measure(members, "replies"), impressions: measure(members, "impressions") };
  });
}

/** Descriptive, all-recorded-data read. Never turns raw totals into a fit score or a winner.
 * Latest snapshots are matched on both brand and account, and missing numbers stay null.
 * This read intentionally does not need a strategy brief or the business outcome ledger.
 */
export function readSignalsPerformance(db: Database.Database, brandId: BrandId) {
  const rows = db.prepare(`SELECT p.id, p.platform, p.posted_at, p.url, p.content_text, p.pillar, p.format,
      m.captured_at, m.impressions, m.replies
    FROM posts p LEFT JOIN metrics m ON m.rowid = (
      SELECT m2.rowid FROM metrics m2 WHERE m2.post_id = p.id
        AND m2.brand_id = p.brand_id AND m2.provider_account_id = p.provider_account_id
      ORDER BY m2.captured_at DESC, m2.rowid DESC LIMIT 1
    ) WHERE p.brand_id = ?`).all(brandId) as Post[];
  const dates = rows.map(r => r.posted_at).filter((v): v is string => !!v).sort();
  const captures = rows.map(r => r.captured_at).filter((v): v is string => !!v).sort();
  return {
    brandId, posts: rows.length, measuredPosts: rows.filter(r => r.captured_at).length,
    firstPost: dates[0] ?? null, lastPost: dates.at(-1) ?? null, latestCapture: captures.at(-1) ?? null,
    excludedUnassigned: (db.prepare("SELECT count(*) AS n FROM posts WHERE brand_id IS NULL").get() as { n: number }).n,
    platforms: [...new Set(rows.map(r => r.platform))].sort().map(platform => {
      const members = rows.filter(r => r.platform === platform);
      const measured = members.filter(r => r.replies !== null);
      return {
        platform, posts: members.length, impressions: measure(members, "impressions"), replies: measure(members, "replies"),
        untagged: members.filter(r => !r.pillar).length,
        topics: groups(members, "pillar"), formats: groups(members, "format"),
        examples: [...measured].sort((a, b) => b.replies! - a.replies! || a.id - b.id).slice(0, 3).map(r => ({
          id: r.id, text: r.content_text?.slice(0, 240) || "Post text not imported", url: r.url,
          postedAt: r.posted_at, capturedAt: r.captured_at, impressions: r.impressions, replies: r.replies,
        })),
      };
    }),
  };
}

export type SignalsPerformance = ReturnType<typeof readSignalsPerformance>;
