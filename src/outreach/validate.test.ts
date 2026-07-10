import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkLeadShape } from "./validate.js";

const REQUIRED_BODY = [
  "## Profile",
  "",
  "text",
  "",
  "## Evidence",
  "",
  "(none yet)",
  "",
  "## Classification",
  "",
  "text",
  "",
  "## Pitch",
  "",
  "text",
  "",
  "## Decision log",
  "",
  "- entry",
].join("\n");

function baseClientFm(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "client",
    name: "Acme Co",
    url: "https://acme.co",
    source: "manual",
    status: "intake",
    classification: "unclear",
    pitch_angle: "",
    ...overrides,
  };
}

describe("checkLeadShape: a well-formed lead passes with zero violations", () => {
  test("kind: client, source: manual", () => {
    assert.deepEqual(checkLeadShape("lead.md", baseClientFm(), REQUIRED_BODY), []);
  });

  test("kind: platform, source: manual", () => {
    const fm = baseClientFm({ kind: "platform", classification: undefined, fit: "weak" });
    delete fm.classification;
    assert.deepEqual(checkLeadShape("lead.md", fm, REQUIRED_BODY), []);
  });

  test("kind: client, source: jsa, with jsa_verdict present", () => {
    const fm = baseClientFm({ source: "jsa", jsa_verdict: "TARGET" });
    assert.deepEqual(checkLeadShape("lead.md", fm, REQUIRED_BODY), []);
  });
});

describe("checkLeadShape: frontmatter field violations", () => {
  test("flags an invalid kind", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ kind: "vendor" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("kind must be")));
  });

  test("flags a missing name", () => {
    const fm = baseClientFm({ name: "" });
    const violations = checkLeadShape("lead.md", fm, REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes('"name"')));
  });

  test("flags a missing url key entirely (not just an empty string)", () => {
    const fm = baseClientFm();
    delete fm.url;
    const violations = checkLeadShape("lead.md", fm, REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes('"url"')));
  });

  test("an empty-string url is fine as long as the key exists", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ url: "" }), REQUIRED_BODY);
    assert.deepEqual(violations, []);
  });

  test("flags an invalid source", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ source: "cold-email" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("source must be")));
  });

  test("source: jsa without jsa_verdict is flagged", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ source: "jsa" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("jsa_verdict")));
  });

  test("flags an invalid status", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ status: "contacted" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("status must be")));
  });
});

describe("checkLeadShape: classification/fit are kind-exclusive", () => {
  test("kind: client with an invalid classification value is flagged", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ classification: "hot" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("classification in")));
  });

  test("kind: client carrying a fit field is flagged", () => {
    const violations = checkLeadShape("lead.md", baseClientFm({ fit: "strong" }), REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes('should not carry a "fit" field')));
  });

  test("kind: platform with an invalid fit value is flagged", () => {
    const fm = baseClientFm({ kind: "platform", fit: "hot" });
    delete fm.classification;
    const violations = checkLeadShape("lead.md", fm, REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("fit in")));
  });

  test("kind: platform carrying a classification field is flagged", () => {
    const fm = baseClientFm({ kind: "platform", fit: "strong" });
    const violations = checkLeadShape("lead.md", fm, REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes('should not carry a "classification" field')));
  });
});

describe("checkLeadShape: pitch_angle and required body sections", () => {
  test("missing pitch_angle key is flagged even though it may be an empty string", () => {
    const fm = baseClientFm();
    delete fm.pitch_angle;
    const violations = checkLeadShape("lead.md", fm, REQUIRED_BODY);
    assert.ok(violations.some((v) => v.includes("pitch_angle")));
  });

  test("a body missing one or more required sections is flagged per missing section", () => {
    const thinBody = "## Profile\n\ntext\n";
    const violations = checkLeadShape("lead.md", baseClientFm(), thinBody);
    assert.ok(violations.some((v) => v.includes("## Evidence")));
    assert.ok(violations.some((v) => v.includes("## Classification")));
    assert.ok(violations.some((v) => v.includes("## Pitch")));
    assert.ok(violations.some((v) => v.includes("## Decision log")));
  });
});
