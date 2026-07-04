import { test } from "node:test";
import assert from "node:assert/strict";
import { revisePrompt, classifySource } from "./serve.js";

// "Revise with Claude" (Muxin, 2026-07-03): the GUI shells out to headless `claude -p` to edit one
// derivative in place. The prompt is the only guardrail against Claude wandering — these lock it in.

test("revisePrompt scopes to one file and carries the extraction-first + voice guardrails", () => {
  const p = revisePrompt("2026-06-16-foo", "x-1", "x", "make it punchier");
  assert.match(p, /content\/2026-06-16-foo\/derivatives\/x-1\.md/); // the exact file, nothing else
  assert.match(p, /make it punchier/); // Muxin's instruction is included
  assert.match(p, /Edit ONLY that one file/);
  assert.match(p, /frontmatter/); // preserve frontmatter
  assert.match(p, /source\.md/); // extraction-first traceability
  assert.match(p, /voice\.yaml/); // no em dashes / AI tells
  assert.ok(!/quote-card CAPTION/.test(p), "x-1 is not a card caption");
});

test("revisePrompt adds the context-only rule only for a quote-card caption id", () => {
  const caption = revisePrompt("2026-06-16-foo", "quote-card-2-linkedin", "linkedin", "tighten it");
  assert.match(caption, /quote-card CAPTION/);
  assert.match(caption, /context-only/);

  // the card DEFINITION derivative (quote-card-2, the quote itself) is not a caption
  const def = revisePrompt("2026-06-16-foo", "quote-card-2", "quote-card", "x");
  assert.ok(!/quote-card CAPTION/.test(def));
});

// "Add / Queue" tab (Muxin, 2026-07-03): the GUI is the front door now. A raw source string is
// routed to /atomize as a url, a real file path, or pasted text — this decides which.
test("classifySource routes urls, existing files, and pasted text", () => {
  assert.equal(classifySource("https://x.substack.com/p/post").kind, "url");

  const file = classifySource("/vault/My Note.md", (p) => p === "/vault/My Note.md");
  assert.equal(file.kind, "file");
  assert.equal(file.arg, "/vault/My Note.md");
  assert.equal(file.label, "My Note.md");

  const text = classifySource("# An Idea\nsome body that isn't a path", () => false);
  assert.equal(text.kind, "text");
  assert.equal(text.label, "An Idea"); // title from the first heading, hash stripped

  // a path-looking string that doesn't resolve is pasted text, not a phantom file
  assert.equal(classifySource("/nope/missing.md", () => false).kind, "text");
});
