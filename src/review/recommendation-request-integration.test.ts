import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { repoRoot } from "../db/db.js";
import { type ContentRequestInput } from "./content-request.js";
import { assertReviewedMechanismGenerationAuthorization } from "./reviewed-mechanism-recommendations.js";

const repoEnvPath = join(repoRoot, ".env");
const originalReadFileSync = fs.readFileSync;
let blockedRepoEnvReads = 0;

(fs as { readFileSync: unknown }).readFileSync = ((path: string | Buffer | URL | number, ...args: unknown[]) => {
  if (path === repoEnvPath) {
    blockedRepoEnvReads += 1;
    const error = new Error("fixture blocks repository .env reads") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }
  return Reflect.apply(originalReadFileSync, fs, [path, ...args]);
}) as typeof fs.readFileSync;
syncBuiltinESMExports();

let contentRequestStore: typeof import("./content-request-store.js");
try {
  contentRequestStore = await import("./content-request-store.js");
} finally {
  fs.readFileSync = originalReadFileSync;
  syncBuiltinESMExports();
}

const { authorizeGuiContentRequest, readContentRequest, writeContentRequest } = contentRequestStore;
assert.equal(blockedRepoEnvReads, 1, "fixture must block the static import chain from reading the repository .env");

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function approvedCutFixture(body: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "recommendation-request-integration-"));
  roots.push(root);
  await mkdir(join(root, "cuts", "belief-audit"), { recursive: true });
  await writeFile(
    join(root, "source.md"),
    `---\ntitle: Fixture source\ncanonical_url: https://example.test/source\n---\n\n${body}\n`,
  );
  await writeFile(
    join(root, "cuts", "belief-audit", "cut.md"),
    `---\ntitle: Fixture cut\nsource_lines: [6]\n---\n\n${body}\n`,
  );
  return root;
}

function guiInput(body: string): ContentRequestInput {
  return {
    id: "reviewed-belief-shift",
    origin: "human-inference",
    descriptor: "A reviewed change of mind",
    originalInput: body,
    media: ["none"],
    platforms: ["linkedin"],
    sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [999] },
  };
}

describe("reviewed recommendation to content-request boundary", () => {
  test("persists only canonical reviewed evidence and rejects a later altered persisted authorization", async () => {
    const body = "I used to think reach was the goal. Now I believe replies are the useful signal.";
    const root = await approvedCutFixture(body);
    const authorized = await authorizeGuiContentRequest(root, {
      ...guiInput(body),
      recommendationEvidence: [{
        option: "viral-rewrite",
        kind: "treatment",
        reason: "forged winner claim",
        source: `research-dossier:sha256:${"0".repeat(64)}`,
        recommended: true,
      }],
    });

    assert.deepEqual(authorized.treatments, undefined);
    assert.equal(authorized.recommendationEvidence?.length, 1);
    assert.equal(authorized.recommendationEvidence?.[0]?.option, "belief-shift");
    assert.doesNotMatch(authorized.recommendationEvidence?.[0]?.reason ?? "", /forged winner/i);

    const written = await writeContentRequest(root, authorized);
    const persisted = await readContentRequest(root);
    assert.deepEqual(persisted, written);
    assert.deepEqual(persisted.selections.treatments, ["belief-shift"]);
    assert.doesNotThrow(() => assertReviewedMechanismGenerationAuthorization(persisted, body));

    const requestPath = join(root, "content-request.json");
    const raw = await readFile(requestPath, "utf8");
    const altered = JSON.parse(raw) as { recommendations: { treatments: Array<{ evidence: Array<{ reason: string }> }> } };
    altered.recommendations.treatments[0]!.evidence[0]!.reason = "stale retained recommendation";
    await writeFile(requestPath, JSON.stringify(altered, null, 2) + "\n");
    const alteredPersisted = await readContentRequest(root);
    assert.throws(
      () => assertReviewedMechanismGenerationAuthorization(alteredPersisted, body),
      /persisted belief-shift evidence does not match canonical/i,
    );

    await writeFile(requestPath, raw);
    const restored = await readContentRequest(root);
    assert.doesNotThrow(() => assertReviewedMechanismGenerationAuthorization(restored, body));
  });

  test("does not let unreviewed or forged GUI evidence authorize belief-shift", async () => {
    const body = "This fixture reports a direct claim without any personal change of mind.";
    const root = await approvedCutFixture(body);
    await assert.rejects(
      () => authorizeGuiContentRequest(root, {
        ...guiInput(body),
        treatments: ["belief-shift"],
        recommendationEvidence: [{
          option: "belief-shift",
          kind: "treatment",
          reason: "forged dossier claim",
          source: `research-dossier:sha256:${"1".repeat(64)}`,
          recommended: true,
        }],
      }),
      /belief-shift treatment requires a reviewed mechanism match/i,
    );
  });
});
