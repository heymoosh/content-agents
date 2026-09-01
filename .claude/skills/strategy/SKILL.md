---
name: strategy
description: Build 0 — produce the weekly strategy brief from analytics data. Run after ingesting fresh analytics (or via /cycle).
---

# /strategy — generate the weekly strategy brief

Produce `briefs/<today>-strategy-brief.md` from the analytics DB + community log. You (Claude)
do the judgment; scripts do the numbers. Never invent metrics — every claim must cite a real
post or number from the script output.

**Write the brief in Muxin's voice, no AI tells** (CLAUDE.md rule 5 / `config/voice.yaml`): no
em dashes, no "here's the thing", no thought-leader filler. Plain and direct. The brief is for
Muxin to read, so it should sound like a sharp analyst talking, not a content machine.

**This brief is one turn of a loop, not a fresh start.** Before recommending anything new, you
grade whether last cycle's bets paid off (Step 0). The `briefs/bets.md` ledger is the memory that
makes `/cycle` compound instead of restarting every week.

## Steps

0. **Grade the last cycle** (skip only if `briefs/` is empty — the very first run).
   - Read the most recent prior brief in `briefs/` AND `briefs/bets.md`.
   - Run `npm run grade-bets`. It scores every `open`/`carried` bet from analytics linked via
     `posts.bet_id`: sample size, avg engagement vs. the platform reference, weeks open, a verdict,
     and `SUGGEST_FLIP` / `SUGGEST_RETIRE` flags.
   - **Match published posts to bets first if needed.** For bets whose `Placed log` rows aren't yet
     reflected in the analytics (a post shipped last cycle now has metrics), find the analytics row
     for each placed derivative — match by the placed row's text prefix + platform + approximate
     date against `npm run snapshot` output. Write the matches back with
     `npm run link-bet -- '<json [{id, bet_id}]>'`, then re-run `npm run grade-bets`.
   - In `briefs/bets.md`, append a `grade:` line (with today's date + the cited numbers) under each
     graded bet, update its `status` (`confirmed` / `failed` / `carried`), apply the
     `underperform_streak` updates the script prints, and **act on every flag** (flip/retire it, or
     write one sentence defending why you're keeping it — silence is not allowed).

1. **Freshness check.** Run `npm run ingest` if `data/inbox/` has files. If `.env` has Bluesky
   creds, run `npm run bluesky`. If `.env` has `SUBSTACK_HANDLE`, run `npm run new-notes` to pull
   the latest Substack Notes and refresh their engagement (Notes are Muxin's highest-engagement
   surface and appear in no export). If the DB is empty, stop and tell Muxin which exports to drop
   (see `docs/analytics-export-howto.md`).

2. **Tag untagged posts.** Run `npm run snapshot -- --untagged`. If any posts are returned,
   assign each a pillar using the rubric in `config/pillars.yaml` (use `other` when unsure —
   don't force-fit), then write back:
   `tsx src/db/tag-posts.ts '<json array of {id, pillar}>'`
   For large batches, write the array to a temp file and pass the path.

3. **Run the numbers.**
   - `npm run snapshot` → channel performance + data-confidence table
   - `npm run resonance` → pillar × platform map
   - `npm run platform-fit` → strategy lever A (card c7638362, epic 2ce597d7): a ranked
     topic-platform fit RECOMMENDATION (lean in / steady / consider easing off / insufficient
     data), same underlying numbers as resonance + route's fit score, plus Muxin's seed priors
     from `config/strategy.yaml`. Recommendation only — it never changes what `/atomize` drafts;
     `route.ts`'s include/skip stays defaults-driven (card 7e550e48). A thin cell (n<3 or <4wks
     of data) always reads insufficient-data, never a forced lean-in/ease-off — don't over-read
     early signal into a directive. Fold the ranked table into the brief; where a read disagrees
     with `config/routing.yaml`'s defaults, surface it as a suggestion for Muxin to consider by
     hand, same posture as Routing drift flags below — never edit `config/routing.yaml` yourself.
   - `npm run media-fit` → strategy lever B (card 27dc7d2d, epic 2ce597d7): a per-platform
     RECOMMENDATION comparing text engagement against quote-card/video engagement (recency-weighted,
     `config/strategy.yaml`'s `media_thresholds`), labeled lean toward `<media>` / steady /
     insufficient data. Recommendation only — `/atomize`'s generation contract (always text +
     quote-card per routed platform) and `/video`'s invocation model (always human-invoked) are
     both unchanged; nothing here auto-generates a video or a composited quote-card. A thin cell
     (n<3 or <4wks on EITHER the text or the media side) always reads insufficient-data, never a
     forced lean/steady read. Where a platform reads lean-toward-`<media>`, add ONE line to the
     `media_mix` list in **Directives for atomization** below naming the platform + the suggestion
     (e.g. "bluesky: video resonance running 2.1x text — flag `/video` as a strong option when
     atomizing bluesky-routed pieces") — `/atomize` step 2 already reads and applies these
     directives. `insufficient-data`/`steady` reads get no `media_mix` entry — don't manufacture one.
   - `npm run cadence-fit` → strategy lever C (card ed23f712, epic 2ce597d7): per-platform
     engagement TREND (climbing / steady / declining, recent 4wk vs prior 4wk) + peak posting
     HOUR (PT). Unlike lever A this one CAN reach `/publish`'s live scheduler, but only through
     `config/schedule-overrides.yaml` — `src/publish/slots.ts` ignores it entirely while
     `approved: false` there. Run `npm run cadence-fit -- --write` to also propose numbers into
     that file (still inert); Muxin reviews them and sets `approved: true` herself when she wants
     them live. Same overfitting guard as lever A: a thin window (n<3) or a synthetic/date-only
     timestamp platform (true today of X and LinkedIn — their analytics don't capture posting
     hour, only the date) always reads insufficient-data, never a forced trend/peak-hour read.
     Fold the ranked tables into the brief.
   - `npm run frame-fit` → strategy lever D (card a4c5b42b, epic 2ce597d7): the card's original ask
     ("weight spin angles by conversion performance") isn't buildable today — angle is 1:1 with
     platform (no menu of angles to weight) and no conversion metric exists in the analytics DB —
     so this instead compares the always-on spin frame against the verbatim control baseline
     (`npm run spin-control`), by engagement, per platform: frame-winning / even / frame-losing /
     insufficient data. Recommendation only — `src/atomize/spin.ts`'s per-platform angle is
     untouched. Because `posts.source` is untagged on most distributed posts until `tag-source`
     runs, and control coverage accrues slowly (one pick per calendar month), expect mostly
     insufficient-data today — that's the honest read, not a bug. Fold the ranked table into the
     brief; case-skeleton/directive-level angle weighting is deferred until those tags are
     persisted to the DB (see the follow-up card filed alongside this lever).
   - `npm run cta-fit` → strategy lever E (card d80411bc, epic 2ce597d7): SCAFFOLD, not a live
     signal yet. The card's original ask ("score CTA click-through + lead-gen effectiveness per
     platform") isn't buildable today — no click/conversion metric survives ingest, same wall
     lever D hit — and which CTA destination a post used was never persisted before this card. It
     now rides along on the bets.md Placed-log (`| cta:<dest>` marker, read back by `tag-source`
     onto `posts.cta_destination`), so future CTA-tagged posts accumulate real data. Compares
     per-platform engagement across the three CTA destinations (source/project/work_with_me):
     clear-winner / even / insufficient-data, same overfitting guard as lever D. Expect
     insufficient-data on every platform until enough CTA-tagged posts ship — that's the honest
     state, not a bug. Recommendation only — `src/publish/cta.ts`'s resolution is untouched. Fold
     the ranked table into the brief.
   - `npm run lever-effectiveness` → strategy-lever validation (card 83166c51, epic 2ce597d7):
     answers "do the 5 levers this epic built actually measure something?" by combining lever C's,
     D's, and E's real computed deltas (the same reads `npm run cadence-fit`/`npm run frame-fit`/
     `npm run cta-fit` print, reused not recomputed) into one report, plus an explicit
     **insufficient tracking** note for levers A/B — `posts` persists pillar/media_type but nothing
     records whether a post's routing or media choice actually FOLLOWED that lever's
     recommendation, so a before/after lift for A/B is not honestly computable today (a tracking
     gap, not a thin-data one — don't wait for more posts to fix it; proposed fix pending Muxin's
     sign-off, cards 2ed2bc5a/30257501). Lever C's own gap closed once `posts.cadence_source`
     ('override' | 'default', stamped at slot-claim time by `src/publish/typefully.ts`) started
     being persisted — expect insufficient-data there too until Muxin approves an override in
     config/schedule-overrides.yaml and posts accumulate under it. Optional dedicated report, run
     on demand — not required every cycle; when run, fold its three tables + A/B tracking-gap note
     into a `## Lever effectiveness` brief section if Muxin wants it in that cycle's brief,
     otherwise just show it to her directly.
   - `npm run tag-source` → classify each post's origin: atomized (shipped by /publish from a
     content folder) vs organic (posted natively / a Substack note). Deterministic — matches the
     `Placed log` + `posts.bet_id`. Also stamps `posts.cta_destination` from the same Placed-log
     rows' `| cta:<dest>` marker (card d80411bc, lever E).
   - `npm run origin-compare` → verbatim-atomized vs spin vs organic engagement per platform.
     Answers "is atomizing earning traction, or is Muxin better off posting natively?" Observational;
     flags INSUFFICIENT groups — don't over-read a gap. It also prints a **Spin control readiness**
     line: spin is the always-on default now, so the verbatim `--no-spin` control is what gets rare.
     If it flags **Spin lift not yet measurable**, the verbatim control is too thin (< n=10) on a
     platform where spin has volume — surface a nudge to run occasional `/atomize --no-spin` controls
     (see Step 4). If control is adequate, just read the comparison off the table.
   - `npm run audience` → who follows you: LinkedIn demographics + follower/subscriber totals &
     growth (demographics are LinkedIn-only; X/Bluesky give counts, Substack free/paid)
   - `npm run route -- --all` → routing map (where each pillar should post; the include/skip
     gate `/atomize` applies, from this data + `config/routing.yaml`). Decisions are always
     defaults-driven now (score never overrides `config/routing.yaml`'s defaults list, in either
     direction) — see the next line for how a persistent data/defaults mismatch surfaces instead.
   - `npm run route -- --flags` → routing drift flags: pillar/platform pairs where the fit score
     persistently diverges from `config/routing.yaml`'s defaults across two independent ~4-week
     windows (not one noisy snapshot). Computed/printed only — never writes to
     `config/routing.yaml` or `config/platforms.yaml`. A flag is a prompt for Muxin to reconsider
     the defaults by hand, not an auto-change.
   - `npm run spin-control` → spin-control run (card f444f440): picks and records this month's due
     verbatim control run for whichever already-assigned pillar/platform pair
     (`config/routing.yaml` defaults) has gone longest without one (idempotent, a control run
     already picked this calendar month just prints a skip line). When it prints a pick, add a
     [TEST] recommendation in Step 4 naming the pillar + platform: next time Muxin atomizes a
     piece for that pillar, draft that ONE platform's derivative verbatim (NOT the whole-piece
     `/atomize --no-spin` flag — every other routed platform keeps its normal spin treatment) and
     stamp its frontmatter `control_run: true` before it reaches `review-queue.md` (see
     `.claude/skills/atomize/SKILL.md` step 4). Without this, the routing drift flag's
     no-spin-control availability permanently reads false, since Spin's always-on default means a
     plain verbatim post no longer happens on its own. `/strategy` only surfaces the pick, it
     never drafts content itself.
   - `npm run spin-control -- --coverage` → accumulated spin-control engagement (card f444f440):
     per already-assigned pillar/platform pair with a deliberate control run, tracked separately
     from the pillar/platform resonance figures and the routing drift flag above — a control run's
     engagement never feeds either. Prints nothing until a pair reaches n>=3 control runs; a bare
     "no pair has reached n>=3" needs no brief section.
   - `npm run explore` → exploration budget (card 92bb2ae6): picks and records this month's due
     off-assignment probe for LinkedIn and for Bluesky (idempotent, a platform already probed
     this calendar month just prints a skip line). When it prints a pick, add a [TEST]
     recommendation in Step 4 naming the platform + pillar: next time Muxin atomizes a piece,
     route ONE derivative for that platform with
     `tsx src/strategy/route.ts --pillar <pillar> --explore <platform> --folder <folder>` and
     stamp that derivative's frontmatter `exploration_probe: true` before it reaches
     `review-queue.md` (see `.claude/skills/atomize/SKILL.md` step 3.5). `/strategy` only
     surfaces the pick, it never drafts content itself.
   - `npm run explore -- --coverage` → exploration-budget coverage (card 92bb2ae6): accumulated
     engagement (n, avg) per off-assignment pillar/platform pair probed by `npm run explore`
     (LinkedIn/Bluesky's untested pillars, derived live from `config/routing.yaml`'s defaults).
     This is a SEPARATE bucket from the topic resonance map and routing drift flags above — an
     exploration probe's engagement never feeds either. Prints nothing until an untested pillar
     reaches n>=3 probes; a bare "no untested pillar has reached n>=3" needs no brief section.
   - Read `data/community-log.md` (manual observations — treat as qualitative signal)
   - `npm run outreach:strategy-summary` → the current borrowed-audience target list plus
     follow-up counts for every bucket. Fold its output into the brief verbatim. This command is
     read-only: it does not research, draft, contact, or publish anything. If job-search data is
     unavailable, preserve the command's degraded-state note instead of hiding the missing input.

4. **Write the brief** to `briefs/YYYY-MM-DD-strategy-brief.md`:

   ```markdown
   # Strategy Brief — YYYY-MM-DD
   data_window: <earliest posted_at> → <today>

   ## Last cycle scorecard
   <from Step 0 — skip on the first run. Table: bet | type | claim | grade | numbers cited | new status>
   <1-2 sentences: what we learned, what we're retiring/flipping, what we're still testing>

   ## Data confidence
   <verbatim table from snapshot — INSUFFICIENT channels get directional-only treatment>

   ## Channel performance snapshot
   <snapshot output + 2-3 sentences of your reading per channel>

   ## Topic resonance map
   <resonance table + your interpretation; ignore cells with n<3; where rc << raw avg, the win is aging out>

   ## Atomized vs organic
   <origin-compare table + 1-2 sentences: are pipeline-distributed posts earning traction vs ones
    Muxin posted natively (incl. Substack notes)? Observational — flag INSUFFICIENT groups and don't
    over-read a gap. Where Muxin barely posts natively on a platform, read it as "do the cross-posts
    land at all" rather than a head-to-head.
    Spin is the always-on default, so this now compares spin against a verbatim `--no-spin` control.
    If origin-compare printed **Spin lift not yet measurable**, add a one-line **[TEST] run --no-spin
    controls** call to action here (and a matching TEST bet in Step 5): the verbatim control is too
    thin to measure spin's lift, so run occasional `/atomize --no-spin` on the flagged platform(s).
    If control is adequate, say nothing — don't manufacture a recommendation.>

   ## Audience (who you're reaching)
   <audience output: reach table + LinkedIn demographics + Substack tier. 1-2 sentences —
    does the audience Muxin actually reaches match the target reader for each pillar? A mismatch
    (e.g. reaching big-company seniors when a pillar targets indie builders) is a positioning/
    routing signal, not trivia. Demographics are LinkedIn-only; treat sub-100 audiences as anecdote.>

   ## Routing map (what to post where)
   <route --all table — which pillars route to which platforms, and why. Note where the
    gate is data-driven vs cold-start. This is the include/skip rule /atomize enforces. The
    decision itself is always defaults-driven (config/routing.yaml); a persistent score/defaults
    mismatch shows up in Routing drift flags below, not here.>

   ## Routing drift flags
   <route --flags output verbatim — pillar/platform pairs where the fit score has persistently
    diverged from config/routing.yaml's defaults across both independent windows checked. "No
    persistent divergences" needs no follow-up. A flag is a suggestion for Muxin's own
    re-approval of the defaults list, same posture as the Angle drift check below — it never
    edits config/routing.yaml itself and never blocks the rest of /strategy.>

   ## Topic-platform fit (lever A)
   <platform-fit ranked table verbatim + 1-2 sentences per notable row: which pairs read lean-in
    vs consider-easing-off, and whether that matches or runs against config/strategy.yaml's seed
    priors. Insufficient-data pairs get a one-line mention at most, never a recommendation.
    Recommendation only — never changes what /atomize drafts on its own; a lean-in/ease-off read
    is Muxin's cue to consider updating config/routing.yaml's defaults by hand, not an
    instruction to do so automatically.>

   ## Media-mix signal (lever B)
   <media-fit ranked table verbatim + 1-2 sentences per lean-toward row: which platform/media-type
    pairs are outperforming text, and by how much. Insufficient-data pairs get a one-line mention
    at most, never a recommendation. For each lean-toward row, add the corresponding one-line
    entry to Directives for atomization's media_mix list below (e.g. "bluesky: video resonance
    running 2.1x text — flag /video as a strong option when atomizing bluesky-routed pieces").
    Recommendation only — /atomize's generation contract (always text + quote-card per routed
    platform) and /video's invocation model (always human-invoked) are both unchanged; nothing
    here auto-generates a
    video or a composited quote-card.>

   ## Cadence + timing signal (lever C)
   <cadence-fit's two ranked tables verbatim (engagement trend, peak posting hour) + 1-2 sentences
    each on which platforms read climbing/declining and which have a real peak-hour read.
    Insufficient-data rows get a one-line mention at most; for X/LinkedIn's peak-hour row, name the
    reason (synthetic date-only timestamps), don't just say "insufficient data." This is the one
    lever that can actually reach the live scheduler — but only via config/schedule-overrides.yaml,
    and only once Muxin sets `approved: true` there herself. Always end this section with: "To
    activate: review the proposed values in config/schedule-overrides.yaml (run
    `npm run cadence-fit -- --write` to refresh them first), set approved: true, commit. Nothing
    changes your posting cadence or times until you do.">

   ## Frame-fit signal (lever D)
   <frame-fit's ranked table verbatim + 1-2 sentences on which platforms read frame-winning vs
    frame-losing (the always-on spin frame vs the verbatim control baseline). Insufficient-data
    rows get a one-line mention at most, naming the reason (source untagged / thin control
    coverage) rather than just "insufficient data" — expect this to be most or all rows until
    tag-source + spin-control coverage build up. Recommendation only — src/atomize/spin.ts's
    per-platform angle is unchanged; a frame-losing read is Muxin's cue to consider dialing back
    spin on that platform by hand, not an instruction to do so automatically.>

   ## CTA-fit signal (lever E)
   <cta-fit's ranked table verbatim + 1-2 sentences. If every platform reads insufficient-data
    (expected until enough CTA-tagged posts ship), say so plainly and name why (no CTA-tagged
    posts yet / posts.cta_destination only started being stamped once card d80411bc shipped) —
    don't manufacture a read. Recommendation only — src/publish/cta.ts's CTA resolution is
    unchanged; a clear-winner read is Muxin's cue to consider favoring that destination by hand on
    that platform, not an instruction to do so automatically (live consumption is a follow-up).>

   ## Spin-control coverage
   <only include this section if `npm run spin-control -- --coverage` printed at least one row
    (some already-assigned pillar/platform pair reached n>=3 control runs) — omit the section
    entirely otherwise, don't manufacture a placeholder. When present: the coverage table verbatim
    + 1-2 sentences on whether the control runs show the spin angle is landing or not for that
    pair (a judgment call for Muxin, never an auto-change here). This bucket is separate from, and
    never folded into, the Topic resonance map or Routing drift flags above.>

   ## Exploration coverage
   <only include this section if `npm run explore -- --coverage` printed at least one row (some
    untested pillar reached n>=3 probes) — omit the section entirely otherwise, don't manufacture
    a placeholder. When present: the coverage table verbatim + 1-2 sentences on whether an
    off-assignment pillar/platform pair is worth promoting into config/routing.yaml's defaults
    (a judgment call for Muxin, never an auto-change here). This bucket is separate from, and was
    never folded into, the Topic resonance map or Routing drift flags above.>

   ## Community signals
   <synthesis of community-log.md: what sparked conversation vs silence, per community>

   ## Outreach and follow-ups
   <outreach:strategy-summary output verbatim: the platform target list, per-bucket total/due/
    overdue/responded table, and any honest degraded-state note. Use this as a weekly action view,
    not an urgency score. It never authorizes contact or publishing.>

   ## Recommendations
   1. [DO MORE] <pillar/format/channel> — evidence: <specific posts + metrics>
   2. [TEST] <hypothesis worth testing> — evidence: <why>  (carry forward unresolved TESTs from the scorecard)
   3. [DO LESS] <what the data says isn't working> — evidence: <...>

   ## Directives for atomization
   - prioritize_pillar: <pillar id>
   - channel_emphasis: <channel(s) showing traction>
   - format_notes: <e.g. "short single posts over threads on X">
   - hooks_that_worked: ["<verbatim opening lines from top posts>"]
   - media_mix: ["<one line per lean-toward read from the Media-mix signal section, e.g.
     'bluesky: video resonance running 2.1x text — flag /video as a strong option'>"]
   ```

   The `prioritize_pillar`/`channel_emphasis`/`format_notes`/`hooks_that_worked` keys must be
   **derived from the scorecard**: never carry a directive that maps to a bet you just graded
   `failed`. Carry-forward TESTs that are still unresolved so a hypothesis gets settled rather
   than forgotten. `media_mix` is populated from the Media-mix signal section instead (lever B,
   card 27dc7d2d) — one line per `lean-toward-<media>` read, omit the key entirely when nothing
   reads lean-toward this cycle; recommendation only, `/atomize` step 2 reads it as one input to
   its existing quote+image-variant and `/video`-suggestion judgment calls, never a rule.

5. **Record this cycle's bets.** For each new recommendation, append a bet block to the `## Bets`
   section of `briefs/bets.md` so next cycle can grade it:

   ```markdown
   ## bet:YYYY-MM-DD-NNN
   brief: briefs/YYYY-MM-DD-strategy-brief.md
   type: DO_MORE | TEST | DO_LESS
   claim: "<the recommendation in one line>"
   hypothesis_metric: <the measurable bar, e.g. "avg replies per claude-code X post > 4">
   status: open
   underperform_streak: 0
   ```

   (`/publish` appends `Placed log` rows here automatically when assets ship — leave those alone.)

6. **Refresh per-channel angles (drift check).** On-demand, not a hard requirement of every run:
   skip this step if Muxin doesn't have his Obsidian content-ideas notes handy this cycle, and say
   so in the summary (Step 8) rather than blocking the rest of the brief.
   - The four `spin_angles` in `config/platforms.yaml` (x, linkedin, substack, bluesky) were derived
     from Muxin's Obsidian content-ideas and approved 2026-06-30. This step re-checks whether they
     still hold — it never rewrites them. There is no configured path to the vault in this repo, so
     ask Muxin for the current content-ideas (a file path, or pasted notes) if it isn't already in
     this conversation.
   - Read those notes plus `config/pillars.yaml`. For each of the four channels, judge (your own
     inline call, same as pillar tagging / storytelling scores / the home-brand thread-check
     elsewhere in this pipeline) what candidate X-for-Y angle the current content-ideas most
     support for that channel's audience — reframing what Muxin is already writing about, never
     inventing a new stream. Then judge `verdict: "match"` if that candidate is still substantively
     the same claim as the encoded angle in `config/platforms.yaml`, or `"drift"` if it's
     meaningfully different, with a one-line `rationale` citing what shifted in the notes.
   - Run the comparison (deterministic plumbing only — it never touches `config/platforms.yaml`).
     `candidate`/`rationale` are free-form prose, so (same as Step 2's large batches) write the
     array to a temp file and pass the path rather than inlining it as a single-quoted shell arg —
     an apostrophe in the text ("doesn't", "Muxin's") would otherwise break the shell command:
     ```
     npm run angle-refresh -- /tmp/angle-candidates.json
     ```
   - Show the printed report to Muxin, and append it verbatim under a `## Angle drift check` section
     at the end of this cycle's `briefs/YYYY-MM-DD-strategy-brief.md` (or a one-line "skipped — no
     content-ideas notes this cycle" if this step didn't run) so a later read of the brief file shows
     whether the check ran and what it found, not just the chat transcript. A "no drift" result needs
     no follow-up. A drifted channel is a suggestion for Muxin's own re-approval, same posture as the
     home-brand thread-check — it never edits `config/platforms.yaml` itself and never blocks the
     rest of `/strategy`.

7. **Honesty rules.**
   - A channel flagged INSUFFICIENT gets at most a [TEST] recommendation, never [DO MORE].
   - A bet graded on n<3 (insufficient-sample) may be carried as a TEST but NEVER promoted to a
     [DO MORE] directive — thin data caps confidence.
   - Every `SUGGEST_FLIP` / `SUGGEST_RETIRE` flag from `grade-bets` must be acted on or overridden
     with one sentence of justification. No bet survives by inertia.
   - 2-3 *new* recommendations max. If the data is too thin to support any, say exactly that and
     recommend consistent posting for N more weeks instead.
   - This brief informs Muxin's judgment; it does not replace it. Flag uncertainty plainly.

8. Show Muxin a 3-bullet summary of the brief, the scorecard verdicts, and where it was written
   (plus the angle-refresh result from Step 6, if it ran).
