import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bodyIsComplete,
  describeMedia,
  findPostNodes,
  jsonBlobsFromHtml,
  ownPostReason,
  stageEntry,
  threadsUrl,
  toThreadsPost,
  type ThreadsPost,
} from "./threads-extract.js";
import { loadConfig, validateEntry } from "../patterns/collect.js";
import { DEFAULT_PULL_PLATFORMS, PULLERS } from "./registry.js";
import { slideDirFor } from "./platforms/threads.js";
import { isAbsolute } from "node:path";

// Fixture markup in the shape a Threads profile page ships: server-rendered state inside
// `<script type="application/json">` blobs, with the post objects buried somewhere down a Relay
// envelope. The envelope here is deliberately deep and oddly named, because the whole point of the
// structural walk is that the envelope is not what it keys on.
//
// The field names inside the post objects are reconstructed from the Instagram-family schema
// Threads runs on. They have not been checked against a live logged-in response, so these tests
// prove the walking, filtering and staging logic, NOT that Threads calls its fields this.

function textPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "Cabc123",
    pk: "1",
    taken_at: 1_755_000_000,
    like_count: 4_210,
    caption: { text: "The thing nobody tells you about shipping alone:\n\nyou run out of feedback, not ideas." },
    user: { username: "buildsolo", full_name: "Sam Builds", follower_count: 61_000 },
    text_post_app_info: { direct_reply_count: 88, repost_count: 140 },
    ...overrides,
  };
}

function carouselPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "Cdef456",
    pk: "2",
    taken_at: 1_755_100_000,
    like_count: 12_800,
    caption: { text: "6 slides on this 👇" },
    user: { username: "buildsolo", full_name: "Sam Builds", follower_count: 61_000 },
    text_post_app_info: { direct_reply_count: 310, repost_count: 900 },
    original_width: 1080,
    original_height: 1080,
    carousel_media: [
      {
        accessibility_caption: "May be an image of text",
        image_versions2: { candidates: [{ url: "https://cdn.example/slide1.jpg", width: 1080 }] },
      },
      {
        accessibility_caption: null,
        image_versions2: { candidates: [{ url: "https://cdn.example/slide2.jpg", width: 1080 }] },
      },
    ],
    ...overrides,
  };
}

function wrap(items: Record<string, unknown>[]): string {
  const envelope = {
    require: [["ScheduledServerJS", "handle", null, [{ __bbox: { require: [] } }]]],
    __bbox: {
      result: {
        data: {
          mediaData: {
            edges: items.map((node) => ({ node: { thread_items: [{ post: node }] } })),
          },
        },
      },
    },
  };
  return [
    "<!DOCTYPE html><html><head><title>Threads</title></head><body>",
    '<script type="application/json" data-sjs>' + JSON.stringify(envelope) + "</script>",
    '<script type="application/json">{"not":"a post"}</script>',
    '<script type="text/javascript">requireLazy(["TimeSlice"], function(){});</script>',
    "</body></html>",
  ].join("");
}

test("jsonBlobsFromHtml takes the JSON script blobs and leaves the JavaScript alone", () => {
  const blobs = jsonBlobsFromHtml(wrap([textPost()]));
  assert.equal(blobs.length, 2);
});

test("jsonBlobsFromHtml skips a blob that will not parse instead of throwing", () => {
  const html = '<script type="application/json">{oops</script><script type="application/json">{"ok":1}</script>';
  assert.deepEqual(jsonBlobsFromHtml(html), [{ ok: 1 }]);
});

test("findPostNodes reaches post objects through an envelope it knows nothing about", () => {
  const blobs = jsonBlobsFromHtml(wrap([textPost(), carouselPost()]));
  const nodes = blobs.flatMap((b) => findPostNodes(b));
  assert.deepEqual(
    nodes.map((n) => n.code),
    ["Cabc123", "Cdef456"]
  );
});

test("findPostNodes ignores objects that only look post-shaped", () => {
  const nodes = findPostNodes({
    a: { code: "X1", user: { username: "buildsolo" } }, // no post-only field
    b: { code: "X2", like_count: 5 }, // no author
    c: { user: { username: "buildsolo" }, like_count: 5 }, // no shortcode
  });
  assert.equal(nodes.length, 0);
});

test("findPostNodes dedupes by shortcode and survives a cyclic payload", () => {
  const post = textPost();
  const payload: Record<string, unknown> = { first: post, second: post };
  payload.self = payload;
  assert.equal(findPostNodes(payload).length, 1);
});

test("toThreadsPost maps a text post onto the corpus vocabulary", () => {
  const post = toThreadsPost(textPost()) as ThreadsPost;
  assert.equal(post.username, "buildsolo");
  assert.equal(post.creator, "Sam Builds");
  assert.equal(post.url, threadsUrl("buildsolo", "Cabc123"));
  assert.equal(post.form, "text-only");
  assert.equal(post.likes, 4_210);
  // Threads replies are the corpus's comments, and Threads reposts are its shares.
  assert.equal(post.replies, 88);
  assert.equal(post.reposts, 140);
  assert.equal(post.followers, 61_000);
  assert.equal(post.postedAt, new Date(1_755_000_000_000).toISOString());
  // No public view count in the payload means null, never a stand-in.
  assert.equal(post.views, null);
});

test("toThreadsPost records a carousel as a carousel, with its slides and its slide count", () => {
  const post = toThreadsPost(carouselPost()) as ThreadsPost;
  assert.equal(post.form, "carousel");
  assert.equal(post.mediaCount, 2);
  assert.equal(post.aspect, "square");
  assert.deepEqual(post.slides, [
    { url: "https://cdn.example/slide1.jpg", alt: "May be an image of text" },
    { url: "https://cdn.example/slide2.jpg", alt: null },
  ]);
});

test("toThreadsPost splits short-video from video on a real duration, and never on a guess", () => {
  const short = toThreadsPost(textPost({ video_versions: [{ url: "v" }], video_duration: 31 })) as ThreadsPost;
  assert.equal(short.form, "short-video");
  const long = toThreadsPost(textPost({ video_versions: [{ url: "v" }], video_duration: 240 })) as ThreadsPost;
  assert.equal(long.form, "video");
  const unknown = toThreadsPost(textPost({ video_versions: [{ url: "v" }] })) as ThreadsPost;
  assert.equal(unknown.form, "video");
  assert.equal(unknown.durationSeconds, null);
});

test("toThreadsPost returns null on a node with no author or no shortcode", () => {
  assert.equal(toThreadsPost({ code: "X", like_count: 1 }), null);
  assert.equal(toThreadsPost({ user: { username: "a" }, like_count: 1 }), null);
});

// ── The authorship filter. This is the rule that exists because another person's comment was once
// staged as a creator's own post, on LinkedIn, and all 15 entries had to be purged.

test("a post by someone else is refused, whatever else is right about it", () => {
  const post = toThreadsPost(textPost({ user: { username: "someoneelse", full_name: "Not Sam" } })) as ThreadsPost;
  assert.match(ownPostReason(post, "buildsolo") ?? "", /written by @someoneelse/);
});

test("the author match ignores a leading @ and letter case", () => {
  const post = toThreadsPost(textPost()) as ThreadsPost;
  assert.equal(ownPostReason(post, "@BuildSolo"), null);
});

test("a reply is refused even when the account itself wrote it", () => {
  const node = textPost({
    text_post_app_info: { direct_reply_count: 2, repost_count: 0, reply_to_author: { username: "someoneelse" } },
  });
  const post = toThreadsPost(node) as ThreadsPost;
  assert.equal(post.isReply, true);
  assert.match(ownPostReason(post, "buildsolo") ?? "", /a reply/);
});

test("a repost of someone else's post is refused", () => {
  const node = textPost({
    text_post_app_info: { direct_reply_count: 0, repost_count: 0, share_info: { reposted_post: { code: "Zzz" } } },
  });
  const post = toThreadsPost(node) as ThreadsPost;
  assert.equal(post.isRepost, true);
  assert.match(ownPostReason(post, "buildsolo") ?? "", /repost/);
});

test("a decoy feed stages only the account's own standalone posts", () => {
  const html = wrap([
    textPost(),
    textPost({ code: "Cwrong1", pk: "9", user: { username: "someoneelse", full_name: "Not Sam" } }),
    textPost({
      code: "Creply1",
      pk: "10",
      text_post_app_info: { direct_reply_count: 0, repost_count: 0, reply_to_author: { username: "someoneelse" } },
    }),
  ]);
  const posts = jsonBlobsFromHtml(html)
    .flatMap((b) => findPostNodes(b))
    .map(toThreadsPost)
    .filter((p): p is ThreadsPost => p !== null);
  const staged = posts
    .map((p) => stageEntry(p, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" }))
    .filter((r) => r.entry !== null);
  assert.equal(staged.length, 1);
  assert.equal(staged[0].entry?.url, threadsUrl("buildsolo", "Cabc123"));
});

// ── body_is_complete. The single field the whole collection exists to get right.

test("only a post with no media at all can claim its body is the whole post", () => {
  assert.equal(bodyIsComplete("text-only", "the whole post"), true);
  assert.equal(bodyIsComplete("text-only", "   "), false);
  for (const form of ["carousel", "image", "video", "short-video", "link-preview", "repost-with-comment", "mixed"] as const) {
    assert.equal(bodyIsComplete(form, "a caption"), false, `${form} must not claim a complete body`);
  }
});

test("a carousel is staged with body_is_complete false and no invented on-screen text", () => {
  const post = toThreadsPost(carouselPost()) as ThreadsPost;
  const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" });
  assert.ok(entry);
  assert.equal(entry.media.body_is_complete, false);
  // The caption is recorded as the caption. It is never allowed to stand in for the slides.
  assert.equal(entry.body, "6 slides on this 👇");
  assert.equal(entry.media.onscreen_text, null);
  assert.equal(entry.media.media_count, 2);
});

test("a plain text post is staged with body_is_complete true", () => {
  const post = toThreadsPost(textPost()) as ThreadsPost;
  const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" });
  assert.equal(entry?.media.body_is_complete, true);
  assert.equal(entry?.media.form, "text-only");
});

test("a video is staged as kind video with transcript_source caption, the singular one", () => {
  const post = toThreadsPost(textPost({ video_versions: [{ url: "v" }], video_duration: 42 })) as ThreadsPost;
  const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" });
  assert.equal(entry?.kind, "video");
  // Singular "caption": the body is the creator's written words, not anything anyone said.
  assert.equal(entry?.transcript_source, "caption");
  assert.equal(entry?.media.body_is_complete, false);
  assert.equal(entry?.media.duration_seconds, 42);
});

test("a wordless image post is skipped and says why, rather than being padded past the gate", () => {
  const post = toThreadsPost(carouselPost({ caption: { text: "   " } })) as ThreadsPost;
  const { entry, skipped } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" });
  assert.equal(entry, null);
  assert.match(skipped ?? "", /no caption text/);
});

test("describeMedia labels Meta's alt text as Meta's and never as the typeset headline", () => {
  const post = toThreadsPost(carouselPost()) as ThreadsPost;
  const text = describeMedia(post, "/tmp/slides");
  assert.match(text, /carousel of 2 slides/);
  assert.match(text, /was NOT extracted/);
  assert.match(text, /auto-generated alt text/);
  assert.match(text, /not the typeset headline/);
  assert.match(text, /\/tmp\/slides/);
});

test("the slide directory is named as an absolute path a human can paste into Finder", () => {
  const post = toThreadsPost(carouselPost()) as ThreadsPost;
  const dir = slideDirFor("buildsolo", "Cdef456");
  assert.ok(isAbsolute(dir), `${dir} must be absolute`);
  const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur", slideDir: dir });
  assert.match(entry?.media.description ?? "", /paste this path into Finder/);
  assert.ok((entry?.media.description ?? "").includes(dir));
});

test("describeMedia on a text-only post makes no claim about images", () => {
  const post = toThreadsPost(textPost()) as ThreadsPost;
  const text = describeMedia(post, null);
  assert.match(text, /no attached media/);
  assert.doesNotMatch(text, /alt text/);
});

test("staged entries carry the platform, handle and niche the corpus validates on", () => {
  const post = toThreadsPost(textPost()) as ThreadsPost;
  const { entry } = stageEntry(post, { handle: "@buildsolo", creator: "Sam Builds", niche: "solopreneur", notes: "a note" });
  assert.equal(entry?.platform, "threads");
  assert.equal(entry?.handle, "@buildsolo");
  assert.equal(entry?.niche, "solopreneur");
  assert.equal(entry?.notes, "a note");
});

test("a follower count is read from the payload, and stays null when the payload has none", () => {
  const post = toThreadsPost(textPost({ user: { username: "buildsolo", full_name: "Sam Builds" } })) as ThreadsPost;
  const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur" });
  assert.equal(entry?.metrics.followers, null);
});

// ── The join to the corpus. A staged entry that `npm run patterns:collect` would reject is not a
// staged entry, so this runs the real validator rather than trusting the shape by eye.

test("every staged shape passes the real corpus validator", () => {
  const config = loadConfig();
  const nodes = [textPost(), carouselPost(), textPost({ code: "Cvid1", pk: "3", video_versions: [{ url: "v" }], video_duration: 20 })];
  for (const node of nodes) {
    const post = toThreadsPost(node) as ThreadsPost;
    const { entry } = stageEntry(post, { handle: "buildsolo", creator: "Sam Builds", niche: "solopreneur", slideDir: "/tmp/slides" });
    assert.ok(entry, `${node.code} should stage`);
    const { entry: validated, errors } = validateEntry(JSON.parse(JSON.stringify(entry)), config);
    assert.deepEqual(errors, [], `${node.code}: ${errors.join("; ")}`);
    assert.ok(validated);
    assert.equal(validated.platform, "threads");
    assert.equal(validated.media?.body_is_complete, entry.media.body_is_complete);
  }
});

test("threads is registered as a puller and stays out of the bare `npm run pull` sweep", () => {
  assert.equal(PULLERS.threads?.platform, "threads");
  assert.ok(!DEFAULT_PULL_PLATFORMS.includes("threads"));
  // The weekly analytics job runs the bare sweep, and it exists to refresh Muxin's own numbers.
  assert.deepEqual(DEFAULT_PULL_PLATFORMS, ["linkedin", "x", "substack"]);
});
