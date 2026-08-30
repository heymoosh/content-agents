import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContentRequest, type ContentRequestInput } from "./content-request.js";
import { readContentRequest, writeContentRequest } from "./content-request-store.js";

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
