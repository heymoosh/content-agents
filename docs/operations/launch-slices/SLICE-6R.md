# SLICE-6R: the six remaining agent-CLI spawn sites stop inheriting `.env` secrets

Protocol: `AGENTS.md` → `## Slice protocol`, plus the bindings in
`docs/operations/slice-protocol-environment.md`. Read those and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Every agent-CLI child this repository launches receives the ambient environment minus exactly the
keys `src/util/env.ts` injected from `.env`. 6Q closed that hole for `runAgentSpawn`
(`src/review/jobs.ts`) only; its Codex audit named six other files that still hand a model CLI the
full `.env`. When this slice is done all six pass `withoutDotenvKeys()` as the child `env`, a real
child proves it observably for both mechanisms (`spawn` and `execFile`), a source guard stops a
regression, and one authenticated CLI run per family (`claude`, plus one non-`claude` engine)
still works with `.env` stripped.

The six sites, all already located:

| File | Line | Mechanism | Note |
| --- | --- | --- | --- |
| `src/atomize/reply-draft.ts` | 133 | `spawn("claude", …)` | no `env` option today |
| `src/outreach/research.ts` | 392 | `execFileP("claude", …)` | already sets `env: { ...process.env, OUTREACH_SEARCH_BUDGET_COUNTER_FILE, OUTREACH_SEARCH_BUDGET_TOTAL }` — both extra vars must survive |
| `src/providers/polish/claude-cli.ts` | 41 | `execFileP("claude", …)` | no `env` option today |
| `src/fiction/continuity.ts` | 252 | `execFileP(command, args)` | engine CLI (`claude`/`grok`/`codex`/`ollama`) |
| `src/fiction/idea-inbox.ts` | 347 | `spawn(built.command, …)` | engine CLI |
| `src/fiction/review-pr.ts` | 365 | `spawn(built.command, …)` | engine CLI |

`src/fiction/review-pr.ts:21` is a `git`/`gh` exec, not an agent CLI. It keeps the full
environment; a `.env`-sourced `GITHUB_TOKEN` is exactly what it needs.

## Difficulty

hard — six lines of edit, but it changes how six real subprocesses are launched, and stripping a
key a non-`claude` CLI authenticates with would break a workflow silently. The cost is proof, not
code.

## Depends on

6Q (accepted, `3120a77`) — it exports `withoutDotenvKeys()` / `dotenvInjectedKeys` from
`src/util/env.ts`. No dependency on 6L, 6M or 6O; this slice touches no GUI page.

Delivery batch: 6R alone. Deliverable: implementation plus its verification. Stop condition —
the six sites are narrowed, the checks below pass, and both canary families are recorded. A free
slot does not authorize pulling 6M or 6O into this session.
Owner checkpoint: none. Scope is fixed by the 6Q audit's named list; the engine-canary
unavailability rule is decided below, not a question for the owner.

## Owned files

Parallel-safe: no. The split considered was claude-trio / engine-trio, rejected because both
lanes' behavioral proof lands in one new file (`src/util/env.test.ts`) and both draw on the same
authenticated-canary budget, so write ownership is not disjoint. Each lane is also a one-line
edit, so a separate assignment would add a handoff without an independently shippable
deliverable.

### Lane A — sole lane

- `src/atomize/reply-draft.ts`
- `src/outreach/research.ts`
- `src/providers/polish/claude-cli.ts`
- `src/fiction/continuity.ts`
- `src/fiction/idea-inbox.ts`
- `src/fiction/review-pr.ts`
- `src/util/env.test.ts` (new)

## Do not touch

- `src/util/env.ts` — 6Q's helper is the contract; consume it, do not change it.
- `src/review/jobs.ts`, `src/review/jobs.test.ts` — 6Q owns them and they are already correct.
- `src/review/engines.ts` — argv assembly, not environment; unchanged.
- `src/fiction/review-pr.ts:21` (`git`/`gh` exec) and every non-agent `spawn`/`execFile` in the
  repository.
- `.env`, `data/`, `config/`, any GUI page, any board file.

## Cited headings

`docs/content-studio-master-status.md` → `## Standing constraints`

## Acceptance

- [ ] Each of the six files listed in `## Goal` passes a child environment derived from
  `withoutDotenvKeys()` at the named spawn site, and imports it from `src/util/env.js`.
- [ ] `src/outreach/research.ts` still sets `OUTREACH_SEARCH_BUDGET_COUNTER_FILE` and
  `OUTREACH_SEARCH_BUDGET_TOTAL` on the child, with the same values as before.
- [ ] `src/util/env.test.ts` exists and contains a `spawn` test and an `execFile` test that each
  launch a real `process.execPath -e` child under `withoutDotenvKeys()` and assert, from the
  child's own printed `Object.keys(process.env)`, that no key in `dotenvInjectedKeys` is present
  and that `PATH` is present. If `dotenvInjectedKeys.size === 0` at run time the test fails with
  a message naming the missing `.env`, rather than passing vacuously.
- [ ] `src/util/env.test.ts` contains a source guard that reads all six files and fails naming any
  file whose agent-CLI spawn site does not reference `withoutDotenvKeys`.
- [ ] `node --import tsx --test src/util/env.test.ts` exits 0.
- [ ] `node --import tsx --test src/atomize/reply-draft.test.ts src/outreach/research.test.ts
  src/fiction/continuity.test.ts src/fiction/idea-inbox.test.ts src/fiction/review-pr.test.ts`
  exits 0, with per-file counts recorded and no count lower than its pre-change baseline.
- [ ] `npm run check` run unsandboxed exits 0 at 4374/4374, or every difference from that baseline
  is reproduced with this slice's changes stashed out and recorded as pre-existing.
- [ ] Canary 1 (`claude` family): one real `npm run script:draft` run over an existing
  `content/` folder completes normally under the narrowed environment, with its job identity,
  wall-clock and `$0` subscription route recorded.
- [ ] Canary 2 (non-`claude` engine): one real `grok` or `codex` continuity call completes
  normally under the narrowed environment, recorded the same way. If neither CLI is installed and
  authenticated on this machine, the three engine files
  (`src/fiction/continuity.ts`, `src/fiction/idea-inbox.ts`, `src/fiction/review-pr.ts`) are
  reverted and this slice ships the three `claude`-route files only, with the engine trio recorded
  under `## Stopped` as an unproven verification gap and a named next action.
- [ ] Each canary used at most one retry, and the RESULT BLOCK states the total canary count.
- [ ] `config/voice.yaml`, `review-queue.md` and `data/cost-log.csv` are unchanged by this slice;
  no content was generated or published (`## Standing constraints`).

## Verify

Classification and applicable gate: meaningful behavior / high risk. It changes what six real
subprocesses can read, it is security-relevant, and a wrong strip breaks a live workflow silently.
Focused outcome proof plus bounded cross-family review before integration. Not a UI change: no
journey, viewport, flag or browser evidence applies. Live integration is in scope and covered by
the two canaries; the unit tests are controlled local proof, not integration proof.

Retain per command: exact command, exit code, pass/fail/skip counts and reasons, candidate sha.
Run everything unsandboxed from the repository root with the real `.env` present; the sandbox
reports roughly 196 phantom venture failures and cannot read `.env`, which would make the
injected-keys assertion vacuous.

```
node --import tsx --test src/util/env.test.ts
node --import tsx --test src/atomize/reply-draft.test.ts src/outreach/research.test.ts src/fiction/continuity.test.ts src/fiction/idea-inbox.test.ts src/fiction/review-pr.test.ts
npm run script:draft
node --import tsx --eval "import('./src/fiction/continuity.js').then(async m => { const out = await m.callEngineContinuity('grok')('Reply with the single word OK and nothing else.'); console.log(JSON.stringify(out.slice(0, 200))); })"
npm run check
bash scripts/repo-hygiene.sh --rescue
```

Substitute `'codex'` for `'grok'` in the fourth command if `grok` is unavailable. Per the
bindings' Grok note, `--sandbox read-only` refuses to start on this Mac; the engine's own argv
assembly already handles this, so do not add sandbox flags by hand.

## Observable result

Six one-line diffs carrying the same helper call, one new test file, and a transcript pointer per
canary showing a real model CLI still authenticating and returning work with `.env` keys absent
from its environment.

## Risk

high — audit required: yes. Security-relevant subprocess environment change across six files; one
(`research.ts`) carries extra environment the fix must not drop, and three launch CLIs never
verified here under a stripped environment.
Review boundary: this candidate.
Review scope/budget: one bounded cross-family audit at medium-high effort over the six diffs, the
new test file and the check output. Unanswered questions to put to the auditor: (1) does any of the
six sites drop environment the child still needs, beyond the `.env` keys; (2) is the
`research.ts` counter/budget pair preserved byte-for-byte; (3) does the source guard actually fail
on a reverted site; (4) is any non-agent spawn caught by mistake. Delta re-audit only for
unresolved material findings.
Prior accepted evidence: 6Q's `runAgentSpawn` narrowing (`3120a77`, Codex PASS, canary
`job-1789065331989-1`) is retained and not reopened. It reopens only if this slice changes
`src/util/env.ts` or `src/review/jobs.ts`, which `## Do not touch` forbids.
On reviewer outage: do not integrate. Record the blocker, the retry condition and the frozen
candidate sha under `## Stopped`; independent authorized work is limited to this packet's own
evidence collection.

## Families

- Builder: Claude, strong model at high effort — the packet declares the work high-risk.
- Auditor: Codex (GPT family), medium-high effort. Different family from the builder, and the
  reviewer that produced this list in 6Q.

## Closeout

Closeout gate: this repository's binding is `none`. Record either a line beginning `**PASS**`
followed by the date, or an explicit list of what is left, in this packet before the slice closes.
No command belongs in this slot.

Preflight: the six paths above plus `src/util/env.test.ts` are the complete changed set; every
acceptance item maps to one of the commands, a canary transcript, or a named diff; every exit code
captured; cross-family audit obtained and material findings closed; both canaries recorded (or the
Canary 2 revert rule applied) before the final gate runs.
Gate cost: `npm run check` on the frozen candidate sha, unsandboxed. Measured local runtime
`unknown` until run; record it. One rerun only after a real repair, never to refresh paperwork.

Hygiene: run `bash scripts/repo-hygiene.sh --rescue`, then assert all four of — the command was
run; its output was reviewed; every path this session created was committed or deleted, each named;
every other path it listed was named and left in place. An exit code alone is not an acceptable
entry: the command exits non-zero whenever it lists another session's work.

Read-set measurement: use the `### Read-set measurement` commands in
`docs/operations/slice-protocol-environment.md`, substituting `SLICE-6R.md`.

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
- Each extra lane: none — serial, because a second lane would share `src/util/env.test.ts` and the
  one canary budget while carrying a one-line edit.
- Assignment: one Claude strong-model worker at high effort, fresh packet-sized context; reuse it
  for audit repairs. Frozen handoff at the candidate sha before the audit.
- Evidence return: command, exit code, counts, candidate sha, one-line result, and pointers to the
  two canary transcripts on disk. Do not paste transcripts into the RESULT BLOCK.
- Capability boundary: close out once, after both canaries and the final gate. Use completion
  notifications; do not poll unchanged progress.
