---
name: derisk
description: An opt-in-only analysis lens that names the riskiest belief behind an external example (a product, business, or org strategy Muxin points it at), the cheapest test for it, and what that test saves or unlocks. Never runs automatically -- Muxin invokes it explicitly, often on a content-example lead /scout already found. Usage - /derisk <url|file|content-example-lead-folder> [--belief "seed belief to red-team"].
---

# /derisk: riskiest belief, cheapest test, payoff

The demonstration of analytical value Muxin asked for: instead of only pointing out what's wrong
with someone else's strategy, name the belief it actually rests on, the cheapest real way to test
it, and what passing or failing that test would save or unlock — something a reader could try
themselves. This is how the value gets proven rather than just claimed.

**Opt-in only.** This never runs as a side effect of `/atomize`, `/scout`, or any other skill.
Muxin invokes it explicitly, on an example he chose. See CLAUDE.md rule 1's scoped exception for
why composing original analysis here is legal at all — it depends entirely on the interactive-lock
and review-gate steps below, not on this skill's own judgment alone.

## Non-negotiable rules

1. **Never automatic.** No other skill calls into `/derisk`. If `/atomize` or `/scout` ever seem
   like they'd benefit from auto-invoking this, that's a sign to ask Muxin, not to wire it in.
2. **The belief is locked with Muxin, not by the AI alone.** Propose a candidate, red-team your
   own pick with 1-2 stronger alternatives, and brainstorm until Muxin picks ONE. The red-team
   reasoning is internal — share it in conversation, never in the composed piece.
3. **Evidence-gated when the belief rests on a checkable fact.** Same discipline as
   `/outreach research`'s evidence items: a real quote with a live source URL, or don't claim it.
   If the belief is a judgment call with no single checkable fact, say so and skip the evidence
   pass rather than forcing a citation that doesn't exist.
4. **The anti-salty guard is a hard stop, not a note.** `src/derisk/score.ts`'s
   `needsAntiSaltyGuard()` — see `references/belief-rubric.md` for the full rubric. If it trips,
   stop, tell Muxin why, and rework before writing `source.md`.
5. **This skill's flow is content-generation logic (CLAUDE.md rule 7).** A PR touching this
   SKILL.md's steps or `src/derisk/score.ts`'s rubric holds for Muxin's review with an old-vs-new
   sample — no self-vet-merge shortcut.
6. **Voice.** Whatever gets composed follows `config/voice.yaml` — no em dashes, no AI tells. The
   `constructive` dimension IS the voice check for this lens specifically: read it aloud, if it
   sounds smug instead of useful, it fails.
7. **Still gated by review.** Writing `source.md` is not publishing. `/atomize` → `review-queue.md`
   → Muxin's approval is what publishes (CLAUDE.md rule 2 still governs every word this produces).

## Flow

### Step 1: ingest the example

Muxin points at something: a URL (`/derisk https://example.com/blog/post`), a pasted excerpt, or a
`content-example` lead `/scout` already found (`outreach/leads/content-example-<slug>/lead.md` —
`kind: content-example`, has a `## Profile`, a tentative one-line angle, and cited evidence
already gathered; see `.claude/skills/scout/SKILL.md`). Read the source directly — WebFetch for a
URL, Read for a file or lead folder. If nothing usable comes back (dead link, paywall, thin
content), say so and stop. Do not fabricate a stand-in example.

### Step 2: propose + red-team the riskiest belief

If Muxin passed `--belief "..."`, treat it as the seed candidate — still red-team it, he can still
override. Otherwise: read the example and name the ONE riskiest belief the strategy or decision
rests on (an assumption that, if wrong, breaks the plan). Then immediately red-team your own pick:
name 1-2 stronger candidate beliefs and say why they might be the real risk instead. Share this
red-team reasoning with Muxin in conversation so he can choose — it must never appear in the
composed piece. Brainstorm until ONE belief is locked. This step is what makes rule 1's carve-out
legal: the belief is never asserted unilaterally.

### Step 3: evidence pass (only if the belief rests on a checkable fact)

If the locked belief hinges on something lookupable (a stated metric, a public claim, a fact about
the market), WebSearch/WebFetch for real sources and record quote + source URL — the same
evidence discipline `/outreach research` uses (`config/outreach/*.md`'s cited-quote requirement).
If the belief is a judgment call with no single checkable fact, skip this and say so.

### Step 4: cheapest test + concrete payoff

Draft, with Muxin, not for him: the cheapest real test of the belief (reader-runnable — something
a person could try in a weekend, not "commission a study"), and the concrete payoff — what passing
or failing that test would specifically save or unlock. Vague payoffs ("could help the business")
aren't done yet; keep pushing for a named, specific one.

### Step 5: score + anti-salty guard

Score the locked analysis against the six dimensions in `references/belief-rubric.md`
(`load_bearing`, `test_cheap`, `test_decisive`, `payoff_concrete`, `reader_runnable`,
`constructive` — mirrors `src/atomize/storytelling.ts`'s pattern, enforced by
`src/derisk/score.ts`). If `needsAntiSaltyGuard()` trips (`reader_runnable: false`, or
`constructive <= 3`): **stop**. Tell Muxin directly what's failing — reads as pure criticism, or
isn't actually testable by a reader — and rework the belief/test/payoff before continuing. Do not
write `source.md` on a piece that fails this guard. Other low dimensions are soft flags: mention
them, but keep going.

### Step 6: write source.md, hand off to atomize

Once locked and passing the guard, compose the piece in Muxin's voice and scaffold it the same way
every other content path does:

```
echo "<composed text>" | npm run new-content -- --text
```

This calls `scaffoldContentFolder()` (`src/atomize/new-content.ts`), creating
`content/<date>-<slug>/source.md` plus an empty `review-queue.md`. Then patch two fields into
`source.md`'s frontmatter, inserted before the closing `---` the same way `writeSourceClass` does
(`src/atomize/source-triage.ts`) — a text-level patch, not a rewrite, so the rest of the block
stays byte-for-byte untouched:

- `source_kind: derisk-composed` — reuses the existing "this is composed, not extracted" field
  name `resolveFileSource` already sets for locked outreach messages (`source_kind:
  outreach-message`, `src/atomize/new-content.ts`). Note: as of this writing `src/db/tag-source.ts`
  only recognizes `outreach-message`, not yet `derisk-composed` — stamping the field now means a
  future wiring pass can add that recognition without another source.md schema change; it isn't
  live downstream tracking yet.
- `derisk_scores: {...}` — the six fields from step 5. `deriskNote()`/`summarizeDerisk()`
  (`src/derisk/score.ts`) can read this frontmatter to fold a flagged low score into a
  review-queue row's `notes` cell, mirroring `spinPassNote()`/`threadCheckNote()`
  (`src/atomize/storytelling.ts`) — that wiring into `/atomize`'s row-creation step and `npm run
  validate` doesn't exist yet either (touching `/atomize`'s own logic is out of scope for this
  skill; it's Thread C's territory), so treat this stamp as groundwork, not an active integration.

Tell Muxin the folder is ready for `/atomize --continue <folder>` — `/derisk` itself never runs
atomize or generates platform derivatives; that hand-off is a separate, explicit step.

## What "done" looks like

A `content/<date>-<slug>/source.md` with a locked riskiest belief, a reader-runnable test, a
concrete payoff, and `derisk_scores` in frontmatter that pass the anti-salty guard — plus Muxin's
own sign-off from the brainstorm. Ready for `/atomize --continue`, gated the same as every other
piece of content by `review-queue.md`.
