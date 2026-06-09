---
name: strategy
description: Build 0 — produce the weekly strategy brief from analytics data. Run after ingesting fresh analytics (or via /cycle).
---

# /strategy — generate the weekly strategy brief

Produce `briefs/<today>-strategy-brief.md` from the analytics DB + community log. You (Claude)
do the judgment; scripts do the numbers. Never invent metrics — every claim must cite a real
post or number from the script output.

## Steps

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
   - Read `data/community-log.md` (manual observations — treat as qualitative signal)

4. **Write the brief** to `briefs/YYYY-MM-DD-strategy-brief.md`:

   ```markdown
   # Strategy Brief — YYYY-MM-DD
   data_window: <earliest posted_at> → <today>

   ## Data confidence
   <verbatim table from snapshot — INSUFFICIENT channels get directional-only treatment>

   ## Channel performance snapshot
   <snapshot output + 2-3 sentences of your reading per channel>

   ## Topic resonance map
   <resonance table + your interpretation; ignore cells with n<3>

   ## Community signals
   <synthesis of community-log.md: what sparked conversation vs silence, per community>

   ## Recommendations
   1. [DO MORE] <pillar/format/channel> — evidence: <specific posts + metrics>
   2. [TEST] <hypothesis worth one week of testing> — evidence: <why>
   3. [DO LESS] <what the data says isn't working> — evidence: <...>

   ## Directives for atomization
   - prioritize_pillar: <pillar id>
   - channel_emphasis: <channel(s) showing traction>
   - format_notes: <e.g. "short single posts over threads on X">
   - hooks_that_worked: ["<verbatim opening lines from top posts>"]
   ```

5. **Honesty rules.**
   - A channel flagged INSUFFICIENT gets at most a [TEST] recommendation, never [DO MORE].
   - 2-3 recommendations max. If the data is too thin to support any, say exactly that and
     recommend consistent posting for N more weeks instead.
   - This brief informs Muxin's judgment; it does not replace it. Flag uncertainty plainly.

6. Show Muxin a 3-bullet summary of the brief and where it was written.
