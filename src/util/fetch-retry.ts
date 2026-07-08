// Shared retry wrapper for provider/publish fetch call sites, none of which had any retry — a
// single transient 429/5xx/network blip aborted the whole row. Small bounded exponential backoff,
// same signature as fetch() so callers keep their own res.ok/status handling unchanged. Reads
// globalThis.fetch at call time (not captured at import) so tests that stub globalThis.fetch keep
// working unchanged.

export interface FetchRetryOptions {
  retries?: number; // additional attempts after the first, default 3 (4 attempts total)
  baseDelayMs?: number; // default 300ms, doubles each retry
  sleep?: (ms: number) => Promise<void>;
  // A thrown network error (timeout, connection reset, DNS failure) means we never learned
  // whether the server received and processed the request. A 5xx carries the SAME ambiguity —
  // it can arrive after the origin already committed the write (e.g. a gateway timeout following
  // a successful backend commit), not just before. Retrying a non-idempotent "create" call (a
  // scheduled draft, a scheduled post, a paid generation) on either signal risks a real duplicate
  // publish. Default true (safe for reads/uploads, where a duplicate is harmless); callers
  // wrapping a one-time create-a-real-thing call should pass false — they still get 429 retries
  // (429 is an explicit rejection: the server never processed the request, so it's always safe).
  retryOnNetworkError?: boolean;
}

function isRetryableStatus(status: number, retryAmbiguous: boolean): boolean {
  if (status === 429) return true; // rejected before processing -- always safe to retry
  return retryAmbiguous && status >= 500; // ambiguous: may have already committed server-side
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: FetchRetryOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retryOnNetworkError = opts.retryOnNetworkError ?? true;

  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    let err: unknown;
    try {
      res = await globalThis.fetch(input, init);
    } catch (e) {
      err = e;
    }
    const retryable =
      (err !== undefined && retryOnNetworkError) ||
      (res !== undefined && isRetryableStatus(res.status, retryOnNetworkError));
    if (!retryable || attempt >= retries) {
      if (err !== undefined) throw err;
      return res!;
    }
    await sleep(baseDelayMs * 2 ** attempt);
  }
}
