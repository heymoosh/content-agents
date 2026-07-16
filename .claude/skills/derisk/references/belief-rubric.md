# The derisk rubric — six beats, three scored 1-5, three present/absent

Score the composed frame against the *locked* belief/test/decision/payoff/sign-off (SKILL.md step
6). `src/derisk/score.ts` is the deterministic plumbing that reads what you score here and flags
an incomplete or weak frame -- you do the judgment, the module just surfaces it as a soft note.

## Numeric (1-5, `<=3` reads weak)

- **belief_load_bearing.** Does the claim or decision actually rest on this belief, or is it a
  side detail? A 5 means: if this belief is wrong, the thing someone should do about the topic
  visibly changes. A 2-3 means you picked a belief that's true-or-false but doesn't actually
  change the decision -- go back to the red-team step and pick a more load-bearing one.
- **test_cheap.** Could someone actually run this test themselves, cheaply? A 5 is a
  weekend-or-less, no-budget test a reader could try. A 2-3 is "commission a study" or "wait six
  months for the data" -- technically a test, but not the "move fast, think cheap" instinct the
  frame is known for.
- **saves_if_false_concrete.** Is the payoff a specific, named thing ("saves a week of onboarding
  a model that can't hold a codebase together") or a vague gesture ("could help the business")?
  Concrete wins.

## Present/absent (boolean)

- **test_reader_runnable.** Could a reader with no special access actually run the test described?
  If it requires internal data, a specific company's tooling, or access only Muxin has, this is
  `false` -- the piece may still be worth publishing, but as a written argument rather than a
  "try this yourself" post.
- **decision_named.** Does the piece explicitly name the decision the test unlocks ("whether to
  spend a sprint adopting this")? A frame that only observes without naming a decision is
  incomplete -- it reads as commentary, not the frame.
- **has_signoff.** Does the piece close with Muxin's positioning line? This is what turns one
  analysis into a recognizable, repeated pattern instead of a one-off post -- skipping it is the
  single easiest way for a `/derisk` piece to stop reading like Muxin's.

## How a flag is used

`needsFramePass(scores)` is a **soft signal**, never a hard stop -- mirrors `needsSpinPass()` in
`src/atomize/storytelling.ts` exactly. It's true when any numeric dimension reads `<=3` or any
boolean beat is `false`. When it's true: tell Muxin which beat is missing or weak and offer another
pass -- he decides whether it's worth reworking or fine to ship as-is. `deriskNote()` records the
same flags in the eventual review-queue row's `notes` cell so it's visible at review time too, the
same way `spinPassNote()`/`threadCheckNote()` do elsewhere in this pipeline.

There is no guard that blocks writing `source.md`. Being useful and constructive is what the frame
itself is built to produce -- the riskiest-belief/cheapest-test/payoff structure IS the mechanism,
not a score enforced on top of it.
