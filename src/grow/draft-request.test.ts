import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftRequestFromJson,
  main,
  renderDraftRequest,
  renderDraftRequestMarkdown,
  type DraftRequestCliIo,
} from "./draft-request-cli.js";
import {
  createDraftRequest,
  type DraftRequestInput,
} from "./draft-request.js";

const baseInput: DraftRequestInput = {
  id: "draft-request-1",
  sourceThoughtRef: "thought:human-inference-1",
  sourceArtifactRef: "artifact:essay-1",
  platform: "linkedin",
  medium: "text",
  format: "short-post",
  treatmentRef: "treatment:observation-led",
  hookTemplateRefs: ["hook:common-contrarian"],
  experimentRefs: ["experiment:opening-1"],
  voicePolicyRef: "voice:muxin-1",
  expectedOutputArtifactRef: "artifact:draft-request-1-output",
  treatment: {
    platform: "linkedin",
    medium: "text",
    format: "short-post",
    treatmentRef: "treatment:observation-led",
    hookTemplateRefs: ["hook:common-contrarian"],
    experimentRefs: ["experiment:opening-1"],
  },
  lineage: {
    sourceThoughtRef: "thought:human-inference-1",
    sourceArtifactRef: "artifact:essay-1",
    generationBriefRef: "brief:human-inference-1",
    volumePlanRef: "volume:human-inference-1",
    treatmentCoverageRef: "coverage:human-inference-1",
    expectedOutputArtifactRef: "artifact:draft-request-1-output",
  },
  humanReview: {
    status: "pending",
  },
};

function input(overrides: Partial<DraftRequestInput> = {}): DraftRequestInput {
  return {
    ...baseInput,
    ...overrides,
    treatment: { ...baseInput.treatment, ...(overrides.treatment ?? {}) },
    lineage: { ...baseInput.lineage, ...(overrides.lineage ?? {}) },
    humanReview: { ...baseInput.humanReview, ...(overrides.humanReview ?? {}) },
  };
}

test("builds a deterministic request with exact treatment identity and lineage", () => {
  const first = createDraftRequest(input({
    hookTemplateRefs: ["hook:common-contrarian", "hook:question-led"],
    experimentRefs: ["experiment:opening-2", "experiment:opening-1"],
    treatment: {
      ...baseInput.treatment,
      hookTemplateRefs: ["hook:question-led", "hook:common-contrarian"],
      experimentRefs: ["experiment:opening-1", "experiment:opening-2"],
    },
  }));
  const second = createDraftRequest(input({
    hookTemplateRefs: ["hook:question-led", "hook:common-contrarian"],
    experimentRefs: ["experiment:opening-1", "experiment:opening-2"],
    treatment: {
      ...baseInput.treatment,
      hookTemplateRefs: ["hook:common-contrarian", "hook:question-led"],
      experimentRefs: ["experiment:opening-2", "experiment:opening-1"],
    },
  }));

  assert.deepEqual(first, second);
  assert.equal(first.kind, "grow_draft_request");
  assert.equal(first.version, "grow-draft-request-v1");
  assert.deepEqual(first.identity, {
    platform: "linkedin",
    medium: "text",
    format: "short-post",
    treatmentRef: "treatment:observation-led",
    hookTemplateRefs: ["hook:common-contrarian", "hook:question-led"],
    experimentRefs: ["experiment:opening-1", "experiment:opening-2"],
  });
  assert.deepEqual(first.lineage, baseInput.lineage);
  assert.deepEqual(first.blockers, ["human review is pending"]);
  assert.equal(first.readiness.status, "blocked");
});

test("allows common hook mad-lib adaptation but forbids creator body reuse", () => {
  const request = createDraftRequest(input());

  assert.deepEqual(request.templateReusePolicy, {
    mode: "template-madlib",
    commonSocialHooks: "allowed",
    creatorBodyCopy: "forbidden",
  });
  assert.equal(request.generatesCopy, false);
  assert.equal(request.creatorBodyCopyAllowed, false);
  assert.equal(request.sideEffects, "none");
  assert.equal(request.modelBoundary.modelInvocation, "deferred");
  assert.equal(request.modelBoundary.sideEffects, "none");
  assert.equal(request.modelBoundary.boundaries.composesBody, false);
  assert.equal(request.modelBoundary.boundaries.commonHookMadLibAllowed, true);
  assert.equal(request.modelBoundary.boundaries.creatorBodyCopyAllowed, false);
  const serialized = JSON.stringify(request);
  assert.doesNotMatch(serialized, /"(?:body|sourceSubstance|creatorBody|modelOutput|promptBody|ranking|winner)"\s*:/i);
  assert.equal(Object.hasOwn(request, "autoApproval"), false);
  assert.equal(Object.hasOwn(request, "autoScheduling"), false);
  assert.equal(Object.hasOwn(request, "autoPublishing"), false);
});

test("fails closed when any required reference or identity field is missing", () => {
  const missing: Array<[string, () => DraftRequestInput]> = [
    ["source thought", () => input({ sourceThoughtRef: "" })],
    ["source artifact", () => input({ sourceArtifactRef: "" })],
    ["platform", () => input({ platform: "" })],
    ["medium", () => input({ medium: "" })],
    ["format", () => input({ format: "" })],
    ["treatment", () => input({ treatmentRef: "" })],
    ["hook template", () => input({ hookTemplateRefs: [] })],
    ["experiment", () => input({ experimentRefs: [] })],
    ["voice policy", () => input({ voicePolicyRef: "" })],
    ["expected artifact", () => input({ expectedOutputArtifactRef: "" })],
    ["generation brief", () => input({ lineage: { ...baseInput.lineage, generationBriefRef: "" } })],
    ["volume plan", () => input({ lineage: { ...baseInput.lineage, volumePlanRef: "" } })],
    ["treatment coverage", () => input({ lineage: { ...baseInput.lineage, treatmentCoverageRef: "" } })],
  ];

  for (const [label, build] of missing) {
    assert.throws(() => createDraftRequest(build()), /required|must not be empty|must not be empty/, label);
  }
});

test("rejects body-bearing fields instead of silently dropping them", () => {
  for (const field of ["body", "sourceSubstance", "creatorBody", "modelOutput", "promptBody", "ranking", "winner", "autoApproval", "autoScheduling", "autoPublishing", "modelInvocation"]) {
    const bodyBearing = { ...input(), [field]: field === "ranking" ? 1 : "forbidden" } as unknown as DraftRequestInput;
    assert.throws(() => createDraftRequest(bodyBearing), /unsupported field/, field);
  }
});

test("rejects platform and treatment identity drift", () => {
  assert.throws(
    () => createDraftRequest(input({ treatment: { ...baseInput.treatment, platform: "x" } })),
    /treatment platform.*match.*platform|identity.*platform/i,
  );
  assert.throws(
    () => createDraftRequest(input({ treatment: { ...baseInput.treatment, treatmentRef: "treatment:other" } })),
    /treatment ref.*match|identity.*treatment/i,
  );
  assert.throws(
    () => createDraftRequest(input({ lineage: { ...baseInput.lineage, sourceArtifactRef: "artifact:other" } })),
    /lineage.*source artifact|sourceArtifactRef.*match/i,
  );
});

test("requires an explicit human decision and fails closed for pending or rejected review", () => {
  const pending = createDraftRequest(input());
  assert.deepEqual(pending.humanReview, {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    reason: null,
  });
  assert.equal(pending.readiness.status, "blocked");

  const rejected = createDraftRequest(input({ humanReview: { status: "rejected", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z", reason: "Needs a clearer claim." } }));
  assert.equal(rejected.humanReview.status, "rejected");
  assert.equal(rejected.readiness.status, "blocked");
  assert.ok(rejected.blockers.includes("human review is rejected"));

  const approved = createDraftRequest(input({ humanReview: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" } }));
  assert.equal(approved.humanReview.status, "approved");
  assert.equal(approved.readiness.status, "ready");
  assert.deepEqual(approved.blockers, []);
  assert.throws(
    () => createDraftRequest(input({ blockers: ["voice policy pending"], humanReview: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" } })),
    /approval is blocked/i,
  );
  assert.throws(
    () => createDraftRequest(input({ humanReview: { status: "rejected" } })),
    /rejected.*requires.*reason|decidedBy|decidedAt/i,
  );
});

test("preserves caller blockers without inferring readiness or release actions", () => {
  const request = createDraftRequest(input({ blockers: ["format review pending", "source review pending"] }));

  assert.deepEqual(request.blockers, ["format review pending", "human review is pending", "source review pending"]);
  assert.deepEqual(request.readiness, {
    status: "blocked",
    blockers: request.blockers,
  });
  assert.equal(Object.hasOwn(request, "autoApproval"), false);
  assert.equal(Object.hasOwn(request, "autoScheduling"), false);
  assert.equal(Object.hasOwn(request, "autoPublishing"), false);
});

test("renders deterministic JSON and Markdown through injected IO", async () => {
  const approvedInput = input({ humanReview: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" } });
  const first = buildDraftRequestFromJson(JSON.stringify(approvedInput));
  const second = buildDraftRequestFromJson(JSON.stringify({ ...approvedInput }));
  assert.deepEqual(first, second);
  assert.equal(renderDraftRequest(first, "json"), `${JSON.stringify(first, null, 2)}\n`);
  const markdown = renderDraftRequestMarkdown(first);
  assert.match(markdown, /^# Draft request/m);
  assert.match(markdown, /linkedin/);
  assert.match(markdown, /treatment:observation-led/);
  assert.match(markdown, /Human review: approved/);
  assert.doesNotMatch(markdown, /human inference starts|source body|creator body text/i);

  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const io: DraftRequestCliIo = {
    readFile: async (path) => { reads.push(path); return JSON.stringify(approvedInput); },
    write: (value) => { writes.push(value); },
    error: (value) => { errors.push(value); },
  };
  const exitCode = await main(["--file", "draft-request.json", "--format", "markdown"], io);
  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["draft-request.json"]);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^# Draft request/);
  assert.deepEqual(errors, []);
});

test("CLI fails closed for malformed JSON and unsupported body fields", () => {
  assert.throws(() => buildDraftRequestFromJson("not-json"), /valid JSON/);
  assert.throws(() => buildDraftRequestFromJson(JSON.stringify({ ...input(), body: "forbidden" })), /unsupported field/);
});
