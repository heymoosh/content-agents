import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveFileSource } from "./new-content.js";

// Outreach Phase 2 (docs/outreach-engine-plan.md §6): a locked outreach message must be a legal
// /atomize file source. new-content.ts's plain-file branch used to treat the WHOLE file
// (including any YAML frontmatter block) as source.md's body — harmless for a plain note, but a
// locked message DOES carry frontmatter (lead/channel/evidence/...), which would otherwise leak
// raw YAML into source.md and throw off source_lines line-number tracing. resolveFileSource
// strips it via the same splitFrontmatter() every other module in this repo uses.

describe("resolveFileSource: plain files (no frontmatter) keep their existing behavior", () => {
  test("uses the first heading as the title when present", () => {
    const out = resolveFileSource("notes/build-log.md", "# My Build Log\n\nSome body text.\n");
    assert.equal(out.title, "My Build Log");
    assert.equal(out.text, "# My Build Log\n\nSome body text.");
    assert.equal(out.origin, "file:build-log.md");
    assert.equal(out.sourceKind, undefined);
  });

  test("falls back to a filename-derived title when there's no heading", () => {
    const out = resolveFileSource("notes/idea-draft.md", "just some plain text, no heading");
    assert.equal(out.title, "idea draft");
    assert.equal(out.sourceKind, undefined);
  });
});

describe("resolveFileSource: a file with unrelated frontmatter strips it from the body", () => {
  test("body excludes the frontmatter block; not classified as an outreach message", () => {
    const raw = "---\nkind: something-else\n---\n\n# A Title\n\nBody text only.\n";
    const out = resolveFileSource("notes/other.md", raw);
    assert.ok(!out.text.includes("kind: something-else"));
    assert.equal(out.text, "# A Title\n\nBody text only.");
    assert.equal(out.title, "A Title");
    assert.equal(out.sourceKind, undefined);
  });
});

describe("resolveFileSource: a locked outreach message is recognized and stripped cleanly", () => {
  const raw =
    "---\nlead: client-posthog\nchannel: email\nevidence: [E1, E6]\nclassification: greenfield\n" +
    "status: locked\nlocked_at: 2026-07-10\n---\n\nHi PostHog team,\n\nThis is the message body.\n";

  test("strips the frontmatter block entirely from the source text", () => {
    const out = resolveFileSource("outreach/leads/client-posthog/messages/message-01.md", raw);
    assert.ok(!out.text.includes("lead: client-posthog"));
    assert.ok(!out.text.includes("---"));
    assert.equal(out.text, "Hi PostHog team,\n\nThis is the message body.");
  });

  test("tags sourceKind: outreach-message for tag-source / SKILL.md to key off", () => {
    const out = resolveFileSource("outreach/leads/client-posthog/messages/message-01.md", raw);
    assert.equal(out.sourceKind, "outreach-message");
  });

  test("derives a legible title naming the lead, since message bodies have no heading", () => {
    const out = resolveFileSource("outreach/leads/client-posthog/messages/message-01.md", raw);
    assert.equal(out.title, "Outreach message: client-posthog");
  });

  test("origin still marks it as a file source, same convention as any other file", () => {
    const out = resolveFileSource("outreach/leads/client-posthog/messages/message-01.md", raw);
    assert.equal(out.origin, "file:message-01.md");
  });
});
