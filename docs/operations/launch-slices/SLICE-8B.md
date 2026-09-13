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
- [x] The first due post is confirmed live before this slice closes.

## Verify

Classification and applicable gate: meaningful live publishing behavior. No repository-wide code
gate applies to the unchanged runtime candidate. Verify outcomes from Studio, the slot ledger, and
a read-only provider query. The original four-row Studio batch remained the only batch action.
Muxin later authorized moving the exact Bluesky provider object forward for immediate proof. Its
first accelerated attempt failed on Postiz's own image self-fetch, and the one bounded retry used a
container-reachable URL for the same uploaded PNG; the stable provider id never changed.

## Observable result

The four card rows show scheduled provider IDs and planned times. The accelerated Bluesky row is
live at
`https://bsky.app/profile/did:plc:brjgstzt7gooqouz5kdci6n7/post/3mvekg4rsvd2h`;
Postiz and Bluesky agree on the provider object, author, approved caption, image, and CTA reply.

## Risk

high - audit required: no standalone audit because this uses the already accepted SLICE-8A runtime
without code changes, but outcome triangulation is mandatory.
Review boundary: exact four-row batch.
Review scope/budget: one Schedule batch; one owner-authorized accelerated provider reschedule and
one bounded retry after the first accelerated publish failed deterministically. Read-only status
checks afterward.
Prior accepted evidence: SLICE-8A commit `d896cef` and its Grok audit remain valid because runtime
code is unchanged.
On provider outage: retain the fail-closed status and wait for a named retry condition.

## Families

- Builder: coordinator only; live provider calls cannot be delegated.
- Auditor: not required for unchanged accepted runtime; live outcome is independently read back.

## Closeout

**PASS** 2026-09-12. The four-row Studio batch is retained, the X row stayed pending, and the first
approved media row is publicly live. Postiz id `cmtz395zs0001mu8e0p5tbik3` reports `published` at
2026-09-13T02:30:00Z and the public Bluesky thread has the exact approved caption, one image, and
the source CTA reply. The failed accelerated attempt and retry are retained in the publishing
journal. The unrelated self-fetch risk for the three later image posts is recorded in the master.

## Usage budget and handoff

- Each extra lane: none; live mutation and its shared ledger serialize this work.
- Assignment: coordinator only.
- Evidence return: command exits, exact row IDs/fingerprints, Studio state, ledger/provider IDs.
- Capability boundary: accepted after live proof; the separate self-fetch risk is master item 6.
