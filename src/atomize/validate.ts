import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { resolveAngle } from "./spin.js";
import { summarizeThreadChecks } from "./thread-check.js";

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
  // Only a literal boolean `spin: true` counts as spun — a truthy non-boolean (e.g. the
  // string "yes") must not silently earn the source_lines exemption while dodging the
  // angle check below.
  const spun = fm.spin === true;
  // Video scripts are the scoped exception to extraction-first (Grok-drafted from the
  // essay's ideas, reviewed before render — see CLAUDE.md rule 1), so no source_lines.
  // Spin variants (config/platforms.yaml spin_angles, default-on since 2026-07-02, see
  // docs/spin-experiment.md) reframe within guardrails, so source_lines is best-effort there too.
  if (platform !== "video-script" && !spun && !fm.source_lines) {
    violations.push(`${file}: missing source_lines frontmatter (extraction-first traceability)`);
  }
  // A spun derivative must name the approved angle it applied, and that angle must actually
  // be configured for its own platform — catches a mismatched/copy-pasted angle (e.g. a
  // LinkedIn angle stamped on an X post).
  if (spun) {
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

// Platform-fit hard gate: parse routing.md's table into platform -> include|skip. The "why"
// column can itself contain literal "|" characters (route.ts semicolon-joins multi-pillar
// rationale precisely to avoid this), but platform/decision are always the first two columns,
// so any stray pipe further down a row never shifts them.
export function parseRoutingDecisions(md: string): Map<string, "include" | "skip"> {
  const out = new Map<string, "include" | "skip">();
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const platform = cells[1];
    const decision = cells[2];
    if (!platform || platform === "platform" || /^-+$/.test(platform)) continue;
    if (decision === "include" || decision === "skip") out.set(platform, decision as "include" | "skip");
  }
  return out;
}

// A community derivative carries the generic `platform: community` in frontmatter (config/platforms.yaml
// has one shared "community" rule); the specific room only lives in the filename, e.g.
// community-democratic-resilience.md -> routing's community:democratic-resilience key.
export function routingKeyFor(file: string, platform: string): string {
  if (platform !== "community") return platform;
  const id = file.replace(/^community-/, "").replace(/\.md$/, "");
  return `community:${id}`;
}

// Bake the platform-fit check into the thing that gates queueing, instead of trusting Claude to
// remember which platforms routing.md excluded while drafting. A derivative for a platform
// routing.md marked `skip` fails validation outright — the same hard stop as a char-limit
// violation. Unmapped keys (format assets like quote-card, or a folder with no routing.md yet)
// are not flagged; only an explicit `skip` decision is a violation.
export function checkRoutingGate(
  files: { file: string; platform: string }[],
  routingDecisions: Map<string, "include" | "skip">
): string[] {
  const violations: string[] = [];
  for (const { file, platform } of files) {
    const key = routingKeyFor(file, platform);
    if (routingDecisions.get(key) === "skip") {
      violations.push(
        `${file}: drafted for "${key}", but routing.md marked it skip — platform-fit gate says this content shouldn't post there (see routing.md for why, or fix config/routing.yaml if that's wrong)`
      );
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

  const routingFiles: { file: string; platform: string }[] = [];
  const threadInputs: { file: string; fm: Record<string, unknown> }[] = [];
  for (const file of files) {
    const { fm, body } = splitFrontmatter(readFileSync(join(derivDir, file), "utf8"));
    violations.push(...checkDerivative(file, fm, body, config.platforms));
    routingFiles.push({ file, platform: String(fm.platform ?? "") });
    threadInputs.push({ file, fm });
  }

  const routingPath = join(dir.startsWith("/") ? dir : join(repoRoot, dir), "routing.md");
  if (existsSync(routingPath)) {
    const routingDecisions = parseRoutingDecisions(readFileSync(routingPath, "utf8"));
    violations.push(...checkRoutingGate(routingFiles, routingDecisions));
  }

  // Home-brand thread-check (config/platforms.yaml `home_brand`): advisory only, never a gate — a
  // "missing" derivative still queues (CLAUDE.md rule via the thread-check card).
  const thread = summarizeThreadChecks(threadInputs);
  if (thread.missing > 0) {
    console.log(
      `home-brand thread-check: ${thread.pass} pass, ${thread.missing} missing (not blocking) — ${thread.missingFiles.join(", ")}`
    );
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
