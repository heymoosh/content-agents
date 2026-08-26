# Verified facts vs. unknowns

Body-free only. Nothing below reproduces a creator's body, caption, transcript, or on-screen text.
Every number traces to a lane's `intake-report.json` or `ledger-bridge-report.json`.

## Verified facts

- **Counts.** 65 account rows, 499 evidence rows, and 12 baseline rows exist across the three
  lanes, split 31/354/12 (text-community), 14/70/0 (professional-publishing), and 20/75/0
  (visual-video). All three lanes' `intake-report.json` and `ledger-bridge-report.json` agree on
  these counts exactly (see `summary.json`).
- **Readiness.** All 576 rows across the three lanes (397 + 84 + 95) report `blocked`. Zero rows
  are `ready`, `reviewed`, or `unmapped` anywhere.
- **Proposals are proposals, not dispositions.** Each lane preserves the corrected candidate
  slate's own recommend/hold/research-further label as a `dispositionReason` string on the account
  row; the intake schema's actual `disposition` field is `"pending"` on all 65 accounts and all 499
  evidence rows. Totals: 30 recommend, 8 hold, 27 research-further.
- **Account-key provenance and disjointness.** Every account key is a lane-verified
  `platform|handle` join (text-community and visual-video document the exact match method in their
  decision packets; professional-publishing takes the key from the same corrected slate). The 65
  keys are unique strings; no key repeats across or within lanes.
- **Baseline provenance (text-community only).** The 12 baseline rows are matched one-to-one to 6
  named Reddit accounts by `platform|handle`; `metric`, `sampleSize`, and `window` are the source
  projection's real values, copied as-is. The other two lanes carry zero baseline rows because
  their corrected-slate accounts record `b: 0`; no baseline is invented for them.
- **Body-completeness split, where recorded.** Text-community: 172 evidence rows `bodyComplete:
  true`, 140 `false`, 42 `null` (all 42 Mastodon). Visual-video: Instagram 0/13 true (11 false, 2
  null), TikTok 37/38 true, YouTube 24/24 true. Professional-publishing's per-account
  body-completeness triplets are copied verbatim from the corrected slate and cross-checked
  id-for-id against the source projection.
- **No exclude disposition exists in any lane.** Every proposal is recommend, hold, or
  research-further; none of the 65 accounts is marked for exclusion.
- **Side effects.** All three `ledger-bridge-report.json` files report `bodyIncluded: false` and
  `sideEffects: "none"`. No ledger writer ran; no canonical file changed.

## Unknowns / gaps that remain unreviewed

### Identity

- All 65 accounts: `stableAccountId` is `null`/`unconfirmed`. No lane assigns one.
- 11 accounts (all 10 Reddit community accounts plus Hacker News, text-community lane) have no
  single account-level `creator`, because their local records name many distinct posters; `creator`
  is left `null` rather than picking one poster to represent the account.

### Topic, focus, niche

- Topics, focus, and niche label are `null` for every one of the 65 accounts in every lane; none
  has been reviewed.
- The 3 Threads accounts (professional-publishing) additionally carry `topics: "unknown"`,
  `focus: "unknown"`, `format: "unknown"` at the account level, an explicit boundary preserved from
  an earlier correction after direct profile access was blocked during research.

### Pool

- No account in any lane is assigned to a research pool. `researchPoolMembership` is `null` on
  every account row and `pool` is `null` on every evidence row, in all three lanes.
- Each lane carries its own open niche/broad/format pool questions, unresolved (see
  `decision-sheet.md`).

### Audience

- `audienceSnapshot` and `audienceSizeSnapshot` are `null` for every account and every evidence row
  in all three lanes. No follower count, subscriber count, or audience-size figure is asserted
  anywhere in this package.

### Scope (popularity / sample / baseline)

- `popularityScope`, `sampleScope`, and `baselineScope` are `null` across all 65 accounts and all
  499 evidence rows. No absolute reach or engagement figure is comparable across accounts or
  platforms without a stated denominator, and none is stated here.
- `baselineSource` is `null` at the account level for 11 of the 31 text-community accounts: 5
  because the projection never recorded a value, 6 because the underlying evidence rows are a
  genuine mix of `null` and a real value that would misstate the account if collapsed to one claim.

### Provenance

- Text-community: 5 of 354 evidence rows carry a real `provenance` note (all `x|nathanbarry`); the
  remaining 349 have none.
- Visual-video: `provenance` is `null` on all 75 evidence rows.
- Professional-publishing: broad-research profile access returned partial evidence (creator
  identity, stated topics/focus, sometimes a lower-bound audience figure) for 11 of 14 accounts, but
  none of that evidence has moved any reviewed-schema field off `unknown`, because disposition is
  still `pending`. The 3 Threads accounts' profile access was blocked outright.
- All 31 text-community accounts and all 14 professional-publishing accounts have exactly one
  public-profile lookup on record, and every one of those lookups is `accessStatus: "blocked"`
  (text-community: DNS-blocked; professional-publishing: Threads specifically blocked, LinkedIn/
  Substack/Substack Notes partial-but-unreviewed). Visual-video's 20 public-profile checks all
  returned `access_status: "limited"` (login walls, robots-policy denials, rate limits, or empty
  channel shells).

### Completeness

- Cross-reference blockers: every text-community evidence row (354) carries "account reference is
  unmapped or ambiguous" because `accountId` is `null` throughout that lane's source projection.
  Visual-video's 75 evidence rows resolve this cross-reference (each carries its own real
  `sourceId`/`postId`) but remain blocked on the same identity/pool/format/audience fields as every
  other lane, plus "account metadata is not ready" since the parent account is itself pending.
- Caption, transcript, and on-screen-text completeness is not collected for any of the 75
  visual-video evidence rows; `format`/`medium` are left `null` there by design, since the source
  projection's own `format` field is a paraphrased structural note, not a category.

### Baseline

- All 12 text-community baseline rows withhold `numerator`, `denominator`, and
  `settledSampleDate` (`unavailableReason` set): the hand-collected pass recorded only a median.
  `id` and `source` are `null` on all 12; the source projection never assigned either field.
- 345 of the wider 371-account catalog (cited in `charter.md`, outside this package's 65-account
  scope) still need valid baseline measurement; that is repository-level context, not a claim about
  these 65 accounts specifically.

None of the gaps above is resolved by this consolidated package. They carry forward exactly as
each lane's own decision packet states them, pending Muxin's answers in `decision-sheet.md` or a
later exclusive steward's resolution from canonical local data.
