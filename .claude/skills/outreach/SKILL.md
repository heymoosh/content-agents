---
name: outreach
description: The outreach engine (docs/outreach-engine-plan.md), turning a seeded company or platform into a cited, classified pitch report and (once qualified) a human-reviewed outreach message. Usage - /outreach add (manual or --from-jsa, client or platform kind), /outreach research <lead-folder>, /outreach qualify <lead-folder>, /outreach draft <lead-folder>, /outreach lock <message-file>, /outreach status [--targets].
---

# /outreach: engine core (seeded leads, human-reviewed messages)

Take a lead from a bare name/URL to a cited, classified pitch report Muxin can judge cold, then
(once qualified) a drafted outreach message he reviews and locks by hand. **No discovery, no
sending.** Leads must already exist (manually seeded or pulled from JSA); nothing goes out to
anyone without Muxin locking it first, and nothing in this repo ever sends an email, DM, or
contact-form submission on its own.

## Non-negotiable rules

1. **No send path exists.** This skill has six subcommands: `add`, `research`, `qualify`,
   `draft`, `lock`, `status`. `draft` composes ONE message to a review-queue row (`status:
   pending`); `lock` only fires once Muxin approves that row in the GUI, and even then it just
   stamps the message file and a decision-log line. There is no `pitch`, no send step, and
   nothing in this repo sends an email, DM, or contact-form submission — sending stays a manual,
   by-hand action Muxin takes outside this codebase.
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
4. **`research.ts`, `qualify.ts`, and `draft.ts` are content-generation logic** (CLAUDE.md rule 7).
   A PR touching any of these three files' prompts or scoring/message rules HOLDS for Muxin's
   review, that's the conductor's job, not something to route around here. `draft.ts` is the one
   place in this whole engine composed prose is allowed (CLAUDE.md rule 1's scoped exception, same
   posture as video scripts and Build 2 fiction) — legal only because every message sits at
   `status: pending` until Muxin reviews and approves it in the GUI; `lock.ts` itself is
   deterministic (no LLM call) and not content-generation logic.
5. **Voice.** Any prose you write into a lead's `## Profile`/`## Pitch`, or that `draft.ts`
   composes into a message body (or say to Muxin) follows `config/voice.yaml`: no em dashes, no
   AI tells.

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

### Platform-kind: the client-kind flow's sibling

A `platform`-kind lead (a podcast, newsletter, or other borrowed-audience venue, `intake --kind
platform`) walks the exact same `add` -> `research` -> `qualify` -> (`draft` -> `lock`) sequence
as client-kind, with two swapped pieces:

- **Rubric.** `research.ts` reads `config/outreach/platforms.md` (topic-overlap,
  audience-reality, guest-friendliness/pitch-path, and recency signals, plus the same
  worldview-match + disconfirmation pass) instead of `config/outreach/clients.md`, and pulls the
  pitch angle from `config/platforms.yaml`'s `spin_angles` (Muxin's existing per-channel
  positioning) rather than inventing one from scratch.
- **Field.** Everywhere client-kind writes `classification` (`turnaround`/`greenfield`/`unclear`/
  `disqualified`), platform-kind writes `fit` (`strong`/`partial`/`weak`/`disqualified`) — `weak`
  is the platform-kind analog of `unclear`, a legitimate outcome on thin evidence, never rounded
  up. `qualify.ts` and `draft.ts` both branch on `kind` in the lead's frontmatter to pick the
  right field automatically; no separate command is needed.

`status --targets` (below) is platform-kind-only: it renders the running borrowed-audience target
list `config/outreach.yaml`'s Phase 3 scope feeds into `/strategy`'s weekly brief.

### `/outreach qualify <lead-folder>`: deterministic legality backstop

```
npm run outreach:qualify -- outreach/leads/client-acme-co
```

No LLM call. Re-derives `classification`/`fit` from `## Evidence` using the code-level rules in
non-negotiable rule 2 and 3 above, appends a decision-log line explaining any downgrade, and
advances `status` to `qualified` or `pursue` (or `passed` if disqualified). Run this after every
research pass, it's the backstop that keeps research.ts's LLM output honest.

### `/outreach draft <lead-folder>`: compose one message

```
npm run outreach:draft -- outreach/leads/client-acme-co [--channel email|linkedin-dm|contact-form|podcast-pitch]
```

Refuses outright unless the lead's `classification` is `turnaround`/`greenfield` (client-kind) or
`fit` is `strong`/`partial` (platform-kind) — you don't draft outreach off a non-fit. Composes ONE
message via a `claude -p` subprocess (`--tools ""`, no web access — every fact it can cite
already lives in the evidence `research.ts` gathered), citing only real, specific evidence items
(the two-sided rule: name something concrete and true about this lead, never a generic template),
following `config/voice.yaml`. Writes `outreach/leads/<slug>/messages/message-NN.md` at `status:
draft` and appends a `status: pending` row to that lead's review queue — **never** `approve`,
Muxin reviews every message in the GUI before anything can lock.

### `/outreach lock <message-file>`: Muxin's approval, made permanent

```
npm run outreach:lock -- outreach/leads/client-acme-co/messages/message-01.md
```

No LLM call. Fires when Muxin approves an `outreach-message` row in the review GUI (never any
other path). Re-runs `validate.ts`'s own two-sided guard before ever locking, so a hand-edited or
corrupted message can't slip through the GUI's approve button. Stamps the message `status:
locked` + `locked_at`, appends a decision-log line to the lead, and flips the review-queue row to
`locked`. This is the terminal state: there is still no send step anywhere after this, sending the
locked message stays a manual, by-hand action.

### `/outreach status [--targets]`: where every lead stands

```
npm run outreach:status
npm run outreach:status -- --targets
```

Deterministic, non-LLM scan of every `outreach/leads/*/lead.md`. Plain form: grouped by status
(`pursue`-ready leads first) with kind, source, and classification/fit per lead — same listing the
GUI's read-only lead view surfaces. `--targets`: platform-kind leads only, fit-positive-first
(`strong` > `partial` > `weak` > `disqualified`), each with its pitch angle — the running
borrowed-audience target list Phase 3 feeds into `/strategy`'s weekly brief.

## What "done" looks like for one lead

`add` -> `research` -> `qualify` -> (if qualified) `draft` -> Muxin reviews in the GUI -> `lock`.
The end state Muxin should be able to read cold at any point in that chain: a `## Profile` that
says what the company/platform is, `## Evidence` with real quotes and links, a `## Classification`
that names which signals cleared or didn't (including the disconfirmation check), a `## Pitch`
with one honest angle, and — once qualified — a drafted message that names something specific and
true about this lead rather than reading like a template. `unclear`/`weak` is a legitimate,
expected outcome on thin evidence: never force a positive classification to look more decided
than the evidence supports, and never draft outreach off one.
