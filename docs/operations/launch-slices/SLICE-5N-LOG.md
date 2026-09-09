# SLICE-5N archive log

Moved sections from SLICE-5N.md, newest first.

## RESULT BLOCK — ACCEPTED 2026-09-07

**Outcome: PASS**, with one leftover that needs Muxin (see Unresolved).

**Changed paths.** `src/review/jobs.ts`, `serve.ts`, `page.ts`, `studio-scheduling.ts`;
`src/publish/reuse-guard.ts` (an additive test-root override, admitted under a coordinator
amendment during repair — see R1); tests `src/review/jobs.test.ts`, `serve.test.ts`,
`captures.test.ts`, and new `src/review/studio-scheduling.test.ts`.

**What shipped.** Half 1: `Job` gained `brand`, required by `addJob` / `addVideoJob` /
`addDevelopJob` / `addDevelopFolderJob`, validated at six HTTP routes via the pre-existing
`requestBrand`, sent from the client via `signalsBrand()`, composed into the spawned prompt, shown
in the Jobs list, and round-tripped through the durable store by a single `decodeJobBrand` used by
both rehydration paths. Half 2: `reuseGuardBlock` takes the brand from the already-resolved
`DeliveryPolicyDecision` instead of `checkReuse`'s `human-inference` default.

**Checks.** `npm run check` unsandboxed: **4278 pass, 0 fail, 489 suites**. `tsc --noEmit` exit 0.
`bash scripts/repo-hygiene.sh --rescue` exit 0, sole item this slice's own uncommitted work
(snapshot `43b7a19`).

**Audit.** Cross-family (Codex), two passes. Pass 1 returned DO NOT ACCEPT with three established
defects and two verification gaps; pass 2 confirmed R2 and R3 closed and found two further test
defects. Repairs ran two cycles, the protocol's bound.

- **R1** — the new suite wrote fixtures into the real `briefs/` tree and `rmSync`'d them, with
  nothing restoring their bytes. Latent only because no per-brand brief exists yet; it would have
  destroyed `bets.md`, the append-only placement log that prevents duplicate publishing. Fixed with
  an additive `CONTENT_AGENTS_TEST_BRIEFS_ROOT` override (the per-file
  `CONTENT_AGENTS_TEST_BETS_PATH` is still checked first and unchanged for all existing callers)
  plus a recursive sha256 byte-identity assertion against a module-load digest.
- **R2** — a recovered task job (`task: undefined`, no brand) fell past the brandless guard into
  `runAtomizeJob`, threw uncaught, and stranded the queue: job stuck `running`, `draining` set,
  execution lease held. Fixed by moving every branch into `dispatchJob` and settling exactly once
  from `drain()`'s `try/catch`.
- **R3** — `addDevelopJob`'s crash-recovery branch spread the durable record and cast to `Job`,
  letting `null`/junk survive. Now decodes through the shared decoder.
- **R4** — `/develop` does need a brand. See Unresolved.
- **R5** — the tests asserted the prompt just composed, not the argv built from it. Now driven
  through the real `buildEngineSpawn` with the full argv array asserted.
- Declined: `src/venture/deliver.ts:73` also takes the `checkReuse` default. True, but Venture maps
  to Human Inference and is not a cross-brand path. Out of scope.

**Spawn-site inventory (Trap 3).** Enumerated by the builder rather than taken from this packet,
which is what caught the `/develop` error below. Fiction, Charles, outreach and Venture jobs either
carry their identity intrinsically or spawn no brand-scoped skill. `/atomize`, `/video` and
`/develop` all now carry the brand, including the Notes picker path
(`runContinueJob` → `runAtomizeJob`) that this packet's Trap 2 flagged and the master doc had never
mentioned.

**Unresolved — one item, needs Muxin.**

`develop/SKILL.md` defines no `--brand` at entry: its step 0 reads the arg as the source
folder/URL/file, while line 57 of its body runs `npm run route -- --brand <brand>`. `atomize` and
`video` both carry an explicit entry contract; develop does not. `.claude/skills/**` is
write-protected by Muxin's own settings, so neither builder nor coordinator may edit it, and
neither routed around that protection.

Interim: `developSpawnPrompt` does **not** send a flag the skill does not define. The source stays
immediately after the command where step 0 looks for it, and the brand rides as a named
instruction naming the brand and the routing command that consumes it. Nothing ships broken.

To finish: give `develop/SKILL.md` atomize's entry contract, make step 0 read the source after the
flag, reconcile line 57, then flip `developSpawnPrompt` to the flag form.

**Two known limits, recorded rather than papered over.**

1. One layer of R5 is still uncovered: `runAgentSpawn`'s own
   `buildEngineSpawn(...)` → `runCommandSpawn(job, built.command, built.args)` linkage. Observing it
   needs either a real process (which appends to `data/cost-log.csv`) or a second seam below the
   first. The builder named it and stopped rather than inventing one, as instructed.
2. The R5 loop asserting `/--brand (charles|fiction)/` across all three kinds now matches develop's
   *prose* rather than a flag, since develop no longer sends one. It still proves the brand reaches
   the argv; it is a weaker assertion than its shape suggests, and it tightens on its own once the
   skill contract above lands.

**A defect the builder found in its own work and reported unprompted.** Its earlier claim that
`--continue content/<missing>` was "refused before any spawn" was false — `canonicalPath`
deliberately tolerates ENOENT, so the arg resolved `ok` and dispatched. Six real `claude` runs
reached `data/cost-log.csv` (untracked, gitignored, `$0` subscription rows, empty cost field,
labelled from the test fixture). Verified by me: the six rows stop at 01:38:21, before the fix; a
full `npm run check` afterwards added only `0.0000` stub-shaped `outreach:draft` and `step` rows,
the same pattern present the previous day. The rows were left in place — silently deleting entries
from a cost log to tidy test noise is worse than disclosing them.

**Process lessons.**

- This packet asserted `/develop` takes no brand. It was false, read off the skill's usage line
  instead of its body, and the builder reproduced the error because a packet claim reads as settled
  fact rather than as a starting point. **Second false packet claim in two slices, same cause.**
  Verify against the body of a source, never a usage line or heading, before writing it into a
  packet.
- The closure brief over-specified an isolation rule ("no reads or writes") and the auditor then
  marked a correct fix defective for satisfying the other half of the same sentence — the read was
  the byte-identity assertion the brief also demanded. State the hazard, not the mechanism.
