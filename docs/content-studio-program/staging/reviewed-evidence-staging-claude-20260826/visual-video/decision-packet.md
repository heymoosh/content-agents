# Reviewed evidence staging — visual/video (Claude builder) — decision packet

Observed: 2026-08-25. Lease: `pattern-stage-evidence-visual-video-claude`. Builder family: Claude.
Auditor family: Codex (cross-family, per protocol.md family rotation).

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
4. Built 75 `reviewed_source_evidence_intake_row` inputs, one per unit of each account's reviewed
   `records` count, each carrying a self-assigned, obviously-synthetic staging identifier
   (`local-corpus-staging:<accountKey>:record-<n>-of-<records>` — not a platform post ID; no
   `sourceId`/`postId` is claimed because none was collected), the account's profile URL as
   `evidenceLinks` (explicitly caveated as account-level, not a post permalink), and a
   `bodyComplete` value distributed to match the account's reviewed Body C/I/U split from the
   corrected slate (e.g. `instagram|adriennemareebrown`'s `body:[0,2,2]` yields 0 complete, 2
   incomplete, 2 unknown rows). `pool`, `metricSnapshot`, `audienceSizeSnapshot`, `medium`,
   `format`, `sourceId`, `postId`, `lineage`, `reviewStatus`, and `observedAt` are all `null` — no
   per-record metric, format, or content fact was collected. `accountId` is set to the account's
   `currentAccountKey` so the intake's cross-reference check can locate the parent account row.
5. Ran `src/patterns/reviewed-evidence-intake-cli.ts` on `intake-input.json` to produce
   `intake-report.json`, then ran `src/patterns/reviewed-evidence-ledger-bridge-cli.ts` on
   `intake-report.json` to produce `ledger-bridge-report.json`. Both CLIs accepted the input with
   no side effects and no rejected/forbidden keys.

## Results

- `intake-report.json`: `readiness.status = "blocked"`; 20/20 account rows blocked, 75/75 evidence
  rows blocked, 0/0 baseline rows (empty set, itself reported `ready`/vacuous); every row's
  `bodyIncluded` is `false`; `sideEffects: "none"`.
- Every account row is blocked on (at minimum) `stableAccountId`, `topics`, `focus`, `nicheLabel`,
  `researchPoolMembership`, `popularityScope`, `sampleScope`, `baselineScope`, `baselineSource`,
  `medium`, `format`, `audienceSnapshot`, `reviewer`, `reviewedAt`, `reviewStatus` — i.e. every
  identity/pool/format/audience fact this packet deliberately left unreviewed.
- Every evidence row is blocked on (at minimum) `sourceIdOrPostId`, `pool`, `audienceSizeSnapshot`,
  `metricSnapshot`, `popularityScope`, `sampleScope`, `baselineScope`, `baselineSource`,
  `reviewStatus`, `lineage`, `observedAt`, plus `bodyComplete` for the incomplete/unknown-body
  records and `account reference is unmapped or ambiguous`-style cross-reference gaps.
- `ledger-bridge-report.json`: `counts = {accounts: 20, sources: 75, baselines: 0, total: 95}`; 95
  blocker entries (one per row, since none is ready); `bodyIncluded: false`, `sideEffects: "none"`.

## Gaps kept explicit (not resolved by this package)

- **Body/media completeness.** Instagram: 0 of 13 records body-complete (11 incomplete, 2 unknown
  across the 4 accounts: `[0,2,2]+[0,1,0]+[0,5,0]+[0,3,0]`). TikTok: 37 of 38
  complete, 1 incomplete (`tiktok|underthedesknews`). YouTube: 24 of 24 complete at the
  body-field level, but 0 of these YouTube accounts has any admitted comparator analysis with a
  measured value (`R` column is 0 or a single uncompared admission for every YouTube row except
  `aliabdaal` and `melrobbins`), so completeness of the *body* field says nothing about caption,
  transcript, or on-screen-text availability, which this packet does not check or claim.
- **Caption / transcript / on-screen-text.** Not collected for any of the 75 rows. No row's
  `format` or `medium` is populated, so no format-specific completeness claim (e.g. "short-video
  transcripts exist") is made.
- **Provenance.** Every row's `provenance` is `"local"` only — the same Meta "L" designation the
  corrected slate already carries; reviewed-metadata and comparison-universe remain gaps (Meta
  "U/G") and are represented as `null`/missing fields and blockers, not filled in.
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

- `npm run check` — passed (`tsc --noEmit`, no diagnostics).
- `git diff --check` — passed (no whitespace errors).
- `npx tsx src/patterns/reviewed-evidence-intake-cli.ts --file intake-input.json --format json` —
  exit 0, wrote `intake-report.json` (20 accounts / 75 evidence / 0 baselines, all blocked).
- `npx tsx src/patterns/reviewed-evidence-ledger-bridge-cli.ts --file intake-report.json --format
  json` — exit 0, wrote `ledger-bridge-report.json` (counts 20/75/0/95, 95 blocker entries, no
  forbidden/body/model/ranking/winner key rejected because none was ever supplied).

## Files in this package

- `intake-input.json` — the 20 account rows + 75 source-evidence rows + empty baseline array fed
  to the intake CLI.
- `intake-report.json` — exact, unmodified stdout of the intake CLI.
- `ledger-bridge-report.json` — exact, unmodified stdout of the ledger-bridge CLI run against
  `intake-report.json`.
- `decision-packet.md` — this file.
