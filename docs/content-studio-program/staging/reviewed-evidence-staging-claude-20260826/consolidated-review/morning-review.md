# Consolidated evidence review, morning read

Observed 2026-08-26. This page reconciles the three text/community, professional/publishing, and
visual/video staging lanes into one status table. It does not reclassify, rank, or advance any row.
Every row in all three lanes stays `pending` or `blocked`.

## Lane packets

- Text/community: [decision-packet.md](../text-community/decision-packet.md),
  [intake-report.json](../text-community/intake-report.json),
  [ledger-bridge-report.json](../text-community/ledger-bridge-report.json)
- Professional/publishing: [decision-packet.md](../professional-publishing/decision-packet.md),
  [intake-report.json](../professional-publishing/intake-report.json),
  [ledger-bridge-report.json](../professional-publishing/ledger-bridge-report.json)
- Visual/video: [decision-packet.md](../visual-video/decision-packet.md),
  [intake-report.json](../visual-video/intake-report.json),
  [ledger-bridge-report.json](../visual-video/ledger-bridge-report.json)

Full detail in [summary.json](summary.json). Reconciliation is verified by [verify.mjs](verify.mjs).

## Status table

| Lane | Platforms | Accounts | Evidence rows | Baselines | Recommend | Hold | Research further | Ready rows |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Text/community | Bluesky, Dev.to, Hacker News, Mastodon, Reddit, X | 31 | 354 | 12 | 14 | 6 | 11 | 0 |
| Professional/publishing | LinkedIn, Substack, Substack Notes, Threads | 14 | 70 | 0 | 11 | 0 | 3 | 0 |
| Visual/video | Instagram, TikTok, YouTube | 20 | 75 | 0 | 5 | 2 | 13 | 0 |
| **Total** | 13 platforms | **65** | **499** | **12** | **30** | **8** | **27** | **0** |

All three lanes report intake readiness `status: "blocked"`. Zero rows anywhere are `ready`,
`reviewed`, or `unmapped`. The 65 account keys are disjoint across lanes (verified in
`summary.json`'s reconciliation block and by `verify.mjs`); no key repeats.

## What this review does and does not authorize

**Does:**

- Reconciles the three lanes' own already-published counts, account keys, and proposed
  recommend/hold/research-further dispositions into one place, for one morning read.
- Carries forward each lane's open pool and metadata questions unanswered, so Muxin can decide or
  defer them here instead of re-reading three packets.
- Gives Muxin a single approve/narrow/hold surface per lane plus the open questions, in
  [decision-sheet.md](decision-sheet.md).

**Does not:**

- Does not reclassify, rank, score, or advance any account or evidence row. Every row stays
  `pending` or `blocked` exactly as its lane's `intake-report.json` reports it.
- Does not select a canonical, best, viral, or winning account or source.
- Does not write, propose, or imply a `data/patterns/**` canonical record. No canonical write
  follows from this package.
- Does not authorize content generation, publishing, or any pool/format/niche assignment.
- Does not assign a `stableAccountId`, resolve a baseline numerator/denominator gap, or resolve
  any identity/topic/audience unknown named in the three lane packets. Those stay open until
  Muxin answers [decision-sheet.md](decision-sheet.md) or a later exclusive steward resolves them
  from canonical local data.

See [verified-facts-vs-unknowns.md](verified-facts-vs-unknowns.md) for the body-free facts this
package can state directly against the gaps that remain unreviewed, and
[decision-sheet.md](decision-sheet.md) for the exact decisions this review asks Muxin to make.
