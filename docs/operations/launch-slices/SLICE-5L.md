# SLICE-5L: retire `/cycle`'s drafting step, but only for the input kinds the Content room provably covers

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

`/cycle` stops being a second front door for drafting. Step 3 ("New content", which runs the
`/atomize` skill flow) is removed for every input kind the Content room can demonstrably handle,
and `/cycle` becomes the ingest-and-strategy loop it already mostly is.

The deliverable is **a coverage proof followed by a retirement**, in that order. It is a legitimate
PASS to retire only part of step 3, or none of it, if the proof does not come out.

## Background — the trap in this slice

`docs/content-room-alignment-plan.md` § "The forced chain" states the dependency plainly:

> **Item 3 splits.** `/cycle`'s review and publish steps duplicate what the Content room already
> owns and can be retired immediately, dependent on nothing (**3a**). Its drafting step cannot be
> retired until Content can do what `/atomize` does, so **3b depends on the item 5 port**. Retiring
> drafting first would remove the only working path.

`.claude/skills/cycle/SKILL.md` repeats the warning in its own "Retired steps" section: "Drafting
(step 3) is still `/atomize` on purpose. It stays until the Content room can do what `/atomize`
does; retiring it before then would remove the only working drafting path."

The §5 port is closed. **It did not port everything.** Three capabilities were declined outright
(the scoring/soft gate, the home-brand thread-check, and the strategy-brief directives). So
"item 5 is done" does NOT establish "the Content room does what `/atomize` does." That inference is
the single way this slice ships a regression, and it is exactly the shape of error this project has
made three times: reading that a thing is listed as done and not checking what it actually does.

**Do not retire a step because a dependency is marked closed. Retire it because you demonstrated
the replacement path handles that input.**

## Difficulty

medium — the edits are small and mostly prose. The correctness lives entirely in the coverage
proof, which is research, not code.

## Depends on

none. §5 (the item 5 port) closed 2026-09-05. Item 3a (retiring `/cycle`'s review and publish
steps) has been done since 2026-09-02.

## Owned files

Parallel-safe: no — single lane. The coverage proof has to be finished before any retirement edit
is correct, so the two halves cannot run beside each other.

### Lane A — coverage proof and retirement

- `.claude/skills/cycle/SKILL.md`
- `docs/operations/launch-slices/SLICE-5L-coverage.md` (new — the proof table, see Acceptance)
- `src/publish/queue.ts` **only if** the coverage proof shows the `"from /cycle"` origin in
  `QUEUE_ORIGINS` (line 13) is left with no producer. Do not remove it merely because it looks
  unused: existing `review-queue.md` rows on disk carry that string and must keep parsing.
- the existing test files covering any file you change
- new test files alongside them

## Do not touch

- `src/review/jobs.ts`, `src/review/serve.ts`, `src/review/page.ts` — the Content room's own
  behavior is not in scope. This slice measures it; it does not change it. If the proof finds a gap,
  **record the gap, do not fill it.**
- `.claude/skills/atomize/SKILL.md`, `.claude/skills/strategy/SKILL.md`, `.claude/skills/video/SKILL.md`
  — `/atomize` remains a working skill invoked directly and by the Content room. This slice does not
  retire `/atomize`. It retires `/cycle` **calling** it.
- `src/review/studio-scheduling.ts`, `src/publish/cards.ts`, `src/publish/typefully.ts` — the
  delivery path (SLICE-5I/5J/5K) is settled and unrelated.
- `config/platforms.yaml`, `remotion/`
- `docs/content-agents-backlog.md` — board writes go through `prose_kanban` only, never as text.
- `docs/content-studio-master-status.md` — the coordinator updates it.
- `.claude/worktrees/**` — another session's checkout. Never edit or delete anything under it.

## Cited headings

- `docs/content-room-alignment-plan.md` → `### 3. Work made by /cycle is invisible in Content's approve step`
- `docs/content-room-alignment-plan.md` → `## Dependencies and running order`

Read those two sections and nothing else from that document.

## Acceptance

### Part 1 — the coverage proof (do this first, in full)

Write `docs/operations/launch-slices/SLICE-5L-coverage.md`. It is a table with one row per input
kind `/cycle` step 3 accepts today, and it must be built by reading the Content room's actual code
path, not its UI labels or its documentation.

Step 3's text is: "Ask Muxin if there's new content to atomize (**Substack URL, file, or voice
memo**) … For each, run the `/atomize` skill flow (text + quote cards). … **Video is separate:** for
any piece worth a short, offer to run `/video <folder>`."

- [ ] One row per input kind, at minimum: **Substack essay URL**, **local file**, **voice memo**,
      **Substack Notes** (the `/atomize notes` path), and the **`/video` offer**.
- [ ] Each row states: the Content-room entry point that handles it (file and line), what it
      produces, and the **evidence class** — one of `test` (a passing test exercises it),
      `code-path` (traced from the entry point through to a queue row, cited by file:line), or
      `unproven`.
- [ ] `unproven` is an allowed and expected answer. A row marked `unproven` is a finding, not a
      failure of this slice.
- [ ] The proof traces the **dispatcher**, not one candidate handler. A UI button labelled for an
      input kind is not evidence that the input kind reaches a queue row. Follow the value.
- [ ] For any kind the room does NOT cover, the row says what happens to a user who tries it in the
      room today — an error, a silent no-op, or nothing offered at all.

### Part 2 — the retirement (only what Part 1 earned)

- [ ] Step 3 is removed from `.claude/skills/cycle/SKILL.md` for every input kind Part 1 marked
      `test` or `code-path`, with the Content room named as where that work now happens.
- [ ] Any input kind marked `unproven` **stays in step 3**, narrowed to just that kind, with a
      one-line note saying it stays because the room has not been shown to cover it and citing the
      coverage doc.
- [ ] If every kind is `unproven`, nothing is retired, the skill file is unchanged except for a
      pointer to the coverage doc, and the RESULT BLOCK says so. **That outcome is a PASS.**
- [ ] The "Retired steps" section is updated to describe what is now retired and why, and keeps its
      existing standing warning against re-adding review and publish.
- [ ] `/cycle`'s remaining steps (1 ingest, 2 strategy, 4 wrap up) still read as a coherent skill
      after the edit — the wrap-up step must not summarize a drafting step that no longer runs.
- [ ] The skill's frontmatter `description` matches what the skill now does. **Do not rename the
      skill.** The alignment plan suggests "a name that says what they do"; renaming a command Muxin
      types, and which is referenced across a dozen docs, is a separate decision she has not made.
      Coordinator decision: out of scope here.

### Part 3 — nothing breaks

- [ ] Every existing test that references `/cycle` or `"from /cycle"` still passes. If one asserts
      behavior this slice removes, changing it requires a line in the RESULT BLOCK saying which and
      why.
- [ ] `QUEUE_ORIGINS` still accepts `"from /cycle"` unless Part 1 proves no producer remains AND no
      `review-queue.md` on disk carries it. Removing a value from that union is a parsing change,
      not a cleanup.
- [ ] Nothing in the diff changes what publishes or when. Rule 2 is untouched: rows still ship only
      on Muxin's `approve`.
- [ ] Nothing in the diff loosens extraction-first. This slice removes a drafting entry point; it
      must not alter what any drafting path is allowed to write.

## Intended approach

Do Part 1 completely and write the table before editing the skill file at all. The table is the
argument for the edit; an edit made first will bend the table toward itself.

For each input kind, start from the Content room's server entry (`src/review/serve.ts` routes) or
its job runner (`src/review/jobs.ts`) and follow the value to a `review-queue.md` row. Stop and mark
`unproven` the moment the chain needs an assumption. "The room has a button for it" and "a
dispatch table lists it" are both insufficient — this repository has recorded two separate incidents
where a listed route was not a reached route.

Deviate if the code makes this wrong, but say why in the RESULT BLOCK.

## Verify

Run the focused tests for anything you changed, then report the exact command and its exit code.
Start from:

```
node --import tsx --test src/publish/queue.test.ts src/atomize/content-request.test.ts
```

Call `node --import tsx --test` directly. `npm test -- <files>` does NOT narrow the run: the script
is `node --import tsx --test "src/**/*.test.ts"`, so named files are appended to the glob rather
than replacing it, and you get the whole suite while believing you ran two files.

Adjust the paths to the test files that actually exist or that you add. If the slice ends up
touching no `.ts` file, say so and report the typecheck instead: `npx tsc --noEmit -p tsconfig.json`.
Do not run the repository-wide gate — the coordinator runs it once, last, unsandboxed.

## Observable result

`.claude/skills/cycle/SKILL.md` no longer tells Claude to run `/atomize` for any input the Content
room was shown to handle, and `docs/operations/launch-slices/SLICE-5L-coverage.md` states, per input
kind, exactly which path replaced it and how that was proved.

## Risk

medium — audit required: yes. The edits are cheap and reversible, but the failure mode is silent and
delayed: retiring a drafting path the room does not actually cover leaves Muxin with no way to
atomize that input, and she would only discover it the next time she tried. Ask the auditor
specifically whether each retirement is supported by its cited evidence, and whether any row marked
`code-path` is really an assumption wearing a file:line.

## Families

- Builder: Claude, strong tier — the work is code archaeology and careful prose.
- Auditor: Codex / GPT, strong tier — different family. Receives the coverage table, the diff, the
  changed-file list and the focused check output only. Ask it to attack the coverage claims: for
  each retired input kind, is the cited evidence sufficient, or does the chain have a gap the
  builder walked past?

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in this
packet before the slice closes.

## RESULT BLOCK

- Changed paths: `.claude/skills/cycle/SKILL.md`, `docs/operations/launch-slices/SLICE-5L-coverage.md`
  (new). **No `.ts` file changed.**
- Outcome: **PASS, partial retirement.** `/cycle` step 3 is retired for the three input kinds the
  Content room was demonstrated to handle — Substack essay URL, local text/markdown file, pasted
  text — and kept for two it was demonstrated *not* to handle: voice memos and the `/video` offer.
- Checks run and results: `node --import tsx --test src/publish/queue.test.ts
  src/atomize/content-request.test.ts` exit 0 (47 pass, 0 fail); `npx tsc --noEmit -p tsconfig.json`
  exit 0; the repository-wide gate `npm run check` run once, last, unsandboxed — **4248 tests, 488
  suites, 0 fail, exit 0**, identical to the pre-slice baseline as expected for a no-code change.
- Audit: Codex/GPT, one round, one repair cycle. The audit returned **"do not accept as written"**
  with four established defects. It was right. Second cycle not used.

### The audit earned its keep — the first submission over-retired

Cycle 0 retired five input kinds. Two of those retirements rested on code paths that are **listed
but not reached** — the exact failure the packet was written to prevent, committed by the builder
in the same document where it correctly identified three other instances of it. The coordinator
verified all three headline findings against the source before acting on any of them.

1. **The `/video` retirement cited a button in dead code.** `page.ts:1534-1537` really does render
   "Generate storyboard", but it lives inside `rowEl` (`page.ts:1466`), which has **zero callers** —
   `grep -n "rowEl" src/review/page.ts` returns the definition and one comment. The live row
   renderer is `reviewScanRowEl` (`page.ts:1595`), called at `page.ts:1807`, and it renders "Open
   Focus Mode" instead. So `canGenerateStoryboard → button → POST /api/video/generate` does not
   connect, and retiring `/cycle`'s `/video` offer would have left no way to start a short.
   **Restored.**
2. **The Notes retirement asserted a room path with two live defects.** Step 3 never offered Notes,
   so nothing was removed — but the new prose claimed the room handled them. Claim withdrawn; the
   skill now asserts nothing about where Notes are handled.

The three surviving retirements are exactly the set the auditor independently confirmed as
connected code paths. That is why no second round was run: the repair only narrowed, and the code
the audit blessed is the code that shipped.

### Three production defects found and deliberately NOT fixed

The packet scoped this slice to *measure* the room, not change it ("record the gap, do not fill
it"). All three are recorded in `SLICE-5L-coverage.md` items 4-6 and want their own slice.

4. **`rowEl` is dead, and wider than first thought.** `onAction` is wired only at `page.ts:1590`,
   inside `rowEl`, so its `approve-media-plan` (`:1719`), `render-media` (`:1724`) and
   `attach-reviewed-media` (`:1729`) branches are unreachable too. Blast radius not measured.
5. **The GUI spawns `/atomize` and `/video` without `--brand`.** `runAtomizeJob` (`jobs.ts:2150`)
   sends `/atomize ${job.arg}` and `runVideoJob` (`jobs.ts:2163`) sends `/video <folder>`, while
   `.claude/skills/atomize/SKILL.md:7-8` and `.claude/skills/video/SKILL.md:7-9` both require a
   canonical brand and forbid a Human Inference fallback. `runDevelopJob` is unaffected —
   `/develop` declares no brand argument.
6. **A doubled `join` makes successful Notes jobs report failure.** `scaffoldContentFolder` returns
   an absolute path (`new-content.ts:125`), `serve.ts:1786` passes it as `--continue ${r.dir}`, and
   `runContinueJob` then does `join(repoRoot, parsed.folder)` (`jobs.ts:2220`), which concatenates
   rather than discarding. `continueArtifactCounts` inspects a directory that does not exist, both
   counts are zero, and the job reports "formatting ran but added no new rows or derivatives" on a
   run that worked. Reproduced empirically by the auditor with the real parser, not reasoned about.
   `stampFolderEngine` (`jobs.ts:2237`) sits in the same unreachable `done` branch, so the engine
   stamp is never written either. **This is the highest-value find in the slice** — it teaches the
   owner to distrust a feature that works.

### Four evidence errors corrected in the coverage document

Kept as corrections rather than silent rewrites, because the document's value is its citations:
the `/video` row's test citations did not support it (`content-generation.test.ts` fixtures carry
`media: []`); a caveat claimed picked Notes share the advisor acceptance gate, contradicting the
document's own Chain B; Chain A omitted its classification step (`page.ts:6781` checks other-room
keywords first, `page.ts:6967` calls server classification, and the "Wrong room?" control is the
override); and `jobs.ts:999` rejects any request carrying more than one short-video variant before
a queue write, which `content-request.ts:298` can trip with one control plus one treatment.

### Unresolved / leftovers

1. **Defects 4, 5 and 6 above are unfixed by design.** 6 is user-visible today.
2. **Chain A's last link is an LLM subprocess** (`/develop`), artifact-verified at `jobs.ts:2205`.
   Accepted as `code-path`: `/cycle` step 3's own path was the same kind of LLM run with *less*
   verification, so retiring it in favour of the room is not a regression in provability.
3. **The room asks one more human step than `/cycle` did.** It requires an accepted cut before the
   Configure button exists (`page.ts:3186` gates on `CW.approvedLens`), and `acceptAngle` refuses a
   card with no `source_lines` (`develop.ts:186`), so a thin advisor round can stall. Not
   input-kind-specific, and it is the room model working as designed — but "retired" here means
   "`/cycle` stops asking", not "the two paths are identical".
4. **No scoring and no thread-check on the configured path.** Deliberate: §5 declined both.
5. **The skill was not renamed.** The alignment plan floats "a name that says what they do";
   renaming a command the owner types is her decision, not the coordinator's.
6. `QUEUE_ORIGINS` untouched. `"from /cycle"` still has a producer (direct `/atomize` runs,
   `atomize/SKILL.md:513`) and live rows on disk in two content folders.
