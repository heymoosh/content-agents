// Deterministic Chromium coverage for Outreach first-draft and same-file revision. The combined
// runner's one-use token swaps only model output; the real GUI, routes, queue, artifact writes,
// reloads, and job boundaries still execute inside the disposable repository.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "../src/util/frontmatter.js";
import { bootServer, openRoom, openSession, record, results, ROOT, waitLoaded } from "./harness.js";

const PORT = 4797;
const LEAD = "e2e-outreach-injected";
const DIR = `outreach/leads/${LEAD}`;

function seedLead(): void {
  const folder = join(ROOT, DIR);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "lead.md"), [
    "---",
    "kind: client",
    'name: "E2E Outreach Lead"',
    "source: manual",
    "status: pursue",
    "classification: greenfield",
    'pitch_angle: "Ask about the reviewed product assumption."',
    'why_them: "They have a real unshipped product decision."',
    'why_me: "Muxin has directly relevant product evidence."',
    'why_mutual: "A short evidence-grounded conversation could test the fit."',
    "---",
    "",
    "## Evidence",
    "",
    '- E1 | signal: greenfield | person: Casey | source: https://example.com/e2e | quote: "We are testing the product assumption before launch." | A bounded reviewed fact for the disposable draft.',
    "",
    "## Decision log",
    "",
    "- 2026-09-01: pursue",
    "",
  ].join("\n"));
  writeFileSync(join(folder, "review-queue.md"), [
    "# Review queue — E2E Outreach Lead",
    "",
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |",
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|",
    "",
  ].join("\n"));
}

async function main(): Promise<void> {
  console.log("\n=== Pass D: Outreach draft and revise, disposable injected engine ===\n");
  seedLead();
  const token = process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN;
  if (!token || readFileSync(join(ROOT, ".e2e-configured-engine-token"), "utf8") !== token) throw new Error("combined disposable engine token is required");
  const server = await bootServer({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token }, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(PORT, { allowInjectedRoutes: ["/api/outreach/draft", "/api/outreach/message/revise"] });
    const { page } = session;
    await openRoom(page, "outreach");
    await waitLoaded(page, "#outreachList");
    await page.waitForSelector(`.tri-row[data-dir="${DIR}"]`, { timeout: 15_000 });
    await page.click(`.tri-row[data-dir="${DIR}"]`);
    await page.waitForSelector(`textarea.dir-input[data-dir="${DIR}"]`, { timeout: 10_000 });
    const direction = "Lead with the reviewed assumption and ask for a short conversation.";
    await page.fill(`textarea.dir-input[data-dir="${DIR}"]`, direction);
    await page.waitForFunction((dir) => {
      const button = document.querySelector(`button.dir-send[data-dir="${dir}"]`) as HTMLButtonElement | null;
      return button?.disabled === false;
    }, DIR, { timeout: 5_000 });
    await page.selectOption(".dossier-grid .outreach-engine", "codex");
    const draftResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/outreach/draft");
    await page.click(`button.dir-send[data-dir="${DIR}"]`);
    const draftHttp = await draftResponse;
    const draftPayload = await draftHttp.json() as { ok?: boolean; error?: string };
    if (!draftHttp.ok() || !draftPayload.ok) throw new Error(`Outreach draft failed: HTTP ${draftHttp.status()} ${draftPayload.error ?? "unknown error"}`);
    await page.waitForFunction(() => (document.querySelector(".lead-msg .msg-edit") as HTMLTextAreaElement | null)?.value.includes("Fixture outreach draft"), undefined, { timeout: 15_000 });

    const messagePath = join(ROOT, DIR, "messages", "message-01.md");
    const drafted = readFileSync(messagePath, "utf8");
    const queueAfterDraft = readFileSync(join(ROOT, DIR, "review-queue.md"), "utf8");
    await page.fill(".msg-revise-input", "Make it shorter and warmer.");
    const reviseResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/outreach/message/revise");
    await page.click("button.msg-revise");
    const reviseHttp = await reviseResponse;
    const revisePayload = await reviseHttp.json() as { ok?: boolean; error?: string };
    if (!reviseHttp.ok() || !revisePayload.ok) throw new Error(`Outreach revise failed: HTTP ${reviseHttp.status()} ${revisePayload.error ?? "unknown error"}`);
    await page.waitForFunction(() => (document.querySelector(".lead-msg .msg-edit") as HTMLTextAreaElement | null)?.value.includes("Fixture revised outreach message"), undefined, { timeout: 15_000 });
    const revised = readFileSync(messagePath, "utf8");
    const queueAfterRevision = readFileSync(join(ROOT, DIR, "review-queue.md"), "utf8");
    const draftedParts = splitFrontmatter(drafted);
    const revisedParts = splitFrontmatter(revised);
    const messageRowCount = (queueAfterDraft.match(/^\| message-\d+ \|/gm) ?? []).length;
    const messageFiles = await page.evaluate(async () => {
      const response = await fetch("/api/outreach/leads");
      const body = await response.json() as { leads?: { dir?: string; latestMessage?: { file?: string; status?: string; body?: string } }[] };
      return body.leads?.find((lead) => lead.dir === "outreach/leads/e2e-outreach-injected")?.latestMessage ?? null;
    });
    const passed = drafted.includes("Fixture outreach draft grounded in the reviewed lead evidence.")
      && revised.includes("Fixture revised outreach message, shorter and warmer.")
      && !revised.includes("Fixture outreach draft grounded")
      && messageRowCount === 1
      && queueAfterDraft.includes("| message-01 |") && queueAfterDraft.includes("| pending |")
      && queueAfterRevision === queueAfterDraft
      && draftedParts.header === revisedParts.header
      && draftedParts.fm.status === "draft" && revisedParts.fm.status === "draft"
      && messageFiles?.file === "messages/message-01.md" && messageFiles.status !== "locked"
      && session.blockedCalls.length === 0;
    record({
      feature: "Outreach GUI drafts once and revises the same pending message with an injected engine",
      status: passed ? "pass" : "fail",
      detail: `direction submitted=${direction.length > 0}; message rows=${messageRowCount}; pending row=${queueAfterDraft.includes("| pending |")}; same queue=${queueAfterRevision === queueAfterDraft}; frontmatter preserved=${draftedParts.header === revisedParts.header}; same file=${messageFiles?.file ?? "missing"}; blocked model calls=${session.blockedCalls.length}`,
    });
  } finally {
    await session?.close().catch(() => {});
    await server.stop();
  }
  process.exit(results.some((result) => result.status === "fail") ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
