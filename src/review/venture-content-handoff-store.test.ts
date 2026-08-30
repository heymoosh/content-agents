import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApprovedVentureHandoff, findExistingVentureContentFolder } from "./venture-content-handoff-store.js";

const priorRoot = process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
afterEach(() => { if (priorRoot === undefined) delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT; else process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = priorRoot; });

async function fixture(bodyPath = "phase-1-attention/p1-essay-01.md") {
  const root = await mkdtemp(join(tmpdir(), "venture-handoff-"));
  const venture = join(root, "civic-tech");
  await mkdir(join(venture, "phase-1-attention"), { recursive: true });
  await writeFile(join(venture, "artifacts.jsonl"), JSON.stringify({
    artifact_id: "p1-essay-01", phase: 1, artifact_kind: "substack-post", title: "A useful test",
    body_path: bodyPath, venture_id: "civic-tech", venture_phase: 1, message_id: "msg-1",
    editorial_status: "approved", delivery_status: "ready", delivery_mode: "manual", publishable: false,
    claim_refs: [{ claim: "A claim", ref: "intake:q1" }], created_at: "now", updated_at: "now",
  }) + "\n");
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = root;
  return { root, venture };
}

describe("approved Venture content handoff store", () => {
  test("reads the declared body and hands off only the approved artifact", async () => {
    const { venture } = await fixture();
    await writeFile(join(venture, "phase-1-attention/p1-essay-01.md"), "Approved Venture copy.\n");
    const handoff = await createApprovedVentureHandoff({ slug: "civic-tech", artifactId: "p1-essay-01" });
    assert.equal(handoff.body, "Approved Venture copy.\n");
    assert.equal(handoff.artifactId, "p1-essay-01");
  });

  test("refuses traversal and symlink body paths", async () => {
    const traversal = await fixture("../outside.md");
    await writeFile(join(traversal.root, "outside.md"), "secret");
    await assert.rejects(createApprovedVentureHandoff({ slug: "civic-tech", artifactId: "p1-essay-01" }), /outside/i);
    const linked = await fixture("phase-1-attention/link.md");
    await writeFile(join(linked.root, "outside.md"), "secret");
    await symlink(join(linked.root, "outside.md"), join(linked.venture, "phase-1-attention/link.md"));
    await assert.rejects(createApprovedVentureHandoff({ slug: "civic-tech", artifactId: "p1-essay-01" }), /regular|symbolic|outside/i);
  });

  test("finds an existing Content source by exact Venture provenance for retry recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "venture-content-existing-"));
    const matching = join(root, "2026-08-29-useful-test");
    await mkdir(matching, { recursive: true });
    await writeFile(join(matching, "source.md"), "---\norigin: venture:civic-tech:p1-essay-01\n---\n\nBody\n");
    assert.equal(findExistingVentureContentFolder("civic-tech", "p1-essay-01", root), matching);
    assert.equal(findExistingVentureContentFolder("civic-tech", "p1-other", root), null);
  });
});
