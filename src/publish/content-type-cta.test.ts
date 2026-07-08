/**
 * Unit tests for src/publish/cta.ts's content-type CTA routing (Smarter routing, card 6dcaee98).
 * A derivative is classified by CONTENT TYPE (frontmatter `content_type`, an array), not pillar;
 * these functions resolve the documented primary/(optional) secondary CTA(s) for each type from
 * config/content-types.yaml — `source` resolves to the essay link, `project` resolves ONLY to
 * this derivative's own `project_url` frontmatter (dropped if absent) — and stack CTAs from 2+
 * matched types instead of picking one winner. Pure functions: a ContentTypesConfig object +
 * frontmatter in, resolved CTA lines out. No file IO to mock (except the smoke test against the
 * real config).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveContentTypeCtas, resolveCtaLines, loadContentTypesConfig } from "./cta.js";
import type { CtaConfig } from "./cta.js";

const CFG: CtaConfig = {
  placement: { x: "reply", linkedin: "inline", bluesky: "inline" },
  fallbackUrl: "https://humaninference.substack.com",
  fallbackLabel: "More from me (free to subscribe):",
};

const CANONICAL = "https://example.com/essay";
const PROJECT = "https://example.com/my-project";

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
  test("loads all 8 documented content types", () => {
    const ctCfg = loadContentTypesConfig();
    for (const key of ALL_TYPE_KEYS) {
      assert.ok(ctCfg.types[key], `missing content type: ${key}`);
    }
  });
});

describe("resolveContentTypeCtas: a project-destination entry resolves to the derivative's OWN project_url", () => {
  const ctCfg = loadContentTypesConfig();

  const cases = [
    { type: "essay_excerpt", labels: ["Read full essay on Substack", "See related project"] },
    { type: "society_capitalism_piece", labels: ["Subscribe/read more", "Optional: explore projects"] },
    { type: "ai_agency_thesis", labels: ["Read full essay", "See what I'm building"] },
    { type: "personal_career_reflection", labels: ["Subscribe/follow", "Maybe: see my job-search project"] },
    { type: "product_builder_insight", labels: ["See how I think/work", "Read related essay"] },
    { type: "project_demo", labels: ["Explore the project"] },
    { type: "case_study", labels: ["See projects", "Read the essay behind it"] },
  ];

  for (const c of cases) {
    test(`${c.type}: emits primary + secondary exactly as documented when project_url is present`, () => {
      const { ctas } = resolveContentTypeCtas(
        { content_type: [c.type], project_url: PROJECT },
        CANONICAL,
        CFG,
        ctCfg
      );
      assert.deepEqual(
        ctas.map((r) => r.label),
        c.labels
      );
      const projectEntry = ctas.find((r) => r.url === PROJECT);
      assert.ok(projectEntry, `${c.type} should resolve its project entry to this derivative's project_url`);
    });
  }
});

describe("resolveContentTypeCtas: a project-destination entry is DROPPED (not defaulted) when project_url is absent", () => {
  const ctCfg = loadContentTypesConfig();

  const cases = [
    { type: "essay_excerpt", remaining: ["Read full essay on Substack"] },
    { type: "society_capitalism_piece", remaining: ["Subscribe/read more"] },
    { type: "ai_agency_thesis", remaining: ["Read full essay"] },
    { type: "personal_career_reflection", remaining: ["Subscribe/follow"] },
    { type: "product_builder_insight", remaining: ["Read related essay"] },
    { type: "case_study", remaining: ["Read the essay behind it"] },
  ];

  for (const c of cases) {
    test(`${c.type}: drops its project entry, keeps only the source entry, when no project_url is set`, () => {
      const { ctas } = resolveContentTypeCtas({ content_type: [c.type] }, CANONICAL, CFG, ctCfg);
      assert.deepEqual(ctas, [{ url: CANONICAL, label: c.remaining[0] }]);
    });
  }

  test("project_demo (project-only, no secondary) resolves to ZERO CTAs with no project_url", () => {
    const { ctas } = resolveContentTypeCtas({ content_type: ["project_demo"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(ctas, []);
  });
});

describe("resolveContentTypeCtas: project_demo and offer_adjacent_post's new single-entry shapes", () => {
  const ctCfg = loadContentTypesConfig();

  test("project_demo: exactly one CTA (the project link) when project_url is given", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["project_demo"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(ctas, [{ url: PROJECT, label: "Explore the project" }]);
  });

  test("project_demo: zero CTAs when project_url is absent", () => {
    const { ctas } = resolveContentTypeCtas({ content_type: ["project_demo"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(ctas, []);
  });

  test("offer_adjacent_post: always exactly one CTA (the source link), unconditionally", () => {
    const withoutProject = resolveContentTypeCtas({ content_type: ["offer_adjacent_post"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(withoutProject.ctas, [{ url: CANONICAL, label: "Read my thinking" }]);

    const withProject = resolveContentTypeCtas(
      { content_type: ["offer_adjacent_post"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(
      withProject.ctas,
      [{ url: CANONICAL, label: "Read my thinking" }],
      "offer_adjacent_post has no project-destination entry at all, so project_url must have no effect"
    );
  });
});

describe("resolveContentTypeCtas: multi-type stacking never picks one winner, with the new destinations", () => {
  const ctCfg = loadContentTypesConfig();

  test("a post matching 2+ content types stacks ALL applicable CTAs from every matched type (project_url present)", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["personal_career_reflection", "product_builder_insight"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Subscribe/follow", "Maybe: see my job-search project", "See how I think/work", "Read related essay"]
    );
  });

  test("a post matching 2+ content types drops every project entry, keeps every source entry, with no project_url", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["personal_career_reflection", "product_builder_insight"] },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Subscribe/follow", "Read related essay"]
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
    assert.deepEqual(ctas, [{ url: CANONICAL, label: "Read full essay on Substack" }]);
  });

  test("no explicit cta, content_type + project_url set: resolves both entries via content-type routing", () => {
    const { ctas } = resolveCtaLines(
      { content_type: ["essay_excerpt"], project_url: PROJECT },
      CANONICAL,
      CFG,
      "",
      ctCfg
    );
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
