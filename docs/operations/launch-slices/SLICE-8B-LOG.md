# SLICE-8B history

This file holds completed session records moved out of the active packet. New sessions do not read
it.

## Accepted — 2026-09-12

- Provider identity: Postiz `cmtz395zs0001mu8e0p5tbik3`, Bluesky account
  `muxin-li.bsky.social`.
- Accelerated attempt: 2026-09-13T02:15:00Z, failed because the Postiz container resolved
  `postiz-threads.meta:4443` to dead loopback while fetching its own uploaded image.
- Bounded retry: 2026-09-13T02:30:00Z, same stable provider id and same PNG through the verified
  internal fetch path; Postiz reported `published`.
- Public proof:
  `https://bsky.app/profile/did:plc:brjgstzt7gooqouz5kdci6n7/post/3mvekg4rsvd2h`.
  Bluesky's public API returned the exact approved caption, one image, and the source CTA reply.
- Local proof: the slot ledger and publishing-status journal moved from 02:15Z to 02:30Z and the
  final status event is `live` with the public URL.

## RESULT BLOCK — scheduled handoff

- Changed paths: the four target queue statuses, the folder publish log, and the Human Inference
  Placed log; outside-repository approval and publishing-status journals plus scheduler ledger.
- Outcome: one confirmed Studio batch scheduled all four exactly once. LinkedIn is 2026-09-20
  08:30 PT (`cmtz395vg0000mu8e0v29dgxm`), Bluesky was initially 2026-09-13 18:30 PT
  (`cmtz395zs0001mu8e0p5tbik3`), Instagram is 2026-09-15 12:00 PT
  (`cmtz3962y0003mu8ex9oq82ic`), Facebook is 2026-09-15 12:00 PT
  (`cmtz3965t0004mu8e5641baj5`). The X row stayed pending and unscheduled.
- Checks run and results: four dry runs exit 0; four adoption runs exit 0; Studio displayed four
  scheduled results; exact publishing-status events and four scheduler claims agreed; Postiz
  calendar displayed the Bluesky caption at its original due time.
- Evidence locations: Studio Publishing room, Postiz Calendar, folder `publish-log.md`, external
  `publishing-status.jsonl` events 67-74, and the external scheduler ledger.
- Delivery state at handoff: scheduled and read back; waiting for first-live proof.
- Usage at handoff: one live four-row Studio batch; no retry; local verification under one second.

## Stopped — 2026-09-12

Blocker: the earliest scheduled post was not due until 2026-09-13 18:30 PT, so live delivery could
not yet be truthfully accepted.

Verified: exactly four approved rows were provenance-adopted and scheduled once; Studio, the
external scheduler ledger, publishing-status events 67-74, folder publish log, Placed log, and
Postiz calendar readback agreed on provider ids and times. The X row remained pending.

Retained work: uncommitted operational state in
`content/2026-09-02-the-world-s-broken-what-do-we-do/review-queue.md`, that folder's
`publish-log.md`, and `briefs/human-inference/bets.md`; external approval, publishing-status, and
scheduler journals retained provider evidence.

Next action at that stop: after the due time, read Postiz id `cmtz395zs0001mu8e0p5tbik3` and the
public Bluesky result; close only if both showed live.
