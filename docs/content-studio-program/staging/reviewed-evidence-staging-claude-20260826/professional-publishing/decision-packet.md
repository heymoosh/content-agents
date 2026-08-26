# Reviewed-evidence staging: professional and publishing

## Scope and reconciliation

This is a body-free, noncanonical proposal for the exact 14 accounts and 70 local source
records in the corrected candidate slate's professional/publishing platforms: LinkedIn,
Substack, Substack Notes, and Threads. The account split is LinkedIn 4, Substack 5, Substack
Notes 2, Threads 3. The source-record split is LinkedIn 21, Substack 22, Substack Notes 12,
Threads 15.

The corrected slate's proposed dispositions are preserved as proposal text only: 11 recommend
and 3 research further. Intake disposition remains `pending` for every account. Source rows
remain `reviewStatus: pending` and `status: blocked`; the intake report and bridge report
therefore contain no ready rows (0 of 84 total rows ready, 84 blocked, 0 unmapped). No row is
reviewed, and no row is canonical.

No baseline rows are included. The corrected candidate slate records zero stored baseline rows
for all 14 of these accounts (`b: 0` on every LinkedIn, Substack, Substack Notes, and Threads
row); the 12 existing baseline artifacts in the local snapshot are all Reddit community rows and
are out of scope for this platform set. `baselineSamples` is an empty array; no baseline is
invented.

## Provenance and gaps

- Account identities, proposed dispositions, and local record counts come from
  `docs/content-studio-program/staging/corrected-candidate-account-slate-20260825/decision-packet.json`.
- Profile locators come from
  `docs/content-studio-program/staging/broad-pattern-research-20260825/professional-publishing/source-manifest.json`
  (the `source_kind: "profile"` entry for each of the 14 accounts).
- Source identifiers, locators, format labels, body-completeness flags, and post/collection
  dates come from the local corpus snapshot used for the local-evidence inventory
  (`data/patterns/corpus.jsonl`, read from outside this worktree for identifiers and non-body
  metadata only; no body, transcript, or analysis text was copied into this staging package).
  Per-account body-completeness triplets in this local snapshot match the corrected candidate
  slate's `body` field exactly for all 14 accounts (LinkedIn `[4,2,0]`/`[4,1,0]`/`[5,0,0]`/
  `[3,2,0]`; Substack `[4,0,0]`/`[3,1,0]`/`[4,0,0]`/`[6,0,0]`/`[3,1,0]`; Substack Notes
  `[6,0,0]`/`[2,4,0]`; Threads `[3,2,0]`/`[1,4,0]`/`[5,0,0]`), confirming the 70-record
  reconciliation before this package was built.
- The checked-in local-evidence inventory (`docs/content-studio-program/staging/local-evidence-inventory-20260825/`)
  confirms the platform totals; the runtime `data/patterns/*.jsonl` files are not present inside
  this worktree, so identifiers were read from the local corpus snapshot outside it and were not
  copied into the repository.

Known gaps remain explicit: stable account IDs, topics, focus, niche labels, audience snapshots,
pool memberships, and comparison universes are unreviewed or unknown for every account; source
metric snapshots and audience-size snapshots are unknown for every one of the 70 source rows;
and many local source bodies are incomplete (`bodyComplete: false`). A local source locator is
not proof of account leadership or cross-platform superiority.

### Threads evidence boundary (preserved, not reversed)

For the 3 Threads accounts (`threads|danidonovan`, `threads|rowancheung`, `threads|thedankoe`),
direct profile access during broad pattern research was blocked. The corrected broad-research
decision packet already reset those three rows' topics, focus, medium, and format labels to
`unknown`/`[]`/`not assessed`, after an earlier commit had reversed that correction and was
itself reverted. This staging package does not reintroduce topic, focus, or format labels for
Threads: all three account rows carry `topics: "unknown"`, `focus: "unknown"`, and
`format: "unknown"`, with a caveat naming the blocked-access boundary explicitly so it cannot be
silently re-inferred later. The 15 Threads source-evidence rows (local corpus records, a
separate evidence source from the blocked profile research) retain their local format labels
(`text-only`, `image`) and body-completeness flags, since those come from the local corpus
snapshot, not from the blocked profile research; this is not a reversal of the Threads profile
correction, only a distinct, independently-sourced local record.

For the other 11 accounts (LinkedIn, Substack, Substack Notes), broad-research profile access was
not blocked and returned partial evidence (creator identity, stated topics/focus, and in most
cases a lower-bound audience or follower figure). This staging package still leaves those
accounts' reviewed-schema fields (`topics`, `focus`, `audienceSnapshot`, etc.) as `unknown` at the
intake layer, because disposition is `pending` and no reviewer has confirmed them; the caveat on
each such row states that broad-research evidence exists but was not blocked, distinguishing it
from the Threads boundary.

## Pool-choice questions for Muxin

Keep the three dimensions independent when answering these questions:

1. Which accounts, if any, should enter the niche pool after identity, topic, and evidence review?
2. Which accounts, if any, should enter the broad-platform pool within their own platform's
   measurement context? LinkedIn, Substack, Substack Notes, and Threads metrics do not pool
   across platforms.
3. Which records, formats, and medium labels are sufficiently complete for a format pool? Do not
   infer a mechanism from an incomplete or unknown body.
4. Should the proposed 11/3 recommend/research-further dispositions be approved, narrowed,
   expanded, or held as a slate?
5. For the 3 blocked Threads accounts, what further research (if any) should attempt to resolve
   the unknown topic/focus/format, and by what means?

## Exact human decisions required

Muxin must explicitly:

- approve, narrow, expand, or hold the 14-account staging slate and its 11 recommend and 3
  research-further proposals;
- confirm each account's stable identity, topic/focus, niche label, audience snapshot, and
  evidence links where available;
- assign any niche, broad, or format membership with a reason, keeping the dimensions separate;
- confirm source locators, body-completeness flags, provenance, and any source-to-account
  mapping for the 70 local source records;
- confirm whether further research may attempt to resolve the 3 blocked Threads accounts, without
  reversing the existing correction in the interim; and
- only after that review, choose which rows may transition from pending/blocked to reviewed or
  remain blocked/unmapped.

Until those decisions are recorded, this package is staging only. It performs no ranking, pool
selection, generation, canonical ledger append, or publishing, and no row is reviewed or
canonical.
