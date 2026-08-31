import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readPublishingHistory, readPublishingStatuses, recordHumanDeliveryEvidence } from "./publishing-status.js";
import { createDefaultProviderStatusReaders, reconcileProviderStatuses } from "./provider-status-reconciliation.js";
import type { DeliveryProvider } from "./delivery-event.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("appends one normalized authoritative terminal event for every provider without write retries", async () => {
  const root = mkdtempSync(join(tmpdir(), "provider-reconcile-")); roots.push(root);
  const path = join(root, "events.jsonl");
  const providers: DeliveryProvider[] = ["postiz", "typefully", "postpeer", "youtube", "substack", "manual", "upload-post"];
  writeFileSync(path, providers.map((provider) => JSON.stringify({
    slug: provider, rowId: "r-1", provider, state: "planned", at: "2026-01-01T00:00:00.000Z",
    providerObjectId: `${provider}-1`, providerAccountId: `${provider}-account`,
  })).join("\n") + "\n");
  const calls = new Map<DeliveryProvider, number>();
  const readers = Object.fromEntries(providers.map((provider) => [provider, async () => {
    calls.set(provider, (calls.get(provider) ?? 0) + 1);
    return { id: `${provider}-1`, accountId: `${provider}-account`, status: "published", url: `https://provider.test/${provider}/1`, publishedAt: "2026-01-02T00:00:00.000Z" };
  }]));
  const events = await reconcileProviderStatuses(readers, path, () => new Date("2026-01-03T00:00:00.000Z"));
  assert.equal(events.length, providers.length);
  for (const provider of providers) {
    assert.equal(calls.get(provider), 1);
    const latest = events.find((event) => event.provider === provider);
    assert.equal(latest?.state, "live");
    assert.equal(latest?.canonicalUrl, `https://provider.test/${provider}/1`);
  }
  assert.equal(readPublishingHistory(path).length, providers.length * 2);
});

test("a missing reader appends explicit uncertain evidence and never retries or recreates", async () => {
  const root = mkdtempSync(join(tmpdir(), "provider-reconcile-")); roots.push(root);
  const path = join(root, "events.jsonl");
  writeFileSync(path, JSON.stringify({ slug: "old", rowId: "r-1", provider: "upload-post", state: "planned", at: "2026-01-01T00:00:00Z", ref: "legacy-1" }) + "\n");
  const [event] = await reconcileProviderStatuses({}, path, () => new Date("2026-01-02T00:00:00Z"));
  assert.equal(event.state, "uncertain");
  assert.match(event.error ?? "", /reader is unavailable/);
  assert.equal(readPublishingHistory(path).length, 2);
});

test("Typefully and YouTube list absence is uncertain, never inferred terminal proof", async () => {
  const readers = createDefaultProviderStatusReaders({ fetchTypefully: async () => [], fetchYoutube: async () => [] });
  for (const provider of ["typefully", "youtube"] as const) {
    const observation = await readers[provider]!({ slug: "p", rowId: "r", provider, state: "planned", at: "2026-01-01Z", providerObjectId: "id-1" });
    assert.equal((observation as { status: string }).status, "unknown");
    assert.match((observation as { reconciliationError: string }).reconciliationError, /cannot distinguish/);
  }
});

test("legacy human-readable provider references exact-match stable provider ids", async () => {
  const readers = createDefaultProviderStatusReaders({
    fetchTypefully: async () => [{ id: "tf-card-7", whenIso: "2026-01-02T00:00:00Z", platforms: ["x"], title: "card" }],
    fetchPostpeer: async () => [{ id: "pp-8", scheduledFor: "2026-01-02T00:00:00Z" }],
    fetchYoutube: async () => [{ videoId: "yt-9", publishAt: "2026-01-02T00:00:00Z", title: "short" }],
  });
  const base = { slug: "p", rowId: "r", state: "planned" as const, at: "2026-01-01Z" };
  assert.equal((await readers.typefully!({ ...base, provider: "typefully", providerObjectId: "typefully draft tf-card-7" }) as { id: string }).id, "tf-card-7");
  assert.equal((await readers.postpeer!({ ...base, provider: "postpeer", providerObjectId: "postpeer post pp-8" }) as { id: string }).id, "pp-8");
  assert.equal((await readers.youtube!({ ...base, provider: "youtube", providerObjectId: "https://youtube.com/shorts/yt-9" }) as { id: string }).id, "yt-9");
});

test("every provider can reach a truthful terminal outcome through recorded human evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "provider-human-")); roots.push(root); const path = join(root, "events.jsonl");
  const providers: DeliveryProvider[] = ["postiz", "typefully", "postpeer", "youtube", "substack", "manual", "upload-post"];
  writeFileSync(path, providers.map((provider) => JSON.stringify({ slug: provider, rowId: "r", provider, state: "uncertain", at: "2026-01-01T00:00:00Z", providerObjectId: `${provider}-1` })).join("\n") + "\n");
  for (const provider of providers) recordHumanDeliveryEvidence(provider, "r", "live", { evidence: `human checked ${provider}`, canonicalUrl: `https://evidence.test/${provider}` }, path);
  const latest = readPublishingStatuses(path);
  for (const provider of providers) {
    assert.equal(latest[`${provider}/r`]?.state, "live");
    assert.equal(latest[`${provider}/r`]?.evidenceKind, "human");
  }
});
