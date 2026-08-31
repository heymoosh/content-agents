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

async function main(): Promise<void> {
  console.log("\n=== Pass D: configured Content generation, disposable injected engine ===\n");
  seedSource();
  seedFictionRefusal();
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
