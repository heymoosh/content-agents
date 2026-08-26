# Reviewed-evidence staging decision packet — text/community (Claude builder, replacement lease)

Observed: 2026-08-26
Status: isolated review staging only. No row in this package is reviewed, canonical, a pool
winner, or a "best" claim. `intake-input.json` runs through the existing, unmodified
`reviewed-evidence-intake` and `reviewed-evidence-ledger-bridge` contracts; both CLIs report every
row `pending`/`blocked` and the intake readiness status is `blocked` (0 rows `ready`, 0
`unmapped`). No canonical `data/patterns/**` file was read or written, and no ledger writer
executed.

This package **replaces** the first draft of this lease (same directory, same filenames). The
first draft built per-account placeholder evidence rows from the corrected slate's aggregate
counts. This draft was rebuilt from the coordinator's body-free operator projection
(`content-agents-body-free-projections-20260826/source-evidence.json` and `baselines.json`)
instead: every evidence and baseline row below carries the actual stable id, url, provenance, and
`bodyComplete` value that projection assigned to that specific record — nothing here is a
positional placeholder distributed across an aggregate count.

**Correction pass (2026-08-26, same replacement lease):** a Codex audit of the first commit of
this package found four defects, all corrected in `intake-input.json` and/or this document without
touching `src/patterns/**`:

1. Six account rows (`reddit|r/adhd`, `reddit|r/civictech`, `reddit|r/claudeai`,
   `reddit|r/lifeprotips`, `reddit|r/sideproject`, `x|dickiebush`) had a non-null account-level
   `baselineSource` even though that account's own evidence rows carry a mix of `null` and a real
   value. Collapsing a mixed per-record value into a single account claim is exactly the thing this
   package says it does not do elsewhere (see the 5-account mixed case below) — these six were
   missed in the first pass. All six now carry `baselineSource: null` at the account level, with a
   caveat pointing back to the per-record values.
2. All 12 baseline rows carried an `id` (`baseline:<accountKey>:<n>`) and a `source`
   (`reddit-hand-collected-notes-<date>`) that do not exist anywhere in `baselines.json` — that file
   has no `id` or `source` field on any row, only `platform`, `handle`, `metric`, `window`,
   `sampleSize`, `method`, and `collected_at`. Both were invented rather than read from the
   projection. The intake contract's `normalizedBaseline()` reads `id`/`source` through `text()`,
   which accepts `null` without failing (`src/patterns/reviewed-evidence-intake.ts`'s `text()` and
   `normalizedBaseline()`), so a non-null value is not contractually required. Both fields are now
   `null` on all 12 rows, with a caveat noting the projection carries neither field.
3. This document's "182 of 354 evidence rows carry `bodyComplete: null`" claim (both instances,
   below) was wrong. 182 is the intake CLI's `bodyComplete` **blocker** count — every row where
   `bodyComplete !== true` (140 rows with an explicit `false` plus 42 rows with `null`) — not a null
   count. The projection's actual `bodyComplete` distribution across the 354 rows is 172 `true`, 140
   `false`, 42 `null`; both mentions below are corrected to state that split.
4. Every one of the 397 `intake-input.json` rows (31 accounts, 354 evidence, 12 baselines) now
   carries an explicit `"bodyIncluded": false` field. The intake contract accepts this without error
   — `bodyIncluded` is not in `reviewed-evidence-intake.ts`'s `UNSUPPORTED_KEYS` rejection list — but
   it is a **contract limitation, not a code change**, that the field has no functional effect on
   the report: none of `normalizedAccount()`, `normalizedEvidence()`, or `normalizedBaseline()`
   reads a `bodyIncluded` key from the input row, and `accountOutput()`/`evidenceOutput()`/
   `baselineOutput()` each unconditionally hardcode `bodyIncluded: false` on the output row
   regardless of what the input contained. Adding the field to the input rows is honest (it matches
   what the report will say) but inert; only a code change to those three normalizer functions would
   let an input-side `bodyIncluded` value actually reach the report, and this correction pass makes
   no such change.

`intake-report.json` and `ledger-bridge-report.json` were regenerated from the corrected
`intake-input.json` via the exact commands in "Reconciliation against the report outputs" below;
every reconciled total in this document (31 accounts / 354 evidence / 12 baselines / 397 total, 14
recommend / 6 hold / 11 research_further) is unchanged by this correction pass — only the six
accounts' `baselineSource`, the twelve baselines' `id`/`source`, this document's `bodyComplete`
prose, and the 397 rows' `bodyIncluded` field changed.

## What this package covers

Exactly the text/community slice of the corrected 65-account slate
(`docs/content-studio-program/staging/corrected-candidate-account-slate-20260825/`): Bluesky,
Dev.to, Hacker News, Mastodon, Reddit, and X.

| Reconciled quantity | Required | This package |
| --- | ---: | ---: |
| Accounts | 31 | 31 |
| Local source records (evidence rows) | 354 | 354 |
| Baseline rows | 12 | 12 |
| `recommend` dispositions (corrected slate) | 14 | 14 |
| `hold` dispositions (corrected slate) | 6 | 6 |
| `research_further` dispositions (corrected slate) | 11 | 11 |

Per-platform account/record split: Bluesky 4 accounts / 22 records, Dev.to 1 / 4, Hacker News 1 /
9, Mastodon 9 / 54, Reddit 10 / 232, X 6 / 33. Total 31 accounts / 354 records — every number
verified programmatically against the corrected slate's own per-account `records` field before any
row was written (see "How the 354 rows were selected" below).

## How the 354 rows were selected

`source-evidence.json` carries 499 body-free evidence rows across all 65 corrected-slate accounts
and 13 platforms, with `accountId: null` on every single row (the projection never assigned a
stable account id to any record, on any platform, in this pass). There is therefore no literal
`accountId` value to select on. Selection instead used the only two fields the projection does
populate on every row — `platform` and `handle` — normalized to `platform|handle` (handle
lower-cased, leading `@` stripped) and compared against the corrected slate's own
`account_key` for the 31 text/community accounts. That match is exact and lossless:

- All 31 corrected-slate text/community account keys have at least one matching
  `platform|handle` group in the projection, with no leftover/unmatched handles.
- Every one of those 31 groups' row count equals the corrected slate's own `records` field for
  that account, with no rounding or estimation.
- The sum is exactly 354, and the platform split (above) matches the corrected slate's own
  per-account rollup.

This is the closest available reading of "select by actual accountId/platform": platform is a
literal field match; handle stands in for the (universally null) accountId as the record-to-account
join key, and every row placed under an account is a row the projection itself already tagged with
that account's platform and handle — never a row picked by position or by aggregate count.

## How each field was populated (provenance)

Every evidence and baseline row below carries fields copied as-is from the projection, never
computed, stratified, or distributed:

- **`id`**: the projection's own `id` field where present (147 of 354 rows). Where the projection
  left `id` null (207 Reddit rows — a source-listing pass that filled `sourceId`/`postId` but not
  `id`), this package uses that row's own `sourceId` as the identifier instead, and says so in that
  row's `caveats`. This is still the record's actual stable id from the pipeline, just read from a
  different field on that particular row — never a generated or synthesized value. All 354
  resulting ids are unique (verified before writing the file).
- **`sourceId` / `postId`**: the projection's own values, verbatim, on every row.
- **`evidenceLinks`**: the projection's own `url` field, verbatim, wrapped in a one-element array
  (`evidenceRefs` mirrors it via the intake contract's own alias resolution — see
  `reviewed-evidence-intake.ts`'s `present()` key-alias list). No row invents or omits this; every
  one of the 354 rows has a real `url` in the projection.
- **`bodyComplete`**: the projection's own literal value (`true`, `false`, or `null`) on every row,
  unchanged. The split across the 354 rows is 172 `true`, 140 `false`, 42 `null`. The 42 `null`
  rows are all Mastodon; the 140 `false` rows span every platform (106 Reddit, 15 X, 8 Mastodon, 6
  Bluesky, 5 Hacker News). `null` is preserved, not defaulted to `"unknown"` or to a guessed
  boolean, and is never conflated with `false`. (The intake CLI's own `bodyComplete` readiness
  blocker fires on both `false` and `null` alike — 182 rows total — which is a *blocker count*, not
  a null count; see "Reconciliation against the report outputs" below.)
- **`provenance`**: the projection's own `provenance` field where present (5 of 354 rows, all on
  `x|nathanbarry` — collection-methodology notes about the tweet syndication endpoint and sampling
  bias, not creator body text). Null everywhere else, because the projection itself left it null
  everywhere else.
- **`format`**: the projection's own `format` field where present (147 of 354 rows) — short,
  body-free structural notes (character counts, line/paragraph structure, presence of links or
  emoji), never the post's actual wording. Null where the projection left it null.
- **`observedAt` / `collectedAt` / `baselineSource`**: the projection's own values, verbatim.
- **Fields the projection never populated on any text/community row** — `accountId`, `medium`,
  `pool`, `membershipReason`, `audienceSizeSnapshot`, `metricSnapshot`, `comparisonClaimed`,
  `popularityScope`, `sampleScope`, `baselineScope`, `caveats` (beyond this package's own honest
  provenance notes), `reviewStatus`, `status`, `lineage` (beyond the `belongs_to_account` link this
  package adds) — are left `null` here. They are unavailable in the projection, not unreviewed
  guesses.

Account rows (31) are built the same way, from the projection's own evidence rows grouped by
account, plus the two other named body-free repository documents:

- `currentAccountKey`/`platform`: the corrected slate's own `account_key`/`platform`.
- `handle`: the projection's own `handle` field (identical across every evidence row in the
  group, verified before writing).
- `creator`: the projection's own `creator` field, but only where every evidence row in the group
  shares exactly one creator value (true for the single-author feeds: Bluesky, Dev.to, Mastodon, X).
  11 accounts are aggregator/community accounts where the group's rows carry many distinct poster
  names (all 10 Reddit accounts plus Hacker News) — for those, `creator` is left `null` rather than
  picking one poster to stand in for the account, and a `caveats` entry states exactly why.
- `baselineSource`: the projection's own value, but only where every row in the group agrees. Two
  distinct null cases exist and this document now distinguishes them (corrected 2026-08-26 — the
  first draft mislabeled both as "mixed"):
  - 5 accounts (`reddit|r/entrepreneur`, `reddit|r/localllama`, `reddit|r/microsaas`,
    `reddit|r/youshouldknow`, `x|sahilbloom`) are uniformly `null` — every evidence row in the group
    carries `baselineSource: null`, so there is no real value to preserve. The account-level field
    is `null` because the projection never recorded one for this account, not because of a mix.
  - 6 accounts (`reddit|r/adhd`, `reddit|r/civictech`, `reddit|r/claudeai`, `reddit|r/lifeprotips`,
    `reddit|r/sideproject`, `x|dickiebush`) genuinely are mixed — some rows carry `null`, others
    carry a real value (`notes-true-median` for the five Reddit accounts, `timeline-window` for
    `x|dickiebush`). The account-level field is `null` for these too, but for the opposite reason:
    collapsing the mix into either value would misstate the group. A `caveats` entry on each of
    these six says the value is mixed, pointing back to the per-record values.
- `evidenceLinks`: the one blocked public-profile lookup URL per account, from
  `broad-pattern-research-20260825/text-community/source-manifest.json`'s `sources` array — real,
  present for all 31 accounts, and explicitly `accessStatus: "blocked"` per that document. Carried
  as account-level evidence only, exactly as the corrected slate's own account/record split
  intends.
- `stableAccountId`/topics/focus/nicheLabel/researchPoolMembership/popularityScope/sampleScope/
  baselineScope/medium/format/audienceSnapshot/reviewer/reviewedAt: `null` — none of this has been
  reviewed or established anywhere in the named documents.
- `disposition`: `"pending"` (the intake contract's own workflow state, never `"reviewed"`).
  `dispositionReason` carries the corrected slate's `recommend`/`hold`/`research_further` label
  verbatim, so it survives into the report without being converted into a reviewed status.
- `caveats`: the account's corrected-slate aggregate counts (records, w, r, b, body
  complete/incomplete/unknown, engagement_records, repeat, meta) in prose, plus the notes above.

Baseline rows (12) are the projection's own `baselines.json` rows, one per row, matched to their
Reddit account by `platform|handle` the same way evidence rows were: `metric`, `sampleSize`,
`window.start`/`window.end` are the projection's real values; `method` (a hand-collection
methodology note, not creator body text) is preserved verbatim in `caveats`. `id` and `source` are
both `null` on all 12 rows (corrected 2026-08-26) — `baselines.json` has no `id` or `source` field
on any row, so neither is invented; a caveats entry on each row says so explicitly.
`numerator`/`denominator`/`settledSampleDate` are `null` with an explicit `unavailableReason` —
the hand-collected pass recorded only a median (and, on 6 of the 12 rows, an upvote-only `terms`
tag), never individual scores or a numerator/denominator pair, so there is nothing to preserve
there. This is the same "12 rows tied to the 6 named Reddit accounts, values withheld, not
invented" shape as the corrected slate calls for — now built from the projection's actual 12 rows
instead of asserting the count from the slate's own text.

### The W (source-listing winner) count is prose-only, by design

The corrected slate records 207 source-listing rows across Reddit accounts in this slice (visible
in the projection as rows whose own `id` field is null but `sourceId`/`postId` are populated — see
"How the 354 rows were selected"). The intake contract's `rejectUnsupported` guard hard-fails on
any `winner`/`winners`/`rank`/`score`/`listing` -shaped key anywhere in the input, so this package
never puts a `sourceRole`, `rank`, `listing`, or `window`(per-record ranking window) key into
`intake-input.json` at all — only the recognized schema fields above. Where a row's corrected-slate
`w` count is nonzero, that count is reconciled in the owning account's `caveats` text only, exactly
as the task packet requires: "Never turn a source-listing winner flag into an account winner."

## Reconciliation against the report outputs

`intake-report.json` (exact `patterns:reviewed-evidence-intake` CLI output over
`intake-input.json`, run via `npm run patterns:reviewed-evidence-intake -- --file intake-input.json
--format json`):

- `summary.accounts`: 31 total, 0 ready, 31 blocked, 0 unmapped.
- `summary.evidence`: 354 total, 0 ready, 354 blocked, 0 unmapped.
- `summary.baselines`: 12 total, 0 ready, 12 blocked, 0 unmapped.
- `summary.total` / `readiness`: 397 total, 0 ready, 397 blocked, 0 unmapped — overall status
  `"blocked"`. No row anywhere in this package is `"reviewed"` or `"ready"`.

`ledger-bridge-report.json` (exact `patterns:reviewed-evidence-ledger-bridge` CLI output over
`intake-report.json`, run via `npm run patterns:reviewed-evidence-ledger-bridge -- --file
intake-report.json --format json`): `counts` = 31 accounts / 354 sources / 12 baselines / 397
total, `bodyIncluded: false`, `sideEffects: "none"`. This is a body-free operator projection only;
no ledger writer ran and no canonical file changed.

## Provenance and baseline gaps

- All 31 accounts: `stableAccountId` unresolved (`stableAccountIdStatus: "unconfirmed"`) — the
  projection never assigns one. `reviewer`/`reviewedAt` empty, topics/focus/nicheLabel/medium/
  format/scopes all null. Every account needs Muxin's identity confirmation and metadata review
  before any of these can move to `"reviewed"`.
- All 354 evidence rows: `accountId` null (universal in the projection), so every row also carries
  the cross-reference blocker `"account reference is unmapped or ambiguous"` from the intake CLI
  itself — that is the CLI's own honest read of the same gap, not something this package asserts
  separately.
- Of 354 evidence rows: 172 carry `bodyComplete: true`, 140 carry `bodyComplete: false`, and 42
  carry `bodyComplete: null` (all 42 are Mastodon rows the collector could not confirm complete).
  182 rows (the 140 `false` plus the 42 `null`) fail the intake CLI's `bodyComplete` readiness
  blocker, since that blocker requires a literal `true` — that 182 is a blocker count, not a count
  of `null` rows.
- 5 of 354 evidence rows carry a real `provenance` note (all `x|nathanbarry`); the remaining 349
  have none, because the projection itself never recorded one for them.
- Public-profile provenance: every one of the 31 accounts has exactly one broad-pattern-research
  profile-URL lookup on record, and every one of those lookups is `accessStatus: "blocked"` (DNS
  blocked in that collection environment; no page body retained).
- All 12 baseline rows: `numerator`/`denominator`/`settledSampleDate` withheld
  (`unavailableReason` set) — the hand-collected pass never recorded individual scores. `id` and
  `source` are also `null` on all 12 — the projection never assigned either.
- 6 accounts' `baselineSource` is `null` because the underlying evidence rows are a genuine mix of
  `null` and a real value (see "How each field was populated" above); collapsing that mix into a
  single claim would misstate the account.

## Pool-choice questions for Muxin

None of the 31 accounts is assigned to a research pool (`researchPoolMembership` is null on every
account row and `pool` is null on every evidence row) — deliberate, since pool assignment is a
pending decision, not a staging fact. The corrected slate's own "Pool proposals" section is
provisional for this exact slice:

1. **Niche pool** — proposed coverage labels touching this slice: ADHD/neurodiversity
   (`bluesky|adriennemareebrown.bsky.social`, `reddit|r/adhd`), civic-democracy/civic-tech (several
   Mastodon accounts, `reddit|r/civictech`), AI-building (`hackernews|hackernews`,
   `reddit|r/claudeai`, `reddit|r/localllama`), product-thinking (`reddit|r/productmanagement`),
   solopreneur/building-solopreneur (`reddit|r/sideproject`, `reddit|r/microsaas`, several X
   accounts), general-viral (`reddit|r/lifeprotips`, `reddit|r/youshouldknow`). Does Muxin want
   this slice split into those niche pools now, or held until the full 65-account niche pool is
   decided together?
2. **Broad-platform pool** — the corrected slate proposes treating Reddit communities as
   *community* evidence, not creator-account evidence, and never pooling metrics across platforms.
   This package's own data backs that split: 11 of 31 accounts (all 10 Reddit accounts plus Hacker
   News) have no single account-level `creator`, because their local records name many distinct
   posters — structurally different from the other 20 single-author accounts. Does that
   community/creator split apply as-is to this slice?
3. **Format pool** — per-record `format` notes exist for 147 of 354 records (structural
   descriptions only), but no account-level format rollup is populated. Should format review use
   those 147 real per-record notes now, or wait for full per-record corpus access for the other
   207?

## Exact decisions Muxin must make before any row here can move past `pending`

1. Approve, narrow, or hold each of the 31 accounts' `recommend`/`hold`/`research_further`
   disposition as a **basis for continuing to the next reviewed-metadata step** — this package does
   not ask her to re-litigate the corrected slate's dispositions, only to confirm this slice may
   proceed on them.
2. Assign or confirm a `stableAccountId` for each of the 31 accounts (all currently `unconfirmed`).
3. Decide the three pool-choice questions above (niche split now vs. later; Reddit
   community-vs-creator treatment; format-review timing given the 147/207 split).
4. Decide whether the 354 evidence rows' `accountId` gap and the 12 baseline rows' withheld
   numerator/denominator should be resolved from `data/patterns/*.jsonl` in a future, narrower
   lease — this package could not resolve it because that raw/private data directory was out of
   scope for this lease and this worktree.

No canonical `data/patterns/**` write, ranking, generation, or publishing follows from this
package. Every row stays `pending` or `blocked` until Muxin answers the above.
