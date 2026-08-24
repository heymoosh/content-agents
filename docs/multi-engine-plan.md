# Any agent, one desk: running the studio on Claude, Grok or GPT

**Status: designed, not built.** Blocked on the CLAUDE.md → AGENTS.md migration landing first
(see [Sequencing](#sequencing)). Decisions below are Muxin's, recorded 2026-08-23.

## What Muxin asked for

> I also want the ability to use ANY agent (grok, chatgpt, or claude) whenever it comes to creating
> content, or running through the venture studio steps, etc. That way I can test out different
> writing styles and thinking styles. Of course they all write to a shared set of data all other
> agents can pick up from.

Her decisions on the three open calls:

| Question | Her answer |
|---|---|
| Which surfaces first | **All four**: venture studio steps, content drafting + revise, Charles, Develop |
| How to pick the engine | **A per-run picker in the GUI**, so the same input can go through two engines back to back |
| Venture judgment steps too, or drafting only | **Judgment too** — she wants different *thinking*, not just different prose |

## The half that already exists

The shared-data requirement is **already met**, and it is worth being precise about why, because it
decides how small this build is.

Every contract in this repo is a file, and every rule about those files is enforced by code rather
than by the model's goodwill:

- Venture state is `canon.md` plus append-only `decisions.jsonl` / `artifacts.jsonl` / `responses.jsonl`.
  Checkpoints gate on those files; `venture-writes.ts` refuses a malformed write; a selected decision
  is immutable.
- Content derivatives are markdown with `source_lines` frontmatter, validated by `npm run validate`.
- Review state is `review-queue.md`; publishing reads it and nothing else.
- Generated prose passes the em-dash guard and the voice rules on the way out.

So a Grok-written artifact and a Claude-written artifact are the same kind of object, and the next
agent picks up from the file, not from a conversation. **Nothing in the data layer needs to change.**
The scope here is *dispatch* and *provenance*, and the plan should not grow past that.

There are also two precedents to extend rather than invent around:

- **Per-stream engine choice already ships.** Build 2 fiction reads `prose:` from each series'
  own `series.yaml` (`claude-native` by default, `grok-openrouter` when a series opts in).
- **Engine fallback with honest reporting already ships.** `config/providers.yaml` sets
  `analyst: routed`, which runs the local Codex CLI on the ChatGPT subscription and falls back to
  `claude-cli`, and the GUI shows which engine actually answered.

## The crux

There is exactly one seam. Every model-backed action in the GUI funnels through
`runClaudeSpawn` (`src/review/jobs.ts`), which is a thin layer over `runCommandSpawn`:

```ts
return runCommandSpawn(job, "claude", buildClaudeSpawnArgs(withAnswer, opts), opts);
```

One hardcoded binary, one pure argv builder. That is a good seam.

The actual difficulty is not the binary, it is **the prompt**. Today `runAtomizeJob` sends the
literal string `/atomize <arg>`, and `/atomize` is a Claude Code slash command — a host feature that
resolves to `.claude/skills/atomize/SKILL.md`. Grok and Codex have no idea what `/atomize` means.

The fix is to stop relying on the host to resolve the skill and name the file instead:

> Read `.claude/skills/atomize/SKILL.md` and carry it out for `<arg>`.

All three CLIs are agentic and can read a file and follow it. This is also why the AGENTS.md
migration is the enabler and not a side quest: it is what makes the repo's standing instructions
legible to an agent that has never heard of `CLAUDE.md`.

### The three CLIs, verified on this machine

| Engine | Binary | Headless form | Approval flag | Notes |
|---|---|---|---|---|
| Claude | `claude` 2.1.241 | `claude -p "<prompt>"` | `--permission-mode acceptEdits` | today's only engine |
| Grok | `grok` 1.0.5 | `grok -p "<prompt>"` | `--permission-mode acceptEdits` | flags are deliberately Claude-Code-shaped, incl. `--allow` / `--tools` / `--output-format` |
| GPT | `codex` 0.147.0 | `codex exec "<prompt>"` | `-s/--sandbox <mode>` | already used for the `analyst` capability |

Grok's CLI carries "compat alias" flags matching Claude Code's names, so its argv builder is close
to a copy of the existing one. Codex is the odd one out: `exec` subcommand, `--sandbox` instead of
`--permission-mode`, `-o/--output-last-message` for capturing the final message.

## Design

### 1. An engine registry, not an if-chain

Generalize the existing pure builder into one builder per engine, keeping it unit-testable without
spawning anything (the current `buildClaudeSpawnArgs` test pattern carries over unchanged):

```
src/review/engines.ts
  export type Engine = "claude" | "grok" | "codex";
  export function buildEngineSpawn(engine, prompt, opts): { bin: string; args: string[] }
```

`runClaudeSpawn` becomes `runAgentSpawn(job, engine, prompt, opts)`. Everything downstream —
`runCommandSpawn`, the timeout/enoent/exit classification, the log tail, the stop handling, the
answer hand-off — is engine-agnostic already and stays exactly as it is.

### 2. The prompt is identical across engines

The engine changes the binary. It never changes the words.

This matters twice. It is the only way a style comparison means anything — same instruction, same
source, different model. And it keeps the diff honest under CLAUDE.md rule 7: the plumbing changes,
the content-generation prompts do not.

### 3. Provenance is the feature, not a nice-to-have

"Test out different writing styles" is unanswerable unless every output records who wrote it. Add an
`engine` field wherever a generated thing is recorded:

- derivative frontmatter, beside `source_lines`
- venture artifact records (`artifacts.jsonl`) and decision records (`decisions.jsonl`) — the latter
  is what makes "judgment too" legible later
- `charles/review-queue.md` rows
- `data/cost-log.csv`, including for `$0` subscription runs — `src/discovery/discover.ts` already
  logs `costUsd: 0`, so free runs appearing in the cost log is established practice

Without this, two months from now there is no way to answer "which of these did Grok write."

### 4. The picker

A small engine selector on the action itself, defaulting to Claude, on: the Content room's revise,
Studio's Develop, the Charles draft action, and the Venture room's phase actions. It posts an
`engine` field with the existing request; the route passes it to `runAgentSpawn` and stamps it on
the output.

The honest-UI rules apply: the picker shows only engines whose CLI is actually installed and
authenticated, and a failed run says which engine failed rather than a generic error.

## Cost

Rule 6 asks for the cheapest acceptable route, so this is a genuine improvement rather than a
regression: it moves work **onto** subscriptions.

- `claude -p` — Claude subscription, $0 marginal.
- `codex exec` — ChatGPT subscription, $0 marginal. Already how the `analyst` capability runs.
- `grok -p` — **needs confirming.** This install has no `GROK_API_KEY`/`XAI_API_KEY` in the
  environment and authenticates from a cached login (`grok login` / `grok logout`, credentials in
  `~/.grok/auth.json`), which points at a subscription rather than per-token billing. Confirm before
  the picker offers Grok as a $0 route. If it turns out to be key-based, it stays opt-in and logged,
  exactly like the existing `prose: grok-openrouter` adapter.

Note this build also makes the *existing* paid path avoidable: fiction's Grok prose currently bills
per token through OpenRouter, and a subscription-backed `grok -p` would be the cheaper route to the
same voice.

## Rule 7

Letting a different engine draft in Muxin's voice changes what future runs generate, so the drafting
half is a **held draft PR with an old-vs-new sample**.

That requirement is not friction here — it *is* the thing she asked for. The required sample is the
same source drafted by Claude and by Grok, side by side in the PR description. The existing
`docs/bakeoffs/` convention is where a fuller comparison belongs; no new harness needed.

The engine registry and the provenance stamping on their own are plumbing and reporting, and
auto-merge normally.

## Sequencing

1. **Muxin's AGENTS.md migration lands.** It is in flight in the main checkout and touches
   `AGENTS.md`, `.claude/skills/venture/SKILL.md` and `.claude/skills/charles/SKILL.md` — the exact
   files this work builds on. Nothing here starts before it merges.
2. Confirm how `grok` is billed on this machine.
3. Engine registry + `runAgentSpawn`, no behaviour change: every existing call site passes
   `"claude"` and the suite stays green. Auto-merges.
4. Provenance (`engine` field) everywhere listed above. Auto-merges.
5. Skill prompts stop depending on slash-command resolution and name their SKILL.md file. Held —
   this changes what runs generate.
6. The GUI picker, one surface at a time: Charles first (no Muxin-voice risk, and comic timing is
   where engines differ most), then Develop, then Content revise, then Venture.
7. Extend the e2e suite's slow lane to drive one job per engine and assert it reaches `done` —
   asserting the plumbing, never the prose.

## Not in scope

A router that picks an engine on its own, cross-engine "consensus" drafting, and any change to the
data contracts. The engine is Muxin's choice per run, and the files stay exactly as they are.
