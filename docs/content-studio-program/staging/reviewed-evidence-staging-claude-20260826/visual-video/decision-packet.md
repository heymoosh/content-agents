# Reviewed evidence staging — visual/video (Claude builder) — decision packet

Observed: 2026-08-25. Lease: `pattern-stage-evidence-visual-video-claude`. Builder family: Claude.
Auditor family: Codex (cross-family, per protocol.md family rotation).

## Correction (this commit)

The first version of this package (prior commit) built its 75 source-evidence rows by
distributing each account's reviewed Body C/I/U aggregate across a positional, self-numbered
placeholder id (`local-corpus-staging:<accountKey>:record-<n>-of-<records>`) with no real
per-record identity. Codex's audit correctly rejected this as synthesized evidence.

This commit replaces every one of those 75 placeholder rows with the 75 real, body-free
projected rows for these exact 20 accounts from
`/private/tmp/content-agents-body-free-projections-20260826/source-evidence.json` (a body-free
projection of the raw local corpus; its `format` field is a paraphrased structural description
and `provenance`/text fields never contain captions, transcripts, or article bodies). Each row
is selected by its own actual `platform` and `handle` fields, normalized (`handle` lower-cased
with a leading `@` stripped) into the same `platform|handle` account key already used by every
other document in this lease; the projection has no non-null `accountId` field of its own, so
this normalization is the only way to select "by actual accountId/platform." No row's
`bodyComplete`, `id`, `sourceId`, `postId`, `url`, `observedAt`, `collectedAt`, `baselineSource`,
or `provenance` value is invented, distributed, or aggregated — each is copied from that row's
own actual field, or left `null` if the projection itself has `null` there. Account-level rows
are unchanged except for the one caveat that used to claim per-record identifiers "were not
collected" — corrected to state that they now reconcile against the real projected rows.

Status: isolated, noncanonical review staging only. This package does not write
`data/patterns/**`, does not rank, does not select a canonical account or source record, and does
not generate, publish, or reproduce any creator body, caption, transcript, on-screen text, or
title. Every account and source row below is `pending`, `blocked`, or `unmapped`.

## Scope

- Exactly the 20 visual/video accounts (Instagram, TikTok, YouTube) named in
  `corrected-candidate-account-slate-20260825/decision-packet.{md,json}` and re-selected in
  `broad-pattern-research-20260825/visual-video/source-manifest.json`.
- Exactly 75 local source records, reconciled from the same account table's `records` column
  (Instagram 13 + TikTok 38 + YouTube 24 = 75).
- Zero baseline rows: every one of these 20 accounts carries `b:0` (no stored baseline) in the
  corrected slate, so `baselineSamples` is intentionally empty. No baseline is invented.
- Dispositions preserved exactly as proposed in the corrected slate: **5 recommend, 2 hold, 13
  research-further**, 0 exclude.

| Disposition | Accounts |
| --- | --- |
| recommend (5) | `tiktok\|adhd_love`, `tiktok\|carlos_eduardo_espina`, `tiktok\|sabrina_ramonov`, `tiktok\|underthedesknews`, `youtube\|aliabdaal` |
| hold (2) | `tiktok\|theholisticpsychologist`, `youtube\|melrobbins` |
| research_further (13) | `instagram\|adriennemareebrown`, `instagram\|dralexgeorge`, `instagram\|sharonsaysso`, `instagram\|the.holistic.psychologist`, `tiktok\|aliabdaal`, `tiktok\|realmattgray`, `youtube\|aakashgupta`, `youtube\|benerez`, `youtube\|dankoetalks`, `youtube\|neelsikdar`, `youtube\|productmanagementwithsachinsharma`, `youtube\|theholisticpsychologist`, `youtube\|underthedesknews` |

These labels are carried only inside each account row's `dispositionReason` text (a caveat/
provenance string, quoting the account's W/R/B/Body/repeat facts already published in the corrected
slate). The intake schema's own `disposition` enum (`pending` / `reviewed` / `blocked` /
`unmapped`) is set to `pending` for all 20 accounts and 75 source rows, per the outcome requirement
that every row stay pending, blocked, or unmapped until Muxin's consolidated review — this package
does not itself constitute that review.

## Method

1. Read the two task packets and, within this worktree, only the named body-free documents:
   `charter.md`, `protocol.md`, `corrected-candidate-account-slate-20260825/**`,
   `local-evidence-inventory-20260825/**`, `broad-pattern-research-20260825/visual-video/**`, and
   the six `src/patterns/*.ts` intake/bridge/ledger modules. `data/patterns/{corpus,analyses,
   baselines}.jsonl` were deliberately **not** read — those are raw/private corpus data, and the
   program's own safety wall (`charter.md` §"Keep raw pattern bodies local and out of coordinator
   context") plus this lease's explicit instruction is to build from the already-reviewed,
   body-free staging documents instead, not from raw pattern bodies.
2. Cross-checked that the 20-account visual/video seed list in
   `broad-pattern-research-20260825/visual-video/source-manifest.json` (`selection.seed_keys`,
   `platform_counts: {instagram:4, tiktok:7, youtube:9}`) matches the Instagram/TikTok/YouTube rows
   in the corrected candidate slate's account table, and that their `records` column sums to 75.
3. Built one `reviewed_account_intake_row` input per account carrying only: identity already
   public in the named documents (`currentAccountKey`, `platform`, `handle`), the account's public
   profile URL and broad-pattern-research `source_id` as `evidenceLinks`/`evidenceRefs`, explicit
   caveats (aggregate-count-only, public-route-limited, comparison-universe gap), and
   `dispositionReason` carrying the preserved recommend/hold/research_further label plus its W/R/B/
   Body/repeat facts. Every other field (`stableAccountId`, `topics`, `focus`, `nicheLabel`,
   `researchPoolMembership`, `popularityScope`, `sampleScope`, `baselineScope`, `baselineSource`,
   `medium`, `format`, `audienceSnapshot`, `reviewer`, `reviewedAt`) is `null` — not collected in
   this staging pass, per the "preserve null for not collected" rule. `disposition` is `pending`
   for all 20 rows.
4. Built 75 `reviewed_source_evidence_intake_row` inputs by filtering
   `/private/tmp/content-agents-body-free-projections-20260826/source-evidence.json` to
   `platform` in `{instagram, tiktok, youtube}` (exactly 75 rows) and mapping each row's own real
   `id`/`sourceId`/`postId`/`url`/`bodyComplete`/`baselineSource`/`provenance`/`observedAt`/
   `collectedAt`/`pool`/`reviewStatus`/`status`/`lineage`/`audienceSizeSnapshot`/`popularityScope`/
   `sampleScope`/`baselineScope` fields straight through (`null` stays `null`; nothing is
   inferred). `accountId` is the row's own `platform` + normalized `handle`
   (`@Handle`/`Handle` → lower-cased, `@` stripped), which lands on the same `platform|handle`
   key as the matching account row for every one of the 75 rows — verified programmatically, zero
   unmatched rows. `medium`, `format`, `metricSnapshot`, `comparisonClaimed`, and `evidenceRefs`
   are left `null`: the projection's `format` field is a paraphrased structural description, not
   a `medium`/`format` category, and mapping it in would itself be an inferred classification.
   `membershipReason` states the real platform+handle match rule, not a pool or performance claim.
5. Ran `src/patterns/reviewed-evidence-intake-cli.ts` on `intake-input.json` to produce
   `intake-report.json`, then ran `src/patterns/reviewed-evidence-ledger-bridge-cli.ts` on
   `intake-report.json` to produce `ledger-bridge-report.json`. Both CLIs accepted the input with
   no side effects and no rejected/forbidden keys.

## Results

- `intake-report.json`: `readiness = {status: "blocked", total: 95, ready: 0, blocked: 95,
  unmapped: 0, blockerCount: 1393}`; 20/20 account rows blocked (`blockerCount: 300`), 75/75
  evidence rows blocked (`blockerCount: 1093`), 0/0 baseline rows (empty set, vacuously
  non-blocking); every row's `bodyIncluded` is `false`; `sideEffects: "none"`.
- Every account row is blocked on (at minimum) `stableAccountId`, `topics`, `focus`, `nicheLabel`,
  `researchPoolMembership`, `popularityScope`, `sampleScope`, `baselineScope`, `baselineSource`,
  `medium`, `format`, `audienceSnapshot`, `reviewer`, `reviewedAt`, `reviewStatus` — i.e. every
  identity/pool/format/audience fact this packet deliberately left unreviewed.
- All 75 evidence rows now cross-reference their account row successfully (no "account reference
  is unmapped or ambiguous" and no "sourceIdOrPostId" blocker survives, because every row carries
  its own real `sourceId`/`postId`). Each evidence row is still blocked on (at minimum) `pool`,
  `medium`, `format`, `audienceSizeSnapshot`, `metricSnapshot`, `popularityScope`, `sampleScope`,
  `baselineScope`, `provenance`, `caveats`, `reviewStatus`, `status`, `lineage`, and `account
  metadata is not ready` (since the parent account is itself still pending); rows whose real
  `bodyComplete` is `false` or `null` additionally carry a `bodyComplete` blocker (14 of 75: the
  11 incomplete + 2 unknown real Instagram rows and 1 incomplete real TikTok row).
- `ledger-bridge-report.json`: `counts = {accounts: 20, sources: 75, baselines: 0, total: 95}`; 95
  blocker entries (one per row, since none is ready); `bodyIncluded: false`, `sideEffects: "none"`.

## Gaps kept explicit (not resolved by this package)

- **Body/media completeness.** These are now each row's real, projected `bodyComplete` value (not
  distributed from an aggregate). Instagram: 0 of 13 records `bodyComplete: true` (11 `false`, 2
  `null`). TikTok: 37 of 38 `true`, 1 `false` (in `tiktok|underthedesknews`). YouTube: 24 of 24
  `true`. These totals happen to match the corrected slate's aggregate Body C/I/U counts exactly,
  but that is now a verified fact about the real rows, not an assumption used to build them. 0 of
  the YouTube accounts has any admitted comparator analysis with a measured value (`R` is 0 or a
  single uncompared admission for every YouTube row except `aliabdaal` and `melrobbins`), so a
  `true` body-field value says nothing about caption, transcript, or on-screen-text availability,
  which this packet still does not check or claim.
- **Caption / transcript / on-screen-text.** Not collected for any of the 75 rows; `caveats`,
  `reviewStatus`, `status`, and `lineage` are `null` on every row. No row's `format` or `medium`
  is populated, so no format-specific completeness claim (e.g. "short-video transcripts exist")
  is made. The projection's own `format` field (a paraphrased structural description, e.g. post
  length and layout notes) was deliberately left out of this packet's `format`/`medium` fields —
  see "Correction" above.
- **Provenance.** Every one of these 75 rows' `provenance` field is `null` in the source
  projection, and stays `null` here — nothing is filled in. Reviewed-metadata and
  comparison-universe remain gaps and are represented as `null`/missing fields and blockers.
- **Public-research corroboration.** All 20 accounts' public profile checks in
  `broad-pattern-research-20260825/visual-video` returned `access_status: "limited"` (login walls,
  robots-policy denials, rate limits, or empty channel shells). No fresh public metric, caption, or
  identity fact was available to cross-check the local aggregate counts.
- **No exclude disposition.** Consistent with the corrected slate, no account here is marked for
  exclusion; `hold` and `research_further` are gaps in comparator evidence or body completeness,
  not performance judgments.

## Decision request

None. This package needs no immediate decision from Muxin — it is the next reviewed-staging step
authorized by the corrected candidate-account-slate gate. It stays available for her consolidated
review, alongside any equivalent text/community-family package, before any canonical
`data/patterns/**` write is proposed.

## Acceptance evidence

- `npm run patterns:reviewed-evidence-intake -- --file docs/content-studio-program/staging/reviewed-evidence-staging-claude-20260826/visual-video/intake-input.json --format json`
  — exit 0, wrote `intake-report.json` (20 accounts / 75 real evidence rows / 0 baselines, all
  blocked, `blockerCount: 1393`).
- `npm run patterns:reviewed-evidence-ledger-bridge -- --file docs/content-studio-program/staging/reviewed-evidence-staging-claude-20260826/visual-video/intake-report.json --format json`
  — exit 0, wrote `ledger-bridge-report.json` (counts 20/75/0/95, 95 blocker entries, no
  forbidden/body/model/ranking/winner key rejected because none was ever supplied).
- `npm run check` — passed (`tsc --noEmit`, no diagnostics).
- `git diff --check` — passed (no whitespace errors).

## Files in this package

- `intake-input.json` — the 20 account rows + 75 source-evidence rows + empty baseline array fed
  to the intake CLI.
- `intake-report.json` — exact, unmodified stdout of the intake CLI.
- `ledger-bridge-report.json` — exact, unmodified stdout of the ledger-bridge CLI run against
  `intake-report.json`.
- `decision-packet.md` — this file.
