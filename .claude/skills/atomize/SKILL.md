---
name: atomize
description: Build 1 — atomize one piece of Muxin's original content into cheap platform assets (text posts + quote cards) and a review queue. Video shorts are a separate skill — /video. Usage - /atomize <substack-url | file | audio-file | pasted text>, /atomize notes (spread your Substack Notes), or /atomize --revise <content-folder>.
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

**This is the default and stays the default.** There is one opt-in, tracked exception:
`/atomize --spin` lets you reframe and flavor a post for its audience (see **Spin mode** below).
It is OFF unless Muxin asks for it, and even then it may re-angle but never invent a claim Muxin
didn't make. Do not spin unless the invocation says `--spin`.

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
   - `quote-card-1.md` (a verbatim quotable line) — drives the quote-card asset (step 7).
   - File format:
     ```markdown
     ---
     platform: x            # x | linkedin | bluesky | community | quote-card
     option: 1
     source_lines: [12, 31-33]   # required normally; best-effort (the ideas drawn from) when spin: true
     # spin: true           # ONLY on a --spin run — marks an audience-reframed variant (Spin mode below)
     scores: { native: 4, brand: 5, cta: true }
     cta: source            # source | <literal-url> | none — stamped from config/cta.yaml (step 4.5)
     cta_label: "Full essay (free to subscribe):"   # short lead-in for the link; omit when cta is none
     from_brief: briefs/2026-06-14-strategy-brief.md   # the brief whose directives shaped this (or omit if none)
     directives_applied: [prioritize_pillar:claude-code, format:short-single]  # which directives you acted on
     ---
     <the post text — nothing else>
     ```
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
   inline), so the body stays clean and dodges the in-post link penalty. The `quote-card` takes
   the pillar CTA too (default `cta: source`); `publish:cards` places it INLINE on inline platforms
   (Bluesky/LinkedIn) and OMITS it where placement is `reply` (X), since the image relays can't post
   a reply. Set a card's `cta` to `none` only to deliberately ship it link-free.
   Donations are never the headline ask; the default CTA is "come read / subscribe."
   - **Check `canonical_url`.** If source.md has no `canonical_url` (a local draft, not yet
     published), tell Muxin to paste the published essay URL into source.md before `/publish` —
     otherwise every `cta: source` link falls back to the Substack home instead of the essay.

5. **Score honestly** (the frontmatter `scores`):
   - `native`: does this read like a real human post on that platform? (1–5)
   - `brand`: does it represent human-centered AI values? (1–5)
   - `cta`: does it point somewhere useful? (true/false — CTA is optional, not mandatory)
   - Score 1–2 → discard it yourself rather than queueing junk.

6. **Validate.** `npm run validate -- <folder>` — must pass before queueing. Fix violations,
   don't relax limits. (Validation enforces char/word limits for every derivative and requires
   `source_lines` except on `spin: true` derivatives, where it's best-effort — Spin mode below.)

7. **Generate the quote-card asset** (cheap, extraction-first):
   - `npm run render -- --still <folder> --quote quote-card-1`
   - **Image model policy — cost-first, escalate only on request, NEVER automatically.** Default
     is **Riverflow** (~$0.02). If Muxin dislikes a result, do NOT silently switch to a pricier
     model — **offer first**: *"we can try a different prompt on Riverflow, or step up to a more
     expensive model."* Only on his yes, re-render with `--pro` (Nano Banana Pro ~$0.13) or
     `--hero` (gpt-5.4-image-2 ~$0.23). (Free option for flat conceptual spots: hand-author an
     SVG → `remotion-svg` path / `/bakeoff`.)

   **Video shorts are a separate skill.** `/atomize` no longer scripts or renders video — that
   keeps it cheap (text + quote cards). To turn this piece into a short, run **`/video <folder>`**
   (script → storyboard → review → render).

8. **Queue for review.** Ensure `<folder>/review-queue.md` has one row per asset that was
   generated — the routing `include` text platforms plus the quote card
   (id, platform, format, asset path, scores, status=pending). Then STOP. Do not publish.
   Tell Muxin: the folder path, asset counts, which platforms routing skipped (and why, per
   `routing.md`), and anything else skipped. If Muxin wants a skipped platform anyway, they can
   say so (or adjust `config/routing.yaml`) and you'll generate it. If the piece is a good
   candidate for a short, mention they can run `/video <folder>`.

## Notes mode — /atomize notes

Muxin's Substack **Notes** (short posts, not essays) are his highest-engagement surface, but they
never appear in the RSS feed, so the URL path above can't reach them. `/atomize notes` pulls them
directly and spreads the ones worth spreading.

1. **Pull + list.** `npm run new-notes` (needs `SUBSTACK_HANDLE` in `.env`). It prints a numbered
   list of recent original notes with engagement, ingests their engagement into analytics (so
   `/strategy` resonance covers Notes — they're otherwise invisible to it), and caches the list.
   Show Muxin the list.
2. **Pick.** Muxin says which to spread. `npm run new-notes -- --pick 1,3` scaffolds one content
   folder per picked note (`source_kind: substack-note`, the note's own URL as `origin` +
   `canonical_url`). Don't spread every note — only the ones worth cross-posting.
3. **Spread each.** For each scaffolded folder, run the standard flow above (steps 2–8): read the
   brief, tag the pillar, `npm run route`, generate derivatives, validate, queue. A note is short
   and already platform-ready, so the **whole note is the extract** — derivatives are near-verbatim
   cross-posts trimmed to each platform's limit (extraction-first still holds; if a note is too thin
   for a platform like LinkedIn, the "don't pad, stop" rule applies). Substack is already excluded
   as a routing target, so a note is never reposted back to where it came from. Muxin still approves
   every draft in `review-queue.md` before `/publish`.

   **Quote card for a note.** The note body IS the quotable unit, so the quote card uses the whole
   note, not a sub-sentence. Put the entire note body in `quote-card-1.md` with `source_lines`
   pointing at the body line(s). If the full body runs past ~280 characters (it turns unreadable at
   card font sizes), take the strongest self-contained sentence(s) that stand as a complete thought
   without the rest of the note. Never use the `title` frontmatter field as the quote source: for a
   note that field is an 80-char synthetic truncation (`noteTitle()` cuts the first 80 chars, often
   mid-sentence), not a verbatim excerpt, and quoting it is what produced the broken, nonsensical
   cards. Strip em dashes per voice rules, and set `cta_label: "Full note (free to subscribe):"`
   rather than the essay CTA, since this is a note.

## Spin mode — /atomize --spin (opt-in audience-fit experiment)

Default atomization is verbatim extraction. **Spin is the one exception**, and it runs ONLY when
the invocation is `/atomize --spin <arg>` (or Muxin asks for a spin on a re-run). It tests a single
hypothesis: does reframing a post for its audience lift engagement enough to be worth dropping
strict verbatim? It is measured against verbatim, so it must be tracked, not silently mixed in.
Full rationale + protocol: `docs/spin-experiment.md`.

**What changes vs. the normal flow:** run steps 1–8 exactly as above, with three differences.

1. **You may reframe and flavor — within hard guardrails.** For a spun derivative you MAY re-angle
   the framing, change the hook, reorder, and adapt the register to the platform's audience. You MAY
   NOT introduce a claim, argument, statistic, metaphor, or worldview Muxin did not express in the
   source. Every spun post must still be traceable to something Muxin actually said or believes —
   reframed, not invented. When unsure whether a line crosses from flavor into invention, it has
   crossed; cut it.
2. **Mark it.** Add `spin: true` to the derivative's frontmatter. `source_lines` becomes
   best-effort: point at the lines/ideas you drew from (validation no longer hard-requires it for
   `spin: true`, but include it when you can — it keeps the trace honest).
3. **Everything else holds.** `config/voice.yaml` applies in full (no em dashes, no AI tells).
   Scoring, CTA stamping (`config/cta.yaml` — spin does not change CTA), routing, and the
   `review-queue.md` approval gate are unchanged. Nothing publishes without Muxin's `approve`.

**Which derivatives to spin (default for a `--spin` run):** spin **LinkedIn and X** — the platforms
where audience-format fit varies most. Keep **Bluesky, community, and the quote card near-verbatim**
(those surfaces already work; don't disturb the baseline). So a typical `--spin` run produces
`spin: true` LinkedIn + X derivatives and ordinary verbatim Bluesky/quote-card derivatives. The A/B
accumulates across runs over the weeks (verbatim from normal runs vs. spin from `--spin` runs), not
within one piece. If Muxin wants a clean same-piece A/B, produce both the verbatim and the spun
version of a platform and let review pick — say so in the review-queue header so it's not read as a
dupe.

**The invent-vs-flavor line, made concrete.** Say `source.md` line 14 reads:

> Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual.

- **Verbatim (default, X):** "Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual." → `source_lines: [14]`
- **✅ Allowed spin (LinkedIn, reframed as a lesson, new hook, same claim):** "The most common AI mistake I keep seeing: teams automate the judgment and keep doing the typing by hand. That's the wrong layer. Flip it." → `spin: true`, `source_lines: [14]`. The hook and register changed; the claim is still Muxin's.
- **❌ Not a spin, it's invention:** "Most AI rollouts automate the wrong layer. Studies show 70% fail in year one because of it." → bans: invents a statistic ("70%") and a citation ("studies show") Muxin never stated. Cut it, even on a spin run.

When you queue spun derivatives, tell Muxin which are `spin: true` and on which platforms, so the
experiment stays legible. Once published, `/publish` stamps the Placed-log row with a `spin` marker,
`tag-source` classifies the post `atomized-spin`, and `/strategy`'s `origin-compare` shows
verbatim-atomized vs spin vs organic per platform.

## --revise mode

`/atomize --revise <folder>`: read `review-queue.md`, find rows with status `revise`, and act
by `format`:
- **Text derivatives / quote cards**: re-draft ONLY those using the `notes` column as
  instruction (extraction-first still applies), re-validate.
Reset revised rows to `pending`, re-validate, and report. (storyboard / short rows are revised
with `/video --revise <folder>`.)
