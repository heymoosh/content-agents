import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFrontmatter } from "./frontmatter.js";

const DOC = "---\nplatform: x\nspin: true\n---\nHello body.\n";

test("splitFrontmatter parses fm and body without the raw option", () => {
  const { fm, body } = splitFrontmatter(DOC);
  assert.equal(fm.platform, "x");
  assert.equal(fm.spin, true);
  assert.equal(body, "Hello body.");
  assert.equal((splitFrontmatter(DOC) as { header?: string }).header, undefined);
});

test("splitFrontmatter with { raw: true } also returns the exact original header block", () => {
  const { fm, body, header } = splitFrontmatter(DOC, { raw: true });
  assert.equal(fm.platform, "x");
  assert.equal(body, "Hello body.");
  assert.equal(header, "---\nplatform: x\nspin: true\n---\n");
  // the header + body reconstruct the byte-preserving edit path serve.ts relies on
  assert.equal(header + body.trim() + "\n", DOC);
});

test("splitFrontmatter with { raw: true } returns an empty header when there is no frontmatter block", () => {
  const { fm, body, header } = splitFrontmatter("just plain text\n", { raw: true });
  assert.deepEqual(fm, {});
  assert.equal(body, "just plain text");
  assert.equal(header, "");
});

test("splitFrontmatter swallows a malformed YAML block instead of throwing", () => {
  const bad = "---\nplatform: [unterminated\n---\nbody text\n";
  assert.doesNotThrow(() => splitFrontmatter(bad, { raw: true }));
  const { fm, body, header } = splitFrontmatter(bad, { raw: true });
  assert.deepEqual(fm, {});
  assert.equal(body, "body text");
  assert.equal(header, "---\nplatform: [unterminated\n---\n");
});
