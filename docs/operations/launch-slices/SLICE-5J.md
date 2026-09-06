# SLICE-5J: Typefully is the backup route for Content-page image rows when Postiz cannot take them

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

A Content-page configured-media row that holds a rendered **image** and targets a Typefully
platform (`x`, `linkedin`, `bluesky`) must schedule a native Typefully image draft when Postiz
cannot take it — instead of dead-ending at manual ready-to-paste.

Typefully was never removed. It is still the live route for text rows (`publishText`) and for
`/atomize` quote-card rows (`publishCards`, native image drafts since 2026-07-08). What is missing
is a wire: configured-media rows are a newer row kind, and the dispatch table at the bottom of
`scheduleApproved` has no `media` case, so `legacyProvider` returns `{ provider: "manual" }` for
them (`src/review/studio-scheduling.ts`, the `kind === "media"` branches) and
`scheduleApproved` refuses any non-Postiz provider for a media row. The Content page is the only
surface Muxin publishes from, and Postiz rate-limits at 90 creates/hour instance-wide, so today a
throttled or unconfigured Postiz means no scheduled draft at all.

**Owner decision (Muxin, 2026-09-05): "Content page should be able to also use Typefully if
Postiz doesn't work."** Postiz stays the first choice. Typefully is the backup, not a second
default.

## Difficulty

hard — the change is small but it decides when an approved row is allowed to take a second
delivery route, and a wrong trigger can double-post.

## Depends on

none. SLICE-5I is running in parallel and owns a disjoint file set
(`src/review/configured-media.ts`, `src/review/configured-media-runtime.ts`, `src/review/jobs.ts`);
5I's own "Do not touch" list names the two files this slice owns.

## Owned files

Parallel-safe: yes, against SLICE-5I only — the two lanes share no file.

### Lane A — media-row fallback route

- `src/review/studio-scheduling.ts`
- `src/publish/cards.ts` (row-selection and per-row publish only)
- the existing test files covering the above
- new test files alongside them

## Do not touch

- `src/review/configured-media.ts`, `src/review/configured-media-runtime.ts`, `src/review/jobs.ts`
  — SLICE-5I owns these and is running now.
- `src/publish/typefully.ts` — the Typefully transport itself is working and stays as it is.
- `config/platforms.yaml`, `remotion/` — no cadence, dimension or composition change.
- `docs/content-studio-master-status.md` — the coordinator updates it.

## Cited headings

none

## Acceptance

Write the trigger conditions as tests. The exact list:

- [ ] **Falls back** when Postiz is not configured at all (no base URL / API key), for an image
      media row whose platform is `x`, `linkedin` or `bluesky`: the row schedules a native
      Typefully image draft carrying the row's rendered asset and its `derivatives/<id>.md`
      caption, and the result names Typefully.
- [ ] **Falls back** when Postiz capability discovery returns an authoritative *unsupported* result
      for that destination and media shape.
- [ ] **Falls back** when Postiz refuses the create with an unambiguous "nothing was created"
      outcome — specifically a rate-limit rejection (Postiz's 90 creates/hour instance-wide cap).
- [ ] **Does NOT fall back** on an ambiguous create failure, where Postiz may or may not have
      created the draft. That row still returns its `scheduleError`. Auto-retrying elsewhere after
      a possibly-successful create is how a post ships twice; this line is the point of the slice.
- [ ] **Does NOT fall back** for a media row whose format is video (the animated card `.mp4`).
      Typefully's card route is image-only. Those rows keep today's manual ready-to-paste path.
- [ ] **Does NOT fall back** for a destination Typefully cannot post to (instagram, threads,
      tiktok, facebook, mastodon, youtube, and anything else outside `x | linkedin | bluesky`).
      Those rows keep today's manual ready-to-paste path.
- [ ] Postiz still wins whenever it can take the row. No test passes because the code stopped
      trying Postiz first.
- [ ] A row that fell back is scheduled exactly **once**. No path can produce both a Postiz post
      and a Typefully draft for one row.
- [ ] The fallback draft goes through the same shared slot scheduler and reuse guard the card path
      already uses, so it cannot exceed a platform's per-day slot cap or bypass reuse rules.
- [ ] `/atomize` quote-card rows (`quote-card:<target>` platform) keep behaving exactly as they do
      today. Widening `publishCards`' row selection must not change which rows it already picks up,
      nor how it publishes them.
- [ ] Rows still only reach any route after Muxin's `approve` in `review-queue.md`. Nothing in the
      diff loosens that. A scheduled Typefully draft is a draft, never an instant post.
- [ ] New tests assert the observable outcome — which provider the row was scheduled through, and
      the `scheduleError` on the rows that correctly refuse to fall back — not that a function was
      called with a particular argument.

## Intended approach

`publishCards` already does the per-row work this needs: it takes a row with a rendered image asset
and a `derivatives/<id>.md` caption, claims a slot, checks the reuse guard, and creates a native
Typefully image draft for one target platform. The only thing standing between it and a
configured-media row is its selection rule (`isQuoteCardRow(r.platform)`) and the fact that a
configured-media row carries its target platform directly rather than as `quote-card:<target>`.

So: widen the row selection to also admit an approved image media row, resolve its target from the
row's own platform, and give `scheduleApproved`'s `media` branch a Typefully fallback that fires
only under the three conditions above. Keep the Postiz-first order intact.

Deviate if the existing runtime makes this wrong, but say why in the RESULT BLOCK.

## Verify

Run the focused tests for the changed path, then report the exact command and its exit code:

```
npm test -- src/review/studio-scheduling.test.ts src/publish/cards.test.ts
```

Adjust the paths to the test files that actually exist or that you add. Do not run the
repository-wide gate — the coordinator runs it once, last, unsandboxed.

## Observable result

With Postiz unreachable, an approved Content-page LinkedIn row holding a rendered quote card
schedules a Typefully image draft rather than falling through to ready-to-paste.

## Risk

medium — audit required: yes. It adds a second delivery route for an approved row. The failure
mode that matters is a double-post, so the ambiguous-create-failure case must stay non-falling-back.

## Families

- Builder: Claude, strong tier — the correctness lives in the trigger conditions, not the wiring.
- Auditor: Codex / GPT, strong tier — different family, receives the diff, the changed-file list
  and the focused check output only. Ask it specifically whether any path can schedule one row
  twice.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice closes.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
