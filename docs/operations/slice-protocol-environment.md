# Working protocol — environment and repository bindings

`AGENTS.md` → `## Slice protocol` is the source of truth for repository workflow. This file
holds only machine- and repository-specific bindings. It is required alongside an optional slice
packet when Muxin explicitly invokes orchestration. Normal requests do not load this file merely
because work could be described as a slice.

### Repo bindings

| Binding | This repository |
| --- | --- |
| Repository root | the worktree you were launched in — never switch to another checkout for implementation |
| Master document | `docs/content-studio-master-status.md`, orchestration only |
| Slice packets | optional orchestration briefs at `docs/operations/launch-slices/SLICE-<ID>.md` |
| Packet template | `docs/operations/launch-slices/SLICE-TEMPLATE.md` |
| Repository-wide gate | `npm run check` (typecheck + unit tests); in a fresh worktree run `npm run worktree:setup` first |
| Documentation-only gate | `git diff --check` plus session review for accuracy, links and rule consistency |
| Hygiene command | `bash scripts/repo-hygiene.sh --rescue --base main` |
| Closeout gate | none — record `PASS` or an actionable leftover list in the packet when one exists, otherwise in the final handoff |
| Integration rule | one session, one reviewed commit at a time, with the applicable gate passing before integration |
| Delivery boundary | branch `main`, private `origin` (`heymoosh/content-agents`); reviewed gated work may be pushed when delivery is in scope; no engineering delivery pull request or new hosted workflow without separate authorization; the scoped story editorial PR flow remains available |
| Non-negotiable product rules | extraction-first with only the exceptions in `CLAUDE.md`; nothing publishes without Muxin's review; generated copy follows `config/voice.yaml`; every paid model call is opt-in and logged; board writes use `prose_kanban`, never direct text edits |
| Live or authenticated model work | normally one authenticated canary per workflow and at most one retry; isolate Git, operational data, secrets, ports and model permissions |
| Machine facts | system `grep` is ugrep 7.5.0, so never combine `-q` with `-v`; there is no coreutils `timeout`; verify a piped `git pull` with `git status -sb` |

The repository has intentional hosted files for a manual diagnostic, secret scanning, scheduled
dependency review and Dependabot. Retain them. Do not add another GitHub Actions workflow without
separate authorization. This repository has no Vercel production project.

### Optional packet discipline

A packet is a brief, not a context prison or mandatory handoff. The owning session may read whatever
repository context it needs. Workers receive the paths and context needed for their bounded
assignments and never commit or integrate.

Files named `SLICE-<ID>.md` under `docs/operations/launch-slices/` stay under 12,288 B.
`*-LOG.md` history files, `SLICE-TEMPLATE.md`, and the existing
`SLICE-5L-coverage.md` companion analysis are exempt. Status and evidence remain pointers rather
than copied transcripts.

### Hygiene disposition

The hygiene command can exit nonzero because it reports another session's work, an integrated
branch awaiting cleanup, or a retained checkout. A nonzero exit is not itself a failure when every
listed item was reviewed and belongs outside the current session.

The handoff states all four facts: the command ran; its output was reviewed; every path this session
created was committed or deleted and named; every other listed path was named and left in place.
A bare exit code or the word "clean" is not enough.

Use `--base main`. Local `main` is the integration ref, while `origin/main` can lag until fetch
or push and falsely classify already integrated branches as unmerged.

### Closeout disposition

No closeout command exists in this repository. For runtime or tooling work, record `PASS` or an
actionable leftover list in the current packet when orchestration is active, otherwise in the final
handoff. Documentation-only work records its scoped review and diff-check result. The hygiene
command is a separate requirement and is never substituted for this record.

### Model routing on this Mac

Claude for frontend and Codex for backend are defaults, not rules. Choose the model and effort from
the work's risk and unanswered questions, optimizing total work to verified completion.

### Grok CLI on this Mac

Docker Desktop makes `/var/run/docker.sock` a symlink, so Grok's read-only sandbox refuses to
start. Use the local Grok CLI with `--sandbox workspace`; never call `grok_spawn_readonly` or use
`grok --sandbox read-only`. Use `grok_spawn_worker` only when a required plugin can explicitly
pass `sandbox=workspace`. Workspace access never authorizes edits during an audit.

For evidence-only CLI audits, work outside the repository. Allow only `read_file` with a
`Read(<exact evidence path>)` allow rule, use `--permission-mode dontAsk`, and disable subagents
and web search. Point the prompt at frozen evidence and require complete bounded reads. The prompt
must require: "Audit against the supplied requirements. Do not modify files. Cite path:line.
Separate established defects, verification gaps, and optional improvements. Answer the code-quality
question separately from the requirements question." Verify the exit status, complete verdict, and
unchanged candidate. Never disable sandboxing as a fallback.
