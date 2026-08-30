import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignalsRoute } from "./serve-signals.js";
import { appendSignalsDecision, readSignalsDecisions } from "./signals-decisions.js";

function harness(method: string, path: string, body: Record<string, unknown> = {}) {
  let response: { code: number; value: unknown } | undefined;
  const req = { method } as any;
  return {
    req,
    url: new URL(`http://localhost${path}`),
    readBody: async () => body,
    json: (_res: unknown, code: number, value: unknown) => { response = { code, value }; },
    response: () => response,
  };
}

test("decline is durably recorded and returned by a later Signals read", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-"));
  const ledger = join(root, "signals.jsonl");
  try {
    const h = harness("POST", "/api/signals/decision", { decision: "decline", type: "TEST", title: "Try the audit hook", rationale: "Not this cycle" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger }), true);
    assert.equal(h.response()?.code, 200);
    assert.equal(readSignalsDecisions(ledger)["TEST:Try the audit hook"].decision, "decline");
    const read = harness("GET", "/api/signals");
    assert.equal(await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: ledger }), true);
    assert.deepEqual((read.response()?.value as any).decisions["TEST:Try the audit hook"].decision, "decline");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("adopt records a decision without mutating the repository backlog", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-"));
  const ledger = join(root, "signals.jsonl");
  try {
    const h = harness("POST", "/api/signals/decision", { action: "adopt", type: "DO MORE", title: "Use notes", rationale: "They travel" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger }), true);
    assert.equal(h.response()?.code, 200);
    assert.doesNotMatch(readFileSync(new URL("./serve-signals.ts", import.meta.url), "utf8"), /appendBacklog|appendBacklogCard/);
    assert.equal(readSignalsDecisions(ledger)["DO MORE:Use notes"].decision, "adopt");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
