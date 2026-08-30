import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export type SignalsRecommendationType = "DO MORE" | "TEST" | "DO LESS";
export type SignalsDecisionKind = "adopt" | "decline";

export interface SignalsDecision {
  type: SignalsRecommendationType;
  title: string;
  rationale: string;
  decision: SignalsDecisionKind;
  date: string;
}

export const SIGNALS_DECISIONS_PATH = migrateLegacyDataFile(["signals-decisions.jsonl"]);

/** Stable identity shared by the UI and the append-only ledger. */
export function recommendationKey(type: SignalsRecommendationType, title: string): string {
  return `${type}:${title}`;
}

export function appendSignalsDecision(decision: SignalsDecision, path: string = SIGNALS_DECISIONS_PATH): { ok: true } {
  if (!decision.title.trim()) throw new Error("a Signals decision needs a title");
  if (!decision.rationale.trim()) throw new Error("a Signals decision needs its rationale");
  withFileLock(`${path}.lock`, () => {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      const current = readFileSync(path, "utf8");
      if (current.length > 0 && !current.endsWith("\n")) appendFileSync(path, "\n", { encoding: "utf8", mode: 0o600 });
    }
    appendFileSync(path, JSON.stringify(decision) + "\n", { encoding: "utf8", mode: 0o600 });
  });
  return { ok: true };
}

/** Read the latest event for each recommendation. Invalid/truncated lines are ignored. */
export function readSignalsDecisions(path: string = SIGNALS_DECISIONS_PATH): Record<string, SignalsDecision> {
  return withFileLock(`${path}.lock`, () => readSignalsDecisionsUnlocked(path));
}
function readSignalsDecisionsUnlocked(path: string): Record<string, SignalsDecision> {
  if (!existsSync(path)) return {};
  const result: Record<string, SignalsDecision> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Partial<SignalsDecision>;
      if (!value.title || !value.type || !value.rationale || !value.decision || !value.date) continue;
      if (!["DO MORE", "TEST", "DO LESS"].includes(value.type) || !["adopt", "decline"].includes(value.decision)) continue;
      result[recommendationKey(value.type, value.title)] = value as SignalsDecision;
    } catch { /* append-only files can end mid-write; preserve earlier valid state */ }
  }
  return result;
}
