# SLICE-6Q: stop handing every `.env` secret to the agent CLI children the studio spawns

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`src/util/env.ts` loads the repo-root `.env` into `process.env` at import time. `runCommandSpawn`
(`src/review/jobs.ts:1786`) then builds every child's environment as `{ ...process.env,
...opts.env }`. So every `claude` / `codex` child the studio spawns through `runAgentSpawn` gets
the full secret set from `.env` — observed keys include `OPENROUTER_API_KEY`, `TYPEFULLY_API_KEY`,
`YOUTUBE_REFRESH_TOKEN`, `LINKEDIN_CLIENT_SECRET`, `BLUESKY_APP_PASSWORD`. None is anything an
agent CLI needs.

It is also the single reason `npm run check` is red on `main` in a checkout with a real `.env`:
`src/review/jobs.test.ts:2472` asserts "the process runner inherited only the fixture allowlist"
and gets ~30 extra keys. SLICE-6N called this "did not reproduce" because it ran in a fresh
worktree with no `.env`. Confirmed red at `6de90f7`: 4372/4373, this one test.

When this slice is done, an agent child's environment is the ambient environment minus exactly the
keys `.env` injected; non-agent spawns (`scout`, `pull`, the venture and fiction runners) keep the
environment they need today; and `npm run check` exits 0 in a checkout with a real `.env`.

## Difficulty

easy — the loader already knows which keys it injected, and the spawn boundary is one object
literal. The difficulty is entirely in not breaking what sits around it.

## Depends on

none. SLICE-6M owns `e2e/pass-*.ts` and SLICE-6O `src/operations/freeze-candidate*.ts`; ownership
is disjoint and neither blocks this. It unblocks both of their final gates, red today for this
reason.

Delivery batch: 6Q only, one implementation deliverable. Stop condition: accepted, or stopped
under `### Stopping without acceptance`. A free slot does not authorize a second slice.
Owner checkpoint: none. Secrets not reaching a model subprocess is a standing safety rule, not a
new product decision; how the injected key set is exposed is an engineering call.

## Owned files

Parallel-safe: no. One exported set, one spawn-boundary filter and their tests, all proved by one
`node --import tsx --test src/review/jobs.test.ts` run. A second lane would re-run that file to
verify the same artifact and return no independent deliverable.

### Lane A — bounded agent-child environment

- `src/util/env.ts`
- `src/review/jobs.ts` — `runCommandSpawn` and `runAgentSpawn` only
- `src/review/jobs.test.ts`

Temporary and check outputs: the fixture roots under `os.tmpdir()` `jobs.test.ts` already creates
and removes. Nothing new in the working tree.

## Do not touch

- `e2e/pass-a-reads.ts`, `e2e/pass-b-writes.ts` (SLICE-6M) and
  `src/operations/freeze-candidate{,.test}.ts` (SLICE-6O).
- The `.env` file, and the loader's parsing rules: the regex, the quote stripping, the "only set a
  key that is `undefined`" precedence, the silent catch when no `.env` exists. Adding an export is
  in scope; changing what loads is not.
- `src/review/serve.ts`, `src/review/venture-runner.ts`, `src/review/fiction-jobs.ts` — they call
  `runCommandSpawn` for repo scripts that legitimately need provider keys. Their behaviour must not
  change; do not edit them to compensate.
- `package.json`, `docs/**`, `data/**`, and every other `src/**` path.

## Cited headings

`docs/content-studio-master-status.md` → `## Standing constraints`

## Acceptance

- [ ] `src/util/env.ts` exposes the set of keys it injected into `process.env` from `.env`, as a
      value other modules can read. It stays a side-effect import: no file outside this packet's
      owned list changes, and the set is empty with no `.env`.
- [ ] A child spawned through `runAgentSpawn` receives no key that came from `.env`. Asserted by a
      test, by key name, not by asserting a filter function ran.
- [ ] That child still receives the ambient environment: a test proves a key present in the
      spawning process but absent from `.env` reaches it, and `opts.env` still wins.
- [ ] A key that is in `.env` but ALSO genuinely present in the ambient environment still reaches
      the agent child: the loader only sets keys that were `undefined`, so it was never
      `.env`-sourced and stripping it is a regression. A test asserts this.
- [ ] `runCommandSpawn` called directly — the `scout`, `pull`, venture and fiction runner path —
      still passes the full `process.env`, `.env` keys included. A test asserts a `.env`-sourced
      key reaching a non-agent child.
- [ ] The assertion at `src/review/jobs.test.ts:2472` passes with its 12-key
      `allowedChildEnvironment` list (lines 2468-2471) byte-identical: not edited, extended or
      replaced, and the test not skipped or downgraded.
- [ ] The fixture-supplied keys it expects (`CONTENT_AGENTS_DATA_ROOT`,
      `CONTENT_AGENTS_TEST_COST_LOG`, `FIXTURE_MODE`, `FIXTURE_CLI_RECEIPT`, `FIXTURE_WORK`,
      `HOME`, `PATH`, `TMPDIR`, `TMP`, `TEMP`, `__CF_USER_TEXT_ENCODING`) still reach the child. A
      fix that passes by narrowing to a hardcoded allowlist fails this item.
- [ ] `node --import tsx --test src/review/jobs.test.ts` exits 0, run from a checkout with a real
      `.env`, and the test count is strictly greater than before this slice.
- [ ] `npm run check` was run unsandboxed from a checkout with a real `.env` and exits 0. Baseline
      at `6de90f7` is 4372/4373 with `src/review/jobs.test.ts:72` failing; record both numbers. Any
      other failure is reproduced with this slice's changes stashed out and named before close.
- [ ] Authenticated canary: one real agent job through `npm run review`, subscription route ($0),
      succeeding under the narrowed environment. Budget one canary, one retry; record the job id
      and log path. If the studio cannot be driven unattended, record a named verification gap and
      hand it to the coordinator — never mark it done or substitute a fixture run.
- [ ] `bash scripts/repo-hygiene.sh --rescue` was run and settled per the `### Hygiene
      disposition` form, not a bare exit code.

## Verify

Classification and applicable gate: meaningful behavior / high risk. This changes what a
model-driven subprocess can read, and a wrong narrowing breaks every studio agent job. The
repository-wide gate applies; the documentation-only exception does not.

For UI changes: none — record that in the RESULT BLOCK rather than leaving it unstated; the design
sanity check in `## Standing constraints` does not apply. Live integration: applicable, budgeted
above as the single canary; the fixture CLI proves the environment's shape, not that the real CLI
still authenticates.

Run from a checkout with a real `.env`. This failure mode is invisible in a fresh worktree —
without `.env` it reports green either way, which is how SLICE-6N closed this moot. Copy nothing
into a worktree: run the gate in the main checkout.

Explicit non-goal: do not stop `src/util/env.ts` loading `.env`, and do not replace the spawn
environment with a hardcoded allowlist. The loader feeds every provider adapter here, and an
allowlist drops the ambient keys the fixture and the real CLIs depend on.

```
node --import tsx --test src/review/jobs.test.ts
npm run check                          # unsandboxed; under the sandbox it reports ~196 phantom venture failures
npm run review                         # the authenticated canary; one real agent job, one retry max
bash scripts/repo-hygiene.sh --rescue
```

## Observable result

A Revise or Develop job in the studio still works, and the `claude` child it spawns no longer has
`OPENROUTER_API_KEY`, `TYPEFULLY_API_KEY` or any other `.env` secret in its environment.
`npm run check` goes from 4372/4373 to green on Muxin's own checkout.

## Risk

medium — audit required: yes. Two cheap wrong fixes read green locally: narrowing the child to a
hardcoded allowlist (breaks the fixture, and strips what the real CLI needs from the ambient
shell), and editing the 12-key expectation to match the leak (a rubber stamp on a real finding).
That is what this audit exists to catch.
Review boundary: this candidate.
Review scope/budget: high effort, one bounded review — a secret-exposure boundary with a live
dependency. Four questions: (1) is the child environment derived by subtracting the loader's
injected keys, or by some allowlist; (2) does a `.env`-sourced key still reach a non-agent
`runCommandSpawn` child; (3) are `jobs.test.ts:2468-2471` byte-identical; (4) can any ambient key
the real CLIs read be stripped here — name it, or state that none can.
Prior accepted evidence: none retained. SLICE-6N's "did not reproduce" disposition is superseded
by the reproduction in `## Goal`; nothing else is reopened.
On reviewer outage: mark the candidate review-blocked, record the retry condition in `## Stopped`,
do not integrate.

## Families

- Builder: Claude, strong model, high effort — one lane, fresh packet-sized context. Escalated
  above the mid-tier default because this packet declares a security boundary with a live
  dependency (`### Effort tiers`).
- Auditor: Codex (GPT), different family from the builder, high effort — justified by the
  secret-exposure boundary, not by default. Launch `codex exec --sandbox read-only` unsandboxed
  locally (sandboxed it fails `Operation not permitted`; the default model is required, this
  account rejects `gpt-5.1-codex`). Supply the acceptance list and the candidate diff, not only
  prose. If Codex is unavailable non-interactively (as in SLICE-6N), Grok is the fallback per the
  bindings' `### Grok CLI on this Mac`; a second Claude is not independent review.

## Closeout

**PASS** — 2026-09-10. Full RESULT BLOCK, audit disposition, canary record, preflight and
read-set: `SLICE-6Q-LOG.md` → `## Accepted — 2026-09-10`.

## RESULT BLOCK

See `SLICE-6Q-LOG.md` → `## Accepted — 2026-09-10` → `### RESULT BLOCK`.

## Usage budget and handoff

Apply `AGENTS.md` → Slice protocol → Usage discipline.
- Each extra lane: none. Serial: all three owned files are proved by one focused test run, and a
  second worker would duplicate it for no independent deliverable.
- Assignment: one Claude worker, strong model at high effort, fresh packet-sized context. Reuse it
  for audit repairs here; its retained context is what makes them cheap.
- Evidence return: command, exit code, counts, candidate sha, one-line result, pointers to the job
  log and test output. No transcripts.
- Capability boundary: closeout runs once, after acceptance of this capability, not after each
  repair. Use completion notifications; do not poll an unchanged worker.
