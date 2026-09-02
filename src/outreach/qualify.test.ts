import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateQualify,
  parseEvidence,
  isValidSourceUrl,
  hasQuote,
  isValidEvidenceItem,
  type EvidenceItem,
  formatEvidenceLine,
  type QualifyInput, upsertFrontmatterField } from "./qualify.js";

const WORLDVIEW_ITEM: EvidenceItem = {
  id: "E1",
  signal: "worldview-match",
  person: "",
  source: "https://example.com/interview",
  quote: "we shipped the process before anyone checked the assumption underneath it",
  description: "founder interview re: untested assumption",
  captured_at: null,
};

const PERSON_ITEM: EvidenceItem = {
  id: "E2",
  signal: "person-fit",
  person: "Jane Doe",
  source: "https://example.com/jane-blog",
  quote: "the system worked fine, the question is who it worked for",
  description: "eng lead blog post",
  captured_at: null,
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

  test("peer kind is treated like client: classification field, unclear as the downgrade target", () => {
    const result = evaluateQualify(baseInput({ kind: "peer", classification: "turnaround" }), []);
    assert.equal(result.fieldName, "classification");
    assert.equal(result.finalValue, "unclear");
    assert.equal(result.downgraded, true);
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

// ── upsertFrontmatterField: inserts a NEW field (setFrontmatterField deliberately no-ops) ───────
test("upsertFrontmatterField updates an existing field and inserts a missing one before the closing ---", () => {
  const header = "---\nkind: client\nstatus: pursue   # comment\n---\n";
  const updated = upsertFrontmatterField(header, "status", "passed");
  assert.match(updated, /status: passed   # comment/);
  const inserted = upsertFrontmatterField(header, "why_mutual", '"the read"');
  assert.match(inserted, /why_mutual: "the read"\n---\n/);
  assert.equal(upsertFrontmatterField("no frontmatter here", "x", "y"), "no frontmatter here");
});

// ── captured_at: the optional trailing segment ──────────────────────────────────────────────────
//
// Every lead.md already on disk was written before this field existed and nothing rewrites those
// files, so the OLD line shape has to keep parsing forever. These lines are copied verbatim out of
// outreach/leads/ rather than written for the test, which is the only version of this check that
// can actually catch a format change.
describe("parseEvidence: captured_at", () => {
  const REAL_UNDATED_LINE =
    '- E1 | signal: greenfield | person: | source: https://www.businesswire.com/news/home/20250423372243/en/x | quote: "Beyond Notetaking: Fireflies Offers 200+ Agentic AI Apps" | April 2025 shift from a single notetaking product into a wide, still-forming portfolio.';
  const REAL_VAULT_LINE =
    '- E2 | signal: greenfield | person: Krish Ramineni | source: vault:Research/Company Research/Fireflies/Krish LinkedIn.md | quote: "I\'m hiring founders! We\'re expanding into multiple new products at Fireflies." | Direct 0-to-1 language for genuinely undecided new product bets.';

  test("a line written before the field existed parses, and is undated rather than defaulted", () => {
    const [item] = parseEvidence(`## Evidence\n\n${REAL_UNDATED_LINE}\n`);
    assert.equal(item.id, "E1");
    assert.equal(item.signal, "greenfield");
    assert.equal(item.source, "https://www.businesswire.com/news/home/20250423372243/en/x");
    assert.equal(item.description, "April 2025 shift from a single notetaking product into a wide, still-forming portfolio.");
    assert.equal(item.captured_at, null);
  });

  test("a vault-sourced legacy line parses unchanged too", () => {
    const [item] = parseEvidence(`## Evidence\n\n${REAL_VAULT_LINE}\n`);
    assert.equal(item.person, "Krish Ramineni");
    assert.equal(item.source, "vault:Research/Company Research/Fireflies/Krish LinkedIn.md");
    assert.equal(item.description, "Direct 0-to-1 language for genuinely undecided new product bets.");
    assert.equal(item.captured_at, null);
  });

  test("a dated line reads its date and keeps the note whole", () => {
    const line = `${REAL_UNDATED_LINE} | captured: 2026-08-23`;
    const [item] = parseEvidence(`## Evidence\n\n${line}\n`);
    assert.equal(item.captured_at, "2026-08-23");
    assert.equal(item.description, "April 2025 shift from a single notetaking product into a wide, still-forming portfolio.");
  });

  test("a note that merely mentions a capture is not mistaken for a date", () => {
    const line = "- E1 | signal: recency | person: | source: https://acme.co | quote: (none) | captured on video, no date given";
    const [item] = parseEvidence(`## Evidence\n\n${line}\n`);
    assert.equal(item.captured_at, null);
    assert.equal(item.description, "captured on video, no date given");
  });

  // The one pre-existing difference a round trip has always had: an empty `person:` field comes
  // back as "person: " with the separator's own space, because the writer interpolates a blank.
  // That predates captured_at and is not what these tests are about, so it is normalized away
  // rather than pinned — everything else must come back byte for byte.
  const norm = (line: string) => line.replace(/\| person:\s*\|/, "| person: |");

  test("round trip: an undated line re-serializes still undated", () => {
    for (const line of [REAL_UNDATED_LINE, REAL_VAULT_LINE]) {
      const [item] = parseEvidence(`## Evidence\n\n${line}\n`);
      const written = formatEvidenceLine(item, Number(item.id.slice(1)));
      assert.equal(norm(written), norm(line), "re-writing an undated line must not invent a date");
      assert.ok(!/captured:/.test(written), "no capture segment may appear on a line that had none");
    }
  });

  test("round trip: a vault line with a real person comes back byte for byte", () => {
    const [item] = parseEvidence(`## Evidence\n\n${REAL_VAULT_LINE}\n`);
    assert.equal(formatEvidenceLine(item, 2), REAL_VAULT_LINE);
  });

  test("round trip: a dated line re-serializes with the same date", () => {
    const line = `${REAL_VAULT_LINE} | captured: 2026-08-23`;
    const [item] = parseEvidence(`## Evidence\n\n${line}\n`);
    assert.equal(item.captured_at, "2026-08-23");
    assert.equal(formatEvidenceLine(item, 2), line);
  });

  test("the date changes nothing about whether an item is valid", () => {
    const dated = { ...WORLDVIEW_ITEM, captured_at: "2026-08-23" };
    assert.equal(isValidEvidenceItem(dated), isValidEvidenceItem(WORLDVIEW_ITEM));
    assert.equal(isValidEvidenceItem(dated), true);
    const badSource = { ...WORLDVIEW_ITEM, source: "(none)", captured_at: "2026-08-23" };
    assert.equal(isValidEvidenceItem(badSource), false, "a date must never rescue an item with no source");
  });
});
