# Content Studio master status

## START HERE — next session (updated 2026-09-05)

**Repo to work in:** `/Users/Muxin/Documents/GitHub/content-agents`, branch `main`.
**This doc:** `/Users/Muxin/Documents/GitHub/content-agents/docs/content-studio-master-status.md`.
Continue in a fresh feature worktree based on local `main`, not an old slice worktree.

**This doc is the single source of truth for status + decisions.** Use
`docs/content-room-alignment-plan.md` only as the detailed design/reference specification for
room-model item 5; its top block redirects back here. Update this file whenever a slice lands,
is deferred, or its verification/audit decision changes.

**Read only this section to start.** Everything below it is history and reference; open a named
section only when this one cites it.

> ### ▶ NEXT ACTION (2026-09-05 handoff #10) — Lane-C item 5b: port validation
> Work from `main` in a fresh feature worktree. Lane A is fully merged: **P1 #442**, **P2 #455
> (`df02f09`)**, **item 1 #456 (`608f335`)**, and **item 2 #457 (`e53c6d3`)**. Decision 11's
> per-room queues (slices 1.5/2/3) are also complete. There are no open PRs.
>
> **Item 5a is DONE — `6a02b27` (2026-09-05).** `generateConfiguredContent` now consumes recorded
> `routing.md` decisions before model/media/output work, filters whole skipped platforms, keeps
> included control/treatment pairs, and stamps exploration probes. Source/request identities,
> provenance, and pending review remain intact. Routed-subset reruns and ambiguous community
> destinations have explicit, tested handling. **184 focused tests; final local check 4,158 tests /
> 484 suites / zero failures or skips; Claude cross-family audit PASS; isolated live canary PASS.**
> The first canary's behavior passed but its harness copied legacy logs; the corrected source-only
> Git/HOME-isolated retry passed with one current log and no historical copies. Both attempts and
> successful outputs are preserved; this workflow's live budget is exhausted. No push or PR was
> made for this slice. Evidence and mandatory next-builder checklist:
> `docs/evidence-content-routing-gate-2026-09-04.md`.
>
> **Build exactly item 5b next:** port the applicable existing `validate` gates into configured
> Content generation. Read `docs/content-room-alignment-plan.md` §5 and §Dependencies and running
> order, then delegate inspection of `src/atomize/validate.ts`, its tests, and the relevant
> generation/provenance seams. Map each gate and each room's scoped exception before editing.
> Do not combine this with the seven remaining item-5 capabilities. Acceptance: deterministic
> integration tests prove ported validation failures cannot leave partial output or review rows;
> valid origin-specific requests retain 5a routing, exact controls, provenance, and pending review;
> focused/fake-model tests, cross-family audit, bounded isolated canary, and local check pass.
>
> Use the bounded verification contract: early Claude architecture review, red/green + fake-model
> E2E, packet-only cross-family audit before canary, P0/P1 fixes only, and the final local check.
> Audit packets contain only this slice's requirements, diff, and test log. Close the linked
> checklist up front, especially parser/caller searches and actual full-launcher isolation tests.
> One existing routing file refuses an unsupported confidence value; this is recorded P2
> strictness, not permission to silently weaken routing or rewrite operational content.
>
> **Exit state:** item 5b has not started. Implementation `6a02b27`, evidence/handoff `571f39c`
> and `ab8f4b6`, plus the ledger record `1889296`, are all **pushed to `origin/main`** as of
> 2026-09-05; local `main` and `origin/main` are level and there are no open PRs. Committed
> evidence is under `docs/evidence/content-routing-gate-2026-09-04/`.
> Do not rerun item 5a's exhausted canary or push merely to obtain CI. Set a fresh, explicit
> verification budget for item 5b before starting it. No new product decision is needed to begin.
>
> **Open question for Muxin (2026-09-05, not blocking 5b):** a coordinator/worker workflow
> migration was proposed and is undecided — add `## Slice protocol` and `## Ending a session`
> to `AGENTS.md`, create `docs/operations/launch-slices/` for one-slice worker packets, and cut
> this START HERE block to ~15 lines of pointers with the narrative moved to a Progress log.
> Nothing has been built for it. Her new short start/end session prompts reference those section
> names and that directory, so they are inert until she approves the setup.
>
> **Handoff hygiene (2026-09-05):** root rescue ran; the two appended
> `data/notes-spread-ledger.jsonl` rows from the 2026-09-05 scheduled Notes run were committed as
> `1889296` (operational data, no behavior change) rather than left uncommitted. Working tree is
> clean, no untracked paths. Three stale `/private/tmp` worktrees for already-merged work
> (fiction-charles-editors, routing-gate-5a, venture-editor) were removed and the fully merged
> local branch `feat/content-routing-gate-5a` deleted. Three worktrees remain by design and were
> left alone: Codex's `~/.codex/worktrees/3728/content-agents`, `content-agents-worktrees/
> content-studio-master-status-recovery`, and `.claude/worktrees/content-studio-ui-recovery`
> (branch `agent/studio-functionality`). Five pre-existing local-only agent branches remain
> untouched (names under “Prior-slice handoff details” below). Primary checkout stays on `main`.
> Fresh root `npm run check` passed unsandboxed: typecheck and 4,158/4,158 tests, 484 suites,
> zero failures/skips (2026-09-05; exit 0).

### Prior-slice handoff details — history/reference only

The current next action and delivery state are in START HERE above. The following records explain
completed work; they are not instructions to reopen it.

> 0. **~~Build P2 — editor registry + un-fuse editor from provenance (decision 10b2)~~ — DONE, merged as
>    PR #455 (`df02f09`).** `CONTENT_EDITORS` registry keyed by
>    `request.origin` (studio/fiction/charles/venture, each its own prompt + voice rubric + `editor_pass`
>    stamp); the fused `treated && sourceLines` gate split into a pure `planConfiguredEditing()` returning
>    `{traceable, scannable, editor}`. Studio prompt moved in **byte-identical** (independently diffed vs
>    `main` + literal-pin test); studio stamp stays `cold-feed-v1` so `src/grow/experiment-slice.ts` is
>    untouched. `npm run check` unsandboxed **484 suites / 4111 tests / 0 fail** (coordinator-verified, not
>    just builder). Cross-family **Codex** audit returned FIX, but all three findings are seams P2
>    deliberately leaves for the *unbuilt* items 1/2 (venture branch still bypasses by design; Fiction/
>    Charles editors unreachable behind `assertConfiguredTreatmentPolicy`; no editor-dispatch integration
>    test seam yet) — re-scoped PASS. The former rule-7 hold was **retired 2026-09-04**; P2's one behavior
>    change is real:
>    a treated piece with **no `source_lines`** now gets an editor pass where before it got none.
>    Sample: `docs/evidence-p2-editor-registry-2026-09-04.md`.
>    - Muxin's prior editor-feedback record remains diagnostic only. The retired hold no longer blocks
>      merging #455; its verification and audit evidence are sufficient.
>    - **Audit → acceptance checklist the next builders MUST close:**
>      - **Item 1 (Venture): CLOSED in draft #456.** The dedicated Venture drafting branch now falls
>        through to `editing.scannable`; a treated Venture piece with no `source_lines` emits
>        `editor_pass: venture-social-v1` in a deterministic integration test and a preserved live canary.
>      - **Item 2 (Fiction/Charles):** when lifting the `jobs.ts:726` treated-policy block, **Charles must
>        NOT run through `muxinVoiceFindings()`** (rule-5 exemption) — add a per-editor `check` hook on
>        `ContentEditor`; acceptance = Charles output validated against `persona.yaml`, not voice.yaml.
>      - **Both:** add a deterministic editor-dispatch test seam (injectable editor output) + an integration
>        test through `generateConfiguredContent` proving editor selection + stamp emission per newly-reachable
>        origin (closes Codex finding 3; the untraced path has no disposable stand-in today).
>      - **Item 2 (Fiction/Charles): CLOSED.** Treated variants now reach `fiction-social-v1` and
>        `charles-social-v1`; the Charles check is independent of `muxinVoiceFindings()`. Focused,
>        full-suite, cross-family Grok audit, and one bounded authenticated Codex canary all passed.
>        Evidence and the new P2 acceptance checklist: `docs/evidence-fiction-charles-editor-2026-09-04.md`.
>
> Prior slices, for the record:
> 1. **~~Build slice 1.5~~ — DONE.** Branch `feat/capture-contracts-slice15`, four commits
>    (fd3268f 1.5a capture event-log + room projections; 7ca0d5f 1.5b Venture resolver + CAS answer
>    protocol; e07b0e1 1.5c Fiction two-store link + confirm-before-canon gate; 59289ec 1.5d Charles
>    durable output group + double-draft-safe run). Every sub-slice passed `npm run check`
>    (4100/4100) + a cross-family codex/GPT audit before commit. Self-vet merged (rule 7 untouched —
>    contracts/gates/classification, no prose). Checklist mapping under decision 11 below.
> 2. **~~Build slice 2 — Studio Start routing + Charles/Venture queues~~ — DONE.** Three sub-slices,
>    each `npm run check` unsandboxed green + cross-family codex audit, self-vet merged:
>    **2a #448 (`2e467a7`)** re-targeted Fiction's canon-approve one-click at slice 1.5c's
>    confirm-before-canon gate (captured non-chapter ideas only; chapters + legacy ideas keep the
>    direct path) + the Fiction bottom queue; **2b #452 (`1487a0b`)** the Venture bottom queue
>    (active-slug filter + open "which venture?" rows, CAS answer picker); **2c #453 (`fbd355c`)**
>    the Charles bottom queue + switching the composer from N per-mode `/api/charles/draft` calls to
>    one durable `/api/charles/group` run. All client-only over the 1.5 contracts; no prose logic.
> 3. **~~Build slice 3 — Charles combined-review layout~~ — DONE.** PR #454 (`92190d8`), one commit.
>    Groups Charles review outputs by durable `payload.groupId`: essay leads in a bounded scrollable
>    sub-window (max-height 320px) with an "Open in focus mode" trigger (saves via existing
>    `/api/charles/doc`); shorter outputs stack below by ordinal; legacy no-group posts fall back to
>    per-post pseudo-groups. Server (`page-charles.ts`) + client-script (`page.ts`) share
>    argument-only grouping/order/resume helpers, pinned by a test that runs BOTH copies. Resume
>    picks the lowest-ordinal drafted output and scrolls to it; ordinal order is deterministic
>    (missing/NaN last via `POSITIVE_INFINITY`, tie-break `postId`); a duplicate empty group row
>    can't shadow a later real one. `npm run check` unsandboxed green (484 suites / 4107 tests);
>    four-round cross-family codex/GPT audit ended PASS. Presentation-only, self-vet merged.
> 4. **Lane-A item 1 (Venture through the normal editor) — DONE, merged as PR #456 (`608f335`, 2026-09-04).**
>    The isolated stacked checkout `/private/tmp/content-agents-venture-editor` has branch
>    `feat/venture-editor`, commits `3b7b701` + `d7153de`, and targets `feat/p2-editor-registry`.
>    Venture's dedicated treated-draft path now runs the selected registry editor afterwards, including
>    guarded disposable drafting; treated output is stamped `editor_pass: venture-social-v1`. The focused
>    `generateConfiguredContent` suite passed **18/18**, unsandboxed `npm run check` passed, and
>    `git diff --check` passed. The single authenticated Codex canary is preserved in
>    `content/venture-editor-live-canary-20260904/`: it records the representative input, actual
>    pre-editor draft, edited result, live engine execution, no `source_lines`, and two pending-only rows.
>    Its review-facing old/new sample is `docs/evidence-venture-editor-2026-09-04.md`.
>
>    **Audit closure:** the prior Grok 4.6 high-effort audit's delivery-only FIX is closed. Its packet-only
>    Grok bridge failed on this Mac's sandbox profile, so an independent **Claude Opus** audit received the
>    slice requirements, diff, evidence, and test results only; it returned **PASS, no introduced blockers**.
>    Pass D browser E2E remains pre-existing: its two bounded attempts timed out at Studio Capture selector
>    `#captureVerdict:not([hidden]) .cap-go` before the Venture case, so do not retry it in this slice.
>
>    **Future-builder acceptance checklist (P2, not a merge blocker):** add a direct unauthorized-case test
>    for `disposableConfiguredEditorOutput()`, make a regression guard for any future
>    `engineExecution !== "disposable-injected"` editor skip, record exact canary command/timestamp when
>    changing this evidence protocol, and after the Capture selector defect is repaired run Pass D once to
>    confirm the GUI Venture case records `venture-social-v1`.
>
>    Item 2 (Fiction/Charles) subsequently merged as #457 (`e53c6d3`); Lane C item 5a is now
>    complete as `6a02b27`. Item 5b is next.
>    Decision 11's queue ladder is complete; no decision-11 slice remains.
>
> **Rule 7 (settled):** all slices merge after their scoped local verification and required audit pass.
> Content-generation logic retains its stronger test, canary, and cross-family audit requirements; it no
> longer waits for separate PR review. Human approval before publishing remains unchanged.
>
> **Repo gotchas:** run `npm run check` UNSANDBOXED (sandbox = phantom failures + EPERM); client JS
> lives in a `<script>` template literal so regex backslashes MUST be doubled (`\\s`), enforced by
> `page.test.ts`; Fiction route tests MUST set `CONTENT_AGENTS_HOME` or they write the real inbox.
>
> **Historical branch inventory, rechecked at handoff #10 (2026-09-05):** the rescue script listed
> the same 5 pre-existing local-only agent branches from
> 2026-08-24→27 (`agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
> `agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`,
> `agent/cs6-parallel-safe-ui-completion`) — prior-session work, unclassified, left untouched; verify
> against merged history before deleting or resuming any of them.

### Standing authorization (settles the old "nothing is approved to build" gate)

Muxin owns *what* gets built, and she has already said it: **work through this document.** She does
not pick starting items, sequence lanes, or approve mechanics — that is the agent's job. Earlier
revisions of this doc froze `src/review/jobs.ts` "until she picks a starting item"; that freeze is
**lifted**. The order below is not a preference, it is forced by the code (see "Room-model
execution order"), so there was never anything for her to choose.

No PR-specific review hold remains. Content-generation logic retains its stronger verification and
cross-family audit requirements; publishing still requires Muxin's normal content approval.

### Do this next, in this order

**No open PRs. Start by building, not by triage.** The rest of the 2026-09-03 queue was resolved
that day; what happened is under "PR hygiene" below, and you do not need it to begin.

**Lane A and decision 11's per-room queues are complete. Continue Lane C's item-5
capability ports from the current START HERE handoff.**

- **P1 is DONE and MERGED — PR #442** (`c6842cd`, rebased onto `main` 2026-09-03). It deleted
  `CONFIGURED_PLATFORM_LIMITS` and resolves platform character limits from `config/platforms.yaml`
  via a memoized `configuredPlatformLimit()`. It was a **pure identity refactor** — for every
  platform reachable as a `variant.platform`, config `max_chars` equals the retired table value (or
  both absent); `quote-card` is a media type, never a platform, so its 180-char config limit cannot
  introduce a new gate. A regression test pins the values. Merged after Muxin confirmed it needed no
  hold under the then-current rule 7. **P2 subsequently merged as #455; the separate
  content-generation review hold was retired on 2026-09-04.**
- **Item 4 (Fiction leg) is DONE and MERGED — PR #443** (`d682d77`). Studio Start
  (`POST /api/captures/start`) now takes an optional `room` (default `"Content"`, backwards
  compatible) and, for `room: "Fiction"`, lands the capture as a **durable inbox idea** via the
  existing `createIdea()` — `needs-review`, **no model job runs**. The client Fiction branch calls
  Start instead of prefilling `#ficIdea`. Verified by an isolated HTTP integration test
  (`CONTENT_AGENTS_HOME` sandboxed so it never touches the real fiction inbox) that also asserts no
  job is enqueued and the idea stays unclassified, plus two cross-family audits (grok SHIP; codex
  FIX on test strength, applied). Not logic → self-vet merged.
  - **Correction to the plan's premise:** a routed capture is **not** lost on reload.
    `takeCaptureTo` already saves it via `POST /api/captures` before advancing, so every capture
    persists in `studio-captures.json` tagged with its room. The real gap was **promotion into the
    room's own item type**, which item 4 now closes for Fiction.
  - **Charles, Venture, Fiction Start rooms — RESOLVED 2026-09-03: build per-room queues (decision
    11).** Muxin answered the product question. Each room home gets an **expandable queue** (collapsed
    with a pending count) at its bottom, reusing Content's pick-a-source visual; Studio Start files a
    routed capture into the destination room's queue as a durable item (extends the item-4 pattern);
    clicking a row resumes that room's native interaction. Venture: one queue per venture, capture
    names its venture, Studio asks if unclear. Fiction: its own queue, chat-confirms before writing
    canon (no auto-classify). Charles: single queue, multi-select output types (composer already
    does this), review room shows the essay in a scrollable sub-window with other drafts stacked
    below. Full spec + building-block line refs: decision 11 under "Recorded product decisions".
    Outreach's Start leg stays deferred (no queue spec'd yet; `intakeManual` needs a name/URL).

Remaining, in order:

1. **Lane-A item 2 is DONE and MERGED — PR #457 (`e53c6d3`, 2026-09-04):** Fiction and Charles
   treated variants dispatch through their selected editors with origin-specific checks and stamps.
   It passed focused/full verification, a Grok 4.6 audit, and one bounded live canary. Evidence and
   future hardening checklist: `docs/evidence-fiction-charles-editor-2026-09-04.md`.
2. **Lane B: Decision 11's per-room queues are complete.** Item 4 Fiction, item 6, 3a, and the
   content-request fix are done, as are the contracts-first 1.5 slices and all queues.
3. **Lane C item 5a is complete (`6a02b27`); item 5b (validation port) is next** — same `jobs.ts`
   generation region. Its design is `docs/content-room-alignment-plan.md` §5; follow the narrowly
   scoped handoff above rather than re-reading this history.

### Ground rules that bite immediately

- Run the gate `npm run check` **unsandboxed**; under the sandbox it reports ~196 phantom failures.
  Green as of 2026-09-03 at **4,055 tests / 484 suites / 0 failures** (P1 and item 4 each added a test).
- A fresh worktree has no `node_modules` and no `.env`: run `npm run worktree:setup` first.
- Studio: `npm run review` serves `http://localhost:4600` and dies with the terminal.
- Hosted CI is `on: workflow_dispatch` only. The sole automatic PR check is `gitleaks`, a secret
  scan that runs no test. **Dependabot PRs are therefore ungated** — run `npm ci && npm run check`
  locally before merging any dependabot major. #430 landed red exactly this way.
- Before landing any long-lived integration branch, run
  `git merge-base --is-ancestor <held-branch> <integration-branch>` against every held PR head.
  PR #420 auto-merged without review because a recovery branch silently contained its commits.
- `bash scripts/repo-hygiene.sh --rescue` from the repo root is the standing state check. It
  snapshots uncommitted work to `refs/wip/` without touching any working tree, index, or branch.

### Two audits, one lesson

Lane B was audited twice, cross-family (codex and grok). Codex caught a **blocker that grok and my
own review both missed**: the new content-request writer keyed requests as `atomize:<slug>`, and
both `serve.ts:1480` and `jobs.ts:772` refuse a request whose `id !== slug`, so every folder it
touched would have become impossible to configure in the Content room — strictly worse than the
invisibility it was fixing. **One auditor would have shipped it.** Run two, from different
families, on anything that writes files other code reads.

### PR hygiene — done 2026-09-03

**Open PRs: zero.** Six were resolved, none of them by rebasing.

- **#393 and #397 (dependabot) merged after a real local gate.** Hosted CI runs no tests, so both
  bumps were merged into a scratch branch and put through `npm ci && npm run check` unsandboxed
  first: **4,053 tests / 484 suites / 0 failures**. This is the check #430 skipped.
- **#421, #422, #423 and #433 closed as already-landed, not rebased.** Every one of them was
  already on `main` — the `recovery/content-studio-master-status` integration branch carried the
  work in, in a *newer* form. Their branches predate roughly 16k lines of later work, so merging or
  rebasing any of them would have **reverted `main`**: #433 would have restored the zod-3
  `z.record(z.enum(...))` in `brand-accounts.ts` that took the whole publish path down, #422 would
  have undone the decision-9 `DEFAULT_DISCOVERY_KINDS = ["platform"]` narrowing and downgraded zod
  to ^3.24.2, #423 would have dropped `listReviewCommentsWithHealth`. Confirmed two ways that
  agreed: a per-line containment test (every line each PR meant to add, checked against `main`'s own
  copy of that file) and an independent codex audit, which returned CLOSE-ALL with its own
  file:line evidence. Each branch still exists on origin, so every close is reversible.
- **The trap that hid this, worth remembering.** This doc previously said the four were "checked
  and are **not** in `main`". That was true of the *commits* — `git merge-base --is-ancestor` says
  no — and false of the *content*. **Commit ancestry does not answer "is this work already on
  main"** when the work arrived by a second route. Compare trees or lines, not ancestry.
- **So it is four more rule 7 breaches, beside #420**, from the same mechanism: content-generation
  logic reached `main` without Muxin's review because an integration branch quietly carried it.
  Her review packets survive the closes, on `main` at
  `docs/reviews/content-studio-fiction-p2-review.html`,
  `docs/reviews/outreach-phase5-discovery-review.html` and
  `docs/reviews/charles-persona-edit-review.html`.

### Open, recorded, not scheduled

- **PR #420, #421, #422, #423 and #433 all merged or landed without Muxin's review** (rule 7
  breaches; mechanism traced above and further down). Her call on all five: accept them (they are
  covered by the green 4,053-test gate) or revert. Nothing publishes either way — rule 2 still gates
  that through `review-queue.md`.
- **P1 audit follow-up — content-request selections are not validated against a vocabulary.**
  `buildContentRequest()`'s `selections()` (`content-request.ts:154`) accepts any non-empty string
  for `platforms[]`/`media[]`; the GUI only offers the `CONTENT_CONFIG_OPTIONS` set, but a direct
  `/api/content/request` caller could pass e.g. `platforms: ["quote-card"]` and make
  `variant.platform === "quote-card"`. After P1 that now gates the body at config's 180 (stricter
  than the retired table's no-gate — see PR #442's body). The fix is a shared server-side platform/
  media vocabulary to validate against; none exists today (`CONTENT_CONFIG_OPTIONS` is client-only),
  so it is its own small change, not part of P1's table deletion. Recorded, not built.
- **Item-4 follow-up — a promoted capture still reads as "waiting."** The Content Start path stamps
  a capture's `startedAt`/`jobId` through `startCapture`; item 4's Fiction path uses
  `saveCapture` + `createIdea` and stamps nothing, because `markCaptureStarted` requires a `jobId`
  and there is no "promoted, no job" stamp. So a Fiction capture that is now a durable inbox idea
  still shows on Studio home as "CAPTURE WAITING HERE" (`startedAt: null`). Pre-existing (Fiction was
  never stamped before), not a regression, but item 4 makes it visible. Needs a
  `markCapturePromoted(id, target)` or a `jobId`-optional stamp; scope it together with the three
  deferred Start rooms, which will need the same.
- **Finding 6a:** `image-carousel` can never be auto-recommended for a Substack-ingested essay —
  the rule needs three markdown headings and `htmlToText` emits none. The fix lives in
  `fetch-substack.ts` and would shift every `source_lines` number, so it is recorded, not built.
- **Finding 3c:** the `"from /cycle"` provenance stamp outlives the `/cycle` steps retired in 3a.
- `revise-mode.md` does not call `/atomize` step 8.5; the content-request CLI trusts `--brand`
  without cross-checking `source.md`; the check-then-write path is not concurrency-safe (a
  single-user local tool, deliberately out of scope). All in
  `docs/evidence-lane-b-2026-09-02.md`.

### Branch hygiene state (2026-09-03) — done

`repo-hygiene.sh --rescue` reports **no uncommitted work and no untracked paths** anywhere, and the
local branch list is now clean. Twenty-eight local branches were measured the same way the closed
PRs were — for each, every line it intended to add was checked against `main`'s own copy of the
same file:

- **15 carried content `main` does not have** and were **pushed to origin**, so nothing survives
  only on this disk: `agent/cs2-jobs-outreach-charles-extract`, `agent/cs2-page-room-pure-helpers`,
  `agent/cs2-serve-walled-room-routes`, `agent/cs3-studio-durable-handoff`,
  `agent/cs4-signals-recommendation-decisions`, `agent/cs5-content-workbench-continuity`,
  `agent/cs6-parallel-safe-ui-completion`, `agent/fiction-charles-functionality`,
  `agent/prototype-subtraction`, `agent/studio-fourth-batch-20260825`,
  `agent/studio-functionality`, `agent/studio-second-batch-20260824`,
  `docs/content-studio-master-status-final`, `feat/content-studio-phase2-evidence`,
  `fix/phase3-experiment-audit-gaps`. They are unreviewed and mostly stale; treat them as an
  archive, not a queue. **`repo-hygiene.sh` will still list seven of them under "unpushed,
  unmerged"** — that is a false alarm. All fifteen are on origin at identical SHAs; only the local
  upstream-tracking config is unset, because `.git/config` could not be locked from the worktree
  the pushes ran in. Verify with `git rev-parse <branch>` against `refs/remotes/origin/<branch>`
  before believing the script on this one.
- **12 measured zero unique content** and were deleted locally (all reflog-recoverable):
  `agent/content-studio-coordinator-local-merge` `8e4d4b9`,
  `agent/content-studio-coordinator-reconcile` `7448d59`,
  `agent/pattern-corrected-candidate-account-slate` `d220c40`,
  `agent/pattern-local-evidence-inventory-clean-commit` `4b7644f`,
  `agent/pattern-local-evidence-inventory-handoff` `993b067`,
  `agent/pattern-local-evidence-inventory-integration` `1188922`,
  `agent/pattern-research-professional-publishing` `632567e`,
  `agent/pattern-stage-evidence-text-community` `ae0da99`,
  `agent/pattern-stage-evidence-visual-video` `9b825e8`,
  `docs/content-studio-master-status` `eaccfe8`, `docs/pr420-carried` `1202ccd`,
  `feat/content-studio-phase1-completion` `cd42927`.
- The session's own working branches were deleted after merging: `lane-b/atomize-content-request`
  `9fc1156`, `docs/handoff-2026-09-03`, and the `deps/gate-check` scratch branch.

---

**Last reconciled:** 2026-09-03 evening (START HERE + Room-model order: P1 done as held PR #442,
item 4 Fiction leg merged as PR #443); body below reconciled 2026-09-02
**Repository baseline:** merged `origin/main` commit `10e678e` (PR #419), plus local recovery-branch
commits through `444b4d9` (`fix: isolate Fiction model drafting`) and the integrated Phase 4
cross-system learning, per-brand partition, Outreach Phase 5, Fiction P2, and Charles persona-edit patches on the current recovery
branch. PR #419 contains the audited Phase 3 Experiment implementation. The current branch closes
the measured Signals-to-Venture boundary and Outreach's deterministic discovery and weekly
Strategy-summary gaps, adds Fiction's review bridge, and adds a digest-bound Studio review gate for
production persona changes. Authenticated provider lifecycles remain operationally unverified
except the Postiz legs (all nine connected channels scheduled, rescheduled, and cancelled live on
2026-09-02) and the Typefully text-draft leg passed on 2026-09-02;
bounded authenticated model runs are recorded per capability below and do not prove general model quality.
**Phase 0 status:** operational provenance and policy wiring are complete with deterministic browser
coverage, and one authenticated Codex generation canary passed; authenticated provider canaries remain.
**Phase 1 status:** repository implementation and deterministic verification are complete for durable capture and
safe next actions, advisor-cut enforcement, seven staged media pipelines, normalized delivery and
reconciliation, one locked operational data root, the gated Postiz-first/Typefully-fallback canary
matrix, and reviewed Signals apply/rollback. Operational acceptance for Postiz delivery was reached on
2026-09-02: Muxin approved the far-future scheduled canary, and every connected channel passed
schedule, reschedule, read-back, and cancel with terminal cleanup (see the gate below).
On 2026-09-02
the Postiz leg passed live: read-only discovery authenticated against the self-hosted instance and
an approved Bluesky **draft** canary completed create, read, cancel, and reconcile with terminal
cleanup recorded (`cleanupRequired:false`). Getting there exposed that the adapter's create, read,
and cancel calls had also been written to a guessed contract (see decision 7); they were rewritten
against the `postiz-app` source and re-tested with real response shapes before the canary passed.
Later that day the full attended matrix passed: Bluesky/text via Postiz (draft
`cmtkcv66m0001mn8mg0e07e0v`, terminal cleanup), LinkedIn/text via the Typefully fallback (draft
`10597216` created unscheduled and deleted with a second acknowledged delete), and YouTube/video
recorded as the declared explicit exception. Later still, with Muxin's written approval, the
all-channel canary (`npm run verify:postiz-canary -- --all`) created one far-future `schedule`
post per connected channel (tiktok, mastodon, facebook, instagram, linkedin, threads, x, youtube,
bluesky), moved each one hour with the in-place re-save, read the new time back, cancelled, and
swept the window: nine passes, zero leftovers (`docs/evidence-postiz-canary-all-2026-09-02.json`).
Image and video fixtures were registered through the public upload route, so Postiz media is now
live-verified for this instance. Earlier attempts (2026-08-30 instance offline, 2026-09-01 configuration absent) changed no
provider state.
**Generation review:** Muxin approved the treatment, editor, voice, CTA, and distribution behavior
shown in `docs/reviews/content-studio-phase1-generation-review.html`. The artifact contains eight Luna and eight Grok
source-grounded treatments of Muxin's essay plus eight before/after examples from a blind Luna
cold-feed editor that saw no source context and grounded each opening for a reader scanning
unrelated topics. The untreated control remains byte-for-byte exact; treated
posts must make a standalone point, cite supporting source lines, strip footnote syntax, capitalize
after colons, pass the voice gate, and attach the canonical essay CTA with platform-aware placement.
This approved behavior is locked by the root policy, `/atomize` instructions, runtime validation,
and deterministic tests.
**Distribution recommendations:** the Content treatment read now derives cold-start platform and
media defaults from the source's topic, length, structure, and source kind, with a visible reason
for every preselection. The evaluator covers every configured downstream text, visual, and video destination;
it does not recommend reposting to the source channel itself (for example, a Substack essay or Note back to Substack).
Video-first recommendations name and preselect the required short-video asset, and final delivery remains gated
by discovered provider capabilities. Existing routing and measured performance remain stronger evidence. The
three-source review is `docs/reviews/source-distribution-recommendations-review.html`.
**CTA default:** a real canonical essay, chapter, or other long-form published source is now the
default CTA for every derivative and cannot be displaced by automatic content-type lead routing.
Substack Notes are deliberately excluded: they are complete short-form objects and never link
back to their own Note URL.
With no canonical source, a promotional destination must already exist and be explicitly reviewed
as high-fit and high-value; otherwise the resolver emits no forced link and never invents a lead
magnet or substitutes a generic homepage.
**Provider-cost update:** Studio edits already route Claude, Grok, and GPT/Codex through local
subscription CLIs. Grok prose now uses the subscription CLI, transcription uses local whisper.cpp,
and unattended image generation is disabled; reviewed Codex-generated image files are the preferred
art path through Studio's reviewed-file attachment step. OpenRouter remains temporarily for Kling video interpolation only while Wan 2.2
is evaluated locally; HunyuanVideo 1.5 is not a fit for this Apple-Silicon machine.
**Verification status:** the subscription-backed Grok prose adapter completed a live nonempty
canary at zero reported cost; provider-policy, Studio scheduling, Content capture, all seven media
stage contracts, durable runtime state, provider reconciliation, and Signals apply/rollback are
covered locally. The Postiz adapter passed live discovery and one attended draft lifecycle canary
on 2026-09-02 (Bluesky, text). The full attended matrix (Postiz-first, Typefully fallback, explicit
exception) passed the same day, followed by the nine-channel scheduled canary with reschedule and
media upload. Rescheduling (single row and batch by pillar/slug/platform) is implemented and
deterministically tested; its first live use will be an ordinary Studio move, not a canary.
**Purpose:** one current answer to what Content Studio is meant to do, what is actually wired,
what has been verified, and what remains.

## Current handoff — 2026-09-02

- **Continue in:** `/Users/Muxin/Documents/GitHub/content-agents` on `main`. Everything described
  below has landed there (PR #434, then #435); the
  `content-agents-worktrees/content-studio-master-status-recovery` worktree that carried it is
  merged and disposable. Start Studio with `npm run review`; it serves `http://localhost:4600` and
  dies with the terminal. Run the gate `npm run check` **unsandboxed** — under the sandbox it
  reports phantom failures. A fresh worktree needs `npm run worktree:setup` before any script, and
  has no `.env` of its own.
  The 2026-09-02 evening slices below are the latest work (see git log for hashes).
- **State cleanup completed (2026-09-02, night).** All of it is done; nothing here is outstanding.
  The main checkout is back on `main` and fast-forwarded to `cb1923b`. All **15** branches proven
  contained in `main` are deleted, including `agent/pattern-local-evidence-inventory`, which had
  been blocking the checkout switch. Two proven-stale untracked paths are gone: the
  `reviewed-evidence-staging-20260826/` directory (a strict predecessor of the committed
  `reviewed-evidence-staging-claude-20260826/` sibling: same 70 evidence rows, one field fewer,
  written a day earlier) and the `venture/e2e-phase3/` + `venture/e2e-probe-venture/` residue in
  the `content-studio-ui-recovery` worktree. That worktree's three modified files were discarded
  too, after Muxin confirmed the `data/outreach/tracker.jsonl` row claiming `client-aaron-hill` was
  contacted by email on 2026-08-29 is **false** — the end-to-end suite wrote it into the real data
  root, along with a backlog card and a flipped `review-queue.md` status. Every one of those
  deletions was snapshotted to `refs/wip/` first and is recoverable from there.
  **A standing lesson: an e2e run that writes into the real data root produces state that reads as
  real history.** A false outreach record is worse than noise, because a later session would act on
  it. `4e611cc` fixed the test root; this residue predated the fix.
  Landing the branch on `main` needed a merge, not a rebase: a direct push to `main` must
  fast-forward, and the branch had forked 4 commits earlier. `origin/main` was merged in
  (`package.json` / `package-lock.json` only, clean), which made `main` an ancestor. That merge
  pulled in the zod 3 to 4 major bump, so the pre-merge test run was re-run against the merged tree
  before anything touched `main`.
  That re-run caught **two real defects already live on `main`**, both from the zod 4 bump (#430),
  which merged with a red gate.
  1. *Typecheck, cosmetic.* zod 4 requires an explicit key schema for `z.record()`, and
     `src/review/develop.ts:305` was the last single-arg call in the repo. Fixed by passing
     `z.string()`. No behavior change.
  2. *Runtime, serious.* zod 4 made `z.record()` over an **enum** key exhaustive — every key
     becomes required. `src/config/brand-accounts.ts:18` maps delivery providers that way, and
     Charles and Fiction deliberately declare no delivery accounts, so on `main` today the brand
     account registry **fails to load at all** and takes the whole publish path with it: 48 tests
     across publishing, scheduling, Signals, and delivery-policy fail. Fixed with
     `z.partialRecord`, which restores the zod 3 contract of enum-constrained but optional keys.
     The existing `superRefine` is what actually requires an account for any provider a platform
     routes to, so partial keys were always the intent. It is the only enum-keyed record in `src/`.
  Both fixes are schema corrections, not content-generation logic, so rule 7 does not hold them.
  The lesson for the dependabot lane, now traced to its cause: **`.github/workflows/ci.yml` is
  `on: workflow_dispatch:` only.** Hosted CI never runs on a PR — the sole automatic check is
  `gitleaks`, which is a secret scan and reads no test. That is deliberate (the workflow says so:
  the local gate is the merge gate, and CLAUDE.md rule 7 calls hosted CI manual/advisory), and it
  works fine for agent-opened PRs, which run `npm run check` locally before merging. **Dependabot
  PRs do not.** Nothing at all gates them, which is exactly how #430 landed red. Until that is
  closed, a dependabot major needs a local `npm ci && npm run check` *before* it merges.
- **Repo state cleanup (2026-09-02, night):** the branch was pushed to origin (66 commits that had
  existed only on this disk), and `npm run check` passed unsandboxed at **4040 tests / 484 suites /
  0 failures** as the merge proof. Branch hygiene: every local branch was tested for containment
  with `git merge-tree --write-tree origin/main <branch>` compared against `origin/main^{tree}` —
  the only test that answers "would merging this change main at all", and the only one that catches
  a squash-merge. **14 provably contained branches were deleted**; none was an open-PR head and all
  are reflog-recoverable. An earlier count in this session's conversation ("24 safe, 15
  conflicting") was wrong: that loop captured `head`'s exit code instead of git's through a pipe,
  so the conflict half was never measured. `scripts/repo-hygiene.sh` (copied unmodified from
  `voter-choice`, pure git, no baked-in paths) is now committed here and is the standing check —
  run `bash scripts/repo-hygiene.sh --rescue` from the repo root, which snapshots every worktree's
  uncommitted work to `refs/wip/<worktree>` without touching any working tree, index, or branch.
  It found a **third worktree** nobody was tracking,
  `/Users/Muxin/Documents/GitHub/content-agents/.claude/worktrees/content-studio-ui-recovery`
  (on `agent/studio-functionality`), whose entire dirty state is end-to-end test residue written
  into the real data root — the defect `4e611cc` fixed, from a run predating it.
- **PR #420 landed on `main` without Muxin's review, as a side effect of landing the recovery
  branch (2026-09-03).** This is a rule 7 breach and it should be recorded plainly. #420 ("Phase 4:
  connect measured Signals learning to Venture") was a draft held *because* it changes Venture
  judgment and Content/Signals generation-adjacent gates. Its commits were already inside
  `recovery/content-studio-master-status` before this session began (`ef5a29e` is an ancestor of
  `53a461c`), so when #434 merged at 03:28:42Z GitHub found #420's head reachable from `main` and
  auto-closed it as MERGED one second later. Nobody merged it deliberately. **The lesson: before
  landing a long-lived integration branch, check whether it already carries a held PR's commits**
  — `git merge-base --is-ancestor <held-branch> <integration-branch>` answers it, and a held PR's
  protection is worth nothing if an unrelated branch quietly contains it. The other four held PRs
  (#421, #422, #423, #433) were checked and are **not** in `main`. **Corrected 2026-09-03: that
  conclusion was wrong, and its wrongness is the real lesson.** `--is-ancestor` answers a question
  about *commits*; all four PRs' *content* was already on `main`, carried in by the recovery branch
  along a different route. All four are now closed as already-landed — see "PR hygiene" at the top
  of this doc. When you want to know whether work is already on `main`, compare trees or lines, not
  ancestry. Muxin's options on #420 are to
  accept it (the code is covered by the green 4040-test gate) or to revert the merge; that decision
  is hers and has not been made. Nothing here publishes regardless — rule 2 still gates that
  through `review-queue.md`.
- **Open PR state (2026-09-02) — SUPERSEDED 2026-09-03: the queue is now empty.** The two
  dependabot PRs merged after a real local gate; the four drafts closed as already-landed. See
  "PR hygiene" at the top of this doc. The paragraph below is kept for the record, not as
  current state.
- **Open PR state (2026-09-02):** five draft PRs and two dependabot PRs. Four of the drafts (#423
  Charles persona, #422 Outreach discovery, #421 Fiction inbox, #420 Venture handoff) are correctly
  held under rule 7 — each is a content-generation LOGIC change, each names an old-vs-new review
  packet under `docs/reviews/*.html`, and each is waiting on Muxin's eyes and nothing else. **#433
  (per-brand Strategy) has an empty PR body** — it touches brief synthesis, which is on rule 7's
  hold list, so it needs a body, a review packet, and an old-vs-new sample before it can be judged.
  **Correction (2026-09-02, evening): all four now conflict with `main`, not only #423.** Tested
  with `git merge-tree --write-tree origin/main origin/<branch>` — #433, #423, #422 and #421 each
  conflict, so every one needs a rebase before it can even be judged. A related finding on #433:
  its diff still *adds* the `context?: StrategyMeasurementContext` parameter to `loadData`, which
  `main` already carries identically (`src/strategy/route.ts:153` on both heads) — part of the
  brand partition reached `main` by another route, so some of #433 is already landed and its
  remaining delta is smaller than its 77-file diff suggests. Worth knowing before writing its body.
  On merge method: Muxin's "commit depth is version history"
  position argues for `--merge` or `--rebase` over the `--squash` habit, which would collapse the
  67 commits she said cost nothing.
- **Room-model architecture review (2026-09-02, evening):** Muxin stated the intended job of each
  room and asked what it would take to match it. Recorded as decision 10 under "Recorded product
  decisions"; the traced gap inventory with file and line references is
  `docs/content-room-alignment-plan.md`. Headline findings: all three room-to-Content handoff
  buttons already exist and are wired, a handed-off piece already lands and persists at Content's
  pick-a-source step, and Venture measurement through Signals is live against real analytics — so
  the routing she described is largely built. The gaps are what Content can *do* with a piece once
  it is there: Venture bypasses the editor inside Content, Fiction and Charles are blocked from any
  treated variant, `/cycle` drafts into a place Content cannot review, Studio Start does server
  work for one room only, and most of the "make it for social" machinery lives in `/atomize` where
  the Content room cannot reach it. **Superseded 2026-09-03:** the freeze on `src/review/jobs.ts`
  is lifted — see "Standing authorization" at the top of this doc. Build in the code-forced order
  and hold each PR under rule 7; she does not pick a starting item.
- **Studio front-door room router (2026-09-02):** the capture router was a keyword match (7 of 16
  drafted probes landed in the right room). `POST /api/captures/classify` now asks the subscription
  analyst route (GPT via codex, Claude fallback, no tools, empty working directory) for the room
  and a one-sentence reason, keyword match as fallback; 15 of 16 probes land correctly, the one
  miss is Signals by design. Verdicts are bound to the exact text read, superseded reads are
  ignored, server failures are named, the "Wrong room?" override stays. Evidence:
  `docs/evidence-capture-router-2026-09-02.md`. The pillar-to-platform router inside `/atomize`
  is a different thing. Partly closed the same evening — see the next bullet.
- **Base loop on a real essay (2026-09-02, evening):** the front door and the pillar-to-platform
  router were both read against Muxin's own writing for the first time. Source: "The world's
  broken. What do we do?" (published 2026-08-30, 3,677 words), the newest of seven essays
  published since 2026-08-02 that had never been through the pipeline. Ingest exposed a real
  extraction defect: `htmlToText` in `src/atomize/fetch-substack.ts` decoded six named entities by
  hand and no numeric references, so the first pull wrote **119 undecoded references into
  `source.md`** (`&#8217;` x69, `&#8220;`/`&#8221;` x46, and `&#233;`/`&#232;`/`&#237;` inside
  "Medecins Sans Frontieres" and "la alegria"). `source.md` is the file every derivative quotes
  line for line, so all 119 would have shipped encoded and two real proper nouns misspelled. Fixed
  with one shared decoder, `src/util/html-entities.ts` (named + decimal + hex + the Windows-1252
  range, single-pass so an escaped entity stays escaped), wired into `fetch-substack.ts` (body and
  title) and `src/patterns/youtube-transcript.ts`, which had the same named-only chain. Re-pulling
  the same essay: 0 remaining references. `src/patterns/reddit-rss.ts` was deliberately left alone
  (it already decodes numeric references and its ordering is part of a documented double-unescape).
  Second defect: `src/strategy/route.ts` requires `--brand`, and every usage string omitted it, so
  the documented invocation produces a stack trace instead of a usage line; corrected in
  `route.ts`, `src/strategy/exploration.ts`, `src/strategy/routing-drift.ts`,
  `.claude/skills/strategy/SKILL.md`, and — caught by the audit below, and the ones that actually
  matter — `.claude/skills/atomize/SKILL.md` step 3.5, `.claude/skills/develop/SKILL.md`, and this
  repo's `CLAUDE.md` pipeline table. Drafting then ran on the same folder and produced 15
  derivatives (11 text, 3 quote-card captions, 1 card line), each with `source_lines`, and 14
  `pending` rows (the card's own quote line carries no row); `npm run validate` on the real output returned `ok: 15 derivative(s) within
  platform limits`, so the routing gate held on live drafting, not just in tests. The Claude CLI
  hit a session limit mid-attempt and the leg was re-run on the codex CLI — same subscription
  route, $0 either way.
  A cross-family Grok audit against six written requirements returned **FIX** with three defects,
  all now closed: the `/atomize` skill's own route invocation (above), the `CLAUDE.md` table, and
  a decoder bug where the five unmapped Windows-1252 slots and `&#8;` decoded into invisible
  control characters — contradicting that code's own comment and planting junk in a
  quoted-verbatim file. `fromCodePoint` now refuses C0/C1 controls except tab, newline and
  carriage return. Suite: 4,040 passing, 0 failing, typecheck clean.
  What the run does NOT prove: the routing decisions came back entirely `cold-start` because all
  20 posts in this worktree's `data/analytics.db` have a null `pillar`, so the router's code path
  is proven live but its decisions reflect a thin snapshot, not Muxin's history; source triage ran
  but had nothing to narrow (`frame-native`, no beat-2, no case); no scoped brief existed so no
  directives applied and no community derivative was drafted; no image or video was rendered
  (no-spend constraint), so the quote-card rows point at a PNG that does not exist yet; the run
  went through the `/atomize` skill rather than the Content room's `POST /api/content/generate`,
  so the blind cold-feed editor, the treated/control pairing, the mechanical voice gate and the
  source-line boundary check never ran on it, and with no `content-request.json` written the
  folder is invisible to the Content room's own approval step; and
  nothing was approved, scheduled, or published. Evidence:
  `docs/evidence-base-loop-2026-09-02.md`.
- **Postiz batch drain (2026-09-02):** a 429 on create releases the claimed slot, records a
  retry-eligible failure with the resume time, and a five-minute loop in the Studio server
  re-dispatches waiting approved rows once the window reopens, one create per row, stopping at the
  next 429. Studio shows "N rows waiting for Postiz, resumes at HH:MM". It runs only while Studio
  is open; batch moves of already-scheduled posts are not auto-resumed.
- **Test leak into the real data root (2026-09-02):** every gate run had written its fixture jobs
  into Muxin's real Studio job store (172 fake tasks on her desk). `dataRoot()` and the legacy
  path now resolve to a throwaway directory whenever node:test's `NODE_TEST_CONTEXT` is set and
  no `CONTENT_AGENTS_DATA_ROOT` is configured. The leaked store was backed up beside itself and
  cleared. The main-checkout `.env` gained `CONTENT_AGENTS_POSTIZ_ACCOUNT_ID` and
  `CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID` (non-secret identity labels) the same day.
- **Outreach reset toward what Muxin actually wants (2026-09-02):** the seven "follow up with"
  rows on the Studio desk are her own Boardy intros from 2026-07-24 (PR #274), not scout output.
  They and two more Boardy leads are now `peer`-kind (`outreach/leads/peer-*`), a third lead kind
  beside client and platform with its own PEERS segment, follow-up bucket, and a 14/60-day
  follow-up/abandon window in `config/outreach.yaml` that Muxin has not yet confirmed.
  `config/outreach/brief.md` is her short Boardy-style statement of what she wants and leads the
  platform scout prompt, declared to win over the older rubric files (she considers them mostly
  stale; only the Collective Intelligence Project and Audrey Tang anchors and the non-dilutive
  funding preference still hold). A bare `/scout` now sweeps platforms only (decision 9). Peers skip the research pass (a Boardy-style intro needs none) and draft directly; only an
  explicit `disqualified` blocks a peer from triage or drafting.
- **Latest completed slice:** Fiction draft and repass calls now use a disposable full-tree stage,
  exact single-chapter mutation/import rules, optimistic live-tree drift checks, Claude restricted
  mode, and one exact `story:validate` command grant. Operational Fiction beats, continuity reports,
  and review notes preserve their historical default paths and honor an explicit
  `CONTENT_AGENTS_DATA_ROOT` for isolated runs. The root `AGENTS.md` records the bounded verification
  sequence for future sessions.
- **Behavior evidence:** an authenticated disposable-repository Claude run completed chapter-2
  draft, continuity, instruction-bound repass, and continuity (the last check succeeded on its one
  retry). The chapter validated, Git refs stayed fixed, and configured operational data stayed
  isolated. After that canary, the permission boundary was tightened to Claude `--restricted` plus
  an exact validator command; a separate authenticated Claude CLI probe and focused tests verified
  that hardening, but the complete draft/repass canary was not rerun after the argv change.
- **Review evidence:** the final cross-family read-only audit returned SHIP with no P0/P1/P2 after
  canonical-series containment and exact tool-grant corrections. Focused typecheck/tests passed
  151/151. The earlier full suite had one unrelated timing-sensitive failure in
  `stopping a queued job never spawns anything, and drain() skips it` (`src/review/jobs.test.ts`):
  the first job held the lane with a timer, so under suite load both timers fired in one tick and
  the second job ran before it was stopped. That flake was reproduced under parallel load (1 of 30
  runs) and fixed on 2026-09-02 by holding the lane with a promise the test releases explicitly
  (0 of 40 loaded runs after). The unsandboxed merge gate `npm run check` then passed:
  typecheck clean, 3,975/3,975 tests. This is unit evidence only; it changes no product status.
- **Canary incident:** the first isolation attempt overwrote the pre-existing
  `~/.content-agents/fiction-beats/the-least-of-us.json`. No recoverable prior bytes were found, so
  the file was preserved rather than guessed or deleted. Canary-only global continuity/review files
  and all disposable canary directories were removed.
- **Postiz runtime check (2026-09-02):** the self-hosted instance is running and `healthy` on
  `http://localhost:4007` with X, LinkedIn, Bluesky, Threads, Mastodon, Instagram, Facebook,
  TikTok, and YouTube connected in its UI. The content-agents `.env` (main checkout) still lacks
  `POSTIZ_BASE_URL`, `POSTIZ_API_KEY`, and `POSTIZ_ACCOUNT_ID`; this worktree has no `.env` at all
  (the loader reads the running checkout's own root), so the canary must run from a checkout that
  has one. Reading the `postiz-app` source revealed two adapter defects the mocked tests had hidden
  (no media list in the real integrations response; the public middleware expects the bare API key).
  Both were fixed with real-shape tests the same day (recorded decision 6). At that point discovery
  had not run (superseded by the next two bullets).
- **Postiz read-only discovery (2026-09-02, later the same day):** Muxin added `POSTIZ_BASE_URL`
  and `POSTIZ_API_KEY` to the main-checkout `.env`; the browser login stall was a URL mismatch
  (the Compose file names `https://postiz-threads.meta:4443` as the frontend origin, so
  `localhost:4007` posts cross-origin), resolved by logging in at the configured host. Discovery
  through the fixed adapter authenticated and returned nine integrations (bluesky/heymoosh, x,
  linkedin, instagram as Muxin Li; threads, mastodon, tiktok, youtube as Human Inference; facebook
  recorded as `unknown-identifier`). The registry then advertised all eight as text-only; the
  same-day tightening in decision 6 now records instagram, tiktok, and youtube as
  `no-text-baseline`, so five text channels remain routable. Nothing was created. At that point
  `POSTIZ_ACCOUNT_ID` was unset and the create/read/cancel/reconcile matrix awaited
  Muxin's account choice and explicit approval.
- **Postiz lifecycle canary (2026-09-02):** Muxin set `POSTIZ_ACCOUNT_ID` to the Bluesky channel
  and approved the matrix. The first run returned 400 (`All posts must have an integration id`):
  the adapter had posted its own input object, and its read and cancel paths assumed a
  `GET /posts/:id` route Postiz does not have. Create/read/cancel/reconcile were rewritten from the
  `postiz-app` DTO, controller, service, and repository (CreatePostDto body; array create response;
  list-by-window read with uppercase `State`; soft delete by id; absence after delete as the only
  cancellation signal). The rerun created draft `cmtkbipdk0000mn8m3fmezz2y`, read it back as
  DRAFT, deleted it, reconciled it absent, and wrote the terminal ledger event under the
  operational data root. Postiz stores drafts with no publish workflow, so nothing could post.
- **Attended matrix (2026-09-02):** after Muxin's "Go", `verify:publish-canary-matrix` ran with
  cases bluesky/text, linkedin/text, youtube/video(exception). Evidence: Postiz `verified`
  (`cmtkcv66m0001mn8mg0e07e0v`, ledger terminal), Typefully `verified` (`10597216`), YouTube
  `explicit-exception`. The Phase 1 live-delivery gate is met for text drafts.
- **All-channel scheduled canary (2026-09-02, later):** Muxin approved a far-future `schedule`
  canary with immediate cancel and asked for every connected channel. The gate now admits
  `scheduled` only with `allowScheduled` approval evidence and at least seven days of lead. Result:
  nine of nine channels passed create, reschedule (+1h, `type: schedule` re-save with the existing
  post id and group), read-back, cancel, and terminal reconcile; the closing window sweep found no
  canary rows. Two findings folded into the adapter: X requires `who_can_reply_post` on any
  non-draft save (the production path would have 400ed), and Postiz's `update` type still writes
  `publishDate`, so only `schedule` re-saves may change a date. Test media stays in the Postiz
  media library (no public delete route); harmless.
- **Open questions for Muxin (2026-09-02 close):** (a) confirm or change the peer follow-up
  window (14 days to follow up, 60 to abandon, a placeholder); (b) whether to delete the stale
  rubric files under `config/outreach/` now that `brief.md` leads; (c) the Scout `--theme`
  sentence for the first platforms-only run; (d) whether to discard the seven stale July 17
  pending rows in the Content review queue. Session state (corrected 2026-09-02, evening): that
  session's commits are on `main` — the branch was pushed, merged as PR #434/#435/#437, and the
  count is stale. The Studio server started from that session is gone and must be relaunched with
  `npm run review`.
- **Next gates, in Muxin's order:** (1) the base-loop test: its unblocked prefix ran on 2026-09-02
  (real essay in, front door, routing, drafting; see the base-loop bullet above and
  `docs/evidence-base-loop-2026-09-02.md`). What remains is hers: one approval of a drafted row
  into a scheduled Postiz post. Routing should be re-read against her real tagged analytics before
  that approval, since this run's decisions were all cold-start; (2) the first
  platforms-only Scout run, waiting on her `--theme` sentence (proposed: platforms and shows that
  would feature her talking about her civic work and Human Inference); (3) the attended Fiction
  browser/GitHub approval workflow and the signed-in per-brand Signals/Experiment loop. Later, by
  her ordering: the landscape/podcast reframe and readable podcast transcript (decision 8), and
  samples of the carousel, caption burn-in, and audiogram. Do not perform provider delivery,
  GitHub push/PR mutation, or account writes without the corresponding explicit approval.

## Authority and update rule

This is the master **implementation-status and current-decision** document. It records the
current implementation truth and resolved product decisions. It does not replace the product
and safety authorities below:

1. Current product direction: `docs/Muxin's Vision for Content Studio.md`. This is the newer
   product-direction document and supersedes older wording where a later explicit decision differs.
2. Foundational product principles and detailed UX intent: `docs/content-studio-vision.md`.
   It remains authoritative except where superseded by the newer vision or a later explicit decision.
3. Repository safety: root `CLAUDE.md` and `AGENTS.md`.
4. Domain behavior: `stories/AGENTS.md`, `venture/AGENTS.md`, `venture/rules.md`,
   `venture/rules.yaml`, `docs/venture-schema-contract.md`, and `charles/AGENTS.md`.
5. Typed target contracts: `docs/content-system-contracts.md` and
   `docs/content-system-blueprint.md`.
6. Current implementation status, resolved implementation decisions, and remaining scope:
   **this file**.
7. Work index and historical record: `docs/content-agents-backlog.md` and
   `docs/content-agents-backlog.archive.md`. The backlog is not a second status specification.

Any merge that changes a product decision, runtime capability, provider, verification level, or
known gap must update this file in the same PR. Point-in-time handoffs and audits remain useful
history, but they do not override this file's current-state statements.

## Status vocabulary

| Status | Meaning |
|---|---|
| Live verified | Exercised against the real external system or real authenticated account under an explicit safety gate. |
| Deterministic tested | Implemented and covered by unit, integration, CLI, or disposable-browser tests without a live provider/model dependency. |
| Provider unverified | Provider integration exists, but its current authenticated create/list/cancel/delivery lifecycle has not been canary-tested. |
| Partially wired | Real pieces exist, but the user-visible end-to-end contract is incomplete. |
| Scaffold only | Types, projections, or read-only adapters exist without a production write path. |
| Not implemented | No production implementation exists. |
| Intentionally manual | The latest decision is that the system stops and Muxin performs the external action. |
| Blocked for safety | Code exists, but it must not be treated as complete or enabled broadly until the named safety boundary is fixed. |

File existence is not completion. Unit tests do not prove an authenticated provider accepted an
operation. A scheduled item is not a confirmed published item. A typed scaffold is not a wired
product flow.

## Executive truth

The repository has a substantial backend, not just a UI. It has durable content folders, review
queues, Venture's four-phase state machine, Fiction drafting and continuity tools, Charles's
persona workflow, Outreach dossiers and follow-ups, analytics and Signals reads, a shared job
queue, publishing adapters, and a shared scheduler.

PR #404 reorganized the product surface. PR #406 added publishing-state tracking, Venture-to-
Content handoff, Signals decisions, Outreach tracking improvements, durable Content requests,
and engine boundaries. PR #407 added Fiction passage editing and review history plus Charles
status views, prose-only editing, and retry-safe review notes.

Merged PR #412 closes the four Phase 0 safety boundaries with deterministic coverage:
configured Muxin-voice generation is constrained within an approved source/cut boundary; Fiction
and Charles handoffs preserve their approved body and domain restrictions; delivery resolves origin
to a fail-closed brand/account policy; and a disposable injected-engine Chromium pass now drives
the real configured-generation GUI flow. A bounded
authenticated Codex CLI generation canary passed in a throwaway repository copy; no authenticated
provider lifecycle canary is claimed. A read-only authenticated Substack saved-session check also
passed, proving login readiness but not create/list/cancel or live delivery.

The system is **not operationally verified end to end**. The largest unresolved boundaries are:

1. The authenticated Postiz-first/Typefully-fallback matrix passed on 2026-09-02 (Postiz Bluesky
   draft with terminal cleanup, Typefully LinkedIn draft deleted, YouTube declared exception).
   Later that day the nine-channel scheduled canary and media upload also passed live; the
   Studio reschedule and batch-move paths are deterministic-tested but have not yet moved a real
   scheduled post.
2. Provider reconciliation records explicit `uncertain` evidence instead of guessing when an API
   cannot prove a terminal state. Typefully and YouTube list absence is not terminal proof, and
   Substack still needs provider or reviewed human evidence.
3. Media pipelines are deterministically wired behind approval gates, including a safe reviewed-file
   attachment path for attended Codex image and carousel files. Paid/authenticated provider renders
   and delivery paths remain live-unverified.
4. The Experiment/pattern Phase 2 and Phase 3 vertical slices are integrated through proposal,
   approval, canonical Content generation, and measurement interpretation boundaries. Their first
   approved publication and attributed measurement window remain operationally unverified.
5. Provider credentials and non-secret account bindings are configured locally, but credentials
   alone are not lifecycle evidence and must not be described as a successful canary.

## Studio and Content

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Global Studio shell | One global room bar; each room has a small local view menu; persistent references live in the right rail. | Seven rooms are implemented: Studio, Venture, Content, Outreach, Fiction, Charles, Signals. PR #404. | Deterministic tested in DOM and Chromium fixture passes. | `src/review/page.ts` remains a very large generated HTML/JS module. Keep room labels and supporting documentation synchronized with the seven-room model. |
| Studio capture | One front door accepts a thought or link, identifies the destination, explains it, and starts the next safe step. | `studio-capture-v1` records are repository-owned under the operational data root, locked, idempotent, and restart-safe. The room read is a model judgment on the subscription analyst route (GPT first, Claude fallback, no tools, $0) with the older keyword sniff as fallback; the verdict carries the model's one-sentence reason and the desk keeps its "Wrong room?" override. The classifier has five actionable destinations: Content reserves and starts one durable advisor job; Fiction, Outreach, Venture, and Charles open the existing room-owned human gate with the saved capture visible. Charles routing (the keyword fallback) requires the explicit persona name; the model route also recognizes an unnamed oligarch-consultant idea. Charles handoff copies the exact capture into empty Charles Input, and never clicks Draft; a different unsaved Charles idea is preserved and blocks the copy truthfully. Unknown destinations fail closed instead of falling through to Venture. It does not claim to classify directly to Signals. | Deterministic cross-process, crash-recovery, route, classifier-mirror, exhaustive-dispatch, and UI-contract coverage for those five destinations. Disposable Chromium proves both the Content advisor start and the Charles exact-input/no-job/no-overwrite handoff through the real Studio controls. A 16-probe room-routing run on 2026-09-02 (drafted ideas across all five rooms plus Signals) put 7 of 16 in the right room under the keyword sniff alone; the model route's result on the same probes is recorded in `docs/evidence-capture-router-2026-09-02.md`. | Add direct Signals classification only after Signals has a room-owned safe capture action; until then the global bar is not evidence of direct seven-room classification. |
| Advisor and cuts | Muxin supplies substance; the advisor proposes lens/CTA choices; Muxin edits message-level cuts before formatting. | `/develop`, recommendation rounds, deterministic accept/dismiss, cuts, and cut comments exist. Content configuration re-reads the authoritative approved cut and refuses missing, dismissed, mismatched, ambiguous, malformed, or uncited cut provenance before formatting. | Deterministic unit, persistence, and authorization coverage; authenticated model calls remain nondeterministic. | Repeat the authenticated model canary when the advisor engine adapter changes. |
| Content configuration | The system recommends treatments, media, and destinations; Muxin accepts or overrides rather than constructing the plan from scratch. | Durable `content-request.json` persists validated source or approved-cut provenance, treatment/media/platform selections, untreated controls, recommendations, and grouped input-request filters. The first reviewed mechanism is connected: the digest-bound used-to-think/now dossier may preselect a `belief-shift` treatment only when the exact server-read approved cut contains an ordered first-person change of mind. The treatment read and save boundaries both replay the cut against its cited source lines; save discards case-insensitive client assertions in the dossier namespace, replays the canonical review, and refuses an ineligible treatment. Generation independently replays the canonical dossier and persisted evidence before any job or artifact. Draft parsing permits only exact sentences from the cited source lines while retaining old belief before current belief, and the blind editor must preserve that body byte-for-byte. The UI labels the evidence as a hypothesis, preserves the no-winner caveat and dossier digest, and leaves every eligible selection overridable. | Deterministic canonical-replay, tamper, adversarial eligibility/order, whole-source/cut separation, forged-client-evidence, generation preflight, exact-sentence drafting, editor preservation, persistence, prompt, and UI coverage. | This is one reviewed mechanism, not a general recommendation engine or a performance claim. Continue adding mechanisms only through the same digest-bound review, source-match, server-authority, and output-invariant boundary. Media and platform recommendations still rely on source fit, routing, measured Signals evidence when available, or explicit cold-start defaults. |
| Configured text generation | The untreated control is byte-exact. Approved treatments may re-hook, reorder, trim, clarify, and add connective structure within cited source boundaries; every generated item remains pending review and preserves provenance. | Human Inference/Studio generation requires authoritative `source_lines`, materially applies the selected treatment, then runs a blind cold-feed editor that sees only the finished drafts and sharpens topic grounding for a rapidly context-switching reader. Voice validation rejects AI tells, dashes, footnote syntax, and lowercase prose after colons. Canonical long-form sources get a CTA; Substack Notes never self-link. | Deterministic prompt/parser/provenance/editor/voice/CTA/output coverage, a disposable injected-engine Chromium pass through the real GUI save-and-generate flow, reviewed Luna and Grok comparison artifacts, and one bounded authenticated Codex CLI generation canary in a throwaway repository copy. | Keep provenance enforcement and human review fail-closed while reconnecting advisor/cut review. Repeat authenticated canaries when engine adapters change. |
| Media generation | Requested media should invoke the relevant text/script, review, render, and asset pipeline. Paid steps remain explicit. | All seven configured choices create a source-bound, inspectable stage; require explicit digest-bound approval; dispatch to the production renderer/provider; verify the created assets and cost; checkpoint promotion; and update the review row without double-rendering after a promotion failure. Image and carousel stages also accept attended Codex files already placed inside the content folder, validate regular nonempty nonsymlink image files and matching image signatures, enforce the approved image count, preserve the supplied positional slide order, reject contradictory numbered filenames, copy files to canonical output paths, and use the same manifest/promotion checkpoint. | Deterministic registry, plan, approval, tamper, reviewed-file safety, renderer-injection, asset-verification, promotion-retry, and no-double-billing coverage for quote still, animated quote, image, carousel, short video, caption package, and audiogram. Caption burn-in and the audiogram were run live on 2026-09-02 (local whisper.cpp alignment plus Remotion, $0): a 6.8s spoken fixture aligned to 21 words with an exact transcript, and frames were inspected. | Authenticated/paid provider renders remain live-unverified. Attended Codex images are now supported through the reviewed-file workflow. Captioned video (`video-caption-package` with a source video) now yields a publishable `captioned.mp4` with real word timings, and the audiogram is a 1080x1920 waveform clip with the same synced house captions; both use the single caption style in `remotion/Short.tsx` (`CaptionOverlay`). `npm run captions -- <video.mp4>` captions any vertical clip outside a content folder (the Reelify replacement); landscape input is refused today, and the podcast reframe in decision 7 below is the required replacement for that refusal. A storyboard-only caption package (no source video) still writes sidecars with evenly spaced timings. |
| Content review | Group by original request; edit directly; comment/revise; approve explicitly; keep publishing status separate. | Searchable request filter, direct derivative editor, revise notes/engine, bulk selection, approval, and four-step Content views exist. Persisted request identity now reaches the grouped review surface, whose Review and Publish steps are globally reachable without first selecting a source. Both grouped and focused approval controls state that approval immediately attempts scheduling for provider-backed destinations, that scheduling failure does not erase approval, and that provider acceptance/publication is reported separately. Manual delivery stays approved and reports a ready-to-paste handoff without claiming provider activity. | Executable UI outcome vectors cover provider acceptance, retained approval after scheduling failure, private upload, and manual handoff. Disposable Chromium proves direct Focus Mode editing, grouped two-row approval, durable queue/request writes, and separately recorded planned-provider and uncertain-failure outcomes through a token-and-marker-gated provider seam. | None for the approved Content review scope. Live-provider acceptance remains part of the separate operational acceptance gate below. |
| Cross-room Content handoffs | Venture, Fiction, and Charles reuse one Content workflow while retaining source identity, voice/canon rules, CTA ownership, and delivery policy. | Typed idempotent handoff contracts and routes exist for all three. Content configuration now reads and visibly presents the owning room's approved body and authority: Fiction's locked passages plus canon/provenance restrictions, Charles's persona/CTA/manual-delivery restrictions, and Venture's approved artifact, body path, approval provenance, and `claim_refs`. Fiction/Charles configured generation permits only an untreated control copied from that approved body and records context/restriction references; any treated variant fails closed before a job or write. Venture retains its scoped composition exception through `config/voice.yaml` and the no-invented-proof constraint. | Deterministic unit, persistence, route, generation-policy, and Venture prompt/parser coverage. Disposable Chromium proves all three authority displays, Fiction treatment refusal before a job or write, and an approved Venture treated composition through the real GUI into pending Content review without a real model call. One bounded authenticated Claude canary also passed through the production Venture handoff, Content request, and configured generator for a `shorter` LinkedIn treatment: source and request hashes stayed unchanged; exactly one grounded derivative, `none` media stage, and pending queue row were created; and no approval, publication, delivery, or provider activity occurred. | Superseded in scope by decision 10 below: the recorded model requires Content to make platform variations of Fiction and Charles work rather than only an untreated control, and requires the editor to run on Venture too. The current fail-closed behavior in this row is correct as built and remains the safe state until that work is approved; see `docs/content-room-alignment-plan.md` items 1 and 2. Fiction remains provider-blocked until it has a separate configured account; Charles remains manual by decision. Other Venture engines, treatments, and platforms remain operationally unverified, and delivery remains a separate provider gate. |

## Models, jobs, and runtime safety

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Engine selection | Choose per run. Prefer subscription/free routes. Claude, Grok, and GPT/Codex use their installed subscription CLIs; reserve Grok for deliberate cross-family work. Stop GPT-OSS experiments unless Muxin explicitly reopens them. | Claude, Grok, and Codex dispatch exist across supported actions. GPT-OSS remains an internal adapter but is server-enforced as paused: it is absent from product selectors, advertised unavailable even if Ollama reports the model, and refused by analysis and file-writing routes. Fiction scene anchors and continuity reports persist and display the engine that produced them, while legacy records remain explicitly unstamped. | Extensive argv, domain, persistence, backward-compatibility, and UI tests; real multi-engine jobs remain nondeterministic and unverified end to end. | Repeat authenticated per-engine canaries when adapters change. Reopening GPT-OSS requires an explicit product decision and corresponding route/UI changes. |
| Shared job queue | One bounded lane, real elapsed time, logs, stop/retry, blocked questions, engine attribution, artifact-based success. | One serialized lane persists durable job summaries under the operational data root, uses a cross-process execution lease, and recovers abandoned queued/running work fail-closed as nonretryable instead of silently replaying a possibly non-idempotent model call. | Strong unit, cross-process, stale-lock, restart-recovery, and deterministic browser coverage. | Recovery deliberately does not resume an interrupted model call. A future resumable engine contract would need artifact checkpoints and engine-specific idempotency. |
| Approval boundary | Generation never implies approval; no delivery without explicit approval. | Review queues and Muxin-only Venture/Fiction/Charles gates are enforced in domain code. | Strong deterministic tests. | Provider and cross-brand integration must continue to fail closed while the account/policy gaps above remain. |

## Publishing and delivery

### Provider matrix

Postiz is the canonical social publishing infrastructure and the primary target path. A
self-hosted Postiz instance is the default path for destinations and media it currently supports.
The available destination/media matrix must come from that instance rather than from an assumed
universal capability list. Typefully remains a working fallback and must not be removed until the
Postiz path is implemented and verified. Provider-specific or manual paths remain exceptions where
Postiz does not support the required destination or capability.

| Destination | Current provider/path | State | What is still unverified or missing |
|---|---|---|---|
| X, LinkedIn, Bluesky, Mastodon, Threads, Facebook text | Self-hosted Postiz when live discovery advertises the exact account/destination/media capability; Typefully scheduled drafts only after an explicit unsupported result | Postiz live-verified for all six text channels on 2026-09-02 (far-future schedule, reschedule, cancel); Typefully live-verified for a LinkedIn text draft | First real scheduled delivery through Studio has not run yet; Facebook has no non-Postiz fallback. |
| X, LinkedIn, Bluesky, Instagram, Facebook quote cards | Postiz (media registered through `POST /public/v1/upload`); native Typefully image drafts only after an explicit unsupported result | Postiz image path live-verified on Instagram (2026-09-02); dispatch uploads the rendered PNG and sends the card caption | Run one real card through Studio; Typefully image fallback stays provider-unverified. |
| Configured-media image, carousel, and video rows (any Postiz channel) | Postiz only; manual ready-to-paste when discovery reports no support. Routed by asset path (`media-stages/` or `configured-media/`) so the older native-video Typefully rows are untouched. | Carousel dispatch uploads every slide in order and sends one multi-image post; caption is the row's own derivative body with CTA placement (never composed); per-channel image caps enforced before the first upload (x 4, bluesky 4, mastodon 4, instagram 10, facebook 10, linkedin 20, threads 20, tiktok 35). Two-slide carousel live-verified on 2026-09-02 on TikTok, Mastodon, Facebook, Instagram, LinkedIn, Threads, and X (schedule, reschedule, cancel, sweep clean; `docs/evidence-postiz-canary-carousel-2026-09-02.json`). Bluesky's carousel case hit Postiz's rate limit that run and has not been rerun yet (single-command rerun once the hour rolls over). | Postiz throttles post creation to 90 requests per hour for the whole instance and each schedule or move counts as one. Since 2026-09-02 a 429 on approval releases the claimed publish slot, is recorded as a retry-eligible `failed` ledger event carrying the resume time (from `Retry-After`, else one hour), and a background drainer inside the Studio server (`src/review/publish-drain.ts`, `/api/publishing/drain-health`) re-dispatches the waiting approved rows once that time passes, one create per row, stopping again at the next 429; Studio shows "N rows waiting for Postiz, resumes at HH:MM". The drainer runs only while Studio is open. A batch move still stops at the first rate-limit error and reports the remaining rows as not attempted; they are not auto-resumed. Moving an image, carousel, or video row re-uploads its media before the create call (Postiz has no delete route, so the library accumulates copies). Run one real carousel through Studio. |
| TikTok | Postiz (video registered through the upload route) with the PostPeer exception only after an unsupported result | Postiz TikTok video path live-verified on 2026-09-02 (privacy SELF_ONLY canary); production sends DIRECT_POST with public privacy | Run one real short through Studio; PostPeer remains the unverified fallback. |
| YouTube Shorts | Postiz (video plus `title`/`type` settings from `video/title.txt`) with the YouTube Data API exception only after an unsupported result | Postiz YouTube video path live-verified on 2026-09-02 (private canary) | Run one real short through Studio; the direct YouTube exception stays unverified. |
| Substack Notes | Constrained saved-session browser automation | Provider unverified | Run an explicitly approved canary; maintain selectors; add independent live confirmation. Full essays remain manual. |
| Community/manual destinations | `ready-to-paste/` | Intentionally manual | Surface the handoff and status in the Studio consistently. |
| Postiz | Self-hosted Postiz | **Live-verified on all nine connected channels (2026-09-02): scheduled create, in-place reschedule, cancel, media upload** | Adapter, environment contract, dynamic capability/account registry, per-channel provider settings, media registration, create/read/reschedule/update/cancel/reconcile lifecycle, recovery ledger, gated canary (draft or approved far-future schedule), fallback matrix, single-row and batch reschedule (Studio endpoints, CLI `publish:reschedule`). History: the 2026-08-30 instance was offline; on 2026-09-01 `.env` lacked the base URL and key; on 2026-09-02 discovery authenticated, the first attended draft canary exposed a guessed create/read/cancel contract that was rewritten from the `postiz-app` source, the draft lifecycle passed, and after Muxin approved scheduled visibility the all-channel canary passed with zero leftovers. |
| Outreach email/Gmail | Send a locked email from the Content Agents GUI through the exact approved Gmail account after an explicit confirmation; retain manual/external sending for unsupported channels. | **Implemented and deterministic-tested; provider unverified.** The GUI exposes Gmail only when the matching OAuth configuration is present, validates the authenticated profile as `muxin.li.pro@gmail.com`, writes a body-free append-only delivery ledger, prevents blind retries, reconciles uncertain sends by deterministic RFC Message-ID against Sent mail, and advances the follow-up clock only after confirmed delivery. The by-hand fallback remains available. | Run one explicitly approved authenticated send/reconcile canary. Recipient address and subject are explicit send-time envelope fields; the locked reviewed artifact remains the message body and channel. |

### Scheduler and publishing status

| Capability | Current state | Verification | Remaining work |
|---|---|---|---|
| Unified scheduler | `src/publish/slots.ts`, configuration, publish ledger, durable jobs, captures, provider status, and reconciliation health all resolve through `CONTENT_AGENTS_DATA_ROOT` (defaulting outside the checkout). File locks and execution leases serialize cross-process mutation; startup recovery fails abandoned non-idempotent work closed. | Strong deterministic PT/DST, migration, cross-process, stale-lock, lease, and restart-recovery tests. | Operational backup/retention for the external data root remains an installation concern, not a second checkout-local authority. |
| Publish orchestration | Studio approval discovers the live Postiz account/capability registry first (media advertised by default after the verified upload lifecycle; `POSTIZ_MEDIA_UPLOAD_VERIFIED=0` opts out) and chooses Postiz only for exact advertised support. A verified unsupported result permits the explicit Typefully/PostPeer/YouTube/manual fallback. Postiz dispatch places the source CTA per cta.yaml (inline, or as a thread reply / LinkedIn first comment through Postiz follow-up values), marks the row published, appends the publish log, and records the bets Placed row, the same bookkeeping as the Typefully path. A scheduled Postiz row can be moved to an exact time or the next free cadence slot, alone or as a cluster selected by pillar, slug, platform, or key (shift N days or re-flow after a date); the provider is re-saved in place, the slot ledger moved, and one publishing event appended so the Content page shows the new time at once. Typefully rows have no reschedule API and are reported as manual. | Deterministic policy, discovery, capability-first selection, scheduler, adapter, fallback, reschedule, and real-shape lifecycle coverage; the 2026-09-02 attended matrix and nine-channel scheduled canary passed. | Still open: first real scheduled delivery and first real move through Studio. Do not treat discovery transport failure as unsupported. |
| Publishing status | Append-only normalized events record atomic claims, provider/account/object IDs, provider URLs, planned and observed timestamps, policy identity, uncertainty, human evidence, and delivered/deleted/canceled/failed/private/uncertain outcomes. A bounded reconciler runs under one cross-process lease every 15 minutes and now reads Postiz `scheduledAt` into `plannedFor`, so a move made inside Postiz itself reaches the Content page on the next pass. | Strong deterministic unit, cross-process, runner-wiring, all-state normalization, human-evidence, and no-blind-retry coverage; the 2026-09-02 matrix exercised authenticated Postiz and Typefully draft reconciliation; other providers unverified. | APIs that cannot prove terminal state remain explicitly `uncertain`. |

## Venture

Venture is substantially implemented in backend code. `docs/venture-build-plan.md` is design
history and its “nothing built yet” statement is obsolete.

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| State authority and gates | `canon.md` is authority; decisions/artifacts are append-only; all selections, approvals, live confirmations, and checkpoints are hard Muxin-only predicates. Phase 4 ends in a Day-14 human decision, not checkpoint 4. | Implemented across `src/venture/`, `venture/AGENTS.md`, rules, and schema contract. | Extensive phase/state/CLI tests. | Keep the master and root scan docs synchronized with runtime predicates. |
| Intake and Phase 1 Attention | 25-question intake, fixed scorecard, reviewed research plan, platform decision, 10 ideas, exactly 3 selected probes, approvals/live evidence, research-read continuation decision. | Implemented. | Unit/CLI plus disposable-browser intake/autosave/commit. | Run a real venture through model-produced plan/ideas/drafts and real delivery evidence. |
| Phase 2 Audience | Select lead magnet, draft magnet and landing-page copy, review existing survey, draft welcome email, optional announcement. External capture/survey already exist. | Implemented as composition and gates. No Venture-specific email provider is built. | Unit/CLI tests. | Installation, capture, Venture email delivery, and live confirmation remain manual/outside the repo. Content Studio Outreach email is tracked separately below. |
| Phase 3 Offer | Privacy-preserving response intake, 20 minimum/30 target gate, clusters, problem and transformation decisions, outline, price/format, price decision, checkpoint 3. | Implemented. | Strong tests plus browser response/artifact writes. | Survey response ingestion is manual; no external survey/email connector. Real-volume analysis remains operationally unverified. |
| Phase 4 Operations | Time-budget choice, approved operating plan, manual thank-yous, approved Day-14 facts, final explicit decision. | Implemented. | Unit/CLI tests. | No real Day-14 run yet. Thank-you delivery remains manual by design. |
| Venture Studio UI | Work/Documents/Intake and guardrails/History, decision and artifact actions, response intake, evidence, pace/checkpoint, one engine-owned next step, and queued per-artifact delivery/retry controls. | Implemented across Venture review modules; delivery reuses the existing manual handoff and shared Substack slot machinery, while retry is exposed only for provider failures classified retryable. | Deterministic UI, lifecycle, queue, and browser write coverage. One bounded authenticated Claude Phase 1 canary ran through the production Venture runner after its prompt was aligned with the executable argument and `plan-init` schemas: it created exactly one unreviewed research-plan artifact with no confirmed knowns, changed no decisions or intake bytes, stopped for Muxin's plan review, and retained a completed Claude job record. | Later Venture model steps and authenticated Substack delivery remain operationally unverified. The bounded Phase 1 pass proves the adapter and human stop, not general Venture composition quality. |
| Venture to Content | Approved primary Phase-1 post/note can idempotently become a normal Content source without claiming it went live. | Implemented in PR #406. | Unit/route coverage. | Decide whether the Venture artifact should record a queued handoff state. Downstream Content generation/media gaps still apply. |

## Outreach

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Fit lifecycle | Source/add, cited research, qualify, pursue/pass, editable draft, lock, approved send, per-person follow-ups. Poor fits never advance. | Implemented for client/platform flows with JSA read-only integration and matchmaker reads. | Extensive deterministic tests, selected historic real research, disposable GUI draft/revision coverage, and the bounded authenticated Claude drafting evidence described below. | Component boundaries are verified, but one signed-in source-to-draft-to-lock-to-send GUI lifecycle has not run. Gmail delivery remains provider-unverified pending explicit approval for the authenticated send/reconcile canary. |
| Matchmaker read | Show why them, why Muxin, and why now before the yes/no choice. | Implemented and surfaced. | Unit/UI coverage. | Keep sources and current direction editable and visible. |
| Discovery | Bounded cited scouting rotates a belief, community dialect, modality, and trusted-anchor subset; clients start from a named person's quoted worldview trail. Permanent frontier, pass-reason learning, mid-tail policy, disconfirmation downgrade, calibration, total batch cap, and bounded rate-limit retry fail closed in code. | **Phase 5 deterministic implementation complete on the current branch.** Model query expansion remains bounded by the rotated lens and one-to-two-hop public graph prompt; deterministic gates own what may be written. | Red-green unit/integration coverage exercises lens rotation, graph context, pass feedback, canonical identity, people-first evidence, disconfirmation, mid-tail caps, rate limits, success/failure ledger, cold-profile gating, and a hard five-lead whole-run cap. Final local check passes 3,748/3,748; Grok 4.5's read-only cross-family audit reports no remaining release blocker. | Run one real signed-in Scout sweep and inspect the surfaced candidates, citations, skip reasons, rate-limit behavior, and append-only run ledger. Until then, do not claim live discovery quality or operational completion. |
| Contact selection | Muxin can use extracted contacts or add one manually. | Implemented manual/research-extracted path. | UI/unit coverage. | Automated contact discovery and public-email harvesting are not implemented. |
| Draft, edit, lock | Direction input, engine choice, direct edit, revise with model, validation, immutable lock. | Implemented. The prompt now directs the model to open with the evidenced practice instead of inventing an encounter, forbids prose colons in the short message, and names the antithetical cadence ban. The post-generation boundary deterministically rejects enumerated population/prevalence and Muxin-interest syntactic classes. Population/prevalence claims require the complete normalized sentence in cited evidence or Muxin's direction; first-person, selected-adverb, greeting-elliptical, and bare-opening read/saw/liked/loved/enjoyed/followed/worked-on claims require the complete normalized generated sentence in Muxin's direction. Full-sentence authorization prevents predicate, object, and polarity substitution. The same shared hard `config/voice.yaml` checker now runs at both Content and Outreach generation boundaries; Outreach refuses findings before any message, queue, or cost write. These bounded grammars intentionally do not pretend to prove arbitrary entailment, which remains part of pending human review. Successful execution logs retain the selected engine. | Unit/route/UI coverage plus disposable Chromium through the real first-draft and same-file revision controls, with a one-run token-gated injected engine, a real pending queue row, durable message bytes, and no live model call. Authenticated Claude canaries exposed unsupported prevalence, invented encounters, lowercase-after-colon prose, and an antithetical voice tell; the hard boundaries rejected those samples before persistence, while human review separately rejected an unsupported presupposition. After prompt alignment, one bounded authenticated sample passed the claim and voice guards plus independent cross-family human review: it stayed grounded in E1/E2, used conditional rather than presumed breakage, retained one pending row, logged zero-cost Claude provenance, and sent nothing. This proves the bounded adapter/draft path and layered gates, not general model quality. | Keep both deterministic boundaries and pending human review fail closed. Repeat the bounded canary when the adapter or voice policy changes; do not generalize one accepted sample into a broad quality claim. |
| Send | Send a locked message from the Content Agents GUI through the exact connected Gmail account after Muxin's explicit confirmation; retain manual/external sending for unsupported channels such as LinkedIn DMs. | Implemented locally with exact-account OAuth verification, locked-email-only route/UI, append-only intent/outcome evidence, deterministic Sent-mail reconciliation, and automatic confirmed sent-state updates. Manual “sent elsewhere” remains available. | Provider, ledger, reconciliation, route-contract, UI-contract, and follow-up-state tests; final local `npm run check` passes 3,907/3,907. | Run one explicitly approved authenticated Gmail send/reconcile canary; until then, keep the path provider-unverified. |
| Follow-ups | Append-only per-person clocks with origin context; client/platform/peer/inbound/job-search buckets (peer added 2026-09-02 for Boardy-style intros); mark sent/responded/move on; no guilt styling. The read-only weekly Strategy summary includes the borrowed-audience target list, every bucket's counts, and honest degraded JSA state. | Implemented, including Strategy integration on the current branch. | Strong tests, browser tracker write coverage, renderer tests, and a successful real local `outreach:strategy-summary` read. | Drafting support is limited for buckets without lead folders. Actual delivery remains external. |
| Outreach to Content | Locked outreach can become extraction-first Content source. | Existing reuse path. | Deterministic tests around source/lock boundaries. | Exclude cold B2B outreach derivatives from resonance metrics until the open strategy decision is implemented. |

## Fiction

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Co-creation surface | Write next accepts beats; Review drafts supports scene review, continuity, direct passage edits, and notes; Promotion is separate; canon stays in the rail. | Implemented through PRs #404/#406/#407. Claude drafting and repass now run in a disposable staged workspace that excludes Git metadata, secrets, and operational data; only the exact next chapter creation or target-chapter replacement may be imported after full-tree mutation validation and an optimistic live-series drift check. The scoped Claude invocation permits only the story validator. Fiction beats, continuity reports, and review notes honor `CONTENT_AGENTS_DATA_ROOT`. | Strong unit/route tests and real disposable-Chromium exact-passage edit/history pass. A bounded authenticated Claude continuity canary ran the production command against `the-least-of-us` chapter 1, wrote a fresh Claude-stamped local report with three holds and no conflicts, and left the tracked story, git state, and cost log unchanged. A later authenticated disposable-repository canary exercised the production Studio queue from chapter-2 draft through automatic continuity, instruction-bound repass, and automatic continuity again. The generated chapter passed `story:validate`, contained no en/em dash, preserved Git refs, cleaned its internal model stages, and wrote Claude provenance plus beats, continuity, and review-note evidence only beneath the configured canary data root. The post-repass continuity run exceeded its first 240-second cap and completed on the offered retry. The subsequent restricted-mode/exact-command hardening was verified separately with an authenticated Claude CLI probe and focused tests, not by rerunning the complete workflow canary. | The workflow model calls are authenticated-canary verified, while the final restricted argv boundary has separate authenticated probe evidence. Browser interaction and the GitHub final-approval workflow remain operationally unverified; rerun one bounded workflow canary only when the drafting adapter changes again or before broader release. |
| Final chapter approval | GitHub PR is the final chapter review loop. Surgical comment-driven changes only. Lock updates append-only canon. | Existing `/story` workflow remains authoritative. The local P2 slice adds an explicit Studio action that creates or reconnects to the prescribed draft chapter PR and refuses unrelated dirty state, a wrong branch, a mismatched PR, a local commit that differs from the PR head, or a non-GitHub remote. Creating the PR intentionally parks the checkout on its story branch; canon-document approvals are then blocked until the operator returns to `main`. | Deterministic command-adapter tests cover the sole-chapter commit boundary, existing-PR idempotence, exact branch/PR/SHA verification, and command failures. | Authenticated GitHub creation/reply behavior still needs an attended canary on a disposable chapter PR. Lock remains an explicit post-merge `/story lock` action. |
| Idea routing | Fiction should accept an idea and decide whether it belongs in world, character, plot, chapter, or imagery while preserving Muxin's wording for non-chapter material. | Implemented locally as the default Fiction page: exact raw text and exact ordered clarification turns persist outside git; the subscription-selected Claude, Grok, or Codex CLI classifies to the six-value destination union with fail-closed `clarify`; GPT-OSS is paused; non-chapter cleanup remains a provenance-bearing review proposal; main-branch authorization is required before approval can change the normalized writable document; chapter approval sends exact author context to the existing draft queue. | Focused tests cover abstention, durable clarification, byte preservation, proposal integrity, selected-doc-only writes, main-branch authorization, chapter handoff, path guards, and read-only CLI arguments. A token-and-marker-gated disposable Chromium pass drives the real Fiction GUI from byte-exact raw input through review and explicit canonical approval, proving no pre-review write, one exact cleaned append, untouched unrelated canon, durable approved state, and no live model call. Authenticated Grok, Claude, and Codex subscription canaries each classified a bounded station-signal rule as `world` and returned its already-clean wording byte-for-byte through the exact production adapter; the Codex pass used `The station signal changes the weather above it.` and produced no inbox, proposal, canon, job, GitHub, or provider write. | All three bounded subscription adapter canaries are complete. The wider authenticated GUI-to-proposal/canonical-write and chapter/GitHub workflow remains separate operational verification. |
| PR comment engine routing | Muxin may name different engines for individual GitHub comment edits. | Implemented locally as an explicit Studio action. Each unresolved root review comment binds to one exact current line/range, may select Claude/Grok/Codex independently, defaults deterministically when no engine is named, blocks unknown/conflicting/GPT-OSS write requests, applies replacements bottom-up, validates before push, persists a resumable operation before Git/GitHub side effects, replies without auto-resolving, and records durable provenance. Subscription CLIs receive read-only/no-tools arguments. | Deterministic tests cover multi-engine parsing, malformed/outdated/overlapping spans, unrelated-byte preservation, keep/no-op comments, validation rollback, commit/push/reply-failure idempotence, root-thread filtering, and exact matching-PR preflight. | Authenticated GitHub comment ingestion, subscription CLI revisions, replies, and push still need an attended disposable-PR canary. |
| Fiction to Content | Approved promotion based on approved/locked chapter may enter Content with fixed Fiction ownership. | Typed handoff exists. The working tree preserves the approved promo body and canon/source restrictions, permits only an untreated control, and records a blocked delivery-policy outcome when no Fiction account is configured. | Deterministic handoff, generation-policy, delivery-policy, and publishing-ledger coverage. | Deterministic safety boundaries are closed. Operational provider delivery remains blocked until Fiction has a separately configured and verified platform/account mapping. |

## Charles

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Persona drafting | One-liner, essay, and reply composed under `charles/config/persona.yaml`; memes stay external; never apply Muxin's voice. | Implemented. Every newly generated queue row is stamped with its selected engine, the queue is normalized to a backward-compatible engine column, and Studio shows that provenance while labeling older rows as unstamped legacy drafts. The production boundary now runs the selected model inside a disposable Charles workspace, requires exactly one mode-specific draft plus one appended `pending` row, rejects unexpected file, directory, permission, or model-authored dash changes, and imports only the verified draft after an optimistic full-tree check proves live Charles state did not change during the model call. Failed or stale runs never restore over concurrent review/persona edits because the model never writes the live tree. | Strong deterministic prompt, leak-bank, queue-provenance, staged-transaction, drift, and UI tests. Bounded authenticated Claude one-liner and essay canaries ran through the exact production adapter in disposable repository snapshots. The final staged essay pass created exactly one valid persona-governed draft and one `pending` row stamped `claude`, used `calm_story_vs_frantic_maintenance`, declared no leak-bank items, wrote no em/en dash, cleaned its internal staging directory, and produced only the draft, queue mutation, and zero-dollar subscription cost record. An earlier essay attempt exposed an em dash that the old adapter accepted; the new fail-closed staged boundary was added from that evidence and the current-code canary then passed. The shared Charles subtree remained unchanged. | Grok/Codex drafting and reply mode remain operationally unverified. Repeat a bounded authenticated canary when an engine adapter changes, and preserve the leak-bank truthfulness boundary. |
| Review and editing | Input, Needs review, Approved, All; prose-only editor; append-only retry-safe review notes. Review-history reads now distinguish a healthy empty ledger from an unavailable store and surface the latter visibly instead of claiming no notes exist. | Implemented in PR #407 plus the current health-state correction. | Deterministic read/write failure coverage; disposable Chromium proves prose save, frontmatter preservation, retry deduplication, and reload history. | The review-history ledger remains local single-process JSONL; move it to a shared durable store only if Charles review becomes multi-process or multi-machine. |
| Persona editing | Muxin updates the production persona from Studio only through an exact old/new review gate; the original brief remains a separate verbatim copy surface. | Implemented in this change set. Saving validated YAML creates a digest-bound proposal without mutating `persona.yaml`; explicit approval atomically applies exactly the reviewed bytes and is retry-safe. Stale, tampered, malformed, schema-invalid, source-stripping, and client-path-injection attempts fail closed. Rejection changes nothing. | Focused unit and route tests cover proposal/save/approve/reject, exact bytes, digest conflicts, leak-source retention, server-owned paths, and the byte-exact brief. The disposable Chromium suite proves preview-before-mutation, exact approved-byte application, brief preservation, rejection without mutation, durable decisions after reload, and a clean browser session (42 pass, 0 fail, 17 deliberately blocked external/model paths across the full suite). This edit workflow makes no model call; broader Charles drafting remains operationally unverified beyond the bounded Claude one-liner canary above. | Keep persona-logic PRs held for Muxin's review and delivery manual. |
| Delivery | Charles remains ready-to-paste unless Muxin explicitly approves account automation. | Intentionally manual in `charles/AGENTS.md`. | Policy tests. | No Charles-owned provider/account implementation, by design. |
| Charles to Content | Approved Charles prose can enter Content without inheriting another venture/CTA. | Typed handoff exists. The working tree preserves approved prose and persona restrictions, refuses unsupported treatments, and records manual ready-to-paste delivery as private with no provider account. | Deterministic handoff, generation-policy, delivery-policy, and publishing-ledger coverage. | Deterministic safety boundaries are closed. Delivery remains intentionally manual unless Muxin explicitly changes the policy; no authenticated Charles provider path is claimed. |

## Signals, analytics, patterns, and Experiment

**Resolved architecture decision:** “Experiment” is the user-facing name for the capability
previously called Grow. Existing `src/grow/**`, `grow-*`, and `npm run grow:*` identifiers are
legacy implementation names and may remain until a deliberate migration; they do not define the
product boundary. Signals is the scientific intelligence layer: it reviews ordinary Content
performance and other qualified evidence, separates attention, conversation, audience, and
business outcomes, and recommends the next bounded content-growth experiment when a useful
uncertainty warrants publishing capacity. Experiment is the execution layer: it preserves the
approved hypothesis and lineage, creates controlled variants through the normal Content treatment
and cold-feed-editor path, obtains Muxin's approval, schedules safely, records observations, and
returns results to Signals for interpretation. Experiment does not invent its own rationale or
silently turn every post into a test.

Signals must rank approval-ready experiment proposals by confidence and expected information value,
then spend generation and publishing capacity on the strongest candidates first. Low-confidence
ideas are deferred before generation. A proposal may honestly return no experiment. Confidence is
a prioritization input, never a claim that a treatment has already won.

Experiment has no separate copy-review inbox. Muxin reviews the body-free scientific proposal in
Signals. Approving that plan authorizes creation of an experiment-tagged request through the same
configured Content generator used for ordinary work. The resulting variants receive the normal
treatments, blind cold-feed editor, voice/CTA/platform/media validation, and land as `pending` drafts
in the ordinary Content review queue. Muxin then edits, approves, rejects, and publishes them from
Content exactly like any other draft. Plan approval must not count as copy approval. The normal
Content queue is the sole copy approval authority.

Multiple experiments may be proposed, approved, drafting, running, or awaiting measurement at the
same time. Every request, draft, review row, delivery, provider observation, and outcome retains one
experiment id, allowing Content to show experiment context without becoming a second experiment
system and allowing Signals to group and interpret performance per experiment. Capacity prevents
over-scheduling; it does not impose a global one-experiment lock.

There are two distinct experiment families. A **content-growth experiment** is Signals-owned and
tests a general content, treatment, media, platform, distribution, or audience-growth question.
A **venture-learning experiment** is owned by one named Venture and tests that venture's market,
reader problem, product, offer, or demand hypothesis. Venture surveys belong to the latter: Venture
owns their questions, responses, clustering, interpretation, and phase decisions. Shared Experiment
machinery may provide review, scheduling, attribution, and measurement, but it may not detach a
Venture result from its venture context or reinterpret it as a global content rule. Any learning
crossing between Venture and Signals requires a visible reviewed handoff with provenance, scope,
sample size, an evidence-ladder tier, an honest claim ceiling, and caveats. Signals prioritizes
analytics and patterns; Venture remains the contextual authority for lead-generation, product, offer,
and strategy hypotheses.

Before Muxin can approve any experiment, its review must show: the observation and evidence that
motivated it; the proposed interpretation; a directional, falsifiable hypothesis; why the chosen
input is a valid test; the single controlled variable and held-constant factors; primary success
metric and outcome family; guardrails; sample size or duration; keep/revise/reject decision rule;
confidence and caveats; and why the opportunity is worth the publishing capacity. The proposal is
body-free. After plan approval, candidate copy must pass the same treatments, media/platform
configuration, voice validation, source/CTA rules, and blind cold-feed editor used by ordinary
Content generation before it appears as pending work in Content. A generic claim that a treatment
“may change outcomes” is not an approval-ready hypothesis.

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Analytics and strategy | Keep attention, conversation, audience, and business separate; thin data stays insufficient; no silent routing changes. | Analytics DB, strategy briefs, bets, routing/resonance, and recommendation layers exist. The Signals brand selector scopes measurements, Strategy recommendations, decisions, experiments, and reviewed outcome-ledger facts to Human Inference, Charles, or Fiction. A local `ingest:outcomes` boundary validates one explicit brand-bound funnel/business batch and appends it atomically to the canonical operational ledger; Signals reads landing visits, opt-ins, and separate business-event counts from that ledger. Legacy unassigned records stay visibly excluded rather than being attributed silently. | Deterministic parser, validation, atomic-write, revision, cross-brand isolation, route, UI, and browser brand-switch coverage plus historic operational analytics data. | Live landing-page, email-provider, payment-provider, and CRM connectors remain unimplemented; reviewed exports must be imported explicitly. Per-brand operational proof is tracked separately below. |
| Signals decisions | Muxin adopts or declines recommendations; an adopted recommendation may change behavior only through a separate visible review/apply gate. | Adoption creates an exact allowlisted cadence or routing proposal against a configuration digest. Muxin separately approves or rejects it, apply uses a write-ahead intent and conflict guard, restart reconciles an interrupted apply without guessing, and rollback requires the exact applied value plus evidence. Unsupported prose recommendations remain blocked. | Deterministic intent, allowlist, preview, review, apply, conflict, crash-recovery, rollback, append-only audit, concurrency, route, and UI coverage. | Expand the allowlist only with a reviewed typed delta and matching recovery semantics; never turn free-form recommendation prose directly into configuration writes. |
| Per-brand Signals | Human Inference, Charles, and Fiction have separate content, goals, strategy, and accounts. | **P2.4 implementation complete, including the 2026-09-01 cross-family audit corrections.** Analytics, research, Strategy reports/briefs/bets, Signals recommendations/decisions/experiments, publishing reuse, and measurement ingest now require an explicit canonical brand. Optional provider-account scope uses identity-compatible post/metric joins. A non-secret registry controls each brand's platform/provider and measurement-account mappings without credential values or Human Inference fallback. Human Inference remains bound to configured accounts, Charles remains manual/unconfigured, and Fiction remains blocked/unconfigured. Existing top-level briefs/bets and NULL-identity analytics remain visibly unassigned and unread. | Deterministic migration, identity-conflict, cross-brand/account isolation, same-title decision/proposal, experiment lineage/performance, direct-ingest refusal, delivery-wall, ledger/reuse, CLI-contract, UI, and browser-switch coverage. A bounded Grok 4.5 read-only audit found cross-brand tagging, CLI, ingest, and experiment-join gaps; focused red-green tests cover each correction. | Operational proof remains: configure and verify each intended provider account, exercise one signed-in brand-scoped Strategy/Experiment run, and migrate legacy unassigned history only through an explicit reviewed decision. Do not infer Charles automation or Fiction delivery from the partition existing. |
| Pattern evidence | Use reviewed common mechanisms without copying creator-specific prose; evidence and originality remain explicit. | **Phase 2 vertical slice complete.** Corpus, pattern, review metadata, evidence ledgers, mechanism blueprints, and reports/adapters exist. The first real `research-dossier-v2` records Muxin's approval of the bounded evidence and a separate `hypothesis` disposition for the used-to-think/now scaffold. The packet, receipt, caveats, citations, and no-winner boundary remain digest-bound. That dossier now feeds both the body-free Signals experiment boundary and one conditional Content recommendation without copying creator body. | Strong deterministic contract/report tests, including forged receipt, partial-approval, unknown-field, tamper, body, winner-claim, authority, exact-cut eligibility, and client-forgery failures; the approved real dossier is retained under `docs/reviews/`. | Continue expanding reviewed account metadata, baselines, platform/pool coverage, and the live mechanism ledger without calling the current evidence a winner claim. Each additional Content recommendation needs its own reviewed mapping and source-eligibility predicate. |
| Experiment lifecycle | Signals ranks and proposes content-growth experiments; Muxin approves plans in Signals; Experiment creates tagged work through the canonical Content generator; Content remains the sole copy-review and publishing surface; Signals later interprets grouped outcomes. Venture owns venture-learning experiments and surveys within one venture's hypothesis chain. | **Phase 3 implementation complete, including the 2026-08-31 cross-family audit corrections.** Signals can evaluate a persisted normal Content request against a digest-bound, Muxin-approved Phase 2 dossier through the wired Claude, Grok, or Codex subscription-CLI seam; the production route records either an honest no-experiment result or a ranked body-free plan. The approval view exposes the full science case and explicitly declared capacity. Generic hypotheses and missing or insufficient capacity fail closed, decline rationale is durable, and the retired legacy Grow CLI can no longer put copy into an approved queue state. Approved plans still use canonical Content generation, concurrent experiment identities, and pending-copy review. The measurement loop matches live provider identities to the latest analytics and attributed outcomes, then presents collecting/ready status and a separately reviewed keep/revise/reject interpretation. No path selects a winner or changes routing automatically. | Red-green tests cover production-route wiring with injected runners, canonical dossier replay, body-free prompts, honest abstention, complete approval evidence, generic-hypothesis rejection, capacity deferral, durable decline rationale, legacy pending-copy behavior, canonical generation, exact provider matching, readiness, and separately reviewed interpretation. On 2026-09-01, one fresh authenticated Claude request completed through the live production HTTP proposal route and recorded exactly one body-free, medium-confidence proposed plan; the persisted request and source were unchanged, and no decision, generation, handoff, publication, or provider activity occurred. The request used `curl` against the disposable live server because no browser backend was connected; it was not a browser-operated proof. A cross-family Codex audit found no P0/P1 issue and one P2 human-review caveat: the proposed guardrail duplicated the primary metric and its effect/noise threshold was underspecified, so the proposal has not passed scientific approval. | Exercise the proposal from the Studio browser, have Muxin review the plan's scientific quality, then run the first approved experiment through publication and data collection. Metrics absent from provider exports remain honestly collecting until explicit attributed rows enter `data/outcomes.jsonl`. Multi-pair operational cadence remains bounded by declared Content capacity and human review. |
| Cross-system learning and Venture handoff | Signals may offer analytics/experiment learning to one named Venture; Venture-native reader responses enter from their existing manually judged intake. Muxin separately reviews every recommendation. | **Phase 4 deterministic implementation complete on the current branch, including the 2026-09-01 audit corrections.** Engagement → attention; qualitative/comments → resonance; surveys → stated-need; directional → directional-comparison; controlled → bounded-comparison; funnel → behavioral-intent; business → observed-demand. Ordinary account-level analytics and redacted comment/reply/DM/email observations are listed from `data/analytics.db` as reviewable Venture learning sources; exact text and respondent hashes never enter the evaluator. Signals remains analytics/pattern prioritization; Venture remains contextual hypothesis authority for lead-generation, product, offer, and strategy. Accepted learning may recommend no-change/change/test without upgrading evidence. Signals-origin adoption creates one internal, non-publishable `signals-input` artifact plus an append-only canon decision; Venture-native surveys/comments/emails/DMs use their existing explicit response-intake judgment instead of a redundant Signals gate. Neither path clears a checkpoint, advances a phase, publishes, selects a winner, changes configuration, or claims demand automatically. Accepted tests flow through the canonical Experiment planner, normal plan approval, canonical Content drafting/review/publishing/measurement, then back to Signals and Venture learning; the normal queue supports multiple experiments. | Deterministic contract, lifecycle, lineage, tier/ceiling, tamper, idempotency, ordinary-engagement intake, redaction, and rules-parity coverage. No operational live proof is claimed until a real reviewed loop is run. | Run one complete reviewed loop with real evidence after operational verification is authorized; preserve deterministic-only status meanwhile. |

## Room-model execution order — start here in a new session

The work recorded in decision 10. All six gaps are agreed; there is no preference order among them,
so this is the order the code forces. Full inventory with file and line references:
`docs/content-room-alignment-plan.md`. **Approved to build (2026-09-03)** — see "Standing
authorization" at the top of this doc. Rule 7 requires recorded local verification and any
required cross-family audit; the former separate draft/PR-review hold was retired on 2026-09-04.

**Two prerequisites, both cheap, both blocking.**

- **P1 — one source of truth for platform limits. DONE and merged (2026-09-03), PR #442.**
  `src/review/jobs.ts` no longer hardcodes `CONFIGURED_PLATFORM_LIMITS`; a memoized
  `configuredPlatformLimit()` reads `config/platforms.yaml` `max_chars`, the same source
  `src/atomize/validate.ts` uses. Pure identity refactor (delta: none — see PR body's limits table);
  a regression test pins every value. It landed **before** item 1, as required, so item 1 wires
  Venture into the config-backed limit check rather than the retired table. **P2 branched on #442.**
- **P2 — the editor registry, and un-fusing the editor from provenance — DONE and merged, PR #455.** It replaced the single
  `configuredColdFeedEditorPrompt` (`jobs.ts:443-461`) with a registry of named editors, one per
  source kind, each a complete independent instruction set carrying its own voice rubric and its
  own `editor_pass:` stamp (decision 10b2). In the same change, split the `jobs.ts:804` gate
  `treated.length && authoritative?.sourceLines.length` into its two separate questions:
  scannability and traceability are different concerns. Items 1 and 2 both need this; building it
  once first is the difference between one change and the same change made twice incompatibly.

**Then the forced chain.**

- **Item 1, Venture, after P2 — DONE and merged, PR #456.** The Venture branch at `jobs.ts:793-803` was deleted and Venture now takes the
  same editor pass and limit check as every other origin. It had to come after P2: deleting
  the branch drops Venture through to the `:804` gate, which is false for it
  (`resolveConfiguredAuthoritative` returns `null` for Venture), so without P2 one bypass is simply
  replaced by another. Venture keeps its scoped tracing exception (`claim_refs`, not
  `source_lines`); that exemption is from tracing, not from the editor.
- **Item 2, Fiction and Charles, after item 1 — DONE and merged, PR #457.** Both rewrote the same
  `jobs.ts` region, so they were serial in merge. Treated variants now select their origin-specific
  editor/stamp; Charles's check is independent of `muxinVoiceFindings()`. The evidence file records
  the bounded live canary and the P2 hardening checklist.
- **Item 3 splits. 3a is DONE (2026-09-02, evening).** `/cycle`'s review and publish steps
  duplicated what the Content room already owns and were retired: steps 4 and 5 are gone from
  `.claude/skills/cycle/SKILL.md`, the wrap-up now points at the Content room, a "Retired steps"
  note records why so they are not re-added, and `README.md` and `CLAUDE.md`'s pipeline table no
  longer claim `/cycle` reviews or publishes. Its drafting step is deliberately untouched (**3b**,
  still held). Its drafting step cannot be
  retired until Content can do what `/atomize` does, so **3b depends on the item 5 port** —
  retiring drafting first would delete the only working path.
- **Item 6 is VERIFIED (2026-09-02, evening) — no code change needed, two findings.** Media type
  *is* auto-selected per source with a stated reason, pre-checked in the GUI (`page.ts:2991` seeds
  the media choices from the recommendations), overridable by hand, and staged behind an approval
  gate before any renderer runs. Read live against Muxin's real essay: topic `civic-technology`,
  recommending `static-quote-card` and `short-video-script`. **Finding 6a:** `image-carousel` can
  never be auto-recommended for a Substack-ingested essay — the rule needs three markdown headings
  and `htmlToText` emits none, so an ingested essay has zero by construction; the fix lives in
  `fetch-substack.ts` and would shift every `source_lines` number, so it is recorded, not built.
  **Finding 6b, fixed:** `GET /api/content/treatment` 400ed for every piece, because
  `treatment.ts` called `loadData()` unbound and `loadData` requires an explicit brand. Every test
  in `treatment.test.ts` injects data, so the 4,040-test gate never saw it. `readTreatment` now
  takes a measurement context and refuses an unbound read by name; `serve.ts` resolves the brand
  from the piece's own request origin, then an explicit `?brand=`, and 400s naming the missing
  brand if neither exists. No Human Inference default.
  Evidence: `docs/evidence-lane-b-2026-09-02.md`.
- **Item 4 — all Decision 11 room queues DONE and merged; Fiction leg was PR #443 (`d682d77`).** Studio Start
  (`POST /api/captures/start`) takes an optional `room` (default `"Content"`), and for Fiction lands
  the capture as a durable inbox idea via `createIdea()` — `needs-review`, no model job, client no
  longer prefills `#ficIdea`. **Historical premise, superseded by Decision 11:** Charles, Venture,
  and Outreach initially had no lightweight item store. Decision 11 subsequently defined and
  implemented their durable per-room queues, so this is no longer an open product question.
  Correction to the original premise:
  a routed capture is not lost on reload — `takeCaptureTo` persists it via `POST /api/captures`
  before advancing; the real gap was promotion into the room's own item type.
- **Item 5 is its own sequence:** the platform routing gate first (it decides which variants get
  made at all), then `validate`, then the remaining seven capabilities, which are largely
  independent of one another once those two land.

**What is genuinely parallel: two lanes, not three.**

| Lane | Work | Touches | Notes |
|---|---|---|---|
| A | P1, P2, item 1, item 2 | `src/review/jobs.ts` | Strictly serial within itself: one file, one region. |
| B | Decision 11 per-room queues, item 4, item 6, 3a, and the `/atomize` content-request fix are all DONE. | `serve.ts`, `page.ts`, skills, verification | No remaining Lane-B work. |
| C | Item 5's port sequence | `jobs.ts` generation path | **Collides with lane A on the same file.** Queue C behind A, or split the generation module before starting either. |

**One small independent fix worth doing early — DONE (2026-09-02, evening).** `/atomize` wrote no
`content-request.json`, which was the entire reason the 14 pending rows in
`content/2026-09-02-the-world-s-broken-what-do-we-do` were invisible in Content's approve step
(`page.ts:1616`). `src/atomize/content-request.ts` + `npm run content-request` now write one, called
from `/atomize` SKILL.md step 8.5. Verified against the real folder: `listPieces()` through
`page.ts`'s own filter returned **0** visible pieces before and returns that folder with its 14
pending rows after. The request records identity, the verbatim source body and `source_lines`
provenance, and selects no platform/media/treatment (zero derived variants) — Studio configured and
generated none of it. Evidence: `docs/evidence-lane-b-2026-09-02.md`.

**Verification split.** Lane A and lane C change what future runs generate and therefore require
their stronger tests, canary evidence, and cross-family audit. Lane B is routing, verification, and
bookkeeping, with one exception: **3b** removes a drafting path and receives the stronger verification.

## Prioritized remaining work

### P0: safety and truthfulness before broader use

Implemented in the PR #412 change set, with deterministic evidence:

1. Configured Muxin-voice generation enforces approved source/cut provenance, applies only
   source-grounded treatments within cited `source_lines`, and sends treated long-form derivatives
   through the blind cold-feed editor. Missing, mismatched, or out-of-bound references fail closed;
   untreated controls remain byte-exact.
2. Fiction/Charles handoffs preserve the approved body plus canon/persona/provenance/CTA
   restrictions in the durable Content request. Configured generation copies that body only for an
   untreated control and refuses treated variants before starting a job or writing output. Venture
   treated variants remain on their separate approved-artifact composition path, constrained by
   `claim_refs`, `config/voice.yaml`, and the no-invented-proof rule.
3. Delivery applies a versioned origin/brand/account policy at scheduling and provider boundaries.
   Charles is manual ready-to-paste, Fiction is blocked without its own account, Human Inference/
   Venture require exact account assertions, and ambiguous/missing origins are blocked.
4. `POST /api/content/generate` remains blocked by default in browser tests, but a one-run token
   tied to the disposable repository enables a deterministic injected engine for one Chromium pass.
   That pass proves GUI authority, traced pending output, zero external calls, and Fiction treatment
   refusal. Pass E separately inventories only authenticated live CLI execution as nondeterministic.

One bounded authenticated Codex CLI generation canary passed in a throwaway repository copy.
Some provider credentials and non-secret provider-account bindings are configured locally, but
the Postiz base URL, API key, and Bluesky account id are now configured in the parent `.env`
(the delivery policy and the Studio Notes pull additionally need the non-secret identity labels
`CONTENT_AGENTS_POSTIZ_ACCOUNT_ID=human-inference/postiz` and
`CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID=human-inference/substack` in that `.env`; on 2026-09-02 they
were supplied only in the Studio process environment), and
the Postiz draft canary, the attended matrix, and the nine-channel scheduled canary all passed on
2026-09-02. Before operationally broadening delivery to other providers, explicitly gate their canaries. Do not
treat a working-tree diff or deterministic test as a PR, merge, or live delivery proof. The
read-only `publish:substack -- --check` probe did confirm
that the saved Substack browser session is currently authenticated.

### P1: complete the promised operating loop

Repository implementation and deterministic verification are complete across merged PR #412 and
the current Phase 1 completion patch:

1. Studio capture is durable. Content starts one idempotent advisor job; Fiction, Outreach,
   Venture, and Charles open their existing human-gated next step without implying autonomous work.
2. Content configuration requires an authoritative approved cut before treatment formatting.
3. All seven configured media choices have source-bound stages, explicit approval, production
   dispatch, asset verification, promotion checkpoints, and retry-safe deterministic coverage.
4. Provider/account/object IDs and normalized delivered/deleted/canceled/failed/private/uncertain
   evidence persist append-only. Reconciliation never converts absence or transport failure into a
   guessed terminal state.
5. Scheduler, job, capture, publishing, and reconciliation state share one operational data root
   with cross-process locks, leases, migration, and fail-closed restart recovery.
6. Postiz-first discovery, Typefully fallback, explicit provider exceptions, and the attended
   lifecycle matrix are implemented and deterministic-tested. Until 2026-09-02 that deterministic
   coverage used a mocked per-integration media list that the real self-hosted public endpoint does
   not return, and the transport sent a `Bearer` prefix that Postiz's public API middleware rejects.
   Both were corrected against the published `postiz-app` controller and middleware source (see
   recorded decision 6). The same day the first live create returned 400 and showed that the
   create body, read route, and cancel semantics had also been guessed; those were rewritten from
   source (decision 7) and the Postiz draft lifecycle then passed live with terminal cleanup. The
   earlier claim that the adapter had been "fixed against the real API" was true for discovery only.
7. Signals uses separate propose, review, apply, recovery, and rollback events for exact allowlisted
   configuration deltas.

**Phase 1 acceptance gate: met for Postiz on 2026-09-02 (scheduled visibility and media included).**
Discovery authenticated; the approved attended matrix finished with terminal cleanup for every
created canary object (Postiz Bluesky draft `cmtkcv66m0001mn8mg0e07e0v`, Typefully LinkedIn draft
`10597216`) and YouTube declared as the explicit exception. One limit of that proof: Postiz runs
its per-provider validation only for non-draft creates, so a draft canary proves the API
lifecycle, not that the provider accepts the post. The earlier wording of this gate required a
Postiz `schedule` canary as well. Muxin approved that canary in writing on 2026-09-02 (far-future
schedule, immediate cancel, every connected channel), the gate was relaxed to admit it only with
`allowScheduled` evidence and seven days of lead, and all nine channels passed with terminal
cleanup and a clean window sweep. Media uploads are inside the claim: image and video fixtures were
registered through the public upload route and carried on the Instagram, TikTok, and YouTube
canaries. What remains is the first real delivery and the first real move through Studio, which
are ordinary operations, not gates.

### P2: complete product depth

1. Exercise Fiction's implemented conversational idea router, non-paraphrasing canonical updates,
   Studio-to-draft-PR bridge, and per-comment engine routing against the authenticated GitHub/model workflow.
2. Exercise the implemented Outreach Phase 5 discovery/calibration method in one signed-in live
   Scout run and review its citations and candidate quality; deterministic code and Strategy
   summary integration are complete in the held Phase 5 patch.
3. Review the Charles persona-edit change set (it sits on this recovery branch; no PR was ever
   opened for it); its disposable-browser workflow is verified, and delivery remains manual unless
   the policy changes.
4. Operationally verify the completed per-brand Strategy/Signals/account partitions with one
   signed-in Human Inference run. Keep Charles manual, Fiction blocked, and legacy history unassigned
   unless a separate reviewed migration explicitly binds it.
5. Populate and review pattern/account/baseline/mechanism evidence, then connect it to honest
   recommendations.
6. Exercise the implemented Experiment and Signals-to-Venture lifecycle with real publication,
   attributed outcome, two-room decisions, and a completed measurement window.

### Recorded product decisions

1. Postiz is the canonical primary social publishing infrastructure. Self-hosted Postiz is the
   default path for capabilities advertised by live discovery. The repository path is implemented
   and the text-draft lifecycle passed live on 2026-09-02; scheduled visibility and media remain open.
2. Typefully remains the working fallback and must not be removed before Postiz is implemented and
   verified.
6. Postiz discovery defaults an enabled, exactly recognized integration to text-only when the
   instance returns no explicit media list (decided 2026-09-02 from the `postiz-app` source, which
   returns none). Tightened later on 2026-09-02: text is a baseline only for x, linkedin, bluesky,
   mastodon, and threads. Instagram, TikTok, and YouTube require media at Postiz's `validatePosts`
   step, which runs only for non-draft creates, so they are recorded as `no-text-baseline` and
   never routed. Image and video stay unsupported on Postiz until a live upload lifecycle is
   verified. Disabled rows and unrecognized identifiers (for example `linkedin-page`, `facebook`)
   are recorded in the registry and never routed. This is the conservative form of a deliberate
   fail-closed choice; Muxin may reverse it.
7. Postiz lifecycle calls follow the `postiz-app` source, not a guessed REST shape (decided
   2026-09-02 after the first live create returned 400). Create sends CreatePostDto (`type`
   `draft`|`schedule`, `date`, `shortLink:false`, `tags:[]`, one post per `integration.id`); Postiz
   has no private visibility, so `private` is refused rather than downgraded, and media is refused
   until an upload lifecycle is verified. Read lists posts in a 45-day window around the known
   scheduled time because no read-by-id route exists; absent on read is an error. Cancel is the
   soft delete by id; absent from the window after cancel is the only cancellation proof Postiz
   offers, so reconcile maps absence to `canceled` and a still-listed row to its live state.
3. Outreach email is intended to send from the Content Agents GUI after Muxin's explicit approval.
   Successful sends must update sent state automatically. Manual/external sending remains the
   fallback for unsupported channels.
4. Charles delivery remains ready-to-paste. Do not infer account automation from the existence of
   a Content handoff.
8. Landscape video is allowed input; short-form output is a reframe, never a refusal (Muxin,
   2026-09-02). Requirements: (a) a landscape source (a podcast recording, for example) is
   accepted by the caption and short-video paths; (b) short-form vertical output crops it rather
   than letterboxing or squashing; (c) a two-person side-by-side layout becomes two half-crops
   stacked top and bottom so both people stay visible; (d) a single-person shot becomes a
   centered crop around the person; (e) locating the person uses free local face detection
   (the smallest add is OpenCV; the venv has neither OpenCV nor MediaPipe today); (f) layouts
   that cut between full-screen speakers need per-shot detection and are a later step. Not built
   yet by Muxin's ordering: prove the base content loop first, and podcasting is not a live
   channel. Until built, landscape input is refused rather than squashed.
   Added 2026-09-02: a readable podcast transcript is part of the same package. The caption
   package's transcript today is raw whisper output in one block; for a podcast it must also
   produce a clean, formatted transcript (paragraphs, speaker labels, light cleanup of filler,
   no invented words) that a reader can use instead of watching. Not built yet, same ordering.
9. Client outreach is parked, not deleted (Muxin, 2026-09-02). The `client` discovery kind, its
   rubrics (`config/outreach/clients.md`, `config/outreach/person-fit.md`), and the existing
   `outreach/leads/client-*` folders stay in place, but no Phase 5 run targets clients and the
   Studio should not push client work at her. The live focus is platforms that would feature her
   civic work and Human Inference, and peers who share those concerns and understand funding.
   Scout runs default to `--kinds platform` with a short `--theme` sentence in that spirit, the
   way she briefs Boardy. `config/outreach/brief.md` is her short statement of what she wants
   (platforms that would feature her; peers who share the civic and democracy-tech concerns and
   understand non-dilutive funding; anchors: the Collective Intelligence Project and Audrey Tang)
   and the platform scout prompt puts it first, declared to win over the older rubric files,
   which she considers mostly stale. Boardy-style intros need no deep analysis. A peer/funder
   discovery kind does not exist yet; adding one is outreach prompt logic and holds for her review.
10. **The room model is the architecture (Muxin, 2026-09-02).** Each room does its own job within
   its own scope and has a button to move its output into Content; it does not need to be an
   automated pipeline. Studio routes a capture to the right room and creates nothing itself.
   Venture builds the business, feeds its session ideas into Content queued for social posting,
   and must be able to answer "how did this post do?" by pulling data on anything being tested.
   Fiction and Charles are specific kinds of input that need their own interactions to get right;
   the outcome may be a chapter, an essay in Charles's voice, or just a post. **Content takes any
   room's output as its input and makes the variations for every platform** — treatments, media
   (auto-selected, manually tweakable), review of everything created, and Muxin's approval of what
   publishes. That is why the editor belongs on Content: Content is where social creation and
   distribution happen. A handed-off piece lands at Content's pick-a-source step so she can work
   one idea at a time through treatments and review.
   Four consequences follow, and only the last is already true in code:
   (a) **Content always runs the editor.** The venture-only branch at `src/review/jobs.ts:793-803`
   that skips the editor, the platform limits and the mechanism authorization is a bypass to
   delete. Venture keeps its scoped tracing exception (`claim_refs`, not `source_lines`); that
   exemption is from tracing, not from the editor.
   (b) **Content must be able to make platform variations of Fiction and Charles work**, which
   `jobs.ts:608-610` blocks outright today. It should apply good hooks and storytelling while
   retaining the voice and the point of the original input, and it must know it is handling a
   Charles or Fiction source so it does not over-flatten the piece with generic optimization. That
   needs a mechanically checkable restricted treatment, the editor un-fused from `source_lines`
   provenance, and an editor chosen by source kind (next paragraph).
   (b2) **Separate editors, not one editor with multiple personalities** (Muxin, 2026-09-02).
   There is one editor today, `configuredColdFeedEditorPrompt` (`src/review/jobs.ts:443-461`),
   with `config/voice.yaml` written into it as a literal instruction and called for every origin.
   The replacement is a registry of named editors, one per source kind — a Fiction social editor,
   a Charles social editor, a Venture social editor, and today's prompt moved in unchanged as the
   Studio/Human-Inference one — each a complete, independent instruction set for its own focus,
   each carrying its own voice rubric (`charles/config/persona.yaml` for Charles, with the em-dash
   ban carrying over to all) and its own `editor_pass:` stamp so a derivative records which editor
   made it. A single prompt that switches voice contracts by condition is explicitly rejected.
   (c) **`/cycle` predates this model and contradicts it.** Its drafting/review/publish steps
   duplicate the Content room and produce work Content's approve step cannot see; its ingest and
   strategy steps have no room equivalent and stay.
   (d) **Venture measurement already works** through the Signals experiment path with live
   analytics readback, which is the mechanism Muxin recalled.
   All six gaps are agreed work with no preference order among them (Muxin, 2026-09-02); the
   running order is the one the code forces. Two cheap prerequisites gate the rest — settling
   platform limits on `config/platforms.yaml` instead of the hardcoded table at `jobs.ts:438-440`,
   and building the editor registry while un-fusing the editor from `source_lines` provenance at
   `jobs.ts:804`. Then Venture, then Fiction/Charles. Two lanes run genuinely in parallel: the
   `jobs.ts` editor lane, and an independent lane holding Studio Start, the media auto-selection
   check, retiring `/cycle`'s review and publish steps, and making `/atomize` write a
   `content-request.json` so already-drafted work becomes reviewable. The `/atomize` capability
   port collides with the editor lane on the same file and queues behind it; retiring `/cycle`'s
   drafting step depends on that port finishing. The full inventory, dependency chain, parallelism
   table is `docs/content-room-alignment-plan.md`. **These capabilities are authorized under
   Standing authorization above; the current START HERE handoff owns sequence and completion.
   The separate rule-7 review hold was retired on 2026-09-04.**
11. **Per-room queues, and Studio Start files into them (Muxin, 2026-09-03 — approved to build).**
   Refines decision 10's "Studio creates nothing itself": Studio Start's safe create action is to
   file a routed capture into the destination room's own queue as a durable item — it still
   generates no content (consistent with the item-4 Fiction inbox already shipped, PR #443). Every
   room home (Fiction, Charles, Venture) gains a **queue at the bottom of its home page**, reusing
   Content's pick-a-source visual pattern (`cw-src` rows: tag pill + title + meta + action,
   `src/review/page.ts:3071`). The queue is **expandable: collapsed by default showing only a count
   of pending items, expand to reveal the rows.** Clicking a row resumes *that room's native
   interaction* (Venture chat, Fiction chat/drafting, Charles drafting) — not a Content handoff.
   Bottom-of-home append points: Fiction `renderFiction()` (`page.ts:4895`), Charles
   `renderCharles()` (`page.ts:5347`), Venture `renderVenture()` (`page.ts:4191`).
   Per-room specifics:
   - **Venture — one queue per venture** (`venture/<slug>/`; enumerate with `listVentures()`,
     `src/venture/paths.ts:20`). The capture names its venture ("this is for <venture>"); Studio
     matches that to a venture slug and files it into that venture's queue. **If the venture is
     unclear or ambiguous, Studio asks Muxin which venture** rather than guessing or misfiling.
   - **Fiction — its own queue; no auto draft-vs-canon classification** (reverses an earlier
     2026-09-03 idea of an auto-classifier). A queued Fiction capture opens a chat with the Fiction
     agent; the agent **confirms with Muxin before writing anything canon-like** (canon.md,
     bible.md, outline.md, characters/) — canon integrity stays human-gated, consistent with the
     idea inbox already refusing to write `canon.md` (`src/fiction/idea-inbox.ts:274`). Plain draft
     ideas still use `createIdea` → `stories/<series>/ideas.json` (`idea-inbox.ts:136`).
   - **Charles — single queue; per-capture multi-select of output types** (essay, quick
     post/oneliner, reply — any and all, not one at a time). The multi-select composer already
     exists (`.charles-format` checkboxes, `page.ts:5248-5265`); wire it to the Studio Start and
     queue path. The Charles **review room shows all outputs from one capture together**: an essay
     sits in its own scrollable sub-window, openable to a focus mode for editing, with the other
     posts/first-drafts stacked below it — the essay does not fill the whole pane.
   Studio Start routing today has only Content + Fiction branches (`serve.ts:1420-1444`); the
   Venture and Charles branches and all three bottom-of-home queues are net-new. Rule 7: this is
   UI + input-routing, not content-generation logic (it changes where a capture lands and how a
   room is browsed, not the words a run produces), so **all of it self-vet merges**. The Fiction
   confirm-before-canon step is a routing/gate and a Charles "suggest output type" step is
   classification — neither *composes* content, so by the narrowed rule 7 (only changes to how
   content is *created* hold) neither holds. What holds is unchanged and out of scope here: the
   actual composition of story/canon prose (Build 2 fiction-drafting logic) and Charles persona
   prose (Build 4) — this decision touches neither. **Confirmed by Muxin 2026-09-03** when an
   adversarial review pushed back: the only thing she wants a held PR on is *actual fiction chapter
   prose*, where she comments line-by-line on the passage. Nothing in decision 11 — queues,
   routing, Venture disambiguation, Charles output-type multi-select/fan-out, the Fiction
   confirm-before-canon gate — is that, so the whole feature self-vet merges.

### Decision 11 build order — REVISED to contracts-first (Codex review, Muxin 2026-09-03)

A cross-family adversarial review (Codex/OpenAI, repo-grounded) of the whole decision-11 plan
returned **"slicing not sound as-is: build the durable capture/state contracts and the Fiction
confirm gate first, then the queues."** Muxin chose **contracts-first, hold #448**. So the order is
now:

- **Slice 1 (built, PR #448, GREEN 4056/4056, HELD as a draft — do not merge yet).** Shared
  `roomQueueHtml()` + Fiction bottom queue reading `ficInbox` needs-review. Kept open so the helper
  + wiring are ready to re-target. It is a shortcut into Fiction's *existing* classifier →
  "Approve for canonical update" path (`idea-inbox.ts` writes canon), i.e. the very path the
  confirm gate replaces — so it must not ship before the gate exists. (Fix landed in this branch:
  the client `<script>` is inside a template literal, so a source `\s` is eaten and emits `/s+/g`;
  regexes in that region need `\\s`. `page.test.ts` enforces even-length backslash runs — run it.)
- **Slice 1.5 — DONE (branch `feat/capture-contracts-slice15`, 4 commits).** The capture/state
  contracts, foundation findings 3–10. Item→commit map: **1** (durable capture identity + CAS
  answer) → 1.5b `7ca0d5f` (`venture-resolver.ts`, `venture-queue.ts`); **2** (append-only event
  log + room projections + legacy migration) → 1.5a `fd3268f` (`captures.ts` front door,
  `room-queue.ts` projections, `projectCaptureEvents`); **3** (7-state lifecycle + collapsed count =
  the 4 pending states) → 1.5a `fd3268f` (`QUEUE_STATES`/`PENDING_STATES`/`pendingCount`); **4**
  (Fiction two-store link + reconciliation) → 1.5c `e07b0e1` (`captureId` on `IdeaRecord`,
  `syncFictionQueue`); **5** (Charles group model, per-output status, persist-before-draft) → 1.5d
  `59289ec` (`charles-queue.ts` durable group + double-draft-safe `runCharlesGroup`); **6** (Venture
  name→slug resolver, never trusts client slug) → 1.5b `7ca0d5f` (`resolveVentureMention`); **7**
  (Fiction confirm-before-canon state machine + resume payloads) → 1.5c `e07b0e1` (`openCanonGate`/
  `confirmCanonGate`/`cancelCanonGate`, `fictionResume`). Original spec preserved below:
  1. **Durable capture identity + protocol.** Today a capture id is derived from room+trimmed text
     (`captures.ts:24-31`) and the client resends only `{room,text}`. Ambiguous Venture captures
     need a *persisted* `awaiting-venture` record with a stable id, a candidate snapshot, and a
     version; the `{needsVenture,candidates}` response must carry that id; the answer goes to an
     **idempotent** endpoint taking `captureId` + selected slug + expected version
     (compare-and-swap), server-validating the slug. Guards reload, two-tab divergence, retry
     dupes, venture-deleted-mid-select.
  2. **Capture schema as an append-only event log + room-owned projections.** `StudioCapture` v1
     (`captures.ts:7-20`) holds only room/text/timestamps/job — no venture slug, source-item id,
     lifecycle, Charles selection, or group id. Do NOT just bump `CAPTURE_VERSION` (that silently
     filters old rows out on `read()`). Treat the store as immutable front-door events; project
     into Venture-slug records, Fiction records linked to `ideas.json`, and Charles capture groups.
     Add an explicit migration that preserves legacy rows.
  3. **Queue lifecycle + count semantics.** Define states (`pending`, `awaiting-answer`,
     `in-progress`, `partially-complete`, `complete`, `rejected`, `archived`) and specify exactly
     which count in a collapsed queue summary — otherwise Venture/Charles counts grow forever.
  4. **Fiction two-store consistency.** Fiction Start writes `studio-captures.json` then separately
     `createIdea` (`serve.ts:1424-1431`) with no link → orphan on partial failure. Add a capture id
     to `IdeaRecord` (or make the queue record authoritative) + a reconciliation test. Route tests
     MUST inject an isolated `CONTENT_AGENTS_HOME` or they write Muxin's real inbox (the idea store
     ignores `NODE_TEST_CONTEXT`).
  5. **Charles group model.** The drafting validator requires exactly one new file + one queue row
     per run (`charles-jobs.ts:110-145`), so one capture can't fan out to essay+post+reply as a
     group today. Add a durable capture/group id + output type/ordinal per row; decide approval is
     per-output with group-level partial-complete; multi-select must persist the selection *before*
     drafting and return per-output status so a retry targets only the missing outputs (today the
     client POSTs types sequentially, `page.ts:5248-5265`, and a mid-way failure leaves an
     untracked half-set).
  6. **Venture name→slug resolver.** `capture-router` picks room only; there is no slug match.
     Build a deterministic resolver: exact slug/name → auto-resolve; fuzzy/NL mention → return
     candidates + require confirmation; define no-match and multiple-mention behavior. Never fall
     back to the client `ventureSlug` as an implicit default.
  7. **Fiction confirm-before-canon state machine.** Where the confirm/gate state lives, its
     conversation id, and that navigation alone is not "resume" — each room needs a resume payload
     (Venture: slug + destination phase; Fiction: conversation id + gate state; Charles: capture
     group + durable selected formats).
- **Slice 2 — DONE (2026-09-04):** the Charles/Venture per-room queues + re-target #448's Fiction
  queue at the new confirm flow, all client-only over the 1.5 contracts. 2a #448 (`2e467a7`) Fiction
  gate re-target + queue; 2b #452 (`1487a0b`) Venture queue + CAS answer picker; 2c #453 (`fbd355c`)
  Charles queue + single `/api/charles/group` run. Each cross-family codex-audited before merge.
- **Slice 3 — DONE (2026-09-04, PR #454 `92190d8`):** the Charles combined-review layout — outputs
  grouped by durable `payload.groupId`, essay in a bounded scrollable sub-window with a focus-mode
  editor (existing `/api/charles/doc`), shorter outputs stacked by ordinal, legacy posts as per-post
  pseudo-groups, per-output actions + partial-complete summary. Resume selects the lowest-ordinal
  drafted output and scrolls to it. Server (`page-charles.ts`) + client-script (`page.ts`) share
  argument-only grouping/order/resume helpers, pinned by a test running both copies. Deterministic
  ordinal order (`POSITIVE_INFINITY` sentinel + `postId` tie-break); duplicate empty group row can't
  shadow a real one. Presentation-only over the 1.5 contracts; four-round cross-family codex audit →
  PASS; self-vet merged. **This completes decision 11's per-room-queue slice ladder.**

**Acceptance checklist distilled from slice 3's four audit rounds (close these UP FRONT on any
"client-`<script>` UI over the contracts" slice — each was a real cross-family audit finding here):**
1. **Mirror parity is argument-only + executed by a test.** The server render and its client-`<script>`
   copy must both compute from their arguments (no reading a global like `charlesVisiblePosts()`
   *inside* the grouping helper). Pin it with a test that EXTRACTS the client copy from the emitted
   `<script>` (`new Function`) and runs it against the same fixtures — string-presence assertions on
   server HTML do not catch a client that went flat or misordered.
2. **Comparators must be total.** For missing/NaN/duplicate sort keys use `Number.POSITIVE_INFINITY`
   as the "missing" sentinel (NOT `MAX_SAFE_INTEGER` — a real value can equal it) plus a stable
   tie-break (e.g. `postId`). The test fixture must actually **discriminate** the sentinel: the wrong
   sentinel has to FAIL the assertion (give the finite-max entry a tie-break key that sorts opposite).
3. **Resume selects the intended element, not the array-first one.** Deep-link/resume must pick the
   lowest-ordinal drafted output via the shared helper and scroll to THAT `.charles-output`, not the
   group container (or a reply can land off-screen under a long essay window).
4. **Dedupe marks "seen" only after a row yields usable outputs.** An empty duplicate row must not
   shadow a later real one — add the id to the seen-set after the drafted/visible guard, with a test.
5. **Even-length backslash runs** in the client `<script>` (`\\s`), enforced by `page.test.ts`.
6. **Run `npm run check` UNSANDBOXED** (sandbox = phantom failures + EPERM).
7. **"Search for every other use of this symbol."** Replacing singleton DOM ids (`#charlesBody`,
   `#charlesEditBtn`, `#charlesRevisebox`) with per-output scoped selectors requires updating every
   reader — grep them all before assuming the swap is complete.

All of the above is still self-vet per the confirmed rule-7 scope above; "contracts-first" is an
engineering-soundness reorder, not a review-gate change.

## Known stale or historical documents

These files remain useful sources, but must not be read as current completion ledgers:

- `docs/session-handoff-2026-08-29.md`: recovery-branch snapshot predating PRs #404/#406/#407.
- `docs/content-studio-reset-handoff.md`: redesign starting point, not current status.
- `docs/venture-build-plan.md`: design authority/history with an obsolete “nothing built yet” line.
- `docs/multi-engine-plan.md` and `docs/handoff-multi-engine.md`: say designed/not built even though
  PR #406 implemented most dispatch boundaries; GPT-OSS attempts are now paused.
- `docs/publishing-logic-audit.md`: June snapshot predating current providers, platforms, and
  publishing-status ledger.
- `docs/setup-typefully.md`: stale network count and scheduling description; Typefully remains the
  working fallback while self-hosted Postiz is implemented and verified as primary.
- `docs/unified-queue-plan.md`: valuable original plan, but several gaps later shipped.
- Disposable `e2e/RESULTS.md` reports: point-in-time run artifacts, not cumulative product truth.
- `docs/content-system-blueprint.md` and `docs/content-system-contracts.md`: target contracts and
  scaffold inventory, not proof of integrated runtime behavior.
- `docs/outreach-engine-plan.md`: ratified behavior, not a live status ledger. Its Phase 5
  deterministic requirements are implemented by the current held patch; live Scout quality and
  rate-limit behavior remain operational proofs rather than claims.

## Source map

- Product intent: `docs/Muxin's Vision for Content Studio.md`, `docs/content-studio-vision.md`
- Pipeline scan: `CLAUDE.md`
- Studio UI/runtime: `src/review/`
- Publishing: `src/publish/`, `config/platforms.yaml`, `config/providers.yaml`
- Content artifacts: `content/`
- Venture: `venture/`, `src/venture/`, `docs/venture-schema-contract.md`
- Outreach: `src/outreach/`, `src/discovery/`, `config/outreach/`, `data/outreach/`
- Fiction: `stories/`, `src/fiction/`, `stories/AGENTS.md`
- Charles: `charles/`, `charles/AGENTS.md`
- Analytics/Signals: `src/db/`, `src/strategy/`, `src/review/signals*.ts`, `briefs/`
- Patterns/Grow contracts: `src/patterns/`, `src/grow/`, `docs/content-system-{blueprint,contracts}.md`
- Work index/history: `docs/content-agents-backlog.md`,
  `docs/content-agents-backlog.archive.md`, `docs/content-studio-program/work.yaml`

## Reconciliation checklist for future updates

Before changing a status in this file:

1. Name the merged commit or PR and the exact production path.
2. State whether evidence is unit, CLI, disposable browser, or authenticated live verification.
3. Confirm the implementation honors the latest product and scoped safety decisions.
4. Distinguish an adapter/type from an integrated write path.
5. Distinguish scheduled/accepted from confirmed live delivery.
6. Update any stale source named above or leave an explicit historical label.
7. Add only the actionable gap to the backlog through `prose_kanban`; keep the full explanation
   here and use the backlog as an index.
