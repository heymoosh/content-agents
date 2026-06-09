import { parse } from "yaml";

export function splitFrontmatter(text: string): {
  fm: Record<string, unknown>;
  body: string;
} {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text.trim() };
  return { fm: (parse(m[1]) as Record<string, unknown>) ?? {}, body: m[2].trim() };
}
