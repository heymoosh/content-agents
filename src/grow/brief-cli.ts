import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  createGenerationBrief,
  type GenerationBrief,
  type GenerationBriefInput,
  type GenerationBriefReadiness,
  type GenerationBriefVariant,
} from "./generation-brief.js";

export interface GenerationBriefCliIo {
  readFile: (path: string) => string | Promise<string>;
  write: (value: string) => unknown;
  error?: (value: string) => unknown;
}

export type GenerationBriefRequestSource =
  | { kind: "json-string"; value: string }
  | { kind: "file"; path: string };

export type GenerationBriefCliFormat = "json" | "markdown" | "both";

export interface GenerationBriefCliArgs {
  source: GenerationBriefRequestSource;
  format: GenerationBriefCliFormat;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseGenerationBriefArgs(argv: readonly string[]): GenerationBriefCliArgs {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: GenerationBriefCliFormat = "json";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("--format must be json, markdown, or both");
      }
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (jsonText !== undefined && file !== undefined) {
    throw new Error("exactly one of --json or --file is allowed");
  }

  let source: GenerationBriefRequestSource;
  if (jsonText !== undefined) source = { kind: "json-string", value: jsonText };
  else if (file !== undefined) source = { kind: "file", path: file };
  else throw new Error("exactly one of --json or --file is required");

  return { source, format };
}

export function parseGenerationBriefRequest(value: string): GenerationBriefInput {
  if (typeof value !== "string") throw new Error("generation brief JSON request must be a string");

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid generation brief JSON request: ${reason}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("generation brief JSON request must be a JSON object");
  }
  return parsed as GenerationBriefInput;
}

export function buildGenerationBriefFromJson(value: string): GenerationBrief {
  return createGenerationBrief(parseGenerationBriefRequest(value));
}

export async function readGenerationBriefRequest(
  source: GenerationBriefRequestSource,
  io: Pick<GenerationBriefCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") throw new Error("generation brief request file must contain text");
  return value;
}

export async function buildGenerationBriefFromSource(
  source: GenerationBriefRequestSource,
  io: Pick<GenerationBriefCliIo, "readFile">,
): Promise<GenerationBrief> {
  return buildGenerationBriefFromJson(await readGenerationBriefRequest(source, io));
}

export function renderGenerationBriefJson(brief: GenerationBrief): string {
  return `${JSON.stringify(brief, null, 2)}\n`;
}

function markdownText(value: string): string {
  return value.replace(/`/g, "'").replace(/\s+/g, " ").trim();
}

function variantReadiness(variants: readonly GenerationBriefVariant[], platform: string, format: string): GenerationBriefReadiness | undefined {
  return variants.find((variant) => variant.platform === platform && variant.format === format)?.readiness;
}

function readinessRows(brief: GenerationBrief): Array<{ platform: string; format: string; readiness: GenerationBriefReadiness }> {
  const factsSupplied = brief.variants.some((variant) => Object.hasOwn(variant, "readiness"));
  if (!factsSupplied) return [];

  return brief.platforms.flatMap((platform) =>
    brief.formats.map((format) => ({
      platform,
      format,
      readiness: variantReadiness(brief.variants, platform, format) ?? {
        status: "blocked" as const,
        blockers: ["platform/format readiness fact is absent"],
      },
    })),
  );
}

export function renderGenerationBriefMarkdown(brief: GenerationBrief): string {
  const rows = readinessRows(brief);
  const blockedRows = rows.filter((row) => row.readiness.status === "blocked");
  const lines = [
    `# Generation brief: ${markdownText(brief.goal)}`,
    "",
    `- Version: \`${markdownText(brief.version)}\``,
    `- Source reference: \`${markdownText(brief.sourceReference)}\``,
    `- Substance reference: \`${markdownText(brief.substanceReference)}\``,
    `- Variants: ${brief.variants.length}`,
    `- Generates body copy: ${brief.generatesCopy ? "yes" : "no"}`,
    `- Side effects: ${brief.sideEffects}`,
    "",
    "## Gates and boundaries",
    `- Human gate: ${brief.humanGate.status} before ${brief.humanGate.before} (owner: ${brief.humanGate.approvalOwner})`,
    `- Review gate: required before ${brief.reviewGate.before} (owner: ${brief.reviewGate.approvalOwner})`,
    `- Common hook policy: ${brief.templateReusePolicy.mode}; common hooks ${brief.templateReusePolicy.commonSocialHooks}`,
    `- Creator body copy: ${brief.templateReusePolicy.creatorBodyCopy}`,
    `- Model boundary: invocation ${brief.modelBoundary.modelInvocation}; body composition ${brief.modelBoundary.boundaries.composesBody ? "allowed" : "forbidden"}; side effects ${brief.modelBoundary.sideEffects}`,
    "",
    "## Readiness",
  ];

  if (!rows.length) {
    lines.push("- Readiness facts: not supplied. No platform/format readiness is asserted.");
  } else {
    lines.push(`- Readiness: ${blockedRows.length ? "blocked" : "ready"} (${blockedRows.length} blocked of ${rows.length} platform/format combinations)`);
    for (const row of rows) {
      const blockers = row.readiness.blockers.length ? ` (${row.readiness.blockers.map(markdownText).join("; ")})` : "";
      lines.push(`- ${markdownText(row.platform)} / ${markdownText(row.format)}: ${row.readiness.status}${blockers}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderGenerationBrief(brief: GenerationBrief, format: GenerationBriefCliFormat): string {
  if (format === "json") return renderGenerationBriefJson(brief);
  if (format === "markdown") return renderGenerationBriefMarkdown(brief);
  return `${renderGenerationBriefJson(brief)}\n${renderGenerationBriefMarkdown(brief)}`;
}

const defaultIo: GenerationBriefCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => {
    process.stdout.write(value);
  },
  error: (value) => {
    process.stderr.write(value);
  },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: GenerationBriefCliIo = defaultIo,
): Promise<number> {
  try {
    const args = parseGenerationBriefArgs(argv);
    const brief = await buildGenerationBriefFromSource(args.source, io);
    await io.write(renderGenerationBrief(brief, args.format));
    return 0;
  } catch (error) {
    await io.error?.(`grow:brief: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
