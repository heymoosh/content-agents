# pattern-local-evidence-inventory

## Outcome

The existing local pattern corpus has a body-free, evidence-led inventory that states exactly
what supports high-performance, creator, platform, format, and baseline claims before the
candidate-slate decision is renewed.

## Decisions already made

- Inspect the existing 499 corpus records and their existing analyses and baselines. This corrects
  the prior public-source-only research pass; it does not collect anything new.
- Output only aggregate counts and body-free metadata. Do not reproduce post bodies, captions,
  titles, transcripts, hooks, structures, or creator-specific mechanisms.
- Do not write `data/**`, change canonical ledgers, classify an account canonically, or rank
  accounts or creators.
- Treat a source-listing `winner`, an existing measured relative-performance analysis, and an
  account baseline as distinct evidence. Do not turn any into a universal viral score.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/protocol.md`
- `docs/content-studio-program/broad-pattern-research-policy-20260825.md`
- `docs/content-studio-program/candidate-account-slate-20260825.md`
- `data/patterns/corpus.jsonl`
- `data/patterns/analyses.jsonl`
- `data/patterns/baselines.jsonl`

## Boundaries

- Write paths: `docs/content-studio-program/staging/local-evidence-inventory-20260825/**`.
- Forbidden paths: `data/**`, `content/**`, `config/**`, `src/**`, and
  `docs/content-agents-backlog.md`.
- Semantic lock: `pattern:local-evidence-inventory`.

## Acceptance criteria

- The report accounts for the entire existing corpus and identifies coverage by platform.
- It distinguishes source-winner evidence, measured relative-performance evidence, and stored
  baseline evidence.
- It identifies both usable strengths and evidence limitations, including missing platforms and
  content-completeness gaps.
- It contains no creator content or creator-specific account ranking.
