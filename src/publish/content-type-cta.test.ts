/**
 * Unit tests for src/publish/cta.ts's content-type CTA routing (Smarter routing, card 6dcaee98).
 * A derivative is classified by CONTENT TYPE (frontmatter `content_type`, an array), not pillar;
 * these functions resolve the documented primary/(optional) secondary CTA(s) for each type from
 * config/content-types.yaml — `source` resolves to the essay link, `project` resolves ONLY to
 * this derivative's own `project_url` frontmatter (dropped if absent, and only ever set when
 * genuinely relevant to that post — never just because the content type matched), and
 * `work_with_me` resolves to a fixed config-level url (Muxin's LinkedIn profile, standing in for
 * the not-yet-built work-with-me landing page) — and stack CTAs from 2+ matched types instead of
 * picking one winner. Pure functions: a ContentTypesConfig object + frontmatter in, resolved CTA
 * lines out. No file IO to mock (except the smoke test against the real config).
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
const LINKEDIN = "https://www.linkedin.com/in/muxinli";

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
  test("loads all 8 documented content types + the work_with_me_url", () => {
    const ctCfg = loadContentTypesConfig();
    for (const key of ALL_TYPE_KEYS) {
      assert.ok(ctCfg.types[key], `missing content type: ${key}`);
    }
    assert.equal(ctCfg.workWithMeUrl, LINKEDIN);
  });
});

describe("resolveContentTypeCtas: a project-destination entry resolves to the derivative's OWN project_url", () => {
  const ctCfg = loadContentTypesConfig();

  const cases = [
    { type: "essay_excerpt", labels: ["Read full essay on Substack", "See related project"] },
    { type: "society_capitalism_piece", labels: ["Subscribe/read more", "Optional: explore projects"] },
    { type: "ai_agency_thesis", labels: ["Read full essay", "See what I'm building"] },
    { type: "personal_career_reflection", labels: ["Subscribe/follow", "Maybe: see my job-search project"] },
    { type: "product_builder_insight", labels: ["See how I think/work", "Connect on LinkedIn"] },
    { type: "project_demo", labels: ["Explore the project", "Connect on LinkedIn"] },
    { type: "case_study", labels: ["See projects", "Connect on LinkedIn"] },
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
    { type: "essay_excerpt", remaining: [{ label: "Read full essay on Substack", url: CANONICAL }] },
    { type: "society_capitalism_piece", remaining: [{ label: "Subscribe/read more", url: CANONICAL }] },
    { type: "ai_agency_thesis", remaining: [{ label: "Read full essay", url: CANONICAL }] },
    { type: "personal_career_reflection", remaining: [{ label: "Subscribe/follow", url: CANONICAL }] },
    { type: "product_builder_insight", remaining: [{ label: "Connect on LinkedIn", url: LINKEDIN }] },
    { type: "project_demo", remaining: [{ label: "Connect on LinkedIn", url: LINKEDIN }] },
    { type: "case_study", remaining: [{ label: "Connect on LinkedIn", url: LINKEDIN }] },
  ];

  for (const c of cases) {
    test(`${c.type}: drops its project entry, keeps only the non-project entry, when no project_url is set`, () => {
      const { ctas } = resolveContentTypeCtas({ content_type: [c.type] }, CANONICAL, CFG, ctCfg);
      assert.deepEqual(ctas, c.remaining);
    });
  }
});

describe("resolveContentTypeCtas: the 4 work-flavored types stand in with LinkedIn, never an essay-link fallback", () => {
  const ctCfg = loadContentTypesConfig();

  test("product_builder_insight: project + LinkedIn when project_url is given; LinkedIn alone when it's not", () => {
    const withProject = resolveContentTypeCtas(
      { content_type: ["product_builder_insight"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(withProject.ctas, [
      { url: PROJECT, label: "See how I think/work" },
      { url: LINKEDIN, label: "Connect on LinkedIn" },
    ]);

    const withoutProject = resolveContentTypeCtas({ content_type: ["product_builder_insight"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(withoutProject.ctas, [{ url: LINKEDIN, label: "Connect on LinkedIn" }]);
  });

  test("project_demo: project + LinkedIn when project_url is given; LinkedIn alone when it's not (never zero CTAs)", () => {
    const withProject = resolveContentTypeCtas(
      { content_type: ["project_demo"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(withProject.ctas, [
      { url: PROJECT, label: "Explore the project" },
      { url: LINKEDIN, label: "Connect on LinkedIn" },
    ]);

    const withoutProject = resolveContentTypeCtas({ content_type: ["project_demo"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(withoutProject.ctas, [{ url: LINKEDIN, label: "Connect on LinkedIn" }]);
  });

  test("offer_adjacent_post: always exactly one CTA (Connect on LinkedIn), unconditionally", () => {
    const withoutProject = resolveContentTypeCtas({ content_type: ["offer_adjacent_post"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(withoutProject.ctas, [{ url: LINKEDIN, label: "Connect on LinkedIn" }]);

    const withProject = resolveContentTypeCtas(
      { content_type: ["offer_adjacent_post"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(
      withProject.ctas,
      [{ url: LINKEDIN, label: "Connect on LinkedIn" }],
      "offer_adjacent_post has no project-destination entry at all, so project_url must have no effect"
    );
  });

  test("case_study: project + LinkedIn when project_url is given; LinkedIn alone when it's not", () => {
    const withProject = resolveContentTypeCtas(
      { content_type: ["case_study"], project_url: PROJECT },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(withProject.ctas, [
      { url: PROJECT, label: "See projects" },
      { url: LINKEDIN, label: "Connect on LinkedIn" },
    ]);

    const withoutProject = resolveContentTypeCtas({ content_type: ["case_study"] }, CANONICAL, CFG, ctCfg);
    assert.deepEqual(withoutProject.ctas, [{ url: LINKEDIN, label: "Connect on LinkedIn" }]);
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
      ["Subscribe/follow", "Maybe: see my job-search project", "See how I think/work", "Connect on LinkedIn"]
    );
  });

  test("a post matching 2+ content types drops every project entry, never an essay fallback for the work-flavored type", () => {
    const { ctas } = resolveContentTypeCtas(
      { content_type: ["personal_career_reflection", "product_builder_insight"] },
      CANONICAL,
      CFG,
      ctCfg
    );
    assert.deepEqual(
      ctas.map((r) => r.label),
      ["Subscribe/follow", "Connect on LinkedIn"]
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

  test("no explicit cta, work-flavored content_type set: resolves to LinkedIn, never the essay link", () => {
    const { ctas } = resolveCtaLines({ content_type: ["offer_adjacent_post"] }, CANONICAL, CFG, "", ctCfg);
    assert.deepEqual(ctas, [{ url: LINKEDIN, label: "Connect on LinkedIn" }]);
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
