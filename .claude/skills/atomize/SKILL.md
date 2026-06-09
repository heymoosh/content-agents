---
name: atomize
description: Build 1 — atomize one piece of Muxin's original content into platform assets (text, quote cards, video) and a review queue. Usage - /atomize <substack-url | file | audio-file>, or /atomize --revise <content-folder>.
---

# /atomize — content atomization pipeline

Turn ONE piece of Muxin's original content into platform-specific assets, scored and queued
for review. Muxin wrote the thinking; you package it.

## The extraction-first rule (non-negotiable)

- Derivatives are built from **verbatim sentences** in the source. You may trim, tighten, and
  reformat for the platform. You may NOT compose new claims, arguments, metaphors, or
  worldview statements in Muxin's voice.
- Every derivative carries `source_lines` frontmatter listing the source.md line numbers its
  text came from. If you can't point at lines, you wrote it — delete it.
- If the source is too thin to atomize honestly, say so and stop. Do not pad.

## Steps

1. **Ingest.** `npm run new-content -- <arg>` → prints the content folder path. (Audio files
   are transcribed automatically via the configured provider.) Read `source.md`.

2. **Read the latest strategy brief** in `briefs/` (highest date). Apply its
   `Directives for atomization` — pillar priority, channel emphasis, format notes, hooks that
   worked. If no brief exists, proceed with defaults and note that in the review queue header.

3. **Tag + extract.** Identify the pillar(s) (rubric: `config/pillars.yaml`). List the 5–10
   most quotable/claimable sentences with their line numbers. Write these to
   `<folder>/extracts.md` — this is the working material for every derivative.

4. **Generate text derivatives** into `<folder>/derivatives/` per `config/platforms.yaml`
   (counts and style there):
   - `x-1.md … x-5.md`, `linkedin-1.md`, `bluesky-1.md`
   - Community variants ONLY for communities where the brief shows a reason to post, e.g.
     `community-democratic-resilience.md`. Respect `config/platforms.yaml` community notes
     (ABC Builders: observe-only unless brief says otherwise).
   - `video-script.md` (hook / 1–2 points / CTA, ≤220 words, written to be spoken) and
     `quote-card-1.md` (verbatim quotable line) — these drive the asset steps.
   - File format:
     ```markdown
     ---
     platform: x            # x | linkedin | bluesky | community | video-script | quote-card
     option: 1
     source_lines: [12, 31-33]
     scores: { native: 4, brand: 5, cta: true }
     cta: https://...       # or none
     ---
     <the post text — nothing else>
     ```
   - If `text-polish` is enabled in `config/providers.yaml`, X variants may be passed through
     it for punch — but the polished text must still trace to source_lines; re-check after.

5. **Score honestly** (the frontmatter `scores`):
   - `native`: does this read like a real human post on that platform? (1–5)
   - `brand`: does it represent human-centered AI values? (1–5)
   - `cta`: does it point somewhere useful? (true/false — CTA is optional, not mandatory)
   - Score 1–2 → discard it yourself rather than queueing junk.

6. **Validate.** `npm run validate -- <folder>` — must pass before queueing. Fix violations,
   don't relax limits.

7. **Generate assets** (each step skips gracefully if its API key is missing — note it in the
   review queue):
   - Quote cards: `npm run render -- --still <folder> --quote quote-card-1`
   - Video: `npm run render -- --video <folder>` (TTS → captions → Remotion → MP4 + thumbnail
     + title.txt + description.txt + transcript.txt). Write title/description yourself first
     into `video/title.txt` + `video/description.txt` — extraction-first applies to these too.

8. **Queue for review.** Fill `<folder>/review-queue.md` with one row per asset
   (id, platform, format, asset path, scores, status=pending). Then STOP. Do not publish.
   Tell Muxin: the folder path, asset counts, and anything skipped.

## --revise mode

`/atomize --revise <folder>`: read `review-queue.md`, find rows with status `revise`, re-draft
ONLY those derivatives using the `notes` column as instruction (extraction-first still applies),
reset their status to `pending`, re-validate, and report.
