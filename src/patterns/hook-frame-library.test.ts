import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkFrame,
  creatorFilesFromRefs,
  fillFrame,
  fixedRuns,
  fixedWords,
  HOOK_FRAME_LIBRARY_VERSION,
  parseHookFrame,
  readHookFrameLibrary,
  selectFrames,
  templateSlots,
  type HookFrame,
  type HookFrameLibrary,
} from "./hook-frame-library.js";

// Every checkFrame call below that is not specifically exercising the verbatim-scan-not-run
// finding supplies this, so the fail-closed backstop does not add an unrelated finding.
const NOOP_SCAN = { corpusContainsRun: (): boolean => false };

// All fixtures below are invented for this test file. None of the wording is drawn from
// docs/content-studio-program/creator-content/; every name, handle, and phrase is synthetic.

function frame(overrides: Partial<HookFrame> = {}): HookFrame {
  return {
    id: "frame:base",
    name: "Synthetic overlooked-risk opener",
    template: "Nobody warns you about {topic} until {consequence} happens.",
    slots: ["consequence", "topic"],
    whenToUse: "Use when opening a piece about a risk nobody flags in advance.",
    platforms: ["linkedin", "x"],
    topics: ["synthetic-topic-one"],
    support: {
      instances: 3,
      distinctCreatorFiles: 2,
      rankedInstances: 3,
      topQuartileInstances: 1,
    },
    // Two distinct creator files (a twice, b once), matching support.distinctCreatorFiles below.
    // checkFrame now derives the creator count from these refs, so the fixture has to agree with
    // itself or every test built on it trips a spurious support-arithmetic finding.
    sourceRefs: [
      "synthetic-creator-a.md#entry-1-1",
      "synthetic-creator-a.md#entry-1-2",
      "synthetic-creator-b.md#entry-1-1",
    ],
    review: "approved",
    originality: "passed",
    adaptationNote: "Fill topic and consequence from her own material only; nothing borrowed.",
    ...overrides,
  };
}

function rawFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "frame:raw-base",
    name: "Synthetic parse-check opener",
    template: "Nobody warns you about {topic} until {consequence} happens.",
    slots: ["topic", "consequence"],
    whenToUse: "Use for a synthetic parse-check scenario.",
    platforms: ["linkedin", "x"],
    topics: ["synthetic-topic-one"],
    support: { instances: 3, distinctCreatorFiles: 2, rankedInstances: 3, topQuartileInstances: 1 },
    sourceRefs: [
      "synthetic-creator-a.md#entry-1-1",
      "synthetic-creator-b.md#entry-1-1",
      "synthetic-creator-c.md#entry-1-1",
    ],
    review: "approved",
    originality: "passed",
    adaptationNote: "Fill topic and consequence from her own material only.",
    ...overrides,
  };
}

function library(frames: readonly HookFrame[]): HookFrameLibrary {
  return { kind: "hook_frame_library", version: HOOK_FRAME_LIBRARY_VERSION, frames, findings: [] };
}

function jsonl(...values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n");
}

// --- templateSlots / fixedWords / fixedRuns -------------------------------------------------

test("templateSlots preserves first-occurrence order, collapses duplicates, and returns none for a slot-free template", () => {
  assert.deepEqual(templateSlots("{beta} and {alpha} then {beta} again"), ["beta", "alpha"]);
  assert.deepEqual(templateSlots("no slots here at all"), []);
});

test("fixedWords removes slots and strips surrounding punctuation", () => {
  assert.deepEqual(fixedWords("Say {word} now!"), ["Say", "now"]);
  assert.deepEqual(fixedWords("Wait, {x}: really?"), ["Wait", "really"]);
});

test("fixedRuns splits at slots, drops empty boundary runs, and lowercases", () => {
  assert.deepEqual(fixedRuns("UPPER {x} middle {y} CASE"), [["upper"], ["middle"], ["case"]]);
  assert.deepEqual(fixedRuns("{x} only end"), [["only", "end"]]);
});

test("creatorFilesFromRefs dedupes and sorts the file portion of each ref", () => {
  assert.deepEqual(
    creatorFilesFromRefs(["b.md#entry-2-1", "a.md#entry-1-1", "a.md#entry-1-2", "b.md#entry-2-1"]),
    ["a.md", "b.md"],
  );
  assert.deepEqual(creatorFilesFromRefs([]), []);
});

// --- checkFrame: one finding kind at a time -------------------------------------------------

test("checkFrame reports slot-syntax for a malformed brace group", () => {
  const bad = frame({
    template: "Bring your {Bad Slot} and {topic} out now.",
    slots: ["topic"],
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["slot-syntax"]);
});

test("checkFrame reports slot-mismatch when declared slots disagree with the template", () => {
  const bad = frame({ slots: ["topic", "extra_slot"] });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["slot-mismatch"]);
});

test("checkFrame reports too-few-fixed-words when almost nothing is fixed", () => {
  const bad = frame({ template: "{topic} {consequence}.", slots: ["consequence", "topic"] });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["too-few-fixed-words"]);
});

test("checkFrame reports claim-word for a performance claim like proven", () => {
  const bad = frame({
    whenToUse: "Use when you already have proven language that generalizes across creators.",
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["claim-word"]);
});

test("checkFrame reports claim-word for a performance claim inside the frame id", () => {
  const bad = frame({ id: "frame:proven-opener" });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["claim-word"]);
});

test("checkFrame reports claim-word for a performance claim inside topics", () => {
  const bad = frame({ topics: ["synthetic-topic-one", "viral-openers"] });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["claim-word"]);
});

test("checkFrame reports em-dash for a dash character in the frame prose", () => {
  const bad = frame({
    whenToUse: "Use when connecting two ideas\u2014like cause and effect.",
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["em-dash"]);
});

test("checkFrame reports url for a link in the frame prose", () => {
  const bad = frame({
    whenToUse: "See www.example.com before adapting this opener template.",
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["url"]);
});

test("checkFrame reports creator-name when a two-word creator name appears", () => {
  const bad = frame({
    adaptationNote: "Never copy Jordan Rivera's phrasing; use her own material only.",
  });
  const findings = checkFrame(bad, { ...NOOP_SCAN, creatorNames: ["Jordan Rivera"] });
  assert.deepEqual(findings.map((finding) => finding.kind), ["creator-name"]);
});

test("checkFrame reports handle when a creator handle appears", () => {
  const bad = frame({
    adaptationNote: "Do not copy synthcreator1's exact wording here.",
  });
  const findings = checkFrame(bad, { ...NOOP_SCAN, handles: ["@synthcreator1"] });
  assert.deepEqual(findings.map((finding) => finding.kind), ["handle"]);
});

test("checkFrame reports insufficient-creators below the minimum distinct creator files", () => {
  // All three refs point at the same file, so the ref-derived count -- the thing checkFrame
  // actually trusts now -- is 1, regardless of what support.distinctCreatorFiles claims.
  const bad = frame({
    support: { instances: 3, distinctCreatorFiles: 1, rankedInstances: 3, topQuartileInstances: 1 },
    sourceRefs: [
      "synthetic-creator-a.md#entry-1-1",
      "synthetic-creator-a.md#entry-1-2",
      "synthetic-creator-a.md#entry-1-3",
    ],
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["insufficient-creators"]);
});

test("checkFrame reports support-arithmetic when distinctCreatorFiles disagrees with the refs", () => {
  // The bank claims 2 creators, but every ref shares one file: the refs are the load-bearing
  // count now, so this is both too few creators AND a bank number that does not match its refs.
  const bad = frame({
    support: { instances: 3, distinctCreatorFiles: 2, rankedInstances: 3, topQuartileInstances: 1 },
    sourceRefs: [
      "synthetic-creator-a.md#entry-1-1",
      "synthetic-creator-a.md#entry-1-2",
      "synthetic-creator-a.md#entry-1-3",
    ],
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind).sort(), ["insufficient-creators", "support-arithmetic"]);
  assert.ok(
    findings.some(
      (finding) => finding.kind === "support-arithmetic" && /distinctCreatorFiles claims 2, the refs span 1/.test(finding.detail),
    ),
  );
});

test("checkFrame reports support-arithmetic for each impossible relationship in support", () => {
  // Overstating distinctCreatorFiles above what the refs actually span. Since the refs are now the
  // ground truth for creator count, this necessarily reads as both "too few creators" (the refs
  // really do span only one file) and "the bank's number disagrees with its own refs".
  const instancesBelowCreators = frame({
    support: { instances: 1, distinctCreatorFiles: 2, rankedInstances: 1, topQuartileInstances: 1 },
    sourceRefs: ["synthetic-creator-a.md#entry-1-1"],
  });
  const findingsA = checkFrame(instancesBelowCreators, NOOP_SCAN);
  assert.deepEqual(findingsA.map((finding) => finding.kind), ["insufficient-creators", "support-arithmetic", "support-arithmetic"]);
  assert.ok(findingsA.some((finding) => /distinctCreatorFiles claims 2, the refs span 1/.test(finding.detail)));
  assert.ok(findingsA.some((finding) => /instances cannot be fewer than the distinct creator files/.test(finding.detail)));

  const rankedAboveInstances = frame({
    support: { instances: 2, distinctCreatorFiles: 2, rankedInstances: 3, topQuartileInstances: 1 },
    sourceRefs: ["synthetic-creator-a.md#entry-1-1", "synthetic-creator-b.md#entry-1-1"],
  });
  assert.deepEqual(checkFrame(rankedAboveInstances, NOOP_SCAN).map((finding) => finding.kind), ["support-arithmetic"]);

  // 3 refs across exactly 2 distinct files, matching the declared distinctCreatorFiles, so the
  // only violation left is the topQuartile-above-ranked relationship.
  const topQuartileAboveRanked = frame({
    support: { instances: 3, distinctCreatorFiles: 2, rankedInstances: 1, topQuartileInstances: 2 },
    sourceRefs: [
      "synthetic-creator-a.md#entry-1-1",
      "synthetic-creator-a.md#entry-1-2",
      "synthetic-creator-b.md#entry-1-1",
    ],
  });
  assert.deepEqual(checkFrame(topQuartileAboveRanked, NOOP_SCAN).map((finding) => finding.kind), ["support-arithmetic"]);

  // 2 refs (still 2 distinct files, matching distinctCreatorFiles) against a claimed instances of 3
  // -- only the source-refs-vs-instances relationship is violated.
  const refsMismatch = frame({
    sourceRefs: ["synthetic-creator-a.md#entry-1-1", "synthetic-creator-b.md#entry-1-1"],
  });
  assert.deepEqual(checkFrame(refsMismatch, NOOP_SCAN).map((finding) => finding.kind), ["support-arithmetic"]);
});

test("checkFrame reports unusable-template for a template with no slots", () => {
  const bad = frame({
    template: "This opener has no fillable slot at all today.",
    slots: [],
  });
  const findings = checkFrame(bad, NOOP_SCAN);
  assert.deepEqual(findings.map((finding) => finding.kind), ["unusable-template"]);
});

test("checkFrame reports unusable-template when an 8-word fixed run matches the corpus verbatim", () => {
  const bad = frame({
    template: "{opener} this specific exact phrase should appear nowhere else.",
    slots: ["opener"],
  });
  const findings = checkFrame(bad, { corpusContainsRun: () => true });
  assert.deepEqual(findings.map((finding) => finding.kind), ["unusable-template"]);
});

test("checkFrame catches a distinctive sentence broken up by slots via the collapsed fixed-words scan", () => {
  // Every individual run here is well under 8 words, so the per-run scan alone would miss this.
  // Only the fixed words collapsed back together (slots closed up) forms the 8-word window that
  // corpusContainsRun below is keyed to accept.
  const bad = frame({
    template:
      "This {one} specific {two} exact {three} phrase {four} should {five} appear {six} nowhere {seven} else {eight} today.",
    slots: ["one", "two", "three", "four", "five", "six", "seven", "eight"],
  });
  const findings = checkFrame(bad, {
    corpusContainsRun: (words) => words.join(" ") === "this specific exact phrase should appear nowhere else",
  });
  assert.deepEqual(findings.map((finding) => finding.kind), ["unusable-template"]);
});

test("checkFrame returns no findings for a clean valid frame", () => {
  assert.deepEqual(checkFrame(frame(), NOOP_SCAN), []);
});

test("checkFrame reports verbatim-scan-not-run when no corpusContainsRun is supplied", () => {
  // Fail closed: an otherwise-clean frame gets exactly this one finding when the caller never
  // wired up the verbatim backstop, never silently zero findings.
  const findings = checkFrame(frame());
  assert.deepEqual(findings.map((finding) => finding.kind), ["verbatim-scan-not-run"]);
});

test("checkFrame creator-name matching does not fire on a single generic word", () => {
  const clean = frame({
    whenToUse: "Use this the way Riley would phrase it, only as a generic pattern.",
  });
  assert.deepEqual(checkFrame(clean, { ...NOOP_SCAN, creatorNames: ["Riley"] }), []);
});

test("checkFrame creator-name matches a distinctive single-token name but not a common single token", () => {
  const distinctive = frame({
    whenToUse: "Adapt only the shape; never reuse Partridgeology's exact opening line.",
  });
  assert.deepEqual(
    checkFrame(distinctive, { ...NOOP_SCAN, creatorNames: ["partridgeology"] }).map((finding) => finding.kind),
    ["creator-name"],
  );

  // "career" is 6+ letters (long enough to otherwise qualify) but sits in COMMON_SINGLE_TOKENS,
  // so it must not fire on its own the way a distinctive single token does.
  const common = frame({
    whenToUse: "Keep this about career growth in general, nothing creator specific here.",
  });
  assert.deepEqual(checkFrame(common, { ...NOOP_SCAN, creatorNames: ["career"] }), []);
});

test("checkFrame catches a creator name evading detection with a unicode hyphen", () => {
  const bad = frame({
    whenToUse: "Never mimic Jean‐Luc Picard directly; keep the language generic and unattached.",
  });
  const findings = checkFrame(bad, { ...NOOP_SCAN, creatorNames: ["jean-luc picard"] });
  assert.deepEqual(findings.map((finding) => finding.kind), ["creator-name"]);
});

test("checkFrame matches a hyphenated creator slug against the frame's plain-text spelling", () => {
  // normalizeForMatch now collapses hyphens to spaces, so a slug-shaped creator name ("jean-luc-
  // picard", the kind creatorIdentity() derives from a filename) matches a frame that spells the
  // name the ordinary way.
  const bad = frame({
    whenToUse: "Never imitate Jean Luc Picard's tone; keep this fully generic instead.",
  });
  const findings = checkFrame(bad, { ...NOOP_SCAN, creatorNames: ["jean-luc-picard"] });
  assert.deepEqual(findings.map((finding) => finding.kind), ["creator-name"]);
});

// --- parseHookFrame ---------------------------------------------------------------------------

test("parseHookFrame rejects invalid records", () => {
  assert.throws(() => parseHookFrame({ ...rawFrame(), extra: "nope" }, "field"), /field\.extra is unsupported/);
  const missingKey = rawFrame();
  delete missingKey.topics;
  assert.throws(() => parseHookFrame(missingKey, "field"), /field\.topics is required/);
  assert.throws(() => parseHookFrame(rawFrame({ platforms: ["mars"] }), "field"), /supported platform/);
  assert.throws(
    () => parseHookFrame(rawFrame({ support: { instances: -1, distinctCreatorFiles: 2, rankedInstances: 3, topQuartileInstances: 1 } }), "field"),
    /non-negative integer/,
  );
  assert.throws(
    () => parseHookFrame(rawFrame({ support: { instances: 3, distinctCreatorFiles: 1.5, rankedInstances: 3, topQuartileInstances: 1 } }), "field"),
    /non-negative integer/,
  );
  assert.throws(() => parseHookFrame(rawFrame({ review: "maybe" }), "field"), /field\.review is unsupported/);
  assert.throws(() => parseHookFrame(rawFrame({ originality: "meh" }), "field"), /field\.originality is unsupported/);
});

test("parseHookFrame accepts a valid record and normalizes list fields", () => {
  const parsed = parseHookFrame(rawFrame(), "field");
  assert.equal(parsed.id, "frame:raw-base");
  assert.deepEqual(parsed.slots, ["consequence", "topic"]);
  assert.deepEqual(parsed.platforms, ["linkedin", "x"]);
  assert.deepEqual(parsed.topics, ["synthetic-topic-one"]);
  assert.equal(parsed.support.instances, 3);
  assert.equal(parsed.review, "approved");
  assert.equal(parsed.originality, "passed");
});

// --- readHookFrameLibrary ----------------------------------------------------------------------

test("readHookFrameLibrary skips blank lines and rejects malformed JSON", () => {
  const text = `\n${JSON.stringify(frame())}\n\n   \n`;
  const result = readHookFrameLibrary(text, NOOP_SCAN);
  assert.deepEqual(result.frames.map((value) => value.id), ["frame:base"]);
  assert.deepEqual(result.findings, []);
  assert.throws(() => readHookFrameLibrary("not json"), /not valid JSON/);
});

test("readHookFrameLibrary excludes a frame with findings and a duplicate id, reporting both", () => {
  // A single ref, so a single file: the ref-derived count (not the bank's claimed
  // distinctCreatorFiles) is what makes this frame insufficient-creators.
  const flawed = frame({
    id: "frame:flawed",
    support: { instances: 1, distinctCreatorFiles: 1, rankedInstances: 1, topQuartileInstances: 0 },
    sourceRefs: ["synthetic-creator-a.md#entry-1-1"],
  });
  const original = frame({ id: "frame:dup" });
  const duplicate = frame({ id: "frame:dup", name: "Second copy of the same id" });
  const text = jsonl(flawed, original, duplicate);
  const result = readHookFrameLibrary(text, NOOP_SCAN);
  assert.deepEqual(result.frames.map((value) => value.id), ["frame:dup"]);
  assert.ok(result.findings.some((finding) => finding.frameId === "frame:flawed" && finding.kind === "insufficient-creators"));
  assert.ok(result.findings.some((finding) => finding.frameId === "frame:dup" && finding.kind === "duplicate-id"));
});

test("readHookFrameLibrary sorts output frames by id regardless of input order", () => {
  const zeta = frame({ id: "frame:zeta" });
  const alpha = frame({ id: "frame:alpha" });
  const mid = frame({ id: "frame:mid" });
  const result = readHookFrameLibrary(jsonl(zeta, alpha, mid), NOOP_SCAN);
  assert.deepEqual(result.frames.map((value) => value.id), ["frame:alpha", "frame:mid", "frame:zeta"]);
});

// --- selectFrames ------------------------------------------------------------------------------

test("selectFrames filters by platform and excludes unapproved frames unless includePending", () => {
  const onLinkedin = frame({ id: "frame:li", platforms: ["linkedin"] });
  const onX = frame({ id: "frame:x", platforms: ["x"] });
  const pending = frame({ id: "frame:pending", platforms: ["linkedin"], review: "pending" });
  const lib = library([onLinkedin, onX, pending]);

  const result = selectFrames(lib, { platform: "linkedin" });
  assert.deepEqual(result.map((value) => value.frame.id), ["frame:li"]);

  const withPending = selectFrames(lib, { platform: "linkedin", includePending: true });
  assert.deepEqual(withPending.map((value) => value.frame.id).sort(), ["frame:li", "frame:pending"]);
});

test("selectFrames sorts a topic match first even ahead of a higher-share non-match", () => {
  const matching = frame({
    id: "frame:topic-match",
    topics: ["synthetic-launch-day"],
    support: { instances: 4, distinctCreatorFiles: 2, rankedInstances: 4, topQuartileInstances: 1 },
    sourceRefs: ["a.md#entry-1-1", "b.md#entry-1-1", "c.md#entry-1-1", "d.md#entry-1-1"],
  });
  const higherShare = frame({
    id: "frame:higher-share",
    topics: ["synthetic-unrelated-topic"],
    support: { instances: 4, distinctCreatorFiles: 2, rankedInstances: 4, topQuartileInstances: 3 },
    sourceRefs: ["e.md#entry-1-1", "f.md#entry-1-1", "g.md#entry-1-1", "h.md#entry-1-1"],
  });
  const result = selectFrames(library([higherShare, matching]), { platform: "linkedin", topic: "synthetic-launch-day" });
  assert.deepEqual(result.map((value) => value.frame.id), ["frame:topic-match", "frame:higher-share"]);
  assert.equal(result[0]?.topicMatch, true);
});

test("selectFrames breaks a topic tie by higher top-quartile share, with a null share last", () => {
  const highShare = frame({
    id: "frame:high-share",
    support: { instances: 4, distinctCreatorFiles: 2, rankedInstances: 4, topQuartileInstances: 3 },
    sourceRefs: ["a.md#entry-1-1", "b.md#entry-1-1", "c.md#entry-1-1", "d.md#entry-1-1"],
  });
  const lowShare = frame({
    id: "frame:low-share",
    support: { instances: 4, distinctCreatorFiles: 2, rankedInstances: 4, topQuartileInstances: 1 },
    sourceRefs: ["e.md#entry-1-1", "f.md#entry-1-1", "g.md#entry-1-1", "h.md#entry-1-1"],
  });
  const nullShare = frame({
    id: "frame:null-share",
    support: { instances: 2, distinctCreatorFiles: 2, rankedInstances: 0, topQuartileInstances: 0 },
    sourceRefs: ["i.md#entry-1-1", "j.md#entry-1-1"],
  });
  const result = selectFrames(library([lowShare, nullShare, highShare]), { platform: "linkedin" });
  assert.deepEqual(result.map((value) => value.frame.id), ["frame:high-share", "frame:low-share", "frame:null-share"]);
  assert.equal(result[0]?.topQuartileShare, 0.75);
  assert.equal(result[2]?.topQuartileShare, null);
});

test("selectFrames excludes a rejected frame and a failed-originality frame even with includePending", () => {
  const rejected = frame({ id: "frame:rejected", platforms: ["linkedin"], review: "rejected" });
  const failedOriginality = frame({ id: "frame:failed-originality", platforms: ["linkedin"], originality: "failed" });
  const stillPending = frame({ id: "frame:still-pending", platforms: ["linkedin"], review: "pending" });
  const lib = library([rejected, failedOriginality, stillPending]);
  const result = selectFrames(lib, { platform: "linkedin", includePending: true });
  assert.deepEqual(result.map((value) => value.frame.id), ["frame:still-pending"]);
});

test("selectFrames respects limit and rejects an unsupported platform or a non-positive limit", () => {
  const lib = library([frame({ id: "frame:one" }), frame({ id: "frame:two" }), frame({ id: "frame:three" })]);
  const result = selectFrames(lib, { platform: "linkedin", limit: 2 });
  assert.equal(result.length, 2);
  assert.throws(() => selectFrames(lib, { platform: "mars" as never }), /platform/);
  assert.throws(() => selectFrames(lib, { platform: "linkedin", limit: 0 }), /limit/);
});

// --- fillFrame -----------------------------------------------------------------------------

test("fillFrame fills every slot, marks review pending, copies sourceRefs, and has no voice findings for clean material", () => {
  const target = frame();
  const result = fillFrame(target, { topic: "onboarding friction", consequence: "new users churn" });
  assert.equal(result.text, "Nobody warns you about onboarding friction until new users churn happens.");
  assert.deepEqual(result.slotsFilled, ["topic", "consequence"]);
  assert.equal(result.review, "pending");
  assert.deepEqual(result.sourceRefs, target.sourceRefs);
  assert.notEqual(result.sourceRefs, target.sourceRefs);
  assert.deepEqual(result.voiceFindings, []);
});

test("fillFrame throws for missing, unknown, or whitespace-only slot material", () => {
  const target = frame();
  assert.throws(() => fillFrame(target, { topic: "onboarding friction" }), /missing material for slot\(s\): consequence/);
  assert.throws(
    () => fillFrame(target, { topic: "onboarding friction", consequence: "new users churn", extra: "nope" }),
    /material supplied for unknown slot\(s\): extra/,
  );
  assert.throws(() => fillFrame(target, { topic: "   ", consequence: "new users churn" }), /missing material for slot\(s\): topic/);
});

test("fillFrame voiceFindings flags an em dash in supplied material", () => {
  const target = frame();
  const result = fillFrame(target, { topic: "growth\u2014fast", consequence: "new users churn" });
  assert.ok(result.voiceFindings.some((finding) => /em dash/.test(finding)));
});

test("fillFrame voiceFindings flags the banned here's the thing phrase", () => {
  const target = frame();
  const result = fillFrame(target, { topic: "here's the thing about onboarding", consequence: "new users churn" });
  assert.ok(result.voiceFindings.some((finding) => /here's the thing/.test(finding)));
});
