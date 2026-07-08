---
name: atomize
description: Build 1 — atomize one piece of Muxin's original content into cheap platform assets (text posts + quote cards) and a review queue. Video shorts are a separate skill — /video. Usage - /atomize <substack-url | file | audio-file | pasted text>, /atomize notes (spread your Substack Notes), /atomize --no-spin <arg> (strict verbatim, no audience spin), /atomize --continue <content-folder> (resume steps 2-8 on an already-scaffolded folder), or /atomize --revise <content-folder>.
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
     cta: source            # source | <literal-url> | none — stamped from config/cta.yaml (step 4.5)
     cta_label: "Full essay (free to subscribe):"   # short lead-in for the link; omit when cta is none
     from_brief: briefs/2026-06-14-strategy-brief.md   # the brief whose directives shaped this (or omit if none)
     directives_applied: [prioritize_pillar:claude-code, format:short-single]  # which directives you acted on
     control_run: true      # only on the one derivative drafted for a due spin-control pick (card f444f440); omit otherwise
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
   - **X and LinkedIn additionally get the storytelling re-hook/re-order pass** (Muxin,
     2026-07-04) — still inside the same never-invent guardrail, not a new license: lead with the
     strongest existing line (drop throat-clearing like "What I described in my essay..."),
     re-order for a narrative arc instead of a list of facts, and do NOT trim concrete personal
     specifics that ARE the story. Bluesky and any Notes-sourced derivative (`source_kind:
     substack-note` in source.md) stay near-verbatim — no extra re-hook/re-order latitude there.
     See `references/spin-mode.md` for the worked before/after and `appliesRehook()` in
     `src/atomize/spin.ts` for the platform/source gate.
   - Text derivatives are ALWAYS Claude-authored and extraction-first. Do NOT pass them
     through `text-polish` — that provider (Grok) is reserved for video scripts, which now live
     in the `/video` skill.

4.5. **Stamp the CTA** (`config/cta.yaml`). The funnel: convert rented attention into owned
   audience. For each text derivative set `cta` + `cta_label` from the target for THAT
   derivative's pillar — human-ai / claude-code / other → `cta: source` (a "read more" link to
   the essay itself; `/publish` resolves it from source.md `canonical_url`, falling back to the
   Substack home when there's no essay URL); civic-tech (and community rooms posting civic
   content) → the voting tool URL. A piece that spans pillars: choose per derivative (e.g. a
   civic-leaning Bluesky take on a human-ai essay may point at the voting tool). If a derivative
   isn't a "go read the essay" invite, you may set its `cta` to a literal url or `none` instead.
   **Never write the link into the post body** — `/publish` places it per platform from
   `cta.yaml` `placement` (X → first reply, LinkedIn → first comment, Bluesky/community →
   inline), so the body stays clean and dodges the in-post link penalty. Each per-platform card
   caption takes the pillar CTA too (default `cta: source`); `publish:cards` places it INLINE on
   inline platforms (Bluesky/LinkedIn) and OMITS it where placement is `reply` (X), since the image
   relays can't post a reply. Set a caption's `cta` to `none` only to deliberately ship it link-free.
   Donations are never the headline ask; the default CTA is "come read / subscribe."
   - **Check `canonical_url`.** If source.md has no `canonical_url` (a local draft, not yet
     published), tell Muxin to paste the published essay URL into source.md before `/publish` —
     otherwise every `cta: source` link falls back to the Substack home instead of the essay.

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
   ships alone, out of context (Muxin, 2026-07-03). Three parts per card N:

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
   origin). The table schema itself doesn't grow a storytelling or thread-check column
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
   mention they can run `/video <folder>`.

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
