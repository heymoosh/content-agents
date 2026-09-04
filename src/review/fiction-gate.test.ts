import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { approveIdea, createCleanupProposal, createIdea, readIdea, type IdeaRecord } from "../fiction/idea-inbox.js";
import { listCaptures, saveCapture } from "./captures.js";
import {
  cancelCanonGate, canonGateDigest, canonGateId, confirmCanonGate, fictionQueueState, fictionResume, openCanonGate, projectFictionCapture, syncFictionQueue,
} from "./fiction-queue.js";
import { readQueueItem, type FictionQueuePayload, type RoomQueueItem } from "./room-queue.js";
import { handleFictionRoute } from "./serve-fiction.js";

// Slice 1.5c: the durable capture<->idea link (build-order item 4) and the confirm-before-canon
// gate (item 7). The fiction idea store honors CONTENT_AGENTS_HOME but not NODE_TEST_CONTEXT, so
// every test isolates it explicitly, or it writes Muxin's real inbox.
function withIsolatedHome<T>(fn: (home: string) => T): T {
  const home = mkdtempSync(join(tmpdir(), "fiction-gate-home-"));
  const prior = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  const restore = () => { if (prior === undefined) delete process.env.CONTENT_AGENTS_HOME; else process.env.CONTENT_AGENTS_HOME = prior; rmSync(home, { recursive: true, force: true }); };
  try {
    const result = fn(home);
    if (result instanceof Promise) return result.finally(restore) as T;
    restore(); return result;
  } catch (error) { restore(); throw error; }
}

function stores(label: string): { captures: string; queue: string } {
  const root = mkdtempSync(join(tmpdir(), `fiction-gate-${label}-`));
  return { captures: join(root, "captures.json"), queue: join(root, "room-queue.json") };
}

/** A throwaway stories/ tree with one series holding a bible, so a canon append has somewhere real to land. */
function storiesRoot(series: string): string {
  const root = mkdtempSync(join(tmpdir(), "fiction-gate-stories-"));
  mkdirSync(join(root, series));
  writeFileSync(join(root, series, "bible.md"), "# A Test Series, Story Bible\n\nThe world so far.\n");
  return root;
}

/** An idea whose cleanup proposal targets the bible: the exact shape the gate exists for. */
function worldIdea(home: string, stories: string, text: string, captureId?: string): IdeaRecord {
  const idea = createIdea("series-a", text, { storageRoot: home, storiesRoot: stories, classification: "world", ...(captureId ? { captureId } : {}) });
  createCleanupProposal(idea, `${text} (cleaned)`);
  return readIdea("series-a", idea.id, home)!;
}

// ---------------------------------------------------------------------------
// Item 4: two-store consistency.

test("createIdea records the capture id it was Started from, backfills a legacy record, and never overwrites one", () => withIsolatedHome((home) => {
  const legacy = createIdea("series-a", "an idea from the room's own inbox", { storageRoot: home });
  assert.equal(legacy.captureId, undefined, "existing callers that pass no capture id still produce a record without one");
  const backfilled = createIdea("series-a", legacy.rawText, { storageRoot: home, captureId: "capture-first" });
  assert.equal(backfilled.id, legacy.id);
  assert.equal(backfilled.captureId, "capture-first");
  assert.equal(readIdea("series-a", legacy.id, home)?.captureId, "capture-first", "the backfill is durable");
  const kept = createIdea("series-a", legacy.rawText, { storageRoot: home, captureId: "capture-second" });
  assert.equal(kept.captureId, "capture-first", "a recorded link is never overwritten by a later Start");
}));

test("reconciliation: a capture with no idea stays pending and unlinked; once the idea exists with its captureId, sync links by id even when the raw text is ambiguous across series", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("reconcile");
  // Partial failure: saveCapture succeeded, createIdea never ran.
  const capture = saveCapture("Fiction", "the same beat, two stories", captures);
  const sync = (): ReturnType<typeof syncFictionQueue> => syncFictionQueue({ series: ["series-a", "series-b"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  const orphaned = sync();
  assert.deepEqual(orphaned.items[0]!.payload, { kind: "fiction", series: null, ideaId: null });
  assert.equal(orphaned.items[0]!.state, "pending");
  assert.equal(orphaned.pending, 1);
  // The same raw text now lives in both series; only series-b's idea carries the explicit link.
  createIdea("series-a", capture.text, { storageRoot: home });
  const mine = createIdea("series-b", capture.text, { storageRoot: home, captureId: capture.id });
  const linked = sync();
  assert.deepEqual(linked.items[0]!.payload, { kind: "fiction", series: "series-b", ideaId: mine.id }, "the explicit id link wins over the ambiguous raw text");
  assert.equal(linked.items[0]!.state, "awaiting-answer");
  assert.equal(readQueueItem(capture.id, queue)?.payload.kind, "fiction");
  assert.equal((readQueueItem(capture.id, queue)?.payload as FictionQueuePayload).ideaId, mine.id, "the link is durable, not just derived in the response");
}));

test("the raw-text fallback only considers legacy ideas without a captureId", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("fallback");
  const capture = saveCapture("Fiction", "a beat one story has", captures);
  // An idea with the same text but an explicit link to some OTHER capture is not this capture's.
  createIdea("series-a", capture.text, { storageRoot: home, captureId: "capture-elsewhere" });
  const legacy = createIdea("series-b", capture.text, { storageRoot: home });
  const result = syncFictionQueue({ series: ["series-a", "series-b"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.deepEqual(result.items[0]!.payload, { kind: "fiction", series: "series-b", ideaId: legacy.id });
}));

// ---------------------------------------------------------------------------
// Item 7: confirm-before-canon.

test("an open canon gate is a durable awaiting-answer row; confirm promotes once, re-confirm is a no-op, cancel-after-confirm is refused", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("gate");
  const stories = storiesRoot("series-a");
  const capture = saveCapture("Fiction", "the lighthouse keeps a ledger of ships", captures);
  const idea = worldIdea(home, stories, capture.text, capture.id);
  const item = projectFictionCapture(capture, idea, queue);
  assert.equal(item.state, "pending", "a classified idea with a proposal is pending review, not yet a question");

  const opened = openCanonGate(capture.id, idea, queue);
  assert.equal(opened.status, 200);
  if (opened.status !== 200) return;
  assert.equal(opened.replayed, false);
  assert.equal(opened.item.state, "awaiting-answer");
  assert.deepEqual(opened.gate, { ...opened.gate, gateId: canonGateId(capture.id, canonGateDigest(idea.proposal!)), state: "open", target: "bible.md", resolvedAt: null });
  assert.deepEqual(opened.resume, { kind: "fiction", captureId: capture.id, series: "series-a", ideaId: idea.id, gate: { gateId: opened.gate.gateId, state: "open", target: "bible.md", digest: opened.gate.digest } });

  // A reload: the read-side sync re-reads the same open gate, it is not re-derived away.
  const reloaded = syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.equal(reloaded.items[0]!.state, "awaiting-answer");
  assert.equal(fictionResume(reloaded.items[0]!).gate?.gateId, opened.gate.gateId);
  assert.equal(reloaded.pending, 1, "an open confirmation still counts as needing Muxin's attention");

  // Asking again over the same proposal is the same gate, not a second question.
  const again = openCanonGate(capture.id, idea, queue);
  assert.equal(again.status, 200);
  if (again.status === 200) { assert.equal(again.replayed, true); assert.equal(again.gate.gateId, opened.gate.gateId); }

  let promotions = 0;
  const promote = (): IdeaRecord => { promotions += 1; return { ...idea, status: "approved" }; };
  const wrong = confirmCanonGate({ captureId: capture.id, gateId: "gate-not-this-one" }, promote, queue);
  assert.equal(wrong.status, 409, "a stale or foreign gate id never promotes");
  assert.equal(promotions, 0);

  const confirmed = confirmCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, promote, queue);
  assert.equal(confirmed.status, 200);
  if (confirmed.status !== 200) return;
  assert.equal(promotions, 1);
  assert.equal(confirmed.replayed, false);
  assert.equal(confirmed.gate.state, "confirmed");
  assert.ok(confirmed.gate.resolvedAt);
  assert.equal(confirmed.item.state, "complete");
  assert.equal(readQueueItem(capture.id, queue)?.state, "complete", "the confirmation is durable");

  const replay = confirmCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, promote, queue);
  assert.equal(replay.status, 200);
  if (replay.status === 200) assert.equal(replay.replayed, true);
  assert.equal(promotions, 1, "re-confirming never promotes twice");

  const cancelled = cancelCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, queue);
  assert.equal(cancelled.status, 409, "what is in canon cannot be un-confirmed from the queue");
  const reopen = openCanonGate(capture.id, idea, queue);
  assert.equal(reopen.status, 200);
  if (reopen.status === 200) assert.equal(reopen.gate.state, "confirmed", "asking again after promotion returns the confirmed gate, it never re-opens");
}));

test("cancel withdraws the question durably and idempotently; the same proposal can be asked again under the same gate id", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("cancel");
  const capture = saveCapture("Fiction", "a harbor that forgets its own name", captures);
  const idea = worldIdea(home, storiesRoot("series-a"), capture.text, capture.id);
  projectFictionCapture(capture, idea, queue);
  const opened = openCanonGate(capture.id, idea, queue);
  assert.equal(opened.status, 200);
  if (opened.status !== 200) return;
  const cancelled = cancelCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, queue);
  assert.equal(cancelled.status, 200);
  if (cancelled.status !== 200) return;
  assert.equal(cancelled.gate.state, "cancelled");
  assert.equal(cancelled.item.state, "pending", "the proposal is still pending review, just not being asked about");
  const twice = cancelCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, queue);
  assert.equal(twice.status, 200);
  if (twice.status === 200) assert.equal(twice.replayed, true);
  let promotions = 0;
  const refused = confirmCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, () => { promotions += 1; return idea; }, queue);
  assert.equal(refused.status, 409, "a cancelled gate never promotes");
  assert.equal(promotions, 0);
  const sync = syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.equal(sync.items[0]!.state, "pending", "a resolved gate no longer holds the row at awaiting-answer");
  const reopened = openCanonGate(capture.id, idea, queue);
  assert.equal(reopened.status, 200);
  if (reopened.status === 200) { assert.equal(reopened.replayed, false); assert.equal(reopened.gate.state, "open"); assert.equal(reopened.gate.gateId, opened.gate.gateId); }
}));

test("a promotion that throws leaves the gate open and the row unwritten; a re-cleaned proposal is a new gate and the old one is inert", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("failure");
  const capture = saveCapture("Fiction", "the tide reads the almanac backwards", captures);
  const idea = worldIdea(home, storiesRoot("series-a"), capture.text, capture.id);
  projectFictionCapture(capture, idea, queue);
  const opened = openCanonGate(capture.id, idea, queue);
  assert.equal(opened.status, 200);
  if (opened.status !== 200) return;
  const before = JSON.stringify(readQueueItem(capture.id, queue));
  assert.throws(() => confirmCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, () => { throw new Error("switch to main"); }, queue), /switch to main/);
  assert.equal(JSON.stringify(readQueueItem(capture.id, queue)), before, "nothing was written");
  assert.equal(readQueueItem(capture.id, queue)?.state, "awaiting-answer");
  // The proposal is redone: the old gate's digest no longer matches, so sync stops holding the row
  // at awaiting-answer, and asking again opens a fresh gate over the new text.
  const redone = createCleanupProposal({ ...idea, proposal: null }, `${capture.text} (cleaned again)`);
  const current = readIdea("series-a", idea.id, home)!;
  assert.notEqual(canonGateDigest(redone), opened.gate.digest);
  const sync = syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.equal(sync.items[0]!.state, "pending");
  const fresh = openCanonGate(capture.id, current, queue);
  assert.equal(fresh.status, 200);
  if (fresh.status === 200) { assert.notEqual(fresh.gate.gateId, opened.gate.gateId); assert.equal(fresh.gate.state, "open"); }
  const stale = confirmCanonGate({ captureId: capture.id, gateId: opened.gate.gateId }, () => current, queue);
  assert.equal(stale.status, 409, "the superseded gate id cannot confirm the new proposal");
}));

test("the gate refuses what is not a canon write: chapter ideas, unclassified ideas, an unlinked capture", () => withIsolatedHome((home) => {
  const { captures, queue } = stores("refuse");
  const capture = saveCapture("Fiction", "a chapter beat, not canon", captures);
  const chapter = createIdea("series-a", capture.text, { storageRoot: home, classification: "chapter", captureId: capture.id });
  createCleanupProposal(chapter, chapter.rawText);
  projectFictionCapture(capture, readIdea("series-a", chapter.id, home)!, queue);
  const refused = openCanonGate(capture.id, readIdea("series-a", chapter.id, home)!, queue);
  assert.equal(refused.status, 400);
  if (refused.status === 400) assert.match(refused.error, /draft queue, not canon/);
  const other = saveCapture("Fiction", "no idea yet", captures);
  assert.equal(openCanonGate(other.id, chapter, queue).status, 404, "a capture never projected is not in the queue");
  const bare = createIdea("series-a", "unclassified", { storageRoot: home });
  const bareCapture = saveCapture("Fiction", bare.rawText, captures);
  projectFictionCapture(bareCapture, bare, queue);
  const noProposal = openCanonGate(bareCapture.id, bare, queue);
  assert.equal(noProposal.status, 400);
  if (noProposal.status === 400) assert.match(noProposal.error, /no reviewable cleanup proposal/);
  assert.equal(fictionQueueState(bare, { state: "confirmed" }), "awaiting-answer", "a resolved gate does not change the idea's own mirror");
}));

test("approveIdea appends the cleaned text once, and a retry after a crash between the canon append and the status persist appends nothing more", () => withIsolatedHome((home) => {
  const stories = storiesRoot("series-a");
  const idea = worldIdea(home, stories, "the moon keeps the harbor's second ledger");
  const proposal = idea.proposal!;
  const bible = join(stories, "series-a", "bible.md");
  const countOf = (): number => readFileSync(bible, "utf8").split(proposal.cleanedText).length - 1;
  assert.equal(countOf(), 0);
  const first = approveIdea(proposal, { canonicalWriteAuthorized: true });
  assert.equal(first.status, "approved");
  assert.equal(countOf(), 1, "a normal first approval appends the text once");
  // The crash: canon.md's sibling doc already holds the text, but the idea store never learned
  // the idea was approved. Rewind only the store, exactly as a failed status persist would leave it.
  const ideasPath = join(home, "series-a", "ideas.json");
  const records = JSON.parse(readFileSync(ideasPath, "utf8")) as Array<Record<string, unknown>>;
  const record = records.find((row) => row.id === idea.id)!;
  record.status = "needs-review";
  (record.proposal as Record<string, unknown>).status = "needs-review";
  writeFileSync(ideasPath, JSON.stringify(records, null, 2) + "\n");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "needs-review");
  const retried = approveIdea(proposal, { canonicalWriteAuthorized: true });
  assert.equal(retried.status, "approved", "the retry persists the status the crash lost");
  assert.equal(countOf(), 1, "the retry never appends the same text a second time");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "approved");
}));

test("the idempotency guard is anchored to a line boundary: a doc whose last line merely ends in the new text still gets the append", () => withIsolatedHome((home) => {
  const stories = storiesRoot("series-a");
  const bible = join(stories, "series-a", "bible.md");
  writeFileSync(bible, "# A Test Series, Story Bible\n\nThe mission was to reach the target.\n");
  const idea = createIdea("series-a", "a target, on its own", { storageRoot: home, storiesRoot: stories, classification: "world" });
  createCleanupProposal(idea, "target.");
  const proposal = readIdea("series-a", idea.id, home)!.proposal!;
  const approved = approveIdea(proposal, { canonicalWriteAuthorized: true });
  assert.equal(approved.status, "approved");
  const after = readFileSync(bible, "utf8");
  assert.equal(after, "# A Test Series, Story Bible\n\nThe mission was to reach the target.\n\ntarget.\n", "the mid-line suffix did not suppress a real append");
  assert.equal(after.split("target.").length - 1, 2, "the words appear mid-sentence AND as their own trailing block");
}));

// ---------------------------------------------------------------------------
// The routes, through handleFictionRoute so the branch check is injectable. The capture and queue
// stores land in the node:test throwaway data root; the idea store in the isolated home.

type RouteBody = Record<string, unknown>;
async function call(pathname: string, body: RouteBody, currentBranch: () => Promise<string>): Promise<{ code: number; body: RouteBody }> {
  let out: { code: number; body: RouteBody } = { code: 0, body: {} };
  const handled = await handleFictionRoute({
    req: { method: "POST" } as never, res: {} as never, url: new URL(`http://localhost${pathname}`),
    readBody: async () => body, json: (_res, code, payload) => { out = { code, body: payload as RouteBody }; }, requestEngine: () => "claude", currentBranch,
  });
  assert.equal(handled, true, `${pathname} is a Fiction route`);
  return out;
}

test("gate routes: open asks durably, confirm off main refuses and keeps the gate open, confirm on main appends to the bible exactly once", () => withIsolatedHome(async (home) => {
  const stories = storiesRoot("series-a");
  const capture = saveCapture("Fiction", `A cartographer who maps forgetting. ${Date.now()}`);
  const idea = worldIdea(home, stories, capture.text, capture.id);
  projectFictionCapture(capture, idea);
  const onBranch = async () => "story/series-a/chapter-01";
  const onMain = async () => "main";

  const opened = await call("/api/fiction/gate/open", { captureId: capture.id }, onBranch);
  assert.equal(opened.code, 200, String(opened.body.error ?? ""));
  const gate = opened.body.gate as { gateId: string; state: string };
  assert.equal(gate.state, "open");
  assert.deepEqual((opened.body.resume as { gate: { gateId: string } }).gate.gateId, gate.gateId);

  const refused = await call("/api/fiction/gate/confirm", { captureId: capture.id, gateId: gate.gateId }, onBranch);
  assert.equal(refused.code, 400);
  assert.match(String(refused.body.error), /switch to main/);
  assert.equal((readQueueItem(capture.id) as RoomQueueItem<FictionQueuePayload>).payload.gate?.state, "open", "a refused confirm leaves the question open");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "needs-review");

  const confirmed = await call("/api/fiction/gate/confirm", { captureId: capture.id, gateId: gate.gateId }, onMain);
  assert.equal(confirmed.code, 200, String(confirmed.body.error ?? ""));
  assert.equal((confirmed.body.gate as { state: string }).state, "confirmed");
  assert.equal((confirmed.body.item as { state: string }).state, "complete");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "approved");
  const bible = readFileSync(join(stories, "series-a", "bible.md"), "utf8");
  assert.equal(bible.split(`${capture.text} (cleaned)`).length - 1, 1, "the cleaned text landed once");

  const replay = await call("/api/fiction/gate/confirm", { captureId: capture.id, gateId: gate.gateId }, onMain);
  assert.equal(replay.code, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(readFileSync(join(stories, "series-a", "bible.md"), "utf8"), bible, "a replayed confirm appends nothing");

  const cancel = await call("/api/fiction/gate/cancel", { captureId: capture.id, gateId: gate.gateId }, onMain);
  assert.equal(cancel.code, 409);
  const unknown = await call("/api/fiction/gate/open", { captureId: "capture-nope" }, onMain);
  assert.equal(unknown.code, 400);
  assert.match(String(unknown.body.error), /no such capture/);
}));

// Slice 2a: the desk's Cancel button and its stale-gate path, through the same routes the client
// calls. open -> cancel must leave the bible byte-identical and the idea still needs-review; a
// confirm carrying a gate id that is not the open one is a 409 that writes nothing.
test("gate routes: open then cancel writes no canon and keeps the idea reviewable; a foreign gate id cannot confirm", () => withIsolatedHome(async (home) => {
  const stories = storiesRoot("series-a");
  const capture = saveCapture("Fiction", `A harbor that keeps no ledger. ${Date.now()}`);
  const idea = worldIdea(home, stories, capture.text, capture.id);
  projectFictionCapture(capture, idea);
  const onMain = async () => "main";
  const bible = join(stories, "series-a", "bible.md");
  const before = readFileSync(bible, "utf8");

  const opened = await call("/api/fiction/gate/open", { captureId: capture.id }, onMain);
  assert.equal(opened.code, 200, String(opened.body.error ?? ""));
  const gate = opened.body.gate as { gateId: string; target: string };
  assert.equal(gate.target, "bible.md", "the card shows the doc the confirm would write");

  const foreign = await call("/api/fiction/gate/confirm", { captureId: capture.id, gateId: "gate-not-this-one" }, onMain);
  assert.equal(foreign.code, 409);
  assert.equal(readFileSync(bible, "utf8"), before, "a foreign gate id appends nothing");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "needs-review");

  const cancelled = await call("/api/fiction/gate/cancel", { captureId: capture.id, gateId: gate.gateId }, onMain);
  assert.equal(cancelled.code, 200, String(cancelled.body.error ?? ""));
  assert.equal((cancelled.body.gate as { state: string }).state, "cancelled");
  assert.equal((cancelled.body.item as { state: string }).state, "pending", "the card goes back to Approve, not to done");
  assert.equal(readFileSync(bible, "utf8"), before, "cancel writes no canon");
  assert.equal(readIdea("series-a", idea.id, home)?.status, "needs-review", "the proposal is still Muxin's to approve");

  const stale = await call("/api/fiction/gate/confirm", { captureId: capture.id, gateId: gate.gateId }, onMain);
  assert.equal(stale.code, 409, "confirming the cancelled gate is refused, not silently promoted");
  assert.equal(readFileSync(bible, "utf8"), before);
}));
