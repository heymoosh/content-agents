import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { buildAtomizeRequestInput, collectSourceLines, writeAtomizeContentRequest } from "./content-request.js";
import { readContentRequest, writeContentRequest } from "../review/content-request-store.js";

function folderWithRun(options: { sourceLines?: string; canonical?: string; title?: string } = {}): string {
  const folder = mkdtempSync(join(tmpdir(), "atomize-request-"));
  const canonical = options.canonical ?? "https://humaninference.substack.com/p/a-post";
  writeFileSync(
    join(folder, "source.md"),
    `---\ntitle: "${options.title ?? "A real title"}"\ncanonical_url: ${canonical}\n---\n\nFirst line of the essay.\n\nSecond line of the essay.\n`
  );
  writeFileSync(
    join(folder, "review-queue.md"),
    "# Review queue — A real title\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----|----|----|----|----|----|----|----|----|\n| x-1 | x | text | derivatives/x-1.md | 5 | 5 | true | pending | | from /cycle |\n"
  );
  mkdirSync(join(folder, "derivatives"));
  writeFileSync(
    join(folder, "derivatives", "x-1.md"),
    `---\nplatform: x\nsource_lines: ${options.sourceLines ?? "[12, 3]"}\n---\nBody.\n`
  );
  return folder;
}

test("builds a request from a real atomize folder without inventing configuration", () => {
  const folder = folderWithRun();
  const input = buildAtomizeRequestInput(folder, "human-inference");

  assert.equal(input.origin, "human-inference");
  assert.equal(input.descriptor, "A real title");
  assert.match(input.originalInput, /First line of the essay\./);
  assert.doesNotMatch(input.originalInput, /canonical_url/);
  // Studio configured and generated none of this; the request must not claim otherwise.
  assert.deepEqual(input.treatments, []);
  assert.deepEqual(input.media, []);
  assert.deepEqual(input.platforms, []);
  assert.equal(input.includeUntreatedControl, false);
  assert.deepEqual(input.sourceProvenance, {
    kind: "source",
    sourceLines: [3, 12],
    canonicalUrl: "https://humaninference.substack.com/p/a-post",
  });
});

test("collects and normalizes source_lines, dropping references the schema cannot hold", () => {
  const folder = folderWithRun({ sourceLines: '[9, "4-6", 9, 0, "nope", -2]' });
  assert.deepEqual(collectSourceLines(folder), [9, "4-6"]);
});

test("omits provenance rather than fabricating it when no derivative cites source lines", () => {
  const folder = folderWithRun({ sourceLines: "[]" });
  assert.equal(buildAtomizeRequestInput(folder, "human-inference").sourceProvenance, null);
});

test("drops a non-https canonical url instead of writing an unusable one", () => {
  const folder = folderWithRun({ canonical: "http://example.com/p" });
  const provenance = buildAtomizeRequestInput(folder, "human-inference").sourceProvenance;
  assert.equal(provenance?.canonicalUrl, undefined);
  assert.deepEqual(provenance?.sourceLines, [3, 12]);
});

test("falls back to the review-queue heading when source.md has no title", () => {
  const folder = folderWithRun();
  writeFileSync(join(folder, "source.md"), "---\ncanonical_url: https://example.com/p\n---\n\nBody text.\n");
  assert.equal(buildAtomizeRequestInput(folder, "human-inference").descriptor, "A real title");
});

test("refuses a folder that is not an atomize run", () => {
  const folder = mkdtempSync(join(tmpdir(), "atomize-request-empty-"));
  assert.throws(() => buildAtomizeRequestInput(folder, "human-inference"), /not an \/atomize content folder/);
});

test("writes a request that round-trips through the store's own validation", async () => {
  const folder = folderWithRun();
  const result = await writeAtomizeContentRequest(folder, "human-inference");
  assert.equal(result.reason, "written");
  assert.equal(existsSync(join(folder, "content-request.json")), true);

  const stored = await readContentRequest(folder);
  assert.equal(stored.kind, "content_request");
  assert.equal(stored.origin, "human-inference");
  assert.deepEqual(stored.variants, []);
  assert.equal(stored.control.enabled, false);
  // The two fields the Content room's approve filter actually gates on.
  assert.ok(stored.id);
  assert.ok(stored.originalInput);
  // POST /api/content/request and generateConfiguredContent both refuse `request.id !== slug`,
  // so a namespaced id would make the folder impossible to configure.
  assert.equal(stored.id, basename(folder));
});

test("collects source_lines from every cut's derivatives, not only the default ones", () => {
  const folder = folderWithRun({ sourceLines: "[4]" });
  mkdirSync(join(folder, "cuts", "short", "derivatives"), { recursive: true });
  writeFileSync(
    join(folder, "cuts", "short", "derivatives", "bluesky-1.md"),
    '---\nplatform: bluesky\nsource_lines: [21, "30-33"]\n---\nBody.\n'
  );
  assert.deepEqual(collectSourceLines(folder), [4, 21, "30-33"]);
});

test("re-running refreshes its own request instead of duplicating it", async () => {
  const folder = folderWithRun();
  const first = await writeAtomizeContentRequest(folder, "human-inference");
  const before = readFileSync(join(folder, "content-request.json"), "utf8");
  const second = await writeAtomizeContentRequest(folder, "human-inference");
  assert.equal(second.reason, "refreshed");
  assert.equal(second.id, first.id);
  assert.equal(readFileSync(join(folder, "content-request.json"), "utf8"), before);
});

test("never clobbers a request written by the Content room", async () => {
  const folder = folderWithRun();
  await writeContentRequest(folder, {
    id: basename(folder),
    origin: "studio",
    descriptor: "Configured in Studio",
    originalInput: "A verbatim thought.",
    platforms: ["bluesky"],
    media: ["static-quote-card"],
  });
  const before = readFileSync(join(folder, "content-request.json"), "utf8");

  const result = await writeAtomizeContentRequest(folder, "human-inference");
  assert.equal(result.written, false);
  assert.equal(result.reason, "foreign-request-kept");
  assert.equal(readFileSync(join(folder, "content-request.json"), "utf8"), before);
});

test("never clobbers Studio configuration saved onto its own request", async () => {
  // A Content-room save keeps this writer's id (mergeContentConfiguration preserves it), so the
  // id alone cannot tell a bare atomize request from one Muxin has since configured.
  const configurations = [
    { platforms: ["bluesky"] },
    { media: ["static-quote-card"] },
    { treatments: ["hook-variants"] },
    { includeUntreatedControl: true },
    { sourceProvenance: { kind: "approved-cut" as const, lens: "short", sourceLines: [3] } },
  ];
  for (const configuration of configurations) {
    const folder = folderWithRun();
    const id = (await writeAtomizeContentRequest(folder, "human-inference")).id;
    assert.equal(id, basename(folder));
    await writeContentRequest(folder, {
      id,
      origin: "human-inference",
      descriptor: "A real title",
      originalInput: "Muxin's approved cut body.",
      platforms: [],
      media: [],
      treatments: [],
      includeUntreatedControl: false,
      ...configuration,
    });
    const before = readFileSync(join(folder, "content-request.json"), "utf8");

    const result = await writeAtomizeContentRequest(folder, "human-inference");
    assert.equal(result.written, false, `overwrote ${JSON.stringify(configuration)}`);
    assert.equal(result.reason, "configured-request-kept");
    assert.equal(readFileSync(join(folder, "content-request.json"), "utf8"), before);
  }
});

test("records the brand's own origin so delivery policy still resolves it", async () => {
  for (const brand of ["charles", "fiction"] as const) {
    const folder = folderWithRun();
    await writeAtomizeContentRequest(folder, brand);
    assert.equal((await readContentRequest(folder)).origin, brand);
  }
});
