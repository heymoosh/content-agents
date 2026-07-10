import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildResearchPrompt,
  parseResearchResponse,
  mergeResearchIntoLead,
  runResearch,
} from "./research.js";

describe("buildResearchPrompt", () => {
  const baseOpts = {
    name: "Acme Co",
    url: "https://acme.co",
    existingProfile: "",
    searchBudgetPerSignal: 2,
    clientsRubric: "RUBRIC TEXT",
    worldviewMap: "WORLDVIEW TEXT",
    personFitRubric: "PERSON FIT TEXT",
  };

  test("embeds the company name, url, and search budget", () => {
    const prompt = buildResearchPrompt(baseOpts);
    assert.ok(prompt.includes("Acme Co"));
    assert.ok(prompt.includes("https://acme.co"));
    assert.ok(prompt.includes("at most 2 times"));
  });

  test("embeds the rubric, worldview map, and person-fit text verbatim", () => {
    const prompt = buildResearchPrompt(baseOpts);
    assert.ok(prompt.includes("RUBRIC TEXT"));
    assert.ok(prompt.includes("WORLDVIEW TEXT"));
    assert.ok(prompt.includes("PERSON FIT TEXT"));
  });

  test("omits the existing-profile block when there is none yet (placeholder or empty)", () => {
    const prompt = buildResearchPrompt({ ...baseOpts, existingProfile: "(not yet researched)" });
    assert.ok(!prompt.includes("Existing profile notes already on file"));
  });

  test("includes the existing-profile block when real prior research is on file", () => {
    const prompt = buildResearchPrompt({ ...baseOpts, existingProfile: "Prior research found X." });
    assert.ok(prompt.includes("Existing profile notes already on file"));
    assert.ok(prompt.includes("Prior research found X."));
  });

  test("instructs a quote-required worldview match and a disconfirmation pass", () => {
    const prompt = buildResearchPrompt(baseOpts);
    assert.ok(/REQUIRED to be a real quote/.test(prompt));
    assert.ok(/Disconfirmation pass/.test(prompt));
  });

  test("bans em dashes in the output instructions", () => {
    const prompt = buildResearchPrompt(baseOpts);
    assert.ok(prompt.includes("No em dashes anywhere in your output"));
  });
});

describe("parseResearchResponse", () => {
  const WELL_FORMED = [
    "PROFILE:",
    "Acme Co builds internal tools for logistics teams.",
    "",
    "EVIDENCE:",
    '- E1 | signal: worldview-match | person: | source: https://acme.co/blog/pivot | quote: "we shipped before we checked the assumption" | founder blog post',
    '- E2 | signal: person-fit | person: Jane Doe | source: https://acme.co/team/jane | quote: "the real question is who this helps" | eng lead interview',
    "",
    "DISCONFIRMATION:",
    "Searched for locked-roadmap language, found none, decision-making still reads open.",
    "",
    "CLASSIFICATION: turnaround",
    "CLASSIFICATION_NOTE:",
    "Per E1 the founder describes a pivot after an untested assumption surfaced. Per E2 a named",
    "person-fit match exists.",
    "",
    "PITCH_ANGLE: name the shared belief that shipping before testing the assumption backfired",
  ].join("\n");

  test("parses all sections and evidence items from a well-formed response", () => {
    const parsed = parseResearchResponse(WELL_FORMED);
    assert.equal(parsed.profile, "Acme Co builds internal tools for logistics teams.");
    assert.equal(parsed.evidence.length, 2);
    assert.equal(parsed.evidence[0].signal, "worldview-match");
    assert.equal(parsed.evidence[1].person, "Jane Doe");
    assert.equal(parsed.classification, "turnaround");
    assert.ok(parsed.classificationNote.includes("Per E1"));
    assert.ok(parsed.disconfirmation.includes("locked-roadmap"));
    assert.ok(parsed.pitchAngle.includes("shared belief"));
  });

  test("does not confuse CLASSIFICATION_NOTE with CLASSIFICATION", () => {
    const parsed = parseResearchResponse(WELL_FORMED);
    assert.equal(parsed.classification, "turnaround");
    assert.ok(!parsed.classificationNote.startsWith("turnaround"));
  });

  test("degrades gracefully when sections are missing entirely", () => {
    const parsed = parseResearchResponse("CLASSIFICATION: unclear\n");
    assert.equal(parsed.profile, "");
    assert.deepEqual(parsed.evidence, []);
    assert.equal(parsed.classification, "unclear");
    assert.equal(parsed.pitchAngle, "");
  });

  test("ignores a malformed evidence line instead of crashing", () => {
    const text = ["EVIDENCE:", "- not pipe-delimited at all", "CLASSIFICATION: unclear"].join("\n");
    const parsed = parseResearchResponse(text);
    assert.deepEqual(parsed.evidence, []);
  });
});

describe("mergeResearchIntoLead", () => {
  const HEADER = [
    "---",
    "kind: client",
    'name: "Acme Co"',
    "url: https://acme.co",
    "source: manual",
    "status: intake   # intake | researched | qualified | pursue | passed | drafted | locked",
    "classification: unclear   # turnaround | greenfield | unclear | disqualified",
    "pitch_angle: ",
    "---",
  ].join("\n");

  const FRESH_BODY = [
    "## Profile",
    "",
    "(not yet researched)",
    "",
    "## Evidence",
    "",
    "(none yet)",
    "",
    "## Classification",
    "",
    "(not yet classified)",
    "",
    "## Pitch",
    "",
    "(not yet drafted)",
    "",
    "## Decision log",
    "",
    "- 2026-07-01: intake (manual)",
  ].join("\n");

  const PARSED = {
    profile: "Acme Co builds internal tools for logistics teams.",
    evidenceBlock: "",
    evidence: [
      {
        id: "E1",
        signal: "worldview-match",
        person: "",
        source: "https://acme.co/blog/pivot",
        quote: "we shipped before we checked the assumption",
        description: "founder blog post",
      },
    ],
    disconfirmation: "Searched for locked-roadmap language, found none.",
    classification: "turnaround",
    classificationNote: "Per E1 the founder describes a pivot.",
    pitchAngle: "name the shared belief about testing assumptions first",
  };

  test("sets classification, status, and a quoted pitch_angle in the frontmatter", () => {
    const { header } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    assert.ok(header.includes("classification: turnaround"));
    assert.ok(header.includes("status: researched"));
    assert.ok(header.includes('pitch_angle: "name the shared belief about testing assumptions first"'));
  });

  test("replaces a placeholder Profile section entirely with the new research", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    const profileSection = body.split("## Evidence")[0];
    assert.ok(profileSection.includes("Acme Co builds internal tools for logistics teams."));
    assert.ok(!profileSection.includes("not yet researched"));
  });

  test("appends to (rather than overwrites) a Profile section that already has real content", () => {
    const bodyWithProfile = FRESH_BODY.replace("(not yet researched)", "Prior notes from intake.");
    const { body } = mergeResearchIntoLead({ header: HEADER, body: bodyWithProfile, parsed: PARSED });
    const profileSection = body.split("## Evidence")[0];
    assert.ok(profileSection.includes("Prior notes from intake."));
    assert.ok(profileSection.includes("Acme Co builds internal tools"));
  });

  test("replaces the (none yet) Evidence placeholder with formatted, renumbered evidence lines", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    assert.ok(body.includes("- E1 | signal: worldview-match"));
    assert.ok(body.includes("we shipped before we checked the assumption"));
    assert.ok(!body.includes("(none yet)"));
  });

  test("renumbers evidence sequentially across a re-research pass instead of colliding ids", () => {
    const bodyWithEvidence = FRESH_BODY.replace(
      "(none yet)",
      '- E1 | signal: person-fit | person: Jane Doe | source: https://acme.co/team/jane | quote: "prior quote" | prior note',
    );
    const { body } = mergeResearchIntoLead({ header: HEADER, body: bodyWithEvidence, parsed: PARSED });
    const evidenceSection = body.split("## Classification")[0];
    assert.ok(evidenceSection.includes("- E1 | signal: person-fit"));
    assert.ok(evidenceSection.includes("- E2 | signal: worldview-match"));
  });

  test("Evidence section stays (none yet) when no evidence was found and none pre-existed", () => {
    const emptyParsed = { ...PARSED, evidence: [] };
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: emptyParsed });
    const evidenceSection = body.split("## Classification")[0];
    assert.ok(evidenceSection.includes("(none yet)"));
  });

  test("Classification section is fully replaced with the rationale and disconfirmation summary", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    const classSection = body.split("## Pitch")[0];
    assert.ok(classSection.includes("Per E1 the founder describes a pivot."));
    assert.ok(classSection.includes("Disconfirmation pass: Searched for locked-roadmap language"));
    assert.ok(!classSection.includes("not yet classified"));
  });

  test("Pitch section is replaced with the pitch angle sentence", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    const pitchSection = body.split("## Decision log")[0];
    assert.ok(pitchSection.includes("name the shared belief about testing assumptions first"));
  });
});

describe("runResearch guard clauses (no subprocess reached)", () => {
  function makeLeadDir(fixtureBody: string): string {
    const dir = mkdtempSync(join(tmpdir(), "outreach-research-test-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "lead.md"), fixtureBody);
    return dir;
  }

  test("refuses a kind: platform lead with a Phase 3 scope message, before ever shelling out", async () => {
    const dir = makeLeadDir(
      ['---', "kind: platform", 'name: "Some Podcast"', "fit: unclear", "---", "", "## Profile", "", "x"].join("\n"),
    );
    try {
      await assert.rejects(runResearch(dir), /Phase 3 scope/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("throws a clear error when lead.md does not exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "outreach-research-test-"));
    try {
      await assert.rejects(runResearch(dir), /no lead\.md found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
