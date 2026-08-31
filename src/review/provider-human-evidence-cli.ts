import { recordHumanDeliveryEvidence } from "./publishing-status.js";
import type { DeliveryState } from "./delivery-event.js";

const terminal = new Set<DeliveryState>(["delivered", "live", "canceled", "deleted", "failed", "private"]);
function value(flag: string): string | undefined { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; }

function main(): void {
  const slug = value("--slug"); const rowId = value("--row"); const state = value("--state") as DeliveryState | undefined; const evidence = value("--evidence");
  if (!slug || !rowId || !state || !terminal.has(state) || !evidence) {
    throw new Error("usage: npm run publish:record-evidence -- --slug <slug> --row <id> --state <terminal-state> --evidence <what-you-checked> [--url <canonical-url>]");
  }
  const event = recordHumanDeliveryEvidence(slug, rowId, state as "delivered" | "live" | "canceled" | "deleted" | "failed" | "private", { evidence, canonicalUrl: value("--url") });
  console.log(JSON.stringify(event));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
