# SLICE-6O: make the freeze-candidate scratch-root containment refusal symlink-proof

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`planFreeze` refuses a scratch root that lands inside the repository working tree, with reason
`scratch_root_inside_repo`. Its containment test is `isInsideRepo`, which compares
`path.relative(resolve(repoRoot), resolve(targetRoot))`. `path.resolve` is lexical: it never reads
the filesystem, so a symlink whose name sits outside the repo but whose target sits inside it
passes the check. The freeze then writes the "detached" checkout into the repository working tree,
the exact outcome this refusal exists to prevent and the reason completion-sequence step 6 requires
an out-of-repo freeze at all. SLICE-6K's Codex audit found this and the coordinator dispositioned
it as deferred P2 hardening rather than a defect; this slice closes it.

When this slice is done, a scratch root that reaches inside the repository through one or more
symlinks is refused with `scratch_root_inside_repo`, a scratch root genuinely outside the
repository is still accepted, `planFreeze` is still pure, and `npm run check` still exits 0.

## Difficulty

easy — one containment predicate and its call sites. The one real constraint is that the fix must
not make `planFreeze` touch the filesystem.

## Depends on

none. SLICE-6K is accepted and `src/operations/freeze-candidate.ts` is on `main`. SLICE-6M is
written and dependency-ready but owns only `e2e/pass-a-reads.ts` and `e2e/pass-b-writes.ts`; write
ownership is disjoint and neither slice blocks the other.

Delivery batch: 6O only. One implementation deliverable. Stop condition: accepted, or stopped
under `### Stopping without acceptance`. A free slot does not authorize a second slice.
Owner checkpoint: none. SLICE-6K already shipped the refusal and its intent; this slice only makes
it hold against symlinks. Whether real-path resolution is injected as a resolver argument or done
by the CLI before it calls `planFreeze` is an engineering choice.

## Owned files

Parallel-safe: no. The change is one predicate, its callers and its tests, all inside two files
proved by one `node --import tsx --test src/operations/freeze-candidate.test.ts` run. A second
lane would re-run the same file to verify the same artifact and return no independent deliverable,
so it would add coordination cost and nothing else.

### Lane A — symlink-proof containment

- `src/operations/freeze-candidate.ts`
- `src/operations/freeze-candidate.test.ts`

Temporary and check outputs: symlink and directory fixtures the new tests create live under
`os.tmpdir()` and are removed by the test, never inside the repository working tree.

## Do not touch

- `e2e/pass-a-reads.ts` and `e2e/pass-b-writes.ts` — SLICE-6M's owned files.
- `package.json`. The `freeze-candidate` script entry already exists and needs no change.
- `docs/content-studio-master-status.md`, `docs/content-agents-backlog.md`, `data/**`, `.env`.
- The other three refusal reasons (`sha_mismatch`, `untracked_path`, `undeclared_modification`)
  and their existing tests. Their behaviour is accepted and out of scope.
- SLICE-6K's gitignored-files disposition. Do not add `--ignored` handling here.

## Cited headings

none

## Acceptance

- [ ] With a symlink at a path outside the repository working tree whose target resolves inside
      it, the freeze is refused with reason `scratch_root_inside_repo`. A test asserts the
      `reason` field, not merely that a refusal occurred.
- [ ] The same refusal holds when the scratch root reaches inside the repository through a chain
      of at least two symlinks, and when the symlink is an intermediate path segment of the
      scratch root rather than its final segment. Both cases are asserted.
- [ ] A scratch root that is genuinely outside the repository working tree — including one
      reached through a symlink whose target is also outside it — is still accepted and still
      produces `ok: true`. A test asserts this, so the fix cannot pass by refusing everything.
- [ ] The existing lexical containment cases still refuse: a scratch root equal to `repoRoot`,
      and one nested beneath `repoRoot`. Neither existing test was deleted or weakened.
- [ ] `planFreeze` performs no filesystem read and no filesystem write. Verifiable by grep over
      `src/operations/freeze-candidate.ts`: no `node:fs` call appears inside the body of
      `planFreeze` or inside any function `planFreeze` calls. Real-path resolution is either
      injected into `planFreeze` as a caller-supplied argument or performed by the CLI before it
      builds `PlanFreezeInput`.
- [ ] The CLI path actually uses the hardened check: freezing with `--scratch-root` pointed at a
      symlink into the repository is refused. A test drives whatever seam the CLI uses to obtain
      real paths; if the CLI resolves paths itself, that resolution step is covered by a test.
- [ ] Real-path resolution never crashes the run on a scratch root that does not exist yet. A
      non-existent scratch root outside the repository is still accepted, and a test asserts it.
      `fs.realpathSync` throws `ENOENT` on a missing path, so this is the likely regression.
- [ ] `node --import tsx --test src/operations/freeze-candidate.test.ts` exits 0, and the test
      count is strictly greater than the 13 tests SLICE-6K shipped.
- [ ] `npm run check` was run unsandboxed and exits 0. It was green on `main` at `3395dc2`
      (4373/4373, SLICE-6N's verification), so unlike SLICE-6M this slice does assert exit 0. If
      it is red, every failure is reproduced with this slice's changes stashed out and named
      before the slice may close.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene
      disposition` form (not a bare exit code).

## Verify

Classification and applicable gate: meaningful behavior / high risk. This changes a safety
refusal that guards the integration step where a candidate is frozen; a wrong fix either lets a
checkout land inside the repository or blocks every freeze. The repository-wide gate applies; the
documentation-only exception does not.

For UI changes: none. This slice changes no page, no component and no user-visible copy; record
that in the RESULT BLOCK rather than leaving it unstated, and the standing design sanity check
does not apply. No browser journey is affected. Live integration: not applicable. This is a local
git/filesystem tool with no backend, and the tests prove real local behaviour against real
symlinks under `os.tmpdir()`, not mocked path APIs.

Run everything from a worktree dedicated to this session that no other session is writing to. Run
`npm run worktree:setup` once first or every command fails on missing `node_modules`.

Explicit non-goal: do not replace the containment refusal with a warning, and do not add an
`--allow`-style escape hatch for it. SLICE-6K already established that the `--allow` exception
route must not extend to a refusal whose consequence is silent data loss.

```
npm run worktree:setup                                             # once, in the fresh worktree
node --import tsx --test src/operations/freeze-candidate.test.ts
npm run check                                                      # unsandboxed; under the sandbox it reports ~196 phantom venture failures
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

`npm run freeze-candidate -- --scratch-root <a symlink pointing into the repo>` refuses with
`scratch_root_inside_repo` instead of writing a checkout inside the working tree, and the same
command against a real outside path still produces a frozen checkout and its manifest.

## Risk

medium — audit required: yes. The cheap wrong fix is `realpathSync` inside `planFreeze`, which
breaks its documented purity and throws `ENOENT` on a scratch root that does not exist yet; the
other cheap wrong fix is refusing more broadly and calling the red case green. That is the failure
this audit exists to catch.
Review boundary: this candidate.
Review scope/budget: ordinary effort, one bounded review. Three fixed questions for the auditor:
(1) is `planFreeze` still free of filesystem access, and where does real-path resolution actually
happen; (2) does a scratch root genuinely outside the repository — existing or not yet created,
symlinked or not — still get accepted, or has the fix widened the refusal; (3) does the CLI path
use the hardened check, or only the unit-tested seam.
Prior accepted evidence: SLICE-6K's audit dispositions are retained and not reopened. This slice
closes exactly one of them, the symlink-mediated scratch-root containment bypass recorded in
`SLICE-6K-LOG.md` → `## Accepted — 2026-09-09`. The gitignored-files disposition stays closed.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
and do not integrate.

## Families

- Builder: Claude, mid-tier model, medium effort — one lane, fresh packet-sized context. Escalate
  only if a first pass fails acceptance.
- Auditor: Codex (GPT), different family from the builder, ordinary effort. Launch
  `codex exec --sandbox read-only` unsandboxed locally; the sandboxed launch fails with
  `Operation not permitted` here, and the default model is required because `gpt-5.1-codex` is
  rejected on this account. Supply the acceptance list and the candidate diff, not only prose. If
  Codex is unavailable non-interactively (as in SLICE-6N), Grok is the fallback per
  `docs/operations/slice-protocol-environment.md` → `### Grok CLI on this Mac`; a second Claude is
  not independent review.

## Closeout

Use the `### Closeout gate disposition` form in `docs/operations/slice-protocol-environment.md`
for the closeout gate item — a `**PASS**` line with a date or an explicit leftover list, never a
fenced command.

Preflight: candidate sha pinned and changed paths listed; every acceptance item mapped to a named
command output or a quoted diff hunk; both check exit codes captured by exit status, not by
reading piped output; the purity claim evidenced by the actual grep, not asserted; audit findings
separated into established defects, verification gaps and optional improvements, each closed by a
fix plus evidence or an explicit disposition.
Gate cost: `npm run check` on the frozen candidate, run once, last, after the focused test. Record
measured local elapsed time per command separately from model usage; mark provider-reported usage
`unknown` if unavailable. Do not rerun either for paperwork.

Use the `### Hygiene disposition` form in `docs/operations/slice-protocol-environment.md` for the
hygiene item — not a bare exit code. Expect a non-zero exit: other sessions have pending work,
several `/private/tmp/content-agents-*` checkouts and unmerged branches. Name each path this
session created and settled, and each left in place.

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
- Each extra lane: none. Serial, because both owned files are proved by one focused test run and
  a second worker would duplicate that run for no independent deliverable.
- Assignment: one Claude mid-tier worker at medium effort, fresh packet-sized context. Reuse it
  for audit repairs on this candidate; its retained context is what makes the repairs cheap.
- Evidence return: command, exit code, counts, candidate sha, one-line result, and pointers to
  output on disk. Do not paste transcripts.
- Capability boundary: closeout runs once, after acceptance of this whole capability, not after
  each repair. Use completion notifications; do not poll an unchanged worker.
