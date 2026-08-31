import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readQueue } from "../publish/queue.js";
import { readContentRequest } from "../review/content-request-store.js";
import { buildContentRequest, type ContentRequestInput } from "../review/content-request.js";
import { signalsExperimentRecommendation } from "./experiment-test-fixtures.js";
import {
  applyApprovedExperimentToContent,
  approveExperimentPlan,
  buildExperimentPlan,
  rankExperimentPlans,
} from "./experiment-content-handoff.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function contentInput(id: string): ContentRequestInput {
  return {
    id,
    origin: "human-inference",
    descriptor: "A bounded opening experiment",
    originalInput: "Trying to respond when society is broken can feel like volunteering for more disappointment.",
    treatments: ["summary"],
    media: ["none"],
    platforms: ["linkedin"],
    includeUntreatedControl: true,
    sourceProvenance: { kind: "approved-cut", lens: "action", sourceLines: [5] },
  };
}

function plan(id: string, confidence: "low" | "medium" | "high") {
  const request = buildContentRequest(contentInput(id));
  const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
  const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
  const recommendation = { ...signalsExperimentRecommendation({ variantId, comparisonRef, minimumSample: 10 }), id: `signals-rec:${id}`, confidence };
  return buildExperimentPlan({ recommendation, contentRequest: contentInput(id), variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])) });
}

describe("Signals plan to canonical Content handoff", () => {
  test("ranks high confidence first and defers low-confidence generation", () => {
    const ranked = rankExperimentPlans([plan("low", "low"), plan("high", "high"), plan("medium", "medium")]);
    assert.deepEqual(ranked.ready.map((item) => item.contentRequest.id), ["high", "medium"]);
    assert.deepEqual(ranked.deferred.map((item) => item.contentRequest.id), ["low"]);
    assert.match(ranked.deferred[0]!.priorityReason, /low confidence/i);
  });

  test("plan approval is body-free authority to draft, never copy approval", () => {
    const proposal = plan("approved-plan", "high");
    const decision = approveExperimentPlan(proposal, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    assert.equal(decision.authorizesGeneration, true);
    assert.equal(decision.authorizesCopyApproval, false);
    assert.equal(JSON.stringify(proposal).includes("editor_pass"), false);
    assert.throws(() => approveExperimentPlan(proposal, { status: "approved", decidedBy: "system" as "muxin", decidedAt: "2026-08-31T18:00:00.000Z" }), /Muxin/i);
  });

  test("approved plans use the normal generator and land experiment-tagged drafts pending in Content", async () => {
    const parent = await mkdtemp(join(tmpdir(), "experiment-content-")); roots.push(parent);
    const root = join(parent, "approved-plan"); await mkdir(root);
    await mkdir(join(root, "cuts", "action"), { recursive: true });
    await writeFile(join(root, "source.md"), "---\ntitle: Source\n---\n\nTrying to respond when society is broken can feel like volunteering for more disappointment.\n");
    await writeFile(join(root, "cuts", "action", "cut.md"), "---\nsource_lines: [5]\n---\n\nTrying to respond when society is broken can feel like volunteering for more disappointment.\n");
    await writeFile(join(root, "review-queue.md"), "| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n");
    const proposal = plan("approved-plan", "high");
    const decision = approveExperimentPlan(proposal, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    const generated: string[] = [];
    const result = await applyApprovedExperimentToContent(root, proposal, decision, {
      generate: async (_slug, request) => {
        generated.push(request.experiment!.id);
        await mkdir(join(root, "derivatives"), { recursive: true });
        const rows = request.variants.map((variant) => `| ${variant.identity.id} | ${variant.platform} | text | derivatives/${variant.identity.id}.md | | | | pending | Experiment: ${request.experiment!.id} | from GUI queue |`).join("\n");
        await writeFile(join(root, "review-queue.md"), `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n${rows}\n`);
        for (const variant of request.variants) await writeFile(join(root, "derivatives", `${variant.identity.id}.md`), `---\nexperiment_id: ${JSON.stringify(request.experiment!.id)}\n---\n\nDraft.\n`);
        return { ids: request.variants.map((variant) => variant.identity.id) };
      },
    });
    assert.deepEqual(generated, [proposal.recommendation.id]);
    assert.equal(result.copyApproval, "pending-in-content");
    const stored = await readContentRequest(root);
    assert.equal(stored.experiment?.id, proposal.recommendation.id);
    assert.equal(stored.experiment?.planDecisionDigest, decision.digest);
    assert.equal(readQueue(root).rows.every((row) => row.status === "pending"), true);
    assert.match(await readFile(join(root, "derivatives", `${stored.variants[0]!.identity.id}.md`), "utf8"), /experiment_id/);
  });

  test("multiple approved experiments remain independent instead of using a singleton lock", async () => {
    const first = plan("experiment-a", "high"), second = plan("experiment-b", "medium");
    const firstDecision = approveExperimentPlan(first, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    const secondDecision = approveExperimentPlan(second, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:01:00.000Z" });
    assert.notEqual(first.recommendation.id, second.recommendation.id);
    assert.notEqual(firstDecision.digest, secondDecision.digest);
  });

  test("revalidates the approved cut before spending generation work", async () => {
    const parent = await mkdtemp(join(tmpdir(), "experiment-content-forged-")); roots.push(parent);
    const root = join(parent, "forged-source"); await mkdir(join(root, "cuts", "action"), { recursive: true });
    await writeFile(join(root, "source.md"), "---\ntitle: Source\n---\n\nAuthoritative sentence.\n");
    await writeFile(join(root, "cuts", "action", "cut.md"), "---\nsource_lines: [5]\n---\n\nDifferent sentence.\n");
    const proposal = plan("forged-source", "high");
    const decision = approveExperimentPlan(proposal, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    let generated = false;
    await assert.rejects(
      () => applyApprovedExperimentToContent(root, proposal, decision, { generate: async () => { generated = true; return { ids: [] }; } }),
      /does not match its cited source_lines/i,
    );
    assert.equal(generated, false);
  });
});
