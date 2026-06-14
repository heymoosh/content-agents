---
name: strategy
description: Build 0 — produce the weekly strategy brief from analytics data. Run after ingesting fresh analytics (or via /cycle).
---

# /strategy — generate the weekly strategy brief

Produce `briefs/<today>-strategy-brief.md` from the analytics DB + community log. You (Claude)
do the judgment; scripts do the numbers. Never invent metrics — every claim must cite a real
post or number from the script output.

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
   creds, run `npm run bluesky`. If the DB is empty, stop and tell Muxin which exports to drop
   (see `docs/analytics-export-howto.md`).

2. **Tag untagged posts.** Run `npm run snapshot -- --untagged`. If any posts are returned,
   assign each a pillar using the rubric in `config/pillars.yaml` (use `other` when unsure —
   don't force-fit), then write back:
   `tsx src/db/tag-posts.ts '<json array of {id, pillar}>'`
   For large batches, write the array to a temp file and pass the path.

3. **Run the numbers.**
   - `npm run snapshot` → channel performance + data-confidence table
   - `npm run resonance` → pillar × platform map
   - `npm run route -- --all` → routing map (where each pillar should post; the include/skip
     gate `/atomize` applies, from this data + `config/routing.yaml`)
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

   ## Routing map (what to post where)
   <route --all table — which pillars route to which platforms, and why. Note where the
    gate is data-driven vs cold-start. This is the include/skip rule /atomize enforces.>

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

6. **Honesty rules.**
   - A channel flagged INSUFFICIENT gets at most a [TEST] recommendation, never [DO MORE].
   - A bet graded on n<3 (insufficient-sample) may be carried as a TEST but NEVER promoted to a
     [DO MORE] directive — thin data caps confidence.
   - Every `SUGGEST_FLIP` / `SUGGEST_RETIRE` flag from `grade-bets` must be acted on or overridden
     with one sentence of justification. No bet survives by inertia.
   - 2-3 *new* recommendations max. If the data is too thin to support any, say exactly that and
     recommend consistent posting for N more weeks instead.
   - This brief informs Muxin's judgment; it does not replace it. Flag uncertainty plainly.

7. Show Muxin a 3-bullet summary of the brief, the scorecard verdicts, and where it was written.
