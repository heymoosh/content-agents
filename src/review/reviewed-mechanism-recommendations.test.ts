import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { repoRoot } from "../db/db.js";
import {
  assertReviewedMechanismGenerationAuthorization,
  readReviewedMechanismRecommendations,
  containsPersonalBeliefReversal,
  reviewedMechanismRecommendations,
} from "./reviewed-mechanism-recommendations.js";
import { buildContentRequest } from "./content-request.js";

const dossierPath = join(repoRoot, "docs", "reviews", "content-studio-phase2-used-to-think-final-dossier.json");
const canonical = JSON.parse(readFileSync(dossierPath, "utf8"));

describe("reviewed mechanism recommendations", () => {
  test("recommends the approved belief-shift treatment only for a genuine first-person reversal", () => {
    const recommendations = reviewedMechanismRecommendations(
      "I used to think civic participation was mostly voting. Now I believe the smaller repeated acts matter more.",
      [canonical],
    );
    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0]?.option, "belief-shift");
    assert.equal(recommendations[0]?.kind, "treatment");
    assert.equal(recommendations[0]?.recommended, true);
    assert.match(recommendations[0]?.source ?? "", /^research-dossier:sha256:/);
    assert.match(recommendations[0]?.reason ?? "", /reviewed hypothesis/i);
    assert.match(recommendations[0]?.reason ?? "", /does not claim.*improves/i);
  });

  test("does not force the mechanism onto a source without both sides of a personal belief change", () => {
    assert.deepEqual(reviewedMechanismRecommendations("Many people used to think this. The evidence is complicated.", [canonical]), []);
    assert.deepEqual(reviewedMechanismRecommendations("I used to think this was simple.", [canonical]), []);
    assert.deepEqual(reviewedMechanismRecommendations("Now I believe this is worth testing.", [canonical]), []);
    for (const unrelated of [
      "I thought it would rain. But I brought an umbrella.",
      "I used to think this was simple. Now I work elsewhere.",
      "I believed the meeting was today. Today I opened the calendar.",
    ]) {
      assert.equal(containsPersonalBeliefReversal(unrelated), false, unrelated);
      assert.deepEqual(reviewedMechanismRecommendations(unrelated, [canonical]), []);
    }
    assert.equal(containsPersonalBeliefReversal("Now I believe replies matter. I used to think reach mattered."), false);
  });

  test("rejects a forged, stale, or non-hypothesis dossier instead of turning it into a recommendation", () => {
    assert.throws(
      () => reviewedMechanismRecommendations("I used to think one thing. Now I believe another.", [{ ...canonical, digest: `sha256:${"0".repeat(64)}` }]),
      /dossier|digest|canonical/i,
    );
    assert.throws(
      () => reviewedMechanismRecommendations("I used to think one thing. Now I believe another.", [{ ...canonical, usabilityDecision: { ...canonical.usabilityDecision, disposition: "observation" } }]),
      /dossier|digest|canonical|hypothesis/i,
    );
  });

  test("the production reader replays the retained reviewed dossier", () => {
    const recommendations = readReviewedMechanismRecommendations(
      "I once believed attention was the same thing as trust. I now believe repeated useful contact is the stronger signal.",
    );
    assert.equal(recommendations[0]?.option, "belief-shift");
  });

  test("generation replays canonical authorization from the persisted request", () => {
    const body = "I used to think reach was the goal. Now I believe replies are the useful signal.";
    const evidence = readReviewedMechanismRecommendations(body);
    const request = buildContentRequest({
      id: "authorized-belief-shift", origin: "human-inference", descriptor: "A change of mind", originalInput: body,
      treatments: ["belief-shift"], media: [], platforms: ["linkedin"], recommendationEvidence: evidence,
      sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [1] },
    });
    assert.doesNotThrow(() => assertReviewedMechanismGenerationAuthorization(request, body));
    const missing = buildContentRequest({
      id: "missing-evidence", origin: "human-inference", descriptor: "A change of mind", originalInput: body,
      treatments: ["belief-shift"], media: [], platforms: ["linkedin"],
      sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [1] },
    });
    assert.throws(() => assertReviewedMechanismGenerationAuthorization(missing, body), /persisted belief-shift evidence.*canonical|canonical.*authorization/i);
    const forged = buildContentRequest({
      id: "forged-evidence", origin: "human-inference", descriptor: "A change of mind", originalInput: body,
      treatments: ["belief-shift"], media: [], platforms: ["linkedin"],
      recommendationEvidence: [{ ...evidence[0]!, reason: "forged winner claim" }],
      sourceProvenance: { kind: "approved-cut", lens: "belief-audit", sourceLines: [1] },
    });
    assert.throws(() => assertReviewedMechanismGenerationAuthorization(forged, body), /does not match canonical/i);
  });
});
