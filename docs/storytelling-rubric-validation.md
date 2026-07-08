# Storytelling rubric — validation against real /atomize output (2026-07-07)

Card: "Validate storytelling rubric against real /atomize output" (9be7688d). Runs the
hook/narrative/resonance rubric (`src/atomize/storytelling.ts`) against real, live-scored
derivatives instead of only `storytelling.test.ts`'s fixture values, and checks whether the
soft-gate (`LOW_SCORE_THRESHOLD = 3`) still behaves the way the original eval expected.

## Method

`npm run validate` (`src/atomize/validate.ts`) already runs `summarizeStorytelling` as part of
its advisory output. Ran it against every content folder that has a populated `scores:`
frontmatter block, then pulled every real `hook`/`narrative`/`resonance` triple directly from
derivative frontmatter across the repo's full content history.

## Real sample

Storytelling scores exist on derivatives from **one** source piece so far:
`content/2026-07-05-hey-substack-i-m-looking-for-others-who-feel-int/` (6 derivatives — all
`format:near-verbatim-note`). Earlier folders (`2026-06-16-building-an-innovation-nation`,
`2026-07-04-250th-anniversary-question`) only carry `native`/`brand`/`cta` scores — no
`hook`/`narrative`/`resonance` — so the dimension hasn't been exercised on those runs at all.
That means the real sample is thin: n=6, one source, one atomize pass.

`npm run validate` output for that folder:
```
storytelling: 6 scored, 4 flagged for a Spin pass (not blocking)
  — bluesky-1.md (low: narrative), quote-card-1-bluesky.md (low: narrative),
    quote-card-1-x.md (low: narrative), x-1.md (low: narrative)
```

Raw scores:

| file | hook | narrative | resonance |
|---|---|---|---|
| bluesky-1.md | 4 | 3 | 4 |
| linkedin-1.md | 4 | 4 | 5 |
| quote-card-1-bluesky.md | 4 | 3 | 4 |
| quote-card-1-linkedin.md | 4 | 4 | 5 |
| quote-card-1-x.md | 4 | 3 | 4 |
| x-1.md | 4 | 3 | 4 |

## Finding

The rubric was built on an eval (storytelling.ts's own header comment) that found **all three**
dimensions — hook, narrative, resonance — clustering at 2-3 across 10 real derivatives, motivating
`LOW_SCORE_THRESHOLD = 3`. The live sample does **not** reproduce that: `hook` is 4 on every single
derivative scored so far (never flagged), `resonance` is 4-5 (never flagged), and only `narrative`
actually clusters at the threshold (3 on 4 of 6, all correctly flagged). So the soft-gate is
discriminating, not degenerate — it isn't flagging everything or nothing — but two of its three
dimensions have shown zero variance in production so far.

Two explanations are both plausible with n=6: (a) hook/resonance are genuinely strong on
near-verbatim-extraction posts (pulling the single punchiest line naturally nails the hook and the
payoff, while narrative continuity is what breaks when you extract a fragment out of a longer
note) — in which case the rubric is correctly finding a real, narrower problem than the original
eval implied; or (b) inline Claude scoring in production is more generous than the original
10-derivative manual eval was, i.e. a calibration drift on hook/resonance specifically. One
source and six data points can't distinguish these.

## Recommendation

**Keep the rubric and threshold as-is.** Do not narrow it to narrative-only or change
`LOW_SCORE_THRESHOLD` yet — the sample is too small (one source, one atomize run) to retune
anything on, and the threshold is already doing useful work (catching real narrative weakness on
4 of 6 near-verbatim posts). Re-run this same check once storytelling scores exist across a
handful of distinct source pieces (rough target: n≥20 scored derivatives spanning ≥3 different
essays/notes, not just more posts from the same source). At that point, specifically check
whether hook/resonance keep showing zero variance — if they do across multiple sources, that's
worth a real conversation about whether the rubric should stay 3-dimensional or narrow to the
dimension that's actually discriminating.
