import { test } from "node:test";
import assert from "node:assert/strict";
import { splitThread } from "./thread-split.js";
import { buildPosts } from "./typefully.js";

const words = (text: string) => text.split(/\s+/).filter(Boolean);

test("splitThread keeps the exact words in order and every post within the limit", () => {
  const body = "Opening paragraph that sets things up. It has two sentences.\n\n" +
    "Second paragraph with a much longer run of words that keeps going and going, well past one post. ".repeat(5).trim();
  const posts = splitThread(body, 280)!;
  assert.ok(posts.length > 1);
  assert.ok(posts.every((p) => p.length <= 280 && p.length > 0));
  assert.deepEqual(words(posts.join(" ")), words(body));
});

test("splitThread breaks at a paragraph when it leaves a reasonably full post", () => {
  const first = "A first paragraph long enough to fill most of a post on its own, which keeps going for a good while. It has a second sentence too, so it is well past half.";
  const body = `${first}\n\n${"Then the second paragraph goes on. ".repeat(10).trim()}`;
  assert.equal(splitThread(body, 280)![0], first);
});

test("splitThread prefers a sentence end over a mid-sentence word break", () => {
  const body = "a".repeat(150) + " ends here. " + "b ".repeat(100).trim();
  const posts = splitThread(body, 200)!;
  assert.ok(posts[0]!.endsWith("ends here."));
});

test("splitThread returns a fitting body unchanged and refuses a word longer than one post", () => {
  assert.deepEqual(splitThread("  short  ", 280), ["short"]);
  assert.equal(splitThread("y".repeat(290), 280), null);
});

test("buildPosts chains a thread-marked body and places the CTA against the last post", () => {
  const body = "One sentence here. ".repeat(30).trim();
  const cta = [{ label: "Read the essay:", url: "https://example.com/p/essay" }];
  const { posts } = buildPosts(body, cta, "reply", 280, true);
  assert.ok(posts.length > 2);
  assert.equal(posts[posts.length - 1]!.text, "Read the essay: https://example.com/p/essay");
  assert.deepEqual(words(posts.slice(0, -1).map((p) => p.text).join(" ")), words(body));
  assert.equal(buildPosts(body, [], "reply", 280).posts.length, 1, "unmarked bodies are never split");
});
