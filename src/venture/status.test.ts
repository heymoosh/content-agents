import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { formatStatus } from "./status.js";
import { createArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import { ventureDir } from "./paths.js";
import { loadRules } from "./rules.js";

const SLUG = "zz-test-status";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

describe("formatStatus -- plain language, no internal vocabulary", () => {
  test("no artifacts yet reads as nothing drafted", () => {
    const text = formatStatus(SLUG);
    assert.match(text, /No posts drafted yet/);
  });

  test("never leaks internal field names into the output", () => {
    const rules = loadRules();
    createArtifact(SLUG, rules, {
      artifact_id: "p1-a",
      phase: 1,
      artifact_kind: "text-post-note",
      title: "t",
      checkpoint_id: "checkpoint-1",
      venture_id: SLUG,
      venture_phase: 1,
      message_id: "msg-a",
      at: "t0",
    });
    const text = formatStatus(SLUG);
    for (const forbidden of ["artifact", "delivery_status", "gated", "editorial_status"]) {
      assert.doesNotMatch(text.toLowerCase(), new RegExp(forbidden));
    }
  });

  // Regression: once checkpoint-1 clears, formatStatus starts reporting checkpoint-2's blocking
  // reasons too -- those come from a different code path (checkpointArtifactState's
  // required_artifact_kinds branch, state.ts) than checkpoint-1's, and it's easy for a raw
  // "missing required artifact kind ..." reason to leak straight into user-facing text unmapped.
  test("Phase 2 output (once checkpoint-1 has cleared) never leaks internal vocabulary either", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const text = formatStatus(SLUG);
    assert.match(text, /Phase 2/);
    for (const forbidden of ["artifact", "delivery_status", "gated", "editorial_status"]) {
      assert.doesNotMatch(text.toLowerCase(), new RegExp(forbidden));
    }
  });
});
