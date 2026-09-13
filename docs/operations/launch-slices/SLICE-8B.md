# SLICE-8B: Reconcile, schedule, and live-verify the four approved quote cards

Protocol: `AGENTS.md` -> `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md`. Do not load the repository for context.
Do not commit, stage, push, checkout or stash.

## Goal

The four Muxin-approved rows `quote-card-1-linkedin`, `quote-card-1-bluesky`,
`quote-card-1-instagram`, and `quote-card-1-facebook` have verifiable approval provenance,
are scheduled exactly once through Studio, and the first due post is later confirmed live.

## Difficulty

easy but externally consequential: reconciliation is local; Schedule makes four provider requests;
live proof cannot finish before the first due slot.

## Depends on

SLICE-8A accepted.

Delivery batch: SLICE-8B, SLICE-8C, and SLICE-8D are owner-authorized by the 2026-09-12 Codex
handoff. This slice is the operational deliverable. Stop after four schedule results are verified
and record a frozen wait handoff until the first due post can be checked live.
Owner checkpoint: Muxin approved all four rows in Studio and supplied action-time confirmation
immediately before the completed batch. No worker may make provider calls.

## Owned files

Parallel-safe: yes. This coordinator-only operational lane does not edit the code paths owned by
SLICE-8C or SLICE-8D. Schedule dispatch is serialized across its own shared ledger and provider
state; only one batch action is permitted.

### Lane A - coordinator-only operational proof

- `content/2026-09-02-the-world-s-broken-what-do-we-do/review-queue.md`
- the configured external scheduler ledger (provider-created evidence only; never hand-edit)
- configured publishing-status and approval-provenance journals (read or append only through the
  repository's scripts/UI)

## Do not touch

- `.env`, provider secrets, any non-target queue row, and the pending X card row.
- No direct provider mutation outside Studio's Schedule path.

## Cited headings

none

## Acceptance

- [x] A dry run showed all four approved rows were legacy and printed stable fingerprints.
- [x] The coordinator reviewed the four current captions and rendered image.
- [x] Expected-fingerprint reconciliation adopted exactly the four approved rows.
- [x] After action-time confirmation, one Studio batch action scheduled exactly those four rows.
- [x] Studio status, the slot ledger, publish log, Placed log, and Postiz calendar readback agree.
- [ ] The first due post is confirmed live before this slice closes.

## Verify

Classification and applicable gate: meaningful live publishing behavior. No repository-wide code
gate applies to the unchanged runtime candidate. Verify outcomes from Studio, the slot ledger, and
a read-only provider query. Use one scheduling batch and no retry unless the first attempt returns a
safe no-provider-request refusal.

## Observable result

The four card rows show scheduled provider IDs and planned times; after the first due time, its
provider state and public result show that it is live.

## Risk

high - audit required: no standalone audit because this uses the already accepted SLICE-8A runtime
without code changes, but outcome triangulation is mandatory.
Review boundary: exact four-row batch.
Review scope/budget: one Schedule batch, at most one retry only after a proven no-provider-request
refusal; read-only status checks afterward.
Prior accepted evidence: SLICE-8A commit `d896cef` and its Grok audit remain valid because runtime
code is unchanged.
On provider outage: retain the fail-closed status and wait for a named retry condition.

## Families

- Builder: coordinator only; live provider calls cannot be delegated.
- Auditor: not required for unchanged accepted runtime; live outcome is independently read back.

## Closeout

Preflight: exact four selected rows, owner approval present, reconciled fingerprints, accepted
runtime commit, and action-time confirmation.
Gate cost: one live Schedule batch; local runtime unknown until execution.
Leftover: the first due Bluesky post must be confirmed live after 2026-09-13 18:30 PT.

## RESULT BLOCK

- Changed paths: the four target queue statuses, the folder publish log, and the Human Inference
  Placed log; outside-repository approval and publishing-status journals plus scheduler ledger.
- Outcome: one confirmed Studio batch scheduled all four exactly once. LinkedIn is 2026-09-20
  08:30 PT (`cmtz395vg0000mu8e0v29dgxm`), Bluesky 2026-09-13 18:30 PT
  (`cmtz395zs0001mu8e0p5tbik3`), Instagram 2026-09-15 12:00 PT
  (`cmtz3962y0003mu8ex9oq82ic`), Facebook 2026-09-15 12:00 PT
  (`cmtz3965t0004mu8e5641baj5`). The X row stayed pending and unscheduled.
- Checks run and results: four dry runs exit 0; four adoption runs exit 0; Studio displayed four
  scheduled results; exact publishing-status events and four scheduler claims agree; Postiz calendar
  refreshed from 101 to 102 visible current-week items and displayed the Bluesky caption at its due
  time.
- Evidence locations: Studio Publishing room, Postiz Calendar, folder `publish-log.md`, external
  `publishing-status.jsonl` events 67-74, and external scheduler ledger's final four rows.
- Unresolved: confirm the first due Bluesky post live after 2026-09-13 18:30 PT.
- Delivery state and next action: scheduled and read back; frozen wait until the Bluesky due time.
- Usage: one live four-row Studio batch; no retry; local verification commands under one second.

## Usage budget and handoff

- Each extra lane: none; live mutation and its shared ledger serialize this work.
- Assignment: coordinator only.
- Evidence return: command exits, exact row IDs/fingerprints, Studio state, ledger/provider IDs.
- Capability boundary: stop in a frozen wait state after scheduling until the earliest due post.

## Stopped

Blocker: the earliest scheduled post is not due until 2026-09-13 18:30 PT, so live delivery cannot
yet be truthfully accepted.

Verified: exactly four approved rows were provenance-adopted and scheduled once; Studio, the
external scheduler ledger, publishing-status events 67-74, folder publish log, Placed log, and
Postiz calendar readback agree on their provider ids and times. The X row remains pending.

Retained work: uncommitted operational state in
`content/2026-09-02-the-world-s-broken-what-do-we-do/review-queue.md`, that folder's
`publish-log.md`, and `briefs/human-inference/bets.md`; this packet is the durable handoff. External
approval, publishing-status, and scheduler journals retain the provider evidence.

Next action: after the due time, read Postiz id `cmtz395zs0001mu8e0p5tbik3` and the public Bluesky
result without mutation; if both show live, mark the last acceptance item and close SLICE-8B.
