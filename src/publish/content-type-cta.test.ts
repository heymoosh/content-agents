/**
 * Unit tests for src/publish/cta.ts's content-type CTA routing (Smarter routing, card 6dcaee98).
 * A derivative is classified by CONTENT TYPE (frontmatter `content_type`, an array), not pillar;
 * these functions resolve the documented primary/secondary CTA(s) for each type from
 * config/content-types.yaml, applying the landing-page downgrade until `landing_page_live: true`,
 * and stack CTAs from 2+ matched types instead of picking one winner. Pure functions: a
 * ContentTypesConfig object + frontmatter in, resolved CTA lines out. No file IO to mock (except
 * the smoke test against the real config).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveContentTypeCtas,
  resolveCtaLines,
  loadContentTypesConfig,
  type ContentTypesConfig,
} from "./cta.js";
import type { CtaConfig } from "./cta.js";

const CFG: CtaConfig = {
  placement: { x: "reply", linkedin: "inline", bluesky: "inline" },
  fallbackUrl: "https://humaninference.substack.com",
  fallbackLabel: "More from me (free to subscribe):",
};

const CANONICAL = "https://example.com/essay";

const ALL_TYPE_KEYS = [
  "essay_excerpt",
  "society_capitalism_piece",
  "ai_agency_thesis",
  "personal_career_reflection",
  "product_builder_insight",
  "project_demo",
  "offer_adjacent_post",
  "case_study",
];

describe("loadContentTypesConfig: smoke test against the real config/content-types.yaml", () => {
  test("loads all 8 documented content types, landing_page_live defaults to false", () => {
    const ctCfg = loadContentTypesConfig();
    assert.equal(ctCfg.landingPageLive, false);
    for (const key of ALL_TYPE_KEYS) {
      assert.ok(ctCfg.types[key], `missing content type: ${key}`);
    }
  });
});

describe("resolveContentTypeCtas: the 4 types that ship as-is (primary already Substack, no downgrade)", () => {
  const ctCfg = loadContentTypesConfig();

  const cases = [
    { type: "essay_excerpt", primary: "Read full essay on Substack", secondary: "See related project" },
    { type: "society_capitalism_piece", primary: "Subscribe/read more", secondary: "Optional: explore projects" },
    { type: "ai_agency_thesis", primary: "Read full essay", secondary: "See what I'm building" },
    {
      type: "personal_career_reflection",
      primary: "Subscribe/follow",
      secondary: "Maybe: see my job-search project",
    },
  ];

  for (const c of cases) {
    test(`${c.type}: emits primary + secondary exactly as documented`, () => {
      const { ctas } = resolveContentTypeCtas({ content_type: [c.type] }, CANONICAL, CFG, ctCfg);
      assert.deepEqual(
        ctas.map((r) => r.label),
        [c.primary, c.secondary]
      );
      assert.ok(
        ctas.every((r) => typeof r.url === "string" && r.url.length > 0),
        "every resolved CTA must have a real (Substack-reachable) url even pre-landing-page"
      );
    });
  }
});

describe("resolveContentTypeCtas: the 4 types whose primary is downgraded to their secondary (landing page not live)", () => {
  const ctCfg = loadContentTypesConfig();

  const cases = [
    { type: "product_builder_insight", secondary: "Read related essay" },
    { type: "project_demo", secondary: "Work with me" },
    { type: "offer_adjacent_post", secondary: "Read my thinking" },
    { type: "case_study", secondary: "Read the essay behind it" },
  ];

  for (const c of cases) {
    test(`${c.type}: ships ONLY the documented secondary as the sole CTA, not the landing-page primary`, () => {
      const { ctas } = resolveContentTypeCtas({ content_type: [c.type] }, CANONICAL, CFG, ctCfg);
      assert.equal(ctas.length, 1, "the landing-page primary must not ship until landing_page_live");
      assert.equal(ctas[0].label, c.secondary);
      assert.ok(
        typeof ctas[0].url === "string" && ctas[0].url.length > 0,
        "the downgraded CTA must still resolve to a real Substack-reachable url"
      );
    });
  }
});

describe("resolveContentTypeCtas: flipping landing_page_live restores the original primary", () => {
  const ctCfg = loadContentTypesConfig();
  const live: ContentTypesConfig = { ...ctCfg, landingPageLive: true };

  test("product_builder_insight regains its documented primary once landing_page_live: true", () => {
    const { ctas } = resolveContentTypeCtas({ content_type: ["product_builder_insight"] }, CANONICAL, CFG, live);
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["See how I think/work", "Read related essay"]
    );
  });

  test("project_demo regains its documented primary once landing_page_live: true", () => {
    const { ctas } = resolveContentTypeCtas({ content_type: ["project_demo"] }, CANONICAL, CFG, live);
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Explore the project", "Work with me"]
    );
  });

  test("essay_excerpt (ships-as-is group) is unaffected by the flag: still primary + secondary", () => {
    const { ctas } = resolveContentTypeCtas({ content_type: ["essay_excerpt"] }, CANONICAL, CFG, live);
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Read full essay on Substack", "See related project"]
    );
  });
});

describe("resolveContentTypeCtas: multi-type stacking never picks one winner", () => {
  const ctCfg = loadContentTypesConfig();

  test("a post matching 2+ content types stacks ALL applicable CTAs from every matched type", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["personal_career_reflection", "product_builder_insight"] },
      CANONICAL,
      CFG,
      ctCfg
    );
    // personal_career_reflection ships both (primary+secondary, ships-as-is);
    // product_builder_insight is downgraded to its secondary alone (landing page not live).
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Subscribe/follow", "Maybe: see my job-search project", "Read related essay"]
    );
  });
});

describe("resolveContentTypeCtas: an unrecognized content_type key warns instead of failing silently", () => {
  const ctCfg = loadContentTypesConfig();

  test("unknown key resolves to no CTA lines (not a throw), and logs a warning", () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);
    try {
      const { ctas } = resolveContentTypeCtas({ content_type: ["not_a_real_type"] }, CANONICAL, CFG, ctCfg);
      assert.deepEqual(ctas, []);
      assert.ok(
        warnings.some((w) => w.includes("not_a_real_type")),
        "expected a warning naming the unrecognized content_type key"
      );
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("resolveCtaLines: the top-level entry point publishers call", () => {
  const ctCfg = loadContentTypesConfig();

  test("explicit frontmatter cta still wins over content_type (backward-compatible override)", () => {
    const { ctas } = resolveCtaLines(
      { cta: "https://voter-choice.vercel.app/", cta_label: "Vote:", content_type: ["essay_excerpt"] },
      CANONICAL,
      CFG,
      "",
      ctCfg
    );
    assert.deepEqual(ctas, [{ url: "https://voter-choice.vercel.app/", label: "Vote:" }]);
  });

  test("no explicit cta, content_type set: resolves via content-type routing", () => {
    const { ctas } = resolveCtaLines({ content_type: ["essay_excerpt"] }, CANONICAL, CFG, "", ctCfg);
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Read full essay on Substack", "See related project"]
    );
  });

  test("no explicit cta, no content_type: no link (legacy empty-cta behavior unchanged)", () => {
    const { ctas } = resolveCtaLines({}, CANONICAL, CFG, "", ctCfg);
    assert.deepEqual(ctas, []);
  });

  test("cta: none still means no link even with a content_type set", () => {
    const { ctas } = resolveCtaLines({ cta: "none", content_type: ["essay_excerpt"] }, CANONICAL, CFG, "", ctCfg);
    assert.deepEqual(ctas, []);
  });
});
