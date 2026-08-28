// CLI over the hook frame library.
//
//   npm run patterns:hook-frames -- list [--platform x] [--topic ...] [--include-pending]
//   npm run patterns:hook-frames -- fit  --draft <path> [--platform x] [--show-unfit] [--limit N]
//   npm run patterns:hook-frames -- verify
//   npm run patterns:hook-frames -- fill --frame <id> --slot name=value [--slot ...]
//
// `fit` is the one Muxin reaches for: it reads a draft and offers only the frames that draft can
// actually fill. `verify` is the one that keeps the bank honest: it recomputes every frame's support
// from the read-only corpus and refuses to agree with the bank on faith.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CREATOR_CONTENT_DIR, parseCreatorFile } from "./creator-content-normalization.js";
import { buildCorpusRanking, checkGrounding, compareSupport, corpusRunIndex, recomputeSupport } from "./hook-frame-corpus.js";
import { fitFrame, proposeOpening, rankFits } from "./hook-frame-fit.js";
import {
  VERBATIM_RUN_WORDS,
  fillFrame,
  fixedRuns,
  parseHookFrame,
  readHookFrameLibrary,
  selectFrames,
  templateSlots,
  type HookFrame,
} from "./hook-frame-library.js";
import { PLATFORMS, type Platform } from "./types.js";

export const HOOK_FRAME_CLI_VERSION = "hook-frame-cli-v1" as const;
export const HOOK_FRAME_BANK = "config/hook-frames.jsonl" as const;

export type HookFrameCommand = "list" | "verify" | "fill" | "fit";

export interface HookFrameCliOptions {
  readonly command: HookFrameCommand;
  readonly root: string;
  readonly platform?: Platform;
  readonly topic?: string;
  readonly includePending: boolean;
  readonly limit?: number;
  readonly frameId?: string;
  readonly material: Readonly<Record<string, string>>;
  /** Path to the draft `fit` reads. */
  readonly draft?: string;
  /** Show frames the draft cannot fill, which `fit` hides by default. */
  readonly showUnfit: boolean;
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
  if (command !== "list" && command !== "verify" && command !== "fill" && command !== "fit") {
    fail("usage: hook-frame-cli <list|verify|fill|fit> [options]");
  }
  let root = ".";
  let platform: Platform | undefined;
  let topic: string | undefined;
  let includePending = false;
  let limit: number | undefined;
  let frameId: string | undefined;
  let draft: string | undefined;
  let showUnfit = false;
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
    } else if (argument === "--draft") {
      draft = optionValue(rest, index, argument);
      index += 1;
    } else if (argument === "--show-unfit") {
      showUnfit = true;
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
  if (command === "fit" && draft === undefined) fail("fit requires --draft <path>");
  return {
    command, root, includePending, material, showUnfit,
    ...(platform === undefined ? {} : { platform }),
    ...(topic === undefined ? {} : { topic }),
    ...(limit === undefined ? {} : { limit }),
    ...(frameId === undefined ? {} : { frameId }),
    ...(draft === undefined ? {} : { draft }),
  };
}

function loadCorpus(root: string, io: HookFrameCliIo): {
  files: ReturnType<typeof parseCreatorFile>[];
  rawTexts: string[];
  rawByFile: Map<string, string>;
} {
  const directory = join(root, CREATOR_CONTENT_DIR);
  const names = [...io.listDir(directory)].filter((name) => name.endsWith(".md")).sort();
  const files: ReturnType<typeof parseCreatorFile>[] = [];
  const rawTexts: string[] = [];
  const rawByFile = new Map<string, string>();
  for (const name of names) {
    const raw = io.readFile(join(directory, name));
    rawTexts.push(raw);
    rawByFile.set(name, raw);
    files.push(parseCreatorFile(name, raw));
  }
  return { files, rawTexts, rawByFile };
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
  const { files, rawTexts, rawByFile } = loadCorpus(options.root, io);
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
      const citedTexts = new Map<string, string>();
      for (const ref of frame.sourceRefs) {
        const file = ranking.byRef.get(ref)?.file;
        const raw = file === undefined ? undefined : rawByFile.get(file);
        if (file !== undefined && raw !== undefined) citedTexts.set(file, raw);
      }
      const grounding = checkGrounding(fixedRuns(frame.template), citedTexts);
      for (const run of grounding.ungroundedRuns) {
        io.write(`FINDING ${frame.id}: ungrounded-wording: "${run}" appears in none of the cited creators' text\n`);
        problems += 1;
      }
      for (const run of grounding.singleCreatorRuns) {
        io.write(`FINDING ${frame.id}: single-creator-wording: "${run}" appears in only one cited creator's text\n`);
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
      baseRate: ranking.rankedEntries === 0 ? 0.25 : ranking.topQuartileEntries / ranking.rankedEntries,
      ...(options.topic === undefined ? {} : { topic: options.topic }),
      ...(options.limit === undefined ? {} : { limit: options.limit }),
    });
    if (selections.length === 0) {
      io.write("no frames match. Frames stay unavailable until Muxin marks them approved; pass --include-pending to see the bank.\n");
      return 0;
    }
    io.write(`base rate for comparison: ${percent(ranking.topQuartileEntries, ranking.rankedEntries)} of ranked corpus entries are top-quartile within their own creator\n\n`);
    for (const selection of selections) {
      // Recomputed from the corpus, not read off the bank. What a human sees has to be the measured
      // number, or the "never trust the written support" rule holds only where nobody is looking.
      const support = recomputeSupport(selection.frame.sourceRefs, ranking).support;
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

  if (options.command === "fit") {
    const draft = io.readFile(options.draft!);
    // Derivatives already declare their platform in frontmatter, so `fit --draft <path>` is the
    // whole command in practice. An explicit --platform still wins.
    const declared = /^platform:\s*([a-z-]+)\s*$/m.exec(draft)?.[1];
    const platform = options.platform ?? (declared !== undefined && (PLATFORMS as readonly string[]).includes(declared) ? (declared as Platform) : undefined);
    if (platform === undefined) {
      io.error?.("fit needs a platform: pass --platform, or give a draft whose frontmatter declares one\n");
      return 1;
    }
    const candidates = selectFrames(library, {
      platform,
      includePending: options.includePending,
      ...(options.topic === undefined ? {} : { topic: options.topic }),
    });
    if (candidates.length === 0) {
      io.write("no frames for this platform. Frames stay unavailable until Muxin marks them approved; pass --include-pending to consider the whole bank.\n");
      return 0;
    }
    const fits = rankFits(
      candidates.map((selection) =>
        fitFrame(draft, {
          frameId: selection.frame.id,
          slots: templateSlots(selection.frame.template),
          fixedRuns: fixedRuns(selection.frame.template),
        }),
      ),
    );
    const byId = new Map(candidates.map((selection) => [selection.frame.id, selection.frame]));
    // A frame the draft cannot fill is the thing this command exists to stop offering, so it is
    // hidden rather than ranked last.
    const shown = options.showUnfit ? fits : fits.filter((fit) => fit.verdict !== "no-fit");
    const limited = options.limit === undefined ? shown : shown.slice(0, options.limit);
    io.write(
      `draft: ${options.draft}\n` +
        `${candidates.length} frame(s) for ${platform}, ${fits.filter((fit) => fit.verdict === "fits").length} the draft can fill completely\n` +
        `fit is material matching only. It reports what your draft can supply, never whether an opening is better than the one you wrote.\n\n`,
    );
    if (limited.length === 0) {
      io.write("nothing this draft can fill. Pass --show-unfit to see what was ruled out and why.\n");
      return 0;
    }
    for (const fit of limited) {
      const frame = byId.get(fit.frameId)!;
      const proposed = proposeOpening(frame.template, fit);
      io.write(`${fit.frameId}  [${fit.verdict}${fit.alreadyUsed ? ", draft already opens this way" : ""}]\n`);
      io.write(`  ${frame.template}\n`);
      for (const slot of fit.slots) {
        const found = slot.span === null
          ? slot.signal === "generic" ? "you supply this; nothing in the draft identifies it" : `NOT FOUND (needs a ${slot.signal})`
          : `"${slot.span}"`;
        io.write(`    {${slot.slot}} <- ${found}\n`);
      }
      io.write(`  proposed: ${proposed.text}\n`);
      if (proposed.unfilled.length > 0) io.write(`  still yours to fill: ${proposed.unfilled.join(", ")}\n`);
      io.write("\n");
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
