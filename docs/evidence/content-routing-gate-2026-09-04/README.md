# Item 5a verification artifacts

These are synthetic, unpublished test fixtures, not production content or a live
editorial queue. The source text and example canonical URL exist solely for this
verification. The fixture lives under docs so it cannot enter the Content room.

- `attempt-1`: original successful behavior result and model outputs, plus the
  separately recorded failed isolation postcheck. Historical logs were copied by
  a legacy migration; those historical logs are deliberately not archived here.
- `attempt-2`: accepted terminal live retry. Behavior and isolation passed at
  `2026-09-05T05:12:03.850Z`; four pending variants, two model calls, one current
  job log, no publishing, no historical-log migration. The live budget is exhausted.
- `fixture`: exact source, saved request, routing, derivatives, media stages, and
  pending review queue from attempt 2.
- `harness`: historical snapshot of the corrected temporary harness. Its absolute
  `/private/tmp` paths describe this run; it is evidence, not a new canonical
  repository verification command. Do not run it blindly or reuse the exhausted
  run base. Future runs need their own scoped authorization and verification budget.
- `checked-source.sha256`: the four product files checked by the focused tests,
  full local gate, product audit, and accepted live canary.
- `product-audit.txt`, `harness-clearance.txt`: bounded cross-family verdicts.

The coordinator verified the clearance's pre-launch conditions: actual argv begins
`-a never exec`, exec-only flags follow, installed CLI help supports all flags,
isolated-HOME login status reports ChatGPT, and the launcher fake run proves the
legacy-log migration is isolated. An early-exit postcheck test preserves evidence
even when normal verification does not finish.

Full interpretation, audit-derived checklist, and known limitations:
[slice evidence](../../evidence-content-routing-gate-2026-09-04.md).
