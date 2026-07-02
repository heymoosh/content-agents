import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { resolveAngle } from "./spin.js";

// Validate every derivative in a content folder against config/platforms.yaml.
//   tsx src/atomize/validate.ts content/2026-06-09-some-post
// Exit non-zero with a list of violations. Frontmatter must declare `platform`.

export interface PlatformRule {
  max_chars?: number;
  max_words?: number;
}

// Pure per-file check, exported so it can be unit-tested without a content folder on disk.
export function checkDerivative(
  file: string,
  fm: Record<string, unknown>,
  body: string,
  platforms: Record<string, PlatformRule>
): string[] {
  const violations: string[] = [];
  const platform = String(fm.platform ?? "");
  const rule = platforms[platform];
  if (!rule) {
    violations.push(`${file}: unknown or missing platform "${platform}" in frontmatter`);
    return violations;
  }
  // Video scripts are the scoped exception to extraction-first (Grok-drafted from the
  // essay's ideas, reviewed before render — see CLAUDE.md rule 1), so no source_lines.
  // Spin variants (config/platforms.yaml spin_angles, default-on since 2026-07-02, see
  // docs/spin-experiment.md) reframe within guardrails, so source_lines is best-effort there too.
  if (platform !== "video-script" && !fm.spin && !fm.source_lines) {
    violations.push(`${file}: missing source_lines frontmatter (extraction-first traceability)`);
  }
  // A spun derivative must name the approved angle it applied, and that angle must actually
  // be configured for its own platform — catches a mismatched/copy-pasted angle (e.g. a
  // LinkedIn angle stamped on an X post).
  if (fm.spin === true) {
    const angleKey = typeof fm.angle === "string" ? fm.angle : "";
    if (!angleKey) {
      violations.push(`${file}: spin:true but missing angle frontmatter (which approved angle was applied)`);
    } else if (angleKey !== platform || !resolveAngle(platform)) {
      violations.push(`${file}: angle "${angleKey}" does not match a configured spin angle for platform "${platform}"`);
    }
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
  return violations;
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
    violations.push(...checkDerivative(file, fm, body, config.platforms));
  }

  if (violations.length) {
    console.error(`VALIDATION FAILED (${violations.length}):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`ok: ${files.length} derivative(s) within platform limits`);
}

// Run only as a CLI entry point — importing checkDerivative for tests must not execute main().
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
