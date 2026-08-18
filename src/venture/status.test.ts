import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { formatStatus } from "./status.js";
import { createArtifact } from "./artifacts.js";
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
});
