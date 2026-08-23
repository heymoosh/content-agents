// The derived Venture thread.
//
// Most of these are honesty tests, not shape tests. The room's whole job is to say only what the
// data supports, and the specific ways that goes wrong are enumerated in
// docs/prototype-port-rules.md — so each rule there that this builder is responsible for gets a
// test that fails if the rule is broken, not a test that the output "looks right".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildVentureThread,
  cardState,
  checkpointStamp,
  elapsedDays,
  evidenceView,
  openCheckpointId,
  railGroups,
  receiptFor,
  QUESTION_DISPLAY,
  CARD_ACTION_IDS,
  cardActions,
  choiceFor,
  type CheckpointRow,
  type ThreadInput,
  type ThreadMsg,
} from "./venture-thread.js";
import { INTAKE_QUESTIONS } from "../venture/intake.js";
import type { VentureArtifact, Evidence } from "../venture/artifacts.js";
import { OVERRIDE_SELECT_KINDS, type DecisionRecord } from "../venture/decisions.js";
import type { CheckpointState, VentureState } from "../venture/state.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const AT = "2026-08-18T09:00:00.000Z";
const NOW = "2026-08-21T09:00:00.000Z";

function artifact(over: Partial<VentureArtifact> & { artifact_id: string }): VentureArtifact {
  return {
    phase: 1,
    artifact_kind: "substack-post",
    title: "a title",
    body_path: null,
    checkpoint_id: "checkpoint-1",
    fields: null,
    delivery_mode: "manual",
    publishable: false,
    editorial_status: "draft",
    delivery_status: "awaiting_approval",
    evidence: null,
    retraction: null,
    failure: null,
    origin_type: "venture",
    venture_id: "v",
    venture_phase: 1,
    message_id: "m",
    cta_id: null,
    rules_version: "r1",
    probe_id: null,
    unknown_id: null,
    claim_refs: [],
    created_at: AT,
    updated_at: AT,
    ...over,
  } as VentureArtifact;
}

const ev = (type: Evidence["type"], value: string): Evidence => ({ type, value, confirmed_by: "muxin", confirmed_at: AT });

function checkpoint(over: Partial<CheckpointState> = {}): CheckpointState {
  return {
    required: [],
    complete_count: 0,
    required_count: 0,
    pace_recorded: false,
    decisions_required_count: 0,
    decisions_complete_count: 0,
    cleared: false,
    blocking: [],
    ...over,
  };
}

function state(over: Partial<VentureState> = {}): VentureState {
  return {
    slug: "v",
    current_phase: 1,
    phase_status: "drafting",
    checkpoints: { "checkpoint-1": checkpoint() },
    phase4: {
      operating_plan: { drafted: false, approved: false },
      thank_you_notes_count: 0,
      day_14_review: { drafted: false, approved: false },
      day_14_decision: { made: false, candidate_id: null },
      complete: false,
      blocking: [],
    },
    ...over,
  };
}

function input(over: Partial<ThreadInput> = {}): ThreadInput {
  return {
    slug: "v",
    state: state(),
    statusText: "v -- Phase 1",
    artifacts: [],
    decisions: [],
    canon: [],
    gate: { state: "closed", have: 0, need: 20, target: 30, opened_at: null },
    clusters: null,
    answers: null,
    rulesVersion: "r1",
    minEvidence: { "substack-post": "url", "text-post-note": "agent", "welcome-email": "attestation", "product-outline": null, "phase_1_research_read": null, "day-14-review": null, "daily-operating-plan": null },
    selectCounts: { "idea-ranking": 3, "lead-magnet-concept": 1 },
    day14Candidates: ["continue", "revise_positioning", "revise_lead_magnet", "collect_more_evidence", "stop"],
    now: NOW,
    ...over,
  };
}

function msgs(kind: string, over: Partial<ThreadInput> = {}): ThreadMsg[] {
  return buildVentureThread(input(over)).messages.filter((m) => m.kind === kind);
}

// ── the question map ─────────────────────────────────────────────────────────────────────────────

test("the display map covers all 25 questions and keys by the backend's own ids", () => {
  assert.equal(Object.keys(QUESTION_DISPLAY).length, 25);
  for (const q of INTAKE_QUESTIONS) {
    assert.ok(QUESTION_DISPLAY[q.id], `no display wording for ${q.id}`);
  }
});

test("the map is the seam: the two wordings are allowed to differ, and neither file is edited", () => {
  // Muxin's decision. q13 is the clearest case: "What do they distrust?" against the backend's
  // "What do they not trust?". If someone "fixes" one file to match the other this goes red, which
  // is the point — the seam is deliberate.
  assert.equal(QUESTION_DISPLAY.q13.question, "What do they distrust?");
  assert.equal(INTAKE_QUESTIONS.find((q) => q.id === "q13")?.question, "What do they not trust?");
});

// ── evidence ─────────────────────────────────────────────────────────────────────────────────────

test("each proof type gets its own badge, and no two of them look the same", () => {
  const url = evidenceView(ev("url", "https://example.com/x"))!;
  const agent = evidenceView(ev("agent", "substack-notes"))!;
  const word = evidenceView(ev("attestation", "I put it up this morning"))!;
  assert.deepEqual([url.badge, agent.badge, word.badge], ["LINK", "SYSTEM", "YOUR WORD"]);
  assert.equal(new Set([url.glyph, agent.glyph, word.glyph]).size, 3);
  assert.equal(new Set([url.tone, agent.tone, word.tone]).size, 3);
  assert.equal(new Set([url.how, agent.how, word.how]).size, 3);
  assert.equal(evidenceView(null), null);
});

test("no evidence sentence claims the app checked something it never checked", () => {
  // The prototype's LINK copy was "I pinged the link you pasted and it answered." Nothing in this
  // repo pings anything: confirmManualDelivery stores the URL and checks nothing.
  const url = evidenceView(ev("url", "https://example.com/x"))!;
  assert.ok(!/ping|answered|I checked|verified/i.test(url.how), `the link copy claims a check: ${url.how}`);
  assert.match(url.how, /Nothing here opened it/);
  assert.match(evidenceView(ev("attestation", "x"))!.how, /Nothing here checked it/);
  // The agent one is the ONE that may say it was observed, because the agent really did report back.
  assert.match(evidenceView(ev("agent", "x"))!.how, /observed, not taken on trust/);
});

test("a URL renders as a link and an attestation never does", () => {
  assert.equal(evidenceView(ev("url", "https://example.com/x"))!.isUrl, true);
  assert.equal(evidenceView(ev("attestation", "https://looks-like-a-link"))!.isUrl, false);
});

// ── approved is not live ─────────────────────────────────────────────────────────────────────────

test("every legal (editorial, delivery) pair gets its own sentence", () => {
  const pairs: [VentureArtifact["editorial_status"], VentureArtifact["delivery_status"]][] = [
    ["draft", "not_applicable"],
    ["draft", "awaiting_approval"],
    ["approved", "ready"],
    ["approved", "handed_off"],
    ["approved", "live_confirmed"],
    ["approved", "failed"],
    ["approved", "not_applicable"],
    ["discarded", "cancelled"],
    ["discarded", "not_applicable"],
  ];
  const seen = new Map<string, string>();
  for (const [ed, dl] of pairs) {
    const s = cardState(artifact({ artifact_id: "x", editorial_status: ed, delivery_status: dl })).text;
    seen.set(`${ed}:${dl}`, s);
  }
  // draft:* and discarded:* legitimately share a sentence within their own group; what must never
  // collapse is anything approved-but-not-live into the live one.
  const live = seen.get("approved:live_confirmed");
  for (const [pair, text] of seen) {
    if (pair === "approved:live_confirmed") continue;
    assert.notEqual(text, live, `${pair} reads the same as live`);
    assert.ok(!/^Live\.$/.test(text), `${pair} reads as live: ${text}`);
  }
});

test("approved-and-not-sent never reads as live, on the card or in the checkpoint row", () => {
  const a = artifact({ artifact_id: "x", editorial_status: "approved", delivery_status: "ready" });
  const st = cardState(a);
  assert.match(st.text, /not sent yet/);
  assert.notEqual(st.dot, "green");
});

test("a retracted artifact is not flattened into a plain discard", () => {
  const plain = cardState(artifact({ artifact_id: "x", editorial_status: "discarded", delivery_status: "cancelled" }));
  const retracted = cardState(
    artifact({
      artifact_id: "x",
      editorial_status: "discarded",
      delivery_status: "cancelled",
      retraction: { attestation: "took it down", retracted_at: NOW, retracted_by: "muxin" },
    })
  );
  assert.notEqual(plain.text, retracted.text);
  assert.match(retracted.text, /was live/);
  assert.match(plain.text, /never went anywhere/);
});

// ── her word is not the same fact as a checked one ───────────────────────────────────────────────

test("a row live on Muxin's word alone does not carry the same dot as one with a link", () => {
  const byWord = artifact({ artifact_id: "w", editorial_status: "approved", delivery_status: "live_confirmed", evidence: ev("attestation", "it is up") });
  const byLink = artifact({ artifact_id: "l", editorial_status: "approved", delivery_status: "live_confirmed", evidence: ev("url", "https://x.test/a") });
  const cp = checkpoint({ required: [byWord, byLink], required_count: 2, complete_count: 2 });
  const [msg] = buildVentureThread(input({ state: state({ checkpoints: { "checkpoint-1": cp } }), artifacts: [byWord, byLink] })).messages.filter(
    (m) => m.kind === "checkpoint"
  );
  assert.ok(msg && msg.kind === "checkpoint");
  const rows = Object.fromEntries(msg.rows.map((r) => [r.artifactId, r]));
  assert.equal(rows.l.dot, "green");
  assert.equal(rows.w.dot, "amber", "an attestation must not render with the verified-green dot");
});

test("the checkpoint stamp counts by proof type instead of collapsing into one number", () => {
  const row = (badge: string | null): CheckpointRow => ({
    artifactId: "a",
    title: "t",
    dot: "green",
    live: "",
    isLive: true,
    approval: "✓ APPROVED",
    evidence: badge ? { badge, glyph: "x", tone: "link", value: "v", isUrl: false, how: "h", confirmedAt: null } : null,
  });
  const mixed = checkpointStamp([row("LINK"), row("LINK"), row("YOUR WORD")], false);
  assert.match(mixed.text, /2 LINKS/);
  assert.match(mixed.text, /1 YOUR WORD/);
  assert.notEqual(mixed.text, "3 OF 3 LIVE");
  // Mixed proof is never the all-clear green, because one third of it is unverified.
  assert.equal(mixed.tone, "amber");

  const allChecked = checkpointStamp([row("LINK"), row("SYSTEM")], false);
  assert.equal(allChecked.tone, "green");
  assert.equal(checkpointStamp([row("LINK")], true).text, "CLEARED, KEPT AS THE RECORD");
});

test("a checkpoint with nothing live says zero of N, not nothing", () => {
  assert.equal(checkpointStamp([{ artifactId: "a", title: "t", dot: "amber", live: "", isLive: false, approval: "", evidence: null }], false).text, "0 OF 1 LIVE");
});

test("the approval column carries no date, because no approval date is recorded", () => {
  // The prototype rendered "✓ APPROVED <approvedAt>". There is no approvedAt field, and updated_at
  // moves on every later transition, so rendering it as an approval date goes false the moment the
  // artifact ships.
  const a = artifact({ artifact_id: "x", editorial_status: "approved", delivery_status: "ready" });
  const cp = checkpoint({ required: [a], required_count: 1 });
  const [msg] = buildVentureThread(input({ state: state({ checkpoints: { "checkpoint-1": cp } }), artifacts: [a] })).messages.filter((m) => m.kind === "checkpoint");
  assert.ok(msg && msg.kind === "checkpoint");
  assert.equal(msg.rows[0].approval, "✓ APPROVED");
});

// ── never render an unmeasured number ────────────────────────────────────────────────────────────

test("the elapsed day count comes from the kickoff event, and is null without one", () => {
  assert.equal(elapsedDays([], NOW), null);
  assert.equal(elapsedDays([{ at: AT, type: "kickoff", id: "v/kickoff", fields: {} }], NOW), 3);
  assert.equal(elapsedDays([{ at: AT, type: "kickoff", id: "v/kickoff", fields: {} }], AT), 0);
  // A clock that ran backwards is not a measurement.
  assert.equal(elapsedDays([{ at: NOW, type: "kickoff", id: "v/kickoff", fields: {} }], AT), null);
});

test("no message anywhere carries one of the prototype's sourceless numbers", () => {
  const t = buildVentureThread(
    input({
      canon: [{ at: AT, type: "kickoff", id: "v/kickoff", fields: {} }],
      answers: { q1: "help people vote", q18: "Substack" },
      state: state({ current_phase: 3 }),
    })
  );
  const text = JSON.stringify(t);
  for (const banned of ["$49", "153 of your 158", "158 subscribers", "Civic pulls 1.9", "24 people", "Six sections", "DAY 8", "OF 14"]) {
    assert.ok(!text.includes(banned), `the thread carries an unmeasured figure: ${banned}`);
  }
});

// ── three states, never two ──────────────────────────────────────────────────────────────────────

test("a null cluster analysis renders nothing at all, not zero clusters", () => {
  const withNull = msgs("clusters", { state: state({ current_phase: 3 }), clusters: null });
  assert.equal(withNull.length, 0);
  const withOne = msgs("clusters", {
    state: state({ current_phase: 3 }),
    clusters: { analyzed_at: AT, clusters: [{ cluster_id: "c1", label: "a problem", count: 1, evidence: ["a redacted quote"], stuck_point: "s", desired_outcome: null, visible_consequences: null }] },
  });
  assert.equal(withOne.length, 1);
});

test("a gate with no responses reports a measured zero, and says the analysis is waiting on it", () => {
  const [g] = msgs("gate", { state: state({ current_phase: 3 }) });
  assert.ok(g && g.kind === "gate");
  assert.equal(g.have, 0);
  assert.equal(g.need, 20);
  assert.equal(g.opened, false);
  assert.match(g.note, /0 of 20/);
  assert.match(g.note, /wait for this/);
});

test("the gate exists in Phase 3 only, and never carries an answer", () => {
  assert.equal(msgs("gate").length, 0);
  assert.equal(msgs("gate", { state: state({ current_phase: 2 }) }).length, 0);
  // Not from Phase 4 either: by then nothing is waiting on it, and a closed gate at 0 would read as
  // a failure rather than as history.
  assert.equal(msgs("gate", { state: state({ current_phase: 4 }) }).length, 0);
  const [g] = msgs("gate", { state: state({ current_phase: 3 }), gate: { state: "opened", have: 31, need: 20, target: 30, opened_at: AT } });
  assert.ok(g && g.kind === "gate");
  assert.deepEqual(Object.keys(g).sort(), ["have", "kind", "need", "note", "opened", "pct", "rail", "target", "title"]);
  assert.match(g.note, /only the count/);
});

// ── receipts trace to real events ────────────────────────────────────────────────────────────────

test("a receipt with no canon event behind it is never invented", () => {
  const t = buildVentureThread(input({ canon: [] }));
  assert.equal(t.messages.filter((m) => m.kind === "receipt").length, 0);
});

test("an unrecognised event renders its own type rather than a made-up sentence", () => {
  const r = receiptFor({ at: AT, type: "something-new", id: "v/something-new", fields: {} });
  assert.equal(r.text, "something-new: v/something-new");
});

test("receipts render oldest first, in the order canon recorded them", () => {
  const t = buildVentureThread(
    input({
      canon: [
        { at: NOW, type: "pace-recorded", id: "v/pace", fields: {} },
        { at: AT, type: "kickoff", id: "v/kickoff", fields: {} },
      ],
    })
  );
  const receipts = t.messages.filter((m) => m.kind === "receipt");
  assert.deepEqual(receipts.map((r) => (r.kind === "receipt" ? r.at : "")), [AT, NOW]);
});

// ── decisions ────────────────────────────────────────────────────────────────────────────────────

function decision(over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decision_id: "p1-platform-01",
    decision_kind: "platform-recommendation",
    rules_version: "r1",
    input_refs: [],
    candidates: [
      { candidate_id: "substack", label: "Substack", scores: { fit: 5 }, evidence_refs: [], rationale: "already writes there" },
      { candidate_id: "linkedin", label: "LinkedIn", scores: { fit: 2 }, evidence_refs: [], rationale: "bigger room" },
    ],
    recommended_candidate_ids: ["substack"],
    selected_candidate_ids: [],
    selected_by: null,
    override_reason: null,
    rationale: null,
    status: "awaiting_user",
    created_at: AT,
    decided_at: null,
    ...over,
  };
}

test("an undecided decision reads as live, and a decided one does not", () => {
  const [live] = msgs("choice", { decisions: [decision()] });
  assert.ok(live && live.kind === "choice");
  assert.equal(live.live, true);
  const [settled] = msgs("choice", { decisions: [decision({ status: "selected", selected_candidate_ids: ["substack"], selected_by: "muxin" })] });
  assert.ok(settled && settled.kind === "choice");
  assert.equal(settled.live, false);
  assert.equal(settled.items.find((i) => i.candidateId === "substack")?.selected, true);
});

test("the recommendation and the selection are separate marks", () => {
  const [c] = msgs("choice", { decisions: [decision({ status: "selected", selected_candidate_ids: ["linkedin"], override_reason: "my people are there" })] });
  assert.ok(c && c.kind === "choice");
  const substack = c.items.find((i) => i.candidateId === "substack")!;
  const linkedin = c.items.find((i) => i.candidateId === "linkedin")!;
  assert.deepEqual([substack.recommended, substack.selected], [true, false]);
  assert.deepEqual([linkedin.recommended, linkedin.selected], [false, true]);
  assert.equal(c.overrideReason, "my people are there");
  assert.equal(c.rulesVersion, "r1");
});

test("the live decision sits last, closest to Muxin", () => {
  const t = buildVentureThread(
    input({
      decisions: [decision({ decision_id: "d-live" }), decision({ decision_id: "d-done", status: "selected", selected_candidate_ids: ["substack"] })],
    })
  );
  const ids = t.messages.filter((m) => m.kind === "choice").map((m) => (m.kind === "choice" ? m.decisionId : ""));
  assert.deepEqual(ids, ["d-done", "d-live"]);
});

// ── checkpoints ──────────────────────────────────────────────────────────────────────────────────

test("the checkpoint shown belongs to the phase she is IN, never a stale earlier one", () => {
  const all = { "checkpoint-1": checkpoint(), "checkpoint-2": checkpoint(), "checkpoint-3": checkpoint() };
  assert.equal(openCheckpointId(state({ current_phase: 2, checkpoints: all })), "checkpoint-2");
  // The bug a live read caught: a Phase 4 venture whose checkpoint-1 was never marked cleared used
  // to render "CHECKPOINT 1 · 0 OF 0 LIVE" as the thing blocking her.
  assert.equal(openCheckpointId(state({ current_phase: 4, checkpoints: all })), null);
  assert.equal(openCheckpointId(state({ current_phase: 3, checkpoints: all })), "checkpoint-3");
  assert.equal(openCheckpointId(state({ current_phase: 1, checkpoints: {} })), null);
});

test("Phase 4 renders no checkpoint at all — there is no checkpoint-4", () => {
  const t = buildVentureThread(input({ state: state({ current_phase: 4, checkpoints: { "checkpoint-1": checkpoint(), "checkpoint-3": checkpoint({ cleared: true }) } }) }));
  assert.equal(t.messages.filter((m) => m.kind === "checkpoint").length, 0);
});

test("checkpoint 3 renders its required decisions, which the prototype's four artifact rows could not", () => {
  const cp = checkpoint({
    decisions_required_count: 3,
    decisions_complete_count: 1,
    blocking: [
      { artifact_id: null, reason: 'missing required decision kind "transformation-choice"' },
      { artifact_id: null, reason: 'missing required decision kind "product-format-and-price"' },
    ],
  });
  const [m] = buildVentureThread(input({ state: state({ current_phase: 3, checkpoints: { "checkpoint-3": cp } }) })).messages.filter((x) => x.kind === "checkpoint");
  assert.ok(m && m.kind === "checkpoint");
  assert.equal(m.decisions.length, 3);
  assert.equal(m.decisions.filter((d) => !d.selected).length, 2);
  assert.match(m.decisions[0].kind, /1 of 3 decisions made/);
});

test("a checkpoint with no decision requirement renders no decision rows", () => {
  const [m] = buildVentureThread(input({ state: state({ checkpoints: { "checkpoint-1": checkpoint({ required_count: 0 }) } }) })).messages.filter((x) => x.kind === "checkpoint");
  assert.ok(m && m.kind === "checkpoint");
  assert.deepEqual(m.decisions, []);
});

// ── her words ────────────────────────────────────────────────────────────────────────────────────

test("the transcript renders her answers verbatim, keyed by the backend's ids", () => {
  const [q] = msgs("quotes", { answers: { q1: "help people vote on local measures", q18: "Substack" } });
  assert.ok(q && q.kind === "quotes");
  assert.deepEqual(q.lines.map((l) => l.answer), ["help people vote on local measures", "Substack"]);
  assert.equal(q.lines[0].question, QUESTION_DISPLAY.q1.question);
  assert.deepEqual(q.lines.map((l) => l.anchor), ["q-q1", "q-q18"]);
});

test("no intake means no transcript, rather than 25 blank rows", () => {
  assert.equal(msgs("quotes").length, 0);
  assert.equal(msgs("quotes", { answers: {} }).length, 0);
});

test("the context rail quotes her words and jumps to them, and never quotes anything else", () => {
  const groups = railGroups(
    { q1: "help people vote", q18: "Substack" },
    [decision({ status: "selected", selected_candidate_ids: ["linkedin"], override_reason: "my people are there" })],
    [artifact({ artifact_id: "a", title: "a live post", delivery_status: "live_confirmed", evidence: ev("url", "https://x.test/a") })]
  );
  const words = groups.find((g) => g.name === "YOUR WORDS")!;
  assert.equal(words.items.every((i) => i.isQuote && i.jumpTo?.startsWith("q-")), true);
  for (const g of groups.filter((x) => x.name !== "YOUR WORDS")) {
    assert.equal(g.items.some((i) => i.isQuote), false, `${g.name} must not render in her register`);
  }
  // Every rail item names where it came from — a claim never renders bare.
  assert.equal(groups.every((g) => g.items.every((i) => i.from.length > 0)), true);
  assert.match(groups.find((g) => g.name === "DECIDED")!.items[0].from, /you overrode the recommendation/);
  assert.equal(groups.find((g) => g.name === "LIVE")!.items[0].from, "↗ LINK");
});

test("the rail shows only groups that have something in them", () => {
  assert.deepEqual(railGroups(null, [], []), []);
});

// ── the whole thread ─────────────────────────────────────────────────────────────────────────────

test("the thread is derived: with no data at all it is just where the venture is", () => {
  const t = buildVentureThread(input());
  assert.deepEqual(t.messages.map((m) => m.kind), ["rail", "said", "rail", "checkpoint"]);
  assert.equal(t.elapsedDays, null);
  assert.deepEqual(t.rail, []);
});

test("the thread carries no artifact body text, only the path to it", () => {
  const a = artifact({ artifact_id: "x", body_path: "phase-1-attention/x.md" });
  const t = buildVentureThread(input({ artifacts: [a], state: state() }));
  const card = t.messages.find((m) => m.kind === "card");
  assert.ok(card && card.kind === "card");
  assert.equal(card.bodyPath, "phase-1-attention/x.md");
  assert.equal(card.drafted, true);
  // No `body` field exists at all: the builder never reads the file, so it can never quote it.
  assert.equal("body" in card, false);
});

test("only the current phase's cards are drawn, so the thread does not grow without bound", () => {
  const t = buildVentureThread(
    input({
      state: state({ current_phase: 2 }),
      artifacts: [artifact({ artifact_id: "old", venture_phase: 1 }), artifact({ artifact_id: "now", venture_phase: 2 })],
    })
  );
  const ids = t.messages.filter((m) => m.kind === "card").map((m) => (m.kind === "card" ? m.artifactId : ""));
  assert.deepEqual(ids, ["now"]);
});

// ── the client mirror (port-rules Rule 5) ────────────────────────────────────────────────────────

test("the two page.ts helpers ship to the browser as mirrors, and the room uses them", () => {
  const src = readFileSync(join(HERE, "page.ts"), "utf8");
  for (const line of [
    'function vDot(tone){',
    'if (tone === "green") return "#2f7d46";',
    'function vDayLine(elapsedDays){',
    'return elapsedDays === 0 ? "started today" : "day " + (elapsedDays + 1) + " since kickoff";',
  ]) {
    assert.ok(src.includes(line), `the browser mirror drifted: ${line}`);
  }
  assert.ok(src.includes('$("#ventureDay").textContent = vDayLine(t.elapsedDays);'), "renderVenture must use the day mirror");
});

// ── the write side's view model ──────────────────────────────────────────────────────────────────
//
// Every control the room draws comes from here, so "would this button be refused?" is answerable
// without a browser. The rule these enforce: a control exists only where a route exists AND the
// server would not refuse it outright.

const MIN_EVIDENCE: Record<string, "url" | "agent" | "attestation" | null> = {
  "substack-post": "url",
  "text-post-note": "agent",
  "welcome-email": "attestation",
  "product-outline": null,
};

function actions(over: Partial<VentureArtifact>): string[] {
  return cardActions(artifact({ artifact_id: "x", ...over }), MIN_EVIDENCE).map((a) => a.id);
}

test("every action a card offers maps to a route that exists", () => {
  const routed = new Set(CARD_ACTION_IDS as readonly string[]);
  const pairs: Partial<VentureArtifact>[] = [
    { editorial_status: "draft", delivery_status: "awaiting_approval" },
    { editorial_status: "draft", delivery_status: "not_applicable" },
    { editorial_status: "approved", delivery_status: "ready" },
    { editorial_status: "approved", delivery_status: "handed_off" },
    { editorial_status: "approved", delivery_status: "handed_off", delivery_mode: "app" },
    { editorial_status: "approved", delivery_status: "live_confirmed" },
    { editorial_status: "approved", delivery_status: "failed" },
    { editorial_status: "approved", delivery_status: "not_applicable" },
    { editorial_status: "discarded", delivery_status: "cancelled" },
  ];
  for (const p of pairs) {
    for (const id of actions(p)) assert.ok(routed.has(id), `${JSON.stringify(p)} offers ${id}, which has no route`);
  }
});

test("an app-mode hand-off offers no confirm-live, because the server would refuse it outright", () => {
  // §2.2's app row lists "Confirm live", but confirmManualDelivery throws "is not a manual-delivery
  // artifact" for anything whose delivery_mode is not manual -- the AGENT confirms those. Drawing
  // the button would be a control backed by a guaranteed refusal.
  assert.ok(!actions({ editorial_status: "approved", delivery_status: "handed_off", delivery_mode: "app" }).includes("confirm-live"));
  assert.ok(actions({ editorial_status: "approved", delivery_status: "handed_off", delivery_mode: "manual" }).includes("confirm-live"));
});

test("confirm-live asks for the proof the artifact kind's own floor demands", () => {
  const forKind = (kind: string) =>
    cardActions(artifact({ artifact_id: "x", artifact_kind: kind as VentureArtifact["artifact_kind"], editorial_status: "approved", delivery_status: "handed_off" }), MIN_EVIDENCE)
      .find((a) => a.id === "confirm-live")?.proof;
  assert.equal(forKind("substack-post"), "url");
  assert.equal(forKind("welcome-email"), "attestation");
  // A kind with no floor is never delivered by hand at all, so there is nothing to confirm.
  assert.equal(forKind("product-outline"), undefined);
});

test("a live artifact offers only the takedown, and a draft never offers it", () => {
  assert.deepEqual(actions({ editorial_status: "approved", delivery_status: "live_confirmed" }), ["retract"]);
  assert.ok(!actions({ editorial_status: "draft", delivery_status: "awaiting_approval" }).includes("retract"));
});

test("a failed delivery offers give-up but never a Retry with nothing behind it", () => {
  // §2.2 lists Retry; re-delivery runs through deliverVenture, which is deliberately not routed.
  assert.deepEqual(actions({ editorial_status: "approved", delivery_status: "failed" }), ["discard"]);
});

test("the destructive actions are marked, so the room can ask first", () => {
  const live = cardActions(artifact({ artifact_id: "x", editorial_status: "approved", delivery_status: "live_confirmed" }), MIN_EVIDENCE);
  assert.equal(live[0].destructive, true);
  const draft = cardActions(artifact({ artifact_id: "x" }), MIN_EVIDENCE);
  assert.equal(draft.find((a) => a.id === "approve")?.destructive, undefined);
  assert.equal(draft.find((a) => a.id === "discard")?.destructive, true);
});

test("the override-discipline list matches decisions.ts's own, exactly", () => {
  // venture-thread.ts cannot value-import the real constant (decisions.ts reaches the filesystem and
  // this module must stay importable by fixtures.ts), so it holds a copy. A test may import
  // anything, so this is where the two are held together.
  const mine = new Set<string>();
  for (const kind of OVERRIDE_SELECT_KINDS) {
    mine.add(kind);
    assert.equal(choiceFor(decision({ decision_kind: kind })).overrideDiscipline, true, `${kind} should carry the override discipline`);
  }
  for (const kind of ["idea-ranking", "transformation-choice", "day-14-decision"] as const) {
    assert.equal(mine.has(kind), false);
    assert.equal(choiceFor(decision({ decision_kind: kind })).overrideDiscipline, false, `${kind} has no recommendation to override`);
  }
});

test("an empty recommendation set makes every option an override, matching the server", () => {
  // selectWithOverride: isOverride = !recommended_candidate_ids.includes(id). With an empty list
  // that is true for everything. The prototype let a selection through with no reason here.
  const c = choiceFor(decision({ recommended_candidate_ids: [] }));
  assert.equal(c.overrideDiscipline, true);
  assert.equal(c.items.every((i) => !i.recommended), true);
});

test("the Day 14 panel exists before its record does, with rules.yaml's own options", () => {
  const withReview = state({
    current_phase: 4,
    phase4: {
      operating_plan: { drafted: true, approved: true },
      thank_you_notes_count: 0,
      day_14_review: { drafted: true, approved: true },
      day_14_decision: { made: false, candidate_id: null },
      complete: false,
      blocking: [],
    },
  });
  const [c] = msgs("choice", { state: withReview });
  assert.ok(c && c.kind === "choice");
  assert.equal(c.decisionId, "p4-day-14-decision");
  assert.equal(c.recordExists, false);
  assert.equal(c.reasonAlwaysRequired, true, "rules.md §8.5 requires a reason for every option");
  assert.equal(c.overrideDiscipline, false, "the system never recommends one of these");
  assert.deepEqual(c.items.map((i) => i.candidateId), ["continue", "revise_positioning", "revise_lead_magnet", "collect_more_evidence", "stop"]);
});

test("the Day 14 panel is absent before the review is approved, and once the decision is made", () => {
  const p4 = (review: boolean, made: boolean) =>
    state({
      current_phase: 4,
      phase4: {
        operating_plan: { drafted: true, approved: true },
        thank_you_notes_count: 0,
        day_14_review: { drafted: true, approved: review },
        day_14_decision: { made, candidate_id: made ? "continue" : null },
        complete: false,
        blocking: [],
      },
    });
  assert.equal(msgs("choice", { state: p4(false, false) }).length, 0);
  assert.equal(msgs("choice", { state: p4(true, true) }).length, 0);
});

test("the clear button starts enabled only when every row is live and every decision is made", () => {
  const live = artifact({ artifact_id: "l", editorial_status: "approved", delivery_status: "live_confirmed", evidence: ev("url", "https://x.test/a") });
  const notLive = artifact({ artifact_id: "n", editorial_status: "approved", delivery_status: "handed_off" });
  const cpFor = (req: VentureArtifact[], over: Partial<CheckpointState> = {}) =>
    buildVentureThread(input({ state: state({ checkpoints: { "checkpoint-1": checkpoint({ required: req, required_count: req.length, ...over }) } }), artifacts: req }))
      .messages.find((m) => m.kind === "checkpoint") as { canClear: boolean; needsPace: boolean };
  assert.equal(cpFor([live]).canClear, true);
  assert.equal(cpFor([live, notLive]).canClear, false);
  assert.equal(cpFor([live], { decisions_required_count: 2, decisions_complete_count: 1 }).canClear, false);
  // An empty checkpoint cannot be cleared into existence.
  assert.equal(cpFor([]).canClear, false);
});

test("the pace control appears only where the checkpoint actually demands a pace", () => {
  const live = artifact({ artifact_id: "l", editorial_status: "approved", delivery_status: "live_confirmed", evidence: ev("url", "https://x.test/a") });
  const cp = (blocking: { artifact_id: string | null; reason: string }[], paceRecorded: boolean) =>
    buildVentureThread(
      input({ state: state({ checkpoints: { "checkpoint-1": checkpoint({ required: [live], required_count: 1, blocking, pace_recorded: paceRecorded }) } }), artifacts: [live] })
    ).messages.find((m) => m.kind === "checkpoint") as { needsPace: boolean; canClear: boolean };
  // checkpoint-2 and 3 never demand one, and pace_recorded is false on them forever.
  assert.equal(cp([], false).needsPace, false);
  assert.equal(cp([{ artifact_id: null, reason: "posting pace not recorded -- run recordPace first" }], false).needsPace, true);
  assert.equal(cp([{ artifact_id: null, reason: "posting pace not recorded -- run recordPace first" }], false).canClear, false);
});

test("only a research read carries findings, and only its emergent ones", () => {
  const read = artifact({
    artifact_id: "p1-read",
    artifact_kind: "phase_1_research_read",
    fields: {
      findings: [
        { finding_id: "e1", finding_origin: "emergent", emergent_description: "people skip the down-ballot", lead_magnet_implications: "the guide should start there", signal_quality: "strong", muxin_confirmed_emergent: null },
        { finding_id: "p1", finding_origin: "planned", emergent_description: "planned one" },
      ],
    },
  });
  const card = buildVentureThread(input({ artifacts: [read] })).messages.find((m) => m.kind === "card");
  assert.ok(card && card.kind === "card");
  assert.equal(card.findings?.length, 1);
  assert.equal(card.findings?.[0].findingId, "e1");
  assert.equal(card.findings?.[0].confirmed, null, "not yet ruled on is its own state, not false");
  assert.equal(card.findings?.[0].signalQuality, "strong");
  // Every other kind has none at all, so the panel is absent rather than empty.
  const plain = buildVentureThread(input({ artifacts: [artifact({ artifact_id: "x" })] })).messages.find((m) => m.kind === "card");
  assert.equal(plain?.kind === "card" ? plain.findings : "wrong", null);
});

test("a finding note is never invented when the read did not write one", () => {
  const read = artifact({
    artifact_id: "p1-read",
    artifact_kind: "phase_1_research_read",
    fields: { findings: [{ finding_id: "e1", finding_origin: "emergent" }] },
  });
  const card = buildVentureThread(input({ artifacts: [read] })).messages.find((m) => m.kind === "card");
  assert.equal(card?.kind === "card" ? card.findings?.[0].note : "wrong", "");
});

// ── the client mirrors, again (Rule 5) ───────────────────────────────────────────────────────────

test("the write layer ships to the browser, and refetches the whole thread rather than patching", () => {
  const src = readFileSync(join(HERE, "page.ts"), "utf8");
  assert.ok(src.includes("await loadVenture();"), "a successful write must refetch the thread");
  // The dispatch the wiring guard checks for, and the one that keeps the state machine server-side.
  assert.ok(src.includes('"/artifacts/"+encodeURIComponent(artifactId)+"/"+action.id'));
  // The refusal path: the server's sentence is what renders, never a rewritten one.
  assert.ok(src.includes("ventureOpen.error = j.error"), "a refusal must carry the server's own message");
  assert.ok(src.includes('class="vrefusal"'), "the refusal must render next to the control");
  // needsReason reads the server's recommendation, not source order.
  assert.ok(src.includes("function vNeedsReason(choice, item){"));
  assert.ok(src.includes("return !!choice.overrideDiscipline && !item.recommended;"));
});

test("a settled decision offers no control, because a second selection is refused", () => {
  const src = readFileSync(join(HERE, "page.ts"), "utf8");
  assert.ok(src.includes("const pick = m.live ?"), "only a live decision is clickable");
});
