import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildClientPlatformDiscoveryPrompt,
  parseClientPlatformDiscoveryCandidates,
  buildContentExampleDiscoveryPrompt,
  parseContentExampleDiscoveryCandidates,
  computeDiscoveryBudget,
} from "./prompt.js";

describe("buildClientPlatformDiscoveryPrompt", () => {
  test("client kind: mentions turnaround/greenfield vocabulary and the exclude list", () => {
    const prompt = buildClientPlatformDiscoveryPrompt({
      kind: "client",
      theme: "AI-era career strategy",
      maxCandidates: 3,
      rubric: "RUBRIC TEXT",
      worldviewMap: "MAP TEXT",
      extraContext: "PERSON FIT TEXT",
      excludeNames: ["Acme Co"],
      searchBudgetPerSignal: 2,
    });
    assert.match(prompt, /turnaround, greenfield, unclear, disqualified/);
    assert.match(prompt, /Do NOT propose any of these -- already on file: Acme Co\./);
    assert.match(prompt, /AI-era career strategy/);
    assert.match(prompt, /RUBRIC TEXT/);
    assert.match(prompt, /PERSON FIT TEXT/);
    assert.match(prompt, /No em dashes anywhere/);
    assert.match(prompt, /Start with reflective founders or executives/i);
    assert.match(prompt, /research the company only after/i);
  });

  test("platform kind: mentions strong/partial/weak vocabulary, no person-fit step", () => {
    const prompt = buildClientPlatformDiscoveryPrompt({
      kind: "platform",
      theme: "civic tech",
      maxCandidates: 2,
      rubric: "PLATFORM RUBRIC",
      worldviewMap: "MAP TEXT",
      extraContext: "SPIN ANGLES TEXT",
      excludeNames: [],
      searchBudgetPerSignal: 2,
    });
    assert.match(prompt, /strong, partial, weak, disqualified/);
    assert.match(prompt, /None on file yet -- propose freely\./);
    assert.doesNotMatch(prompt, /Person-fit pass/);
    assert.match(prompt, /SPIN ANGLES TEXT/);
  });

  test("grounds each run in its rotated lens, anchor graph, pass feedback, and calibration", () => {
    const prompt = buildClientPlatformDiscoveryPrompt({
      kind: "platform",
      theme: "participatory technology",
      maxCandidates: 2,
      rubric: "platform rubric",
      worldviewMap: "worldview map",
      extraContext: "positioning",
      excludeNames: [],
      searchBudgetPerSignal: 2,
      lens: { belief: "systems should distribute agency", dialect: "civic tech", modality: "podcast" },
      anchorContext: "Anchor: Audrey Tang. Expand 1-2 public hops through co-appearance.",
      antiExamples: ["Big Generic Show: audience too large."],
      calibration: "platform pursue rate 10% (cold; tighten fit before searching)",
    });
    assert.match(prompt, /ACTIVE DISCOVERY LENS/);
    assert.match(prompt, /systems should distribute agency/);
    assert.match(prompt, /civic tech/);
    assert.match(prompt, /podcast/);
    assert.match(prompt, /Audrey Tang/);
    assert.match(prompt, /Big Generic Show: audience too large/);
    assert.match(prompt, /pursue rate 10%/);
  });
});

const CANDIDATE_BLOCK = [
  "CANDIDATE 1:",
  "NAME: Acme Co",
  "URL: https://acme.co",
  "PROFILE:",
  "Acme makes widgets.",
  "",
  "EVIDENCE:",
  '- E1 | signal: worldview-match | person: | source: https://acme.co/blog | quote: "we believe in people" | founder blog post',
  "",
  "DISCONFIRMATION:",
  "Nothing found against it.",
  "",
  "CLASSIFICATION: greenfield",
  "CLASSIFICATION_NOTE:",
  "Per E1, a real worldview match.",
  "",
  "PITCH_ANGLE: lead with the shared worldview",
  "CANDIDATE 2:",
  "NAME: Beta Inc",
  "URL: https://beta.example.com",
  "PROFILE:",
  "Beta does something else.",
  "",
  "EVIDENCE:",
  "(none found)",
  "",
  "DISCONFIRMATION:",
  "n/a",
  "",
  "CLASSIFICATION: unclear",
  "CLASSIFICATION_NOTE:",
  "No evidence found.",
  "",
  "PITCH_ANGLE: insufficient evidence for a pitch angle yet",
].join("\n");

describe("parseClientPlatformDiscoveryCandidates", () => {
  test("splits multiple CANDIDATE blocks and reuses parseResearchResponse per block", () => {
    const candidates = parseClientPlatformDiscoveryCandidates(CANDIDATE_BLOCK);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].name, "Acme Co");
    assert.equal(candidates[0].url, "https://acme.co");
    assert.equal(candidates[0].classification, "greenfield");
    assert.equal(candidates[0].evidence.length, 1);
    assert.equal(candidates[0].evidence[0].signal, "worldview-match");
    assert.equal(candidates[1].name, "Beta Inc");
    assert.equal(candidates[1].classification, "unclear");
  });

  test("a block with no NAME line is skipped, not thrown", () => {
    const text = "CANDIDATE 1:\nPROFILE:\nno name given\n";
    assert.deepEqual(parseClientPlatformDiscoveryCandidates(text), []);
  });

  test("empty response yields zero candidates", () => {
    assert.deepEqual(parseClientPlatformDiscoveryCandidates(""), []);
  });
});

const CE_BLOCK = [
  "CANDIDATE 1:",
  "NAME: Acme's Q3 pricing relaunch",
  "URL: https://acme.co/blog/pricing",
  "WHY:",
  "They bet usage-based pricing would grow revenue without churn.",
  "",
  "EVIDENCE:",
  '- E1 | signal: source-quote | person: | source: https://acme.co/blog/pricing | quote: "we are betting on usage-based pricing" | company blog',
  "",
  "ANGLE: the riskiest belief is that switching pricing models won't spike churn",
].join("\n");

describe("parseContentExampleDiscoveryCandidates", () => {
  test("parses a single candidate block", () => {
    const candidates = parseContentExampleDiscoveryCandidates(CE_BLOCK);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].name, "Acme's Q3 pricing relaunch");
    assert.equal(candidates[0].url, "https://acme.co/blog/pricing");
    assert.match(candidates[0].why, /usage-based pricing/);
    assert.equal(candidates[0].evidence.length, 1);
    assert.equal(candidates[0].evidence[0].signal, "source-quote");
    assert.match(candidates[0].angle, /churn/);
  });

  test("a block with no NAME line is skipped, not thrown", () => {
    assert.deepEqual(parseContentExampleDiscoveryCandidates("CANDIDATE 1:\nWHY:\nno name\n"), []);
  });
});

describe("computeDiscoveryBudget", () => {
  test("client: signalsPerCandidate=3 plus fixed proposal overhead", () => {
    assert.equal(computeDiscoveryBudget("client", 3, 2), 2 * (3 * 3 + 2));
  });
  test("platform: signalsPerCandidate=5", () => {
    assert.equal(computeDiscoveryBudget("platform", 2, 2), 2 * (2 * 5 + 2));
  });
  test("content-example: signalsPerCandidate=1", () => {
    assert.equal(computeDiscoveryBudget("content-example", 3, 2), 2 * (3 * 1 + 2));
  });
});

describe("buildContentExampleDiscoveryPrompt", () => {
  test("names the theme, exclude list, and never asks the model to name the riskiest belief", () => {
    const prompt = buildContentExampleDiscoveryPrompt({
      theme: "builder",
      maxCandidates: 3,
      excludeNames: ["Acme's Q3 pricing relaunch"],
      searchBudgetPerSignal: 2,
    });
    assert.match(prompt, /builder/);
    assert.match(prompt, /Do NOT propose any of these -- already on file: Acme's Q3 pricing relaunch\./);
    assert.match(prompt, /TENTATIVE/);
    assert.match(prompt, /a separate tool composes that analysis later/);
  });
});
