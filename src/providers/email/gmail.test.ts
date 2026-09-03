import test from "node:test";
import assert from "node:assert/strict";
import { GmailProvider, GMAIL_METADATA_SCOPE, GMAIL_SEND_SCOPE, buildMimeMessage, gmailRfcMessageId, type GmailFetch } from "./gmail.js";

function response(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

test("Gmail refreshes, verifies the exact account and sends URL-safe MIME", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: GmailFetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response({ access_token: "access", scope: `${GMAIL_SEND_SCOPE} ${GMAIL_METADATA_SCOPE}` });
    if (calls.length === 2) return response({ emailAddress: "muxin.li.pro@gmail.com" });
    return response({ id: "msg-1", threadId: "thread-1" });
  };
  const result = await new GmailProvider({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" }, fetcher).send({ messageId: "m1", to: "person@example.com", subject: "Hello", body: "héllo?" });
  assert.equal(result.providerMessageId, "msg-1");
  const sent = JSON.parse(String(calls[2].init?.body)) as { raw: string };
  assert.match(sent.raw, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(sent.raw.replace(/-/g, "+").replace(/_/g, "/") + "==", "base64").toString("utf8").includes("Subject: Hello"), true);
});

test("MIME rejects header injection", () => assert.throws(() => buildMimeMessage({ to: "a\nb", subject: "x", body: "y" }), /invalid To/));

test("Gmail reconciles an uncertain send by its deterministic RFC Message-ID", async () => {
  const calls: string[] = [];
  const fetcher: GmailFetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return response({ access_token: "access", scope: `${GMAIL_SEND_SCOPE} ${GMAIL_METADATA_SCOPE}` });
    if (calls.length === 2) return response({ emailAddress: "muxin.li.pro@gmail.com" });
    return response({ messages: [{ id: "found-1", threadId: "thread-1" }] });
  };
  const request = { messageId: "lead:message-01.md", to: "person@example.com", subject: "Hello", body: "Body" };
  const result = await new GmailProvider({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" }, fetcher).findSent(request);
  assert.equal(result?.providerMessageId, "found-1");
  assert.match(calls[2], /rfc822msgid/);
  assert.match(buildMimeMessage(request), new RegExp(gmailRfcMessageId(request).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Gmail refuses a different profile account", async () => {
  const fetcher: GmailFetch = async (_url, init) => String(init?.method) === "POST" ? response({ access_token: "a", scope: `${GMAIL_SEND_SCOPE} ${GMAIL_METADATA_SCOPE}` }) : response({ emailAddress: "other@example.com" });
  await assert.rejects(() => new GmailProvider({ clientId: "i", clientSecret: "s", refreshToken: "r" }, fetcher).send({ to: "x", subject: "s", body: "b" }), /approved Muxin account/);
});

test("Gmail refuses a send-only token because reconciliation requires metadata access", async () => {
  const fetcher: GmailFetch = async () => response({ access_token: "a", scope: GMAIL_SEND_SCOPE });
  await assert.rejects(() => new GmailProvider({ clientId: "i", clientSecret: "s", refreshToken: "r" }, fetcher).send({ to: "x", subject: "s", body: "b" }), /gmail\.metadata/);
});
