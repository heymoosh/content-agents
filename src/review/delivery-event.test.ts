import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDeliveryState, normalizeProviderStatus, type DeliveryProvider } from "./delivery-event.js";

describe("delivery event normalization", () => {
  test("covers every normalized state and legacy spelling", () => {
    for (const state of ["planned", "blocked", "delivered", "live", "canceled", "deleted", "failed", "private", "uncertain"] as const) {
      assert.equal(normalizeDeliveryState(state), state);
    }
    assert.equal(normalizeDeliveryState("scheduled"), "planned");
    assert.equal(normalizeDeliveryState("cancelled"), "canceled");
    assert.equal(normalizeDeliveryState("live_confirmed"), "live");
  });

  test("normalizes every current, retired, and Postiz-compatible provider", () => {
    const providers: DeliveryProvider[] = ["typefully", "postpeer", "postiz", "youtube", "substack", "manual", "upload-post"];
    for (const provider of providers) {
      assert.deepEqual(normalizeProviderStatus(provider, {
        id: `${provider}-1`, accountId: `${provider}-account`, status: "published",
        url: `https://provider.test/${provider}/1`, createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z", publishedAt: "2026-01-03T00:00:00.000Z",
      }), {
        provider, state: "live", providerObjectId: `${provider}-1`, providerAccountId: `${provider}-account`,
        canonicalUrl: `https://provider.test/${provider}/1`, providerCreatedAt: "2026-01-01T00:00:00.000Z",
        providerUpdatedAt: "2026-01-02T00:00:00.000Z", providerPublishedAt: "2026-01-03T00:00:00.000Z",
      });
    }
    // A Postiz row read back after a reschedule carries `scheduledAt`; reconciliation must follow it.
    const moved = normalizeProviderStatus("postiz", { id: "p-1", status: "scheduled", scheduledAt: "2026-09-20T17:00:00.000Z", url: null });
    assert.equal(moved.state, "planned");
    assert.equal(moved.plannedFor, "2026-09-20T17:00:00.000Z");
  });
});
