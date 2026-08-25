export function ventureDotColor(tone: string): string {
  if (tone === "green") return "#2f7d46";
  if (tone === "amber") return "#9a6b12";
  if (tone === "red") return "#9a2f2f";
  if (tone === "blue") return "#2f5d9a";
  return "#b0a488";
}

export function ventureDayLine(elapsedDays: number | null | undefined): string {
  if (elapsedDays === null || elapsedDays === undefined) return "";
  return elapsedDays === 0 ? "started today" : "day " + (elapsedDays + 1) + " since kickoff";
}

export interface VentureHistoryCardView {
  artifactId: string;
  title: string;
  state: string;
}

export interface VentureHistoryGroupView {
  phase: number;
  artifacts: VentureHistoryCardView[];
}

export function ventureHistoryHtml(history: VentureHistoryGroupView[]): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const groups = history.filter((group) => group.artifacts.length > 0);
  if (!groups.length) return "";
  const count = groups.reduce((total, group) => total + group.artifacts.length, 0);
  return '<details class="v-history"><summary>EARLIER PHASES · ' + count + ' ARTIFACTS</summary>' +
    groups.map((group) => '<div class="v-history-group"><div class="vmono">PHASE ' + group.phase + '</div>' +
      group.artifacts.map((artifact) => '<div class="v-history-card"><div class="vtitle">' + esc(artifact.title || artifact.artifactId) + '</div>' +
        '<div class="vnote">' + esc(artifact.state) + '</div><div class="from">' + esc(artifact.artifactId) + '</div></div>').join("") +
      '</div>').join("") +
    '</details>';
}

export function ventureMultiPickIds(requiredCount: number, selectedIds: string[], candidateId: string): string[] {
  const current = [...new Set(selectedIds)];
  if (current.includes(candidateId)) return current.filter((id) => id !== candidateId);
  return current.length >= requiredCount ? current : [...current, candidateId];
}

export function intakeProgressLine(step: number, total: number): string {
  if (step >= 1 && step <= total) return "Question " + step + " of " + total;
  if (step === total + 1) return "Voice evidence";
  if (step === total + 2) return "Day 14 scorecard";
  return "";
}

export function intakeUnanswered(drafts: { n: number; text: string }[], total: number): number[] {
  const filled = new Set<number>();
  for (const d of drafts) if (d.text && d.text.trim()) filled.add(d.n);
  const out: number[] = [];
  for (let n = 1; n <= total; n++) if (!filled.has(n)) out.push(n);
  return out;
}

export function intakeSaveLine(s: { state: string; savedAt?: string; error?: string }): string {
  if (s.state === "saving") return "saving…";
  if (s.state === "failed") return "NOT SAVED — " + (s.error || "the server did not answer");
  if (s.state === "saved") {
    const d = s.savedAt ? new Date(s.savedAt) : null;
    if (!d || isNaN(d.getTime())) return "saved";
    return "saved " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  return "";
}

export function intakeSlugError(slug: string): string | null {
  if (typeof slug !== "string" || !/^[a-z0-9][\w-]*$/.test(slug)) return "bad venture name";
  return null;
}
