# Build 3 — Venture (composed business content, walled off)

Build 3 is the **opposite** of extraction-first: `/venture` *composes* original business-testing
content. Muxin is the founder and the decider — the venture, the audience, and every locked choice
are hers; Claude drafts candidates and holds the evidence trail. This composition is allowed
**only because every judgment step ends in a decision record Muxin selects, every user-facing
draft is editorially approved by her, and nothing publishes or becomes a locked business decision
without her explicit action** — the same principle as the video-script exception (rule 1) and
Build 2, extended to a whole build. It must never bleed back into Builds 0/1: text/image
derivatives stay extraction-first.

## Venture cuts closer to rule 1 than Fiction does

Fiction ships as labeled narrative in a separate register. Venture ships nonfiction posts **under
Muxin's own byline, to her real audience, making claims about a real market**. The exception here
is narrower than Build 2's:

- **Rule 5 applies in full — no carve-out.** `config/voice.yaml` governs every Venture draft, not
  just its em-dash ban. There is no separate fictional voice to govern here, so there is no
  `config/fiction/craft.md` analog and there should never be one.
- **Rule 1's real prohibition survives the exception.** The exemption is from `source_lines`
  *tracing*, not from truthfulness. `venture/rules.md` §3, item 9 ("No invented proof"): never
  invent results, stories, customer language, or experience. Claude may compose a *frame*; it may never assert a fact about
  Muxin's history, her numbers, or a reader's words that no evidence supports. **`claim_refs`**
  (below) is what replaces `source_lines` tracing here.
- **Rules 2 and 3 are untouched.** Phase 1 essays (`substack-post`) go out as `ready-to-paste/` for
  Muxin to paste, with the live URL she confirms as delivery evidence. Notes (`text-post-note`) go
  through the existing constrained Substack browser agent (`src/publish/substack.ts`), claiming a
  slot from the same shared scheduler `/atomize` uses. Venture builds no new publish machinery.
- **Rule 6 applies.** Phase judgment runs on the Claude Code subscription ($0 marginal), same as
  `/story` claude-native. Muxin already has survey and email-capture capabilities live on her own
  site (amended 2026-08-19, `docs/venture-build-plan.md` §E) -- this repo does not build or wire
  any email provider or capture mechanism for Phase 2. Phase 2's scope here is copy/concept
  composition only (lead magnet, landing-page copy, welcome-email copy, a fit review of the
  existing survey).

## The gates are state, and Claude never writes them

Every Venture gate is a checkable field, not a vibe. Each field below is **Muxin-only**. The skill
and the phase scripts *read* them, *stop* on them, and MUST NOT write them under any circumstance
— including "she said yes in chat," a resumed session, a retry after a crash, or a script's own
inference. If a gate field is unset, the correct behavior is to stop and ask, every time.

| Muxin-only field | Artifact / record | What it unlocks |
|---|---|---|
| decision `status: selected`, `selected_by: "muxin"` | `platform-recommendation` | Phase 1 idea generation |
| `confirmed_knowns[].confirmed_by_muxin` | `phase_1_research_plan` | using "already known" to skip a probe |
| `reviewed_by_muxin` | `phase_1_research_plan` | drafting any probe into post copy |
| decision `status: selected`, `selected_by: "muxin"`, exactly 3 ids | `idea-ranking` | drafting the three selected ideas into posts |
| `editorial_status: approved` | each Phase 1 post artifact | handoff to `ready-to-paste/` or the Notes agent |
| `delivery_status: live_confirmed` + `evidence` | each Phase 1 post artifact | counting toward Checkpoint 1 |
| `reviewed_by_muxin` | `phase_1_research_read` | selecting the `phase-1-research-continuation` decision |
| `findings[].muxin_confirmed_emergent` | `phase_1_research_read` | gates `research-read-review` (every emergent finding must be confirmed/rejected first) AND excludes a `false`-confirmed finding from informing `concepts` -- both read by runtime gates in `src/venture/phase1.ts`/`phase2.ts` (rules.md §5.6) |
| decision `status: selected`, `selected_by: "muxin"` | `phase-1-research-continuation` | unlocking Phase 2 concept generation (`proceed_with_evidence`/`proceed_as_hypothesis`) or looping back into more Phase 1 probes (`more_probes`) |
| decision `status: selected`, `selected_by: "muxin"` | `lead-magnet-concept` | drafting the selected concept into the lead magnet |
| `reviewed_by_muxin` | `survey` (`p2-survey-review`, via `survey-review-approve`) | gates `welcome-email-draft` (refuses until the survey fit review is approved) -- read by a runtime gate in `src/venture/phase2.ts` |
| `editorial_status: approved` | each Phase 2 artifact | handoff for delivery (manual; Muxin installs/publishes it herself) |
| `delivery_status: live_confirmed` + `evidence` | each Phase 2 artifact | counting toward Checkpoint 2 |
| decision `status: selected`, `selected_by: "muxin"` | `problem-selection` (`p3-problem-01`) | drafting the transformation sentence (`transformation-draft`) |
| decision `status: selected`, `selected_by: "muxin"` | `transformation-choice` (`p3-transformation-01`) | drafting the product outline (`outline-draft`) |
| `editorial_status: approved` | `p3-product-outline` artifact | drafting price/format options (`price`) and the price-decision (`price-draft`), and counting toward Checkpoint 3 |
| decision `status: selected`, `selected_by: "muxin"` | `product-format-and-price` (`p3-price-01`) | drafting the price-decision artifact (`price-draft`) |
| `editorial_status: approved` | `p3-price-decision` artifact | counting toward Checkpoint 3, alongside `p3-product-outline` and the three decisions above |
| decision `status: selected`, `selected_by: "muxin"` | `daily-operating-plan-choice` (`p4-operating-plan-01`) | drafting the daily operating plan artifact (`operating-plan-write`) |
| `editorial_status: approved` | `p4-operating-plan` artifact | counting toward `phase-4-completed` |
| `editorial_status: approved` | each `p4-thank-you-<note_id>` artifact | handoff for sending (manual; Muxin sends it herself, never auto-sent) |
| `editorial_status: approved` | `p4-day-14-review` artifact | making the Day 14 decision (`day-14-decide`) |
| decision `status: selected`, `selected_by: "muxin"` | `day-14-decision` (`p4-day-14-decision`) | `phase-4-completed` (alongside `p4-operating-plan` and `daily-operating-plan-choice` above) — Phase 4's own completion, not a fourth checkpoint |

Signals handoffs are accepted only by the Venture-owned `src/venture/signals-input.ts` seam. The
Content/Signals view remains read-only; Venture requires an independent Muxin action, current
venture phase/rules, qualified measured evidence, and exact body-free identity. An accepted handoff
creates at most one `signals-input` internal artifact (`delivery_mode: none`, `publishable: false`)
plus an idempotent canon decision event. Rejection or a request for more evidence records the
decision event but creates no artifact. This never clears a checkpoint, unlocks a phase, or
publishes. Same identity with changed bytes fails closed.

**This is Build 2's expensive lesson, built in on day one.** `/story` shipped without a beat-sheet
approval gate and drafted an inert chapter before the gate was retrofitted (commit `26bf36c`).
Venture's equivalent gate lives in **script-level predicates and checkable state**
(`src/venture/*.ts`), not in prompt prose — because prompt prose is exactly what `26bf36c` had to
go back and add. `.claude/skills/venture/SKILL.md` restates each stop for the agent's own benefit;
that text is a *reminder* of the gate, never the gate itself.

## The claim boundary — Venture's replacement for `source_lines`

Every concrete factual claim in a drafted post or Phase 2 copy block carries a `claim_refs` entry
pointing at the `intake.md` question it came from, or at a `confirmed_known`'s `evidence_refs`. A
claim with no ref gets cut, or rewritten as an explicitly framed hypothesis — never asserted as
fact. A post may not claim a result Muxin did not get, a customer she does not have, a number
nobody can source, or an experience the intake never described. This is the structural reading of
"the exemption is from tracing, not from truthfulness."

## The confidence boundary — do not manufacture market signal

Venture's output becomes the evidence base for a business decision Muxin will spend money and
months on. **A Venture run may never leave Muxin more confident than the evidence warrants.**
`venture/rules.md` already fences this: no single engagement number decides a read (§5.6), a
`signal_quality` label needs every rubric factor scored (§2C.4), a classifier that cannot tell
must abstain rather than guess (§5.4c), a measured zero is a real reading and a `null` is not.

## Authorship and privacy

A generated recommendation must remain visibly distinct from Muxin's own words, and her edit
becomes her version. The 25 intake answers stay verbatim and correctable — nothing silently
rewrites her answer, her voice evidence, or her selection. Where Venture handles third-party
replies (a later phase), `respondent_hash` is a keyed HMAC and neither the raw identifier nor the
key ever appears in a log, export, error record, or PR body.

## Gates are state predicates, never dates

No Venture gate may be predicated on `planned_phase_day` or the calendar. This is also what lets
the gates survive the approved-but-undrafted loosening of the 14-day phase scaffolding
(`venture/rules.md` §12 item 7) — a phase-structure redesign changes the sequence, not the
predicates.

## Consistency model — per-venture state

- `venture/<slug>/intake.md` — the 25 answers verbatim + the Day 14 scorecard fields, fixed at
  kickoff.
- `venture/<slug>/canon.md` — append-only ledger; the **authority** for checkpoint state, with the
  stamped rules version and both source hashes written at kickoff. `state.md` is a cache, rebuilt
  from the ledger on disagreement, never trusted.
- `venture/<slug>/decisions.jsonl` — one line per judgment step; immutable once `selected`.
- `venture/<slug>/artifacts.jsonl` — one line per drafted/delivered artifact; both state machines
  live here (editorial: Muxin-only; delivery: script/agent-written).
- `venture/<slug>/phase-1-attention/` — Phase 1's working drafts. `venture/<slug>/phase-2-audience/`
  — Phase 2's working drafts. `venture/<slug>/phase-3-offer/` — Phase 3's working drafts (the
  product outline and price-decision body files). `venture/<slug>/phase-4-operations/` — Phase 4's
  working drafts (the daily operating plan, thank-you notes, and Day 14 review body files;
  `src/venture/paths.ts`'s `phase4Dir()`, same pattern as `phase1Dir()`/`phase2Dir()`/`phase3Dir()`
  — NOT gitignored, unlike `responses.jsonl`, so a thank-you note must never carry a raw email or
  handle, see rules.md §9.3 item 1). `venture/<slug>/ready-to-paste/` — essays waiting for Muxin to
  paste.
- `venture/<slug>/responses.jsonl` — one line per ingested survey response, append-only correction
  history per record; gitignored (raw and redacted quotes never reach git).
  `venture/<slug>/cluster-analysis.json` — the current cluster-analysis snapshot `cluster` writes
  (count, redacted evidence, stuck point, desired outcome, visible consequences per cluster);
  overwritten wholesale on a re-run, same one-shot-snapshot treatment as `state.md`; gitignored.
- `venture/rules.md` is the authority and does not execute. `venture/rules.yaml` is the only thing
  a phase script loads at runtime; a parity test keeps them from drifting.
- `venture/examples/civic-tech-worked-example.md` (if present) is a fixture only. It MUST NOT
  enter any clean venture's runtime context, and it MUST NOT appear in a PR body.

## Scripts (Phase 1, Phase 2, Phase 3, and Phase 4)

`/venture new <slug>` (`npm run venture:new`) — 25-question intake, kickoff canon event.
`/venture <slug>` (`npm run venture:phase1`) — research plan → **stop for Muxin's plan review** →
platform pick → ten ideas → **stop, Muxin selects three** → draft → per-post approval → the Phase
1-to-2 bridge (research read → **stop for review** → continuation decision, which either sends the
venture back into more Phase 1 idea generation or unlocks Phase 2).
`/venture <slug>` continuing into Phase 2 (`npm run venture:phase2`) — five lead-magnet concepts →
**stop, Muxin selects one** → lead magnet draft → **stop for approval** → landing page draft →
**stop for approval** → a fit review of Muxin's existing survey (not a new one) → **stop for
approval** → welcome email draft (requires both the magnet and the survey) → **stop for
approval** → an optional announcement draft.
`/venture <slug>` continuing into Phase 3 (`npm run venture:phase3`) — `response-ingest` /
`response-correct` collect survey responses (exempt from every gate below, since gating intake on
the gate it exists to open would be circular); every analysis command refuses until the response
gate opens (20 min / 30 target eligible unique respondents, `response-gate-status` reports where
it stands) → `cluster` groups the eligible responses into 3-5 problems → **stop, show Muxin the
clusters** → `problem-score` ranks each cluster on 6 factors → **stop, Muxin selects the core
problem** (`problem-select`) → `transformation-draft` writes one plain transformation sentence (no
vague verbs, no em dashes) → **stop, Muxin edits/approves it** (`transformation-select`) →
`outline-draft` builds a 5-7 section product outline backward from the approved sentence → **stop
for approval** (`approve <slug> p3-product-outline`) → `price` ranks price/format options → **stop,
Muxin selects one** (`price-select`) → `price-draft` writes the price-decision (recommended price,
considered range, reasoning, known uncertainty, pitch paragraph, optional illustrative-only
scenario math; refuses the $49 worked-example price outright) → **stop for approval**
(`approve <slug> p3-price-decision`).
`/venture <slug>` continuing into Phase 4 (`npm run venture:phase4`, unlocked once
`phase-3-completed` is recorded) — `time-budget-compare` checks the intake time budget against the
canonical 2h15m daily routine (read-only) → `operating-plan-draft` offers the four recorded-choice
modes from rules.md §8.1 (canonical / rotated across the week / extended timeline / revised
pace-or-scope) → **stop, Muxin selects one** (`operating-plan-choice-select`) → `operating-plan-write`
records the schedule, the triage of recurring work into never_build/ignore/automate (rules.md §8.2 —
the script mechanically refuses "automate" bucketing insight, voice, audience empathy, product
judgment, or final approval), and the automation configuration order (rules.md §8.3, a strict
dependency sequence) → **stop for approval** (`approve <slug> p4-operating-plan`). Separately,
`thank-you-note-draft <note_id>` drafts one short (≤2 sentence) note per respondent worth thanking,
linked to a real response, checked for raw emails/handles and sales language (rules.md §8.4) →
**stop for approval, one note at a time** (`approve <slug> p4-thank-you-<note_id>`) — always manual,
Muxin sends it herself, never auto-sent. Then `day-14-scorecard-draft` renders the fixed Day 14
scorecard (rules.md §8.5) — computed fields only, never invented, `null` renders as "not enough data
yet" — → **stop, show Muxin the facts** (`approve <slug> p4-day-14-review`) → `day-14-decide` records
Muxin's one final decision (continue / revise positioning / revise the lead magnet / collect more
evidence / stop) with a required reason; once every required Phase 4 artifact and decision clears,
Phase 4 completes automatically (`phase-4-completed`) — there is no fourth checkpoint, Phase 4 ends
in this human decision, not a cleared gate.
`/venture <slug> deliver` (`npm run venture:deliver`) — hands off an approved post; essay →
`ready-to-paste/`, Note → the Substack Notes agent via the shared scheduler.
`/venture <slug> checkpoint` (`npm run venture:checkpoint`) — clears Checkpoint 1 once all three
required posts are approved and live and posting pace is recorded, clears Checkpoint 2 once the
lead magnet, landing page, welcome email, and survey are all approved and live (the announcement is
never required), and clears Checkpoint 3 once the product-outline and price-decision artifacts are
both approved and live AND the problem-selection, transformation-choice, and
product-format-and-price decisions are all `selected` (no pace requirement). There is no
`checkpoint-4` — Phase 4 completes on its own via `day-14-decide`, above.
`/venture <slug> status` (`npm run venture:status`) — read-only, plain-language status.

## Review checklist — for `/code-review` and any human review of a Venture PR

Any PR touching `venture/**`, `src/venture/**`, or `.claude/skills/venture/**` should specifically
check these, on top of the usual review — a 2026-08-18 review pass found real instances of every
one of them in the build's first PR:

1. **Citations resolve.** Every `venture/rules.md §X.Y` or `docs/venture-schema-contract.md §X.Y`
   citation in this file, root `CLAUDE.md`, or a PR body must point at a heading that actually
   exists in that file — not a numbered list item dressed up as a section number.
2. **The command list here and root `CLAUDE.md`'s pipeline-map table agree.** They document the
   same scripts in two places on purpose (this file's prose is the detailed version, root
   `CLAUDE.md`'s table is the scan-friendly index) — a script added to one and not the other is a
   drift bug, not a style choice.
3. **A field named in this doc exists in the schema.** If this file or a PR introduces a new
   field name (like `claim_refs`), `docs/venture-schema-contract.md` §1's field table must define
   it — don't let a doc-only field ship without the schema contract knowing about it.
4. **`.orchestrator.json`'s `guardrail_paths` covers what actually decides what a Venture post
   says or whether it goes live** — not just `src/venture/**` itself, but any shared file Venture
   code calls into for drafting or delivery (e.g. `src/publish/substack.ts`). A gate that lives
   outside the guarded path is not a gate.
5. **A PR that edits `.orchestrator.json` itself always holds for Muxin's review, full stop** —
   including this repo's own PRs, regardless of how low-risk the specific diff looks. The guard on
   the guard is a rule with no self-vet exception.
