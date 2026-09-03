---
name: develop
description: The advisor stage of the review GUI's Develop tab (also runnable from the CLI). Reads one piece of Muxin's inspiration and proposes recommendation cards — brand angles (brand-lens inspiration rubric), a CTA sense-check, per-platform spin fit, and a routing preview — appended as one round to content/<slug>/develop/advice.json + develop/log.md. Proposes only; never drafts a cut, a derivative, or anything that enters the pipeline as content. Usage - /develop <content-folder | url | file | pasted-text-inbox-path>.
---

# /develop — the advisor round behind the Develop tab

Muxin drops inspiration into the Develop tab; you are the advisor. Run the checks, propose
recommendation cards, write ONE new round to the develop files, stop. The GUI (not you) handles
everything that acts on your advice: accepting an angle deterministically builds a cut from
Muxin's own verbatim `source.md` lines (`src/review/develop.ts` `acceptAngle`), and "Format for
platforms" runs the normal `/atomize --continue` pipeline afterward.

## Hard rules (override everything below)

1. **Extraction-first (CLAUDE.md rule 1).** You propose angles and point at which of Muxin's
   verbatim `source.md` lines carry each one. You NEVER compose prose in Muxin's voice, never
   write or edit a cut, never call `addCut`, never touch `source.md`, `extracts.md`, or any
   `derivatives/`. Your ONLY writes are `develop/advice.json` and `develop/log.md`.
2. **Voice.** Your own annotation prose (card titles, summaries, log text) follows
   `config/voice.yaml` — no em dashes, no AI tells.
3. **Nothing queues or publishes here.** No review-queue rows, no routing.md writes, no renders.
4. **Honesty over padding.** A thin source gets a `note` card saying so, not invented angles.
   Evidence discipline: when a card rests on a checkable fact, cite it or don't claim it.

## Steps

0. **Ingest if needed.** If the arg is already a content folder (`content/<slug>`), skip ahead.
   A URL or file path: `npm run new-content -- <arg>` prints the folder. A pasted-text inbox file
   (`content/.inbox/*.md`, materialized by the GUI): pass it the same way — it's just a file.
   Then read `<folder>/source.md`.

1. **Read the session state.** If `develop/advice.json` and `develop/log.md` exist, read both.
   If `log.md` ends with a `## Muxin — reply (round N)` section newer than the last advisor round,
   this is a **reply round**: address that reply specifically — refine, replace, or defend the
   prior cards it pushes on, and say so in the new cards' summaries. Otherwise this is the
   initial round.

2. **Run the checks.** Each produces cards (see the schema below). Read the configs fresh every
   run — never hardcode brand or platform language here.
   - **Angles** (kind `angle`, 2-4 of them): apply `/brand-lens` inspiration mode's rubric
     (`.claude/skills/brand-lens/SKILL.md`) against `config/brand.yaml` — for each angle name the
     reader + payoff, the altitude and the platform it maps to, the belief under audit in one
     sentence, and the cheapest observable a reader could check in under a day. Then the part
     that makes an angle acceptable as a cut: list the exact 1-indexed `source.md` line numbers
     (the file as it sits on disk; a range is `"31-33"`) whose VERBATIM text carries the angle,
     and propose a lens slug matching `^[a-z][a-z0-9-]*$` (never `extract` — that's the default
     top-level cut). If the source can't honestly support more than one angle, produce fewer, or
     a `note` card saying so.
   - **CTA sense-check** (kind `cta`, one card): judge the `content_type` classification per
     `config/content-types.yaml` and `/atomize` step 4.5's rules; flag when a `project_url`
     question should be put to Muxin (never guess or invent a project link) and when a literal
     `cta` override (e.g. civic-tech's voting tool) likely applies.
   - **Platform spin fit** (kind `spin`, one card): for each platform with a
     `config/platforms.yaml` `spin_angles` entry, one line on how this piece does or doesn't fit
     that channel's approved angle.
   - **Routing preview** (kind `routing`, one card): judge the pillar(s) per
     `config/pillars.yaml`, then run `npm run route -- --brand <brand> --pillar <pillars>` WITHOUT `--folder`
     (prints the decision, writes nothing) and report which platforms would be included/skipped
     and why in one line each.

3. **Emit the round.** Append ONE new round to `develop/advice.json` (create the file with
   `{"version": 1, "rounds": []}` shape if absent) and a matching human-readable section to
   `develop/log.md`. Never modify a prior round or a prior card's status — accept/dismiss belong
   to the GUI. The exact schema:

   ```json
   {
     "version": 1,
     "rounds": [
       {
         "index": 1,
         "trigger": "initial",            // "reply" on a reply round
         "replyText": null,               // on a reply round: the Muxin reply you're answering
         "at": "2026-07-17T18:00:00Z",
         "cards": [
           {
             "id": "r1-c1",              // r<round>-c<card>, unique across the whole file
             "kind": "angle",            // angle | cta | spin | routing | note
             "title": "Belief under audit: ...",
             "summary": "Reader + payoff, altitude -> platform, the observable. Your rationale prose; it never enters content.",
             "lens": "belief-audit",     // angle only
             "sourceLines": [12, "31-33"],  // angle only: verbatim source.md lines that carry it
             "status": "open",           // always "open" when you write it
             "acceptedLens": null,
             "decidedAt": null
           }
         ]
       }
     ]
   }
   ```

   `develop/log.md` gets `## Round N — advisor (<date>)` with the cards rendered as readable
   prose (titles, rationale, line refs). On a reply round the Muxin reply is already in the log —
   your section follows it.

4. **Stop.** No formatting, no cuts, no scaffolding beyond step 0, no publishing. Report the
   round you wrote in one short paragraph.

## Notes

- Line refs can go stale if Muxin edits `source.md` after your round — the GUI resolves previews
  live and refuses an accept whose refs point past the file, so precision matters more than
  coverage: cite the lines that really carry the angle, not a whole-document range.
- This skill's flow is content-generation-adjacent judgment (CLAUDE.md rule 7): a PR touching it
  holds for Muxin's review with an old-vs-new sample. No self-vet-merge.
