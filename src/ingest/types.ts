export interface ImportRow {
  platform: "x" | "linkedin" | "substack" | "bluesky";
  platformPostId: string; // stable id; if the export has none, derive from hash(content+date)
  postedAt: string | null; // ISO8601
  url: string | null;
  contentText: string | null;
  format: "text" | "thread" | "image" | "video" | "newsletter" | null;
  metrics: {
    impressions: number | null;
    likes: number | null;
    replies: number | null;
    reposts: number | null;
    clicks: number | null;
    newFollows: number | null;
    engagementRate: number | null;
  };
  raw: Record<string, unknown>; // every source column, preserved verbatim
}

// Audience-level row (who follows you), as opposed to per-post ImportRow. See schema.sql `audience`.
export interface AudienceRow {
  platform: "x" | "linkedin" | "substack" | "bluesky";
  capturedAt: string; // ISO8601 — when ingested
  asOfDate: string | null; // ISO8601 — date the source attributes the value to
  metricType: "follower_total" | "follower_delta" | "demographic";
  dimension: string | null; // null for totals
  valueLabel: string | null; // null for totals
  valueCount: number | null; // absolute count when known
  valuePct: number | null; // demographic share 0–100; null when source says "< 1%"
  sourceFile: string | null;
  raw: Record<string, unknown>;
}

export class ParseError extends Error {
  constructor(file: string, detail: string) {
    super(
      `Could not parse ${file}: ${detail}\n` +
        `Export formats drift — check the file's actual columns and update the parser aliases.`
    );
  }
}
