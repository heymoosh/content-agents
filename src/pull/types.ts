import type { BrowserContext } from "playwright";

// The "constrained browser agent" for analytics sources that have no usable API
// (LinkedIn, X, Substack). Each platform implements ONE narrow job: from an already
// authenticated context, download the analytics export in the exact shape
// `npm run ingest` expects (see src/ingest/import.ts) and nothing else.

export type PullPlatform = "linkedin" | "x" | "substack";

export interface PlatformPuller {
  platform: PullPlatform;
  // Where the one-time interactive login should land the user (`npm run pull:login`).
  loginUrl: string;
  // Drive an already-authenticated context to download the export file(s).
  // Returns the absolute path(s) written into data/inbox/<platform>/.
  pull(context: BrowserContext): Promise<string[]>;
}
