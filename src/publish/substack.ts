import "../util/env.js";
import { readFileSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { claimSlots, readLedger, releaseClaims, fmtLa, type Claim } from "./slots.js";
import { launchPlatform } from "../pull/browser.js";
import { captureDiagnostics, looksLikeAuthWall } from "../pull/diagnose.js";
import { PullError, classifyUnknown, CULPRIT, type PullFailureKind } from "../pull/errors.js";

// Post approved `substack` rows to Substack Notes. Substack has NO usable posting API (see CLAUDE.md
// rule 3), so this is the sanctioned constrained-browser path — it drives the saved-session stealth
// Chrome the analytics puller already uses (src/pull/browser.ts) and posts ONLY rows Muxin set to
// `approve` in review-queue.md. A wrong status here posts live to Muxin's real public account, so
// the approve-only gate below is the safety-critical invariant of the whole feature.
//   npm run publish:substack <content-folder>            # claim slots + fire ripe ones
//   npm run publish:substack <content-folder> -- --dry-run   # report intent, zero mutations
//   npm run publish:substack -- --check                  # read-only session-auth probe
//
// TWO-PHASE claim-then-fire, forced by the unified scheduler: claimSlots (src/publish/slots.ts) only
// ever hands back a FUTURE slot — there is no "post now". So a first run CLAIMS a future slot for each
// approved row and records it in the shared ledger without posting; a later run (e.g. the daily cron),
// once that slot's time has arrived, FIRES the note exactly once and marks the row published. The
// claimed slot in the ledger is the "pending, not yet posted" marker; the row's review-queue status
// flipping approve → published is the "already fired" marker.

const NOTES_URL = "https://substack.com/notes";
const WINDOW_KEY = "substack"; // config/platforms.yaml cadence + shared ledger key

// Exported so callers (serve.ts's scheduleKind, tests) route to publishSubstack using this SAME
// predicate instead of keeping an independently-maintained copy that could drift out of sync.
export const isSubstackRow = (platform: string): boolean => platform === "substack";

// The ledger key for one row's claim — unique per row so each note's future slot is findable on its
// own (a folder can carry several approved substack rows, each claiming its own slot independently).
function assetKey(folder: string, rowId: string): string {
  return `${basename(folder)}/${rowId}`;
}

// The context handed to a postFn. Kept as a small object (not a raw BrowserContext) so publishSubstack
// stays browser-free until an actual fire happens and so tests can inject a postFn with no browser at
// all. Carries only what the real side effect needs from the caller: the --headed passthrough.
export interface PostContext {
  headed?: boolean;
}

export type PostFn = (context: PostContext, text: string) => Promise<{ ref: string }>;

// A prior claim already recorded in the shared ledger for this asset that hasn't fired yet. "Not yet
// fired" is implicit: once a row fires, its review-queue status becomes `published` and it drops out
// of the approved set before this is ever consulted for it again, and the spent claim is released.
export function findPendingClaim(asset: string): Claim | undefined {
  return readLedger().find((c) => c.asset === asset && isSubstackRow(c.platform));
}

// The real Playwright side effect: drive the saved-session Substack profile to the Notes composer,
// type the note, submit, return a confirmation ref. Launches (and always closes) its own stealth
// Chrome via launchPlatform, exactly like the analytics puller. Every failure is wrapped in a
// PullError with the same culprit taxonomy the pull side uses (connectivity vs lapsed login vs the
// site's UI changing), so a broken session yields a triage verdict, not a raw stack trace.
export async function postNoteToSubstack(
  context: PostContext,
  text: string
): Promise<{ ref: string }> {
  const browser = await launchPlatform("substack", { headed: context.headed });
  try {
    const page = browser.pages()[0] ?? (await browser.newPage());

    // 1) Navigate — a failure here is connectivity (our side), not a UI change.
    try {
      await page.goto(NOTES_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${NOTES_URL}`, {
        hint: "Check your connection / that Substack opens in a normal browser.",
        cause,
      });
    }

    // 2) Auth check — a sign-in wall means the saved session lapsed (re-login), NOT a UI change.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `Substack redirected to a sign-in wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- substack` and sign in again.",
      });
    }

    // 3) Open the composer, type the note, submit. A failure here is the site's UI changing (logged
    //    in + on-page, but the expected composer/flow is gone) — capture a diagnostics bundle.
    try {
      // The Notes feed shows a "Write a note" affordance that expands into a contenteditable box.
      const opener = page
        .getByRole("button", { name: /write a note|new note|write note|start a post/i })
        .or(page.getByRole("textbox", { name: /write a note|add a comment|note/i }))
        .first();
      await opener.waitFor({ state: "visible", timeout: 15_000 });
      await opener.click();

      const editor = page.locator('[contenteditable="true"]').first();
      await editor.waitFor({ state: "visible", timeout: 10_000 });
      await editor.click();
      await editor.fill(text);

      const post = page
        .getByRole("button", { name: /^post$|^publish$|^send$/i })
        .first();
      await post.waitFor({ state: "visible", timeout: 10_000 });
      await post.click();

      // Best-effort confirmation: the composer clears (editor empties or detaches) once the note is
      // accepted. We don't fail the post if this races — the click already went through — but we do
      // give the network round-trip a moment to land before closing the browser.
      await page
        .waitForFunction(
          () => {
            const el = document.querySelector('[contenteditable="true"]');
            return !el || (el.textContent ?? "").trim().length === 0;
          },
          { timeout: 15_000 }
        )
        .catch(() => {});

      return { ref: `substack note (posted ${new Date().toISOString()})` };
    } catch (cause) {
      if (cause instanceof PullError) throw cause;
      const diag = await captureDiagnostics(page, "substack", "notes-composer");
      throw new PullError("UI_CHANGED", `Couldn't post a note from ${page.url()}`, {
        hint: `Expected a "Write a note" composer + "Post" button on ${NOTES_URL}. Re-check the selectors in src/publish/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
        diagnosticsDir: diag,
        cause,
      });
    }
  } finally {
    await browser.close();
  }
}

export interface ScheduledSubstack {
  id: string;
  platform: string; // always "substack"
  when: string; // human PT label of the claimed slot (matches publishTikTok/publishText)
  ref: string; // provider ref once posted; "" while a slot is only claimed (not yet fired)
  posted: boolean; // false = claimed & waiting for its slot; true = fired to Substack this run
}

// Advance every approved `substack` row in `folder` through the claim-then-fire machine. Extracted
// from the CLI (like publishTikTok/publishText) so the review GUI can drive ONE row via opts.onlyIds.
// With no opts it processes every approved substack row in the folder.
//   - eligible = status is EXACTLY "approve" AND isSubstackRow (never draft/reject/published/pending).
//   - no pending claim  → claim a FUTURE slot, record it in the ledger, do NOT post ("claimed").
//   - pending claim, slot not yet due → wait, do NOT post.
//   - pending claim, slot has arrived → call postFn exactly once, mark the row published, release the
//     spent claim ("posted").
//   - dryRun short-circuits BEFORE any ledger write / status change / postFn call — zero mutations.
export async function publishSubstack(
  folder: string,
  opts: {
    onlyIds?: string[];
    dryRun?: boolean;
    now?: Date; // test-only override; never call new Date()/Date.now() inside the machine
    headed?: boolean;
    postFn?: PostFn;
  } = {}
): Promise<ScheduledSubstack[]> {
  const now = opts.now ?? new Date();
  const postFn = opts.postFn ?? postNoteToSubstack;

  const { rows } = readQueue(folder);
  // Safety-critical gate: ONLY status === "approve" is ever eligible. draft/reject/published/pending
  // must never reach postFn — a misfire posts live to Muxin's real public Substack account.
  let approved = rows.filter((r) => r.status === "approve" && isSubstackRow(r.platform));
  if (opts.onlyIds) approved = approved.filter((r) => opts.onlyIds!.includes(r.id));
  if (approved.length === 0) {
    console.log("no approved substack rows in the review queue");
    return [];
  }

  // DRY RUN: report the phase each row WOULD take, writing nothing — no ledger claim, no status
  // change, no post. Short-circuits before the mutating loop entirely.
  if (opts.dryRun) {
    const results: ScheduledSubstack[] = [];
    for (const row of approved) {
      const claim = findPendingClaim(assetKey(folder, row.id));
      if (!claim) {
        console.log(`[dry-run] ${row.id} → would CLAIM a future substack slot (not yet posted)`);
        results.push({ id: row.id, platform: "substack", when: "(unclaimed)", ref: "", posted: false });
      } else if (new Date(claim.time).getTime() <= now.getTime()) {
        console.log(`[dry-run] ${row.id} → would POST now (claimed slot ${claim.time} has arrived)`);
        results.push({ id: row.id, platform: "substack", when: fmtLa(new Date(claim.time)), ref: "", posted: false });
      } else {
        console.log(`[dry-run] ${row.id} → claimed for ${fmtLa(new Date(claim.time))}, not yet due`);
        results.push({ id: row.id, platform: "substack", when: fmtLa(new Date(claim.time)), ref: "", posted: false });
      }
    }
    return results;
  }

  const results: ScheduledSubstack[] = [];
  for (const row of approved) {
    const asset = assetKey(folder, row.id);
    const existing = findPendingClaim(asset);

    // PHASE 1 — no claim yet: claim a FUTURE slot from the unified scheduler (records it in the
    // shared ledger) and stop. Nothing posts on this run.
    if (!existing) {
      const { labels } = claimSlots({
        windowKey: WINDOW_KEY,
        conflictPlatforms: [WINDOW_KEY],
        count: 1,
        asset,
        by: WINDOW_KEY,
        now,
      });
      const when = labels[0] ?? "next-free-slot";
      appendPublishLog(folder, `${row.id} → substack slot claimed for ${when} (not yet posted)`);
      console.log(`claimed: ${row.id} → substack ${when} (will post once the slot arrives)`);
      results.push({ id: row.id, platform: "substack", when, ref: "", posted: false });
      continue;
    }

    // Claim exists but its slot is still in the future — wait, don't post.
    if (new Date(existing.time).getTime() > now.getTime()) {
      const when = fmtLa(new Date(existing.time));
      console.log(`waiting: ${row.id} → substack slot ${when} not yet due`);
      results.push({ id: row.id, platform: "substack", when, ref: "", posted: false });
      continue;
    }

    // PHASE 2 — the claimed slot has arrived: fire exactly once, mark the row published, release the
    // spent claim. The status flip to `published` is what stops any later run from re-firing it.
    const assetPath = isAbsolute(row.asset) ? row.asset : join(folder, row.asset);
    const { fm, body } = splitFrontmatter(readFileSync(assetPath, "utf8"));
    const text = body.trim();
    const { ref } = await postFn({ headed: opts.headed }, text);
    setStatus(folder, row, "published");
    releaseClaims([existing]);
    const when = fmtLa(new Date(existing.time));
    appendPublishLog(folder, `${row.id} → substack ${ref} (posted, claimed slot ${existing.time})`);
    appendBetPlacement(folder, row.id, "substack", `${ref} @ ${existing.time}`, fm, text);
    console.log(`posted: ${row.id} → substack ${ref}`);
    results.push({ id: row.id, platform: "substack", when, ref, posted: true });
  }

  return results;
}

// Read-only preflight: launch the saved-session browser, confirm it's still authenticated (no
// sign-in wall), print the verdict. Makes ZERO writes and NEVER posts or claims a slot.
//   npm run publish:substack -- --check
async function runCheck(headed: boolean): Promise<void> {
  const context = await launchPlatform("substack", { headed });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(NOTES_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${NOTES_URL}`, {
        hint: "Check your connection / that Substack opens in a normal browser.",
        cause,
      });
    }
    if (looksLikeAuthWall(page.url())) {
      console.error(`✗ Substack session is NOT authenticated — a sign-in wall at ${page.url()}.`);
      console.error("  fix: npm run pull:login -- substack");
      process.exitCode = 1;
      return;
    }
    console.log(`✓ Substack session is authenticated (${page.url()}) — ready to post notes.`);
  } finally {
    await context.close();
  }
}

// The triage verdict for a failed run — every failure says WHOSE fault it is (site UI vs our side vs
// a lapsed login), what happened, how to fix it, and where the diagnostics bundle landed. Mirrors
// src/pull/pull.ts's reportFailure so browser breakage reads identically on the pull and publish sides.
function reportFailure(err: unknown): void {
  const kind: PullFailureKind = err instanceof PullError ? err.kind : classifyUnknown(err);
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ substack — FAILED`);
  console.error(`  culprit: ${CULPRIT[kind]}`);
  console.error(`  what:    ${msg}`);
  if (err instanceof PullError && err.hint) console.error(`  fix:     ${err.hint}`);
  if (err instanceof PullError && err.diagnosticsDir) console.error(`  diag:    ${err.diagnosticsDir}`);
}

async function main() {
  const args = process.argv.slice(2);
  const headed = args.includes("--headed");
  const dryRun = args.includes("--dry-run");
  const check = args.includes("--check");

  if (check) {
    await runCheck(headed);
    return;
  }

  const arg = args.find((a) => !a.startsWith("--"));
  if (!arg) {
    console.error("usage: tsx src/publish/substack.ts <content-folder> [--dry-run] [--headed] | --check");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  try {
    await publishSubstack(folder, { dryRun, headed });
  } catch (e) {
    reportFailure(e);
    process.exit(1);
  }
}

// Run the CLI only when executed directly, so the module can be imported (e.g. in tests) without
// triggering main()/process.exit. Matches tiktok.ts / typefully.ts / cards.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
