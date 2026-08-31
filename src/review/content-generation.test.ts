import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContentRequest } from "./content-request.js";
import { assertConfiguredTreatmentPolicy, buildConfiguredMediaOutputs, configuredColdFeedEditorPrompt, configuredContentPrompt, configuredDerivativeText, configuredSourceCtaLabel, configuredSourceSupportsCta, configuredSourceSegments, parseConfiguredEditorBodies, parseConfiguredVariantBodies, parseVentureConfiguredBodies, resolveConfiguredAuthoritative, resolveConfiguredProvenance, ventureConfiguredContentPrompt } from "./jobs.js";

const request = buildContentRequest({
  id: "request-1", origin: "studio", descriptor: "A useful idea", originalInput: "The exact source.",
  treatments: ["summary", "counterpoint"], media: ["image"], platforms: ["linkedin"], includeUntreatedControl: true,
  sourceProvenance: { kind: "source", sourceLines: [2], canonicalUrl: "https://www.humaninference.ai/essays/example" },
});
const treated = request.variants.filter((variant) => variant.identity.kind === "treated");

test("configured source CTA labels distinguish published Notes from essays", () => {
  assert.equal(configuredSourceCtaLabel("https://substack.com/@humaninference/note/c-321624538"), "Read the full note:");
  assert.equal(configuredSourceCtaLabel("https://www.humaninference.ai/essays/example"), "Read the full essay:");
  assert.equal(configuredSourceSupportsCta("https://substack.com/@humaninference/note/c-321624538"), false);
  assert.equal(configuredSourceSupportsCta("https://www.humaninference.ai/p/a-short-note", "substack-note"), false);
  assert.equal(configuredSourceSupportsCta("https://www.humaninference.ai/essays/example"), true);
});

test("configured drafting prompt carries every selected treated identity and preserves source/control separation", () => {
  const prompt = configuredContentPrompt(request, treated, [{ source_line: 2, text: "The exact source." }]);
  for (const variant of treated) assert.match(prompt, new RegExp(variant.identity.id));
  assert.match(prompt, /approved_source_lines/);
  assert.match(prompt, /The exact source\./);
  assert.match(prompt, /source-grounded rewrite/i);
  assert.match(prompt, /standalone/i);
  assert.match(prompt, /https:\/\/www\.humaninference\.ai\/essays\/example/);
  assert.match(prompt, /footnote/i);
  assert.match(prompt, /Capitalize the first word after every prose colon/);
  assert.match(prompt, /No em dashes/i);
  assert.match(prompt, /AI tells/i);
  assert.doesNotMatch(prompt, new RegExp(request.variants.find((variant) => variant.identity.kind === "control")!.identity.id));
});

test("configured source segments preserve exact source text and treated output fails closed on formatting and voice violations", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-voice-"));
  writeFileSync(join(folder, "source.md"), "Control stays exact.\nHere’s the thing. Bad treated line.\nBad dash — line.\n");
  assert.deepEqual(configuredSourceSegments(folder, [1, 2]), [
    { source_line: 1, text: "Control stays exact." },
    { source_line: 2, text: "Here’s the thing. Bad treated line." },
  ]);
  assert.throws(
    () => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, body: "Here’s the thing. Bad treated line.", source_lines: [2] }))), treated, folder, [1, 2, 3]),
    /AI tell/i,
  );
  assert.throws(
    () => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, body: "Bad dash — line.", source_lines: [3] }))), treated, folder, [1, 2, 3]),
    /em dash/i,
  );
  assert.throws(
    () => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, body: `The point: this starts wrong ${v.identity.id}.`, source_lines: [1] }))), treated, folder, [1, 2, 3]),
    /lowercase after a colon/i,
  );
});

test("untreated control serialization preserves the complete author body byte for byte", () => {
  const original = "# Heading\n\n  Deliberate spacing stays.  \nLast line without newline";
  const serialized = configuredDerivativeText("---\nvariant_kind: control\n---\n\n", original, true);
  assert.equal(serialized.slice(serialized.indexOf("\n\n") + 2), original);
});

test("configured drafting accepts grounded rewrites and rejects footnotes, duplicates, and forged provenance", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-provenance-"));
  writeFileSync(join(folder, "source.md"), "heading\nThe exact source.\nNot approved.\n");
  const output = JSON.stringify(treated.map((variant, index) => ({ id: variant.identity.id, body: `A standalone point ${index + 1}.`, source_lines: [2] })));
  const parsed = parseConfiguredVariantBodies(output, treated, folder, [2]);
  assert.equal(parsed.size, 2);
  assert.equal(parsed.get(treated[0]!.identity.id)?.body, "A standalone point 1.");
  assert.throws(() => parseConfiguredVariantBodies("[]", treated), /count/);
  const make = (body: string, refs: (number | string)[] = [2]) => JSON.stringify(treated.map((v, i) => ({ id: v.identity.id, body: `${body}${i}`, source_lines: refs })));
  assert.throws(() => parseConfiguredVariantBodies(make("Point.", [3]), treated, folder, [2]), /approved claim boundary/);
  assert.throws(() => parseConfiguredVariantBodies(make("Point.", []), treated, folder, [2]), /untraced/);
  assert.throws(() => parseConfiguredVariantBodies(make("Point.", [99]), treated, folder, [99]), /past the end/);
  assert.throws(() => parseConfiguredVariantBodies(make("Point [^6]."), treated, folder, [2]), /footnote/);
  const duplicate = JSON.stringify(treated.map((v) => ({ id: v.identity.id, body: "Same point.", source_lines: [2] })));
  assert.throws(() => parseConfiguredVariantBodies(duplicate, treated, folder, [2]), /duplicate treated body/);
});

test("treated variants may cite only a nonempty subset of approved refs", () => {
  const folder = mkdtempSync(join(tmpdir(), "configured-subset-"));
  writeFileSync(join(folder, "source.md"), "One\nTwo\nThree\nInvented boundary\n");
  const output = JSON.stringify(treated.map((variant, index) => ({ id: variant.identity.id, body: `Grounded rewrite ${index}.`, source_lines: [3, 1] })));
  const parsed = parseConfiguredVariantBodies(output, treated, folder, [1, 2, 3]);
  assert.equal(parsed.get(treated[0]!.identity.id)?.body, "Grounded rewrite 0.");
  assert.deepEqual(parsed.get(treated[0]!.identity.id)?.sourceLines, [3, 1]);
  assert.throws(() => parseConfiguredVariantBodies(JSON.stringify(treated.map((v) => ({ id: v.identity.id, body: v.identity.id, source_lines: [3, 4] }))), treated, folder, [1, 2, 3]), /approved claim boundary/);
});

test("cold-feed editor sees no source context and preserves provenance while enforcing voice and limits", () => {
  const originals = new Map(treated.map((variant, index) => [variant.identity.id, { body: `Original post ${index}.`, sourceLines: [2] as (number | string)[] }]));
  const prompt = configuredColdFeedEditorPrompt(treated, originals);
  assert.match(prompt, /rapidly scanning unrelated posts/i);
  assert.match(prompt, /immediately name the concrete subject/i);
  assert.doesNotMatch(prompt, /The exact source/);
  assert.doesNotMatch(prompt, /source_lines/);
  const output = JSON.stringify(treated.map((variant, index) => ({
    id: variant.identity.id,
    recommendation: "Name the concrete topic immediately.",
    body: `AI policy is the subject of this post ${index}.`,
  })));
  const edited = parseConfiguredEditorBodies(output, treated, originals);
  assert.deepEqual(edited.get(treated[0]!.identity.id)?.sourceLines, [2]);
  assert.equal(edited.get(treated[0]!.identity.id)?.body, "AI policy is the subject of this post 0.");
  assert.throws(() => parseConfiguredEditorBodies(JSON.stringify(treated.map((variant) => ({ id: variant.identity.id, recommendation: "Fix it.", body: "The point: this is unclear." }))), treated, originals), /lowercase after a colon/i);
  assert.throws(() => parseConfiguredEditorBodies(JSON.stringify(treated.map((variant) => ({ id: variant.identity.id, recommendation: "Fix it.", body: "Same edited post." }))), treated, originals), /duplicate cold-feed body/i);
  const overLimit = "x".repeat(3001);
  assert.throws(() => parseConfiguredEditorBodies(JSON.stringify(treated.map((variant, index) => ({ id: variant.identity.id, recommendation: "Fix it.", body: index ? `Distinct ${index}.` : overLimit }))), treated, originals), /character limit/i);
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
  assert.throws(
    () => parseVentureConfiguredBodies(JSON.stringify(ventureTreated.map((v) => ({ id: v.identity.id, body: "Here’s the thing — this unlocks a new paradigm." }))), ventureTreated),
    /voice check/i,
  );
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
