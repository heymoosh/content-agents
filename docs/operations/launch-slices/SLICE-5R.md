# SLICE-5R: X carries building and technical pieces only

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin's routing decision, 2026-09-07, in her words: "I have a preference to keep X only tech
related; society related posts I don't know putting on there unless I'm actually trying to promote
the voting product to right leaning groups." Then, after seeing the numbers: "I don't even know if
X is a place for human ai either" and "I'd keep X on those things (building and tech stuff)".

The numbers behind that, latest metrics per post from `data/analytics.db` on 2026-09-07: 264 X
posts, every pillar averaging about one interaction per post (civic-tech 8 posts at 1.0, human-ai
81 at 0.9, claude-code 62 at 0.9, builder 14 at 0.7, career-work 16 at 0.6, other 71 at 0.5). No
pillar earns X on data. The decision is Muxin's judgment about who is on X, not a data finding.

Today `config/routing.yaml` puts X in every pillar's cold-start default, and the SLICE-5P canary
essay (civic-tech + human-ai) was routed to X for that reason, not because anything fit. The
router already applies hard `rules.<pillar>.never` overrides after the data decision
(`config/routing.yaml` → `rules:`; `src/strategy/route.ts`).

Demonstrably true when done: only building and technical pieces auto-route to X, and Muxin has a
documented, one-step way to put any other piece on X on purpose (for example promoting the voting
tool).

## Decision recorded

- **X stays on `claude-code` and `builder`.** Decided. (Muxin: "claude code only isn't a
  category but building and technical stuff is." The two pillars together are that category.)
- **X comes off `civic-tech`, `human-ai`, `other` and `career-work`: remove `x` from each
  default and add `rules.<pillar>.never: [x]` for each.** Decided, 2026-09-07, in her words:
  "I'd stop doing career-work on X. ONLY technical stuff goes on X cause that's the only thing
  that platform seems to respect these days. Think very silicon valley monoculture, if it fits
  that paradigm, it can go in X." Use that sentence, dated, as the comment in `routing.yaml`.

A piece tagged **both** civic-tech and human-ai (as the 5P essay was) now has X excluded by both
tags. A piece tagged civic-tech and builder is routed per pillar, so the builder tag may still
bring X in. Record in the RESULT BLOCK what the router actually does for such a piece, so Muxin
can decide whether pillar precedence needs its own slice. Do not build precedence here.

## Known data gap, not this slice's

Every X, LinkedIn and Substack row in `data/analytics.db` has a NULL `brand_id`; only Bluesky rows
carry `human-inference`. A brand-filtered routing run therefore sees no X history at all and
falls back to config. Backfilling `brand_id` is its own slice (see the master doc's START HERE);
do not touch the database here.

## Difficulty

Easy — a config rule that the router already honours, plus a test and a doc line.

## Depends on

SLICE-5P (closed first; it reads routing during a live run).

## Owned files

Parallel-safe: **no — single lane.** Two files that must agree; one worker.

### Lane A — the rule, its test, and the opt-in path

- `config/routing.yaml` — remove `x` from the `civic-tech`, `human-ai`, `other` and `career-work`
  defaults and add `never: [x]` under `rules.<pillar>` for each (civic-tech keeps its existing
  `always:`); add a two-line comment carrying Muxin's reason and the date. Leave `claude-code`
  and `builder` as they are.
- `src/strategy/route.test.ts` — a case proving X is excluded for civic-tech and for human-ai
  even when the data scores it above `skip_below_score`, and a case proving builder and
  claude-code still include X.
- `content/README.md` or the `routing.md` header the router writes, **whichever already documents
  how Muxin overrides routing for one piece** — add one sentence saying that promoting the voting
  tool on X is a per-piece manual include, and name the exact step (an edit to the piece's
  `routing.md` before `/atomize --continue`, or an existing flag if one exists). Find the existing
  mechanism; do not build a new flag. If no manual-include mechanism exists, record that under
  Unresolved as the follow-up slice and document nothing.

## Do not touch

- `src/strategy/route.ts` — the rule engine is not in scope. If `never:` turns out not to be
  honoured after data routing, stop and record `file:line`; that is a defect for its own slice.
- `config/pillars.yaml`, `config/platforms.yaml`.
- Any `content/<slug>/routing.md` already generated.
- `.claude/skills/**` — write-protected.

## Cited headings

`none`

## Acceptance

- [ ] A1 — `npm run route -- --brand human-inference --all` (or the router's dry-run form) on the
      folder `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference` shows X
      excluded with a reason naming the rule, and Bluesky and the democratic-resilience community
      still included. Paste the relevant lines.
- [ ] A2 — The two new `route.test.ts` cases pass and assert on the router's output list, not on
      the config having been read.
- [ ] A3 — Every existing `route.test.ts` case still passes.
- [ ] A4 — The comment in `routing.yaml` carries the date and the reason, no em dashes.
- [ ] A5 — The RESULT BLOCK states what happens to a dual-tagged piece where one tag excludes X
      and the other keeps it (for example civic-tech + builder).
- [ ] A6 — The per-piece opt-in step is documented in an existing place, or its absence is
      recorded as a follow-up.

## Verify

Run unsandboxed.

```
node --import tsx --test src/strategy/route.test.ts
npm run route -- --brand human-inference --all
```

## Observable result

Muxin runs the router on the 5P essay and sees X drop out with the reason written next to it.

## Risk

Low — audit required: **no** (config plus test; the diff review is the check). Shares the next
capability-boundary audit.

## Families

- Builder: Codex (GPT), light tier (backend config and test).
- Auditor: not required.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list here.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
