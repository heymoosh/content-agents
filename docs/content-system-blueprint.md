# Content system blueprint

**Status:** Directional architecture and execution contract, 2026-08-23
**North star:** Grow-this is one conversation that turns Muxin's raw thought into a reviewed,
learnable set of platform treatments. It is not an autopilot, a universal virality engine, or a
claim that the current corpus is comprehensive.

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
| Pattern | A structural description of an observed mechanism: hook family, sequence, pacing, tension, CTA shape, or visual treatment. It is not creator-copy substitution. |
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

## 3. Research and evidence architecture

The catalog is a shared index, not a promise of representative coverage. A source/account record
should preserve creator/account, platform and handle, source kind, URL, collection date, original
date, audience size/type when known, topics, lane, medium, format, exact evidence location,
provenance, and caveats. Metrics must preserve the numerator, denominator, observation window, and
comparison group.

Keep three research pools separate, with separate labels and retrieval/ranking:

1. **Niche pool:** unusually strong examples for the relevant topic, audience, or community.
2. **Broad platform pool:** examples selected to understand platform-wide behavior, even when the
   topic is unrelated.
3. **Format pool:** examples selected for mechanics of a medium or format, such as short video,
   quote card, carousel, thread, or newsletter opening.

A record can appear in more than one pool only with an explicit reason. Pool membership is not a
quality score, and evidence from one pool cannot silently stand in for another.

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

### Exact-hook and mad-lib boundary

The system may abstract a hook family, opener shape, rhythm, sequence, tension, or CTA pattern and
adapt that structure to Muxin's own claim and voice. A generated variant must be materially
original, traceable to Muxin's source or a declared Venture exception, and checked for voice and
originality before review.

Live verbatim opener storage and remix mode may retain exact creator text for internal analysis or
licensed/attributed exceptions, but Grow's default generation path is mad-lib-originality: copy is
structurally inspired and materially original.

It may not turn an identifiable creator's wording into a noun-swapped template, preserve a
distinctive phrase sequence, or draft from exact creator text. Exact text is analysis, quotation,
or licensed material only. Pattern records describe structure, trigger, pacing, context, and
conditions of success. They do not store substitution-ready copy banks.

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

**Grow-this** is the surface contract. It coordinates one conversation and exposes only the next
decision. It does not replace the engines below it.

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

### Workstream dependency order

Build the workstreams in this order. Later workstreams may consume earlier artifacts, but may not
pretend that a target contract exists while its producer is still current-state or partial.

```text
coverage/catalog
  -> pool evidence
  -> Grow variants
  -> review/publish
  -> comments/Signals
  -> Venture
```

1. **Coverage/catalog** establishes stable IDs, account mappings, source records, and honest
   current-versus-target coverage. It is the inventory foundation.
2. **Pool evidence** adds bounded evidence, pool membership, denominators, dates, selection rules,
   and caveats. It may identify hypotheses, not manufacture winners.
3. **Grow variants** turns an approved source or raw thought into cuts and platform treatments,
   retaining lineage, variables, rationale, and the mad-lib originality boundary.
4. **Review/publish** exposes decisions, enforces human approval, claims only valid platform slots,
   and records scheduling and delivery outcomes.
5. **Comments/Signals** links post and conversation observations, funnel events, and experiments
   without collapsing attention into demand or strategy proof.
6. **Venture** receives only qualified, caveated inputs and remains governed by its own decision and
   approval gates.

The dependency order is a sequencing constraint, not a claim that each workstream is currently
implemented. A later workstream can be prototyped with explicit fixtures, but its output must be
labelled provisional and must not be presented as live evidence.

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
  approve, alter the canonical voice/config, or invent missing facts.

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

**Not in scope:** training on exact creator text, replacing human judgment with ranking, or
generalizing from a single account or small sample.

### Phase 3: Grow-this experiments

**Ship predicate:** Given one raw input, a selected platform set, available evidence, and the
configured review and slot capacity, the owner produces a readable cut, bounded platform/format
variants, a review bundle, and publish-ready records. Each output retains lineage, experiment
variables, treatment rationale, evidence status, and pending decisions. Muxin decides which items
are approved, edited, rejected, or sent for another pass. Evidence is the cut, variant bundle,
decision record, scheduler record, and any outcome record. The owner is Grow variants, with
review/publish owning the approval and delivery gate.

**Not in scope:** silent platform selection, publishing without approval, auto-replies, or changing
voice/pillars/routing from metrics alone.

### Phase 4: Venture learning

**Ship predicate:** Given measured variants, qualified comments, funnel events, and business
outcomes, the owner produces a caveated Venture input with provenance, scope, sample size, and
decision context. Muxin decides whether to adopt, decline, or request more evidence, and Venture's
own gate decides whether the input becomes a Venture artifact or phase transition. Evidence is the
linked signal, decision record, Venture artifact, and approval record. The owner is Venture after
comments/Signals has produced qualified inputs.

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
| Corpus | 292 entries across 13 corpus platforms | Normalized source/account/evidence catalog with queryable pool membership | Partial |
| Patterns | 31 hook patterns | Structural patterns with source citations, originality review, and no substitution copy | Partial |
| Full posts | 47 full-post records | Records linked to source, account, pool, metric denominator, and selection reason | Partial |
| Internal candidates versus publish volume | Current systems generate or queue artifacts in several places, but do not yet expose one shared capacity view | Separate candidate counts from approved publish counts, with human capacity, platform slots, pauses, and rollback records | Target |
| Source-to-publish path | Existing extraction, review, and publish engines | One Grow-this conversation from raw thought through approved variants and measured outcomes | Partial |
| Review gate | Human review and publish approval already required | Explicit per-artifact states, rationale, lineage, and no-AI-smell check | Partial |
| Phase contracts | This blueprint names broad phase outcomes; the parallel contracts document is not yet treated as an implemented runtime contract | `docs/content-system-contracts.md` records executable inputs, outputs, owners, decisions, evidence, non-goals, and failure/pause conditions | Target |
| Coverage report | `src/patterns/coverage.ts` and `patterns:coverage` now emit a deterministic descriptive report over the catalog; it is a scaffold, not a completeness claim | Coverage report becomes a trusted operator view with reviewed account IDs, explicit pool/scope metadata, denominators, and target gaps | Partial |
| Research pools | Niche, broad, and format distinction documented | Separate ingestion, ranking, retrieval, and reporting | Target |
| Experiment lineage | Metrics and bets exist in specialized systems | Variant-level variables linked to comments, funnel events, Signals, and Venture | Target |
| Venture handoff | Venture has its own phases and gates | Qualified, caveated inputs with human adopt/decline and shared Content path | Partial |
| Human Inference lanes | Adjacent lanes identified as hypotheses | Lane-level tests and enough evidence to keep, revise, or retire a hypothesis | Target |
| Model boundaries | Subscription-first and human approval rules exist | Logged model/subagent roles, bounded briefs, and auditable outputs | Partial |

This blueprint does not authorize implementation by itself. Each future change should name the
phase, artifacts, acceptance predicate, human decision, and explicit non-goals it satisfies.
