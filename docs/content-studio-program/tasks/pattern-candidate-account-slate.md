# pattern-candidate-account-slate

## Outcome

Muxin chooses whether the exact body-free, evidence-bearing cohort may enter subsequent review
staging. This packet itself does not create, amend, or select canonical pattern data.

## Decisions already made

- The slate is all and only the 65 account keys with `evidenceCount > 0` in the read-only
  `review-status` projection recorded in `candidate-account-slate-20260825.md`.
- The other 306 catalog accounts remain explicitly unmapped and pending; they are neither
  rejected nor silently inferred.
- Evidence presence is a review-prioritization signal only. It does not establish audience,
  popularity, niche, format, quality, or a `best` designation.
- The source projection contains no raw post bodies and this gate must not write `data/patterns/**`.
- Muxin's affirmative decision authorizes only the next review-staging packet; its subsequent
  canonical write remains separately bounded, cross-family audited, and subject to all existing
  provenance rules.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/protocol.md`
- `docs/pattern-mining-plan.md`
- `docs/content-studio-program/candidate-account-slate-20260825.md`

## Boundaries

- Write paths: none while awaiting Muxin's decision.
- Forbidden paths: `data/**`, `content/**`, `config/**`, `src/**`, and all source evidence bodies.
- Semantic lock: `pattern:candidate-account-slate`.
- This task is a human gate, not a worker lease.

## Acceptance criteria

1. The slate identifies the source snapshot, deterministic inclusion rule, count, and account-key
   digest without copying raw evidence bodies.
2. The decision clearly distinguishes review staging from canonical selection or a quality claim.
3. No canonical pattern-data write occurs before Muxin answers.

## Decision requested

Approve the 65-account evidence-bearing slate for the review-staging packet, request a narrower
cohort, or hold it. On approval, the coordinator resumes the approved pattern-evidence lane;
canonical writes remain blocked until the bounded staging work is audited.
