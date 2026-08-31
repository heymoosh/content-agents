import { test, describe, before, beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverVenture, confirmManualDelivery } from "./deliver.js";
import { createArtifact, transitionArtifact, readArtifact } from "./artifacts.js";
import { phase1Dir, readyToPasteDir } from "./paths.js";
import { loadRules, type VentureRules } from "./rules.js";
import { PullError } from "../pull/errors.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

const SLUG = "zz-test-deliver";
const TEST_LEDGER = join(tmpdir(), "venture-deliver-test-ledger.jsonl");
let rules: VentureRules;
const priorSubstackAccount = process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID;

before(() => {
  process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = "human-inference/substack";
});
after(() => {
  delete process.env.CONTENT_AGENTS_TEST_LEDGER;
  if (priorSubstackAccount === undefined) delete process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID;
  else process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = priorSubstackAccount;
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

beforeEach(useTempVentureRoot);

beforeEach(() => {
  rules = loadRules();
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

afterEach(() => {
  clearTempVentureRoot();
  if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
});

function seedApprovedPost(kind: "substack-post" | "text-post-note" | "welcome-email", id = "p1-a") {
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
    confirmManualDelivery(SLUG, "p1-a", { type: "url", value: "https://humaninference.substack.com/p/test" }, "t2");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "live_confirmed");
    assert.equal(a?.evidence?.type, "url");
    assert.equal(a?.evidence?.confirmed_by, "muxin");
  });

  test("refuses to confirm a post that hasn't been handed off yet", () => {
    seedApprovedPost("substack-post");
    assert.throws(() => confirmManualDelivery(SLUG, "p1-a", { type: "url", value: "https://x" }, "t1"), /not handed_off/);
  });

  // The bug this fixes: confirm hardcoded type "url", so welcome-email (min_evidence: attestation,
  // schema contract §4's example of a thing with no addressable trace) could never be confirmed in
  // a way its own minimum accepts. It is one of checkpoint 2's four required kinds, so checkpoint 2
  // could not clear at all. Muxin's only way through was to invent a link.
  test("an attestation is a real confirmation for a kind whose minimum is an attestation", async () => {
    seedApprovedPost("welcome-email");
    await deliverVenture(SLUG);
    confirmManualDelivery(SLUG, "p1-a", { type: "attestation", value: "The welcome sequence is live in Substack." }, "t2");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "live_confirmed");
    assert.equal(a?.evidence?.type, "attestation");
    assert.equal(a?.evidence?.value, "The welcome sequence is live in Substack.");
    assert.equal(a?.evidence?.confirmed_by, "muxin");
    assert.equal(a?.evidence?.confirmed_at, "t2");
  });

  // The floor cuts both ways, and this is the direction that is easy to lose: a kind whose minimum
  // is an attestation must still take a url through the same path. A url is the stronger proof, and
  // refusing it would be the old exact-equality bug pointing the other way.
  test("a url is still a real confirmation for a kind whose minimum is only an attestation", async () => {
    seedApprovedPost("welcome-email");
    await deliverVenture(SLUG);
    confirmManualDelivery(SLUG, "p1-a", { type: "url", value: "https://humaninference.substack.com/welcome" }, "t2");
    const a = readArtifact(SLUG, "p1-a");
    assert.equal(a?.delivery_status, "live_confirmed");
    assert.equal(a?.evidence?.type, "url", "what she brought is what gets recorded, not the floor");
  });

  // Refused rather than written: confirm needs handed_off and there is no second confirm, so an
  // attestation on a url-minimum kind would strand the artifact behind a retraction it never
  // earned. The message names the minimum so she knows what to bring instead.
  test("an attestation is refused for a kind that needs a checkable url", async () => {
    seedApprovedPost("substack-post");
    await deliverVenture(SLUG);
    assert.throws(
      () => confirmManualDelivery(SLUG, "p1-a", { type: "attestation", value: "I pasted it." }, "t2"),
      /needs "url" evidence/
    );
    // The message has to be usable by someone mid-task without the contract open: what this kind
    // needs, what to run instead, and why the two proofs are not the same.
    assert.throws(
      () => confirmManualDelivery(SLUG, "p1-a", { type: "attestation", value: "I pasted it." }, "t2"),
      /confirm it with --url <live-url>: a link can be re-checked later, a sentence cannot/
    );
    assert.equal(readArtifact(SLUG, "p1-a")?.delivery_status, "handed_off", "nothing was written");
  });

  // §4: never synthesize an attestation on her behalf. An empty one states nothing.
  test("an empty confirmation is never recorded", async () => {
    seedApprovedPost("welcome-email");
    await deliverVenture(SLUG);
    assert.throws(() => confirmManualDelivery(SLUG, "p1-a", { type: "attestation", value: "   " }, "t2"), /needs a value/);
    assert.equal(readArtifact(SLUG, "p1-a")?.delivery_status, "handed_off");
  });
});

describe("deliverVenture -- app (text-post-note), the live-posting-critical path", () => {
  test("missing provider-account binding blocks before claiming a slot or calling Substack", async () => {
    seedApprovedPost("text-post-note");
    delete process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID;
    let calls = 0;
    try {
      await assert.rejects(
        () => deliverVenture(SLUG, { postFn: async () => { calls++; return { ref: "must-not-exist" }; } }),
        /delivery policy blocked.*ACCOUNT_ID.*missing/i,
      );
      assert.equal(calls, 0);
      assert.equal(existsSync(TEST_LEDGER), false, "policy refusal must happen before slot-claim side effects");
      assert.equal(readArtifact(SLUG, "p1-a")?.delivery_status, "ready");
    } finally {
      process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = "human-inference/substack";
    }
  });

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
