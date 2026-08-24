# Content system record contracts

**Status:** architecture contract, scaffolded, 2026-08-23. This document makes
`docs/content-system-blueprint.md` implementable. It does not authorize an
implementation or change the blueprint.

The account metadata overlay and source/post comparison boundary in this
document are scaffolds, not live reviewed data. Current live rows remain
blocked until real, human-reviewed metadata is entered.

The gitignored mined-data checkout currently has a metadata-only readiness
report: 499 corpus entries (292 previously collected plus 207 newly admitted; 18 staged duplicates skipped), 292 analyses, 12 baseline records, 225 staged
Reddit inbox entries, 11 browser artifacts, and 9 RSS artifacts. These counts
are available and parse-clean in the inspected checkout, but
`reviewStatus: unreviewed` remains authoritative. The report does not expose
body text and does not establish best creators, platform-wide winners, or
reviewed account metadata.

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

### `account_metadata_overlay` (scaffolded)

Owner: `coverage/catalog`; Muxin owns the review decision. This is a
human-reviewed overlay on an account mapping, not inferred enrichment. A
script may normalize handles, validate shapes, join evidence, and calculate a
rollup. It may not infer metadata or `review_status` from an account name,
post metrics, ranking, or model judgment.

Required fields:

```text
id, account_id, account, audience_size_snapshot, topics, focus, platform,
medium, format, pool, popularity_scope, sample_scope, baseline_scope,
baseline_source, evidence_links, caveats, review_status, review_note,
reviewed_by, reviewed_at, status, lineage
```

`account` contains the stable platform-local handle and display creator or
account name. `audience_size_snapshot` preserves the audience value and type,
observation date, collection date, and evidence source. `pool` is explicit
`niche` or canonical `broad` membership, displayed as broad-platform; a
separately declared `format` pool may also be represented by the source/post
evidence. `evidence_links` points
to the source/post-level records that support the row. `review_status` is
`pending`, `reviewed`, `blocked`, or `unmapped`; only Muxin may set
`reviewed`. The common `null`/`unknown` policy applies to every field.

The overlay is a rollup and navigation surface only. It cannot create a
source, post, metric, denominator, pool membership, or comparison sample.
Rows without real reviewed metadata remain `blocked` and cannot support a
pool comparison or winner claim.

`src/patterns/account-review-ledger.ts` is the append-only persistence seam
for these human-reviewed rows. It retains account size, audience, topic/focus,
medium/format, explicit pool memberships, scopes, baseline/evidence refs,
caveats, reviewer, and review status without storing creator bodies. It
rejects duplicate identities, in-place edits, inferred values, ranking,
winner, model, and body fields while keeping pending, blocked, and unmapped
rows visible. `src/patterns/account-review-ledger-cli.ts` and
`npm run patterns:account-review-ledger` expose deterministic JSON/Markdown
inspection and append behavior over an explicit injected/local ledger.

### `source_post_evidence` (scaffolded; typed inventory adapter exists)

Owner: `pool evidence`; the source/post row is the authoritative comparison
unit. An account mapping may link and roll up these rows, but it cannot replace
one.

Required fields:

```text
id, source_id, post_id, account_id, platform, medium, format, pool,
membership_reason, audience_size_snapshot, metric_snapshot,
popularity_scope, sample_scope, baseline_scope, evidence_links,
baseline_source, body_is_complete, caveats, provenance, observed_at,
collected_at, review_status, status, lineage
```

At least one of `source_id` or `post_id` is required. A comparison may count a
row only when its pool membership, metric snapshot, declared scopes,
baseline or denominator, dates, provenance, and caveats are present. Account
rows may report rollup counts, but the underlying source/post rows and their
selection rule remain authoritative.

The current adapter is `src/patterns/source-evidence.ts`. It normalizes the
explicit fields available in the corpus and analysis inputs, preserves
unknowns as `null` or an explicit blocked status, and never serializes the
source body. It may emit one row per explicitly reasoned pool membership. A
`ready` row means only that the evidence packet is structurally admissible for
human comparison; it is not a winner claim, a pattern approval, or permission
to reuse creator wording.

`src/patterns/comparison-readiness.ts` is the pure join boundary from reviewed
account metadata to source/post evidence. It checks that platform, medium,
format, and explicit pool membership agree, and independently re-validates the
complete source-evidence identity, scope, provenance, dates, audience, metric,
caveat, body-completeness, and lineage fields. It preserves blocked rows for
human review. Its output contains no body text, never assigns a pool from a
rank or name, and cannot select a winner or authorize generation.

`src/patterns/operator-readiness.ts` consumes that inventory to expose
deterministic ready/blocked coverage by pool, platform, medium, and format,
plus the blocking gaps that must be resolved before a comparison can be
called complete. It is an operator view only: it carries no winner field,
does not promote a row, and does not include source body or copy.

`src/patterns/source-evidence-cli.ts` and `npm run patterns:source-evidence`
provide the read-only command adapter. It accepts one explicit JSON/file
envelope containing `corpus` and `analyses`, renders JSON, Markdown, or both,
and preserves explicit pool, scope, metric, provenance, review, and readiness
blockers without emitting body fields or inferring winners.

`src/patterns/source-evidence-ledger.ts` adds the append-only reviewed-evidence
boundary for durable source/post comparison rows. It stores stable evidence
identity, explicit pool/topic/focus/format, metric and denominator facts,
popularity/sample scope, dates, selection rule, provenance, baseline/evidence
refs, body-completeness status, review status, and caveats, but no creator body.
`src/patterns/source-evidence-ledger-cli.ts` and
`npm run patterns:source-evidence-ledger` provide deterministic inspection and
append operations. Duplicate IDs, in-place edits, missing comparison facts,
inferred membership, body/model/PII/ranking fields, and winner claims fail
closed; blocked and unreviewed rows remain visible.

`src/patterns/reviewed-evidence-ledger-bridge.ts` is the pure projection from
the existing `reviewed_evidence_intake` report into append-ready account and
source-ledger inputs. It carries the intake's explicit readiness blockers,
keeps pending, blocked, and unmapped dispositions visible, and never supplies
missing identity, pool, baseline, or review facts. It owns no file or database
write; the ledger append boundary remains the caller's explicit decision.
`src/patterns/reviewed-evidence-ledger-bridge-cli.ts` provides a deterministic
JSON/Markdown inspection of that projection. It accepts one explicit report,
preserves separate evidence links and refs, and does not persist or promote rows.

`src/patterns/ledger-account-example-table.ts` is the durable producer/consumer
join after those ledgers exist. It reads current account-review corrections and
source-evidence rows, feeds them through the strict comparison-readiness join,
and emits the body-free account/example table with explicit account size,
topics, focus, platform, medium, format, pool, scopes, citations, caveats, and
blocked state. Source/post scope and metric facts remain authoritative; account
metadata cannot overwrite them. The adapter accepts JSONL text or validated
ledger objects, does not infer a pool or winner, and exposes no creator body.
`src/patterns/ledger-account-example-table-cli.ts` and
`npm run patterns:ledger-account-example-table` provide the file-based operator
view from an account ledger and source ledger.

### `baseline_measurement_ledger` (scaffolded; append-only JSONL seam exists)

Owner: `research` collects the measurement; Muxin owns review. This ledger
records only caller-supplied settled `/new` facts. It does not fetch, calculate,
infer, rank, select, or rewrite the existing baseline store.

Required fields:

```text
id, account_id, platform, route=/new, settled=true, sample.window_start,
sample.window_end, metric.name, metric.numerator, metric.denominator, method,
observed_at, collected_at, baseline_scope, baseline_source, evidence_refs,
reviewer_status, unavailable_reason
```

`src/patterns/baseline-measurement-ledger.ts` keeps incomplete, manual, and
unavailable facts as blocked rows with explicit blockers. A fact is ready only
when the sample window, metric denominator, method, dates, scope/source,
evidence refs, and reviewed status are present. The injected JSONL adapter
appends one validated fact at a time and rejects duplicate IDs or malformed
rows; it does not mutate the established baseline data.
`src/patterns/baseline-measurement-ledger-cli.ts` exposes deterministic JSON or
Markdown inspection and an explicit one-fact append command. It requires a
caller-supplied path and fact, and performs no measurement, calculation, or
inference.

### `account_example_table` (scaffolded; pure projection exists)

`src/patterns/account-table.ts` projects the reviewed account overlay and
comparison-readiness rows into the requested account/example table. Each row
preserves account size snapshot, topics, focus, platform, medium, format,
explicit niche/broad/format pool, popularity/sample/baseline scopes, evidence
links, caveats, and review status. It keeps incomplete or unjoined examples
visible and blocked. It never derives a pool, copies a body, or selects a
winner. The source/post evidence row remains authoritative for comparison
scopes and caveats; account-overlay values never overwrite its denominators.

`src/patterns/overlay-coverage.ts` reports one deterministic status per
current catalog account key, including duplicate or missing mappings, stable
ID presence, missing overlay fields, and linked comparison-evidence readiness.
An unmapped key remains visible as `unmapped`; a row with incomplete metadata
or duplicate mappings is `blocked`. The report is a coverage diagnostic, not
an inferred completion claim or a winner table.

`src/patterns/review-queue.ts` joins that coverage to the current catalog and
emits one body-free review handoff row per account key. It preserves the
explicit status and evidence count, reports the next human review action, and
keeps absent rows unmapped rather than inferring metadata. It is an operator
queue, not a reviewed account table, winner ranking, or approval action.

`src/patterns/review-status.ts` is the read-only operator entry point. It
accepts an explicit JSON review input, validates it, exposes the requested
account metadata fields and review state, and includes the queue and pool
coverage diagnostics. Without a review file it reports `not_supplied` and
leaves all rows unreviewed. It never writes the review file or exposes source
post bodies.

Its `--template` mode emits a deterministic top-level JSON array with one
pending, body-free row per catalog account, including uncollected accounts.
Only the current account key, platform, and handle are prefilled. All
judgment fields remain null until a human supplies them. The output can be
reviewed and passed back through `--reviews`; the two modes cannot be combined.

`src/patterns/review-pool-coverage.ts` reports niche, broad, and format labels
only when they are present in validated human metadata. Its pool counts are
metadata-coverage counts, not comparison-ready evidence or platform rankings;
missing and incomplete rows remain blocked or unmapped.

### `pattern_data_status` (current read-only inventory; unreviewed)

`src/patterns/data-status.ts` accepts an explicit data directory and reports
availability, parse validity, record counts, platform counts, baseline keys,
optional browser/RSS file counts, and a separate derived `openers.jsonl` status
for the mined artifacts. It does not
regenerate, rewrite, or expose body text. Its `reviewStatus` is always
`unreviewed`: these counts, including the derived opener bank, do not establish human-reviewed account metadata,
best creators, platform-wide winners, or permission to reuse creator body copy.

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
audience/CTA intent, experiment identity and variables, pattern/evidence
references, explicit claim references, optional hook-template metadata,
evidence status, voice/originality review state, and `needs-human-review`
status. It is an inspectable planning artifact only. It does not read source
bodies, generate copy, create review-queue rows, schedule, publish, or claim
that a variant is approved. Missing claim references remain a readiness
blocker; the manifest does not verify that the referenced claim exists.

### `grow_review_bundle` (scaffolded; side-effect-free reference bundle exists)

The typed adapter in `src/grow/review-bundle.ts` packages source, cut, variant,
and optional publish references with evidence status, voice/originality checks,
readiness blockers, and Muxin's explicit decision. It carries references and
metadata only. It never reads source bodies, generates copy, queues, schedules,
publishes, or turns a candidate into an approval by inference.

Required review fields are:

```text
id, review_queue_ref, source_ref, cut_ref, variant_refs, publish_refs, lineage,
evidence_status, evidence_refs, voice_check, originality_check, readiness,
human_decision, status
```

`status` is `candidate`, `approved`, `rejected`, or `needs-another-pass`.
`approved` requires complete lineage, supported evidence with references,
passed voice and originality checks, and a decision explicitly recorded by
Muxin. Missing or blocked inputs remain visible as readiness blockers.

### `grow_capacity_manifest` (scaffolded; side-effect-free accounting view exists)

The typed adapter in `src/grow/capacity.ts` separates inspectable candidate
volume from approved publish volume. It records per-day/per-platform candidate
counts, review capacity, slot capacity, scheduled count, pauses, rollback
conditions, and gap reasons. Missing placement or slot data stays blocked or
`null`; the manifest does not approve, schedule, publish, or create content.

`src/grow/delivery-record.ts` joins an already-approved review bundle to a
capacity slice, an explicit candidate roster, and delivery facts. It requires
Muxin's approval, complete source/cut/variant/experiment lineage, an explicit
variant for multi-variant bundles, a remaining slot before scheduling, publish
evidence declared by the bundle before `published`, and outcome references
before `measured`. It exposes `autoScheduling: false`, `autoPublishing: false`,
and `sideEffects: none`; it does not claim a slot or call a queue, scheduler,
or publisher.

`src/grow/delivery-binding.ts` is the stricter read-side join for the next
handoff: it binds the approved review bundle and candidate to capacity, queue,
scheduler, and optional provider/live facts. It requires exact source/cut/
variant/treatment/experiment lineage, matching IDs, both queue and scheduler
evidence for scheduled state, and explicit provider timestamps/live checks for
later states. Missing or ambiguous manual/provider facts remain blockers. The
binding is body-free, read-only, human-gated, and exposes
`autoScheduling: false`, `autoPublishing: false`, and `sideEffects: none`.
`src/grow/delivery-binding-cli.ts` and `npm run grow:delivery-binding` expose
the same fail-closed JSON/Markdown operator view.

`src/patterns/reviewed-evidence-intake.ts` is the corresponding read-side
boundary for the reviewed account, source-evidence, and `/new` baseline rows
needed by comparison. It normalizes explicit niche, broad, and format pool
membership, topic/focus, audience snapshots, source evidence, scopes,
denominators, caveats, review status, and lineage into separate deterministic
groups. Missing, unmapped, incomplete, or cross-mismatched rows remain
blocked; creator body, model, ranking, winner, and selection fields are
rejected. It does not collect, rank, calculate, merge, select, or write.
`src/patterns/reviewed-evidence-intake-cli.ts` and
`npm run patterns:reviewed-evidence-intake` expose the body-free operator view.

### `grow_this_plan` (scaffolded; pure lifecycle projection exists)

`src/grow/grow-this-plan.ts` joins the supplied source, cut, variant, review,
delivery, optional per-slot generation-review-delivery join, experiment, and outcome references into one deterministic
conversation view. It exposes stage statuses, evidence blockers, and required
human gates for cut, review, and delivery. Callers must supply source/cut
readiness facts and an explicit Muxin cut decision; reference presence does not
prove that a stage ran or measured an outcome. Supplied records remain
authoritative.
The projection contains no body text, never selects a winner, and never calls
the review queue, scheduler, publisher, Signals, or Venture.
When supplied, the generation-review-delivery join must match this plan's
review bundle and variant; its blockers and safety boundary flow into delivery
readiness, but it never replaces the durable delivery record.

`src/grow/grow-this-plan-cli.ts` and `npm run grow:this` expose this projection
as a deterministic operator view. The CLI accepts one explicit JSON plan or
file, reports the first blocked/pending lifecycle stage, and can render JSON,
Markdown, or both. It rejects body, model, credential, and winner fields before
the projection runs; its output is body-free, keeps `winner: null`, and has
`sideEffects: none`. It does not queue, schedule, publish, or generate copy.

The same CLI accepts `--folder <content-folder> [--lens <lens>]`. That route
uses `src/grow/legacy-content-adapter.ts` to read the existing source/cut
artifacts, review queue, and publish log into stable Grow references. Legacy
queue statuses and publish observations are retained as facts, but they cannot
stand in for a persisted Grow cut decision, evidence refs, treatment rationale,
voice/originality checks, or human review-bundle decision. Missing artifacts
remain blocked, and the adapter never returns body text or performs writes,
generation, approval, scheduling, or publishing.

`src/patterns/hook-template-ledger.ts` is the curated hook-mechanism read
boundary. The checked-in starter ledger at
`config/patterns/hook-template-ledger.jsonl` contains eight curated
measured/hypothesis metadata rows, not creator copy. Its JSONL rows may contain
only abstract mechanism, platform/niche/
format/slot metadata, source references, caveats, review/originality state,
evidence status, and adaptation guidance. `patterns:hook-templates` provides
deterministic filtering and JSON/Markdown output. Exact opener evidence remains
in the separate opener bank; creator body, copied wording, model, ranking, and
winner fields are rejected recursively. Common-hook mad-lib adaptation is
allowed downstream through the existing Grow metadata-only bridge, with no copy
generation or side effects.

`src/grow/reconciliation.ts` is a read-side comparison of the review bundle,
delivery record, review-queue fact, and scheduler fact. It reports `blocked` or
`drifted` when IDs, lineage, approval, lifecycle, or scheduler evidence
disagree. It never repairs a queue row, claims a slot, cancels a post, or calls
a publisher.

`src/grow/queue-facts.ts` is the pure normalization boundary for facts read
from the existing review queue or scheduler adapters. It preserves explicit
IDs and lineage, maps only declared lifecycle values, and keeps pending,
unknown, blocked, or invalid values conservative. It performs no filesystem
read/write, does not approve or schedule anything, and exposes `sideEffects: none`
before those facts enter reconciliation.

`src/grow/live-facts.ts` is the narrow read-side bridge from established
repository records into that normalizer. It accepts an already-read
`QueueRow` or an explicit scheduler `Claim` plus caller-supplied lifecycle,
delivery, and lineage facts. It does not read files itself, treat a claim as
approval, invent lineage, claim a slot, or mutate the queue or scheduler.

`src/grow/live-reconciliation.ts` composes those two already-read fact
adapters into a single `grow_live_facts` artifact. Missing queue/claim facts
and explicit lineage conflicts remain visible blockers; the composition never
selects a winner, repairs drift, or upgrades a claim into approval or
publication.

### `skill_contract` (scaffolded; lightweight manifest exists)

`src/agents/skill-contract.ts` describes the bounded content-studio stages:
capture/develop, patterns, format-for-platforms, human-review, publish,
learning, and Venture. Each has exact input fact keys, one output fact, an
owner, an invocation boundary, a human gate, and explicit prohibitions on
hidden writes, hidden model/skill calls, creator body-copy reuse, and
unmeasured demand or causality claims. `evaluateSkillContract` checks only
fact-key presence and non-empty values. The manifest is a migration aid for
making existing skills lighter; it does not invoke or replace them.

`src/agents/skill-invocation.ts` creates a model-free, key-only readiness
envelope for one explicit contract check. It records supplied fact keys and
the evaluator's missing/unknown facts without retaining values or body text.
An invocation artifact does not run a skill or model and cannot publish,
schedule, or make a demand/virality claim.

### `phase_contract` (scaffolded; executable definition exists)

`src/blueprint/phase-contracts.ts` defines the four blueprint phases as
deterministic read-only contracts: coverage/catalog, pool-evidence,
growth/delivery, and learning/venture. Each contract names its owner, required
inputs, outputs, human gates, evidence, non-goals, and pause conditions.
`evaluatePhaseContract` checks only explicitly supplied fact names. Missing or
unknown facts block; the evaluator does not infer that a producer, review, or
human decision exists. This is an executable contract definition, not proof
that the live phase is complete.

### `generation_brief` (scaffolded; planning boundary exists)

`src/grow/generation-brief.ts` retains the source and original-substance
references and deterministically fans out platform x format x treatment
specifications while recording the requested daily volume per platform. The
volume field is planning metadata, not an implicit publish promise or a hidden
fan-out multiplier. The brief allows common social
hooks to be reused as `template-madlib` structures while forbidding creator
body-copy reuse. It contains no body text, winner, demand claim, publish call,
or scheduler action. When supplied, explicit platform/format readiness facts
are copied onto each matching treatment; a missing or blocked fact is exposed
as a readiness blocker instead of being inferred. Human review remains
required before release.

### `grow_draft_request` (scaffolded; body-free studio handoff exists)

`src/grow/draft-request.ts` binds one original thought and source artifact to
one exact platform/medium/format treatment. It carries treatment, hook-template,
experiment, voice-policy, output-artifact, and lineage refs plus an explicit
pending/approved/rejected human review state. It is a request manifest, not
copy: model invocation is deferred, common-hook mad-lib adaptation is allowed,
creator-body reuse is forbidden, and auto-approval, scheduling, publishing,
ranking, and side effects are false. `src/grow/draft-request-cli.ts` and
`npm run grow:draft-request` render deterministic JSON/Markdown and fail closed
on missing or mismatched identity, unsupported body/prompt fields, or approval
that still has blockers.

`src/grow/draft-batch.ts` is the volume fan-out seam. Given one original thought
and an explicit treatment list, it emits one body-free pending request per
unique platform/medium/format/treatment/hook/experiment identity. It preserves
source lineage, allows common-hook mad-lib template references, and rejects
creator-body, model, PII, ranking, and winner inputs. It never generates copy,
approves, schedules, publishes, or writes files.
`src/grow/draft-batch-inspection.ts` is a read-only projection of that batch for
operators. It lists exact identities, lineage, per-platform/per-format counts,
and pending-review blockers while retaining `generatesCopy: false` and
`sideEffects: "none"`.

`src/grow/draft-batch-run.ts` is the explicit producer/consumer join after the
batch has been planned. It requires one caller-supplied binding for every draft
request, verifies each artifact reference against the request's expected output,
and joins those references to exact volume slots as pending generation candidates.
Unbound, duplicate, mismatched, or missing-review bindings fail closed; blocked
treatment coverage and human review remain visible. It creates no copy, invokes
no model, and has no persistence or publishing side effects.
`src/grow/draft-batch-run-cli.ts` and `npm run grow:draft-batch-run` expose the
same JSON/Markdown handoff for an explicit file or JSON envelope.

### `grow_treatment_coverage` (scaffolded; read-only reconciliation exists)

`src/grow/treatment-coverage.ts` reconciles explicit requested treatment
cells with already-produced candidate metadata. Matching uses the complete
identity of platform, medium, format, treatment ID, experiment ID, and sorted
experiment variables. Missing, duplicate, blocked, and unexpected candidates
remain visible; no treatment is inferred from a platform-only match.
`src/grow/treatment-coverage-cli.ts` and `npm run grow:treatment-coverage`
expose deterministic JSON/Markdown output.

This is coverage evidence, not generation or delivery. The report is body-free,
does not carry copy or asset contents, and declares `generatesCopy: false`,
`creatorBodyCopyAllowed: false`, and `sideEffects: none`. It cannot approve,
schedule, publish, invoke a model, or write a queue.

### `experiment` (scaffolded; typed deterministic record exists)

The typed adapter in `src/grow/experiment-record.ts` normalizes one question,
declared variables, platform/format/topic/audience scope, source/variant/
publish/outcome lineage, success observations, minimum sample, and an end date
or review rule. Attention, conversation, audience, and business observations
remain separate outcome families. A winner may be recorded only when its
observation is measured, references a declared outcome, and meets the declared
minimum sample; otherwise the experiment remains provisional or
`insufficient-evidence`.

Owner: `signals`; Muxin owns the question and adoption of the conclusion.

Required fields:

```text
id, question, hypothesis, unit, comparison, variable_names, platform_scope,
format_scope, topic_scope, audience_scope, success_observations, minimum_sample, review_rule,
start_at, end_at, variant_refs, outcome_refs, status, lineage
```

`comparison` names the control or baseline and treatment. It must not compare
selected winners to selected winners without a denominator. `status` is
`proposed`, `running`, `closed`, or `insufficient-evidence`.

`src/grow/experiment-outcomes.ts` is the pure measurement join from an
experiment to normalized comment, funnel, and business records, with an
optional Venture proposal reference. Comments, audience/funnel events, and
business outcomes stay in separate families; evidence refs and caveats are
preserved and source/variant/experiment lineage is checked exactly. The ledger
does not infer a winner, close an experiment, interpret a comment as demand,
or write to Signals, Venture, the review queue, or publishing. `ready` means
only that linked rows are lineage- and evidence-valid; it does not mean the
declared success observations are measured or that the experiment has
concluded.

### `model_boundary_record` (scaffolded; pure audit manifest exists)

`src/agents/model-boundary.ts` records a bounded role, task kind, model route,
subscription/local/paid cost class, input/output/evidence refs, and human gate.
Extraction remains non-composing. Content generation and pattern adaptation
remain human-gated. A common hook may be used as a mad-lib template when it is
anchored to Muxin's original substance; creator-body copying is always blocked.
The manifest is an audit record only and makes no model call or side effect.

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

### `approved_reply_task` (scaffolded; human-gated response seam exists)

Owner: `content` for preparation; Muxin owns approval and sending.

Required fields:

```text
id, comment_observation_id, draft_text, reply_purpose, claim_refs,
target_platform, human_decision, decided_by, decided_at, delivery_status,
sent_at, status, lineage
```

`human_decision` is `pending`, `approve`, or `decline`. No auto-reply exists.
Approval is specific to this draft, target, and context. `delivery_status` may
not be `sent` unless the human decision is `approve`; `sent` records a
confirmation, not an assumption. The pure adapter is
`src/review/approved-reply-task.ts`; it never sends, publishes, or includes the
source comment body.

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
`src/review/funnel-events.ts` provides the pure normalizer and conservative
readiness assessment for this shape. It does not capture live events, infer
attribution, or aggregate Signals.

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

### `content_learning_packet` (scaffolded; side-effect-free bridge exists)

The typed bridge in `src/review/learning-packet.ts` packages qualified
conversation observations, funnel events, and business outcomes for review.
It preserves variant/experiment lineage and separates observed facts from
interpretation. Comments can be included as qualified observations, but a
comment alone never satisfies a willingness-to-pay or Venture evidence gate.
The packet remains pending until Muxin explicitly adopts or declines the
proposal; Venture then has its own independent gate. Building this packet does
not write Signals, mutate Venture, reply to a commenter, or change routing.

`src/grow/comment-learning.ts` adds a deterministic operator projection over
the same comment, funnel, and business facts. It emits product/lead
hypotheses with lineage, evidence refs, qualification, confidence, and a
pending Muxin decision. It preserves missing evidence and non-qualified
comments, never claims demand, includes no comment body in the projection, and
does not create a Venture artifact or write to Signals.

### `outcome_ledger` (scaffolded; append-only persistence boundary exists)

`src/grow/outcome-ledger.ts` stores normalized funnel events and business
outcomes as append-only JSONL facts. Each row keeps its outcome family,
lineage, evidence refs, collection window, attribution confidence, and
revision link when a later row supersedes an earlier fact. Unknown attribution
is represented explicitly with a null content item and a reason. The ledger
rejects post bodies, model outputs, rankings, and winner claims; it does not
infer attribution, aggregate Signals, close experiments, or create Venture
records. `src/grow/outcome-ledger-cli.ts` and `npm run grow:outcome-ledger`
provide deterministic JSON/Markdown inspection over an explicit local source.
The pure `appendOutcomeRow`/`appendOutcomeLedger` functions are the separate
append-only persistence seam; the CLI itself does not write a ledger.
Persistence remains separate from the human decision to interpret or adopt a
result.

### `grow_learning_bundle` (scaffolded; side-effect-free feed-context join exists)

`src/grow/learning-bundle.ts` joins an explicit `CommentLearningView` to
reviewed `SourceEvidenceRow` feed context and an operator-supplied proposal.
Every proposal carries exact basis hypothesis IDs, feed-context IDs, lineage,
scope, sample size, caveats, and Muxin's pending/adopted/declined decision.
Feed context must be reviewed, ready, body-complete, pool-labelled, metrically
complete, provenance-dated, linked, and tied to the same source lineage. The
join is descriptive evidence context; it does not copy creator bodies, prove
demand, or rank feed evidence.

`qualification: qualified` is admissible only with a qualified funnel or
business hypothesis (`qualified_inquiry`, `call`, `opportunity`, or `purchase`)
with evidence refs. A comment or feed-attention signal remains a hypothesis.
Missing, mismatched, or incomplete facts remain blocked, including an adopted
proposal that is not evidence-complete. `src/grow/learning-bundle-cli.ts` and
`npm run grow:learning-bundle` expose deterministic JSON/Markdown output from
an explicit envelope. The adapter has `autoClaimsDemand: false`,
`ventureArtifacts: false`, and `sideEffects: none`; it does not write Signals,
create Venture artifacts, reply, or publish.

`src/grow/venture-handoff.ts` joins this view to the normalized learning
packet at the Signals-to-Venture boundary. It keeps comment, funnel, and
business families separate and remains blocked until Muxin has adopted the
proposal and the declared Venture gate is `ready` or `accepted`. It is a
read-only gate view: it does not create a Venture artifact, write Signals,
claim demand, or send a reply.

When a `grow_learning_bundle` is supplied, the handoff requires an explicit
`proposalId`, exact bundle/packet lineage, a unique selected proposal, a
qualified status, a ready proposal/feed context, and a Muxin decision matching
the packet and learning view. It preserves only body-free proposal metadata:
basis IDs, feed-context IDs and blockers, scope, sample size, caveats,
qualification, lineage, and evidence-backed hypothesis summaries. Missing,
blocked, hypothesis-only, mismatched, or non-unique proposals remain blocked;
the handoff never chooses a proposal implicitly.
`src/grow/venture-handoff-cli.ts` and `npm run grow:venture-handoff` expose the
same body-free gate view without creating a Venture artifact or sending a reply.

## 5. Venture boundary

### `venture_input` (scaffolded)

Owner: `content` packages; Venture owns acceptance under its current phase.

Required fields:

```text
id, venture_id, phase, input_kind, source_record_refs, evidence_refs,
content_item_refs, scope, sample_size, provenance, caveats,
content_human_decision, venture_gate, venture_decision, status, lineage
```

`input_kind` names the Content evidence kind, with the abstract kinds above
available for the contract and implementation-specific kinds allowed when
their lineage is explicit. `content_human_decision` must be `approved` before
handoff. `venture_gate` names the required Venture evidence predicate and
must include its rules version. `venture_decision` is null until Venture's
own phase gate records an independent `accept`, `reject`, or
`request-more-evidence` fact. The implementation uses camelCase field names
inside the typed pointer and exposes the snake_case record vocabulary here as
the boundary contract.

This record is a pointer and evidence packet, not a phase unlock. It cannot
create a Venture decision, artifact, response gate, checkpoint, or publish
approval. Venture's response, decision, artifact, editorial, delivery, and
checkpoint gates remain authoritative. Venture-originated content still
creates normal `cut`, `content_item`, `variant`, and human-review records.

`src/grow/venture-input.ts` is the Content-owned implementation of this
pointer seam. It requires an approved Muxin content decision, preserves only
body-free source/evidence/lineage references, and leaves the Venture decision
independent and null until Venture supplies its own phase fact. Comments alone
remain hypothesis or needs-more-evidence input. The readiness view and
`src/grow/venture-input-cli.ts` / `npm run grow:venture-input` are read-only
operator projections; they never write Venture artifacts, advance a phase,
approve publishing, or treat a Content approval as Venture acceptance.

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
caveats, readiness, comparisonReadiness
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

These rows are account-oriented rollups for inventory display, not the
authoritative comparison observations. `readiness` only says whether explicit
metadata is available for inventory inspection. `comparisonReadiness` and any
future comparison summary must derive from linked `source_post_evidence`
records. An account row without those source/post records remains blocked for
comparison.

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

The exact creator body remains internal evidence. It may be inspected for
analysis, quotation, attribution, or an originality check, but it must not be
copied into Muxin's body. A common hook may be adapted as a mad-lib template
around Muxin's original claim, experience, example, evidence, and point of
view. The template supplies a structure, not a creator's body or signature
wording.

### `pattern_evidence_readiness` (scaffolded; pure composition exists)

`src/patterns/evidence-readiness.ts` composes the pool inventory, source
evidence, comparison-readiness, and operator-readiness adapters into one
deterministic read-only artifact. It accepts an explicit catalog, corpus,
analysis records, and review rows. It does not fill missing pools from the
catalog, expose post bodies, select winners, or write data. Empty or
incomplete reviews keep comparison and operator readiness blocked. The
artifact is an inspection join, not proof that the live corpus is reviewed.

### `platform_format_readiness` (scaffolded; pure projection exists)

`src/patterns/platform-readiness.ts` projects configured platform and format
coverage from the catalog without ranking creators or inferring a platform
winner. It keeps configured-but-uncollected surfaces visible, separates
collected evidence from reviewed evidence and baselines, and reports
conservative blockers. It has no network or filesystem side effects and does
not expose post bodies.

`src/patterns/readiness.ts` and `npm run patterns:readiness` provide the
read-only operator entry point that composes evidence and platform readiness.
It accepts an explicit review JSON file, reports missing or invalid review
input, and never promotes a row to reviewed by inference or writes data.

`src/patterns/account-table-report.ts` and `npm run patterns:account-table`
provide the operator entry point for the account/example table. It preserves
the requested account size, topics, focus, platform, medium, format, explicit
pool membership, comparison scope, evidence links, caveats, and review state.
When raw corpus and analyses are supplied, it derives comparison rows through
`pattern_evidence_readiness`; otherwise it keeps the comparison view empty and
visible. The report is body-free, deterministic, fail-closed for invalid review
batches, and never ranks creators or declares a winner.

### `opener_operator_report` (scaffolded; deterministic evidence projection exists)

`src/patterns/opener-report.ts` projects already-normalized opener records with
platform groups, warnings, performance provenance, and status counts. Captured
`opener_text` is labeled source evidence for hook analysis; it is not generated
copy or a full post body. The report permits downstream common-hook mad-lib
adaptation under human review, but does not rank creators, infer winners, or
authorize creator-body copying.

`src/patterns/opener-report-cli.ts` and `npm run patterns:opener-report` are the
read-only operator adapter. They accept one explicit JSON/file source and render
JSON, Markdown, or both; malformed opener rows fail closed and accidental body
fields are not admitted into the report.

### `account_review_queue_batch` (scaffolded; deterministic pagination exists)

`src/patterns/review-batch.ts` returns one deterministic page of non-reviewed
account queue rows with status counts, next actions, and explicit human-review
fields. Empty queues expose page one and reject later pages. The projection does
not write review state, infer metadata, rank accounts, select winners, or publish.

`src/patterns/review-batch-cli.ts` and `npm run patterns:review-batch` provide the
same view from an explicit queue artifact. Page size and page number are required
positive integers, and the adapter remains stdout-only and human-gated.

### `baseline_gap_report` and `baseline_sample_cli` (scaffolded; measurement remains explicit)

`src/patterns/baseline-gap-report.ts` compares explicit target rows with explicit
`AccountBaseline` rows. Missing rows are marked `measure_baseline`, require the
`/new` route, and keep sample-size, age, topic/focus, method, and caveats visible
when supplied. The report never manufactures a median, calls a winners-only
sample a baseline, ranks accounts, or writes the ledger.

`src/patterns/baseline-gap-report-cli.ts` and `npm run patterns:baseline-gaps`
accept an explicit `{ targets, baselines }` JSON envelope and render JSON,
Markdown, or both. `src/patterns/baseline-sample-cli.ts` and
`npm run patterns:baseline-sample` accept an explicit `{ account, sample, meta }`
envelope, run the existing pure baseline builder, and fail closed when the sample
is empty or has no common measurable terms. Both commands are stdout-only. The
sample adapter does not fetch `/new`, append `baselines.jsonl`, or establish a
winner claim; the actual collector remains the separately authorized measurement
step.

`src/patterns/baseline-repo-report.ts` and `npm run patterns:baseline-repo` apply
the same gap contract to the configured `PatternMiningConfig` account seeds and
the current explicit baseline ledger. The command is read-only and reports
configured accounts with an unconfirmed `handle: null` as explicit
`handle_not_confirmed` blockers. It does not discard them silently, and it does
not call a null handle a baseline gap that can be measured.

### `measurement_run` (scaffolded; bounded execution manifest exists)

`src/patterns/measurement-run.ts` records one explicit baseline measurement
run: account identity, route and collection method, sample policy, collection
window, operator/evidence refs, and any measured baseline result. Supported,
manual, unsupported, blocked, and unconfirmed routes remain distinct. The
manifest does not crawl a platform, fetch post bodies, infer a metric, rank
creators, or write `baselines.jsonl`; it is the execution desk and evidence
manifest that a separately authorized collector or human can complete.
`src/patterns/measurement-run-cli.ts` and `npm run patterns:measurement-run`
render the same body-free manifest deterministically.

### `platform_pool_matrix` (scaffolded; explicit coverage accounting)

`src/patterns/platform-pool-matrix.ts` groups explicit target rows by platform,
research pool (`niche`, `broad`, or `format`), medium, and format. It counts
configured, collected, reviewed, baseline-ready, blocked, and unreviewed rows
and keeps each gap dimension visible. It does not infer missing labels from a
niche, account name, or platform and does not rank creators.

`src/patterns/platform-pool-matrix-cli.ts` and
`npm run patterns:platform-pool-matrix` accept an explicit target array (or
`{ targets }` envelope) and render deterministic JSON, Markdown, or both. The
command is stdout-only and body-free; a later repo adapter may populate its
explicit target rows from reviewed catalog and evidence facts.

`src/patterns/platform-pool-matrix-repo.ts` and
`npm run patterns:platform-pool-matrix-repo` are that repo adapter. They join
catalog rows to review facts by exact `currentAccountKey` and baseline facts by
exact normalized account key. Pool, medium, and format values in usable matrix
targets come only from the explicit review fact; catalog labels are context for
blocked handoff rows and are never promoted into a review decision. Missing
reviewed labels are reported in `blockedTargets`; invalid reviewed pool labels
fail closed rather than becoming targets. Neither case is assigned to `niche`.
Multiple independent catalog labels are not
cross-producted. Review states `pending`, `blocked`, and `unmapped` remain
visible when explicit reviewed labels exist, and no creator body or winner claim
is emitted.
With the current gitignored checkout, the command reports 0 matrix targets and
371 blocked rows because explicit review metadata has not yet been entered;
that is a coverage fact and not permission to classify those rows from catalog
niche, account name, platform, or other unreviewed labels.

`src/patterns/reviewed-account-registry.ts` is the canonical read path over the
append-only account ledger. It resolves exactly one non-superseded row per
account identity, revalidates caller-shaped ledger objects through the ledger
validator, and adapts the same explicit facts into the matrix review-fact
shape. `src/patterns/reviewed-account-registry-report.ts` joins that registry
to the durable account/source example table and the platform/pool matrix;
`npm run patterns:reviewed-account-registry` exposes the JSON/Markdown/both
operator view. This bridge does not infer pool membership from catalog labels,
select winners, copy creator bodies, or replace the separate source/post and
baseline gates. It remains blocked until real reviewed ledger rows and usable
baseline terms exist.

### `pool_best_report` (scaffolded; fail-closed comparison only)

`src/patterns/pool-best-report.ts` and `npm run patterns:best-report` compare
explicit source/post evidence rows against recorded account baselines. The input
must supply reviewed account metadata, explicit niche/broad/format membership and
reason, platform, medium, format, metric name/value/unit, numerator and
denominator, metric scope and window, observation and collection dates, selection
rule, provenance, evidence links, caveats, body-complete evidence, and a baseline
with matching terms, metric, median, sample size, window, method, and collection
date. The report uses the recorded baseline multiple; it never uses a winners-only
or sibling median as a substitute.

Niche groups are separated by the reviewed niche label. Broad groups are grouped
by platform, and all groups remain separated by medium, format, metric, unit,
metric numerator/denominator, metric window/scope, popularity scope, selection
rule, baseline metric/terms/window, baseline scope, and baseline source. A
declared minimum comparable-candidate count is required. A valid group
may report one or more tied best examples and their creators; any missing,
incomplete, conflicting, duplicate, or incomparable fact produces a blocked group
and no winner claim. The output is deterministic JSON/Markdown, body-free, and
stdout-only. It does not rank account tables or follower counts, infer topics or
pools, copy creator text, or write data. Current live rows remain blocked because
reviewed metadata and usable baseline terms have not yet been supplied.

`src/patterns/pool-best-ledger-report.ts` and
`npm run patterns:best-ledger-report` are the durable-ledger adapter for this
comparison. They resolve current account rows through the reviewed-account
registry, convert validated source-ledger rows into the existing comparison
shape, and pass caller-supplied baseline facts through unchanged. A missing
baseline, incomplete source fact, missing explicit pool, or mismatched scope
stays a blocked candidate/group. The adapter does not use follower count as a
ranking metric, fall back to catalog labels, or turn incomplete evidence into a
winner.

`src/patterns/pool-review-handoff.ts` and
`npm run patterns:pool-review-handoff` provide the narrow human handoff for that
gap. The adapter joins each exact catalog account key to the existing explicit
pool-review coverage and adds account identity, configured/collected state,
audience-size evidence, niche, topics, focus, and observed formats/media forms.
The displayed pool labels, disposition, status, blockers, and next action come
only from validated review coverage. Catalog `researchPools` are deliberately
not copied into the handoff as decisions. Missing coverage remains unmapped;
unknown, pending, blocked, and empty explicit choices remain review blockers.
The JSON/Markdown projection is deterministic, body-free, stdout-only, and does
not infer, rank, fetch, approve, persist, select, or publish.

### `review_session` (scaffolded; human handoff only)

`src/patterns/review-session.ts` joins an explicit `account_review_queue_batch`
with optional review-input and data-status facts. It preserves each row's
pending, blocked, or unmapped status, required fields, evidence count, and next
human action. `bodyIncluded` is always false. `src/patterns/review-session-cli.ts`
and `npm run patterns:review-session` accept an explicit JSON/file envelope and
render deterministic JSON/Markdown/both. The session does not approve, persist,
rank, select, publish, or expose creator post bodies.

### `pattern_data_status_cli` (scaffolded; metadata-only operator command)

`src/patterns/data-status-cli.ts` and `npm run patterns:data-status` expose the
gitignored pattern-data inventory from an explicit `--data-dir`. The command
reports artifact availability, counts, and validation metadata, including the
derived opener bank, but never emits opener text or corpus bodies and never
changes the data directory.

### `pool_evidence_cli` (scaffolded; explicit inventory command)

`src/patterns/pool-evidence-cli.ts` and `npm run patterns:pool-evidence-cli`
accept either an explicit catalog/raw-input JSON envelope or the existing
config/corpus/analysis paths. They expose niche, broad, and format membership
only when explicitly present, preserve blocked rows, and do not infer pools,
rank accounts, or select winners.

### `generation_brief_cli` (scaffolded; read-only operator adapter exists)

`src/grow/brief-cli.ts` and `npm run grow:brief` accept an explicit JSON
generation-brief request from a string or file and render deterministic JSON or
Markdown. They expose platform/format readiness blockers, preserve the common
hook mad-lib policy, keep creator-body copying forbidden, and leave the human
gate pending. They do not call models, read source bodies, write artifacts, or
publish.

### `comment_observation_intake` (scaffolded; manual/local adapter exists)

`src/review/comment-intake.ts` normalizes operator-supplied conversation
observations for the existing comment-learning seam. It requires explicit
content and lineage/evidence references, preserves consent and moderation
posture, and can produce a redacted representation when raw comment text is
not permitted in downstream artifacts. It does not fetch comments, infer
demand, create product ideas, publish replies, or write to Signals or Venture.

`src/grow/comment-learning-cli.ts` and `npm run grow:comment-learning` accept
an explicit JSON envelope of normalized comment observations, funnel events,
and business outcomes. The adapter validates record shapes, renders a
body-free learning view, preserves evidence blockers and Muxin's decision, and
never infers demand or creates replies, Signals, or Venture artifacts.

`src/review/comment-intake-cli.ts` and `npm run review:comment-intake` normalize
one explicit manual comment observation. Their default projection is body-free;
`--include-comment-text` is an explicit operator opt-in for the normalized raw
or redacted representation. Both modes retain moderation, consent, lineage,
evidence, and the blocked Venture handoff, and never infer demand or send a
reply.

### `approved_reply_task_operator_view` (scaffolded; human-gated response seam exists)

`src/review/approved-reply-task.ts` normalizes an explicit proposed response
to a `comment_observation`. It preserves the proposed reply text as a
reviewable Muxin artifact, claim references, platform, lineage, decision, and
delivery state. Pending and declined tasks remain blocked; a sent task requires
an explicit Muxin approval and timestamp. The adapter never includes the source
comment body, calls a provider, writes a record, sends a reply, or publishes.
`autoSend: false`, `autoPublish: false`, and `sideEffects: none` are contract
fields, not suggestions. `src/review/approved-reply-task-cli.ts` and
`npm run review:approved-reply` expose the same body-free state as a
read-only JSON/Markdown operator view; they do not send, publish, or write.

### `studio_readiness` (scaffolded; aggregate operator view exists)

`src/grow/studio-readiness.ts` composes caller-supplied readiness for the
source, generation brief, treatment coverage, volume plan, generation run,
review bundle, delivery record, optional per-slot generation-review-delivery
join, and comment-learning view. Its lifecycle is
explicitly `source -> brief -> treatment-coverage -> volume -> generation ->
review -> delivery -> learning`; missing or blocked pre-generation stages keep
generation blocked. It keeps separate human gates and is a body-free inspection
artifact: it does not include the brief, source substance, creator text,
generated copy, publishing records, or learning interpretation, and it never
approves or publishes anything.
`src/grow/studio-readiness-cli.ts` and `npm run grow:studio-readiness` provide a
read-only JSON/Markdown operator projection of that envelope. Malformed or
missing inputs fail closed; the command preserves blockers and never writes,
publishes, or includes source substance. When supplied, the
`generationReviewDelivery` artifact contributes its per-slot blockers and
safety boundary to the delivery stage; it never substitutes for the explicit
delivery record or human approval gate.

### `generation_run` (scaffolded; explicit artifact/review handoff exists)

`src/grow/generation-run.ts` reconciles a deterministic `volume_plan` with
caller-supplied metadata for each generated artifact and its still-pending
human-review queue reference. It requires an explicit, ready
`grow_treatment_coverage` report before the run can be ready. Missing, duplicate,
wrong-platform, wrong-variant, wrong-assignment, blocked, and unexpected records
remain explicit blockers; the adapter never selects or invents a replacement.

The manifest carries references and slot identity only. It has
`generatesCopy: false`, `creatorBodyCopyAllowed: false`,
`humanReviewRequired: true`, `autoApproval: false`, `autoScheduling: false`,
`autoPublishing: false`, and `sideEffects: none`. It does not invoke a model,
read or write draft files, create queue rows, approve, schedule, publish, or
send. `src/grow/generation-run-cli.ts` and `npm run grow:generation-run`
expose deterministic JSON/Markdown output and fail closed on malformed or
body-bearing envelopes.

### `generation_review_delivery` (scaffolded; per-artifact review-to-delivery join exists)

`src/grow/generation-review-delivery.ts` joins each `generation_run` slot to
the exact pending review-queue reference, a caller-supplied reviewed
`grow_review_bundle`, already-read `grow_live_facts`, a capacity slice, and
the existing `grow_delivery_binding` builder. The queue reference must repeat
both the generation slot's reference and the reviewed bundle's explicit
`reviewQueueRef`; the artifact, slot identity, review source,
candidate variant, delivery lineage, and live facts remain explicit joins.
Legacy queue/scheduler facts may omit treatment identity, so the adapter
requires an explicit enriched queue/scheduler lineage rather than filling it
from the candidate or review bundle. Missing, mismatched, pending, or
incomplete inputs remain blocked per row. A generation slot's expected
`human review is pending` blocker is not treated as a permanent generation
failure once the separate reviewed bundle is supplied.

The result contains one body-free delivery binding per planned slot and
retains the review-queue reference, artifact reference, review bundle ID,
capacity facts, live facts, and all blockers. It never reads or writes the
queue, approves a bundle, claims a scheduler slot, schedules, publishes, or
includes source or creator body text. `bodyFree: true`,
`humanApprovalRequired: true`, `autoApproval: false`, `autoScheduling: false`,
`autoPublishing: false`, and `sideEffects: none` remain mandatory.
`src/grow/generation-review-delivery-cli.ts` and
`npm run grow:generation-review-delivery` expose the same join as
deterministic JSON/Markdown from one explicit envelope; they do not write
domain state. `grow:studio-readiness` accepts the resulting body-free artifact
as `generationReviewDelivery` and carries its blockers into delivery readiness
without treating the join as a durable delivery record.

### `manual_platform_observation` (scaffolded; collectorless intake exists)

`src/patterns/manual-platform-intake.ts` normalizes an operator-supplied
observation for a platform whose collector is unavailable. It preserves the
account/post identity, topic/focus, medium/format/media facts, audience and
metric snapshots, explicit niche/broad/format scope, evidence links, collection
status, and caveats. It marks provenance as manual, body completeness false,
and readiness blocked when required facts are absent. It does not fetch,
infer, rank, select a winner, or copy a post body.
`src/patterns/manual-platform-report.ts` aggregates normalized observations by
platform, collection status, explicit role/pool, body flags, and missing facts.
It is descriptive-only and cannot establish a winner or platform coverage.
`src/patterns/manual-platform-report-cli.ts` and
`npm run patterns:manual-platform-report` expose that report from one explicit
JSON/file observation source with deterministic JSON/Markdown output. Invalid
rows fail closed, and explicit role/pool/status values are preserved rather than
inferred.

### `volume_plan` (scaffolded; deterministic slot projection exists)

`src/grow/volume-plan.ts` allocates the copy-free variants in a generation
brief into deterministic per-platform daily slots using the brief's declared
volume or an explicit override. Each slot retains variant and experiment
references, readiness blockers, and a pending human review gate. It does not
compose copy, read source substance, schedule, publish, or approve.
`src/grow/volume-plan-cli.ts` and `npm run grow:volume-plan` expose the same
projection from an explicit generation-brief envelope and optional volume
overrides. The command is planning-only and never creates copy or claims a
publish slot is approved.

### `experiment_outcome_cli` (scaffolded; read-only measurement adapter exists)

`src/grow/experiment-outcome-cli.ts` and `npm run grow:experiment-outcome`
normalize an explicit experiment/outcome envelope and render JSON or Markdown
over the existing outcome ledger. Attention, conversation, audience, and
business families remain separate; lineage/evidence blockers and a supplied
winner remain visible. The adapter never infers demand or a winner, composes
copy, closes an experiment, sends, publishes, or writes.

### Increment acceptance predicates and current status

The account metadata and pool-evidence increment is accepted only when all of
these predicates hold:

1. Every current account key has one `account_metadata_overlay` row with real
   evidence links and `review_status: reviewed`, or an explicit `unmapped`
   disposition with a reason.
2. Every live row lacking that reviewed metadata is marked `blocked`. The
   existence of a row, a populated account mapping, or a model-generated value
   does not satisfy the predicate.
3. Every pool comparison names its authoritative `source_post_evidence`
   rows, explicit pool membership, popularity scope, sample scope, baseline or
   denominator, dates, provenance, and caveats. Account mappings may roll up
   those rows but cannot stand in for them.
4. Exact creator bodies remain internal evidence, and any adapted common hook
   carries Muxin's original substance and passes human originality review.

The current status is `scaffolded` for `account_metadata_overlay`,
`source_post_evidence`, `content_learning_packet`, and
`pool-evidence-inventory-v1`. The inventory adapters exist, but the live
corpus is not thereby reviewed. The inventory is
provisional and does not unlock Grow variants or permit a winner claim. Current
live rows remain blocked until real reviewed metadata is entered.

Every `variant` must carry the following treatment object:

```text
{
  platform, medium, format, treatment_reason, audience_scope, cta,
  experiment_id, variables, pattern_refs, claim_refs, evidence_status,
  hook_template?
}
```

`platform` is the distribution surface, `medium` is text/image/video/audio,
and `format` is the platform-native shape such as thread, note, quote-card,
carousel, or short. Routing decides what may be generated or queued. It does
not approve publication. A missing or `unknown` treatment reason blocks
approval; an unavailable platform may be represented with status
`not-routed`, not by fabricating a variant.

When present, `hook_template` is metadata only:

```text
{ ref, slot_refs, adaptation_note }
```

Slot references identify Muxin's original substance and evidence. The
template contains no creator body copy. A hook treatment with no slot refs is
blocked, and the Grow manifest remains `generatesCopy: false`,
`creatorBodyCopyAllowed: false`, `sideEffects: none`, and human-gated.

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
