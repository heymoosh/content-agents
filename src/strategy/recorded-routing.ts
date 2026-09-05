import type { Confidence, Decision } from "./route.js";

export interface RecordedRoutingDecision {
  decision: Decision["decision"];
  confidence?: Confidence;
}

/** Read the router's persisted gate, including its one-off exploration decision. Never
 * recompute a subset of the routing policy: source triage and origin vetoes live here too.
 * Absent platform rows keep the legacy gate's permissive behavior; malformed present rows
 * must not turn an intended skip into permission. Older two-column tables remain readable. */
export function parseRecordedRouting(md: string): Map<string, RecordedRoutingDecision> {
  const decisions = new Map<string, RecordedRoutingDecision>();
  const confidences: readonly string[] = ["data", "cold-start", "rule", "always", "exploration"];
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const platform = cells[1];
    if (platform === "platform" || /^:?-+:?$/.test(platform ?? "")) continue;
    const decision = cells[2];
    if (!platform || (decision !== "include" && decision !== "skip")) {
      throw new Error("invalid routing decision row in routing.md; rerun routing before generation");
    }
    if (decisions.has(platform)) throw new Error(`duplicate routing decision for ${platform} in routing.md`);
    const confidence = cells[4];
    if (confidence && !confidences.includes(confidence)) {
      throw new Error(`invalid routing confidence for ${platform} in routing.md`);
    }
    decisions.set(platform, { decision, ...(confidence ? { confidence: confidence as Confidence } : {}) });
  }
  if (!decisions.size) throw new Error("routing.md has no routing decisions; rerun routing before generation");
  return decisions;
}
