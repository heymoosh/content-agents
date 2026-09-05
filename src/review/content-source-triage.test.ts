// SLICE-5C: the configured Content generation path (generateConfiguredContent) runs source triage
// and records the resulting source class (frame-native / reflective / fiction-promo) plus the case
// evidence into each variant's derivative provenance/frontmatter BEFORE any derivative file or
// review-queue row is written, and passes those same values into slice 5b's skeleton and case gate
// calls (replacing the stale `undefined` default those calls read before 5c).
//
// SCOPE / DORMANCY (corrected — see SLICE-5C packet "Corrected scope"): the skeleton and case gates
// do NOT fire in the configured path today and cannot until a future spin slice populates candidate
// spin/angle/caseSkeleton — their triggers are `spin===true && angle===platform` and
// `caseSkeleton===true`, and the configured path computes none of those, so the call site passes
// `undefined`. What 5c proves here: (1) the class/case facts are real, recorded into each variant's
// provenance, and are the exact values threaded into the gate calls; (2) the gate FUNCTIONS give the
// right verdict when driven by the recorded fact plus a synthetic beat-carrying candidate (unit-level
// gate logic, not a production rejection); (3) the intentional current dormancy — a studio essay
// recorded `reflective` (the class that WOULD exclude the beat) still generates and lands pending,
// because no configured candidate carries a beat. The end-to-end gate-rejection test belongs to the
// spin slice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentRequest } from "./content-request.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { repoRoot } from "../db/db.js";
import { readQueue } from "../publish/queue.js";
import { generateConfiguredContent } from "./jobs.js";
import { checkSkeletonGate, checkCaseGate } from "../atomize/validate.js";
import { classifyContentOriginClass, readSourceClass, readCaseEvidence } from "../atomize/source-triage.js";

const QUEUE_HEADER =
  "# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n";

let seq = 0;
function uniqueSlug(tag: string): string {
  return `test-5c-${tag}-${process.pid}-${Date.now()}-${++seq}`;
}

// Build a studio content folder with a control-only request (no treated variant, so no model is
// needed) whose source.md carries `frontmatter`, and run the real generation path.
// human-inference is deliberately NOT re-tested here: it shares studio's `:811` authoritative branch
// AND classifyContentOriginClass maps both to `frame-native`, so its generation behavior is
// identical to studio (already generation-tested below) — covered by the classifier unit assertion.
async function runStudio(tag: string, frontmatter: string, sourceLine: number): Promise<{ folder: string; derivativePath: string; ids: string[] }> {
  const slug = uniqueSlug(tag);
  const folder = join(repoRoot, "content", slug);
  const claim = "Short studio claim stays exact.";
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Triage studio", originalInput: claim,
    treatments: [], platforms: ["bluesky"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [sourceLine], canonicalUrl: "https://www.humaninference.ai/p/triage-source" },
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "source.md"), `${frontmatter}${claim}\n`);
  writeFileSync(join(folder, "routing.md"), "| bluesky | include |\n");
  const result = await generateConfiguredContent(slug, configured);
  const variant = configured.variants.find((v) => v.platform === "bluesky")!;
  assert.deepEqual(result.ids, [variant.identity.id]);
  return { folder, derivativePath: join(folder, "derivatives", `${variant.identity.id}.md`), ids: result.ids };
}

test("SLICE-5C: classifyContentOriginClass maps essay origins deterministically and returns undefined for a no-source-essay origin", () => {
  assert.equal(classifyContentOriginClass("fiction"), "fiction-promo");
  assert.equal(classifyContentOriginClass("studio"), "frame-native");
  // human-inference shares studio's branch and mapping, so its generation behavior equals studio's.
  assert.equal(classifyContentOriginClass("human-inference"), "frame-native");
  // Scoped-exception origins with no source essay are NOT forced into a tracing-demanding class.
  assert.equal(classifyContentOriginClass("venture"), undefined);
  assert.equal(classifyContentOriginClass("charles"), undefined);
  // Fail-safe: never guess a bucket for an unknown origin.
  assert.equal(classifyContentOriginClass("something-else"), undefined);
});

test("SLICE-5C: the configured path stamps the deterministic class + case evidence into each variant's derivative frontmatter, and never rewrites source.md", async () => {
  const beforeSource = "---\nsource_kind: essay\n---\n";
  const { folder, derivativePath } = await runStudio("studio-default", beforeSource, 4);
  try {
    const file = readFileSync(derivativePath, "utf8");
    const { fm } = splitFrontmatter(file);
    // A studio essay with no recorded class is classified frame-native, fail-safe case not_found,
    // and the fact is stamped into the variant's own provenance/frontmatter.
    assert.equal(fm.source_class, "frame-native");
    assert.equal(fm.source_class_case, "not_found");
    // The stamped class is EXACTLY what the gate call receives: readSourceClass falls through to the
    // deterministic origin class (source.md carries none), lining up with the derivative stamp.
    assert.equal(readSourceClass(folder) ?? classifyContentOriginClass("studio"), fm.source_class);
    // Traceability is preserved: source.md is byte-for-byte unchanged (recording into source.md
    // would shift the body lines that source_lines is indexed against — a rule-1 break).
    assert.equal(readFileSync(join(folder, "source.md"), "utf8"), `${beforeSource}Short studio claim stays exact.\n`);
    assert.match(file, /^source_lines: \[4\]$/m, "the traceable control still carries its exact source_lines");
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"), "the variant lands pending for review");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: a class recorded in source.md by /atomize wins over the origin default and is stamped; the gate FUNCTION's verdict follows the recorded fact (unit-level)", async () => {
  // /atomize recorded `reflective`; the configured path must respect it (not override with the studio
  // default) and stamp it into the variant provenance.
  const reflectiveFm = "---\nsource_kind: essay\nsource_class: reflective\nsource_class_case: not_found\n---\n";
  const reflective = await runStudio("respect-reflective", reflectiveFm, 6);
  // A studio essay with no recorded class classifies frame-native (the ALLOW-the-beat class).
  const frameNative = await runStudio("origin-frame-native", "---\nsource_kind: essay\n---\n", 4);
  try {
    assert.equal(splitFrontmatter(readFileSync(reflective.derivativePath, "utf8")).fm.source_class, "reflective", "recorded reflective is respected, not overridden by the studio default");
    assert.equal(splitFrontmatter(readFileSync(frameNative.derivativePath, "utf8")).fm.source_class, "frame-native");

    // Unit-level gate logic: the recorded fact (read back from the folder the Content path produced)
    // is what would be passed to the gate; drive the gate FUNCTION with it plus a SYNTHETIC
    // beat-carrying candidate to prove the recorded fact drives the verdict. This is gate logic, NOT
    // a production rejection — the production call site passes spin/angle = undefined (see dormancy
    // test below), so no real configured candidate reaches this branch today.
    const syntheticBeatCandidate = [{ file: "derivatives/x.md", platform: "linkedin", spin: true, angle: "linkedin" }];
    const recordedReflective = readSourceClass(reflective.folder) ?? classifyContentOriginClass("studio");
    const recordedFrameNative = readSourceClass(frameNative.folder) ?? classifyContentOriginClass("studio");
    assert.equal(recordedReflective, "reflective");
    assert.equal(recordedFrameNative, "frame-native");
    const verdict = checkSkeletonGate(syntheticBeatCandidate, recordedReflective!);
    assert.equal(verdict.length, 1);
    assert.match(verdict[0], /excludes the case-skeleton/);
    assert.deepEqual(checkSkeletonGate(syntheticBeatCandidate, recordedFrameNative!), [], "frame-native admits the beat, so the recorded fact yields a passing verdict");
  } finally {
    rmSync(reflective.folder, { recursive: true, force: true });
    rmSync(frameNative.folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: the skeleton/case gates are DORMANT in the configured path — a studio essay recorded `reflective` still generates and lands pending, no rejection", async () => {
  // `reflective` is the class whose triageEffects EXCLUDE the case-skeleton beat. If the configured
  // path ever declared a beat on a candidate, this would be rejected. It is not: the configured path
  // computes no spin/angle/caseSkeleton, so the gate call passes `undefined` and no candidate trips.
  // This pins the intentional current dormancy; the future spin slice's own test will flip it.
  const reflectiveFm = "---\nsource_kind: essay\nsource_class: reflective\nsource_class_case: not_found\n---\n";
  const { folder, derivativePath, ids } = await runStudio("dormant-reflective", reflectiveFm, 6);
  try {
    assert.equal(ids.length, 1, "the reflective essay generated normally — no gate rejection");
    assert.ok(existsSync(derivativePath), "the derivative was written despite the beat-excluding class");
    assert.equal(splitFrontmatter(readFileSync(derivativePath, "utf8")).fm.source_class, "reflective");
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"), "the variant lands pending for review");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: recorded case evidence is stamped and drives the case gate FUNCTION's verdict (unit-level) — found admits a case_skeleton candidate, not_found rejects it", async () => {
  const foundFm = "---\nsource_kind: essay\nsource_class: frame-native\nsource_class_case: found\n---\n";
  const found = await runStudio("case-found", foundFm, 6);
  // No recorded case evidence -> the configured path fails safe to not_found and stamps it.
  const notFound = await runStudio("case-not-found", "---\nsource_kind: essay\n---\n", 4);
  try {
    assert.equal(splitFrontmatter(readFileSync(found.derivativePath, "utf8")).fm.source_class_case, "found", "a recorded found is respected and stamped");
    assert.equal(splitFrontmatter(readFileSync(notFound.derivativePath, "utf8")).fm.source_class_case, "not_found", "an untriaged source fails safe to not_found");

    // Unit-level gate logic with a SYNTHETIC case_skeleton candidate (the configured path declares no
    // case_skeleton today, so this is gate logic, not a production rejection): the recorded case fact
    // flips the verdict.
    const syntheticCaseCandidate = [{ file: "derivatives/x.md", platform: "linkedin", caseSkeleton: true, sourceLines: [6] }];
    const recordedFound = readCaseEvidence(found.folder) ?? (readSourceClass(found.folder) ? "not_found" : undefined);
    const recordedNotFound = readCaseEvidence(notFound.folder) ?? "not_found";
    assert.equal(recordedFound, "found");
    assert.deepEqual(checkCaseGate(syntheticCaseCandidate, recordedFound), [], "the recorded found yields a passing verdict for a case_skeleton candidate");
    const verdict = checkCaseGate(syntheticCaseCandidate, recordedNotFound);
    assert.equal(verdict.length, 1);
    assert.match(verdict[0], /never force or invent a client case/);
  } finally {
    rmSync(found.folder, { recursive: true, force: true });
    rmSync(notFound.folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: fiction origin (:813 context branch) stamps source_class: fiction-promo, fabricates no source_lines, and lands pending", async () => {
  const slug = uniqueSlug("fiction");
  const folder = join(repoRoot, "content", slug);
  const body = "A door opened behind Mara.";
  const configured = buildContentRequest({
    id: slug, origin: "fiction", descriptor: "approved promotion", originalInput: body,
    treatments: [], platforms: ["bluesky"], media: [], includeUntreatedControl: true,
    sourceContext: {
      kind: "fiction-approved-promotion", authoritativeBody: body,
      series: { id: "test-series", title: "Test Series" }, chapter: { number: 1, title: "The Door" },
      sourcePassages: [{ ref: "chapters/chapter-01.md#L1", text: body, locked: true }],
      restrictions: { canon: [], provenance: [] },
    },
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| bluesky | include |\n");
  try {
    const result = await generateConfiguredContent(slug, configured);
    const variant = configured.variants.find((v) => v.platform === "bluesky")!;
    assert.deepEqual(result.ids, [variant.identity.id]);
    const file = readFileSync(join(folder, "derivatives", `${variant.identity.id}.md`), "utf8");
    const { fm } = splitFrontmatter(file);
    // Fiction is the composed fiction teaser: the fiction-promo bucket is stamped (it is NOT a
    // source_lines-demanding class), and no essay provenance is fabricated.
    assert.equal(fm.source_class, "fiction-promo");
    assert.equal(fm.source_class_case, "not_found");
    assert.equal(/^source_lines:/m.test(file), false, "fiction fabricates no essay source_lines");
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
    assert.equal(existsSync(join(folder, "source.md")), false, "no source.md is invented for fiction");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: charles origin (:813 context branch) is a scoped exception — no source_class/case stamp, no fabricated source_lines, lands pending", async () => {
  const slug = uniqueSlug("charles");
  const folder = join(repoRoot, "content", slug);
  const body = "We are, of course, entirely fine.";
  const configured = buildContentRequest({
    id: slug, origin: "charles", descriptor: "approved post", originalInput: body,
    treatments: [], platforms: ["bluesky"], media: [], includeUntreatedControl: true,
    sourceContext: {
      kind: "charles-approved-post", authoritativeBody: body,
      personaRef: "charles/config/persona.yaml", identity: "charles-lord-featherbottom",
      restrictions: ["no new leak claims"],
    },
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| bluesky | include |\n");
  try {
    const result = await generateConfiguredContent(slug, configured);
    const variant = configured.variants.find((v) => v.platform === "bluesky")!;
    assert.deepEqual(result.ids, [variant.identity.id]);
    const file = readFileSync(join(folder, "derivatives", `${variant.identity.id}.md`), "utf8");
    const { fm } = splitFrontmatter(file);
    // Charles has no source essay: it is not forced into any source class, exactly like Venture.
    assert.equal(fm.source_class, undefined, "Charles is not forced into a source class");
    assert.equal(fm.source_class_case, undefined, "Charles records no case evidence");
    assert.equal(/^source_lines:/m.test(file), false, "Charles fabricates no essay source_lines");
    assert.equal(readSourceClass(folder) ?? classifyContentOriginClass("charles"), undefined);
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5C: a no-source-essay origin (Venture) is not forced into a class — no source_class/case stamp, no source_lines, still lands pending", async () => {
  const slug = uniqueSlug("venture-exception");
  const folder = join(repoRoot, "content", slug);
  const configured = buildContentRequest({
    id: slug, origin: "venture", descriptor: "Venture exception",
    originalInput: "Short venture probe.", treatments: [], platforms: ["x", "bluesky"], media: [], includeUntreatedControl: true,
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| x | include |\n| bluesky | skip |\n");
  try {
    const result = await generateConfiguredContent(slug, configured);
    const xVariant = configured.variants.find((v) => v.platform === "x")!;
    assert.deepEqual(result.ids, [xVariant.identity.id]);
    const file = readFileSync(join(folder, "derivatives", `${xVariant.identity.id}.md`), "utf8");
    const { fm } = splitFrontmatter(file);
    // The scoped exception is honored: no class is stamped, so no source_lines-demanding class is
    // forced onto a composed, no-source-essay origin.
    assert.equal(fm.source_class, undefined, "Venture is not forced into a source class");
    assert.equal(fm.source_class_case, undefined, "Venture records no case evidence");
    assert.equal(/^source_lines:/m.test(file), false, "Venture control carries no fabricated essay provenance");
    // classifyContentOriginClass agrees, and the folder has no recorded class, so the gate stays dormant.
    assert.equal(readSourceClass(folder) ?? classifyContentOriginClass("venture"), undefined);
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
    // No source.md exists for this origin, and none was created.
    assert.equal(existsSync(join(folder, "source.md")), false, "no source.md is invented for a no-essay origin");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
