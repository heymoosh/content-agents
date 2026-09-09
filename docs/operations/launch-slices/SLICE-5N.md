# SLICE-5N: the brand travels — GUI jobs and the reuse guard both stop assuming Human Inference

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Two places currently drop the brand and silently substitute Human Inference. After this slice
neither does.

**Half 1 — the GUI spawns brand-scoped skills without a brand.** `runAtomizeJob`
(`src/review/jobs.ts:2273`) builds the prompt `/atomize ${job.arg}` and `runVideoJob` (`:2285`)
builds `/video ${job.arg}`. Neither emits `--brand`. But `.claude/skills/atomize/SKILL.md:7-10`
and `.claude/skills/video/SKILL.md:7-10` each say, in identical words: *"Require one canonical
brand at entry: `human-inference`, `charles`, or `fiction`. Reject a missing or unknown brand.
There is no Human Inference fallback."* Both skills also scope their brief reads to
`briefs/<brand>/` and declare legacy top-level `briefs/` unassigned. So every job the Content room
starts today asks a skill to do brand-scoped work while withholding the brand.

The reason it cannot be a one-line fix: **the `Job` record has no brand field at all**
(`jobs.ts:1503-1528`). The brand has to be carried from the HTTP request, through `addJob`, onto
the job, and into the prompt.

**Half 2 — the reuse guard checks every brand's rows under Human Inference.**
`checkReuse` (`src/publish/reuse-guard.ts:77-81`) takes `brandId: BrandId = "human-inference"` and
passes it to `findLastPlacement`. Five of the six production callers pass a real brand
(`typefully.ts:352`, `tiktok.ts:181`, `substack.ts:186`, `cards.ts:273`, `youtube.ts:122` — all
`deliveryDecision.brand!`). One does not: `reuseGuardBlock` (`src/review/studio-scheduling.ts:430`)
calls `checkReuse(basename(folder), platform)` at `:433` and takes the default.

That is the Content page's own guard, on both of its paths — the Postiz pre-flight (`:575`) and
`runPublisher`'s recovery (`:486`).

## Difficulty

hard — Half 2 is small and mechanical. Half 1 is not: it adds a field to a persisted record, a
required parameter to two HTTP routes, and a new failure mode (a request with no brand), and it
touches the exact code path SLICE-5M just repaired.

## Depends on

SLICE-5M (accepted 2026-09-06) — its `resolveContinueArg` / `settleContinueRun` work is in
`jobs.ts` and this slice edits the same file.

## Owned files

Parallel-safe: **no — single lane.** The two halves do not share a path, but they share one
repo-wide `npx tsc --noEmit`, which cannot be lane-isolated: a lane typechecking mid-flight would
read the other lane's half-finished edits and report failures that belong to neither. The work is
also one idea (thread a brand that is already required), and it lands in one commit.

### Lane A — the brand travels, and can be seen

- `src/review/jobs.ts`
- `src/review/serve.ts`
- `src/review/page.ts`
- `src/review/studio-scheduling.ts`
- `src/review/jobs.test.ts`
- `src/review/develop.test.ts`
- `src/review/serve.test.ts`
- `src/review/studio-scheduling.test.ts`

Add a test file if the right home for a case is not one of the above. Do not rename or move
existing test files.

## Do not touch

- `.claude/skills/**` — the skills are the specification here, not the thing under repair. If a
  skill looks wrong, say so in the RESULT BLOCK; do not edit it.
- `src/publish/reuse-guard.ts` — its signature already accepts a brand and five callers already
  use it correctly. The defect is the caller.
- `src/publish/**` generally, `src/atomize/new-content.ts`, `.claude/worktrees/**`,
  `docs/content-studio-master-status.md`.
- `data/**` — never write real queue, analytics or schedule data from a test.

## Cited headings

none.

## The traps

**Trap 1 — do not put the brand in `job.arg`. It will look like it works and it will break the
Notes path.** `job.arg` is not a free-form command tail; three consumers parse it as data:

- `runVideoJob` (`jobs.ts:2286`) does `join(repoRoot, job.arg)` and `basename(job.arg)`;
- `runContinueJob` (`jobs.ts:2342`) hands it to `resolveContinueArg`, which parses
  `--continue <folder> [--cut <lens>]` and refuses anything outside `content/`;
- `addVideoJob` (`jobs.ts:2035`) dedupes queued jobs by `j.arg === arg`.

Appending `--brand x` to `arg` corrupts all three. The brand is a **separate field on `Job`**.

**Trap 2 — `runContinueJob` also spawns `/atomize`, and it is the path Muxin actually uses.**
`runContinueJob` calls `runAtomizeJob(job)` (`jobs.ts:2342` onward), so the Notes picker's
continue jobs inherit whatever `runAtomizeJob` emits. Its one production creator is
`serve.ts:1786`, `POST /api/notes/pick`. If you thread the brand into the atomize and video routes
and skip this one, you will have fixed the two paths Muxin uses less and left the one she uses
most emitting a brandless `/atomize --continue`. SLICE-5M repaired that exact path; do not
half-break it again.

**Trap 3 — enumerate the spawn sites, do not trust this list.** This project's signature bug is
reading that a route is *listed* and concluding it is *reached*, and the previous packet in this
series committed it. Before you finish, search `src/review/` for every place a brand-scoped slash
command is composed into a spawned prompt, and for every `addJob` / `addVideoJob` /
`addDevelopJob` call site. For each one, either thread the brand or write one line in the RESULT
BLOCK saying why it does not need one. `runDevelopJob` is the known example of the second kind —
`/develop` takes no brand — but verify that rather than taking it from here.

**Trap 4 — a stale default is worse than a failure.** `signalsBrand()` (`page.ts:5722`) is
`document.getElementById("signalsBrand")?.value || "human-inference"`, and that `<select>` lives
in the **Signals** sheet header (`page.ts:1232`), not in the Content room. The Content room
already reads it across rooms (`page.ts:3243` sends `&brand=`+`signalsBrand()`), so the value is
reachable — but it is a global the user sets somewhere else. Reuse that same accessor for
consistency; do not invent a second brand state.

## Decisions already made — implement these, do not re-litigate

1. **A request without a valid brand is refused, not defaulted.** Use the existing
   `requestBrand(value)` helper (`serve.ts:324-327`), which throws
   `brand must be one of human-inference, charles, fiction`. The skills forbid a Human Inference
   fallback; a server-side default would reinstate exactly that, invisibly. Refusal is unreachable
   in normal use because the client always sends a value — that is the point.
2. **The brand is visible on the job.** `publicJob()` is an explicit serialization allowlist;
   include the brand, and show it in the Jobs list the way the engine is already shown. A brand
   that travels invisibly is a brand Muxin cannot check.
3. **Half 2 passes the brand from the delivery policy, not from a new lookup.** At both
   `reuseGuardBlock` call sites a `DeliveryPolicyDecision` is already in scope — `deliveryPolicy`
   in `runPublisher` (`studio-scheduling.ts:476`) and `policy` in the Postiz branch (`:560-575`).
   Thread it in; match the five correct publishers' `deliveryDecision.brand!` shape.
4. **Not in scope:** adding a brand selector to the Content room's own header. That is a UI
   question for the owner. Note it in the RESULT BLOCK if the work makes the gap sharper.

## Acceptance

- [ ] `Job` carries the brand as its own field; `job.arg` is byte-for-byte what it was before for
      every kind (atomize, video, continue, develop, notes).
- [ ] `runAtomizeJob` spawns a prompt containing `--brand <id>` for the brand its job carries, and
      `runVideoJob` does the same, with the flag before the source, matching each SKILL.md usage
      line.
- [ ] A continue job created by `POST /api/notes/pick` reaches `runAtomizeJob` carrying its brand,
      and the spawned prompt contains both `--brand <id>` and the unmodified
      `--continue <folder>`.
- [ ] Every `addJob` / `addVideoJob` / `addDevelopJob` call site in `src/review/` either supplies a
      brand or is named in the RESULT BLOCK with the reason it does not need one.
- [ ] `POST /api/atomize`, the video route (`serve.ts:1699`) and `POST /api/notes/pick` each refuse
      a request whose brand is missing or not one of the three canonical ids, and the refusal names
      the three.
- [ ] The browser sends the brand on all three of those requests.
- [ ] The Jobs list shows which brand a job is running under.
- [ ] `reuseGuardBlock` passes a real brand to `checkReuse`, on both the Postiz pre-flight path and
      the `runPublisher` recovery path, and the two cannot drift apart.
- [ ] A test proves a `charles` row is checked against `charles` placements: with a Human Inference
      placement inside the window and none for Charles, the Charles row is **allowed**; with a
      Charles placement inside the window it is **blocked**. Assert the outcome — the verdict and
      the row's fate — not that an argument was passed.
- [ ] Persisted jobs from before this change still load. A job record on disk with no brand field
      must not crash the queue or the Jobs list; decide and state what it displays.
- [ ] No behavior change to `/develop`.

## Verify

Run each; report exit codes, not tail output.

```
node --import tsx --test src/review/jobs.test.ts src/review/develop.test.ts src/review/studio-scheduling.test.ts
node --import tsx --test src/review/serve.test.ts
npx tsc --noEmit -p tsconfig.json
```

`serve.test.ts` contributes 3 `listen EPERM: operation not permitted 127.0.0.1` failures when run
under a sandbox; those are environmental and unrelated to any diff. Run unsandboxed and say which
environment you used.

Note: `npm test -- <files>` does **not** narrow the run — the script appends named files to a glob.
Call `node --import tsx --test <files>` directly, as above. Do not run `npm run check`; the
coordinator runs the repository-wide gate once, last.

## Observable result

Muxin selects Charles in the brand control, picks a Substack Note in the Content room, and the job
that starts says it is a Charles job. The drafting subprocess receives `--brand charles`, reads
`briefs/charles/` instead of Human Inference's, and when that row is later approved the reuse guard
asks whether *Charles* has published this recently — not whether Human Inference has.

## Risk

medium — audit required: **yes**. It changes a persisted record shape, adds a rejection path to
three live routes, and edits the continue path SLICE-5M just fixed. The failure mode is quiet: a
brand that threads to four of five spawn sites looks entirely healthy until the fifth one drafts
Charles's post off Human Inference's brief.

## Families

- Builder: Claude, strong tier — one lane.
- Auditor: Codex (GPT), strong tier.

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list in the
RESULT BLOCK below before the slice closes.

```
bash scripts/repo-hygiene.sh --rescue
```
