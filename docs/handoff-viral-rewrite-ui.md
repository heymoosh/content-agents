# Handoff: the "make this viral" action needs a visible model picker

Written 2026-08-28 by the Claude Code session that built `npm run patterns:rewrite`
(branch `agent/pattern-creator-corpus-to-mechanism-proposals`, PR #405).
For the session working on the Studio UI. The backend half is done and on `main`; the surface is
yours.

## 1. What Muxin asked for

> "I'd want to be able to see which model is doing the viral adaptation, not be a hidden config
> setting I can't see. I'd want that in the UI."

and earlier, describing the whole feature:

> "we just store a simple prompt to give to grok or chatgpt (I can select the model, I'd hope) and
> click the 'make this viral' button."

So: one button on a draft, a model picker next to it whose current value is readable without
opening a config file, and the model that actually ran named on the result.

## 2. What already exists

| Piece | Where |
|---|---|
| The command | `npm run patterns:rewrite -- --draft <path> [--engine <id>] [--patterns] [--platform <p>] [--out <path>] [--brief-only]` |
| The stored prompt Muxin edits | `config/rewrite-prompt.md`, read at run time, never compiled in |
| Brief assembly | `src/patterns/rewrite-brief.ts` |
| CLI | `src/patterns/rewrite-cli.ts` |
| Grok adapter | `src/providers/analyst/grok-cli.ts` |
| Engine resolution with no Claude fallback | `getAnalystNamed` in `src/providers/registry.ts` |

It writes `<draft>.rewrite.md` (or `--out`), leaves the draft untouched, and publishes nothing. The
output file is gitignored (`*.rewrite.md`).

## 3. The engine mapping, which is the part that is easy to get wrong

The Studio's own engine ids (`src/review/engines.ts`) and this CLI's `--engine` values are **not the
same strings**:

| Studio `Engine` | `--engine` value | Offer it here? |
|---|---|---|
| `grok` | `grok-cli` | Yes, and it is the default |
| `codex` | `gpt-codex` | Yes |
| `claude` | — | **No.** `parseRewriteArgs` rejects it outright |

Claude is absent deliberately, in Muxin's words: *"Claude is terrible at this because it tends to
stick to what you originally wrote and it starts to lose the thread."* `getAnalystNamed` exists
precisely so this path cannot silently fall back to Claude the way the routed analyst does. The
picker for this action must offer two options, not three. If the room's shared engine picker is
reused, filter `ENGINES` down to `["grok", "codex"]` for this one action rather than passing
`claude` through and letting the CLI throw.

## 4. Where to plug in

The shape already exists. `src/review/serve.ts:548` runs `npm run scout` as a queued job:

```ts
await runQueued("scout", "Scout new leads (npm run scout)", async (job) => {
  const result = await runCommandSpawn(job, "npm", ["run", "scout"], { timeoutMs: SCOUT_TIMEOUT_MS, … });
  …
});
```

A `rewrite` job kind is the same move:

```ts
runCommandSpawn(job, "npm", ["run", "patterns:rewrite", "--", "--draft", draftPath, "--engine", cliEngine], { timeoutMs: … })
```

Notes for that wiring:

- **It is a job, not a request.** A real run took 40s to 3 minutes. Do not block a route on it.
- **`job.engine` already exists** on the `Job` record and is already displayed by the jobs strip.
  Set it from the picker so the running job says which model is working, which is half of what she
  asked for.
- **Timeout:** the adapter's own ceiling is 300s. Give the job a little more than that so the CLI's
  error message wins rather than the job's.
- **A rewrite writes into `content/`,** so it does not need the `claude` permission plumbing that
  the atomize-family kinds use. It is a plain npm spawn.

## 5. What to show her when it finishes

The result file's frontmatter is already the display record, so read it rather than recomputing:

```
source_draft: content/…/linkedin-1.md
platform: linkedin
engine: grok-cli          ← the model that actually ran
cost_usd: 0.0521
patterns_offered: 3 openers, 19 structures   (or "none")
voice_findings: 0
review_status: pending
```

The body is three sections, in order: `## Rewritten post`, `## What changed`, `## Blanks to fill`.
A side-by-side of the draft and the rewritten post is the natural view; `What changed` reads as the
model's rationale, and `Blanks to fill` is a to-do list for her (bracketed blanks like
`[my number here]` are deliberate: the prompt forbids inventing a fact she did not write).

`voice_findings` above 0 means the post-check caught an em dash or a known AI tell in the model's
output. Surface it; do not hide it.

## 6. The iterate affordance

`--patterns` appends the corpus inventory (opening shapes from `config/hook-frames.jsonl`, structural
patterns from the staged mechanism proposals) to the same prompt. It is the "give me more ideas"
lever for a second pass, not the opening move: the first pass is deliberately just the stored prompt
and the draft, because a capable model restructures prose unaided.

In the UI that is a second button or a checkbox on a re-run, labelled as more ideas rather than as
better output. There is no evidence it produces a better rewrite; it produces a differently-informed
one.

## 7. Cost, and what the cost log will and will not show

- **Grok bills per token.** A real run costs roughly $0.05 to $0.11. The CLI logs it to
  `data/cost-log.csv` itself (step `patterns:rewrite`) — do not log it twice from the job layer.
- **Codex is subscription-backed and reports `costUsd: 0`,** so nothing is written to the cost log
  for a `gpt-codex` run. That is correct, not a bug. If the UI shows a running cost, a $0.00 next to
  a GPT run is the honest number.

## 8. Things not to do

- **Do not add Claude to this picker**, however tempting the fallback. See §3.
- **Do not flip `config/hook-frames.jsonl` entries to `review: approved`.** They are `pending` on
  purpose and the rewrite path already includes pending frames. Approving frame content is Muxin's
  call and separate from shipping the code.
- **Do not treat the rewrite file as an artifact to publish.** It is a proposal. Nothing in
  `review-queue.md` should point at it until she copies something out of it herself.
- **Do not move the corpus.** An earlier lane recommended `git rm`-ing the tracked creator-content
  Markdown; that is obsolete, because these CLIs read those files live at run time.

## 9. Tests that must stay green

`src/patterns/rewrite-brief.test.ts`, `src/patterns/rewrite-cli.test.ts`,
`src/providers/analyst/grok-cli.test.ts`. The CLI test injects `analyze`, so nothing there calls a
real model; keep it that way.
