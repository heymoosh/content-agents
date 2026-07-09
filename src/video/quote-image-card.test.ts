import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  imagePromptPath,
  readImagePrompt,
  withImageOutPath,
  buildQuoteImageProps,
} from "./quote-image-card.js";

// Quote+image cards are a distinct asset from the typographic-only QuoteCard (render.ts's
// --still path stays untouched). These pure helpers own the new artifact's naming convention
// and prop-shaping so render.ts's --with-image wiring has no untested logic of its own.

function makeFolder(): string {
  return mkdtempSync(join(tmpdir(), "quote-image-card-test-"));
}

test("imagePromptPath points at a sibling derivatives/<name>-image-prompt.txt", () => {
  const folder = makeFolder();
  try {
    assert.equal(
      imagePromptPath(folder, "quote-card-1"),
      join(folder, "derivatives", "quote-card-1-image-prompt.txt")
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("readImagePrompt reads and trims the prompt file", () => {
  const folder = makeFolder();
  try {
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(
      join(folder, "derivatives", "quote-card-1-image-prompt.txt"),
      "  a flat editorial illustration of a lone figure at a keyboard  \n"
    );
    assert.equal(
      readImagePrompt(folder, "quote-card-1"),
      "a flat editorial illustration of a lone figure at a keyboard"
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("readImagePrompt throws a helpful error when the prompt file is missing", () => {
  const folder = makeFolder();
  try {
    assert.throws(() => readImagePrompt(folder, "quote-card-1"), /quote-card-1-image-prompt\.txt/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("readImagePrompt throws when the prompt file is empty", () => {
  const folder = makeFolder();
  try {
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "derivatives", "quote-card-1-image-prompt.txt"), "   \n");
    assert.throws(() => readImagePrompt(folder, "quote-card-1"), /empty/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("withImageOutPath names the composited PNG distinctly from the typographic card", () => {
  const folder = makeFolder();
  try {
    assert.equal(
      withImageOutPath(folder, "quote-card-1"),
      join(folder, "images", "quote-card-1-image.png")
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("buildQuoteImageProps carries the quote fields plus the relative image path", () => {
  const props = buildQuoteImageProps(
    { quote: "Ship the boring version first.", attribution: "Muxin Li", source: "On Shipping", accent: "#e2552f" },
    "job-abc123/bg.png"
  );
  assert.deepEqual(props, {
    quote: "Ship the boring version first.",
    attribution: "Muxin Li",
    source: "On Shipping",
    accent: "#e2552f",
    image: "job-abc123/bg.png",
  });
});

test("buildQuoteImageProps omits source when not given", () => {
  const props = buildQuoteImageProps(
    { quote: "Ship the boring version first.", attribution: "Muxin Li", accent: "#e2552f" },
    "job-abc123/bg.png"
  );
  assert.equal(props.source, undefined);
});
