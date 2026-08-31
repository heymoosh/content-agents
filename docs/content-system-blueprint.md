# Content system blueprint

**Status:** Directional architecture and execution contract, 2026-08-23
**North star:** Grow-this is one conversation that turns Muxin's raw thought into a reviewed,
learnable set of platform treatments. It is not an autopilot, a universal virality engine, or a
claim that the current corpus is comprehensive.

**Next increment status:** The human-reviewed account metadata overlay and the source/post-level
pool-evidence boundary are scaffolded. Typed source-evidence, reviewed-intake-to-ledger bridge,
append-only baseline measurement ledger, comparison-readiness, operator
readiness, account-example-table, reviewed-account-registry read view/CLI, overlay-coverage, Grow-variant, Grow-this, review-bundle,
capacity, delivery, queue-facts, live-facts, reconciliation, phase-contract, generation-brief,
skill-contract, data-status, experiment-outcome, experiment-record, learning-packet,
comment-learning, Venture-handoff, and model-boundary adapters now make the next joins explicit,
but current live rows remain blocked for pool comparison until real reviewed metadata is entered.
The new Grow artifacts are planning, measurement, reconciliation, and delivery-readiness seams,
not copy generation or automatic publishing. This document describes the target contract; it does
not make existing rows reviewed by inference.

The current mined inventory is 499 posts, 292 analyses, 12 baseline records, 50 derived opener
records, and 225 staged Reddit inbox posts. It is gitignored and unreviewed. Those counts describe
available material, not reviewed evidence, best creators, or proof of platform-wide virality.

## 1. What the system must do

Muxin supplies the insight, claims, observations, taste, and final yes. The system handles the
repetitive work: finding relevant examples, recommending lenses, cutting the message, selecting
platform and format treatments, generating visuals, recording provenance, collecting outcomes, and
surfacing decisions. Every meaningful transition leaves an inspectable artifact.

The target user flow is:

```text
raw thought / URL / essay / Substack / note
  -> capture and source record
  -> advisor conversation: claim, audience, lane, lens, CTA recommendation
  -> message cut(s) that Muxin can edit
  -> Format for platforms: platform x medium x format variants
  -> human review queue: approve, edit, reject, or request another pass
  -> approved scheduling/publishing
  -> post, comment, funnel, and business outcome records
  -> Signals: qualified observations and proposed experiments
  -> human adopt/decline decision
  -> Venture inputs only when its evidence gate permits
```

The UI calls the production step **Format for platforms**. The internal engine may remain named
`atomize`. The user should see the message, why a treatment was suggested, what still needs her
judgment, and what will be measured. Routing notes, line citations, pattern IDs, and model traces
stay behind the conversation but remain available for audit.

### Volume is not publish capacity

The system must distinguish **internal candidate volume** from **approved publish volume**. A
candidate is an inspectable draft, treatment, or experiment option generated for comparison. It is
not a commitment to review, schedule, or publish it. Approved publish volume is the smaller set of
variants Muxin has explicitly approved and the scheduler can place within each platform's configured
cadence. Generation may produce several candidates per source and platform; it must never imply
that all candidates will be reviewed or shipped.

The eventual operating target is at least one reviewed, publishable item per selected platform per
day, subject to a human-review capacity that Muxin sets and can lower at any time. "Publishable"
means approved, evidence and lineage complete, originality and voice checks passed, and a valid
platform slot exists. It does not mean that a post is guaranteed to publish: a platform outage,
missing asset, changed approval, or scheduler failure can pause delivery. The target is not a
current capability or a promise of daily output on every platform.

Capacity planning must record, per day and platform, candidate count, review capacity, approved
count, available slots, scheduled count, and the reason for any gap. Platform `posts_per_week`,
`max_slots_per_day`, slot days, and slot times remain hard constraints. Human review is the
bottleneck by design, so the system should queue fewer candidates when the review backlog, quality
defects, or decision time exceeds the agreed limit. It must pause new generation or scheduling for
a platform when review capacity is exhausted, required evidence is missing, originality is
uncertain, a publish error is unresolved, or a rollback condition is met. Rollback means stop the
affected treatment or platform cadence, preserve the records, and return to the last known-good
approved configuration. Resume requires a human decision supported by an inspectable reason and
evidence. No part of this target authorizes auto-approval, auto-publishing, auto-replies, or
unbounded scraping.

## 2. Shared vocabulary and lineage

Use these normalized terms in records, prompts, and screens. Do not create near-synonyms for the
same object.

| Term | Meaning and required identity |
|---|---|
| Source | The original input Muxin supplied or an external item collected for research. Stable `source_id`, kind, URL/path, author/account, date, and provenance. |
| Account | A creator, publication, organization, or channel. Stable `account_id`, platform, handle/URL, audience notes, and collection provenance. |
| Evidence | A bounded observation supporting a statement: source record, metric snapshot, comment, response, or business event. It carries date, denominator, scope, quality, and caveats. |
| Claim | A proposition being made or tested. It must point to source lines, an evidence record, or a clearly marked hypothesis. |
| Cut | A message-level treatment before platform formatting. It may select, order, and lightly trim Muxin's words; it is not a raw working file or a platform post. |
| Variant | A cut formatted for one platform, medium, and format, with its experiment variables and lineage intact. |
| Pattern | A reusable description of an observed mechanism: common hook template, sequence, pacing, tension, CTA shape, or visual treatment. It is not creator body-copy substitution. |
| Experiment | A declared comparison with a question, variable(s), unit, audience/platform scope, success observations, sample size, and end date or review rule. |
| Comment | A conversation observation linked to a published variant and date. It may propose a question or follow-up test; it is not automatically evidence of demand. |
| Funnel event | A measurable transition such as profile visit, landing visit, opt-in, reply, call inquiry, or sale, linked to the originating variant where possible. |
| Venture lineage | A non-destructive link from a content item or signal to a Venture project, phase, decision, artifact, or gate. Content origin does not bypass Venture approval. |

Minimum lineage is `source -> claim/cut -> variant -> approval -> publish -> outcome ->
experiment/signal`. A Venture-originated item adds `venture_project/phase/decision` at the source
or claim node and still enters Content's normal cut, format, review, and publish path.

### Current-to-target account identity plan

The current corpus groups an account with the composite key `platform|normalizeHandle(handle)`:
the platform is part of identity, the handle has its leading `@` removed, surrounding whitespace
trimmed, and letters lowercased. This is intentionally platform-local. The same person on two
platforms is two current accounts because reach and baselines are not comparable. Existing post
IDs remain the current `platform-handle-short-hash-of-url` form and are not silently rewritten.

Phase 1 maps each distinct current composite key to a future stable `account_id`. The mapping is
an explicit, reviewable artifact with at least `current_account_key`, `account_id`, platform,
normalized handle, display creator, mapping status, evidence links, and a human-review note. The
future ID is opaque and stable across handle changes; the composite key remains as a historical
alias and deduplication key. Do not merge accounts across platforms, or merge renamed handles,
without evidence and a human decision.

The mapping audit must identify and preserve the currently missing normalized fields: `topics`,
`focus`, `research_pool`, `popularity_scope`, `sample_scope`, and `baseline_source`. These are
account or record attributes as appropriate, not guesses inferred from a creator's name. `topics`
are the observed subject labels; `focus` is the account's stated or observed editorial focus;
`research_pool` is one or more of `niche`, `broad`, or `format` (the `broad` label is displayed as
broad platform); `popularity_scope` is the declared comparison scope for the relevant evidence;
`sample_scope` describes how the item was selected; and `baseline_source` identifies the comparison
denominator. None is a general account ranking.

Null/unknown policy is explicit: use `null` for not collected, not applicable, or not yet
normalized; use `unknown` only when the field was checked or considered but cannot be determined;
never replace either with an inferred value, empty string, or zero. A missing field blocks a
winner claim or a pool-specific comparison that requires it, but does not block retaining the
source or mapping it for later review. Existing current-state caveats remain attached to the
mapping and are not converted into target-state certainty.

**Phase 1 acceptance predicate:** the phase is complete only when every current account composite
key has exactly one reviewed mapping row or an explicit `unmapped` disposition, every row has a
stable target `account_id` or a recorded reason it cannot yet receive one, the six missing fields
are present with the null/unknown policy applied, and no target pool, scope, or identity claim is
presented as complete beyond the available evidence.

### Next increment: human-reviewed account metadata overlay

Account metadata is a human-reviewed overlay on the account mapping. It is not inferred
enrichment. A script may normalize handles, validate field shapes, join evidence, and roll the
overlay up for display, but it may not infer an audience, topic, focus, pool, popularity scope,
sample scope, baseline, or review decision from an account name, post metrics, ranking, or model
judgment. The overlay supplements source and post records; it does not replace them or turn a
current account key into a reviewed account.

The requested account table has these fields:

| Field | Meaning |
|---|---|
| `account` | Stable `account_id`, platform-local handle, and display creator or account name. |
| `audience_size_snapshot` | Audience size and type, with observation date, collection date, and evidence source. |
| `topics` / `focus` | Human-reviewed observed topics and the account's stated or observed editorial focus. |
| `platform` | The platform that owns the handle and its reach baseline. |
| `medium` / `format` | The medium and platform-native shape of the relevant source or post. |
| `pool` | Explicit `niche` or canonical `broad` membership, displayed as broad-platform; `format` remains a separate format pool where applicable. |
| `popularity_scope` / `sample_scope` / `baseline_scope` / `baseline_source` | The declared comparison scope, how the item was selected, and the denominator or baseline used, with its source. |
| `evidence_links` | Links or stable references to the source/post-level evidence supporting the row. |
| `caveats` | Missing body, attribution, audience, denominator, selection, or other limits. |
| `review_status` | Whether Muxin reviewed the overlay, or whether it remains pending, blocked, or unmapped. |

The account row is a rollup and navigation surface only. The authoritative unit for a pool
comparison is a source/post-level evidence record with its own pool membership, metric snapshot,
scope, sample rule, baseline, provenance, and caveats. Account mapping may group those records and
report counts, but it cannot create evidence, supply a missing denominator, or make a pool
comparison ready. A comparison that has only account mappings remains blocked.

**Account-overlay acceptance predicate:** this increment is accepted only when the table schema is
present, each current account key has one reviewed row or an explicit `unmapped` disposition,
reviewed values are backed by real evidence links, and all unreviewed or incomplete live rows are
marked blocked. The account overlay is not complete merely because rows exist. Current live rows
remain blocked until real reviewed metadata is entered.

### Next increment: per-platform mechanism blueprint (`platform-treatment-blueprint-v1`)

This is the evidence layer for “what makes content work on this platform and format.” It is an
explicit reviewed-or-hypothesis overlay, not an automatic summary of the corpus. Each row keeps
the platform, medium, format, evidence pool, niche/topic, analysis and source references, baseline
references, discovery surface, response intent, and five body-free mechanism descriptions:
`hook`, `structure`, `retentionPayoff`, `cta`, and `format`.

Niche, broad-platform, and format evidence stay separate. A row may describe a common hook as a
mad-lib mechanism, but it never stores creator body text, exact creator wording, generated copy,
or a winner/ranking claim. Missing evidence, missing baseline, an unreviewed overlay, or a
hypothesis status remains a named readiness blocker. `src/patterns/platform-treatment-blueprint.ts`
provides the deterministic validator and projection; it does not read or rewrite the corpus.

**Acceptance predicate:** every row has an explicit identity, pool, topic, evidence references,
baseline references, mechanism set, caveats, and review/originality status. The output must remain
body-free and must explicitly disallow generated copy, creator-body copying, universal virality,
and winner claims. This makes the next step clear: populate reviewed rows from the existing
analysis/source evidence, then connect the ready rows to Grow treatment experiments.

## 3. Research and evidence architecture

The catalog is a shared index, not a promise of representative coverage. A source/account record
should preserve creator/account, platform and handle, source kind, URL, collection date, original
date, audience size/type when known, topics, lane, medium, format, exact evidence location,
provenance, and caveats. Metrics must preserve the numerator, denominator, observation window, and
comparison group.

For pool comparisons, the authoritative unit is the source/post-level evidence record. That row
must carry the observed metric, audience snapshot when relevant, pool membership, popularity scope,
sample scope, baseline or denominator, dates, evidence link, and caveats. Account mapping is only a
rollup that groups those rows for navigation and reporting. It cannot substitute for a source/post
row, create a denominator, or make a comparison ready. Account-level counts must not be treated as
the comparison sample unless the underlying source/post units and selection rule are shown.

Keep three research pools separate, with separate labels and retrieval/ranking:

1. **Niche pool:** unusually strong examples for the relevant topic, audience, or community.
2. **Broad platform pool:** examples selected to understand platform-wide behavior, even when the
   topic is unrelated.
3. **Format pool:** examples selected for mechanics of a medium or format, such as short video,
   quote card, carousel, thread, or newsletter opening.

A record can appear in more than one pool only with an explicit reason. Pool membership is not a
quality score, and evidence from one pool cannot silently stand in for another.

### Deterministic pool-evidence inventory

Phase 2 has a deterministic inventory artifact: `pool-evidence-inventory-v1`, with
`src/patterns/pool-evidence.ts` as its source module. It is scaffolded and provisional. For a
fixed catalog snapshot and the same invocation inputs, it emits a stable, reviewable set of rows;
it does not claim that the catalog or any pool is complete.

The provisional output requires `rows` and `summary`. `summary` requires
`poolCounts` for `niche`, `broad`, and `format`, plus `blockedAccounts`. Every row requires
`accountId`, `platform`, `handle`, `creator`, `niche`, `topics`, `focus`, `formats`, `audience`,
`pool`, `membershipReason`, `popularityScopes`, `sampleScopes`, `baselineSources`,
`evidenceCount`, `admissibleCount`, `bodyCompleteCount`, `bodyIncompleteCount`, `caveats`,
`readiness`, and `comparisonReadiness`. `readiness` describes whether explicit account metadata is
available for inventory inspection. `comparisonReadiness` remains blocked until linked
source/post-level evidence is present. Both are `ready` or `blocked` with a reason. Nulls and
empty lists preserve the common missing-data policy; the counts are descriptive inventory facts,
not metric judgments.

Pool membership is explicit-membership-only. `pool` may be populated only from explicit
`research_pool`/`research_pools` metadata; it may not be inferred from the account name, niche,
topic, format, metric, ranking, body, or a model's judgment. An account may have more than one row
only when each membership is explicitly recorded. Unsupported pool labels do not create rows. If
there is no explicit pool metadata, the row remains with `pool: null`, `membershipReason: null`,
`readiness.status: blocked`, and a reason; it is not dropped, assigned a pool, or made usable for
a pool-specific comparison. Rows and pool values are sorted deterministically.

This inventory has three explicit non-goals: no inference of missing metadata or membership, no
winner selection or winner claim, and no body generation. It records evidence and body-completeness
counts as metadata, but does not draft, rewrite, or generate a body, hook, opener, or exact creator
wording. The common-hook policy remains unchanged: later Grow work may adapt a
common, widely shared hook template as a mad-lib around Muxin's own substance, while distinctive
creator-specific wording and exact opener generation remain outside the default generation path.

### Popularity and winner claims

Use **winner** only with a declared scope: niche, broad platform, format, account-relative,
community, or time window. A winner claim must include:

- the comparison set and denominator, or an explicit `unknown`;
- the metric and observation window, including whether it is raw or normalized by audience;
- source date and collection date;
- minimum sample or selection rule, if one exists;
- caveats such as reposts, paid distribution, missing impressions, survivorship bias, or an
  unusually large account; and
- whether the record is an observation, an inference, or a hypothesis.

Without those fields, say “selected example” or “observed signal,” never “most popular,” “viral,”
or “proven.” Account-relative performance is never platform-wide performance. Small samples may
generate experiments, but cannot establish a general rule.

### Common-hook template and originality boundary

The system may reuse common, widely shared hook and opener templates as mad-lib structures. A
template may stay recognizably close to the familiar format when its slots are filled with
Muxin's own claim, experience, example, evidence, and point of view. This is the requested growth
lever, not a prohibition on using the opening forms that circulate throughout social media.

The generated hook and body must still be written in Muxin's voice, preserve her non-generic
substance, and pass voice and originality review before approval. Exact creator text may be retained
in the local corpus or opener bank as internal evidence, quotation, attribution, or a licensed
exception. It is not the default output.

The exact creator body remains internal evidence. It may support analysis, quotation, attribution,
or an originality check, but it must not be copied into Muxin's body. Common hooks may be adapted as
mad-lib templates around Muxin's original substance: her supplied claim, experience, example,
evidence, and point of view remain the content of the adapted treatment.

The system must not copy a distinctive creator-specific phrase sequence, body, story, claim, or
example and swap nouns. A common template is allowed; a recognizable creator's signature wording
is not. Pattern records therefore store the reusable slots, mechanism, trigger, pacing, context,
conditions of success, and source evidence. They may include a template example for analysis, but
the generation path must produce an adapted version rather than paste the example.

## 4. Human Inference and brand hypotheses

Human Inference is the positioning center: making human judgment, meaning, and responsibility
legible in an AI-shaped world. It is a lens for deciding what is worth testing, not a requirement
that every item repeat one slogan.

Adjacent lanes from Human Inference are hypotheses, not settled pillars:

- AI building
- product thinking for social problems
- ADHD and nonlinear work
- mission-driven solopreneurship
- AI and public trust
- civic systems and power
- founder sustainability and meaning

Every test should record the lane, claim, audience, platform, format, CTA, and experiment variable.
The system must be able to conclude that evidence is too thin to generalize or that a lane should
remain exploratory.

## 5. Lightweight skills and orchestration boundaries

**Experiment** is the user-facing surface contract formerly called Grow-this. It coordinates one conversation and exposes only the next
decision. It does not replace the engines below it.

Signals owns scientific recommendation and interpretation for content-growth tests. It reviews
qualified performance evidence, identifies a useful uncertainty, and proposes a directional,
falsifiable hypothesis. Experiment owns the controlled execution, review, scheduling, lineage,
measurement, and return of results to Signals. Existing `grow-*` code and command names are legacy
implementation identifiers, not a reason to expose Grow as a separate product concept.

Signals orders approval-ready proposals by confidence and expected information value. Higher
confidence proposals consume scarce generation and publishing capacity first. Low-confidence
proposals are withheld by default unless Signals can show that the uncertainty is unusually
important, the experiment is cheap, and the expected learning is worth the capacity. This ordering
does not convert confidence into evidence of a winner.

The user flow has two different human decisions and one canonical copy surface:

1. Signals shows a body-free experiment plan with its evidence, hypothesis, controls, metrics,
   guardrails, confidence, and decision rule. Muxin approves or declines the plan.
2. Plan approval creates an experiment-tagged request through the ordinary configured Content
   generator. It does not approve any prose.
3. The generator applies the requested treatments and media/platform choices, then the blind
   cold-feed editor and normal voice, CTA, provenance, and platform checks.
4. Every generated variant lands `pending` in the ordinary Content review queue. Content is the
   only place Muxin edits or gives final copy approval before scheduling and publishing.
5. Delivery and observed outcomes retain the experiment id. Signals groups those facts per
   experiment, applies its declared keep/revise/reject rule, and presents the interpretation.

Experiment therefore has no separate copy-review page or duplicate approval state. Multiple
experiments may occupy different lifecycle states concurrently; identity and capacity accounting,
not a global singleton, keep their drafts, deliveries, and outcomes separate.

- `develop` is the advisor and cut engine. It recommends angles and assembles cuts from source
  material; it is not an invisible author.
- `brand-lens` checks fit and identifies gaps. It recommends; it does not rewrite prose into the
  pipeline.
- `patterns` researches, normalizes, and summarizes patterns with source links and scope labels.
- `atomize` remains the internal platform-format engine, surfaced as Format for platforms.
- `video`, `publish`, `strategy`, `signals`, and `venture` remain specialized layers with
  their existing artifacts and gates.
- `story`, `outreach`, `charles`, and other separate systems remain walled off. Fiction may
  share social promotion only; Outreach never sends; Charles is not Muxin's voice.

The orchestrator owns sequencing, retries, artifact links, elapsed-time visibility, and presenting
judgment points. It does not make the final content, brand, routing, publish, or strategy decision.
Each skill owns one bounded output and its validation. No skill should silently call a downstream
skill with a new claim or bypass review.

`src/agents/skill-contract.ts` is the lightweight manifest for this architecture. It describes
the seven bounded stages, their required fact keys, one output fact, owner, human gate, and
prohibited hidden side effects or downstream claims. It is a read-only contract, not a replacement
for every existing SKILL.md. The migration path is to make each skill smaller around one contract
and let Grow-this orchestrate the sequence.

### Workstream dependency order

Build the workstreams in this order. Later workstreams may consume earlier artifacts, but may not
pretend that a target contract exists while its producer is still current-state or partial.

```text
coverage/catalog
  -> pool evidence
  -> Experiment variants
  -> review/publish
  -> comments/Signals
  -> Venture
```

1. **Coverage/catalog** establishes stable IDs, account mappings, source records, and honest
   current-versus-target coverage. It is the inventory foundation.
2. **Pool evidence** adds bounded evidence, pool membership, denominators, dates, selection rules,
   and caveats. It may identify hypotheses, not manufacture winners.
3. **Experiment variants** turns an approved source or raw thought into controlled platform treatments,
   retaining lineage, variables, rationale, and the mad-lib originality boundary.
4. **Review/publish** exposes decisions, enforces human approval, claims only valid platform slots,
   and records scheduling and delivery outcomes. The current typed seams are the review bundle,
   capacity manifest, delivery record, queue/scheduler fact adapters, and reconciliation view; all
   are side-effect-free and keep candidate volume separate from approved publish volume.
   Reconciliation observes drift between canonical review/delivery facts and queue/scheduler facts;
   it never repairs them.
5. **Comments/Signals** links post and conversation observations, funnel events, and experiments
   without collapsing attention into demand or strategy proof. `src/grow/comment-learning.ts`
   exposes a deterministic product/lead hypothesis view with evidence and a pending Muxin decision;
   `src/grow/learning-bundle.ts` joins those hypotheses to explicitly reviewed feed context for
   a scoped, sample-sized product/lead proposal; it does not claim demand or create Venture
   artifacts.
6. **Venture** receives only qualified, caveated inputs and remains governed by its own decision and
   approval gates. The Venture-handoff view is a read-only gate check, not an artifact creator.

The dependency order is a sequencing constraint, not a claim that each workstream is currently
implemented. A later workstream can be prototyped with explicit fixtures, but its output must be
labelled provisional and must not be presented as live evidence.

### Current orchestration seams

`src/grow/grow-this-plan.ts` is the current read-only conversation projection. The
`src/grow/grow-this-plan-cli.ts` adapter and `npm run grow:this` expose its first-action
operator view as deterministic JSON/Markdown. It joins the
source, cut, variant, review, delivery, optional per-slot generation-review-delivery join, experiment, and outcome references into one lifecycle,
surfaces human gates and evidence blockers, and suppresses winner inference and body text. It
does not call the review queue, scheduler, publisher, Signals, or Venture. `src/patterns/account-table.ts`
is the account/example navigation table requested for both niche and broad-platform examples; it
preserves explicit pool, topic, focus, platform, medium, format, audience-size, scope, evidence,
caveat, and review fields while keeping incomplete rows blocked. `src/patterns/review-queue.ts`
turns the overlay coverage into one actionable, body-free row per current account key without
inventing review metadata. `src/patterns/review-status.ts` is the read-only operator entry point
that emits a deterministic blank review template or validates an explicit review JSON input and
exposes the account metadata table; it does not write or infer review values. `src/patterns/hook-template-ledger.ts`
provides the curated, body-free metadata boundary for hook mechanisms, and `patterns:hook-templates`
exposes deterministic filtered JSON/Markdown. `src/grow/variants.ts` can carry a hook-template reference
and source-slot map as metadata only; it keeps copy generation,
creator-body reuse, and approval blocked. These are typed operator seams, not proof that the live corpus has
been reviewed or that the app is wired end to end. `src/patterns/platform-treatment-blueprint.ts`
adds the corresponding per-platform mechanism overlay. Its readiness is evidence readiness, not a
virality score, and it remains separate from platform limits and cadence in `config/platforms.yaml`.
`src/grow/legacy-content-adapter.ts` is the read-only bridge from an existing
`content/<slug>` folder into that Grow projection. It preserves source and cut
references, non-default cut prefixes, legacy review-queue row IDs/statuses,
and row-scoped recognized publish-log references, while leaving unrecorded or
ambiguous Grow treatment rationale, evidence, voice/originality checks, and cut
decisions blocked. An explicit accepted Develop angle decision is consumed as a
Muxin cut approval only when its lens and decision timestamp match unambiguously.
These legacy publish observations never fabricate a Grow delivery record or
publish approval. `npm run grow:this`
accepts `--folder <content-folder> [--lens <lens>]` for this path, so real
legacy studio artifacts can be inspected without hand-authoring a JSON plan.
The adapter returns no body text and performs no generation, approval, queue,
scheduling, or publishing side effect.

`src/patterns/overlay-coverage.ts` reports the explicit per-account mapping status and missing
fields; `src/grow/queue-facts.ts` normalizes supplied queue/scheduler facts without filesystem
writes; `src/grow/live-facts.ts` adapts existing queue rows and scheduler claims into that boundary
without claiming or scheduling; `src/grow/live-reconciliation.ts` composes those explicit facts
and preserves missing/conflicting inputs as blockers; `src/grow/generation-review-delivery.ts`
joins each generation slot's artifact and pending review reference to an explicit reviewed bundle,
already-read live facts, capacity slice, and delivery binding while requiring enriched treatment
lineage; `src/blueprint/phase-contracts.ts` makes the four phase contracts
machine-checkable without asserting that their live producers exist; `src/grow/generation-brief.ts`
describes deterministic platform/format experiment fan-out with mad-lib hook-template reuse and no
body copy; and `src/grow/venture-handoff.ts` keeps the Signals-to-Venture view behind both human
gates. `src/agents/skill-invocation.ts` records key-only readiness for one declared skill contract.
`src/patterns/review-pool-coverage.ts` counts only explicit reviewed pool labels and keeps the
metadata-only boundary visible.
`src/grow/outcome-ledger.ts` is the append-only persistence boundary for funnel and business facts;
it preserves unknown attribution and revisions without embedding bodies, model output, ranking, or
winner inference. `npm run grow:outcome-ledger -- --ledger <path>` reads that append-only JSONL
directly with line-numbered, fail-closed parse errors; the existing explicit JSON/input forms remain
available. The Studio's Experiment measurement read uses `data/outcomes.jsonl` as the canonical
runtime path. It admits a row only when the ledger is ready, its metric exactly matches the declared
experiment metric, and one explicit attribution content id exactly matches one live experiment arm.
Provider metrics follow the same exact-identity rule against `posts.platform_post_id` or the canonical
URL and use the latest analytics snapshot. Missing semantic-reply or website-visit measurements stay
missing rather than being substituted with generic replies or clicks. Neither route writes the ledger,
closes experiments, or selects a winner. `src/grow/venture-input.ts` is the Content-owned, body-free pointer into Venture;
it requires Muxin's content approval while leaving Venture's independent decision null until its
own gate supplies a fact. `src/patterns/measurement-run.ts` records the explicit route, sample
policy, window, operator, and evidence for a `/new` baseline run, including manual and unsupported
routes, without pretending that a manifest is a measurement. Each row also
surfaces a deterministic operator next action; `record_explicit_baseline_fact`
still requires a separate reviewed ledger fact and never means “baseline ready.”
`src/patterns/data-status.ts` provides a metadata-only, read-only report over an explicit
gitignored data directory so file availability and counts cannot be confused with reviewed account
metadata or proof of platform-wide best content. It now reports the derived `openers.jsonl` bank
separately from core artifacts, including parse/validation status without treating opener text as
reviewed evidence or a winner claim.
`src/patterns/source-evidence-cli.ts` and `npm run patterns:source-evidence` expose the
source/post evidence normalization boundary from explicit corpus and analysis envelopes. The
operator view keeps pool, scope, metric, provenance, review, and readiness blockers visible while
omitting bodies and refusing to infer winners.
`src/patterns/platform-readiness.ts` projects platform and format coverage without ranking or
inferring winners, and keeps configured-but-uncollected surfaces visible. `src/review/comment-intake.ts`
provides a local/manual, lineage-aware observation adapter for the comment-learning seam; it does
not fetch comments, infer demand, or publish replies. The Instagram route preserves an explicitly
returned media asset URL as provenance while keeping caption-only and onscreen-text limitations
unchanged. These are bounded readiness seams, not evidence that every platform or comment source is
currently connected.
`npm run patterns:readiness` composes those evidence and platform projections for operator
inspection; it reports absent or invalid review input rather than making the corpus look reviewed.
`src/patterns/account-table-report.ts` and `npm run patterns:account-table` expose the requested
body-free account/example table. When corpus and analysis inputs are supplied, the report derives
comparison rows through the existing evidence seam; it keeps account size, topics, focus, platform,
medium, format, pool, scope, evidence links, and review state explicit, without ranking winners or
copying post bodies.
`src/patterns/account-review-ledger.ts` now gives that review table an append-only persistence seam:
human-reviewed account size, topic/focus, format, explicit pool, baseline, evidence, reviewer, and
status facts stay durable while pending, blocked, and unmapped rows remain visible. The matching
`src/patterns/source-evidence-ledger.ts` persists reviewed source/post comparison facts without
creator bodies, so account rows remain rollups rather than a substitute for authoritative evidence.
`src/patterns/reviewed-evidence-ledger-bridge.ts` projects the existing reviewed-intake report into
append-ready account and source ledger inputs while retaining explicit blockers and refusing to
infer missing identities or review decisions.
`src/patterns/ledger-account-example-table.ts` is the next durable join: it consumes current
account-review corrections plus source-evidence ledger rows, preserves source/post scope and
metric facts as authoritative, and emits the body-free account/example table with explicit size,
topics, focus, platform, medium, format, pool, citations, caveats, and readiness. Blocked rows
remain visible; no pool, ranking, winner, or creator body is inferred. Its file adapter is
`src/patterns/ledger-account-example-table-cli.ts` with `npm run patterns:ledger-account-example-table`.
`src/patterns/opener-report.ts` provides a deterministic evidence view over the derived opener bank:
captured opener text is labeled as source evidence, warnings and performance provenance remain
visible, and no full post body, ranking, or winner claim is added. `src/patterns/review-batch.ts`
pages the unreviewed account queue without mutating it, so a human can process large review sets
while status, next action, and blockers remain explicit.
`src/patterns/baseline-gap-report.ts` compares explicit target rows with the explicit measured
baseline ledger and marks each row `measure_baseline` or `already_measured`. Its route is `/new`
and its missing rows contain no guessed median, winner claim, or platform-wide ranking.
`src/patterns/baseline-sample-cli.ts` accepts an explicit settled sample and runs the existing
baseline builder without writing the ledger; empty or incomparable samples fail closed.
`src/patterns/baseline-repo-report.ts` adapts the configured account seeds and current explicit
baseline ledger into that same plan, so `npm run patterns:baseline-repo` can show the actual
repository gap without hand-building JSON. Configured rows whose handle is intentionally
unconfirmed remain visible as `handle_not_confirmed` blockers rather than disappearing.
`src/patterns/review-session.ts` composes a paged review batch with explicit review/data-status
facts into a body-free human checklist. It preserves pending, blocked, and unmapped state and
never approves, persists, ranks, selects, publishes, or includes creator post bodies.
`src/patterns/platform-pool-matrix.ts` groups explicit platform, niche/broad/format-pool,
medium/format, collection, review, and baseline state into a body-free coverage matrix. It does
not infer missing pool or format labels and does not identify best creators.
`src/patterns/platform-pool-matrix-repo.ts` joins that matrix to the catalog by exact account key,
uses only explicit reviewed pool/medium/format facts and exact baseline keys, and keeps missing
review labels or unassigned catalog labels as separate blocked rows. It never cross-products
independent format arrays because their tuple provenance is absent.
`src/patterns/pool-best-report.ts` and `npm run patterns:best-report` are the next comparison seam:
they can name a best example and best creator only inside an explicit, reviewed, source/post-level
comparison set. Niche groups stay separate by reviewed niche label; broad groups stay platform-wide
but never mix platform, format, metric, unit, numerator/denominator, observation window/scope,
selection rule, baseline terms/window, or baseline source. The report uses recorded baseline
multiples, keeps exact ties as ties, and emits blocked groups instead of a winner when review,
metric, baseline, provenance, body-complete, selection-rule, or sample-size gates are missing. It
is body-free and does not rank account tables or follower counts.
The read-only adapters `src/patterns/opener-report-cli.ts`,
`src/patterns/review-batch-cli.ts`, `src/patterns/data-status-cli.ts`,
`src/patterns/baseline-gap-report-cli.ts`, `src/patterns/baseline-sample-cli.ts`, and
`src/patterns/baseline-repo-report-cli.ts`, `src/patterns/platform-pool-matrix-cli.ts`, and
`src/patterns/platform-pool-matrix-repo-cli.ts`, `src/patterns/pool-review-handoff-cli.ts`,
`src/patterns/review-session-cli.ts`, and `src/patterns/pool-best-report-cli.ts` expose those
operator views as explicit JSON/file commands with deterministic JSON/Markdown output.
`src/patterns/pool-evidence-cli.ts` does the same for explicit catalog or raw catalog-input
pool evidence. Their package commands fail closed on invalid input and do not write data,
infer pool membership, rank creators, or declare winners.
`src/patterns/account-review-ledger-cli.ts` and
`src/patterns/source-evidence-ledger-cli.ts` expose the corresponding append-only reviewed
account and source/post evidence ledgers; both keep blocked rows visible and reject body, model,
ranking, and winner fields. `src/grow/draft-request-cli.ts` exposes the body-free request from an
original thought to one exact treatment with a pending human review gate.
`src/patterns/baseline-measurement-ledger-cli.ts` and
`src/patterns/reviewed-evidence-ledger-bridge-cli.ts` expose deterministic inspection/append and
intake-projection views for the baseline and reviewed-evidence seams. They use explicit paths or
JSON input, preserve blockers, and do not commit facts without the caller's append action.
`src/grow/generation-brief.ts` can carry explicit platform/format readiness blockers onto planning
variants while remaining copy-free and human-gated. The Threads extractor now preserves explicit
media URLs or downloaded slide paths as asset provenance, without treating them as read media or
complete body evidence.
`src/grow/treatment-coverage.ts` reconciles requested platform/medium/format/treatment/experiment
cells against candidate metadata using complete identity and keeps missing, duplicate, blocked,
and unexpected cells visible without generating copy. `npm run grow:treatment-coverage` exposes the
same body-free report.
`src/grow/generation-run.ts` now joins each explicit volume-plan slot to caller-supplied draft and
pending-review references, requiring ready treatment coverage and exact one-to-one slot coverage;
missing, duplicate, mismatched, blocked, and unexpected metadata stay visible. It never creates
drafts, invokes a model, mutates a queue, approves, schedules, or publishes. `npm run
grow:generation-run` exposes the body-free manifest.
`src/grow/draft-request.ts` is the next explicit studio handoff: it binds one
original thought to one exact platform treatment and carries only source,
hook-template, experiment, voice-policy, output, and review references. It
keeps common-hook mad-lib adaptation available while creator-body copying,
model invocation, auto-approval, scheduling, publishing, and side effects stay
false. `npm run grow:draft-request` exposes the deterministic operator view.
`src/grow/draft-batch.ts` fans one original thought into a deterministic set of
unique exact treatments, including hook-template and experiment identity, while
keeping every request pending human review and body/model-free. It is the
volume mechanism for trying many platform combinations; it does not generate or
publish the resulting copy. `src/grow/draft-batch-inspection.ts` provides a deterministic
body-free operator view with per-platform and per-format counts, exact treatment identities,
lineage, and pending-review blockers.
`src/grow/draft-batch-run.ts` is the producer/consumer join after that manifest: it requires an
explicit one-to-one binding from every draft request to a volume slot, checks expected artifact
and review-queue references, and creates pending generation-run candidates while preserving
treatment blockers and the human gate. It never generates copy or invokes a model. The CLI is
`src/grow/draft-batch-run-cli.ts` and `npm run grow:draft-batch-run`.
`src/grow/brief-cli.ts` and `npm run grow:brief` provide a deterministic JSON/Markdown operator
view over that planning boundary. `src/grow/comment-learning-cli.ts` and
`npm run grow:comment-learning` provide the corresponding body-free operator view over explicitly
captured comment, funnel, and business facts; both remain read-only and human-gated.
`src/grow/learning-bundle.ts` and `npm run grow:learning-bundle` join those hypotheses to
explicitly reviewed source/post evidence using exact lineage and evidence references. Feed context
is descriptive context only; qualification requires an evidence-backed funnel or business basis,
and missing or mismatched context remains blocked. The bundle preserves Muxin's pending/adopted/
declined decision and creates no Venture artifact, demand claim, reply, or write.
`src/review/approved-reply-task.ts` adds the missing response seam: a proposed reply can be
reviewed, approved, declined, or kept pending, but no state in this adapter sends or publishes it.
`src/grow/studio-readiness.ts` aggregates source, brief, treatment coverage, volume, generation,
review, delivery, the optional per-slot generation-review-delivery join, and learning readiness without embedding source substance. Its pre-generation
stages remain explicitly blocked when coverage, volume, or draft/review references are missing.
`src/grow/delivery-binding.ts` and `npm run grow:delivery-binding` add the
read-only delivery handoff join: approved review, exact candidate lineage,
capacity, queue, scheduler, provider, and live evidence are reconciled without
claiming a slot, scheduling, publishing, or copying creator body text. The
binding cannot call a provider and keeps manual or ambiguous delivery blocked.
`src/grow/studio-readiness.ts` now consumes the body-free generation-review-delivery
artifact as an explicit delivery-stage input, preserving its per-slot blockers while
still requiring the durable delivery record.
`src/patterns/reviewed-evidence-intake.ts` and
`npm run patterns:reviewed-evidence-intake` provide the matching intake gate
for reviewed account metadata, source evidence, and `/new` baseline rows,
keeping niche, broad-platform, and format pools separate and preserving every
missing or unmapped comparison fact. An empty intake is explicitly blocked with
`no reviewed evidence rows supplied`, so absence of rows cannot look like
comparison readiness.
`src/patterns/manual-platform-intake.ts` keeps a manually
observed platform/post visible when a collector is unavailable, with explicit scope, provenance,
metrics, caveats, and blocked fields rather than silently treating the platform as covered.
`src/review/approved-reply-task-cli.ts` and `npm run review:approved-reply` expose that reply
state as a read-only JSON/Markdown operator view. `src/grow/studio-readiness-cli.ts` and
`npm run grow:studio-readiness` do the same for the end-to-end readiness envelope. Both adapters
preserve blockers and human gates, and neither sends, publishes, or includes source comment/body
text. `src/patterns/manual-platform-report.ts` aggregates already-normalized collectorless
observations by platform, status, explicit pool/role, and missing facts; it is descriptive
coverage only. `src/patterns/manual-platform-report-cli.ts` and
`npm run patterns:manual-platform-report` make that report runnable from an explicit observation
envelope. `src/grow/volume-plan.ts` allocates existing copy-free variants into deterministic
per-platform daily slots while retaining readiness and human review for every slot;
`src/grow/volume-plan-cli.ts` and `npm run grow:volume-plan` expose the same plan from an explicit
brief and optional volume overrides. `src/review/comment-intake-cli.ts` and
`npm run review:comment-intake` provide the manual comment-learning intake with a body-free
default and explicit opt-in for comment text. These are operator/build seams, not reviewed
evidence or permission to auto-publish.
`src/grow/experiment-outcome-cli.ts` and `npm run grow:experiment-outcome` provide a read-only
measurement view that keeps attention, conversation, audience, and business outcomes separate,
preserves lineage/evidence blockers, and accepts a winner only as an explicitly supplied fact. It
does not infer demand, close experiments, compose copy, or publish.

## 6. Model and subagent responsibilities

Use the cheapest acceptable subscription or local route by default, and log paid calls and model
identity. Deterministic scripts handle parsing, IDs, schema validation, joins, scheduling, and
metric calculations. Models handle bounded judgment:

- **Primary Claude/subscription route:** extraction, claim/source alignment, pattern abstraction,
  cut recommendations, voice checks, evidence caveats, and synthesis for review.
- **Cheap local or subscription media route:** deterministic rendering, image/layout generation,
  transcription, and other repeatable media work where quality is sufficient.
- **Specialist or paid model:** only an explicit opt-in when it adds value the default route cannot;
  record why, model, cost, input artifact, and output artifact.
- **Subagents:** run isolated, read-only research, corpus normalization, originality checks, or
  review passes with a bounded brief and structured evidence output. They may not publish, send,
  approve, alter the canonical voice/config, or invent missing facts. `src/agents/model-boundary.ts`
  records the role, task, route, audit refs, cost class, and human gate for this boundary.

Human review remains authoritative for the claim, cut, voice, lane, CTA, platform treatment,
visual, publish timing, and any proposed strategic change. AI prose is visibly distinct from
Muxin's words during review. Apply `config/voice.yaml`: plain verbs, no em dashes, no “here's the
thing,” no rhetorical-question hooks, no generic brand voice, and read it aloud. Any AI tell or
unsupported claim is a reject or rewrite, not a cosmetic warning.

## 7. Review, approval, and delivery gates

The queue must make these states explicit: `draft`, `needs-human-judgment`, `approved`,
`rejected`, `scheduled`, `published`, and `measured`. Approval is per artifact or declared
bundle, never implied by generation or a prior approval. Nothing publishes or sends without Muxin's
explicit decision. Text posts schedule as drafts; outreach stays manual; browser posting requires
the same approval.

Before approval, a variant must show its source/claim lineage, platform/format reason, experiment
variables, CTA or `none`, evidence status, and any exact-text/originality concern. After
publishing, append immutable publish and outcome records. Signals may recommend an adjustment, but
Muxin adopts or declines it before routing, voice, pillars, or strategy change.

## 8. Experiments, comments, funnel, and Venture feedback

An experiment has one question and a declared comparison. Candidate variables include opener
family, claim angle, lane, audience, platform, medium, format, length, CTA, timing, and visual
treatment. Preserve them on every variant and publish record. Signals report attention,
conversation, audience, and business separately. Do not collapse them into one score.

Comments are linked observations with author/context, date, theme, and response status. They can
suggest a problem, language, objection, or next test. They do not by themselves prove willingness
to pay, audience fit, or a Venture gate.

Funnel events link content to profile visits, landing visits, opt-ins, replies, calls, inquiries,
and sales when attribution is known. A quiet post with a lead is a business win; a high-reach post
with no downstream movement is not automatically a success. Missing attribution is recorded as
missing, not guessed.

Venture receives qualified patterns, audience observations, and business signals as inputs with
scope, sample size, provenance, and caveats. It does not receive a universalized engagement claim.
Venture's own response, decision, artifact, and approval gates remain authoritative. A content item
can carry `from-venture` or `from-studio`, but both use the same Content pipeline.

## 9. Phases and acceptance criteria

### Phase 1: blueprint and inventory

**Ship predicate:** Given the existing seeded material, the blueprint and inventory inputs, and the
current account/source records, the owner produces the vocabulary, lineage, three pools, popularity
rules, adaptation boundary, skill boundaries, model policy, approval states, Human Inference
hypotheses, and current-vs-target matrix. The output is a reviewable inventory and explicit mapping
plan with coverage caveats. Muxin decides whether the scope and caveats are acceptable. Evidence is
the inventory, mapping rows, source links, and coverage report. The owner is coverage/catalog.

**Not in scope:** broad scraping, a repo-wide rewrite, a universal score, auto-publishing,
auto-replies, or claiming corpus completeness.

### Phase 2: evidence-aware research

**Ship predicate:** Given the catalog and a declared research question, the owner produces
normalized source, account, and evidence records with provenance, queryable pool membership, and
reviewable selection rules, denominators, dates, caveats, source citations, and originality checks.
Muxin decides whether a summary is usable as an observation, hypothesis, or experiment input.
Evidence is the bounded evidence set, pattern summaries, source links, and review notes. The owner
is pool evidence.

`pool-evidence-inventory-v1` advances this phase by making the pool-membership inputs,
provenance, metadata gaps, and blocked rows deterministic and inspectable. It is the inventory
scaffold for Phase 2, not the Phase 2 ship predicate: the phase remains incomplete until the
normalized evidence set, reviewable summaries and selection rules, denominators, dates, caveats,
source citations, originality checks, and Muxin's judgment are present. A provisional inventory
does not unlock Experiment variants or permit a winner claim.

`research-dossier-v2` is the first end-to-end Phase 2 decision boundary. It binds one declared
question and intended use to an exact included/excluded evidence set, an explicit selection
policy, reviewed baselines, descriptive summaries, citation closure, caveats, and originality
checks. The canonical path begins with `npm run patterns:research-dossier -- propose`, which emits
a body-free `research-dossier-review-v1` packet without any Muxin review stamps. `review` accepts
only a complete explicit Muxin approval bound to that packet's digest and every evidence,
baseline, and originality ID; it then creates the still-pending dossier while retaining the
normalized packet and review receipt inside the dossier digest. `build` is a validate/render-only
adapter for legacy already-stamped inputs and produces JSON, Markdown, or static HTML; its output
cannot receive a usability decision because it has no digest-bound packet and receipt.
`decide` accepts only a separate explicit Muxin usability decision and makes that immutable dossier
usable as an observation, hypothesis, or experiment input, or records revise/reject. Missing
denominators, dates, baseline matches, citations, selection coverage, reviewed originality, or
Muxin authority fail closed. The artifact is body-free and never permits winner claims. This
vertical slice completed the Phase 2 ship predicate on 2026-08-31 with a real question-scoped
dossier, populated reviewed evidence, and Muxin's recorded `hypothesis` disposition. Broader
account/baseline coverage remains incomplete and is continuing evidence expansion, not a reason to
misstate the completed vertical slice as an integrated recommendation engine.

For this increment, the Phase 2 comparison predicate is explicit: every comparison must name its
source/post-level evidence rows, explicit pool membership, popularity and sample scopes, baseline
or denominator, dates, and caveats. An account mapping may be included as a rollup, but it cannot
stand in for any of those evidence rows. If real reviewed account metadata is absent, current live
rows remain `blocked` and no pool comparison or winner claim may proceed.

**Not in scope:** inferring missing pool metadata, training on exact creator text, selecting or
claiming winners, generating body or opener copy, replacing human judgment with ranking, or
generalizing from a single account or small sample.

### Phase 3: Experiment execution

**Ship predicate:** Given qualified evidence and normal Content inputs, Signals ranks one or more
body-free, approval-ready experiment plans. Muxin may approve any subset. Each approved plan creates
an experiment-tagged request through the configured Content generator, which produces bounded
platform/media treatments and puts them `pending` in the ordinary Content queue after the normal
editor and policy gates. Muxin performs final copy review only in Content. Concurrent experiments
retain distinct lineage through review, delivery, provider observations, and outcomes, and Signals
can present a per-experiment interpretation against the original keep/revise/reject rule. Evidence
is the ranked Signals proposal and plan decision, Content request and pending review rows, final copy
decisions, scheduler/provider records, outcome records, and Signals interpretation.

The approval surface must show the motivating observation and evidence, interpretation,
directional falsifiable hypothesis, reason the input is a valid test, controlled variable,
constants, primary success metric and outcome family, guardrails, sample size or duration,
keep/revise/reject decision rule, confidence and caveats, and publishing-capacity rationale. Every
candidate must pass the ordinary Content treatment, platform/media, provenance, CTA, voice, and
blind cold-feed-editor path before the digest-bound experiment proposal is constructed. A manually
supplied comparison or a hypothesis saying only that a treatment may affect outcomes is mechanical
test data, not an approval-ready experiment recommendation.

**Not in scope:** silent platform selection, publishing without approval, auto-replies, or changing
voice/pillars/routing from metrics alone.

The current `src/grow/grow-this-plan.ts` projection makes this lifecycle inspectable in one
conversation without pretending that the downstream systems are wired. It reports stage refs,
human gates, evidence blockers, and the absence of a winner; it does not generate copy, schedule,
publish, or mark an experiment measured merely because a reference exists.

`src/grow/experiment-slice.ts` is the first body-bearing Phase 3 review boundary. It accepts one
explicit raw source, an already-approved readable cut, caller-produced platform treatments, the
selected platform set, a strictly parsed Signals recommendation, editor provenance for every
candidate, experiment variables, and declared review/slot capacity. The body-free Signals science
boundary in `src/review/signals-experiment-recommendation.ts` receives qualified evidence, cut
context, and candidate metadata without candidate prose; it permits an honest no-experiment result
and binds an accepted recommendation to evidence, prompt, and response digests. `propose` rejects
missing or inconsistent science/editor evidence, binds the exact packet to a digest, renders the
static HTML review, and
composes the canonical `grow-capacity-manifest-v1`, `grow-review-bundle-v1`, and
`grow-experiment-v1` records. `decide` requires one explicit Muxin decision per variant and emits
only approved unchanged candidates through canonical `grow-delivery-record-v1` records. An edit is
recorded as `needs-another-pass` and must enter a fresh validated proposal before delivery. No
record claims a queue row, scheduler slot, provider object, publication, measurement, or winner.
The generated static HTML now owns the item-level review handoff as well: every candidate requires
one unselected Muxin decision, edits require a complete replacement body, and the page can copy or
download the exact digest-bound `GrowExperimentDecisionInput` JSON. The page is local and
dependency-free; exporting a decision changes no repository or provider state, and the existing
`decide` command still performs the authoritative digest, authority, capacity, voice, CTA, and
completeness validation.
`src/grow/experiment-queue-handoff.ts` is the explicit next boundary. It rebuilds that digest-bound
decision, admits only unchanged variants Muxin marked `approved`, writes their exact bodies and
lineage into the canonical Content derivative folder, appends one `approve` row per variant under
a folder lock, and immediately reconciles the rows through the existing Grow queue/delivery
binding. The handoff is byte-idempotent and rejects row or asset conflicts before its first write.
`npm run grow:experiment-handoff` previews by default; `--apply` is required for filesystem writes.
Neither mode claims a slot, contacts a provider, or publishes. A ready binding requires explicit
total, scheduled, and available slot facts; the older remaining-capacity-only packet stays honest
and cannot be promoted to a fully bound delivery merely because a number was present.

`src/grow/experiment-scheduling.ts` closes the deterministic scheduler-record seam without
weakening that gate. It accepts only an unchanged handoff candidate whose canonical queue row is
still explicitly `approve`, rechecks the exact derivative bytes, and dispatches through Studio's
existing attempt-ledgered `scheduleApprovedOnce` boundary. It then re-reads the queue and binds the
observed provider object, exact claimed ISO time, and publish lineage into the Grow delivery
record. Failed or uncertain calls remain blocked evidence and never become fabricated scheduled
state. The legacy publisher adapters now return their exact claimed timestamp in addition to the
human display label. `npm run grow:experiment-schedule` is preview-only by default; the explicit
`--schedule` flag is required before it applies the handoff or contacts a provider. No path
auto-approves or treats provider acceptance as confirmed publication.

`src/grow/experiment-run.ts` closes the next evidence transition. Given the original proposal,
its complete digest-bound Muxin decision, and one or more successful scheduler observations, it
revalidates approval, exact lineage, provider references, claimed times, and delivery identity,
then emits the canonical `running` experiment record. Only variants actually observed as
scheduled are included. `npm run grow:experiment-run -- --input <envelope.json>` is read-only: it
does not contact providers, alter the queue, infer outcomes, select a winner, or create a Venture
handoff. Failed, duplicate, drifted, unapproved, or pre-decision observations fail closed.

The retained real packet preserves useful science input, raw response, parsed recommendation
provenance, and cold-feed-editor evidence under `docs/reviews/`; Muxin approved its rationale on
2026-08-31. Its separate body-bearing item review is now historical vertical-slice evidence, not the
target product workflow. Phase 3 remains incomplete until plan approval feeds the canonical
configured Content generator, produces ordinary `pending` review rows, supports multiple active
experiment identities, and later returns grouped outcome evidence to Signals.

### Phase 4: Cross-system learning and Venture handoff

**Ship predicate:** Given measured Content variants, qualified comments, funnel events, and business
outcomes, Signals may propose a caveated handoff to a named Venture with provenance, scope, sample
size, and decision context. Muxin decides whether to adopt, decline, or request more evidence, and
Venture's own gate decides whether the input becomes a Venture artifact or phase transition.
Evidence is the linked signal, decision record, Venture artifact, and approval record. The owner is
Venture only after Signals has produced qualified inputs and Muxin has approved the boundary crossing.

This cross-system phase is not Venture's internal survey workflow. Surveys created for a Venture
remain inside that named Venture and help test its market, reader-problem, product, offer, and
demand hypotheses. Venture owns survey design, response intake, clustering, interpretation, and
phase decisions. Shared Experiment machinery may help deliver probes or preserve attribution, but
content-growth success criteria cannot replace the Venture's market-learning criteria. A Venture
finding reaches Signals or becomes a general Content rule only through a separate reviewed handoff
that retains venture identity, evidence, sample size, scope, and caveats.

The current side-effect-free bridges are `src/review/learning-packet.ts`,
`src/grow/comment-learning.ts`, and `src/grow/learning-bundle.ts`. They are review views, not
automatic handoffs: they keep observation, interpretation, Muxin's decision, and Venture's gate
separate. A comment can inform a product or lead hypothesis, but cannot by itself establish
willingness to pay or unlock Venture. The learning bundle can add reviewed feed context, but that
context remains descriptive until a qualified funnel or business basis and the human gates exist.
`src/grow/venture-handoff.ts` accepts an explicit bundle/proposal selection when callers are ready
to cross the boundary; it carries only selected proposal metadata and blocks missing,
hypothesis-only, blocked, mismatched, or non-unique selections.
`src/grow/venture-handoff-cli.ts` and `npm run grow:venture-handoff` expose that gate view as
deterministic JSON/Markdown without creating Venture artifacts or sending replies.

**Not in scope:** turning content engagement into proof of demand, bypassing Venture decisions, or
making Venture the owner of every Studio idea.

### Phase contract fields

Every phase record must name the inputs, outputs, owner, human decision, evidence, and non-goals.
The predicates above are the ship contract. A phase is not complete because a script ran, a file
exists, or a model returned a plausible answer. If an input is missing, the output is incomplete or
provisional and the next phase remains locked.

## 10. Coverage matrix: current facts versus target state

Current figures are inventory facts from this branch, not a completeness claim or performance
claim. “Partial” means some supporting material exists, not that the architecture is implemented.

| Area | Current fact | Target state | Status |
|---|---|---|---|
| Seeded targets | 352 rows across 13 configured platforms | Stable, provenance-aware target records with explicit scope and caveats | Partial |
| Corpus | `src/patterns/data-status.ts` reports 499 corpus entries (292 previously collected plus 207 newly admitted; 18 staged duplicates skipped), 292 analyses, 12 baselines, 225 replayable Reddit inbox entries, the derived opener bank, 11 browser artifacts, and 9 RSS artifacts; all are available/parse-clean in the permanent gitignored data checkout, but the report is marked unreviewed | Normalized source/account/evidence catalog with queryable pool membership and reviewed niche/broad/format coverage | Partial |
| Patterns | 31 hook patterns; 8 curated measured/hypothesis metadata rows are seeded in `config/patterns/hook-template-ledger.jsonl`, with `src/patterns/hook-template-ledger.ts` and `patterns:hook-templates` providing the body-free adapter; account/source review rows remain unpopulated | Common hook templates with source citations, adaptation notes, originality review, and original Muxin substance | Partial |
| Platform-viral mechanisms | `src/patterns/platform-treatment-blueprint.ts` validates explicit platform × medium × format rows with niche/broad/format pool, topic, evidence, baseline, and hook/structure/retention/CTA/format mechanism references; current live rows are not populated or review-ready | Reviewed per-platform mechanism rows that drive controlled hook, story, format, and response experiments without claiming universal virality | Scaffolded |
| Full posts | 47 full-post records | Records linked to source, account, pool, metric denominator, and selection reason | Partial |
| Internal candidates versus publish volume | `src/grow/capacity.ts` emits a deterministic, side-effect-free capacity manifest with candidate/approved counts, human capacity, slots, pauses, and rollback conditions; `src/grow/delivery-record.ts` consumes a capacity slice without claiming it; `src/grow/delivery-binding.ts` reconciles that slice with explicit queue/scheduler/provider facts; the experiment queue handoff now requires total/scheduled/available slot facts for a ready live binding | Observe the later scheduler/provider transition and retain its exact capacity facts without allowing accounting to approve or publish | Partial |
| Source-to-publish path | Existing extraction, review, and publish engines; typed `src/grow/variants.ts` and `src/grow/generation-brief.ts` emit provisional no-copy platform/format specifications, `src/grow/volume-plan.ts` allocates those variants into deterministic daily slots, `src/grow/treatment-coverage.ts` reconciles requested treatment cells, `src/grow/draft-batch.ts` fans one thought into unique exact treatment requests, `src/grow/generation-run.ts` records explicit artifact/review references, `src/grow/draft-request.ts` binds one original thought to one treatment without composing copy, `src/grow/grow-this-plan.ts` joins the lifecycle read-only, and `npm run grow:this` exposes the next-action view, while delivery and outcome ledgers preserve the later handoff | One Grow-this conversation from raw thought through approved variants and measured outcomes | Partial |
| Review gate | Human review and publish approval already required; `src/grow/review-bundle.ts` makes evidence, readiness, and Muxin's decision explicit, `src/grow/delivery-record.ts` blocks delivery without it, `src/grow/queue-facts.ts` normalizes facts, `src/grow/live-facts.ts` adapts existing queue/scheduler records, `src/grow/live-reconciliation.ts` composes them without inference, `src/grow/reconciliation.ts` reports drift without repairing it, `src/grow/delivery-binding.ts` performs the exact delivery handoff join, and `src/grow/experiment-queue-handoff.ts` now materializes approved unchanged variants into canonical assets/queue rows and reconciles them | Bind the observed scheduler/provider result after an explicit scheduling action while retaining per-artifact approval | Partial |
| Phase contracts | `src/blueprint/phase-contracts.ts` provides deterministic contract definitions and fact evaluation, while live producers and reviewed data remain separate | The contracts document records executable inputs, outputs, owners, decisions, evidence, non-goals, and failure/pause conditions | Scaffolded |
| Coverage report | `src/patterns/coverage.ts` and `patterns:coverage` emit a deterministic descriptive report; `src/patterns/operator-readiness.ts` adds deterministic ready/blocked coverage by pool, platform, medium, format, and gap; `src/patterns/manual-platform-report.ts` and `patterns:manual-platform-report` summarize collectorless observations; `src/patterns/source-evidence-cli.ts` exposes source/post readiness; `src/patterns/evidence-readiness.ts` composes pool, source, comparison, and operator readiness without side effects | Coverage report becomes a trusted operator view with reviewed account IDs, explicit pool/scope metadata, denominators, and target gaps | Partial |
| Account metadata overlay | `src/patterns/review-metadata.ts` validates human-reviewed account rows, `src/patterns/comparison-readiness.ts` joins them to source/post evidence, `src/patterns/account-table.ts` produces the body-free account/example table, `src/patterns/overlay-coverage.ts` reports per-key mapping status, `src/patterns/review-queue.ts` emits the actionable body-free review handoff, `src/patterns/review-batch.ts` pages unreviewed rows for human processing, `src/patterns/pool-review-handoff.ts` adds account context and explicit pool-choice blockers, `src/patterns/reviewed-evidence-intake.ts` normalizes reviewed account/evidence/baseline rows, `src/patterns/reviewed-evidence-ledger-bridge.ts` projects that intake into append-ready ledger inputs, `src/patterns/reviewed-evidence-ledger-bridge-cli.ts` exposes the projection, `src/patterns/account-review-ledger.ts` persists append-only reviewed account facts, `src/patterns/reviewed-account-registry.ts` resolves one current row per identity and adapts the same facts to downstream consumers, `src/patterns/reviewed-account-registry-report.ts` joins the registry to the account/example table and platform/pool matrix, and `patterns:reviewed-account-registry` exposes the deterministic operator view; live rows are still not reviewed | Human-reviewed rows for account, audience snapshot, topic/focus, platform, medium/format, pool, scope, evidence links, caveats, baseline terms, and review status | Scaffolded |
| Baseline measurement gate | `src/patterns/baseline-gap-report.ts` exposes explicit `/new` measurement gaps, `src/patterns/baseline-repo-report.ts` reads the configured targets and current ledger, `src/patterns/baseline-sample-cli.ts` builds a measured baseline only from an explicit settled sample, `src/patterns/measurement-run.ts` records the route/sample/window/evidence manifest for each run, and `src/patterns/baseline-measurement-ledger.ts` retains caller-supplied baseline facts append-only through injected JSONL I/O; `src/patterns/baseline-measurement-ledger-cli.ts` provides the explicit inspect/append operator path; `src/patterns/review-session.ts` carries the remaining review blockers; the current repo-level report shows 350 handle-bearing targets, 5 already-measured rows, 345 measurement gaps, and 2 intentionally unconfirmed handles | Measured `/new` baselines for every comparison account before any honest multiple or best-per-platform claim | Scaffolded |
| Platform/pool matrix | `src/patterns/platform-pool-matrix.ts` and `patterns:platform-pool-matrix` group only explicit platform, niche/broad/format-pool, medium/format, collection, review, and baseline facts; `src/patterns/platform-pool-matrix-repo.ts` and `patterns:platform-pool-matrix-repo` populate those rows from exact catalog/review/baseline joins while keeping unassigned labels blocked; `src/patterns/pool-review-handoff.ts` and `patterns:pool-review-handoff` expose the account/topic/format context needed to complete those explicit choices; the current repo run has 0 matrix targets and 371 blocked rows because explicit review metadata has not yet been entered | Reviewed platform × pool × format coverage with explicit account examples and no inferred best creator | Scaffolded |
| Best example/creator comparison | `src/patterns/pool-best-report.ts` and `patterns:best-report` compare only reviewed source/post rows with explicit pool, niche label, metric, denominator, selection rule, dates, provenance, body-complete evidence, and recorded baseline terms; `src/patterns/pool-best-ledger-report.ts` and `patterns:best-ledger-report` now feed those comparisons from the append-only account/source ledgers; exact ties remain ties and incomplete or incomparable sets remain blocked | Separate niche and broad-platform best-example/best-creator results with a declared comparison set and no account-size or follower-count ranking | Scaffolded |
| Treatment coverage | `src/grow/treatment-coverage.ts` and `grow:treatment-coverage` reconcile complete platform × medium × format × treatment × experiment-variable identities against candidate metadata; missing, duplicate, blocked, and unexpected cells remain visible and no copy is generated | Every requested treatment cell accounted for before generation/review, with media and volume experiments kept distinct | Scaffolded |
| Generation run | `src/grow/generation-run.ts` and `grow:generation-run` require ready treatment coverage, while `src/grow/draft-batch-run.ts` and `grow:draft-batch-run` bind every draft request to a matching platform slot with explicit artifact and pending-review references; `src/grow/generation-review-delivery.ts` joins those references to reviewed bundles, live queue/scheduler facts, capacity, and delivery bindings; duplicate, mismatched, and blocked metadata remains visible without body copy or side effects | Every planned slot has one reviewable artifact reference and pending human-review reference before review/delivery | Scaffolded |
| Pool-evidence inventory | `pool-evidence-inventory-v1` is deterministic and provisional; `patterns:pool-evidence-cli` exposes explicit catalog/raw-input views, `src/patterns/reviewed-evidence-ledger-bridge.ts` projects reviewed intake without inference, and `src/patterns/source-evidence-ledger.ts` persists reviewed source/post facts append-only, while comparison readiness checks memberships and evidence scopes and keeps missing rows blocked | A complete, reviewed Phase 2 evidence inventory with normalized records, citations, caveats, and originality checks | Scaffolded |
| Research pools | Niche, broad, and format distinction documented; `src/patterns/review-pool-coverage.ts` reports only explicit reviewed labels and keeps metadata coverage separate from comparison readiness; account rows are rollups only | Separate ingestion, ranking, retrieval, and reporting from authoritative source/post-level evidence | Partial |
| Experiment lineage | Phase 3 now carries approved plan identity through canonical Content variants, delivery events, exact provider/analytics matches, and explicitly attributed `data/outcomes.jsonl` facts into a per-experiment Signals read. `src/grow/signals-experiment-performance.ts` requires both controlled arms, every guardrail, sample, and duration; `src/review/signals-experiment-result-store.ts` retains one body-free keep/revise/reject science recommendation plus a separate Muxin review. Existing experiment/outcome adapters still preserve the four outcome families and Venture boundary. No read or review selects a winner. | Link experiment records to comments, funnel events, Signals, and Venture without collapsing outcome families | Implemented for the Signals content-growth loop; broader external outcome ingestion remains partial |
| Venture handoff | Venture has its own phases and gates; side-effect-free learning packet, `src/grow/comment-learning.ts`, `src/grow/learning-bundle.ts`, bundle-aware `src/grow/venture-handoff.ts`, and Content-owned `src/grow/venture-input.ts` preserve qualified observations, body-free source pointers, product/lead hypotheses, reviewed feed context, selected proposal metadata, and dual human gates | Qualified, caveated inputs with human adopt/decline and shared Content path | Partial |
| Human Inference lanes | Adjacent lanes identified as hypotheses | Lane-level tests and enough evidence to keep, revise, or retire a hypothesis | Target |
| Model boundaries | Subscription-first and human approval rules exist; `src/agents/model-boundary.ts` records bounded role/task/route/audit facts, `src/agents/skill-contract.ts` records the lightweight stage boundaries, and `src/agents/skill-invocation.ts` records key-only readiness; all permit common-hook mad-lib adaptation without creator-body copying | Logged model/subagent roles, bounded briefs, and auditable outputs | Partial |

This blueprint does not authorize implementation by itself. Each future change should name the
phase, artifacts, acceptance predicate, human decision, and explicit non-goals it satisfies.
