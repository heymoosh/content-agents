# Handoff: multi-engine build, Claude session → next session

Written 2026-08-23 by the Claude Code session that produced `docs/multi-engine-plan.md`.
Read that plan first; this file is only the state and the gotchas, not the design.

Repo: `heymoosh/content-agents`, main checkout at
`/Users/Muxin/Documents/GitHub/content-agents`.

---

## 1. Where things stand

`main` is at **`e8d811b`**. Everything from the Studio v7 batch is merged: #375 through #383, plus
#377, #379 and #380.

Three PRs are open:

| PR | Branch | State | What it is |
|---|---|---|---|
| **385** | `docs/multi-engine-plan` | open, mergeable | The design this handoff belongs to. Docs only. |
| **384** | `test/studio-e2e` | **draft** | `npm run test:e2e` — a real Chromium driving the real server. 24 pass / 1 fail / 15 not-covered. Muxin decides whether to merge. |
| **358** | `feat/patterns-auto-collect` | **draft, conflicting** | Pattern-mining. **Do not touch** — another session is doing a research batch on top of it. |

Local worktrees that already exist (do not re-create):

```
content-agents-worktrees/wt-e2e          test/studio-e2e        999b606
content-agents-worktrees/wt-multiengine  docs/multi-engine-plan 338eab8
/private/tmp/claude/wt-mine              feat/pattern-corpus-v1     ← someone else's
/private/tmp/claude/wt-patterns-auto     feat/patterns-auto-collect ← someone else's
```

## 2. The blocker — read this before starting

**The main checkout is dirty and the changes are not ours.** It sits on `300cb30` (8 commits behind
`origin/main`) with ~24 uncommitted changes: Muxin's CLAUDE.md → AGENTS.md migration, in flight in
another session. It deletes `charles/CLAUDE.md`, `stories/CLAUDE.md`, `venture/CLAUDE.md` and edits
`AGENTS.md`, `CLAUDE.md`, `.orchestrator.json`, `.claude/skills/venture/SKILL.md`,
`.claude/skills/charles/SKILL.md`.

**Do not stash it, commit it, revert it, or build on top of it.** Work in a worktree off
`origin/main` instead.

That migration is a hard dependency, not an annoyance. Step 5 of the plan rewrites skill prompts to
name their `SKILL.md` file instead of relying on Claude Code's slash-command resolution, and it
touches the same two SKILL.md files the migration is editing. **Wait for it to land.**

## 3. What to do next, in order

Steps 1 and 2 are unblocked today. Everything from 3 on waits for the migration.

1. **Confirm how `grok` is billed on this machine.** No `GROK_API_KEY` or `XAI_API_KEY` is in the
   environment and it authenticates from a cached login (`~/.grok/auth.json`), which points at a
   subscription — but this was *not* verified. Ask Muxin or run `grok login` and read what it says.
   Do not read `auth.json` directly; it is credentials. Until confirmed, Grok is not advertised as a
   $0 route.
2. **Pin down `codex exec`'s approval flags.** It is the one argv builder in the plan that was not
   fully scoped: `-s/--sandbox <mode>`, `--output-last-message <FILE>`, `--json`. Decide which
   combination is the equivalent of `claude --permission-mode acceptEdits`.
3. Engine registry + `runAgentSpawn` — pure argv builders per engine, no behaviour change, every
   existing call site passes `"claude"`, suite stays green. Auto-merges.
4. Provenance: an `engine` field on derivative frontmatter, `artifacts.jsonl`, `decisions.jsonl`,
   `charles/review-queue.md`, `data/cost-log.csv`. Auto-merges.
5. Skill prompts name their SKILL.md. **Held PR** (changes what runs generate).
6. The GUI picker, one surface at a time: Charles → Develop → Content revise → Venture.
7. Extend the e2e slow lane to drive one job per engine, asserting it reaches `done` — the plumbing,
   never the prose.

## 4. The seam

Everything funnels through one place, `src/review/jobs.ts`:

```ts
export function buildClaudeSpawnArgs(prompt, opts): string[]   // pure, unit-tested
export function runClaudeSpawn(job, prompt, opts)              // → runCommandSpawn(job, "claude", …)
```

`runCommandSpawn`, the timeout/enoent/exit classification, the log tail, stop handling and the
answer hand-off are all engine-agnostic already and do not change.

Keep the new builders pure and unit-testable the same way — that existing test pattern is the model
to copy.

## 5. Environment gotchas that will cost you a round trip each

- **`npm test` must run with the sandbox OFF.** Under it, ~196 `src/venture/*` tests fail
  spuriously because tsx cannot open an IPC pipe. They are not real failures. Green is
  **2085 pass / 0 fail**.
- **`content-agents-worktrees/` is outside the sandbox write allowlist.** Every write there —
  `git worktree add`, heredocs, file edits, npm — needs the sandbox disabled. Symptoms look
  unrelated: `Operation not permitted`, `cannot create temp file for here document`.
- **A fresh worktree has no `node_modules`.** Run `npm run worktree:setup` (a plain `npm ci`) once.
- **`claude -p` in text mode prints only the final assistant message.** Intermediate output and all
  Bash stdout inside the run are discarded. This is why no `runClaudeSpawn` job can stream
  `STEP n/total` progress, and only `runCommandSpawn` jobs can. Verify whether `grok -p` and
  `codex exec` behave the same before promising per-engine progress.
- **The intake draft store is NOT worktree-isolated.** It lives at
  `~/.content-agents/venture-intake-drafts/<slug>.json`, keyed by slug, shared across every
  checkout. Everything else (`data/`, `venture/`, `review-queue.md`) resolves from
  `import.meta.url`, so a worktree isolates it.
- **Do not copy `.env` into a worktree.** If a route under test needs a secret, that is a finding to
  report, not something to work around.

## 6. Verifying your work

```
npm run typecheck          # must be clean
npm test                   # 2085 pass / 0 fail, sandbox OFF
npm run test:e2e           # only on the test/studio-e2e branch; run it in a DISPOSABLE worktree
```

`npm run test:e2e` writes for real by design (review-queue statuses, tracker events, a backlog card,
two seeded ventures) and is not idempotent.

## 7. Rules that will bite you

From `AGENTS.md` / `CLAUDE.md` at the repo root — read them, they are not optional:

- **Rule 1, extraction-first.** Text and image derivatives quote and trim Muxin's verbatim lines.
  Never compose new claims in her voice. Venture and Charles are scoped exceptions; the exemption is
  from *tracing*, not from truthfulness.
- **Rule 5, no em dashes** in any generated copy a human reads. There is a source-level guard test
  over the reader-facing modules (`src/review/signals.test.ts`) that parses with the TypeScript
  scanner and fails on U+2014 inside a string or template literal. Comments and regex literals are
  exempt by construction.
- **Rule 7, when to hold a PR.** Hold *only* changes to the code/prompts that decide what content
  says; those open as **draft PRs carrying an old-vs-new content sample**. Everything else
  auto-merges on green CI. For this build: the engine registry and provenance auto-merge; the skill
  prompt rewrite and the drafting surfaces are held.
- **Rule 6, cheapest acceptable route.** This build *improves* it by moving work onto subscriptions.
- **Nothing publishes without Muxin's review** in `review-queue.md`.

## 8. Open items this session did not close

- The one real e2e defect: on the survey-response screen, an unconfigured `RESEARCH_HASH_KEY`
  refuses with *"RESEARCH_HASH_KEY is required before research capture can write observations"* —
  correct to refuse, wrong words for a screen where she is transcribing a survey response. One-line
  fix, deliberately not applied.
- `captured_at` is only half-proven: undated items correctly stay undated, but no dated item was
  ever seen render, and the stamping path is behind the scout job.
- `venture-thread.ts:721` filters cards to `venture_phase === current_phase`, so a Phase 1 artifact
  is unreachable once a venture reaches Phase 3. Pre-existing, unfixed.
- `docs/venture-schema-contract.md` §2.2 lists Edit as an action with no route — now stale.
