// The mad-lib hook frame library.
//
// This is the surface CLAUDE.md rule 1's "common platform hook templates" carve-out describes: a
// bank of generic opening scaffolds, each mostly fixed connective English with a few {slots} the
// writer fills from her own thought, claim, experience, evidence and point of view.
//
// It is deliberately NOT `hook-template-ledger.ts`. That ledger is body-free by contract (its
// FORBIDDEN_KEYS scan bans `openertext`, `literalshape`, `copy`, `example` on purpose) and it
// hands Grow a bare ref plus slot names. Frames carry actual fixed wording, so they need their own
// module with their own guards rather than a hole cut in that invariant.
//
// What the guards here are actually for: a frame must be language many writers would independently
// produce, never one creator's distinctive line with braces swapped in. The load-bearing test is
// the cross-creator count (a shape at least two different creators reached for on their own is by
// definition common), backed by a verbatim-run scan against the corpus.

import { PLATFORMS, type Platform } from "./types.js";

export const HOOK_FRAME_LIBRARY_VERSION = "hook-frame-library-v1" as const;

/** A frame needs at least this many creator FILES instantiating it to count as widely shared. */
export const MINIMUM_DISTINCT_CREATORS = 2;

/** Fixed words outside the slots, below which a "frame" carries nothing reusable. */
export const MINIMUM_FIXED_WORDS = 5;

/** A fixed run this long or longer is checked against the corpus for verbatim overlap. */
export const VERBATIM_RUN_WORDS = 8;

export type FrameReviewState = "pending" | "approved" | "rejected";
export type FrameOriginalityState = "pending" | "passed" | "failed";

export interface HookFrameSupport {
  /** Corpus hooks that instantiate this frame. */
  readonly instances: number;
  /** Distinct creator files among those instances. The originality test that matters. */
  readonly distinctCreatorFiles: number;
  /** Instances whose creator file had enough readable counts to rank within itself. */
  readonly rankedInstances: number;
  /** Ranked instances landing in the top quartile of their OWN creator's distribution. */
  readonly topQuartileInstances: number;
}

export interface HookFrame {
  readonly id: string;
  readonly name: string;
  /** Fixed connective English with {snake_case} slots. */
  readonly template: string;
  readonly slots: readonly string[];
  readonly whenToUse: string;
  readonly platforms: readonly Platform[];
  readonly topics: readonly string[];
  readonly support: HookFrameSupport;
  /** `file.md#entry-<section>-<entry>` refs into the read-only corpus. */
  readonly sourceRefs: readonly string[];
  readonly review: FrameReviewState;
  readonly originality: FrameOriginalityState;
  /** What a writer must supply rather than borrow. */
  readonly adaptationNote: string;
}

export class HookFrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HookFrameError";
  }
}

function fail(message: string): never {
  throw new HookFrameError(message);
}

// Words that would turn a descriptive frame record into a performance claim. The corpus has no
// control group, so nothing in it can support any of these.
const BANNED_CLAIM_WORDS = [
  "viral", "proven", "guaranteed", "best", "winner", "winning", "optimal", "top-performing",
  "high-performing", "generation-ready", "approved-for-generation", "always works", "never fails",
];

const SLOT_PATTERN = /\{([a-z][a-z0-9_]*)\}/g;
const BAD_SLOT_PATTERN = /\{[^}]*\}/g;

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail(`${field} must be a non-negative integer`);
  return value;
}

function stringList(value: unknown, field: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const items = value.map((item, index) => text(item, `${field}[${index + 1}]`));
  if (!allowEmpty && items.length === 0) fail(`${field} must not be empty`);
  return [...new Set(items)].sort();
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) fail(`${field}.${key} is unsupported`);
  for (const key of allowed) if (!(key in value)) fail(`${field}.${key} is required`);
}

/** Slot names in template order, first occurrence only. */
export function templateSlots(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(SLOT_PATTERN)) {
    const name = match[1]!;
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

/** The template with every slot removed, i.e. only the words the frame supplies itself. */
export function fixedWords(template: string): string[] {
  return template
    .replace(SLOT_PATTERN, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9']/g, ""))
    .filter((word) => word.length > 0);
}

/** Runs of consecutive fixed words, split at each slot. A run is what could plausibly be copied. */
export function fixedRuns(template: string): string[][] {
  return template
    .split(/\{[a-z][a-z0-9_]*\}/g)
    .map((segment) =>
      segment
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Za-z0-9']/g, "").toLowerCase())
        .filter((word) => word.length > 0),
    )
    .filter((run) => run.length > 0);
}

export interface FrameValidationContext {
  /** Lowercased creator display names taken from the corpus index. */
  readonly creatorNames?: readonly string[];
  /** Lowercased handles (with or without a leading @) taken from the corpus index. */
  readonly handles?: readonly string[];
  /**
   * Membership test for an 8-word run appearing verbatim anywhere in the corpus. Supplied by the
   * caller so this module never reads the corpus itself.
   */
  readonly corpusContainsRun?: (words: readonly string[]) => boolean;
}

export interface FrameFinding {
  readonly frameId: string;
  readonly kind:
    | "slot-syntax"
    | "slot-mismatch"
    | "too-few-fixed-words"
    | "claim-word"
    | "em-dash"
    | "url"
    | "creator-name"
    | "handle"
    | "insufficient-creators"
    | "support-arithmetic"
    | "duplicate-id"
    | "unusable-template";
  readonly detail: string;
}

function normalizeForMatch(value: string): string {
  // Unicode hyphens and quotes collapse so a name cannot slip through on typography alone.
  return value
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9'@-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkFrame(frame: HookFrame, context: FrameValidationContext = {}): FrameFinding[] {
  const findings: FrameFinding[] = [];
  const add = (kind: FrameFinding["kind"], detail: string): void => {
    findings.push({ frameId: frame.id, kind, detail });
  };

  // Every brace group has to be a well-formed slot; a stray "{ ... }" means the template was never
  // machine-checkable in the first place.
  for (const match of frame.template.match(BAD_SLOT_PATTERN) ?? []) {
    if (!/^\{[a-z][a-z0-9_]*\}$/.test(match)) add("slot-syntax", `${match} is not a {snake_case} slot`);
  }

  const derived = templateSlots(frame.template);
  const declared = [...frame.slots].sort();
  if (JSON.stringify([...derived].sort()) !== JSON.stringify(declared)) {
    add("slot-mismatch", `template slots [${derived.join(", ")}] do not match declared [${declared.join(", ")}]`);
  }
  if (derived.length === 0) add("unusable-template", "a frame with no slots is a fixed sentence, not a template");

  const fixed = fixedWords(frame.template);
  if (fixed.length < MINIMUM_FIXED_WORDS) {
    add("too-few-fixed-words", `${fixed.length} fixed words, needs at least ${MINIMUM_FIXED_WORDS}`);
  }

  const prose = `${frame.name} ${frame.template} ${frame.whenToUse} ${frame.adaptationNote}`;
  const haystack = normalizeForMatch(prose);
  for (const word of BANNED_CLAIM_WORDS) {
    if (haystack.includes(normalizeForMatch(word))) add("claim-word", `"${word}" is a performance claim the corpus cannot support`);
  }
  if (/[—–]/.test(prose)) add("em-dash", "em dashes are never Muxin's; use a period, comma, colon or parentheses");
  if (/https?:\/\/|www\./i.test(prose)) add("url", "frames carry no links");

  for (const name of context.creatorNames ?? []) {
    const needle = normalizeForMatch(name);
    if (needle.split(" ").length >= 2 && haystack.includes(needle)) add("creator-name", `mentions creator "${name}"`);
  }
  for (const handle of context.handles ?? []) {
    const needle = normalizeForMatch(handle).replace(/^@/, "");
    if (needle.length >= 4 && haystack.includes(needle)) add("handle", `mentions handle "${handle}"`);
  }

  if (frame.support.distinctCreatorFiles < MINIMUM_DISTINCT_CREATORS) {
    add(
      "insufficient-creators",
      `${frame.support.distinctCreatorFiles} creator file(s); a frame only counts as widely shared at ${MINIMUM_DISTINCT_CREATORS} or more`,
    );
  }
  if (frame.support.instances < frame.support.distinctCreatorFiles) {
    add("support-arithmetic", "instances cannot be fewer than the distinct creator files they came from");
  }
  if (frame.support.rankedInstances > frame.support.instances) {
    add("support-arithmetic", "ranked instances cannot exceed instances");
  }
  if (frame.support.topQuartileInstances > frame.support.rankedInstances) {
    add("support-arithmetic", "top-quartile instances cannot exceed ranked instances");
  }
  if (frame.sourceRefs.length !== frame.support.instances) {
    add("support-arithmetic", `${frame.sourceRefs.length} source refs against ${frame.support.instances} instances`);
  }

  // The backstop. Most frames pass this trivially because their fixed runs are two or three generic
  // words; it bites exactly on the long frame that is really a creator's sentence in disguise.
  const contains = context.corpusContainsRun;
  if (contains) {
    for (const run of fixedRuns(frame.template)) {
      for (let start = 0; start + VERBATIM_RUN_WORDS <= run.length; start += 1) {
        const window = run.slice(start, start + VERBATIM_RUN_WORDS);
        if (contains(window)) {
          add("unusable-template", `a ${VERBATIM_RUN_WORDS}-word fixed run appears verbatim in the corpus: "${window.join(" ")}"`);
        }
      }
    }
  }

  return findings;
}

export function parseHookFrame(value: unknown, field: string): HookFrame {
  const row = object(value, field);
  exactKeys(
    row,
    ["id", "name", "template", "slots", "whenToUse", "platforms", "topics", "support", "sourceRefs", "review", "originality", "adaptationNote"],
    field,
  );
  const platforms = stringList(row.platforms, `${field}.platforms`).map((platform, index) => {
    if (!(PLATFORMS as readonly string[]).includes(platform)) fail(`${field}.platforms[${index + 1}] is not a supported platform`);
    return platform as Platform;
  });
  const support = object(row.support, `${field}.support`);
  exactKeys(support, ["instances", "distinctCreatorFiles", "rankedInstances", "topQuartileInstances"], `${field}.support`);
  const review = text(row.review, `${field}.review`);
  if (!["pending", "approved", "rejected"].includes(review)) fail(`${field}.review is unsupported`);
  const originality = text(row.originality, `${field}.originality`);
  if (!["pending", "passed", "failed"].includes(originality)) fail(`${field}.originality is unsupported`);
  return {
    id: text(row.id, `${field}.id`),
    name: text(row.name, `${field}.name`),
    template: text(row.template, `${field}.template`),
    slots: stringList(row.slots, `${field}.slots`),
    whenToUse: text(row.whenToUse, `${field}.whenToUse`),
    platforms,
    topics: stringList(row.topics, `${field}.topics`, true),
    support: {
      instances: integer(support.instances, `${field}.support.instances`),
      distinctCreatorFiles: integer(support.distinctCreatorFiles, `${field}.support.distinctCreatorFiles`),
      rankedInstances: integer(support.rankedInstances, `${field}.support.rankedInstances`),
      topQuartileInstances: integer(support.topQuartileInstances, `${field}.support.topQuartileInstances`),
    },
    sourceRefs: stringList(row.sourceRefs, `${field}.sourceRefs`),
    review: review as FrameReviewState,
    originality: originality as FrameOriginalityState,
    adaptationNote: text(row.adaptationNote, `${field}.adaptationNote`),
  };
}

export interface HookFrameLibrary {
  readonly kind: "hook_frame_library";
  readonly version: typeof HOOK_FRAME_LIBRARY_VERSION;
  readonly frames: readonly HookFrame[];
  readonly findings: readonly FrameFinding[];
}

/**
 * Read a JSONL frame bank. Frames that fail a check are dropped from `frames` and reported in
 * `findings`, so a bad row can never be selected or filled by accident.
 */
export function readHookFrameLibrary(jsonl: string, context: FrameValidationContext = {}): HookFrameLibrary {
  if (typeof jsonl !== "string") fail("hook frame library input must be JSONL text");
  const frames: HookFrame[] = [];
  const findings: FrameFinding[] = [];
  const seen = new Set<string>();
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      fail(`jsonl line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const frame = parseHookFrame(parsed, `jsonl line ${index + 1}`);
    if (seen.has(frame.id)) {
      findings.push({ frameId: frame.id, kind: "duplicate-id", detail: `duplicate frame id on line ${index + 1}` });
      continue;
    }
    seen.add(frame.id);
    const frameFindings = checkFrame(frame, context);
    if (frameFindings.length > 0) {
      findings.push(...frameFindings);
      continue;
    }
    frames.push(frame);
  }
  frames.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { kind: "hook_frame_library", version: HOOK_FRAME_LIBRARY_VERSION, frames, findings };
}

/**
 * Pseudo-counts pulling a frame's share toward the corpus base rate when it is ranking frames.
 *
 * Without this, four instances that all happened to land top-quartile read as 100% and outrank a
 * frame measured over fifty. Ten pseudo-counts means a frame needs real volume before its share
 * moves it much, which is the honest reading of these sample sizes.
 */
export const SHARE_PRIOR_WEIGHT = 10;

export interface FrameSelectionRequest {
  readonly platform: Platform;
  readonly topic?: string;
  /** Include frames still awaiting Muxin's review. Off by default. */
  readonly includePending?: boolean;
  readonly limit?: number;
  /** Corpus top-quartile base rate, used as the prior. Defaults to a flat quartile. */
  readonly baseRate?: number;
}

export interface FrameSelection {
  readonly frame: HookFrame;
  /** Top-quartile share among ranked instances, or null when nothing could be ranked. */
  readonly topQuartileShare: number | null;
  /** The share after shrinking toward the base rate. Ordering only, never reported as a result. */
  readonly adjustedShare: number;
  readonly topicMatch: boolean;
}

function topQuartileShare(frame: HookFrame): number | null {
  if (frame.support.rankedInstances === 0) return null;
  return frame.support.topQuartileInstances / frame.support.rankedInstances;
}

function adjustedShare(frame: HookFrame, baseRate: number): number {
  const { topQuartileInstances, rankedInstances } = frame.support;
  return (topQuartileInstances + SHARE_PRIOR_WEIGHT * baseRate) / (rankedInstances + SHARE_PRIOR_WEIGHT);
}

/**
 * Rank frames for a platform and topic. This orders candidates for a human; it never declares a
 * winner. Ordering is topic match, then measured top-quartile share, then how many separate
 * creators reached for the shape, then id for stability.
 */
export function selectFrames(library: HookFrameLibrary, request: FrameSelectionRequest): FrameSelection[] {
  if (!(PLATFORMS as readonly string[]).includes(request.platform)) fail("request.platform is unsupported");
  const baseRate = request.baseRate ?? 0.25;
  if (typeof baseRate !== "number" || !Number.isFinite(baseRate) || baseRate < 0 || baseRate > 1) {
    fail("request.baseRate must be between 0 and 1");
  }
  const topic = request.topic?.trim().toLowerCase();
  const rows = library.frames
    .filter((frame) => frame.platforms.includes(request.platform))
    .filter((frame) => request.includePending === true || frame.review === "approved")
    .map((frame) => ({
      frame,
      topQuartileShare: topQuartileShare(frame),
      adjustedShare: adjustedShare(frame, baseRate),
      topicMatch: topic === undefined ? false : frame.topics.some((value) => value.toLowerCase().includes(topic) || topic.includes(value.toLowerCase())),
    }));
  rows.sort((left, right) => {
    if (left.topicMatch !== right.topicMatch) return left.topicMatch ? -1 : 1;
    if (left.adjustedShare !== right.adjustedShare) return right.adjustedShare - left.adjustedShare;
    if (left.frame.support.distinctCreatorFiles !== right.frame.support.distinctCreatorFiles) {
      return right.frame.support.distinctCreatorFiles - left.frame.support.distinctCreatorFiles;
    }
    return left.frame.id < right.frame.id ? -1 : 1;
  });
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1)) {
    fail("request.limit must be a positive integer");
  }
  return request.limit === undefined ? rows : rows.slice(0, request.limit);
}

export interface FilledHook {
  readonly frameId: string;
  readonly text: string;
  readonly slotsFilled: readonly string[];
  readonly sourceRefs: readonly string[];
  /** Always pending. Filling a frame produces a draft, never something publishable. */
  readonly review: "pending";
  readonly voiceFindings: readonly string[];
}

/**
 * Fill a frame from Muxin's own material.
 *
 * Every slot must be supplied; a half-filled hook with a bare {slot} left in it would read as
 * finished text and is refused instead. Material is hers, so it is not rewritten here beyond
 * trimming, but it is checked for the tells `config/voice.yaml` bans.
 */
export function fillFrame(frame: HookFrame, material: Readonly<Record<string, string>>): FilledHook {
  const slots = templateSlots(frame.template);
  const missing = slots.filter((slot) => {
    const value = material[slot];
    return typeof value !== "string" || value.trim().length === 0;
  });
  if (missing.length > 0) fail(`missing material for slot(s): ${missing.join(", ")}`);
  const extra = Object.keys(material).filter((key) => !slots.includes(key));
  if (extra.length > 0) fail(`material supplied for unknown slot(s): ${extra.join(", ")}`);

  const filled = frame.template.replace(SLOT_PATTERN, (_match, name: string) => material[name]!.trim());
  const voiceFindings: string[] = [];
  if (/[—–]/.test(filled)) voiceFindings.push("contains an em dash or en dash; replace it with a period, comma, colon or parentheses");
  if (/\bhere's the thing\b/i.test(filled)) voiceFindings.push('contains "here\'s the thing"');
  if (/\bdelve\b|\bit's not just .*, it's\b/i.test(filled)) voiceFindings.push("contains a common AI writing tell");
  if (/\{[^}]*\}/.test(filled)) voiceFindings.push("an unfilled placeholder survived into the text");

  return {
    frameId: frame.id,
    text: filled,
    slotsFilled: slots,
    sourceRefs: [...frame.sourceRefs],
    review: "pending",
    voiceFindings,
  };
}
