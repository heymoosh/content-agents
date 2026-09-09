# SLICE-5M archive log

Moved sections from SLICE-5M.md, newest first.

## RESULT BLOCK

**ACCEPTED 2026-09-06.** Closeout: **PASS**. Gate `npm run check` unsandboxed: **4260 tests, 488
suites, 0 fail**, exit 0 (up from 4248 — twelve new tests). `npx tsc --noEmit` exit 0.

- **Changed paths:** `src/review/jobs.ts`, `src/review/develop.test.ts`. `src/review/serve.ts`
  deliberately unchanged. No skill file, no publishing code, no `src/atomize/**`.
- **Outcome:** the defect is fixed and the room's Notes path now reports what actually happened.

### What was wrong with this packet

**The packet's central claim was false, and it was the coordinator's error, not the builder's.**
It stated there are two live producers of `--continue <folder>` and built its whole "trap" section
around protecting the relative one. `buildFormatArg` (`jobs.ts:2100`) has **zero production
callers** — verified during repair cycle 1 by grepping every call site: only its own definition and
tests. `addJob("continue", …)` has exactly ONE call site in the repository, `serve.ts:1786`, the
notes picker, absolute. The false claim came from trusting a status-document phrasing without
tracing a caller: this project's signature bug, committed inside the document written to prevent it.

The fix survives the correction — consumer-side normalization is right either way, and the relative
branch is cheap insurance — but the code and test comments that asserted "two producers" were
corrected to say what is true. `buildFormatArg` was **not** deleted; that is a separate decision,
and it belongs with the other dead-code findings in the master document's item (d3).

### The fix

Normalization lives at the **consumer**. `resolveContinueArg` (`jobs.ts:2205`) returns a three-way
`ContinueResolution` — `ok` / `refused` / `unparseable` — and `settleContinueRun` (`jobs.ts:2221`)
owns the verdict, extracted from `runContinueJob` so it is testable without spawning `claude`.

`serve.ts` was left alone on purpose: it hands the same string to the `/atomize` subprocess as
`job.arg`, and that subprocess already worked. Only the verification was broken. Rewriting the
producer would have changed what a working live spawn receives, in the one room Muxin publishes
from, to fix a bug that was never in the spawn.

The three resolution states are deliberately not two. `unparseable` keeps the historic escape hatch
(spawn, verify by exit code only, stamp nothing). `refused` fails the job **without spawning** —
`runContinueJob` settles it ahead of `runAtomizeJob`.

### What the audit caught, across three rounds

The cross-family auditor (Codex) returned "do not accept" **twice** before clearing it. Both
rejections were correct.

1. **Round 1 — the containment check the builder added created a false-success branch.** An
   out-of-tree folder resolved to null, and null was already the "cannot inspect, trust the exit
   code" branch, so `content/../evil` went from *failing on no growth* to *passing silently*. A
   guard that widened an escape hatch. Fixed by the three-way resolution above.
2. **Round 1 — containment was a string prefix test, so a symlink walked through it.** Reproduced:
   a symlink under `content/` got outside files counted and an outside file stamped
   `engine: codex`. Fixed by canonicalizing both sides first.
3. **Round 2 — `canonicalPath` treated every `realpathSync` error as "does not exist yet".** A
   dangling symlink and an `EACCES` both fell through to lexical acceptance. Now **ENOENT only**,
   with an `lstatSync` probe to separate a genuinely missing entry from a dangling link; anything
   else refuses. Containment that cannot be established is a refusal, never a fallback.
4. **Round 2 — the guard checked one path and handed the subprocess another.** `resolve()` collapses
   `..` before symlinks resolve, so `content/link/../marker` passed as `content/marker` while the OS
   would follow it to `outside/marker`. Killed at the class level rather than per-traversal: **any
   `..` segment is refused before resolution**, one condition, consistent with `parseContinueArg`
   already refusing `..` in a `--cut` value.
5. **Round 2 — the one test written to prove "no spawn" did not prove it.** It set
   `stoppedByMuxin: true`, which short-circuits earlier anyway, so it passed with the refusal branch
   deleted. That is the "assert the outcome, not the call" rule failing inside its own enforcement
   test. Rewritten against a live job, asserting on what an entered spawn observably leaves behind
   (`lastSpawn`, the job log, both written before the spawn).
6. **Round 3 — a test restored `process.env.PATH` as the literal string `"undefined"`** when it had
   been absent. Fixed to delete rather than assign.

### Scope calls made, and why

- **Containment was never in this packet.** The builder added it while fixing a path-shape bug, and
  every audit finding after round 1 was against that addition rather than the original defect. The
  defect itself — a working Notes job reporting failure — was fixed in cycle 0 and stayed fixed.
  Before pushing further, the producer surface was checked: one call site, argument generated by
  this codebase, no route and no user input. **This is correctness hygiene, not a security
  boundary**, and the builder was told so explicitly to stop it building defence in depth.
- **DECLINED — uppercase `CONTENT/slug` is refused on case-insensitive macOS.** Real and reproduced.
  No producer emits it, refusing is the strict-and-safe direction, and case-folding a containment
  check correctly across filesystems costs more than the case is worth. Accepted limitation.
- **DECLINED — the resolver's filesystem calls are not atomic** against a concurrent symlink swap.
  Theoretical; nothing local reaches it. No redesign.
- **DECLINED — `..` refusal also rejects legal-but-unusual filenames** containing a
  backslash-delimited `..`. No producer emits one.
- **RECORDED, NOT FIXED — `jobs.ts:86` joins an unrestricted `row.asset` onto the folder,** so an
  ordinary, properly contained folder can stamp a file outside the repository. Reproduced by the
  auditor. Pre-existing, different function, different surface, not in this slice's owned files.
  Filed as item (e) in the master document.
- **NOTED — the new `try/catch` around `stampFolderEngine` is a deliberate behaviour change.**
  Previously an exception escaped before the job settled. Swallowing matches the rule the
  atomize-family branch of `drain()` already applies to the same two stamp calls.

### Checks

- `npm run check` (unsandboxed, coordinator, once, last): **4260 / 488 / 0 fail**, exit 0.
- `node --import tsx --test src/review/develop.test.ts src/review/jobs.test.ts src/review/serve.test.ts`:
  249 pass, 0 fail. Under the sandbox `serve.test.ts` contributes 3 `listen EPERM` failures
  unrelated to this diff — a known machine fact, not a defect.
- Mutation checks, each fix reverted alone and confirmed to turn its own test red, then restored:
  the resolution line, the ENOENT-only guard, the `..` refusal, and the early refusal branch.

### Evidence locations

- Absolute producer, observable outcome plus engine stamp, fixture pinned to the real
  `scaffoldContentFolder`: `src/review/develop.test.ts:332`.
- Relative shape still resolving to the same directory (dead producer, kept as insurance):
  `develop.test.ts:424`.
- Genuinely empty run still reports no progress: `develop.test.ts` empty-run test.
- Out-of-tree refusal asserting `job.status` and `job.error`: `develop.test.ts:551` region.
- Dangling symlink and `EACCES` refused, not-yet-created folder still accepted: `develop.test.ts:551`.
- Non-null spawn failure beats real artifact growth: `develop.test.ts:470`.
- Refusal settles without spawning: `develop.test.ts:615`.

### Unresolved

Only the recorded out-of-scope item: `jobs.ts:86`'s unrestricted `row.asset` join, filed as master
document item (e).
