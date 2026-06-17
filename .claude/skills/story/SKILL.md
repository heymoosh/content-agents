---
name: story
description: Build 2 — write and revise an original fiction series one chapter at a time, with consistency across a story bible + canon, illustrations, and a GitHub-PR review loop. Usage - /story new <notes-file|paste>, /story <series> [next|--chapter N], /story --revise <series> <chapter>, /story lock <series> <chapter>.
---

# /story — serialized fiction writer (Build 2)

Help Muxin write an original, monetized fiction series for Substack, chapter by chapter.
Muxin is the showrunner: he owns the world, the characters, and the direction. You draft the
prose (via Grok, the `prose` provider), hold consistency across chapters, and take his
per-passage feedback as **targeted edits, never full rewrites**. The reader must always want
the next chapter — that pull is the subscription engine.

## This is composed prose — and why that's allowed

Unlike Build 0/1 (extraction-first; Muxin is the author, derivatives only quote his verbatim
lines), fiction is **composed**. That is a deliberate, walled-off exception (see CLAUDE.md —
Build 2), permitted ONLY because **every chapter is reviewed and approved by Muxin on a GitHub
PR before anything publishes, and nothing auto-publishes.** Fiction is governed by
`config/fiction/*` (craft + style), NOT `config/voice.yaml` — the nonfiction PM voice and the
em-dash ban do not apply here. This exception must never bleed back into Build 1 derivatives.

## The consistency model

- `stories/<slug>/bible.md` — the living reference: world, rules, major characters, big plot
  points. Evolves freely.
- `stories/<slug>/canon.md` — append-only ledger of what's been **established** (facts, events,
  timeline, character state). The writer treats it as fixed. `story:lock` appends to it.
- `stories/<slug>/characters/<name>.md` — per-character sheets (motivation, physical tells,
  voice, arc state).
- `stories/<slug>/outline.md` — loose, evolving plot map. The plot is allowed to change.

The plot can evolve, but the **world and established facts stay consistent**. When Muxin
steers somewhere new, follow him, but don't silently break older canon — write so it still
holds, or flag the seam.

## Starting a new series — `/story new <notes-file | pasted notes>`

1. Scaffold from Muxin's notes:
   - File: `npm run story:new -- <notes-file> [--title "..."]`
   - Pasted notes: pipe via a quoted heredoc so the text passes literally:
     ```
     npm run story:new -- --text <<'STORY_EOF'
     # Title
     <the notes, verbatim>
     STORY_EOF
     ```
   It prints the series folder and seeds `bible.md` with the raw notes.
2. **Structure the notes (your judgment).** Read `bible.md`. Pull each major character into a
   `characters/<name>.md` sheet (an `## Appearance` section with the physical tells, plus
   motivation, voice, arc state). Tidy the world/rules into the bible. Seed `outline.md` with
   the plot points Muxin gave. Don't invent canon he didn't state — ask if a gap matters.
3. Confirm the setup with Muxin before writing chapter 1.

## Writing a chapter — `/story <series> [next | --chapter N]`

1. **Build the beat sheet (your judgment).** Read `bible.md`, `canon.md`, the character sheets,
   `outline.md`, and the previous chapter. Decide what THIS chapter should do: whose POV, the
   scene goal + obstacle, what question it opens, and the ending hook. Keep it inside what the
   outline/canon support; if Muxin gave direction for this chapter, use it. Write the beat
   sheet to a temp file or pass it inline.
2. **Inspect the context pack** (optional but cheap): `npm run story:context -- <series>` prints
   exactly what the model will see. Sanity-check it's coherent and not missing a character.
3. **Draft via Grok:**
   ```
   npm run story:draft -- <series> --beats <<'BEATS_EOF'
   <your beat sheet for this chapter>
   BEATS_EOF
   ```
   (or `--beats-file <path>`). This writes `chapters/chapter-NN.md` one-sentence-per-line,
   logs the cost, and prints the path. The craft + style guards (`config/fiction/*`) are
   injected automatically.
4. **QC it (your judgment).** Read the draft against `config/fiction/style.yaml`'s
   `check_before_pr`: does it open on a question, does every scene have a goal + obstacle, does
   it **end on a turn/open loop**, does anything contradict canon? Set the `title` in
   frontmatter. If it's flat or off-canon, re-draft (adjust the beats and re-run `story:draft`
   to a fresh chapter number, or edit surgically). This is where storytelling instinct lives —
   don't ship a chapter that doesn't pull.
5. **Validate:** `npm run story:validate -- <series> --chapter N` (frontmatter, one-sentence-
   per-line for clean PR anchoring, min word count). Fix violations.
6. **Open the review PR.** Commit just this chapter on a per-chapter branch and open a **draft
   PR** so Muxin can comment from his phone:
   - Branch: `story/<slug>/chapter-NN`. Commit `chapters/chapter-NN.md` (+ any sheet/outline/
     bible updates this chapter required).
   - Push, then create a **draft** PR (title `<Series> — Chapter N: <title>`). The body
     explains: this is for line-level review, comment on any line to request a change, approve
     when happy.
   - Offer to `subscribe_pr_activity` on the PR so Muxin's comments wake this session.
7. **Stop.** Report the PR link and the chapter's hook in one line. Do not publish.

## Revising from PR comments — `/story --revise <series> <chapter>` (or driven by PR events)

The feedback loop. Muxin comments on specific lines/ranges in the GitHub PR (real comment
bubbles, works on mobile). Each comment is anchored to a passage.

1. Read the PR's review comments and threads (`mcp__github__pull_request_read` with the review-
   comments method; the diff gives you the line each comment targets).
2. For **each** comment, make a **surgical edit to only that passage**:
   - Small/mechanical notes ("cut this line", "his name is Cael not Caol", "tighten") → edit the
     line(s) directly.
   - Substantive prose rewrites ("make this beat land harder", "more dread here") → re-draft
     **just that span** in voice (you may call the `prose` provider on the span with the
     surrounding context), keeping everything else byte-for-byte.
   - "Keep this" / praise → leave it exactly as is; note it so a later edit doesn't touch it.
   - **Never** rewrite unannotated text. The diff after revising should touch only commented
     lines.
3. Reply on each thread (`mcp__github__add_reply_to_pull_request_comment`) saying what you
   changed (one line), and resolve threads you've addressed. Re-run `story:validate`. Push.
4. Repeat as new comments arrive. Follow CLAUDE.md's PR-activity rules: act when confident,
   `AskUserQuestion` when a comment is ambiguous, skip true no-ops.

## Locking a chapter — `/story lock <series> <chapter>` (after Muxin approves/merges)

1. **Write the continuity entry (your judgment):** what did this chapter establish (facts,
   events, timeline, character state changes)? Pipe it into the ledger:
   ```
   npm run story:lock -- <series> <chapter> --stdin <<'CANON_EOF'
   - <fact / event established>
   - <character state change>
   CANON_EOF
   ```
   This flips the chapter `status: approved`, appends to `canon.md`, and writes
   `ready-to-paste/chapter-NN.txt` (prose reflowed into paragraphs for the Substack editor).
2. **Update character sheets** for any arc/state change (your judgment) so the next chapter
   stays consistent.
3. Tell Muxin the chapter is locked and ready to paste into Substack.

## Illustrations & promotion

- Character and scene art is the **`/illustrate`** skill (fan-art variants for social; optional
  consistent-style in-chapter art). Offer it once a chapter locks.
- To drive subscriptions, a locked chapter can feed the existing **`/atomize`** (teaser posts
  quoting a gripping excerpt + a cliffhanger line, CTA to subscribe) and **`/video`** (a short).
  Those quote the real published prose, so they stay extraction-first / on-brand.

## Model

Grok by default (`prose: grok-openrouter` in `config/providers.yaml`). Swap globally there, or
per series in `stories/<slug>/series.yaml` (`prose:`), no code change.
