# Evidence: Venture editor dispatch, live before and after (2026-09-04)

Rule-7 sample for Lane-A item 1: the Venture-specific configured drafting path now runs its selected
editor rather than bypassing the normal editor dispatch.

## Bounded live canary

The canary ran once in the isolated `feat/venture-editor` checkout, using the subscription-authenticated
Codex engine. It created `content/venture-editor-live-canary-20260904/` only. It did not call a
delivery or publish path: both queue rows remain `pending`.

This is a representative, non-sensitive Venture input, rather than a claim about a live customer or
market result. The exact request and the retained raw model trace are in that folder's
`canary-input.json` and `canary-model-output.log`.

| Stage | Actual content |
| --- | --- |
| Approved input / untreated control | Before adding another tool, make one repeated decision easier to see. That is the smaller first step. |
| Live Venture drafting result, before the editor | Before adding another tool, make one repeated decision easier to see. |
| Live Venture editor result, persisted treated derivative | Adding another tool before you can see the repeated decision it is meant to help with can make work noisier. |

The raw model trace preserves the two JSON responses in order. The persisted treated derivative has
`editor_pass: venture-social-v1`, has no `source_lines`, and is still pending review.

## Why this closes the delivery gate

This is not the disposable browser fixture: `canary-result.json` records `engineExecution: "live"`.
The selected engine performed both the Venture drafting and the editor pass. The editor's output is
the body in `derivatives/treated-Ymx1ZXNreQ-bm9uZQ-c2hvcnRlcg.md`; no auto-publication capability is
part of `generateConfiguredContent`.
