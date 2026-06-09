import ExcelJS from "exceljs";
import { sha256Text } from "../util/hash.js";
import { ImportRow, ParseError } from "./types.js";
import { toInt, toFloat } from "../util/csv.js";

// LinkedIn creator/content analytics XLSX export. The workbook layout shifts often;
// we scan every sheet for a header row containing an "Impressions"-like column and
// treat the rows under it as post data. Everything else is preserved in `raw`.
const ALIASES: Record<string, string[]> = {
  url: ["post url", "post link", "url"],
  title: ["post title", "post text", "title", "post"],
  date: ["post publish date", "publish date", "created date", "date"],
  impressions: ["impressions"],
  likes: ["reactions", "likes"],
  replies: ["comments"],
  reposts: ["reposts", "shares"],
  clicks: ["clicks", "click through rate"],
  engagementRate: ["engagement rate"],
  newFollows: ["new followers", "follows"],
};

function matchAlias(cell: string): string | null {
  const norm = cell.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(norm)) return key;
  }
  return null;
}

export async function parseLinkedIn(fileName: string, buffer: Buffer): Promise<ImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  for (const sheet of wb.worksheets) {
    // find a header row: must contain an impressions-like column
    for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (c) => cells.push(String(c.value ?? "")));
      const mapped = cells.map(matchAlias);
      if (!mapped.includes("impressions")) continue;

      const colFor = (key: string) => mapped.indexOf(key); // 0-based within cells
      const out: ImportRow[] = [];
      for (let dr = r + 1; dr <= sheet.rowCount; dr++) {
        const dataRow = sheet.getRow(dr);
        const vals: string[] = [];
        dataRow.eachCell({ includeEmpty: true }, (c) => {
          const v = c.value;
          vals.push(
            v instanceof Date ? v.toISOString() : v != null ? String(v) : ""
          );
        });
        if (vals.every((v) => v === "")) continue;
        const get = (key: string) => {
          const i = colFor(key);
          return i === -1 ? undefined : vals[i];
        };
        const title = get("title") ?? null;
        const url = get("url") ?? null;
        const date = get("date") ?? null;
        const id =
          (url && url.match(/activity[:-](\d+)/)?.[1]) ||
          sha256Text(`${title}${url}${date}`).slice(0, 16);
        const raw = Object.fromEntries(cells.map((h, i) => [h || `col${i}`, vals[i]]));
        out.push({
          platform: "linkedin",
          platformPostId: id,
          postedAt: date ? new Date(date).toISOString() : null,
          url,
          contentText: title,
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
        });
      }
      if (out.length > 0) return out;
    }
  }
  throw new ParseError(
    fileName,
    "no sheet with an 'Impressions' header row found in workbook"
  );
}
