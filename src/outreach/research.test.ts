import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildResearchPrompt,
  buildPlatformResearchPrompt,
  parseResearchResponse,
  mergeResearchIntoLead,
  runResearch,
  computeSearchBudgetTotal,
  buildResearchSettings,
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

describe("buildPlatformResearchPrompt", () => {
  const basePlatformOpts = {
    name: "Some Podcast",
    url: "https://pod.example.com",
    existingProfile: "",
    searchBudgetPerSignal: 2,
    platformsRubric: "PLATFORM RUBRIC TEXT",
    worldviewMap: "WORLDVIEW TEXT",
    spinAngles: "x (audience: tech): some angle text",
  };

  test("embeds the platform name, url, and search budget", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(prompt.includes("Some Podcast"));
    assert.ok(prompt.includes("https://pod.example.com"));
    assert.ok(prompt.includes("at most 2 times"));
  });

  test("embeds the platforms rubric, worldview map, and spin_angles text verbatim", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(prompt.includes("PLATFORM RUBRIC TEXT"));
    assert.ok(prompt.includes("WORLDVIEW TEXT"));
    assert.ok(prompt.includes("x (audience: tech): some angle text"));
  });

  test("instructs the model to classify into strong/partial/weak/disqualified, not client values", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(prompt.includes("CLASSIFICATION: <strong|partial|weak|disqualified>"));
    assert.ok(!prompt.includes("turnaround|greenfield"));
  });

  test("instructs the pitch angle to be grounded in the closest spin_angles match", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(/spin_angles/i.test(prompt));
    assert.ok(/closest/i.test(prompt));
  });

  test("instructs a quote-required worldview match and a disconfirmation pass", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(/REQUIRED to be a real quote/.test(prompt));
    assert.ok(/Disconfirmation pass/.test(prompt));
  });

  test("instructs mid-tail size to downgrade, not disqualify", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(/50k/.test(prompt));
    assert.ok(/DOWNGRADE/.test(prompt));
  });

  test("bans em dashes in the output instructions", () => {
    const prompt = buildPlatformResearchPrompt(basePlatformOpts);
    assert.ok(prompt.includes("No em dashes anywhere in your output"));
  });

  test("omits the existing-profile block when there is none yet", () => {
    const prompt = buildPlatformResearchPrompt({ ...basePlatformOpts, existingProfile: "(not yet researched)" });
    assert.ok(!prompt.includes("Existing profile notes already on file"));
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
        captured_at: null,
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

  // ── captured_at on a merge ──────────────────────────────────────────────────────────────────
  //
  // The merge re-writes the WHOLE ## Evidence section on every pass, old items included, so this is
  // the exact place a well-meaning formatter would stamp today's date onto evidence gathered months
  // ago. It must not: only the items this pass brought in get a date, and only the caller's.
  test("stamps the run's date on the evidence this pass brought in", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED, capturedAt: "2026-08-23" });
    assert.ok(body.includes("- E1 | signal: worldview-match"));
    assert.ok(body.includes("| captured: 2026-08-23"), "new evidence carries the date the run captured it");
  });

  test("leaves evidence that was already in the file undated, on a pass that dates its own", () => {
    const bodyWithEvidence = FRESH_BODY.replace(
      "(none yet)",
      '- E1 | signal: person-fit | person: Jane Doe | source: https://acme.co/team/jane | quote: "prior quote" | prior note',
    );
    const { body } = mergeResearchIntoLead({ header: HEADER, body: bodyWithEvidence, parsed: PARSED, capturedAt: "2026-08-23" });
    const lines = body.split("## Classification")[0].split("\n").filter((l) => l.startsWith("- E"));
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith("- E1 | signal: person-fit"));
    assert.ok(!lines[0].includes("captured:"), "an item that arrived undated stays undated forever: " + lines[0]);
    assert.ok(lines[1].endsWith("| captured: 2026-08-23"), lines[1]);
  });

  test("omitting capturedAt leaves even the new evidence undated, rather than reading a clock here", () => {
    const { body } = mergeResearchIntoLead({ header: HEADER, body: FRESH_BODY, parsed: PARSED });
    assert.ok(!body.includes("captured:"), "the merge is pure; the caller owns the date");
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

describe("mergeResearchIntoLead: kind: platform sets fit, not classification", () => {
  const PLATFORM_HEADER = [
    "---",
    "kind: platform",
    'name: "Some Podcast"',
    "url: https://pod.example.com",
    "source: manual",
    "status: intake   # intake | researched | qualified | pursue | passed | drafted | locked",
    "fit: unclear   # strong | partial | weak | disqualified",
    "pitch_angle: ",
    "---",
  ].join("\n");

  const PLATFORM_BODY = [
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

  const CLIENT_HEADER = [
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

  const PLATFORM_PARSED = {
    profile: "Some Podcast covers AI and society for a general audience.",
    evidenceBlock: "",
    evidence: [
      {
        id: "E1",
        signal: "worldview-match",
        person: "",
        source: "https://pod.example.com/about",
        quote: "we think the real risk is the systems we build without checking them",
        description: "host mission statement",
        captured_at: null,
      },
    ],
    disconfirmation: "Searched for closed-to-outside-guests language, found none.",
    classification: "strong",
    classificationNote: "Per E1 the host's own words match worldview-map statement 1.",
    pitchAngle: "the civic-tech audience angle, applied to this podcast's own listeners",
  };

  test("sets fit (not classification) in the frontmatter for a platform-kind lead", () => {
    const { header } = mergeResearchIntoLead({
      header: PLATFORM_HEADER,
      body: PLATFORM_BODY,
      parsed: PLATFORM_PARSED,
      kind: "platform",
    });
    assert.ok(header.includes("fit: strong"));
    assert.ok(!/^classification:/m.test(header));
  });

  test("defaults to weak (not unclear) when the model returns no classification for a platform lead", () => {
    const { header } = mergeResearchIntoLead({
      header: PLATFORM_HEADER,
      body: PLATFORM_BODY,
      parsed: { ...PLATFORM_PARSED, classification: "" },
      kind: "platform",
    });
    assert.ok(header.includes("fit: weak"));
  });

  test("still defaults to unclear for a client-kind lead (kind omitted preserves prior behavior)", () => {
    const { header } = mergeResearchIntoLead({
      header: CLIENT_HEADER,
      body: PLATFORM_BODY,
      parsed: { ...PLATFORM_PARSED, classification: "" },
    });
    assert.ok(header.includes("classification: unclear"));
  });
});

describe("runResearch guard clauses (no subprocess reached)", () => {
  function makeLeadDir(fixtureBody: string): string {
    const dir = mkdtempSync(join(tmpdir(), "outreach-research-test-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "lead.md"), fixtureBody);
    return dir;
  }

  test("throws a clear error when lead.md does not exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "outreach-research-test-"));
    try {
      await assert.rejects(runResearch(dir), /no lead\.md found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Card 43fa1e02 (resumes 3c6550a6): code-enforce search_budget_per_signal at the subprocess-hook
// level rather than only via prompt text. computeSearchBudgetTotal/buildResearchSettings are the
// unit-testable seams around that; the hook's own budget-consumption logic is covered separately
// in search-budget-hook.test.ts since it lives in its own module.
describe("computeSearchBudgetTotal", () => {
  test("client kind multiplies by 3 signal categories (turnaround, greenfield, disqualifying)", () => {
    assert.equal(computeSearchBudgetTotal("client", 2), 6);
    assert.equal(computeSearchBudgetTotal("client", 5), 15);
  });

  test("platform kind multiplies by 5 signal categories (topic-overlap, audience-reality, guest-friendliness, recency, disqualifying)", () => {
    assert.equal(computeSearchBudgetTotal("platform", 2), 10);
    assert.equal(computeSearchBudgetTotal("platform", 1), 5);
  });
});

describe("buildResearchSettings", () => {
  test("wires a PreToolUse hook matching WebSearch|WebFetch that shells out to the hook script via tsx", () => {
    const settings = buildResearchSettings("/fake/repo/src/outreach/search-budget-hook.ts");
    const hookEntry = settings.hooks.PreToolUse[0];
    assert.equal(hookEntry.matcher, "WebSearch|WebFetch");
    assert.equal(hookEntry.hooks.length, 1);
    assert.equal(hookEntry.hooks[0].type, "command");
    assert.ok(hookEntry.hooks[0].command.includes("search-budget-hook.ts"));
    assert.ok(hookEntry.hooks[0].command.includes("tsx"));
  });
});

// ── Matchmaker read (design 3d): WHY_* markers parse and merge into frontmatter ─────────────────
test("parseResearchResponse picks up the WHY_* matchmaker blocks", () => {
  const text = "PROFILE:\np\n\nEVIDENCE:\n\nCLASSIFICATION: greenfield\nCLASSIFICATION_NOTE:\nn\n\nPITCH_ANGLE: a\nWHY_THEM: A standing audience.\nWHY_ME: You bring the frame.\nWHY_MUTUAL: Why you two, now.\n";
  const parsed = parseResearchResponse(text);
  assert.equal(parsed.whyThem, "A standing audience.");
  assert.equal(parsed.whyMe, "You bring the frame.");
  assert.equal(parsed.whyMutual, "Why you two, now.");
});

test("mergeResearchIntoLead writes why_* frontmatter only when present", () => {
  const header = "---\nkind: client\nname: \"Acme\"\nstatus: intake\n---\n";
  const body = "## Profile\n\n(none yet)\n\n## Evidence\n\n(none yet)\n\n## Classification\n\n(none yet)\n\n## Pitch\n\n(none yet)\n";
  const withWhy = mergeResearchIntoLead({ header, body, parsed: { profile: "p", evidenceBlock: "", evidence: [], disconfirmation: "", classification: "greenfield", classificationNote: "n", pitchAngle: "a", whyThem: "them", whyMe: "me", whyMutual: "mutual" } });
  assert.match(withWhy.header, /why_them: "them"/);
  assert.match(withWhy.header, /why_mutual: "mutual"/);
  const withoutWhy = mergeResearchIntoLead({ header, body, parsed: { profile: "p", evidenceBlock: "", evidence: [], disconfirmation: "", classification: "greenfield", classificationNote: "n", pitchAngle: "a" } });
  assert.ok(!/why_them/.test(withoutWhy.header));
});
