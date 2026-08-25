# pattern-research-text-community

## Outcome

A bounded, body-free research staging package covers exactly the 31 existing-evidence seed
accounts on Bluesky (4), Dev.to (1), Hacker News (1), Mastodon (9), Reddit (10), and X (6), plus
at most two explicitly-provenanced additional candidates per platform. It makes independent
candidate recommendations for niche, broad-platform, and format pools without a score, ranking,
canonical-data write, or claim that an account is viral/best.

## Decisions already made

- The 65 accounts are evidence-bearing seeds, not an approved, exhaustive, ranked, or viral
  cohort. This packet owns the 31 listed above; it must not research a seed owned by another
  packet.
- Work from the exact account keys in the candidate slate. An additional account may come from
  the wider 371-account catalog or a bounded public discovery, but each platform has a maximum of
  two additions and every addition needs a source/provenance reason in `source-manifest.json`.
- For each seed, use at most one first-party public profile and three public item pages. For each
  addition, use at most two public item pages. Do not authenticate, pay, bypass access controls,
  scrape at scale, use analytics/ranking sites, or expand through related-account suggestions.
- Use only visible identity, format, date, audience, and performance facts. A metric must retain
  value, denominator when available, measurement window/scope, observed date, and direct source;
  otherwise record `unknown` or `null`. Do not calculate engagement rates or infer baselines.
- Keep niche relevance, broad-platform performance, format-specific performance, relative
  outperformance, repeatability, and evidence quality as separately named assessments. Do not
  combine them into a score or universal definition of viral.
- Packets may name URLs/IDs and summarize a mechanism in original neutral language, but must not
  retain or reproduce creator bodies, captions, transcripts, titles, hooks, prompts, screenshots,
  or derived body text. Read no local raw pattern corpus.
- Existing local evidence may be referenced only through the body-free account key and the count
  published in the candidate slate. Do not inspect `data/**`.

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

- Write paths: `docs/content-studio-program/staging/broad-pattern-research-20260825/text-community/**`
- Forbidden paths: `data/**`, `content/**`, `config/**`, `src/**`, coordinator records, task
  packets, the backlog, and every other staging package.
- Semantic lock: `pattern:broad-research-text-community`.
- This is research staging only: no canonical JSONL data, collectors, publishing, generated
  content, or product behavior changes.

## Required artifacts

Create these exact files, deterministically ordered by `platform`, then `accountKey`, then source
URL/identifier:

1. `source-manifest.json`: collection timestamp, policy/version, all account identities, seed or
   additional provenance, local evidence-count reference for seeds, and every direct public source
   URL with its observation date/type. Never include source body-derived fields.
2. `observations.json`: an object with `observations`, containing body-free
   `manual_platform_observation` input records compatible with `manual-platform-intake.ts`.
   Use `collectionStatus` `observed`, `partial`, `blocked`, or `not_collected`; include separate
   `evidenceLinks`, `metricSnapshot`, audience snapshot, explicit baseline gap/source, caveats,
   and lineage. Use example post IDs/URLs only.
3. `decision-packet.json` and `decision-packet.md`: one account decision containing identity,
   sources/local references, niche/topic, medium/formats, examples, metrics, baseline/gap,
   separate six dimensions, explicit pool rationale, caveats, confidence, and reviewer
   recommendation (`include`, `exclude`, `hold`, or `research further`).

## Acceptance criteria

1. The seed set is exactly the 31 text-community keys specified above, with no duplicate across
   packets; any additions obey the two-per-platform cap and source provenance requirement.
2. The package is body-free and contains no ranking, score, winner/best/viral assertion, copied
   title/caption/transcript/body, or inferred metric/baseline.
3. Every decision preserves unknowns and caveats; available metrics state their denominator and
   context or explicitly state that it is unavailable.
4. `npm run check` passes.
5. `node --import tsx src/patterns/manual-platform-report-cli.ts --input docs/content-studio-program/staging/broad-pattern-research-20260825/text-community/observations.json --format json` succeeds and reports zero included/complete bodies.
6. `git diff --check` passes and the staged artifacts have deterministic ordering on a second run.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`, including the actual model,
effort, public-source limits used, exact seed/addition counts, and acceptance output. Do not edit
`work.yaml` or `runs/`.
