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
   - Text derivatives are ALWAYS Claude-authored and extraction-first. Do NOT pass them
     through `text-polish` — that provider (Grok) is reserved for video scripts only (step 7a).

5. **Score honestly** (the frontmatter `scores`):
   - `native`: does this read like a real human post on that platform? (1–5)
   - `brand`: does it represent human-centered AI values? (1–5)
   - `cta`: does it point somewhere useful? (true/false — CTA is optional, not mandatory)
   - Score 1–2 → discard it yourself rather than queueing junk.

6. **Validate.** `npm run validate -- <folder>` — must pass before queueing. Fix violations,
   don't relax limits.

7. **Generate assets.** Quote cards first (cheap, extraction-first):
   - `npm run render -- --still <folder> --quote quote-card-1`

   Video is **two-phase** — the storyboard is reviewed as TEXT before any paid generation.

   **7a — Script + storyboard (cheap; the only spend here is the Grok text call).**
   Video scripts are the scoped exception to extraction-first (CLAUDE.md rule 1): Grok drafts
   from the essay's *ideas*, not verbatim lines.
   - Call the script writer (Grok via the `text-polish` provider) on the source/extracts with a
     brief: a 60–90s, hook-first spoken script (hook in line 1, 1–2 points, CTA), ≤220 words,
     conversational, not hype-y. (Use `getTextPolish().polish({ draft, platform: "video-script",
     instructions })`, or invoke `text-polish` however the run plumbs it.) Sanity-check it stays
     true to the essay's ideas — reject and re-prompt if it invents claims Muxin wouldn't make.
   - Read `config/style.yaml`. Storyboard the script into **5–7 scenes**. For each scene write a
     `beat` (one line), a `visual` (an Imagen prompt — concrete scene, ending with
     `global.mood` + the matching pillar's `suffix` so all scenes share one look), and a
     `motion` hint (`zoom-in` / `zoom-out` / `pan-left` / `pan-right`).
   - Write `<folder>/video/storyboard.md`:
     ```markdown
     ---
     kind: storyboard
     pillar: human-ai
     script_words: 78
     source_ref: source.md
     status: pending
     ---
     ## Script
     <the spoken script>

     ## Scenes
     ### Scene 1
     - beat: <what this scene covers>
     - visual: <Imagen prompt … + style suffix>
     - motion: zoom-in
     ### Scene 2
     ...
     ```
   - Add a **storyboard** row to `review-queue.md` (`format: storyboard`,
     asset `video/storyboard.md`, status `pending`). **STOP for video here — generate NO images
     or audio.** Tell Muxin to review the storyboard before it renders.

   **7b — Render (only after the storyboard row is approved).**
   - Write `video/title.txt` + `video/description.txt` (extraction-first applies to these).
   - `npm run render -- --render-video <folder>` — refuses unless the storyboard row is
     `approve`; then derives `derivatives/video-script.md` + `video/image-prompts.txt` from the
     storyboard and runs TTS → (Whisper alignment if the voice has no timestamps) → captions →
     images → Remotion → `video/short.mp4` + thumbnail + transcript.
   - Add a **short** row to `review-queue.md` for `video/short.mp4` (status `pending`).
   - (Each step notes in the queue if an API key/local dep is missing rather than failing the run.)

8. **Queue for review.** Ensure `<folder>/review-queue.md` has one row per asset
   (id, platform, format, asset path, scores, status=pending). Then STOP. Do not publish.
   Tell Muxin: the folder path, asset counts, and anything skipped.

## --revise mode

`/atomize --revise <folder>`: read `review-queue.md`, find rows with status `revise`, and act
by `format`:
- **Text derivatives / quote cards**: re-draft ONLY those using the `notes` column as
  instruction (extraction-first still applies), re-validate.
- **storyboard**: regenerate `video/storyboard.md` per the note (re-script via Grok and/or
  re-storyboard) — this is the cheap checkpoint, so no image/audio spend.
- **short** (MP4): re-run `npm run render -- --render-video <folder>` (delete
  `images/video-*.png` first to force image regeneration past the cache).
Reset revised rows to `pending`, re-validate, and report.
