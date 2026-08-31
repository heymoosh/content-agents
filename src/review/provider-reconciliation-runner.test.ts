import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { runProviderReconciliationOnce } from "./provider-reconciliation-runner.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("production runner performs one bounded pass and exposes persisted last-run health", async () => {
  const root = mkdtempSync(join(tmpdir(), "reconcile-runner-")); roots.push(root);
  const ledgerPath = join(root, "events.jsonl"); const healthPath = join(root, "health.json");
  writeFileSync(ledgerPath, JSON.stringify({ slug: "p", rowId: "r", provider: "typefully", state: "planned", at: "2026-01-01T00:00:00Z", providerObjectId: "tf-1" }) + "\n");
  let calls = 0;
  const health = await runProviderReconciliationOnce({
    ledgerPath, healthPath, now: () => new Date("2026-01-02T00:00:00Z"),
    deps: { fetchTypefully: async () => { calls++; return [{ id: "tf-1", whenIso: "2026-01-03T00:00:00Z", platforms: ["x"], title: "r" }]; } },
  });
  assert.equal(calls, 1);
  assert.equal(health.state, "ok");
  assert.equal(health.observations, 1);
  assert.equal(JSON.parse(readFileSync(healthPath, "utf8")).lastCompletedAt, "2026-01-02T00:00:00.000Z");
});

test("two Studio processes share one provider reconciliation lease", async () => {
  const root = mkdtempSync(join(tmpdir(), "reconcile-processes-")); roots.push(root);
  const ledgerPath = join(root, "events.jsonl"), healthPath = join(root, "health.json"), callsPath = join(root, "calls"), readyPath = join(root, "ready");
  writeFileSync(ledgerPath, JSON.stringify({ slug: "p", rowId: "r", provider: "typefully", state: "planned", at: "2026-01-01T00:00:00Z", providerObjectId: "tf-1" }) + "\n");
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/provider-reconciliation-runner.ts")).href;
  const script = `import { appendFileSync, readFileSync } from "node:fs"; import { runProviderReconciliationOnce } from ${JSON.stringify(moduleUrl)}; appendFileSync(process.argv[4], "ready\\n"); const deadline=Date.now()+10000; while(readFileSync(process.argv[4], "utf8").trim().split("\\n").length<2){ if(Date.now()>deadline) throw new Error("child readiness barrier timed out"); await new Promise(r=>setTimeout(r,10)); } await runProviderReconciliationOnce({ ledgerPath: process.argv[1], healthPath: process.argv[2], deps: { fetchTypefully: async () => { appendFileSync(process.argv[3], "call\\n"); await new Promise(r => setTimeout(r, 250)); return [{ id: "tf-1", whenIso: "2026-01-03T00:00:00Z", platforms: ["x"], title: "r" }]; } } });`;
  const run = promisify(execFile);
  await Promise.all([0, 1].map(() => run(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script, ledgerPath, healthPath, callsPath, readyPath])));
  assert.equal(readFileSync(callsPath, "utf8").trim().split("\n").length, 1);
});
