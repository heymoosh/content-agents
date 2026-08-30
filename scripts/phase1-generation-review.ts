import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildContentRequest, type ContentRequest, type ContentVariant } from "../src/review/content-request.js";
import { configuredMediaPlan, configuredMediaStage, CONFIGURED_MEDIA } from "../src/review/configured-media.js";
import { buildEngineSpawn, type Engine } from "../src/review/engines.js";

// Importing the production jobs module initializes its durable job paths. Keep this review harness
// hermetic by selecting a disposable runtime root before that module is evaluated.
process.env.CONTENT_AGENTS_DATA_ROOT ??= mkdtempSync(join(tmpdir(), "phase1-generation-review-state-"));
const {
  assertConfiguredTreatmentPolicy,
  configuredContentPrompt,
  parseConfiguredVariantBodies,
  parseVentureConfiguredBodies,
  resolveConfiguredProvenance,
  ventureConfiguredContentPrompt,
} = await import("../src/review/jobs.js");

const outputPath = resolve(process.argv[2] ?? "docs/reviews/content-studio-phase1-generation-review.html");
const generatedAt = new Date().toISOString();
const engine: Engine = process.env.PHASE1_REVIEW_ENGINE === "ollama-gpt-oss" ? "ollama-gpt-oss" : "codex";

const approvedLines = [
  "A product team can automate a task long before it understands whether the task is worth doing.",
  "The hard part is usually not execution. It is deciding what good looks like and what evidence would change the decision.",
  "That means an AI rollout should begin with a judgment map, not a list of tools.",
  "Write down the decisions people make, the evidence they use, and the cost of being wrong.",
  "Then automate the work around those decisions without pretending the judgment disappeared.",
  "The goal is not more automation. The goal is better decisions with less mechanical work around them.",
];

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runEngine(prompt: string): { output: string; version: string } {
  const timeoutMs = engine === "ollama-gpt-oss" ? 600_000 : 180_000;
  const built = buildEngineSpawn(engine, prompt, { timeoutMs, sandbox: "read-only" });
  const result = spawnSync(built.command, built.args, {
    cwd: resolve("."),
    input: built.input,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${engine} exited ${result.status}: ${result.stderr.trim()}`);
  const version = engine === "codex"
    ? spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout.trim()
    : `local ${spawnSync("ollama", ["--version"], { encoding: "utf8" }).stdout.trim()} · gpt-oss:20b`;
  return { output: result.stdout.trim(), version };
}

function variantLabel(variant: ContentVariant): string {
  const treatment = variant.treatments.length ? variant.treatments.join(", ") : "untreated control";
  return `${variant.platform} · ${treatment}`;
}

function cards(items: readonly { title: string; eyebrow: string; body: string; meta?: string }[]): string {
  return items.map((item) => `
    <article class="card">
      <div class="eyebrow">${escapeHtml(item.eyebrow)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="copy">${escapeHtml(item.body).replaceAll("\n", "<br>")}</div>
      ${item.meta ? `<div class="meta">${escapeHtml(item.meta)}</div>` : ""}
    </article>`).join("");
}

function policyError(request: ContentRequest): string {
  try {
    assertConfiguredTreatmentPolicy(request, request.variants.filter((variant) => variant.identity.kind === "treated"));
    return "Unexpectedly allowed";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const folder = mkdtempSync(join(tmpdir(), "phase1-generation-review-"));
writeFileSync(join(folder, "source.md"), approvedLines.join("\n") + "\n");
const lineRefs = approvedLines.map((_, index) => index + 1);
const approvedBody = approvedLines.join("\n\n");
mkdirSync(join(folder, "cuts", "human-judgment"), { recursive: true });
writeFileSync(
  join(folder, "cuts", "human-judgment", "cut.md"),
  `---\nsource_lines: [${lineRefs.join(", ")}]\n---\n\n${approvedBody}\n`,
);

const ordinary = buildContentRequest({
  id: "phase1-review-ordinary",
  origin: "studio",
  descriptor: "Synthetic approved thesis cut for Phase 1 review",
  originalInput: approvedBody,
  treatments: ["shorter", "lead with the counterintuitive claim"],
  media: [],
  platforms: ["linkedin", "x"],
  includeUntreatedControl: true,
  sourceProvenance: { kind: "approved-cut", lens: "human-judgment", sourceLines: lineRefs },
});
const ordinaryTreated = ordinary.variants.filter((variant) => variant.identity.kind === "treated");
resolveConfiguredProvenance(folder, ordinary);
const ordinaryRun = runEngine(configuredContentPrompt(ordinary, ordinaryTreated));
const ordinaryBodies = parseConfiguredVariantBodies(ordinaryRun.output, ordinaryTreated, folder, lineRefs);
const ordinaryCards = ordinary.variants.map((variant) => {
  const generated = variant.identity.kind === "control"
    ? { body: approvedBody, sourceLines: lineRefs }
    : ordinaryBodies.get(variant.identity.id)!;
  return {
    title: variantLabel(variant),
    eyebrow: variant.identity.kind === "control" ? "Control" : `${engine}-selected extraction`,
    body: generated.body,
    meta: `source_lines: [${generated.sourceLines.join(", ")}] · pending review`,
  };
});

const ventureBody = [
  "Teams in this review fixture can automate scoped work, but they still struggle to decide what is worth building.",
  "The proposed test is a short field guide that helps a product team separate execution work from judgment work before it automates anything.",
  "The only promised outcome is a clearer map of the decisions the team still owns.",
].join("\n\n");
const venture = buildContentRequest({
  id: "phase1-review-venture",
  origin: "venture",
  ventureId: "phase1-review-fixture",
  descriptor: "Representative approved Venture probe",
  originalInput: ventureBody,
  treatments: ["shorter", "open with the practical tension"],
  media: [],
  platforms: ["linkedin", "substack"],
  includeUntreatedControl: true,
  ventureSource: {
    artifactId: "review-probe-1",
    phase: 1,
    artifactKind: "text-post-note",
    messageId: "review-message-1",
    bodyPath: "phase-1/review-probe-1.md",
    claimRefs: [
      { claim: "Scoped work and judgment gap", ref: "synthetic-review-fixture:claim-1" },
      { claim: "Field-guide test and promised outcome", ref: "synthetic-review-fixture:claim-2" },
    ],
    approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
  },
});
const ventureTreated = venture.variants.filter((variant) => variant.identity.kind === "treated");
const ventureRun = runEngine(ventureConfiguredContentPrompt(venture, ventureTreated));
const ventureBodies = parseVentureConfiguredBodies(ventureRun.output, ventureTreated);
const ventureCards = venture.variants.map((variant) => ({
  title: variantLabel(variant),
  eyebrow: variant.identity.kind === "control" ? "Control" : `${engine}-composed Venture treatment`,
  body: variant.identity.kind === "control" ? ventureBody : ventureBodies.get(variant.identity.id)!.body,
  meta: variant.identity.kind === "control" ? "approved source · pending review" : "claim_refs enforced · config/voice.yaml required · pending review",
}));

const fiction = buildContentRequest({
  id: "phase1-review-fiction", origin: "fiction", descriptor: "Approved promotion", originalInput: "Unapproved request wording.",
  treatments: ["shorter"], media: [], platforms: ["substack"],
  sourceContext: {
    kind: "fiction-approved-promotion", authoritativeBody: "Approved fiction promotion.",
    series: { id: "review-series", title: "Review Series" }, chapter: { number: 1, title: "One" },
    sourcePassages: [{ ref: "chapters/001.md#L1", text: "Locked passage.", locked: true }],
    restrictions: { canon: ["No new canon."], provenance: ["Use approved promotion only."] },
  },
});
const charles = buildContentRequest({
  id: "phase1-review-charles", origin: "charles", descriptor: "Approved post", originalInput: "Unapproved request wording.",
  treatments: ["shorter"], media: [], platforms: ["substack"],
  sourceContext: {
    kind: "charles-approved-post", authoritativeBody: "Approved Charles post.",
    personaRef: "charles/config/persona.yaml", identity: "charles-lord-featherbottom",
    restrictions: ["No new leak claims."],
  },
});

const mediaRows = Object.keys(CONFIGURED_MEDIA).map((media) => {
  const id = `review-${media}`;
  const inputs = media === "audiogram"
    ? { sourceAudioPath: "review/source-audio.wav" }
    : media === "video-caption-package"
      ? { approvedStoryboard: true }
      : {};
  const stage = configuredMediaStage(media, id, inputs);
  const plan = configuredMediaPlan(media, approvedBody);
  return { media, stage: stage.stage, queue: stage.queue.format, plan: JSON.stringify(plan, null, 2), primitives: stage.primitives.join("; ") };
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Content Studio Phase 1 generation review</title>
  <style>
    :root { color-scheme: light; --ink:#1c1917; --muted:#6b645c; --paper:#f7f3ea; --panel:#fffdf8; --line:#d9cfbd; --accent:#244f43; --warn:#8a451c; }
    * { box-sizing:border-box; }
    body { margin:0; font:16px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--paper); }
    main { width:min(1180px,calc(100% - 32px)); margin:36px auto 80px; }
    header { padding:36px; border:1px solid var(--line); border-radius:18px; background:var(--panel); }
    h1 { margin:0 0 10px; font:700 clamp(32px,5vw,58px)/1.02 ui-serif,Georgia,serif; letter-spacing:-.035em; }
    h2 { margin:56px 0 8px; font:700 31px/1.12 ui-serif,Georgia,serif; }
    h3 { margin:6px 0 14px; font-size:18px; }
    p { max-width:820px; }
    .dek { color:var(--muted); font-size:18px; }
    .facts,.grid { display:grid; gap:14px; }
    .facts { grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); margin-top:24px; }
    .fact,.card,.boundary,.media { border:1px solid var(--line); border-radius:13px; background:var(--panel); }
    .fact { padding:15px; }
    .fact b { display:block; font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
    .grid { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); margin-top:20px; align-items:start; }
    .card { padding:22px; }
    .eyebrow { color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .copy { white-space:normal; }
    .meta { margin-top:18px; padding-top:12px; border-top:1px solid var(--line); color:var(--muted); font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .source { padding:20px 24px; border-left:5px solid var(--accent); background:#eef3ed; border-radius:8px; white-space:pre-wrap; }
    .boundary { padding:22px; margin-top:14px; border-color:#ddb997; background:#fff7ed; }
    .boundary strong { color:var(--warn); }
    table { width:100%; border-collapse:separate; border-spacing:0; margin-top:20px; background:var(--panel); border:1px solid var(--line); border-radius:13px; overflow:hidden; }
    th,td { text-align:left; vertical-align:top; padding:14px; border-bottom:1px solid var(--line); }
    tr:last-child td { border-bottom:0; }
    th { background:#eee7da; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    pre { max-width:500px; margin:0; overflow:auto; white-space:pre-wrap; font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .note { color:var(--muted); font-size:14px; }
    code { font:14px ui-monospace,SFMono-Regular,Menlo,monospace; }
    @media (max-width:700px) { header { padding:24px; } th:nth-child(3),td:nth-child(3) { display:none; } }
  </style>
</head>
<body><main>
  <header>
    <div class="eyebrow">Human Inference · review artifact</div>
    <h1>What Phase 1 actually generates</h1>
    <p class="dek">Outputs below were produced from a synthetic, non-private fixture by the committed Phase 1 prompt, parser, provenance, policy, and media-plan functions. Nothing was approved, scheduled, rendered by a paid provider, or published.</p>
    <div class="facts">
      <div class="fact"><b>Generated</b>${escapeHtml(generatedAt)}</div>
      <div class="fact"><b>Engine</b>${escapeHtml(ordinaryRun.version)}</div>
      <div class="fact"><b>Ordinary Content</b>Extraction only</div>
      <div class="fact"><b>Venture</b>Scoped composition</div>
    </div>
  </header>

  <h2>1. Ordinary Content</h2>
  <p>The selected model does not write the post here. It returns only line references. The server reconstructs every body from the approved cut, refuses any out-of-bound reference, and queues each result as pending.</p>
  <div class="source">${escapeHtml(approvedBody)}</div>
  <div class="grid">${cards(ordinaryCards)}</div>

  <h2>2. Venture composition exception</h2>
  <p>This path may compose a treatment because Venture has no source essay. The prompt carries the approved body, claim references, the no-invented-proof rule, and <code>config/voice.yaml</code>. These are representative review fixtures, not approved campaign content.</p>
  <div class="source">${escapeHtml(ventureBody)}</div>
  <div class="grid">${cards(ventureCards)}</div>

  <h2>3. Cross-room safety boundaries</h2>
  <p>Fiction and Charles may enter Content with approved prose, but Phase 1 deliberately refuses AI treatments because no enforceable restricted transformation exists yet.</p>
  <div class="boundary"><strong>Fiction treatment refused:</strong><br>${escapeHtml(policyError(fiction))}</div>
  <div class="boundary"><strong>Charles treatment refused:</strong><br>${escapeHtml(policyError(charles))}</div>

  <h2>4. Seven staged media paths</h2>
  <p>These are the inspectable artifacts created before rendering. Each waits for explicit approval; a declared path is never presented as a finished asset.</p>
  <table><thead><tr><th>Media</th><th>Gate</th><th>Plan created by Phase 1</th><th>Existing primitives</th></tr></thead><tbody>
    ${mediaRows.map((row) => `<tr><td><b>${escapeHtml(row.media)}</b><br><span class="note">queue: ${escapeHtml(row.queue)}</span></td><td>${escapeHtml(row.stage)}</td><td><pre>${escapeHtml(row.plan)}</pre></td><td>${escapeHtml(row.primitives)}</td></tr>`).join("")}
  </tbody></table>

  <h2>How to evaluate this</h2>
  <p>For ordinary Content, judge whether the selected source lines make a useful platform post without changing Muxin's words. For Venture, judge voice, concision, and whether every factual statement stays inside the two claim references. For media, judge whether the pre-render plan is concrete enough to approve before cost or side effects occur.</p>
  <p class="note">Reproduce with Codex: <code>npx tsx scripts/phase1-generation-review.ts docs/reviews/content-studio-phase1-generation-review.html</code>. To keep generation fully local, set <code>PHASE1_REVIEW_ENGINE=ollama-gpt-oss</code>.</p>
</main></body></html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log(outputPath);
