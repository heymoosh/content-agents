// Matching a draft to a frame.
//
// The bank ranks frames by evidence, which answers "which shapes do creators use" and says nothing
// about "which shape suits the thing I just wrote". Ranking by evidence alone hands back frames that
// fight the draft: an opener built on a reversed belief is useless against a post that never states
// one, and a credential opener is useless to a post with no credential in it.
//
// So fit is decided by material, not by taste. Each slot is read for what it demands (a duration, a
// role, a purchase, a question), the draft is scanned for that material, and a frame is only offered
// when the draft can actually supply what its slots need. Nothing here scores writing quality: the
// corpus cannot support that judgment, and this module does not pretend to make it.
//
// Spans come out of the draft verbatim, so a proposed opening is assembled from Muxin's own wording
// rather than composed. A slot with nothing to draw on stays an empty slot for her to fill.

export const HOOK_FRAME_FIT_VERSION = "hook-frame-fit-v1" as const;

/** What a slot demands of the draft. "generic" means the slot accepts anything, so it proves nothing. */
export type SlotSignal =
  | "duration"
  | "ongoing-state"
  | "belief-old"
  | "belief-new"
  | "role"
  | "proper-name"
  | "number"
  | "question"
  | "purchase"
  | "action-taken"
  | "frustration"
  | "shared-experience"
  | "generic";

export type FitVerdict = "fits" | "partial" | "no-fit" | "unverifiable";

export interface SlotEvidence {
  readonly slot: string;
  readonly signal: SlotSignal;
  /** Text lifted verbatim from the draft, or null when the draft offers nothing for this slot. */
  readonly span: string | null;
}

export interface FrameFit {
  readonly frameId: string;
  readonly verdict: FitVerdict;
  readonly slots: readonly SlotEvidence[];
  /** Slots demanding real material that the draft supplies. */
  readonly satisfied: number;
  /** Slots demanding real material that the draft does not supply. This is what rules a frame out. */
  readonly unmet: number;
  /** Slots accepting anything, so they neither help nor hurt. */
  readonly generic: number;
  /** The draft already opens in this shape, so applying the frame changes little. */
  readonly alreadyUsed: boolean;
}

// Slot names come from whatever proposed the frame, so they are matched on tokens rather than
// enumerated. An unrecognized name falls through to "generic" and is honestly reported as proving
// nothing, instead of being guessed at.
const SLOT_SIGNALS: ReadonlyArray<readonly [RegExp, SlotSignal]> = [
  [/timespan|duration|how_long|period/, "duration"],
  [/^state$|ongoing|doing/, "ongoing-state"],
  // Order matters: the two halves of a reversal are different material, and a frame that slots both
  // would otherwise print the old belief twice.
  [/new_|_now$|after|replacement/, "belief-new"],
  [/belief|assum|used_to|old_|former|thought/, "belief-old"],
  [/role|credential|title|job|profession/, "role"],
  [/^name$|person|guest|author|byline/, "proper-name"],
  [/number|percent|count|metric|follower/, "number"],
  [/question|challenge/, "question"],
  [/bought|purchase|price/, "purchase"],
  [/action|next_action|response/, "action-taken"],
  [/tired|frustrat|pain|problem/, "frustration"],
  [/experience|scenario|identity|audience/, "shared-experience"],
];

export function slotSignal(slot: string): SlotSignal {
  const name = slot.toLowerCase();
  for (const [pattern, signal] of SLOT_SIGNALS) if (pattern.test(name)) return signal;
  return "generic";
}

// Each detector returns the first verbatim span in the draft that supplies its material. Written to
// under-match rather than over-match: a false "the draft has this" would put a frame in front of
// Muxin that her draft cannot actually fill, which is the failure this module exists to prevent.
const DETECTORS: Readonly<Record<Exclude<SlotSignal, "generic">, RegExp>> = {
  // The quantity phrase only, with any leading preposition left out, because frames wrap the slot
  // themselves ("for {timespan} now"). A bare start date like "since 2024" states when something
  // began, not how long it ran, so it deliberately does NOT satisfy a duration slot: converting one
  // to the other would put a number in Muxin's mouth that her draft does not say.
  duration: /\b(?:for|over|in)\s+(?:the\s+)?(?:past\s+)?((?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:year|month|week|day|decade|hour)s?)\b|\b((?:a|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:year|month|week|day|decade)s?)\s+(?:ago|now)\b/i,
  // Stops before a duration cue. A frame that slots the state and the timespan separately would
  // otherwise take "writing on LinkedIn since 2024" for the state and repeat the date.
  "ongoing-state": /\bI(?:'ve|’ve|\s+have)\s+been\s+([a-z]+ing\b(?:(?!\s+(?:since|for|over)\b)[^.!?;]){0,60})/i,
  "belief-old": /\bI\s+(?:used\s+to\s+(?:think|believe|assume)|once\s+thought|thought|believed|assumed)\s+(?:that\s+)?([^.!?;]{3,90})/i,
  // Sentence-initial "Now", so a mid-sentence "now" does not get read as the turn. Everything after
  // it is kept, verb included: stripping "I see" out of "Now I see it as ..." leaves "Now it as ...".
  "belief-new": /(?:^|[.!?]\s+)Now,?\s+([^.!?;]{3,90})/,
  // A job title, not any noun phrase. Capped at three words and screened for the connectors that
  // mean the match ran on into ordinary prose ("as a list of things nobody decided").
  role: /\b(?:I(?:'m|’m|\s+am)\s+an?|my\s+expertise\s+as\s+an?|as\s+an?)\s+((?!list\b|lot\b|kind\b|sort\b|result\b)[a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})(?=[,.;!?]|\s+(?:and|who|that|with|but|for)\b)/i,
  "proper-name": /(?<=[a-z,]\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  number: /\b\d[\d,.]*\s*(?:%|k\b|m\b|billion|million|thousand|hundred)?/i,
  question: /([^.!?]{8,160}\?)/,
  purchase: /\bI\s+(?:just\s+)?(?:bought|purchased|paid\s+for|subscribed\s+to|signed\s+up\s+for)\b([^.!?;]{0,60})/i,
  "action-taken": /\b(?:so\s+I|and\s+then\s+I|which\s+is\s+why\s+I)\s+([a-z][^.!?;]{2,70})/i,
  frustration: /\b(?:got\s+tired\s+of|sick\s+of|fed\s+up\s+with|kept\s+(?:re)?[a-z]+ing)\b([^.!?;]{0,70})/i,
  // Stops at a comma as well as sentence punctuation, so the span is the experience itself rather
  // than the experience plus whatever clause followed it.
  "shared-experience": /\bif\s+you(?:'ve|’ve|\s+have)\s+ever\s+([^.!?;,]{3,90})|\byou\s+(?:have|are|keep|still)\s+([^.!?;,]{3,80})/i,
};

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
}

/** First verbatim span in the draft supplying this signal, or null. */
export function findSpan(draft: string, signal: SlotSignal): string | null {
  if (signal === "generic") return null;
  const match = DETECTORS[signal].exec(draft);
  if (match === null) return null;
  // Prefer the first capture group, which holds the material rather than the cue that found it.
  const captured = match.slice(1).find((group) => typeof group === "string" && group.trim().length > 0);
  const span = tidy(captured ?? match[0]!);
  return span.length === 0 ? null : span;
}

function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bi've\b/g, "i have")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bit's\b/g, "it is")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether the draft already opens in this frame's shape, judged by its fixed wording appearing in
 * the draft. A frame the draft already uses is not a suggestion worth making, so it is reported
 * rather than ranked up.
 */
export function alreadyUses(draft: string, fixedRunsOfTemplate: readonly (readonly string[])[]): boolean {
  const haystack = normalizeForCompare(draft);
  const runs = fixedRunsOfTemplate.filter((run) => run.length >= 3);
  if (runs.length === 0) return false;
  return runs.every((run) => haystack.includes(normalizeForCompare(run.join(" "))));
}

export interface FitInput {
  readonly frameId: string;
  readonly slots: readonly string[];
  readonly fixedRuns: readonly (readonly string[])[];
}

/** Score one frame against one draft. Pure material matching, never a quality judgment. */
export function fitFrame(draft: string, frame: FitInput): FrameFit {
  const slots = frame.slots.map((slot) => {
    const signal = slotSignal(slot);
    return { slot, signal, span: findSpan(draft, signal) };
  });
  const demanding = slots.filter((slot) => slot.signal !== "generic");
  const satisfied = demanding.filter((slot) => slot.span !== null).length;
  const unmet = demanding.length - satisfied;
  const generic = slots.length - demanding.length;
  const verdict: FitVerdict =
    demanding.length === 0 ? "unverifiable" : unmet === 0 ? "fits" : satisfied === 0 ? "no-fit" : "partial";
  return {
    frameId: frame.frameId,
    verdict,
    slots,
    satisfied,
    unmet,
    generic,
    alreadyUsed: alreadyUses(draft, frame.fixedRuns),
  };
}

/**
 * Assemble the opening from the draft's own spans.
 *
 * Only spans lifted verbatim from the draft are substituted. A slot with nothing to draw on is left
 * as `{slot}` rather than being written for her, because filling it would mean composing a claim in
 * her voice that her draft does not make.
 */
export function proposeOpening(template: string, fit: FrameFit): { text: string; unfilled: string[] } {
  const spans = new Map(fit.slots.map((slot) => [slot.slot, slot.span]));
  const unfilled: string[] = [];
  const text = template.replace(/\{([a-z][a-z0-9_]*)\}/g, (_match, name: string) => {
    const span = spans.get(name) ?? null;
    if (span === null) {
      unfilled.push(name);
      return `{${name}}`;
    }
    return span;
  });
  return { text, unfilled: [...new Set(unfilled)] };
}

/**
 * Order fits for a human: usable first, then by how much of the frame the draft actually supplies.
 * A frame the draft already opens with sinks, since applying it changes nothing.
 */
export function rankFits(fits: readonly FrameFit[]): FrameFit[] {
  const order: Record<FitVerdict, number> = { fits: 0, partial: 1, unverifiable: 2, "no-fit": 3 };
  return [...fits].sort((left, right) => {
    if (left.alreadyUsed !== right.alreadyUsed) return left.alreadyUsed ? 1 : -1;
    if (order[left.verdict] !== order[right.verdict]) return order[left.verdict] - order[right.verdict];
    if (left.satisfied !== right.satisfied) return right.satisfied - left.satisfied;
    return left.frameId < right.frameId ? -1 : 1;
  });
}
