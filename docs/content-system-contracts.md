# Content system record contracts

**Status:** architecture contract, 2026-08-23. This document makes
`docs/content-system-blueprint.md` implementable. It does not authorize an
implementation or change the blueprint.

## 1. Status vocabulary and common rules

Each record has an immutable `id`, `record_type`, `schema_version`,
`created_at`, `updated_at`, and `status`. IDs are opaque and stable. Records
are append-only events or versioned snapshots. A correction creates a new
record or revision and points to `supersedes_id`; it does not erase evidence.

The status below is the architecture status of the record, not its workflow
status:

| Architecture status | Meaning |
| --- | --- |
| `current` | A usable equivalent already exists in the repository or its established artifacts. |
| `scaffolded` | The concept or partial fields exist, but the normalized record and joins are not complete. |
| `future` | Required by the target architecture and not yet implemented. |

Workflow statuses are record-specific. Unless a contract says otherwise,
`draft`, `needs-human-judgment`, `approved`, `rejected`, `scheduled`,
`published`, and `measured` are valid lifecycle states. Generation never means
approval. `rejected` is terminal for that revision; a new attempt gets a new
ID.

Common field rules:

- `owner` is the role accountable for correctness, not the process that writes
  the row. `system` may validate or derive, but cannot make a human gate
  decision.
- `lineage` is an array of typed references: `{record_type, id, relation}`.
  Required parent references are listed below. Broken references block
  approval and publication.
- `evidence_refs` names bounded evidence records or source locations. A claim
  without evidence is either a declared `hypothesis` or blocked.
- Use `null` for not collected, not applicable, or not yet normalized. Use
  `unknown` only after the field was checked or considered and cannot be
  determined. Never use an empty string or zero to mean missing. A numeric
  zero is valid only when observed and accompanied by its denominator and
  window.
- `observed_at` is when the thing happened or was measured; `collected_at` is
  when the system recorded it. Never substitute one for the other.
- Unknown attribution is honest data: `content_item_id: null` requires an
  `unattributed_reason`. Missing attribution is not silently dropped.
- Every metric carries `metric`, `value`, `unit`, `numerator`, `denominator`,
  `window`, `scope`, and `observed_at`, or those fields are explicitly
  `unknown`.

Human gates are explicit records or decisions with `decided_by: muxin`,
`decided_at`, and an optional note. A model, script, subagent, or prior
approval cannot stand in for Muxin.

## 2. Core records

### `source` (current, normalized target scaffold)

Owner: `research` for external material, `muxin` for supplied material.

Required fields:

```text
id, source_kind, locator, title, author_or_account, platform, original_at,
collected_at, provenance, body_is_complete, pool_memberships, scope,
topics, caveats, status, lineage
```

`locator` is a URL or repository path. `source_kind` includes `raw_thought`,
`essay`, `note`, `post`, `video`, `comment`, and `research_item`.
`body_is_complete: false` prevents treating a title, caption, or SEO text as
the source's substance. A source may be retained with incomplete body data.
`pool_memberships` contains zero or more of `niche`, `broad`, and `format`,
each with a reason. Pool membership is not a quality score.

### `claim` (scaffolded)

Owner: `muxin` for final assertion; `system` may extract a candidate.

Required fields:

```text
id, proposition, claim_kind, origin_type, source_refs, evidence_refs,
lane, audience, scope, caveats, status, lineage
```

`claim_kind` is `observed`, `inferred`, or `hypothesis`. `origin_type` is
`studio`, `venture`, or `external_observation`. A studio claim must point to
source lines or a declared hypothesis. A Venture claim must use Venture's
evidence references and cannot become a proven claim from engagement alone.
`status` is `candidate`, `human-confirmed`, `reframed`, or `rejected`.
Human confirmation is required before a claim enters an approved cut.

### `cut` (scaffolded, with current extraction equivalents)

Owner: `content/develop`; Muxin owns the message decision.

Required fields:

```text
id, message_id, source_refs, claim_refs, selected_lines, excluded_lines,
text_or_blocks, origin_type, lane, audience, cta, evidence_status,
originality_check, status, lineage
```

`selected_lines` is required for Muxin-voice text and image derivatives.
The cut may select, order, and lightly trim source words, but may not invent a
claim. `claim_refs` maps each concrete factual claim to a source or evidence
reference. `evidence_status` is `supported`, `hypothesis`, `insufficient`, or
`blocked`. `originality_check` records checker, date, and result.

### `content_item` (scaffolded; legacy content remains readable)

Owner: `content` for lineage and state; Muxin owns editorial approval.

Required fields:

```text
id, message_id, item_kind, origin_type, primary_item_id, parent_item_id,
venture_id, venture_phase, pillar, cta_id, lead_magnet_id, offer_id,
rules_version, cut_ref, claim_refs, status, lineage
```

`item_kind` is `primary`, `derivative`, or `venture_artifact`. A primary has
`primary_item_id: null`; every derivative points to the primary and its
immediate parent. Non-Venture content has `venture_id` and `venture_phase`
`null`. `status` uses the common workflow states. Legacy rows keep their
existing status and are not silently rewritten; adapters may expose null
fields until migration.

### `variant` (scaffolded; provisional manifest exists)

Owner: `atomize` for construction; Muxin owns treatment and editorial approval.

Required fields:

```text
id, content_item_id, cut_id, platform, medium, format, treatment_reason,
copy_or_asset_ref, source_refs, claim_refs, pattern_refs, experiment_id,
variables, cta, voice_check, originality_check, status, lineage
```

`platform`, `medium`, and `format` are separate. `treatment_reason` explains
why this platform-format choice serves the message. `variables` declares the
comparison dimensions, such as hook family, angle, length, CTA, timing, and
visual treatment. A variant cannot become `approved` unless lineage, claim
refs, treatment reason, evidence status, voice check, and originality check
are present. Approval is per variant or an explicitly named bundle.

`src/grow/variants.ts` currently emits a no-copy `grow-variant-manifest-v1`
with source descriptor provenance, platform/medium/format, treatment reason,
pattern/evidence references, experiment values, and `needs-human-review`
status. It is an inspectable planning artifact only. It does not read source
bodies, generate copy, create review-queue rows, schedule, publish, or claim
that a variant is approved.

### `experiment` (scaffolded)

Owner: `signals`; Muxin owns the question and adoption of the conclusion.

Required fields:

```text
id, question, hypothesis, unit, comparison, variable_names, platform_scope,
audience_scope, success_observations, minimum_sample, review_rule,
start_at, end_at, variant_refs, outcome_refs, status, lineage
```

`comparison` names the control or baseline and treatment. It must not compare
selected winners to selected winners without a denominator. `status` is
`proposed`, `running`, `closed`, or `insufficient-evidence`.

## 3. Conversation records and human reply gate

### `comment_observation` (scaffolded)

Owner: `signals`; Muxin owns interpretation and any reply.

Required fields:

```text
id, published_variant_id, platform, author_or_hash, observed_at,
collected_at, text_or_excerpt, context, theme, sentiment, question_or_objection,
evidence_quality, response_status, status, lineage
```

`response_status` is `none`, `candidate`, `approved-task`, `sent`, or
`declined`. A comment is an observation, not proof of demand, willingness to
pay, audience fit, or a Venture gate. `author_or_hash` is redacted when
identity is not needed.

### `approved_reply_task` (future)

Owner: `content` for preparation; Muxin owns approval and sending.

Required fields:

```text
id, comment_observation_id, draft_text, reply_purpose, claim_refs,
target_platform, human_decision, decided_by, decided_at, delivery_status,
sent_at, status, lineage
```

`human_decision` is `approve` or `decline`. No auto-reply exists. Approval is
specific to this draft, target, and context. `delivery_status` may not be
`sent` unless the human decision is `approve`; `sent` records a confirmation,
not an assumption.

## 4. Outcomes and Signals

### `funnel_event` (scaffolded; Venture has a related contract)

Owner: `measurement`; attribution is evidence, not inference.

Required fields:

```text
id, event_type, occurred_at, collected_at, respondent_hash, value,
source_note, attribution, evidence_refs, status, lineage
```

`event_type` is `visit`, `opt_in`, `survey_response`, `qualified_inquiry`,
`call`, `opportunity`, or `purchase`. Each attribution entry has
`content_item_id`, `touch_type` (`first`, `last`, `assisted`, `self_reported`,
or `unknown`), `touch_at`, and `confidence`. An `unknown` touch requires
`content_item_id: null` and `unattributed_reason`; all other touch types
require a content item. `value` is null when not applicable, not zero.

### `business_outcome` (future)

Owner: `measurement`; Muxin confirms material business facts.

Required fields:

```text
id, outcome_type, occurred_at, value, currency, qualification,
content_item_refs, funnel_event_refs, evidence_refs, caveats, status, lineage
```

`outcome_type` is `qualified_inquiry`, `call`, `opportunity`, `purchase`,
`retention`, or `lost`. It is separate from engagement and cannot be inferred
from reach, likes, or comments. `qualification` records the rule used and
whether it is `confirmed`, `self-reported`, or `unknown`.

### `signals_proposal` (future)

Owner: `signals` proposes; Muxin adopts or declines.

Required fields:

```text
id, proposal_kind, statement, outcome_family, evidence_refs, sample_scope,
denominator, caveats, affected_scope, proposed_change, human_decision,
decided_by, decided_at, status, lineage
```

`outcome_family` is exactly one of `attention`, `conversation`, `audience`,
or `business`. These families are reported separately, never averaged into a
single success score. `human_decision` is `adopt`, `decline`, or `defer`.
Until `adopt`, a proposal cannot change routing, voice, pillars, experiment
defaults, or strategy. Decline preserves the evidence and rationale.

## 5. Venture boundary

### `venture_input` (scaffolded)

Owner: `content` packages; Venture owns acceptance under its current phase.

Required fields:

```text
id, venture_id, phase, input_kind, source_record_refs, evidence_refs,
content_item_refs, scope, sample_size, provenance, caveats,
content_human_decision, venture_gate, venture_decision, status, lineage
```

`input_kind` is `pattern`, `comment`, `audience_observation`, `funnel_event`,
or `business_outcome`. `content_human_decision` must be `approved` before
handoff. `venture_gate` names the required Venture evidence predicate and
must include its rules version. `venture_decision` is null until Venture's
own phase gate records `accepted`, `rejected`, or `needs-more-evidence`.

This record is a pointer and evidence packet, not a phase unlock. It cannot
create a Venture decision, artifact, response gate, checkpoint, or publish
approval. Venture's response, decision, artifact, editorial, delivery, and
checkpoint gates remain authoritative. Venture-originated content still
creates normal `cut`, `content_item`, `variant`, and human-review records.

## 6. Platform, format, and pattern evidence

### `pool-evidence-inventory-v1` (scaffolded; provisional)

Owner: `pool evidence`; the artifact is an inspectable inventory, not a human
judgment or approval record. Its provisional source module is
`src/patterns/pool-evidence.ts`. For the same catalog snapshot and invocation
inputs, the producer must emit the same row content and ordering.

The provisional serialized output requires:

```text
rows, summary
```

Each row requires:

```text
accountId, platform, handle, creator, niche, topics, focus, formats, audience,
pool, membershipReason, popularityScopes, sampleScopes, baselineSources,
evidenceCount, admissibleCount, bodyCompleteCount, bodyIncompleteCount,
caveats, readiness
```

`summary` requires `poolCounts` for `niche`, `broad`, and `format`, plus
`blockedAccounts`. `pool` is one of `niche`, `broad`, or `format`, or `null`
for a blocked row. It is explicit-membership-only: the producer may copy it
only from explicit `research_pool`/`research_pools` metadata. It must not
infer membership from a name, niche, topic, format, metric, ranking, body, or
model judgment. Multiple rows for one account are valid only for separately
explicit memberships; unsupported pool labels do not create rows. The
producer sorts rows and pool values deterministically. Nulls and empty lists
follow the common missing-data policy; the counts are descriptive inventory
facts, not metric judgments.

Rows with missing required pool metadata remain in the artifact with
`pool: null`, `membershipReason: null`, and `readiness.status: blocked`, with
the reason explaining that the membership was not inferred. They are not
dropped, assigned a pool, or used in a pool-specific comparison. The artifact
has no inference, no winner selection or winner claim, and no body generation
as non-goals. It carries body-completeness counts only; it does not draft or
rewrite a body, hook, opener, or exact creator wording.

This is a Phase 2 scaffold, not completion of Phase 2. It makes membership,
provenance, gaps, and blocked work deterministic and reviewable; it does not
by itself provide the normalized evidence set, reviewed summaries and
selection rules, source citations, originality checks, or Muxin's decision
required by the Phase 2 ship predicate. It cannot unlock Grow variants or
support a winner claim. The common-hook policy remains available downstream:
a common, widely shared hook template may be adapted as a mad-lib around
Muxin's own substance, but exact opener generation and distinctive creator
wording are not default generation behavior.

Every `variant` must carry the following treatment object:

```text
{
  platform, medium, format, treatment_reason, audience_scope, cta,
  experiment_id, variables, pattern_refs, evidence_status
}
```

`platform` is the distribution surface, `medium` is text/image/video/audio,
and `format` is the platform-native shape such as thread, note, quote-card,
carousel, or short. Routing decides what may be generated or queued. It does
not approve publication. A missing or `unknown` treatment reason blocks
approval; an unavailable platform may be represented with status
`not-routed`, not by fabricating a variant.

Each `pattern_evidence_ref` is:

```text
{ pattern_id, source_id, evidence_location, pool, scope, metric_snapshot,
  selection_rule, originality_review, caveats }
```

`pool` is `niche`, `broad`, or `format`; `scope`, denominator, dates, and
caveats are required. A pattern describes a reusable mechanism and its mad-lib
slots. Common, widely shared hook templates may be adapted into Muxin's own
wording and substance. Distinctive creator-specific phrase sequences, bodies,
stories, claims, and examples may not be copied with nouns swapped. Exact
creator wording remains analysis, quotation, attribution, or a licensed
exception, not the default generated output. A single sighting may motivate a
hypothesis but cannot be called a general rule.

## 7. Compact end-to-end lifecycle

```text
source s1 (raw thought, complete, studio)
  -> claim c1 (human-confirmed, source_lines=s1)
  -> cut k1 (selected_lines=s1, claim_refs=c1, draft)
  -> content_item i1 (primary, studio, k1)
  -> experiment e1 (question: hook A vs B, review rule declared)
  -> variant v1 (Substack/text/post, treatment_reason, e1, pattern_ref=p7)
  -> human gate: Muxin approves v1
  -> publish record for v1 (scheduled, then published)
  -> comment_observation co1 (question, response_status=candidate)
  -> funnel_event f1 (qualified_inquiry, attribution v1, confidence=medium)
  -> business_outcome b1 (qualified_inquiry, evidence_refs=f1)
  -> signals_proposal sp1 (business, evidence co1/f1/b1, status=proposed)
  -> human gate: Muxin adopts sp1
  -> venture_input vi1 (caveated packet, content approved, Venture gate named)
  -> Venture gate accepts or requests more evidence
```

At no point does a comment become a reply, a signal become a strategy change,
or a Venture input become a Venture decision without its named human or
phase-specific gate.
