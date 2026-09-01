import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleCharlesRoute } from "./serve-charles.js";

const productionPersona = readFileSync(new URL("../../charles/config/persona.yaml", import.meta.url), "utf8");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "serve-charles-persona-"));
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "posts", "one-liners"), { recursive: true });
  writeFileSync(join(root, "config", "persona.yaml"), productionPersona);
  writeFileSync(join(root, "config", "persona-brief.md"), "brief bytes\n");
  writeFileSync(join(root, "posts", "one-liners", "dapper.md"), "---\ntype: one-liner\n---\n\nDapper.\n");
  writeFileSync(join(root, "review-queue.md"), "| id | type | file | status | notes |\n|----|------|------|--------|-------|\n| dapper | one-liner | posts/one-liners/dapper.md | pending | |\n");
  return { root, proposalsPath: join(root, "state", "proposals.jsonl") };
}

function harness(method: string, pathname: string, body: Record<string, unknown> = {}) {
  let response: { code: number; value: any } | undefined;
  return {
    req: { method } as any, res: {} as any, url: new URL(`http://localhost${pathname}`),
    readBody: async () => body,
    json: (_res: unknown, code: number, value: unknown) => { response = { code, value }; },
    requestEngine: (() => "codex") as any,
    response: () => response,
  };
}

test("persona routes propose without mutation, then approve the same reviewed bytes", async () => {
  const f = fixture();
  try {
    const after = productionPersona.replace('short_name: "Charles"', 'short_name: "Charles Route Reviewed"');
    const propose = harness("POST", "/api/charles/persona/proposals", { yaml: after });
    assert.equal(await handleCharlesRoute({ ...propose, charlesRoot: f.root, personaProposalsPath: f.proposalsPath }), true);
    assert.equal(propose.response()?.code, 200);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
    const proposal = propose.response()?.value.proposal;
    assert.equal(proposal.status, "pending");

    const approve = harness("POST", `/api/charles/persona/proposals/${proposal.id}/approve`, { evidence: "Exact old/new YAML reviewed" });
    assert.equal(await handleCharlesRoute({ ...approve, charlesRoot: f.root, personaProposalsPath: f.proposalsPath }), true);
    assert.equal(approve.response()?.code, 200);
    assert.equal(approve.response()?.value.proposal.status, "applied");
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), after);
    assert.equal(readFileSync(join(f.root, "config", "persona-brief.md"), "utf8"), "brief bytes\n");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("persona routes reject client path injection and a rejected proposal leaves production unchanged", async () => {
  const f = fixture();
  try {
    const after = productionPersona.replace('short_name: "Charles"', 'short_name: "Charles Rejected"');
    const injected = harness("POST", "/api/charles/persona/proposals", { yaml: after, root: "/tmp/other" });
    await handleCharlesRoute({ ...injected, charlesRoot: f.root, personaProposalsPath: f.proposalsPath });
    assert.equal(injected.response()?.code, 400);
    assert.match(injected.response()?.value.error, /unsupported persona request field/);
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);

    const propose = harness("POST", "/api/charles/persona/proposals", { yaml: after });
    await handleCharlesRoute({ ...propose, charlesRoot: f.root, personaProposalsPath: f.proposalsPath });
    const id = propose.response()?.value.proposal.id;
    const reject = harness("POST", `/api/charles/persona/proposals/${id}/reject`, { evidence: "Not the right voice" });
    await handleCharlesRoute({ ...reject, charlesRoot: f.root, personaProposalsPath: f.proposalsPath });
    assert.equal(reject.response()?.value.proposal.status, "rejected");
    assert.equal(readFileSync(join(f.root, "config", "persona.yaml"), "utf8"), productionPersona);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("production persona and verbatim brief have separate read endpoints", async () => {
  const f = fixture();
  try {
    const persona = harness("GET", "/api/charles/persona");
    await handleCharlesRoute({ ...persona, charlesRoot: f.root, personaProposalsPath: f.proposalsPath });
    assert.equal(persona.response()?.value.persona.yaml, productionPersona);
    const brief = harness("GET", "/api/charles/persona-brief");
    await handleCharlesRoute({ ...brief, charlesRoot: f.root, personaProposalsPath: f.proposalsPath });
    assert.equal(brief.response()?.value.text, "brief bytes\n");
    assert.equal(readFileSync(join(f.root, "config", "persona-brief.md"), "utf8"), "brief bytes\n");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("Charles read route exposes review-history failure without hiding the draft", async () => {
  const f = fixture();
  try {
    const request = harness("GET", "/api/charles");
    await handleCharlesRoute({ ...request, charlesRoot: f.root, reviewCommentsPath: f.root });
    assert.equal(request.response()?.code, 200);
    assert.equal(request.response()?.value.posts[0].id, "dapper");
    assert.deepEqual(request.response()?.value.posts[0].comments, []);
    assert.match(request.response()?.value.posts[0].historyWarning, /Review history is unavailable/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
