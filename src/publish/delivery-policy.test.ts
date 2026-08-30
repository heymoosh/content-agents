import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { decideDeliveryPolicy, resolveDeliveryPolicy } from "./delivery-policy.js";
import { scheduleApproved } from "../review/studio-scheduling.js";
import { publishText } from "./typefully.js";
import { publishCards } from "./cards.js";
import { publishTikTok } from "./tiktok.js";
import { publishShorts } from "./youtube.js";
import { publishSubstack } from "./substack.js";
import type { QueueRow } from "./queue.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("delivery policy matrix", () => {
  test("Human Inference and Venture bind to an explicit non-secret account identity", () => {
    for (const origin of ["human-inference", "venture"] as const) {
      const decision = decideDeliveryPolicy(origin, "typefully");
      assert.equal(decision.mode, "provider");
      assert.equal(decision.brand, "human-inference");
      assert.equal(decision.providerAccountId, "human-inference/typefully");
    }
  });

  test("Charles is always manual and Fiction never falls through to Human Inference", () => {
    assert.equal(decideDeliveryPolicy("charles", "typefully").mode, "manual");
    const fiction = decideDeliveryPolicy("fiction", "typefully");
    assert.equal(fiction.mode, "blocked");
    assert.equal(fiction.providerAccountId, null);
  });

  test("missing, unknown, and brand-ambiguous Studio origins fail closed", () => {
    for (const origin of ["missing", "unknown", "studio"] as const) assert.equal(decideDeliveryPolicy(origin, "typefully").mode, "blocked");
  });

  test("provider credentials must assert the exact mapped account identity", () => {
    const { folder } = fixture("human-inference");
    const before = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    try {
      delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
      assert.match(resolveDeliveryPolicy(folder, "typefully").reason, /missing|unverified/i);
      process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "fiction/typefully";
      assert.match(resolveDeliveryPolicy(folder, "typefully").reason, /does not match/i);
      process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
      assert.equal(resolveDeliveryPolicy(folder, "typefully").mode, "provider");
    } finally {
      if (before === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
      else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = before;
    }
  });

  test("generic Studio resolves to Human Inference only from an explicit account URL in source.md", () => {
    const { folder } = fixture("studio");
    const before = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    try {
      process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
      assert.equal(resolveDeliveryPolicy(folder, "typefully").mode, "blocked");
      writeFileSync(join(folder, "source.md"), "---\norigin: https://substack.com/@humaninference/note/c-1\n---\nsource\n");
      const resolved = resolveDeliveryPolicy(folder, "typefully");
      assert.equal(resolved.mode, "provider");
      assert.equal(resolved.origin, "human-inference");
      assert.match(resolved.reason, /generic Studio request resolved from source\.md/i);
    } finally {
      if (before === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
      else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = before;
    }
  });
});

function fixture(origin: string): { folder: string; row: QueueRow } {
  const folder = mkdtempSync(join(tmpdir(), "delivery-policy-")); roots.push(folder);
  mkdirSync(join(folder, "derivatives"));
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin }));
  writeFileSync(join(folder, "derivatives", "x.md"), "---\ntitle: test\n---\nApproved body\n");
  return { folder, row: { id: "x-1", platform: "x", format: "text", asset: "derivatives/x.md", status: "approve", notes: "", lineIndex: 2 } };
}

test("blocked origins make zero provider calls", async () => {
  for (const origin of ["fiction", "studio", "unknown"] as const) {
    const { folder, row } = fixture(origin); let calls = 0;
    const result = await scheduleApproved(folder, row, {
      publishText: async () => { calls++; return []; }, publishCards: async () => [], publishTikTok: async () => [],
      publishShorts: async () => [], publishSubstack: async () => [], lockOutreachMessage: async () => [],
    });
    assert.match(result.scheduleError ?? "", /delivery policy blocked/i);
    assert.equal(calls, 0);
  }
});

test("Charles writes ready-to-paste and makes zero provider calls", async () => {
  const { folder, row } = fixture("charles"); let calls = 0;
  const result = await scheduleApproved(folder, row, {
    publishText: async () => { calls++; return []; }, publishCards: async () => [], publishTikTok: async () => [],
    publishShorts: async () => [], publishSubstack: async () => [], lockOutreachMessage: async () => [],
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.scheduled, { autoPublishes: false, readyToPaste: "ready-to-paste/x-1.txt" });
  assert.match(readFileSync(join(folder, "ready-to-paste", "x-1.txt"), "utf8"), /Approved body/);
});

test("every direct provider publisher fails closed before its provider call", async () => {
  const cases = [
    { platform: "x", format: "text", run: (folder: string) => publishText(folder, { noSchedule: true, forceReuse: true }) },
    { platform: "quote-card:x", format: "image", run: (folder: string) => publishCards(folder, { forceReuse: true }) },
    { platform: "tiktok", format: "short", run: (folder: string) => publishTikTok(folder) },
    { platform: "youtube", format: "short", run: (folder: string) => publishShorts(folder) },
    { platform: "substack", format: "text", run: (folder: string) => publishSubstack(folder, { postFn: async () => { throw new Error("provider called"); } }) },
  ];
  const originalFetch = globalThis.fetch; let fetchCalls = 0;
  globalThis.fetch = (async () => { fetchCalls++; throw new Error("provider called"); }) as typeof fetch;
  try {
    for (const item of cases) {
      const { folder } = fixture("fiction");
      writeFileSync(join(folder, "review-queue.md"), [
        "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
        "|----|----------|--------|-------|--------|-------|-----|--------|-------|--------|",
        `| row-1 | ${item.platform} | ${item.format} | derivatives/x.md | 4 | 4 | yes | approve | | from GUI queue |`,
        "",
      ].join("\n"));
      await assert.rejects(() => item.run(folder), /delivery policy blocked/i);
    }
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("a valid Human Inference decision cannot authorize another folder identity", async () => {
  const supplied = decideDeliveryPolicy("human-inference", "typefully");
  const before = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
  globalThis.fetch = (async () => { fetchCalls++; throw new Error("provider called"); }) as typeof fetch;
  try {
    for (const origin of ["fiction", "charles", "studio"] as const) {
      const { folder } = fixture(origin);
      writeFileSync(join(folder, "review-queue.md"), [
        "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
        "|----|----------|--------|-------|--------|-------|-----|--------|-------|--------|",
        "| x-1 | x | text | derivatives/x.md | 4 | 4 | yes | approve | | from GUI queue |",
        "",
      ].join("\n"));
      await assert.rejects(
        () => publishText(folder, { noSchedule: true, forceReuse: true, deliveryPolicy: supplied }),
        /supplied decision does not match authoritative folder policy/i,
      );
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (before === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = before;
  }
});
