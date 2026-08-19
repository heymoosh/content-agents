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
  `/story` claude-native. Resend is the email provider for Phase 2's capture layer (not built yet).

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
- `venture/<slug>/phase-1-attention/` — Phase 1's working drafts. `venture/<slug>/ready-to-paste/`
  — essays waiting for Muxin to paste.
- `venture/rules.md` is the authority and does not execute. `venture/rules.yaml` is the only thing
  a phase script loads at runtime; a parity test keeps them from drifting.
- `venture/examples/civic-tech-worked-example.md` (if present) is a fixture only. It MUST NOT
  enter any clean venture's runtime context, and it MUST NOT appear in a PR body.

## Scripts (Phase 1 and Phase 2 — Offer/Operations not yet built)

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
`/venture <slug> deliver` (`npm run venture:deliver`) — hands off an approved post; essay →
`ready-to-paste/`, Note → the Substack Notes agent via the shared scheduler.
`/venture <slug> checkpoint` (`npm run venture:checkpoint`) — clears Checkpoint 1 once all three
required posts are approved and live and posting pace is recorded, and clears Checkpoint 2 once
the lead magnet, landing page, welcome email, and survey are all approved and live (the
announcement is never required).
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
