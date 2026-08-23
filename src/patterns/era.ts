// Which delivery era a post went up in, and the honest way to compare across eras: don't.
//
// WHY THIS FILE EXISTS. A probe of 459 Pinterest pins across 31 accounts and 48 boards measured
// the same accounts posting the same kind of content in different years. ADDitude Magazine's 2017
// pins carry 15,201 and 14,710 saves. Its 2026 pins carry 1 to 3. Creative Market's 2016 pin
// carries 22,454 and its 2025 boards top out around 40. A lifestyle control group decayed about
// 20x over the same span; the informational niches decayed about 2,000x. That is not a ranking
// difference, it is two different platforms wearing the same name, and pooling them into one
// ranking produces a leaderboard of nothing but old posts with no explanation attached.
//
// So era is recorded as a field rather than left implicit in a date string, and the collect step
// checks it against `posted_at` so the two can never disagree.
//
// THE CUMULATIVE CONFOUND, and it is the reason this file refuses to compute a cross-era ratio.
// Pinterest save counts are LIFETIME running totals with no window. A 2016 pin has had ten years
// to accrue them and a 2026 pin has had weeks, so part of any old-versus-new gap is simply
// elapsed time. The gap measured above is far too large to be only that (a 2,000x spread against
// a same-format lifestyle control's 20x is a delivery collapse, not an accrual curve), but the
// confound never fully cancels. Two rules follow, and they are the whole point of this module:
//
//   1. Compare WITHIN one account, or against a same-era control from another account. Never
//      across eras in one pool.
//   2. Read an era's numbers as "what this shape earned over its whole life", never as a rate.
//
// Nothing here does I/O and nothing here judges a post. Pure functions over a date string.

import { POST_ERAS, type CorpusEntry, type PostEra } from "./types.js";

// The boundaries, and why they sit where they do.
//
// 2020 is the collapse line. Every niche the probe measured drops off a cliff on pins published
// from 2020 onward, and the same accounts' pre-2020 pins keep performing. 2023 is the second line,
// separating the transition years from the current platform: 2020-2022 pins still show occasional
// four-figure saves (a 2021 ADDitude poster carries 9,211), while 2023-plus pins in these niches
// sit at a median of 1.
//
// These are Pinterest's numbers. They are applied to every platform because a clean, stable set of
// buckets that is sometimes merely uninformative beats a per-platform set nobody can join across.
export const ERA_2020_START = "2020-01-01";
export const ERA_2023_START = "2023-01-01";

// The era a post belongs to, from its posted_at.
//
// Returns "unknown" for a null, empty, or unparseable date. That is a real answer: it means the
// platform published no usable date, and no era is inferred from anything else. A downstream step
// that needs era certainty must filter "unknown" out rather than treat it as recent.
export function eraFor(postedAt: string | null | undefined): PostEra {
  if (typeof postedAt !== "string" || postedAt.trim() === "") return "unknown";
  const date = postedAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "unknown";
  if (Number.isNaN(Date.parse(date))) return "unknown";
  if (date < ERA_2020_START) return "pre-2020";
  if (date < ERA_2023_START) return "2020-2022";
  return "2023-plus";
}

export function isPostEra(value: unknown): value is PostEra {
  return typeof value === "string" && (POST_ERAS as readonly string[]).includes(value);
}

// A date the platform published that cannot be true. One collected pin carried a datePublished of
// 2026-12-27, months ahead of the collection date. The date is kept exactly as published rather
// than corrected, because a made-up correction is worse than a flagged oddity, and the caller
// stamps a warning onto the entry so a reader sees it.
export function isImplausibleDate(postedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (typeof postedAt !== "string" || postedAt.trim() === "") return false;
  const parsed = Date.parse(postedAt.trim());
  if (Number.isNaN(parsed)) return false;
  // One day of slack, so a timezone difference on a post made today is not called impossible.
  return parsed > now.getTime() + 24 * 60 * 60 * 1000;
}

// Entries in one era. The `era` field is used when present and recomputed from posted_at when it
// is not, so a corpus written before the field existed still answers the question.
export function filterByEra(entries: CorpusEntry[], era: PostEra): CorpusEntry[] {
  return entries.filter((entry) => (entry.era ?? eraFor(entry.posted_at)) === era);
}

// How many entries sit in each era, in the fixed order eras are declared. Used by the reports, so
// nobody reads a ranking without seeing how much of the collection it left out.
export function countByEra(entries: CorpusEntry[]): Map<PostEra, number> {
  const counts = new Map<PostEra, number>(POST_ERAS.map((era) => [era, 0]));
  for (const entry of entries) {
    const era = entry.era ?? eraFor(entry.posted_at);
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  return counts;
}
