import ExcelJS from "exceljs";
import { sha256Text } from "../util/hash.js";
import { ImportRow, ParseError } from "./types.js";
import { toInt } from "../util/csv.js";

// LinkedIn creator/content analytics XLSX export. The per-post data lives on the "TOP POSTS"
// sheet, which LinkedIn lays out as TWO side-by-side blocks separated by a blank column:
//   [Post URL | Post Publish Date | Engagements] [blank] [Post URL | Post Publish Date | Impressions]
// The left block is the top posts by engagement, the right block the top posts by impressions —
// overlapping but not identical sets. We merge both blocks by Post URL so each post carries
// whatever it has (engagements and/or impressions). The export has NO post text and no per-metric
// breakdown (likes/comments/reposts), so contentText is null and only impressions + an engagement
// rate are populated. Audience demographics (DEMOGRAPHICS/FOLLOWERS sheets) are not per-post and
// are intentionally not ingested here.
const norm = (s: string) => s.trim().toLowerCase();

// LinkedIn post URLs embed the post's opening words as a slug:
//   /posts/muxinli_warning-this-is-a-brag-ive-been-selected-share-745240506
// The export has no post text, but this slug is enough to tag a pillar / recognize the post.
// We strip the handle prefix and the trailing URL-type token (share|ugcPost|activity) + id.
function textFromUrl(url: string): string | null {
  const m = url.match(/\/posts\/[^_/]*_(.+)$/);
  if (!m) return null;
  let slug = m[1]
    .replace(/[-_](share|ugcpost|activity)[-_].*$/i, "") // drop type token + id + hash
    .replace(/[-_]\d{5,}.*$/, ""); // drop any leftover long numeric id
  const text = slug.replace(/[-_]+/g, " ").trim();
  return text ? text : null;
}

export async function parseLinkedIn(fileName: string, buffer: Buffer): Promise<ImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = wb.worksheets.find((s) => /top\s*posts/i.test(s.name));
  if (!sheet) {
    throw new ParseError(
      fileName,
      `no "Top posts" sheet (sheets found: ${wb.worksheets.map((s) => s.name).join(", ")})`
    );
  }

  // Read the sheet into a column-aligned string matrix (index by real column number so the
  // blank separator column is preserved and the two blocks stay aligned).
  const matrix: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const vals: string[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (c, col) => {
      vals[col - 1] = c.value instanceof Date ? c.value.toISOString() : c.value != null ? String(c.value) : "";
    });
    for (let i = 0; i < vals.length; i++) if (vals[i] === undefined) vals[i] = "";
    matrix.push(vals);
  }

  const hr = matrix.findIndex(
    (row) => row.some((c) => norm(c) === "post url") && row.some((c) => norm(c) === "impressions")
  );
  if (hr === -1) throw new ParseError(fileName, "Top posts sheet has no 'Post URL' + 'Impressions' header row");
  const head = matrix[hr].map(norm);

  const urlCols = head.map((c, i) => (c === "post url" ? i : -1)).filter((i) => i >= 0);
  const dateCols = head.map((c, i) => (/(post )?publish date|^date$/.test(c) ? i : -1)).filter((i) => i >= 0);
  const engCol = head.findIndex((c) => c === "engagements");
  const impCol = head.findIndex((c) => c === "impressions");
  const leftUrl = urlCols[0] ?? -1;
  const rightUrl = urlCols.length > 1 ? urlCols[urlCols.length - 1] : leftUrl;
  const nearestDate = (urlCol: number) =>
    dateCols.reduce((best, d) => (best === -1 || Math.abs(d - urlCol) < Math.abs(best - urlCol) ? d : best), -1);
  const leftDate = nearestDate(leftUrl);
  const rightDate = nearestDate(rightUrl);

  type Rec = { url: string; date: string | null; engagements: number | null; impressions: number | null };
  const byUrl = new Map<string, Rec>();
  const upsert = (url: string, patch: Partial<Rec>) => {
    if (!url) return;
    const cur = byUrl.get(url) ?? { url, date: null, engagements: null, impressions: null };
    byUrl.set(url, { ...cur, ...patch, url, date: cur.date ?? patch.date ?? null });
  };
  for (let r = hr + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (row.every((c) => c === "")) continue;
    if (leftUrl >= 0 && row[leftUrl]) {
      upsert(row[leftUrl], { engagements: toInt(row[engCol]), date: leftDate >= 0 ? row[leftDate] || null : null });
    }
    if (rightUrl >= 0 && row[rightUrl]) {
      upsert(row[rightUrl], { impressions: toInt(row[impCol]), date: rightDate >= 0 ? row[rightDate] || null : null });
    }
  }

  const safeIso = (d: string | null) => {
    if (!d) return null;
    const t = new Date(d);
    return isNaN(t.getTime()) ? null : t.toISOString();
  };
  const out: ImportRow[] = [];
  for (const rec of byUrl.values()) {
    const id =
      rec.url.match(/activity[:-](\d+)/)?.[1] || rec.url.match(/(\d{15,})/)?.[1] || sha256Text(rec.url).slice(0, 16);
    out.push({
      platform: "linkedin",
      platformPostId: String(id),
      postedAt: safeIso(rec.date),
      url: rec.url,
      contentText: textFromUrl(rec.url), // no post text in the export — recover the opening line from the URL slug
      format: "text",
      metrics: {
        impressions: rec.impressions,
        likes: null,
        replies: null,
        reposts: null,
        clicks: null,
        newFollows: null,
        engagementRate: rec.engagements != null && rec.impressions ? rec.engagements / rec.impressions : null,
      },
      raw: { url: rec.url, date: rec.date, engagements: rec.engagements, impressions: rec.impressions },
    });
  }
  if (out.length === 0) throw new ParseError(fileName, "Top posts sheet had no post rows");
  return out;
}
