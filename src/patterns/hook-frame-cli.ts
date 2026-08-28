// CLI over the hook frame library.
//
//   npm run patterns:hook-frames -- list [--platform x] [--topic ...] [--include-pending]
//   npm run patterns:hook-frames -- verify
//   npm run patterns:hook-frames -- fill --frame <id> --slot name=value [--slot ...]
//
// `verify` is the one that matters: it recomputes every frame's support from the read-only corpus
// and refuses to agree with the bank on faith.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CREATOR_CONTENT_DIR, parseCreatorFile } from "./creator-content-normalization.js";
import { buildCorpusRanking, compareSupport, corpusRunIndex, recomputeSupport } from "./hook-frame-corpus.js";
import {
  VERBATIM_RUN_WORDS,
  fillFrame,
  parseHookFrame,
  readHookFrameLibrary,
  selectFrames,
  type HookFrame,
} from "./hook-frame-library.js";
import { PLATFORMS, type Platform } from "./types.js";

export const HOOK_FRAME_CLI_VERSION = "hook-frame-cli-v1" as const;
export const HOOK_FRAME_BANK = "config/hook-frames.jsonl" as const;

export type HookFrameCommand = "list" | "verify" | "fill";

export interface HookFrameCliOptions {
  readonly command: HookFrameCommand;
  readonly root: string;
  readonly platform?: Platform;
  readonly topic?: string;
  readonly includePending: boolean;
  readonly limit?: number;
  readonly frameId?: string;
  readonly material: Readonly<Record<string, string>>;
}

export interface HookFrameCliIo {
  readonly readFile: (path: string) => string;
  readonly listDir: (path: string) => readonly string[];
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

function fail(message: string): never {
  throw new Error(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseHookFrameArgs(argv: readonly string[]): HookFrameCliOptions {
  const [command, ...rest] = argv;
  if (command !== "list" && command !== "verify" && command !== "fill") {
    fail("usage: hook-frame-cli <list|verify|fill> [options]");
  }
  let root = ".";
  let platform: Platform | undefined;
  let topic: string | undefined;
  let includePending = false;
  let limit: number | undefined;
  let frameId: string | undefined;
  const material: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === "--root") {
      root = optionValue(rest, index, argument);
      index += 1;
    } else if (argument === "--platform") {
      const value = optionValue(rest, index, argument);
      if (!(PLATFORMS as readonly string[]).includes(value)) fail(`--platform ${value} is unsupported`);
      platform = value as Platform;
      index += 1;
    } else if (argument === "--topic") {
      topic = optionValue(rest, index, argument);
      index += 1;
    } else if (argument === "--include-pending") {
      includePending = true;
    } else if (argument === "--limit") {
      const value = Number(optionValue(rest, index, argument));
      if (!Number.isInteger(value) || value < 1) fail("--limit must be a positive integer");
      limit = value;
      index += 1;
    } else if (argument === "--frame") {
      frameId = optionValue(rest, index, argument);
      index += 1;
    } else if (argument === "--slot") {
      const value = optionValue(rest, index, argument);
      const split = value.indexOf("=");
      if (split < 1) fail("--slot expects name=value");
      material[value.slice(0, split).trim()] = value.slice(split + 1);
      index += 1;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (command === "fill" && frameId === undefined) fail("fill requires --frame <id>");
  if (command === "list" && platform === undefined) fail("list requires --platform <platform>");
  return { command, root, includePending, material, ...(platform === undefined ? {} : { platform }), ...(topic === undefined ? {} : { topic }), ...(limit === undefined ? {} : { limit }), ...(frameId === undefined ? {} : { frameId }) };
}

function loadCorpus(root: string, io: HookFrameCliIo): { files: ReturnType<typeof parseCreatorFile>[]; rawTexts: string[] } {
  const directory = join(root, CREATOR_CONTENT_DIR);
  const names = [...io.listDir(directory)].filter((name) => name.endsWith(".md")).sort();
  const files: ReturnType<typeof parseCreatorFile>[] = [];
  const rawTexts: string[] = [];
  for (const name of names) {
    const raw = io.readFile(join(directory, name));
    rawTexts.push(raw);
    files.push(parseCreatorFile(name, raw));
  }
  return { files, rawTexts };
}

function loadBank(root: string, io: HookFrameCliIo, rawTexts: readonly string[], names: readonly string[], handles: readonly string[]) {
  const runIndex = corpusRunIndex(rawTexts, VERBATIM_RUN_WORDS);
  return readHookFrameLibrary(io.readFile(join(root, HOOK_FRAME_BANK)), {
    creatorNames: names,
    handles,
    corpusContainsRun: (words) => runIndex.has(words.join(" ")),
  });
}

function creatorIdentity(files: readonly ReturnType<typeof parseCreatorFile>[]): { names: string[]; handles: string[] } {
  const names = files.map((file) => file.creatorSlug.replace(/-/g, " "));
  const handles = files.map((file) => file.header.handle ?? "").filter((handle) => handle.length > 0);
  return { names, handles };
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "not ranked";
  return `${Math.round((part / whole) * 100)}%`;
}

export function runHookFrameCli(options: HookFrameCliOptions, io: HookFrameCliIo): number {
  const { files, rawTexts } = loadCorpus(options.root, io);
  const { names, handles } = creatorIdentity(files);
  const ranking = buildCorpusRanking(files);

  if (options.command === "verify") {
    const raw = io.readFile(join(options.root, HOOK_FRAME_BANK));
    const library = loadBank(options.root, io, rawTexts, names, handles);
    const declared = raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line, index) => parseHookFrame(JSON.parse(line) as unknown, `line ${index + 1}`));
    let problems = library.findings.length;
    for (const finding of library.findings) io.write(`FINDING ${finding.frameId}: ${finding.kind}: ${finding.detail}\n`);
    for (const frame of declared) {
      const recomputed = recomputeSupport(frame.sourceRefs, ranking);
      for (const ref of recomputed.unresolvedRefs) {
        io.write(`FINDING ${frame.id}: unresolved-ref: ${ref} matches no corpus entry\n`);
        problems += 1;
      }
      for (const mismatch of compareSupport(frame.support, recomputed.support)) {
        io.write(`FINDING ${frame.id}: support-mismatch: ${mismatch.field} claims ${mismatch.claimed}, corpus says ${mismatch.recomputed}\n`);
        problems += 1;
      }
      const unlisted = recomputed.platforms.filter((platform) => !(frame.platforms as readonly string[]).includes(platform));
      for (const platform of unlisted) {
        io.write(`FINDING ${frame.id}: platform-mismatch: refs include ${platform}, which the frame does not list\n`);
        problems += 1;
      }
    }
    io.write(
      `frames declared: ${declared.length}, usable: ${library.frames.length}\n` +
        `corpus: ${files.length} files, ${ranking.byRef.size} entries, ${ranking.rankedEntries} ranked in ${ranking.filesWithDistribution} files\n` +
        `top-quartile base rate: ${percent(ranking.topQuartileEntries, ranking.rankedEntries)}\n` +
        `findings: ${problems}\n`,
    );
    return problems === 0 ? 0 : 1;
  }

  const library = loadBank(options.root, io, rawTexts, names, handles);

  if (options.command === "list") {
    const selections = selectFrames(library, {
      platform: options.platform!,
      includePending: options.includePending,
      ...(options.topic === undefined ? {} : { topic: options.topic }),
      ...(options.limit === undefined ? {} : { limit: options.limit }),
    });
    if (selections.length === 0) {
      io.write("no frames match. Frames stay unavailable until Muxin marks them approved; pass --include-pending to see the bank.\n");
      return 0;
    }
    io.write(`base rate for comparison: ${percent(ranking.topQuartileEntries, ranking.rankedEntries)} of ranked corpus entries are top-quartile within their own creator\n\n`);
    for (const selection of selections) {
      const support = selection.frame.support;
      io.write(
        `${selection.frame.id}  (${selection.frame.review})\n` +
          `  ${selection.frame.name}\n` +
          `  ${selection.frame.template}\n` +
          `  when: ${selection.frame.whenToUse}\n` +
          `  seen: ${support.instances} entries across ${support.distinctCreatorFiles} creators; ` +
          `${support.topQuartileInstances}/${support.rankedInstances} ranked instances top-quartile (${percent(support.topQuartileInstances, support.rankedInstances)})\n` +
          `  supply: ${selection.frame.slots.join(", ")}\n\n`,
      );
    }
    return 0;
  }

  const frame: HookFrame | undefined = library.frames.find((row) => row.id === options.frameId);
  if (frame === undefined) {
    io.error?.(`no usable frame with id ${options.frameId}. Run verify to see why a frame was dropped.\n`);
    return 1;
  }
  const filled = fillFrame(frame, options.material);
  io.write(`${filled.text}\n\n`);
  io.write(`frame: ${filled.frameId}\nreview: ${filled.review}\nsource refs: ${filled.sourceRefs.join(", ")}\n`);
  if (filled.voiceFindings.length > 0) {
    io.write(`voice findings:\n${filled.voiceFindings.map((finding) => `  - ${finding}`).join("\n")}\n`);
    return 1;
  }
  return 0;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseHookFrameArgs(process.argv.slice(2));
  const code = runHookFrameCli(options, {
    readFile: (path) => readFileSync(path, "utf8"),
    listDir: (path) => readdirSync(path),
    write: (value) => process.stdout.write(value),
    error: (value) => process.stderr.write(value),
  });
  process.exitCode = code;
}
/* c8 ignore stop */
