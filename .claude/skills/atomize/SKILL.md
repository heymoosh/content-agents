---
name: atomize
description: Build 1 — atomize one piece of Muxin's original content into cheap platform assets (text posts + quote cards) and a review queue. Proposes cut/version options from the same inspiration before formatting anything (step 1.5) — every cut's text is Muxin's own; Muxin approves a set conversationally, then each cut atomizes independently. Video shorts are a separate skill — /video. Usage - /atomize <substack-url | file | audio-file | pasted text>, /atomize notes (spread your Substack Notes), /atomize --no-spin <arg> (strict verbatim, no audience spin), /atomize --continue <content-folder> [--cut <lens>] (resume steps 2-8 on an already-scaffolded folder or cut), or /atomize --revise <content-folder>.
---

# /atomize — content atomization pipeline

Turn ONE piece of Muxin's original content into platform-specific assets, scored and queued
for review. Muxin wrote the thinking; you package it.

**Scope:** `/atomize` handles the **cheap, high-volume** derivatives — text posts and quote
cards — so you can run it on everything. Turning a piece into a **video short is the separate,
deliberate `/video` skill** (script → storyboard → review → render); it's heavier and costs
real money, so it's opt-in per piece, not bundled here.

## The extraction-first rule (non-negotiable)

- Derivatives are built from **verbatim sentences** in the source. You may trim, tighten, and
  reformat for the platform. You may NOT compose new claims, arguments, metaphors, or
  worldview statements in Muxin's voice.
- Every derivative carries `source_lines` frontmatter listing the source.md line numbers its
  text came from. If you can't point at lines, you wrote it — delete it.
- If the source is too thin to atomize honestly, say so and stop. Do not pad.

**Spin rides on top of this rule; it does not replace it.** Since 2026-07-02 Spin is the
always-on default for every atomize run: no flag needed. Each derivative for a platform with a
Muxin-approved angle in `config/platforms.yaml` `spin_angles` (x, linkedin, bluesky) is reframed
through that channel's angle. Spin may re-angle the framing, hook, and register, but it may NEVER
invent a claim, statistic, metaphor, or worldview Muxin did not express. `source_lines` tracing
still applies (best-effort on spun derivatives: point at the lines and ideas you drew from). Read
`references/spin-mode.md` before drafting. The opt-out is `/atomize --no-spin`, which produces
strict verbatim extraction with no reframing.

## Voice & AI tells (non-negotiable — CLAUDE.md rule 5)

Read `config/voice.yaml` before you draft or edit ANY text below. It applies to every
derivative, the video script, and the video title/description. The short version:

- **No em dashes.** Normalize them to periods, commas, colons, or parentheses. This holds even
  for verbatim extractions: keep Muxin's words, change the dash. (Muxin's source essays use em
  dashes; the published derivatives must not.)
- **No AI tells:** "here's the thing", "it's not just X, it's Y", "let's unpack", "delve",
  "leverage", "unlock", rhetorical-question hooks, emoji bullets, reflexive triads. See the full
  banned list in `config/voice.yaml`.
- Muxin sounds like a working PM thinking out loud: plain, direct, specific, contrarian when
  earned, never performing. Read each draft aloud before queueing it.

## Cut-aware steps

Steps 2-8 below read as if there's one source. When step 1.5 approved more than one cut, run them
once per additional cut, substituting throughout:
- "the source" / `source.md` → that cut's `cuts/<lens>/cut.md` (its body is the drafting material,
  same role `source.md`'s body plays for `extract`).
- `<folder>/derivatives/` → `<folder>/cuts/<lens>/derivatives/`.
- A queue row's id gets the lens prefix: `cutRowId(lens, id)` (`src/publish/queue.ts`) — e.g.
  `short/x-1` for a cut whose lens is `short`, so it's traceable to its cut without a table schema
  change (the `extract` cut is never prefixed, matching every id written before cuts existed).
`npm run validate -- <folder>` already scans every cut automatically (`collectDerivativeTargets`
in `src/atomize/validate.ts`) — one call validates all of them, not one call per cut. `routing.md`
and source-triage facts stay ONE set per content folder, shared by every cut — they all trace back
to the same `source.md` and the same platform-fit decision.

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

1.5. **Propose and approve cuts (Stage 1 — plan i-want-to-add-mellow-mist).** Before anything gets
   formatted per platform, decide which *versions* of this piece are worth drafting from the same
   inspiration. This is a conversational discussion stage, not a review/approval gate — nothing
   here is "queued," nothing publishes.
   - Propose the applicable versions with a one-line rationale each: `extract` (Muxin's own
     verbatim lines, today's default — always applicable), and any additional version whose text
     Muxin supplies (an alternate draft he wrote, a shorter rework, a different framing in his own
     words). **A non-extract cut's text is always Muxin's — never composed by a lens or skill**
     (extraction-first, CLAUDE.md rule 1; there is no compose exception here). When the topic
     suits his brand frame, you may *offer* "want angles first? run `/brand-lens`"
     (`.claude/skills/brand-lens/SKILL.md`) — it proposes angles he might write from; it never
     drafts a cut, and it never auto-runs.
   - Preview each chosen cut's *core content* (not yet platform-formatted): for `extract`, this is
     the 5-10 quotable lines step 3 below would tag anyway, previewed as prose; for any other
     lens, it's the Muxin-authored text that version will be built from.
   - Show Muxin each draft and iterate cut-by-cut — in chat ("this one's good, change that one"),
     and/or via `npm run review`'s Cuts tab (`src/review/` — a side-by-side proof-sheet view with
     inline edit and anchored comments; see the plan file's "Stage 1 UI: the Proof Sheet" section)
     if it's running. Keep iterating until Muxin approves a set of one or more cuts.
   - Once approved: `extract` needs no extra scaffolding — it's today's top-level `source.md` /
     `derivatives/` layout, continue straight into step 2. Any OTHER approved lens gets scaffolded
     via `addCut()` (`src/atomize/cuts.ts`): `addCut(folderDir, { lens, title, text })` writes
     `cuts/<lens>/cut.md` + `cuts/<lens>/derivatives/`. Then run steps 2-8 again, once per
     additional approved cut, pointed at that cut instead of `source.md` (see "Cut-aware steps"
     below) — equivalent to `/atomize --continue <folder> --cut <lens>`.
   - This step never blocks generation the way a hard gate would — if Muxin only wants `extract`
     (today's behavior), say so and skip straight to step 2 with zero cuts/ overhead.
   - The review GUI's **Develop tab** is this step's headless counterpart (`/develop`,
     `.claude/skills/develop/SKILL.md`): the advisor proposes angle cards there, and an accepted
     angle arrives here already scaffolded via `addCut()` (its body assembled server-side from
     Muxin's verbatim `source.md` lines). Its "Format for platforms" button then runs
     `/atomize --continue <folder> [--cut <lens>]`, picking up from step 2 exactly as below.

2. **Read the latest strategy brief** in `briefs/` (highest date). **Propose** applying its
   `Directives for atomization` — pillar priority, channel emphasis, format notes, hooks that
   worked — as an opt-in at step 1.5 or here, rather than always silently applying them: name which
   directive(s) look relevant to this piece and ask before acting on them. **Record which brief and
   which directives Muxin accepted** in each derivative's frontmatter (`from_brief`,
   `directives_applied`, see step 4) — that attribution is what lets `/publish` log the bet and
   `/strategy` later grade whether it paid off, and it is only ever stamped for a directive Muxin
   actually accepted, never one you applied silently. If no brief exists, or Muxin declines every
   directive, proceed with defaults and note that in the review queue header.

2.5. **Source triage — classify the source once** (`src/atomize/source-triage.ts`, card b288d0da).
   Before drafting or routing anything, judge which ONE of three buckets this source falls into.
   This is a classification, not composition — you're sorting the piece Muxin already wrote, never
   inventing a claim about it:
   - **`frame-native`** — carries a testable belief / "the move": a claim or case worth the
     LinkedIn/X case-skeleton treatment (see step 4's beat templates). The default when the source
     doesn't clearly read as one of the other two buckets.
   - **`reflective`** — personal/reflective register, no testable belief or case to make (worked
     examples: "What AI Cannot Reach", "More than Bread"). Native to Substack + Bluesky only —
     NO skeleton ever, and excludes the LinkedIn case format and X's compressed-case treatment
     from the platform subset entirely.
   - **`fiction-promo`** — a Build 2 fiction teaser/promo piece linking to `stories/`. Stays in
     the existing extraction-first cliffhanger style; never framed. Its platform subset is
     otherwise unrestricted (pillar-driven routing still decides that normally).

   Also judge whether the source contains a clear "beat 2"-style belief statement: a literal
   quoted assumption, in the holder's own words, that a stranger could picture (see
   `config/platforms.yaml` `spin_angles.linkedin.angle`'s Beat 2 definition for the exact bar).
   This is informational only — it flags essays that lack "the move" so Muxin learns the pattern
   over time. It never blocks anything and never changes the bucket above.

   Also judge, separately, whether THIS source contains a real, anonymize-able THIRD-PARTY case —
   a team/client situation (not Muxin's own story), with enough concrete detail (a situation, a
   quoted assumption, a cost) to extract into the LinkedIn/X case-skeleton beats (card f7b186c2).
   This is narrower than the beat-2 check above: a source can have a quotable belief statement
   built entirely from Muxin's own autobiographical material and still have no third-party case to
   extract (this is exactly what happened to PR #185's sample). Extraction-only and CONDITIONAL:
   never force or invent a case when one isn't really there — `--case not_found` is a legitimate,
   expected outcome, and a derivative then falls back to the essay's own argument instead of the
   case-skeleton beats. `validate.ts`'s `checkCaseGate` code-enforces this: a derivative can only
   declare `case_skeleton: true` (step 4) when you recorded `--case found` here, so getting this
   judgment right up front is what makes step 4's case-skeleton option available at all.

   Record all three as facts in `source.md` — you do the judgment, this writes it, and every
   downstream step (route.ts, validate.ts, this skill's own step 4) reads those facts instead of
   re-deciding them:
   ```
   tsx src/atomize/source-triage.ts <folder> <frame-native|reflective|fiction-promo> [--beat2 found|not_found] [--case found|not_found]
   ```
   It prints the one-line confirmation (`triageSummary()`'s exact text, e.g. `reflective ->
   Substack + Bluesky only, no frame (LinkedIn case format and X excluded)`) plus either flag line
   if raised — relay all of it to Muxin as part of your normal output so she can confirm the calls
   before you draft anything, one judgment pass per piece. If she disagrees, re-run the same
   command with the corrected values; it's idempotent (re-triaging replaces the recorded facts,
   never duplicates them).

   This must be written before step 3.5's `route` call and step 4's drafting: `route.ts --folder`
   reads it to force-exclude a `reflective` source's LinkedIn/X platforms, and `npm run validate`
   (step 6) hard-fails any derivative that still carries the LinkedIn/X case-skeleton beat
   treatment (`spin: true` + `angle: linkedin|x`) on a `reflective` or `fiction-promo` source — so
   drafting one for an excluded bucket is wasted work, not just a lint fix later.

3. **Tag + extract.** Identify the pillar(s) (rubric: `config/pillars.yaml`). List the 5–10
   most quotable/claimable sentences with their line numbers. Write these to
   `<folder>/extracts.md` — this is the working material for every derivative (and for `/video`
   later, if this piece becomes a short).

3.5. **Route — decide which platforms this piece is for.** Run
   `npm run route -- --pillar <pillar> --folder <folder>` — pass **all** tagged pillars in ONE
   call, comma-separated (e.g. `--pillar civic-tech,human-ai`), not one invocation per pillar.
   The router merges across pillars itself (include if *either* pillar includes it, unless
   *any* pillar's `config/routing.yaml` `never` rule vetoes it — that veto is a hard stop no
   other pillar's include can override) and writes ONE `<folder>/routing.md`. Re-running route
   overwrites the file, so don't call it twice for the same folder.
   Only generate text derivatives in step 4 for platforms the router marked **`include`**; do
   not produce assets for `skip` platforms — the point is to post where it makes sense, not
   everywhere. This is a hard gate, not just a convention: **`npm run validate` (step 6) fails
   outright if a derivative exists for a platform routing.md marked `skip`** — if that happens,
   discard the derivative, don't relax the check. Layer the strategy brief (step 2) on top: the
   brief may tighten further (e.g. a DO LESS directive), but don't re-add a data-skipped
   platform without a stated reason — and if a category should durably never post to a given
   platform (e.g. "this data doesn't support X as a political platform"), encode it as a
   `rules.<pillar>.never` entry in `config/routing.yaml` rather than a one-off skip, so the gate
   holds on every future piece in that pillar, not just this one. Cold-start platforms come back
   `include` with low confidence — that's expected; routing tightens as data accrues.
   **Exploration probe (card 92bb2ae6):** if the latest strategy brief's [TEST] recommendations
   name an off-assignment platform + pillar probe still due this month, and this piece's tagged
   pillar matches, add `--explore <platform>` to the same route call (e.g.
   `--pillar civic-tech --explore linkedin --folder <folder>`) to force that ONE platform's
   decision to `include` for this piece only, even though `config/routing.yaml` doesn't default
   it there. Draft that platform's derivative same as any other in step 4, but stamp its
   frontmatter `exploration_probe: true`. Everything else about the piece (other platforms,
   scoring, review) is unaffected.

4. **Generate text derivatives** into `<folder>/derivatives/` per `config/platforms.yaml`
   (counts and style there), **only for the platforms `routing.md` marked `include`**:
   - `x-1.md … x-5.md`, `linkedin-1.md`, `bluesky-1.md` — skip any of these whose platform the
     router excluded (e.g. no `linkedin-1.md` if LinkedIn was skipped for this pillar).
   - Community variants ONLY where routing **and** the brief agree there's a reason to post,
     e.g. `community-democratic-resilience.md`. Respect `config/platforms.yaml` community notes
     (ABC Builders: observe-only unless brief says otherwise).
   - Quote cards are made in **step 7** (a verbatim quote line `quote-card-N.md` that renders the
     image, plus a spun per-platform CONTEXT caption per routed channel) — not here.
   - File format:
     ```markdown
     ---
     platform: x            # x | linkedin | bluesky | community | quote-card
     option: 1
     source_lines: [12, 31-33]   # hard-required on verbatim; best-effort (the ideas drawn from) when spin: true
     spin: true             # the default for platforms with a spin_angles entry; omit on --no-spin runs
     angle: x               # the config/platforms.yaml spin_angles key applied; must equal `platform` (see references/spin-mode.md)
     scores: { native: 4, brand: 5, hook: 4, narrative: 3, resonance: 3, cta: true }
     thread_check: pass     # pass | missing — stamped in step 5.5, after scoring
     thread_spin_applied: true   # only present once the step 5.5 fallback redraft ran
     content_type: [essay_excerpt]   # 1+ of the 8 keys in config/content-types.yaml — classifies what job this post does; drives its CTA(s) at publish time (step 4.5). Omit ONLY when setting an explicit cta override below.
     project_url: https://example.com/my-project   # OPTIONAL, per-post: only set when Muxin confirmed a SPECIFIC project genuinely relevant to THIS post's content (step 4.5 — ask her, never guess/reuse a project just because the content type matched). Omit when she has none or none applies — that CTA line is simply dropped, never defaulted to the essay link or an unrelated project.
     cta: source            # OPTIONAL override: source | <literal-url> | none — wins over content_type when set (e.g. civic-tech's voting-tool link, or a deliberate none). Omit to let content_type drive the CTA.
     cta_label: "Full essay (free to subscribe):"   # with an explicit cta override, this is its label. With content_type instead (no explicit cta), this OPTIONALLY overrides just the work_with_me line's text on the 4 work-flavored types (card d2746598, step 4.5) -- a tactical, source-topic-tied line instead of the generic "Connect on LinkedIn." Omit to keep the generic default; other stacked CTA lines (source/project) are never affected by it.
     from_brief: briefs/2026-06-14-strategy-brief.md   # the brief whose directives shaped this (or omit if none)
     directives_applied: [prioritize_pillar:claude-code, format:short-single]  # which directives you acted on
     control_run: true      # only on the one derivative drafted for a due spin-control pick (card f444f440); omit otherwise
     exploration_probe: true   # only on the one derivative routed via step 3.5's --explore flag (card 92bb2ae6)
     outreach_message: true   # only when source.md carries `source_kind: outreach-message` (new-content.ts's resolveFileSource, from a LOCKED /outreach message) — propagate it onto every derivative drafted from that source; src/db/tag-source.ts reads it to tag the shipped post 'atomized-outreach'. Omit otherwise.
     case_skeleton: true    # ONLY on a linkedin/x derivative drafted under the case-first beat template (references/spin-mode.md), AND only when step 2.5's source-triage recorded --case found for this source. If --case found is not on record, do NOT set this and do NOT use the beat template — fall back to normal (non-case) extraction/spin instead (validate.ts's checkCaseGate hard-gates this; never fabricate a case to force the fit). Omit entirely on every other derivative.
     ---
     <the post text — nothing else>
     ```
   - **Apply the channel's spin angle by default.** For each platform with a `spin_angles`
     entry in `config/platforms.yaml` (x, linkedin, bluesky), reframe the derivative through
     that approved angle and mark it `spin: true` + `angle: <platform>` per
     `references/spin-mode.md`. This includes a quote card's per-platform context captions (step 7).
     What stays verbatim with no spin frontmatter: the quote-card DEFINITION line (the image quote),
     community variants, and anything with no `spin_angles` entry. On a `--no-spin` run, skip all of
     this and draft every derivative verbatim.
   - **Spin-control run (card f444f440):** if the latest strategy brief's `[TEST]` recommendations
     name a pillar + platform pair with a control run still due this month, and this piece's
     tagged pillar matches, draft ONLY that one platform's derivative verbatim (no `spin: true`,
     no `angle`) even though every other routed platform for this same piece still gets its normal
     spin treatment. Stamp that one derivative's frontmatter `control_run: true` so `/publish`
     records it as a control run (see `src/publish/queue.ts`'s `appendBetPlacement`) and it gets
     excluded from the pillar/platform resonance figures instead of counted as a normal spin-on or
     verbatim post.
   - **Every platform gets the storytelling re-hook/re-order pass** (Muxin, 2026-07-04, widened
     from X/LinkedIn-only to all platforms 2026-08-22), still inside the same never-invent
     guardrail, not a new license: lead with the strongest existing line (drop throat-clearing like
     "What I described in my essay..."), re-order for a narrative arc instead of a list of facts,
     and do NOT trim concrete personal specifics that ARE the story. A platform can opt back out
     with `rehook: false` in `config/platforms.yaml` (only `quote-card` does today). Any
     Notes-sourced derivative (`source_kind: substack-note` in source.md) stays near-verbatim on
     every platform; that source carve-out is unchanged. See `references/spin-mode.md` for the
     worked before/after and `appliesRehook()` in `src/atomize/spin.ts` for the platform/source
     gate.
   - **The full-post shape library is `references/post-patterns.md`**, the arc-after-the-hook
     companion to `references/hook-patterns.md`, filed by platform and written by
     `/patterns synthesize`. It ships EMPTY: until a synthesis run has landed, every platform
     section there reads "Not yet mined", and while a section is empty drafting falls back to
     `references/hook-patterns.md` and the channel's `spin_angles` entry. An empty section is never
     permission to invent a structure and call it proven.
   - **Civic and social-issues material additionally follows
     `references/civic-adaptation.md`** (Muxin's own rubric, 2026-08-22): concrete pain-or-outcome
     hook, an immediate personal payoff the reader gets or avoids right now, everyday local
     language over abstract "democracy" talk, and one specific next action. It says WHAT the piece
     must deliver; `references/hook-patterns.md`'s joyful-activism default (patterns 16-23) says in
     WHICH REGISTER. They stack. Both still sit under the extraction-first rule: the rubric's
     example lines are shapes, never copy.
   - Text derivatives are ALWAYS Claude-authored and extraction-first. Do NOT pass them
     through `text-polish` — that provider (Grok) is reserved for video scripts, which now live
     in the `/video` skill.

4.5. **Classify the content type(s) and let the CTA follow** (`config/content-types.yaml`, card
   6dcaee98 "Smarter routing"). The funnel: convert rented attention into owned audience — but the
   CTA text now depends on WHAT the post is about, not which pillar it's tagged. For each text
   derivative, judge which of these 8 content types it plausibly is (one, or more than one — don't
   force a single choice when it genuinely fits several):
   - `essay_excerpt` — expands/quotes a Substack essay's argument.
   - `society_capitalism_piece` — a broader society/capitalism worldview post.
   - `ai_agency_thesis` — the AI-agency thesis specifically.
   - `personal_career_reflection` — personal reflection not tied to a project.
   - `product_builder_insight` — diagnoses a builder/product problem, or shares how you think/work.
   - `project_demo` — shows off a specific project/tool/system/build process.
   - `offer_adjacent_post` — reads like an implicit "work with me" pitch.
   - `case_study` — a concrete before/after or project case study.

   Stamp every type that plausibly applies as `content_type: [<key>, ...]` (a single-item array is
   fine and the common case). `src/publish/cta.ts`'s `resolveContentTypeCtas()` resolves the
   actual CTA text at PUBLISH time from `config/content-types.yaml` — you never hand-pick CTA copy
   here. It stacks every matched type's CTA(s) as separate lines (a post matching 2 types gets
   both, never one winner).
   - **`project`-destination CTAs need a `project_url` you supply — and it must be genuinely
     RELEVANT, never just any project Muxin has built.** `product_builder_insight`, `project_demo`,
     and `case_study` (plus the optional secondary on the other four types) resolve to a `project`
     link. That link is only correct when THIS SPECIFIC derivative's content actually discusses,
     demonstrates, or is about that particular project — the content-type bucket alone (e.g. "this
     reads like builder insight") does NOT tell you which project, or whether one applies at all.
     Never invent that connection yourself (the same never-invent guardrail as extraction-first
     text) — if the source material doesn't make the relevant project obvious, ASK MUXIN DIRECTLY:
     "This looks like it could link to a specific project — is there one that's actually relevant
     here, and if so what's the URL?" Stamp `project_url` only with what she gives you. If she has
     none, or none is genuinely relevant to this post, omit `project_url` entirely — that CTA line
     is simply dropped, never filled with an unrelated project just to have a link.
   - **The 4 work-flavored types resolve to Muxin's LinkedIn profile by default — but on
     LinkedIn especially (X to a lesser degree, card d2746598), give that line a TACTICAL,
     source-topic-tied `cta_label` instead of leaving it generic.** `product_builder_insight`,
     `project_demo`, `offer_adjacent_post`, and `case_study` are fundamentally "connect for work"
     asks, so their non-project entry resolves to Muxin's LinkedIn profile (a fixed config value),
     never the essay/Substack link — that part is automatic, you never set the URL. What you DO
     set (optional, `cta_label` frontmatter — the same field the literal-`cta` override already
     uses) is the LINE ITSELF: something the reader could apply RIGHT NOW, tied to THIS post's
     actual insight, not a generic "Connect on LinkedIn." Michael Callaway principle: content
     converts to leads/clients by being unique AND useful, not by asking harder. Two rules:
     - **Tactical, not a pitch.** Good: "Ask your team which assumption nobody's tested this
       quarter." Bad/cringy: "DM me to see how I can help your team," "Book a call to learn more,"
       any line that reads as a sales ask rather than something the reader does with THIS post's
       idea before ever talking to Muxin. The soft-availability-close pattern already in
       `spin_angles.linkedin`'s beat 5 (`references/spin-mode.md`) is the tone to match: a
       diagnostic signal ("this is the kind of thing I look for"), not a call-to-action.
     - **Omitting it is always fine.** No tactical line occurs to you naturally from this specific
       post → leave `cta_label` unset. The prior generic "Connect on LinkedIn" text is still there
       as the default; it is never worse than before this card, only improvable when a real
       tactical line fits. Never force one to avoid leaving it blank — a forced line is worse than
       the generic default, not better.
     - This only overrides the work_with_me line's text — a stacked `project`-destination entry
       (e.g. `product_builder_insight`'s primary "See how I think/work") keeps its own config text
       regardless; `cta_label` here targets the connect-for-work ask specifically, same as it
       always has for the literal-`cta` override path above.
   - **The literal-URL override still exists, and still wins.** Civic-tech pieces (and community
     rooms posting civic content) keep pointing at the voting tool exactly as before: set
     `cta: <voting-tool-url>` (+ `cta_label`) directly and skip `content_type` — an explicit `cta`
     always wins over a `content_type` classification. Same for a derivative that shouldn't carry
     a "go read" invite at all (`cta: none`), or any other literal-url case.
     - **Civic CTAs now have to clear a bar (`references/civic-adaptation.md`, Muxin 2026-08-22).**
       The mechanics above are unchanged; what goes in them is stricter. A civic CTA has TWO
       accepted forms, and this is the first of them: a SPECIFIC micro-action the reader can
       finish in under 5 to 10 minutes (check
       registration status, look up one race on the next ballot, find a polling place, read one
       local measure in plain English), not "vote," "get involved," or "stay informed." It must
       point at something REAL: never invent a link, form, deadline, race, or ballot measure. If
       the specific thing can't be verified, fall back to the plain voting-tool default rather than
       fabricating a specific one. Same never-invent guardrail as the `project_url` rule above.
     - **Belief- or value-aligned matching is the other accepted civic CTA form** (same rubric,
       table 2). Muxin's words for it: "Based on what you said you care about, here's how these
       candidates actually voted on X." It clears the bar the same way a micro-action does, and it
       carries one extra requirement: it must be NEUTRAL and RECORD-BASED, built on an actual vote
       or an actual position on the record, never a partisan characterization of a candidate, a
       party, or a side. If the record can't be verified, don't write it at all, don't write it
       with a caveat, and fall back to the plain voting-tool default. That harder rule is
       deliberate, not an oversight: a wrong claim about how someone voted is a factual assertion
       about a real person, not a soft guess, and it's exactly the invented proof rule 1 forbids.
   - **Never write the link into the post body** — `/publish` places it per platform from
     `cta.yaml` `placement` (X → first reply, LinkedIn → first comment, Bluesky/community →
     inline), so the body stays clean and dodges the in-post link penalty. Stacked CTA lines
     render as one block (blank line between each) wherever a single CTA would have gone. Each
     per-platform card caption gets the same treatment (classify its `content_type` same as the
     parent derivative, or set an explicit `cta` override); `publish:cards` places it INLINE on
     inline platforms (Bluesky/LinkedIn) and OMITS it where placement is `reply` (X), since the
     image relays can't post a reply. Set a caption's `cta` to `none` only to deliberately ship it
     link-free. Donations are never the headline ask; the default CTA is "come read / subscribe"
     (or whatever the classified content type's own text says).
   - **Check `canonical_url`.** If source.md has no `canonical_url` (a local draft, not yet
     published), tell Muxin to paste the published essay URL into source.md before `/publish` —
     otherwise any `source`-destination CTA link falls back to the Substack home instead of the
     essay.

5. **Score honestly** (the frontmatter `scores`):
   - `native`: does this read like a real human post on that platform? (1–5)
   - `brand`: does it represent human-centered AI values? (1–5)
   - `hook`: does the opening line grab attention? (1–5)
   - `narrative`: is there an arc — a beginning that sets something up and an ending that pays it
     off — rather than a list of facts? (1–5)
   - `resonance`: does it state a felt truth people react to? (1–5) This is NOT "does it ask for
     engagement" — asking for engagement is banned as inauthentic (never ask; engagement is a
     byproduct of resonance, not a request).
   - `cta`: does it point somewhere useful? (true/false — CTA is optional, not mandatory)
   - Score 1–2 on native/brand → discard it yourself rather than queueing junk.
   - **Storytelling is a soft gate, never a hard one.** A derivative scoring `<= 3` on hook,
     narrative, or resonance still queues — but append `spinPassNote()`'s exact text
     (`src/atomize/storytelling.ts`, e.g. `flag: spin pass suggested (low: hook, resonance)`) to
     its review-queue.md `notes` cell (step 8) so Muxin sees it needs a Spin re-hook pass, not a
     rewrite of the table schema. A high-scoring derivative gets no flag.
   - **Practical angle and CTA stay conditional, never scored requirements** (Muxin, 2026-06-30
     DECISION): present them only when genuinely warranted by the source. Never manufacture a
     takeaway or CTA that isn't there.

5.5. **Home-brand thread-check** (`config/platforms.yaml` `home_brand`; see `docs/thread-check.md`).
   Judge — same inline-judgment pattern as pillar/spin/scores above — whether the derivative
   connects back to the home-brand worldview line ("I uncover harmful hidden beliefs and why
   they need to change before AI automates everything"). The operational test is NOT "is this
   about AI" — it's whether the piece touches one of `home_brand.signals` (an unexamined human
   system/assumption, who benefits or is harmed, or building/shipping the right thing). Stamp
   the verdict into frontmatter: `thread_check: pass` if it connects.
   - **If missing:** first try genuinely tightening the piece's own framing to draw out the
     connection already latent in Muxin's argument (a real redraft, in her voice — never invent
     a new claim). If that doesn't land, fall back to `draftThreadIn()`
     (`src/atomize/thread-check.ts`) as a safe deterministic patch: it weaves
     `home_brand.worldview_expanded` onto the body as a closing line (idempotent) and returns
     `{ thread_check: "pass", thread_spin_applied: true }` — apply that frontmatter patch.
   - **Never a hard gate.** If a piece still doesn't connect after a redraft attempt, leave
     `thread_check: missing` and queue it anyway (step 8) — surface/suggest only, exactly like
     every other score here. Append `threadCheckNote()`'s exact text (`src/atomize/thread-check.ts`,
     `flag: home-brand thread-check missing`) to its review-queue.md `notes` cell (step 8) so
     skimming the raw markdown itself surfaces it too, not just the frontmatter and the GUI badge —
     same notes-cell pattern as the storytelling soft gate above. A passing piece gets no flag.

6. **Validate.** `npm run validate -- <folder>` — must pass before queueing. Fix violations,
   don't relax limits. (Validation enforces char/word limits for every derivative, requires
   `source_lines` except on `spin: true` derivatives where it's best-effort, requires every
   `spin: true` derivative to carry an `angle` that matches its own platform's `spin_angles`
   entry, and hard-fails any derivative drafted for a platform routing.md marked `skip` — the
   platform-fit gate from step 3.5; see `references/spin-mode.md`.)

7. **Generate the quote-card asset(s)** (cheap, extraction-first). A card is a bare-quote IMAGE
   shared across platforms, each with its OWN per-platform CONTEXT caption — so the quote never
   ships alone, out of context (Muxin, 2026-07-03). Three parts per card N (plus an optional
   quote+image variant, part d):

   a. **Definition derivative** `derivatives/quote-card-N.md` — the verbatim quote line that goes
      ON the image. `platform: quote-card`, `source_lines: [<the quote's line>]`, no spin, body =
      the quote (≤180 chars). This is NOT a posting row; it only drives rendering.
   b. **Render it:** `npm run render -- --still <folder> --quote quote-card-N` → writes both
      `images/quote-card-N.png` (still) and `images/quote-card-N.mp4` (animated companion).
   c. **Per-platform context captions** `derivatives/quote-card-N-<target>.md`, one for EACH routed
      text platform (x / linkedin / bluesky that routing marked `include`). Each is a normal spun
      text derivative — `platform: <target>`, `spin: true`, `angle: <target>`, best-effort
      `source_lines` (the lines AROUND the quote), `cta`/`cta_label` — whose body is the CONTEXT
      that frames the quote: the setup, mechanism, or stakes drawn from the surrounding source
      lines. **Context only: never repeat the quote that's already on the image.** Same spin
      guardrails as any text post (reframe through the channel angle, never invent a claim). On a
      `--no-spin` run, write the caption verbatim (no `spin`/`angle`, `source_lines` hard-required)
      — still context-only. Char limit is the TARGET platform's (X 280, etc.), enforced by validate.
   d. **Optional quote+image variant.** Distinct from the typographic-only card above (which stays
      the default and is unaffected) — the SAME verbatim quote composited over a generated
      illustration, for when the piece has a strong visual concept worth the extra render. Write
      `derivatives/quote-card-N-image-prompt.txt` — ONE line, an image concept prompt drawn from
      the source content (Claude's judgment, same spirit as how video B-roll visual prompts are
      drafted from storyboard scenes in `/video` — a visual concept, not new text in Muxin's
      voice, so it doesn't touch the extraction-first rule for the quote itself). Then render with
      the same command plus one flag: `npm run render -- --still <folder> --quote quote-card-N
      --with-image` → writes `images/quote-card-N-image.png` (the composited card) alongside the
      raw generated illustration `images/quote-card-N-bg.png`, without touching
      `images/quote-card-N.png`/`.mp4` from part b. Skip this part entirely unless the piece calls
      for it; when you do use it, add its own review-queue row (step 8) pointing at
      `images/quote-card-N-image.png` instead of the typographic PNG — same image model policy
      (below) applies. If the latest brief's `Directives for atomization` `media_mix` list names
      this piece's platform as lean-toward-`quote-card` (strategy lever B, card 27dc7d2d), weigh
      that alongside the "strong visual concept" call above — a data point, not a rule; the
      variant stays Claude's judgment either way.

   Then add one review-queue row per caption (step 8): `quote-card-N-<target> | quote-card:<target>
   | image | images/quote-card-N.png | …`. `publish:cards` posts the shared image to that one
   platform with that platform's caption, and records the placement under the real destination
   platform so `tag-source` / `origin-compare` measure how each channel's card did.

   - **Image model policy — cost-first, escalate only on request, NEVER automatically.** Default
     is **Riverflow** (~$0.02). If Muxin dislikes a result, do NOT silently switch to a pricier
     model — **offer first**: *"we can try a different prompt on Riverflow, or step up to a more
     expensive model."* Only on his yes, re-render with `--pro` (Nano Banana Pro ~$0.13) or
     `--hero` (gpt-5.4-image-2 ~$0.23). (Free option for flat conceptual spots: hand-author an
     SVG → `remotion-svg` path / `/bakeoff`.)

   The **animated companion** (`images/quote-card-N.mp4`, from step 7b) reuses the SAME per-platform
   context caption when posted as a native video, so the out-of-context fix applies to both.
   **Video shorts are a separate skill.** `/atomize` no longer scripts or renders video — that keeps
   it cheap (text + quote cards). To turn this piece into a short, run **`/video <folder>`**
   (script → storyboard → review → render).

8. **Queue for review.** Ensure `<folder>/review-queue.md` has one row per asset that was
   generated — the routing `include` text platforms, plus ONE `quote-card:<target>` row per routed
   platform for the card (each pointing at the shared `images/quote-card-N.png`, caption from its
   own `quote-card-N-<target>.md`). (id, platform, format, asset path, scores, status=pending,
   origin). On a cut other than `extract` (see "Cut-aware steps" above), the id is `cutRowId(lens,
   id)` and the asset path is under `cuts/<lens>/derivatives/` or `cuts/<lens>/…` — every row for
   every cut lands in the SAME `review-queue.md`, one table, no separate queue per cut. The table schema itself doesn't grow a storytelling or thread-check column
   (`native(1-5)` / `brand(1-5)` / `cta` stay as-is — three separate scripts parse that table by
   fixed column position, see `src/publish/queue.ts`); instead, a derivative flagged by step 5's
   soft gate gets `spinPassNote()`'s text appended to its row's `notes` cell, and one still
   `thread_check: missing` after step 5.5's redraft attempt gets `threadCheckNote()`'s text
   appended too (both can appear on the same row, e.g. `flag: spin pass suggested (low: hook);
   flag: home-brand thread-check missing`).
   - **Origin tag (10th column).** Every row gets an `origin` cell so the review GUI can show
     which pipeline produced it (`src/publish/queue.ts` `QUEUE_ORIGINS`). Check whether this
     invocation set the `ATOMIZE_ORIGIN` environment variable (run `echo $ATOMIZE_ORIGIN`): if it
     prints `gui-queue`, write `from GUI queue`; otherwise (an ordinary `/atomize` run, including
     one driven by `/cycle`) write `from /cycle`. Never write `reply to mention` here — that value
     belongs to the not-yet-built inbound-reply pipeline (see the backlog card "Inbound listening +
     voice-replies").
   Then STOP. Do not publish.
   Tell Muxin: the folder path, asset counts, which platforms routing skipped (and why, per
   `routing.md`), any derivative flagged for a Spin pass on storytelling, and anything else
   skipped. If Muxin wants a skipped platform anyway, they can say so (or adjust
   `config/routing.yaml`) and you'll generate it. If the piece is a good candidate for a short,
   mention they can run `/video <folder>` — and if the latest brief's `Directives for atomization`
   `media_mix` list names one of this piece's routed platforms as lean-toward-`video` (strategy
   lever B, card 27dc7d2d), cite that data point explicitly alongside your own read (e.g. "bluesky
   video resonance is running 2.1x text this cycle — could be worth a `/video` pass here"). Still
   a recommendation, never automatic: `/atomize` never invokes `/video` itself.

## Mode dispatch

The steps above are the **default flow** for `/atomize <url|file|audio|pasted-text>`. Other
invocation modes are each governed by a dedicated reference file. When a non-default mode is
invoked, read the corresponding file first and follow its instructions:

- **`/atomize notes`** — pulls and spreads Substack Notes (not in RSS). Read
  `references/notes-mode.md` and follow it before doing anything else.
- **`/atomize --no-spin <arg>`** opts out to strict verbatim extraction: no reframing, no
  `spin`/`angle` frontmatter, `source_lines` hard-required on every text derivative. Spin itself
  is not a mode anymore; it is the default flow above (angles in `config/platforms.yaml`
  `spin_angles`, rules in `references/spin-mode.md`).
- **`/atomize --revise <folder>`** — re-drafts derivatives flagged `revise` in review-queue.md.
  Read `references/revise-mode.md` and follow it before doing anything else.
- **`/atomize --continue <folder>`** — the folder is already scaffolded (source.md exists);
  resume at step 2 instead of re-ingesting. Read `references/continue-mode.md` and follow it
  before doing anything else.
- **`/atomize --continue <folder> --cut <lens>`** — same, but for an additional approved cut from
  step 1.5 (not `extract`): resume steps 2-8 pointed at `cuts/<lens>/cut.md` instead of
  `source.md`, per "Cut-aware steps" above. `<lens>`'s `cuts/<lens>/cut.md` must already exist
  (step 1.5's `addCut()` call) before this runs.
