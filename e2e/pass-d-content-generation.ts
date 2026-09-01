// Deterministic browser coverage for the real Content save + generate flow. The combined runner
// grants this pass a one-run token tied to its disposable repository copy; without that token the
// harness still aborts /api/content/generate and the server still uses the real selected CLI.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootServer, openRoom, openSession, record, results, ROOT, waitLoaded } from "./harness.js";
import { buildContentRequest } from "../src/review/content-request.js";

const PORT = 4796;
const SLUG = "e2e-configured-generation";
const FICTION_SLUG = "e2e-fiction-treatment-refusal";
const CHARLES_SLUG = "e2e-charles-approved-source";
const VENTURE_SLUG = "e2e-venture-composition";

function seedSource(): void {
  const folder = join(ROOT, "content", SLUG);
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  mkdirSync(join(folder, "cuts", "approved-e2e"), { recursive: true });
  writeFileSync(join(folder, "derivatives", "seed-pending.md"), "---\nplatform: bluesky\nsource_lines: [7]\n---\n\nThe approved first claim is exactly this sentence.\n");
  writeFileSync(join(folder, "source.md"), [
    "---",
    "title: E2E authoritative configured source",
    "origin: imported-substack",
    "canonical_url: https://humaninference.substack.com/p/e2e-authoritative-source",
    "source_kind: essay",
    "---",
    "",
    "The approved first claim is exactly this sentence.",
    "The approved second claim stays inside the same boundary.",
    "",
  ].join("\n"));
  writeFileSync(join(folder, "review-queue.md"), [
    "# Review queue — E2E authoritative configured source",
    "",
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |",
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|",
    "| seed-pending | bluesky | text | derivatives/seed-pending.md | 5 | 5 | no | pending | E2E source discovery seed |",
    "",
  ].join("\n"));
  // This is the deterministic stand-in for the completed advisor decision. The browser still has
  // to choose it, and request persistence re-reads this file before accepting its provenance.
  writeFileSync(join(folder, "cuts", "approved-e2e", "cut.md"), [
    "---",
    "title: Approved E2E cut",
    'source_lines: ["8-9"]',
    "---",
    "",
    "The approved first claim is exactly this sentence.",
    "The approved second claim stays inside the same boundary.",
    "",
  ].join("\n"));
}

function seedFictionRefusal(): void {
  const folder = join(ROOT, "content", FICTION_SLUG);
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  writeFileSync(join(folder, "source.md"), "---\ntitle: E2E approved fiction promotion\norigin: fiction:e2e\n---\n\nApproved fiction promotion.\n");
  writeFileSync(join(folder, "review-queue.md"), "# Review queue — E2E approved fiction promotion\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n");
  const request = buildContentRequest({
    id: FICTION_SLUG, origin: "fiction", ventureId: "least-of-us-fiction", descriptor: "Approved fiction promotion",
    originalInput: "Unapproved request wording must not become content.", treatments: ["summary"], media: [], platforms: ["substack"], includeUntreatedControl: true,
    sourceContext: {
      kind: "fiction-approved-promotion", authoritativeBody: "Approved fiction promotion.",
      series: { id: "e2e-series", title: "E2E Series" }, chapter: { number: 1, title: "One" },
      sourcePassages: [{ ref: "chapters/001.md#L1", text: "Locked passage.", locked: true }],
      restrictions: { canon: ["No new canon."], provenance: ["Use the approved promotion only."] },
    },
  });
  writeFileSync(join(folder, "content-request.json"), JSON.stringify(request, null, 2) + "\n");
}

function seedCrossRoomSources(): void {
  const charlesFolder = join(ROOT, "content", CHARLES_SLUG);
  mkdirSync(join(charlesFolder, "derivatives"), { recursive: true });
  writeFileSync(join(charlesFolder, "source.md"), "---\ntitle: E2E approved Charles post\norigin: charles:lord-featherbottom\nsource_kind: charles\n---\n\nApproved Charles observation.\n");
  writeFileSync(join(charlesFolder, "review-queue.md"), "# Review queue — E2E approved Charles post\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n");
  writeFileSync(join(charlesFolder, "content-request.json"), JSON.stringify(buildContentRequest({
    id: CHARLES_SLUG, origin: "charles", ventureId: "charles", descriptor: "Approved Charles post",
    originalInput: "Unapproved Charles prompt wording.", treatments: [], media: [], platforms: ["substack"], includeUntreatedControl: true,
    sourceContext: {
      kind: "charles-approved-post", authoritativeBody: "Approved Charles observation.", personaRef: "charles/config/persona.yaml",
      identity: "charles-lord-featherbottom", restrictions: ["Preserve Charles voice.", "Delivery is manual and ready-to-paste only."],
    },
  }), null, 2) + "\n");

  const ventureFolder = join(ROOT, "content", VENTURE_SLUG);
  mkdirSync(join(ventureFolder, "derivatives"), { recursive: true });
  writeFileSync(join(ventureFolder, "source.md"), "---\ntitle: E2E approved Venture artifact\norigin: venture:e2e-venture:artifact-1\nsource_kind: venture\n---\n\nThe approved Venture premise is that careful operators need a smaller first step.\n");
  writeFileSync(join(ventureFolder, "review-queue.md"), "# Review queue — E2E approved Venture artifact\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n");
  writeFileSync(join(ventureFolder, "content-request.json"), JSON.stringify(buildContentRequest({
    id: VENTURE_SLUG, origin: "venture", ventureId: "e2e-venture", descriptor: "Approved Venture artifact",
    originalInput: "The approved Venture premise is that careful operators need a smaller first step.", treatments: ["summary"], media: [], platforms: ["bluesky"], includeUntreatedControl: true,
    ventureSource: {
      artifactId: "artifact-1", phase: 1, artifactKind: "text-post-note", messageId: "message-1",
      bodyPath: "phase-1-attention/artifact-1.md", claimRefs: [{ claim: "Careful operators need a smaller first step.", ref: "intake:q7" }],
      approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" },
    },
  }), null, 2) + "\n");
}

async function main(): Promise<void> {
  console.log("\n=== Pass D: configured Content generation, disposable injected engine ===\n");
  seedSource();
  seedFictionRefusal();
  seedCrossRoomSources();
  const token = process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN;
  if (!token || !existsSync(join(ROOT, ".e2e-configured-engine-token"))) throw new Error("combined disposable E2E runner token is required");
  const server = await bootServer({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token }, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(PORT, { allowInjectedRoutes: ["/api/content/generate"] });
    const { page } = session;

    // Exercise the canonical front door. The top-level action persists the capture and starts the
    // advisor-only job; the disposable engine route ensures no real model is invoked.
    await page.fill("#src", "A source idea with enough context for Content versions and an exact-source advisor cut.");
    await page.click("#routeBtn");
    await page.waitForSelector("#captureVerdict:not([hidden]) .cap-go", { timeout: 10_000 });
    const verdict = (await page.locator("#captureVerdict").innerText()).replace(/\s+/g, " ");
    if (!verdict.includes("Content")) throw new Error(`capture classified outside Content: ${verdict}`);
    await page.click("#captureVerdict .cap-go");
    await page.waitForSelector("#contentCaptureHandoff:not([hidden]) .capture-handoff", { timeout: 15_000 });
    const captures = await page.evaluate(async () => {
      const response = await fetch("/api/captures");
      return await response.json() as { ok?: boolean; captures?: { room?: string; text?: string; jobId?: string }[] };
    });
    const contentCapture = captures.captures?.find((capture) => capture.room === "Content" && capture.text?.includes("exact-source advisor cut"));
    record({
      feature: "Studio capture persists in Content and starts only the advisor gate",
      status: captures.ok && !!contentCapture?.jobId ? "pass" : "fail",
      detail: `durable Content captures=${captures.captures?.filter((capture) => capture.room === "Content").length ?? 0}; advisor job=${contentCapture?.jobId ?? "missing"}; approval and publishing remain separate`,
    });

    await openRoom(page, "content");
    await waitLoaded(page, "#contentWizard");
    const seededSession = await page.evaluate(async (slug) => {
      const response = await fetch("/api/content");
      const body = await response.json() as { sessions?: { slug?: string; cuts?: { lens?: string }[] }[] };
      return body.sessions?.find((candidate) => candidate.slug === slug) ?? null;
    }, SLUG);
    if (!seededSession?.cuts?.some((cut) => cut.lens === "approved-e2e")) {
      throw new Error(`seeded approved cut missing from server-owned Content read: ${JSON.stringify(seededSession)}`);
    }
    await page.click(`#cwBody .cw-src[data-slug="${SLUG}"]`);
    await page.waitForSelector('input[name="approvedCut"][value="approved-e2e"]', { state: "attached", timeout: 15_000 });
    const gated = (await page.locator("#cwBody").innerText()).includes("Pick one approved cut before configuration")
      && await page.locator("#contentConfigSave").count() === 0;
    await page.check('input[name="approvedCut"][value="approved-e2e"]');
    await page.waitForSelector("[data-open-config]", { timeout: 10_000 });
    await page.click("[data-open-config]");
    await page.waitForSelector("#contentConfigSave", { timeout: 15_000 });
    record({
      feature: "Approved server-owned cut unlocks Content configuration",
      status: gated ? "pass" : "fail",
      detail: `advisor gate before selection=${gated}; configuration opened after approved-e2e cut`,
    });
    // Text-only keeps this pass focused on provenance-bearing derivatives rather than the still
    // separate configured-media rendering gap.
    await page.click('[data-config-none="media"]');
    await page.waitForSelector("#contentConfigSave:not([disabled])", { timeout: 15_000 });
    const savedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/content/request");
    const generatedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/content/generate").catch(() => null);
    await page.click("#contentConfigSave");
    const save = await savedResponse;
    const savePayload = await save.json() as { ok?: boolean; error?: string };
    if (!save.ok() || savePayload.ok !== true) throw new Error(`GUI configuration save failed: HTTP ${save.status()} ${savePayload.error ?? "unknown error"}`);
    const response = await generatedResponse;
    if (!response) throw new Error("GUI configuration saved but no generation response arrived");
    const payload = await response.json() as { ok?: boolean; ids?: string[]; engineExecution?: string; error?: string };
    console.log(`  (configured generation response: ${response.status()} ${JSON.stringify(payload)})`);
    await page.waitForFunction(() => document.querySelector("#reviewSheet")?.hasAttribute("hidden") === false, undefined, { timeout: 20_000 }).catch(() => {});

    const folder = join(ROOT, "content", SLUG);
    const stored = JSON.parse(readFileSync(join(folder, "content-request.json"), "utf8")) as { sourceProvenance?: { sourceLines?: unknown[]; canonicalUrl?: string } };
    const derivativeFiles = readdirSync(join(folder, "derivatives")).filter((name) => name.endsWith(".md"));
    const derivatives = derivativeFiles.map((name) => readFileSync(join(folder, "derivatives", name), "utf8"));
    const queue = readFileSync(join(folder, "review-queue.md"), "utf8");
    const generated = (payload.ids ?? []).map((id) => readFileSync(join(folder, "derivatives", `${id}.md`), "utf8"));
    const traced = generated.length > 0 && generated.every((body) => /source_lines:\s*\[/.test(body));
    const controlExact = generated.some((body) => /variant_kind:\s*["']?control/.test(body)
      && body.endsWith("The approved first claim is exactly this sentence.\nThe approved second claim stays inside the same boundary."));
    const treatedStandalone = generated.some((body) => /variant_kind:\s*["']?treated/.test(body)
      && body.includes("Fixture standalone point 1.") && !body.includes("invented"));
    const editorStamped = generated.some((body) => /variant_kind:\s*["']?treated/.test(body)
      && !/^editor_pass:/m.test(body));
    const essayCta = generated.every((body) => /^cta:\s*source$/m.test(body) && /^cta_label:\s*["']Read the full essay:["']$/m.test(body))
      && stored.sourceProvenance?.canonicalUrl === "https://humaninference.substack.com/p/e2e-authoritative-source";
    const pending = (payload.ids ?? []).every((id) => new RegExp(`\\| ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|[^\\n]+\\| pending \\|`).test(queue));
    const passed = response.ok() && payload.ok === true && payload.engineExecution === "disposable-injected"
      && Array.isArray(stored.sourceProvenance?.sourceLines) && traced && controlExact && treatedStandalone && editorStamped && essayCta && pending;
    record({
      feature: "Content GUI saves authoritative provenance and generates pending traced derivatives",
      status: passed ? "pass" : "fail",
      detail: `HTTP ${response.status()}; injected=${payload.engineExecution}; derivatives=${derivativeFiles.length}; traced=${traced}; controlExact=${controlExact}; treatedStandalone=${treatedStandalone}; editorStamped=${editorStamped}; essayCta=${essayCta}; pending=${pending}${payload.error ? `; error=${payload.error}` : ""}`,
    });
    record({
      feature: "Configured-generation browser pass cannot invoke a real model or provider",
      status: payload.engineExecution === "disposable-injected" && session.blockedCalls.length === 0 ? "pass" : "fail",
      detail: `server execution=${payload.engineExecution ?? "missing"}; browser-aborted calls=${session.blockedCalls.join(", ") || "none"}`,
    });

    const crossRoomCases = [
      { slug: FICTION_SLUG, expected: ["Approved fiction promotion.", "Locked passage: chapters/001.md#L1", "Canon: No new canon.", "Provenance: Use the approved promotion only."] },
      { slug: CHARLES_SLUG, expected: ["Approved Charles observation.", "Persona: charles-lord-featherbottom", "Persona source: charles/config/persona.yaml", "Delivery is manual and ready-to-paste only."] },
      { slug: VENTURE_SLUG, expected: ["The approved Venture premise", "Approved artifact: artifact-1", "Approval: approved · muxin-editorial-approval", "Claim authority: Careful operators need a smaller first step. · intake:q7"] },
    ];
    let crossRoomDisplay = true;
    const crossDetails: string[] = [];
    for (const item of crossRoomCases) {
      await page.locator('[data-step="1"]:visible').first().click();
      await page.click(`#cwBody .cw-src[data-slug="${item.slug}"]`);
      await page.waitForSelector("#cwBody .cw-cross-context", { timeout: 15_000 });
      const text = (await page.locator("#cwBody .cw-cross-context").innerText()).replace(/\s+/g, " ");
      const found = item.expected.every((expected) => text.includes(expected));
      crossRoomDisplay = crossRoomDisplay && found;
      crossDetails.push(`${item.slug}=${found}`);
    }
    record({
      feature: "Content displays approved Fiction, Charles, and Venture authority before configuration",
      status: crossRoomDisplay ? "pass" : "fail",
      detail: crossDetails.join("; "),
    });

    await page.waitForSelector("#contentConfigSave", { timeout: 15_000 });
    await page.click('[data-config-none="media"]');
    const ventureGeneratedResponse = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === "/api/content/generate");
    await page.click("#contentConfigSave");
    const ventureResponse = await ventureGeneratedResponse;
    const venturePayload = await ventureResponse.json() as { ok?: boolean; ids?: string[]; engineExecution?: string; error?: string };
    const ventureFolder = join(ROOT, "content", VENTURE_SLUG);
    const ventureBodies = (venturePayload.ids ?? []).map((id) => readFileSync(join(ventureFolder, "derivatives", `${id}.md`), "utf8"));
    const ventureQueue = readFileSync(join(ventureFolder, "review-queue.md"), "utf8");
    const ventureComposed = ventureBodies.some((body) => /variant_kind:\s*["']?treated/.test(body) && body.includes("Approved Venture premise, composed for"));
    const venturePending = (venturePayload.ids ?? []).every((id) => new RegExp(`\\| ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|[^\\n]+\\| pending \\|`).test(ventureQueue));
    record({
      feature: "Approved Venture authority composes treated pending Content through the real GUI",
      status: ventureResponse.ok() && venturePayload.ok === true && venturePayload.engineExecution === "disposable-injected" && ventureComposed && venturePending ? "pass" : "fail",
      detail: `HTTP ${ventureResponse.status()}; injected=${venturePayload.engineExecution}; outputs=${ventureBodies.length}; composed=${ventureComposed}; pending=${venturePending}; blocked calls=${session.blockedCalls.join(", ") || "none"}${venturePayload.error ? `; error=${venturePayload.error}` : ""}`,
    });

    const fictionResult = await page.evaluate(async (slug) => {
      const response = await fetch("/api/content/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, engine: "codex" }) });
      return { status: response.status, body: await response.json() as { ok?: boolean; error?: string } };
    }, FICTION_SLUG);
    const fictionFolder = join(ROOT, "content", FICTION_SLUG);
    const fictionWrites = readdirSync(join(fictionFolder, "derivatives"));
    const refused = fictionResult.status === 400 && /treatments are unavailable.*untreated control/i.test(fictionResult.body.error ?? "") && fictionWrites.length === 0;
    record({
      feature: "Configured Fiction treatment fails closed before a model job or derivative write",
      status: refused ? "pass" : "fail",
      detail: `HTTP ${fictionResult.status}; derivatives=${fictionWrites.length}; error=${fictionResult.body.error ?? "missing"}`,
    });
  } finally {
    if (session) await session.close();
    await server.stop();
  }
  const failed = results.filter((result) => result.status === "fail").length;
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
