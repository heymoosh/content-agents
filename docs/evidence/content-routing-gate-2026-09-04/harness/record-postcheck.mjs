import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [artifacts, exitCode] = process.argv.slice(2);
if (!artifacts?.startsWith("/private/tmp/content-routing-canary-runs/")) process.exit(64);
const target = join(artifacts, "isolation-postcheck.json");
if (!existsSync(target)) {
  const logs = join(artifacts, "content-agents-data", "logs", "gui-jobs");
  const count = existsSync(logs) ? readdirSync(logs).filter((name) => name.endsWith(".log")).length : 0;
  writeFileSync(target, JSON.stringify({
    ok: false,
    retryAuthorized: false,
    checkedAt: new Date().toISOString(),
    reason: "Run ended before its normal isolation postcheck; isolation is not certified.",
    exitCode: Number(exitCode),
    expectedJobLogCount: 1,
    actualJobLogCount: count,
    historicalLogsCopied: count > 1,
  }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
}
