import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContentRequest } from "./content-request.js";
import { assertConfiguredTreatmentPolicy, buildConfiguredMediaOutputs, configuredContentPrompt, parseConfiguredVariantBodies, parseVentureConfiguredBodies, resolveConfiguredAuthoritative, resolveConfiguredProvenance, ventureConfiguredContentPrompt } from "./jobs.js";

const request = buildContentRequest({
  id: "request-1", origin: "studio", descriptor: "A useful idea", originalInput: "The exact source.",
  treatments: ["summary", "counterpoint"], media: ["image"], platforms: ["linkedin"], includeUntreatedControl: true,
  sourceProvenance: { kind: "source", sourceLines: [2] },
});
const treated = request.variants.filter((variant) => variant.identity.kind === "treated");

test("configured drafting prompt carries every selected treated identity and preserves source/control separation", () => {
  const prompt = configuredContentPrompt(request, treated);
  for (const variant of treated) assert.match(prompt, new RegExp(variant.identity.id));
  assert.match(prompt, /approved_source_lines/);
  assert.doesNotMatch(prompt, /The exact source\./);
  assert.doesNotMatch(prompt, new RegExp(request.variants.find((variant) => variant.identity.kind === "control")!.identity.id));
});

test("configured drafting reconstructs bodies from approved refs and rejects forged/out-of-bound provenance", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-provenance-"));
  writeFileSync(join(folder, "source.md"), "heading\nThe exact source.\nNot approved.\n");
  const output = JSON.stringify(treated.map((variant) => ({ id: variant.identity.id, source_lines: [2] })));
  const parsed = parseConfiguredVariantBodies(output, treated, folder, [2]);
  assert.equal(parsed.size, 2);
  assert.equal(parsed.get(treated[0]!.identity.id)?.body, "The exact source.");
  assert.throws(() => parseConfiguredVariantBodies("[]", treated), /count/);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, source_lines: [3] }))), treated, folder, [2]), /approved claim boundary/);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, source_lines: [] }))), treated, folder, [2]), /untraced/);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, source_lines: [99] }))), treated, folder, [99]), /past the end/);
});

test("treated variants may select and reorder only a nonempty subset of approved refs", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-subset-"));
  writeFileSync(join(folder, "source.md"), "One\nTwo\nThree\nInvented boundary\n");
  const output = JSON.stringify(treated.map((variant) => ({ id: variant.identity.id, source_lines: [3, 1] })));
  const parsed = parseConfiguredVariantBodies(output, treated, folder, [1, 2, 3]);
  assert.equal(parsed.get(treated[0]!.identity.id)?.body, "Three\n\nOne");
  assert.deepEqual(parsed.get(treated[0]!.identity.id)?.sourceLines, [3, 1]);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, source_lines: [3, 4] }))), treated, folder, [1, 2, 3]), /approved claim boundary/);
});

test("Fiction and Charles authoritative approved bodies win over arbitrary originalInput and carry restrictions", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-context-"));
  const fiction = buildContentRequest({
    id: "fiction", origin: "fiction", descriptor: "promo", originalInput: "UNAPPROVED prompt text", treatments: ["shorter"], platforms: ["substack"],
    sourceContext: { kind: "fiction-approved-promotion", authoritativeBody: "Approved fiction promotion.", series: { id: "s", title: "Series" }, chapter: { number: 1, title: "One" }, sourcePassages: [{ ref: "chapters/001.md#L1", text: "Passage", locked: true }], restrictions: { canon: ["no new canon"], provenance: ["locked passage only"] } },
  });
  const resolvedFiction = resolveConfiguredAuthoritative(folder, fiction)!;
  assert.equal(resolvedFiction.body, "Approved fiction promotion.");
  assert.doesNotMatch(resolvedFiction.body, /UNAPPROVED/);
  assert.deepEqual(resolvedFiction.restrictionRefs, ["no new canon", "locked passage only", "chapters/001.md#L1"]);
  assert.match(configuredContentPrompt(fiction, fiction.variants), /no new canon/);

  const charles = buildContentRequest({
    id: "charles", origin: "charles", descriptor: "post", originalInput: "UNAPPROVED thought", treatments: ["shorter"], platforms: ["substack"],
    sourceContext: { kind: "charles-approved-post", authoritativeBody: "Approved Charles post.", personaRef: "charles/config/persona.yaml", identity: "charles-lord-featherbottom", restrictions: ["no new leak claims"] },
  });
  const resolvedCharles = resolveConfiguredAuthoritative(folder, charles)!;
  assert.equal(resolvedCharles.body, "Approved Charles post.");
  assert.deepEqual(resolvedCharles.restrictionRefs, ["charles/config/persona.yaml", "charles-lord-featherbottom", "no new leak claims"]);
  assert.match(configuredContentPrompt(charles, charles.variants), /no new leak claims/);
  assert.throws(() => assertConfiguredTreatmentPolicy(fiction, fiction.variants.filter((v) => v.identity.kind === "treated")), /unavailable.*untreated control/i);
  assert.throws(() => assertConfiguredTreatmentPolicy(charles, charles.variants.filter((v) => v.identity.kind === "treated")), /unavailable.*untreated control/i);
  assert.doesNotThrow(() => assertConfiguredTreatmentPolicy(buildContentRequest({ ...fiction, treatments: [] }), []));
});

test("Venture treated variants use a dedicated engine-body contract with claim and voice restrictions", () => {
  const venture = buildContentRequest({
    id: "venture", origin: "venture", ventureId: "v1", descriptor: "approved probe", originalInput: "Approved source body.", treatments: ["shorter"], platforms: ["substack"],
    ventureSource: { artifactId: "p1", phase: 1, artifactKind: "text-post-note", messageId: "m1", bodyPath: "phase-1/p1.md", claimRefs: [{ claim: "Users asked for this", ref: "intake:q4" }], approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" } },
  });
  const ventureTreated = venture.variants.filter((v) => v.identity.kind === "treated");
  const prompt = ventureConfiguredContentPrompt(venture, ventureTreated);
  assert.match(prompt, /config\/voice\.yaml/);
  assert.match(prompt, /Never invent proof/);
  assert.match(prompt, /intake:q4/);
  const engineBody = "Engine-produced treatment of the approved claim.";
  const parsed = parseVentureConfiguredBodies(JSON.stringify(ventureTreated.map((v) => ({ id: v.identity.id, body: engineBody }))), ventureTreated);
  assert.equal(parsed.get(ventureTreated[0]!.identity.id)?.body, engineBody);
  assert.notEqual(parsed.get(ventureTreated[0]!.identity.id)?.body, venture.originalInput);
  assert.throws(() => parseVentureConfiguredBodies(JSON.stringify(ventureTreated.map((v) => ({ id: v.identity.id, body: engineBody, source_lines: [1] }))), ventureTreated), /malformed/);
});

test("authoritative resolution fails closed on missing or forged source/cut provenance", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-source-"));
  writeFileSync(join(folder, "source.md"), "heading\nThe exact source.\n");
  assert.equal(resolveConfiguredProvenance(folder, request).body, "The exact source.");
  assert.throws(() => resolveConfiguredProvenance(folder, buildContentRequest({ ...request, sourceProvenance: null })), /requires authoritative/);
  assert.throws(() => resolveConfiguredProvenance(folder, buildContentRequest({ ...request, originalInput: "forged" })), /does not match/);
  mkdirSync(join(folder, "cuts", "angle"), { recursive: true });
  writeFileSync(join(folder, "cuts", "angle", "cut.md"), "---\nsource_lines: [2]\n---\n\nforged\n");
  const cut = buildContentRequest({ ...request, sourceProvenance: { kind: "approved-cut", lens: "angle", sourceLines: [2] } });
  assert.throws(() => resolveConfiguredProvenance(folder, cut), /does not match/);
});

test("configured generation preflights media inputs and never invents missing final assets", () => {
  const supported = buildContentRequest({
    id: "supported", origin: "studio", descriptor: "source", originalInput: "Source.",
    treatments: [], platforms: ["linkedin"], media: ["static-quote-card", "short-video-script"],
    sourceProvenance: { kind: "source", sourceLines: [1] },
  });
  const outputs = buildConfiguredMediaOutputs(supported.variants);
  assert.equal(outputs.length, 2);
  assert.equal(outputs[0]!.queue.asset.startsWith("media-stages/"), true);
  assert.equal(outputs[0]!.record.stage, "render-required");
  assert.deepEqual(outputs[1]!.queue, { format: "storyboard", asset: `media-stages/${outputs[1]!.id}.json` });
  assert.equal(outputs[1]!.record.stage, "storyboard-required");
  assert.equal(outputs.every((output) => output.record.status === "staged"), true);

  const plans = buildContentRequest({
    id: "plans", origin: "studio", descriptor: "source", originalInput: "Source.",
    treatments: [], platforms: ["linkedin"], media: ["image", "image-carousel"],
    sourceProvenance: { kind: "source", sourceLines: [1] },
  });
  const planOutputs = buildConfiguredMediaOutputs(plans.variants);
  assert.equal(planOutputs.every((output) => output.queue.asset.startsWith("media-stages/")), true);
  assert.equal(planOutputs.every((output) => output.record.outputPath === undefined), true);

  const needsAudio = buildContentRequest({
    id: "audio", origin: "studio", descriptor: "source", originalInput: "Source.",
    treatments: [], platforms: ["linkedin"], media: ["audiogram"],
    sourceProvenance: { kind: "source", sourceLines: [1] },
  });
  assert.throws(() => buildConfiguredMediaOutputs(needsAudio.variants), /requires a source audio file/i);
  assert.doesNotThrow(() => buildConfiguredMediaOutputs(needsAudio.variants, { sourceAudioPath: "incoming/source.wav" }));

  const twoVideos = buildContentRequest({
    id: "two-videos", origin: "studio", descriptor: "source", originalInput: "Source.",
    treatments: ["shorter"], platforms: ["linkedin"], media: ["short-video-script"],
    sourceProvenance: { kind: "source", sourceLines: [1] },
  });
  assert.throws(() => buildConfiguredMediaOutputs(twoVideos.variants), /one staged script.*folder-scoped/);
});
