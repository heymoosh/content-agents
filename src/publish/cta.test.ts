/**
 * Unit tests for src/publish/cta.ts resolveCta — the shared funnel layer that decides which CTA
 * link (if any) a post gets. Pure functions: a CtaConfig object + frontmatter in, a resolved
 * url/label out. No file IO to mock.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCta,
  loadCtaConfig,
  resolveContentTypeCtas,
  loadContentTypesConfig,
  type CtaConfig,
  type ContentTypesConfig,
} from "./cta.js";

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
      name: "substack-note, empty cta: no link",
      fm: {},
      canonicalUrl: "https://example.com/note-1",
      cfg: CFG,
      sourceKind: "substack-note",
      expected: { url: null, label: "", usedFallback: false },
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
      name: "substack-note, explicit literal non-source url remains available",
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


describe("loadCtaConfig: smoke test against the real config/cta.yaml", () => {
  test("loads placement rules without a generic homepage fallback", () => {
    const cfg = loadCtaConfig();
    assert.equal(cfg.placement.x, "reply");
    assert.equal(cfg.placement.linkedin, "inline");
    assert.equal(cfg.fallbackUrl, null);
  });
});

// Card d2746598 (resumes c02ff4aa): a per-post `cta_label` now overrides the work_with_me-
// destination CTA's text specifically, so a "work"-flavored derivative can carry a tactical,
// source-topic-tied CTA instead of the generic canned "Connect on LinkedIn" every such post got
// before. source/project entries are untouched either way -- this override targets only the
// connect-for-work ask.
describe("resolveContentTypeCtas: per-post cta_label overrides only the work_with_me entry's text", () => {
  const CT_CFG: ContentTypesConfig = {
    workWithMeUrl: "https://www.linkedin.com/in/muxinli",
    types: {
      // secondary is work_with_me (mirrors product_builder_insight/project_demo/case_study).
      product_builder_insight: {
        primary: { text: "See how I think/work", destination: "project" },
        secondary: { text: "Connect on LinkedIn", destination: "work_with_me" },
      },
      // primary IS work_with_me, no secondary (mirrors offer_adjacent_post).
      offer_adjacent_post: {
        primary: { text: "Connect on LinkedIn", destination: "work_with_me" },
      },
      // no work_with_me destination at all (mirrors essay_excerpt).
      essay_excerpt: {
        primary: { text: "Read full essay on Substack", destination: "source" },
        secondary: { text: "See related project", destination: "project" },
      },
    },
  };

  test("no cta_label: the work_with_me entry keeps its generic config text (unchanged, backward compatible)", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["product_builder_insight"], project_url: "https://example.com/project" },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    const workLine = ctas.find((c) => c.url === CT_CFG.workWithMeUrl);
    assert.equal(workLine?.label, "Connect on LinkedIn");
  });

  test("cta_label set: overrides the work_with_me entry's label (secondary position)", () => {
    const { ctas } = resolveContentTypeCtas(
      {
        content_type: ["product_builder_insight"],
        project_url: "https://example.com/project",
        cta_label: "Ask your team what assumption nobody's tested this quarter.",
      },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    const workLine = ctas.find((c) => c.url === CT_CFG.workWithMeUrl);
    const projectLine = ctas.find((c) => c.url === "https://example.com/project");
    assert.equal(workLine?.label, "Ask your team what assumption nobody's tested this quarter.");
    // The project entry's own config text is untouched -- the override targets work_with_me only.
    assert.equal(projectLine?.label, "See how I think/work");
  });

  test("cta_label set: overrides the work_with_me entry's label (primary position)", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["offer_adjacent_post"], cta_label: "Try this on your own roadmap first." },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    assert.equal(ctas.length, 1);
    assert.equal(ctas[0].label, "Try this on your own roadmap first.");
  });

  test("cta_label set but content_type has no work_with_me entry: ignored entirely, config text stays", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["essay_excerpt"], project_url: "https://example.com/project", cta_label: "Some tactical line" },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    assert.equal(ctas.find((c) => c.label === "Read full essay on Substack")?.label, "Read full essay on Substack");
    assert.equal(ctas.find((c) => c.label === "See related project")?.label, "See related project");
    assert.ok(!ctas.some((c) => c.label === "Some tactical line"));
  });

  test("cta_label set: applies the same override to every stacked work_with_me line (two work-flavored types)", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["product_builder_insight", "offer_adjacent_post"], cta_label: "One tactical ask." },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    const workLines = ctas.filter((c) => c.url === CT_CFG.workWithMeUrl);
    assert.equal(workLines.length, 2);
    assert.ok(workLines.every((l) => l.label === "One tactical ask."));
  });

  test("whitespace-only cta_label is treated as unset, same as omitted", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["offer_adjacent_post"], cta_label: "   " },
      "https://example.com/essay",
      CFG,
      CT_CFG
    );
    assert.equal(ctas[0].label, "Connect on LinkedIn");
  });
});

describe("resolveContentTypeCtas + loadContentTypesConfig: smoke test against the real config/content-types.yaml", () => {
  test("a tactical cta_label overrides the real product_builder_insight type's work_with_me line", () => {
    const ctCfg = loadContentTypesConfig();
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["product_builder_insight"], cta_label: "A real tactical takeaway." },
      "https://example.com/essay",
      loadCtaConfig(),
      ctCfg
    );
    const workLine = ctas.find((c) => c.url === ctCfg.workWithMeUrl);
    assert.equal(workLine?.label, "A real tactical takeaway.");
  });
});
