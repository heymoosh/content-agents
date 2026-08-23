import type { BrowserContext } from "playwright";

// The "constrained browser agent" for sources that have no usable API (LinkedIn, X, Substack,
// Threads). Each platform implements ONE narrow job: from an already authenticated context,
// retrieve what that platform hands over, write it where the next step reads from, and nothing
// else.
//
// Three of the four download the analytics export in the exact shape `npm run ingest` expects
// (see src/ingest/import.ts). Threads is the exception and says so in its own file: it stages
// pattern-corpus entries into data/patterns/inbox/ for `npm run patterns:collect`. The saved
// session and the failure taxonomy are shared; the destination is not.

export type PullPlatform = "linkedin" | "x" | "substack" | "threads";

export interface PlatformPuller {
  platform: PullPlatform;
  // Where the one-time interactive login should land the user (`npm run pull:login`).
  loginUrl: string;
  // Drive an already-authenticated context to retrieve the platform's data.
  // Returns the absolute path(s) written (data/inbox/<platform>/ for the analytics pullers,
  // data/patterns/inbox/ for Threads).
  pull(context: BrowserContext): Promise<string[]>;
}
