# SLICE-5F: record the experiment lineage into the bets ledger at publish

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`appendBetPlacement` (`src/publish/queue.ts`) writes an experiment marker into the `briefs/bets.md`
Placed-log line it already builds, read deterministically from the derivative frontmatter it is
already handed: when `fm.experiment_id` is present, the line gains
` | experiment: <experiment_id>`, and — when `fm.experiment_recommendation_id` is also present —
` | recommendation: <experiment_recommendation_id>` immediately after it. When `fm.experiment_id`
is absent, NO experiment/recommendation segment is written and the Placed-log line is byte-for-byte
identical to today's.

This closes the first, currently-broken link in the experiment measure/confirm chain. The configured
Content path (`generateConfiguredContent`) already stamps `experiment_id`,
`experiment_recommendation_id`, `experiment_plan_decision_digest`, and `experiment_variables` onto
each experiment derivative's frontmatter (`configuredExperimentFrontmatter`, `src/review/jobs.ts:682`).
But `/publish`'s bets recorder reads none of it — it only harvests the legacy
`from_brief`/`directives_applied` fields — so a published experiment post never lands in the
feedback-loop memory (`briefs/bets.md`) *as an experiment*. This slice makes that lineage persist
into the Placed log the exact same way `spin`, `exploration`, `cadence`, and `cta` markers already do.

It is deliberately the RECORD port only. Grading/confirming the experiment (teaching `tag-source.ts`
to stamp a `posts.*` column and `grade-bets.ts` to key on it) is a SEPARATE downstream slice and is
out of scope here — do not touch those files.

## Difficulty

easy — two optional string segments assembled from frontmatter fields already in hand, concatenated
into the existing Placed-log `line` template exactly like the `spin`/`exploration`/`cadence`/`cta`
markers beside them. No model call, no new config, no new parameter, no behavior change to what
publishes or when.

## Depends on

None. `appendBetPlacement` already receives `fm` (the derivative frontmatter) from every publish
channel (`typefully.ts:449`, `tiktok.ts:209`, `substack.ts:254`, `youtube.ts:166`, `cards.ts:281`,
`paste-files.ts:39`, `studio-scheduling.ts:370`), so `fm.experiment_id` is available wherever an
experiment derivative is published. The configured stamp (5-series, on `main`) already writes those
fields; this slice only reads them.

## Owned files

Parallel-safe: no — single lane. One function edit plus its test.

### Lane A — write the marker and prove it

- `src/publish/queue.ts`
- `src/publish/queue.test.ts`

## Do not touch

- `src/review/jobs.ts` / `configuredExperimentFrontmatter` — the stamp is upstream and already
  correct; this slice only reads what it writes. Do not change the stamped field names or values.
- `src/db/tag-source.ts`, `src/strategy/grade-bets.ts`, `src/strategy/*` — the read-back /
  grading half is a separate downstream slice, explicitly out of scope.
- The existing `from_brief`, `directives`, `spin`, `control-run`, `exploration`,
  `outreach-message`, `cta`, `cadence` markers — leave their values, wording, and relative order
  intact; add the experiment segment alongside them, do not reorder them.
- The quoted body `prefix` — the experiment segment must sit BEFORE it in the line, like every
  other marker (the downstream end-anchored quote regex in `tag-source.ts` depends on markers
  preceding the quoted tail).

## Cited headings

none

## Acceptance

- [ ] When `fm.experiment_id` is present, the Placed-log line `appendBetPlacement` writes contains
      ` | experiment: <experiment_id>` (the exact string value of `fm.experiment_id`), placed before
      the quoted body prefix, alongside the existing markers.
- [ ] When BOTH `fm.experiment_id` and `fm.experiment_recommendation_id` are present, the line also
      contains ` | recommendation: <experiment_recommendation_id>` immediately after the experiment
      segment. When `experiment_recommendation_id` is absent but `experiment_id` is present, only the
      experiment segment is written (no dangling recommendation segment).
- [ ] When `fm.experiment_id` is absent, NO experiment or recommendation segment is written, and the
      Placed-log line is byte-for-byte identical to today's output for the same inputs.
- [ ] The change is additive and reads only frontmatter already passed in `fm`: no new function
      parameter, no model call, no new config, no change to what publishes or to any other marker.
- [ ] `src/publish/queue.test.ts` gains coverage proving: (a) an `fm` carrying `experiment_id` +
      `experiment_recommendation_id` yields a line with both segments before the quoted prefix;
      (b) an `fm` carrying `experiment_id` only yields the experiment segment and no recommendation
      segment; (c) an `fm` with no experiment fields yields a line byte-identical to the pre-change
      baseline (assert against the exact expected line, mirroring the existing cta/cadence marker
      tests in that file).

## Verify

Focused, from the repo root:

```
node --import tsx --test src/publish/queue.test.ts
```

Then type-check:

```
npx tsc --noEmit
```

## Observable result

Publish an experiment derivative (frontmatter carries `experiment_id: "experiment:opening"`,
`experiment_recommendation_id: "signals:opening"`). The new `briefs/bets.md` Placed-log row reads
`- placed <ts> [folder/id] <platform> → <ref> | experiment: experiment:opening | recommendation:
signals:opening | "<body prefix>"`. Publish a non-experiment derivative: the Placed-log row is
exactly as it is today, with no experiment/recommendation segment.

## Risk

low — audit required: no. An additive Placed-log marker read from existing frontmatter, mirroring
the `cta`/`cadence` markers (which shipped as Rule-7 self-vet merges) line-for-line. It changes no
composed prose, no publish behavior, and no other marker; the absent path is byte-identical. Rule-7
self-vet merge, not a hold. Coordinator self-verifies the diff against this packet and runs the full
closeout gate before merging; cross-family audit is optional, not required, at this risk level.

## Families

- Builder: Claude (strong tier) — single lane.
- Auditor: not required (low risk). Coordinator self-verifies the diff vs. this packet.

## Closeout

Repo-wide gate, run UNSANDBOXED (the sandbox produces phantom venture failures):

```
npm run check
```

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths: `src/publish/queue.ts` (+13/-1), `src/publish/queue.test.ts` (+85/-0)
- Outcome: `appendBetPlacement` gains two optional segments assembled from `fm` already in hand —
  `const experiment = fm.experiment_id ? \` | experiment: ${String(fm.experiment_id)}\` : ""` and a
  `recommendation` segment guarded on `fm.experiment_id && fm.experiment_recommendation_id` so it
  never dangles — concatenated into the existing `line` template between `${cadence}` and
  `${prefix}` (`queue.ts:315-322`, line at `:327`). Reads only frontmatter; no new parameter, no
  model call, no config, no publish-behavior change, no other marker reordered. `experiment_id`
  absent → neither segment, line byte-identical.
- Checks run and results: `node --import tsx --test src/publish/queue.test.ts` → 35/35 (4 new
  subtests: both-segments-before-prefix, experiment-only, recommendation-without-experiment writes
  neither, no-fields byte-identical baseline). `npx tsc --noEmit` → exit 0.
- Evidence locations: marker `src/publish/queue.ts:315-322,327`; tests
  `src/publish/queue.test.ts` `describe("appendBetPlacement: experiment-lineage marker")` (same
  `CONTENT_AGENTS_TEST_BETS_PATH` isolation as the cta/cadence blocks).
- Unresolved: none.

## Closeout result

**ACCEPTED — merged to local `main`** (2026-09-05). Coordinator-verified the full `queue.ts` diff
against this packet: the experiment/recommendation segments are additive, read only `fm`, sit before
the quoted prefix (preserving tag-source's end-anchored regex), the recommendation is guarded on
`experiment_id` so it never dangles, and no other marker was reordered or altered. Test block covers
all four acceptance cases, including an exact byte-identical baseline (only the ISO timestamp
stripped). Metadata/measurement-only, no composed-prose change → Rule-7 self-vet merge, no hold, no
cross-family audit required. Closeout gate `npm run check` UNSANDBOXED: **exit 0, 4185 pass / 485
suites / 0 fail / 0 skip** (+4 tests / +1 suite vs. 5e's 4181/484 — exactly the new marker block).
Grading/confirm (tag-source column + grade-bets keying on the recorded experiment) remains a
separate downstream slice, out of scope here.
