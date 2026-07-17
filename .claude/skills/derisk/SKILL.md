---
name: derisk
description: Muxin's signature editorial frame -- riskiest belief, cheapest test, decision it unlocks, what it saves if false -- applied to a topic he picks (a claim, a product release, a trend) so readers start recognizing the pattern as his. Opt-in only -- Muxin invokes it explicitly, often on a content-example lead /scout already found. Usage - /derisk <url|file|topic> [--belief "seed belief to red-team"].
---

# /derisk: riskiest belief, cheapest test, payoff

Muxin's signature frame, reused every time so readers start associating it with him:

> Here's the riskiest belief, the cheapest test, the decision it will unlock, and what it saves
> [us / you] if it's false.

Applied to a topic Muxin picks (a hyped claim, a product release, a trend) and closed with his
positioning line. This is a fixed editorial structure, not a scoring exercise -- being useful IS
the frame, not something enforced on top of it. See `references/belief-rubric.md` for the six
beats that make up a complete frame.

**Opt-in only.** This never runs as a side effect of `/atomize`, `/scout`, or any other skill.
Muxin invokes it explicitly, on a topic he chose. See CLAUDE.md rule 1's scoped exception for why
composing original text here is legal at all -- it depends entirely on the interactive-lock and
review-gate steps below, not on this skill's own judgment alone.

## Non-negotiable rules

1. **Never automatic.** No other skill calls into `/derisk`. If `/atomize` or `/scout` ever seem
   like they'd benefit from auto-invoking this, that's a sign to ask Muxin, not to wire it in.
2. **The belief is locked with Muxin, not by the AI alone.** Propose a candidate, red-team your
   own pick with 1-2 stronger alternatives, and brainstorm until Muxin picks ONE. The red-team
   reasoning is internal -- share it in conversation, never in the composed piece.
3. **Evidence-gated when the belief rests on a checkable fact.** Same discipline as
   `/outreach research`'s evidence items: a real quote with a live source URL, or don't claim it.
   If the belief is a judgment call with no single checkable fact, say so and skip the evidence
   pass rather than forcing a citation that doesn't exist.
4. **Every beat of the frame, every time.** Belief, test, decision, payoff, sign-off -- all five.
   `src/derisk/score.ts`'s `deriskNote()` flags a missing or weak beat as a soft note in the
   eventual review-queue row, same as every other soft-scored dimension in this pipeline (see
   `storytelling.ts`'s `spinPassNote()`). It never blocks -- Muxin's own sign-off in conversation
   is what actually confirms the frame lands, not a score threshold.
5. **This skill's flow is content-generation logic (CLAUDE.md rule 7).** A PR touching this
   SKILL.md's steps or `src/derisk/score.ts`'s rubric holds for Muxin's review with an old-vs-new
   sample -- no self-vet-merge shortcut.
6. **Voice.** Whatever gets composed follows `config/voice.yaml` -- no em dashes, no AI tells.
   Read it aloud: it should sound like Muxin naming an assumption, not a report grading one.
7. **Still gated by review.** Writing `source.md` is not publishing. `/atomize` → `review-queue.md`
   → Muxin's approval is what publishes (CLAUDE.md rule 2 still governs every word this produces).

## Flow

### Step 1: ingest the topic

Muxin points at something: a URL (`/derisk https://example.com/blog/post`), a pasted excerpt, a
plain topic ("Kimi K3 topping a coding leaderboard"), or a `content-example` lead `/scout` already
found (`outreach/leads/content-example-<slug>/lead.md` -- `kind: content-example`, has a
`## Profile`, a tentative one-line angle, and cited evidence already gathered; see
`.claude/skills/scout/SKILL.md`). Read the source directly -- WebFetch for a URL, Read for a file
or lead folder, or just work from the topic Muxin describes. If nothing usable comes back (dead
link, paywall, thin content), say so and stop. Do not fabricate a stand-in example.

### Step 2: propose + red-team the riskiest belief

If Muxin passed `--belief "..."`, treat it as the seed candidate -- still red-team it, he can still
override. Otherwise: read the topic and name the ONE riskiest belief underneath the claim or
decision it's built on (an assumption that, if wrong, changes what someone should actually do).
Then immediately red-team your own pick: name 1-2 stronger candidate beliefs and say why they might
be the real risk instead. Share this red-team reasoning with Muxin in conversation so he can
choose -- it must never appear in the composed piece. Brainstorm until ONE belief is locked. This
step is what makes rule 1's carve-out legal: the belief is never asserted unilaterally.

### Step 3: evidence pass (only if the belief rests on a checkable fact)

If the locked belief hinges on something lookupable (a stated metric, a public claim, a fact about
the market), WebSearch/WebFetch for real sources and record quote + source URL -- the same
evidence discipline `/outreach research` uses (`config/outreach/*.md`'s cited-quote requirement).
If the belief is a judgment call with no single checkable fact, skip this and say so.

### Step 4: cheapest test, named decision, concrete payoff

Draft, with Muxin, not for him, the rest of the frame:
- **The cheapest test** of the belief -- reader-runnable, something a person could try in a
  weekend, not "commission a study."
- **The decision it unlocks** -- name it explicitly ("whether to spend a sprint adopting this
  tool," not "whether it's good"). A frame without a named decision is just an observation.
- **The concrete payoff** -- what passing or failing that test specifically saves or unlocks
  ("saves a week of onboarding a model that can't hold a real codebase together," not "could help
  the business"). Keep pushing for a named, specific one.

### Step 5: the sign-off

Close the piece with Muxin's positioning line -- the sentence that names what he does and invites
the reader to bring him a problem (his own words, not a new claim; pull the current line from
recent `/derisk`-style posts or ask him if none exist yet). This is what turns one analysis into a
recognizable, repeated frame rather than a one-off post.

### Step 6: score the frame + write source.md

Score the composed piece against the six beats in `references/belief-rubric.md`
(`belief_load_bearing`, `test_cheap`, `test_reader_runnable`, `decision_named`,
`saves_if_false_concrete`, `has_signoff` -- enforced by `src/derisk/score.ts`). If
`needsFramePass()` is true (a beat is missing or a numeric dimension reads weak), say so to Muxin
and offer a rework -- this is a suggestion, not a stop; he decides whether it's worth another pass
or fine as-is.

Once Muxin signs off, scaffold the content folder the same way every other content path does:

```
echo "<composed text>" | npm run new-content -- --text
```

This calls `scaffoldContentFolder()` (`src/atomize/new-content.ts`), creating
`content/<date>-<slug>/source.md` plus an empty `review-queue.md`. Then patch two fields into
`source.md`'s frontmatter, inserted before the closing `---` the same way `writeSourceClass` does
(`src/atomize/source-triage.ts`) -- a text-level patch, not a rewrite, so the rest of the block
stays byte-for-byte untouched:

- `source_kind: derisk-composed` -- reuses the existing "this is composed, not extracted" field
  name `resolveFileSource` already sets for locked outreach messages (`source_kind:
  outreach-message`, `src/atomize/new-content.ts`). Note: as of this writing `src/db/tag-source.ts`
  only recognizes `outreach-message`, not yet `derisk-composed` -- stamping the field now means a
  future wiring pass can add that recognition without another source.md schema change; it isn't
  live downstream tracking yet.
- `derisk_scores: {...}` -- the six fields from step 6. `deriskNote()`/`summarizeDerisk()`
  (`src/derisk/score.ts`) can read this frontmatter to fold a flagged beat into a review-queue
  row's `notes` cell, mirroring `spinPassNote()`/`threadCheckNote()` (`src/atomize/storytelling.ts`)
  -- that wiring into `/atomize`'s row-creation step and `npm run validate` doesn't exist yet
  either (touching `/atomize`'s own logic is out of scope for this skill), so treat this stamp as
  groundwork, not an active integration.

Tell Muxin the folder is ready for `/atomize --continue <folder>` -- `/derisk` itself never runs
atomize or generates platform derivatives; that hand-off is a separate, explicit step.

## What "done" looks like

A `content/<date>-<slug>/source.md` executing all five beats of the frame -- riskiest belief,
reader-runnable test, named decision, concrete payoff, sign-off -- with `derisk_scores` in
frontmatter, plus Muxin's own sign-off from the brainstorm. Ready for `/atomize --continue`, gated
the same as every other piece of content by `review-queue.md`.
