# SLICE-6K: a runnable candidate freeze, so completion-sequence step 6 can be cited

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Completion sequence step 6 ("Freeze the audit-cleared candidate on a detached checkout") has no
runnable form anywhere, so every non-documentation slice asserts it by narration. This slice
builds one: a tested module plus a thin CLI that produces a detached checkout of the current
candidate at a recorded sha, writes a manifest naming the sha, the changed-file list and the
checkout path, and refuses to run when the tree state would make the freeze a lie. When it is
done, a RESULT BLOCK can cite a command, an exit code and a manifest path instead of a claim.

## Difficulty

hard — the failure modes (dirty tree, untracked files that never enter the detached checkout,
another session's work, a sha that does not match what was audited) are exactly the ones a freeze
exists to prevent, so the refusal conditions carry the value, not the happy path.

## Depends on

none

Delivery batch: 6K and 6L only. Both are implementation deliverables, both are dependency-ready
now, and they own disjoint paths, so they may run concurrently in separate sessions. Acceptance
order is independent. Stop condition: both accepted, or either one stopped under
`### Stopping without acceptance`. A free slot does not authorize a third slice.
Owner checkpoint: none. Whether the freeze is a shell script or a tsx CLI, where the checkout
lands, and the manifest's field names are engineering choices and stay with the coordinator.

## Owned files

Parallel-safe: no — within this slice the module, its test and the CLI are one small deliverable;
splitting the pure planner from its thin `main` would hand a second worker the same file pair and
the same investigation, adding a handoff without an independent result. Across slices, 6K and 6L
are genuinely parallel: disjoint owned paths, neither runs a repo-wide rewriting command, and each
one's focused checks write only inside its own owned paths.

### Lane A — the freeze mechanism

- `src/operations/freeze-candidate.ts` (create `src/operations/` if absent)
- `src/operations/freeze-candidate.test.ts`
- `package.json` — one added `scripts` entry only, no dependency changes

## Do not touch

- `docs/operations/slice-protocol-environment.md` — the bindings row naming this mechanism is the
  coordinator's integration commit, not the worker's. 6L is blocked from this file for the same
  reason; two lanes must never own one path.
- `docs/content-studio-master-status.md`
- `e2e/` — owned by 6L
- Any path under `src/` other than `src/operations/`
- Any existing `data/` file, `.env`, or `docs/content-agents-backlog.md`

## Cited headings

none

## Acceptance

- [ ] `src/operations/freeze-candidate.ts` exists and exports a pure function that takes a
      repository state description (current sha, porcelain status entries, a target root) and
      returns either a refusal with a named reason or a freeze plan carrying the sha, the changed
      paths and the checkout path. The pure function performs no git call and no filesystem write.
- [ ] The module's CLI entry point, when run, creates a detached checkout of the current `HEAD`
      sha under a scratch root outside the repository working tree, and writes a manifest file
      recording at least: the sha, the checkout path, the changed-file list it froze, and an
      ISO-8601 timestamp.
- [ ] The refusal path is implemented and tested for all three of: a tree carrying staged or
      unstaged modifications the caller did not declare, an untracked path that would not exist in
      the detached checkout, and a `HEAD` sha that does not match a sha the caller passed in.
      Each refusal names which condition fired.
- [ ] `src/operations/freeze-candidate.test.ts` exists, is discovered by `npm test`
      (`src/**/*.test.ts`), and contains at least one test per refusal condition above plus at
      least one test asserting the accepted plan's sha, changed paths and checkout path.
- [ ] Every test in that file asserts the returned plan or refusal value. No test asserts only
      that a git command was constructed or an argument was passed.
- [ ] `package.json` gained exactly one `scripts` entry invoking the CLI, and `git diff` on
      `package.json` shows no change outside the `scripts` object.
- [ ] `npm run check` exits 0, run unsandboxed.
- [ ] The RESULT BLOCK records one real invocation of the new script against this candidate: the
      exact command, its exit code, the sha it froze, and the manifest path it wrote.

## Verify

Classification and applicable gate: meaningful behavior / high risk. This adds a mechanism the
protocol's integration step will cite, and it touches `package.json`, an executable input. The
repository-wide gate applies; the documentation-only exception does not.

For UI changes: not applicable. This slice adds no page, no component and no user-visible copy,
so the standing design sanity check does not apply and no browser journey is required. Record
that in the RESULT BLOCK rather than leaving it unstated. Live integration: not applicable — the
mechanism is local git only, no network and no authenticated call.

```
npm run worktree:setup   # only in a fresh worktree, once
npm run check            # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

The coordinator runs the new script, gets an exit code, and can open the manifest and the detached
checkout it names. The sha in the manifest matches `git rev-parse HEAD` at the moment of the
freeze. A dirty tree produces a refusal naming which condition fired, not a silent partial freeze.

## Risk

medium — audit required: yes. The mechanism will be cited as proof that review looked at immutable
evidence, so a freeze that silently omits untracked files or drifts from the audited sha would
make every later slice's step-6 assertion false while looking correct.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Two fixed questions for the auditor:
(1) can any input reach the accepted-plan branch while the working tree still differs from the sha
being frozen; (2) does each refusal condition have a test that fails if that condition is removed.
Prior accepted evidence: none retained; this is a new mechanism.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate. 6L is independent authorized work and may continue.

## Families

- Builder: Claude, mid-tier model, medium effort — one lane, no escalation unless a first pass
  fails acceptance.
- Auditor: Codex (GPT family), ordinary effort — different family from the builder. Run
  `codex exec --sandbox read-only` unsandboxed locally; the sandboxed form fails with
  `Operation not permitted` on this machine. Give it the acceptance list above, not only the
  protocol prose: 6J's audit raised a false flag precisely because it was handed the looser text.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`
for the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a
fenced command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item above mapped to a
named test or a recorded command output; `npm run check` exit code captured, not piped through
`tail`; audit findings separated into established defects, verification gaps and optional
improvements, with every material finding closed by a fix plus evidence or an explicit
disposition.
Gate cost: `npm run check` on the frozen candidate, run once, last. Record measured local elapsed
time separately from model usage; mark provider-reported usage `unknown` if unavailable. Do not
rerun the gate for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
several `/private/tmp/content-agents-6d-*` checkouts and unmerged `agent/cs*` branches. Name each
path this session created and settled, and name each path left in place.

Use the `### Read-set measurement` form in `docs/operations/slice-protocol-environment.md` for the
closeout read-set print — not an ad hoc re-derivation.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
- Delivery state and next action: <built | verified | accepted | committed; workers cannot accept/commit>
- Usage: <local check elapsed time separately from model calls/provider-reported usage;
  unavailable values `unknown`; prior history behind evidence pointers>

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: serial within the slice — a second worker on the same module pair would repeat
  the same investigation and return no independent deliverable. 6L is the parallel lane, and it
  is a separate packet with its own worker.
- Assignment: one Claude mid-tier worker at medium effort, fresh packet-sized context. Reuse it
  for audit repairs on this candidate; its retained context is what makes the repairs cheap.
- Evidence return: command, exit code, counts, candidate sha, one-line result, and pointers to
  the manifest and any log on disk. Do not paste transcripts.
- Capability boundary: closeout runs once, after acceptance of this whole capability, not after
  each repair. Use completion notifications; do not poll an unchanged worker.
