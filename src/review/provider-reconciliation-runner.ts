import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { tryAcquireFileLease } from "../runtime/file-lock.js";
import { reconcileConfiguredProviderStatuses, type DefaultStatusReaderDeps } from "./provider-status-reconciliation.js";

export const PROVIDER_RECONCILIATION_HEALTH_PATH = migrateLegacyDataFile(["provider-reconciliation-health.json"]);
export interface ProviderReconciliationHealth {
  state: "idle" | "running" | "ok" | "failed";
  lastStartedAt?: string;
  lastCompletedAt?: string;
  observations?: number;
  error?: string;
  limitations?: string[];
}

const LIMITATIONS = ["Substack has no authoritative post-status API in this adapter; its events remain explicitly uncertain until human confirmation"];
let health: ProviderReconciliationHealth = { state: "idle", limitations: LIMITATIONS };
let active: Promise<ProviderReconciliationHealth> | null = null;
export function providerReconciliationHealth(): ProviderReconciliationHealth { return { ...health }; }

function persistHealth(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(health, null, 2) + "\n", { mode: 0o600 });
}

/** One bounded pass. Concurrent ticks share the same promise and never duplicate provider reads. */
export function runProviderReconciliationOnce(opts: {
  ledgerPath?: string;
  healthPath?: string;
  deps?: DefaultStatusReaderDeps;
  now?: () => Date;
} = {}): Promise<ProviderReconciliationHealth> {
  if (active) return active;
  const now = opts.now ?? (() => new Date());
  const healthPath = opts.healthPath ?? PROVIDER_RECONCILIATION_HEALTH_PATH;
  const lease = tryAcquireFileLease(`${healthPath}.provider-poll.lock`, { staleMs: 30 * 60_000 });
  if (!lease) {
    if (existsSync(healthPath)) {
      try { return Promise.resolve(JSON.parse(readFileSync(healthPath, "utf8")) as ProviderReconciliationHealth); }
      catch { /* the owner may be replacing health; report a truthful running state */ }
    }
    return Promise.resolve({ state: "running", limitations: LIMITATIONS });
  }
  health = { state: "running", lastStartedAt: now().toISOString(), limitations: LIMITATIONS };
  persistHealth(healthPath);
  active = reconcileConfiguredProviderStatuses(opts.ledgerPath, opts.deps)
    .then((events) => {
      health = { ...health, state: "ok", lastCompletedAt: now().toISOString(), observations: events.length };
      persistHealth(healthPath);
      return providerReconciliationHealth();
    })
    .catch((error) => {
      health = { ...health, state: "failed", lastCompletedAt: now().toISOString(), error: error instanceof Error ? error.message : String(error) };
      persistHealth(healthPath);
      return providerReconciliationHealth();
    })
    .finally(() => { active = null; lease.release(); });
  return active;
}

/** Immediate startup pass plus an unref'd bounded interval for the long-lived review server. */
export function startProviderReconciliationLoop(intervalMs = 15 * 60_000): { stop(): void } {
  void runProviderReconciliationOnce();
  const timer = setInterval(() => { void runProviderReconciliationOnce(); }, Math.max(60_000, intervalMs));
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

async function main(): Promise<void> {
  const result = await runProviderReconciliationOnce();
  console.log(JSON.stringify(result));
  if (result.state === "failed") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
