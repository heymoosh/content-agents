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
   - `npm run tag-source` → classify each post's origin: atomized (shipped by /publish from a
     content folder) vs organic (posted natively / a Substack note). Deterministic — matches the
     `Placed log` + `posts.bet_id`.
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

   ## Recommendations
   1. [DO MORE] <pillar/format/channel> — evidence: <specific posts + metrics>
   2. [TEST] <hypothesis worth testing> — evidence: <why>  (carry forward unresolved TESTs from the scorecard)
   3. [DO LESS] <what the data says isn't working> — evidence: <...>

   ## Directives for atomization
   - prioritize_pillar: <pillar id>
   - channel_emphasis: <channel(s) showing traction>
   - format_notes: <e.g. "short single posts over threads on X">
   - hooks_that_worked: ["<verbatim opening lines from top posts>"]
   ```

   The `Directives for atomization` block must be **derived from the scorecard**: never carry a
   directive that maps to a bet you just graded `failed`. Carry-forward TESTs that are still
   unresolved so a hypothesis gets settled rather than forgotten.

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
