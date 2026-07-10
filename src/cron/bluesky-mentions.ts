// bluesky-mentions.ts — Poll Bluesky for new mentions/replies, log which ones are new.
//
//   npm run bluesky-mentions               # live run (needs BLUESKY_HANDLE/BLUESKY_APP_PASSWORD)
//   npm run bluesky-mentions -- --dry-run  # print plan only, no network calls, no file writes
//   npm run bluesky-mentions -- --limit 40 # fetch further back (default 30)
//
// State lives in data/bluesky-mentions-ledger.jsonl (committed, mirrors notes-spread-ledger.jsonl's
// convention — see src/cron/bluesky-mentions-ledger.ts).
//
// Flow: load ledger → fetch notifications → filter to mention/reply, not already seen → log them →
// mark seen in the ledger. That's it.
//
// This script does NOT draft anything (same rule as notes-daily.ts): drafting a reply needs real
// Claude judgment (framing a reply in Muxin's voice) and review before it can ever ship. See
// src/atomize/reply-draft.ts for the drafting step — a separate command, run on one mention at a
// time, never auto-chained from this poller.

import "../util/env.js";
import { pathToFileURL } from "node:url";
import { AtpAgent } from "@atproto/api";
import { readLedger, appendLedger } from "./bluesky-mentions-ledger.js";

const REASONS = ["mention", "reply"] as const;
type MentionReason = (typeof REASONS)[number];

// The subset of AT Protocol's Notification shape this module actually reads — narrower than the
// SDK's own type so a fixture/mock in tests doesn't need to satisfy every unrelated field.
export interface RawNotification {
  uri: string;
  reason: string;
  author: { handle: string };
  record: { text?: string; createdAt?: string };
  indexedAt: string;
}

// The one method this module calls on an AtpAgent — injected so tests can supply a fake client
// instead of a real network-backed AtpAgent (mirrors fetch-bluesky.ts's own AtpAgent usage, but
// narrowed to exactly what's needed here, the same "minimal client interface" DI pattern used
// elsewhere in this repo for testability).
export interface NotificationsClient {
  listNotifications(params: {
    reasons?: string[];
    limit?: number;
    cursor?: string;
  }): Promise<{ data: { notifications: RawNotification[]; cursor?: string } }>;
}

export interface DetectedMention {
  uri: string;
  reason: MentionReason;
  authorHandle: string;
  postUrl: string;
  postText: string;
  indexedAt: string;
}

function toDetectedMention(n: RawNotification): DetectedMention {
  // `?? n.uri` only guards null/undefined, not "" — a URI with a trailing slash would otherwise
  // produce an empty rkey (a broken postUrl) instead of falling back to the full URI.
  const lastSegment = n.uri.split("/").pop();
  const rkey = lastSegment ? lastSegment : n.uri;
  return {
    uri: n.uri,
    reason: n.reason as MentionReason,
    authorHandle: n.author.handle,
    postUrl: `https://bsky.app/profile/${n.author.handle}/post/${rkey}`,
    postText: n.record.text ?? "",
    indexedAt: n.indexedAt,
  };
}

// Pure: given raw notifications + the set of already-seen URIs, return only the NEW mention/reply
// notifications, mapped into our own shape. Exported so the detect+dedupe logic is unit-testable
// without any network or filesystem — the dedupe key is the notification's own URI (one notification
// per post, so re-fetching the same window twice can never double-log the same post).
export function detectNewMentions(
  notifications: RawNotification[],
  seenUris: Set<string>
): DetectedMention[] {
  return notifications
    .filter((n) => (REASONS as readonly string[]).includes(n.reason) && !seenUris.has(n.uri))
    .map(toDetectedMention);
}

// Fetch one page of notifications from the client, already reason-filtered server-side (Bluesky's
// own `reasons` param) as a courtesy — detectNewMentions still filters client-side too, since we
// can't assume every client/mock honors the param.
export async function fetchNotifications(
  client: NotificationsClient,
  limit: number
): Promise<RawNotification[]> {
  const res = await client.listNotifications({ reasons: [...REASONS], limit });
  return res.data.notifications;
}

// ---- dry-run fixture -------------------------------------------------------

const DRY_RUN_FIXTURE: RawNotification[] = [
  {
    uri: "at://did:plc:dryrun001/app.bsky.feed.post/dryrun001",
    reason: "mention",
    author: { handle: "curious-reader.bsky.social" },
    record: { text: "@humaninference what do you make of the new AI hiring rules?", createdAt: "2026-07-08T10:00:00.000Z" },
    indexedAt: "2026-07-08T10:00:05.000Z",
  },
  {
    uri: "at://did:plc:dryrun002/app.bsky.feed.post/dryrun002",
    reason: "reply",
    author: { handle: "skeptical-pm.bsky.social" },
    record: { text: "I don't buy the fairness-gap framing. Isn't this just standard tech adoption?", createdAt: "2026-07-08T11:00:00.000Z" },
    indexedAt: "2026-07-08T11:00:05.000Z",
  },
  {
    // Already in the ledger → should be SKIPPED in dry-run.
    uri: "at://did:plc:dryrun-already-seen/app.bsky.feed.post/seen001",
    reason: "mention",
    author: { handle: "already-seen.bsky.social" },
    record: { text: "This one was already logged and should be skipped.", createdAt: "2026-07-07T09:00:00.000Z" },
    indexedAt: "2026-07-07T09:00:05.000Z",
  },
  {
    // A "like" notification — must be filtered out even though it's technically new.
    uri: "at://did:plc:dryrun-like/app.bsky.feed.post/like001",
    reason: "like",
    author: { handle: "liker.bsky.social" },
    record: {},
    indexedAt: "2026-07-08T12:00:00.000Z",
  },
];

// ---- main ------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  // `|| 30` would treat an explicit `--limit 0` as falsy and silently substitute the default —
  // check NaN specifically so 0 (Math.max floors it to 1 anyway) round-trips as the caller's own
  // value instead of being swapped for 30.
  const parsedLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "30", 10) : 30;
  const fetchLimit = Math.max(1, Number.isNaN(parsedLimit) ? 30 : parsedLimit);

  console.log(`\nbluesky-mentions${isDryRun ? " [DRY RUN — no network, no writes]" : ""}`);
  console.log("=".repeat(50));

  // 1. Load ledger — set of already-seen notification URIs.
  const { seenUris } = readLedger();
  console.log(`Ledger: ${seenUris.size} notification(s) already seen.`);

  // 2. Fetch notifications (or use fixture in dry-run).
  let notifications: RawNotification[];
  if (isDryRun) {
    console.log("Using fixture notifications (no network call in dry-run).");
    notifications = [...DRY_RUN_FIXTURE];
    seenUris.add("at://did:plc:dryrun-already-seen/app.bsky.feed.post/seen001");
  } else {
    const handle = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (!handle || !password) {
      console.error("Set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env (see .env.example).");
      process.exit(1);
    }
    const agent = new AtpAgent({ service: "https://bsky.social" });
    await agent.login({ identifier: handle, password });
    console.log(`Fetching last ${fetchLimit} notification(s)...`);
    notifications = await fetchNotifications(agent, fetchLimit);
    console.log(`Fetched: ${notifications.length} notification(s).`);
  }

  // 3. Filter to NEW mention/reply notifications (not already in the ledger).
  const newMentions = detectNewMentions(notifications, seenUris);
  console.log(`New mention/reply notification(s): ${newMentions.length}`);

  if (newMentions.length === 0) {
    console.log("Nothing new — all fetched notifications already in the ledger (or not a mention/reply).");
    return;
  }

  console.log(`\n${newMentions.length} new mention(s)/reply(ies):`);
  for (const m of newMentions) {
    console.log(`  [${m.reason}] @${m.authorHandle}: "${m.postText.slice(0, 100)}"`);
    console.log(`    ${m.postUrl}`);
    // reply-draft.ts's --uri flag needs the AT URI (m.uri), not the bsky.app link above — print a
    // ready-to-paste command so the handoff to the next step doesn't require opening the ledger.
    console.log(`    tsx src/atomize/reply-draft.ts --uri "${m.uri}"`);
  }

  if (isDryRun) {
    console.log("\nDry-run complete — no ledger entries written, no network calls.");
    return;
  }

  // 4. Mark each as seen so the next run doesn't re-flag it. Nothing is drafted here — run
  //    `tsx src/atomize/reply-draft.ts` on a specific mention to draft a reply for review.
  for (const m of newMentions) {
    appendLedger({
      uri: m.uri,
      reason: m.reason,
      authorHandle: m.authorHandle,
      postUrl: m.postUrl,
      postText: m.postText,
      indexedAt: m.indexedAt,
      seenAt: new Date().toISOString(),
    });
  }
  console.log(`\nLedger: marked ${newMentions.length} notification(s) as seen.`);
  console.log("Nothing drafted or published — draft a reply for one of these with src/atomize/reply-draft.ts.");
}

// Run the CLI only when executed directly, so the module can be imported (detectNewMentions,
// fetchNotifications) without triggering main()/process.exit. Matches typefully.ts / tiktok.ts /
// cards.ts / youtube.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
