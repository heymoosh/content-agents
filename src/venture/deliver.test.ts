import { test, describe, before, beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverVenture, confirmManualDelivery } from "./deliver.js";
import { createArtifact, transitionArtifact, readArtifact } from "./artifacts.js";
import { ventureDir, phase1Dir, readyToPasteDir } from "./paths.js";
import { loadRules, type VentureRules } from "./rules.js";
import { PullError } from "../pull/errors.js";

const SLUG = "zz-test-deliver";
const TEST_LEDGER = join(tmpdir(), "venture-deliver-test-ledger.jsonl");
let rules: VentureRules;

before(() => {
  process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
});
after(() => {
  delete process.env.CONTENT_AGENTS_TEST_LEDGER;
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

beforeEach(() => {
  rules = loadRules();
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

function seedApprovedPost(kind: "substack-post" | "text-post-note", id = "p1-a") {
  createArtifact(SLUG, rules, {
    artifact_id: id,
    phase: 1,
    artifact_kind: kind,
    title: "test post",
    body_path: `phase-1-attention/${id}.md`,
    checkpoint_id: "checkpoint-1",
    venture_id: SLUG,
    venture_phase: 1,
    message_id: `msg-${id}`,
    at: "t0",
  });
  mkdirSync(phase1Dir(SLUG), { recursive: true });
  writeFileSync(`${phase1Dir(SLUG)}/${id}.md`, "test body content?\n");
  transitionArtifact(SLUG, id, { editorial_status: "approved", delivery_status: "ready" }, "t1");
}

describe("deliverVenture -- manual (substack-post)", () => {
  test("writes ready-to-paste and moves to handed_off", async () => {
    seedApprovedPost("substack-post");
    const results = await deliverVenture(SLUG);
    assert.equal(results.length, 1);
    assert.equal(results[0].action, "handed_off");
    assert.equal(existsSync(`${readyToPasteDir(SLUG)}/p1-a.txt`), true);
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "handed_off");
  });

  test("a not-yet-ready artifact is skipped entirely", async () => {
    createArtifact(SLUG, rules, {
      artifact_id: "p1-b",
      phase: 1,
      artifact_kind: "substack-post",
      title: "t",
      venture_id: SLUG,
      venture_phase: 1,
      message_id: "msg-b",
      at: "t0",
    });
    const results = await deliverVenture(SLUG);
    assert.equal(results.length, 0);
  });
});

describe("confirmManualDelivery", () => {
  test("moves handed_off -> live_confirmed with url evidence", async () => {
    seedApprovedPost("substack-post");
    await deliverVenture(SLUG);
    confirmManualDelivery(SLUG, "p1-a", "https://humaninference.substack.com/p/test", "t2");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "live_confirmed");
    assert.equal(a?.evidence?.type, "url");
    assert.equal(a?.evidence?.confirmed_by, "muxin");
  });

  test("refuses to confirm a post that hasn't been handed off yet", () => {
    seedApprovedPost("substack-post");
    assert.throws(() => confirmManualDelivery(SLUG, "p1-a", "https://x", "t1"), /not handed_off/);
  });
});

describe("deliverVenture -- app (text-post-note), the live-posting-critical path", () => {
  test("first run claims a slot, does not post", async () => {
    seedApprovedPost("text-post-note");
    const postFn = async () => {
      throw new Error("postFn must not be called on the claim phase");
    };
    const results = await deliverVenture(SLUG, { postFn });
    assert.equal(results[0].action, "claimed");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "handed_off");
  });

  test("once the claimed slot is due, fires postFn and moves to live_confirmed with agent evidence", async () => {
    seedApprovedPost("text-post-note");
    const noPostYet = async () => {
      throw new Error("must not be called on the claim phase");
    };
    await deliverVenture(SLUG, { postFn: noPostYet });

    let called = false;
    const postFn = async (_ctx: unknown, text: string) => {
      called = true;
      assert.equal(text, "test body content?");
      return { ref: "note-ref-123" };
    };
    const farFuture = new Date(Date.now() + 400 * 24 * 3600 * 1000);
    const results = await deliverVenture(SLUG, { postFn, now: farFuture });
    assert.equal(called, true);
    assert.equal(results[0].action, "posted");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "live_confirmed");
    assert.equal(a?.evidence?.type, "agent");
    assert.equal(a?.evidence?.value, "note-ref-123");
    assert.equal(a?.evidence?.provider, "substack-notes");
  });

  test("a thrown PullError moves the artifact to failed with a failure object, never crashes the run", async () => {
    seedApprovedPost("text-post-note");
    const noPostYet = async () => {
      throw new Error("must not be called on the claim phase");
    };
    await deliverVenture(SLUG, { postFn: noPostYet });

    const postFn = async () => {
      throw new PullError("SESSION_EXPIRED", "saved login lapsed");
    };
    const farFuture = new Date(Date.now() + 400 * 24 * 3600 * 1000);
    const results = await deliverVenture(SLUG, { postFn, now: farFuture });
    assert.equal(results[0].action, "failed");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "failed");
    assert.equal(a?.failure?.provider, "substack-notes");
    assert.equal(a?.failure?.retryable, true); // SESSION_EXPIRED is retryable
  });

  test("a UI_CHANGED PullError is recorded as not retryable", async () => {
    seedApprovedPost("text-post-note");
    await deliverVenture(SLUG, {
      postFn: async () => {
        throw new Error("claim phase");
      },
    });
    const farFuture = new Date(Date.now() + 400 * 24 * 3600 * 1000);
    await deliverVenture(SLUG, {
      postFn: async () => {
        throw new PullError("UI_CHANGED", "selector missing");
      },
      now: farFuture,
    });
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.failure?.retryable, false);
  });
});
