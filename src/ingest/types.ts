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

export class ParseError extends Error {
  constructor(file: string, detail: string) {
    super(
      `Could not parse ${file}: ${detail}\n` +
        `Export formats drift — check the file's actual columns and update the parser aliases.`
    );
  }
}
