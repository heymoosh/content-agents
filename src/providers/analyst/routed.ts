import type { AnalystProvider, AnalystResult } from "../types.js";
import { provider as codex } from "./codex-cli.js";
import { provider as claude } from "./claude-cli.js";

// The default analyst route (Muxin, 2026-07-19): GPT first for analysis and interpretation
// ("it's better at telling me very clearly and cleanly what the hell is going on in the data"),
// Claude when GPT is unavailable — usage limits included, which is why the fallback reason is
// carried through to the GUI: the limit message usually says when it clears. ANY codex failure
// falls back (an unavailable analyst and a crashed one look the same from the desk); only when
// both engines fail does the caller see an error.

// Factory exported so tests can inject fake engines without spawning either CLI.
export function createRoutedAnalyst(primary: AnalystProvider, fallback: AnalystProvider): AnalystProvider {
  return {
    name: "routed",
    async analyze(req): Promise<AnalystResult> {
      let reason: string;
      try {
        return await primary.analyze(req);
      } catch (e) {
        reason = e instanceof Error ? e.message : String(e);
      }
      try {
        const result = await fallback.analyze(req);
        return { ...result, fallbackReason: reason };
      } catch (e) {
        const fb = e instanceof Error ? e.message : String(e);
        throw new Error(`both analyst engines failed — ${primary.name}: ${reason}; ${fallback.name}: ${fb}`);
      }
    },
  };
}

export const provider: AnalystProvider = createRoutedAnalyst(codex, claude);
