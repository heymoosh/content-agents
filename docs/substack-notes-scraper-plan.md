# Substack evidence ingestion — implementation plan

**Date:** 2026-08-08 (round-6; live feasibility verified)
**Status:** implementation-ready specification. The Notes reply endpoint, payload, and complete
cursor walk have been verified against a real 68-branch thread. No repository code has been written.

**Scope — v1 is Notes only, across four commands.** Two capture commands (`research:backfill`,
`research:sync`) pull Muxin's Substack **Notes** and their reply trees and reconcile them across runs.
Two classification commands (`research:classify`, `research:reclassify`) turn captured replies into
research signal under a named taxonomy. Everything lands in the account-level `research_observations`
and `research_observation_classifications` stores defined by `docs/venture-schema-contract.md` §5.4a
and §5.4c, where Venture Phase 1, future ventures, and the Signals room read it.

**Essay comments are a named follow-up, not v1.** The data contract already represents them
(`surface: "essay"`, `source: "comment"`, `comments_count` metrics) so nothing has to change later,
but their endpoint has not been discovered and no command captures them. A research read covering only
Notes must say so through `collection_coverage` (`venture-schema-contract.md` §2C.3), marking essay
comments `unavailable` rather than leaving them unmentioned. See §5.1.

**This document states current desired behavior only.** Earlier drafts carried review annotations and
stacked "what changed" sections; both are gone. Everything below is what to build. Where something is
genuinely undecided it is in §10 as an open question with a recommended default, never as a caveat
buried in the behavior spec. Revision history lives in the review record
(`venture-work-package-1-verification.md`), not here.

---

## 0. What this is for

`/atomize notes` treats Notes as a distribution surface: it needs engagement counts to decide what to
cross-post. This is different. It treats the *replies* to Notes as a research corpus. The
value is not the Note, it is what people wrote back — what they are confused about, what emotional
register they are in, what kind of help they are asking for, and which behavior-based audience role
they are showing.

That corpus answers a specific question the Venture build needs answered before it spends its three
Phase 1 probes: **what is already established, and what is genuinely still unknown.** Muxin has
Notes, some of which were posted specifically to test audience reaction. If the replies already
establish that a problem is felt, Phase 1 should not spend a probe re-proving it — it should test what
help people want and which audience role responds (`venture/rules.md` §5.1A). That only works if the
existing replies are readable as structured evidence rather than as a pile of nested JSON.

**The corpus is account-level, not venture-level, and that is the central design fact.** A reply from
March is a fact about Muxin's audience. It has to serve the first venture, the second venture, the
Signals room, and content strategy that has nothing to do with any venture — without three copies and
without Signals reading inside one venture's private folder. §3 is where that lands.

**Not specified here:** what specific lead magnet, product, or campaign this research validates. If
there is a specific downstream target, adding it to §10 would let the classification prompts weight
for it rather than tagging in a vacuum.

---

## 1. Why this is a new build, not an extension of `/atomize notes`

`src/atomize/fetch-notes.ts` (behind `npm run new-notes`) fetches Muxin's Notes via the unofficial
`/api/v1/reader/feed/profile/<id>` endpoint, but pulls note-level fields only: `likes`, `reposts`,
`replies` as a count. No reply bodies, no thread structure. Correct for its job (deciding what to
cross-post), wrong for reading what people said back. This is a separate module reading a different
shape of data, with a different consumer and different privacy posture.

## 2. Hard constraints, confirmed by reading the repo

- **Runs on Muxin's Mac, never in the cloud.** `docs/setup-notes-daily-launchd.md` records that a
  GitHub Actions version of the notes fetch was tried and abandoned: Substack's WAF returns a flat 403
  to every cloud-runner IP regardless of headers or User-Agent, an IP-reputation block confirmed
  across PRs #75–78. The same applies to any cloud session, which is why this document is a plan for
  a local Claude Code session rather than tested code.
- **There is no documented Substack API.** Every endpoint this repo uses (the Notes feed, the
  writer-dashboard analytics in `src/pull/platforms/substack.ts`) was found by sniffing real browser
  XHRs against an authenticated session. All of it is unofficial and can change without notice, hence
  the existing loud-failure `PullError` pattern instead of silent empty results.
- **The reply-tree endpoint is unofficial but confirmed.** §4 records the live request, payload,
  pagination behavior, and the completeness trap found during the feasibility check.

### Why the confirmed structure fits the existing feed model

`fetch-notes.ts`'s `FeedComment` type carries `ancestor_path`, `post_id`, and `children_count` on every
feed item, and the code filters "is this one of Muxin's own top-level Notes?" by checking
`ancestor_path === ""`. That matches the live endpoint: Notes and replies use the same underlying
comment model. A Note is a comment with an empty `ancestor_path`; replies carry non-empty paths and
arrive in branches from the `/api/v1/reader/comment/<id>/replies` endpoint recorded in §4.

---

## 3. Where the data lives — three layers

| Layer | Location | Git | Holds |
|---|---|---|---|
| **Raw capture** | `data/research/substack-notes/<note_id>.json` | ignored | Verbatim API payloads: note body, full nested reply tree, author handles, timestamps, engagement counts. Unprocessed. Not evidence yet. |
| **Canonical observations** | `research_observations` table in `data/analytics.db` | ignored (already) | One row per source observation, account-level, venture-neutral: text, source, reply id, dates, metrics. Contract: `venture-schema-contract.md` §5.4a. |
| **Classifications** | `research_observation_classifications` table, same database | ignored (already) | Many rows per observation — one per taxonomy and version. Contract: §5.4c. Split out in round-4 so one observation can carry several ventures' taxonomies without being duplicated. |
| **Per-venture links** | `venture/<slug>/evidence-links.jsonl` | ignored | Which observations a given venture uses, with derived `evidence_role`, `unknown_ids`, `target_audience_fit`. Contract: §5.4b. Written by the venture, not by this pipeline (§7). |

**`.gitignore` must gain `data/research/` before the first capture run, and `.env` must gain
`RESEARCH_HASH_KEY`.** `data/research/` is not covered today. `data/analytics.db` is already ignored
(root `CLAUDE.md`: "Never commit `.env` or `data/analytics.db`"), and `venture/<slug>/*.jsonl` is
covered by the Venture build's own gitignore work. `data/research/` is the gap, and raw capture holds
reply text and author handles, so this is a prerequisite, not a cleanup task. `RESEARCH_HASH_KEY` is
the HMAC key for `respondent_hash` (§6.2, schema §5.4a) and must exist before the first observation is
written, since re-keying later invalidates every existing hash.

**Why the observation store is account-level and lives in `data/analytics.db`.** It has to serve
multiple ventures, the Signals room, and non-venture strategy. Filing it inside one venture forces
either duplication or a private-file read from Signals, and it makes `unknown_ids` unassignable until
some particular venture has a reviewed research plan — a circular dependency, since ingestion should
be able to run before any venture exists. `data/analytics.db` already exists, is already gitignored,
and is already what `/strategy` reads, so it avoids creating a second silo. (Whether research evidence
deserves its own `data/research.db` for blast-radius reasons is open question 15 in the schema
contract; either satisfies the contract.)

**A ledger sits alongside the raw capture** at `data/research/substack-notes-ledger.jsonl`, following
the existing `data/notes-spread-ledger.jsonl` convention. It holds per-note capture state, and §5.3's
reconciliation algorithm is entirely a function of it.

---

## 4. Step zero — endpoint discovery (complete 2026-08-08)

Live discovery used the existing saved Substack Playwright profile against Note `c-288661298`, whose
public feed record reported 68 replies. The usable requests are:

```text
GET /api/v1/reader/comment/<numeric_comment_id>
GET /api/v1/reader/comment/<numeric_comment_id>/replies?comment_id=<numeric_comment_id>
GET /api/v1/reader/comment/<numeric_comment_id>/replies?comment_id=<numeric_comment_id>&cursor=<opaque>
```

`numeric_comment_id` is the Note id without its `c-` prefix. The replies payload contains
`commentBranches[]`, `moreBranches`, `nextCursor`, `rootComment`, and, on the first page,
`automodHiddenBranches`. Each branch has `comment` plus `descendantComments[]`; every comment exposes
the stable `id`, `user_id`, `body`, `date`, `edited_at`, `ancestor_path`, `children_count`, reactions,
and related metadata needed by the mapping layer. Nesting is therefore explicit through both the
branch structure and `ancestor_path`.

**Cursor rule.** Treat `nextCursor` as opaque and require it to advance. A stateless unauthenticated
request returned page 1 successfully, but sending its cursor without the browser session returned
the same page and cursor again. That can look like a healthy 200 response while silently truncating
the archive or looping forever. Thread capture therefore runs through the existing authenticated
`launchPlatform("substack")` request context. It hard-fails a repeated cursor, a page that adds zero
new ids while claiming another cursor, or a walk that reaches the page cap.

**Count semantics are now confirmed.** On the live target, the public feed's `children_count: 68`
matched **68 top-level branches**, not the flattened reply count. Walking nine cursor pages returned
68 branches and 147 unique reply ids after descendants were included. Completeness must compare
branch counts with branch counts; it must never compare the feed's 68 to the flattened 147. §5.3
uses separate ledger fields for these two quantities.

The `research_observations` contract (§5.4a of the schema) remains the stable boundary. Raw payloads
stay verbatim, while the mapping layer reads only the confirmed fields above. DOM scraping is neither
needed nor permitted as a silent fallback.

---

## 5. Capture

### 5.1 Four commands, and what each one does

Capture and classification are separate commands. An earlier draft said "two commands pull and
classify" while naming only capture commands, leaving it ambiguous whether capture invoked
classification implicitly. It does not, and the separation is deliberate: capture is cheap, safe, and
re-runnable, while classification costs model calls, depends on a taxonomy that may not exist yet, and
must be gated behind a gold-set check (§9). Coupling them would mean every sync run re-triggers
classification, and a taxonomy revision would require a re-capture.

| Command | Does | Does not |
|---|---|---|
| `research:backfill` | One-time historical sweep: enumerate the complete Notes archive, capture full reply trees and metrics, write observations. Re-runnable safely. | Classify. Assign `evidence_role`. |
| `research:sync` | Ongoing pass on a schedule (the launchd pattern in `docs/setup-notes-daily-launchd.md` is the model): capture new Notes, re-check recent ones for new, edited, or deleted replies per §5.3, refresh metrics per §5.4. | Classify. Assign `evidence_role`. |
| `research:classify` | Classify observations that have **no** classification under the named taxonomy, writing `research_observation_classifications` rows (schema §5.4c). Takes a `--taxonomy <id>` argument; refuses to run without one. | Re-classify anything already classified under that taxonomy. Touch observations. |
| `research:reclassify` | Explicit opt-in re-run under a new taxonomy or a new version of an existing one. Writes new classification rows, setting `supersedes_classification_id` when the taxonomy id matches an existing row's. | Create new observation rows. Delete prior classifications. |

**`research:reclassify` writes classifications, never observations.** This is the round-4 correction:
an earlier draft said re-classification under a new taxonomy creates new observation rows, which
duplicated the reply, inflated recurrence and topic-heat counts that work by counting observations, and
let one venture's taxonomy leak into another's evidence. Schema §5.4c is the model; this command
writes into it.

**No command decides `evidence_role`** — that is derived per venture at link time (§7), which is why a
single "historical backfill" framing would have been wrong.

**Essay comments are a follow-up, not v1.** The observation contract already represents them
(`surface: "essay"`, `source: "comment"`, and `comments_count` metrics), so nothing has to change
later to accommodate them. But their endpoint has not been discovered, and §4's discovery step covers
Notes only. v1 is Notes: `research:backfill` and `research:sync` enumerate Notes and their reply trees.
Essay-comment capture is a separately named follow-up that reuses the same contract, the same
reconciliation algorithm, and the same classification commands once its endpoint is confirmed. An
earlier draft claimed essays were in scope at the top and then recommended stubbing them, which is the
contradiction this resolves.

### 5.2 Enumeration

Extend `fetchSubstackNotes`'s pagination, with the current 20-note default and 25-page cap removed for
backfill: page until the feed reports no `nextCursor`. Capture every Note regardless of reply count —
a zero-reply Note is itself signal about what did not land, and pre-filtering would bias the corpus
toward what already worked.

Use the unauthenticated public-profile and feed routes to enumerate Notes. Use the authenticated
Playwright request context for every reply-tree cursor walk. Do not switch between clients within one
thread: cursor progress is session-bound in the verified behavior (§4).

**Politeness and failure.** A delay between requests, exponential backoff on repeated failures, and a
hard stop-and-report if 403s stack up past a threshold. The existing `PullError` taxonomy covers
`SESSION_EXPIRED` and `UI_CHANGED`; this needs one more kind for "the WAF is pushing back," which is a
stop condition, not a retry-forever condition. **A run that stops early reports partial completion
loudly** and never marks unfetched notes as complete (§5.3).

### 5.3 Reconciliation — the refresh algorithm

"Skip notes already captured" is wrong: replies arrive late, get edited, and get deleted. Per-note
state in the ledger:

```
note_id, first_seen_at, last_checked_at, last_activity_at,
reply_branch_count_reported, reply_branch_count_captured,
reply_observation_count_captured,
completeness: complete | partial | stale | error,
cursor_or_etag, last_error
```

**Refresh tiers.** A run selects which notes to re-check by age, so a daily sync does not re-walk the
whole archive:

- Note published < 7 days ago: re-check every run.
- 7 to 30 days: re-check if `last_checked_at` is more than 72 hours old.
- Over 30 days: re-check if `last_checked_at` is more than 30 days old, **or** whenever
  `reply_branch_count_reported` does not equal `reply_branch_count_captured` (a mismatch means
  something is missing regardless of age).

**Per-note reconciliation, on each check:**

1. Fetch the current reply tree. If the fetch fails or returns obviously truncated data, set
   `completeness: error` or `partial`, record `last_error`, and stop for this note. **Never mark a
   note `complete` on a failed or partial fetch** — this is the rule that keeps a WAF block from
   silently looking like "this Note has no replies."
2. For each fetched reply, match on the platform's stable `reply_id`:
   - **New** — insert a new observation row.
   - **Unchanged** — update `last_checked_at` only.
   - **Changed** (body text or the platform's edit timestamp differs) — write a **new** observation
     row carrying the new text and set `superseded_by` on the previous row. Never overwrite in place:
     a research read that cited the old text stays honest about what it cited. Re-queue the new row
     for classification.
3. For each stored reply **not** present in a fetch whose `completeness` is `complete`: set
   `deleted_at` on the row. This is a tombstone, never a hard delete. A tombstoned reply stays
   citable as evidence, renders as withdrawn, and is excluded from fresh aggregate counts. A reply
   missing from a `partial` fetch is **not** tombstoned — absence from an incomplete fetch proves
   nothing.
4. Set `completeness: complete` only when all of these hold: the final page has no `nextCursor`,
   `moreBranches` is zero, every cursor advanced, every nonterminal page added at least one new id,
   and `reply_branch_count_reported` equals `reply_branch_count_captured`. Otherwise set `partial`
   (or `error` for a repeated cursor/page-cap failure). `reply_observation_count_captured` is the
   flattened unique total, including descendants, and is expected to exceed the branch count on
   nested threads. Update `last_activity_at` from the newest reply seen.

**Checkpoint per note, not per run.** Write each note's raw capture and ledger row as soon as it is
fetched. `docs/outreach-engine-plan.md` §1 already established per-item checkpointing as this repo's
answer to long batches that die partway; same shape here.

### 5.4 Metric ingestion

Reconciliation above handles replies. Metrics are a separate write path and both `research:backfill`
and `research:sync` run it, because without it a zero-reply Note produces **no canonical evidence at
all** — the reconciliation loop only inserts rows for replies that exist, so a Note nobody answered
would leave the store silent about a post that did in fact reach people. Phase 1 would then see only
the posts that generated conversation and systematically overweight them. That is the exact bias §5.2
refuses to introduce by pre-filtering, reintroduced through the back door.

**What gets written, per captured Note (or essay, once in scope):** one `source: "metric"` observation
per measured quantity, at minimum `views`, `likes`, `restacks`, and `replies_count` for a Note or
`comments_count` for an essay. Each carries `metric_value`, `window_start`, `window_end`, and
`collected_at`, plus `previous_value` and `delta` when a prior reading exists. `content_item_id` and
`note_id` link the metric to its post, and `published_at` is copied from the post so evidence-role
derivation (§7) works for metrics as well as replies.

For Notes, `replies_count` preserves the platform feed's `children_count`, which the live check
confirmed is the number of top-level branches. It is not recomputed from flattened observations:
one 68-branch Note produced 147 unique reply observations after nested descendants were included.

**Account-level, per run:** `source: "subscriber_movement"` observations carrying
`subscribers_total` and `subscribers_delta` over the run's window. These have no `content_item_id` —
a subscriber count is not attributable to one post.

**A measured zero is written as `0`.** If the fetch succeeded and the Note has no replies, the
`replies_count` observation carries `metric_value: 0`. It is not skipped, not omitted, and not `null`.
`null` is reserved for "nobody measured this" — a quantity the platform did not return, or a run that
failed before reading it. The two are different facts and the store must be able to tell them apart:
a real zero is evidence that a post reached people and started no conversation, which is one of the
more useful things Phase 1 can know.

**Idempotency: keyed on the measured value, never on the window.** Write a new metric observation
**only when `metric_value` differs from the most recent observation for the same
`(content_item_id, metric_name)` pair**. An unchanged reading advances that row's `window_end` and
`collected_at` and creates nothing new.

An earlier draft said "value **or** collection window has changed," which cancelled itself out: a
daily sync moves the window on every run by definition, so every metric would have written a new row
every day — precisely the duplication the rule exists to prevent. The window describes when a reading
was taken, not which reading it is.

A metric that has never moved therefore has one row whose window spans first-seen to last-checked,
which is the correct representation of a measurement that has held. A metric that moves gets a new row
with `previous_value` and `delta` set, so history is a series rather than an overwrite. Zeros
participate normally: a Note with no replies at every check writes one row, not one per sync. Without
this, every count that works by counting observations — recurrence, topic heat, distinct-respondent
tallies — inflates steadily for no reason.

**A failed metric fetch writes nothing and marks the note `partial`.** It does not write zeros. This is
the same discipline §5.3 applies to replies: absence of a successful measurement is never recorded as
a measurement of absence.

### 5.5 Coverage reporting

Every run emits a per-source coverage record for the window it covered, in the shape
`phase_1_research_read.collection_coverage` consumes (`venture-schema-contract.md` §2C.3): the source,
the window, a status of `complete` / `partial` / `unavailable` / `not_checked`, the records captured,
and a `gap_reason` for anything not complete.

This exists because **v1 does not cover every channel `venture/rules.md` §5.6 lists**, and a research
read must be able to say so rather than implying full coverage by omission. For a v1 run:

- `note_reply`, `metric`, `subscriber_movement` — `complete` or `partial` per the reconciliation
  outcome.
- `essay_comment` — `unavailable`, `gap_reason: "endpoint not discovered; Notes-only in v1"`.
- `dm`, `email`, `follow_up_question`, `creator_observation` — `not_checked` by this pipeline. They
  reach the store through manual entry (`POST …/observation/ingest`), so the pipeline reports what it
  did not look at rather than asserting nothing was there.

A read that shows Notes `complete` and everything else `not_checked` is an honest read. A read that
shows Notes `complete` and stays silent about the rest is not, and it is the failure this record
prevents.

---

## 6. Classification

Run by `research:classify` and `research:reclassify` (§5.1), never implicitly by capture. Turns each
captured reply into the five per-reply labels the contract defines
(`venture-schema-contract.md` §5.4c): `topic_labels`, `emotional_frame`, `desired_help`,
`behavior_audience_role`, `stuck_point` — each with its own confidence, the span of the respondent's
words it was drawn from, and the option to abstain.

**Output is a classification row, not an observation.** Each classified reply gets one
`research_observation_classifications` row pointing at the existing `observation_id`, carrying the
taxonomy id and version, the prompt and model version, the status, and the fields. An observation may
accumulate several such rows under different taxonomies — that is the point of the split, and it is
what lets two ventures with different taxonomies read the same corpus without either duplicating it or
seeing the other's labels. Nothing in this pipeline ever writes a second observation row for text it
has already captured.

**What classification does NOT produce.** Topic heat, recurrence, signal quality, and lead-magnet
implications are conclusions across many replies. They are computed on `phase_1_research_read`
(schema §2C.3), reviewed by Muxin there, and never written onto an observation or a classification. A
single reply cannot tell you what a lead magnet should be, and a pipeline that emits the label anyway
is producing confident nonsense at scale.

### 6.1 Taxonomies are configuration, not code

Label vocabularies live in `config/research-taxonomies/<taxonomy_id>.yaml`. One file per taxonomy,
versioned, named by `research:classify --taxonomy <id>`, and recorded on every classification row's
`taxonomy_id` / `taxonomy_version`:

```yaml
taxonomy_id: civic-tech-substack
version: 1
label: Civic tech Substack audience
notes: >
  Built for Muxin's civic-tech Substack audience. Not a default for other ventures.
dimensions:
  desired_help:
    kind: single_label
    allow_abstain: true
    labels:
      - id: understand
        description: Wants to make sense of how something works.
        positive_example: "Wait, how does a PAC actually move money to a candidate?"
        negative_example: "Totally agree, this is a mess."
      - id: investigate
      - id: decide
      - id: act
      - id: organize
  emotional_frame:
    kind: single_label
    allow_abstain: true
    labels: [ ... ]
  behavior_audience_role:
    kind: single_label
    allow_abstain: true
    derived_from: expressed_behavior_only
    labels: [ ... ]
  topic_labels:
    kind: multi_label
    max_labels: 3
    allow_abstain: true
    labels: [ ... ]
  stuck_point:
    kind: free_text
    allow_abstain: true
    max_words: 25
```

**The Understand / Investigate / Decide / Act / Organize set is one taxonomy for one venture's
audience, not a universal content-agents category system.** A different venture writes a different
file. This is the same fixture-isolation discipline `venture/rules.md` §1.8 and §11 already apply to
the civic-tech worked example: a hardcoded universal set would be that leak in a new form.

**Every dimension has `allow_abstain: true`.** A taxonomy that forces a label on every reply is a
taxonomy that manufactures data.

**`behavior_audience_role` carries `derived_from: expressed_behavior_only`, and that is enforced, not
advisory.** The role must come from what the person said they want to do or are stuck on. Inferring
political affiliation, demographic category, or any other sensitive attribute is out of scope for this
pipeline — not as a matter of taste, but because the resulting label would be an unfalsifiable guess
attached to a real person's identity hash. The taxonomy validator rejects a `behavior_audience_role`
label whose description references demographics or political identity.

**Version stamping.** A venture records the `taxonomy_id` and `version` its Phase 1 classification ran
under in `canon.md` at kickoff, the same way it stamps the rules version (`venture/rules.md` §F of the
build plan). A taxonomy revision after a venture starts does not retroactively change that venture's
stamped version; re-classifying under a new version writes new rows rather than mutating old ones.

### 6.2 The model route

Reuse the local-Claude pattern proven in `src/providers/polish/claude-cli.ts`: shell out to headless
Claude Code on Muxin's subscription, $0 marginal cost, no API key, consistent with CLAUDE.md rule 6.

**State the data-flow accurately.** The CLI runs locally; the reply text it is given travels to
Claude's service to be classified. "Local Claude" describes where the process runs, not where the text
stays. Therefore, before any text leaves the machine:

- Author names and handles are replaced with the observation's `respondent_hash`. The classifier never
  sees who wrote a reply, only what it says. **That hash is a keyed HMAC, not a plain digest** —
  `HMAC-SHA256(RESEARCH_HASH_KEY, "<platform>:<stable_platform_user_id>")`, with the key in `.env`
  (schema §5.4a). A plain `sha256(handle)` would be reversible in seconds: the handle space is public,
  small, and enumerable, so an unkeyed hash of it is a lookup table away from being the handle itself.
  Capture derives the hash from the platform's stable user id, never the display name or handle, so
  identity continuity survives a rename. The raw identifier and the key are never logged, never
  written to the error log, and never sent to the model.
- Email addresses, URLs with identifying query parameters, and phone numbers in reply bodies are
  redacted to placeholders.
- Only the reply text needed for the classification is sent. Raw API payloads, engagement metadata,
  and unrelated thread branches are not.

This is minimization, not anonymization, and it should be described that way: a distinctive reply can
still identify its author to someone who reads it. It reduces exposure; it does not eliminate it.

### 6.3 Chunking — bounded branches, then note-level synthesis

"Classify the whole thread in one call" fails on long threads and silently degrades before it fails.
Instead:

1. **Split each Note's tree into branches.** A branch is one top-level reply plus its descendants.
2. **Classify one branch per call**, with the Note body included as context so a reply like "same
   here" is interpretable. Cap each call at a configured reply count and token budget.
3. **If a single branch exceeds the cap**, split it by depth into sub-branches, classify each, and
   mark every observation from that branch `completeness_note: "branch_split"` so a later reader knows
   the context was partial.
4. **Synthesize at the Note level from structured outputs only** — the per-branch label objects, not
   the raw text again. Note-level synthesis exists to reconcile obvious conflicts across branches, and
   it never invents a label no branch produced.

Context is preserved where it matters (within a conversation) without unbounded growth.

### 6.4 Untrusted input

Reply text is written by strangers and must be treated as data, never as instruction:

- Reply text is delivered inside an explicitly delimited block labeled as untrusted third-party
  content, with the classification instructions outside it.
- **Output is validated against the taxonomy's closed label set.** A label not in the configured
  taxonomy is a validation failure, never a new category. This is the strongest defense available:
  even a successful injection cannot introduce a label the taxonomy does not define.
- The classifier has no tools and no write access. It returns a structured object and nothing else.
- **Classifier output never determines control flow.** It cannot decide which notes to fetch, which
  files to write, which commands to run, or when to stop. The capture and reconciliation logic (§5) is
  entirely independent of anything a reply says.
- A reply containing what looks like an instruction is itself an observation worth recording. It gets
  classified like any other text, and if it fails validation it abstains (§6.5).

### 6.5 Failure and abstention

- **Abstention is a normal outcome.** A field the classifier cannot call with reasonable confidence
  gets `abstained: true`, `value: null`. A reply where every field abstains gets
  `classification.status: "abstained"`. Two-word replies should mostly abstain; if they do not, the
  prompt is wrong.
- **Schema-validation failure abstains, it does not coerce.** Output that fails validation against the
  taxonomy or the observation contract results in `status: "abstained"` for that observation, plus a
  row in `data/research/classification-errors.jsonl` holding the raw output for inspection. The
  observation itself is never dropped and never partially written.
- **Corrections preserve what they replace.** When Muxin changes a label through the correction view,
  the machine value moves to `classification.correction.superseded` with her reason and timestamp, and
  `status` becomes `human_corrected` (schema §5.4a). This is what makes classifier accuracy
  measurable after the fact.

---

## 7. Evidence role and per-venture linking

**This pipeline does not assign `evidence_role`, and does not write `evidence-links.jsonl`.** It
writes account-level observations. Linking happens on the venture side, when a venture has a reviewed
`phase_1_research_plan` to tag against, and the role is derived there from the venture's `kickoff_at`,
the observation's `published_at`, and whether the content item is one of that venture's registered
probes (schema §5.4b's three ordered rules).

This is the correction to the earlier draft's "everything this scraper produces is
`historical_prior`." That was wrong twice over: the same pipeline re-runs during active sprints and
would mislabel fresh probe replies as history, and the role is not a property of the observation at
all — the same March reply is `historical_prior` to an August venture and `current_organic` to a
February one.

**What this pipeline owes the linking step:** an accurate `published_at` on every observation, and a
`content_item_id` wherever the observation traces to a specific published Note or essay. Without those
two, derivation cannot run. They are therefore required capture fields, not nice-to-haves.

---

## 8. What Signals and `/strategy` read

**Current state first, because an earlier draft got this wrong.** `/strategy` reads
`data/analytics.db` and generates a dated Markdown brief in `briefs/`. **Signals does not read the
database.** `src/review/signals.ts`'s `readSignals()` parses the most recent
`briefs/<date>-strategy-brief.md` — the data-confidence table and the `[DO MORE]` / `[TEST]` /
`[DO LESS]` recommendations — and nothing else. So adding a research read to Signals is new work, not
a wiring change to something that already reads the right file.

**Target state.** The store exposes exactly one read path and both consumers use it: a redacted
account-level research read returning aggregate counts and `redacted_text` only, never `exact_text`
and never a raw `respondent_hash`. Neither Signals nor `/strategy` reads `data/research/` raw captures
or anything inside `venture/<slug>/`.

Mapped into the four outcome families (schema §5.8): reply and comment observations are the
**conversation** family; captured view, like, and restack metrics are **attention**; subscriber
movement is **audience**. This is the wiring that keeps the corpus from becoming a second silo — an
earlier draft deferred it as out of scope, which is precisely how silos form.

**Who builds it: Card D** ("Four-family Signals") in the backlog proposal owns adding the redacted
research-observation read to Signals. This plan owns producing the data it reads. Sequencing them the
other way round would put a read path in front of an empty store.

**What this does not do:** it does not let Signals or `/strategy` change anything. Every existing
guardrail holds — recommendations stay recommendations, and `venture/rules.md` §1A rule 10 still
requires Muxin's adoption before any routing, cadence, framing, or CTA change takes effect.

---

## 9. Acceptance tests

The build is not done until these pass. They are behavioral, not typechecks, matching the standard
`venture-build-plan.md`'s Model notes already set.

**Capture and reconciliation**

1. A note captured twice with an unchanged tree produces no duplicate observations.
2. An edited reply produces a second observation row with `superseded_by` set on the first, and the
   original text remains readable.
3. A reply that disappears from a `complete` fetch is tombstoned with `deleted_at`, not deleted.
4. A reply missing from a `partial` fetch is **not** tombstoned.
5. A fetch that 403s leaves the note `error` or `partial`, never `complete`, and the run reports the
   shortfall rather than exiting clean.
6. A run interrupted mid-archive resumes without re-fetching completed notes and without losing them.
7. A cursor response that repeats a prior cursor or adds zero new reply ids while advertising a
    next page stops with `error`; it never loops and never marks the Note complete.
8. A fixture matching the verified high-reply shape—68 top-level branches and 147 unique flattened
    replies—records `reply_branch_count_captured: 68`, `reply_observation_count_captured: 147`, and
    `completeness: "complete"` after the ninth page.

**Classification**

9. A two-word reply with no discernible frame abstains on `emotional_frame` rather than emitting a
   label.
10. Output containing a label outside the configured taxonomy fails validation, the observation lands
   with `status: "abstained"`, and the raw output appears in the error log.
11. A reply whose text contains instruction-shaped content is classified as ordinary text; no capture
   behavior, file write, or fetch decision changes as a result.
12. Every non-abstained field carries a confidence and an `evidence_span`.
13. A Muxin correction sets `status: "human_corrected"` and preserves the machine value under
    `correction.superseded`.
14. A branch exceeding the size cap is split, and its observations carry the partial-context marker.

**Gold set**

15. A hand-labeled gold set of 30 to 50 replies lives at
    `data/research/gold-set/<taxonomy_id>-v<n>.jsonl` (gitignored — it contains reply text). Muxin
    labels **all five output fields** on each gold item, plus an `ambiguous` flag per field for items
    where she judges no confident label is available. The classification pass is scored against it
    before any full run is trusted.
16. **Every one of the five outputs has a threshold** (corrected round-5 — an earlier version gated
    only `desired_help`, `emotional_frame`, and abstention, leaving `behavior_audience_role`,
    `topic_labels`, and `stuck_point` unvalidated. Audience role is one of Phase 1's three central
    unknowns, so shipping it unmeasured meant unvalidated labels could drive Phase 2 concept
    generation):

    | Field | Metric | Threshold |
    |---|---|---|
    | `desired_help` | exact label agreement | ≥ 80% |
    | `emotional_frame` | exact label agreement | ≥ 70% |
    | `behavior_audience_role` | exact label agreement | ≥ 75% |
    | `topic_labels` | per-item Jaccard overlap against Muxin's label set, averaged | ≥ 0.60 |
    | `stuck_point` | Muxin's binary judgement, "does this capture the stuck point" | ≥ 70% |
    | *(all fields)* | abstention rate on items she flagged `ambiguous` | ≥ 80% |
    | *(all fields)* | confident-wrong rate on `ambiguous` items | ≤ 10% |

    `topic_labels` is multi-label so exact agreement is the wrong measure; Jaccard credits partial
    overlap, which is the honest read of "did it find the right topics." `stuck_point` is free text
    and cannot be scored by string match, so it is graded by Muxin once per gold item during the same
    pass that builds the set — 30 to 50 binary judgements, not an ongoing burden.

17. **Below any threshold, the pass writes `status: "abstained"` for every field of every observation
    and reports the per-field scorecard** rather than filling the store with labels nobody should
    trust. It does not partially ship the fields that passed: a taxonomy where `emotional_frame` is
    reliable and `behavior_audience_role` is not is a taxonomy that needs revision, and mixing a good
    field with a bad one in the same store makes the bad one invisible downstream. Abstaining at scale
    is recoverable; a corpus of confident wrong labels is not.
18. The scorecard is written to `data/research/gold-set/<taxonomy_id>-v<n>-score.json` and is a
    required input to Muxin's decision to run the taxonomy at scale.

**Metrics**

19. A Note with zero replies produces a `replies_count` metric observation with `metric_value: 0` —
    present, not omitted, not `null`.
20. A failed metric fetch writes no metric row and marks the note `partial`; it never writes zeros.
21. A second sync over unchanged metric values creates no new rows; a changed value creates one row
    with `previous_value` and `delta` set.
22. Every captured Note yields observations for views, likes, restacks, and its reply or comment
    count; each run yields subscriber total and delta observations.

**Classification cardinality**

23. Classifying one observation under two taxonomies leaves exactly one `research_observations` row
    and two `research_observation_classifications` rows.
24. A recurrence count over an observation classified three times returns 1, not 3.
25. `research:reclassify` under the same taxonomy sets `supersedes_classification_id`; under a
    different taxonomy it does not.

**Boundaries**

26. No observation or classification row carries topic heat, recurrence, signal quality, or a
    lead-magnet implication.
27. The Signals and `/strategy` read paths open no file under `venture/` and no raw capture file.
28. No pipeline output sets `evidence_role`; a link created with a caller-supplied role is rejected.
29. `data/research/` is gitignored, verified by a test that stages a capture file and asserts git
    ignores it.
30. `respondent_hash` differs for the same platform user id under two different `RESEARCH_HASH_KEY`
    values; no log line, error record, or export contains the raw identifier or the key.

---

## 10. Open questions

Each carries a recommended default so a build session is never blocked, but none should be silently
decided.

31. **Archive size.** Order of magnitude of Notes, so backfill volume and backoff are sized rather than
   guessed. Recommended default: assume low hundreds and make the politeness delay configurable.
32. ~~**Essay comments in scope now or later?**~~ **Closed round-4: follow-up, not v1** (§5.1). The
   contract represents them so nothing changes later; the capture work is Notes-only until their
   endpoint is discovered.
33. ~~**Where the reply tree actually nests.**~~ **Closed round-6:** `commentBranches[].comment` plus
   `commentBranches[].descendantComments[]`, with `ancestor_path` on each comment (§4).
34. **What this research validates downstream.** A named target would let the classification prompts
   weight for it. Recommended default: none, tag neutrally.
35. **Does backfill run before the first venture kicks off?** Affects how much historical evidence that
   venture's first `phase_1_research_plan` can cite. Recommended default: yes, run it first — the
   whole point is to stop the venture retesting what is already known.
36. **Re-classification policy on taxonomy revision.** Re-run over the whole corpus, or only forward?
   Recommended default: forward only, with `research:reclassify` as the explicit opt-in for a full
   re-run. Note that since round-4 this is cheap in storage terms and safe in counting terms —
   re-classification writes classification rows against existing observations (§5.1), so it no longer
   duplicates text or inflates recurrence counts. The remaining cost is model calls.
37. **Does `research:sync` run classification automatically once a taxonomy is stable?** Currently no —
   capture and classification are separate by design (§5.1). Recommended default: keep them separate
   and let a scheduled job chain them explicitly if Muxin wants that, so a taxonomy problem never
   silently contaminates a capture run.

---

## 11. Sequencing

38. **`.gitignore` for `data/research/`, and `RESEARCH_HASH_KEY` in `.env`.** Before anything captures.
39. ~~**Endpoint discovery.**~~ **Complete 2026-08-08** (§4): endpoint, payload, session-bound cursor,
   and branch-versus-flattened count semantics verified on a 68-branch / 147-reply thread.
40. **Capture at small scale** — 2 to 3 known high-reply Notes, output shape confirmed by hand.
41. **The store** — migrations and write paths for both `research_observations` and
   `research_observation_classifications`, against schema contract §5.4a and §5.4c. Both tables land
   together; building the observation table alone reintroduces the one-taxonomy cap.
42. **Metric ingestion** (§5.4), including the zero case and the idempotency rule. Before full
   backfill, so the backfill writes metrics rather than needing a second pass.
43. **Full backfill** with checkpointing already proven at small scale.
44. **Taxonomy config plus gold set**, hand-labeled by Muxin, before any classification runs at scale.
45. **`research:classify`**, scored against the gold set, abstaining wholesale if below threshold.
   `research:reclassify` follows once the first taxonomy is stable enough to have a second.
46. **Per-venture linking** (§7) — belongs to the Venture build, listed here so the seam is visible.
47. **Signals read path** (§8) — Card D. Last, because a read path in front of an empty store proves
    nothing.

---

*Grounded in a direct read of `content-agents`' `src/pull`, `src/atomize/fetch-notes.ts`,
`src/cron/bluesky-mentions-ledger.ts`, `src/providers/polish/claude-cli.ts`, and
`docs/outreach-engine-plan.md` / `docs/setup-notes-daily-launchd.md`, plus a read-only live
feasibility check on 2026-08-08. No repository code was written and no reply text or identity was
logged. The data contract this plan writes into is
`docs/venture-schema-contract.md` §5.4a and §5.4b; where the two disagree, the schema contract wins.*
