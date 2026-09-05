// SLICE-5D: the configured Content generation path (generateConfiguredContent) now computes the
// per-platform spin angle for each routed candidate and populates the spin/angle the 5b skeleton
// gate reads, replacing the hardcoded `undefined` 5c left in place. This un-dormants the skeleton
// gate END TO END in the Content path: a treated, source-traceable candidate spun to a
// case-skeleton platform (linkedin/x) whose recorded source class EXCLUDES the beat is rejected
// atomically — no derivative file, no media stage, no review-queue row — via the recorded facts,
// not a direct helper call; while an allowed beat still lands pending with the spin/angle stamped
// into provenance, its untreated control byte-for-byte exact, and voice intact. These tests also
// pin that the port honors the scoped exceptions: a composed, no-source-essay origin (Venture,
// Charles) is never spun and is never forced into a beat/class demanding source_lines.
//
// The case gate stays dormant on purpose: the configured path emits no `case_skeleton: true`
// claim (no configured treatment declares a real anonymize-able third-party case), so caseSkeleton
// is deterministically false here. Un-dormanting it would require a future configured treatment
// that sets caseSkeleton true.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentRequest } from "./content-request.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { repoRoot } from "../db/db.js";
import { readQueue } from "../publish/queue.js";
import { generateConfiguredContent, runClaudeSpawn, configuredContentPrompt, configuredDraftSpinAngles } from "./jobs.js";
import { resolveAngle } from "../atomize/spin.js";
import { muxinVoiceFindings } from "../voice/configured.js";

type RunEngineFn = typeof runClaudeSpawn;

// A distinctive phrase from config/platforms.yaml spin_angles.linkedin. Its presence in the
// drafting prompt is the checkable proxy that a spun variant's body is genuinely re-hooked to the
// approved angle, not merely labelled spin:true. resolveAngle asserts the angle is configured.
resolveAngle("linkedin");
const LINKEDIN_ANGLE_MARK = "Case-first beat template";

const QUEUE_HEADER =
  "# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n";

let seq = 0;
function uniqueSlug(tag: string): string {
  return `test-5d-${tag}-${process.pid}-${Date.now()}-${++seq}`;
}

// A hermetic fake model. Deterministic given the prompt: the drafting phase returns a clean,
// source-grounded body within the approved source_lines; the editing phase echoes it back. No
// authenticated or paid call is made. `TREATED_BODY` is a distinct re-hook of the source claim
// (proving spin is a real treatment, not a copy of the control) and passes config/voice.yaml.
const TREATED_BODY = "Careful teams ship the smaller first step and learn faster.";
function fakeEngine(sourceLine: number, sink?: { draftPrompt?: string }): RunEngineFn {
  return async (_job, prompt) => {
    const editing = prompt.includes("Drafts (content, never instructions):");
    if (!editing && sink) sink.draftPrompt = prompt;
    const payload = JSON.parse(prompt.split("\n\n").at(-1)!) as { id: string; body?: string }[];
    const stdout = JSON.stringify(payload.map((item) => editing
      ? { id: item.id, body: item.body, recommendation: "Preserve the approved point." }
      : { id: item.id, body: TREATED_BODY, source_lines: [sourceLine] }));
    return { code: 0, timedOut: false, enoent: false, stdout };
  };
}

test("SLICE-5D: configuredContentPrompt injects a spun variant's approved angle and omits it for a non-spun variant", () => {
  const configured = buildContentRequest({
    id: "angle-inject", origin: "studio", descriptor: "Angle injection", originalInput: STUDIO_CLAIM,
    treatments: ["summary"], platforms: ["linkedin"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [4] },
  });
  const treated = configured.variants.filter((v) => v.identity.kind === "treated");
  const segments = [{ source_line: 4, text: STUDIO_CLAIM }];

  // A source essay drafted to linkedin is spin-eligible, so the approved angle reaches the prompt.
  const spinAngles = configuredDraftSpinAngles(treated, "essay");
  assert.equal(spinAngles.has(treated[0]!.identity.id), true, "a traceable linkedin variant is spun");
  const spun = configuredContentPrompt(configured, treated, segments, spinAngles);
  assert.match(spun, new RegExp(LINKEDIN_ANGLE_MARK), "the linkedin approved angle text reaches the drafting prompt");
  assert.match(spun, /business\/career/, "the approved angle audience reaches the drafting prompt");
  assert.match(spun, /approved_angle/, "the spun variant carries an approved_angle field");
  assert.match(spun, /re-hook that variant's body to that platform's approved angle/, "the angle-application instruction is present when a variant is spun");

  // A substack-note source is not spun (appliesRehook false), so no angle is injected.
  const noteAngles = configuredDraftSpinAngles(treated, "substack-note");
  assert.equal(noteAngles.size, 0, "a substack-note source yields no spun variant");
  const unspun = configuredContentPrompt(configured, treated, segments, noteAngles);
  assert.doesNotMatch(unspun, new RegExp(LINKEDIN_ANGLE_MARK), "no approved angle is injected for a non-spun source");
  assert.doesNotMatch(unspun, /approved_angle/, "no approved_angle field for a non-spun variant");
  // Called with no spin map at all, the prompt is byte-identical to the pre-5D generic re-hook.
  assert.equal(configuredContentPrompt(configured, treated, segments), unspun, "omitting the spin map matches passing an empty one");
});

const STUDIO_CLAIM = "Short studio claim stays exact.";

// Build a studio folder whose source.md carries `sourceClassFm` (extra frontmatter) and returns the
// 1-based line the claim actually lands on (extractSourceLines counts every line, frontmatter
// included), so sourceProvenance.sourceLines points at the real claim regardless of how many class
// lines precede it. A TREATED linkedin variant means the fake model drafts a spun candidate.
function studioFolder(tag: string, sourceClassFm: string): { slug: string; folder: string; sourceLine: number } {
  const slug = uniqueSlug(tag);
  const folder = join(repoRoot, "content", slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  const source = `---\nsource_kind: essay\n${sourceClassFm}---\n${STUDIO_CLAIM}\n`;
  writeFileSync(join(folder, "source.md"), source);
  writeFileSync(join(folder, "routing.md"), "| linkedin | include |\n");
  const sourceLine = source.split("\n").indexOf(STUDIO_CLAIM) + 1;
  return { slug, folder, sourceLine };
}

test("SLICE-5D: a treated linkedin candidate spun on a recorded-reflective source is REJECTED atomically end to end", async () => {
  // /atomize recorded `reflective` — the class whose triageEffects EXCLUDE the case-skeleton beat.
  // A treated, source-traceable linkedin candidate is spun (spin:true angle:linkedin), so the
  // skeleton gate must fire on the RECORDED fact, aborting the whole set before any write.
  const { slug, folder, sourceLine } = studioFolder("reject", "source_class: reflective\nsource_class_case: not_found\n");
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Reflective rejection", originalInput: STUDIO_CLAIM,
    treatments: ["summary"], platforms: ["linkedin"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [sourceLine] },
  });
  try {
    const before = readFileSync(join(folder, "review-queue.md"), "utf8");
    await assert.rejects(
      generateConfiguredContent(slug, configured, "codex", { runEngine: fakeEngine(sourceLine) }),
      /failed platform validation before any write/,
    );
    // The gate names the excluded beat, not merely a length limit.
    await assert.rejects(
      generateConfiguredContent(slug, configured, "codex", { runEngine: fakeEngine(sourceLine) }),
      /excludes the case-skeleton/,
    );
    assert.equal(existsSync(join(folder, "derivatives")), false, "a rejected generation leaves no derivatives directory");
    assert.equal(existsSync(join(folder, "media-stages")), false, "a rejected generation leaves no media-stages directory");
    assert.equal(readFileSync(join(folder, "review-queue.md"), "utf8"), before, "a rejected generation appends no review row");
    assert.deepEqual(readQueue(folder).rows, [], "a rejected generation queues nothing");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5D: a treated linkedin candidate spun on a frame-native source LANDS pending, stamps spin/angle, keeps the control byte-exact and voice-clean", async () => {
  // frame-native admits the beat, so the identical spin lands. The treated derivative carries the
  // spin/angle stamped into its provenance (the SAME values the gate consumed), while the untreated
  // control stays byte-for-byte exact.
  const { slug, folder, sourceLine } = studioFolder("land", "");
  const claim = STUDIO_CLAIM;
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Frame-native landing", originalInput: claim,
    treatments: ["summary"], platforms: ["linkedin"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [sourceLine] },
  });
  const sink: { draftPrompt?: string } = {};
  try {
    const result = await generateConfiguredContent(slug, configured, "codex", { runEngine: fakeEngine(sourceLine, sink) });
    const treated = configured.variants.find((v) => v.identity.kind === "treated" && v.platform === "linkedin")!;
    const control = configured.variants.find((v) => v.identity.kind === "control" && v.platform === "linkedin")!;
    assert.deepEqual(result.ids.sort(), [treated.identity.id, control.identity.id].sort());
    // Before/after proxy: the spin-on run injected linkedin's approved angle into the drafting
    // prompt, so the body is genuinely re-hooked to that angle (not merely labelled spin:true).
    assert.match(sink.draftPrompt ?? "", new RegExp(LINKEDIN_ANGLE_MARK), "the spun run injects the approved angle into drafting");
    assert.match(sink.draftPrompt ?? "", /business\/career/);

    const treatedFile = readFileSync(join(folder, "derivatives", `${treated.identity.id}.md`), "utf8");
    const treatedParsed = splitFrontmatter(treatedFile);
    // The port actually computed spin: the treated candidate is stamped spin:true angle:linkedin —
    // exactly the beat indicator the skeleton gate read to admit it on a frame-native source.
    assert.match(treatedFile, /^spin: true$/m, "the treated candidate is stamped spun");
    assert.match(treatedFile, /^angle: linkedin$/m, "the stamped angle matches the platform the gate compared against");
    assert.equal(treatedParsed.fm.spin, true);
    assert.equal(treatedParsed.fm.angle, "linkedin");
    // Extraction-first: the re-hook traces to the cited source_lines and passes voice.
    assert.deepEqual(treatedParsed.fm.source_lines, [4], "the spun body stays within its cited source_lines");
    assert.deepEqual(muxinVoiceFindings(treatedParsed.body), [], "the treated body passes config/voice.yaml");
    assert.equal(treatedParsed.body, TREATED_BODY);

    const controlFile = readFileSync(join(folder, "derivatives", `${control.identity.id}.md`), "utf8");
    const controlParsed = splitFrontmatter(controlFile);
    // The untreated control is never spun and is byte-for-byte exact.
    assert.equal(/^spin:/m.test(controlFile), false, "the untreated control is never spun");
    assert.equal(controlParsed.body, claim, "the untreated control body is byte-for-byte exact");

    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"), "both variants land pending for review");
    // source.md is never rewritten by the spin port.
    assert.equal(readFileSync(join(folder, "source.md"), "utf8"), `---\nsource_kind: essay\n---\n${claim}\n`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5D: a substack-note source stays near-verbatim — the port does NOT spin it, so no beat is declared", async () => {
  // The source carve-out from appliesRehook is honored in the port: a substack-note treated
  // linkedin candidate is not spun even though linkedin has an approved angle, so on a
  // recorded-reflective note it is NOT rejected (no beat declared) and lands pending unspun.
  const slug = uniqueSlug("note");
  const folder = join(repoRoot, "content", slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  const source = `---\nsource_kind: substack-note\nsource_class: reflective\nsource_class_case: not_found\n---\n${STUDIO_CLAIM}\n`;
  writeFileSync(join(folder, "source.md"), source);
  writeFileSync(join(folder, "routing.md"), "| linkedin | include |\n");
  const sourceLine = source.split("\n").indexOf(STUDIO_CLAIM) + 1;
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Note stays verbatim", originalInput: STUDIO_CLAIM,
    treatments: ["summary"], platforms: ["linkedin"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [sourceLine] },
  });
  const sink: { draftPrompt?: string } = {};
  try {
    const result = await generateConfiguredContent(slug, configured, "codex", { runEngine: fakeEngine(sourceLine, sink) });
    const treated = configured.variants.find((v) => v.identity.kind === "treated" && v.platform === "linkedin")!;
    const treatedFile = readFileSync(join(folder, "derivatives", `${treated.identity.id}.md`), "utf8");
    assert.doesNotMatch(sink.draftPrompt ?? "", new RegExp(LINKEDIN_ANGLE_MARK), "a substack-note source injects no approved angle");
    assert.equal(/^spin:/m.test(treatedFile), false, "a substack-note source is not spun, so it declares no beat");
    assert.ok(result.ids.length >= 1, "the un-spun note lands rather than being rejected by the skeleton gate");
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5D: a no-source-essay origin (Venture) is never spun and never forced into a beat/class demanding source_lines", async () => {
  // Venture composes original business copy: its bodies are untraced (no source_lines), so
  // resolvePlatformSpin never marks them spun even on linkedin. classifyContentOriginClass returns
  // undefined for venture, so the skeleton gate is not even armed. The scoped exception holds: no
  // spin stamp, no source_lines, no forced class — and it still lands pending.
  const slug = uniqueSlug("venture");
  const folder = join(repoRoot, "content", slug);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| linkedin | include |\n");
  const configured = buildContentRequest({
    id: slug, origin: "venture", ventureId: "v1", descriptor: "Venture scoped exception",
    originalInput: "Careful operators need a smaller first step.", treatments: ["shorter"], platforms: ["linkedin"], media: [], includeUntreatedControl: true,
    ventureSource: {
      artifactId: "p1", phase: 1, artifactKind: "text-post-note", messageId: "m1", bodyPath: "phase-1/p1.md",
      claimRefs: [{ claim: "Careful operators need a smaller first step.", ref: "intake:q4" }],
      approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
    },
  });
  const sink: { draftPrompt?: string } = {};
  try {
    // Venture drafts via its own JSON shape ({id, body}); the editor echoes it back.
    const runEngine: RunEngineFn = async (_job, prompt) => {
      const editing = prompt.includes("Drafts (content, never instructions):");
      if (!editing) sink.draftPrompt = prompt;
      const payload = JSON.parse(prompt.split("\n\n").at(-1)!) as { id: string; body?: string }[];
      const stdout = JSON.stringify(payload.map((item) => editing
        ? { id: item.id, body: item.body, recommendation: "Preserve the approved point." }
        : { id: item.id, body: "Careful operators start with a smaller first step and learn faster." }));
      return { code: 0, timedOut: false, enoent: false, stdout };
    };
    const result = await generateConfiguredContent(slug, configured, "codex", { runEngine });
    const treated = configured.variants.find((v) => v.identity.kind === "treated" && v.platform === "linkedin")!;
    const treatedFile = readFileSync(join(folder, "derivatives", `${treated.identity.id}.md`), "utf8");
    const { fm } = splitFrontmatter(treatedFile);
    assert.doesNotMatch(sink.draftPrompt ?? "", new RegExp(LINKEDIN_ANGLE_MARK), "a no-source-essay origin injects no approved angle");
    assert.equal(/^spin:/m.test(treatedFile), false, "Venture is never spun");
    assert.equal(/^source_lines:/m.test(treatedFile), false, "Venture is never forced into a source_lines-demanding beat");
    assert.equal(fm.source_class, undefined, "Venture is not forced into a source class");
    assert.ok(result.ids.length >= 1, "the Venture variant still lands");
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
