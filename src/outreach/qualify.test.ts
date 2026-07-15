import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateQualify,
  parseEvidence,
  isValidSourceUrl,
  hasQuote,
  isValidEvidenceItem,
  type EvidenceItem,
  type QualifyInput,
} from "./qualify.js";

const WORLDVIEW_ITEM: EvidenceItem = {
  id: "E1",
  signal: "worldview-match",
  person: "",
  source: "https://example.com/interview",
  quote: "we shipped the process before anyone checked the assumption underneath it",
  description: "founder interview re: untested assumption",
};

const PERSON_ITEM: EvidenceItem = {
  id: "E2",
  signal: "person-fit",
  person: "Jane Doe",
  source: "https://example.com/jane-blog",
  quote: "the system worked fine, the question is who it worked for",
  description: "eng lead blog post",
};

function baseInput(overrides: Partial<QualifyInput> = {}): QualifyInput {
  return {
    kind: "client",
    source: "manual",
    classification: "turnaround",
    leadName: "Acme Co",
    leadFile: "outreach/leads/client-acme-co/lead.md",
    ...overrides,
  };
}

describe("evaluateQualify: positive classification requires evidence", () => {
  test("zero evidence items forces unclear", () => {
    const result = evaluateQualify(baseInput(), []);
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.downgraded, true);
    assert.equal(result.status, "qualified");
    assert.ok(result.reasons.some((r) => r.includes("zero evidence")));
  });

  test("evidence present but no valid worldview-match item forces unclear", () => {
    const result = evaluateQualify(baseInput(), [PERSON_ITEM]);
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.downgraded, true);
  });

  test("worldview-match with a placeholder quote does not count as valid evidence", () => {
    const thin: EvidenceItem = { ...WORLDVIEW_ITEM, quote: "(none)" };
    const result = evaluateQualify(baseInput(), [thin]);
    assert.equal(result.finalValue, "unclear");
  });

  test("worldview-match with a dead-shaped source does not count as valid evidence", () => {
    const thin: EvidenceItem = { ...WORLDVIEW_ITEM, source: "n/a" };
    const result = evaluateQualify(baseInput(), [thin]);
    assert.equal(result.finalValue, "unclear");
  });
});

describe("evaluateQualify: platform-kind downgrade lands on a legal fit value", () => {
  // Mirrors VALID_FITS in validate.ts (strong|partial|weak|disqualified) -- "unclear" is not a
  // legal fit value, so a platform-kind downgrade must never produce it.
  const VALID_FITS = new Set(["strong", "partial", "weak", "disqualified"]);

  test("zero evidence items forces a platform-kind lead to weak, not unclear", () => {
    const result = evaluateQualify(
      baseInput({ kind: "platform", classification: undefined, fit: "strong" }),
      [],
    );
    assert.equal(result.finalValue, "weak");
    assert.notEqual(result.finalValue, "unclear");
    assert.ok(VALID_FITS.has(result.finalValue));
    assert.equal(result.downgraded, true);
    assert.equal(result.status, "qualified");
    assert.ok(result.reasons.some((r) => r.includes("forced to weak")));
  });

  test("evidence present but no valid worldview-match item forces a platform-kind lead to weak", () => {
    const result = evaluateQualify(
      baseInput({ kind: "platform", classification: undefined, fit: "partial" }),
      [PERSON_ITEM],
    );
    assert.equal(result.finalValue, "weak");
    assert.ok(VALID_FITS.has(result.finalValue));
    assert.equal(result.downgraded, true);
  });

  test("client-kind downgrade is unchanged: still lands on unclear", () => {
    const result = evaluateQualify(baseInput({ kind: "client", classification: "turnaround" }), []);
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.downgraded, true);
    assert.ok(result.reasons.some((r) => r.includes("forced to unclear")));
  });
});

describe("evaluateQualify: non-jsa lead, single-key path", () => {
  test("valid worldview-match evidence lets a positive classification stand and reach pursue", () => {
    const result = evaluateQualify(baseInput(), [WORLDVIEW_ITEM]);
    assert.equal(result.finalValue, "turnaround");
    assert.equal(result.downgraded, false);
    assert.equal(result.status, "pursue");
    assert.equal(result.anchorEntry, undefined);
  });

  test("a vault:-sourced worldview-match evidence item is valid and does not downgrade the classification", () => {
    // Real repro case (outreach/leads/client-mem/lead.md, E5, source: ingested): a lead citing
    // Muxin's own Obsidian vault research must not be silently downgraded to "unclear" just
    // because the source isn't https://.
    const vaultItem: EvidenceItem = {
      ...WORLDVIEW_ITEM,
      source: "vault:Research/Company Research/Mem/Kevin Moody - Deep Profile & Cultural Fit Analysis.md",
    };
    const result = evaluateQualify(baseInput({ source: "ingested" }), [vaultItem]);
    assert.equal(result.finalValue, "turnaround");
    assert.equal(result.downgraded, false);
    assert.equal(result.status, "pursue");
  });

  test("disqualified claim short-circuits straight to status passed, no evidence needed", () => {
    const result = evaluateQualify(baseInput({ classification: "disqualified" }), []);
    assert.equal(result.finalValue, "disqualified");
    assert.equal(result.status, "passed");
    assert.equal(result.downgraded, false);
  });

  test("an already-unclear claim passes through unchanged with status qualified", () => {
    const result = evaluateQualify(baseInput({ classification: "unclear" }), []);
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.downgraded, false);
    assert.equal(result.status, "qualified");
  });

  test("platform kind uses the fit field and strong/partial as its positive set", () => {
    const result = evaluateQualify(
      baseInput({ kind: "platform", classification: undefined, fit: "strong" }),
      [WORLDVIEW_ITEM],
    );
    assert.equal(result.fieldName, "fit");
    assert.equal(result.finalValue, "strong");
    assert.equal(result.status, "pursue");
  });
});

describe("evaluateQualify: two-key jobsearch gate (source: jsa)", () => {
  test("company-level worldview-match alone is not enough, status stays qualified", () => {
    const result = evaluateQualify(baseInput({ source: "jsa" }), [WORLDVIEW_ITEM]);
    assert.equal(result.finalValue, "turnaround");
    assert.equal(result.status, "qualified");
    assert.ok(result.reasons.some((r) => r.includes("two-key gate")));
  });

  test("both worldview-match and person-fit clear the gate and reach pursue", () => {
    const result = evaluateQualify(baseInput({ source: "jsa" }), [WORLDVIEW_ITEM, PERSON_ITEM]);
    assert.equal(result.status, "pursue");
    assert.equal(result.anchorEntry, undefined);
  });

  test("named person-fit match with no company-level clearance is recorded as an anchor, not discarded", () => {
    const result = evaluateQualify(baseInput({ source: "jsa" }), [PERSON_ITEM]);
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.status, "qualified");
    assert.ok(result.anchorEntry);
    assert.equal(result.anchorEntry?.name, "Jane Doe");
    assert.equal(result.anchorEntry?.company, "Acme Co");
  });

  test("a jsa lead with zero evidence gets no anchor entry (nothing named to record)", () => {
    const result = evaluateQualify(baseInput({ source: "jsa" }), []);
    assert.equal(result.anchorEntry, undefined);
  });
});

describe("parseEvidence", () => {
  test("parses well-formed pipe-delimited evidence lines from the ## Evidence section", () => {
    const body = [
      "## Profile",
      "",
      "some profile text",
      "",
      "## Evidence",
      "",
      '- E1 | signal: worldview-match | person: | source: https://example.com/a | quote: "quoted words" | a note',
      '- E2 | signal: person-fit | person: Jane Doe | source: https://example.com/b | quote: "other words" | another note',
      "",
      "## Classification",
      "",
      "notes",
    ].join("\n");
    const items = parseEvidence(body);
    assert.equal(items.length, 2);
    assert.equal(items[0].signal, "worldview-match");
    assert.equal(items[0].source, "https://example.com/a");
    assert.equal(items[1].person, "Jane Doe");
    assert.equal(items[1].description, "another note");
  });

  test("ignores malformed lines and lines outside the Evidence section", () => {
    const body = [
      "## Evidence",
      "",
      "- not a well-formed evidence line",
      '- E1 | signal: worldview-match | person: | source: https://example.com/a | quote: "x" | note',
      "",
      "## Classification",
      '- E9 | signal: worldview-match | person: | source: https://example.com/b | quote: "y" | should not be parsed',
    ].join("\n");
    const items = parseEvidence(body);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "E1");
  });

  test("returns an empty array when there is no ## Evidence section", () => {
    assert.deepEqual(parseEvidence("## Profile\n\nsome text\n"), []);
  });
});

describe("isValidSourceUrl", () => {
  test("accepts a well-formed http(s) URL with a real-looking hostname", () => {
    assert.equal(isValidSourceUrl("https://example.com/post/1"), true);
  });

  test("accepts a well-formed vault: path (Obsidian vault evidence source)", () => {
    assert.equal(
      isValidSourceUrl("vault:Research/Company Research/Mem/some file.md"),
      true,
    );
  });

  test("rejects a bare vault: with no path", () => {
    assert.equal(isValidSourceUrl("vault:"), false);
    assert.equal(isValidSourceUrl("vault:   "), false);
  });

  test("rejects a placeholder value typo'd behind the vault: prefix", () => {
    assert.equal(isValidSourceUrl("vault:n/a"), false);
    assert.equal(isValidSourceUrl("vault:tbd"), false);
    assert.equal(isValidSourceUrl("vault:(none)"), false);
    assert.equal(isValidSourceUrl("vault:unknown"), false);
  });

  for (const bad of ["", "(none)", "n/a", "TBD", "unknown", "not a url", "ftp://example.com", "https://localhost"]) {
    test(`rejects "${bad}"`, () => {
      assert.equal(isValidSourceUrl(bad), false);
    });
  }
});

describe("hasQuote", () => {
  test("rejects empty and placeholder quotes", () => {
    for (const q of ["", "(none)", "n/a", "TBD"]) assert.equal(hasQuote(q), false);
  });
  test("accepts a real quote string", () => {
    assert.equal(hasQuote("we changed our mind after the data came in"), true);
  });
});

describe("isValidEvidenceItem", () => {
  test("requires both a real quote and a valid source", () => {
    assert.equal(isValidEvidenceItem(WORLDVIEW_ITEM), true);
    assert.equal(isValidEvidenceItem({ ...WORLDVIEW_ITEM, quote: "(none)" }), false);
    assert.equal(isValidEvidenceItem({ ...WORLDVIEW_ITEM, source: "tbd" }), false);
  });
});
