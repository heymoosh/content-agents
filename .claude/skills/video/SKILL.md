---
name: video
description: Build 1 — turn ONE piece of Muxin's content into a vertical short (script → storyboard → review → render). The deliberate, heavier video path, split out of /atomize so atomize stays cheap. Usage - /video <content-folder | substack-url | file | audio-file | text>, or /video --revise <content-folder>.
---

# /video — short-form video generation

Turn ONE piece of Muxin's content into a vertical short. This is the **deliberate, heavier**
path, split out of `/atomize` on purpose: `/atomize` stays cheap (text + quote cards), and you
run `/video` only on the pieces worth turning into a short.

## The extraction-first rule still bounds this

Video scripts are the **scoped exception** to extraction-first (CLAUDE.md rule 1): Grok drafts a
hook-driven script from the essay's *ideas*, not verbatim lines. This is allowed ONLY because the
storyboard is reviewed and approved as TEXT before any render, and nothing auto-publishes. The
exception is the spoken script only — `title.txt`/`description.txt` stay extraction-first.

## Cost gate — read before spending

Video is the most expensive thing the pipeline does. It is **two-phase, money only in phase 2**:

1. **Script + storyboard = cheap** — the only spend is one Grok text call. Reviewed as TEXT.
2. **Render = real money** — scene generation + (local, free) voice + Remotion.

**Never auto-escalate the model or engine — offer first** (policy: [[cost-escalation-offer-first]]).

## Scene engine — choose per short

| Engine | What it is | ~Cost | Status |
|---|---|---|---|
| **image-motion** (default) | still scene images + Ken Burns zoom/pan in Remotion | ~$0.12/short (Riverflow ×6) | **live** |
| **animated** | true generative video per scene, Veo direct on the Gemini key (no extra fee), no-audio tier (we overlay Kokoro voice) | ~$1–4.50/short | planned (Phase 2 — not yet wired) |

Default to **image-motion**. When the animated engine lands, pick it explicitly per short and
offer the cost first. Both coexist — animation is an added option, not a replacement for B-roll.

## Steps

1. **Resolve the piece.**
   - If the arg is an existing content folder → use it (reuse its `source.md`/`extracts.md`).
   - Else (URL / file / audio / pasted text) → `npm run new-content -- <arg>` (for pasted text,
     pipe via a quoted `--text` heredoc as in `/atomize`), then read `source.md`.
   - Optional: read the latest brief in `briefs/` and apply its hook/pillar emphasis.

2. **Tag + extract** (skip if the folder is already atomized and `extracts.md` exists). Identify
   the pillar (`config/pillars.yaml`); note the most video-worthy ideas.

3. **Script (Grok — the cheap spend).** Call the script writer (Grok via the `text-polish`
   provider) on the source/extracts: a 60–90s, hook-first spoken script (hook in line 1, 1–2
   points, CTA), ≤220 words, conversational, not hype-y. Sanity-check it stays true to the
   essay's ideas — reject and re-prompt if it invents claims Muxin wouldn't make.

4. **Storyboard.** Read `config/style.yaml`. Storyboard the script into **5–7 scenes**. For each
   scene write a `beat` (one line), a `visual` (a scene prompt ending with `global.mood` + the
   matching pillar's `suffix` so all scenes share one look), and a `motion` hint (`zoom-in` /
   `zoom-out` / `pan-left` / `pan-right`). Write `<folder>/video/storyboard.md`:
   ```markdown
   ---
   kind: storyboard
   pillar: human-ai
   engine: image-motion
   script_words: 78
   source_ref: source.md
   status: pending
   ---
   ## Script
   <the spoken script>

   ## Scenes
   ### Scene 1
   - beat: <what this scene covers>
   - visual: <scene prompt … + style suffix>
   - motion: zoom-in
   ### Scene 2
   ...
   ```
   Add a **storyboard** row to `review-queue.md` (`format: storyboard`, asset
   `video/storyboard.md`, status `pending`). **STOP — generate NO images or audio.** Tell Muxin
   to review the storyboard before it renders.

5. **Render (only after the storyboard row is `approve`).**
   - Write `video/title.txt` + `video/description.txt` (extraction-first applies to these).
   - `npm run render -- --render-video <folder>` — refuses unless the storyboard row is
     `approve`; then derives `derivatives/video-script.md` + `video/image-prompts.txt` from the
     storyboard and runs TTS → (Whisper alignment) → captions → scene images → Remotion →
     `video/short.mp4` + thumbnail + transcript.
   - **Image model is cost-first** — Riverflow (~$0.02) by default. Only add `--pro`
     (Nano Banana Pro ~$0.13) or `--hero` (gpt-5.4-image-2 ~$0.23) if Muxin asks; **offer first,
     never auto-escalate.**
   - Add a **short** row to `review-queue.md` for `video/short.mp4` (status `pending`).

6. **Stop.** Report the folder, the `short` row, and what it cost. Do not publish — that's
   `/publish`.

## --revise <folder>

Read `review-queue.md`, act on rows with status `revise` by `format`:
- **storyboard**: re-script via Grok and/or re-storyboard per the `notes` (cheap; no image/audio
  spend). Reset to `pending`.
- **short** (MP4): re-run `npm run render -- --render-video <folder>` (delete
  `images/video-*.png` first to force image regeneration past the cache). Reset to `pending`.
