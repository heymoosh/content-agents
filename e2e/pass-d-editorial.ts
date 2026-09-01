// Deterministic Fiction and Charles editorial writes in the disposable E2E checkout.
// Model-drafting routes remain blocked by harness.ts; this pass only drives direct edits,
// statuses, and review history that can be asserted byte for byte.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bootServer, openRoom, openSession, record, results, ROOT, waitLoaded } from "./harness.js";
import { readFictionChapter, saveSceneBeats } from "../src/review/fiction.js";
import { appendReviewComment, fictionReviewSubject } from "../src/review/review-comments.js";

const PORT = 4794;
const SERIES = "the-least-of-us";
const CHARLES_ID = "no-contingency-for-laughter";

async function main(): Promise<void> {
  console.log("\n=== Pass D: Fiction and Charles editorial writes ===\n");
  saveSceneBeats(SERIES, "E2E: keep the existing chapter anchored for direct editorial review.", 1);
  appendReviewComment({
    domain: "fiction",
    subject: fictionReviewSubject(SERIES, 1),
    body: "E2E: keep the human consequence visible.",
    operationId: "e2e-fiction-history",
  });

  const server = await bootServer({}, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(PORT);
    const page = session.page;

    await openRoom(page, "fiction");
    await waitLoaded(page, "#fictionMain");
    await page.click('nav[aria-label="Fiction pages"] [data-fiction-page="review"]');
    await page.waitForSelector("[data-edit-passage]");
    const before = readFictionChapter(SERIES, 1).body;
    const originalSpan = await page.locator('[data-passage="0"] div').first().innerText();
    const replacement = originalSpan.replace("scheduled for 6 a.m.", "scheduled for 5:59 a.m.");
    await page.locator('[data-passage="0"] [data-edit-passage]').click();
    await page.locator('[data-passage="0"] textarea').fill(replacement);
    await page.locator('[data-passage="0"] [data-save-passage]').click();
    await page.waitForFunction(() => document.querySelector('[data-passage="0"] [data-edit-passage]'));
    const after = readFictionChapter(SERIES, 1).body;
    const history = await page.locator("#fictionMain").innerText();
    const fictionOk =
      before.includes(originalSpan) &&
      after.includes(replacement) &&
      !after.includes(originalSpan) &&
      history.includes("E2E: keep the human consequence visible.");
    record({
      feature: "Fiction passage edit saves exact prose and keeps review history visible",
      status: fictionOk ? "pass" : "fail",
      detail: fictionOk ? "exact first passage replaced in the disposable chapter; seeded review note rendered" : "passage or review-history assertion failed",
    });

    await openRoom(page, "charles");
    await waitLoaded(page, "#charlesMain");
    await page.waitForFunction(() => (document.querySelector("#charlesPersonaYaml") as HTMLTextAreaElement)?.value.includes("short_name:"));
    const personaPath = join(ROOT, "charles", "config", "persona.yaml");
    const briefPath = join(ROOT, "charles", "config", "persona-brief.md");
    const personaBefore = readFileSync(personaPath, "utf8");
    const briefBefore = readFileSync(briefPath, "utf8");
    const personaApproved = personaBefore.replace('short_name: "Charles"', 'short_name: "Charles E2E Reviewed"');
    await page.locator("#charlesPersonaYaml").fill(personaApproved);
    await page.click("#charlesPersonaProposeBtn");
    await page.waitForSelector('[data-persona-decision="approve"]');
    const unchangedBeforeApproval = readFileSync(personaPath, "utf8") === personaBefore;
    page.once("dialog", (dialog) => dialog.accept("E2E reviewed the exact old and new YAML"));
    await page.click('[data-persona-decision="approve"]');
    await page.waitForFunction(() => document.querySelector("#charlesPersonaProposals")?.textContent?.includes("APPLIED"));
    const personaAfterApproval = readFileSync(personaPath, "utf8");
    record({
      feature: "Charles persona edit previews exact old/new YAML before explicit approval",
      status: unchangedBeforeApproval && personaAfterApproval === personaApproved && readFileSync(briefPath, "utf8") === briefBefore ? "pass" : "fail",
      detail: unchangedBeforeApproval ? "production stayed unchanged through preview; approval applied the exact reviewed bytes and preserved the verbatim brief" : "production changed before approval",
    });

    const personaRejected = personaApproved.replace('short_name: "Charles E2E Reviewed"', 'short_name: "Charles Must Not Apply"');
    await page.locator("#charlesPersonaYaml").fill(personaRejected);
    await page.click("#charlesPersonaProposeBtn");
    await page.waitForSelector('[data-persona-decision="reject"]');
    page.once("dialog", (dialog) => dialog.accept("E2E rejects this persona change"));
    await page.click('[data-persona-decision="reject"]');
    await page.waitForFunction(() => document.querySelector("#charlesPersonaProposals")?.textContent?.includes("REJECTED"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await openRoom(page, "charles");
    await page.waitForFunction(() => (document.querySelector("#charlesPersonaYaml") as HTMLTextAreaElement)?.value.includes("Charles E2E Reviewed"));
    const personaHistory = await page.locator("#charlesPersonaProposals").innerText();
    record({
      feature: "Charles persona rejection and approved state survive reload",
      status: readFileSync(personaPath, "utf8") === personaApproved && personaHistory.includes("APPLIED") && personaHistory.includes("REJECTED") ? "pass" : "fail",
      detail: "rejected YAML never became production; applied and rejected decisions reloaded from the append-only ledger",
    });

    await page.click('nav[aria-label="Charles pages"] [data-charles-page="needs-review"]');
    await page.waitForSelector(`#charlesDraftList [data-id="${CHARLES_ID}"]`);
    await page.click(`#charlesDraftList [data-id="${CHARLES_ID}"]`);
    await page.click("#charlesEditBtn");
    const editor = page.locator("#charlesBody textarea");
    const prose = await editor.inputValue();
    const edited = `${prose}\n\nE2E direct edit.`;
    await editor.fill(edited);
    await page.click("#charlesEditBtn");
    await page.waitForFunction(() => !document.querySelector("#charlesBody textarea"));
    const charlesPath = join(ROOT, "charles", "posts", "one-liners", `${CHARLES_ID}.md`);
    const saved = readFileSync(charlesPath, "utf8");
    const editOk = saved.startsWith("---\ntype: one-liner\n") && saved.includes("E2E direct edit.") && !prose.startsWith("---");
    record({
      feature: "Charles direct edit saves prose without exposing or losing frontmatter",
      status: editOk ? "pass" : "fail",
      detail: editOk ? "prose changed and raw frontmatter remained intact" : "editor exposed metadata or save lost content",
    });

    const note = "E2E: sharpen the final walk-back.";
    const operationId = "e2e-charles-note";
    const postNote = async () => page.evaluate(async ({ id, body, op }) => {
      const response = await fetch("/api/charles/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: "revise", notes: body, operationId: op }),
      });
      return response.json();
    }, { id: CHARLES_ID, body: note, op: operationId });
    const first = await postNote();
    const retry = await postNote();
    const loaded = await page.evaluate(async () => (await fetch("/api/charles")).json());
    const post = loaded.posts.find((item: { id: string }) => item.id === CHARLES_ID);
    const matching = (post?.comments ?? []).filter((item: { operationId?: string }) => item.operationId === operationId);
    const historyOk = first.ok && retry.ok && matching.length === 1 && matching[0].body === note;
    record({
      feature: "Charles revision history survives a retry without duplicating the note",
      status: historyOk ? "pass" : "fail",
      detail: historyOk ? "two identical requests produced one append-only history entry" : `matching entries=${matching.length}`,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await openRoom(page, "charles");
    await page.click('nav[aria-label="Charles pages"] [data-charles-page="needs-review"]');
    await page.waitForSelector(`#charlesDraftList [data-id="${CHARLES_ID}"]`);
    await page.click(`#charlesDraftList [data-id="${CHARLES_ID}"]`);
    const renderedHistory = await page.locator("#charlesMain").innerText();
    record({
      feature: "Charles review history renders after a fresh page load",
      status: renderedHistory.includes(note) ? "pass" : "fail",
      detail: renderedHistory.includes(note) ? "saved revision note rendered after reload" : "saved note missing from review surface",
    });

    if (session.errors.length || session.badResponses.length || session.blockedCalls.length) {
      record({
        feature: "Editorial browser pass has no console, HTTP, or model-route errors",
        status: "fail",
        detail: [...session.errors, ...session.badResponses, ...session.blockedCalls].join(" / ").slice(0, 400),
      });
    } else {
      record({ feature: "Editorial browser pass has no console, HTTP, or model-route errors", status: "pass", detail: "clean browser session" });
    }
  } finally {
    await session?.close().catch(() => {});
    await server.stop();
  }

  const failed = results.filter((item) => item.status === "fail").length;
  console.log(`\nPass D: ${results.length - failed} ok, ${failed} failing\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
