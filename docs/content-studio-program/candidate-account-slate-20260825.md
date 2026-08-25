# Candidate account slate — 2026-08-25

## Decision requested

Approve this cohort for **review staging** only, request a narrower cohort, or hold it. Approval
does not select accounts as canonical patterns, declare any account "best," or write
`data/patterns/**`.

## Snapshot

- Source command: `node --import tsx src/patterns/review-status.ts --format json`
- Source commit: `7b1256ea8d6787cea9105d2e4b2b60ea5ff1b3c7`
- Scope: 371 catalog account keys and 499 existing evidence records.
- Current review state: 0 reviewed; all 371 unmapped; no comparison-ready accounts; no review
  input supplied.
- Candidate rule: include each account key with `evidenceCount > 0`.
- Candidate count: 65 account keys; 499 records across the wider catalog.
- Candidate-key SHA-256 (sorted keys, newline terminated):
  `1dc0bdb96fd447365701e6bcf3cc251b8611a97f4ae701407fb0c4903641479f`
- Data safety: this projection is metadata-only and has no raw post bodies. No metadata has been
  inferred and no canonical data has been written.

## Cohort by platform

| Platform | Candidate accounts | Existing evidence records |
| --- | ---: | ---: |
| Bluesky | 4 | 22 |
| Dev.to | 1 | 4 |
| Hacker News | 1 | 9 |
| Instagram | 4 | 13 |
| LinkedIn | 4 | 21 |
| Mastodon | 9 | 54 |
| Reddit | 10 | 232 |
| Substack | 5 | 22 |
| Substack Notes | 2 | 12 |
| Threads | 3 | 15 |
| TikTok | 7 | 38 |
| X | 6 | 33 |
| YouTube | 9 | 24 |

Pinterest has no existing evidence records and therefore no candidate in this slate.

## Exact candidate account keys

| Account key | Evidence records |
| --- | ---: |
| bluesky|adriennemareebrown.bsky.social | 4 |
| bluesky|carnage4life.bsky.social | 6 |
| bluesky|danidonovan.com | 6 |
| bluesky|simonwillison.net | 6 |
| devto|sylwia-lask | 4 |
| hackernews|hackernews | 9 |
| instagram|adriennemareebrown | 4 |
| instagram|dralexgeorge | 1 |
| instagram|sharonsaysso | 5 |
| instagram|the.holistic.psychologist | 3 |
| linkedin|aagupta | 6 |
| linkedin|codiesanchez | 5 |
| linkedin|justinwelsh | 5 |
| linkedin|thedankoe | 5 |
| mastodon|bagder@mastodon.social | 6 |
| mastodon|baldur@toot.cafe | 6 |
| mastodon|dangillmor@mastodon.social | 6 |
| mastodon|dansup@mastodon.social | 6 |
| mastodon|gargron@mastodon.social | 6 |
| mastodon|heidilifeldman@mastodon.social | 6 |
| mastodon|mer__edith@mastodon.world | 6 |
| mastodon|mmasnick@mastodon.social | 6 |
| mastodon|molly0xfff@hachyderm.io | 6 |
| reddit|r/adhd | 25 |
| reddit|r/civictech | 25 |
| reddit|r/claudeai | 26 |
| reddit|r/entrepreneur | 25 |
| reddit|r/lifeprotips | 25 |
| reddit|r/localllama | 25 |
| reddit|r/microsaas | 25 |
| reddit|r/productmanagement | 4 |
| reddit|r/sideproject | 27 |
| reddit|r/youshouldknow | 25 |
| substack-notes|robertreich | 6 |
| substack-notes|tedgioia | 6 |
| substack|anandwrites | 4 |
| substack|davidpepper | 4 |
| substack|deepaiyer | 4 |
| substack|elenaverna | 6 |
| substack|heathercoxrichardson | 4 |
| threads|danidonovan | 5 |
| threads|rowancheung | 5 |
| threads|thedankoe | 5 |
| tiktok|adhd_love | 6 |
| tiktok|aliabdaal | 4 |
| tiktok|carlos_eduardo_espina | 4 |
| tiktok|realmattgray | 7 |
| tiktok|sabrina_ramonov | 8 |
| tiktok|theholisticpsychologist | 3 |
| tiktok|underthedesknews | 6 |
| x|akshat_world | 6 |
| x|arvidkahl | 5 |
| x|dickiebush | 9 |
| x|levelsio | 5 |
| x|nathanbarry | 5 |
| x|sahilbloom | 3 |
| youtube|aakashgupta | 2 |
| youtube|aliabdaal | 7 |
| youtube|benerez | 1 |
| youtube|dankoetalks | 1 |
| youtube|melrobbins | 8 |
| youtube|neelsikdar | 1 |
| youtube|productmanagementwithsachinsharma | 1 |
| youtube|theholisticpsychologist | 1 |
| youtube|underthedesknews | 2 |

## What resumes after approval

The coordinator will create the next bounded review-staging packet: explicit account metadata,
source links, provenance and pool dispositions only. It will not infer or write a canonical pattern
row without the separately leased, audited canonical-data task. All zero-evidence accounts stay
unmapped pending a later explicit review decision.
