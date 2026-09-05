// SLICE-5B: the configured Content generation path (generateConfiguredContent) enforces the
// applicable /atomize validate gates — per-platform char/word limits, the source-triage skeleton
// gate, and the case-evidence gate — BEFORE it writes any derivative file, media stage, or
// review-queue row. A gate failure aborts the whole routed variant set atomically. These tests
// prove: the shared limit gate reads only config values (so the config drives the verdict); the
// ported skeleton/case gate functions fire on a forbidden candidate; an over-limit variant is
// rejected with zero partial output; and a valid request across origins (including one with no
// source_lines) still lands with routing subset, provenance, and pending review intact, with the
// skeleton/case gates running but not misfiring on a scoped-exception origin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentRequest } from "./content-request.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { repoRoot } from "../db/db.js";
import { readQueue } from "../publish/queue.js";
import { generateConfiguredContent } from "./jobs.js";
import { checkPlatformLimits, checkDerivative, checkSkeletonGate, checkCaseGate, type PlatformRule } from "../atomize/validate.js";

const QUEUE_HEADER =
  "# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n";

let seq = 0;
function uniqueSlug(tag: string): string {
  return `test-5b-${tag}-${process.pid}-${Date.now()}-${++seq}`;
}

test("SLICE-5B: the shared platform-limit gate enforces only config char/word limits, and the config value drives the verdict", () => {
  const body300 = "x".repeat(300);
  // Same body, two different configured limits -> two different verdicts. This is the proof that
  // the gate's behavior is driven by the config/platforms.yaml value, not a hardcoded number.
  assert.deepEqual(checkPlatformLimits("d.md", "x", body300, { x: { max_chars: 500 } }), []);
  const tight = checkPlatformLimits("d.md", "x", body300, { x: { max_chars: 280 } });
  assert.equal(tight.length, 1);
  assert.match(tight[0], /300 chars > x limit 280/);
  // Word ceiling is enforced the same way.
  const words = checkPlatformLimits("v.md", "video-script", Array(30).fill("w").join(" "), { "video-script": { max_words: 20 } });
  assert.match(words[0], /30 words > video-script limit 20/);
  // A limit-less or unknown platform yields no violation, and NEVER a source_lines demand: the
  // scoped-exception origins (Venture, Charles, fiction) depend on this not misfiring.
  assert.deepEqual(checkPlatformLimits("s.md", "substack", body300, { substack: {} }), []);
  assert.deepEqual(checkPlatformLimits("u.md", "unknown", body300, {}), []);
  // Delegation: checkDerivative's char/word verdict is byte-identical to the extracted function, so
  // /atomize's existing validate behavior is unchanged by the extraction.
  const platforms: Record<string, PlatformRule> = { x: { max_chars: 280 } };
  const viaDerivative = checkDerivative("d.md", { platform: "x", spin: true, angle: "x" }, body300, platforms);
  assert.ok(viaDerivative.includes("d.md: 300 chars > x limit 280"));
});

test("SLICE-5B: the ported skeleton and case gates fire on a forbidden candidate and pass on the configured path's real shape", () => {
  // Skeleton gate: a reflective source forbids the case-skeleton beat; a candidate declaring
  // spin:true angle:linkedin on a case-skeleton platform is a hard violation.
  const skel = checkSkeletonGate([{ file: "derivatives/x.md", platform: "linkedin", spin: true, angle: "linkedin" }], "reflective");
  assert.equal(skel.length, 1);
  assert.match(skel[0], /excludes the case-skeleton/);
  // Configured derivatives carry no spin/angle, so the same gate passes for the real shape.
  assert.deepEqual(
    checkSkeletonGate([{ file: "derivatives/x.md", platform: "linkedin", spin: undefined, angle: undefined }], "reflective"),
    []
  );
  // Case gate: case_skeleton:true with no recorded case evidence is a hard violation.
  const cse = checkCaseGate([{ file: "derivatives/x.md", platform: "linkedin", caseSkeleton: true, sourceLines: [4] }], "not_found");
  assert.equal(cse.length, 1);
  assert.match(cse[0], /never force or invent a client case/);
  // Configured derivatives carry no case_skeleton, so the gate passes even with no evidence on file.
  assert.deepEqual(
    checkCaseGate([{ file: "derivatives/x.md", platform: "linkedin", caseSkeleton: undefined, sourceLines: [] }], undefined),
    []
  );
});

test("SLICE-5B: an over-limit configured variant is rejected atomically — no derivative, no media stage, no review row", async () => {
  const slug = uniqueSlug("atomic");
  const folder = join(repoRoot, "content", slug);
  // A Venture control carries the author body verbatim and has no source_lines: it is the path
  // with no other char gate, so it isolates this gate. The body far exceeds x's 280-char limit.
  const longBody = "word ".repeat(80).trim();
  assert.ok(longBody.length > 280, "fixture body must exceed the x limit");
  const configured = buildContentRequest({
    id: slug, origin: "venture", descriptor: "Atomic rejection",
    originalInput: longBody, treatments: [], platforms: ["x"], media: [], includeUntreatedControl: true,
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| x | include |\n");
  try {
    const before = readFileSync(join(folder, "review-queue.md"), "utf8");
    await assert.rejects(generateConfiguredContent(slug, configured), /failed platform validation before any write/);
    assert.equal(existsSync(join(folder, "derivatives")), false, "a rejected generation leaves no derivatives directory");
    assert.equal(existsSync(join(folder, "media-stages")), false, "a rejected generation leaves no media-stages directory");
    assert.equal(readFileSync(join(folder, "review-queue.md"), "utf8"), before, "a rejected generation appends no review row");
    assert.deepEqual(readQueue(folder).rows, [], "a rejected generation queues nothing");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5B: the char gate reads the real config limit — the same body that overflows x passes under a higher-limit platform", async () => {
  // 290 chars: over x's 280, under bluesky's 300. Routing includes only the platform whose real
  // config/platforms.yaml limit the body respects, proving the gate consults the config, not a
  // constant. (Two separate folders so each is a clean atomic assertion.)
  const body = "y".repeat(290);
  // x (limit 280) -> rejected atomically.
  const xSlug = uniqueSlug("cfg-x");
  const xFolder = join(repoRoot, "content", xSlug);
  const xReq = buildContentRequest({ id: xSlug, origin: "venture", descriptor: "Config x", originalInput: body, treatments: [], platforms: ["x"], media: [], includeUntreatedControl: true });
  mkdirSync(xFolder, { recursive: true });
  writeFileSync(join(xFolder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(xFolder, "routing.md"), "| x | include |\n");
  try {
    await assert.rejects(generateConfiguredContent(xSlug, xReq), /280/);
    assert.equal(existsSync(join(xFolder, "derivatives")), false);
    assert.deepEqual(readQueue(xFolder).rows, []);
  } finally {
    rmSync(xFolder, { recursive: true, force: true });
  }
  // bluesky (limit 300) -> the identical body lands.
  const bSlug = uniqueSlug("cfg-bsky");
  const bFolder = join(repoRoot, "content", bSlug);
  const bReq = buildContentRequest({ id: bSlug, origin: "venture", descriptor: "Config bluesky", originalInput: body, treatments: [], platforms: ["bluesky"], media: [], includeUntreatedControl: true });
  mkdirSync(bFolder, { recursive: true });
  writeFileSync(join(bFolder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(bFolder, "routing.md"), "| bluesky | include |\n");
  try {
    const res = await generateConfiguredContent(bSlug, bReq);
    assert.equal(res.ids.length, 1, "the same body within bluesky's higher config limit is admitted");
    assert.ok(readQueue(bFolder).rows.every((row) => row.status === "pending"));
  } finally {
    rmSync(bFolder, { recursive: true, force: true });
  }
});

test("SLICE-5B: one over-limit candidate aborts the WHOLE routed set atomically — the in-limit sibling is not written either", async () => {
  const slug = uniqueSlug("wholeset");
  const folder = join(repoRoot, "content", slug);
  // 290 chars: within bluesky's config limit (300) but over x's (280). Both platforms are routed
  // include, so both controls are generated candidates. The x candidate's violation must abort the
  // entire routed set before any write, so the in-limit bluesky candidate is never written either.
  const body = "z".repeat(290);
  const configured = buildContentRequest({
    id: slug, origin: "venture", descriptor: "Whole-set atomicity",
    originalInput: body, treatments: [], platforms: ["x", "bluesky"], media: [], includeUntreatedControl: true,
  });
  assert.equal(configured.variants.length, 2, "two routed candidates must actually be generated");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| x | include |\n| bluesky | include |\n");
  try {
    const before = readFileSync(join(folder, "review-queue.md"), "utf8");
    await assert.rejects(generateConfiguredContent(slug, configured), /280/);
    assert.equal(existsSync(join(folder, "derivatives")), false, "no derivatives directory for the whole set");
    assert.equal(existsSync(join(folder, "media-stages")), false, "no media-stages directory for the whole set");
    assert.equal(readFileSync(join(folder, "review-queue.md"), "utf8"), before, "no review row for any variant");
    assert.deepEqual(readQueue(folder).rows, [], "the in-limit sibling is not written either");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5B: a valid scoped-exception request (no source_lines) still lands with routing subset and pending review; the skeleton/case gates run but do not misfire", async () => {
  const slug = uniqueSlug("venture-ok");
  const folder = join(repoRoot, "content", slug);
  const configured = buildContentRequest({
    id: slug, origin: "venture", descriptor: "Valid venture",
    originalInput: "Short venture probe.", treatments: [], platforms: ["x", "bluesky"], media: [], includeUntreatedControl: true,
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "routing.md"), "| x | include |\n| bluesky | skip |\n");
  // A reflective source with no case evidence: this is exactly the condition that arms the
  // skeleton and case gates. A Venture control has no spin/angle/case_skeleton frontmatter, so the
  // gates must run and PASS without demanding source_lines from this scoped-exception origin.
  writeFileSync(join(folder, "source.md"), "---\nsource_kind: essay\nsource_class: reflective\nsource_class_case: not_found\n---\nShort venture probe.\n");
  try {
    const result = await generateConfiguredContent(slug, configured);
    const xVariant = configured.variants.find((variant) => variant.platform === "x")!;
    const blueskyVariant = configured.variants.find((variant) => variant.platform === "bluesky")!;
    // Routing subset from 5a preserved: only the included platform is produced.
    assert.deepEqual(result.ids, [xVariant.identity.id]);
    assert.equal(existsSync(join(folder, "derivatives", `${blueskyVariant.identity.id}.md`)), false, "the skipped platform produces nothing");
    const body = readFileSync(join(folder, "derivatives", `${xVariant.identity.id}.md`), "utf8");
    // The gate did not demand tracing where a scoped exception applies.
    assert.equal(/^source_lines:/m.test(body), false, "a Venture control carries no source_lines and the gate does not force one");
    const rows = readQueue(folder).rows;
    assert.deepEqual(rows.map((row) => row.id), result.ids);
    assert.ok(rows.every((row) => row.status === "pending"), "the valid variant lands pending for review");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5B: a valid traceable request retains its exact control and source_lines provenance while passing the gates", async () => {
  const slug = uniqueSlug("studio-ok");
  const folder = join(repoRoot, "content", slug);
  const claim = "Short studio claim stays exact.";
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Valid studio",
    originalInput: claim, treatments: [], platforms: ["x", "bluesky"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [4], canonicalUrl: "https://www.humaninference.ai/p/studio-source" },
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "source.md"), `---\nsource_kind: essay\n---\n${claim}\n`);
  writeFileSync(join(folder, "routing.md"), "| x | include |\n| bluesky | skip |\n");
  try {
    const result = await generateConfiguredContent(slug, configured);
    const xVariant = configured.variants.find((variant) => variant.platform === "x")!;
    assert.deepEqual(result.ids, [xVariant.identity.id]);
    const file = readFileSync(join(folder, "derivatives", `${xVariant.identity.id}.md`), "utf8");
    const { fm, body } = splitFrontmatter(file);
    // Traceability retained: the control carries its source_lines and its EXACT author body (an
    // exact parsed-body comparison, so prepended or trailing content cannot slip through).
    assert.match(file, /^source_lines: \[4\]$/m);
    assert.deepEqual(fm.source_lines, [4]);
    assert.equal(body, claim, "the untreated control body is byte-for-byte exact");
    // Canonical-URL provenance retained: an essay source carries the published-source CTA signal.
    assert.equal(fm.cta, "source");
    assert.match(file, /^cta_label: "Read the full essay:"$/m);
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
