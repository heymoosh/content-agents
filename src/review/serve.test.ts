import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  revisePrompt,
  classifySource,
  sourceDispatch,
  isSafeRawPath,
  isValidLeadDir,
  isValidMessageFile,
  outreachDraftGuard,
  followUpDraftGuard,
  MAX_DIRECTION_CHARS,
  appendLeadNote,
  approveBlockReason,
  replyToMentionBlockReason,
  scheduleKind,
  scheduleApproved,
  enrich,
  jobLogPath,
  lastNonEmptyLine,
  tailLines,
  jobElapsedMs,
  daysAgo,
  computeFreshness,
  parseBriefDate,
  extractSection,
  latestBriefPath,
  type SchedulerDeps,
  appendLeadContact,
  ventureAnalysisPrompt,
  availableEngines,
  requestEngine,
  requestAnalysisEngine,
  requestInteractiveAnalysisEngine,
  recordOutreachInitialSend,
  recordOutreachGmailSend,
  sendLockedOutreachEmail,
  reconcileLockedOutreachEmail,
  reviewRequestHandler,
} from "./serve.js";
import { listFictionSeries } from "./fiction.js";
import { listIdeas } from "../fiction/idea-inbox.js";
import { jobs as jobStore } from "./jobs.js";
import type { LiveProviderState } from "./reconcile.js";
import type { QueueRow } from "../publish/queue.js";
import { approveConfiguredMediaStage } from "./configured-media-runtime.js";

test("strategy brief lookup is brand-scoped and leaves top-level legacy briefs unassigned", () => {
  const root = mkdtempSync(join(tmpdir(), "strategy-brand-briefs-"));
  try {
    mkdirSync(join(root, "human-inference"), { recursive: true });
    mkdirSync(join(root, "charles"), { recursive: true });
    writeFileSync(join(root, "2026-08-31-strategy-brief.md"), "legacy global");
    writeFileSync(join(root, "human-inference", "2026-08-30-strategy-brief.md"), "hi");
    writeFileSync(join(root, "charles", "2026-08-29-strategy-brief.md"), "charles");

    assert.equal(latestBriefPath("human-inference", root), join(root, "human-inference", "2026-08-30-strategy-brief.md"));
    assert.equal(latestBriefPath("charles", root), join(root, "charles", "2026-08-29-strategy-brief.md"));
    assert.equal(latestBriefPath("fiction", root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("GPT-OSS stays paused even when Ollama reports the exact model", () => {
  const missing = availableEngines((file, args) => file === "ollama" && args[0] === "list" ? "NAME\nllama3.2:latest\n" : "");
  assert.equal(missing.find((e) => e.id === "ollama-gpt-oss")?.installed, false);
  const ready = availableEngines((file, args) => file === "ollama" && args[0] === "list" ? "NAME\ngpt-oss:20b\n" : "");
  assert.equal(ready.find((e) => e.id === "ollama-gpt-oss")?.installed, false);
  assert.match(ready.find((e) => e.id === "ollama-gpt-oss")?.note ?? "", /paused/i);
});

test("GPT-OSS is refused by every product route while paused", () => {
  assert.throws(() => requestAnalysisEngine("ollama-gpt-oss"), /paused/i);
  assert.throws(() => requestEngine("ollama-gpt-oss"), /paused/i);
  assert.equal(requestEngine("codex"), "codex");
  assert.throws(() => requestInteractiveAnalysisEngine("ollama-gpt-oss"), /paused/i);
});

test("manual initial outreach sends use the folder slug and contacted event metadata", () => {
  let recorded: unknown = null;
  const event = recordOutreachInitialSend("outreach/leads/platform-moral-ambition", {
    kind: "platform", latestMessage: {
      file: "messages/message-01.md", channel: "email", status: "locked", recipient: "Jane Doe", body: "Hello",
    }, contacts: [],
  }, (bucket, lead, opts) => {
    recorded = { bucket, lead, opts };
    return { ts: "2026-08-29T00:00:00.000Z", bucket, lead, event: "contacted", ...opts } as never;
  });
  assert.equal(event.event, "contacted");
  assert.deepEqual(recorded, {
    bucket: "platform", lead: "platform-moral-ambition",
    opts: { person: "Jane Doe", channel: "email", message: "messages/message-01.md", note: "Sent by hand from the Outreach composer" },
  });
  assert.throws(() => recordOutreachInitialSend("outreach/leads/platform-moral-ambition", {
    kind: "platform", latestMessage: { file: "messages/message-01.md", channel: "email", status: "draft", recipient: "", body: "Hello" }, contacts: [],
  }, (() => ({}) as never)), /lock/i);
});

test("Gmail sends require a locked email and record confirmed provider delivery", async () => {
  const detail = {
    kind: "client" as const,
    latestMessage: { file: "messages/message-01.md", channel: "email", status: "locked", recipient: "Jane Doe", body: "Hello" },
    contacts: [],
  };
  let request: unknown;
  let recorded: unknown;
  const result = await sendLockedOutreachEmail(
    "outreach/leads/client-example",
    detail,
    { to: "jane@example.com", subject: "A quick note" },
    async (value) => { request = value; return { provider: "gmail", account: "muxin.li.pro@gmail.com", providerMessageId: "gmail-1" }; },
    (bucket, lead, opts) => {
      recorded = { bucket, lead, opts };
      return { ts: "2026-09-01T00:00:00.000Z", bucket, lead, event: "contacted", ...opts } as never;
    },
  );
  assert.deepEqual(request, { to: "jane@example.com", subject: "A quick note", body: "Hello", messageId: "client-example:messages/message-01.md" });
  assert.equal(result.event?.event, "contacted");
  assert.deepEqual(recorded, { bucket: "client", lead: "client-example", opts: { person: "Jane Doe", channel: "email", message: "messages/message-01.md", note: "Delivered by Gmail (gmail-1)" } });
  await assert.rejects(() => sendLockedOutreachEmail("outreach/leads/client-example", { ...detail, latestMessage: { ...detail.latestMessage, status: "draft" } }, { to: "jane@example.com", subject: "Hi" }, async () => ({ status: "already_delivered" })), /lock/i);
});

test("uncertain Gmail delivery never advances the follow-up clock", async () => {
  let recorded = false;
  const result = await sendLockedOutreachEmail(
    "outreach/leads/platform-example",
    { kind: "platform", latestMessage: { file: "messages/message-01.md", channel: "email", status: "locked", recipient: "", body: "Hello" }, contacts: [] },
    { to: "jane@example.com", subject: "Hi" },
    async () => ({ status: "uncertain" }),
    (() => { recorded = true; return {} as never; }),
  );
  assert.equal(result.event, null);
  assert.equal(recorded, false);
});

test("reconciled Gmail delivery advances the follow-up clock only after a Sent-mail match", async () => {
  let recorded = false;
  const detail = { kind: "client" as const, latestMessage: { file: "messages/message-01.md", channel: "email", status: "locked", recipient: "Jane", body: "Hello" }, contacts: [] };
  const uncertain = await reconcileLockedOutreachEmail("outreach/leads/client-example", detail, { to: "jane@example.com", subject: "Hi" }, async () => ({ status: "uncertain" }), (() => { recorded = true; return {} as never; }));
  assert.equal(uncertain.event, null);
  assert.equal(recorded, false);
  const confirmed = await reconcileLockedOutreachEmail("outreach/leads/client-example", detail, { to: "jane@example.com", subject: "Hi" }, async () => ({ provider: "gmail", account: "muxin.li.pro@gmail.com", providerMessageId: "found-1" }), (() => { recorded = true; return { event: "contacted" } as never; }));
  assert.equal(confirmed.event?.event, "contacted");
  assert.equal(recorded, true);
});

test("Outreach Gmail browser path requires confirmation and preserves the manual fallback", () => {
  const server = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  assert.ok(server.includes('url.pathname === "/api/outreach/send-gmail"'));
  assert.match(server, /b\.confirm !== true/);
  assert.match(server, /reconcileLockedOutreachEmail/);
  assert.match(page, /window\.confirm\("Send this locked message now/);
  assert.match(page, /\/api\/outreach\/send-gmail/);
  assert.match(page, /I sent this by hand/);
});

test("Outreach Gmail HTTP route rejects a request without explicit confirmation before dispatch", async () => {
  const httpServer = createServer(reviewRequestHandler);
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/outreach/send-gmail`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir: "outreach/leads/client-example", to: "person@example.com", subject: "Hello" }),
    });
    const body = await response.json() as { ok?: boolean; error?: string };
    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.match(body.error ?? "", /confirmation/i);
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("fiction promotion handoff requires an approved promotional final", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.ok(source.includes('url.pathname === "/api/fiction/handoff"'));
  assert.match(source, /createLockedChapterHandoff/);
  assert.match(source, /scaffoldContentFolder/);
  assert.match(source, /writeContentRequest\(folder/);
  assert.match(source, /sourceKind: "fiction-promotion"/);
  assert.match(source, /promotion\.state !== "Approved"/);
  assert.match(source, /text: promotion\.body/);
});

test("Fiction idea inbox exposes classifier, review, approval, and rejection boundaries", () => {
  const source = readFileSync(new URL("./serve-fiction.ts", import.meta.url), "utf8");
  for (const route of ["/api/fiction/inbox", "/api/fiction/inbox/approve", "/api/fiction/inbox/reject"]) {
    assert.ok(source.includes(`url.pathname === "${route}"`), `missing ${route}`);
  }
  assert.match(source, /classifyIdea\(rawText, engine\)/);
  assert.match(source, /createCleanupProposal/);
  assert.match(source, /approveIdea/);
  assert.match(source, /queueChapter:/);
  assert.match(source, /rejectIdea/);
});

test("Fiction idea inbox exposes an explicit clarification-turn action", () => {
  const routeSource = readFileSync(new URL("./serve-fiction.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  assert.ok(routeSource.includes('url.pathname === "/api/fiction/inbox/clarify"'));
  assert.match(routeSource, /appendClarificationTurn/);
  assert.match(routeSource, /buildIdeaContext/);
  assert.match(pageSource, /ficClarify/);
  assert.match(pageSource, /\/api\/fiction\/inbox\/clarify/);
});

test("Fiction Studio exposes an explicit draft-PR and review-comment bridge", () => {
  const source = readFileSync(new URL("./serve-fiction.ts", import.meta.url), "utf8");
  for (const route of ["/api/fiction/pr/create", "/api/fiction/pr/revise"]) {
    assert.ok(source.includes(`url.pathname === "${route}"`), `missing ${route}`);
  }
  assert.match(source, /createStoryDraftPr/);
  assert.match(source, /listStoryReviewComments/);
  assert.match(source, /processChapterReviewComments/);
  assert.match(source, /reviseSpanWithEngine\(span, instruction, engine, repoRoot\)/);
  assert.match(source, /validateStoryChapter/);
});

test("Fiction page makes the PR bridge an explicit Studio action", () => {
  const source = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  assert.match(source, /id="ficPrCreate"/);
  assert.match(source, /id="ficPrRevise"/);
  assert.match(source, /\/api\/fiction\/pr\/create/);
  assert.match(source, /\/api\/fiction\/pr\/revise/);
});

test("Charles promotion has an approved request-only handoff route", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.ok(source.includes('url.pathname === "/api/charles/handoff"'));
  assert.match(source, /createApprovedCharlesHandoff/);
  assert.match(source, /toCharlesContentRequestInput/);
});

test("configured Content requests have one explicit draft-generation route", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.ok(source.includes('url.pathname === "/api/content/generate"'));
  assert.match(source, /readContentRequest\(safeFolder\(slug\)\)/);
  assert.match(source, /generateConfiguredContent/);
});

test("configured media has separate plan approval, queued render, and reviewed-file attachment routes", () => {
  const source = readFileSync(join(process.cwd(), "src/review/serve.ts"), "utf8");
  assert.ok(source.includes('url.pathname === "/api/content/media/approve"'));
  assert.ok(source.includes('url.pathname === "/api/content/media/render"'));
  assert.ok(source.includes('url.pathname === "/api/content/media/attach-reviewed"'));
  assert.match(source, /approveConfiguredMediaStage\(safeFolder\(slug\), id\)/);
  assert.match(source, /executeConfiguredMediaStage\(folder, id, defaultConfiguredMediaRenderer\)/);
  assert.match(source, /attachReviewedConfiguredMediaFiles\(folder, id, assetPaths\)/);
  assert.match(source, /runQueued\("configured-media-render"/);
  const attachRoute = source.slice(source.indexOf('url.pathname === "/api/content/media/attach-reviewed"'), source.indexOf('url.pathname === "/api/develop/start"'));
  assert.match(attachRoute, /await runQueued\("configured-media-render"/);
  assert.match(attachRoute, /attachReviewedConfiguredMediaFiles\(folder, id, assetPaths\)/);
});

test("POST attach-reviewed executes the real route and returns promoted reviewed media", async () => {
  const slug = `.test-attach-reviewed-${process.pid}-${Date.now()}`;
  const folder = join(process.cwd(), "content", slug);
  mkdirSync(join(folder, "media-stages"), { recursive: true });
  mkdirSync(join(folder, "reviewed"));
  writeFileSync(join(folder, "review-queue.md"), `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| m1 | linkedin | image | media-stages/m1.json | — | — | — | pending | | from GUI queue |\n`);
  writeFileSync(join(folder, "media-stages/m1.json"), JSON.stringify({
    version: "configured-media-stage-v1", id: "m1", media: "image", status: "staged",
    stage: "prompt-approval-required", plan: { kind: "image-prompt-brief", sourceExcerpt: "approved" }, primitives: ["reviewed"],
  }));
  writeFileSync(join(folder, "reviewed/art.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]));
  approveConfiguredMediaStage(folder, "m1");
  const httpServer = createServer(reviewRequestHandler);
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/content/media/attach-reviewed`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, id: "m1", assetPaths: ["reviewed/art.png"] }),
    });
    const body = await response.json() as { ok?: boolean; result?: { primaryAsset?: string }; error?: string };
    assert.equal(response.status, 200, body.error ?? "attach-reviewed route failed");
    assert.equal(body.ok, true);
    assert.equal(body.result?.primaryAsset, "configured-media/m1/image.png");
    assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /Attached reviewed image/);
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    rmSync(folder, { recursive: true, force: true });
  }
});

test("Studio Start routes a Fiction capture into a durable inbox idea, no model job (item 4)", async () => {
  // The fiction idea store honors CONTENT_AGENTS_HOME but not NODE_TEST_CONTEXT, so isolate it
  // explicitly — otherwise this leaks into Muxin's real ~/.content-agents fiction inbox.
  const home = mkdtempSync(join(tmpdir(), "fiction-start-home-"));
  const priorHome = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  const series = listFictionSeries();
  const httpServer = createServer(reviewRequestHandler);
  try {
    // The feature resolves the single series automatically; the repo carries exactly one.
    assert.equal(series.length, 1, "test assumes one fiction series in stories/");
    const slug = series[0]!.slug;
    const text = `A lighthouse keeper who edits the sea. ${Date.now()}`;
    const jobsBefore = jobStore.length;
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/captures/start`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: "Fiction", text }),
    });
    const body = await response.json() as { ok?: boolean; idea?: { id: string; series: string; rawText: string; status: string; classification: string; proposal: unknown }; job?: unknown; error?: string };
    assert.equal(response.status, 200, body.error ?? "fiction start failed");
    assert.equal(body.ok, true);
    assert.equal(body.idea?.series, slug);
    assert.equal(body.idea?.rawText, text);
    assert.equal(body.idea?.status, "needs-review");
    // No model job runs on Fiction Start. Guard the invariant directly, not just by wall-clock: the
    // response carries no job, the idea is unclassified with no cleanup proposal (a classified idea
    // would mean the model path ran), and nothing was enqueued into the shared job store.
    assert.equal(body.job, undefined, "Fiction Start returns no job — it must not enqueue a model run");
    assert.equal(body.idea?.classification, "clarify", "the idea stays unclassified; classification is a later Muxin step");
    assert.equal(body.idea?.proposal, null, "no cleanup proposal — the model cleanup path must not run on Start");
    assert.equal(jobStore.length, jobsBefore, "Fiction Start must not add a job to the store");
    // Durable: it is readable from the inbox store afterward, not just in the response.
    const stored = listIdeas(slug, home);
    assert.ok(stored.some((idea) => idea.rawText === text), "the idea persisted to the inbox store");
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    if (priorHome === undefined) delete process.env.CONTENT_AGENTS_HOME; else process.env.CONTENT_AGENTS_HOME = priorHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("Studio Start defaults room to Content, preserving the pre-item-4 callers", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const start = source.indexOf('url.pathname === "/api/captures/start"');
  const end = source.indexOf('url.pathname === "/api/content"', start);
  const route = source.slice(start, end);
  assert.match(route, /const room = String\(b\.room \?\? "Content"\)/, "room defaults to Content so existing start callers are unchanged");
  assert.match(route, /startCapture\("Content"/, "the Content path still runs the advisor-only develop enqueue");
  assert.match(route, /Studio Start does not create a room item for \$\{room\} yet/, "Charles/Venture/Outreach fail closed rather than silently no-op");
});

test("the initial GUI Content save derives source authority on the server", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const start = source.indexOf('url.pathname === "/api/content/request"');
  const end = source.indexOf('url.pathname === "/api/content/generate"', start);
  const route = source.slice(start, end);
  assert.match(route, /authorizeGuiContentRequest\(folder, input, existing\)/);
  assert.doesNotMatch(route, /:\s*input\s*;/, "fresh client input must not be persisted as source authority");
});

test("approval dispatches through the existing reviewed platform schedulers", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const start = source.indexOf('url.pathname === "/api/status"');
  const end = source.indexOf('url.pathname === "/api/cancel"', start);
  const route = source.slice(start, end);
  assert.match(route, /await scheduleApproved/);
  assert.match(route, /schedulingInFlight/);
  assert.doesNotMatch(route, /provider: "postiz"/);
});

test("Venture handoff refuses concurrent duplicate Content writes", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const start = source.indexOf('url.pathname === "/api/venture/handoff"');
  const end = source.indexOf('url.pathname === "/api/studio"', start);
  const route = source.slice(start, end);
  assert.match(route, /ventureHandoffsInFlight\.has/);
  assert.match(route, /ventureHandoffsInFlight\.add/);
  assert.match(route, /ventureHandoffsInFlight\.delete/);
  assert.match(route, /readContentRequest\(existingFolder\)/);
  assert.match(route, /existingRequest\.ventureSource\?\.artifactId/);
});

test("the E2E start seam owns the loopback listen and direct execution delegates to it", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  const seam = source.indexOf("export function startReviewServer");
  const guard = source.indexOf("startReviewServer();", seam + 1);
  assert.ok(seam >= 0, "serve.ts must export the explicit start seam");
  assert.ok(guard > seam, "the direct-run guard must delegate to the seam");
  assert.match(source.slice(seam, guard), /server\.listen\(PORT, "127\.0\.0\.1"/);
});

test("ventureAnalysisPrompt is read-only and carries the server-derived state", () => {
  const prompt = ventureAnalysisPrompt("my-venture", { phase: 2, next: "review" });
  assert.match(prompt, /\.claude\/skills\/venture\/SKILL\.md/);
  assert.match(prompt, /do not write, edit, delete, or advance/);
  assert.match(prompt, /my-venture/);
  assert.match(prompt, /"phase": 2/);
});

// "Revise with Claude" (Muxin, 2026-07-03): the GUI shells out to headless `claude -p` to edit one
// derivative in place. The prompt is the only guardrail against Claude wandering — these lock it in.

test("revisePrompt scopes to one file and carries the extraction-first + voice guardrails", () => {
  const p = revisePrompt("2026-06-16-foo", "x-1", "x", "make it punchier");
  assert.match(p, /content\/2026-06-16-foo\/derivatives\/x-1\.md/); // the exact file, nothing else
  assert.match(p, /make it punchier/); // Muxin's instruction is included
  assert.match(p, /Edit ONLY that one file/);
  assert.match(p, /frontmatter/); // preserve frontmatter
  assert.match(p, /source\.md/); // extraction-first traceability
  assert.match(p, /voice\.yaml/); // no em dashes / AI tells
  assert.ok(!/quote-card CAPTION/.test(p), "x-1 is not a card caption");
});

test("revisePrompt adds the context-only rule only for a quote-card caption id", () => {
  const caption = revisePrompt("2026-06-16-foo", "quote-card-2-linkedin", "linkedin", "tighten it");
  assert.match(caption, /quote-card CAPTION/);
  assert.match(caption, /context-only/);

  // the card DEFINITION derivative (quote-card-2, the quote itself) is not a caption
  const def = revisePrompt("2026-06-16-foo", "quote-card-2", "quote-card", "x");
  assert.ok(!/quote-card CAPTION/.test(def));
});

// "Add / Queue" tab (Muxin, 2026-07-03): the GUI is the front door now. A raw source string is
// routed to /atomize as a url, a real file path, or pasted text — this decides which.
test("classifySource routes urls, existing files, and pasted text", () => {
  assert.equal(classifySource("https://x.substack.com/p/post").kind, "url");

  const file = classifySource("/vault/My Note.md", (p) => p === "/vault/My Note.md");
  assert.equal(file.kind, "file");
  assert.equal(file.arg, "/vault/My Note.md");
  assert.equal(file.label, "My Note.md");

  const text = classifySource("# An Idea\nsome body that isn't a path", () => false);
  assert.equal(text.kind, "text");
  assert.equal(text.label, "An Idea"); // title from the first heading, hash stripped

  // a path-looking string that doesn't resolve is a fast "file not found", never dispatched as
  // pasted text — a nonexistent path materialized as fake note content used to burn a full LLM
  // atomize run before the model itself noticed the input was garbage.
  const missing = classifySource("/nope/missing.md", () => false);
  assert.equal(missing.kind, "file-not-found");
  assert.equal(missing.arg, "/nope/missing.md");
});

test("classifySource recognizes ~/ and drive-letter paths as file-not-found too", () => {
  assert.equal(classifySource("~/vault/missing.md", () => false).kind, "file-not-found");
  assert.equal(classifySource("C:\\notes\\missing.md", () => false).kind, "file-not-found");
  // a slash inside prose (has a space) is still plain pasted text, not a phantom path
  assert.equal(classifySource("thoughts on love/loss and grief", () => false).kind, "text");
});

test("sourceDispatch surfaces an immediate error for file-not-found instead of dispatching a job", () => {
  const dispatch = sourceDispatch(classifySource("/nope/missing.md", () => false), "/nope/missing.md");
  assert.ok("error" in dispatch);
  assert.match((dispatch as { error: string }).error, /no such file/);

  const textDispatch = sourceDispatch(classifySource("just some pasted text", () => false), "just some pasted text");
  assert.equal(("kind" in textDispatch && textDispatch.kind) || null, "text");
});

// Analytics tab "raw downloaded exports" viewer (Muxin, 2026-07-04): serves files straight out of
// data/inbox and data/processed by a client-supplied relative path — this guard is the only thing
// standing between that and reading arbitrary files off disk.
// Approve guard (Muxin, 2026-07-04): the "video-script" row (format=storyboard) drafts
// video/script-draft.md long before /video turns it into video/storyboard.md — the one file
// src/video/render.ts's own render gate trusts. Approving off the draft alone is a phantom
// approval. `exists` is injected so these don't touch the real filesystem.
const storyboardRow: QueueRow = {
  id: "video-script", platform: "video-script", format: "storyboard", asset: "—",
  status: "blocked", notes: "", lineIndex: 0,
};

test("approveBlockReason blocks a storyboard row when video/storyboard.md doesn't exist", () => {
  const reason = approveBlockReason("/content/2026-06-16-foo", storyboardRow, () => false);
  assert.match(reason ?? "", /storyboard not rendered yet/);
  assert.match(reason ?? "", /\/video/); // tells Muxin what to run
});

test("approveBlockReason allows the same storyboard row once video/storyboard.md exists", () => {
  const reason = approveBlockReason(
    "/content/2026-06-16-foo",
    storyboardRow,
    (p) => p === "/content/2026-06-16-foo/video/storyboard.md",
  );
  assert.equal(reason, null);
});

test("approveBlockReason never treats a configured media plan record as a finished publishable asset", () => {
  const staged: QueueRow = {
    id: "carousel-1", platform: "linkedin", format: "image", asset: "media-stages/carousel-1.json",
    status: "pending", notes: "", origin: "from GUI queue", lineIndex: 0,
  };
  assert.match(approveBlockReason("/content/example", staged, () => true) ?? "", /staged media plan.*not a rendered asset/i);
});

test("approveBlockReason never blocks text rows, even with nothing on disk", () => {
  const textRow: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 1 };
  const alwaysFalse = () => false;
  assert.equal(approveBlockReason("/content/2026-06-16-foo", textRow, alwaysFalse), null);
});

// Quote-card (format=image) rows carry the same missing-render risk as storyboard/video above — a
// row can land in review-queue.md before /render -- --still ever produces its PNG.
test("approveBlockReason blocks an image/quote-card row whose PNG isn't rendered yet", () => {
  const imageRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const cardCaptionRow: QueueRow = { id: "quote-card-6-x", platform: "quote-card:x", format: "image", asset: "images/quote-card-6.png", status: "pending", notes: "", lineIndex: 3 };
  const alwaysFalse = () => false;
  assert.match(approveBlockReason("/content/2026-06-16-foo", imageRow, alwaysFalse) ?? "", /not rendered yet/);
  assert.match(approveBlockReason("/content/2026-06-16-foo", cardCaptionRow, alwaysFalse) ?? "", /not rendered yet/);
});

test("approveBlockReason allows an image/quote-card row once its PNG exists", () => {
  const imageRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const exists = (p: string) => p === "/content/2026-06-16-foo/images/quote-card-1.png";
  assert.equal(approveBlockReason("/content/2026-06-16-foo", imageRow, exists), null);
});

test("approveBlockReason doesn't block an image/quote-card row with no asset cell yet (nothing to check)", () => {
  const noAssetRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "—", status: "pending", notes: "", lineIndex: 2 };
  assert.equal(approveBlockReason("/content/2026-06-16-foo", noAssetRow, () => false), null);
});

// "video"/"short" rows carry the same missing-render risk as the video-script row above (the
// rendered short + its TikTok row are also added to review-queue.md right after a /video render —
// docs/content-agents-backlog.md card 4bef9a7c calls this out by name as "storyboard/video rows").
test("approveBlockReason blocks a video/short row whose asset isn't rendered yet", () => {
  const videoRow: QueueRow = { id: "qvid-x", platform: "x", format: "video", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 4 };
  const shortRow: QueueRow = { id: "tiktok-1", platform: "tiktok", format: "short", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 5 };
  const alwaysFalse = () => false;
  assert.match(approveBlockReason("/content/2026-06-16-foo", videoRow, alwaysFalse) ?? "", /not rendered yet/);
  assert.match(approveBlockReason("/content/2026-06-16-foo", shortRow, alwaysFalse) ?? "", /not rendered yet/);
});

test("approveBlockReason allows a video/short row once its asset exists", () => {
  const videoRow: QueueRow = { id: "qvid-x", platform: "x", format: "video", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 4 };
  const exists = (p: string) => p === "/content/2026-06-16-foo/video/short.mp4";
  assert.equal(approveBlockReason("/content/2026-06-16-foo", videoRow, exists), null);
});

test("approveBlockReason doesn't block a video/short row with no asset cell yet (nothing to check)", () => {
  const noAssetRow: QueueRow = { id: "tiktok-1", platform: "tiktok", format: "short", asset: "—", status: "pending", notes: "", lineIndex: 5 };
  assert.equal(approveBlockReason("/content/2026-06-16-foo", noAssetRow, () => false), null);
});

// Security fix (card db22283f follow-up): rows.ts's `isReply` gate inside enrich() only ever
// drove the revisable/duplicatable BUTTON flags in the GUI — a client-side hint, not a server-side
// gate. A request straight at /api/revise or /api/duplicate for a "reply to mention" row's id could
// still reach reviseDerivative/duplicateToPlatform, both of which run a `claude -p` prompt over
// content/<slug>/source.md — for that origin, the mention author's own untrusted post text, not
// Muxin's — through runClaudeSpawn's DEFAULT permission mode (acceptEdits, full tool access),
// unlike reply-draft.ts's locked-down `--tools ""` spawn for that same untrusted text.
// replyToMentionBlockReason is what those two route handlers in serve.ts (~/api/revise, ~/api/duplicate)
// now call FIRST, sourced from the row's real persisted origin via readQueue — never a
// client-supplied flag — returning early with a 400 before reviseDerivative/duplicateToPlatform
// (and therefore any `claude -p` spawn) is ever reached.
test('replyToMentionBlockReason blocks a row whose persisted origin is "reply to mention"', () => {
  const row: QueueRow = {
    id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md",
    status: "pending", notes: "reply to @alice.bsky.social", origin: "reply to mention", lineIndex: 1,
  };
  const reason = replyToMentionBlockReason(row);
  assert.match(reason ?? "", /reply-to-mention row/);
  assert.match(reason ?? "", /not Muxin's writing/);
});

test("replyToMentionBlockReason allows every other origin, a row with no origin column, and an unknown id", () => {
  const base = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 1 };
  assert.equal(replyToMentionBlockReason({ ...base, origin: "from /cycle" }), null);
  assert.equal(replyToMentionBlockReason({ ...base, origin: "from GUI queue" }), null);
  assert.equal(replyToMentionBlockReason({ ...base }), null); // pre-2026-07-04 row, no origin cell
  // An id that doesn't match any row (readQueue's .find() returns undefined) isn't blocked here —
  // it falls through to reviseDerivative/duplicateToPlatform's own "no such row" error, same as
  // before this fix, so a bad id still gets a real error instead of a misleading reply-gate message.
  assert.equal(replyToMentionBlockReason(undefined), null);
});

test("isSafeRawPath only allows paths under data/inbox or data/processed", () => {
  assert.ok(isSafeRawPath("inbox/x/export.csv"));
  assert.ok(isSafeRawPath("processed/foo.json"));
  assert.ok(!isSafeRawPath("../../.env"));
  assert.ok(!isSafeRawPath("/etc/passwd"));
  assert.ok(!isSafeRawPath("config/voice.yaml")); // outside the two allowed roots
  assert.ok(!isSafeRawPath(""));
});

test("isValidLeadDir only allows a single real segment under outreach/leads/", () => {
  assert.ok(isValidLeadDir("outreach/leads/client-acme-co"));
  assert.ok(isValidLeadDir("outreach/leads/platform-foo.bar"));
  assert.ok(!isValidLeadDir("outreach/leads/..")); // single-segment ".." would resolve one level up
  assert.ok(!isValidLeadDir("outreach/leads/."));
  assert.ok(!isValidLeadDir("outreach/leads/../../../etc/passwd"));
  assert.ok(!isValidLeadDir("/etc/passwd"));
  assert.ok(!isValidLeadDir(""));
});

// Approve → auto-schedule for cards / tiktok / video / substack (Muxin, 2026-07-04): approving one
// of these rows in the GUI now schedules it via its platform's existing publish function (no
// separate /publish run), mirroring the text→Typefully path. `SchedulerDeps` is injected so these
// route/error tests NEVER touch a real PostPeer / Upload-Post / YouTube / browser network call.
const row = (over: Partial<QueueRow>): QueueRow => ({
  id: "r", platform: "x", format: "text", asset: "—", status: "approve", notes: "", lineIndex: 0, ...over,
});

test("scheduleKind routes each row type to the publisher that owns its filter", () => {
  assert.equal(scheduleKind(row({ platform: "x", format: "text" })), "text");
  assert.equal(scheduleKind(row({ platform: "linkedin" })), "text");
  assert.equal(scheduleKind(row({ platform: "bluesky" })), "text");
  // a native-video post on a text platform (the animated quote video: {x|linkedin|bluesky, video})
  // still goes via Typefully, NOT youtube — text platforms are matched first, which is required so
  // these real qvid rows don't fall to youtube.ts (whose filter is format==="short", not "video").
  assert.equal(scheduleKind(row({ platform: "x", format: "video" })), "text");
  assert.equal(scheduleKind(row({ platform: "quote-card", format: "image" })), "card");
  assert.equal(scheduleKind(row({ platform: "quote-card:linkedin", format: "image" })), "card");
  assert.equal(scheduleKind(row({ platform: "tiktok", format: "short" })), "tiktok"); // matched before video
  // the YouTube Short row (format "short" only ever appears on youtube/tiktok rows, never a text platform)
  assert.equal(scheduleKind(row({ platform: "youtube", format: "short" })), "video");
  assert.equal(scheduleKind(row({ platform: "youtube", format: "video" })), "video");
  assert.equal(scheduleKind(row({ platform: "substack", format: "text" })), "substack");
  // a row no scheduler owns just gets the plain approve status (e.g. the storyboard row)
  assert.equal(scheduleKind(row({ platform: "video-script", format: "storyboard" })), null);
  // Outreach Phase 2: Approve on an outreach-message row means LOCK, never a real scheduler —
  // routed by format (fixed), not platform (the channel: email|linkedin-dm|contact-form|podcast-pitch).
  assert.equal(scheduleKind(row({ platform: "email", format: "outreach-message" })), "outreach-lock");
  assert.equal(scheduleKind(row({ platform: "podcast-pitch", format: "outreach-message" })), "outreach-lock");
});

// Stub deps: record which publisher fired + return a marker so we can assert the row's scheduled
// info came back. Any dep NOT overridden throws if called, proving routing hit exactly one path.
function stubDeps(): { deps: SchedulerDeps; calls: Record<string, { folder: string; onlyIds?: string[] }[]> } {
  const calls: Record<string, { folder: string; onlyIds?: string[] }[]> = {
    publishText: [], publishCards: [], publishTikTok: [], publishShorts: [], publishSubstack: [], lockOutreachMessage: [],
  };
  const rec = (name: string) => async (folder: string, opts?: { onlyIds?: string[] }) => {
    calls[name].push({ folder, onlyIds: opts?.onlyIds });
    return [{ scheduledBy: name }];
  };
  return {
    calls,
    deps: {
      publishText: rec("publishText"),
      publishCards: rec("publishCards"),
      publishTikTok: rec("publishTikTok"),
      publishShorts: rec("publishShorts"),
      publishSubstack: rec("publishSubstack"),
      lockOutreachMessage: rec("lockOutreachMessage"),
      resolveDeliveryPolicy: (_folder, provider) => ({
        policyVersion: "delivery-policy-v1", origin: "human-inference", brand: "human-inference",
        provider, providerAccountId: provider === "manual" ? null : `human-inference/${provider}`,
        mode: provider === "manual" ? "manual" : "provider", reason: "test fixture",
      }),
    },
  };
}

test("scheduleApproved schedules a TEXT row via publishText only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/content/2026-06-16-foo", row({ id: "x-1", platform: "x", format: "text" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishText" }, scheduleError: null });
  assert.deepEqual(calls.publishText, [{ folder: "/content/2026-06-16-foo", onlyIds: ["x-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a CARD row via publishCards only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/content/2026-06-16-foo", row({ id: "quote-card-1", platform: "quote-card:x", format: "image" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishCards" }, scheduleError: null });
  assert.deepEqual(calls.publishCards, [{ folder: "/content/2026-06-16-foo", onlyIds: ["quote-card-1"] }]);
  assert.equal(
    calls.publishTikTok.length + calls.publishShorts.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a TIKTOK row via publishTikTok only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishTikTok" }, scheduleError: null });
  assert.deepEqual(calls.publishTikTok, [{ folder: "/f", onlyIds: ["tiktok-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishShorts.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a VIDEO (Short) row via publishShorts only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "yt-1", platform: "youtube", format: "short" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishShorts" }, scheduleError: null });
  assert.deepEqual(calls.publishShorts, [{ folder: "/f", onlyIds: ["yt-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a SUBSTACK row via publishSubstack only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "note-1", platform: "substack", format: "text" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishSubstack" }, scheduleError: null });
  assert.deepEqual(calls.publishSubstack, [{ folder: "/f", onlyIds: ["note-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishText.length,
    0,
  );
});

test("scheduleApproved surfaces a scheduleError (row stays approve) when the publisher throws", async () => {
  const { deps } = stubDeps();
  deps.publishTikTok = async () => {
    throw new Error("PostPeer returned 402 — free-tier posts exhausted");
  };
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /402/); // visible reason, not a crash
});

test("scheduleApproved does nothing for a row no scheduler owns", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ platform: "video-script", format: "storyboard" }), deps);
  assert.deepEqual(out, { scheduled: null, scheduleError: null });
  assert.equal(
    calls.publishText.length +
      calls.publishCards.length +
      calls.publishTikTok.length +
      calls.publishShorts.length +
      calls.publishSubstack.length +
      calls.lockOutreachMessage.length,
    0,
  );
});

// Outreach Phase 2, GUI approve-equals-lock semantics: approving an outreach-message row must
// call lock.ts (via deps.lockOutreachMessage) and NEVER any real scheduler/publisher — CLAUDE.md
// rule 2 analog, there is no send path. Same dispatch/injection pattern as every publisher above.
test("scheduleApproved locks an OUTREACH-MESSAGE row via lockOutreachMessage only, never a real publisher", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved(
    "/outreach/leads/client-acme-co",
    row({ id: "message-01", platform: "email", format: "outreach-message" }),
    deps,
  );
  assert.deepEqual(out, { scheduled: { scheduledBy: "lockOutreachMessage" }, scheduleError: null });
  assert.deepEqual(calls.lockOutreachMessage, [{ folder: "/outreach/leads/client-acme-co", onlyIds: ["message-01"] }]);
  assert.equal(
    calls.publishText.length + calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved surfaces a scheduleError (row stays approve) when locking fails validation", async () => {
  const { deps } = stubDeps();
  deps.lockOutreachMessage = async () => {
    throw new Error("refusing to lock message-01.md, fails the two-sided guard");
  };
  const out = await scheduleApproved(
    "/outreach/leads/client-acme-co",
    row({ id: "message-01", platform: "email", format: "outreach-message" }),
    deps,
  );
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /two-sided guard/);
});

// A publisher can skip a row WITHOUT throwing (the reuse guard, or cards.ts finding no connected
// account for the row's target) — it just returns []. That must surface as a scheduleError, not the
// same {scheduled:null, scheduleError:null} shape as "no scheduler owns this row" — otherwise the GUI
// shows a bare "Approved" for both a harmless no-op AND a real, silently-skipped schedule attempt.
test("scheduleApproved surfaces a scheduleError when the publisher runs but schedules nothing", async () => {
  const { deps } = stubDeps();
  deps.publishTikTok = async () => [];
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /reuse guard|connected account/);
});

// Live Typefully/PostPeer schedule reconciliation (Muxin, 2026-07-04): GET /api/queue calls
// enrich() per row to attach row.reconciled — this exercises that REAL function (not a
// reimplementation) against a temp folder, proving the GOAL_CONDITION end to end: one published
// row whose draft is genuinely live at the provider shows its real time, one approved row with
// nothing scheduled is flagged as a mismatch. No network — the live provider state is injected.
function tmpContentFolder(): string {
  return mkdtempSync(join(tmpdir(), "reconcile-serve-test-"));
}

test("enrich() attaches the provider's real time to a row that's genuinely live", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "98765", whenIso: "2026-07-10T16:00:00.000Z", platforms: ["x"], title: "x-1 (content-agents)" }],
      postpeerPosts: [],
    };
    const log = { text: "- 2026-07-04T00:00:00.000Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n" };
    const r = row({ id: "x-1", platform: "x", format: "text", status: "published" });
    const out = enrich(folder, "2026-07-04-demo", r, log, live);
    assert.equal(out.reconciled?.provider, "typefully");
    assert.equal(out.reconciled?.state, "scheduled");
    assert.ok(out.reconciled?.when, "should carry the provider's real scheduled time");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("enrich() flags an approved row with nothing scheduled at the provider as a mismatch", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
    const r = row({ id: "tiktok-1", platform: "tiktok", format: "short", status: "approve" });
    const out = enrich(folder, "2026-07-04-demo", r, { text: "" }, live);
    assert.equal(out.reconciled?.provider, "postpeer");
    assert.equal(out.reconciled?.state, "mismatch");
    assert.match(out.reconciled?.reason ?? "", /no scheduled PostPeer post recorded/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("enrich() omits reconciled entirely for a row that isn't approved yet", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
    const r = row({ id: "x-2", platform: "x", format: "text", status: "pending" });
    const out = enrich(folder, "2026-07-04-demo", r, { text: "" }, live);
    assert.equal(out.reconciled, undefined);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// Job observability (Codebase-review fix Phase 1, 2026-07-08): persist + stream Claude job logs,
// heartbeat + elapsed in the jobs pill, durable errors instead of a black box.

test("jobLogPath keeps every job's log under one dir, one file per job id", () => {
  const a = jobLogPath("job-1");
  const b = jobLogPath("job-2");
  assert.match(a, /gui-jobs[/\\]job-1\.log$/);
  assert.match(b, /gui-jobs[/\\]job-2\.log$/);
  assert.notEqual(a, b);
});

test("lastNonEmptyLine: the heartbeat is the last real line, ignoring trailing blank lines", () => {
  assert.equal(lastNonEmptyLine("line one\nline two\n"), "line two");
  assert.equal(lastNonEmptyLine("only line"), "only line");
  assert.equal(lastNonEmptyLine("line one\n\n   \n"), "line one");
});

test("lastNonEmptyLine: no output yet is null, not an empty string", () => {
  assert.equal(lastNonEmptyLine(""), null);
  assert.equal(lastNonEmptyLine("\n\n"), null);
});

test("tailLines: keeps the last N non-blank lines, dropping earlier ones", () => {
  const text = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
  const tail = tailLines(text, 30);
  const lines = tail.split("\n");
  assert.equal(lines.length, 30);
  assert.equal(lines[0], "line 20");
  assert.equal(lines[29], "line 49");
});

test("tailLines: shorter input than N returns everything, blank lines dropped", () => {
  assert.equal(tailLines("a\n\nb\nc", 30), "a\nb\nc");
});

test("jobElapsedMs: null for a job that hasn't started yet", () => {
  assert.equal(jobElapsedMs({ status: "queued", startedAt: null, finishedAt: null }), null);
});

test("jobElapsedMs: keeps ticking against `now` while running", () => {
  const ms = jobElapsedMs({ status: "running", startedAt: 1000, finishedAt: null }, 4500);
  assert.equal(ms, 3500);
});

test("jobElapsedMs: freezes at finishedAt-startedAt once the job lands", () => {
  const ms = jobElapsedMs({ status: "done", startedAt: 1000, finishedAt: 6000 }, 999_999);
  assert.equal(ms, 5000);
});

// "Generate insights" data-first fix (Muxin, 2026-07-16): the reports it runs were always live off
// data/analytics.db — the only stale input was the full latest brief it inlined with no age signal.
// These four pure helpers replace that with a real "as of" stamp and a trimmed, dated brief excerpt
// instead of a whole-file dump (mdToHtml has no markdown-link syntax, so the brief is surfaced as a
// dated reference for the client to render as a real <a>, never as raw brief text in Claude's
// synthesis prompt/output).

test("daysAgo: same calendar day is 0", () => {
  const now = new Date("2026-07-16T18:00:00Z").getTime();
  assert.equal(daysAgo("2026-07-16", now), 0);
});

test("daysAgo: counts whole days between a date and now", () => {
  const now = new Date("2026-07-16T12:00:00Z").getTime();
  assert.equal(daysAgo("2026-06-24", now), 22);
});

test("daysAgo: accepts a full ISO timestamp, only the date part matters", () => {
  const now = new Date("2026-07-16T00:00:00Z").getTime();
  assert.equal(daysAgo("2026-07-12T09:41:00.000Z", now), 4);
});

test("computeFreshness: null when every date is null/undefined (no data at all)", () => {
  assert.equal(computeFreshness([null, undefined, null], Date.now()), null);
});

test("computeFreshness: picks the MOST RECENT of several dates, ignoring nulls", () => {
  const now = new Date("2026-07-16T00:00:00Z").getTime();
  const f = computeFreshness([null, "2026-07-01T00:00:00Z", "2026-07-12T09:41:00.000Z", null], now);
  assert.deepEqual(f, { date: "2026-07-12", ageDays: 4 });
});

test("parseBriefDate: extracts the date from a well-formed brief filename", () => {
  assert.equal(parseBriefDate("2026-06-24-strategy-brief.md"), "2026-06-24");
});

test("parseBriefDate: null for anything that doesn't match the exact pattern", () => {
  assert.equal(parseBriefDate("strategy-brief.md"), null);
  assert.equal(parseBriefDate("2026-06-24-strategy-brief.draft.md"), null);
  assert.equal(parseBriefDate("notes.md"), null);
});

test("extractSection: pulls one ## section through the next ## heading", () => {
  const md = [
    "# Strategy Brief: 2026-06-24",
    "intro text",
    "## Last cycle scorecard",
    "| Bet | Verdict |",
    "|---|---|",
    "| 001 | passed |",
    "## Data confidence",
    "| Channel | Status |",
  ].join("\n");
  const section = extractSection(md, "Last cycle scorecard");
  assert.match(section ?? "", /^## Last cycle scorecard/);
  assert.match(section ?? "", /001 \| passed/);
  assert.ok(!section?.includes("Data confidence"), "must stop before the next ## heading");
});

test("extractSection: a section at the end of the file runs to EOF", () => {
  const md = "# Brief\n## Directives for atomization\n- prioritize_pillar: human-ai\n- format_notes: short posts\n";
  const section = extractSection(md, "Directives for atomization");
  assert.match(section ?? "", /prioritize_pillar: human-ai/);
  assert.match(section ?? "", /format_notes: short posts/);
});

test("extractSection: null when the header isn't present (older or hand-edited brief)", () => {
  assert.equal(extractSection("# Brief\nsome text, no headers at all", "Directives for atomization"), null);
});

test("extractSection: header match is case-insensitive but the exact header text still must match", () => {
  const md = "## directives for atomization\nsome directive\n";
  assert.match(extractSection(md, "Directives for atomization") ?? "", /some directive/);
  assert.equal(extractSection(md, "Last cycle scorecard"), null);
});

// ── isValidMessageFile — the Outreach tab's inline draft editor may only touch a lead's own
// messages/message-NN.md, same allowlist posture as isValidLeadDir.

test("isValidMessageFile accepts only the messages/message-NN.md shape", () => {
  assert.equal(isValidMessageFile("messages/message-01.md"), true);
  assert.equal(isValidMessageFile("messages/message-12.md"), true);
  assert.equal(isValidMessageFile("messages/../lead.md"), false);
  assert.equal(isValidMessageFile("/etc/passwd"), false);
  assert.equal(isValidMessageFile("lead.md"), false);
  assert.equal(isValidMessageFile("messages/message-.md"), false);
  assert.equal(isValidMessageFile(""), false);
});

// ── outreachDraftGuard — the whole guard for POST /api/outreach/draft (v7 handoff §3). Reuses the
// same lead-folder allowlist every other outreach route uses, and caps a pasted-document direction.

test("outreachDraftGuard refuses anything outside a real outreach/leads/<dir> folder", () => {
  for (const bad of ["", "outreach/leads/..", "outreach/leads/../../etc/passwd", "/etc/passwd", "content/foo"]) {
    const g = outreachDraftGuard({ dir: bad, direction: "keep it short" });
    assert.ok("error" in g, `expected ${bad} to be refused`);
    assert.match((g as { error: string }).error, /valid outreach lead folder/);
  }
  // A missing dir is refused the same way, not treated as an empty-but-fine value.
  assert.ok("error" in outreachDraftGuard({}));
});

test("outreachDraftGuard accepts a real lead folder and passes the direction through", () => {
  const g = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "  keep it short  " });
  assert.deepEqual(g, { dir: "outreach/leads/client-acme-co", direction: "keep it short", engine: "codex" });
});

test("outreachDraftGuard turns a blank direction into undefined, never an empty string", () => {
  // Load-bearing: `undefined` is what keeps buildDraftPrompt byte-identical for existing callers.
  for (const blank of ["", "   ", "\n\t "]) {
    const g = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: blank });
    assert.deepEqual(g, { dir: "outreach/leads/client-acme-co", direction: undefined, engine: "codex" });
  }
  assert.deepEqual(outreachDraftGuard({ dir: "outreach/leads/client-acme-co" }), {
    dir: "outreach/leads/client-acme-co",
    direction: undefined,
    engine: "codex",
  });
});

test("outreachDraftGuard accepts ChatGPT/Grok and rejects every other outreach engine", () => {
  assert.deepEqual(
    outreachDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "grok" }),
    { dir: "outreach/leads/client-acme-co", direction: undefined, engine: "grok" },
  );
  for (const engine of ["claude", "unsupported"]) {
    const result = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", engine });
    assert.ok("error" in result);
    assert.match((result as { error: string }).error, /ChatGPT or Grok/);
  }
});

test("outreachDraftGuard caps a pasted-document direction before it reaches a spawn", () => {
  const ok = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "x".repeat(MAX_DIRECTION_CHARS) });
  assert.ok(!("error" in ok));
  const tooLong = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "x".repeat(MAX_DIRECTION_CHARS + 1) });
  assert.ok("error" in tooLong);
  assert.match((tooLong as { error: string }).error, /under 2000 characters/);
});

test("followUpDraftGuard validates the route folder and propagates the optional engine", () => {
  assert.deepEqual(
    followUpDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "grok" }),
    { dir: "outreach/leads/client-acme-co", engine: "grok" },
  );
  assert.deepEqual(
    followUpDraftGuard({ dir: "outreach/leads/client-acme-co" }),
    { dir: "outreach/leads/client-acme-co", engine: "codex" },
  );
  assert.ok("error" in followUpDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "claude" }));
  assert.ok("error" in followUpDraftGuard({ dir: "outreach/leads/../escape", engine: "codex" }));
});

// ── appendLeadNote — Muxin's per-lead notes ("what stood out, why interested"), appended dated
// under lead.md's ## Muxin notes so the memory-jogger travels with the lead file itself.

const LEAD_RAW = [
  "---",
  "kind: client",
  'name: "Acme Co"',
  "---",
  "",
  "## Profile",
  "",
  "Acme makes widgets.",
  "",
  "## Decision log",
  "",
  "- 2026-07-10: intake",
  "",
].join("\n");

test("appendLeadNote creates ## Muxin notes before ## Decision log when the section is missing", () => {
  const out = appendLeadNote(LEAD_RAW, "loved the founder's blog voice", "2026-07-16");
  const notesAt = out.indexOf("## Muxin notes");
  const decisionAt = out.indexOf("## Decision log");
  assert.ok(notesAt !== -1 && decisionAt !== -1 && notesAt < decisionAt, "notes section lands before the decision log");
  assert.match(out, /- 2026-07-16: loved the founder's blog voice/);
  assert.match(out, /^---\n/, "frontmatter block survives");
  assert.match(out, /Acme makes widgets\./, "profile body survives");
});

test("appendLeadNote appends into an existing ## Muxin notes section, keeping order", () => {
  const withSection = appendLeadNote(LEAD_RAW, "first note", "2026-07-16");
  const out = appendLeadNote(withSection, "second note", "2026-07-17");
  const first = out.indexOf("first note");
  const second = out.indexOf("second note");
  const decisionAt = out.indexOf("## Decision log");
  assert.ok(first !== -1 && second !== -1 && first < second, "notes accumulate in order");
  assert.ok(second < decisionAt, "new note stays inside the notes section, not after the decision log");
  assert.equal(out.match(/## Muxin notes/g)?.length, 1, "no duplicate section");
});

test("appendLeadNote appends the section at the end when there is no ## Decision log", () => {
  const raw = "---\nkind: client\n---\n\n## Profile\n\nAcme.\n";
  const out = appendLeadNote(raw, "note", "2026-07-16");
  assert.match(out, /## Muxin notes/);
  assert.ok(out.indexOf("## Muxin notes") > out.indexOf("## Profile"));
  assert.match(out, /- 2026-07-16: note/);
});

// ── appendLeadContact (design 3d "WHO YOU'D REACH") ─────────────────────────────────────────────
test("appendLeadContact creates ## Contacts before ## Decision log and appends without duplicating", () => {
  const raw = `---\nkind: client\nname: "PostHog"\n---\n\n## Profile\n\ntext\n\n## Decision log\n\n- 2026-07-01: researched\n`;
  const once = appendLeadContact(raw, "Jamie R.", "community lead");
  assert.match(once, /## Contacts\n\n- Jamie R\. \| community lead\n/);
  assert.ok(once.indexOf("## Contacts") < once.indexOf("## Decision log"));
  const twice = appendLeadContact(once, "Annika L.", "");
  assert.match(twice, /- Jamie R\. \| community lead\n- Annika L\.\n/);
  assert.throws(() => appendLeadContact(twice, "jamie r.", "any"), /already a contact/);
});
