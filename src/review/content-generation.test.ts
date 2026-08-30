import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentRequest } from "./content-request.js";
import { configuredContentPrompt, parseConfiguredVariantBodies } from "./jobs.js";

const request = buildContentRequest({
  id: "request-1", origin: "studio", descriptor: "A useful idea", originalInput: "The exact source.",
  treatments: ["summary", "counterpoint"], media: ["image"], platforms: ["linkedin"], includeUntreatedControl: true,
});
const treated = request.variants.filter((variant) => variant.identity.kind === "treated");

test("configured drafting prompt carries every selected treated identity and preserves source/control separation", () => {
  const prompt = configuredContentPrompt(request, treated);
  for (const variant of treated) assert.match(prompt, new RegExp(variant.identity.id));
  assert.match(prompt, /The exact source\./);
  assert.doesNotMatch(prompt, new RegExp(request.variants.find((variant) => variant.identity.kind === "control")!.identity.id));
});

test("configured drafting accepts exactly one nonempty body per requested treated variant", () => {
  const output = JSON.stringify(treated.map((variant) => ({ id: variant.identity.id, body: `Draft for ${variant.treatments[0]}` })));
  const parsed = parseConfiguredVariantBodies(output, treated);
  assert.equal(parsed.size, 2);
  assert.throws(() => parseConfiguredVariantBodies("[]", treated), /count/);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify([{ id: "unknown", body: "x" }, { id: treated[1]!.identity.id, body: "y" }]), treated), /unknown/);
});
