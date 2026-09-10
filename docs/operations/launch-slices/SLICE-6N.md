# SLICE-6N: make the repository-wide gate green again — repair the red `src/review/jobs.test.ts`

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`npm run check` is this repository's gate (bindings row "Repository-wide gate"), and it is red on
`main` for a pre-existing reason: `src/review/jobs.test.ts`, landed by SLICE-5Z, fails. Because of
that, packets since have had to write "do not assert exit 0" carve-outs into their own acceptance
lists (`SLICE-6M.md` → `## Acceptance`), and every future slice inherits a gate whose result no
one can read as pass/fail.

When this slice is done, `npm run check` exits 0 unsandboxed on the candidate, the failing subtests
are closed by a named repair on the side that was actually wrong, and no test was deleted, skipped
or weakened to get there. The next packet can assert exit 0 with no carve-out.

## Difficulty

hard — the failing side is not yet known. The repair may belong in the test (a stale assertion) or
in `src/review/jobs.ts` (a real product defect 5Z shipped), and the cheapest wrong answer — relax
the assertion — looks identical to success at the gate.

## Depends on

none. Independent of SLICE-6M: that slice owns `e2e/*.ts` only and is forbidden from touching
`src/`, this one owns `src/review/jobs*.ts` only and is forbidden from touching `e2e/`. The two may
run concurrently in separate worktrees; they must not share one, because both run `npm run check`.

Delivery batch: 6N only. One implementation deliverable. Stop condition: accepted, or stopped under
`### Stopping without acceptance`. A free slot does not authorize a second slice.
Owner checkpoint: none. Whether a red gate should be green is not an open question, and which of
the test or the product is wrong is an engineering finding, not a scope decision. If the repair
turns out to require changing shipped 5Z *product behaviour* the owner chose, stop and report it
rather than deciding it here.

## Owned files

Parallel-safe: no. There is one defect with one unknown root cause, proved by one shared
`npm run check` run. A second lane would have to re-run the same gate against the same artifact to
learn anything, returning no independent deliverable while adding a handoff. The independent split
considered — one lane diagnoses, one prepares verification — collapses because the verification is
an existing command that needs no preparation.

### Lane A — the green gate

- `src/review/jobs.test.ts` — only the subtests named in acceptance item 1
- `src/review/jobs.ts` — only if, and only where, acceptance item 5 establishes the product is the
  wrong side

## Do not touch

- `e2e/**`. SLICE-6M owns those files, and SLICE-6L's committed `e2e-summary` work sits there.
- Any test outside `src/review/jobs.test.ts`, and any source file outside `src/review/jobs.ts`.
  A failure elsewhere is a finding to report, not a file to edit.
- `package.json`, `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`,
  `config/**`, `data/**`, `.env`.
- The `npm run check` definition itself. Making the gate green by narrowing what it runs is the
  failure this slice exists to prevent.

## Cited headings

none

## Acceptance

- [ ] Baseline recorded before any edit: `node --import tsx --test src/review/jobs.test.ts` was run
      unsandboxed in the fresh worktree at its checkout sha, and the RESULT BLOCK names every
      failing subtest by its exact test name plus the assertion message printed for it. If that
      command exits 0 at that sha, this slice's premise is void — record that and take
      `### Stopping without acceptance` without editing anything.
- [ ] `node --import tsx --test src/review/jobs.test.ts` exits 0 on the candidate, run unsandboxed,
      verified by exit status and not by reading piped output.
- [ ] `npm run check` exits 0 on the frozen candidate, run unsandboxed from the dedicated worktree,
      verified by exit status. If it reports a failure outside `src/review/jobs.test.ts`, that
      failure is named in the RESULT BLOCK and the slice stops rather than expanding into it.
- [ ] No test was removed to reach green. The count of `test(` occurrences in
      `src/review/jobs.test.ts` at the candidate is greater than or equal to the count at the
      worktree's checkout sha, and the RESULT BLOCK prints both numbers and the exact command that
      produced them. No subtest was renamed out of the run, marked `skip`, marked `todo`, or given
      an `only`.
- [ ] Every failing subtest named in item 1 is closed by exactly one of two dispositions, stated
      per subtest in the RESULT BLOCK with its diff hunk and one sentence of reason: (a) the
      assertion was stale, repaired in `src/review/jobs.test.ts`; or (b) the product was wrong,
      repaired in `src/review/jobs.ts`. No subtest is closed by relaxing an assertion to a
      condition that holds regardless of the behaviour it describes.
- [ ] At least one repaired subtest is demonstrated still able to fail: temporarily break the
      condition it asserts, observe `1 failing` for that subtest, restore, and record in the
      RESULT BLOCK what was broken and what was observed.
- [ ] If `src/review/jobs.ts` changed at all, `npm run test:e2e` was run unsandboxed and its exit
      code recorded. Any failing journey other than the two records SLICE-6M owns
      (`"Content opens request-grouped approval before the separate Publish step"` and
      `"Content grouped approval reports injected provider success and retained failure
      separately"`) blocks acceptance and is reported as a finding. If `src/review/jobs.ts` is
      unchanged, the RESULT BLOCK records this item `not applicable` and says so explicitly.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene disposition`
      form in the bindings file — all four assertions, not a bare exit code.
- [ ] The closeout read-set print is recorded per the `### Read-set measurement` form: three byte
      counts, produced by the commands in that section.

## Verify

Classification and applicable gate: meaningful behavior / high risk. The candidate changes an
executable input to the repository-wide gate and may change shipped product behaviour in
`src/review/jobs.ts`. The repository-wide gate applies in full; the documentation-only exception
does not.

For UI changes: none expected. `src/review/jobs.ts` is review-queue job logic, not a page or a
component. If a repair does alter user-visible copy or a rendered state, stop and report it as a
finding — the standing design sanity check would then apply and this packet does not authorize it.
Live integration: not applicable. Both commands below are hermetic local runs; no provider,
network or authenticated call is in scope, and none is authorized.

Run everything from a worktree dedicated to this session that no other session is writing to. Run
unsandboxed: under the sandbox `npm run check` reports roughly 196 phantom venture failures
(bindings row), which would make item 3 unreadable.

```
npm run worktree:setup                          # once, in the fresh worktree
node --import tsx --test src/review/jobs.test.ts # baseline, before any edit; record exit + failures
node --import tsx --test src/review/jobs.test.ts # after the repair
npm run check                                    # unsandboxed; record exit code, do not pipe through tail
npm run test:e2e                                 # only if src/review/jobs.ts changed
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

`npm run check` exits 0. The owner can read the gate as a real pass for the first time since 5Z,
and the next packet's acceptance list carries no "the gate is already red, do not assert exit 0"
carve-out.

## Risk

medium — audit required: yes. Two distinct failure modes need an independent reader: an assertion
relaxed until it is trivially true, and a product edit in `src/review/jobs.ts` made to satisfy a
stale test rather than because the product was wrong.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Three fixed questions for the auditor:
(1) for each repaired subtest, does it still fail if the behaviour it names breaks, or is it now
trivially true; (2) if `src/review/jobs.ts` changed, is the product genuinely the wrong side, with
the evidence shown, rather than the test being appeased; (3) does the diff reach outside
`src/review/jobs.test.ts` and `src/review/jobs.ts`.
Prior accepted evidence: none retained. The only prior signal is the red `npm run check` recorded
in `SLICE-6M.md` → `## Acceptance`, which this slice supersedes for this file.
On reviewer outage: mark the candidate review-blocked, record the retry condition under
`## Stopped`, and do not integrate.

## Families

- Builder: Codex (GPT), mid-tier model, medium effort — one lane, fresh packet-sized context.
  Backend repair, which the bindings name as Codex's default. Escalate to a strong model at high
  effort only if a first pass fails acceptance, changing one variable at a time.
- Auditor: Claude, a different family from the builder, ordinary effort. Supply the acceptance
  list, the candidate diff, the changed-file list and both check outputs — not prose alone.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md` for
the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a fenced
command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item mapped to a named
command output or a quoted diff hunk; both test runs and `npm run check` captured by exit status,
not by reading piped output; the baseline failure list recorded before the first edit; the
deliberate-break demonstration recorded; audit findings separated into established defects,
verification gaps and optional improvements, each closed by a fix plus evidence or an explicit
disposition.
Gate cost: `npm run check` on the frozen candidate, run once, last. Record measured local elapsed
time per command separately from model calls; mark provider-reported usage `unknown` if
unavailable. Do not rerun either command for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
several `/private/tmp/content-agents-*` checkouts and unmerged branches. Name each path this
session created and settled, and each path left in place.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for the
closeout read-set print — not an ad hoc re-derivation.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action:
- Usage:

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: none — serial, because one defect with one unknown root cause is proved by one
  shared gate run, and a second worker would repeat that run for no independent deliverable.
- Assignment: one Codex mid-tier worker at medium effort, fresh packet-sized context. Reuse it for
  audit repairs on this candidate; its retained diagnosis is what makes the repairs cheap.
- Evidence return: command, exit code, pass/fail/skip counts, candidate sha, one-line result, and
  pointers to output on disk. Do not paste transcripts.
- Capability boundary: closeout runs once, after acceptance of this whole capability, not after
  each repair. Use completion notifications; do not poll an unchanged worker.
