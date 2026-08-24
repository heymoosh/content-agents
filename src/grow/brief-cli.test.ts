import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGenerationBriefFromJson,
  main,
  parseGenerationBriefArgs,
  parseGenerationBriefRequest,
  renderGenerationBriefJson,
  renderGenerationBriefMarkdown,
  type GenerationBriefCliIo,
} from "./brief-cli.js";

const request = {
  sourceReference: "essay:human-inference/attention",
  substanceReference: "reference:essay:human-inference/attention",
  goal: "Test useful growth formats without flattening the idea.",
  platforms: ["x", "linkedin", "x"],
  formats: ["thread", "short-post", "thread"],
  mediaModes: ["video", "text", "video"],
  topicLanes: ["civic technology", "human inference", "civic technology"],
  patternTemplateRefs: ["hook:question-led", "hook:contrarian-observation", "hook:question-led"],
  experimentMatrix: {
    dimensions: [
      { name: "opening", options: ["question", "observation"] },
      { name: "cta", options: ["reply", "save"] },
    ],
  },
  platformFormatReadiness: [
    {
      platform: "linkedin",
      format: "short-post",
      readiness: { status: "ready", blockers: [] },
    },
    {
      platform: "x",
      format: "short-post",
      readiness: { status: "blocked", blockers: ["format is not reviewed"] },
    },
  ],
};

function json(value: unknown): string {
  return JSON.stringify(value);
}

test("builds the same body-free brief and renders the same output for reordered JSON input", () => {
  const first = buildGenerationBriefFromJson(json(request));
  const second = buildGenerationBriefFromJson(
    json({
      ...request,
      platforms: ["linkedin", "x"],
      formats: ["short-post", "thread"],
      mediaModes: ["text", "video"],
      topicLanes: ["human inference", "civic technology"],
      patternTemplateRefs: ["hook:contrarian-observation", "hook:question-led"],
      experimentMatrix: {
        dimensions: [
          { name: "cta", options: ["save", "reply"] },
          { name: "opening", options: ["observation", "question"] },
        ],
      },
    }),
  );

  assert.deepEqual(first, second);
  assert.equal(renderGenerationBriefJson(first), renderGenerationBriefJson(second));
  assert.deepEqual(JSON.parse(renderGenerationBriefJson(first)), first);
  assert.equal(first.generatesCopy, false);
  assert.equal(first.sideEffects, "none");
  assert.equal(Object.hasOwn(first, "body"), false);
  assert.deepEqual(first.humanGate, {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  });

  const markdown = renderGenerationBriefMarkdown(first);
  assert.match(markdown, /Human gate: pending before publish/);
  assert.match(markdown, /Common hook policy: template-madlib; common hooks allowed/);
  assert.match(markdown, /Creator body copy: forbidden/);
  assert.match(markdown, /format is not reviewed/);
  assert.match(markdown, /platform\/format readiness fact is absent/);
  assert.doesNotMatch(markdown, /source body|creator body text/i);
});

test("parses only an explicit JSON object and reports invalid input clearly", () => {
  assert.deepEqual(parseGenerationBriefRequest(json(request)), request);
  assert.throws(() => parseGenerationBriefRequest("{not-json"), /invalid generation brief JSON request/);
  assert.throws(() => parseGenerationBriefRequest("null"), /must be a JSON object/);
  assert.throws(() => parseGenerationBriefRequest("[]"), /must be a JSON object/);
  assert.throws(
    () => buildGenerationBriefFromJson(json({ ...request, goal: " " })),
    /goal must not be empty/,
  );
  assert.throws(
    () => parseGenerationBriefArgs(["--json", json(request), "--file", "request.json"]),
    /exactly one of --json or --file is allowed/,
  );
});

test("keeps absent and blocked readiness facts visible in the operator view", () => {
  const blocked = buildGenerationBriefFromJson(
    json({
      ...request,
      platforms: ["linkedin"],
      formats: ["short-post", "thread"],
      platformFormatReadiness: [
        {
          platform: "linkedin",
          format: "short-post",
          readiness: { status: "blocked", blockers: ["human review is pending", "human review is pending"] },
        },
      ],
    }),
  );

  const markdown = renderGenerationBriefMarkdown(blocked);
  assert.match(markdown, /Readiness: blocked/);
  assert.match(markdown, /linkedin \/ short-post: blocked \(human review is pending\)/);
  assert.match(markdown, /linkedin \/ thread: blocked \(platform\/format readiness fact is absent\)/);

  const factsOmitted = buildGenerationBriefFromJson(
    json({
      ...request,
      platformFormatReadiness: undefined,
    }),
  );
  assert.match(renderGenerationBriefMarkdown(factsOmitted), /Readiness facts: not supplied/);
});

test("reads a request file and writes the selected view only through injected IO", async () => {
  const reads: string[] = [];
  const writes: string[] = [];
  const io: GenerationBriefCliIo = {
    readFile: async (path) => {
      reads.push(path);
      return json(request);
    },
    write: (value) => {
      writes.push(value);
    },
  };

  const exitCode = await main(["--file", "request.json", "--format", "markdown"], io);

  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["request.json"]);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^# Generation brief:/);
});
