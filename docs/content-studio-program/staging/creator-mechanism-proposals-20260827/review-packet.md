# Creator mechanism proposals: review packet, 2026-08-27

Read this first. It is the whole decision surface for this lane. The numbers come from
`creator-corpus-inventory.json`, which was measured from the Markdown; the proposals come from
`mechanism-proposals.jsonl`, which was validated against those same entries.

**Nothing in this package is approved, reviewed, best, a winner, proven, or generation-ready.**
All 69 proposals sit at `review_status: pending` and `originality_status: pending`, with
`generates_copy: false` and `creator_body_copy_allowed: false`. None of them is readable by
Content generation, the Studio UI, the reviewed hook-template ledger, or canonical pattern data,
and this lane adds no wiring that would make them readable.

## 1. What the corpus actually is

| Measure | Value |
|---|---|
| Creator files on disk | 62 |
| Files with at least one parsed entry | 61 |
| Parsed entries | 1,706 |
| Entries with readable platform counts | 1,705 |
| Entries whose metric list is partly unreadable | 39 |
| Entries carrying a direct source link | 1,703 |
| Entries with a partial capture | 210 |
| Entries gated by a paywall | 105 |
| Entries authored by someone other than the account owner | 13 |
| Entries whose opening is visual rather than worded | 61 |
| Video entries | 653 |
| Video entries carrying a transcript field | 625 |
| Video entries whose transcript field held text | 379 |
| Recognized field-label spellings | 124 |
| Tracked size | 16,733,798 bytes |

Entries by platform: youtube 386, substack 325, linkedin 199, bluesky 180, instagram 163,
x 134, mastodon 90, tiktok 89, pinterest 58, devto 30, hackernews 30, threads 22.

Entries by evidence kind: text 802, long-video 386, short-video 267, image 137,
long-form-text 114.

Capture completeness: 49 files complete against their own stated target, 12 partial-window,
1 blocked.

### Field-count equivalence does not hold, and was not assumed

The literal field counts do not match the entry count, and that is the honest state rather than a
defect. Against 1,706 entries: `Framing` appears on 1,704, `Opening hook` on 1,647, `Structure` on
1,440, `Structure map` on 265, `Full text` on 980, a transcript field on 625, `Metrics` or
`Points/comments` on all 1,706. A wordless clip has no transcript; a video has no full text; a
Hacker News submission scores in points, not likes. `missing` is recorded as its own state,
separate from `absent` (the corpus said there was nothing to capture) and `partial` (the capture
stopped early).

## 2. Index-to-file discrepancies

- The index's own status line declares **65** creators captured. There are **63** table rows,
  **62** distinct linked files, **62** files on disk, and **61** files with at least one entry.
  The line's own arithmetic ("58 from the main sweep, plus Alex Cattoni and 6 YouTube creators")
  sums to 65, so the 65 is a roster claim that the delivered files do not support. Three of the
  claimed 65 have no file.
- One index row carries no file link: the Jake Ward row under Solopreneurship, which
  cross-references the AI-building row rather than linking again. That is why 63 rows resolve to
  62 files.
- `jesse-anderson.md` says `30/30` in both the file header and the index row, but 31 entries
  parse: 30 newsletter posts plus 1 Note in a second section. This is the only per-file count
  mismatch in the corpus.
- No file on disk is missing from the index, and no index link points at a file that does not
  exist.
- `alex-partridge.md` parses 43 entries against a leading `30/30`. That is not a discrepancy: its
  claim continues "13/13 image or carousel posts found", and the file carries two numbered
  sections. The parser reads every `n/m` pair before deciding.

## 3. Anomalies the parser recorded

| Kind | Count | What it means |
|---|---|---|
| `body-embedded-heading` | 9 | A `### N.` line inside a creator's own long-form body, rejected as an entry. All 9 are in `ashley-childress.md`, whose Dev.to posts carry their own numbered subheads. Counting them would have inflated that file from 30 entries to 39. |
| `unrecognized-field-label` | 23 | A bold label outside the field taxonomy. These are the creator's own bolded lines inside a verbatim body, so the label text is counted and located but never recorded. |
| `unparsable-metrics` | 39 | An entry whose metric list is partly unreadable, because the platform showed prose where a number belongs ("views not shown", "comments in the hundreds"), or because a paywall note was appended to the metric line. The readable counts are kept; the entry is flagged as incomplete rather than treated as fully measured. |
| `claimed-count-mismatch` | 1 | `jesse-anderson.md`, above. |
| `no-entries` | 1 | `bella-poarch.md`, a documented account-specific capture block. |

## 4. Coverage gaps

These are gaps in the evidence, not gaps in the work that produced it. Each one limits what a
proposal resting on those entries can claim.

- **One account produced nothing.** `bella-poarch.md` is 0/30: the profile loaded but the video
  grid never rendered. TikTok is represented by two other accounts only.
- **Twelve accounts are bounded-window captures**, not top-of-all-time lists:
  `mini-adhd-coach.md` (4/30), `rowan-cheung.md` (4/30), `lara-acosta.md` (12/30),
  `danny-postma.md` (13/30), `daria-career-journey.md` (14/30), `jake-ward.md` (19/30),
  `rich-mironov.md` (20/30), `ruben-hassid.md` (24/30), `teresa-torres.md` (26/30),
  `alex-hormozi.md` (28/30), `digital-empires.md` (28/30), `charli-damelio.md` (29/30).
  Threads capped three of them at 4, 4 and 14; LinkedIn's feed capped three more.
- **Transcripts exist for 379 of 653 video entries**, and 28 video entries carry no
  transcript field at all. The gap is not evenly spread: every
  Instagram Reels account and the TikTok accounts returned 0 usable transcripts (playback would
  not advance in an automated session, or the clip is wordless and set to music), while the
  YouTube accounts returned nearly all of theirs. Any short-video mechanism therefore rests on
  captions, on-screen text and visual description rather than on speech.
- **105 entries stop at a paywall gate.** The free preview was captured and labelled; the
  arrangement past the gate was never observed. Concentrated in the Substack long-form accounts.
- **Dates are not uniformly precise.** Some platforms publish only a relative age ("3 years ago",
  "19h"), Pinterest published none at all for two accounts, and some entries carry an
  approximation the capture agent marked. The inventory records the precision it found and never
  upgrades an approximation into a date.
- **Three of 1,706 entries carry no direct source link**, so 1,703 can be re-checked at
  the source and three cannot. All three are grid-only captures whose individual permalink the
  platform did not expose.
- **No baselines, denominators or comparison windows exist anywhere in this corpus.** Counts are
  absolute and unnormalized against follower count, channel size, era or platform. Nothing here
  supports a relative-outperformance claim.
- **Only 584 of 1,706 entries are cited by a proposal.** The rest are not disqualified; they were
  not clustered into anything that cleared the four-entry floor in this pass.

## 5. Proposed mechanisms

69 proposals across eight families, kept strictly separate. Support numbers below were recomputed
from the cited entries by `validate`, not declared by hand.

- Replication: 69 cross-creator, 0 single-creator. Cross-creator here means only that the cited
  entries come from more than one creator file. It is not a claim of measured replication.
- Evidence status: 34 metric-backed, 32 partial-capture, 3 structural-only.
  `metric-backed` means only that every cited entry carried a complete, readable count set, never
  that the arrangement caused those counts. `structural-only` means at least one cited entry's
  metric list is partly unreadable.
- Confidence: 55 medium, 14 low. No proposal is high.
- 727 source references, 584 distinct entries, across all 12 platforms.

### hook (9 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:hook:chained-quote-cold-open` | Chained real-quote cold open | 6 | 3 | youtube | partial-capture | medium |
| `mech:hook:concrete-scene-before-thesis` | Concrete scene before thesis | 6 | 4 | devto, substack | metric-backed | medium |
| `mech:hook:dated-external-event-anchor` | Dated external-event anchor | 6 | 4 | hackernews, linkedin, mastodon, substack | metric-backed | medium |
| `mech:hook:flash-forward-teaser-cut` | Flash-forward teaser cut | 11 | 3 | youtube | partial-capture | medium |
| `mech:hook:paradox-contrast-flat-opener` | Flat paradox or contrast opener | 20 | 10 | bluesky, linkedin, mastodon, x | structural-only | medium |
| `mech:hook:point-first-opener` | Point-first opener (verdict or topic before preamble) | 16 | 7 | instagram, youtube | partial-capture | medium |
| `mech:hook:stat-first-opener` | Stat-first / concrete-number opener | 20 | 12 | instagram, linkedin, mastodon, substack, tiktok, x, youtube | partial-capture | medium |
| `mech:hook:visual-resolved-curiosity-gap` | Visual-resolved curiosity gap | 8 | 4 | bluesky, linkedin, x | metric-backed | medium |
| `mech:hook:withheld-specifics-curiosity-gap` | Withheld-specifics curiosity gap | 10 | 6 | instagram, linkedin, mastodon, threads, x | metric-backed | medium |

Consolidation note: 19 input candidates consolidated to 9 merged proposals, one above the usual 5-8 target: point-first-opener, paradox-contrast-flat-opener, and withheld-specifics-curiosity-gap were each formed by merging two-to-three same-arrangement candidates that had originally been split across shards (long-video/short-video, or paraphrased-need vs literal-quote-need), but the remaining five stayed genuinely distinct arrangements even after checking every adjacent pair for a legitimate merge, so cutting one further would have discarded a real, separately-evidenced pattern rather than trimming a duplicate. None of the 9 exceed medium confidence; none of the underlying evidence establishes causation or effectiveness, only that the arrangement recurs.

### structure (9 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:structure:chronological-evidence-to-verdict-arc` | Chronological evidence-to-verdict arc | 12 | 5 | youtube | partial-capture | medium |
| `mech:structure:enumerated-list-whole-piece` | Enumerated or fixed-count list as whole-piece arrangement | 34 | 14 | bluesky, instagram, linkedin, pinterest, substack, threads | metric-backed | medium |
| `mech:structure:framework-first-structured-walkthrough` | Framework-first structured walkthrough | 13 | 8 | substack, youtube | partial-capture | medium |
| `mech:structure:opposition-first-then-rebuttal` | Opposition stated first, then rebutted | 13 | 10 | devto, hackernews, mastodon, substack, youtube | partial-capture | medium |
| `mech:structure:paired-juxtaposition-arrangement` | Paired juxtaposition arrangement | 6 | 4 | mastodon, substack | partial-capture | medium |
| `mech:structure:repeating-internal-template-units` | Repeating internal-template units | 13 | 9 | devto, linkedin, substack | partial-capture | medium |
| `mech:structure:single-incident-to-rule-arc` | Single-incident-to-rule arc | 8 | 5 | hackernews, linkedin, substack, x | partial-capture | medium |
| `mech:structure:single-variable-template-reuse` | Single-variable template reuse across posts | 17 | 4 | bluesky, instagram, pinterest | partial-capture | medium |
| `mech:structure:two-state-contrast-spine` | Two-state contrast spine | 10 | 6 | instagram, linkedin, threads, x | metric-backed | medium |

Consolidation note: 23 input candidates consolidated to 9 merged proposals, one above the usual 5-8 target: enumerated-list-whole-piece, repeating-internal-template-units, opposition-first-then-rebuttal, two-state-contrast-spine, and framework-first-structured-walkthrough were each formed by merging 2-3 same-arrangement candidates that the source passes had split across shards (image/short-video/text, or paraphrase/quote variants of the same objection-then-rebuttal shape). The remaining four standalone candidates (chronological-evidence-to-verdict-arc, single-incident-to-rule-arc, paired-juxtaposition-arrangement, single-variable-template-reuse) are each a genuinely distinct arrangement from every other candidate, including from each other's near-neighbors (e.g. paired-juxtaposition's two-different-accounts shape versus two-state-contrast-spine's one-subject-over-time shape), so no further honest merge was available; cutting one to hit 8 would have discarded real, separately-evidenced structure rather than a duplicate. None of the 9 exceed medium confidence; none of the underlying evidence establishes causation or effectiveness, only that the arrangement recurs.

### framing (9 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:framing:admitted-failure-as-authority` | Admitted-failure-as-authority | 33 | 19 | devto, linkedin, substack, x, youtube | partial-capture | medium |
| `mech:framing:attributed-origin-relay-stance` | Attributed-origin relay stance | 14 | 10 | bluesky, linkedin, substack, x, youtube | partial-capture | medium |
| `mech:framing:borrowed-external-authority` | Borrowed external authority | 19 | 10 | instagram, linkedin, mastodon, substack, tiktok | partial-capture | medium |
| `mech:framing:calendar-anchored-urgency` | Calendar-anchored urgency | 10 | 4 | bluesky, instagram, pinterest | partial-capture | medium |
| `mech:framing:conventional-belief-corrective-stance` | Conventional-belief corrective stance | 27 | 15 | instagram, linkedin, pinterest, substack, threads, x, youtube | partial-capture | medium |
| `mech:framing:credential-readout-first-stance` | Credential-readout-first stance | 8 | 4 | youtube | partial-capture | medium |
| `mech:framing:deficit-to-asset-reframe` | Deficit-to-asset reframe | 6 | 3 | instagram | metric-backed | medium |
| `mech:framing:mirror-not-new-information-framing` | Mirror-not-new-information framing | 9 | 4 | instagram | metric-backed | medium |
| `mech:framing:personal-track-record-as-authority` | Personal-track-record-as-authority | 5 | 5 | linkedin, x | metric-backed | medium |

Consolidation note: 9 merged proposals, slightly above the 5-8 target, because evidence genuinely supported that many distinct arrangements once near-duplicates were merged (3 corrective-stance variants -> 1, 4 admitted-failure variants -> 1, 2 attributed-origin variants -> 1, 3 borrowed-authority variants -> 1). The 5 rejected candidates were each thin (at or near the 4-ref/2-file floor, low confidence, or single-creator-dominated) rather than genuinely distinct enough to warrant a separate proposal. Coverage skews heavily toward youtube long-video and linkedin/substack text sources; instagram/pinterest sources cluster around ADHD/neurodivergence-adjacent accounts (mirror framing, deficit-to-asset reframe). digital-empires.md's broader factual reliability is flagged low elsewhere in the corpus, noted where it touches a cited entry's file. No proposal claims any mechanism causes engagement; all are observed arrangements only.

### retention (6 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:retention:cross-piece-continuity-callback` | Cross-piece continuity callback | 12 | 8 | mastodon, substack, x | partial-capture | medium |
| `mech:retention:escalating-sequential-unit-cascade` | Escalating sequential-unit cascade | 15 | 12 | bluesky, hackernews, linkedin, pinterest, substack, threads, x | metric-backed | medium |
| `mech:retention:mid-piece-authenticity-break` | Mid-piece authenticity break | 8 | 5 | devto, substack, youtube | partial-capture | medium |
| `mech:retention:payoff-adjacent-cutoff` | Payoff-adjacent cutoff | 6 | 4 | substack | partial-capture | medium |
| `mech:retention:withheld-context-recontextualization` | Withheld-context recontextualization | 11 | 4 | bluesky, instagram, pinterest | metric-backed | medium |
| `mech:retention:within-piece-running-device` | Within-piece running device | 9 | 4 | devto, substack, youtube | metric-backed | medium |

Consolidation note: 6 merged proposals, within the 5-8 target range. Several individually thin source clusters (each at or near the 4-ref floor) combined into stronger, more broadly replicated proposals once genuinely matching arrangements were merged: escalating-sequential-unit-cascade absorbed 3 separate clusters spanning 12 distinct files; within-piece-running-device and mid-piece-authenticity-break each combined two 2-file clusters into 4-5 file support. The 5 rejected candidates remained genuinely thin after considering merges: each was single-creator-dominated, at the bare support floor, or partly inferential from indirect evidence (comment threads) rather than the captured piece itself. No baseline, denominator, or comparison window exists for any of these counts; none of these arrangements is claimed to cause engagement, only observed as a recurring structure.

### cta (11 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:cta:appended-resource-or-next-step-offer` | Appended Resource or Next-Step Offer | 20 | 9 | linkedin, substack, youtube | partial-capture | medium |
| `mech:cta:cta-as-designed-graphic-element` | CTA as Designed Graphic Element | 12 | 4 | instagram, pinterest, threads | partial-capture | low |
| `mech:cta:direct-access-point-ask` | Direct Access-Point Ask | 6 | 4 | linkedin, x | structural-only | low |
| `mech:cta:entry-mechanism-giveaway-ask` | Entry-Mechanism Giveaway Ask | 5 | 2 | youtube | metric-backed | low |
| `mech:cta:free-sample-paid-upsell-funnel` | Free-Sample Paid-Upsell Funnel | 9 | 3 | youtube | partial-capture | medium |
| `mech:cta:invite-reader-contribution` | Invite Reader Contribution | 4 | 2 | devto, substack | partial-capture | low |
| `mech:cta:no-stated-cta-credit-only-caption` | No Stated CTA, Credit-Only Caption | 5 | 2 | tiktok | metric-backed | medium |
| `mech:cta:off-platform-destination-pointer` | Off-Platform Destination Pointer | 4 | 4 | instagram, tiktok | metric-backed | low |
| `mech:cta:open-question-as-the-close` | Open Question as the Close | 20 | 13 | devto, linkedin, substack, x, youtube | metric-backed | medium |
| `mech:cta:product-prompt-in-closing-beat` | Product Prompt Woven Into the Closing Beat | 5 | 3 | instagram | metric-backed | medium |
| `mech:cta:scarcity-anchored-event-cta` | Scarcity-Anchored Event CTA | 6 | 3 | linkedin | metric-backed | low |

Consolidation note: 16 shard-level candidates consolidated to 11 rather than the aimed 5-8: two genuine cross-shard duplicate pairs merged (open-question closes across four shards; postscript/appended resource offers across three shards), but the remaining shapes describe materially different CTA arrangements (graphic-panel placement, contribution asks, upsell funnels, giveaway mechanics, topic-tied product prompts, absence of a CTA, off-platform pointers, blunt access-point asks, and scarcity framing) that would be false merges if combined further. Several proposals rest on only 2-3 distinct creator files; treat those as exploratory rather than replicated.

### storytelling-sequence (10 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:storytelling-sequence:first-person-before-after-transformation-arc` | First-Person Before/After Transformation Arc | 11 | 6 | instagram, linkedin, tiktok | metric-backed | medium |
| `mech:storytelling-sequence:formative-backstory-before-the-payoff` | Formative Backstory Before the Payoff | 4 | 2 | devto, substack | partial-capture | low |
| `mech:storytelling-sequence:interrupting-party-pivot` | Interrupting-Party Pivot | 4 | 3 | bluesky, linkedin, x | metric-backed | low |
| `mech:storytelling-sequence:lived-experience-narrative-handoff` | Lived-Experience Narrative Handoff | 5 | 3 | youtube | metric-backed | medium |
| `mech:storytelling-sequence:mid-piece-reversal-of-an-initial-assumption` | Mid-Piece Reversal of an Initial Assumption | 10 | 7 | devto, hackernews, linkedin, substack, x | partial-capture | medium |
| `mech:storytelling-sequence:origin-turn-as-narrative-spine` | Origin Turn as Narrative Spine | 6 | 4 | youtube | metric-backed | medium |
| `mech:storytelling-sequence:period-by-period-march-to-the-present` | Period-by-Period March to the Present | 9 | 7 | hackernews, linkedin, x | metric-backed | medium |
| `mech:storytelling-sequence:scene-first-opener-with-pull-back-to-argument` | Scene-First Opener With Pull-Back to Argument | 13 | 7 | linkedin, substack, youtube | partial-capture | medium |
| `mech:storytelling-sequence:setup-turn-end-arc-no-resolution` | Setup-Turn-End Arc, No Resolution | 11 | 9 | bluesky, instagram, pinterest, threads, tiktok | metric-backed | medium |
| `mech:storytelling-sequence:unresolved-outcome-real-time-arc` | Unresolved-Outcome Real-Time Arc | 6 | 3 | youtube | partial-capture | medium |

Consolidation note: 16 shard-level candidates reduced to 10 merged proposals plus 1 rejection. Five genuine cross-shard duplicate pairs merged (assumption reversals; scene-first pull-backs; setup-turn-end arcs; before/after transformation arcs; period-by-period marches) because they described the same arrangement in different media. The remaining five standalone shapes (formative backstory, origin-turn spine, narrative handoff, real-time-outcome arc, interrupting-party pivot) are structurally distinct and would be false merges if combined further, which keeps the count above the aimed 5-8. One candidate was rejected as filed under the wrong family rather than force-fit here.

### native-format (8 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:native-format:cross-post-numbered-segments` | Cross-Post Numbered Segments | 5 | 2 | mastodon, threads | metric-backed | low |
| `mech:native-format:gate-at-payoff-pivot` | Gate At The Payoff Pivot | 5 | 2 | substack | partial-capture | low |
| `mech:native-format:link-out-teaser-post` | Link-Out Teaser Post | 7 | 4 | linkedin, mastodon | metric-backed | medium |
| `mech:native-format:minimal-caption-content-in-attached-media` | Caption As Pointer, Card Carries Content | 11 | 8 | bluesky, linkedin, mastodon, x | metric-backed | medium |
| `mech:native-format:recurring-named-segment-slot` | Recurring Named Segment Slot | 15 | 5 | linkedin, mastodon, substack, youtube | partial-capture | medium |
| `mech:native-format:reproduced-artifact-as-centerpiece` | Reproduced Artifact As Centerpiece | 7 | 3 | devto, substack | partial-capture | low |
| `mech:native-format:standing-episode-opening-bumper` | Standing Episode-Opening Bumper | 12 | 3 | youtube | partial-capture | low |
| `mech:native-format:trending-audio-as-organizing-spine` | Pre-Existing Audio As Organizing Spine | 5 | 3 | instagram, tiktok | metric-backed | medium |

Consolidation note: 21 input candidates reduced to 8 merged proposals. Three merges combined near-duplicate observations that different passes described independently: recurring named segments across a video-show shard and a text-platform shard; standing episode-opening bumpers (an intro-plus-credentials structure and a verbatim-reused opening line describing the same episodes); and a minimal-caption / content-in-attached-media container observed independently in two separate text shards. No ref was dropped from any merge; every merged entry's entry_refs is the deduplicated union of its source candidates. The 10 rejected candidates were real but either sat at or near the 4-ref support floor with only 2 files, showed internal inconsistency per their own evidence notes, or overlapped in purpose with a stronger retained candidate.

### visual-treatment (7 proposals)

| Proposal | Name | Entries | Creator files | Platforms | Evidence | Confidence |
|---|---|---|---|---|---|---|
| `mech:visual-treatment:deadpan-image-mismatch` | Deadpan Image Mismatch | 5 | 3 | bluesky, x | structural-only | low |
| `mech:visual-treatment:fixed-position-text-banner-signature` | Fixed-Position Text Banner As Signature | 5 | 4 | instagram | metric-backed | medium |
| `mech:visual-treatment:overlay-text-as-primary-hook` | Overlay Text As Primary Hook | 11 | 4 | instagram, pinterest, threads | metric-backed | medium |
| `mech:visual-treatment:physical-prop-as-concrete-proof` | Physical Prop As Concrete Proof | 15 | 9 | bluesky, instagram, pinterest, youtube | metric-backed | low |
| `mech:visual-treatment:screenshot-as-evidentiary-proof` | Screenshot As Evidentiary Proof | 16 | 10 | bluesky, devto, linkedin, mastodon, substack, x | metric-backed | medium |
| `mech:visual-treatment:thumbnail-encoded-central-claim` | Thumbnail-Encoded Central Claim | 7 | 3 | youtube | metric-backed | medium |
| `mech:visual-treatment:wordless-visual-pairing-contrast` | Wordless Visual Pairing Carries The Contrast | 5 | 3 | instagram, tiktok | metric-backed | medium |

Consolidation note: 17 input candidates reduced to 7 merged proposals. Two large merges consolidated near-duplicate observations that recurred independently across three shards each: screenshot/image-as-evidentiary-proof (long-form text, a general short-text shard, and an accountability-journalism-leaning shard) and physical-prop-as-concrete-proof (a still-image shard, a long-video shard, a short-video shard); both are now the family's best-supported candidates. One input candidate (upfront structure-preview device) was rejected as filed under the wrong family rather than moved, since it describes a structural device, not a visual-layer treatment. The remaining 5 rejected candidates were thin, at or near the 4-ref support floor with 2-3 files, or showed a concentration issue where one file supplied most refs.

## 6. Rejected and unsupported clusters

Two tiers were dropped. Both are listed so that a "no" is visible rather than silent.

### 6a. Rejected during consolidation (39)

These reached the consolidation stage and were not carried forward.

| Family | Cluster | Why it is not a proposal |
|---|---|---|
| framing | Audience-submission provenance stance | Too thin: 3 distinct files with one creator (jessica-mccabe) supplying 60% of refs; low confidence in the source pass. |
| framing | Corrective-rebuttal stance | Only 3 distinct files and low confidence; conceptually overlaps with the conventional-belief-corrective-stance proposal without enough independent evidence to justify a separate journalism-specific proposal in this pass. |
| framing | Direct-answer-to-a-prior-claim framing | Exactly at the 2-file/4-ref support floor with low confidence; too thin to carry as its own proposal. |
| framing | In-Group Dissent Stance | Exactly at the 4-ref support floor, one creator (colin-percival) supplies half the refs, low confidence. |
| framing | In-group insider-knowledge stance | Too thin: 3 distinct files with one creator (codie-sanchez) supplying 60% of refs; low confidence in the source pass. |
| hook | Credential-First Opener | thin: 5 refs across 3 files, with one file supplying 60% of them |
| hook | Direct-address reader-state opener | thin: 4 refs across 3 files, with half from a single file |
| hook | Hook-template reuse across separate posts | describes a cross-post production habit (the same hook premise redeployed across separate pieces) rather than the information order within a single opening; also thin, only 2 distinct creator files |
| hook | Preempt the objection hook | thin: 4 refs across 3 files, and half those refs carry partialCapture flags limiting what was actually observed of the full arrangement |
| hook | Rhetorical self-recognition question | thin: 4 refs across 3 files, and half those refs come from a single file |
| native-format | Bonus artifact gated after the lesson | A related but distinct gate-placement variant to the retained payoff-pivot gate candidate; keeping both would present two overlapping paywall-placement observations from a small, mostly non-overlapping set of newsletter examples. Folded out in favor of the sharper, more general payoff-pivot arrangement. |
| native-format | Long-recording excerpt repackaged as a standalone clip | Only 2 distinct files in the corpus, though each has substantially more matching entries than listed. Cut in favor of candidates with broader cross-creator-file corroboration. |
| native-format | Multi-Image Juxtaposition Container | Nominal 4-file support is overstated per the source notes: 2 of the 4 files are doubtful matches (one has only 2 of 30 captured entries that are true carousels, the rest a different single-image multi-panel container; the other's instance may be a single multi-panel image rather than a true multi-upload carousel). Real corroboration drops to roughly 2 solid files. |
| native-format | Platform split-screen pairing tool | Only 2 distinct files, and one is noted as using the same platform tool for a different purpose than the dominant file's usage, weakening the claim that this is one consistent arrangement rather than two different uses of a shared platform feature. |
| native-format | Pre-narrative summary block | At the 4-ref support floor across only 2 files. The observed device is real but not distinct enough from ordinary structural framing to hold its own native-format slot at this evidence level; cut to keep the slate to the most distinct, best-supported arrangements. |
| native-format | Quote-post commentary layer | Thin: 3 distinct files, and the source notes flag it as only meaningful on platforms with a native quote-repost primitive, narrowing its generality. Cut in favor of better-corroborated candidates. |
| native-format | Reacts-to-a-creator's-own-upload | At the 4-ref support floor; while 3 distinct files corroborate it, the arrangement blends container choice with subject-matter and relationship framing rather than a pure format decision. Cut to keep the slate to the most clearly arrangement-only candidates. |
| native-format | Recorded live-stage talk container | Reasonably supported (3 files, 7 refs), but one file supplies 4 of 7 refs, close to the concentration threshold, and the arrangement sits closer to a description of the recording's source than a reusable container decision. Cut to stay within the family's target proposal count. |
| native-format | Sponsor co-credit tag inside an organic-looking piece | At the 4-ref support floor across 3 files. Real observation but thin; cut to stay within the family's target proposal count in favor of better-supported candidates. |
| native-format | Vendor-hosted demo webinar container | At the 4-ref support floor across only 2 files, evenly split 2/2. Thin cross-creator corroboration. |
| retention | Coined Concept Handle | At the 4-ref support floor across 3 files with one creator supplying half; low confidence, and the observed entries show only the act of coining a label, not an actual callback to it, so it does not merge cleanly with the cross-piece-continuity-callback proposal. |
| retention | Deferred or withheld list payoff | At the 4-ref support floor across 3 files, low confidence, and the source notes the evidence itself is partly inferential from comment threads rather than the captured piece. |
| retention | Live running-count display | One creator (mrbeast) supplies 5 of 6 refs; only 2 distinct files and low confidence, too thin for its own proposal. |
| retention | Mid-piece participatory challenge | At the 4-ref support floor across only 2 files with one creator (nik-hobrecker) supplying 3 of 4; low confidence, too thin for its own proposal. |
| retention | Theory-before-payoff deferral | One creator (dan-koe) supplies 71% of refs; only 3 distinct files and low confidence, too thin for its own proposal. |
| storytelling-sequence | Narrative belongs to someone other than the poster | Misfiled: describes narrative ownership and curatorial stance (whose story is being told, whose authority backs it), not narrative ordering or a setup/turn/consequence/resolution shape. Belongs to the framing family, not storytelling-sequence. |
| structure | Excerpt-plus-reframing-layer composition | only 2 distinct creator files despite dense within-file replication; too thin for a standalone merged proposal |
| structure | Fixed-rubric scored list | thin and concentrated: one creator supplies 4 of 6 refs (67%), at the 3-file floor with low confidence |
| structure | Literal-prompt build tutorial | concentrated in only 2 of 16 files in its shard, both AI-tooling substacks, and most refs are partialCapture (paywall cuts mid-tutorial); flagged low confidence for thin creator diversity in the source pass |
| structure | Problem-then-mechanism argument | exactly at the 4-ref support floor with only 1 ref per file; thinner evidence depth than the other structure candidates retained |
| structure | Segment-by-segment reaction pass | real pattern but thinner (3 files) than the other long-video structure candidates retained; too close in shape to the chronological evidence-to-verdict arc to justify a separate, only lightly-evidenced entry |
| structure | Silent scenario-into-performance vignette | thin cross-creator diversity (3 files) relative to the other short-video structure candidates; low confidence in the source pass |
| structure | Unified-Thesis Roundup | concentrated: one creator supplies 3 of 5 refs and the pattern is described as close to her default format; low confidence |
| visual-treatment | Continuous synced captioning | At the 4-ref support floor and only 2 distinct files; one file supplies 3 of 4 refs, leaving only one other file to independently confirm the same continuous-caption treatment. |
| visual-treatment | Off-topic humanizing photo | At the 4-ref support floor across 3 files, with 2 of the 4 refs from one file. Thin corroboration; cut to stay within the family's target proposal count. |
| visual-treatment | Silent on-screen text carries narration, visual runs unaccompanied | Only 2 distinct creator files corroborate this device; cut in favor of better-corroborated on-screen-text and wordless-visual candidates already retained for this family. |
| visual-treatment | Structured before/after comparison | At the 4-ref support floor across 3 files, one carrying a partial-capture flag. Real device but thin corroboration; cut to keep the family slate to the strongest, most distinct arrangements. |
| visual-treatment | Unedited Personal Photo | At the 4-ref support floor and only 2 distinct files, with one file supplying 3 of the 4 refs. Weak cross-creator diversity. |
| visual-treatment | Upfront structure-preview device | Filed under the wrong family: this describes a structural or informational device, such as a table of contents, section index, or timestamp list, not what the visual layer does. It belongs with native-format's container-oriented candidates instead; rejected here rather than moved, per the family-boundary instruction. |
### 6b. Never reached consolidation (38)

These were flagged during the first pass as real-looking but below the support floor, or
concentrated in a single creator file.

| Family | Cluster | Why it never reached consolidation |
|---|---|---|
| cta | Comment-a-keyword DM funnel | the specific comment-a-word-for-a-DM-link mechanic recurs many times but only within sasha-hamdani.md |
| cta | Direct civic/collective-action ask | Real closing device (redirects the ask to voting, contacting representatives, or supporting a named cause rather than the channel) but every instance found is in one file |
| cta | Personal-favor loyalty offer | Only a single instance in the shard (marily-nika.md#entry-1-9), well under the 4-ref minimum. |
| cta | Sponsor product woven into the game mechanic | Real device (a paid integration staged as part of a challenge stage rather than a separate break) but every instance found is in one file |
| cta | Timed-window checklist as the CTA | A closing checklist bounded to a specific number of minutes recurs across many entries, but all are from ruben-hassid.md; not observed in the other three files. |
| framing | Even-handed steelman investigative stance | Real pattern (refuses a simple verdict, presents both sides' strongest case) but every clear instance is in one file |
| framing | Lived-Experience-as-Authority | 3 distinct files (joanna-rahier, alex-partridge, digital-empires). |
| framing | Mainstream-institution validation citation | only sasha-hamdani.md cites an outside news/network institution to lend legitimacy to the subject; no second creator file observed |
| framing | Press-hit-as-validation framing | Only one clear instance in this shard (molly-white citing a John Oliver segment); no second file found with the same 'third-party press covered my own work' device. |
| framing | Second-Person Confidant Address | 3 distinct files (joanna-rahier, mini-adhd-coach, alex-partridge). |
| framing | Underdog-to-large-scale-wealth arc | abundant within school-of-hard-knocks.md (a humble origin point revealed before an outsized outcome) but every ref is from that one file |
| hook | Bare Shock-Statistic Opener | Only 1 distinct file (alex-partridge), 2 entries. |
| hook | Interrogates its own subject term before explaining it | Only 3 refs found (below the 4-ref minimum) |
| hook | Numbered-Inventory Hook Opener | Opening-line-specific evidence for a stated item-count hook (distinct from the broader list-as-structure candidate) reaches only 3 distinct files (joanna-rahier, digital-empires, alex-partridge). |
| hook | Rhetorical-Question Opener | 3 distinct files (dani-donovan, digital-empires, alex-partridge); dani-donovan's variant recurs heavily within her own file, which does not add cross-creator weight. |
| hook | Second-person hypothetical address | Only 3 refs found (below the 4-ref minimum) |
| hook | Shock-figure hook immediately after the opening claim | A dollar-figure or percentage shock-stat placed right after the opening claim recurs repeatedly, but only within ruben-hassid.md; no matching instance found in the other three files. |
| native-format | Category-Disclaimer Opener Bit | Only 1 distinct file (weratedogs), a recurring house bit not observed elsewhere in this shard. |
| native-format | Cold-approach street-interview container | the entire subgenre (approaching a stranger to fire scripted wealth questions) is unique to school-of-hard-knocks.md in this shard; no other file uses it |
| native-format | Guest-authored takeover post credited to a named co-author | after moving thirdPartyAuthored entries (jake-ward.md#entry-1-2/3/4/10) to third_party_refs and excluding them from creator-file counts as required, only jake-goodman's own guest-post entries remain, i.e. one creator file |
| native-format | Numbered segmented thread (X/N) | The segmentedThread flag and matching structure appear only in rowan-cheung, a single file, in this shard. |
| native-format | Paywall cut naming exactly what's withheld, positioned right before the payoff | all refs come from one file (jake-goodman); the paywalled flag does not appear on any other file in this shard |
| native-format | Single recurring contestant redemption arc | Real device (a recurring named contestant's prior losses referenced across separate videos to raise stakes) but every instance found is in one file |
| retention | Mid-piece rules-change escalation | Real device (a resource crisis or rule change inserted partway through to escalate difficulty) but every instance found is in one file |
| retention | On-screen series/part counter | only 3 entry refs across 2 files found signaling an explicit ongoing-series counter or 'to be continued' marker, short of the 4-ref minimum |
| retention | Suspense-fake reversal beat | Only 3 refs found (below the 4-ref minimum) despite spanning 3 files |
| storytelling-sequence | Confession then unresolved social risk | Only 3 refs found (below the 4-ref minimum), one per file |
| structure | Chained sequential prompt walkthrough | only sabrina-ramonov.md shows this step-built-on-step chained sequence; no cross-file replication found |
| structure | Chronological accumulated-evidence catalogue with no editorial commentary | Strongly and repeatedly present in judd-legum but no second file in this shard shows the same dense, dated, quote-by-quote catalogue device without added commentary. |
| structure | Escalating price-tier ladder tour | Very clear, heavily reused structure but every instance found is in one file |
| structure | Explicit reader-segment skip-ahead break | Only 2 refs, both from ruben-hassid.md; under the 4-ref minimum and confined to one file. |
| structure | Interview ride-along with live cost/revenue breakdown | Clear recurring format but every instance found is in one file |
| structure | Multi-topic newsletter bundle with shared table of contents | Only one distinct file (julie-zhuo) shows this pattern in this shard; no cross-creator replication found. |
| structure | Personal life-update aside embedded mid-piece | consistent recurring device but only 1 creator file (jake-goodman) exhibits it; no cross-creator replication found in this shard |
| structure | Reader-crowdsourced roundup | Only 3 refs found and only 2 distinct files (jesse-anderson, lenny-rachitsky) genuinely match 'asked audience, compiled responses' rather than generic curation. |
| visual-treatment | Quote-card image carrying an aphorism, paired with a minimal caption/question | concentrated almost entirely in one file (alex-hormozi); not independently replicated elsewhere in this shard |
| visual-treatment | Tone-Mismatched Illustration Style | All strong supporting refs come from one file (pbf-comics) - a distinctive single-creator signature, not observed cross-creator in this shard. |
| visual-treatment | Wordless tonal-whiplash juxtaposition cut | Only 2 refs found (below the 4-ref minimum), also only 2 distinct files |
## 7. Originality risks

The validator proves a bounded thing and not more. Say what it proves, then what it does not.

**What passed.** No proposal's free text, including its own identifier, shares an eight-word run
with any line of any entry it cites, nor with any line anywhere else in the corpus. No proposal carries a link, a blockquote, a quoted run, or
an em dash, and none asserts what an arrangement does to a reader. No proposal record has a key that could hold creator copy, and the reader rejects
unknown keys rather than dropping them. No proposal uses a claim word. No proposal contains a
creator's full name or an account handle: that check matches the name as a phrase and the handle
as one unbroken run, deliberately not single words, because creator slugs and handle fields carry
ordinary English ("love", "green", "levels", "product", "information") that would otherwise fire
on prose naming nobody. A publication title or a bare surname would not be caught.

**What that does not settle.**

1. **Mechanisms were abstracted from the research pass's own `Structure` and `Framing` notes**,
   not from raw bodies. Those notes are already a step away from the creator's words, which is
   good for originality, but it means a proposal inherits whatever the note author chose to
   emphasise. A human should read a sample of proposals against their cited entries.
2. **An arrangement can identify a creator without copying a word.** Some proposals describe what
   is effectively one account's signature format. `mech:structure:single-variable-template-reuse`
   and `mech:visual-treatment` proposals resting on a small number of files are the clearest
   cases. Using such an arrangement is closer to imitating a format than to using a common one.
3. **Cross-creator does not mean common.** 21 of the 69 proposals cite only two or three distinct
   creator files. That clears the mechanical floor without establishing that the arrangement is a
   widely shared convention rather than a small cluster's habit.
4. **Nineteen proposals are single-platform.** A single-platform arrangement may be a platform
   affordance rather than a craft choice.
5. **Nothing here has been checked against Muxin's own voice.** A mechanism can be original,
   body-free, and still wrong for her.

That is why `originality_status` is `pending` on every row. The independent originality and
evidence audit named in the charter has not run, and this lane did not run it.

## 8. What the eight-word copy check cannot see

The check compares a proposal's free text and its identifier against every line of every entry it
cites, and separately against a hashed index of every word run in all 62 files, so copying from an
entry a proposal does not cite is caught too. What it still cannot see is close paraphrase below
eight consecutive words, or a rearrangement of the same substance. It is a floor, not a proof of
independence.

The creator-name check runs over the fields that describe a mechanism: the name, the mechanism, the
adaptation note and the identifier. It does not run over `evidence_limitations`, because naming the
source file the evidence concentrates in is exactly what a limitation is for, and some accounts'
handles are their file name. Account handles remain forbidden in limitations.

Three proposals were reworded during this lane's own audit because they asserted an effect rather
than describing an arrangement: two said a device created urgency or supplied the audience's
trust, one warned against manufacturing urgency. The validator now refuses that wording outright.
That refusal is a bounded lint over the phrasings this work actually produced, not a semantic
judge. A sufficiently indirect effect claim will pass it, which is one of the things a human
reviewer is reading for.

## 9. Decisions required before any template integration

Nothing downstream should move until these are answered. Each one changes what a later
content-generation-logic task would be allowed to build.

1. **Per family, adopt / hold / reject.** Eight decisions, not one. The families differ sharply in
   evidence quality: `visual-treatment` and `native-format` rest heavily on Pinterest and short
   video where transcripts are absent, while `hook` and `structure` rest on text where the capture
   is most complete.
2. **Storage migration: go or no go.** See `storage-boundary-recommendation.md`. Until this is
   answered, the tracked raw bodies stay where they are and non-corpus lanes must not read them.
3. **Do third-party entries ever count toward support?** 13 entries in the corpus are reposts of
   someone else's post. Today they are cited, declared, and excluded from the creator count. The
   alternative is to exclude them from proposals entirely.
4. **Do bounded-window creators count toward replication?** Twelve accounts captured 4 to 29 of a
   30-item target. An arrangement seen in 4 of 4 reachable posts is a different kind of evidence
   from one seen in 4 of 30.
5. **Is 69 the right granularity to review?** The alternative is to cut to the strongest two or
   three per family (roughly 20 proposals) and discard the rest, at the cost of losing coverage of
   the thinner families.
6. **What clears the bar for a template?** This lane used a four-entry floor and more than one
   creator file. A reviewed template ledger may want a higher bar, a baseline requirement, or a
   platform-specific one.

## 10. What this lane deliberately did not do

- It did not modify the creator-content Markdown or its index.
- It did not perform new creator research or browser collection.
- It did not write `data/patterns/**`, `config/**`, the reviewed hook-template ledger, the Studio
  UI, generation prompts, approval policy, publishing, or scheduling.
- It did not move or delete the tracked raw corpus.
- It did not label anything approved, reviewed, best, a winner, proven viral, or generation-ready.
- It did not make any proposal available to Content generation.
