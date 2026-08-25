export function fmtDays(n: number): string { return `${n} day${n === 1 ? "" : "s"}`; }

export function renderInsightsMeta(r: { freshness?: { date: string; ageDays: number } | null; brief?: { path: string; date: string | null; ageDays: number | null } | null; untagged?: number; }): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const parts: string[] = [];
  if (r.freshness) parts.push(`Data current as of <b>${esc(r.freshness.date)}</b> (${fmtDays(r.freshness.ageDays)} ago)`);
  if (r.brief) {
    const label = esc(r.brief.date || r.brief.path) + (r.brief.ageDays != null ? ` (${fmtDays(r.brief.ageDays)} old)` : "");
    parts.push(`Brief: <a href="#stratBriefPanel">${label}</a>`);
  }
  if (r.untagged && r.untagged > 0) parts.push(`<span class="warn">⚠ ${r.untagged} untagged post${r.untagged === 1 ? "" : "s"}</span>`);
  return parts.length ? `<div class="insights-meta">${parts.join(" · ")}</div>` : "";
}

export function notesPickRequest(indices: number[], engine = "claude"): { indices: number[]; engine: string } {
  return { indices, engine: engine || "claude" };
}

export type MetricReadView = { state: "measured"; value: number; records_measured: number; records_unmeasured: number } | { state: "not_measured"; reason: string };
export type ReadTone = "ink" | "grey" | "green" | "amber";
export function groupDigits(n: number): string {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return String(n);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? "-" + digits : digits;
}
export function metricLine(m: MetricReadView): { value: string; note: string; tone: ReadTone } {
  if (m.state === "not_measured") return { value: "not measured", note: m.reason, tone: "grey" };
  if (m.records_measured === 0) return { value: "0", note: "no record carried this number, so this is a sum over nothing rather than a measured zero", tone: "grey" };
  const on = m.records_measured === 1 ? "1 record" : m.records_measured + " records";
  const missing = m.records_unmeasured ? ", " + m.records_unmeasured + (m.records_unmeasured === 1 ? " record carried no number" : " records carried no number") : "";
  return { value: groupDigits(m.value), note: "measured on " + on + missing, tone: "ink" };
}

export interface PlatformConfidenceView { platform: string; posts: number; weeks: number; status: string; sufficient: boolean; }
export interface SampleRuleView { kind: string; threshold_weeks: number; source: string; }
export function sampleNote(confidence: PlatformConfidenceView[], rule: SampleRuleView): string {
  const bar = rule.threshold_weeks + (rule.threshold_weeks === 1 ? " week" : " weeks");
  if (!confidence.length) return "No posts on record in this database, so nothing below has been measured yet.";
  const ok = confidence.filter((c) => c.sufficient).length;
  const total = confidence.length;
  const platforms = total === 1 ? "platform" : "platforms";
  if (ok === 0) return "None of the " + total + " " + platforms + " on record clears " + bar + " of data. Everything below is directional only.";
  if (ok === total) return "All " + total + " " + platforms + " on record clear " + bar + " of data.";
  return ok + " of " + total + " " + platforms + " on record clear " + bar + " of data. The rest are directional only.";
}
export type OutcomeFamilyName = "attention" | "conversation" | "audience" | "business";
export function familyGate(family: OutcomeFamilyName): { text: string; tone: ReadTone } {
  return family === "attention" || family === "conversation" ? { text: "MAY INFORM A ROUTING OR SUPPRESSION CALL", tone: "green" } : { text: "NEVER USED TO SUPPRESS A PILLAR OR PLATFORM", tone: "amber" };
}

export type FitBasisView = "measured" | "insufficient-data" | "editorial-rule" | "format-asset" | "unknown";
export interface ChannelTreatmentView {
  channel: string;
  decision: "include" | "skip" | null;
  recordedDecision: "include" | "skip" | null;
  score: number | null;
  fitLabel: string | null;
  fitBasis: FitBasisView;
  belowFloor: boolean;
  reuse: { key: string; allowed: boolean; everPlaced: boolean; lastPlacedAt: string | null; daysSince: number | null; minDays: number; reason: string | null } | null;
  reuseNote: string | null;
  slot: { time: string; label: string };
}
export function fitLine(ch: ChannelTreatmentView, floor: number): { label: string; basis: string; tone: ReadTone } {
  const score = ch.score == null ? "" : String(Math.round(ch.score * 100) / 100);
  if (ch.fitBasis === "measured") {
    const tone: ReadTone = ch.fitLabel === "STRONG FIT" ? "green" : ch.fitLabel === "POOR FIT" ? "amber" : "ink";
    return { label: ch.fitLabel ?? "NO FIT CALL", basis: "measured, scoring " + score + " where this platform's own norm is 1.0 and the floor is " + floor, tone };
  }
  if (ch.fitBasis === "insufficient-data") return { label: ch.fitLabel ?? "COLD START", basis: "not enough posts or weeks on this channel to score it, so there is no verdict here yet", tone: "grey" };
  if (ch.fitBasis === "editorial-rule") return { label: "EDITORIAL RULE", basis: "your own rule in config/routing.yaml put it here, the data never spoke", tone: "grey" };
  if (ch.fitBasis === "format-asset") return { label: "ALWAYS GENERATED", basis: "a format asset, so it was never fit scored", tone: "grey" };
  return { label: "NOT SCORED", basis: "nothing on disk says what this piece is about, so fit was never computed", tone: "grey" };
}
export function floorNote(ch: ChannelTreatmentView, floor: number): string {
  if (!ch.belowFloor) return "";
  return "Scores under the floor of " + floor + " and stays on. A score never skips a channel here, config/routing.yaml's defaults list decides that on its own.";
}
export function reuseLine(ch: ChannelTreatmentView): { text: string; tone: ReadTone } {
  if (!ch.reuse) return { text: ch.reuseNote ?? "no reuse check runs for this channel", tone: "grey" };
  const window = "this channel's own window of " + fmtDays(ch.reuse.minDays);
  if (!ch.reuse.everPlaced) return { text: "Never placed here, so " + window + " is holding nothing.", tone: "ink" };
  const ago = ch.reuse.daysSince == null ? "at an unrecorded time" : fmtDays(ch.reuse.daysSince) + " ago";
  if (ch.reuse.allowed) return { text: "Last placed " + ago + ", which is past " + window + ".", tone: "ink" };
  return { text: "Held: placed " + ago + ", inside " + window + ".", tone: "amber" };
}
export interface TreatmentView { slug: string; pillars: string[]; pillarSource: "routing.md" | "none"; floor: number; channels: ChannelTreatmentView[]; scoredBelowFloorButEnabled: string[]; }
export function readsFromCells(t: TreatmentView, cuts: { lens: string; sourceLines?: (number | string)[] }[]): { k: string; v: string; tone: ReadTone }[] {
  const held = t.channels.filter((c) => c.reuse && c.reuse.everPlaced && !c.reuse.allowed);
  const pillar = t.pillarSource === "routing.md" ? { k: "PILLAR", v: t.pillars.join(" + ") + ", read from this piece's routing.md. It is what drove every fit call below.", tone: "ink" as ReadTone } : { k: "PILLAR", v: "None. This piece has no routing.md, so nothing below was fit scored and every call is yours.", tone: "grey" as ReadTone };
  const reuse = held.length ? { k: "REUSE WINDOWS", v: held.map((c) => c.channel + " carried this " + fmtDays(c.reuse!.daysSince ?? 0) + " ago, against its own window of " + fmtDays(c.reuse!.minDays)).join(". ") + ". Every channel carries its own window, so there is no single number here.", tone: "amber" as ReadTone } : { k: "REUSE WINDOWS", v: "Nothing is holding this piece. Each channel was checked against its own window, not one shared number.", tone: "ink" as ReadTone };
  const below = t.scoredBelowFloorButEnabled;
  const skipped = below.length ? { k: "NOTHING SKIPPED", v: below.join(", ") + (below.length === 1 ? " scores under the floor of " : " score under the floor of ") + t.floor + (below.length === 1 ? " and stays on. " : " and stay on. ") + "A score never skips a channel here, config/routing.yaml's defaults list decides that on its own.", tone: "ink" as ReadTone } : { k: "NOTHING SKIPPED", v: t.pillarSource === "routing.md" ? "No channel scored under the floor of " + t.floor + ". A score could not have skipped one anyway, the defaults list decides that." : "No score to skip anything on, so every channel below is on and the call is yours.", tone: "ink" as ReadTone };
  const traced = cuts.filter((c) => c.sourceLines && c.sourceLines.length);
  const words = traced.length ? { k: "YOUR WORDS", v: (traced.length === 1 ? "The cut below carries the source lines it was built from" : "All " + traced.length + " cuts below carry the source lines they were built from") + ", so every draft is your text, trimmed. Nothing composed.", tone: "ink" as ReadTone } : { k: "YOUR WORDS", v: "No cut here records the lines it came from, so this screen makes no claim about how the drafts were built.", tone: "grey" as ReadTone };
  return [pillar, reuse, skipped, words];
}
