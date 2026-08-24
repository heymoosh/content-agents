// Seed a venture into Phase 3 so the response gate and the artifact editor actually render.
//
// The repo's committed zz-test-* ventures are canon-only stubs — zz-test-phase3 is really in
// phase 1 — so neither control appears on them and Pass C could only report "blocked". This seeds a
// real one using the repo's OWN writers (appendCanonEvent, createArtifact), exactly the way
// src/venture/status.test.ts reaches Phase 3. It writes only inside this worktree.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { appendCanonEvent } from "../src/venture/canon.js";
import { createArtifact } from "../src/venture/artifacts.js";
import { loadRules } from "../src/venture/rules.js";
import { ventureDir, clusterAnalysisPath } from "../src/venture/paths.js";

const SLUG = process.argv[2] ?? "e2e-phase3";

function main(): void {
  const rules = loadRules();
  mkdirSync(ventureDir(SLUG), { recursive: true });

  // Kickoff, then both hard stops cleared: that is what moves current_phase to 3.
  appendCanonEvent(SLUG, "venture-kicked-off", `${SLUG}/kickoff`, {}, "t0");
  appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t1");
  appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t2");

  // An artifact for the body editor to open. Phase 3, so it belongs to the current phase — the
  // room filters cards to the phase the venture is in.
  // The "Edit the words" action only exists when the artifact record carries a body_path
  // (venture-thread.ts:477), so the record and the file both have to be real.
  // Relative to the VENTURE folder, not the repo — resolveBodyFile resolves it under
  // ventureDir(slug) and refuses anything that escapes it.
  const relBody = "phase-3-offer/e2e-outline.md";
  mkdirSync(`${ventureDir(SLUG)}/phase-3-offer`, { recursive: true });
  const bodyPath = `${ventureDir(SLUG)}/phase-3-offer/e2e-outline.md`;
  if (!existsSync(bodyPath)) {
    writeFileSync(
      bodyPath,
      "# E2E product outline\n\nSection one, written by the seeder so the editor has real bytes to read.\n"
    );
  }

  createArtifact(SLUG, rules, {
    artifact_id: "e2e-outline",
    phase: 3,
    artifact_kind: "product-outline",
    title: "E2E product outline",
    body_path: relBody,
    checkpoint_id: "checkpoint-3",
    venture_id: SLUG,
    venture_phase: 3,
    message_id: "msg-e2e-outline",
    at: "t3",
  });

  if (!existsSync(clusterAnalysisPath(SLUG))) {
    writeFileSync(clusterAnalysisPath(SLUG), JSON.stringify({ analyzed_at: "t3", clusters: [] }));
  }

  console.log(`seeded ${SLUG} into Phase 3`);
}

main();
