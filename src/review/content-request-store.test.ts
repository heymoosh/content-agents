import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContentRequest, type ContentRequestInput } from "./content-request.js";
import { authorizeGuiContentRequest, readContentRequest, writeContentRequest } from "./content-request-store.js";

const roots: string[] = [];
const input: ContentRequestInput = {
  id: "request-store-1", origin: "human-inference", descriptor: "A useful descriptor",
  originalInput: "  Keep this exact\nincluding whitespace.  ", treatments: ["summary"],
  media: ["image"], platforms: ["bluesky"],
};

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function rootDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "content-request-store-"));
  roots.push(root);
  return root;
}

describe("content request store", () => {
  test("ordinary initial GUI save refuses whole-source configuration before an advisor cut is approved", async () => {
    const root = await rootDir();
    await writeFile(join(root, "source.md"), "---\ntitle: A source\norigin: https://humaninference.substack.com/p/source\ncanonical_url: https://humaninference.substack.com/p/source\n---\n\nFirst line.\n\nSecond line.\n");
    await assert.rejects(() => authorizeGuiContentRequest(root, {
      ...input, originalInput: "First line.\n\nSecond line.", sourceProvenance: null,
    }), /approved advisor cut is required/i);
  });

  test("initial GUI authority rejects a client body that is not the server source", async () => {
    const root = await rootDir();
    await writeFile(join(root, "source.md"), "---\ntitle: A source\ncanonical_url: https://humaninference.substack.com/p/source\n---\n\nAuthoritative body.\n");
    await assert.rejects(
      () => authorizeGuiContentRequest(root, { ...input, originalInput: "client replacement" }),
      /approved advisor cut is required/i,
    );
  });

  test("approved-cut configuration binds the cut body and source_lines read by the server", async () => {
    const root = await rootDir();
    await mkdir(join(root, "cuts", "belief-audit"), { recursive: true });
    await writeFile(join(root, "source.md"), "---\ntitle: A source\ncanonical_url: https://humaninference.substack.com/p/source\n---\n\nOne.\nTwo.\n");
    await writeFile(join(root, "cuts", "belief-audit", "cut.md"), "---\ntitle: Belief audit\nsource_lines: [6]\n---\n\nOne.\n");
    const authorized = await authorizeGuiContentRequest(root, {
      ...input, originalInput: "One.", sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [999] },
    });
    assert.equal(authorized.originalInput, "One.");
    assert.deepEqual(authorized.sourceProvenance, { kind: "approved-cut", lens: "belief-audit", sourceLines: [6], canonicalUrl: "https://humaninference.substack.com/p/source" });
  });

  test("an edited cut containing an uncited claim is refused even when its stale source_lines remain", async () => {
    const root = await rootDir();
    await mkdir(join(root, "cuts", "belief-audit"), { recursive: true });
    await writeFile(join(root, "source.md"), "---\ntitle: A source\ncanonical_url: https://humaninference.substack.com/p/source\n---\n\nOne supported claim.\n");
    await writeFile(join(root, "cuts", "belief-audit", "cut.md"), "---\ntitle: Belief audit\nsource_lines: [6]\n---\n\nOne supported claim plus an invented result.\n");
    await assert.rejects(() => authorizeGuiContentRequest(root, {
      ...input, originalInput: "One supported claim plus an invented result.",
      sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [6] },
    }), /cut body does not match.*source_lines/i);
  });

  test("missing cross-room requests cannot be recovered by rebranding their source as Human Inference", async () => {
    for (const marker of [
      { origin: "fiction:series:chapter-1", sourceKind: "fiction-promotion" },
      { origin: "charles:charles-lord-featherbottom", sourceKind: "charles" },
      { origin: "venture:civic-tech:probe-1", sourceKind: "venture" },
    ]) {
      const root = await rootDir();
      await writeFile(join(root, "source.md"), `---\ntitle: Cross room\norigin: ${marker.origin}\nsource_kind: ${marker.sourceKind}\n---\n\nApproved body.\n`);
      await assert.rejects(
        () => authorizeGuiContentRequest(root, { ...input, originalInput: "Approved body." }),
        /cross-room.*request.*missing|missing.*cross-room.*request/i,
      );
    }
  });

  test("ordinary GUI authorization requires an approved cut even for a Human Inference source", async () => {
    const root = await rootDir();
    await writeFile(join(root, "source.md"), "---\ntitle: Ambiguous\norigin: pasted-text\n---\n\nAuthoritative body.\n");
    await assert.rejects(
      () => authorizeGuiContentRequest(root, { ...input, originalInput: "Authoritative body." }),
      /approved advisor cut is required/i,
    );
  });

  test("an existing authority-less GUI request cannot be upgraded from the whole source", async () => {
    const root = await rootDir();
    await writeFile(join(root, "source.md"), "---\ntitle: A source\ncanonical_url: https://humaninference.substack.com/p/source\n---\n\nAuthoritative body.\n");
    const existing = buildContentRequest({ ...input, originalInput: "Authoritative body.", sourceProvenance: null });
    await assert.rejects(() => authorizeGuiContentRequest(root, {
      ...input, originalInput: "forged replacement", sourceProvenance: { kind: "source", sourceLines: [999] },
      treatments: ["shorter-version"],
    }, existing), /approved advisor cut is required/i);
  });

  test("an existing approved-cut request is revalidated against disk on every configuration save", async () => {
    const root = await rootDir();
    await mkdir(join(root, "cuts", "belief-audit"), { recursive: true });
    await writeFile(join(root, "source.md"), "---\ntitle: A source\n---\n\nOne supported claim.\n");
    await writeFile(join(root, "cuts", "belief-audit", "cut.md"), "---\nsource_lines: [5]\n---\n\nOne supported claim.\n");
    const existing = buildContentRequest({
      ...input, originalInput: "One supported claim.",
      sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [5] },
    });
    await writeFile(join(root, "cuts", "belief-audit", "cut.md"), "---\nsource_lines: [5]\n---\n\nA changed uncited claim.\n");
    await assert.rejects(() => authorizeGuiContentRequest(root, {
      ...input, originalInput: "One supported claim.", treatments: ["shorter-version"],
    }, existing), /cut body does not match.*source_lines/i);
  });

  test("writes and reads a validated request while preserving originalInput verbatim", async () => {
    const root = await rootDir();
    const written = await writeContentRequest(root, input);
    const read = await readContentRequest(root);
    assert.deepEqual(read, written);
    assert.equal(read.originalInput, input.originalInput);
    assert.deepEqual(JSON.parse(await readFile(join(root, "content-request.json"), "utf8")), written);
  });

  test("preserves Venture source and approval provenance across persistence", async () => {
    const root = await rootDir();
    const ventureInput: ContentRequestInput = {
      ...input, origin: "venture", ventureId: "civic-tech",
      ventureSource: {
        artifactId: "p1-note", phase: 1, artifactKind: "text-post-note", messageId: "msg-1",
        bodyPath: "phase-1-attention/p1-note.md", claimRefs: [{ claim: "One", ref: "intake:q1" }],
        approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
      },
    };
    const written = await writeContentRequest(root, ventureInput);
    assert.ok(written.ventureSource);
    assert.deepEqual((await readContentRequest(root)).ventureSource, written.ventureSource);
  });

  test("preserves authoritative source provenance across persistence", async () => {
    const root = await mkdtemp(join(tmpdir(), "content-request-source-"));
    const written = await writeContentRequest(root, { ...input, sourceProvenance: { kind: "source", sourceLines: [1, "3-4"] } });
    assert.deepEqual((await readContentRequest(root)).sourceProvenance, written.sourceProvenance);
  });

  test("preserves approved experiment-plan lineage across persistence", async () => {
    const root = await rootDir();
    const base = buildContentRequest({ ...input, treatments: ["summary"], media: ["none"], platforms: ["linkedin"] });
    const variablesByVariant = Object.fromEntries(base.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }]));
    const written = await writeContentRequest(root, {
      ...input, treatments: ["summary"], media: ["none"], platforms: ["linkedin"],
      experiment: {
        id: "experiment:opening", recommendationId: "signals:opening",
        planProposalDigest: `sha256:${"a".repeat(64)}`, planDecisionDigest: `sha256:${"b".repeat(64)}`,
        planApprovedAt: "2026-08-31T18:00:00.000Z", hypothesis: "A grounded opening will improve replies.",
        controlledVariable: "opening", variablesByVariant,
      },
    });
    assert.deepEqual((await readContentRequest(root)).experiment, written.experiment);
  });

  test("preserves server-owned fiction source context across persistence", async () => {
    const root = await rootDir();
    const fictionInput: ContentRequestInput = {
      ...input, origin: "fiction", ventureId: "least-of-us-fiction",
      sourceContext: {
        kind: "fiction-approved-promotion", authoritativeBody: "Approved body.",
        series: { id: "least", title: "The Least" }, chapter: { number: 2, title: "Door" },
        sourcePassages: [{ ref: "chapter-02:line-1", text: "Locked.", locked: true }],
        restrictions: { canon: ["Keep canon."], provenance: ["Quote locked passages only."] },
      },
    };
    const written = await writeContentRequest(root, fictionInput);
    const roundTrip = await readContentRequest(root);
    assert.deepEqual(roundTrip.sourceContext, written.sourceContext);
    assert.equal(roundTrip.sourceContext?.authoritativeBody, "Approved body.");
  });

  test("validates writes through the domain builder", async () => {
    const root = await rootDir();
    await assert.rejects(() => writeContentRequest(root, { ...input, originalInput: "" }), /originalInput is required/);
    await assert.rejects(() => writeContentRequest(join(root, "missing"), input), /directory|folder|root|exist/i);
  });

  test("validates persisted content on read", async () => {
    const root = await rootDir();
    await writeFile(join(root, "content-request.json"), JSON.stringify({ ...buildContentRequest(input), originalInput: "" }));
    await assert.rejects(() => readContentRequest(root), /originalInput is required/);
  });

  test("rejects targets outside the supplied root", async () => {
    const root = await rootDir();
    const outside = await rootDir();
    await symlink(outside, join(root, "content-request.json"));
    await assert.rejects(() => readContentRequest(root), /outside|root|target|symlink/i);
  });
});
