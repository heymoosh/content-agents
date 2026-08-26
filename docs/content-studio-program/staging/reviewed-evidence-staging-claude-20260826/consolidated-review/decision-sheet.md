# Decision sheet: consolidated evidence review

For one morning sitting. Fill in the blank fields below; leave anything you are not answering now
blank.

**Null rule (stated once, applies to every blank field on this sheet):** a blank or `null` answer
means "not answered now." It never means false, excluded, or reviewed.

Nothing on this sheet is reviewed metadata or a canonical write. Every row in all three lanes stays
`pending` or `blocked` until you answer, and this sheet's answers still route through
`pattern-reviewed-metadata-input`, not straight to a canonical `data/patterns/**` record.

---

## Decision 1: approve, narrow, or hold each lane's proposed slate

Each lane's proposed recommend/hold/research-further split is a staging proposal, not a reviewed
disposition. Approving it here only lets that slice proceed as input to the next reviewed-metadata
step; it does not re-litigate individual accounts' labels unless you say so.

| Lane | Proposed split (recommend / hold / research further) | Your choice (approve / narrow / hold) | Notes |
| --- | --- | --- | --- |
| Text/community (31 accounts) | 14 / 6 / 11 | ______ | ______ |
| Professional/publishing (14 accounts) | 11 / 0 / 3 | ______ | ______ |
| Visual/video (20 accounts) | 5 / 2 / 13 | ______ | ______ |

If "narrow," name which accounts to exclude from this pass: ______

---

## Decision 2: open niche, broad, format, community, creator, and Threads pool questions

These are carried verbatim (summarized where noted) from each lane's decision packet. Answer or
defer each one.

### Text/community

1. Niche pool: proposed labels are ADHD/neurodiversity, civic-democracy/civic-tech, AI-building,
   product-thinking, solopreneur/building-solopreneur, general-viral. Split this slice into those
   niche pools now, or hold until the full 65-account niche pool is decided together?
   Answer: ______
2. Broad-platform pool: treat the 10 Reddit accounts (and Hacker News) as *community* evidence,
   never pooled across platforms, distinct from the other 20 single-author accounts? Answer: ______
3. Format pool: use the 147 real per-record format notes now, or wait for full per-record corpus
   access for the other 207 records? Answer: ______

### Professional/publishing

1. Which accounts, if any, should enter the niche pool after identity, topic, and evidence review?
   Answer: ______
2. Which accounts, if any, should enter the broad-platform pool within their own platform's
   measurement context (LinkedIn, Substack, Substack Notes, and Threads do not pool across
   platforms)? Answer: ______
3. Which records, formats, and medium labels are complete enough for a format pool? Answer: ______
4. Should the proposed 11 recommend / 3 research-further split be approved, narrowed, expanded, or
   held? Answer: ______
5. Community/creator question: none named separately for this lane (all 14 accounts are
   single-author, unlike text-community's 11 aggregator accounts). No answer needed here.
6. Threads pool question: for the 3 blocked Threads accounts, what further research (if any)
   should attempt to resolve the unknown topic/focus/format, and by what means? Answer: ______

### Visual/video

No pool-choice questions were raised in this lane's decision packet; it requested no immediate
decision. If you want niche/broad/format pool review to start here too, state that: ______

---

## Decision 3: later exclusive-steward resolution from canonical local data

Decide whether a later, exclusive data steward may resolve these three gaps from canonical
`data/patterns/**` records (none of the three lanes could do this within their leases):

1. Stable account IDs for all 65 accounts (currently `unconfirmed`/`null` everywhere).
   Answer: ______
2. The `accountId` cross-reference gap on evidence rows (all 354 text-community rows carry "account
   reference is unmapped or ambiguous"; visual-video's 75 rows resolve this already via
   `sourceId`/`postId`; professional-publishing's rows carry `platform|handle` as `accountId`).
   Answer: ______
3. The 12 text-community baseline rows' withheld `numerator`/`denominator`/`settledSampleDate`.
   Answer: ______

---

## Decision 4: mark each lane ready, or request a bounded correction

| Lane | Ready to proceed to `pattern-reviewed-metadata-input`? | If not, describe the bounded correction pass requested |
| --- | --- | --- |
| Text/community | ______ | ______ |
| Professional/publishing | ______ | ______ |
| Visual/video | ______ | ______ |

---

Reviewer: ______  Date: ______
