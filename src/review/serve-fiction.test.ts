import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { disposableFictionInboxAuthorized, handleFictionRoute } from "./serve-fiction.js";

test("disposable Fiction inbox authorization requires the one-run token, exact marker, and matching root", () => {
  const root = mkdtempSync(join(tmpdir(), "fiction-inbox-auth-"));
  const token = "one-run-fiction-token";
  writeFileSync(join(root, ".e2e-configured-engine-token"), token);
  assert.equal(disposableFictionInboxAuthorized({}, root), false);
  assert.equal(disposableFictionInboxAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token }, root), false);
  assert.equal(disposableFictionInboxAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token, E2E_REPO_ROOT: root }, root), true);
  assert.equal(disposableFictionInboxAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: "wrong", E2E_REPO_ROOT: root }, root), false);
  assert.equal(disposableFictionInboxAuthorized({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token, E2E_REPO_ROOT: tmpdir() }, root), false);
});

test("inbox route persists exact input and returns an injected cleanup proposal without writing canon", async () => {
  const home = mkdtempSync(join(tmpdir(), "fiction-inbox-route-"));
  const previous = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  try {
    let response: Record<string, unknown> | undefined;
    const rawText = "  Eli\tfinds the station.\n  " ;
    const handled = await handleFictionRoute({
      req: { method: "POST" } as never,
      res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox"),
      readBody: async () => ({ series: "the-least-of-us", rawText, targetPath: "outline.md", engine: "grok" }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; },
      requestEngine: (value) => value as never,
      classifyIdea: async () => "plot",
      cleanupIdea: async () => "Eli finds the station.",
    });
    assert.equal(handled, true);
    assert.equal(response?.ok, true);
    const proposal = response?.proposal as { rawText: string; cleanedText: string; provenance: { engine: string } };
    assert.equal(proposal.rawText, rawText);
    assert.equal(proposal.cleanedText, "Eli finds the station.");
    assert.equal(proposal.provenance.engine, "grok");
  } finally {
    if (previous === undefined) delete process.env.CONTENT_AGENTS_HOME;
    else process.env.CONTENT_AGENTS_HOME = previous;
  }
});

test("clarify route persists turns, reclassifies with delimited context, and is idempotent", async () => {
  const home = mkdtempSync(join(tmpdir(), "fiction-clarify-route-"));
  const previous = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  try {
    let response: Record<string, unknown> | undefined;
    let classifications = 0;
    let cleanupContext = "";
    const first = await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox"),
      readBody: async () => ({ series: "the-least-of-us", rawText: "The signal changes something.", engine: "grok" }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: (value) => value as never,
      classifyIdea: async () => "clarify", cleanupIdea: async () => "unused",
    });
    assert.equal(first, true);
    const idea = response?.idea as { id: string };
    const id = idea.id;
    const classify = async (context: string, engine: string) => { classifications++; assert.equal(engine, "grok"); assert.match(context, /ORIGINAL IDEA[\s\S]*CLARIFICATION TURNS[\s\S]*weather/); return "world" as const; };
    const clarified = await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox/clarify"),
      readBody: async () => ({ series: "the-least-of-us", id, followUp: "The signal changes the weather." }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "claude",
      classifyIdea: classify, cleanupIdea: async (context) => { cleanupContext = context; return "The signal changes the weather."; },
    });
    assert.equal(clarified, true);
    assert.equal(response?.ok, true);
    assert.ok(response?.proposal);
    assert.equal((response?.idea as { targetPath: string }).targetPath, "bible.md");
    assert.match(cleanupContext, /The signal changes the weather/);
    assert.equal(classifications, 1);
    const repeated = await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox/clarify"),
      readBody: async () => ({ series: "the-least-of-us", id, followUp: "The signal changes the weather." }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "claude",
      classifyIdea: async () => { throw new Error("duplicate must not reclassify"); }, cleanupIdea: async () => "unused",
    });
    assert.equal(repeated, true);
    assert.equal(response?.ok, true);
    assert.ok(response?.proposal);
    assert.equal(classifications, 1);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_AGENTS_HOME;
    else process.env.CONTENT_AGENTS_HOME = previous;
  }
});

test("clarify route keeps an unresolved idea clarify while retaining the new turn", async () => {
  const home = mkdtempSync(join(tmpdir(), "fiction-clarify-stays-"));
  const previous = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  try {
    let response: Record<string, unknown> | undefined;
    await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox"),
      readBody: async () => ({ series: "the-least-of-us", rawText: "A thing happens.", engine: "claude" }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: (value) => value as never,
      classifyIdea: async () => "clarify", cleanupIdea: async () => "unused",
    });
    const id = (response?.idea as { id: string }).id;
    await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox/clarify"),
      readBody: async () => ({ series: "the-least-of-us", id, followUp: "It still needs more context." }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "claude",
      classifyIdea: async (context) => { assert.match(context, /END ORIGINAL IDEA[\s\S]*END CLARIFICATION TURNS/); return "clarify"; },
    });
    assert.equal(response?.ok, true);
    assert.equal(response?.needsClarification, true);
    const turns = (response?.idea as { clarificationTurns: Array<{ text: string }> }).clarificationTurns;
    assert.deepEqual(turns.map((turn) => turn.text), ["It still needs more context."]);
    assert.equal((response?.idea as { classification: string }).classification, "clarify");
  } finally {
    if (previous === undefined) delete process.env.CONTENT_AGENTS_HOME;
    else process.env.CONTENT_AGENTS_HOME = previous;
  }
});

test("clarify route rejects an empty follow-up", async () => {
  let response: Record<string, unknown> | undefined;
  const handled = await handleFictionRoute({
    req: { method: "POST" } as never, res: {} as never,
    url: new URL("http://localhost/api/fiction/inbox/clarify"),
    readBody: async () => ({ series: "the-least-of-us", id: "missing", followUp: "  " }),
    json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "claude",
  });
  assert.equal(handled, true);
  assert.equal(response?.ok, false);
  assert.match(String(response?.error), /follow-up.*empty|required/i);
});

test("approve route refuses canonical writes when the checkout is not on main", async () => {
  const home = mkdtempSync(join(tmpdir(), "fiction-approve-branch-route-"));
  const previous = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  try {
    let response: Record<string, unknown> | undefined;
    await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox"),
      readBody: async () => ({ series: "the-least-of-us", rawText: "The rain carries voices.", engine: "grok" }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "grok",
      classifyIdea: async () => "world", cleanupIdea: async () => "The rain carries voices.",
    });
    const id = (response?.idea as { id: string }).id;
    await handleFictionRoute({
      req: { method: "POST" } as never, res: {} as never,
      url: new URL("http://localhost/api/fiction/inbox/approve"),
      readBody: async () => ({ series: "the-least-of-us", id }),
      json: (_res, _code, body) => { response = body as Record<string, unknown>; }, requestEngine: () => "grok",
      currentBranch: async () => "story/the-least-of-us/chapter-01",
    });
    assert.equal(response?.ok, false);
    assert.match(String(response?.error), /switch to main/i);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_AGENTS_HOME;
    else process.env.CONTENT_AGENTS_HOME = previous;
  }
});
