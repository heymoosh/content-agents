import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildContentRequest, type ContentRequest, type ContentVariant } from "../src/review/content-request.js";
import { configuredMediaPlan, configuredMediaStage, CONFIGURED_MEDIA } from "../src/review/configured-media.js";
import { buildEngineSpawn, type Engine } from "../src/review/engines.js";
import { parseGrokJson } from "../src/providers/analyst/grok-cli.js";

// Importing the production jobs module initializes its durable job paths. Keep this review harness
// hermetic by selecting a disposable runtime root before that module is evaluated.
process.env.CONTENT_AGENTS_DATA_ROOT ??= mkdtempSync(join(tmpdir(), "phase1-generation-review-state-"));
const {
  assertConfiguredTreatmentPolicy,
  configuredContentPrompt,
  configuredDerivativeText,
  configuredSourceSegments,
  parseConfiguredVariantBodies,
  resolveConfiguredProvenance,
} = await import("../src/review/jobs.js");

const outputPath = resolve(process.argv[2] ?? "docs/reviews/content-studio-phase1-generation-review.html");
const sourcePath = resolve(process.argv[3] ?? process.env.PHASE1_REVIEW_SOURCE ?? "");
if (!sourcePath) throw new Error("pass the source essay path as the second argument or PHASE1_REVIEW_SOURCE");
const sourceText = readFileSync(sourcePath, "utf8");
const generatedAt = new Date().toISOString();
const engines: readonly Engine[] = process.env.PHASE1_REVIEW_ENGINE
  ? [process.env.PHASE1_REVIEW_ENGINE as Engine]
  : process.env.PHASE1_REVIEW_GROK_OUTPUT ? ["codex", "grok"] : ["codex"];

const treatments = ["cta", "viral-rewrite", "platform-framing", "shorter-version", "thread", "counterpoint", "summary", "hook-variants"] as const;
const treatmentPlatforms: Record<(typeof treatments)[number], string> = {
  cta: "threads", "viral-rewrite": "x", "platform-framing": "linkedin", "shorter-version": "x",
  thread: "x", counterpoint: "bluesky", summary: "linkedin", "hook-variants": "threads",
};

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runEngine(engine: Engine, prompt: string): { output: string; version: string } {
  const timeoutMs = engine === "ollama-gpt-oss" ? 600_000 : engine === "grok" ? 300_000 : 180_000;
  const built = buildEngineSpawn(engine, prompt, { timeoutMs, sandbox: "read-only", permissionMode: "dontAsk", tools: "" });
  if (engine === "grok") built.args.push("--output-format", "json", "--disable-web-search", "--no-plan");
  const result = spawnSync(built.command, built.args, {
    cwd: engine === "grok" ? tmpdir() : resolve("."),
    input: built.input,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${engine} launch failed: ${result.error.code ?? result.error.message}`);
  if (result.status !== 0) throw new Error(`${engine} exited ${result.status}: ${result.stderr.trim()}`);
  const version = engine === "ollama-gpt-oss"
    ? `local ${spawnSync("ollama", ["--version"], { encoding: "utf8" }).stdout.trim()} · gpt-oss:20b`
    : spawnSync(engine, ["--version"], { encoding: "utf8" }).stdout.trim();
  return { output: engine === "grok" ? parseGrokJson(result.stdout).text : result.stdout.trim(), version };
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
writeFileSync(join(folder, "source.md"), sourceText);
const sourceLines = sourceText.split("\n");
const lineRefs: (number | string)[] = [];
for (let index = 0; index < sourceLines.length;) {
  if (!sourceLines[index]!.trim()) { index += 1; continue; }
  const start = index + 1;
  while (index + 1 < sourceLines.length && sourceLines[index + 1]!.trim()) index += 1;
  const end = index + 1;
  lineRefs.push(start === end ? start : `${start}-${end}`);
  index += 1;
}
const approvedBody = sourceText;

const ordinary = buildContentRequest({
  id: "phase1-review-ordinary",
  origin: "studio",
  descriptor: "Muxin's essay, The world's broken. What do we do? Create distinct short posts using only her exact sentences.",
  originalInput: approvedBody,
  treatments,
  media: [],
  platforms: [...new Set(Object.values(treatmentPlatforms))],
  includeUntreatedControl: true,
  sourceProvenance: { kind: "source", sourceLines: lineRefs },
});
const ordinaryTreated = treatments.map((treatment) => ordinary.variants.find((variant) =>
  variant.identity.kind === "treated" && variant.platform === treatmentPlatforms[treatment] && variant.treatments[0] === treatment,
)!);
resolveConfiguredProvenance(folder, ordinary);
const referenceHeading = sourceLines.findIndex((line) => /^# References\s*$/.test(line));
const eligibleSegments = configuredSourceSegments(folder, lineRefs).filter((segment) => {
  const startLine = Number(String(segment.source_line).split("-")[0]);
  const text = segment.text.trim();
  return (referenceHeading < 0 || startLine < referenceHeading + 1)
    && text.length <= 800
    && !/^(?:#|!\[|\*.*\*$|---$|\[\^)/s.test(text);
});
const basePrompt = configuredContentPrompt(ordinary, ordinaryTreated, eligibleSegments);
if (process.env.PHASE1_REVIEW_PROMPT_PATH) {
  writeFileSync(resolve(process.env.PHASE1_REVIEW_PROMPT_PATH), basePrompt, { mode: 0o600 });
  console.log(resolve(process.env.PHASE1_REVIEW_PROMPT_PATH));
  process.exit(0);
}
const engineReviews = engines.map((engine) => {
  let prompt = basePrompt;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const externalOutputPath = engine === "grok" ? process.env.PHASE1_REVIEW_GROK_OUTPUT : undefined;
    const run = externalOutputPath
      ? { output: readFileSync(resolve(externalOutputPath), "utf8").trim(), version: "Grok 4.5 via managed subscription bridge" }
      : runEngine(engine, prompt);
    try {
      const bodies = parseConfiguredVariantBodies(run.output, ordinaryTreated, folder, lineRefs);
      return {
        engine,
        version: run.version,
        cards: ordinaryTreated.map((variant) => {
          const generated = bodies.get(variant.identity.id)!;
          return {
            title: variantLabel(variant), eyebrow: `${engine}-selected exact extraction`, body: generated.body,
            meta: `${generated.body.length} characters · source_lines: [${generated.sourceLines.join(", ")}] · pending review`,
          };
        }),
      };
    } catch (error) {
      lastError = error;
      if (externalOutputPath) break;
      prompt = `${basePrompt}\n\nYour previous selection was rejected by the deterministic server check: ${error instanceof Error ? error.message : String(error)}. Return a corrected complete JSON array. Do not reuse the rejected source_lines for that variant.`;
    }
  }
  throw lastError;
});
const controlEnvelope = configuredDerivativeText("---\nvariant_kind: control\n---\n\n", sourceText, true);
const controlBody = controlEnvelope.slice(controlEnvelope.indexOf("\n\n") + 2);
if (controlBody !== sourceText) throw new Error("untreated control did not preserve the source byte for byte");
const controlHash = createHash("sha256").update(controlBody).digest("hex");

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
  const reviewPlan = JSON.stringify(plan, (key, value) =>
    key === "sourceText" || key === "sourceExcerpt" || key === "transcript" ? "[control omitted from review]" : value, 2);
  return { media, stage: stage.stage, queue: stage.queue.format, plan: reviewPlan, primitives: stage.primitives.join("; ") };
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
    <p class="dek">Every short post below was produced from Muxin's own essay by the committed Phase 1 prompt, parser, provenance, and voice checks. The model could select, omit, and reorder complete source segments. It could not write or paraphrase a sentence.</p>
    <div class="facts">
      <div class="fact"><b>Generated</b>${escapeHtml(generatedAt)}</div>
      <div class="fact"><b>Engines</b>${escapeHtml(engineReviews.map((review) => review.version).join(" · "))}</div>
      <div class="fact"><b>Control</b>Byte-for-byte verified</div>
      <div class="fact"><b>Voice gate</b>No em dashes or configured AI tells</div>
    </div>
  </header>

  <h2>1. Eight treatments of Muxin's essay</h2>
  <p>The untreated control is intentionally not repeated here. The system verified it against the source byte for byte. SHA-256: <code>${controlHash}</code>. Each treatment below is assembled only from exact source segments and passed the hard voice gate before appearing.</p>
  ${engineReviews.map((review) => `<h3 style="margin-top:30px">${escapeHtml(review.engine.toUpperCase())}</h3><div class="grid">${cards(review.cards)}</div>`).join("")}

  <h2>2. Cross-room safety boundaries</h2>
  <p>Fiction and Charles may enter Content with approved prose, but Phase 1 deliberately refuses AI treatments because no enforceable restricted transformation exists yet.</p>
  <div class="boundary"><strong>Fiction treatment refused:</strong><br>${escapeHtml(policyError(fiction))}</div>
  <div class="boundary"><strong>Charles treatment refused:</strong><br>${escapeHtml(policyError(charles))}</div>

  <h2>3. Seven staged media paths</h2>
  <p>These are the inspectable artifacts created before rendering. Each waits for explicit approval; a declared path is never presented as a finished asset.</p>
  <table><thead><tr><th>Media</th><th>Gate</th><th>Plan created by Phase 1</th><th>Existing primitives</th></tr></thead><tbody>
    ${mediaRows.map((row) => `<tr><td><b>${escapeHtml(row.media)}</b><br><span class="note">queue: ${escapeHtml(row.queue)}</span></td><td>${escapeHtml(row.stage)}</td><td><pre>${escapeHtml(row.plan)}</pre></td><td>${escapeHtml(row.primitives)}</td></tr>`).join("")}
  </tbody></table>

  <h2>How to evaluate this</h2>
  <p>Judge whether each exact-source treatment is useful, distinct, short enough for its platform, and recognizably Muxin. Any em dash or configured AI tell causes generation to fail rather than queue the draft.</p>
  <p class="note">Reproduce the Codex set with <code>npx tsx scripts/phase1-generation-review.ts docs/reviews/content-studio-phase1-generation-review.html /absolute/path/to/source.md</code>. The Grok comparison shown here came from the managed subscription bridge and was fed back through the same deterministic parser with <code>PHASE1_REVIEW_GROK_OUTPUT</code>.</p>
</main></body></html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log(outputPath);
