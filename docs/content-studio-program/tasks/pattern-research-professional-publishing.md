# pattern-research-professional-publishing

## Outcome

A bounded, body-free research staging package covers exactly the 14 existing-evidence seed
accounts on LinkedIn (4), Substack (5), Substack Notes (2), and Threads (3), plus at most two
explicitly-provenanced additional candidates per platform. It keeps candidate dimensions separate
and makes no canonical write, score, ranking, or claim that a candidate is viral/best.

## Decisions already made

- The 65 accounts are evidence-bearing seeds rather than an approved, exhaustive, ranked, or
  viral cohort. This packet owns only its 14 platforms/accounts; do not overlap another packet.
- Use exact candidate-slate account keys. At most two additions per platform may be sourced from
  the catalog or bounded public discovery, with source/provenance in `source-manifest.json`.
- Per seed: one first-party public profile plus at most three public item pages. Per additional:
  at most two public item pages. Do not authenticate, pay, bypass access, scrape at scale, use
  ranking/analytics sites, or expand through related-account suggestions.
- Record only visible identity, format, date, audience, and performance facts. Metrics retain
  value, denominator when available, window/scope, observed date, and direct source; otherwise
  leave fields `unknown`/`null`. Never calculate a rate or infer a baseline.
- Assess niche relevance, broad performance, format performance, relative outperformance,
  repeatability, and evidence quality independently. Never combine them into a score or universal
  viral definition.
- Do not store or reproduce creator bodies, captions, transcripts, titles, hooks, prompts,
  screenshots, or derived body text. Use source URLs/IDs and original neutral mechanism summaries
  only. Do not read `data/**`.

## Required context

- `AGENTS.md`
- `CLAUDE.md`
- `docs/content-studio-program/charter.md`
- `docs/content-studio-program/broad-pattern-research-policy-20260825.md`
- `docs/content-studio-program/candidate-account-slate-20260825.md`
- `docs/pattern-mining-plan.md`
- `docs/content-system-blueprint.md`
- `src/patterns/manual-platform-intake.ts`
- `src/patterns/manual-platform-report-cli.ts`

## Boundaries

- Write paths: `docs/content-studio-program/staging/broad-pattern-research-20260825/professional-publishing/**`
- Forbidden paths: `data/**`, `content/**`, `config/**`, `src/**`, coordinator records, task
  packets, the backlog, and every other staging package.
- Semantic lock: `pattern:broad-research-professional-publishing`.
- No canonical JSONL, collectors, publishing, generated content, or product behavior changes.

## Required artifacts

Create deterministic `source-manifest.json`, `observations.json`, `decision-packet.json`, and
`decision-packet.md` under this package. The schema and ordering requirements are identical to the
text-community packet: source identity/provenance; body-free manual-platform observations; and
per-account decisions containing sources, topic/niche, medium/formats, examples, measurements,
baseline/gap, separate six dimensions, pool rationale, caveats, confidence, and `include`,
`exclude`, `hold`, or `research further` recommendation.

## Acceptance criteria

1. The seed set is exactly the 14 professional-publishing keys and additions are capped at two per
   platform with provenance.
2. The package is body-free and has no ranking, score, winner/best/viral assertion, copied
   title/caption/transcript/body, or inferred metric/baseline.
3. Unknowns, denominators/context, evidence links, baseline gaps, and caveats are explicit.
4. `npm run check` passes.
5. `node --import tsx src/patterns/manual-platform-report-cli.ts --input docs/content-studio-program/staging/broad-pattern-research-20260825/professional-publishing/observations.json --format json` succeeds and reports zero included/complete bodies.
6. `git diff --check` passes and artifacts are deterministic on a second run.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`, including actual model/effort,
source limits, seed/addition counts, and acceptance output. Do not edit `work.yaml` or `runs/`.
