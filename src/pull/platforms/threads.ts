import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext, Page } from "playwright";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { repoRoot } from "../../db/db.js";
import { PATTERNS_DIR, INBOX_DIR } from "../../patterns/corpus.js";
import type { AccountSeed, PatternMiningConfig } from "../../patterns/types.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";
import {
  findPostNodes,
  jsonBlobsFromHtml,
  stageEntry,
  toThreadsPost,
  type StagedThreadsEntry,
  type ThreadsPost,
} from "../threads-extract.js";

// Threads is the collection gap the pattern corpus most needs closed. It is also the only puller
// here that feeds `/patterns`, not `/strategy`: instead of downloading an analytics export into
// data/inbox/, it writes staged corpus entries into data/patterns/inbox/ for
// `npm run patterns:collect` to validate and append. Everything else about it, the persistent
// Chrome profile, the one-time headed login, the failure taxonomy, is the shape LinkedIn set.
//
// ── WHY A LOGIN AND NOT A FETCH ─────────────────────────────────────────────────────
// A logged-out fetch of a Threads profile returns a JavaScript shell with no post data in it, and
// threads.com answers HTTP 200 for any string at all, so a status code proves nothing. A previous
// pass reached content with a crawler user-agent; Muxin chose the login route instead, so that is
// what this is. There is no user-agent trick in this file and there should not be one.
//
// ── HONESTY NOTE ────────────────────────────────────────────────────────────────────
// The payload field names this reads are reconstructed from the Instagram-family schema Threads is
// built on (see src/pull/threads-extract.ts). They are NOT verified against a live logged-in
// response. When the walk finds nothing, this dumps every captured payload next to the usual
// screenshot bundle and fails UI_CHANGED, so the first real run hands back the true shape instead
// of a second guess. That is the same refine-from-the-headed-run loop x.ts and substack.ts went
// through.

const PROFILE_BASE = "https://www.threads.com/@";

// The profile feed is reverse-chronological and Threads offers no sort-by-top for a stranger, so
// this window is the account's most recent N posts and nothing about it was chosen for
// performance. That UNSELECTED quality is a property worth having, not a limitation to apologise
// for: a sample discovered by searching for winners makes a denominator of winners, and dividing a
// winner by that understates how far it actually travelled. `classifyOutlier` needs at least 3
// other scored posts on an account before it returns a multiple, and a couple of dozen gives it
// that room while keeping one run to a few minutes.
const MAX_POSTS_PER_ACCOUNT = 24;

// How many times to scroll a profile before reading it. Threads loads its feed in pages.
const SCROLL_ROUNDS = 8;
const SCROLL_PAUSE_MS = 1_200;

interface AccountResult {
  seed: AccountSeed;
  entries: StagedThreadsEntry[];
  skips: string[];
  payloadsSeen: number;
  postsSeen: number;
  // Set only where an account yielded no posts at all: the diagnostics bundle written while its
  // page was still open, holding the screenshot, the HTML, and every JSON payload captured.
  diagnosticsDir: string | null;
}

function loadThreadsAccounts(): AccountSeed[] {
  const path = join(repoRoot, "config", "pattern-mining.yaml");
  const config = parse(readFileSync(path, "utf8")) as PatternMiningConfig;
  return (config.accounts ?? []).filter((a) => a.platform === "threads" && typeof a.handle === "string" && a.handle.trim() !== "");
}

function handleOf(seed: AccountSeed): string {
  return (seed.handle ?? "").trim().replace(/^@/, "");
}

// Where a post's slide images land so a human can read the words off them. Gitignored with the
// rest of data/patterns/**, because these are other creators' images.
export function slideDirFor(username: string, code: string): string {
  return join(PATTERNS_DIR, "media", "threads", `${username}-${code}`);
}

// Best-effort. A slide that will not download is a missing picture, never a failed pull, so this
// swallows its own errors and reports how many landed.
async function saveSlides(context: BrowserContext, post: ThreadsPost): Promise<string | null> {
  const urls = post.slides.map((s) => s.url).filter((u): u is string => u !== null);
  if (urls.length === 0) return null;
  const dir = slideDirFor(post.username, post.code);
  let saved = 0;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }
  for (const [i, url] of urls.entries()) {
    try {
      const response = await context.request.get(url, { timeout: 20_000 });
      if (!response.ok()) continue;
      writeFileSync(join(dir, `slide-${String(i + 1).padStart(2, "0")}.jpg`), await response.body());
      saved++;
    } catch {
      /* one missing slide does not fail a pull */
    }
  }
  return saved > 0 ? dir : null;
}

async function scrollProfile(page: Page): Promise<void> {
  for (let i = 0; i < SCROLL_ROUNDS; i++) {
    await page.mouse.wheel(0, 4_000);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
  }
}

// A Threads session that has lapsed lands on a login route, same as every other platform here.
// The extra check is the login form itself, because threads.com is happy to serve a 200 that is
// nothing but a sign-in gate.
async function assertSignedIn(page: Page): Promise<void> {
  if (looksLikeAuthWall(page.url())) {
    throw new PullError("SESSION_EXPIRED", `Threads redirected to a login wall (${page.url()})`, {
      hint: "Run `npm run pull:login -- threads` and sign in again (Threads signs in with your Instagram account).",
    });
  }
  const loginField = page.locator('input[name="username"], input[autocomplete="username"]').first();
  if (await loginField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    throw new PullError("SESSION_EXPIRED", `Threads served a sign-in form at ${page.url()}`, {
      hint: "Run `npm run pull:login -- threads` and sign in again (Threads signs in with your Instagram account).",
    });
  }
}

async function collectAccount(context: BrowserContext, seed: AccountSeed): Promise<AccountResult> {
  const handle = handleOf(seed);
  const page = await context.newPage();
  const payloads: unknown[] = [];

  // Capture the app's own JSON as it loads. This is raw retrieval: the bytes Threads sent, parsed
  // as JSON. No model reads the page and no model writes a body.
  page.on("response", (response) => {
    const url = response.url();
    if (!/\/graphql|\/api\//i.test(url)) return;
    void response
      .json()
      .then((body) => payloads.push(body))
      .catch(() => {
        /* not JSON, or the response body is gone */
      });
  });

  try {
    const profileUrl = `${PROFILE_BASE}${handle}`;
    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${profileUrl}`, {
        hint: "Check your connection / that Threads opens in a normal browser.",
        cause,
      });
    }
    await page.waitForTimeout(4_000); // the feed hydrates client-side
    await assertSignedIn(page);
    await scrollProfile(page);

    payloads.push(...jsonBlobsFromHtml(await page.content()));

    const nodes = payloads.flatMap((p) => findPostNodes(p));
    const posts = nodes.map(toThreadsPost).filter((p): p is ThreadsPost => p !== null);

    const entries: StagedThreadsEntry[] = [];
    const skips: string[] = [];
    for (const post of posts) {
      if (entries.length >= MAX_POSTS_PER_ACCOUNT) break;
      // Filter on authorship BEFORE downloading anything, so a stranger's carousel is never
      // fetched, staged, or written to disk under this account's name.
      const dryRun = stageEntry(post, { handle, creator: seed.creator, niche: seed.niche });
      if (!dryRun.entry) {
        skips.push(`${post.url}: ${dryRun.skipped}`);
        continue;
      }
      const slideDir = await saveSlides(context, post);
      const staged = stageEntry(post, {
        handle,
        creator: seed.creator,
        niche: seed.niche,
        slideDir,
        notes: `Collected from a logged-in Threads session on ${new Date().toISOString().slice(0, 10)}. Body is the post's own caption text, verbatim from the payload.`,
      });
      if (staged.entry) entries.push(staged.entry);
    }
    const diagnosticsDir = posts.length === 0 ? await dumpPayloads(page, payloads) : null;
    return { seed, entries, skips, payloadsSeen: payloads.length, postsSeen: posts.length, diagnosticsDir };
  } finally {
    await page.close().catch(() => undefined);
  }
}

// When an account yielded nothing, hand over the evidence instead of a shrug: the usual screenshot
// bundle plus every JSON payload the session captured, so the real field names can be read off
// disk rather than guessed at a second time.
async function dumpPayloads(page: Page, payloads: unknown[]): Promise<string | null> {
  try {
    const dir = await captureDiagnostics(page, "threads", "no-posts-extracted");
    writeFileSync(join(dir, "captured-payloads.json"), JSON.stringify(payloads, null, 2));
    return dir;
  } catch {
    // A dump that fails must not mask the real finding, which is that nothing was extracted.
    return null;
  }
}

export const threads: PlatformPuller = {
  platform: "threads",
  // Threads signs in with an Instagram account, and the sign-in flow lives on threads.com itself.
  loginUrl: "https://www.threads.com/login",

  async pull(context: BrowserContext): Promise<string[]> {
    const accounts = loadThreadsAccounts();
    if (accounts.length === 0) {
      throw new PullError("SETUP", "No Threads accounts with a handle in config/pattern-mining.yaml", {
        hint: "Add threads rows under `accounts:` in config/pattern-mining.yaml before collecting.",
      });
    }

    const results: AccountResult[] = [];
    for (const seed of accounts) {
      console.log(`  @${handleOf(seed)} (${seed.niche})`);
      const result = await collectAccount(context, seed);
      console.log(`    posts seen: ${result.postsSeen}, staged: ${result.entries.length}, skipped: ${result.skips.length}`);
      for (const skip of result.skips) console.log(`      skipped ${skip}`);
      results.push(result);
    }

    const entries = results.flatMap((r) => r.entries);
    if (entries.length === 0) {
      const postsSeen = results.reduce((n, r) => n + r.postsSeen, 0);
      const diag = results.map((r) => r.diagnosticsDir).find((d): d is string => d !== null);
      // Two different findings, told apart rather than merged: the walk found no posts at all
      // (the field names are wrong, or the feed never loaded), or it found posts and every one of
      // them was refused by a rule that exists on purpose.
      if (postsSeen === 0) {
        throw new PullError("UI_CHANGED", `Signed in to Threads but extracted no posts from ${accounts.length} account(s)`, {
          hint: diag
            ? `Read ${join(diag, "captured-payloads.json")} for the real payload shape, then update the field names in src/pull/threads-extract.ts. Those names are reconstructed from Instagram's schema and have never been checked against a live Threads response.`
            : "No diagnostics bundle could be written. Re-run with --headed and watch whether the profile feed loads at all.",
          diagnosticsDir: diag,
        });
      }
      throw new PullError("UNKNOWN", `Found ${postsSeen} post(s) on Threads but staged none of them`, {
        hint: "Every post was skipped. The reasons were printed above, one line each: wrong author, a reply, a repost, or no caption text at all.",
      });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const dest = join(INBOX_DIR, `threads-${stamp}.json`);
    try {
      mkdirSync(INBOX_DIR, { recursive: true });
      writeFileSync(dest, JSON.stringify(entries, null, 2), "utf8");
    } catch (cause) {
      throw new PullError("DOWNLOAD_FAILED", "Collected posts but writing the staged file failed", {
        hint: `Check disk space / write permission for ${INBOX_DIR}.`,
        cause,
      });
    }

    const incomplete = entries.filter((e) => !e.media.body_is_complete).length;
    console.log(`\n  ${entries.length} entry(s) staged, ${incomplete} of them with body_is_complete: false.`);
    console.log(`  Next: npm run patterns:collect`);
    return [dest];
  },
};
