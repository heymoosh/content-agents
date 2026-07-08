import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry } from "./fetch-retry.js";

// fetchWithRetry wraps globalThis.fetch with bounded exponential backoff on 429/5xx and network
// errors. Every test stubs globalThis.fetch and injects a no-op sleep so nothing here actually
// waits in real time.

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

function sleepSpy(): { sleep: (ms: number) => Promise<void>; calls: number[] } {
  const calls: number[] = [];
  return { sleep: async (ms: number) => { calls.push(ms); }, calls };
}

test("does not retry on a successful response", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse(200);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep });
  assert.equal(res.status, 200);
  assert.equal(calls, 1);
});

test("does not retry on a non-retryable client error (404)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse(404);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep });
  assert.equal(res.status, 404);
  assert.equal(calls, 1);
});

test("retries on 429 then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 2 ? jsonResponse(429) : jsonResponse(200);
  }) as typeof fetch;
  const { sleep, calls: sleepCalls } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
  assert.equal(sleepCalls.length, 1);
});

test("retries on 503 then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 3 ? jsonResponse(503) : jsonResponse(200);
  }) as typeof fetch;
  const { sleep, calls: sleepCalls } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
  assert.equal(sleepCalls.length, 2);
});

test("retries on a thrown network error then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls < 2) throw new Error("ECONNRESET");
    return jsonResponse(200);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test("exhausts a small bounded retry count and returns the last non-ok response", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse(500);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { retries: 2, sleep });
  assert.equal(res.status, 500);
  assert.equal(calls, 3); // 1 initial + 2 retries
});

test("exhausts retries on a persistent network error and throws the last error", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error(`boom ${calls}`);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  await assert.rejects(
    () => fetchWithRetry("https://example.com", undefined, { retries: 2, sleep }),
    /boom 3/
  );
  assert.equal(calls, 3);
});

test("backoff delays grow exponentially from baseDelayMs", async () => {
  globalThis.fetch = (async () => jsonResponse(503)) as typeof fetch;
  const { sleep, calls: sleepCalls } = sleepSpy();
  await fetchWithRetry("https://example.com", undefined, { retries: 3, baseDelayMs: 100, sleep });
  assert.deepEqual(sleepCalls, [100, 200, 400]);
});

test("retryOnNetworkError: false does not retry a thrown network error (avoids duplicate creates)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("ECONNRESET");
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  await assert.rejects(
    () => fetchWithRetry("https://example.com", undefined, { sleep, retryOnNetworkError: false }),
    /ECONNRESET/
  );
  assert.equal(calls, 1);
});

test("retryOnNetworkError: false still retries a 429 response (rejected, never processed)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 2 ? jsonResponse(429) : jsonResponse(200);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep, retryOnNetworkError: false });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test("retryOnNetworkError: false does NOT retry a 5xx response (may have already committed server-side)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse(503);
  }) as typeof fetch;
  const { sleep } = sleepSpy();
  const res = await fetchWithRetry("https://example.com", undefined, { sleep, retryOnNetworkError: false });
  assert.equal(res.status, 503);
  assert.equal(calls, 1, "a 5xx after a non-idempotent create must not be retried — it may have already succeeded");
});
