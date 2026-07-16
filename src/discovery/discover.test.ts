import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildClientPlatformLeadFile, buildContentExampleLeadFile, DISCOVERY_KINDS } from "./discover.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { checkLeadShape } from "../outreach/validate.js";

const CLIENT_CANDIDATE = {
  name: "Acme Co",
  url: "https://acme.co",
  profile: "Acme makes widgets.",
  evidenceBlock: "",
  evidence: [
    { id: "E1", signal: "worldview-match", person: "", source: "https://acme.co/blog", quote: '"we believe in people"', description: "founder blog post" },
  ],
  disconfirmation: "Nothing found against it.",
  classification: "greenfield",
  classificationNote: "Per E1, a real worldview match.",
  pitchAngle: "lead with the shared worldview",
};

const CE_CANDIDATE = {
  name: "Acme's Q3 pricing relaunch",
  url: "https://acme.co/blog/pricing",
  why: "They bet usage-based pricing would grow revenue without churn.",
  evidence: [
    { id: "E1", signal: "source-quote", person: "", source: "https://acme.co/blog/pricing", quote: '"we are betting on usage-based pricing"', description: "company blog" },
  ],
  angle: "the riskiest belief is that switching pricing models won't spike churn",
};

describe("DISCOVERY_KINDS", () => {
  test("is client, platform, content-example in that order", () => {
    assert.deepEqual(DISCOVERY_KINDS, ["client", "platform", "content-example"]);
  });
});

describe("buildClientPlatformLeadFile", () => {
  test("produces a lead.md whose frontmatter/body pass checkLeadShape (kind: client)", () => {
    const text = buildClientPlatformLeadFile("client", CLIENT_CANDIDATE, "career-work");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "client");
    assert.equal(fm.source, "discovered");
    assert.equal(fm.status, "researched");
    assert.equal(fm.classification, "greenfield");
    assert.equal(fm.fit, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
    assert.match(body, /Acme makes widgets\./);
    assert.match(body, /discovered via \/scout \(theme: "career-work"\)/);
    assert.match(body, /Disconfirmation pass: Nothing found against it\./);
  });

  test("kind: platform writes fit, not classification, and defaults to weak when unclassified", () => {
    const text = buildClientPlatformLeadFile("platform", { ...CLIENT_CANDIDATE, classification: "" }, "civic-tech");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "platform");
    assert.equal(fm.fit, "weak");
    assert.equal(fm.classification, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
  });
});

describe("buildContentExampleLeadFile", () => {
  test("produces a lead.md whose frontmatter/body pass checkLeadShape (kind: content-example)", () => {
    const text = buildContentExampleLeadFile(CE_CANDIDATE, "builder");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "content-example");
    assert.equal(fm.source, "discovered");
    assert.equal(fm.status, "intake");
    assert.equal(fm.classification, undefined);
    assert.equal(fm.fit, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
    assert.match(body, /usage-based pricing/);
    assert.match(body, /discovered via \/scout \(theme: "builder"\)/);
  });

  test("falls back to placeholder text when why/angle are empty (model returned nothing usable)", () => {
    const text = buildContentExampleLeadFile({ ...CE_CANDIDATE, why: "", angle: "" }, "builder");
    const { body } = splitFrontmatter(text);
    assert.match(body, /\(no summary returned\)/);
    assert.match(body, /\(not yet drafted\)/);
  });
});
