// Body-free mechanism proposals derived from the merged creator-content corpus.
//
// A proposal is a PROPOSAL. It is not reviewed, not approved, not a template, and not available
// to Content generation. It says "an arrangement that looks like this shows up in these entries,
// and here is exactly what we do not know about it". Muxin reviews the set; only a separate
// content-generation-logic task may ever turn a reviewed proposal into a template.
//
// The projection is body-free by construction and fails closed:
//   - the record shape has no field that can hold creator wording, and unknown keys are rejected;
//   - a deep key scan rejects any body/copy/verbatim/example-shaped key;
//   - free text is linted for claim words ("approved", "best", "winner", "proven viral", ...);
//   - free text is shingled against the verbatim spans and the analysis prose of every entry it
//     cites, so an exact-text payload cannot be smuggled through a description field;
//   - free text is checked against every creator slug and handle in the corpus, so a proposal
//     cannot attribute itself to a named creator.
//
// See docs/content-studio-program/corpus-ui-reconciliation-20260827.md (join gate) and
// docs/content-studio-program/charter.md (safety walls).

import {
  type ParsedCreatorFile,
  type ParsedEntry,
} from "./creator-content-normalization.js";

export const CREATOR_MECHANISM_PROPOSALS_VERSION = "creator-mechanism-proposals-v1" as const;

// Eight families, deliberately kept apart. A hook is not a structure; a structure is not a
// framing; retention is not a CTA. Collapsing them is how a "pattern library" turns into a
// single undifferentiated virality claim.
export const MECHANISM_FAMILIES = [
  "hook",
  "structure",
  "framing",
  "retention",
  "cta",
  "storytelling-sequence",
  "native-format",
  "visual-treatment",
] as const;

export type MechanismFamily = (typeof MECHANISM_FAMILIES)[number];

/** Whether the cited entries come from more than one creator file. Never inferred upward. */
export const REPLICATION_STATUSES = ["cross-creator", "single-creator", "insufficient"] as const;
export type ReplicationStatus = (typeof REPLICATION_STATUSES)[number];

// "metric-backed" only means every cited entry carried readable platform counts. It does NOT
// mean the mechanism caused those counts: no baseline, no denominator, no comparison window.
export const PROPOSAL_EVIDENCE_STATUSES = ["metric-backed", "structural-only", "partial-capture", "insufficient"] as const;
export type ProposalEvidenceStatus = (typeof PROPOSAL_EVIDENCE_STATUSES)[number];

export const PROPOSAL_CONFIDENCES = ["low", "medium", "unknown"] as const;
export type ProposalConfidence = (typeof PROPOSAL_CONFIDENCES)[number];

export interface MechanismSupport {
  readonly entries: number;
  readonly distinct_creator_files: number;
  readonly distinct_platforms: number;
  readonly metric_backed_entries: number;
  readonly incomplete_metric_entries: number;
  readonly partial_capture_entries: number;
  readonly paywalled_entries: number;
  readonly third_party_entries: number;
}

export interface MechanismProposal {
  readonly proposal_id: string;
  readonly family: MechanismFamily;
  readonly name: string;
  readonly mechanism: string;
  readonly platforms: readonly string[];
  readonly evidence_kinds: readonly string[];
  readonly source_refs: readonly string[];
  readonly third_party_refs: readonly string[];
  readonly support: MechanismSupport;
  readonly replication: ReplicationStatus;
  readonly evidence_status: ProposalEvidenceStatus;
  readonly evidence_limitations: readonly string[];
  readonly adaptation_note: string;
  readonly confidence: ProposalConfidence;
  readonly review_status: "pending";
  readonly originality_status: "pending";
  readonly generates_copy: false;
  readonly creator_body_copy_allowed: false;
}

export interface MechanismProposalSet {
  readonly kind: "creator_mechanism_proposals";
  readonly version: typeof CREATOR_MECHANISM_PROPOSALS_VERSION;
  readonly proposals: readonly MechanismProposal[];
  readonly by_family: Readonly<Record<MechanismFamily, number>>;
  readonly summary: {
    readonly total: number;
    readonly cross_creator: number;
    readonly single_creator: number;
    readonly metric_backed: number;
    readonly pending_review: number;
    readonly pending_originality: number;
  };
  readonly body_included: false;
  readonly verbatim_included: false;
  readonly winner_claims_allowed: false;
  readonly available_to_generation: false;
  readonly generates_copy: false;
  readonly creator_body_copy_allowed: false;
}

export class MechanismProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MechanismProposalValidationError";
  }
}

function fail(message: string): never {
  throw new MechanismProposalValidationError(message);
}

// ---------------------------------------------------------------------------
// Fail-closed guards
// ---------------------------------------------------------------------------

// Any key shaped like a place to stash creator copy, an exact-text payload, a model call, or a
// ranking. Matched after stripping separators and case, so `creator_body` and `creatorBody` and
// `CREATOR-BODY` all trip it.
const FORBIDDEN_KEYS = new Set([
  "body", "bodytext", "bodycopy", "postbody", "creatorbody", "creatorbodycopy", "sourcebody",
  "content", "copy", "text", "fulltext", "rawtext", "sourcetext", "verbatim", "verbatimtext",
  "quote", "quotes", "quotation", "excerpt", "excerpts", "snippet", "snippets", "passage",
  "transcript", "transcripts", "caption", "captions", "onscreentext", "imagetext", "title",
  "posttitle", "headline", "hooktext", "openertext", "opener", "literalshape", "example",
  "exampletext", "examples", "sample", "samples", "url", "urls", "link", "links", "permalink",
  "handle", "creator", "creatorname", "author", "byline",
  "model", "modelname", "prompt", "completion", "llm", "apikey", "accesstoken", "password",
  "secret", "winner", "ranking", "rank", "score", "scores", "best", "top",
]);

// Claim words the program forbids on unreviewed research evidence.
const BANNED_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bapproved\b/i,
  /\breviewed\b/i,
  /\bbest\b/i,
  /\bwinner\b/i,
  /\bwinning\b/i,
  /\bproven\b/i,
  /\bviral\b/i,
  /\bvirality\b/i,
  /\bgeneration-ready\b/i,
  /\bready for generation\b/i,
  /\btop-performing\b/i,
  /\bguaranteed\b/i,
  /\boptimal\b/i,
];

// Effect claims. A proposal describes an arrangement; it does not get to assert what that
// arrangement does to a reader. There is no baseline anywhere in this corpus that could support
// such a claim, so the wording is refused rather than footnoted.
//
// This is a bounded lint over the phrasings the corpus work actually produced, not a semantic
// judge: a sufficiently indirect effect claim will pass it. It raises the floor; Muxin's review is
// still what decides whether a proposal says more than the evidence supports.
const EFFECT_CLAIM_PATTERNS: readonly RegExp[] = [
  /\b(?:creat|generat|manufactur|build|earn|driv|boost|increas|maximi[sz])\w*\s+(?:the\s+|a\s+|an\s+)?(?:urgency|trust|credibility|desire|demand|engagement|reach|conversions?|retention|attention)\b/i,
  /\bbasis for (?:the )?(?:audience|readers?|viewers?)(?:'s|s')?\s+\w+/i,
  // "what makes the reader respond is unknown" is a limitation, not a claim, so the subject
  // matters: only an arrangement asserted to act on a reader is refused.
  /(?<!\bwhat )\bmakes? (?:the )?(?:audience|readers?|viewers?|people)\b/i,
  /\b(?:hooks?|grabs?|holds?|keeps?|captures?|compels?|persuades?|convinces?)\s+(?:the\s+)?(?:audience|readers?|viewers?|people)\b/i,
  /\bso that (?:the )?(?:audience|reader|viewer|people)\b/i,
  /\b(?:audience|reader|viewer)s?\s+(?:are|is|will be)\s+(?:more likely|persuaded|convinced|hooked)\b/i,
  /\b(?:persuades?|convinces?|compels?)\s+(?:the\s+)?(?:audience|readers?|viewers?|people)\s+to\b/i,
];

const NEGATION_BEFORE = /\b(?:not|never|no|nor|unknown|unclear|whether)\b[^.]*$/i;

const URL_PATTERN = /https?:\/\/|www\.|\.com\b|\.org\b|\.net\b|\.io\b/i;
const BLOCKQUOTE_PATTERN = /(^|\n)\s*>/;

const REF_PATTERN = /^([a-z0-9-]+\.md)#entry-(\d+)-(\d+)$/;
const ID_PATTERN = /^mech:(?:hook|structure|framing|retention|cta|storytelling-sequence|native-format|visual-treatment):[a-z0-9-]+$/;

const MAX_SLUG_LENGTH = 60;
const MAX_NAME_LENGTH = 60;
const MAX_MECHANISM_LENGTH = 320;
const MAX_NOTE_LENGTH = 320;
const MAX_LIMITATION_LENGTH = 300;

/** Length of the word run that counts as copied text rather than shared vocabulary. */
export const VERBATIM_SHINGLE_WORDS = 8;

function keyName(value: string): string {
  return value.replace(/[_\- ]/g, "").toLowerCase();
}

export function assertNoForbiddenKeys(value: unknown, field: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail(`${field} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${field}[${index + 1}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(keyName(key))) {
      fail(`${field}.${key} is forbidden: mechanism proposals store abstractions and references, never creator copy, exact text, links, or rankings`);
    }
    assertNoForbiddenKeys(nested, `${field}.${key}`, seen);
  }
}

export function assertNoBannedClaims(text: string, field: string): void {
  for (const pattern of BANNED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      fail(`${field} uses a forbidden claim word (${pattern.source}); proposals are unreviewed research evidence and may not be labelled approved, reviewed, best, winner, proven viral, or generation-ready`);
    }
  }
  for (const pattern of EFFECT_CLAIM_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    // Saying an arrangement is NOT a basis for something, or that its effect is unknown, is the
    // honest sentence this lane wants, so a negation immediately before the phrase clears it.
    if (NEGATION_BEFORE.test(text.slice(Math.max(0, match.index - 28), match.index))) continue;
    fail(`${field} asserts an effect on the audience (${pattern.source}); this corpus has no baseline, denominator or comparison window, so a proposal may describe an arrangement but never what it does to a reader`);
  }
}

function assertNoEmbeddedSource(text: string, field: string): void {
  if (URL_PATTERN.test(text)) fail(`${field} must not carry a link; source references belong in source_refs`);
  if (BLOCKQUOTE_PATTERN.test(text)) fail(`${field} must not carry a quoted block`);
  if (/[""«»]/.test(text)) fail(`${field} must not carry typographic quotation marks; abstractions are not quotations`);
  const straightQuoted = /"[^"]{16,}"/.exec(text);
  if (straightQuoted) fail(`${field} must not carry a quoted run of source text`);
  if (text.includes("—")) fail(`${field} must not use em dashes`);
}

/**
 * A 53-bit hash of a normalized word run, built from two FNV-1a passes with different seeds.
 *
 * One 32-bit pass is not enough here. The corpus holds roughly two and a half million word runs,
 * and at 32 bits that produced false alarms on real proposals whose text appears nowhere in the
 * corpus. Widening to 53 bits, the largest exact integer a Number holds, makes a collision
 * vanishingly unlikely while keeping the set cheap. A collision can still only over-report.
 */
export function shingleHash(words: readonly string[]): number {
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (const word of words) {
    for (let index = 0; index < word.length; index += 1) {
      const code = word.charCodeAt(index);
      low = Math.imul(low ^ code, 0x01000193);
      high = Math.imul(high ^ code, 0x85ebca6b);
    }
    low = Math.imul(low ^ 32, 0x01000193);
    high = Math.imul(high ^ 32, 0x85ebca6b);
  }
  return (low >>> 0) * 2 ** 21 + (high >>> 11);
}

/** Hashed word runs of `text`, for comparison against the whole corpus rather than one entry. */
export function shingleHashes(text: string, size = VERBATIM_SHINGLE_WORDS): Set<number> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const result = new Set<number>();
  for (let index = 0; index + size <= words.length; index += 1) {
    result.add(shingleHash(words.slice(index, index + size)));
  }
  return result;
}

/** Lowercased word shingles, used to detect a copied run rather than shared vocabulary. */
export function shingles(text: string, size = VERBATIM_SHINGLE_WORDS): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const result = new Set<string>();
  for (let index = 0; index + size <= words.length; index += 1) {
    result.add(words.slice(index, index + size).join(" "));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Record validation (shape only; corpus cross-checks are separate)
// ---------------------------------------------------------------------------

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) fail(`${field} must be at most ${maxLength} characters`);
  assertNoBannedClaims(trimmed, field);
  assertNoEmbeddedSource(trimmed, field);
  return trimmed;
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value;
}

function stringList(value: unknown, field: string, maxLength: number, allowEmpty = false): string[] {
  const items = array(value, field).map((item, index) => text(item, `${field}[${index + 1}]`, maxLength));
  if (!allowEmpty && items.length === 0) fail(`${field} must not be empty`);
  return [...new Set(items)].sort(compareText);
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail(`${field} must be a non-negative integer`);
  return value;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string") fail(`${field} must be a string`);
  const normalized = value.trim() as T;
  if (!allowed.includes(normalized)) fail(`${field} must be one of ${allowed.join(", ")}`);
  return normalized;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) fail(`${field}.${key} is unsupported`);
  for (const key of allowed) if (!(key in value)) fail(`${field}.${key} is required`);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const SUPPORT_KEYS = [
  "entries", "distinct_creator_files", "distinct_platforms", "metric_backed_entries",
  "incomplete_metric_entries", "partial_capture_entries", "paywalled_entries", "third_party_entries",
] as const;

const PROPOSAL_KEYS = [
  "proposal_id", "family", "name", "mechanism", "platforms", "evidence_kinds", "source_refs",
  "third_party_refs", "support", "replication", "evidence_status", "evidence_limitations",
  "adaptation_note", "confidence", "review_status", "originality_status", "generates_copy",
  "creator_body_copy_allowed",
] as const;

function refList(value: unknown, field: string, allowEmpty: boolean): string[] {
  const items = array(value, field).map((item, index) => {
    if (typeof item !== "string" || !REF_PATTERN.test(item.trim())) {
      fail(`${field}[${index + 1}] must be a source reference shaped like "creator-file.md#entry-<section>-<entry>"`);
    }
    return item.trim();
  });
  if (!allowEmpty && items.length === 0) fail(`${field} must not be empty`);
  return [...new Set(items)].sort(compareText);
}

function proposalRecord(value: unknown, field: string): MechanismProposal {
  const row = object(value, field);
  exactKeys(row, PROPOSAL_KEYS, field);
  const proposalId = String(row.proposal_id ?? "").trim();
  if (!ID_PATTERN.test(proposalId)) fail(`${field}.proposal_id must look like "mech:<family>:<slug>"`);
  const slug = proposalId.slice(proposalId.lastIndexOf(":") + 1);
  if (slug.length > MAX_SLUG_LENGTH) fail(`${field}.proposal_id slug must be at most ${MAX_SLUG_LENGTH} characters; an id is a handle, not a place to put text`);
  // The id is read by humans and stored like any other string, so it is linted like any other.
  assertNoBannedClaims(slug.replace(/-/g, " "), `${field}.proposal_id`);
  const family = enumValue(row.family, `${field}.family`, MECHANISM_FAMILIES);
  if (!proposalId.startsWith(`mech:${family}:`)) fail(`${field}.proposal_id must carry its own family`);
  if (row.generates_copy !== false) fail(`${field}.generates_copy must be false`);
  if (row.creator_body_copy_allowed !== false) fail(`${field}.creator_body_copy_allowed must be false`);
  if (row.review_status !== "pending") fail(`${field}.review_status must be "pending"; only Muxin's review may change it, and never in this lane`);
  if (row.originality_status !== "pending") fail(`${field}.originality_status must be "pending"; an independent originality audit has not run`);

  const support = object(row.support, `${field}.support`);
  exactKeys(support, SUPPORT_KEYS, `${field}.support`);

  return {
    proposal_id: proposalId,
    family,
    name: text(row.name, `${field}.name`, MAX_NAME_LENGTH),
    mechanism: text(row.mechanism, `${field}.mechanism`, MAX_MECHANISM_LENGTH),
    platforms: stringList(row.platforms, `${field}.platforms`, 32),
    evidence_kinds: stringList(row.evidence_kinds, `${field}.evidence_kinds`, 32),
    source_refs: refList(row.source_refs, `${field}.source_refs`, false),
    third_party_refs: refList(row.third_party_refs, `${field}.third_party_refs`, true),
    support: {
      entries: integer(support.entries, `${field}.support.entries`),
      distinct_creator_files: integer(support.distinct_creator_files, `${field}.support.distinct_creator_files`),
      distinct_platforms: integer(support.distinct_platforms, `${field}.support.distinct_platforms`),
      metric_backed_entries: integer(support.metric_backed_entries, `${field}.support.metric_backed_entries`),
      incomplete_metric_entries: integer(support.incomplete_metric_entries, `${field}.support.incomplete_metric_entries`),
      partial_capture_entries: integer(support.partial_capture_entries, `${field}.support.partial_capture_entries`),
      paywalled_entries: integer(support.paywalled_entries, `${field}.support.paywalled_entries`),
      third_party_entries: integer(support.third_party_entries, `${field}.support.third_party_entries`),
    },
    replication: enumValue(row.replication, `${field}.replication`, REPLICATION_STATUSES),
    evidence_status: enumValue(row.evidence_status, `${field}.evidence_status`, PROPOSAL_EVIDENCE_STATUSES),
    evidence_limitations: stringList(row.evidence_limitations, `${field}.evidence_limitations`, MAX_LIMITATION_LENGTH),
    adaptation_note: text(row.adaptation_note, `${field}.adaptation_note`, MAX_NOTE_LENGTH),
    confidence: enumValue(row.confidence, `${field}.confidence`, PROPOSAL_CONFIDENCES),
    review_status: "pending",
    originality_status: "pending",
    generates_copy: false,
    creator_body_copy_allowed: false,
  };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) value.forEach(freeze);
    else Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
}

export function readMechanismProposals(jsonl: string): MechanismProposalSet {
  if (typeof jsonl !== "string") fail("mechanism proposal input must be JSONL text");
  const proposals: MechanismProposal[] = [];
  const ids = new Set<string>();
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      fail(`jsonl line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertNoForbiddenKeys(parsed, `jsonl line ${index + 1}`);
    const proposal = proposalRecord(parsed, `jsonl line ${index + 1}`);
    if (ids.has(proposal.proposal_id)) fail(`duplicate proposal id: ${proposal.proposal_id}`);
    ids.add(proposal.proposal_id);
    proposals.push(proposal);
  }
  proposals.sort((left, right) => compareText(left.proposal_id, right.proposal_id));
  const byFamily = {} as Record<MechanismFamily, number>;
  for (const family of MECHANISM_FAMILIES) byFamily[family] = 0;
  for (const proposal of proposals) byFamily[proposal.family] += 1;
  return freeze({
    kind: "creator_mechanism_proposals",
    version: CREATOR_MECHANISM_PROPOSALS_VERSION,
    proposals,
    by_family: byFamily,
    summary: {
      total: proposals.length,
      cross_creator: proposals.filter((proposal) => proposal.replication === "cross-creator").length,
      single_creator: proposals.filter((proposal) => proposal.replication === "single-creator").length,
      metric_backed: proposals.filter((proposal) => proposal.evidence_status === "metric-backed").length,
      pending_review: proposals.length,
      pending_originality: proposals.length,
    },
    body_included: false,
    verbatim_included: false,
    winner_claims_allowed: false,
    available_to_generation: false,
    generates_copy: false,
    creator_body_copy_allowed: false,
  });
}

// ---------------------------------------------------------------------------
// Corpus cross-validation
// ---------------------------------------------------------------------------

// Words that show up inside a handle field but name a platform or an audience unit, not a person.
const GENERIC_HANDLE_TOKENS = new Set([
  "hacker", "news", "karma", "follower", "followers", "subscriber", "subscribers", "substack",
  "threads", "youtube", "tiktok", "twitter", "mastodon", "bluesky", "linkedin", "instagram",
  "pinterest", "reddit", "guest", "across", "channels", "channel", "native", "profile", "account",
  "displayed", "natively", "newsletter", "notes", "posts", "video", "social", "hachyderm",
]);

export interface CorpusIndex {
  readonly entriesByRef: ReadonlyMap<string, ParsedEntry>;
  readonly platformByFile: ReadonlyMap<string, string | null>;
  /** Verbatim spans and analysis prose per entry ref, used only for the copy check. */
  readonly verbatimShinglesByRef: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * Hashed word runs from EVERY line of the whole corpus, cited or not. Held as 32-bit hashes
   * rather than strings because the corpus is roughly 16 MB of text. A hash collision can only
   * produce a false alarm on a proposal, never a silent pass.
   */
  readonly corpusShingleHashes: ReadonlySet<number>;
  /** Creator names, matched over the fields that describe a mechanism. */
  readonly creatorTokens: ReadonlySet<string>;
  /** Account handles, matched everywhere including evidence limitations. */
  readonly creatorHandleTokens: ReadonlySet<string>;
  /** Corpus file names, which a limitation is allowed to cite the way source_refs do. */
  readonly corpusFileNames: ReadonlySet<string>;
}

/**
 * Build the lookup a proposal set is checked against. `rawTextByFile` is the corpus Markdown; it
 * is used to shingle the cited entries' verbatim spans and never stored or returned.
 */
export function buildCorpusIndex(
  files: readonly ParsedCreatorFile[],
  rawTextByFile: ReadonlyMap<string, string>,
): CorpusIndex {
  const entriesByRef = new Map<string, ParsedEntry>();
  const platformByFile = new Map<string, string | null>();
  const verbatimShinglesByRef = new Map<string, ReadonlySet<string>>();
  const creatorTokens = new Set<string>();
  const creatorHandleTokens = new Set<string>();
  const corpusFileNames = new Set<string>();
  const corpusShingleHashes = new Set<number>();

  for (const file of files) {
    platformByFile.set(file.file, file.header.platform);
    corpusFileNames.add(file.file);
    // Two things are matched, and deliberately only two: the creator's name as a phrase
    // ("alex hormozi") and the account handle itself as one unbroken run ("juddlegum").
    //
    // Splitting either into single words does not work. Creator slugs contain ordinary English
    // ("love", "green", "levels", "journey") and the handle field often carries a publication
    // name beside the handle ("Popular Information", "Behind the Craft", "Product Talk"), so a
    // word-level match fires on abstract prose that names nobody. A phrase and a whole handle
    // are what an actual attribution looks like.
    const slugTokens = file.creatorSlug.split("-");
    if (slugTokens.length > 1) creatorTokens.add(slugTokens.join(" "));
    else if (slugTokens[0]!.length >= 4) creatorTokens.add(slugTokens[0]!);
    // The handle field is sometimes a display name plus an annotation ("Product Talk
    // (productTalk.org)"). Only take the leading run when it is actually a handle: either
    // @-prefixed, or the only word before the first parenthesis or comma.
    const handleField = (file.header.handle ?? "").toLowerCase().trim();
    const namePart = handleField.split(/[(,]/)[0]!.trim();
    const isHandle = handleField.startsWith("@") || !/\s/.test(namePart);
    const handle = isHandle ? /^@?([a-z0-9][a-z0-9_.-]*)/.exec(handleField)?.[1] : undefined;
    if (handle && handle.length >= 6 && !GENERIC_HANDLE_TOKENS.has(handle)) {
      creatorTokens.add(handle);
      creatorHandleTokens.add(handle);
    }
    // A handle's first segment only counts on its own when it is long enough to be a name rather
    // than a category word: "dieworkwear" yes, the "product" in "@product-thinking" no.
    const firstSegment = handle?.split(/[._-]/)[0];
    if (firstSegment && firstSegment.length >= 8 && !GENERIC_HANDLE_TOKENS.has(firstSegment)) {
      creatorTokens.add(firstSegment);
      creatorHandleTokens.add(firstSegment);
    }
    // Fail closed: a file with no source text would silently disable the copy check for every
    // entry it holds, which is exactly the case where the check matters.
    const rawText = rawTextByFile.get(file.file);
    if (rawText === undefined) fail(`buildCorpusIndex is missing the source text for ${file.file}; the copy check cannot run without it`);
    const lines = rawText.split(/\r?\n/);
    for (const hash of shingleHashes(rawText)) corpusShingleHashes.add(hash);
    const starts = file.entries.map((entry) => entry.lineNumber - 1);
    for (const [position, entry] of file.entries.entries()) {
      const end = position + 1 < starts.length ? starts[position + 1]! : lines.length;
      // Every line of the entry, not just its blockquotes: an inline field value carries captured
      // text too, and a check that skipped them would leave the easiest route open.
      const span = lines.slice(starts[position]!, end).join(" ");
      entriesByRef.set(entry.ref, entry);
      verbatimShinglesByRef.set(entry.ref, shingles(span));
    }
  }
  return { entriesByRef, platformByFile, verbatimShinglesByRef, creatorTokens, creatorHandleTokens, corpusFileNames, corpusShingleHashes };
}

export interface ProposalValidationFinding {
  readonly proposal_id: string;
  readonly kind:
    | "unknown-source-ref"
    | "support-mismatch"
    | "replication-mismatch"
    | "evidence-status-mismatch"
    | "third-party-ref-mismatch"
    | "verbatim-overlap"
    | "creator-named"
    | "platform-mismatch"
    | "insufficient-support";
  readonly detail: string;
}

export interface ProposalValidationReport {
  readonly kind: "creator_mechanism_proposal_validation";
  readonly version: typeof CREATOR_MECHANISM_PROPOSALS_VERSION;
  readonly proposals_checked: number;
  readonly source_refs_checked: number;
  readonly findings: readonly ProposalValidationFinding[];
  readonly passed: boolean;
}

/** The support floor below which a cluster is a note, not a proposal. */
export const MINIMUM_SUPPORT_ENTRIES = 4;

function recomputeSupport(entries: readonly ParsedEntry[], index: CorpusIndex): MechanismSupport {
  const firstParty = entries.filter((entry) => !entry.flags.thirdPartyAuthored);
  return {
    entries: entries.length,
    distinct_creator_files: new Set(firstParty.map((entry) => entry.file)).size,
    distinct_platforms: new Set(firstParty.map((entry) => index.platformByFile.get(entry.file) ?? "unmapped")).size,
    // "metric-backed" means the platform's whole count set was readable. One unreadable token
    // makes the set incomplete, and an incomplete set must not stand in for a complete one.
    metric_backed_entries: entries.filter((entry) => entry.metrics.available && entry.metrics.unparsedTokens === 0).length,
    incomplete_metric_entries: entries.filter((entry) => entry.metrics.unparsedTokens > 0).length,
    partial_capture_entries: entries.filter((entry) => entry.flags.partialCapture).length,
    paywalled_entries: entries.filter((entry) => entry.flags.paywalled).length,
    third_party_entries: entries.length - firstParty.length,
  };
}

function expectedReplication(support: MechanismSupport): ReplicationStatus {
  if (support.entries < MINIMUM_SUPPORT_ENTRIES) return "insufficient";
  // Zero first-party files means every cited entry is somebody else's post carried on an account
  // being studied. That is not one creator repeating themselves and it is not replication either.
  if (support.distinct_creator_files === 0) return "insufficient";
  return support.distinct_creator_files > 1 ? "cross-creator" : "single-creator";
}

function expectedEvidenceStatus(support: MechanismSupport): ProposalEvidenceStatus {
  if (support.entries < MINIMUM_SUPPORT_ENTRIES) return "insufficient";
  if (support.partial_capture_entries > 0 || support.paywalled_entries > 0) return "partial-capture";
  if (support.incomplete_metric_entries > 0) return "structural-only";
  return support.metric_backed_entries === support.entries ? "metric-backed" : "structural-only";
}

export function validateProposalsAgainstCorpus(
  set: MechanismProposalSet,
  index: CorpusIndex,
): ProposalValidationReport {
  const findings: ProposalValidationFinding[] = [];
  let refsChecked = 0;

  for (const proposal of set.proposals) {
    const entries: ParsedEntry[] = [];
    for (const ref of proposal.source_refs) {
      refsChecked += 1;
      const entry = index.entriesByRef.get(ref);
      if (!entry) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "unknown-source-ref", detail: `${ref} does not resolve to a parsed corpus entry` });
        continue;
      }
      entries.push(entry);
    }
    if (entries.length !== proposal.source_refs.length) continue;

    if (entries.length < MINIMUM_SUPPORT_ENTRIES) {
      findings.push({ proposal_id: proposal.proposal_id, kind: "insufficient-support", detail: `${entries.length} cited entries is below the ${MINIMUM_SUPPORT_ENTRIES}-entry floor` });
    }

    const expected = recomputeSupport(entries, index);
    for (const key of SUPPORT_KEYS) {
      if (proposal.support[key] !== expected[key]) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "support-mismatch", detail: `support.${key} declares ${proposal.support[key]} but the cited entries give ${expected[key]}` });
      }
    }

    const declaredThirdParty = new Set(proposal.third_party_refs);
    for (const entry of entries) {
      if (entry.flags.thirdPartyAuthored && !declaredThirdParty.has(entry.ref)) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "third-party-ref-mismatch", detail: `${entry.ref} is authored by someone other than the account owner and must be listed in third_party_refs` });
      }
    }
    for (const ref of proposal.third_party_refs) {
      if (!proposal.source_refs.includes(ref)) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "third-party-ref-mismatch", detail: `${ref} is listed as third-party but is not a source ref` });
        continue;
      }
      if (index.entriesByRef.get(ref)?.flags.thirdPartyAuthored === false) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "third-party-ref-mismatch", detail: `${ref} is listed as third-party but the corpus records it as the account owner's own post` });
      }
    }

    const replication = expectedReplication(expected);
    if (proposal.replication !== replication) {
      findings.push({ proposal_id: proposal.proposal_id, kind: "replication-mismatch", detail: `declares ${proposal.replication} but the cited entries give ${replication}` });
    }
    const evidenceStatus = expectedEvidenceStatus(expected);
    if (proposal.evidence_status !== evidenceStatus) {
      findings.push({ proposal_id: proposal.proposal_id, kind: "evidence-status-mismatch", detail: `declares ${proposal.evidence_status} but the cited entries give ${evidenceStatus}` });
    }

    const citedPlatforms = new Set(entries.map((entry) => index.platformByFile.get(entry.file) ?? "unmapped"));
    for (const platform of proposal.platforms) {
      if (!citedPlatforms.has(platform)) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "platform-mismatch", detail: `declares platform "${platform}" but no cited entry comes from it` });
      }
    }

    let citedOverlap = false;
    const slugWords = proposal.proposal_id.slice(proposal.proposal_id.lastIndexOf(":") + 1).replace(/-/g, " ");
    // Everything a downstream template would read. This is where an attribution must not appear.
    const mechanismText = [slugWords, proposal.name, proposal.mechanism, proposal.adaptation_note].join(" ");
    const freeText = [mechanismText, ...proposal.evidence_limitations].join(" ");
    const proposalShingles = shingles(freeText);
    for (const ref of proposal.source_refs) {
      const source = index.verbatimShinglesByRef.get(ref);
      if (!source) continue;
      for (const shingle of proposalShingles) {
        if (source.has(shingle)) {
          citedOverlap = true;
          findings.push({ proposal_id: proposal.proposal_id, kind: "verbatim-overlap", detail: `shares a ${VERBATIM_SHINGLE_WORDS}-word run with the captured text of ${ref}` });
          break;
        }
      }
    }
    // Citing entry A while copying from entry B would slip past a check scoped to cited entries,
    // so the same runs are also compared against the whole corpus. This one cannot name the
    // entry it matched, only that a run of this length exists somewhere in the source material.
    if (!citedOverlap) {
      for (const hash of shingleHashes(freeText)) {
        if (index.corpusShingleHashes.has(hash)) {
          findings.push({ proposal_id: proposal.proposal_id, kind: "verbatim-overlap", detail: `shares a ${VERBATIM_SHINGLE_WORDS}-word run with corpus text the proposal does not cite` });
          break;
        }
      }
    }

    // A creator name is stored as a phrase ("alex hormozi"), so a written "Alex-Hormozi" or
    // "Alex\u2010Hormozi" has to be compared with the dash family read as a space as well as read
    // as a hyphen. Both readings are checked; a handle keeps its own hyphens in the second.
    // An evidence limitation is provenance: saying which source file the evidence concentrates in
    // is the honest sentence, and it is the same information source_refs already carries. So the
    // creator-name check runs over the mechanism-describing fields, not over the limitations.
    const normalized = mechanismText.toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-");
    const readings = [normalized, normalized.replace(/-/g, " ").replace(/\s+/g, " ")];
    // A handle is never needed to state a limitation, so it stays forbidden there. Source-file
    // names are removed first: citing the file the evidence concentrates in is the honest sentence,
    // and some accounts' handles are the file name, so leaving them in would refuse provenance.
    let limitationText = proposal.evidence_limitations.join(" ").toLowerCase();
    for (const fileName of index.corpusFileNames) {
      limitationText = limitationText.split(fileName).join(" ").split(fileName.replace(/\.md$/, "")).join(" ");
    }
    for (const handle of index.creatorHandleTokens) {
      if (limitationText.includes(handle)) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "creator-named", detail: `an evidence limitation names an account handle ("${handle}")` });
      }
    }
    for (const token of index.creatorTokens) {
      // A one-word name is matched on word boundaries; a multi-word name or a handle is a phrase
      // distinctive enough that a substring match is safe.
      const hit = readings.some((reading) => (token.includes(" ") || token.length >= 8
        ? reading.includes(token)
        : new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(reading)));
      if (hit) {
        findings.push({ proposal_id: proposal.proposal_id, kind: "creator-named", detail: `free text names a corpus creator or handle token ("${token}")` });
      }
    }
  }

  findings.sort((left, right) => compareText(left.proposal_id, right.proposal_id) || compareText(left.kind, right.kind) || compareText(left.detail, right.detail));
  return {
    kind: "creator_mechanism_proposal_validation",
    version: CREATOR_MECHANISM_PROPOSALS_VERSION,
    proposals_checked: set.proposals.length,
    source_refs_checked: refsChecked,
    findings,
    passed: findings.length === 0,
  };
}
