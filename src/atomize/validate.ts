import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Validate every derivative in a content folder against config/platforms.yaml.
//   tsx src/atomize/validate.ts content/2026-06-09-some-post
// Exit non-zero with a list of violations. Frontmatter must declare `platform`.

interface PlatformRule {
  max_chars?: number;
  max_words?: number;
}

function splitFrontmatter(text: string): { fm: Record<string, unknown>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: (parse(m[1]) as Record<string, unknown>) ?? {}, body: m[2].trim() };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: tsx src/atomize/validate.ts <content-folder>");
    process.exit(1);
  }
  const derivDir = join(dir.startsWith("/") ? dir : join(repoRoot, dir), "derivatives");
  if (!existsSync(derivDir)) {
    console.error(`no derivatives folder: ${derivDir}`);
    process.exit(1);
  }
  const config = parse(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
    platforms: Record<string, PlatformRule>;
  };

  const violations: string[] = [];
  const files = readdirSync(derivDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`no derivative .md files in ${derivDir}`);
    process.exit(1);
  }

  for (const file of files) {
    const { fm, body } = splitFrontmatter(readFileSync(join(derivDir, file), "utf8"));
    const platform = String(fm.platform ?? "");
    const rule = config.platforms[platform];
    if (!rule) {
      violations.push(`${file}: unknown or missing platform "${platform}" in frontmatter`);
      continue;
    }
    if (!fm.source_lines) {
      violations.push(`${file}: missing source_lines frontmatter (extraction-first traceability)`);
    }
    if (rule.max_chars && body.length > rule.max_chars) {
      violations.push(`${file}: ${body.length} chars > ${platform} limit ${rule.max_chars}`);
    }
    if (rule.max_words) {
      const words = body.split(/\s+/).filter(Boolean).length;
      if (words > rule.max_words) {
        violations.push(`${file}: ${words} words > ${platform} limit ${rule.max_words}`);
      }
    }
  }

  if (violations.length) {
    console.error(`VALIDATION FAILED (${violations.length}):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`ok: ${files.length} derivative(s) within platform limits`);
}

main();
