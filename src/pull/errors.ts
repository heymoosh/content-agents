// Failure taxonomy for the browser puller. The whole point: when a pull fails, say
// plainly WHOSE fault it is — the site changed its UI (update selectors) vs something on
// our side (setup, network, an expired login) — so triage is instant, not a guessing game.

export type PullFailureKind =
  | "SETUP" // deps/browser not installed, unknown platform
  | "NETWORK" // couldn't reach the site
  | "SESSION_EXPIRED" // authenticated wall — the saved login lapsed
  | "UI_CHANGED" // logged in + on-page, but the expected element/flow is gone
  | "DOWNLOAD_FAILED" // export triggered but the file didn't save
  | "UNKNOWN";

// The one-line "who do I look at first" verdict printed on failure.
export const CULPRIT: Record<PullFailureKind, string> = {
  SETUP: "OUR SIDE — setup (dependencies / platform name)",
  NETWORK: "OUR SIDE — connectivity (couldn't reach the site)",
  SESSION_EXPIRED: "LOGIN — the saved session lapsed (re-run pull:login)",
  UI_CHANGED: "THEIR SIDE — the site's UI changed (update selectors)",
  DOWNLOAD_FAILED: "MIXED — export started but the file didn't save (see diagnostics)",
  UNKNOWN: "UNKNOWN — inspect the diagnostics bundle",
};

export interface PullErrorOpts {
  hint?: string; // one-line "what to do"
  diagnosticsDir?: string; // where the screenshot/HTML bundle was written
  cause?: unknown;
}

export class PullError extends Error {
  readonly kind: PullFailureKind;
  readonly hint: string;
  readonly diagnosticsDir?: string;

  constructor(kind: PullFailureKind, message: string, opts: PullErrorOpts = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "PullError";
    this.kind = kind;
    this.hint = opts.hint ?? "";
    this.diagnosticsDir = opts.diagnosticsDir;
  }
}

// Best-effort bucketing of an un-classified thrown error (Playwright/Node) into a kind,
// so even failures we didn't anticipate still get a culprit label.
export function classifyUnknown(err: unknown): PullFailureKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (/playwright install|Executable doesn't exist/i.test(msg)) return "SETUP";
  if (/net::ERR|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|NS_ERROR/i.test(msg)) return "NETWORK";
  return "UNKNOWN";
}
