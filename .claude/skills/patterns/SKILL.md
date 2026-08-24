---
name: patterns
description: Route captured source material and explicit pattern evidence into platform and format treatments for Muxin's review. Uses the current deterministic collectors and evidence adapters when requested, adapts common hooks as mad-lib templates around Muxin's substance, never copies creator body copy or publishes. Usage - /patterns collect [--platform X] [--account @handle], /patterns analyze, /patterns synthesize [--platform X], /patterns ideas [--platform X] [--niche Y], /patterns series <content-folder>, /patterns rewrite <content-folder | file>, /patterns asap <content-folder>, /patterns remix <content-folder | topic> [--platform X].
---

# /patterns: evidence into treatments

`/patterns` is a bounded research and treatment handoff. It is not an invisible author and it is
not a hidden collect, analyze, synthesize, and apply pipeline.

```text
capture raw thought / URL / source
  -> source record with provenance and completeness
  -> explicit pattern evidence with scope, metric, pool, and caveats
  -> platform x medium x format treatment with pattern/evidence refs
  -> Muxin review: edit, approve, reject, or request another pass
  -> existing publish path, only after approval
```

The owners stay separate:

| Handoff | Owner | Boundary |
|---|---|---|
| Capture and source record | Studio / existing source intake | Preserve what was supplied and how it was obtained. |
| Pattern evidence | `/patterns` and `src/patterns/**` | Normalize, compare, and describe observed mechanisms. Do not claim coverage or invent winners. |
| Cut and message decision | `/develop` | Select and assemble Muxin's source material. It is not an invisible author. |
| Platform and format treatment | `/atomize` and Grow variants | Keep platform, medium, format, rationale, variables, lineage, and review state explicit. |
| Approval and delivery | Muxin, then `/publish` | Approval is required per item or named bundle. Nothing auto-publishes. |

Each mode is explicit. Running one mode does not silently run another, modify the canonical voice or
config, create a publishable asset, or bypass the review queue.

## Current vocabulary

Use `config/pattern-mining.yaml` as the source of truth for new record values. The current blueprint
uses these lanes and labels:

- `ai-building`: building with AI and AI workflows.
- `adhd`: ADHD, executive function, and working with a nonlinear brain.
- `civic-tech`: civic and social problem solving, public-good technology, and democracy work.
- `product-thinking`: product sense, prioritization, and shipping judgment.
- `solopreneur`: solopreneurship, one-person businesses, and audience as distribution.
- `general-viral`: structure donors that are useful beyond one topic. This is not evidence that a
  broad audience or platform is covered.

The config also contains `productivity`, `lifestyle-control`, and legacy labels retained for older
records. Do not silently rename an old row, and do not invent a niche id. A configured lane is a
query label, not a coverage claim.

Research pools are separate from lanes:

- `niche`: unusually strong examples for the relevant topic, audience, or community.
- `broad`: broad-platform examples selected for platform-wide mechanics, displayed as “broad
  platform” in the blueprint.
- `format`: the format pool, selected for mechanics of a medium or format such as short video,
  quote card, carousel, thread, or newsletter opening.

Pool membership is explicit metadata only. It is not inferred from a creator name, topic, metric,
ranking, body, or model judgment. A source may be in more than one pool only with a recorded reason.
The format pool is not a substitute for a niche pool, and neither is proof of reach.

## The evidence boundary

The authoritative comparison unit is a source/post-level evidence record, not an account rollup. A
pattern reference should retain, where applicable:

- `pattern_id` and the source or post id;
- evidence location, platform, medium, and format;
- explicit pool and popularity scope;
- metric snapshot, numerator, denominator, date or window, and selection rule;
- baseline source, caveats, body completeness, and provenance;
- originality review state.

Use `null` for not collected, not applicable, or not normalized. Use `unknown` only when the field
was checked and could not be determined. Missing evidence is `insufficient` or `blocked`, not a
reason to fill a gap with a plausible value.

Use “selected example,” “observed signal,” or “hypothesis” unless a winner claim names its scope,
comparison set, denominator, metric, window, selection rule, and caveats. Account metadata and a
catalog report can expose gaps; they cannot make current live rows reviewed. The blueprint's
inventory and pool-evidence scaffolds remain provisional until real human-reviewed metadata and
source/post evidence are present.

The current hook library has 31 patterns. That count describes the committed library, not complete
coverage of the configured lanes, platforms, or pools. `post-patterns.md` is likewise evidence-led
and may be thin or absent for a platform. Never present a fallback, a partial section, or a single
account as a general platform rule.

## Capture and extraction rules

Collectors exist in the current code. Use only the existing package scripts and the platform route
they name. Deterministic scripts may fetch, parse, validate, normalize ids, record metrics, and
stage entries. They do not decide what a pattern means or approve a treatment.

Before a collection run, read `references/platform-collection.md` for the platform-specific route,
visible metrics, audience-count caveats, and honest fallback. Before a remix run, read
`references/remix-mode.md` for the common-hook template boundary, evidence requirements, and
provenance output. Those references are the operational detail behind this skill's shorter routing
contract.

The current pattern and Grow entry points are:

```text
npm run patterns:collect
npm run patterns:review-status
npm run patterns:review-status -- --template > data/patterns/account-review.json
npm run patterns:catalog
npm run patterns:outliers
npm run patterns:openers
npm run patterns:reddit
npm run patterns:reddit-rss
npm run patterns:reddit-backfill
npm run patterns:instagram
npm run patterns:pinterest
npm run patterns:youtube
npm run patterns:account-mapping
npm run patterns:coverage
npm run patterns:pool-evidence
npm run grow:plan
```

Do not invent a new command because a judgment step would be convenient. `/patterns analyze`,
`synthesize`, `ideas`, `series`, `rewrite`, `asap`, and `remix` are explicit skill modes whose
judgment stays in the requested run; they are not npm scripts and do not auto-chain.

### Mode 1 hard rule: raw and browser extraction

An external body may come from Muxin's paste, an existing deterministic collector, a platform-owned
raw response, or text visibly available on the target platform in a bounded browser read. A raw or
browser read is an extraction surface, not a summarization prompt.

- Never use a model-backed page fetch, page summarizer, or “return it verbatim” prompt to create the
  `body`. It can return a comment, title, description, or rewritten page instead of the creator's
  words.
- Copy only text and metrics the platform itself exposes for the target item. Do not copy comments,
  related posts, SEO titles, captions over an image, thumbnails, or inferred transcript text as if
  they were the body.
- Do not use browser automation to bypass access controls, rate limits, or platform restrictions,
  and do not turn a bounded read into unbounded scraping.
- Preserve line breaks and provenance. For video, distinguish spoken transcript from written
  caption or on-screen text. If the substance is not retrievable, record an incomplete body or
  `null` field where the schema permits it and keep the evidence blocked or caveated.
- If a raw or browser route fails, keep the gap. Never replace it with a summary, guessed metric,
  guessed text, or another creator's material merely to make a pool look fuller.

The existence of a collector output does not mean the data was reviewed by Muxin, that a platform is
covered, or that a post is a winner. Retain the route, observation date, collection date, scope,
and failure reason.

## Originality, substance, and voice

Exact creator body copy is internal evidence only. It may support analysis, attribution, quotation,
or an originality check when allowed by the record, but it is never a body-copy bank. Do not copy a
distinctive phrase sequence, story, claim, example, or close paraphrase and swap nouns.

Common, widely shared hooks may be adapted as mad-lib templates. Fill the slots with Muxin's own
claim, experience, example, evidence, and point of view. The adapted treatment must sound like
Muxin, preserve her non-generic substance, and avoid recognizable creator-specific wording. A
common template is the permitted growth lever; it is not permission to reuse a creator's body.

For Muxin-voice material:

- `/patterns rewrite` may reorder, lightly trim, and re-hook her source. The body remains grounded
  in her source lines and facts. A blank the source cannot fill is a mismatch, not an invitation to
  invent.
- `/patterns remix` may adapt a selected common opener template and, where evidence exists, the
  visual title treatment. It must record the source evidence and what changed. It does not paste
  the captured opener or write a copied body.
- `/patterns ideas`, `series`, and `asap` propose angles, arcs, and candidate actions. They do not
  write a new body or fabricate a missing claim.
- Read `config/voice.yaml` before writing human-readable titles, summaries, or treatments. Muxin's
  voice wins over a pattern. Remove AI tells, including em dashes, and read the result aloud.
- Civic and social-problem-solving material also follows
  `.claude/skills/atomize/references/civic-adaptation.md`: concrete local stakes, an immediate
  personal payoff, and a specific action. Do not invent links, forms, deadlines, races, measures,
  voting records, or results. A value-aligned close must be neutral, record-based, and verified.

## Mode handoffs

These are the existing modes, with one bounded output each:

| Mode | Reads | Produces | Stops at |
|---|---|---|---|
| `collect` | capture, config, platform route | staged/corpus source records | explicit source evidence; no interpretation |
| `analyze` | selected records and their metrics | structural evidence notes | observed mechanism, with scope and caveats |
| `synthesize` | analyzed evidence grouped by platform and pool | proposed pattern-library edits | Muxin's review before library changes |
| `ideas` | patterns, Muxin material, lane and platform | idea proposals | no body copy |
| `series` | one Muxin source and available treatments | reviewable series cards | existing `/develop` acceptance path |
| `rewrite` | one Muxin source or cut | three source-grounded treatment drafts | Muxin review, never `derivatives/` |
| `asap` | one Muxin source and civic rubric | ranked CTA candidates with verification status | human verification and review |
| `remix` | Muxin material plus selected common-hook evidence | source-grounded opener treatment | Muxin review, never auto-queue |

When a mode has no sufficient evidence, say so before proposing anything and label the output
`insufficient`, `blocked`, or `NEEDS HER INPUT` as appropriate. Do not make the next mode run by
default. A treatment must expose its platform, medium, format, treatment reason, pattern refs,
evidence refs, experiment variables when present, voice/originality state, and human review state.

## Review and delivery gate

Muxin remains the final reviewer for substance, claim, lane, voice, CTA, platform, format, visual,
timing, and originality. Generation is never approval. A candidate is not a publishable asset until
the required lineage and evidence are present, the voice and originality checks pass, and Muxin
explicitly approves it.

`/patterns` does not publish, schedule, send, post, auto-reply, or auto-approve. `/publish` may act
only on the existing approved queue and its own delivery rules. Browser posting still requires
Muxin's explicit approval, and nothing in this skill expands that permission.

## Historical note

Earlier 2026-08-22 notes described paste-only collection and placed automated collection in a later
phase. That wording is historical and superseded by the current collector modules and evidence
adapters. Current route availability is per platform, and current rows still need explicit scope,
provenance, caveats, and human review.
