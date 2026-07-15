import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// PreToolUse hook for research.ts's search_budget_per_signal enforcement (card 43fa1e02, resumes
// 3c6550a6). Wired in via `claude -p --settings <json>` (research.ts's callClaudeResearch), so this
// script runs as its own real subprocess, invoked by the `claude` CLI itself before every
// WebSearch/WebFetch call during a research pass -- a genuine code-level backstop, not the model
// policing its own search count off prompt text (the prior state: budget was only ever a sentence
// in the prompt, with nothing stopping a run from ignoring it).
//
// Deliberately does NOT kill the subprocess: a hard kill mid-run would also destroy the
// PROFILE/EVIDENCE/CLASSIFICATION markers callClaudeResearch still needs to parse. Denying the
// individual tool call instead leaves the model able to finish the response normally -- its own
// prompt already tells it "if nothing turns up within budget, record no evidence found and move
// on," so a denial is exactly the signal that instruction expects to act on.
//
// The budget is enforced as one TOTAL ceiling for the whole research pass (computeSearchBudgetTotal
// below), not a true per-individual-signal cap: a single `claude -p` call gives no code-visible
// boundary between "now researching signal A" vs "now researching signal B" (there's no
// per-signal marker until the final structured response), so a call-count ceiling is the only
// enforceable boundary. Total = search_budget_per_signal * the number of closed-checklist signal
// categories that kind's rubric prompt walks (client: 3, platform: 5 -- see buildResearchPrompt /
// buildPlatformResearchPrompt's step-1 instruction).

const BUDGETED_TOOLS = new Set(["WebSearch", "WebFetch"]);

// Exported so it's unit-testable without invoking the hook via stdin/a subprocess -- mirrors the
// buildClaudeSpawnArgs pattern in src/review/jobs.ts (pure logic, thin stdin/stdout wrapper below).
// Returns true (allow) if this call is within budget, false (deny) once the ceiling is hit.
// Fail-open on a corrupt/unreadable counter file: a hook error here should never be the reason a
// legitimate research pass gets stuck denying everything.
export function checkAndConsumeSearchBudget(counterFilePath: string, totalBudget: number): boolean {
  let count = 0;
  if (existsSync(counterFilePath)) {
    const raw = readFileSync(counterFilePath, "utf8").trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) count = parsed;
  }
  if (count >= totalBudget) return false;
  writeFileSync(counterFilePath, String(count + 1));
  return true;
}

interface HookInput {
  tool_name?: string;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();
  let input: HookInput = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    // Malformed hook input -- fail open (allow), never let a parse hiccup block real research.
    process.stdout.write("{}\n");
    return;
  }

  const toolName = input.tool_name ?? "";
  if (!BUDGETED_TOOLS.has(toolName)) {
    process.stdout.write("{}\n");
    return;
  }

  const counterFile = process.env.OUTREACH_SEARCH_BUDGET_COUNTER_FILE;
  const totalBudget = Number(process.env.OUTREACH_SEARCH_BUDGET_TOTAL);
  if (!counterFile || !Number.isFinite(totalBudget)) {
    // Env not wired (e.g. hook invoked outside research.ts's own subprocess) -- fail open.
    process.stdout.write("{}\n");
    return;
  }

  const allowed = checkAndConsumeSearchBudget(counterFile, totalBudget);
  if (allowed) {
    process.stdout.write("{}\n");
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `search_budget_per_signal exhausted (${totalBudget} total ${toolName} calls used for this research pass) -- record "no evidence found" for any remaining signal and move on, per the research prompt's own instruction.`,
      },
    }) + "\n",
  );
}

// Only run as a script (invoked by the claude CLI's hook mechanism) -- importing this module for
// checkAndConsumeSearchBudget (e.g. from tests) must not also block on stdin.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
