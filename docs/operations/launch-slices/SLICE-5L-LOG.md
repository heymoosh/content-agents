# SLICE-5L archive log

Moved sections from SLICE-5L.md, newest first.

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
