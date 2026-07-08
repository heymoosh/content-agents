import { parse } from "yaml";

// `header` is always the raw, byte-exact frontmatter block (or "" if there's none) — cheap to
// compute unconditionally, so a byte-preserving edit (see serve.ts's saveDerivative) can use it
// without a special mode. Malformed YAML in `fm` degrades to `{}` rather than throwing — the ~15
// call sites across validate/publish/fiction were all written against that contract (several loop
// over many files and would otherwise crash a whole batch on one corrupted one); changing it is a
// real behavior change outside this card's scope, not something to slip in with the header fix.
export function splitFrontmatter(text: string): {
  fm: Record<string, unknown>;
  body: string;
  header: string;
} {
  const m = text.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!m) return { fm: {}, body: text.trim(), header: "" };
  const header = m[1];
  let fm: Record<string, unknown> = {};
  try {
    fm = (parse(header.replace(/^---\n/, "").replace(/\n---\n?$/, "")) as Record<string, unknown>) ?? {};
  } catch {
    fm = {};
  }
  return { fm, body: m[2].trim(), header };
}
