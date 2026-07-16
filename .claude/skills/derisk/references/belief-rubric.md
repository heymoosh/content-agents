# The derisk rubric — six dimensions, 1-5 unless noted

Score these against the *locked* belief/test/payoff before writing `source.md` (SKILL.md step 5).
`src/derisk/score.ts` is the deterministic plumbing that reads what you score here and decides
whether the anti-salty guard trips — you do the judgment, the module just enforces it.

- **load_bearing (1-5).** Does the whole strategy actually rest on this belief, or is it a side
  detail? A 5 means: if this belief is wrong, the plan visibly breaks. A 2-3 means you picked a
  belief that's true-or-false but doesn't actually matter much to the outcome — go back to the
  red-team step and pick a more load-bearing one.
- **test_cheap (1-5).** Could someone actually run this test themselves, cheaply? A 5 is a
  weekend-or-less, no-budget test a reader could try. A 2-3 is "commission a study" or "wait six
  months for the data" — technically a test, but not one that proves you can move fast and think
  cheap, which is the whole point of this lens.
- **test_decisive (1-5).** Does the test's outcome actually tell you whether the belief holds, or
  is it ambiguous either way? A test that "passes" no matter what happened isn't a real test.
- **payoff_concrete (1-5).** Is the payoff a specific, named thing ("saves 3 months of build time
  before the wrong feature ships") or a vague gesture ("could help the business")? Concrete wins.
- **reader_runnable (true/false).** Could a reader with no special access actually run the test
  described? If it requires internal data, a specific company's tooling, or Muxin's own access,
  it's `false` — the analysis may still be worth publishing, but as a written argument, not a "try
  this yourself" piece, and the anti-salty guard treats `false` as a hard flag: rework it or be
  honest with Muxin that it's not going to double as proof-of-work the way this lens exists for.
- **constructive (1-5).** Read the whole piece aloud. Does it read like someone trying to help the
  subject succeed, or like someone finding fault for its own sake? A 5 offers the subject (and the
  reader) a genuinely useful next step. A 2-3 reads smug or purely critical — this is the
  anti-salty guard's other half, and it's the dimension Muxin cares about most: the entire reason
  this lens exists is to avoid being "just a salty person who only points out things going wrong."

## The anti-salty guard

`needsAntiSaltyGuard(scores)` trips when `reader_runnable` is `false` OR `constructive <= 3`. When
it trips: **stop, don't write `source.md`**. Tell Muxin directly what's failing and why, and rework
the belief/test/payoff with him — this is not a score to note and move past, it's the guard the
whole feature exists to enforce.

Other low dimensions (`load_bearing`, `test_cheap`, `test_decisive`, `payoff_concrete` at or below
3) are soft flags — `deriskNote()` records them in the eventual review-queue row's `notes` cell the
same way `spinPassNote()`/`threadCheckNote()` do elsewhere in this pipeline, but they don't block
you from continuing. Worth naming to Muxin in the moment anyway, since a low `test_cheap` or
`load_bearing` score usually means a stronger belief was available and got passed over.
