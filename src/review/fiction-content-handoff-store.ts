import { readFictionChapter, listFictionSeries } from "./fiction.js";
import { createFictionContentHandoff, type FictionContentHandoff } from "./fiction-content-handoff.js";

export interface LockedChapterHandoffOptions {
  readonly root: string;
  readonly series: string;
  readonly chapter: number;
  readonly id: string;
  readonly descriptor: string;
  readonly suggestedPromotionalObjective: string;
  readonly originalInput: string;
}

/** Reads only an approved chapter and turns its nonempty source lines into quoteable passages. */
export function createLockedChapterHandoff(options: LockedChapterHandoffOptions): FictionContentHandoff {
  const series = listFictionSeries(options.root).filter((item) => item.slug === options.series);
  if (series.length !== 1) throw new Error("fiction series is missing or ambiguous");
  const chapter = readFictionChapter(options.series, options.chapter, options.root);
  if (chapter.status.toLowerCase() !== "approved") throw new Error("chapter is not locked/approved");
  const lines = chapter.body.split(/\r?\n/).map((text, index) => ({ text: text.trim(), line: index + 1 })).filter((item) => item.text);
  if (lines.length === 0) throw new Error("locked chapter has no source passages");
  const file = chapter.path;
  return createFictionContentHandoff({
    id: options.id,
    series: { id: series[0].slug, title: series[0].title },
    chapter: { number: chapter.number, title: chapter.title },
    sourcePassages: lines.map(({ text, line }) => ({ ref: `${series[0].slug}/${file}:line-${line}`, text, locked: true })),
    restrictions: {
      canon: ["Do not contradict the established canon for this series or chapter."],
      provenance: ["Quote only the locked source passages and preserve each passage reference."],
    },
    suggestedPromotionalObjective: options.suggestedPromotionalObjective,
    descriptor: options.descriptor,
    originalInput: options.originalInput,
  });
}
