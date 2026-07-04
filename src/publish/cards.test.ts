import { test } from "node:test";
import assert from "node:assert/strict";
import { basePlatform, cardTarget, planGroups } from "./cards.js";
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
