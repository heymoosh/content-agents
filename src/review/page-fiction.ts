import { JOB_COLORS, jobRoom, type JobView } from "./studio-job-ui.js";

export type FictionStatus = "unwritten" | "drafting" | "waiting on your answer" | "scene waiting on you" | "nothing written";

export function fictionStatusWord(jobs: JobView[], hasScene: boolean): FictionStatus {
  const mine = jobs.filter((j) => jobRoom(j.kind) === "Fiction");
  const newest = mine.length ? mine[mine.length - 1] : null;
  if (mine.some((j) => j.status === "blocked")) return "waiting on your answer";
  if (newest?.status === "failed" && !hasScene) return "nothing written";
  if (mine.some((j) => j.status === "queued" || j.status === "running") && !hasScene) return "drafting";
  return hasScene ? "scene waiting on you" : "unwritten";
}

export function fictionHasScene(beats: string | null | undefined, chapter: { body?: string } | null | undefined): boolean {
  return !!(String(beats ?? "").trim() && chapter && String(chapter.body ?? "").trim());
}

export function fictionStatusTone(word: FictionStatus): { fg: string; bg: string; bd: string } {
  if (word === "nothing written") return { fg: JOB_COLORS.red, bg: "#fdf1ef", bd: "#ecc9c0" };
  if (word === "drafting") return { fg: JOB_COLORS.ai, bg: "#efeafd", bd: "#ded5e9" };
  if (word === "unwritten") return { fg: "#8a7f6d", bg: "#f4efe3", bd: "#e6dcc4" };
  return { fg: JOB_COLORS.amber, bg: "#fdf8ec", bd: "#e8d5a8" };
}

export interface CanonCheckRow {
  word: string;
  color: string;
  border: string;
  rule: string;
  text: string;
  canFix: boolean;
}

export function unfixableLine(reason: string, occurrences?: number): string {
  if (reason === "span-missing") return "I cannot fix this one for you: I could not find that exact wording in the chapter, so change the line yourself.";
  if (reason === "span-repeats") {
    const n = typeof occurrences === "number" && occurrences > 1 ? `${occurrences} times` : "more than once";
    return `I cannot fix this one for you: that wording appears ${n} in the chapter, so there is no single line to change.`;
  }
  if (reason === "no-replacement") return "I cannot fix this one for you: I have nothing safe to put in its place, so write the new line yourself.";
  return "";
}

export function fictionCheckRow(
  item: { kind: string; rule: string; note: string; span: string; replacement: string; fixable?: boolean; unfixableReason?: string; occurrences?: number },
  fixed: boolean,
): CanonCheckRow {
  if (fixed) return { word: "fixed", color: JOB_COLORS.green, border: "#cbe0d1", rule: item.rule, text: `Reads "${item.replacement}" now. Changed in the draft.`, canFix: false };
  if (item.kind === "conflict") {
    const canFix = Boolean(item.fixable && item.span && item.replacement);
    const why = canFix ? "" : unfixableLine(item.unfixableReason ?? "", item.occurrences);
    return { word: "conflict", color: JOB_COLORS.amber, border: "#e8d5a8", rule: item.rule, text: why ? `${item.note} ${why}`.trim() : item.note, canFix };
  }
  return { word: "holds", color: JOB_COLORS.green, border: "#cbe0d1", rule: item.rule, text: item.note, canFix: false };
}

export function fictionCanonStamp(report: { checkedAt?: string; holds?: unknown[]; conflicts?: unknown[] } | null): string {
  if (!report) return "";
  const holds = report.holds?.length ?? 0;
  const conflicts = report.conflicts?.length ?? 0;
  const when = report.checkedAt ? report.checkedAt.slice(0, 10) : "";
  return `checked ${when} · ${holds} holding · ${conflicts} breaking`;
}

export function fictionSceneParagraphs(body: string): string[] {
  return body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" ")).filter(Boolean);
}

export function fictionEditableSpans(body: string): string[] {
  return body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).map((span) => span.trim()).filter(Boolean);
}
