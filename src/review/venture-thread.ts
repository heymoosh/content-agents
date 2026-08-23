// The Venture room's thread, DERIVED — never stored.
//
// The prototype seeds a conversation as an array of pushed messages, which implies a conversation
// store. There is deliberately none, and there should never be one: every message the prototype
// seeds is already reconstructible from durable data. canon.md gives the receipts and the phase
// rails, decisions.jsonl gives the choice panels (`awaiting_user` is live, `selected` is settled),
// artifacts.jsonl gives the cards, intake.md gives Muxin's own words, deriveState gives the open
// checkpoint. A store would be a second source of truth, and canon is the authority — the moment
// they disagreed the screen would be lying, and it would be the store that was wrong.
//
// So this is a pure function from those reads to a view model, and nothing else. It takes plain
// data, never a slug: no filesystem, no I/O, nothing to stub. That is what lets the fixture mode
// (src/review/fixtures.ts, itself I/O-free by its own source-grep test) build Venture scenarios by
// running the REAL builder over fixture data, instead of anyone hand-authoring thread JSON that
// would drift from what the room actually renders.
//
// It also runs server-side rather than in the browser, deliberately breaking with page.ts's Rule 5
// mirror convention. That convention works for a 20-line helper written twice; this is several
// hundred lines of the most honesty-critical logic in the room, and hand-syncing two copies of it
// is precisely the failure Rule 5's own history warns about, at the size where it will happen.
// Served as GET /api/venture/:slug/thread instead, which also means the read routes' existing
// clean-tree sweep and privacy sentinels cover it for free.
//
// THREE HONESTY RULES run through everything below, all from docs/prototype-port-rules.md:
//
//   Approved is not live. Nine distinct card states exist and each renders distinctly. An artifact
//   that is `approved` but not `live_confirmed` never reads as live, anywhere.
//
//   Never render an unmeasured number. Every count here is computed from records in hand. Where the
//   prototype showed a figure with no source ($49, "153 of your 158 subscribers", "24 people",
//   "DAY 8 OF 14", per-probe click-through), this renders nothing at all.
//
//   Three states, never two. "Not measured" and "measured as zero" stay distinguishable: a null
//   cluster analysis renders nothing, a gate with no responses renders 0 of 20.

import type { VentureArtifact, Evidence, Retraction } from "../venture/artifacts.js";
import type { DecisionRecord, Candidate } from "../venture/decisions.js";
import type { CanonEvent } from "../venture/canon.js";
import type { ResponseGateState } from "../venture/responses.js";
import type { ClusterAnalysis } from "../venture/phase3.js";
import type { VentureState, CheckpointState } from "../venture/state.js";
import type { IntakeAnswers } from "../venture/intake.js";

// ── the view model ───────────────────────────────────────────────────────────────────────────────

/** A monospace phase/step heading. Structure, not a claim. */
export interface RailMsg {
  kind: "rail";
  text: string;
}

/** A ledger fact that already happened. Every one of these traces to a canon.md event. */
export interface ReceiptMsg {
  kind: "receipt";
  text: string;
  dot: DotTone;
  at: string;
}

/** The app speaking. Sans-serif. */
export interface SaidMsg {
  kind: "said";
  text: string;
}

export type DotTone = "green" | "amber" | "red" | "grey" | "blue";

/**
 * One artifact. `state` is the sentence for its exact (editorial, delivery) pair — the nine states
 * of venture-schema-contract.md §2.2, kept distinct.
 */
export interface CardMsg {
  kind: "card";
  artifactId: string;
  rail: string;
  title: string;
  dot: DotTone;
  state: string;
  /** Set only when a body file exists. The room links to it; it does not inline a file it has not read. */
  bodyPath: string | null;
  /** Purple + "I DRAFTED THIS" is the AI register. An artifact body is always AI-written. */
  drafted: boolean;
  evidence: EvidenceView | null;
  retraction: RetractionView | null;
  failure: { message: string; retryable: boolean; at: string } | null;
  claimRefs: { claim: string; ref: string }[];
}

export interface EvidenceView {
  /** "LINK" / "SYSTEM" / "YOUR WORD" */
  badge: string;
  glyph: string;
  tone: "link" | "system" | "word";
  /** The value itself: a URL renders as a link, an attestation as her sentence. */
  value: string;
  isUrl: boolean;
  /** How this was confirmed, said plainly. Never claims the app verified anything it did not. */
  how: string;
  confirmedAt: string | null;
}

export interface RetractionView {
  attestation: string;
  retractedAt: string;
}

/** A ranked decision, read-only in this PR: the candidates, which was recommended, which was taken. */
export interface ChoiceMsg {
  kind: "choice";
  decisionId: string;
  rail: string;
  sub: string;
  live: boolean; // awaiting_user — waiting on Muxin, but not clickable yet
  rulesVersion: string;
  items: ChoiceItem[];
  /** Echoed in her register when she overrode the recommendation. */
  overrideReason: string | null;
  rationale: string | null;
}

export interface ChoiceItem {
  candidateId: string;
  title: string;
  why: string;
  recommended: boolean;
  selected: boolean;
  /** "early_problem 4 · narrowness 5 · …" — only the scores the record actually carries. */
  scoreLine: string;
}

/** Counts only. The response log itself is gitignored and never reaches this file. */
export interface GateMsg {
  kind: "gate";
  rail: string;
  title: string;
  have: number;
  need: number;
  target: number;
  opened: boolean;
  pct: number;
  note: string;
}

/** Muxin's intake answers, in her register. */
export interface QuotesMsg {
  kind: "quotes";
  rail: string;
  sub: string;
  lines: { anchor: string; question: string; answer: string }[];
}

/** The open checkpoint. */
export interface CheckpointMsg {
  kind: "checkpoint";
  checkpointId: string;
  rail: string;
  /** Counts BY PROOF TYPE, never one collapsed "3 OF 3 LIVE" over mixed evidence. */
  stamp: string;
  stampTone: DotTone;
  sub: string;
  cleared: boolean;
  rows: CheckpointRow[];
  decisions: { kind: string; selected: boolean }[];
  footNote: string;
}

export interface CheckpointRow {
  artifactId: string | null;
  title: string;
  dot: DotTone;
  live: string;
  isLive: boolean;
  approval: string;
  evidence: EvidenceView | null;
}

/** The problem clusters. Absent entirely when the analysis has not run — never zero clusters. */
export interface ClustersMsg {
  kind: "clusters";
  rail: string;
  sub: string;
  analyzedAt: string;
  items: { clusterId: string; label: string; stuckPoint: string; evidence: string[] }[];
}

export type ThreadMsg =
  | RailMsg
  | ReceiptMsg
  | SaidMsg
  | CardMsg
  | ChoiceMsg
  | GateMsg
  | QuotesMsg
  | CheckpointMsg
  | ClustersMsg;

export interface VentureThread {
  slug: string;
  phase: 1 | 2 | 3 | 4;
  phaseStatus: string;
  /** The plain-language status line, from formatStatusReadOnly. */
  statusText: string;
  /** Elapsed calendar days since the kickoff event, or null when there is no kickoff. */
  elapsedDays: number | null;
  messages: ThreadMsg[];
  rail: RailGroup[];
  refs: { name: string; stamp: string }[];
}

export interface RailGroup {
  name: string;
  items: RailItem[];
}

export interface RailItem {
  label: string;
  value: string;
  from: string;
  /** Her words render as a quote; everything else renders plain. */
  isQuote: boolean;
  /** The message anchor this jumps to, when the value came from one. */
  jumpTo: string | null;
}

export interface ThreadInput {
  slug: string;
  state: VentureState;
  statusText: string;
  artifacts: VentureArtifact[];
  decisions: DecisionRecord[];
  canon: CanonEvent[];
  gate: ResponseGateState;
  clusters: ClusterAnalysis | null;
  answers: IntakeAnswers | null;
  rulesVersion: string;
  /** "now", for the elapsed-day count. Passed in so the result is deterministic in tests. */
  now: string;
}

// ── the 25 questions, as Muxin reads them ────────────────────────────────────────────────────────
//
// The prototype's phrasing differs from INTAKE_QUESTIONS' (compare "What do they distrust?" with
// "What do they not trust?"). Muxin decided: display the prototype's wording, key by the backend's
// id. Neither file is "fixed" to match the other, so this map is the seam, and it is the only place
// the two vocabularies meet. `short` is the context rail's abbreviated form.
export const QUESTION_DISPLAY: Record<string, { n: number; block: string; question: string; short: string }> = {
  q1: { n: 1, block: "A · WHAT ARE WE BUILDING", question: "What are you trying to help people do?", short: "What are you trying to help people do?" },
  q2: { n: 2, block: "A · WHAT ARE WE BUILDING", question: "Who exactly are you trying to help first?", short: "Who are you trying to help first?" },
  q3: { n: 3, block: "A · WHAT ARE WE BUILDING", question: "What problem do they already know they have?", short: "What problem do they already know they have?" },
  q4: { n: 4, block: "A · WHAT ARE WE BUILDING", question: "What do you believe is broken in the market, industry, or world they are living in?", short: "What do you believe is broken?" },
  q5: { n: 5, block: "A · WHAT ARE WE BUILDING", question: "If this works, what changes for them?", short: "If this works, what changes for them?" },
  q6: { n: 6, block: "B · WHAT MAKES YOU CREDIBLE", question: "What have you already built, published, taught, or tested?", short: "What have you already built or published?" },
  q7: { n: 7, block: "B · WHAT MAKES YOU CREDIBLE", question: "What proof do you have that people care when you talk about this?", short: "What proof that people care?" },
  q8: { n: 8, block: "B · WHAT MAKES YOU CREDIBLE", question: "What have people thanked you for before?", short: "What have people thanked you for?" },
  q9: { n: 9, block: "B · WHAT MAKES YOU CREDIBLE", question: "What do you understand from direct experience that most people miss?", short: "What do you understand that most people miss?" },
  q10: { n: 10, block: "B · WHAT MAKES YOU CREDIBLE", question: "What result, story, or artifact should we keep pointing back to?", short: "What should we keep pointing back to?" },
  q11: { n: 11, block: "C · WHAT YOUR AUDIENCE FEELS", question: "What frustrates them right now?", short: "What frustrates them right now?" },
  q12: { n: 12, block: "C · WHAT YOUR AUDIENCE FEELS", question: "What do they waste time trying to figure out?", short: "What do they waste time on?" },
  q13: { n: 13, block: "C · WHAT YOUR AUDIENCE FEELS", question: "What do they distrust?", short: "What do they distrust?" },
  q14: { n: 14, block: "C · WHAT YOUR AUDIENCE FEELS", question: "What do they want to do, but keep avoiding or delaying?", short: "What do they keep avoiding?" },
  q15: { n: 15, block: "C · WHAT YOUR AUDIENCE FEELS", question: "What language do they use when they complain about this?", short: "What language do they use?" },
  q16: { n: 16, block: "D · WHAT YOU CAN SUSTAIN", question: "What format feels easiest: writing, video, audio, live teaching, demos, or templates?", short: "What format feels easiest?" },
  q17: { n: 17, block: "D · WHAT YOU CAN SUSTAIN", question: "What can you make in under 60 minutes without hating the process?", short: "What can you make in under an hour?" },
  q18: { n: 18, block: "D · WHAT YOU CAN SUSTAIN", question: "Which platform feels natural?", short: "Which platform feels natural?" },
  q19: { n: 19, block: "D · WHAT YOU CAN SUSTAIN", question: "Which platform would burn you out fastest?", short: "Which platform would burn you out?" },
  q20: { n: 20, block: "D · WHAT YOU CAN SUSTAIN", question: "How much time can you realistically commit for the next 14 days?", short: "How much time for the next 14 days?" },
  q21: { n: 21, block: "E · WHAT THE FIRST OFFER BECOMES", question: "Would your first paid thing more likely be a guide, toolkit, mini-course, community, coaching, or software-supported product?", short: "What shape is the first paid thing?" },
  q22: { n: 22, block: "E · WHAT THE FIRST OFFER BECOMES", question: "What small win could someone get in 10 minutes?", short: "What small win in 10 minutes?" },
  q23: { n: 23, block: "E · WHAT THE FIRST OFFER BECOMES", question: "What bigger win could someone get in 1 to 2 weeks?", short: "What bigger win in a week or two?" },
  q24: { n: 24, block: "E · WHAT THE FIRST OFFER BECOMES", question: "What do you not want this business to become?", short: "What should this never become?" },
  q25: { n: 25, block: "E · WHAT THE FIRST OFFER BECOMES", question: "What would make this feel worth continuing after 14 days?", short: "What makes this worth continuing?" },
};

// venture/rules.md's own section headings (§5 "days 1-3", §6 "days 4-6", §7 "days 7-10",
// §8 "days 11-14"). A fixed property of the method as written down, not a measurement of this run,
// which is why it may be stated: the phase a venture is IN comes from deriveState, and only the
// span the method allots to that phase is quoted here.
const PHASE_RAIL: Record<number, string> = {
  1: "PHASE 1 · ATTENTION · DAYS 1 TO 3",
  2: "PHASE 2 · AUDIENCE · DAYS 4 TO 6",
  3: "PHASE 3 · OFFER · DAYS 7 TO 10",
  4: "PHASE 4 · OPERATIONS · DAYS 11 TO 14",
};

// ── evidence ─────────────────────────────────────────────────────────────────────────────────────

/**
 * How a live artifact was confirmed. THE central honesty control of this room.
 *
 * The prototype gives every live row the same green dot and, for an attestation, a "✓" — which
 * venture-schema-contract.md §2.2 rules out by name: "An agent confirmation and Muxin's own word
 * are not the same fact and must not look the same." So an attestation-backed row carries the
 * amber "your word" tone, never the green one, and the checkpoint stamp counts by type rather than
 * flattening three sentences and three agent confirmations into one number.
 *
 * The prototype's LINK sentence ("I pinged the link you pasted and it answered") is REFUSED
 * outright, not softened: nothing in this repo pings anything. confirmManualDelivery stores the URL
 * she pasted and checks nothing. What replaces it says exactly that.
 */
export function evidenceView(evidence: Evidence | null | undefined): EvidenceView | null {
  if (!evidence) return null;
  const confirmedAt = evidence.confirmed_at ?? null;
  if (evidence.type === "url") {
    return {
      badge: "LINK",
      glyph: "↗",
      tone: "link",
      value: evidence.value,
      isUrl: true,
      how: "You pasted this link when you confirmed it. Nothing here opened it, so it is your word plus something anyone can re-check later.",
      confirmedAt,
    };
  }
  if (evidence.type === "agent") {
    return {
      badge: "SYSTEM",
      glyph: "▪",
      tone: "system",
      value: evidence.value,
      isUrl: /^https?:\/\//i.test(evidence.value),
      how: "The delivery agent posted it and reported back inside the app. This one was observed, not taken on trust.",
      confirmedAt,
    };
  }
  return {
    badge: "YOUR WORD",
    glyph: "✓",
    tone: "word",
    value: evidence.value,
    isUrl: false,
    how: "You told me it is live and I took your word. Nothing here checked it, and this row will always say so.",
    confirmedAt,
  };
}

function retractionView(r: Retraction | null | undefined): RetractionView | null {
  return r ? { attestation: r.attestation, retractedAt: r.retracted_at } : null;
}

// ── card state ───────────────────────────────────────────────────────────────────────────────────

/**
 * The sentence for one (editorial, delivery) pair. All nine legal combinations
 * (venture-schema-contract.md §2.2) get their own, because collapsing any two of them is how
 * "approved" ends up reading as "live".
 *
 * `discarded × cancelled` splits on the presence of a retraction: §2.2 is explicit that "retracted"
 * and "discarded" must not flatten into one word, since one of them was public and one never was.
 */
export function cardState(a: Pick<VentureArtifact, "editorial_status" | "delivery_status" | "delivery_mode" | "retraction" | "failure">): {
  text: string;
  dot: DotTone;
} {
  const { editorial_status: ed, delivery_status: dl } = a;
  if (ed === "discarded") {
    if (a.retraction) return { text: "Retracted. It was live, and you took it down. The record that it was live is kept.", dot: "red" };
    return { text: "Put aside. It never went anywhere.", dot: "grey" };
  }
  if (ed === "draft") {
    return { text: "Drafted, waiting on your yes.", dot: "amber" };
  }
  // approved
  if (dl === "not_applicable") return { text: "Approved. Internal, so there is nothing to put anywhere.", dot: "green" };
  if (dl === "ready") return { text: "Approved, and not sent yet.", dot: "amber" };
  if (dl === "handed_off") {
    return a.delivery_mode === "manual"
      ? { text: "Approved. Waiting on you to put it live and tell me.", dot: "amber" }
      : { text: "Handed to the delivery agent. Not live yet.", dot: "amber" };
  }
  if (dl === "failed") return { text: "Delivery failed.", dot: "red" };
  if (dl === "live_confirmed") return { text: "Live.", dot: "green" };
  return { text: `${ed} / ${dl}`, dot: "grey" };
}

/** The tone of a live row's dot. Her own word never renders as the same green as a checked fact. */
function liveDot(ev: EvidenceView | null): DotTone {
  return ev?.tone === "word" ? "amber" : "green";
}

// ── the phase rail, from canon ───────────────────────────────────────────────────────────────────

// Every receipt below is keyed to a canon event TYPE that src/venture/** actually appends. A
// receipt with no event behind it would be the room narrating something that never happened, so
// there is no default sentence: an unrecognised event renders its own type and id rather than an
// invented story.
const RECEIPT_COPY: Record<string, { text: string; dot: DotTone }> = {
  kickoff: { text: "Venture created. Everything from here writes into it.", dot: "grey" },
  "pace-recorded": { text: "Posting pace recorded. Checkpoint 1 reads it from here.", dot: "grey" },
  "response-gate-opened": { text: "Enough answers to start choosing. The count is all I ever show you.", dot: "green" },
  "checkpoint-cleared": { text: "Checkpoint cleared. Written to canon first, then the next phase opened.", dot: "green" },
  retracted: { text: "Retracted. The record that it was live is kept, and the takedown sits next to it.", dot: "red" },
  // checkpoint.ts and phase4.ts write these two with UNDERSCORES, unlike every dashed type above.
  // Spelled here exactly as they land in canon.md rather than normalised, because a near-miss would
  // silently fall through to the raw fallback and the room would narrate an id at Muxin.
  phase_3_completed: { text: "Phase 3 recorded. The problem, the outline and the price are in canon. None of them was ever published.", dot: "green" },
  phase_4_completed: { text: "Phase 4 complete. It is the last entry, and the next fortnight reads from it.", dot: "green" },
};

export function receiptFor(event: CanonEvent): ReceiptMsg {
  const copy = RECEIPT_COPY[event.type];
  return {
    kind: "receipt",
    text: copy ? copy.text : `${event.type}: ${event.id}`,
    dot: copy ? copy.dot : "grey",
    at: event.at,
  };
}

/**
 * Whole calendar days between the kickoff event and now. The prototype's "DAY 8 OF 14" has no
 * source for either half; this is the half that does — and only when a kickoff event exists.
 */
export function elapsedDays(canon: CanonEvent[], now: string): number | null {
  const kickoff = canon.find((e) => e.type === "kickoff");
  if (!kickoff) return null;
  const start = Date.parse(kickoff.at);
  const end = Date.parse(now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

// ── decisions ────────────────────────────────────────────────────────────────────────────────────

function scoreLine(c: Candidate): string {
  const entries = Object.entries(c.scores ?? {});
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ");
}

const DECISION_RAIL: Record<string, { rail: string; sub: string }> = {
  "platform-recommendation": { rail: "ONE DECISION · WHERE THIS GETS POSTED", sub: "One platform, not a spread. The rest of Phase 1 is written for whichever this is." },
  "idea-ranking": { rail: "ONE DECISION · WHICH IDEAS GET DRAFTED", sub: "Ranked on the four factors in the rules. The ones you do not pick are banked, not deleted." },
  "phase-1-research-continuation": { rail: "ONE DECISION · PHASE 2 CANNOT START WITHOUT IT", sub: "What the probes came back with, and what it means for going on." },
  "lead-magnet-concept": { rail: "ONE DECISION · WHAT THE LEAD MAGNET IS", sub: "Ranked on the six factors in the rules." },
  "problem-selection": { rail: "ONE DECISION · THE EXPENSIVE PROBLEM", sub: "Grouped from the answers you collected, scored on the six factors in the rules." },
  "transformation-choice": { rail: "ONE DECISION · THE CHANGE THIS CREATES", sub: "One plain sentence. It is what the outline gets built backward from." },
  "product-format-and-price": { rail: "ONE DECISION · FORMAT AND PRICE", sub: "The range considered, and the reasoning. No number here is a forecast." },
  "daily-operating-plan-choice": { rail: "ONE DECISION · HOW THE DAYS RUN", sub: "Measured against the time you said you had at intake." },
  "day-14-decision": { rail: "ONE DECISION · IT GOES IN CANON", sub: "Whichever you pick gets written down with the numbers beside it." },
};

export function choiceFor(d: DecisionRecord): ChoiceMsg {
  const copy = DECISION_RAIL[d.decision_kind] ?? { rail: `ONE DECISION · ${d.decision_kind.toUpperCase()}`, sub: "" };
  const selected = new Set(d.selected_candidate_ids);
  const recommended = new Set(d.recommended_candidate_ids);
  return {
    kind: "choice",
    decisionId: d.decision_id,
    rail: copy.rail,
    sub: copy.sub,
    live: d.status === "awaiting_user",
    rulesVersion: d.rules_version,
    items: d.candidates.map((c) => ({
      candidateId: c.candidate_id,
      title: c.label,
      why: c.rationale ?? "",
      recommended: recommended.has(c.candidate_id),
      selected: selected.has(c.candidate_id),
      scoreLine: scoreLine(c),
    })),
    overrideReason: d.override_reason,
    rationale: d.rationale,
  };
}

// ── the checkpoint ───────────────────────────────────────────────────────────────────────────────

/**
 * The stamp over a checkpoint's rows. Counts BY PROOF TYPE rather than collapsing everything into
 * "3 OF 3 LIVE" — three attestations and three agent confirmations are not the same evidence, and
 * a single number over both hides which one this checkpoint is resting on.
 */
export function checkpointStamp(rows: CheckpointRow[], cleared: boolean): { text: string; tone: DotTone } {
  if (cleared) return { text: "CLEARED, KEPT AS THE RECORD", tone: "green" };
  const live = rows.filter((r) => r.isLive);
  if (!live.length) return { text: `0 OF ${rows.length} LIVE`, tone: "amber" };
  const counts = { LINK: 0, SYSTEM: 0, "YOUR WORD": 0, RECORDED: 0 };
  for (const r of live) counts[(r.evidence?.badge ?? "RECORDED") as keyof typeof counts]++;
  const parts = (Object.keys(counts) as (keyof typeof counts)[])
    .filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${k}${counts[k] === 1 ? "" : "S"}`);
  const head = `${live.length} OF ${rows.length} LIVE`;
  return {
    text: `${head} · ${parts.join(" · ")}`,
    tone: live.length === rows.length && counts["YOUR WORD"] === 0 ? "green" : "amber",
  };
}

function checkpointRows(cp: CheckpointState, byId: Map<string, VentureArtifact>): CheckpointRow[] {
  return cp.required.map((req) => {
    const a = byId.get(req.artifact_id) ?? req;
    const ev = evidenceView(a.evidence);
    const isLive = a.delivery_status === "live_confirmed" || (a.delivery_mode === "none" && a.editorial_status === "approved" && a.delivery_status === "not_applicable");
    const st = cardState(a);
    return {
      artifactId: a.artifact_id,
      title: a.title,
      dot: isLive ? liveDot(ev) : st.dot,
      // "Approved" and "live" are two separate facts on every row, and only live counts here.
      live: isLive
        ? ev
          ? ev.how
          : "Recorded. Internal, and it was never published."
        : st.text,
      isLive,
      approval: a.editorial_status === "approved" ? "✓ APPROVED" : a.editorial_status === "discarded" ? "PUT ASIDE" : "WAITING ON YOUR YES",
      evidence: ev,
    };
  });
}

// ── the builder ──────────────────────────────────────────────────────────────────────────────────

export function buildVentureThread(input: ThreadInput): VentureThread {
  const { state, artifacts, decisions, canon, gate, clusters, answers } = input;
  const byId = new Map(artifacts.map((a) => [a.artifact_id, a]));
  const messages: ThreadMsg[] = [];

  // 1. Her own words. The transcript opens the thread because it is what everything downstream
  //    cites, and it is the only place in this room rendered entirely in her register.
  if (answers && Object.keys(answers).length) {
    messages.push({ kind: "rail", text: "INTAKE · IN YOUR OWN WORDS" });
    messages.push({
      kind: "quotes",
      rail: "THE 25 ANSWERS",
      sub: "Stored exactly as you gave them. Nothing below paraphrases these.",
      lines: Object.keys(QUESTION_DISPLAY)
        .filter((id) => answers[id])
        .map((id) => ({ anchor: `q-${id}`, question: QUESTION_DISPLAY[id].question, answer: answers[id] })),
    });
  }

  // 2. The ledger, oldest first. Receipts are facts that already happened, in the order canon.md
  //    recorded them — this is the "derived, not stored" claim at its most literal.
  const sorted = [...canon].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of sorted) messages.push(receiptFor(e));

  // 3. Where the venture is now.
  messages.push({ kind: "rail", text: PHASE_RAIL[state.current_phase] ?? `PHASE ${state.current_phase}` });
  messages.push({ kind: "said", text: input.statusText });

  // 4. Decisions, settled ones first and the live one last so it sits closest to her.
  const settled = decisions.filter((d) => d.status !== "awaiting_user");
  const live = decisions.filter((d) => d.status === "awaiting_user");
  for (const d of settled) messages.push(choiceFor(d));

  // 5. The artifacts of the current phase. Earlier phases' cards stay in the ledger above rather
  //    than being redrawn here, so the thread does not grow without bound.
  const phaseArtifacts = artifacts.filter((a) => a.venture_phase === state.current_phase);
  if (phaseArtifacts.length) {
    messages.push({ kind: "rail", text: `PHASE ${state.current_phase} · WHAT IS DRAFTED` });
    for (const a of phaseArtifacts) messages.push(cardFor(a));
  }

  // 6. The response gate, in Phase 3 ONLY. Counts, never answers — and while it is closed there
  //    are no analysis affordances at all, because every Phase 3 analysis command refuses until it
  //    opens, and drawing the controls would promise something that is not available. Deliberately
  //    not shown from Phase 4: the gate's whole copy is about what is still waiting on it, and by
  //    Phase 4 nothing is. A count of 0 there would read as a failure rather than as history.
  if (state.current_phase === 3) {
    messages.push(gateMsg(gate));
    // null before the analysis has run. Rendered as nothing at all, never as zero clusters.
    if (clusters) {
      messages.push({
        kind: "clusters",
        rail: "PHASE 3 · THE PROBLEMS PEOPLE DESCRIBED",
        sub: "Grouped from the answers. The quotes below are the redacted versions, which is the only form that leaves the response log.",
        analyzedAt: clusters.analyzed_at,
        items: clusters.clusters.map((c) => ({
          clusterId: c.cluster_id,
          label: c.label,
          stuckPoint: c.stuck_point,
          evidence: c.evidence ?? [],
        })),
      });
    }
  }

  for (const d of live) messages.push(choiceFor(d));

  // 7. The open checkpoint, last, because it is the thing that is actually blocking.
  const openId = openCheckpointId(state);
  if (openId) {
    const cp = state.checkpoints[openId];
    messages.push({ kind: "rail", text: "CHECKPOINT · STOP AND WAIT" });
    messages.push(checkpointMsg(openId, cp, byId));
  }

  return {
    slug: input.slug,
    phase: state.current_phase,
    phaseStatus: state.phase_status,
    statusText: input.statusText,
    elapsedDays: elapsedDays(canon, input.now),
    messages,
    rail: railGroups(answers, decisions, artifacts),
    refs: [
      { name: "venture/rules.md", stamp: input.rulesVersion },
      { name: "docs/venture-schema-contract.md", stamp: "the artifact and decision shapes" },
      { name: "venture/<slug>/canon.md", stamp: "the ledger every receipt above came from" },
    ],
  };
}

function cardFor(a: VentureArtifact): CardMsg {
  const st = cardState(a);
  const ev = evidenceView(a.evidence);
  return {
    kind: "card",
    artifactId: a.artifact_id,
    rail: a.artifact_kind.replace(/[-_]/g, " ").toUpperCase(),
    title: a.title,
    dot: a.delivery_status === "live_confirmed" ? liveDot(ev) : st.dot,
    state: st.text,
    bodyPath: a.body_path,
    // Every artifact body in a venture is composed by Claude (root CLAUDE.md rule 1's Build 3
    // exception), so the AI register applies to all of them. The card TITLE is serif with no
    // coloured rule: it is neither her words nor drafted prose, and the rule is what carries
    // authorship.
    drafted: Boolean(a.body_path),
    evidence: ev,
    retraction: retractionView(a.retraction),
    failure: a.failure ? { message: a.failure.message, retryable: a.failure.retryable, at: a.failure.at } : null,
    claimRefs: a.claim_refs ?? [],
  };
}

function gateMsg(gate: ResponseGateState): GateMsg {
  const opened = gate.state === "opened";
  return {
    kind: "gate",
    rail: "PHASE 3 · WAITING FOR ENOUGH ANSWERS",
    title: opened ? "Enough answers to start choosing the problem." : "Still waiting for enough answers. Posting continues in the meantime.",
    have: gate.have,
    need: gate.need,
    target: gate.target,
    opened,
    pct: gate.need > 0 ? Math.min(100, Math.round((gate.have / gate.need) * 100)) : 0,
    note: opened
      ? `${gate.have} people who count toward the goal. I never show you the answers, only the count.`
      : `${gate.have} of ${gate.need} people who count toward the goal, aiming for ${gate.target}. Grouping the problems, choosing one, the outline and the price all wait for this. I never show you the answers, only the count.`,
  };
}

function checkpointMsg(checkpointId: string, cp: CheckpointState, byId: Map<string, VentureArtifact>): CheckpointMsg {
  const rows = checkpointRows(cp, byId);
  const stamp = checkpointStamp(rows, cp.cleared);
  const n = /(\d+)$/.exec(checkpointId)?.[1] ?? checkpointId;
  return {
    kind: "checkpoint",
    checkpointId,
    rail: `CHECKPOINT ${n} · ${cp.cleared ? "CLEARED" : "HARD STOP"}`,
    stamp: stamp.text,
    stampTone: stamp.tone,
    sub: cp.cleared
      ? "Cleared, and kept here as the record it cleared on."
      : "Two separate facts on every row: that you approved it, and that it is actually live. Only live counts here.",
    cleared: cp.cleared,
    rows,
    // Checkpoint 3 gates on selected DECISIONS as well as artifacts, which the prototype's
    // four-artifact-row version had no way to show (its fourth "pitch" artifact kind does not
    // exist). CheckpointState carries counts plus a blocking list, not a kind array, so the
    // missing ones are read off blocking's own "missing required decision kind" reason and the
    // rest are inferred as selected. Renders nothing at all where the count is 0.
    decisions: decisionRows(cp),
    footNote: cp.cleared
      ? "Canon first, then the next phase opened."
      : "Nothing after this gets written until every row above reports live.",
  };
}

function decisionRows(cp: CheckpointState): { kind: string; selected: boolean }[] {
  if (cp.decisions_required_count === 0) return [];
  const missing = cp.blocking
    .map((b) => /^missing required decision kind "(.+)"$/.exec(b.reason)?.[1])
    .filter((k): k is string => Boolean(k));
  const rows = missing.map((kind) => ({ kind, selected: false }));
  // The selected ones are not named anywhere in CheckpointState, only counted. Rather than invent
  // names for them, the count is stated as its own row so the screen never implies it knows which.
  const selectedCount = cp.decisions_complete_count;
  if (selectedCount > 0) rows.unshift({ kind: `${selectedCount} of ${cp.decisions_required_count} decisions made`, selected: true });
  return rows;
}

/**
 * The checkpoint this venture is actually sitting at: the one belonging to the phase it is IN.
 *
 * Not "the lowest uncleared one" — that was wrong, and a live read caught it. A venture can reach
 * Phase 4 with checkpoint-1 never marked cleared (checkpoint-3 clearing is what advances the phase,
 * and an older checkpoint whose artifacts were never registered stays uncleared forever), and the
 * room then showed a stale "CHECKPOINT 1 · 0 OF 0 LIVE" as the thing blocking her. current_phase is
 * the authority on where she is, so the checkpoint shown is the one that phase gates. Phase 4 has
 * no checkpoint at all (venture-schema-contract.md §5.3: "There is no checkpoint-4"), so it shows
 * none rather than reaching backwards for one.
 */
export function openCheckpointId(state: VentureState): string | null {
  const id = `checkpoint-${state.current_phase}`;
  return state.checkpoints[id] ? id : null;
}

// ── the context rail ─────────────────────────────────────────────────────────────────────────────

/**
 * "What this is built on". Three groups, each traced to where the value came from — a claim never
 * renders bare (port-rules Rule 3). YOUR WORDS renders in her register and jumps to the answer in
 * the transcript; the others render plain.
 */
export function railGroups(answers: IntakeAnswers | null, decisions: DecisionRecord[], artifacts: VentureArtifact[]): RailGroup[] {
  const groups: RailGroup[] = [];

  const yourWords = ["q1", "q2", "q18", "q20", "q24"]
    .filter((id) => answers?.[id])
    .map((id) => ({
      label: QUESTION_DISPLAY[id].short.toUpperCase(),
      value: answers![id],
      from: `intake:${id}`,
      isQuote: true,
      jumpTo: `q-${id}`,
    }));
  if (yourWords.length) groups.push({ name: "YOUR WORDS", items: yourWords });

  const decided = decisions
    .filter((d) => d.status === "selected")
    .map((d) => ({
      label: d.decision_kind.replace(/-/g, " ").toUpperCase(),
      value: d.selected_candidate_ids
        .map((id) => d.candidates.find((c) => c.candidate_id === id)?.label ?? id)
        .join(", "),
      from: d.override_reason ? `${d.decision_id} · you overrode the recommendation` : d.decision_id,
      isQuote: false,
      jumpTo: null,
    }));
  if (decided.length) groups.push({ name: "DECIDED", items: decided });

  const liveItems = artifacts
    .filter((a) => a.delivery_status === "live_confirmed")
    .map((a) => {
      const ev = evidenceView(a.evidence);
      return {
        label: a.artifact_kind.replace(/[-_]/g, " ").toUpperCase(),
        value: a.title,
        from: ev ? `${ev.glyph} ${ev.badge}` : "live",
        isQuote: false,
        jumpTo: null,
      };
    });
  if (liveItems.length) groups.push({ name: "LIVE", items: liveItems });

  return groups;
}
