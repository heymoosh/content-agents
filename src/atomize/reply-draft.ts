// reply-draft.ts — draft ONE reply to a detected Bluesky mention/reply, in Muxin's voice, for
// review. Never sends anything: this only writes a `kind: "text"` derivative + a `pending`
// review-queue.md row (origin "reply to mention") — CLAUDE.md rule 2 still governs what actually
// ships (src/publish/typefully.ts only ever picks up rows whose status is `approve`).
//
//   tsx src/atomize/reply-draft.ts --uri <at-uri>   # draft a reply for one logged mention
//   tsx src/atomize/reply-draft.ts --dry-run        # fixture mention, prints the prompt + a stub
//                                                    # reply, writes nothing
//
// Composes an ORIGINAL reply (not extraction from Muxin's own prior writing — there's nothing of
// his to extract from here, the whole point is responding to someone else's post) via a `claude -p`
// subprocess, the same "headless Claude on the subscription, $0 marginal" pattern reviseDerivative/
// duplicateToPlatform (src/review/jobs.ts) use for other non-verbatim drafting. Safe for the same
// reason those are: nothing here publishes — it lands `pending` and Muxin reviews it like anything
// else /atomize queues.

import "../util/env.js";
import { writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { AtpAgent } from "@atproto/api";
import { repoRoot } from "../db/db.js";
import { loadPlatforms } from "../config/platforms.js";
import { scaffoldContentFolder } from "./new-content.js";
import { appendRow } from "../publish/queue.js";
import { readLedger, type MentionLedgerEntry } from "../cron/bluesky-mentions-ledger.js";

// ── Thread context ───────────────────────────────────────────────────────────────────────────

// The one method this module needs off an AtpAgent — injected so tests can supply a fake client
// instead of a real network-backed AtpAgent (same minimal-client DI pattern as
// src/cron/bluesky-mentions.ts's NotificationsClient).
export interface ThreadClient {
  getPostThread(params: { uri: string; parentHeight?: number }): Promise<{ data: { thread: unknown } }>;
}

interface ThreadNode {
  post?: { author?: { handle?: string }; record?: { text?: string } };
  parent?: unknown;
}

// Pure: walk a getPostThread response's parent chain into readable "@handle: text" lines,
// oldest-first — exported so the walk itself is unit-testable against a plain object fixture, no
// network, no SDK types required.
export function extractThreadContext(thread: unknown, maxLines = 5): string[] {
  const lines: string[] = [];
  let node = thread as ThreadNode | undefined;
  while (node?.parent && lines.length < maxLines) {
    node = node.parent as ThreadNode;
    const handle = node?.post?.author?.handle;
    const text = node?.post?.record?.text;
    if (handle && text) lines.unshift(`@${handle}: ${text}`);
  }
  return lines;
}

export async function fetchThreadContext(client: ThreadClient, uri: string, maxLines = 5): Promise<string[]> {
  const res = await client.getPostThread({ uri, parentHeight: maxLines });
  return extractThreadContext(res.data.thread, maxLines);
}

// ── Prompt ───────────────────────────────────────────────────────────────────────────────────

// Build the instruction for drafting ONE reply. Exported so the prompt's guardrails (voice.yaml,
// the explicit "this is a reply, engage with what they said" framing, the char limit) are
// unit-testable without spawning a subprocess — mirrors revisePrompt/duplicatePrompt in
// src/review/jobs.ts, the existing "reference config/voice.yaml by name inside a claude -p prompt"
// pattern in this repo.
export function buildReplyPrompt(input: {
  authorHandle: string;
  mentionText: string;
  threadContext: string[]; // oldest-first prior lines, e.g. ["@muxin: ...", "@alice: ..."]
  maxChars: number;
}): string {
  return [
    `Draft ONE reply for Muxin Li's Bluesky account. Do not run shell commands, do not write any files.`,
    `Print ONLY the reply text to stdout — no preamble, no quote marks around it, no explanation, nothing else.`,
    ``,
    `The other person (@${input.authorHandle}) just wrote:`,
    `"""`,
    input.mentionText,
    `"""`,
    input.threadContext.length
      ? `\nPrior context in this thread (oldest first):\n${input.threadContext.map((l) => `- ${l}`).join("\n")}\n`
      : ``,
    `This is a REPLY, not a fresh post: engage directly with what @${input.authorHandle} specifically said —`,
    `answer their point, push back on it, or build on it. Do not just restate one of Muxin's own`,
    `unrelated talking points; respond to what they actually wrote.`,
    ``,
    `Rules:`,
    `- Follow config/voice.yaml: Muxin's plain, direct PM voice. No em dashes, no AI tells (no "here's`,
    `  the thing", no hedging, no thought-leader cadence).`,
    `- Stay under ${input.maxChars} characters (Bluesky's limit).`,
    `- Do not invent a claim, statistic, or fact. If you don't have grounds Muxin has stated elsewhere,`,
    `  keep the reply to reacting to their point, not asserting something new.`,
    `- No hashtags. No emoji used as bullets or decoration.`,
    `- Print ONLY the reply text. Nothing else.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ── Subprocess ───────────────────────────────────────────────────────────────────────────────

export interface ClaudeRunResult {
  stdout: string;
  code: number | null;
}

// Injected so draftMentionReply is unit-testable without ever spawning a real `claude` process.
// Kept deliberately separate from src/review/jobs.ts's runClaudeSpawn (that one is wired to the
// GUI job queue's persisted log/heartbeat — this is a standalone cron-family script with no jobs
// pill to feed).
export type SpawnClaude = (prompt: string) => Promise<ClaudeRunResult>;

const REPLY_TIMEOUT_MS = 120_000;

export function realSpawnClaude(prompt: string): Promise<ClaudeRunResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    const child = spawn("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: REPLY_TIMEOUT_MS,
    });
    child.on("error", reject);
    child.stdout?.on("data", (c) => (stdout += c.toString("utf8")));
    child.on("close", (code) => resolve({ stdout, code }));
  });
}

// ── Draft ────────────────────────────────────────────────────────────────────────────────────

export interface MentionForReply {
  authorHandle: string;
  postUrl: string;
  postText: string;
  indexedAt: string;
}

export interface DraftedReply {
  folder: string;
  id: string;
  path: string;
  body: string;
}

// Draft ONE reply for `mention` and queue it for review. Writes:
//   - content/<date>-reply-to-<handle>/source.md   (scaffolded via new-content.ts, traces what
//     triggered this — the mention's own post — same scaffolding every atomized piece gets)
//   - .../derivatives/bluesky-1.md                 (kind: "text", frontmatter carries
//     reply_to_url/reply_to_text — the NEW fields this build adds)
//   - .../review-queue.md gets a new row: status "pending" (never "approve" — see
//     src/publish/reply-approval-gate.test.ts), origin "reply to mention"
//
// Never approves, schedules, or posts anything — same "draft + queue only" contract as
// duplicateToPlatform.
export async function draftMentionReply(
  mention: MentionForReply,
  threadContext: string[],
  spawnClaude: SpawnClaude
): Promise<DraftedReply> {
  const maxChars = loadPlatforms().platforms.bluesky?.max_chars ?? 300;
  const prompt = buildReplyPrompt({
    authorHandle: mention.authorHandle,
    mentionText: mention.postText,
    threadContext,
    maxChars,
  });

  const { stdout, code } = await spawnClaude(prompt);
  if (code !== 0) throw new Error(`claude -p failed drafting a reply (exit ${code})`);
  const body = stdout.trim();
  if (!body) throw new Error("claude -p produced no reply text");

  const folder = scaffoldContentFolder({
    title: `Reply to @${mention.authorHandle}`,
    origin: mention.postUrl,
    publishedAt: mention.indexedAt,
    text: mention.postText,
    sourceKind: "bluesky-mention",
  });

  const id = "bluesky-1";
  const path = join(folder, "derivatives", `${id}.md`);
  writeFileSync(
    path,
    [
      "---",
      "platform: bluesky",
      `reply_to_url: ${mention.postUrl}`,
      `reply_to_text: ${JSON.stringify(mention.postText)}`,
      "---",
      "",
      body,
      "",
    ].join("\n")
  );

  appendRow(folder, {
    id,
    platform: "bluesky",
    format: "text",
    asset: `derivatives/${id}.md`,
    status: "pending", // NEVER "approve" on creation — CLAUDE.md rule 2, proven by the gate test
    notes: `reply to @${mention.authorHandle}`,
    origin: "reply to mention",
  });

  return { folder, id, path, body };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────

const DRY_RUN_FIXTURE: MentionForReply = {
  authorHandle: "curious-reader.bsky.social",
  postUrl: "https://bsky.app/profile/curious-reader.bsky.social/post/dryrun001",
  postText: "@humaninference what do you make of the new AI hiring rules?",
  indexedAt: "2026-07-08T10:00:05.000Z",
};

function findLedgerEntry(uri: string): MentionLedgerEntry {
  const { entries } = readLedger();
  const entry = entries.find((e) => e.uri === uri);
  if (!entry) throw new Error(`no mention with uri ${uri} in data/bluesky-mentions-ledger.jsonl — run bluesky-mentions first`);
  return entry;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const uriIdx = args.indexOf("--uri");
  const uri = uriIdx >= 0 ? args[uriIdx + 1] : undefined;

  if (isDryRun) {
    console.log("bluesky reply-draft [DRY RUN — fixture mention, no network, no writes]");
    const prompt = buildReplyPrompt({
      authorHandle: DRY_RUN_FIXTURE.authorHandle,
      mentionText: DRY_RUN_FIXTURE.postText,
      threadContext: [],
      maxChars: loadPlatforms().platforms.bluesky?.max_chars ?? 300,
    });
    console.log("\n--- prompt that would be sent to `claude -p` ---\n");
    console.log(prompt);
    console.log("\n--- end prompt (nothing written) ---");
    return;
  }

  if (!uri) {
    console.error("usage: tsx src/atomize/reply-draft.ts --uri <at-uri> | --dry-run");
    process.exit(1);
  }
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    console.error("Set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env (see .env.example).");
    process.exit(1);
  }
  const entry = findLedgerEntry(uri);
  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });
  const threadContext = await fetchThreadContext(agent, uri);
  const drafted = await draftMentionReply(entry, threadContext, realSpawnClaude);
  console.log(`Drafted reply → ${basename(drafted.folder)}/derivatives/${drafted.id}.md (pending review)`);
  console.log(`  ${drafted.body}`);
}

// Run the CLI only when executed directly — importing this module (buildReplyPrompt,
// draftMentionReply, extractThreadContext) must not spawn Claude or touch the network.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
