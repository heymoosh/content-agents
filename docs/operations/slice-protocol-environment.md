# Slice protocol — environment and repository bindings

`AGENTS.md` → `## Slice protocol` is the source of truth for the protocol's rules, and the master
document named below is the source of truth for status and decisions. This file holds only the
environment-, machine- and repository-specific detail that section points at. It is required
reading alongside that section and never overrides a rule stated there.

### Repo bindings

This table is the only part of the protocol that changes between repositories. Everything below
it is repository-neutral.

| Binding | This repository |
| --- | --- |
| Repository root | the worktree you were launched in — never `cd` to another checkout |
| Master document | `docs/content-studio-master-status.md` |
| Slice packets | `docs/operations/launch-slices/SLICE-<ID>.md` |
| Packet template | `docs/operations/launch-slices/SLICE-TEMPLATE.md` |
| Repository-wide gate | Documentation-only exception below; otherwise `npm run check` (typecheck + unit tests). Run it unsandboxed — under the sandbox it reports roughly 196 phantom venture failures. In a fresh worktree run `npm run worktree:setup` once first, or every command fails on missing `node_modules`. |
| Hygiene command | `bash scripts/repo-hygiene.sh --rescue` |
| Closeout gate | none — record `PASS` or the leftover list in the slice packet |
| Integration rule | one coordinator, one reviewed commit at a time, a passing applicable gate on the candidate before each integration commit |
| Delivery boundary | branch `main`, remote `origin` (`heymoosh/content-agents`). Merge is local-first: the recorded local gate result is the merge proof. Hosted CI is a manual diagnostic — never push merely to obtain a CI result. |
| Non-negotiable product rules | Extraction-first: never compose new claims, arguments, or worldview statements in Muxin's voice; text and image derivatives quote and trim verbatim and carry `source_lines`. The scoped exceptions (Content Studio treatments, common hook templates, video scripts, Build 3 Venture, Build 4 Charles) are enumerated in the root `CLAUDE.md` and never widen. Nothing publishes without Muxin's review in `review-queue.md`; committing generated content is not publishing. Generated copy follows `config/voice.yaml` — no em dashes, no AI tells. Prefer subscription and free model routes; every paid call is opt-in and logged to `data/cost-log.csv`. Never edit `docs/content-agents-backlog.md` as text — board writes go through `prose_kanban` only. |
| Live or authenticated model slices | Fix the verification budget before starting: normally one authenticated canary per workflow and at most one retry. Isolate Git, operational data, secrets, ports, and model permissions in a disposable harness. Preserve successful model output when later validation fails. |
| Machine facts that bite | System `grep` is ugrep 7.5.0: never combine `-q` with `-v` — count then test. There is no coreutils `timeout` binary. `git pull` piped through `tail`/`head` prints "Updating a..b" before a would-be-overwritten abort, so verify with `git status -sb`. |

### Packet cap scope

The 12,288 B packet cap governs files named `SLICE-<ID>.md` anywhere under
`docs/operations/launch-slices/`. Three kinds of file in that directory are exempt: `*-LOG.md`
siblings, which exist so a packet can move its dated records and stay small; `SLICE-TEMPLATE.md`,
the packet template itself; and `SLICE-5L-coverage.md` by name, exempt as companion analysis, per
SLICE-6E.

### Hygiene disposition

`bash scripts/repo-hygiene.sh --rescue` exits non-zero whenever it lists anything, including
another session's uncommitted work, merged-but-undeleted branches, or a stray checkout that this
slice did not create and the closeout rule forbids removing. A non-zero exit is therefore not by
itself a slice failure when every item the command lists is a path this session did not create.
A packet must not assert `scripts/repo-hygiene.sh --rescue` exits `0`; that form is unachievable
whenever other sessions have pending work, and mis-specifies the actual gate.

Assert instead, in the RESULT BLOCK, all four of: the command was run; its output was reviewed;
every path this session created was committed or deleted (name each one); every other path the
command listed was named and left in place (name each one). An exit code alone is not an
acceptable entry for this item.

### Model routing on this Mac

- Claude for frontend and Codex for backend are defaults, not rules.

### Grok CLI on this Mac

Docker Desktop makes `/var/run/docker.sock` a symlink. Grok `--sandbox read-only`
refuses to start on this machine. Use `--sandbox workspace` for Grok calls, including
audits; do not call `grok_spawn_readonly`. If a plugin is required, use
`grok_spawn_worker` only when it supports an explicit `sandbox=workspace` argument.

For a bounded audit, run from the intended checkout or disposable audit directory:

```sh
grok --sandbox workspace --no-subagents --disable-web-search --max-turns 3 --model grok-4.5 --prompt-file /absolute/path/audit-prompt.txt
```

The prompt must say: "Audit against the supplied requirements. Do not modify files.
Cite path:line. Separate established defects, verification gaps, and optional improvements."
Supply the acceptance criteria, candidate diff, changed-file list and focused check output;
request bounded excerpts for missing evidence. Workspace sandbox is not read-only enforcement:
inspect the diff afterward and never treat the sandbox choice as permission to edit.
Keep the input bounded; if Grok offloads a long prompt, allow enough turns to read it and
finish the audit. Verify exit status and an actual verdict before reporting audit completion.
This launch fix does not expand repository-export or implementation authorization.
