import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverLockedGmailMessage, readDeliveryEvents, reconcileLockedGmailMessage } from "./gmail-delivery.js";

const request = { messageId: "locked-1", to: "a@example.com", subject: "Hi", body: "private body" };
test("delivery ledger is idempotent and does not persist body", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "gmail-ledger-")), "delivery.jsonl");
  let sends = 0;
  const provider = { send: async () => { sends++; return { provider: "gmail" as const, account: "muxin.li.pro@gmail.com", providerMessageId: "p1" }; } };
  await deliverLockedGmailMessage(request, { ledgerPath: path, provider });
  assert.deepEqual(await deliverLockedGmailMessage(request, { ledgerPath: path, provider }), { status: "already_delivered" });
  assert.equal(sends, 1);
  assert.equal(readFileSync(path, "utf8").includes("private body"), false);
  assert.deepEqual(readDeliveryEvents(path).map((x) => x.event), ["intent", "delivered"]);
});

test("digest drift is rejected", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "gmail-ledger-")), "delivery.jsonl");
  const provider = { send: async () => ({ provider: "gmail" as const, account: "muxin.li.pro@gmail.com", providerMessageId: "p1" }) };
  await deliverLockedGmailMessage(request, { ledgerPath: path, provider });
  await assert.rejects(() => deliverLockedGmailMessage({ ...request, body: "changed" }, { ledgerPath: path, provider }), /digest drift/);
});

test("provider timeout is recorded as uncertainty", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "gmail-ledger-")), "delivery.jsonl");
  await assert.rejects(() => deliverLockedGmailMessage(request, { ledgerPath: path, provider: { send: async () => { throw new Error("network timeout"); } } }), /network timeout/);
  assert.equal(readDeliveryEvents(path).at(-1)?.event, "uncertain");
});

test("uncertain delivery reconciles through Sent mail without resending", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "gmail-ledger-")), "delivery.jsonl");
  await assert.rejects(() => deliverLockedGmailMessage(request, { ledgerPath: path, provider: { send: async () => { throw new Error("network timeout"); } } }), /timeout/);
  const result = await reconcileLockedGmailMessage(request, { ledgerPath: path, provider: { findSent: async () => ({ provider: "gmail", account: "muxin.li.pro@gmail.com", providerMessageId: "found-1" }) } });
  assert.equal("providerMessageId" in result ? result.providerMessageId : null, "found-1");
  assert.equal(readDeliveryEvents(path).at(-1)?.event, "delivered");
});

test("missing Sent-mail match stays uncertain", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "gmail-ledger-")), "delivery.jsonl");
  await assert.rejects(() => deliverLockedGmailMessage(request, { ledgerPath: path, provider: { send: async () => { throw new Error("network timeout"); } } }), /timeout/);
  assert.deepEqual(await reconcileLockedGmailMessage(request, { ledgerPath: path, provider: { findSent: async () => null } }), { status: "uncertain" });
  assert.equal(readDeliveryEvents(path).at(-1)?.event, "uncertain");
});
