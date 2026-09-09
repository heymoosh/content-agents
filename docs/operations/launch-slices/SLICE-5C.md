# SLICE-5C: port source triage into configured Content generation

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The configured Content generation path (`generateConfiguredContent` in `src/review/jobs.ts`) runs
the source-triage classification that today lives only in `/atomize` (`src/atomize/source-triage.ts`
— `frame-native` / `reflective` / `fiction-promo`) and records the resulting source class, plus the
case evidence the case gate reads, into each variant's provenance/frontmatter **before** any
derivative file or `review-queue.md` row is written.

The concrete leverage: slice 5b's skeleton and case gates already call `readSourceClass` and
`readCaseEvidence` in this path, but nothing in the Content path writes those facts, so today the
gates read the `undefined` default. After 5c they read real recorded triage facts and those facts
are stamped into each variant's provenance for a reviewer to see.

**Corrected scope (was over-promised in the first draft of this packet).** The skeleton and case
gates do NOT become live-firing in the Content path in this slice, and cannot: their firing
conditions are `spin===true && angle===platform` (skeleton) and `caseSkeleton===true` (case), and
the configured generation path has **no spin/angle/caseSkeleton computation** — spin is a
Claude-inline `/atomize` capability that is a separate, not-yet-ported item-5 slice. So no
configured candidate declares a beat, and the gate call sites correctly pass `undefined`. 5c's real,
achievable deliverable is therefore: **run triage, record the real `source_class`/`source_class_case`
into each variant's provenance, and pass the real values into the (intentionally dormant) gate calls
— so the spin slice only has to populate candidate spin/angle for the gates to enforce, without
re-wiring the source class.** Making the gates actually reject end to end, and the end-to-end
rejection test, belong to the spin slice (see Dependency note below).

Each room's scoped exception is honored: an origin with no source essay (Venture, Charles, fiction
promo) is classified or handled by its own exception, never forced into a class that demands
`source_lines` where a scoped exception legitimately provides none. Valid, origin-specific requests
keep everything items 5a and 5b already give them — the routing subset, exact untreated controls,
provenance/`source_lines`, the ported validate gates, and pending-review status — unchanged.

## Difficulty

hard — it wires another judgment step (source classification) into the live generation/provenance
seam of `jobs.ts`, and the per-room scoped exceptions must be mapped before editing so triage does
not stamp a tracing-demanding class onto an origin that legitimately has no source essay. The
value only lands if the recorded facts are the exact ones 5b's gates read, so the two slices'
frontmatter/record vocabulary must line up.

## Depends on

Item 5a (routing gate consumed by `generateConfiguredContent`) and item 5b (`validate` gates ported,
reading `readSourceClass`/`readCaseEvidence`) — both accepted and on `main`. P1 (single platform-limit
source) and P2 (editor registry) already landed. No open slice depends on this one being split.

Dependency note (discovered while building): the skeleton and case gates cannot fire in the
configured path until the **spin capability** (a separate item-5 slice) populates candidate
spin/angle/caseSkeleton. 5c records the source class the gates enforce against; the spin slice must
(a) populate those candidate fields and (b) add the end-to-end gate-rejection test that is not
reachable here. This slice leaves the wiring ready and dormant.

## Owned files

Parallel-safe: no — single lane. The work is one coupled change: run triage in the generation path
and record its class/case evidence into the same provenance the 5b gates read, before the same
function writes any derivative or review row. The write-ordering property (triage must classify and
record before the write, and the recorded facts must be the ones the gates consume) spans the call
site and the shared triage logic, so there is no path split for which the protocol's three safety
conditions hold. Run it as one worker.

### Lane A — port triage and make 5b's gates read real recorded facts

- `src/review/jobs.ts` — in `generateConfiguredContent`, classify the source via the triage logic
  and record the source class + case evidence into each variant's provenance/frontmatter before any
  `mkdirSync`/write/`appendRows`, so `readSourceClass`/`readCaseEvidence` (already called by 5b in
  this path) return the recorded values rather than defaults.
- The triage logic the path invokes: reuse `src/atomize/source-triage.ts`'s existing classifier if
  it is importable; otherwise extract the classification into a shared function that both `/atomize`
  and the Content path call. If `source-triage.ts` is modified, it may change **only** to expose a
  shared classifier — its external behavior and existing tests must stay green (regression).
- New/affected `node:test` files covering: triage runs in the Content path and stamps the class; the
  recorded class + case evidence are exactly what 5b's skeleton and case gates read (an end-to-end
  Content-path run where a source that should trip the skeleton or case gate now does, via the
  recorded facts — not only 5b's direct-helper shape); and a valid request per origin kind
  (extraction-first essay classified `frame-native`/`reflective`; Venture and Charles — no source
  essay — not forced into a tracing-demanding class; fiction-promo handled) passing while retaining
  5a routing, exact controls, provenance, the 5b validate gates, and pending review.

## Do not touch

- `src/strategy/route.ts`, `config/routing.yaml`, the 5a routing subset — do not re-implement or
  weaken routing.
- The 5b `validate` gates themselves (`src/atomize/validate.ts` `checkPlatformLimits`, the skeleton
  gate, the case gate). 5c **feeds** them real recorded facts; it does not change their thresholds
  or logic. If a gate's read helper must move, its behavior must stay identical and its tests green.
- The other six item-5 capabilities (pillar tagging, spin, scoring/soft gate, thread check,
  quote-card captions, brief directives). This slice is source triage only.
- `config/platforms.yaml`, `config/voice.yaml`, `config/pillars.yaml` as data — read them; do not
  edit their values.
- `docs/content-agents-backlog.md` — board writes go through `prose_kanban` only, never as text.
- `/atomize`'s runtime behavior — `source-triage.ts` may be refactored to expose a shared
  classifier, but the atomize path's observable output must not change.

## Cited headings

`none` — everything needed is in this packet, the protocol section, and the two design-spec
sections named under Observable result. Do not open the master document.

## Acceptance

- [ ] `generateConfiguredContent` runs source triage and records the source class (`frame-native` /
      `reflective` / `fiction-promo`) plus case evidence into each variant's provenance/frontmatter
      before writing any derivative or review row; a test proves the class is stamped.
- [ ] The recorded facts are exactly the values passed into 5b's skeleton and case gate calls in
      the Content path (same expression stamped into provenance and fed to the gate). A unit-level
      test proves the recorded fact drives each gate's verdict given a beat-carrying candidate. A
      generation test pins the intentional current dormancy: a studio essay recorded `reflective`
      (the class that WOULD exclude the beat) still generates and lands pending, because no
      configured candidate declares a beat until the spin capability is ported.
- [ ] Each origin kind is classified/handled correctly, proven per kind, including at least one
      origin with no source essay (Venture or Charles) that is **not** forced into a class demanding
      `source_lines` — the scoped exception is honored.
- [ ] A valid origin-specific request retains 5a routing, exact untreated controls,
      provenance/`source_lines`, the 5b validate gates, and pending-review status (no regression).
- [ ] `/atomize`'s existing `source-triage` behavior and tests remain green (no regression from any
      extraction/refactor).
- [ ] Focused/fake-model tests, cross-family audit, one bounded isolated canary, and the
      repository-wide gate all pass.

## Verify

Focused checks (worker runs; records exact file list in RESULT BLOCK). Repo runner is Node's
built-in `node:test` via `tsx`:

```
node --import tsx --test <the new/affected review-generation, validate, and source-triage test files>
```

Bounded canary — the deterministic in-path generation tests (studio, venture, fiction, charles
through the real `generateConfiguredContent` with no model, control-only) serve as the canary:
triage classifies, stamps provenance, honors scoped exceptions, and lands pending with no partial
output. A gate-rejection canary is **not reachable here** — no configured candidate declares a beat
until the spin slice — so it is deferred to that slice, per the Dependency note. The dormancy test
(recorded `reflective` still generates) pins the current behavior.

Repository-wide gate (coordinator runs once, last, **unsandboxed** — the sandbox reports ~196
phantom venture failures; in a fresh worktree run `npm run worktree:setup` first):

```
npm run check
```

## Observable result

The owner can read `docs/content-room-alignment-plan.md` §5 (the capability table's source-triage
row) and §Dependencies and running order (the item-5 sequence: routing, validate, then the remaining
capabilities), then inspect the diff to `src/review/jobs.ts` plus a test proving a Content-generated
source is classified, that `source_class`/`source_class_case` are stamped into each variant's
derivative frontmatter, and that the recorded class is the exact value fed to the 5b skeleton/case
gate calls (dormant until the spin slice, per the Dependency note), while a valid variant still
lands with 5a routing, exact controls, provenance, the validate gates, and pending review intact.

## Risk

high — audit required: yes. Touches the live generation/provenance seam again; the failure to catch
would be a mis-stamped source class (a scoped-exception origin wrongly required to trace, or an
essay wrongly exempted), or triage facts that do not line up with what 5b's gates read (leaving the
gates inert — a silent no-op).

## Families

- Builder: Claude, strong tier (backend generation logic).
- Auditor: Codex / GPT, strong tier — a different family from the builder, run via the repo's
  `codex` subscription CLI. Receives only this slice's acceptance criteria, the candidate diff,
  the changed-file list, and the focused check output; never the master document, the repository
  tree, or a worker transcript.

## Closeout

No closeout tool in this repo. The coordinator records `PASS` or the leftover list in this packet
below before the slice can close.

Closeout result: see `SLICE-5C-LOG.md` for the full PASS record (2026-09-05).

Follow-on recorded for the spin slice: un-dormant these gates by populating candidate
spin/angle/caseSkeleton, then add the end-to-end gate-rejection test (see Dependency note above).

## RESULT BLOCK (worker-authored, coordinator-verified)

See `SLICE-5C-LOG.md` for the completed RESULT BLOCK.
