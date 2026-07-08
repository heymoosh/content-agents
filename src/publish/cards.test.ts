import { test } from "node:test";
import assert from "node:assert/strict";
import { basePlatform, cardTarget, planGroups, alreadyLoggedGroup } from "./cards.js";
import type { CtaConfig } from "./cta.js";

// The per-platform card model (Muxin, 2026-07-03): a card row is `quote-card:<target>` — one card
// image shared across platforms, each with its OWN spun context caption so a quote never ships out
// of context. basePlatform + cardTarget decode the row's platform column.

test("basePlatform strips the colon subtype so cards.ts still owns the row", () => {
  assert.equal(basePlatform("quote-card:x"), "quote-card");
  assert.equal(basePlatform("quote-card"), "quote-card");
  assert.equal(basePlatform("community:democratic-resilience"), "community");
  assert.equal(basePlatform("x"), "x");
});

test("cardTarget returns the destination platform, or null for a legacy fan-out row", () => {
  assert.equal(cardTarget("quote-card:x"), "x");
  assert.equal(cardTarget("quote-card:linkedin"), "linkedin");
  assert.equal(cardTarget("quote-card:bluesky"), "bluesky");
  assert.equal(cardTarget("quote-card"), null); // legacy: fan out to every account
  assert.equal(cardTarget("quote-card:"), null); // empty suffix → treat as legacy, not a "" platform
});

// The caption that flows to the post is the CONTEXT body; the CTA link is placed per cta.yaml —
// inline on inline platforms, omitted where placement is `reply` (X) since the relay can't reply.
const cfg = { placement: { bluesky: "inline", x: "reply", linkedin: "comment" } } as unknown as CtaConfig;

test("planGroups keeps the link inline on inline platforms and omits it on reply platforms", () => {
  const caption = "We don't need rigged rules to get extreme inequality.";
  const groups = planGroups(
    caption,
    [{ platform: "bluesky" }, { platform: "twitter" }], // twitter normalizes to the x key → reply
    "https://example.com/essay",
    "Full essay:",
    cfg
  );
  const withLink = groups.find((g) => g.caption.includes("https://example.com/essay"));
  const noLink = groups.find((g) => g.caption === caption);
  assert.ok(withLink, "an inline platform gets the link appended to the context caption");
  assert.ok(noLink, "a reply platform (X) gets the bare context caption, no link");
  assert.deepEqual(withLink!.targets.map((t) => t.platform), ["bluesky"]);
  assert.deepEqual(noLink!.targets.map((t) => t.platform), ["twitter"]);
});

test("planGroups with no CTA is a single group carrying the bare context caption", () => {
  const caption = "Even in a perfectly fair economy, wealth begets more wealth.";
  const groups = planGroups(caption, [{ platform: "bluesky" }], null, "", cfg);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].caption, caption); // exactly the context — this is the analytics match key
});

// R1 idempotency (docs/codebase-review.md Part 2): publishCards posts a row's targets in GROUPS
// (inline-link group + no-link group). If group 1 posts+logs but group 2 then THROWS, the row stays
// `approve`, so the NEXT /publish re-enters the loop. Without a per-group guard it would RE-POST the
// already-successful group 1 — a real duplicate public post. alreadyLoggedGroup parses cards.ts's own
// publish-log line shape and returns the logged ref for an EXACT row+dest match so the loop can skip
// re-posting while still collecting that ref for refs/appendBetPlacement.
const SAMPLE_LOG = [
  "# Publish log",
  "",
  "- 2026-07-06T18:00:00.000Z — card-1 → postpeer post 12345 [bluesky+linkedin +link] (scheduled 2026-07-08T18:00:00.000Z)",
  "",
].join("\n");

test("alreadyLoggedGroup finds the logged ref for the exact row+dest", () => {
  assert.equal(alreadyLoggedGroup(SAMPLE_LOG, "card-1", "bluesky+linkedin"), "post 12345");
});

test("alreadyLoggedGroup returns null for a different dest on the same row (that group must still post)", () => {
  // The no-link group (X/twitter) was NOT logged — treating it as posted would silently drop the post.
  assert.equal(alreadyLoggedGroup(SAMPLE_LOG, "card-1", "twitter"), null);
});

test("alreadyLoggedGroup requires an EXACT platform-set match, not a subset", () => {
  // A single-platform dest must not match a logged multi-platform group, or we'd wrongly skip and
  // drop the post for whichever platform the logged group did NOT cover.
  assert.equal(alreadyLoggedGroup(SAMPLE_LOG, "card-1", "bluesky"), null);
  assert.equal(alreadyLoggedGroup(SAMPLE_LOG, "card-1", "linkedin"), null);
});

test("alreadyLoggedGroup returns null for a row with no log entries (and for empty log text)", () => {
  assert.equal(alreadyLoggedGroup(SAMPLE_LOG, "card-2", "bluesky+linkedin"), null);
  assert.equal(alreadyLoggedGroup("", "card-1", "bluesky+linkedin"), null);
});

test("alreadyLoggedGroup handles the no-link bracket (no ` +link`) and multiple logged groups", () => {
  const log = [
    "# Publish log",
    "",
    "- 2026-07-06T18:00:00.000Z — card-1 → postpeer post 12345 [bluesky+linkedin +link] (scheduled 2026-07-08T18:00:00.000Z)",
    "- 2026-07-06T18:00:01.000Z — card-1 → postpeer post 67890 [twitter] (scheduled 2026-07-08T19:00:00.000Z)",
    "",
  ].join("\n");
  assert.equal(alreadyLoggedGroup(log, "card-1", "bluesky+linkedin"), "post 12345");
  assert.equal(alreadyLoggedGroup(log, "card-1", "twitter"), "post 67890");
});

test("alreadyLoggedGroup mirrors the loop's partial-failure state: group 1 skip, group 2 post", () => {
  // Simulate a prior run that posted+logged the inline-link group then threw before the X group.
  // dest is computed exactly the way publishCards's loop computes it.
  const withLinkTargets = [{ platform: "bluesky" }, { platform: "linkedin" }];
  const noLinkTargets = [{ platform: "twitter" }];
  const destOf = (ts: { platform: string }[]) => ts.map((t) => t.platform).join("+");
  const priorLog = [
    "# Publish log",
    "",
    `- 2026-07-06T18:00:00.000Z — card-1 → postpeer post 12345 [${destOf(withLinkTargets)} +link] (scheduled 2026-07-08T18:00:00.000Z)`,
    "",
  ].join("\n");
  // group 1: already logged → loop reuses this ref, must NOT call the provider again (no duplicate)
  assert.equal(alreadyLoggedGroup(priorLog, "card-1", destOf(withLinkTargets)), "post 12345");
  // group 2: not logged → loop MUST still post it (no silent drop)
  assert.equal(alreadyLoggedGroup(priorLog, "card-1", destOf(noLinkTargets)), null);
});

test("alreadyLoggedGroup keys on the row id, not another row's identical dest", () => {
  const log = [
    "# Publish log",
    "",
    "- 2026-07-06T18:00:00.000Z — card-1 → postpeer post 12345 [bluesky+linkedin +link] (scheduled 2026-07-08T18:00:00.000Z)",
    "",
  ].join("\n");
  assert.equal(alreadyLoggedGroup(log, "card-9", "bluesky+linkedin"), null);
});
