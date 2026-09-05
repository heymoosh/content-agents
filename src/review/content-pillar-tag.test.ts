// SLICE-5E: the configured Content generation path (generateConfiguredContent) surfaces the pillar
// the piece was routed under onto each generated derivative's frontmatter as a single
// `pillar: <value>` line — read deterministically from routing.md's title line via readPillar
// (src/review/reschedule.ts), never recomputed from config/pillars.yaml and never a model call.
// When routing.md names no pillar (readPillar returns null) no `pillar:` line is written and the
// output is byte-identical to today's. Metadata only: bodies, ordering, other frontmatter,
// review-queue rows, and source.md are unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentRequest } from "./content-request.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { repoRoot } from "../db/db.js";
import { readQueue } from "../publish/queue.js";
import { generateConfiguredContent } from "./jobs.js";
import { readPillar } from "./reschedule.js";

const QUEUE_HEADER =
  "# Review queue\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n";

let seq = 0;
function uniqueSlug(tag: string): string {
  return `test-5e-${tag}-${process.pid}-${Date.now()}-${++seq}`;
}

const CLAIM = "Short studio claim stays exact.";
const SOURCE_FM = "---\nsource_kind: essay\n---\n";

// Build a studio content folder with a control-only request (no treated variant, so no model is
// needed) and run the real generation path. `routing` is written verbatim as routing.md, so a
// caller controls whether the title line names a pillar.
async function runStudio(tag: string, routing: string): Promise<{ folder: string; derivativePath: string; ids: string[] }> {
  const slug = uniqueSlug(tag);
  const folder = join(repoRoot, "content", slug);
  const configured = buildContentRequest({
    id: slug, origin: "studio", descriptor: "Pillar studio", originalInput: CLAIM,
    treatments: [], platforms: ["bluesky"], media: [], includeUntreatedControl: true,
    sourceProvenance: { kind: "source", sourceLines: [4], canonicalUrl: "https://www.humaninference.ai/p/pillar-source" },
  });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), QUEUE_HEADER);
  writeFileSync(join(folder, "source.md"), `${SOURCE_FM}${CLAIM}\n`);
  writeFileSync(join(folder, "routing.md"), routing);
  const result = await generateConfiguredContent(slug, configured);
  const variant = configured.variants.find((v) => v.platform === "bluesky")!;
  assert.deepEqual(result.ids, [variant.identity.id]);
  return { folder, derivativePath: join(folder, "derivatives", `${variant.identity.id}.md`), ids: result.ids };
}

// A routing.md whose title line names a pillar, plus the include row generation needs. This is the
// exact shape /atomize writes ("# Routing — <pillar> — <date>"), which readPillar parses.
const pillarRouting = "# Routing — human-ai — 2026-09-05\n\n| bluesky | include |\n";
// A routing.md with no title line at all — a bare decision table. readPillar returns null.
const noPillarRouting = "| bluesky | include |\n";

test("SLICE-5E: readPillar is the reader — the routing title names the pillar, a bare table names none", () => {
  // Pin the deterministic reader this slice surfaces: title present -> exact pillar; title absent
  // (or file absent) -> null. No recompute, no config/pillars.yaml.
  const dir = join(repoRoot, "content", uniqueSlug("readpillar"));
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(join(dir, "routing.md"), pillarRouting);
    assert.equal(readPillar(dir), "human-ai");
    writeFileSync(join(dir, "routing.md"), noPillarRouting);
    assert.equal(readPillar(dir), null);
    rmSync(join(dir, "routing.md"));
    assert.equal(readPillar(dir), null, "an absent routing.md names no pillar");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SLICE-5E: a routed pillar is stamped onto every derivative's frontmatter end-to-end, and source.md is untouched", async () => {
  const { folder, derivativePath } = await runStudio("pillar-present", pillarRouting);
  try {
    const file = readFileSync(derivativePath, "utf8");
    const { fm } = splitFrontmatter(file);
    // The pillar is stamped with the exact value readPillar returns — read, not recomputed.
    assert.equal(fm.pillar, "human-ai");
    assert.equal(fm.pillar, readPillar(folder), "the stamp is exactly what the deterministic reader returns");
    // Exactly one pillar line, and it did not displace the 5c triage frontmatter it sits beside.
    assert.equal((file.match(/^pillar:/gm) ?? []).length, 1, "exactly one pillar line");
    assert.equal(fm.source_class, "frame-native", "the 5c triage stamp is still present alongside the pillar");
    assert.equal(fm.source_class_case, "not_found");
    // Metadata only: source.md is byte-for-byte unchanged (a rule-1 traceability invariant).
    assert.equal(readFileSync(join(folder, "source.md"), "utf8"), `${SOURCE_FM}${CLAIM}\n`);
    assert.ok(readQueue(folder).rows.every((row) => row.status === "pending"), "the variant lands pending for review");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("SLICE-5E: a folder whose routing.md names no pillar emits no `pillar:` line and is byte-identical to the no-pillar baseline", async () => {
  const present = await runStudio("compare-present", pillarRouting);
  const absent = await runStudio("compare-absent", noPillarRouting);
  try {
    const presentFile = readFileSync(present.derivativePath, "utf8");
    const absentFile = readFileSync(absent.derivativePath, "utf8");
    // The no-pillar path emits no pillar line at all.
    assert.equal(/^pillar:/m.test(absentFile), false, "no routed pillar -> no `pillar:` line");
    assert.equal(splitFrontmatter(absentFile).fm.pillar, undefined);
    // The ONLY difference between the two frontmatter blocks is the single pillar line: dropping it
    // from the pillar-present derivative reproduces the pillar-absent derivative byte-for-byte. This
    // proves the surfacing is additive and the absent path is byte-identical to prior behavior. The
    // request_id line encodes each folder's unique test slug, so normalize it away — it is not a
    // pillar-driven difference.
    const normalizeRequestId = (s: string) => s.replace(/^request_id: .*$/m, 'request_id: "SLUG"');
    const presentMinusPillar = normalizeRequestId(presentFile).replace(/^pillar: human-ai\n/m, "");
    assert.equal(presentMinusPillar, normalizeRequestId(absentFile), "removing only the pillar line yields the byte-identical no-pillar output");
    // source.md untouched on both paths.
    assert.equal(readFileSync(join(present.folder, "source.md"), "utf8"), `${SOURCE_FM}${CLAIM}\n`);
    assert.equal(readFileSync(join(absent.folder, "source.md"), "utf8"), `${SOURCE_FM}${CLAIM}\n`);
  } finally {
    rmSync(present.folder, { recursive: true, force: true });
    rmSync(absent.folder, { recursive: true, force: true });
  }
});
