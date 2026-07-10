import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDraftPrompt, selectEvidenceForDraft, runDraft } from "./draft.js";
import type { EvidenceItem } from "./qualify.js";

const GREENFIELD_ITEM: EvidenceItem = {
  id: "E1",
  signal: "greenfield",
  person: "",
  source: "https://acme.co/blog/act-2",
  quote: "(none)",
  description: "publicly exploring a new, unshipped direction",
};

const WORLDVIEW_ITEM: EvidenceItem = {
  id: "E6",
  signal: "worldview-match",
  person: "Jane Doe",
  source: "https://acme.co/founders/product-360",
  quote: "I used to think you don't need product people. I was wrong.",
  description: "founder reverses a foundational assumption",
};

const PERSON_ITEM: EvidenceItem = {
  id: "E8",
  signal: "person-fit",
  person: "Jane Doe",
  source: "https://acme.co/founders/product-360",
  quote: "I used to think you don't need product people. I was wrong.",
  description: "person-fit tier: Developing",
};

describe("selectEvidenceForDraft", () => {
  test("picks the classification-supporting signal plus any worldview-match items", () => {
    const picked = selectEvidenceForDraft([GREENFIELD_ITEM, WORLDVIEW_ITEM, PERSON_ITEM], "greenfield");
    assert.deepEqual(
      picked.map((e) => e.id),
      ["E1", "E6"],
    );
  });

  test("falls back to every evidence item when nothing matches the classification or worldview-match", () => {
    const turnaroundOnly: EvidenceItem = { ...GREENFIELD_ITEM, id: "E9", signal: "disqualifying" };
    const picked = selectEvidenceForDraft([turnaroundOnly], "greenfield");
    assert.deepEqual(
      picked.map((e) => e.id),
      ["E9"],
    );
  });
});

describe("buildDraftPrompt", () => {
  const baseOpts = {
    leadName: "Acme Co",
    channel: "email" as const,
    classification: "greenfield",
    pitchAngle: "name the shared belief about testing assumptions first",
    evidence: [GREENFIELD_ITEM, WORLDVIEW_ITEM],
  };

  test("embeds the lead name, channel, pitch angle, and cited evidence", () => {
    const prompt = buildDraftPrompt(baseOpts);
    assert.ok(prompt.includes("Acme Co"));
    assert.ok(prompt.includes("email"));
    assert.ok(prompt.includes("name the shared belief about testing assumptions first"));
    assert.ok(prompt.includes("E1"));
    assert.ok(prompt.includes("E6"));
    assert.ok(prompt.includes("I used to think you don't need product people. I was wrong."));
  });

  test("instructs the two-sided rule (name their real situation, not generic flattery)", () => {
    const prompt = buildDraftPrompt(baseOpts);
    assert.ok(/two-sided/i.test(prompt));
    assert.ok(/generic flattery|template that could go to anyone/i.test(prompt));
  });

  test("bans em dashes and AI tells, referencing config/voice.yaml", () => {
    const prompt = buildDraftPrompt(baseOpts);
    assert.ok(prompt.includes("config/voice.yaml"));
    assert.ok(/no em dashes/i.test(prompt));
  });

  test("instructs printing only the message body, nothing else", () => {
    const prompt = buildDraftPrompt(baseOpts);
    assert.ok(/print only the message body/i.test(prompt));
  });

  test("does not invent facts beyond the cited evidence", () => {
    const prompt = buildDraftPrompt(baseOpts);
    assert.ok(/do not invent/i.test(prompt));
  });
});

describe("runDraft guard clauses (no subprocess reached)", () => {
  function makeLeadDir(fixtureBody: string): string {
    const dir = mkdtempSync(join(tmpdir(), "outreach-draft-test-"));
    writeFileSync(join(dir, "lead.md"), fixtureBody);
    return dir;
  }

  const EVIDENCE_BODY = [
    "## Profile",
    "",
    "text",
    "",
    "## Evidence",
    "",
    '- E1 | signal: greenfield | person: | source: https://acme.co/a | quote: (none) | a note',
    '- E6 | signal: worldview-match | person: Jane Doe | source: https://acme.co/b | quote: "I was wrong" | founder reversal',
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

  function leadFixture(opts: { kind?: string; classification?: string; body?: string } = {}): string {
    const kind = opts.kind ?? "client";
    const classification = opts.classification ?? "greenfield";
    return (
      `---\nkind: ${kind}\nname: "Acme Co"\nurl: https://acme.co\nsource: manual\nstatus: pursue\n` +
      `${kind === "client" ? `classification: ${classification}` : `fit: ${classification}`}\npitch_angle: "the angle"\n---\n\n` +
      (opts.body ?? EVIDENCE_BODY)
    );
  }

  test("refuses a kind: platform lead when fit is weak", async () => {
    const dir = makeLeadDir(leadFixture({ kind: "platform", classification: "weak" }));
    try {
      await assert.rejects(runDraft(dir), /non-fit|weak/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses a kind: platform lead when fit is disqualified", async () => {
    const dir = makeLeadDir(leadFixture({ kind: "platform", classification: "disqualified" }));
    try {
      await assert.rejects(runDraft(dir), /non-fit|disqualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses to draft when classification is unclear", async () => {
    const dir = makeLeadDir(leadFixture({ classification: "unclear" }));
    try {
      await assert.rejects(runDraft(dir), /non-fit|unclear/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses to draft when classification is disqualified", async () => {
    const dir = makeLeadDir(leadFixture({ classification: "disqualified" }));
    try {
      await assert.rejects(runDraft(dir), /non-fit|disqualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses to draft when the lead has zero evidence items", async () => {
    const emptyBody = [
      "## Profile", "", "text", "", "## Evidence", "", "(none yet)", "",
      "## Classification", "", "text", "", "## Pitch", "", "text", "",
      "## Decision log", "", "- entry",
    ].join("\n");
    const dir = makeLeadDir(leadFixture({ body: emptyBody }));
    try {
      await assert.rejects(runDraft(dir), /zero evidence/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses an invalid --channel value", async () => {
    const dir = makeLeadDir(leadFixture());
    try {
      await assert.rejects(runDraft(dir, { channel: "carrier-pigeon" }), /--channel must be one of/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("throws a clear error when lead.md does not exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "outreach-draft-test-"));
    try {
      await assert.rejects(runDraft(dir), /no lead\.md found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
