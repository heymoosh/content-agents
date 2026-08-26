# Corrected candidate-account decision packet

Observed: 2026-08-25  
Status: isolated review staging only. This packet does not select canonical accounts, declare an account best, rank accounts, or write `data/patterns/**`.

## Decision request

Please choose one of the following for this seed cohort: approve the proposed dispositions for
review staging, narrow or expand a proposed pool, or hold the slate. The decision is only about
which account/platform metadata and local source identifiers may enter the next reviewed staging
step. It is not approval of canonical pattern rows or of any content-generation rule.

## Correction to the prior gate

The old all-hold premise treated 54 blocked public lookups as if they proved that local evidence
was absent. That inference was incorrect. The verified local inventory contains 499 metric-bearing
records across 65 evidence-bearing accounts on 13 represented platforms. It contains 132 admitted
analyses, 123 of them with a recorded relative comparator, 207 source-listing winner records, and
58 accounts with at least two engagement-bearing records. Public access failure is therefore a
gap in fresh metadata research, not evidence that these local records do not exist.

The local corpus is still a targeted seed sample, not a census or a ranked comparison universe.
It can support bounded, platform- or account-contextual review. It cannot establish “top creator,”
cross-platform superiority, or a universal viral threshold.

## Coverage and evidence meanings

| Platform | Accounts | Records | Winner records | Admitted analyses | Measured comparators | Body complete |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bluesky | 4 | 22 | 0 | 7 | 7 | 16 |
| Dev.to | 1 | 4 | 0 | 4 | 4 | 4 |
| Hacker News | 1 | 9 | 0 | 4 | 4 | 4 |
| Instagram | 4 | 13 | 0 | 0 | 0 | 0 |
| LinkedIn | 4 | 21 | 0 | 15 | 15 | 16 |
| Mastodon | 9 | 54 | 0 | 18 | 18 | 4 |
| Reddit | 10 | 232 | 207 | 18 | 18 | 126 |
| Substack | 5 | 22 | 0 | 15 | 15 | 20 |
| Substack Notes | 2 | 12 | 0 | 8 | 8 | 8 |
| Threads | 3 | 15 | 0 | 5 | 5 | 9 |
| TikTok | 7 | 38 | 0 | 24 | 21 | 37 |
| X | 6 | 33 | 0 | 9 | 6 | 18 |
| YouTube | 9 | 24 | 0 | 5 | 2 | 24 |
| **Represented total** | **65** | **499** | **207** | **132** | **123** | **286** |

Pinterest is a configured platform with no local corpus evidence. It is a named coverage gap, not
an all-hold conclusion about the 13 represented platforms.

The account table uses six independent dimensions:

1. **W** = source-listing winner records in the local corpus. This is listing provenance, not a
   claim of account or platform leadership.
2. **R** = admitted analyses / analyses with a recorded comparator. Comparator context is the
   local analysis context (for example, an account timeline window or a platform/community
   sample); no cross-platform multiple is calculated here.
3. **B** = stored baseline rows. These are explicit baseline artifacts, currently limited to six
   Reddit communities. A zero is a baseline gap, not a zero-performance result.
4. **Body** = complete / incomplete / unknown local body metadata. Incomplete or unknown body
   fields limit any later mechanism analysis; this packet does not reproduce or infer bodies,
   hooks, structures, or creator-specific mechanisms.
5. **Repeat** = locally represented records with engagement measurements: `2+`, `1`, or `0`.
   This is repeat engagement within the account sample, not a claim of stable performance.
6. **Meta** = `L/U/G` for local identity and source provenance present / reviewed metadata still
   unreviewed / comparison universe still a gap. Every row retains this distinction.

Disposition rule for this packet: `recommend` means suitable for the next metadata/source review
stage when it has at least two admitted comparator analyses, at least one body-complete record,
and at least two engagement-bearing records. `hold` means local evidence exists but body or
comparison limitations make that review conditional. `research_further` means the local sample
has fewer than two admitted analyses or lacks a repeat engagement sample. These are staging
dispositions, not canonical selections. No account is excluded on local evidence alone.

## Account-level dispositions

| Account key | Records | Disp. | W | R | B | Body C/I/U | Repeat | Meta |
| --- | ---: | --- | ---: | --- | ---: | --- | ---: | --- |
| `bluesky|adriennemareebrown.bsky.social` | 4 | recommend | 0 | 3/3 | 0 | 3/1/0 | 2+ | L/U/G |
| `bluesky|carnage4life.bsky.social` | 6 | research_further | 0 | 1/1 | 0 | 3/3/0 | 2+ | L/U/G |
| `bluesky|danidonovan.com` | 6 | recommend | 0 | 2/2 | 0 | 6/0/0 | 2+ | L/U/G |
| `bluesky|simonwillison.net` | 6 | research_further | 0 | 1/1 | 0 | 4/2/0 | 2+ | L/U/G |
| `devto|sylwia-lask` | 4 | recommend | 0 | 4/4 | 0 | 4/0/0 | 2+ | L/U/G |
| `hackernews|hackernews` | 9 | recommend | 0 | 9/9 | 0 | 4/5/0 | 2+ | L/U/G |
| `instagram|adriennemareebrown` | 4 | research_further | 0 | 0/0 | 0 | 0/2/2 | 2+ | L/U/G |
| `instagram|dralexgeorge` | 1 | research_further | 0 | 1/0 | 0 | 0/1/0 | 1 | L/U/G |
| `instagram|sharonsaysso` | 5 | research_further | 0 | 0/0 | 0 | 0/5/0 | 2+ | L/U/G |
| `instagram|the.holistic.psychologist` | 3 | research_further | 0 | 0/0 | 0 | 0/3/0 | 0 | L/U/G |
| `linkedin|aagupta` | 6 | recommend | 0 | 3/3 | 0 | 4/2/0 | 2+ | L/U/G |
| `linkedin|codiesanchez` | 5 | recommend | 0 | 5/5 | 0 | 4/1/0 | 2+ | L/U/G |
| `linkedin|justinwelsh` | 5 | recommend | 0 | 5/5 | 0 | 5/0/0 | 2+ | L/U/G |
| `linkedin|thedankoe` | 5 | recommend | 0 | 3/3 | 0 | 3/2/0 | 2+ | L/U/G |
| `mastodon|bagder@mastodon.social` | 6 | hold | 0 | 2/2 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|baldur@toot.cafe` | 6 | hold | 0 | 2/2 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|dangillmor@mastodon.social` | 6 | hold | 0 | 2/2 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|dansup@mastodon.social` | 6 | research_further | 0 | 0/0 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|gargron@mastodon.social` | 6 | recommend | 0 | 2/2 | 0 | 2/4/0 | 2+ | L/U/G |
| `mastodon|heidilifeldman@mastodon.social` | 6 | research_further | 0 | 1/1 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|mer__edith@mastodon.world` | 6 | hold | 0 | 5/5 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|mmasnick@mastodon.social` | 6 | hold | 0 | 2/2 | 0 | 0/0/6 | 2+ | L/U/G |
| `mastodon|molly0xfff@hachyderm.io` | 6 | recommend | 0 | 2/2 | 0 | 2/4/0 | 2+ | L/U/G |
| `reddit|r/adhd` | 25 | recommend | 25 | 5/5 | 2 | 25/0/0 | 2+ | L/U/G |
| `reddit|r/civictech` | 25 | research_further | 25 | 0/0 | 2 | 15/10/0 | 2+ | L/U/G |
| `reddit|r/claudeai` | 26 | recommend | 26 | 3/3 | 2 | 3/23/0 | 2+ | L/U/G |
| `reddit|r/entrepreneur` | 25 | research_further | 25 | 0/0 | 0 | 25/0/0 | 2+ | L/U/G |
| `reddit|r/lifeprotips` | 25 | recommend | 25 | 5/5 | 2 | 23/2/0 | 2+ | L/U/G |
| `reddit|r/localllama` | 25 | research_further | 25 | 0/0 | 0 | 1/24/0 | 2+ | L/U/G |
| `reddit|r/microsaas` | 25 | research_further | 25 | 0/0 | 0 | 4/21/0 | 2+ | L/U/G |
| `reddit|r/productmanagement` | 4 | recommend | 4 | 3/3 | 2 | 3/1/0 | 2+ | L/U/G |
| `reddit|r/sideproject` | 27 | recommend | 27 | 2/2 | 2 | 2/25/0 | 2+ | L/U/G |
| `reddit|r/youshouldknow` | 25 | research_further | 25 | 0/0 | 0 | 25/0/0 | 2+ | L/U/G |
| `substack-notes|robertreich` | 6 | recommend | 0 | 6/6 | 0 | 6/0/0 | 2+ | L/U/G |
| `substack-notes|tedgioia` | 6 | recommend | 0 | 2/2 | 0 | 2/4/0 | 2+ | L/U/G |
| `substack|anandwrites` | 4 | recommend | 0 | 4/4 | 0 | 4/0/0 | 2+ | L/U/G |
| `substack|davidpepper` | 4 | recommend | 0 | 2/2 | 0 | 3/1/0 | 2+ | L/U/G |
| `substack|deepaiyer` | 4 | research_further | 0 | 1/1 | 0 | 4/0/0 | 2+ | L/U/G |
| `substack|elenaverna` | 6 | recommend | 0 | 5/5 | 0 | 6/0/0 | 2+ | L/U/G |
| `substack|heathercoxrichardson` | 4 | recommend | 0 | 3/3 | 0 | 3/1/0 | 2+ | L/U/G |
| `threads|danidonovan` | 5 | research_further | 0 | 0/0 | 0 | 3/2/0 | 2+ | L/U/G |
| `threads|rowancheung` | 5 | research_further | 0 | 0/0 | 0 | 1/4/0 | 2+ | L/U/G |
| `threads|thedankoe` | 5 | recommend | 0 | 5/5 | 0 | 5/0/0 | 2+ | L/U/G |
| `tiktok|adhd_love` | 6 | recommend | 0 | 6/6 | 0 | 6/0/0 | 2+ | L/U/G |
| `tiktok|aliabdaal` | 4 | research_further | 0 | 0/0 | 0 | 4/0/0 | 2+ | L/U/G |
| `tiktok|carlos_eduardo_espina` | 4 | recommend | 0 | 4/4 | 0 | 4/0/0 | 2+ | L/U/G |
| `tiktok|realmattgray` | 7 | research_further | 0 | 1/1 | 0 | 7/0/0 | 2+ | L/U/G |
| `tiktok|sabrina_ramonov` | 8 | recommend | 0 | 5/5 | 0 | 8/0/0 | 2+ | L/U/G |
| `tiktok|theholisticpsychologist` | 3 | hold | 0 | 3/0 | 0 | 3/0/0 | 2+ | L/U/G |
| `tiktok|underthedesknews` | 6 | recommend | 0 | 5/5 | 0 | 5/1/0 | 2+ | L/U/G |
| `x|akshat_world` | 6 | recommend | 0 | 2/2 | 0 | 2/4/0 | 2+ | L/U/G |
| `x|arvidkahl` | 5 | research_further | 0 | 0/0 | 0 | 4/1/0 | 2+ | L/U/G |
| `x|dickiebush` | 9 | recommend | 0 | 2/2 | 0 | 4/5/0 | 2+ | L/U/G |
| `x|levelsio` | 5 | recommend | 0 | 2/2 | 0 | 2/3/0 | 2+ | L/U/G |
| `x|nathanbarry` | 5 | research_further | 0 | 0/0 | 0 | 3/2/0 | 2+ | L/U/G |
| `x|sahilbloom` | 3 | hold | 0 | 3/0 | 0 | 3/0/0 | 2+ | L/U/G |
| `youtube|aakashgupta` | 2 | research_further | 0 | 0/0 | 0 | 2/0/0 | 2+ | L/U/G |
| `youtube|aliabdaal` | 7 | recommend | 0 | 2/2 | 0 | 7/0/0 | 2+ | L/U/G |
| `youtube|benerez` | 1 | research_further | 0 | 1/0 | 0 | 1/0/0 | 1 | L/U/G |
| `youtube|dankoetalks` | 1 | research_further | 0 | 1/0 | 0 | 1/0/0 | 1 | L/U/G |
| `youtube|melrobbins` | 8 | hold | 0 | 8/0 | 0 | 8/0/0 | 2+ | L/U/G |
| `youtube|neelsikdar` | 1 | research_further | 0 | 1/0 | 0 | 1/0/0 | 1 | L/U/G |
| `youtube|productmanagementwithsachinsharma` | 1 | research_further | 0 | 1/0 | 0 | 1/0/0 | 1 | L/U/G |
| `youtube|theholisticpsychologist` | 1 | research_further | 0 | 1/0 | 0 | 1/0/0 | 1 | L/U/G |
| `youtube|underthedesknews` | 2 | research_further | 0 | 0/0 | 0 | 2/0/0 | 2+ | L/U/G |

Counts: 30 `recommend`, 8 `hold`, 27 `research_further`, and 0 `exclude`. The absence of an
exclude disposition is deliberate: the local evidence identifies review gaps and limits, but does
not justify rejecting an account as a canonical candidate.

## Pool proposals (separate, provisional)

### Niche pool

Propose review-stage coverage for the locally represented niche labels: ADHD/neurodiversity,
civic-democracy, civic-tech, AI-building, product-thinking, solopreneur/building-solopreneur,
inner-journey, and general-viral. This is a coverage proposal, not a claim that any niche wins.
The caveat is that labels are local metadata and some accounts span more than one label. A niche
coverage audit and reviewed identity metadata are still needed.

### Broad-platform pool

Propose separate platform-context review across the 13 represented platforms, with the Reddit
community records handled as community evidence rather than creator-account evidence. Do not pool
metrics across platforms. Pinterest remains an unrepresented configured-platform gap. The caveat
is that the catalog is selected, the platform denominators differ, and no platform-wide universe
has been defined.

### Format pool

Propose format-specific review for the locally represented forms: text-only, image, carousel,
short-video, video, link-preview, mixed, thread, and repost-with-comment. Treat body-incomplete
and body-unknown records as measurement/context evidence only; they cannot support mechanism
analysis. The caveat is uneven body completeness by platform and no universal format score.

## Held, excluded, and research-further cohorts

- **Held (8):** five Mastodon accounts are conditional holds because all locally represented body
  completeness is unknown (a mechanism-analysis gap, not a performance judgment). Three accounts
  have body-complete records but no admitted comparator analysis: `tiktok|theholisticpsychologist`,
  `x|sahilbloom`, and `youtube|melrobbins`; these are true comparison-evidence holds. The
  Instagram rows with incomplete or unknown bodies are `research_further`, not counted as holds.
- **Excluded (0):** no account is rejected from future consideration solely from this local
  inventory. Rejection would require a human decision or a concrete identity/provenance conflict.
- **Research further (27):** five Reddit communities have source-listing winner records but no
  admitted comparator analysis: `r/civictech`, `r/entrepreneur`, `r/localllama`, `r/microsaas`,
  and `r/youshouldknow`. The other 22 rows are non-Reddit accounts with fewer than two admitted
  analyses or no admitted comparator, including the one-record cases. These are missing-analysis
  or missing-comparator gaps, not low-performance findings.
- **Cross-cutting gaps:** all 65 rows need reviewed identity/metadata confirmation; all rows lack
  a defined comparison universe for “top” claims; Pinterest has no corpus evidence; the stored
  baseline artifacts contain 12 rows across six Reddit accounts (`r/adhd`, `r/lifeprotips`,
  `r/productmanagement`, `r/claudeai`, `r/civictech`, and `r/sideproject`), while every other
  account has a baseline gap; 169 records are body-incomplete and 44 are body-unknown.

## Minimal human gate and resumption

Muxin only needs to decide whether the proposed noncanonical account dispositions and the three
separate pools may proceed to reviewed metadata/source-identifier staging, and whether to alter
any held or research-further cohort. No canonical data write is part of this request.

After that decision, the coordinator can resume with explicit account metadata, source links,
provenance checks, and pool dispositions in isolated staging. It can then prepare a separately
leased, audited canonical-data decision if authorized. It must preserve the six evidence
distinctions, leave unknowns unknown, and keep Pinterest and comparison-universe gaps visible.
