import { parse } from "yaml";

export function splitFrontmatter(text: string): { fm: Record<string, unknown>; body: string };
export function splitFrontmatter(
  text: string,
  opts: { raw: true }
): { fm: Record<string, unknown>; body: string; header: string };
export function splitFrontmatter(
  text: string,
  opts?: { raw?: boolean }
): { fm: Record<string, unknown>; body: string; header?: string } {
  const m = text.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!m) return { fm: {}, body: text.trim(), ...(opts?.raw ? { header: "" } : {}) };
  const header = m[1];
  let fm: Record<string, unknown> = {};
  try {
    fm = (parse(header.replace(/^---\n/, "").replace(/\n---\n?$/, "")) as Record<string, unknown>) ?? {};
  } catch {
    fm = {};
  }
  return { fm, body: m[2].trim(), ...(opts?.raw ? { header } : {}) };
}
