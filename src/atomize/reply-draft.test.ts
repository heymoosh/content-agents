/**
 * Unit tests for src/atomize/reply-draft.ts — goal (b):
 *   a mocked mention drafts a kind:"text" row with origin "reply to mention" +
 *   reply_to_url/reply_to_text populated.
 *
 * draftMentionReply's Claude call is DI'd (spawnClaude) so this never spawns a real subprocess or
 * touches the network — mirrors the mocking convention used elsewhere (typefully.test.ts's
 * globalThis.fetch stub, bluesky-mentions.test.ts's injected NotificationsClient).
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue } from "../publish/queue.js";
import {
  buildReplyPrompt,
  extractThreadContext,
  draftMentionReply,
  type MentionForReply,
  type SpawnClaude,
} from "./reply-draft.js";

describe("buildReplyPrompt: references voice.yaml + frames this explicitly as a reply", () => {
  test("names config/voice.yaml, frames replying to the specific person, includes their text + char limit", () => {
    const prompt = buildReplyPrompt({
      authorHandle: "alice.bsky.social",
      mentionText: "I don't buy the fairness-gap framing.",
      threadContext: [],
      maxChars: 300,
    });
    assert.match(prompt, /config\/voice\.yaml/);
    assert.match(prompt, /REPLY, not a fresh post/);
    assert.match(prompt, /@alice\.bsky\.social/);
    assert.match(prompt, /I don't buy the fairness-gap framing\./);
    assert.match(prompt, /300 characters/);
  });

  test("includes prior thread context lines when present, omits the section when empty", () => {
    const withContext = buildReplyPrompt({
      authorHandle: "bob.bsky.social",
      mentionText: "following up on that",
      threadContext: ["@humaninference: original point here"],
      maxChars: 300,
    });
    assert.match(withContext, /Prior context in this thread/);
    assert.match(withContext, /@humaninference: original point here/);

    const withoutContext = buildReplyPrompt({
      authorHandle: "bob.bsky.social",
      mentionText: "following up on that",
      threadContext: [],
      maxChars: 300,
    });
    assert.doesNotMatch(withoutContext, /Prior context in this thread/);
  });
});

describe("extractThreadContext: walks a getPostThread parent chain, oldest-first", () => {
  test("collects handle+text up the parent chain, stops at maxLines", () => {
    const thread = {
      post: { author: { handle: "leaf" }, record: { text: "leaf text" } },
      parent: {
        post: { author: { handle: "mid" }, record: { text: "mid text" } },
        parent: {
          post: { author: { handle: "root" }, record: { text: "root text" } },
        },
      },
    };
    assert.deepEqual(extractThreadContext(thread, 5), ["@root: root text", "@mid: mid text"]);
  });

  test("a thread with no parent (top-level post) returns no context", () => {
    const thread = { post: { author: { handle: "solo" }, record: { text: "hi" } } };
    assert.deepEqual(extractThreadContext(thread), []);
  });

  test("handles a NotFoundPost/BlockedPost parent gracefully (no author/record) without crashing", () => {
    const thread = {
      post: { author: { handle: "leaf" }, record: { text: "leaf text" } },
      parent: { uri: "at://gone", notFound: true },
    };
    assert.deepEqual(extractThreadContext(thread), []);
  });
});

describe("draftMentionReply: writes a kind:'text' derivative + pending review-queue row", () => {
  const mention: MentionForReply = {
    authorHandle: "alice.bsky.social",
    postUrl: "https://bsky.app/profile/alice.bsky.social/post/abc123",
    postText: "I don't buy the fairness-gap framing. Isn't this just standard tech adoption?",
    indexedAt: "2026-07-08T10:00:00.000Z",
  };
  let capturedPrompt = "";
  const fakeSpawnClaude: SpawnClaude = async (prompt) => {
    capturedPrompt = prompt;
    return { stdout: "Fair pushback. The gap isn't adoption speed, it's who gets a say in how it's deployed.\n", code: 0 };
  };

  let draftedFolder: string | null = null;
  after(() => {
    // Clean up the scaffolded content folder this test creates (mirrors reuse-guard.test.ts's
    // "restore what was there" discipline, applied to a brand-new folder instead of an edited one).
    if (draftedFolder) {
      try {
        rmSync(draftedFolder, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  test("drafts a reply via the injected spawnClaude, writes derivatives/bluesky-1.md + a pending queue row", async () => {
    const result = await draftMentionReply(mention, ["@humaninference: original point"], fakeSpawnClaude);
    draftedFolder = result.folder;

    assert.match(capturedPrompt, /@alice\.bsky\.social/);
    assert.match(capturedPrompt, /original point/);

    // The derivative file: kind "text" (format text in the queue row below), frontmatter carries
    // the NEW reply_to_url/reply_to_text fields.
    assert.ok(existsSync(result.path));
    const raw = readFileSync(result.path, "utf8");
    const { fm, body } = splitFrontmatter(raw);
    assert.equal(fm.platform, "bluesky");
    assert.equal(fm.reply_to_url, mention.postUrl);
    assert.equal(fm.reply_to_text, mention.postText);
    assert.equal(body, "Fair pushback. The gap isn't adoption speed, it's who gets a say in how it's deployed.");

    // The review-queue row: format "text" (kind: "text" per src/review/rows.ts's Kind union),
    // origin "reply to mention", status "pending".
    const { rows } = readQueue(result.folder);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.id, "bluesky-1");
    assert.equal(row.platform, "bluesky");
    assert.equal(row.format, "text");
    assert.equal(row.origin, "reply to mention");
    assert.equal(row.status, "pending");
  });

  test("throws (writes nothing extra) when the subprocess exits non-zero", async () => {
    const failingSpawn: SpawnClaude = async () => ({ stdout: "", code: 1 });
    await assert.rejects(() => draftMentionReply(mention, [], failingSpawn), /exit 1/);
  });

  test("throws when the subprocess produces empty stdout", async () => {
    const emptySpawn: SpawnClaude = async () => ({ stdout: "   \n", code: 0 });
    await assert.rejects(() => draftMentionReply(mention, [], emptySpawn), /no reply text/);
  });
});
