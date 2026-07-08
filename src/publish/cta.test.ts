/**
 * Unit tests for src/publish/cta.ts resolveCta + appendCtaLine — the shared funnel layer that
 * decides which CTA link (if any) a post gets. Pure functions: a CtaConfig object + frontmatter
 * in, a resolved url/label out. No file IO to mock.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveCta, appendCtaLine, loadCtaConfig, type CtaConfig } from "./cta.js";

const CFG: CtaConfig = {
  placement: { x: "reply", linkedin: "inline", bluesky: "inline" },
  fallbackUrl: "https://humaninference.substack.com",
  fallbackLabel: "More from me (free to subscribe):",
};

const CFG_NO_FALLBACK: CtaConfig = { placement: {}, fallbackUrl: null, fallbackLabel: "" };

describe("resolveCta: table-driven", () => {
  const cases: {
    name: string;
    fm: Record<string, unknown>;
    canonicalUrl: string | null;
    cfg: CtaConfig;
    sourceKind?: string;
    expected: { url: string | null; label: string; usedFallback: boolean };
  }[] = [
    {
      name: "no cta, essay (non-note): no link",
      fm: {},
      canonicalUrl: "https://example.com/essay",
      cfg: CFG,
      expected: { url: null, label: "", usedFallback: false },
    },
    {
      name: "cta: none: no link even with a canonical url",
      fm: { cta: "none" },
      canonicalUrl: "https://example.com/essay",
      cfg: CFG,
      expected: { url: null, label: "", usedFallback: false },
    },
    {
      name: "cta: source with a canonical url: resolves to that url",
      fm: { cta: "source", cta_label: "Full essay:" },
      canonicalUrl: "https://example.com/essay",
      cfg: CFG,
      expected: { url: "https://example.com/essay", label: "Full essay:", usedFallback: false },
    },
    {
      name: "cta: source with no canonical url: falls back to the configured homepage",
      fm: { cta: "source" },
      canonicalUrl: null,
      cfg: CFG,
      expected: { url: CFG.fallbackUrl, label: CFG.fallbackLabel, usedFallback: true },
    },
    {
      name: "cta: source with no canonical url and no configured fallback: no link",
      fm: { cta: "source" },
      canonicalUrl: null,
      cfg: CFG_NO_FALLBACK,
      expected: { url: null, label: "", usedFallback: false },
    },
    {
      name: "literal url cta: used verbatim, own label kept",
      fm: { cta: "https://voter-choice.vercel.app/", cta_label: "See where your reps stand:" },
      canonicalUrl: "https://example.com/essay",
      cfg: CFG,
      expected: {
        url: "https://voter-choice.vercel.app/",
        label: "See where your reps stand:",
        usedFallback: false,
      },
    },
    {
      name: "substack-note, empty cta: upgraded default to source (the note's own canonical url)",
      fm: {},
      canonicalUrl: "https://example.com/note-1",
      cfg: CFG,
      sourceKind: "substack-note",
      expected: { url: "https://example.com/note-1", label: "", usedFallback: false },
    },
    {
      name: "substack-note, explicit cta: none: explicit wins over the note default",
      fm: { cta: "none" },
      canonicalUrl: "https://example.com/note-1",
      cfg: CFG,
      sourceKind: "substack-note",
      expected: { url: null, label: "", usedFallback: false },
    },
    {
      name: "substack-note, explicit literal url: explicit wins over the note default",
      fm: { cta: "https://example.com/elsewhere" },
      canonicalUrl: "https://example.com/note-1",
      cfg: CFG,
      sourceKind: "substack-note",
      expected: { url: "https://example.com/elsewhere", label: "", usedFallback: false },
    },
    {
      name: "non-note content is unaffected by the note-default upgrade even with no cta",
      fm: {},
      canonicalUrl: "https://example.com/note-1",
      cfg: CFG,
      sourceKind: "",
      expected: { url: null, label: "", usedFallback: false },
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const result = resolveCta(c.fm, c.canonicalUrl, c.cfg, c.sourceKind);
      assert.deepEqual(result, c.expected);
    });
  }
});

describe("appendCtaLine", () => {
  test("null url leaves the body unchanged", () => {
    assert.equal(appendCtaLine("body text", null, "label"), "body text");
  });

  test("url + label appended as one trimmed line", () => {
    assert.equal(
      appendCtaLine("body text", "https://example.com", "Read more:"),
      "body text\n\nRead more: https://example.com"
    );
  });

  test("url with no label appends just the url (no leading space)", () => {
    assert.equal(appendCtaLine("body text", "https://example.com", ""), "body text\n\nhttps://example.com");
  });
});

describe("loadCtaConfig: smoke test against the real config/cta.yaml", () => {
  test("loads placement rules and a source fallback from the real config", () => {
    const cfg = loadCtaConfig();
    assert.equal(cfg.placement.x, "reply");
    assert.equal(cfg.placement.linkedin, "inline");
    assert.ok(cfg.fallbackUrl, "source_fallback.url should be set in the real config");
  });
});
