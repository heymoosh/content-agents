// Deterministic, body-free normalization of the merged creator-content Markdown libraries.
//
// The corpus under docs/content-studio-program/creator-content/** is research evidence, not a
// reviewed template library and not a Content input. This module reads those files, but every
// value it returns is accounting metadata: field labels, presence flags, counts, dates, and
// source references. No creator body, transcript, caption, hook wording, post title, story,
// example, or source URL is ever carried out of a parse result, so a normalized inventory can be
// staged and reviewed without moving creator bodies anywhere new.
//
// See docs/content-studio-program/corpus-ui-reconciliation-20260827.md for why the corpus is
// read-only here, and docs/content-studio-program/charter.md for the body-free boundary.

export const CREATOR_CONTENT_NORMALIZATION_VERSION = "creator-content-normalization-v1" as const;

/** Where the tracked corpus lives, relative to the repository root. */
export const CREATOR_CONTENT_DIR = "docs/content-studio-program/creator-content" as const;

/** Where the roll-up index lives, relative to the repository root. */
export const CREATOR_CONTENT_INDEX = "docs/content-studio-program/creator-content-index.md" as const;

export class CreatorContentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorContentParseError";
  }
}

function fail(message: string): never {
  throw new CreatorContentParseError(message);
}

// ---------------------------------------------------------------------------
// Field taxonomy
// ---------------------------------------------------------------------------

// One kind per distinguishable evidence surface. The corpus spells the same surface several ways
// depending on source and medium (a YouTube opening hook is labelled off a transcript, a Pinterest
// one off on-image text), so the kind is what downstream accounting counts and the raw label is
// kept beside it for audit.
export const CREATOR_FIELD_KINDS = [
  "hook",
  "body",
  "transcript",
  "caption",
  "on-screen-text",
  "image-text",
  "visual-description",
  "thumbnail-description",
  "structure",
  "structure-map",
  "framing",
  "metrics",
  "teaser",
  "summary",
  "description",
  "access",
  "duration",
  "byline",
  "linked-url",
  "link-card",
  "status",
  "format",
  "entry-metadata",
  "capture-note",
  "unrecognized",
] as const;

export type CreatorFieldKind = (typeof CREATOR_FIELD_KINDS)[number];

// Qualifiers ride in the label's parenthetical ("verbatim, from transcript", "everything visible
// before the paywall", "or 'Not captured' note"). They are the corpus's own honesty markers and
// they decide whether a field counts as complete evidence.
export const CREATOR_FIELD_QUALIFIERS = [
  "verbatim",
  "from-transcript",
  "auto-captions",
  "creator-captions",
  "paywalled",
  "partial",
  "excerpt",
  "conditional-absence",
  "visual-only",
  "no-spoken-audio",
  "third-party-authored",
  "segmented",
  "stylized",
  "restricted",
  "unavailable",
] as const;

export type CreatorFieldQualifier = (typeof CREATOR_FIELD_QUALIFIERS)[number];

/** Whether the field actually carries evidence, only part of it, or explicitly none. */
export type CreatorFieldPresence = "present" | "partial" | "absent";

const KIND_BY_BASE_LABEL: ReadonlyArray<readonly [string, CreatorFieldKind]> = [
  // Longest / most specific first: "structure map" must win over "structure".
  ["structure map", "structure-map"],
  ["structure/framing note", "capture-note"],
  ["structure", "structure"],
  ["framing", "framing"],
  ["opening hook", "hook"],
  ["promotional teaser", "teaser"],
  ["teaser", "teaser"],
  ["full transcript", "transcript"],
  ["spoken/audio transcript", "transcript"],
  ["spoken transcript", "transcript"],
  ["transcript", "transcript"],
  ["full text", "body"],
  ["caption", "caption"],
  ["on-screen text", "on-screen-text"],
  ["on-screen text / spoken transcript method note", "capture-note"],
  ["image text", "image-text"],
  ["thumbnail description", "thumbnail-description"],
  ["visual description", "visual-description"],
  ["video summary", "summary"],
  ["description", "description"],
  ["metrics", "metrics"],
  ["points/comments", "metrics"],
  ["access", "access"],
  ["duration", "duration"],
  ["byline", "byline"],
  ["author(s)", "byline"],
  ["author", "byline"],
  ["co-author", "byline"],
  ["host channel/event", "entry-metadata"],
  ["original clip being reacted to", "entry-metadata"],
  ["on-topic", "entry-metadata"],
  ["linked url", "linked-url"],
  ["live link", "linked-url"],
  ["linked card", "link-card"],
  ["status", "status"],
  ["format", "format"],
  ["edited", "entry-metadata"],
  ["dates", "entry-metadata"],
  ["date note", "capture-note"],
  ["flag", "capture-note"],
  ["caveat", "capture-note"],
  ["known environment limitation", "capture-note"],
  ["playback note", "capture-note"],
  ["methods note", "capture-note"],
  ["pattern note", "capture-note"],
  ["note", "capture-note"],
];

interface QualifierRule {
  readonly pattern: RegExp;
  readonly qualifiers: readonly CreatorFieldQualifier[];
  /** Match the parenthetical only, when the base label would otherwise trigger the rule itself. */
  readonly scope?: "qualifier";
}

const QUALIFIER_RULES: readonly QualifierRule[] = [
  { pattern: /\bverbatim\b/, qualifiers: ["verbatim"] },
  // Scoped to the parenthetical: a hook labelled "(verbatim, transcript)" was read off a
  // transcript, but the base label "Full transcript" says nothing about where the hook came from.
  { pattern: /\btranscripts?\b|\bcaptions?\b/, qualifiers: ["from-transcript"], scope: "qualifier" },
  { pattern: /auto-generated captions|auto-caption|auto caption/, qualifiers: ["auto-captions"] },
  // "no native punctuation" and "no English captions" are the opposite claim, so the negative
  // lookbehind matters: only an unqualified mention means the creator supplied the captions.
  { pattern: /\bcreator-provided\b|(?<!no )\benglish captions\b/, qualifiers: ["creator-captions"] },
  { pattern: /paywall|paid-subscriber|gated|upgrade|subscription-offer/, qualifiers: ["paywalled", "partial"] },
  { pattern: /free preview|public portion|everything visible before|ends where|ends at|cuts in|cuts off|of the visible portion|on-post teaser copy/, qualifiers: ["partial"] },
  { pattern: /\bexcerpt\b/, qualifiers: ["excerpt", "partial"] },
  // The "or ... note" form often contains its own parentheses ("None (music/dance...)"), so the
  // gap between "or" and "note" must be allowed to cross them, bounded to stay cheap.
  { pattern: /\bor\b[\s\S]{0,120}?\bnote\b|if any|if applicable|if image post|if genuinely unavailable/, qualifiers: ["conditional-absence"] },
  { pattern: /visual description|mostly wordless|text card|on-screen caption/, qualifiers: ["visual-only"] },
  { pattern: /wordless|music\/dance|none \(/, qualifiers: ["no-spoken-audio"] },
  // The corpus marks a repost several ways: "X's words", "X's post", "authored by X", "reposted
  // by X", "not X's". All of them mean the account owner did not write it.
  { pattern: /['’]s (?:words|post|writing|content|thread)\b|\bnot [a-z]+['’]s\b|\bauthored by\b|\breposted by\b|\bguest[- ]authored\b/, qualifiers: ["third-party-authored"] },
  { pattern: /\ball \d+ segments\b|\bsegment\b/, qualifiers: ["segmented"] },
  { pattern: /stylized/, qualifiers: ["stylized"] },
  { pattern: /age-restricted|requires sign-in/, qualifiers: ["restricted"] },
  { pattern: /unavailable|not captured|never populated/, qualifiers: ["unavailable"] },
];

// Values the corpus uses to say "there was nothing here", written honestly instead of fabricated.
const ABSENT_VALUE = /^(none|n\/a|not captured|not available|not verified|not determined|not assessed|not visible|not shown|not displayed|not applicable|not retrievable|not accessible|unavailable|transcript unavailable|no transcript|no captions|no english captions|could not)\b/i;
const PARTIAL_VALUE = /paywall|free preview|cuts off|truncat|partial|only the visible/i;

/** The persisted ceiling on a field label. Long enough for every real spelling in the corpus. */
export const MAX_PERSISTED_LABEL_LENGTH = 160;

/**
 * Field labels are the research pass's own metadata, not creator copy, so they are kept verbatim.
 * They are still bounded: a label is a place a long qualifier could sit, and nothing about a label
 * needs 300 characters to be recognizable.
 */
function boundLabel(rawLabel: string): string {
  if (rawLabel.length <= MAX_PERSISTED_LABEL_LENGTH) return rawLabel;
  return `${rawLabel.slice(0, MAX_PERSISTED_LABEL_LENGTH)} (truncated)`;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Split `Full text (verbatim, ends at the paywall gate)` into base label and qualifier text. */
export function splitFieldLabel(rawLabel: string): { readonly base: string; readonly qualifier: string } {
  const normalized = rawLabel.trim();
  const open = normalized.indexOf(" (");
  if (open === -1) return { base: normalizeLabel(normalized), qualifier: "" };
  return {
    base: normalizeLabel(normalized.slice(0, open)),
    qualifier: normalized.slice(open + 2).replace(/\)\s*$/, "").toLowerCase(),
  };
}

export function classifyFieldLabel(rawLabel: string): {
  readonly kind: CreatorFieldKind;
  readonly qualifiers: readonly CreatorFieldQualifier[];
} {
  const { base, qualifier } = splitFieldLabel(rawLabel);
  const whole = `${base} ${qualifier}`.trim();
  let kind: CreatorFieldKind = "unrecognized";
  for (const [prefix, candidate] of KIND_BY_BASE_LABEL) {
    if (base === prefix || base.startsWith(`${prefix} `) || base.startsWith(`${prefix}/`)) {
      kind = candidate;
      break;
    }
  }
  const qualifiers = new Set<CreatorFieldQualifier>();
  for (const rule of QUALIFIER_RULES) {
    if (rule.pattern.test(rule.scope === "qualifier" ? qualifier : whole)) {
      for (const flag of rule.qualifiers) qualifiers.add(flag);
    }
  }
  return { kind, qualifiers: [...qualifiers].sort(compareText) };
}

// ---------------------------------------------------------------------------
// Parsed shapes
// ---------------------------------------------------------------------------

export interface ParsedField {
  /** The label exactly as the corpus spells it. Metadata, never creator copy. */
  readonly rawLabel: string;
  readonly kind: CreatorFieldKind;
  readonly qualifiers: readonly CreatorFieldQualifier[];
  readonly presence: CreatorFieldPresence;
  readonly lineNumber: number;
  /** Size of the field's value, so coverage can distinguish a stub from real evidence. */
  readonly characterCount: number;
  /** How many blockquote lines followed the label. Most verbatim evidence lives in those. */
  readonly quotedLineCount: number;
  /** How many plain lines followed it, up to the next field label. Two files write bodies unquoted. */
  readonly unquotedLineCount: number;
}

export interface ParsedMetricValue {
  readonly metric: string;
  readonly count: number;
}

export interface ParsedMetrics {
  readonly available: boolean;
  readonly values: readonly ParsedMetricValue[];
  /** Value used bare positional numbers (`819 / 25 / 61`) with no metric names attached. */
  readonly positionalOnly: boolean;
  /** Metrics were reported per thread segment rather than for one whole item. */
  readonly segmented: boolean;
  /** At least one comma-separated token carried no readable number. */
  readonly unparsedTokens: number;
}

export type EntryEvidenceKind =
  | "text"
  | "long-form-text"
  | "image"
  | "short-video"
  | "long-video"
  | "unknown";

export interface ParsedEntryFlags {
  readonly paywalled: boolean;
  readonly partialCapture: boolean;
  readonly transcriptExpected: boolean;
  readonly transcriptFieldPresent: boolean;
  readonly transcriptAvailable: boolean;
  readonly visualOnlyHook: boolean;
  readonly thirdPartyAuthored: boolean;
  readonly segmentedThread: boolean;
  readonly autoCaptions: boolean;
  readonly restricted: boolean;
}

export interface ParsedEntry {
  /** File basename, e.g. `colin-percival.md`. */
  readonly file: string;
  /** Stable, body-free source reference used by every downstream artifact. */
  readonly ref: string;
  readonly sectionIndex: number;
  readonly sectionSlug: string;
  readonly entryNumber: number;
  readonly lineNumber: number;
  readonly hasLink: boolean;
  /** ISO date when the heading's parenthetical carried a full one, else null. */
  readonly date: string | null;
  readonly datePrecision: DatePrecision;
  readonly dateApproximate: boolean;
  readonly fields: readonly ParsedField[];
  readonly fieldKinds: readonly CreatorFieldKind[];
  readonly unrecognizedLabelCount: number;
  readonly metrics: ParsedMetrics;
  readonly evidenceKind: EntryEvidenceKind;
  readonly flags: ParsedEntryFlags;
}

export interface ParsedAnomaly {
  readonly file: string;
  readonly lineNumber: number;
  readonly kind:
    | "body-embedded-heading"
    | "unrecognized-field-label"
    | "claimed-count-mismatch"
    | "missing-header-field"
    | "no-entries"
    | "unparsable-metrics"
    | "unparsable-date";
  readonly detail: string;
}

export interface ParsedCreatorFile {
  readonly file: string;
  readonly creatorSlug: string;
  /** Header block written by the research pass, not by the creator. */
  readonly header: {
    readonly handle: string | null;
    readonly platformLabel: string | null;
    readonly platform: string | null;
    readonly mediaTypeLabel: string | null;
    readonly audienceSizeLabel: string | null;
    readonly topicsLabel: string | null;
    readonly captureMethodLabel: string | null;
    readonly postsCapturedLabel: string | null;
  };
  readonly claimedCaptured: number | null;
  readonly claimedTarget: number | null;
  readonly claimedPairs: readonly (readonly [number, number])[];
  readonly captureNoteLabels: readonly string[];
  readonly sectionSlugs: readonly string[];
  readonly entries: readonly ParsedEntry[];
  readonly anomalies: readonly ParsedAnomaly[];
  readonly lineCount: number;
  readonly byteLength: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const HEADER_FIELD = /^\*\*(.+?):\*\*\s?(.*)$/;
const SECTION_HEADING = /^##\s+(.*)$/;
const ENTRY_HEADING = /^###\s+(\d+)\.\s+(.*)$/;
const ANY_HEADING = /^#{1,6}\s/;
const BLOCKQUOTE = /^>/;

// A `### N. ` line is only an entry when a recognized entry field follows it before the next
// heading. Several files embed the creator's own numbered subheadings inside a verbatim body
// (Dev.to long-form posts especially), and those look identical until you check for a field.
const ENTRY_FIELD_GATE = new Set<CreatorFieldKind>([
  "metrics", "hook", "body", "transcript", "caption", "on-screen-text", "image-text",
  "visual-description", "thumbnail-description", "structure", "structure-map", "framing",
  "teaser", "summary", "description", "access", "duration", "byline", "linked-url", "link-card",
  "status", "format", "entry-metadata",
]);

const HEADER_KEYS: ReadonlyArray<readonly [string, keyof ParsedCreatorFile["header"]]> = [
  ["handle", "handle"],
  ["primary platform", "platformLabel"],
  ["primary media type", "mediaTypeLabel"],
  ["audience size", "audienceSizeLabel"],
  ["topic(s)", "topicsLabel"],
  ["capture method", "captureMethodLabel"],
  ["posts captured", "postsCapturedLabel"],
];

// Only the account-bearing surfaces the repo already knows about. Anything else stays honest as
// null plus the raw label, rather than being forced into a bucket.
const PLATFORM_BY_LABEL: ReadonlyArray<readonly [RegExp, string]> = [
  [/^hacker news/, "hackernews"],
  [/^dev\.to/, "devto"],
  [/^substack \(notes \+ newsletter\)|^substack \(posts \+ notes\)/, "substack"],
  [/^substack notes/, "substack-notes"],
  [/^substack/, "substack"],
  [/^linkedin/, "linkedin"],
  [/^mastodon/, "mastodon"],
  [/^threads/, "threads"],
  [/^bluesky/, "bluesky"],
  [/^tiktok/, "tiktok"],
  [/^youtube/, "youtube"],
  [/^instagram/, "instagram"],
  [/^pinterest/, "pinterest"],
  [/^reddit/, "reddit"],
  [/^x\b|^x$|^x \(/, "x"],
];

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const MONTH_NAMES = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/** How precisely the heading dated the item. "relative" means the platform only showed "3 years ago". */
export type DatePrecision = "day" | "month" | "year" | "relative" | "source-undated" | "none";

export interface ParsedHeadingDate {
  readonly date: string | null;
  readonly precision: DatePrecision;
  readonly approximate: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthNumber(name: string): number | undefined {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** A date the source published is still only a date if it exists. 2024-13-40 is a typo, not a day. */
function calendarDay(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!;
  if (day < 1 || day > limit) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Read the heading's date parentheticals and keep nothing else. The corpus dates items in every
 * form the source platform showed: ISO, US slashes, spelled months with or without a year,
 * approximations the capture agent marked with `~`, relative "3 years ago" strings LinkedIn and
 * YouTube render instead of a date, and explicit "not shown" for platforms that publish none.
 * Each of those is a different evidence quality, so none of them is silently upgraded.
 */
export function parseHeadingDate(heading: string): ParsedHeadingDate {
  const withoutLink = heading.replace(/\[link\]\([^)]*\)/g, " ");
  const parentheticals = (withoutLink.match(/\(([^)]*)\)/g) ?? []).map((raw) => raw.slice(1, -1));
  for (const inner of parentheticals) {
    const text = inner.replace(/\s+/g, " ").trim();
    const approximate = /~|approx|approximate|\blate\b|\bmid-|\bearly\b/i.test(text);
    const iso = new RegExp("(\\d{4})-(\\d{1,2})-(\\d{1,2})").exec(text);
    if (iso) {
      const date = calendarDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
      if (date) return { date, precision: "day", approximate };
    }
    const slash = new RegExp("\\b(\\d{1,2})/(\\d{1,2})/(\\d{2}|\\d{4})\\b").exec(text);
    if (slash) {
      const year = slash[3]!.length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
      const date = calendarDay(year, Number(slash[1]), Number(slash[2]));
      if (date) return { date, precision: "day", approximate };
    }
    const named = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})\\b`, "i").exec(text);
    if (named) {
      const month = monthNumber(named[1]!);
      const date = month === undefined ? null : calendarDay(Number(named[3]), month, Number(named[2]));
      if (date) return { date, precision: "day", approximate };
    }
    const shortYear = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*'(\\d{2})\\b`, "i").exec(text);
    if (shortYear) {
      const month = monthNumber(shortYear[1]!);
      const date = month === undefined ? null : calendarDay(2000 + Number(shortYear[3]), month, Number(shortYear[2]));
      if (date) return { date, precision: "day", approximate };
    }
    const monthYear = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?\\s+(\\d{4})\\b`, "i").exec(text);
    if (monthYear) {
      const month = monthNumber(monthYear[1]!);
      if (month !== undefined) return { date: `${monthYear[2]}-${pad(month)}`, precision: "month", approximate };
    }
    const isoMonth = new RegExp("(\\d{4})-(\\d{1,2})(?![\\d-])").exec(text);
    if (isoMonth && Number(isoMonth[2]) >= 1 && Number(isoMonth[2]) <= 12) {
      return { date: `${isoMonth[1]}-${pad(Number(isoMonth[2]))}`, precision: "month", approximate };
    }
    const dayNoYear = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i").exec(text);
    if (dayNoYear) {
      const month = monthNumber(dayNoYear[1]!);
      if (month !== undefined) return { date: null, precision: "month", approximate };
    }
    // Platforms that never render an absolute date: LinkedIn/YouTube "3 years ago", Threads "19h",
    // X "13h before capture". Relative is a real answer, not a missing one, but it is not a date.
    if (new RegExp("\\b\\d+\\s*(years?|months?|weeks?|days?|hours?|minutes?|mo|y|w|d|h|m)\\b\\s*(ago|before)\\b", "i").test(text)) {
      return { date: null, precision: "relative", approximate };
    }
    if (new RegExp("^\\d+\\s*(mo|y|w|d|h|m)$", "i").test(text)) {
      return { date: null, precision: "relative", approximate };
    }
    // TikTok grid dates render as bare month-day with no year.
    const monthDay = new RegExp("^(\\d{1,2})-(\\d{1,2})$").exec(text);
    if (monthDay && Number(monthDay[1]) <= 12 && Number(monthDay[2]) <= 31) {
      return { date: null, precision: "month", approximate };
    }
    if (new RegExp("^(\\d{4})$").test(text)) return { date: `${text}`, precision: "year", approximate };
    if (/not shown|not displayed|no date|undated|date not/i.test(text)) {
      return { date: null, precision: "source-undated", approximate: false };
    }
  }
  return { date: null, precision: "none", approximate: false };
}

const SCALE: Readonly<Record<string, number>> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

// Metric lists separate their entries with a comma, a semicolon or a middle dot, and their NUMBERS
// separate thousands with a comma too. Splitting on every comma turns "949,260,655 views" into
// "655 views", so a comma only separates entries when it is not sitting between two digits.
function splitMetricTokens(value: string): string[] {
  return value
    .split(/[;·]|(?<!\d),|,(?!\d)/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Read a metrics value into named counts. Shapes in the corpus: `1.6K likes, 193 replies`,
 * `949,260,655 views; 20,111,082 likes`, `12 reactions \u00b7 3 comments`, Hacker News's
 * `Points/comments: 1275, 265` (names live in the label, not the value), and Substack's bare
 * `819 / 25 / 61`. Counts stay in the units the platform showed; nothing is inferred when the
 * platform showed nothing.
 */
export function parseMetricsValue(value: string, labelNames: readonly string[] = []): ParsedMetrics {
  const trimmed = value.trim();
  if (!trimmed) return { available: false, values: [], positionalOnly: false, segmented: false, unparsedTokens: 0 };
  const segmented = /\bsegment\b/i.test(trimmed);
  const withoutParens = trimmed.replace(/\([^)]*\)/g, " ").trim();
  if (ABSENT_VALUE.test(withoutParens) || ABSENT_VALUE.test(trimmed)) {
    return { available: false, values: [], positionalOnly: false, segmented, unparsedTokens: 0 };
  }
  // A bare number list: either the label named the metrics ("Points/comments"), or nothing did.
  // A compact list ("1275,265") is indistinguishable from a thousands separator on shape alone, so
  // it counts as a list only when the label names exactly that many metrics AND at least one group
  // is not three digits, which a thousands group after the first always is.
  const compact = /^[\d,]+$/.test(withoutParens) ? withoutParens.split(",").map((part) => part.trim()) : [];
  // A thousands-separated number has a leading group of one to three digits and every later group
  // of exactly three. A comma list that cannot be read that way is a list.
  const readsAsOneNumber = compact.length > 0
    && compact[0]!.length >= 1 && compact[0]!.length <= 3
    && compact.slice(1).every((group) => group.length === 3);
  const compactIsList = labelNames.length > 1 && compact.length === labelNames.length && !readsAsOneNumber;
  const bare = compactIsList
    ? compact
    : splitMetricTokens(withoutParens).flatMap((token) => token.split("/")).map((token) => token.trim()).filter(Boolean);
  if (bare.length > 1 && bare.every((token) => /^[\d][\d,]*$/.test(token))) {
    const named = labelNames.length === bare.length;
    return {
      available: true,
      positionalOnly: !named,
      segmented,
      unparsedTokens: 0,
      values: bare
        .map((token, index) => ({
          metric: named ? labelNames[index]! : `positional-${index + 1}`,
          count: Number(token.replace(/,/g, "")),
        }))
        .sort((left, right) => compareText(left.metric, right.metric)),
    };
  }
  const values: ParsedMetricValue[] = [];
  let unparsedTokens = 0;
  for (const cleaned of splitMetricTokens(withoutParens)) {
    const match = /^([\d][\d,]*(?:\.\d+)?)\s*([KMB])?\s+(.+)$/i.exec(cleaned);
    if (!match) {
      unparsedTokens += 1;
      continue;
    }
    const scale = match[2] ? SCALE[match[2].toLowerCase()]! : 1;
    const metric = match[3]!.trim().toLowerCase().replace(/[^a-z0-9/ -]/g, "").replace(/\s+/g, "-");
    if (!metric) {
      unparsedTokens += 1;
      continue;
    }
    values.push({ metric, count: Math.round(Number(match[1]!.replace(/,/g, "")) * scale) });
  }
  values.sort((left, right) => compareText(left.metric, right.metric));
  return { available: values.length > 0, values, positionalOnly: false, segmented, unparsedTokens };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "section";
}

/**
 * Decide whether a field carried evidence. The corpus writes an honest absence INSIDE the field
 * rather than omitting it: a blockquote reading "Transcript unavailable ...", "Not captured ...",
 * "None (wordless clip)", "Not verified ...", or a structure note saying it cannot be assessed
 * without a transcript. Counting those as present is the difference between 474 retrieved
 * transcripts and a false 625, so the first line of the value is what decides.
 */
function presenceFor(
  qualifiers: readonly CreatorFieldQualifier[],
  value: string,
  firstValueLine: string,
  valueLineCount: number,
): CreatorFieldPresence {
  const inline = value.trim();
  const lead = (inline || firstValueLine).trim();
  if (!lead && valueLineCount === 0) return "absent";
  if (ABSENT_VALUE.test(lead)) return "absent";
  if (valueLineCount === 0 && lead.length <= 2) return "absent";
  if (qualifiers.includes("paywalled") || qualifiers.includes("partial") || qualifiers.includes("excerpt")) return "partial";
  if (PARTIAL_VALUE.test(lead)) return "partial";
  return "present";
}

function evidenceKindFor(
  mediaTypeLabel: string | null,
  kinds: ReadonlySet<CreatorFieldKind>,
  metrics: ParsedMetrics,
): EntryEvidenceKind {
  const media = (mediaTypeLabel ?? "").toLowerCase();
  const hasTranscript = kinds.has("transcript");
  const hasViews = metrics.values.some((value) => value.metric.includes("view"));
  const mentionsVideo = /video|reel/.test(media);
  const mentionsImage = /image|pin\b|pins|carousel|comic|photo/.test(media);
  // A video the account calls a video stays a video even when the only evidence captured is a
  // visual description: some platforms return no transcript at all. Only an account that publishes
  // BOTH images and video is ambiguous enough to be decided by the fields alone.
  const videoKind = (): EntryEvidenceKind => {
    if (/short|reel|tiktok/.test(media)) return "short-video";
    if (/long/.test(media) || kinds.has("duration") || hasViews) return "long-video";
    return "short-video";
  };
  if (hasTranscript || kinds.has("thumbnail-description")) {
    if (/short|reel|tiktok/.test(media)) return "short-video";
    if (/long/.test(media)) return "long-video";
    return kinds.has("duration") || hasViews ? "long-video" : "short-video";
  }
  if (mentionsVideo && !mentionsImage) return videoKind();
  if (kinds.has("image-text") || kinds.has("visual-description")) return "image";
  if (kinds.has("body")) return /long-form|long form/.test(media) ? "long-form-text" : "text";
  if (kinds.has("caption") || kinds.has("on-screen-text")) return mentionsVideo ? "short-video" : "image";
  return "unknown";
}

function parseClaimedPairs(label: string | null): (readonly [number, number])[] {
  if (!label) return [];
  const pairs: (readonly [number, number])[] = [];
  for (const match of label.matchAll(/(\d+)\s*\/\s*(\d+)/g)) {
    pairs.push([Number(match[1]), Number(match[2])] as const);
  }
  return pairs;
}

export function parseCreatorFile(file: string, text: string): ParsedCreatorFile {
  if (typeof file !== "string" || !file.trim()) fail("file name must be a non-empty string");
  if (typeof text !== "string") fail(`${file}: content must be a string`);
  const lines = text.split(/\r?\n/);
  const anomalies: ParsedAnomaly[] = [];
  const header: Record<string, string | null> = {
    handle: null, platformLabel: null, mediaTypeLabel: null, audienceSizeLabel: null,
    topicsLabel: null, captureMethodLabel: null, postsCapturedLabel: null,
  };
  const captureNoteLabels: string[] = [];
  const sectionSlugs: string[] = [];

  // Pass 1: header block (everything before the first `## `), then section + entry boundaries.
  let firstSection = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    if (SECTION_HEADING.test(lines[index]!)) { firstSection = index; break; }
  }
  for (let index = 0; index < firstSection; index += 1) {
    const match = HEADER_FIELD.exec(lines[index]!);
    if (!match) continue;
    const base = normalizeLabel(splitFieldLabel(match[1]!).base);
    const key = HEADER_KEYS.find(([label]) => base === label || base.startsWith(`${label} `));
    if (key) header[key[1]] = match[2]!.trim() || null;
    else captureNoteLabels.push(match[1]!.trim());
  }
  for (const [label, key] of HEADER_KEYS) {
    if (header[key] === null) {
      anomalies.push({ file, lineNumber: 1, kind: "missing-header-field", detail: `header field "${label}" is absent` });
    }
  }

  interface Boundary { readonly line: number; readonly number: number; readonly section: number; readonly heading: string }
  const boundaries: Boundary[] = [];
  let sectionIndex = -1;
  let previousNumber = 0;
  let sectionStarted = true;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const section = SECTION_HEADING.exec(line);
    if (section) {
      sectionIndex += 1;
      sectionSlugs.push(slugify(section[1]!));
      sectionStarted = true;
      continue;
    }
    const entry = ENTRY_HEADING.exec(line);
    if (!entry) continue;
    const number = Number(entry[1]);
    let gated = false;
    for (let scan = index + 1; scan < lines.length; scan += 1) {
      if (ANY_HEADING.test(lines[scan]!)) break;
      const field = HEADER_FIELD.exec(lines[scan]!);
      if (!field) continue;
      if (ENTRY_FIELD_GATE.has(classifyFieldLabel(field[1]!).kind)) { gated = true; break; }
    }
    const sequential = number === previousNumber + 1 || (number === 1 && sectionStarted);
    if (gated && sequential) {
      boundaries.push({ line: index, number, section: Math.max(sectionIndex, 0), heading: entry[2]! });
      previousNumber = number;
      sectionStarted = false;
    } else {
      anomalies.push({
        file,
        lineNumber: index + 1,
        kind: "body-embedded-heading",
        detail: `"### ${number}." is not an entry (recognized field follows: ${gated}; sequential: ${sequential})`,
      });
    }
  }

  // Pass 2: fields inside each entry.
  const entries: ParsedEntry[] = [];
  for (let position = 0; position < boundaries.length; position += 1) {
    const boundary = boundaries[position]!;
    const end = position + 1 < boundaries.length ? boundaries[position + 1]!.line : lines.length;
    const fields: ParsedField[] = [];
    let unrecognizedLabelCount = 0;
    let metrics: ParsedMetrics = { available: false, values: [], positionalOnly: false, segmented: false, unparsedTokens: 0 };
    let sawMetricsField = false;
    for (let index = boundary.line + 1; index < end; index += 1) {
      const match = HEADER_FIELD.exec(lines[index]!);
      if (!match) continue;
      const rawLabel = match[1]!.trim();
      const value = match[2]!;
      const { kind, qualifiers } = classifyFieldLabel(rawLabel);
      // A field's value runs until the next field label, or the end of the entry. Most of the
      // corpus blockquotes its verbatim evidence, but two files present a full post as plain
      // Markdown, sometimes opening with the creator's own heading. Stopping at the first
      // unquoted line, or at any heading, would read a present body as an absent one.
      let quotedLineCount = 0;
      let unquotedLineCount = 0;
      let firstValueLine = "";
      for (let scan = index + 1; scan < end; scan += 1) {
        const next = lines[scan]!;
        if (HEADER_FIELD.test(next)) break;
        if (!next.trim()) continue;
        if (BLOCKQUOTE.test(next)) quotedLineCount += 1;
        else unquotedLineCount += 1;
        if (!firstValueLine) firstValueLine = next.replace(/^>\s?/, "").trim();
      }
      if (kind === "unrecognized") {
        // A bold label the taxonomy does not know is almost always the creator's own body copy
        // (long-form posts carry their own bolded subheads). Record that it happened and where,
        // never what it said, so the report stays body-free and a human can still go look.
        unrecognizedLabelCount += 1;
        anomalies.push({
          file,
          lineNumber: index + 1,
          kind: "unrecognized-field-label",
          detail: `bold label outside the field taxonomy (${rawLabel.length} characters, redacted)`,
        });
      }
      if (kind === "metrics") {
        sawMetricsField = true;
        metrics = parseMetricsValue(value, splitFieldLabel(rawLabel).base.split("/").map((part) => part.trim()).filter(Boolean));
        if (metrics.unparsedTokens > 0) {
          // Even one unreadable token matters: the entry's metric set is incomplete, and an
          // incomplete set must not quietly support a "metric-backed" claim downstream.
          anomalies.push({
            file,
            lineNumber: index + 1,
            kind: "unparsable-metrics",
            detail: `${metrics.unparsedTokens} unreadable metric token(s); the recorded counts are incomplete`,
          });
        }
      }
      fields.push({
        rawLabel: kind === "unrecognized" ? "(redacted: outside field taxonomy)" : boundLabel(rawLabel),
        kind,
        qualifiers,
        presence: presenceFor(qualifiers, value, firstValueLine, quotedLineCount + unquotedLineCount),
        lineNumber: index + 1,
        characterCount: value.trim().length,
        quotedLineCount,
        unquotedLineCount,
      });
    }
    const kinds = new Set(fields.map((field) => field.kind));
    const allQualifiers = new Set(fields.flatMap((field) => field.qualifiers));
    const transcriptFields = fields.filter((field) => field.kind === "transcript");
    const hookFields = fields.filter((field) => field.kind === "hook");
    const { date, precision, approximate } = parseHeadingDate(boundary.heading);
    if (precision === "none") {
      anomalies.push({ file, lineNumber: boundary.line + 1, kind: "unparsable-date", detail: `entry ${boundary.number} heading carries no readable date` });
    }
    if (!sawMetricsField) {
      anomalies.push({ file, lineNumber: boundary.line + 1, kind: "unparsable-metrics", detail: `entry ${boundary.number} has no metrics field` });
    }
    const evidenceKind = evidenceKindFor(header.mediaTypeLabel, kinds, metrics);
    entries.push({
      file,
      ref: `${file}#entry-${boundary.section + 1}-${boundary.number}`,
      sectionIndex: boundary.section,
      sectionSlug: sectionSlugs[boundary.section] ?? "posts",
      entryNumber: boundary.number,
      lineNumber: boundary.line + 1,
      hasLink: /\[link\]\(/.test(boundary.heading),
      date,
      datePrecision: precision,
      dateApproximate: approximate,
      fields,
      fieldKinds: [...kinds].sort(compareText),
      unrecognizedLabelCount,
      metrics,
      evidenceKind,
      flags: {
        paywalled: allQualifiers.has("paywalled"),
        partialCapture: fields.some((field) => field.presence === "partial"),
        transcriptExpected: evidenceKind === "short-video" || evidenceKind === "long-video",
        transcriptFieldPresent: transcriptFields.length > 0,
        transcriptAvailable: transcriptFields.some((field) => field.presence !== "absent"),
        visualOnlyHook: hookFields.length > 0 && hookFields.every((field) => field.qualifiers.includes("visual-only")),
        thirdPartyAuthored: allQualifiers.has("third-party-authored"),
        segmentedThread: metrics.segmented || allQualifiers.has("segmented"),
        autoCaptions: allQualifiers.has("auto-captions"),
        restricted: allQualifiers.has("restricted"),
      },
    });
  }

  if (entries.length === 0) {
    anomalies.push({ file, lineNumber: 1, kind: "no-entries", detail: "file records zero captured entries" });
  }
  const claimedPairs = parseClaimedPairs(header.postsCapturedLabel);
  const claimedCaptured = claimedPairs.length > 0 ? claimedPairs[0]![0] : null;
  const claimedTarget = claimedPairs.length > 0 ? claimedPairs[0]![1] : null;
  const claimedSum = claimedPairs.reduce((total, pair) => total + pair[0], 0);
  if (claimedPairs.length > 0 && entries.length !== claimedCaptured && entries.length !== claimedSum) {
    anomalies.push({
      file,
      lineNumber: 1,
      kind: "claimed-count-mismatch",
      detail: `file claims ${claimedPairs.map((pair) => `${pair[0]}/${pair[1]}`).join(" + ")} but ${entries.length} entries parse`,
    });
  }

  const platformLabel = (header.platformLabel ?? "").toLowerCase();
  const platform = PLATFORM_BY_LABEL.find(([pattern]) => pattern.test(platformLabel))?.[1] ?? null;

  return {
    file,
    creatorSlug: file.replace(/\.md$/, ""),
    header: {
      handle: header.handle,
      platformLabel: header.platformLabel,
      platform,
      mediaTypeLabel: header.mediaTypeLabel,
      audienceSizeLabel: header.audienceSizeLabel,
      topicsLabel: header.topicsLabel,
      captureMethodLabel: header.captureMethodLabel,
      postsCapturedLabel: header.postsCapturedLabel,
    },
    claimedCaptured,
    claimedTarget,
    claimedPairs,
    captureNoteLabels: [...new Set(captureNoteLabels)].sort(compareText),
    sectionSlugs,
    entries,
    anomalies,
    lineCount: lines.length,
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}

// ---------------------------------------------------------------------------
// Index reconciliation
// ---------------------------------------------------------------------------

export interface IndexRow {
  readonly lineNumber: number;
  readonly section: string;
  readonly creatorLabel: string;
  readonly file: string | null;
  readonly itemsCapturedLabel: string;
  readonly claimedPairs: readonly (readonly [number, number])[];
}

export interface IndexReconciliation {
  readonly rows: readonly IndexRow[];
  readonly declaredCapturedCount: number | null;
  readonly distinctLinkedFiles: number;
  readonly rowsWithoutFileLink: readonly string[];
  readonly duplicateLinkedFiles: readonly string[];
  readonly filesMissingFromIndex: readonly string[];
  readonly indexLinksToMissingFiles: readonly string[];
  readonly countMismatches: readonly { readonly file: string; readonly indexClaim: string; readonly actual: number }[];
}

export function parseCreatorContentIndex(text: string): readonly IndexRow[] {
  if (typeof text !== "string") fail("index content must be a string");
  const rows: IndexRow[] = [];
  let section = "";
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) { section = heading[1]!.trim(); continue; }
    if (!line.startsWith("|") || line.startsWith("| ---")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || cells[0] === "Creator") continue;
    const link = /\]\(creator-content\/([a-z0-9-]+\.md)\)/.exec(line);
    rows.push({
      lineNumber: index + 1,
      section,
      creatorLabel: cells[0]!,
      file: link ? link[1]! : null,
      itemsCapturedLabel: cells[5] ?? "",
      claimedPairs: parseClaimedPairs(cells[5] ?? ""),
    });
  }
  return rows;
}

export function reconcileIndex(indexText: string, files: readonly ParsedCreatorFile[]): IndexReconciliation {
  const rows = parseCreatorContentIndex(indexText);
  const declared = /\*\*Status as of this pass:\*\*\s*(\d+)\s+of the confirmed-fill roster/.exec(indexText);
  const linked = rows.filter((row) => row.file !== null).map((row) => row.file!);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const file of linked) {
    if (seen.has(file)) duplicates.add(file);
    seen.add(file);
  }
  const byFile = new Map(files.map((file) => [file.file, file] as const));
  const countMismatches: { file: string; indexClaim: string; actual: number }[] = [];
  for (const row of rows) {
    if (!row.file) continue;
    const parsed = byFile.get(row.file);
    if (!parsed) continue;
    if (row.claimedPairs.length === 0) continue;
    const first = row.claimedPairs[0]![0];
    const sum = row.claimedPairs.reduce((total, pair) => total + pair[0], 0);
    if (parsed.entries.length !== first && parsed.entries.length !== sum) {
      countMismatches.push({ file: row.file, indexClaim: row.itemsCapturedLabel, actual: parsed.entries.length });
    }
  }
  return {
    rows,
    declaredCapturedCount: declared ? Number(declared[1]) : null,
    distinctLinkedFiles: seen.size,
    rowsWithoutFileLink: rows.filter((row) => row.file === null).map((row) => `${row.section} / ${row.creatorLabel}`).sort(compareText),
    duplicateLinkedFiles: [...duplicates].sort(compareText),
    filesMissingFromIndex: files.map((file) => file.file).filter((file) => !seen.has(file)).sort(compareText),
    indexLinksToMissingFiles: [...seen].filter((file) => !byFile.has(file)).sort(compareText),
    countMismatches: countMismatches.sort((left, right) => compareText(left.file, right.file)),
  };
}

// ---------------------------------------------------------------------------
// Body-free corpus inventory
// ---------------------------------------------------------------------------
//
// The inventory is the artifact that leaves this module and gets staged for review. Every value
// in it is a count, a label the research pass wrote, a date, a flag, or a `file#entry-s-n`
// reference. Keys are snake_case because the staged JSON is read by a human and by the auditor,
// not by TypeScript.

/** Field kinds whose presence actually decides whether an entry can support a mechanism claim. */
export const COVERAGE_FIELD_KINDS = [
  "hook", "body", "transcript", "caption", "on-screen-text", "image-text", "visual-description",
  "thumbnail-description", "structure", "structure-map", "framing", "metrics", "teaser", "summary",
] as const;

export type CoverageFieldKind = (typeof COVERAGE_FIELD_KINDS)[number];

export interface FieldCoverage {
  readonly present: number;
  readonly partial: number;
  readonly absent: number;
  readonly missing: number;
}

export interface CaptureWindow {
  readonly earliest: string | null;
  readonly latest: string | null;
  readonly dated_day: number;
  readonly dated_month: number;
  readonly dated_year: number;
  readonly relative_only: number;
  readonly source_undated: number;
  readonly approximate: number;
}

export interface CreatorInventory {
  readonly creator_slug: string;
  readonly file: string;
  readonly platform: string | null;
  readonly platform_label: string | null;
  readonly media_type_label: string | null;
  readonly handle: string | null;
  readonly audience_size_label: string | null;
  readonly topics_label: string | null;
  readonly capture_method_label: string | null;
  readonly posts_captured_label: string | null;
  readonly claimed_captured: number | null;
  readonly claimed_target: number | null;
  readonly actual_entries: number;
  readonly capture_completeness: "complete" | "partial-window" | "blocked" | "unknown";
  readonly entries_by_evidence_kind: Readonly<Record<string, number>>;
  readonly field_coverage: Readonly<Record<CoverageFieldKind, FieldCoverage>>;
  readonly capture_window: CaptureWindow;
  readonly entries_with_source_link: number;
  readonly metrics_available_entries: number;
  readonly metrics_incomplete_entries: number;
  readonly metrics_positional_only_entries: number;
  readonly metric_names: readonly string[];
  readonly flag_counts: Readonly<Record<string, number>>;
  readonly capture_note_labels: readonly string[];
  readonly section_slugs: readonly string[];
  readonly anomaly_counts: Readonly<Record<string, number>>;
  readonly line_count: number;
  readonly byte_length: number;
}

export interface FieldVariant {
  readonly raw_label: string;
  readonly kind: CreatorFieldKind;
  readonly qualifiers: readonly CreatorFieldQualifier[];
  readonly occurrences: number;
  readonly files: number;
}

export interface CorpusInventory {
  readonly kind: "creator_corpus_inventory";
  readonly version: typeof CREATOR_CONTENT_NORMALIZATION_VERSION;
  readonly corpus_dir: typeof CREATOR_CONTENT_DIR;
  readonly index_path: typeof CREATOR_CONTENT_INDEX;
  readonly totals: {
    readonly files: number;
    readonly creators_with_entries: number;
    readonly creators_with_zero_entries: number;
    readonly entries: number;
    readonly entries_with_available_metrics: number;
    readonly entries_with_incomplete_metrics: number;
    readonly entries_with_a_source_link: number;
    readonly entries_paywalled: number;
    readonly entries_partial_capture: number;
    readonly entries_third_party_authored: number;
    readonly entries_segmented_thread: number;
    readonly entries_visual_only_hook: number;
    readonly transcript_expected: number;
    readonly transcript_field_present: number;
    readonly transcript_available: number;
    readonly tracked_bytes: number;
  };
  readonly entries_by_platform: Readonly<Record<string, number>>;
  readonly entries_by_evidence_kind: Readonly<Record<string, number>>;
  readonly field_coverage: Readonly<Record<CoverageFieldKind, FieldCoverage>>;
  readonly field_variants: readonly FieldVariant[];
  readonly creators: readonly CreatorInventory[];
  readonly index_reconciliation: {
    readonly index_rows: number;
    readonly distinct_linked_files: number;
    readonly declared_captured_count: number | null;
    readonly rows_without_file_link: readonly string[];
    readonly duplicate_linked_files: readonly string[];
    readonly files_missing_from_index: readonly string[];
    readonly index_links_to_missing_files: readonly string[];
    readonly per_file_count_mismatches: readonly { readonly file: string; readonly index_claim: string; readonly actual: number }[];
  };
  readonly anomalies: readonly { readonly file: string; readonly line: number; readonly kind: string; readonly detail: string }[];
  readonly anomaly_counts: Readonly<Record<string, number>>;
  readonly body_included: false;
  readonly verbatim_included: false;
  readonly generates_copy: false;
  readonly creator_body_copy_allowed: false;
}

function emptyCoverage(): Record<CoverageFieldKind, FieldCoverage> {
  const result = {} as Record<CoverageFieldKind, FieldCoverage>;
  for (const kind of COVERAGE_FIELD_KINDS) result[kind] = { present: 0, partial: 0, absent: 0, missing: 0 };
  return result;
}

function addCoverage(target: Record<CoverageFieldKind, FieldCoverage>, entry: ParsedEntry): void {
  for (const kind of COVERAGE_FIELD_KINDS) {
    const fields = entry.fields.filter((field) => field.kind === kind);
    const current = target[kind];
    if (fields.length === 0) { target[kind] = { ...current, missing: current.missing + 1 }; continue; }
    if (fields.some((field) => field.presence === "present")) { target[kind] = { ...current, present: current.present + 1 }; continue; }
    if (fields.some((field) => field.presence === "partial")) { target[kind] = { ...current, partial: current.partial + 1 }; continue; }
    target[kind] = { ...current, absent: current.absent + 1 };
  }
}

function tally(counts: Record<string, number>, key: string, amount = 1): void {
  counts[key] = (counts[key] ?? 0) + amount;
}

function sortedRecord(counts: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareText(left, right)));
}

function captureWindowFor(entries: readonly ParsedEntry[]): CaptureWindow {
  const dates = entries.map((entry) => entry.date).filter((date): date is string => date !== null).sort(compareText);
  return {
    earliest: dates[0] ?? null,
    latest: dates[dates.length - 1] ?? null,
    dated_day: entries.filter((entry) => entry.datePrecision === "day").length,
    dated_month: entries.filter((entry) => entry.datePrecision === "month").length,
    dated_year: entries.filter((entry) => entry.datePrecision === "year").length,
    relative_only: entries.filter((entry) => entry.datePrecision === "relative").length,
    source_undated: entries.filter((entry) => entry.datePrecision === "source-undated").length,
    approximate: entries.filter((entry) => entry.dateApproximate).length,
  };
}

/**
 * Completeness compares the entries that actually parse against the target the capture aimed at,
 * never against the file's own summary sentence. Later `n/m` pairs in that sentence are not always
 * a second stream: some report a sub-count of the same items (how many of 30 videos yielded a
 * transcript), so summing every pair would call a complete capture partial. Transcript retrieval
 * is reported separately, as its own coverage number.
 */
function completenessFor(file: ParsedCreatorFile): CreatorInventory["capture_completeness"] {
  if (file.entries.length === 0) return "blocked";
  if (file.claimedTarget === null) return "unknown";
  return file.entries.length >= file.claimedTarget ? "complete" : "partial-window";
}

export function buildCorpusInventory(
  files: readonly ParsedCreatorFile[],
  indexText: string,
): CorpusInventory {
  const ordered = [...files].sort((left, right) => compareText(left.file, right.file));
  const corpusCoverage = emptyCoverage();
  const byPlatform: Record<string, number> = {};
  const byEvidenceKind: Record<string, number> = {};
  const anomalyCounts: Record<string, number> = {};
  const variants = new Map<string, { kind: CreatorFieldKind; qualifiers: readonly CreatorFieldQualifier[]; occurrences: number; files: Set<string> }>();
  const anomalies: { file: string; line: number; kind: string; detail: string }[] = [];
  const creators: CreatorInventory[] = [];
  let entriesTotal = 0;

  for (const file of ordered) {
    const creatorCoverage = emptyCoverage();
    const flagCounts: Record<string, number> = {};
    const creatorAnomalies: Record<string, number> = {};
    const creatorEvidence: Record<string, number> = {};
    const metricNames = new Set<string>();
    let metricsAvailable = 0;
    let positionalOnly = 0;
    let incompleteMetrics = 0;

    for (const entry of file.entries) {
      entriesTotal += 1;
      addCoverage(corpusCoverage, entry);
      addCoverage(creatorCoverage, entry);
      tally(byPlatform, file.header.platform ?? "unmapped");
      tally(byEvidenceKind, entry.evidenceKind);
      tally(creatorEvidence, entry.evidenceKind);
      if (entry.metrics.available) metricsAvailable += 1;
      if (entry.metrics.positionalOnly) positionalOnly += 1;
      if (entry.metrics.unparsedTokens > 0) incompleteMetrics += 1;
      for (const value of entry.metrics.values) metricNames.add(value.metric);
      for (const [flag, on] of Object.entries(entry.flags)) if (on) tally(flagCounts, flag);
      for (const field of entry.fields) {
        if (field.kind === "unrecognized") continue;
        const existing = variants.get(field.rawLabel);
        if (existing) { existing.occurrences += 1; existing.files.add(file.file); continue; }
        variants.set(field.rawLabel, { kind: field.kind, qualifiers: field.qualifiers, occurrences: 1, files: new Set([file.file]) });
      }
    }
    for (const anomaly of file.anomalies) {
      tally(anomalyCounts, anomaly.kind);
      tally(creatorAnomalies, anomaly.kind);
      anomalies.push({ file: anomaly.file, line: anomaly.lineNumber, kind: anomaly.kind, detail: anomaly.detail });
    }

    creators.push({
      creator_slug: file.creatorSlug,
      file: file.file,
      platform: file.header.platform,
      platform_label: file.header.platformLabel,
      media_type_label: file.header.mediaTypeLabel,
      handle: file.header.handle,
      audience_size_label: file.header.audienceSizeLabel,
      topics_label: file.header.topicsLabel,
      capture_method_label: file.header.captureMethodLabel,
      posts_captured_label: file.header.postsCapturedLabel,
      claimed_captured: file.claimedCaptured,
      claimed_target: file.claimedTarget,
      actual_entries: file.entries.length,
      capture_completeness: completenessFor(file),
      entries_by_evidence_kind: sortedRecord(creatorEvidence),
      field_coverage: creatorCoverage,
      capture_window: captureWindowFor(file.entries),
      entries_with_source_link: file.entries.filter((entry) => entry.hasLink).length,
      metrics_available_entries: metricsAvailable,
      metrics_incomplete_entries: incompleteMetrics,
      metrics_positional_only_entries: positionalOnly,
      metric_names: [...metricNames].sort(compareText),
      flag_counts: sortedRecord(flagCounts),
      capture_note_labels: file.captureNoteLabels,
      section_slugs: file.sectionSlugs,
      anomaly_counts: sortedRecord(creatorAnomalies),
      line_count: file.lineCount,
      byte_length: file.byteLength,
    });
  }

  const allEntries = ordered.flatMap((file) => file.entries);
  const reconciliation = reconcileIndex(indexText, ordered);

  return {
    kind: "creator_corpus_inventory",
    version: CREATOR_CONTENT_NORMALIZATION_VERSION,
    corpus_dir: CREATOR_CONTENT_DIR,
    index_path: CREATOR_CONTENT_INDEX,
    totals: {
      files: ordered.length,
      creators_with_entries: ordered.filter((file) => file.entries.length > 0).length,
      creators_with_zero_entries: ordered.filter((file) => file.entries.length === 0).length,
      entries: entriesTotal,
      entries_with_available_metrics: allEntries.filter((entry) => entry.metrics.available).length,
      entries_with_incomplete_metrics: allEntries.filter((entry) => entry.metrics.unparsedTokens > 0).length,
      entries_with_a_source_link: allEntries.filter((entry) => entry.hasLink).length,
      entries_paywalled: allEntries.filter((entry) => entry.flags.paywalled).length,
      entries_partial_capture: allEntries.filter((entry) => entry.flags.partialCapture).length,
      entries_third_party_authored: allEntries.filter((entry) => entry.flags.thirdPartyAuthored).length,
      entries_segmented_thread: allEntries.filter((entry) => entry.flags.segmentedThread).length,
      entries_visual_only_hook: allEntries.filter((entry) => entry.flags.visualOnlyHook).length,
      transcript_expected: allEntries.filter((entry) => entry.flags.transcriptExpected).length,
      transcript_field_present: allEntries.filter((entry) => entry.flags.transcriptExpected && entry.flags.transcriptFieldPresent).length,
      transcript_available: allEntries.filter((entry) => entry.flags.transcriptExpected && entry.flags.transcriptAvailable).length,
      tracked_bytes: ordered.reduce((total, file) => total + file.byteLength, 0),
    },
    entries_by_platform: sortedRecord(byPlatform),
    entries_by_evidence_kind: sortedRecord(byEvidenceKind),
    field_coverage: corpusCoverage,
    field_variants: [...variants.entries()]
      .map(([raw_label, value]) => ({ raw_label, kind: value.kind, qualifiers: value.qualifiers, occurrences: value.occurrences, files: value.files.size }))
      .sort((left, right) => right.occurrences - left.occurrences || compareText(left.raw_label, right.raw_label)),
    creators,
    index_reconciliation: {
      index_rows: reconciliation.rows.length,
      distinct_linked_files: reconciliation.distinctLinkedFiles,
      declared_captured_count: reconciliation.declaredCapturedCount,
      rows_without_file_link: reconciliation.rowsWithoutFileLink,
      duplicate_linked_files: reconciliation.duplicateLinkedFiles,
      files_missing_from_index: reconciliation.filesMissingFromIndex,
      index_links_to_missing_files: reconciliation.indexLinksToMissingFiles,
      per_file_count_mismatches: reconciliation.countMismatches.map((row) => ({ file: row.file, index_claim: row.indexClaim, actual: row.actual })),
    },
    anomalies: anomalies.sort((left, right) => compareText(left.file, right.file) || left.line - right.line),
    anomaly_counts: sortedRecord(anomalyCounts),
    body_included: false,
    verbatim_included: false,
    generates_copy: false,
    creator_body_copy_allowed: false,
  };
}
