import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alreadyUses,
  findSpan,
  fitFrame,
  proposeOpening,
  rankFits,
  slotSignal,
  type FrameFit,
  type SlotEvidence,
} from "./hook-frame-fit.js";

// All draft fixtures below are invented for this test file, obviously synthetic. None of the
// wording is drawn from docs/content-studio-program/creator-content/, which this file never opens.

// --- slotSignal --------------------------------------------------------------------------------

test("slotSignal maps duration, ongoing-state, and belief signals, checking belief-new first", () => {
  assert.equal(slotSignal("timespan"), "duration");
  assert.equal(slotSignal("duration"), "duration");
  assert.equal(slotSignal("state"), "ongoing-state");
  // Order matters: new_belief must come back belief-new, not fall through to belief-old.
  assert.equal(slotSignal("new_belief"), "belief-new");
  assert.notEqual(slotSignal("new_belief"), "belief-old");
  assert.equal(slotSignal("old_belief"), "belief-old");
});

test("slotSignal maps role, proper-name, and number signals", () => {
  assert.equal(slotSignal("role"), "role");
  assert.equal(slotSignal("credential"), "role");
  assert.equal(slotSignal("name"), "proper-name");
  assert.equal(slotSignal("number"), "number");
  assert.equal(slotSignal("percent"), "number");
  assert.equal(slotSignal("follower"), "number");
});

test("slotSignal maps question, purchase, action, frustration, and shared-experience signals", () => {
  assert.equal(slotSignal("question"), "question");
  assert.equal(slotSignal("challenge"), "question");
  assert.equal(slotSignal("bought"), "purchase");
  assert.equal(slotSignal("purchase"), "purchase");
  assert.equal(slotSignal("action"), "action-taken");
  assert.equal(slotSignal("next_action"), "action-taken");
  assert.equal(slotSignal("tired"), "frustration");
  assert.equal(slotSignal("pain"), "frustration");
  assert.equal(slotSignal("experience"), "shared-experience");
  assert.equal(slotSignal("scenario"), "shared-experience");
  assert.equal(slotSignal("identity"), "shared-experience");
  assert.equal(slotSignal("audience"), "shared-experience");
});

test("slotSignal falls through to generic for an unrecognized name", () => {
  assert.equal(slotSignal("promise"), "generic");
  assert.equal(slotSignal("widget"), "generic");
});

// --- findSpan: duration ------------------------------------------------------------------------

test("findSpan duration matches a for-the-past phrasing and an ago phrasing", () => {
  assert.equal(findSpan("for the past two years", "duration"), "two years");
  assert.equal(findSpan("three years ago", "duration"), "three years");
});

test("findSpan duration does not match a bare start date", () => {
  assert.equal(findSpan("I've been posting on Substack since 2024.", "duration"), null);
});

// --- findSpan: ongoing-state ---------------------------------------------------------------

test("findSpan ongoing-state stops before a trailing duration cue and matches the I've contraction", () => {
  assert.equal(
    findSpan("I have been running weekly reviews for three years now", "ongoing-state"),
    "running weekly reviews",
  );
  assert.equal(findSpan("I've been writing essays every week.", "ongoing-state"), "writing essays every week");
});

// --- findSpan: belief-old / belief-new -----------------------------------------------------

test("findSpan belief-old matches a used-to-think reversal", () => {
  assert.equal(findSpan("I used to think a backlog was a plan.", "belief-old"), "a backlog was a plan");
});

test("findSpan belief-new keeps the verb after a sentence-initial Now but not a mid-sentence now", () => {
  assert.equal(
    findSpan("Now I see it as a list of things nobody decided.", "belief-new"),
    "I see it as a list of things nobody decided",
  );
  assert.equal(findSpan("I am now writing more.", "belief-new"), null);
});

// --- findSpan: role ------------------------------------------------------------------------

test("findSpan role matches an as-a opener and an I-am-a opener", () => {
  assert.equal(findSpan("As a product manager, I ship things weekly.", "role"), "product manager");
  assert.equal(findSpan("I am a staff engineer, and I like it.", "role"), "staff engineer");
});

test("findSpan role screens out list so a belief-new sentence does not read as a role", () => {
  assert.equal(findSpan("Now I see it as a list of things nobody decided.", "role"), null);
});

// --- findSpan: proper-name -----------------------------------------------------------------

test("findSpan proper-name finds a two-word capitalized name mid-sentence and null when there is none", () => {
  assert.equal(
    findSpan("I met with Jordan Rivera yesterday to plan the launch.", "proper-name"),
    "Jordan Rivera",
  );
  assert.equal(findSpan("I write about product management every week.", "proper-name"), null);
});

// --- findSpan: number ------------------------------------------------------------------------

test("findSpan number matches a plain count and a count with a percent suffix", () => {
  assert.equal(findSpan("We reached 500 subscribers this month.", "number"), "500");
  assert.equal(findSpan("Open rates hit 42% this week.", "number"), "42%");
});

// --- findSpan: question, purchase -----------------------------------------------------------

test("findSpan question matches a question, and purchase matches a bought sentence", () => {
  assert.equal(
    findSpan("What if the real problem was never the backlog?", "question"),
    "What if the real problem was never the backlog?",
  );
  assert.equal(
    findSpan("I just bought a new standing desk for my office.", "purchase"),
    "a new standing desk for my office",
  );
});

// --- findSpan: action-taken, frustration -----------------------------------------------------

test("findSpan action-taken matches a so-I response, and frustration matches a got-tired-of complaint", () => {
  assert.equal(
    findSpan("The tool kept crashing, so I switched to a simpler tracker.", "action-taken"),
    "switched to a simpler tracker",
  );
  assert.equal(
    findSpan("I got tired of rebuilding the same spreadsheet every month.", "frustration"),
    "rebuilding the same spreadsheet every month",
  );
});

// --- findSpan: shared-experience -----------------------------------------------------------

test("findSpan shared-experience matches an if-you've-ever appeal but not a purely first-person draft", () => {
  assert.equal(
    findSpan("If you've ever stared at a blank editor for an hour, you know the feeling.", "shared-experience"),
    "stared at a blank editor for an hour",
  );
  assert.equal(findSpan("I write every day and I ship what I finish.", "shared-experience"), null);
});

// --- findSpan: generic ---------------------------------------------------------------------

test("findSpan always returns null for the generic signal", () => {
  assert.equal(findSpan("Absolutely anything could be written here.", "generic"), null);
  assert.equal(findSpan("", "generic"), null);
});

// --- alreadyUses -----------------------------------------------------------------------------

test("alreadyUses is true when the draft contains every fixed run, contraction-insensitive", () => {
  assert.equal(
    alreadyUses("I've been building this habit for months now.", [["i", "have", "been"]]),
    true,
  );
});

test("alreadyUses is false when one fixed run is missing from the draft", () => {
  assert.equal(
    alreadyUses("I've been building this habit for months now.", [
      ["i", "have", "been"],
      ["every", "single", "week"],
    ]),
    false,
  );
});

test("alreadyUses is false when the template has no fixed run of 3 or more words", () => {
  assert.equal(alreadyUses("I've been building this habit for months now.", [["hi", "there"]]), false);
});

// --- fitFrame --------------------------------------------------------------------------------

const FITS_DRAFT = "As a product manager, I've been shipping weekly for three years now.";
const PARTIAL_DRAFT = "As a product manager, I ship weekly.";
const NO_MATERIAL_DRAFT = "I like software.";

test("fitFrame verdict is fits when every non-generic slot has a span", () => {
  const fit = fitFrame(FITS_DRAFT, { frameId: "f:fits", slots: ["role", "duration"], fixedRuns: [] });
  assert.equal(fit.verdict, "fits");
  assert.equal(fit.satisfied, 2);
  assert.equal(fit.unmet, 0);
});

test("fitFrame verdict is partial when some demanding slots have a span and some do not", () => {
  const fit = fitFrame(PARTIAL_DRAFT, { frameId: "f:partial", slots: ["role", "duration"], fixedRuns: [] });
  assert.equal(fit.verdict, "partial");
  assert.equal(fit.satisfied, 1);
  assert.equal(fit.unmet, 1);
});

test("fitFrame verdict is no-fit when no demanding slot has a span", () => {
  const fit = fitFrame(NO_MATERIAL_DRAFT, { frameId: "f:nofit", slots: ["role", "duration"], fixedRuns: [] });
  assert.equal(fit.verdict, "no-fit");
  assert.equal(fit.satisfied, 0);
  assert.equal(fit.unmet, 2);
});

test("fitFrame verdict is unverifiable when every slot is generic", () => {
  const fit = fitFrame(NO_MATERIAL_DRAFT, { frameId: "f:unverifiable", slots: ["promise", "widget"], fixedRuns: [] });
  assert.equal(fit.verdict, "unverifiable");
  assert.equal(fit.satisfied, 0);
  assert.equal(fit.unmet, 0);
  assert.equal(fit.generic, 2);
});

test("fitFrame satisfied, unmet, and generic always sum to the slot count", () => {
  const fit = fitFrame(FITS_DRAFT, {
    frameId: "f:counts",
    slots: ["role", "duration", "promise"],
    fixedRuns: [],
  });
  assert.equal(fit.satisfied + fit.unmet + fit.generic, fit.slots.length);
  assert.equal(fit.slots.length, 3);
});

test("fitFrame carries alreadyUsed through, true when the draft has the fixed wording and false when it does not", () => {
  const used = fitFrame(FITS_DRAFT, {
    frameId: "f:already-true",
    slots: ["role", "duration"],
    fixedRuns: [["as", "a", "product", "manager"]],
  });
  assert.equal(used.alreadyUsed, true);
  const unused = fitFrame(FITS_DRAFT, {
    frameId: "f:already-false",
    slots: ["role", "duration"],
    fixedRuns: [["completely", "different", "phrase", "here"]],
  });
  assert.equal(unused.alreadyUsed, false);
});

// --- proposeOpening ----------------------------------------------------------------------------

function fitFromSlots(slots: readonly SlotEvidence[], overrides: Partial<FrameFit> = {}): FrameFit {
  return {
    frameId: "f:propose",
    verdict: "partial",
    slots,
    satisfied: 0,
    unmet: 0,
    generic: 0,
    alreadyUsed: false,
    ...overrides,
  };
}

test("proposeOpening substitutes every span it finds and reports no unfilled slots", () => {
  const fit = fitFromSlots([
    { slot: "role", signal: "role", span: "product manager" },
    { slot: "duration", signal: "duration", span: "three years" },
  ]);
  const result = proposeOpening("As a {role}, for {duration} now.", fit);
  assert.equal(result.text, "As a product manager, for three years now.");
  assert.deepEqual(result.unfilled, []);
});

test("proposeOpening leaves {slot} in place and lists it in unfilled when the span is null", () => {
  const fit = fitFromSlots([
    { slot: "role", signal: "role", span: "product manager" },
    { slot: "duration", signal: "duration", span: null },
  ]);
  const result = proposeOpening("As a {role}, for {duration} now.", fit);
  assert.equal(result.text, "As a product manager, for {duration} now.");
  assert.deepEqual(result.unfilled, ["duration"]);
});

test("proposeOpening dedupes a slot name repeated in the template when it is unfilled", () => {
  const fit = fitFromSlots([{ slot: "role", signal: "role", span: null }]);
  const result = proposeOpening("Nobody tells you about {role} until {role} hits you.", fit);
  assert.equal(result.text, "Nobody tells you about {role} until {role} hits you.");
  assert.deepEqual(result.unfilled, ["role"]);
});

// --- rankFits ----------------------------------------------------------------------------------

function fit(overrides: Partial<FrameFit> = {}): FrameFit {
  return {
    frameId: "f:default",
    verdict: "fits",
    slots: [],
    satisfied: 0,
    unmet: 0,
    generic: 0,
    alreadyUsed: false,
    ...overrides,
  };
}

test("rankFits orders fits before partial before unverifiable before no-fit", () => {
  const noFit = fit({ frameId: "f:z-no-fit", verdict: "no-fit" });
  const fits = fit({ frameId: "f:a-fits", verdict: "fits" });
  const unverifiable = fit({ frameId: "f:b-unverifiable", verdict: "unverifiable" });
  const partial = fit({ frameId: "f:c-partial", verdict: "partial" });
  const result = rankFits([noFit, unverifiable, fits, partial]);
  assert.deepEqual(result.map((value) => value.frameId), ["f:a-fits", "f:c-partial", "f:b-unverifiable", "f:z-no-fit"]);
});

test("rankFits sinks an already-used frame below an unused frame even with a worse verdict", () => {
  const usedButFits = fit({ frameId: "f:used", verdict: "fits", alreadyUsed: true });
  const unusedButNoFit = fit({ frameId: "f:unused", verdict: "no-fit", alreadyUsed: false });
  const result = rankFits([usedButFits, unusedButNoFit]);
  assert.deepEqual(result.map((value) => value.frameId), ["f:unused", "f:used"]);
});

test("rankFits breaks a verdict tie by higher satisfied count", () => {
  const fewer = fit({ frameId: "f:fewer", verdict: "fits", satisfied: 1 });
  const more = fit({ frameId: "f:more", verdict: "fits", satisfied: 3 });
  const result = rankFits([fewer, more]);
  assert.deepEqual(result.map((value) => value.frameId), ["f:more", "f:fewer"]);
});

test("rankFits breaks a satisfied tie by frameId ascending", () => {
  const zeta = fit({ frameId: "f:zeta", verdict: "fits", satisfied: 2 });
  const alpha = fit({ frameId: "f:alpha", verdict: "fits", satisfied: 2 });
  const result = rankFits([zeta, alpha]);
  assert.deepEqual(result.map((value) => value.frameId), ["f:alpha", "f:zeta"]);
});
