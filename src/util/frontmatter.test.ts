import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFrontmatter } from "./frontmatter.js";

const DOC = "---\nplatform: x\nspin: true\n---\nHello body.\n";

test("splitFrontmatter parses fm, body, and the exact original header block", () => {
  const { fm, body, header } = splitFrontmatter(DOC);
  assert.equal(fm.platform, "x");
  assert.equal(fm.spin, true);
  assert.equal(body, "Hello body.");
  assert.equal(header, "---\nplatform: x\nspin: true\n---\n");
  // the header + body reconstruct the byte-preserving edit path serve.ts relies on
  assert.equal(header + body.trim() + "\n", DOC);
});

test("splitFrontmatter returns an empty header and fm when there is no frontmatter block", () => {
  const { fm, body, header } = splitFrontmatter("just plain text\n");
  assert.deepEqual(fm, {});
  assert.equal(body, "just plain text");
  assert.equal(header, "");
});

test("splitFrontmatter swallows a malformed YAML block instead of throwing (header is still exact)", () => {
  const bad = "---\nplatform: [unterminated\n---\nbody text\n";
  assert.doesNotThrow(() => splitFrontmatter(bad));
  const { fm, body, header } = splitFrontmatter(bad);
  assert.deepEqual(fm, {});
  assert.equal(body, "body text");
  assert.equal(header, "---\nplatform: [unterminated\n---\n");
});
