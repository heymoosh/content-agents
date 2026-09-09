# SLICE-5D: port spin angles into configured Content generation and un-dormant 5b/5c's gates

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

The configured Content generation path (`generateConfiguredContent` in `src/review/jobs.ts`)
computes the per-platform spin angle that today lives only in `/atomize` (`src/atomize/spin.ts`),
so each routed candidate carries the spin/angle (and, where the same generation produces it, the
`caseSkeleton` beat) that slice 5b's skeleton and case gates read. This makes those gates —
wired but **dormant** since 5c because the path fed them hardcoded `undefined` — actually fire in
the Content path. The concrete leverage: after 5d, a variant whose recorded source class excludes
a beat but whose spin declares that beat is rejected end to end (no derivative, no review row),
and a variant whose beat is allowed still lands with 5a routing, exact controls, provenance, the
5b/5c validate+triage facts, and pending review intact.

**Scope boundary — extraction-first is not relaxed.** Spin operates only within the narrow,
already-shipped source-grounded latitude (the same latitude `src/atomize/spin.ts` and
`/patterns rewrite` already use): it may re-hook, reorder, trim, and add connective structure so a
platform variant makes one intelligible standalone point. It may **not** invent a factual claim,
statistic, example, experience, metaphor, or worldview position outside the variant's cited
`source_lines`; it must pass `config/voice.yaml` (no em dashes, no AI tells); and the untreated
control variant stays byte-for-byte exact. Where an origin legitimately has no source essay
(Venture, Charles, fiction promo), spin must not fabricate a traced claim or force a class/beat the
scoped exception does not provide. Porting spin must reproduce `/atomize`'s spin behavior in the
Content path, not widen it.

## Difficulty

hard — it wires a composition step (per-platform re-hooking) into the live generation/provenance
seam of `jobs.ts`, and it is the slice that finally lets 5b/5c's gates reject, so the failure modes
to prevent are (a) a spin output that invents a claim outside `source_lines` or fails voice, (b) a
control variant that is no longer byte-exact, and (c) a gate that now fires on a scoped-exception
origin it should not. The recorded-fact/beat vocabulary must line up exactly with what 5b's
skeleton (`spin===true && angle===platform`) and case (`caseSkeleton===true`) gates read.

## Depends on

Item 5a (routing gate), 5b (`validate` gates, reading spin/angle/caseSkeleton beat indicators), and
5c (source triage recording the class the gates enforce against) — all accepted and on `main`. P1
(single platform-limit source) and P2 (editor registry) already landed. No open slice depends on
this one being split. This slice discharges the follow-on the SLICE-5C Dependency note recorded.

## Owned files

Parallel-safe: no — single lane. The work is one coupled change to the same generation/provenance
seam 5b/5c edited: compute spin per routed candidate and record spin/angle (and `caseSkeleton`
where produced) into the same candidate/provenance the 5b gates read, before the same function
writes any derivative or review row. The un-dormanting property (the spin values fed to the gates
must be the ones stamped into provenance, and controls must stay exact) spans the call site and the
shared spin logic, so there is no path split for which the protocol's three safety conditions hold.
Run it as one worker.

### Lane A — port spin and make 5b's skeleton (and, where reachable, case) gate fire

- `src/review/jobs.ts` — in `generateConfiguredContent`, compute the per-platform spin angle for
  each routed candidate via the spin logic and populate the candidate's `spin`/`angle` (and
  `caseSkeleton` where the same generation yields a case beat) that 5b's `checkSkeletonGate` /
  `checkCaseGate` read, replacing the hardcoded `undefined` beat indicators 5c left in place, before
  any `mkdirSync`/write/`appendRows`. The spin-treated copy is a treatment variant; the untreated
  control stays byte-for-byte exact and provenance/`source_lines` are preserved.
- The spin logic the path invokes: reuse `src/atomize/spin.ts`'s existing spin function if it is
  importable; otherwise extract the per-platform spin into a shared function that both `/atomize`
  and the Content path call. If `spin.ts` is modified, it may change **only** to expose a shared
  entry point — its external behavior and existing tests must stay green (regression).
- New/affected `node:test` files covering: spin runs in the Content path and populates
  spin/angle on candidates; **the end-to-end gate rejection 5c deferred** — a Content-path run where
  a candidate's spin declares a beat the recorded source class excludes is rejected atomically (no
  derivative files, no `review-queue.md` row), while an allowed beat still lands pending; the
  untreated control remains byte-exact and passes `config/voice.yaml`; and a valid request per
  origin kind (extraction-first essay spun within `source_lines`; Venture and Charles — no source
  essay — not forced into a beat/class the scoped exception does not provide) retaining 5a routing,
  exact controls, provenance, the 5b/5c gates, and pending review.

## Do not touch

- `src/strategy/route.ts`, `config/routing.yaml`, the 5a routing subset — do not re-implement or
  weaken routing.
- The 5b `validate` gates (`checkPlatformLimits`, `checkSkeletonGate`, `checkCaseGate`) and 5c's
  triage recording (`readSourceClass`/`readCaseEvidence`, `classifyContentOriginClass`). 5d
  **feeds** the gates real beat indicators; it does not change their thresholds, logic, or the
  recorded-class contract. If a gate read helper must move, its behavior must stay identical and its
  tests green.
- The other five item-5 capabilities (pillar tagging, scoring/soft gate, thread check, quote-card
  captions, brief directives). This slice is spin only.
- `config/platforms.yaml`, `config/voice.yaml`, `config/pillars.yaml` as data — read them (spin
  angles live in `config/platforms.yaml`); do not edit their values.
- `docs/content-agents-backlog.md` — board writes go through `prose_kanban` only, never as text.
- `/atomize`'s runtime behavior — `spin.ts` may be refactored to expose a shared entry point, but
  the atomize path's observable output must not change.

## Cited headings

`none` — everything needed is in this packet, the protocol section, and the two design-spec
sections named under Observable result. Do not open the master document.

## Acceptance

- [ ] `generateConfiguredContent` computes the per-platform spin angle for each routed candidate and
      populates the spin/angle (and `caseSkeleton` where produced) that 5b's skeleton and case gates
      read, before writing any derivative or review row. The RESULT BLOCK states which of the two
      gates it made live and — if `caseSkeleton` is not produced by the ported spin path — why the
      case gate remains dormant and what would un-dormant it (an honest scope statement, not an
      over-claim).
- [ ] The end-to-end gate rejection 5c deferred is now proven: a Content-path run whose candidate
      spin declares a beat the recorded source class excludes is rejected atomically — no partial
      derivative files, no pending `review-queue.md` row — via the recorded facts, not a direct
      helper call. An allowed beat still lands pending.
- [ ] Spin stays within the shipped extraction-first latitude: the treated variant invents no claim
      outside its `source_lines` and passes `config/voice.yaml`; the untreated control is
      byte-for-byte exact; a test asserts both.
- [ ] Each origin kind is handled correctly, proven per kind, including at least one origin with no
      source essay (Venture or Charles) that spin does **not** force into a beat/class demanding
      `source_lines` — the scoped exception is honored.
- [ ] A valid origin-specific request retains 5a routing, exact untreated controls,
      provenance/`source_lines`, the 5b/5c validate+triage facts, and pending-review status (no
      regression).
- [ ] `/atomize`'s existing `spin` behavior and tests remain green (no regression from any
      extraction/refactor).
- [ ] Focused/fake-model tests, cross-family audit, one bounded isolated canary, and the
      repository-wide gate all pass.

## Verify

Focused checks (worker runs; records exact file list in RESULT BLOCK). Repo runner is Node's
built-in `node:test` via `tsx`:

```
node --import tsx --test <the new/affected review-generation, spin, validate, and source-triage test files>
```

Bounded canary — verification budget for this slice: **one** isolated end-to-end run of the real
`generateConfiguredContent` against a **fake model** (spin selection is deterministic given the
model text; no authenticated or paid call is needed), in a Git/HOME/operational-data-isolated
harness, forcing one candidate's spin to declare a beat the recorded source class excludes and
confirming atomic rejection (no partial output, no review row), plus one allowed-beat variant that
lands pending with a byte-exact control. At most one retry if the harness (not the behavior) is at
fault. Preserve successful model output if later validation fails.

Repository-wide gate (coordinator runs once, last, **unsandboxed** — the sandbox reports ~196
phantom venture failures; in a fresh worktree run `npm run worktree:setup` first):

```
npm run check
```

## Observable result

The owner can read `docs/content-room-alignment-plan.md` §5 (the capability table's spin row) and
§Dependencies and running order (the item-5 sequence), then inspect the diff to `src/review/jobs.ts`
plus **a before/after content sample**: the same source generating a platform variant with spin off
(5c behavior) versus spin on (this slice), showing the re-hooked copy stays within `source_lines`,
passes voice, and the untreated control is unchanged — alongside the integration test proving a
beat-excluded spin is rejected atomically while an allowed one lands pending.

## Risk

high — audit required: yes. This is content-generation LOGIC that changes composed prose per
platform (lane C, alignment-plan Rule 7). It touches the live generation/provenance seam and finally
lets the 5b/5c gates reject, so a miss would be an invented claim outside `source_lines`, a voice
failure, a mutated control, or a gate misfiring on a scoped-exception origin. **Per Rule 7 this
slice holds for Muxin as a draft PR carrying the old-versus-new content sample; the coordinator does
not self-vet-merge it.** The coordinator builds, cross-family-audits, verifies, and surfaces the
sample + verdict to Muxin for the merge decision.

## Families

- Builder: Claude, strong tier (backend generation + composition logic).
- Auditor: Codex / GPT, strong tier — a different family from the builder, run via the repo's
  `codex` subscription CLI. Receives only this slice's acceptance criteria, the candidate diff, the
  changed-file list, and the focused check output; never the master document, the repository tree,
  or a worker transcript. Extraction-first and voice adherence are explicit audit targets here.

## Closeout

No closeout tool in this repo. The coordinator records `PASS` (audit clean, verified) or the
leftover list in this packet below, then — because this is a Rule 7 hold — surfaces the before/after
sample and verdict to Muxin rather than merging. The slice is **accepted** only on Muxin's approval.

Closeout result: **ACCEPTED — merged to local `main`** (2026-09-05). See `SLICE-5D-LOG.md` for the
full acceptance record, pre-acceptance verdict, and RESULT BLOCK.

## RESULT BLOCK (worker-authored, coordinator-verified)

See `SLICE-5D-LOG.md` for the completed RESULT BLOCK.
