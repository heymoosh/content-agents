# Pattern mining: evidence-to-treatment plan

**Status:** Reconciled with the current Content System blueprint and the `feat/pattern-corpus-v1`
code, 2026-08-24. This document is a bounded plan and handoff contract. It does not claim that the
current catalog, corpus, lanes, pools, or live rows are complete or human-reviewed.

## 1. Purpose and north star

Pattern work should help Muxin turn a captured thought or source into a small set of reviewable,
platform-native treatments while keeping the source, evidence, and decision visible.

```text
capture -> source record -> explicit pattern evidence
       -> platform x medium x format treatments -> human review
       -> approved publish path -> outcomes and learning
```

This extends the existing Content system. `patterns` handles research evidence and treatment
recommendations. `develop` owns angles and source-grounded cuts. `atomize` remains the internal
platform-format engine. Review and `/publish` own approval and delivery. No skill silently calls
the next one with a new claim.

The plan is deliberately not an autopilot, universal virality engine, or promise of daily output.
Internal candidate volume and approved publish volume remain separate. Muxin supplies the insight,
claims, examples, taste, voice, and final yes.

## 2. Current state

The current code already includes deterministic pattern collection and evidence/catalog seams:

- collectors and staging under `src/patterns/**`;
- catalog, account mapping, coverage, outlier, opener, and pool-evidence reports;
- source/post evidence normalization that preserves missing fields and blocked states;
- Grow planning and no-copy variant manifests with platform, medium, format, rationale, evidence refs,
  variables, and a human review gate;
- a committed hook library with 31 patterns and full-post pattern records that remain evidence-led.

These are not the same as complete coverage or reviewed live data. The blueprint marks several
inventory and pool-evidence surfaces as scaffolded or provisional. Current rows remain blocked for
pool comparison or winner claims until real reviewed metadata and source/post evidence are present.

The current package scripts are the implementation surface. The review-status command is the
operator entry point added by this plan; it validates an explicit review JSON file and emits a
body-free account metadata table plus blocked/unmapped coverage. It does not write the review file
or claim that the catalog is reviewed:

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

The slash modes in `.claude/skills/patterns/SKILL.md` are judgment handoffs, not new npm scripts
and not an automatic chain.

### Review input contract

`npm run patterns:review-status -- --template` emits a deterministic top-level JSON array with one
body-free pending row per current catalog account, including uncollected keys. It pre-fills only the
current account key, platform, and handle. It does not infer creator, topic, focus, niche, pool,
scope, audience, or evidence values. Review the file manually, then pass it back with
`npm run patterns:review-status -- --reviews <file.json>`. The template mode cannot be combined with
`--reviews`.

`npm run patterns:review-status -- --reviews <file.json>` accepts a JSON array of
`ReviewMetadataRecord` rows. Each row uses the current account key (`platform|normalized-handle`),
platform-local handle, optional stable account id and status, audience snapshot, topics, focus,
niche label, medium, format, explicit pool memberships with a reason, popularity/sample/baseline
scopes and source, evidence links, caveats, reviewer, review timestamp, and one of
`pending`, `reviewed`, `blocked`, or `unmapped` dispositions. Use `null` for not collected or not
applicable and `unknown` only after checking without resolution. The CLI validates the file and
renders the supplied values; it does not create, overwrite, or infer them. A row is ready only
when all required fields are present, evidence links are real references, and the disposition is
explicitly `reviewed`.

## 3. Normalized vocabulary

Use the current blueprint terms in prompts, records, and review surfaces.

| Term | Meaning |
|---|---|
| Source | Muxin's supplied input or an external research item, with stable id, locator, author/account, date, provenance, and completeness. |
| Account | A creator, publication, organization, or channel. Identity is platform-local unless an explicit reviewed mapping says otherwise. |
| Evidence | A bounded observation with metric, denominator, date/window, scope, selection rule, provenance, and caveats. |
| Pattern | A reusable mechanism, sequence, pacing, CTA shape, common hook template, or visual treatment. It is not creator body-copy substitution. |
| Cut | A message-level treatment before platform formatting. It may select, order, and lightly trim Muxin's words. |
| Variant | A cut formatted for a platform, medium, and format, retaining rationale, variables, lineage, and review state. |
| Treatment | The platform, medium, format, and reason for presenting the same message in that way. |
| Review gate | Muxin's explicit edit, approve, reject, or request-another-pass decision. |

Use `null` for not collected, not applicable, or not normalized. Use `unknown` only after checking
and failing to determine a value. Never replace a missing value with an empty string, zero, or an
inference.

## 4. Lanes and research pools

New config values come from `config/pattern-mining.yaml`. The current blueprint terminology is:

- `ai-building`, building with AI and AI workflows;
- `adhd`, ADHD and executive-function work;
- `civic-tech`, civic and social problem solving, public-good technology, and democracy work;
- `product-thinking`, product sense, prioritization, and shipping judgment;
- `solopreneur`, solopreneurship and one-person businesses;
- `general-viral`, structure donors useful beyond one topic.

The config also retains `productivity`, `lifestyle-control`, and older labels for historical rows.
Those labels are not interchangeable, and a configured label is not evidence that a lane has
coverage.

Research pools are independent of the topical lane:

1. **Niche pool:** examples unusually strong for the relevant topic, audience, or community.
2. **Broad platform pool:** `broad` in records, for platform-wide mechanics even when the topic is
   unrelated. `general-viral` may supply structure donors, but it does not make broad-platform
   coverage complete.
3. **Format pool:** `format` in records, for mechanics of a medium or format such as short video,
   quote card, carousel, thread, or newsletter opening.

Membership is explicit. Do not infer a pool from a name, topic, metric, ranking, body, or model
judgment. A source can have multiple memberships only when each has a reason. Pool membership is
not a quality score.

## 5. Evidence and comparison contract

The source/post record is the authoritative unit for a pool comparison. Account mapping is a rollup
and navigation surface. It cannot create evidence, supply a denominator, or turn an unreviewed row
into a winner.

A usable pattern-evidence reference carries, as applicable:

```text
pattern_id, source_id or post_id, evidence_location, platform, medium, format,
pool, membership_reason, popularity_scope, sample_scope, baseline_scope,
metric_snapshot, baseline_source, observed_at, collected_at, selection_rule,
body_is_complete, provenance, caveats, originality_review
```

Winner claims must name the comparison set, metric and observation window, numerator and denominator,
source and collection dates, selection rule, and caveats. Otherwise use `selected example`,
`observed signal`, or `hypothesis`. A small sample may suggest an experiment; it cannot establish a
general platform rule.

The 31-pattern hook library is a current library count, not a claim that every lane, platform,
format, or pool is represented. `post-patterns.md` can be thin or absent for a platform. Never
present a fallback or partial section as current live coverage.

## 6. Collection and extraction guardrails

Automated collectors now exist. The old wording that there was no collector in v1 and that
automated collection belonged to Phase 2 is superseded. It should not be used as current guidance.
Collection is still bounded, route-specific, and evidence-preserving, not unbounded scraping.

An external body may come from Muxin's paste, an existing deterministic collector, a platform-owned
raw response, or text visibly available on the target platform in a bounded browser read. The raw or
browser route may copy only what the platform exposes for that target item.

The hard restrictions are:

- Never use a model-backed page fetch or summarizer to create a body. A prompt to “return it
  verbatim” does not make a model response verbatim.
- Do not use comments, related posts, SEO titles, descriptions, thumbnails, captions over an image,
  or inferred transcript text as the creator's body.
- Preserve line breaks, source URL, collection route, observation date, and body completeness. For
  video, distinguish spoken transcript from written caption or on-screen text.
- Do not bypass access controls or rate limits, and do not turn browser extraction into an
  unbounded scrape.
- If a body, visual, transcript, metric, or denominator is unavailable, retain the source with a
  null or blocked field and a caveat. Never fill the gap with a plausible value or another source.

Collector output is not human review. A catalog row, account mapping, or deterministic report may
remain provisional or blocked. Do not claim current live data is reviewed unless a real review
record says so.

## 7. Originality and Muxin's voice

Exact creator body copy remains internal evidence for analysis, attribution, quotation, or an
originality check when permitted by the record. It is never a body-copy bank. Do not copy a
distinctive phrase sequence, story, claim, example, or close paraphrase and swap nouns.

Common, widely shared hooks may be adapted as mad-lib templates. The slots must be filled with
Muxin's own claim, experience, example, evidence, and point of view. The treatment must preserve
her non-generic substance and voice, not imitate the named creator.

`rewrite` is source-grounded: it may reorder, lightly trim, and adapt a common opener, but it may
not invent a claim, statistic, result, experience, example, or worldview line. `remix` follows the
same boundary for a selected common hook or visual title treatment. `ideas`, `series`, and `asap`
propose; they do not draft missing body copy.

Read `config/voice.yaml` before writing human-readable treatment titles or summaries. Muxin's voice
wins over a pattern. Remove AI tells, including em dashes, and read the output aloud. Civic and
social-problem-solving material also follows
`.claude/skills/atomize/references/civic-adaptation.md`: concrete local stakes, immediate personal
payoff, and a specific action. Do not invent links, forms, deadlines, races, measures, records, or
results. Muxin makes the final substance and voice decision.

## 8. Bounded mode handoffs

| Existing mode | Input | Bounded output | Next owner |
|---|---|---|---|
| `collect` | Capture, config, and a supported platform route | Staged/corpus source records | Evidence review or `analyze` when explicitly requested |
| `analyze` | Selected records and recorded metrics | Structural evidence notes with scope and caveats | Muxin or `synthesize` when explicitly requested |
| `synthesize` | Analyzed evidence grouped by platform and pool | Proposed library edits with citations and evidence strength | Muxin before library change |
| `ideas` | Patterns plus Muxin material and lane/platform context | Idea proposals | Muxin / existing content path |
| `series` | One Muxin source and available treatments | Reviewable series cards | Existing `/develop` acceptance path |
| `rewrite` | One Muxin source or cut | Three source-grounded treatment drafts | Muxin review |
| `asap` | One Muxin source and civic rubric | Ranked CTA candidates with verification status | Human verification and review |
| `remix` | Muxin material plus common-hook evidence | Source-grounded opener treatment | Muxin review |

No mode silently invokes a sibling mode, writes a publishable derivative, or changes config. If
evidence is thin, say so before proposing anything and mark it `insufficient`, `blocked`, or
`NEEDS HER INPUT` as appropriate.

Every treatment should expose:

- platform, medium, and format;
- why that treatment serves the message and audience;
- pattern references and source/post evidence references;
- evidence status, caveats, and experiment variables when present;
- voice and originality review state;
- the pending human decision.

## 9. Review and delivery gate

Muxin is the final reviewer for the claim, substance, lane, voice, CTA, platform, format, visual,
timing, and originality. Generation is never approval. A candidate is not publishable until its
lineage and evidence are present, checks pass, and Muxin explicitly approves it.

`/patterns` does not publish, schedule, send, post, auto-reply, or auto-approve. `/publish` may act
only on the existing approved queue and its own delivery rules. Browser posting still requires
Muxin's explicit approval. No current collector, blueprint scaffold, or pattern count changes that
gate.
