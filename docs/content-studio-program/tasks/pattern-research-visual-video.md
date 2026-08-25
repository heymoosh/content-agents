# pattern-research-visual-video

## Outcome

A bounded, body-free research staging package covers exactly the 20 existing-evidence seed
accounts on Instagram (4), TikTok (7), and YouTube (9), plus at most two explicitly-provenanced
additional candidates per platform. It keeps candidate dimensions separate and makes no canonical
write, score, ranking, or claim that a candidate is viral/best.

## Decisions already made

- The 65 accounts are evidence-bearing seeds—not a final/approved/best/viral/ranked cohort. This
  packet owns only its 20 platforms/accounts; do not overlap another packet.
- Use exact keys from the candidate slate. At most two additions per platform from the catalog or
  bounded public discovery are permitted, with their source/provenance stated in the manifest.
- Per seed use one first-party profile and no more than three public item pages; per addition, no
  more than two public item pages. Do not authenticate, pay, bypass access, scrape at scale, use
  ranking/analytics sites, or traverse related-account suggestions.
- Retain only visible identity, format, date, audience, and performance facts. A metric needs
  value, denominator if available, window/scope, date, and direct source; missing facts remain
  `unknown`/`null`. Do not calculate rates or infer baselines.
- Keep niche relevance, broad-platform performance, format performance, relative outperformance,
  repeatability, and evidence quality as independent assessments; never make a composite score or
  universal viral definition.
- Never store/reproduce bodies, captions, transcripts, titles, hooks, prompts, screenshots, or
  derived body text. Use URLs/IDs and original neutral mechanism summaries only. Do not inspect
  `data/**`.

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

- Write paths: `docs/content-studio-program/staging/broad-pattern-research-20260825/visual-video/**`
- Forbidden paths: `data/**`, `content/**`, `config/**`, `src/**`, coordinator records, task
  packets, the backlog, and every other staging package.
- Semantic lock: `pattern:broad-research-visual-video`.
- No canonical JSONL, collectors, publishing, generated content, or product behavior changes.

## Required artifacts

Create deterministic `source-manifest.json`, `observations.json`, `decision-packet.json`, and
`decision-packet.md` under this package. Follow the same schema/order as the other research
packets: source identity/provenance; body-free manual-platform observations; and per-account
decisions with sources, topic/niche, medium/formats, examples, measurements, baseline/gap,
separate six dimensions, pool rationale, caveats, confidence, and one allowed recommendation.

## Acceptance criteria

1. The seed set is exactly the 20 visual-video keys and additions are capped at two per platform
   with provenance.
2. The package is body-free and includes no ranking, score, winner/best/viral assertion, copied
   title/caption/transcript/body, or inferred metric/baseline.
3. Unknowns, denominators/context, evidence links, baseline gaps, and caveats are explicit.
4. `npm run check` passes.
5. `node --import tsx src/patterns/manual-platform-report-cli.ts --input docs/content-studio-program/staging/broad-pattern-research-20260825/visual-video/observations.json --format json` succeeds and reports zero included/complete bodies.
6. `git diff --check` passes and artifacts are deterministic on a second run.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`, including actual model/effort,
source limits, seed/addition counts, and acceptance output. Do not edit `work.yaml` or `runs/`.
