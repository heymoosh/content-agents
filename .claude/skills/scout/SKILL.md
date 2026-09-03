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
  testable assumption: raw material for the separate, opt-in `/brand-lens` Inspiration mode (not
  built by this skill). Carries a real cited quote and a *tentative* one-line angle, never a
  finished analysis -- proposing the actual angles is `/brand-lens`'s job, not this skill's.

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
3. **Bounded cost.** One subscription CLI call per selected kind, with the entire run capped by
   `config/outreach.yaml` `batch_cap` (default and hard ceiling 5) and a computed search-budget ceiling enforced by
   the same `search-budget-hook.ts` PreToolUse hook `/outreach research` uses (reused unmodified).
   $0 marginal -- Muxin's Claude Code subscription (CLAUDE.md rule 6), logged to
   `data/cost-log.csv` and `data/outreach/run-log.jsonl`.
4. **Permanent frontier.** Every previously surfaced lead, pursued or passed, is excluded at the
   write gate across kinds. Names, legal suffixes, leading “The,” and URL/domain variants share a
   canonical identity. A pass requires a short reason in the GUI; later runs receive those reasons
   as negative examples so rejected lookalikes stop resurfacing.
5. **Rotated methodology.** Each successful run persists one belief × community dialect × modality
   lens and a small trusted-anchor subset. The subscription model generates fresh bounded queries,
   expands anchors one to two public graph hops, and performs quote-required fit plus a separate
   disconfirmation pass. Client discovery starts from a named person's quoted worldview trail.
   Missing person-first evidence is not surfaced; missing disconfirmation forces a downgrade.
6. **`src/discovery/prompt.ts` and `discover.ts` are content-generation-adjacent** (CLAUDE.md rule
   7): they don't compose prose in Muxin's voice, but they DO decide which companies/examples get
   surfaced and how. A PR changing the discovery prompts or writer logic should be reviewed like
   any other prompt change, even though this particular skill's own commits shipped self-vetted
   (infra, not composed content).

## Usage

```
/scout                                          # platforms only by default (client work is parked), theme = every pillar's signals
/scout --kinds client,platform                  # skip content-example this run
/scout --theme "AI-era career strategy"          # focus the search instead of the full pillar list
/scout --limit 5                                 # request up to 5 per kind; whole run still caps at 5
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
