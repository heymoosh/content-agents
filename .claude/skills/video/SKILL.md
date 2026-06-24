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
| **animated** | Kling interpolates between approved keyframe stills (start→end per scene) via OpenRouter; clips stitched under Kokoro voice + captions | ~$0.08/s ≈ $1–3/short | **live** |
| **motion** | HyperFrames (free, local) choreographs ONE generated still into a motion-graphics visual (camera + overlays); Kokoro voice + captions laid on via AnimatedShort | ~$0.13 (one still; motion is free) | **live** |

**Three engines, cost-first.** Default to **image-motion** (cheapest slideshow). For real motion,
pick per short and **offer the cost first**:
- **`--motion`** (HyperFrames, ~$0.13, perfectly consistent) — the **default choice for
  flat-editorial illustration**. ONE generated still + choreographed motion (camera, overlays,
  reveals); HyperFrames adds the motion for free, so it never pays per scene. Never drifts.
- **`--animated`** (Kling, ~$1–3) — only when a character needs to *physically* move. Kling
  imagines the motion between keyframes; pricier and can drift.

Both paths share the **keyframe-approval gate**: scene visuals become keyframe stills → generate
them with `--keyframes-only` → **you approve** → then render (`--motion` or `--animated`). Veo was
evaluated and rejected (no start→end interpolation on the Gemini key); see
[[video-pipeline-architecture]].

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
   points, CTA), ≤220 words, conversational, not hype-y. **Pass the `config/voice.yaml` rules into
   the Grok instructions** (no em dashes, no AI tells, Muxin's plain PM voice) — this is the one
   place copy is generated non-verbatim, so it needs the voice guard most (CLAUDE.md rule 5).
   Sanity-check it stays true to the essay's ideas AND clean of AI tells — reject and re-prompt if
   it invents claims Muxin wouldn't make or slips in banned phrasing.

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

5. **Render (only after the storyboard row is `approve`).** Write `video/title.txt` +
   `video/description.txt` (extraction-first applies). Then pick the engine (storyboard `engine:`):

   **image-motion (default, cheap):**
   - `npm run render -- --render-video <folder>` — derives `derivatives/video-script.md` +
     `video/image-prompts.txt` from the storyboard, then TTS → (Whisper alignment) → captions →
     scene images → Remotion → `video/short.mp4` + thumbnail + transcript.

   **animated (Kling interpolation):**
   - **Keyframe-approval gate first:**
     `npm run render -- --render-video <folder> --animated --keyframes-only` generates one
     keyframe still per scene visual into `images/keyframe-*.png` and **stops**. Show Muxin the
     stills and **get approval before any paid animation.**
   - **Consistency:** animated keyframes default to **Nano Banana Pro** (~$0.13/still) with
     reference-image conditioning so the character + style stay the same across scenes — scene 1
     anchors the look, and each frame also references the previous one. To pin a recurring
     character/brand, drop an `images/reference.png` in the folder; it becomes the anchor for
     every keyframe.
   - Then: `npm run render -- --render-video <folder> --animated` — TTS + captions, then Kling
     animates between consecutive keyframes (~$0.08/s) and stitches the clips under the voice +
     captions → `video/short.mp4`. **Offer the cost first** (≈ $1–3 for a few scenes).

   **motion (HyperFrames — cheapest, perfectly consistent; the default for illustration):**
   - `npm run render -- --render-video <folder> --motion --keyframes-only` generates **one base still**
     (Nano Banana Pro + consistency) and **stops** for approval.
   - Then: `npm run render -- --render-video <folder> --motion` — HyperFrames choreographs that one
     still into a silent motion visual (free, local — fetched via `npx hyperframes`, no install), and
     Kokoro voice + captions are laid on top → `video/short.mp4`. **Cost is one still (~$0.13)**; the
     motion + render are $0. (HyperFrames adds the motion, so --motion never pays per scene.)

   - **Image model is cost-first** — Riverflow (~$0.02) by default for stills/keyframes. Only add
     `--pro` (Nano Banana Pro ~$0.13) or `--hero` (gpt-5.4-image-2 ~$0.23) if Muxin asks; **offer
     first, never auto-escalate.** (Flags work on the animated path too.)
   - Add a **short** row to `review-queue.md` for `video/short.mp4` (status `pending`).
   - Add a **tiktok** row too (platform `tiktok`, format `short`, asset `video/short.mp4`,
     status `pending`) — the same render fans out to TikTok at publish (`npm run publish:tiktok`,
     caption = `video/title.txt`). Muxin approves or discards it like any other row.

6. **Stop.** Report the folder, the `short` and `tiktok` rows, and what it cost. Do not publish —
   that's `/publish`.

## --revise <folder>

Read `review-queue.md`, act on rows with status `revise` by `format`:
- **storyboard**: re-script via Grok and/or re-storyboard per the `notes` (cheap; no image/audio
  spend). Reset to `pending`.
- **short** (MP4): re-run `npm run render -- --render-video <folder>` (delete
  `images/video-*.png` first to force image regeneration past the cache). Reset to `pending`.
