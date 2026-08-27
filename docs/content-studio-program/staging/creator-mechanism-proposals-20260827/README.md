# Creator mechanism proposals: staging package, 2026-08-27

An isolated staging package produced by the `pattern-creator-corpus-to-mechanism-proposals`
lane. It holds a body-free coverage account of the merged creator-content Markdown, a body-free
set of mechanism proposals derived from it, a validation record, a compact human review document,
and a storage-boundary recommendation.

Nothing here is reviewed, approved, best, a winner, proven, or generation-ready. Nothing here is
readable by Content generation, the Studio UI, the reviewed hook-template ledger, or canonical
pattern data. Every proposal carries `review_status: pending` and `originality_status: pending`
and stays that way until Muxin reviews the set.

## Files

| File | What it is | Written by |
|---|---|---|
| `creator-corpus-inventory.json` | Body-free inventory of every parsed entry, field variant, coverage number, capture window and anomaly | `npm run patterns:creator-corpus -- report` |
| `creator-corpus-coverage.md` | The same account in readable form | `npm run patterns:creator-corpus -- report` |
| `mechanism-proposals.jsonl` | 69 body-free mechanism proposals, one per line, sorted by id | authored, then validated |
| `mechanism-proposal-validation.json` | The validation record for the proposals above | `npm run patterns:creator-corpus -- validate` |
| `review-packet.md` | The compact document Muxin reads | authored |
| `storage-boundary-recommendation.md` | What to do about the tracked raw creator bodies | authored |

## How the two halves differ

The inventory and coverage report are **derived**: code reads the corpus and computes them, and
regenerating them on an unchanged corpus produces identical bytes.

The proposals are **authored**, then checked. Rule-deriving mechanism prose from 1,706 analysis
fields would produce noise, so a mechanism is written by hand, the way the eight rows in
`config/patterns/hook-template-ledger.jsonl` were. What is deterministic is the check:
`validate` resolves every source reference against a real parsed entry, recomputes every support
number from those entries, and refuses the file if a declared number, a replication claim, an
evidence status, a platform, a third-party attribution, a prohibited key, a claim word, or an
eight-word run of captured text does not hold up.

## Commands

```bash
npm run patterns:creator-corpus -- inventory   # summary to stdout
npm run patterns:creator-corpus -- report      # regenerate the inventory and coverage report
npm run patterns:creator-corpus -- validate    # acceptance check; non-zero on any finding
npm run patterns:creator-corpus -- storage     # tracked raw-body footprint, reports only
```

## Boundary

`docs/content-studio-program/creator-content/**` and its index are read-only inputs to this lane
and are not modified by it. Per `../../corpus-ui-reconciliation-20260827.md`, workers outside this
lane must not read those raw files, and no prompt, UI or generator may load them.
