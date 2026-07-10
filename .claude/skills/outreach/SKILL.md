---
name: outreach
description: Phase 1 of the outreach engine (docs/outreach-engine-plan.md), turning a seeded company or platform into a cited, classified pitch report Muxin can judge cold. Usage - /outreach add (manual or --from-jsa), /outreach research <lead-folder>, /outreach qualify <lead-folder>, /outreach status.
---

# /outreach: engine core (Phase 1, seeded leads only)

Take a lead from a bare name/URL to a cited, classified pitch report Muxin can judge cold.
**No discovery, no drafting, no sending in this phase.** Leads must already exist (manually
seeded or pulled from JSA); nothing goes out to anyone.

## Non-negotiable rules

1. **No send path exists yet.** This skill has exactly four subcommands: `add`, `research`,
   `qualify`, `status`. There is no `draft`, no `pitch`, no message-composition step, and
   nothing in this repo sends an email, DM, or contact-form submission. If asked to draft or
   send outreach, say that's Phase 2 (`draft.ts`/`lock.ts`, not built yet) and stop.
2. **Quote-required worldview match.** A `turnaround`/`greenfield` (client) or
   `strong`/`partial` (platform) classification is only legal when backed by a real quoted
   sentence from the candidate's own words, with a live source URL, tagged
   `signal: worldview-match` in `## Evidence`. No quote means the values leg is unmet, not
   assumed: the classification is `unclear`, full stop
   (`config/outreach/clients.md`, `config/outreach/worldview-map.md`). `qualify.ts` enforces
   this in code and can only ever downgrade a claim, never upgrade one.
3. **JSA verdicts are logistics signals, not values signals.** A `source: jsa` lead needs BOTH
   a valid worldview-match item AND a named, evidenced person-fit item
   (`config/outreach/person-fit.md`) before it can reach `pursue` (the two-key gate). A named
   person-fit match with no company-level clearance still gets recorded in
   `config/outreach/anchors.md` instead of being thrown away.
4. **`research.ts` and `qualify.ts` are content-generation logic** (CLAUDE.md rule 7). A PR
   touching either file's prompt or scoring rules HOLDS for Muxin's review, that's the
   conductor's job, not something to route around here.
5. **Voice.** Any prose you write into a lead's `## Profile`/`## Pitch` (or say to Muxin) follows
   `config/voice.yaml`: no em dashes, no AI tells.

## Subcommands

### `/outreach add`: intake

Scaffold `outreach/leads/<kind>-<slug>/lead.md`. Two sources:

```
npm run outreach:add -- --kind client --name "Acme Co" --url https://acme.co
npm run outreach:add -- --kind platform --name "Some Podcast" --url https://pod.example.com
npm run outreach:add -- --from-jsa --verdict TARGET "PostHog"
npm run outreach:add -- --from-jsa --verdict TARGET --limit 3
```

`--from-jsa` reads job-search-agent's `manual_research.db` (read-only, `JSA_DB_PATH` in `.env`)
and snapshots the matching row(s) into a fresh `client`-kind lead, seeded with JSA's logistics
notes in `## Profile`. It refuses a bare `--from-jsa` with neither a company name nor `--limit`,
so there's no accidental full-database pull. `--limit` is capped by `config/outreach.yaml`'s
`batch_cap` (5) regardless of what's asked for.

Every new lead starts `status: intake`, `classification`/`fit: unclear`, empty evidence,
`(not yet researched)` profile.

### `/outreach research <lead-folder>`: cited evidence pass

```
npm run outreach:research -- outreach/leads/client-acme-co
```

Runs a closed-checklist research pass (the finite signal taxonomy in
`config/outreach/clients.md` or `platforms.md`, never an open-ended "research this company"
prompt) via a `claude -p` subprocess with live web search, capped at
`search_budget_per_signal` searches per signal (`config/outreach.yaml`) and a hard subprocess
timeout (`research_timeout_min`). It writes, per lead:

- `## Profile`: what the company/platform actually is and does.
- `## Evidence`: pipe-delimited, cited items (`signal`, optional `person`, `source` URL,
  `quote`, one-line description). A signal still unfound after its search budget is recorded as
  "no evidence found," not padded.
- A **disconfirmation pass**: an explicit search for evidence AGAINST the claimed
  classification, summarized in `## Classification` alongside the rationale. This is not a
  confirmation-only pass.
- `classification`/`fit` and `pitch_angle` in frontmatter, plus the rationale in
  `## Classification` and the angle in `## Pitch`.
- `status: researched`.

A `platform`-kind lead currently refuses with a "Phase 3 scope" error: platform research isn't
built yet, client-kind only for Phase 1.

### `/outreach qualify <lead-folder>`: deterministic legality backstop

```
npm run outreach:qualify -- outreach/leads/client-acme-co
```

No LLM call. Re-derives `classification`/`fit` from `## Evidence` using the code-level rules in
non-negotiable rule 2 and 3 above, appends a decision-log line explaining any downgrade, and
advances `status` to `qualified` or `pursue` (or `passed` if disqualified). Run this after every
research pass, it's the backstop that keeps research.ts's LLM output honest.

### `/outreach status`: where every lead stands

```
npm run outreach:status
```

Deterministic, non-LLM scan of every `outreach/leads/*/lead.md`, grouped by status
(`pursue`-ready leads first) with kind, source, and classification/fit per lead. Same listing
the GUI's read-only lead view surfaces.

## What "done" looks like for one lead

`add` -> `research` -> `qualify`, in that order. The end state Muxin should be able to read cold:
a `## Profile` that says what the company is, `## Evidence` with real quotes and links, a
`## Classification` that names which signals cleared or didn't (including the disconfirmation
check), and a `## Pitch` with one honest angle. `unclear` is a legitimate, expected outcome on
thin evidence: never force a positive classification to look more decided than the evidence
supports.
