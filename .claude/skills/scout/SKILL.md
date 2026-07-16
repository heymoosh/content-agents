---
name: scout
description: Web-discovery agent that finds real, cited candidates for the outreach/discovery inbox -- clients and platforms worth pitching, and real-world examples worth writing about. Usage - /scout [--kinds client,platform,content-example] [--theme "..."] [--limit N].
---

# /scout: web-discovery inbox

Go find things Muxin didn't already know about, via bounded web search, and drop them into the
SAME inbox `/outreach` already uses (`outreach/leads/<kind>-<slug>/lead.md`, surfaced in the
review GUI's Outreach tab). **Discovery only, never action.** Nothing here contacts anyone, drafts
a message, or spends a token on content generation until Muxin reviews a candidate and hits
Pursue in the GUI.

## What it finds

Three kinds, one run:

- **`client`** / **`platform`** -- real companies/platforms that fit `config/outreach/clients.md`
  or `platforms.md` and the worldview map, the same rubrics `/outreach research` already uses.
  Written straight into a fully-populated `lead.md` (not the empty "not yet researched" stub
  `/outreach add` writes) -- `source: discovered`, `status: researched`, real cited evidence
  already filled in, then immediately re-checked by `qualify.ts`'s own downgrade-only legality gate
  (no quoted worldview-match evidence -> forced back to `unclear`/`weak`, same as any other lead).
- **`content-example`** -- a real product/company/org move that looks like it rests on one clear,
  testable assumption: raw material for the separate, opt-in `/derisk` lens (not built by this
  skill). Carries a real cited quote and a *tentative* one-line angle, never a finished analysis --
  naming the actual riskiest belief is `/derisk`'s interactive, red-teamed job, not this skill's.

## Non-negotiable rules

1. **No send path, no auto-action.** A discovered lead lands at `status: researched` (client/
   platform) or `status: intake` (content-example) -- the same starting line a manually-added lead
   sits at before anyone has looked at it. The ONLY things that move it forward are Muxin's own
   Pursue/Pass click in the GUI, or (client/platform, already-`pursue`) the existing
   `/outreach draft` path. This skill never drafts a message and never creates a content folder.
2. **Evidence-gated, same as `/outreach`.** Every candidate must carry a real, working source URL;
   a positive client/platform classification additionally needs a real quoted worldview-match
   (`qualify.ts` enforces this in code, downgrade-only, same as any other lead -- see
   `.claude/skills/outreach/SKILL.md` rule 2). A candidate the model can't back with a real
   citation within its search budget gets dropped, never invented.
3. **Bounded cost.** One `claude -p` call per kind (at most 3 per run), each capped at
   `--limit` candidates (default 3, hard max 5) and a computed search-budget ceiling enforced by
   the same `search-budget-hook.ts` PreToolUse hook `/outreach research` uses (reused unmodified).
   $0 marginal -- Muxin's Claude Code subscription (CLAUDE.md rule 6), logged to
   `data/cost-log.csv` and `data/discovery/run-log.jsonl`.
4. **Exact-slug dedup only.** A candidate whose `outreach/leads/<kind>-<slug>` already exists is
   skipped, not overwritten. This is NOT fuzzy/semantic dedup (that's `idea-scout`'s domain) --
   re-running `/scout` with the same theme may occasionally re-propose something close to an
   existing lead under a different name; that's an acceptable, expected gap in v1.
5. **`src/discovery/prompt.ts` and `discover.ts` are content-generation-adjacent** (CLAUDE.md rule
   7): they don't compose prose in Muxin's voice, but they DO decide which companies/examples get
   surfaced and how. A PR changing the discovery prompts or writer logic should be reviewed like
   any other prompt change, even though this particular skill's own commits shipped self-vetted
   (infra, not composed content).

## Usage

```
/scout                                          # all 3 kinds, theme = every pillar's signals
/scout --kinds client,platform                  # skip content-example this run
/scout --theme "AI-era career strategy"          # focus the search instead of the full pillar list
/scout --limit 5                                 # up to 5 candidates per kind (hard cap 5)
```

Runs `npm run scout -- <args>` (`src/discovery/discover.ts`). Review results in
`npm run review` -> **Outreach** tab: each candidate shows a clickable source link, the cited
quote, a plain-language "what this is," and why it's being recommended, with **Pursue** / **Pass**
buttons. For a `pursue`d client/platform lead, **Approve -> Draft message** reuses the exact same
`/outreach draft` job the Follow-ups tab already uses -- same model, same two-sided evidence guard,
same "you edit it before anything sends" posture.

## Relationship to `/outreach`

`/scout` is upstream of `/outreach`: it's the one thing `/outreach` never had (`/outreach add` only
ever accepts a name Muxin or JSA already supplied -- see `.claude/skills/outreach/SKILL.md`,
"No discovery, no sending"). Once a lead exists, whether seeded by hand, from JSA, or by `/scout`,
every downstream step (`research`/`qualify`/`draft`/`lock`) treats it identically -- `source:
discovered` is just one more legal value alongside `manual`/`jsa`/`ingested`.
