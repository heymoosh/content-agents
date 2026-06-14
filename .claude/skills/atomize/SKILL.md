---
name: atomize
description: Build 1 — atomize one piece of Muxin's original content into platform assets (text, quote cards, video) and a review queue. Usage - /atomize <substack-url | file | audio-file | pasted text>, or /atomize --revise <content-folder>.
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
   - When Muxin **pastes a raw body of text** instead of a URL/file/audio path, pipe it to
     the script via stdin using a quoted heredoc so the text (backticks, `$`, quotes) is
     passed literally:
     ```
     npm run new-content -- --text <<'ATOMIZE_EOF'
     <the pasted body, verbatim>
     ATOMIZE_EOF
     ```
     The title is derived from the first `# heading` or the first non-empty line, so a
     `# Title` line at the top of the paste helps.

2. **Read the latest strategy brief** in `briefs/` (highest date). Apply its
   `Directives for atomization` — pillar priority, channel emphasis, format notes, hooks that
   worked. **Record which brief and which directives you acted on** in each derivative's
   frontmatter (`from_brief`, `directives_applied`, see step 4) — that attribution is what lets
   `/publish` log the bet and `/strategy` later grade whether it paid off. If no brief exists,
   proceed with defaults and note that in the review queue header.

3. **Tag + extract.** Identify the pillar(s) (rubric: `config/pillars.yaml`). List the 5–10
   most quotable/claimable sentences with their line numbers. Write these to
   `<folder>/extracts.md` — this is the working material for every derivative.

3.5. **Route — decide which platforms this piece is for.** Run
   `npm run route -- --pillar <pillar> --folder <folder>` (once per tagged pillar). It writes
   `<folder>/routing.md` and prints the include/skip decision per platform, informed by the
   analytics (which platforms are receptive to this pillar) plus `config/routing.yaml`. Only
   generate text derivatives in step 4 for platforms the router marked **`include`**; do not
   produce assets for `skip` platforms — the point is to post where it makes sense, not
   everywhere. If the piece spans two pillars, run the router per pillar and include a platform
   if **either** pillar includes it. Layer the strategy brief (step 2) on top: the brief may
   tighten further, but don't re-add a data-skipped platform without a stated reason.
   Cold-start platforms come back `include` with low confidence — that's expected; routing
   tightens as data accrues.

4. **Generate text derivatives** into `<folder>/derivatives/` per `config/platforms.yaml`
   (counts and style there), **only for the platforms `routing.md` marked `include`**:
   - `x-1.md … x-5.md`, `linkedin-1.md`, `bluesky-1.md` — skip any of these whose platform the
     router excluded (e.g. no `linkedin-1.md` if LinkedIn was skipped for this pillar).
   - Community variants ONLY where routing **and** the brief agree there's a reason to post,
     e.g. `community-democratic-resilience.md`. Respect `config/platforms.yaml` community notes
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
     from_brief: briefs/2026-06-14-strategy-brief.md   # the brief whose directives shaped this (or omit if none)
     directives_applied: [prioritize_pillar:claude-code, format:short-single]  # which directives you acted on
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

8. **Queue for review.** Ensure `<folder>/review-queue.md` has one row per asset that was
   generated — i.e. only routing `include` platforms plus the format assets
   (id, platform, format, asset path, scores, status=pending). Then STOP. Do not publish.
   Tell Muxin: the folder path, asset counts, which platforms routing skipped (and why, per
   `routing.md`), and anything else skipped. If Muxin wants a skipped platform anyway, they can
   say so (or adjust `config/routing.yaml`) and you'll generate it.

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
