# SLICE-8C: Hide quote-card rows until their image exists

Protocol: `AGENTS.md` -> `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md`. Do not load the repository for context.
Do not commit, stage, push, checkout or stash.

## Goal

Content Studio does not list a quote-card review or publishing row before its referenced image
exists. Once the image appears, the row appears normally.

## Difficulty

easy - a narrow frontend/data-shaping behavior change with a meaningful regression test.

## Depends on

none

Delivery batch: SLICE-8B, SLICE-8C, and SLICE-8D are owner-authorized by the 2026-09-12 Codex
handoff. This slice is the UI deliverable. Stop after the frozen candidate and RESULT BLOCK.
Owner checkpoint: resolved by Muxin: hide the row, do not show a disabled placeholder.

## Owned files

Parallel-safe: yes. This lane owns only the Studio row/view shaping and its focused tests; SLICE-8D
owns publishing character limits and test-write safety. Focused checks may write only under temp.

### Lane A - UI row visibility

- `src/review/rows.ts`
- `src/review/page.ts`
- `src/review/page.test.ts`
- one new focused `src/review/*missing-image*.test.ts` if that is the smallest honest test location

Pinned read-only inputs: `src/publish/queue.ts` queue-row schema and the current accepted UI behavior.
Frozen handoff: a diff limited to the paths above plus red/green focused output.

## Do not touch

- publishing dispatch, provider adapters, content folders, operational ledgers, `.env`, or SLICE-8D
  paths.
- Do not run repo-wide rewriting commands.

## Cited headings

none

## Acceptance

- [x] A focused test is genuinely red before implementation.
- [x] A quote-card row with a missing referenced image is absent from Studio.
- [x] The same row appears once the image exists.
- [x] Text rows, image rows with existing assets, and inspectable media stages remain unchanged.
- [x] Focused tests and the final repository gate pass.

## Verify

Classification and applicable gate: meaningful user-visible behavior; focused tests, a browser
journey, cross-family audit, and final `npm run check` on the frozen candidate.
For UI changes: exercise Content room and Publishing room with one missing-image quote card and one
rendered card, at desktop and narrow viewport; local backend, no live provider call. Assert absence,
appearance after render/refresh, and no regression to existing rows. Retain screenshots and counts.

```
node --import tsx --test <focused-test-file>
```

## Observable result

Before rendering, no card row or failing approval action is visible. After the image exists and the
desk refreshes, the row is visible.

## Risk

medium - audit required: yes, because hiding rows can accidentally hide valid approval work.
Review boundary: this candidate.
Review scope/budget: row filtering, filesystem boundary, and regression coverage; Grok ordinary
effort against frozen diff/check output.
Prior accepted evidence: none for this behavior.
On reviewer outage: candidate remains review-blocked; SLICE-8B and SLICE-8D may continue.

## Families

- Builder: Codex Luna worker, ordinary effort.
- Auditor: Grok `grok-4.5`, ordinary effort, cross-family.

## Closeout

Preflight: focused red/green proof; path-bounded diff; browser evidence; audit input complete.
Gate cost: final passing `npm run check` took 168.4 seconds; browser proof was a separate bounded
local journey.

**PASS** - 2026-09-12. Acceptance, browser proof, cross-family audit, and final gate are complete.

## RESULT BLOCK

- Changed paths: `src/review/page.ts`, `src/review/page.test.ts`, and new
  `src/review/missing-image.test.ts`.
- Outcome: the shared Content/Publishing shaper omits only image rows lacking an asset URL,
  on-disk asset, or inspectable media stage. The row appears after its image reaches disk; the old
  missing-image placeholder path and tests are removed.
- Checks run and results: genuine focused red failed 1 behavior assertion; green passed 1/1;
  focused regression passed 290/290. Frozen browser candidate
  `6f4a546973d4c4422d2d8169ad5fd29994d7beed` passed Content and Publishing at 1280x900 and
  700x900 with missing 0, rendered 1, text 1, and browser/provider errors 0. Final repository gate
  passed typecheck and 4576/4576 tests from the bound checkout after all eight candidate files were
  confirmed byte-identical to the frozen commit.
- Independent audit: Grok 4.5 ordinary effort initially found no defect but required direct
  Publishing-call-path and media-stage proof. The added regression and bounded call-site evidence
  closed both findings; delta verdict PASS.
- Evidence locations: browser evidence root
  `/var/folders/vc/rdt307ss2311nmjqp39cyrx00000gn/T/content-agents-slice-8c-browser-evidence-2pfzMX`;
  summary SHA-256 `eb65dd0afb1838fd7a2fc3fe6984a793f4d469a84d28beed4d75481b0372a1ea`;
  trace SHA-256 `a6f90c75695f784705ec7f77b151a2614623587626bd959db6c1e64758b98da9`.
- Unresolved: none.
- Delivery state and next action: accepted and ready for coordinator integration.
- Usage: builder/provider token and cost reports unavailable; local focused test time 1.05 seconds,
  final gate 168.4 seconds.

## Usage budget and handoff

- Each extra lane: one implementation worker avoids blocking on live scheduling and owns disjoint paths.
- Assignment: fresh Codex Luna worker; retain it for related repairs.
- Evidence return: focused red/green commands, exit/counts, changed paths, candidate identity.
- Capability boundary: automatic closeout after audit, browser proof, and final gate.
