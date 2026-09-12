# Content Studio master status

## START HERE

- Repo root: `/Users/Muxin/Documents/GitHub/content-agents` (main). Master: this file; rules:
  `AGENTS.md` -> `## Slice protocol` + `docs/operations/slice-protocol-environment.md`.
- Current / last accepted: **6Y**, `docs/operations/launch-slices/SLICE-6Y.md`, PASS. Nothing
  blocked. Every Postiz channel Muxin approves is schedulable, not just the one pinned account.
  `npm run check` 4419/0, `npm run test:e2e` 55/0/16.
- What changed: `POSTIZ_ACCOUNT_IDS` is a comma-separated allowlist of approved account ids,
  unioned with legacy `POSTIZ_ACCOUNT_ID` (still ONE opaque id, never split). Unapproved channels
  refuse and name the id to add. Ambiguity always refuses; it never guesses an account.
- Next: no packet written. `POSTIZ_ACCOUNT_IDS` is set and all nine channels resolve. The 6W
  deferral that blocked Threads is closed by 6Y. Unproven: no row has yet been scheduled live
  through a channel other than Bluesky, and no media row through Postiz at all.
- Last decision: builder family is Claude for now, Codex and Grok reserved for cross-family audits
  because quota is limited. Codex is capped until 2026-09-15.
- Details: `## Progress log` -> 2026-09-11 (6Y). Below is history; read only cited headings.

## Standing constraints

These bind every slice and every worker here. They are product and safety rules, not engineering
taste, and they are restated in full in `AGENTS.md` → `## Slice protocol` → Repo bindings so a
worker holding only that section and its packet still has them.

- **Extraction-first.** Never compose new claims, arguments, or worldview statements in Muxin's
  voice. Text and image derivatives quote and trim verbatim and carry `source_lines`. The scoped
  exceptions (Content Studio treatments, common hook templates, video scripts, Build 3 Venture,
  Build 4 Charles) are enumerated in the root `CLAUDE.md` and never widen.
- **Nothing publishes without Muxin's review** in `review-queue.md`. Committing generated content
  is not publishing.
- **Voice:** `config/voice.yaml` governs every word a human will read. No em dashes, no AI tells.
- **Cost:** prefer subscription and free routes; every paid call is opt-in and logged to
  `data/cost-log.csv`.
- **Board writes go through `prose_kanban` only** — never edit `docs/content-agents-backlog.md`
  as text.
- **Test overhead must never dominate a real resource.** Added 2026-09-07 after 404 of 439 rows in
  `data/cost-log.csv` (92%) turned out to be one test's synthetic row, accumulating since
  2026-07-15 and drowning $0.708 of genuine spend. The rule generalizes past that file: whatever a
  test consumes — durable rows, disk, wall-clock, or a coordinator's context window — it is
  overhead, and overhead that outweighs the signal has stopped being verification. If a test's
  footprint approaches the size of the thing it verifies, isolate it (a scratch path, a fixture
  root, a bounded excerpt) rather than accepting the ratio.
- **Design sanity check on every GUI slice.** Added 2026-09-07 after Muxin reviewed the desk and
  called its design "VERY odd": text too small, hard to read and scan through. Any slice that
  touches a page she reads ends with a check, recorded in its RESULT BLOCK and confirmed by the
  auditor from rendered HTML, not intent: body type at least 1.125rem with line height 1.5 or
  more; her content first, with backend ids and folder slugs demoted to muted lines; one clear
  divider between one thought and the next; errors that stay on screen until read; and the page
  scannable at arm's length without zoom. A slice that fails any of the five is not accepted.

## Progress log

### 2026-09-11 (6Y) — every approved Postiz channel schedules, not just the pinned one

Threads would not schedule from the Publishing room. The cause was not Threads and not the route:
`resolveConfiguredPostizCapability` read a single `POSTIZ_ACCOUNT_ID`, and Postiz issues one
account id per connected channel, so exactly one channel could ever be selected. Bluesky held the
pin, so Bluesky was the only channel 6W ever got working. That is the root of the open 6W deferral.

Selection is now an allowlist. `POSTIZ_ACCOUNT_IDS` takes a comma-separated list of approved
account ids and is unioned with the legacy variable, which keeps working and is read as ONE opaque
id that is never comma-split. Blank entries are dropped, so an empty value is unset and never
"approve everything": a channel newly connected in Postiz stays unpostable until a human adds its
id. Two approved accounts advertising the same destination is a refusal naming both, never a pick.
A connected but unapproved channel now names the real cause and the fix instead of claiming Postiz
does not advertise a channel it plainly does.

Every ambiguous case fails closed on purpose. A wrongly permissive selection posts under Muxin's
byline to the wrong account with no undo; a wrongly strict one only blocks scheduling.

`selectDeliveryRoute` is untouched: this changes which account a postiz route uses, not whether a
row routes to Postiz at all. 13 new tests. Grok audited cross-family and found one permissive
drift, the legacy variable being comma-split too; that was repaired and a bounded delta audit
returned CLOSED. `npm run check` 4419/0/0, e2e 55/0/16.

Left for Muxin: paste a `POSTIZ_ACCOUNT_IDS` line into `.env`; done, all nine ids listed.

Correction worth keeping, because it cost a round trip: a first probe called
`fetchPostizCapabilities` without the `mediaUploadVerified` flag that `studio-scheduling.ts:150`
passes, and so reported only the six text-baseline channels and claimed TikTok, Instagram and
YouTube were not Postiz-routable. They are. That flag defaults on (the instance's upload lifecycle
passed live 2026-09-02), and with it the registry returns all nine channels with their full
provider media lists: text, image and video on the six, image and video on TikTok and Instagram,
video on YouTube. Any diagnostic that queries discovery must pass the same flag production does,
or it under-reports the instance.

### 2026-09-11 (6X) — approved rows schedule first time, and refusals name their own fix

6W had shipped one Bluesky post only by hand-seeding that row's safety journal. 6X generalizes it.
Every production path in `src/` that appends a row to a `review-queue.md` now records a `created`
event: five direct `appendRow`/`appendRows` callers plus the two `stampOrigin` paths the GUI uses.
Rows that predate the journal get one explicit adoption route,
`scripts/reconcile-approval-provenance.ts`, which requires `--write --expect-fingerprint <64-hex>`
and refuses when the fingerprint cannot be computed, when the row already has journal events, or
when its status is not `approve`. A row with no provenance is still refused, never silently treated
as approved, and the refusal now tells Muxin exactly what to run.

The double-dispatch invariant held under audit. Grok returned PASS WITH FINDINGS on one HIGH
defect: creation provenance was granted by denylist, so a continue run rescanning an older folder
could mint a `created` event on an already-published row, destroying its adoption path and letting
a later re-approval make published content schedulable a second time. Replaced with an allowlist
(only `pending` or an empty status cell), so unknown future statuses fail closed. Delta audit:
CLOSED, PASS. Two LOW findings accepted as named risks: adoption certifies the bytes on disk now
because legacy rows have no approved-at hash, and a swallowed `stampOrigin` error leaves the job
marked done so a provenance miss only surfaces at the later Schedule refusal.

Two process notes. Codex hit its usage cap mid-slice and stranded a repair round, so on Muxin's
instruction Claude built the remainder and the cross-family models are now reserved for auditing;
the cross-family rule stayed intact, Claude built and Grok audited. A builder round also deleted a
pre-existing test to resolve a contradiction; it was restored, because the old rule was correct for
the call site it was written for and this slice had added a second one. Preserve-versus-overwrite
became a per-call-site option instead of a reversal. Full dated record: `SLICE-6X-LOG.md`.

### 2026-09-11 (6W) — the first real scheduled delivery through Studio, live and confirmed

One Bluesky text post Muxin had approved (`bluesky-2`) was scheduled through the Studio Publishing
room's own Schedule action, moved once to a real different slot, failed once at the provider
(Postiz's stored Bluesky session token had gone stale — its integrations API still showed the
account `disabled: false`, so "connected" in Postiz's UI didn't mean the token still worked),
retried via a new pinned one-off (`scripts/slice-6w-retry-bluesky-2.ts`, calling the same official
Postiz adapter functions Studio itself uses), and delivered after Muxin reconnected the account in
Postiz's own dashboard. She confirmed the post live. All 13 acceptance items closed; `npm run check`
4379/0. Full dated record, including the earlier provenance-gate block and its one-off fix:
`SLICE-6W-LOG.md`. Two items deferred to a future slice: the general provenance-journal fix; an
audit of other Postiz-routed channels' connection health (TikTok, LinkedIn, X, Threads, Mastodon,
Facebook, Instagram, YouTube share this same Postiz instance and could go stale the same way).

### 2026-09-11 (6V) — trimmed the runtime prompt without losing a rule, twice caught by cross-family audit

Ran SLICE-6V: `AGENTS.md` -> `## Slice protocol` was 26179 B against its 24576 B cap, carried
across the 6T and 6U closeouts. One worker (Claude, strongest tier, high effort) compressed wording
across all 17 subsections — no subsection deleted, renamed, merged or reordered — reducing four
cross-subsection duplicate obligations to one statement plus a pointer, and cut it to 24444 B.

The cross-family audit (Codex, `codex exec --sandbox read-only`) is the reason this slice took two
repair rounds instead of one: round 1 found three normative statements the compression had
genuinely dropped rather than reworded — "a packet is a specification, not a session log, read in
full at the start of every session," and the "static" half of "static or entirely local journeys."
The worker restored all three (+104 B, to 24444 B... corrected to 24548 B after restoring both).
A fresh full re-sweep on the repaired candidate (required because the file changed) caught a
fourth, more subtle one: "never infer tokens or cost" had been rephrased to "never infer it," where
"it" only bound to the preceding "usage" clause, silently dropping the explicit ban on inferring
cost. That worker also caught and fixed a real end-of-file-newline regression from its own splice
that neither `git diff --check` nor its own outside-section comparison had detected.

Final candidate: 24560 B (16 B margin under the 24576 cap; the ≤ 24000 stretch target was left
unmet by design — every remaining byte carries an inventoried rule, so preservation won over the
stretch goal). `SLICE-6V-LOG.md` carries the full 142-row rule inventory and the audit disposition.
A third re-audit round, scoped to confirm the fourth fix plus one more fresh full sweep, returned a
clean PASS. `npm run check` unsandboxed: 4379 / 0, independently re-run by the coordinator.

Takeaway for future trims of this section: a same-family reviewer (or the builder re-reading its
own prose) would very plausibly have rubber-stamped all four drops — each one reads as clean,
unremarkable compression. The cross-family requirement earned its cost here.

### 2026-09-11 (6U) — the e2e suite goes green, and two real defects come out from behind stale red

Ran SLICE-6U directly at high effort, diagnosis before any change: 6T's packet had been written
without diagnosis and was wrong about its premise, so this one was written after the work.

The two failures 6T left behind were stale tests, not product regressions. Both asserted the
combined approve-and-publish action that SLICE-5S (`7c6815f`, 2026-09-07) deliberately removed.
Dated on both sides with `git log -S`: the expectations were written 2026-09-01 (`a3ec457`), the
UI they described was replaced six days later. Neither could ever have passed again.

Fixing the Pass B record honestly meant driving the Publishing room's own Schedule action, and
that surfaced two genuine defects the stale red had hidden for eleven days:

- The hermetic seam sat after provider selection in `src/review/publishing-status.ts`, so a
  disposable browser run attempted real provider discovery and failed before it could reach the
  injected fake. Pre-5S the seam was hit first, which is why it had never shown.
- `e2e/run-all.ts` copied the repository-root `.env` into every disposable root. Nothing
  published (discovery failed on transport), but a suite whose whole claim is hermeticity was
  reaching for a live provider with Muxin's real keys.

Both fixed. The `.env` exclusion broke Pass B's delivery-policy identity check, which had been
passing by accident off the copied secrets; the fix states
`CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID` in the harness. That identity is a non-secret string already
committed in `config/brand-accounts.yaml`, so the check stays genuinely exercised rather than
bypassed — deliberately chosen over skipping `resolveDeliveryPolicy` on the injected branch, which
would have removed a real safety check.

Verification: `npm run test:e2e` exit 0 twice solo, unsandboxed, **50 pass / 0 fail / 16 blocked**
both runs, shared worktree byte-identical after each. `npm run check` exit 0, **4379 pass / 0
fail**, 173 s. `npx tsc --noEmit` exit 0. (6T had logged two `src/util/env.test.ts` failures; those
were an artifact of a worktree with no `.env` and pass here on `main`.)

Cross-family audit (Codex, `codex exec --sandbox read-only`) on the one product change, three
fixed questions — reachability of the injected branch from a non-e2e caller, whether skipping
`selectConfiguredProvider` weakens any surviving safety property, and whether the reordering
changes the non-injected path. **No established defects.** `resolveDeliveryPolicy`,
`markDispatchStarted` and `appendPublishingStatus` each re-derive their own evidence, and
`selectConfiguredProvider` leaves no durable authorization state.

Shipped as `cad8fae`, five files, pushed `8041668..cad8fae`. The end-to-end suite is green for the
first time in this sequence. Packet: `docs/operations/launch-slices/SLICE-6U.md`, closed **PASS**.

Leftovers, both pre-existing and neither asked for: `AGENTS.md` → `## Slice protocol` is still
26179 B against its 24576 B cap, carried over from 6T and now due for a dedicated trim rather than
another carry. `scripts/repo-hygiene.sh --rescue` listed four items and changed nothing, all of
them other sessions' work left in place per the closeout rule: two stale worktrees with
modifications (`wt-slice-6m`, snapshotted to `refs/wip/wt-slice-6m` `c0ce8b8`; `wt-slice-6s`, to
`refs/wip/wt-slice-6s` `03a7c39`) and two merged branches safe to delete (`slice-6m-worker`,
`slice-6s-worker`). This session created no untracked paths.

### 2026-09-10 (6T) — Pass D goes green, and an untreated control stops shipping unapproved wording

Ran SLICE-6T. Two prior mid-tier worker attempts at this material had failed, so the coordinator
ran it directly at high effort.

Fix 1 was the packet's, unchanged: the record "Configured-generation browser pass cannot invoke a
real model or provider" asserted `session.blockedCalls.length === 0` against an array that
accumulates for the whole browser session and is never reset, so the file's own three earlier
capture-classify flows made it unpassable once 6S made classify an aborted route. It now snapshots
the count immediately before its own `POST /api/content/generate` and asserts the count is
unchanged. Pushing a fake entry after the snapshot still flips it to `fail`, so the assertion keeps
its teeth.

Fix 2 changed shape. The packet asked for a refusal of fiction treatments; implementing it broke two
passing tests and surfaced a contradiction. `06bd00c` (2026-08-30, PR #411) added an e2e record
expecting that refusal and it has NEVER passed — the error string it greps for was never written
into `src/`. Four days later `df02f09` (2026-09-04, PR #457, decision 10b2 item 2) deliberately
built the opposite: fiction treated variants with their own blind social editor
(`fictionSocialEditorPrompt` — it sees only finished drafts and platform limits, never the chapter,
bible or canon, and may only tighten, reorder and cut), an `editor_pass: fiction-social-v1` stamp,
and canon/provenance restrictions in the prompt. Muxin decided: keep the editor, fix the stale
record. The safety property the Phase 0 record was reaching for is already held by the blind-editor
rules plus the `review-queue.md` gate.

Rewriting that record exposed the real defect it had been masking for eleven days. The untreated
CONTROL variant was written from `request.originalInput` rather than the server-owned approved body,
so the fiction fixture — whose `originalInput` is deliberately "Unapproved request wording must not
become content." — shipped exactly that into a pending review row, while its treated sibling
correctly carried the approved promotion. `src/review/jobs.ts` now computes one
`controlBody = authoritative?.contextKind ? authoritative.body : request.originalInput` and uses it
at both the pre-write gate site and the write site. `contextKind` is set only for the two
server-owned contexts (fiction, Charles), so studio, human-inference and venture keep their exact
request bytes.

Codex (cross-family) audited twice. Round 1 established one P1: the first attempt substituted the
authoritative body for every origin that had one, and because `resolveConfiguredProvenance` compares
only trimmed values, a studio request whose approved input differed in surrounding whitespace would
have silently shipped renormalized bytes on a path whose whole point is byte-exactness. Fixed by
scoping to `contextKind`, with a negative-mutation proof. Round 2: P1 closed, no established
defects. All three of its verification gaps closed — the new test asserts whole-body equality rather
than containment, asserts `engineExecution === "disposable-injected"`, and now covers all five
origins including padded-whitespace human-inference and venture cases.

`content-generation.test.ts` 61/61 exit 0 (+1 test). `e2e/isolation.test.ts` 12/12 exit 0.
`npm run test:e2e` twice solo, unsandboxed: Pass D configured-content-generation 8/8 both runs,
including both target records. `npm run check` 4377/4379, exit 1, 2m26s — the two failures are
SLICE-6R's real-child `.env` tests and reproduce with everything stashed (the worktree has no
`.env`). The suite still exits 1 on one Pass A and one Pass B "Content grouped approval" failure,
both reproduced on clean `main` and left alone as the next slice. SLICE-6S's retained diff was
applied unmodified per `## Depends on` and ships in this commit. Full record: `SLICE-6T-LOG.md`.

### 2026-09-10 (6R) — the six remaining agent-CLI spawn sites stop inheriting `.env` secrets

Ran SLICE-6R (declared high-risk/meaningful-behavior, one Claude strong-model worker at high
effort). Narrowed the six spawn sites 6Q's Codex audit had named as still inheriting the full
`.env`: `src/atomize/reply-draft.ts:133` (`spawn("claude", …)`), `src/outreach/research.ts:392`
(`execFileP("claude", …)`, keeping its `OUTREACH_SEARCH_BUDGET_COUNTER_FILE`/
`OUTREACH_SEARCH_BUDGET_TOTAL` overrides byte-for-byte), `src/providers/polish/claude-cli.ts:41`,
and the three fiction engine-CLI sites (`continuity.ts:252`, `idea-inbox.ts:347`,
`review-pr.ts:365`). Each now passes `env: withoutDotenvKeys()`, imported from `src/util/env.js`
(6Q's helper, unchanged). `src/fiction/review-pr.ts:21`'s separate `git`/`gh` exec deliberately
keeps the full environment (needs a `.env`-sourced `GITHUB_TOKEN`), asserted by its own test.

New `src/util/env.test.ts` (4 tests) proves both mechanisms against a real child: a `spawn` and an
`execFile` test each launch `process.execPath -e` under `withoutDotenvKeys()` and assert, from the
child's own printed `Object.keys(process.env)`, that no `.env`-injected key survives and `PATH`
does; a source guard reads all six files and fails naming any site that doesn't reference the
helper (negative-proof: reverting `continuity.ts` failed the guard, naming it); a fourth test
confirms `review-pr.ts`'s git/gh exec is not narrowed.

Codex (cross-family) audited the six-file diff plus the new test file: one established finding
(P2) — the source guard's windowed substring check doesn't assert the spawn's `env` expression is
exactly `withoutDotenvKeys()`, so a stray in-window mention of the helper name could in principle
produce a false pass. Disposition: no fix required this slice — the coordinator confirmed no such
stray occurrence exists in any of the six files today (each file's only in-window match is the
real call; every `import` line falls outside its anchor's window), the packet's own acceptance
criterion only required the guard to fail when a site "does not reference" the helper, and the
`continuity.ts` negative-mutation proof already demonstrates it catches a real reversion. Recorded
as an optional AST-based hardening improvement, not pulled into scope.

Two authenticated canaries, zero retries: `npm run script:draft` (claude family, $0 subscription
route, 14 s) completed normally under the narrowed environment; `callEngineContinuity('grok')`
(non-claude engine, 13 s) returned `"OK"` under the same narrowed environment — both `grok` and
`codex` were installed and authenticated, so all six files ship (the packet's Canary-2-unavailable
revert rule did not apply).

`node --import tsx --test src/util/env.test.ts`: 4/4, exit 0 (worker and coordinator, both
independently, unsandboxed, real `.env` present). Focused regression suite across the six touched
files: 99/99, exit 0, matching pre-change baselines. `npm run check`: 4378/4378, exit 0 (worker
152 s; coordinator's independent re-run 149.5 s) — baseline 4374/4374 plus this slice's 4 new
tests, no other difference. Accepted and committed as `cc54cd4` on `main`. Full record:
`SLICE-6R.md` → `## Closeout`; dated record in `SLICE-6R-LOG.md` → `## Accepted — 2026-09-10`.

### 2026-09-10 (6Q) — agent children stop inheriting `.env` secrets; `npm run check` goes green

Ran SLICE-6Q (declared meaningful-behavior/high-risk, one Claude strong-model worker at high
effort). `src/util/env.ts` now records which keys it actually injected from `.env` (`undefined`
in the ambient environment before the loader ran) and exports `dotenvInjectedKeys` plus
`withoutDotenvKeys(env)`. `runCommandSpawn` (`src/review/jobs.ts`) gained an optional `baseEnv`
defaulting to the full `process.env`, so `scout`, `pull`, the venture/fiction runners and
`serve.ts`'s other spawns are unaffected. `runAgentSpawn` passes `baseEnv: withoutDotenvKeys()`,
so an agent CLI child gets the ambient environment minus exactly the `.env`-injected keys —
subtraction, not an allowlist, so a key genuinely present ambiently (even if `.env` also names it)
still reaches the child. 1 test added to `src/review/jobs.test.ts` (136→137), asserting on a real
child's own reported environment by key name. The existing 12-key `allowedChildEnvironment`
assertion at `jobs.test.ts:2468-2472` is byte-identical.

Codex (cross-family, high effort) audited: PASS, no introduced blocker, all four required
questions answered affirmatively for this candidate. It flagged five pre-existing spawn paths
outside this slice's owned files (`src/atomize/reply-draft.ts`, `src/outreach/research.ts`,
`src/providers/polish/claude-cli.ts`, `src/fiction/continuity.ts`, `src/fiction/idea-inbox.ts`,
`src/fiction/review-pr.ts`) that still inherit the full `.env` — real, but out of this slice's
scope; candidates for a future slice, not blockers here.

Authenticated canary: a real `claude` Develop job (`job-1789065331989-1`, 194 s, subscription
route, $0) ran under the narrowed environment against
`content/2026-06-16-building-an-innovation-nation` and completed normally, proving the real CLI
still authenticates and works with `.env` secrets stripped from its environment. Its own output
separately flagged that `config/routing.yaml`'s `human-ai: never: [x]` rule (added 2026-09-07)
postdates and contradicts this piece's 7 already-published X posts under that pillar — a real
finding, unrelated to this slice, not acted on here.

`node --import tsx --test src/review/jobs.test.ts`: 137/137, exit 0 (unsandboxed, real `.env`
present). `npm run check`: 4374/4374, exit 0 (unsandboxed, real `.env` present) — baseline at
`6de90f7` was 4372/4373 with this file's assertion the one failure. Full record:
`SLICE-6Q.md` → `## RESULT BLOCK` / `## Closeout`.

### 2026-09-10 (6P) — e2e isolation check stops failing candidates for another session's SQLite sidecars

Ran SLICE-6P (easy, one Claude mid-tier worker at medium effort). `e2e/harness.ts` gained
`partitionIsolationChanges(changed: string[])`, a pure function splitting a changed-path list into
`failing` and a closed, exact-path `volatile` set (`data/analytics.db-shm`/`-wal`/`-journal` only —
confirmed the repo's only database, `src/db/db.ts:7`); `data/analytics.db` itself always stays in
`failing`. `e2e/run-all.ts`'s isolation block now fails the run only on `failing.length > 0` and
names any `volatile` paths as explicitly not failing. 6 tests added to `e2e/isolation.test.ts` (12
total). This closes the false-failure vector `SLICE-6L.md` → `## Stopped` recorded: a concurrent
session's `data/analytics.db-shm`/`-wal` tripping the guard for a reason unrelated to the
candidate.

Cross-family audit (Codex, `codex exec --sandbox read-only`), two rounds. Round 1: HIGH — the
first implementation matched any path whose *basename* ended in the three suffixes anywhere in
the tree (e.g. a candidate's stray `tmp/leak.db-wal` would be silently exempted), defeating the
guard's purpose; fixed by narrowing to the exact-path allowlist above, with a regression test
proving same-suffix files elsewhere still land in `failing`. Also fixed pre-audit (coordinator's
own review): `run-all.ts`'s "byte-identical" line was printing even when a volatile sidecar had in
fact changed. Round 2 (delta re-audit) confirmed the HIGH closed by direct inspection; a second
point (the three canonical paths stay exempt even if the candidate itself, not another session,
touches them) was dispositioned as an accepted, packet-fixed design tradeoff, not a defect — the
packet's own Goal/Owner-checkpoint/Risk sections already fixed this scope, and `data/analytics.db`
itself remaining in `failing` still catches real candidate writes.

`npm run check` (unsandboxed): 4370/4373 pass, the same 3 pre-existing failures (Grok fixtures x2,
scheduler-ledger CLI test) reproduced identically with this slice's three owned files stashed out.
Accepted and committed as `7ec5368` on `main` (fast-forward from `9b02cdb`). Does not by itself
flip 6L to accepted — that still needs 6M's journey realignment. Full record, hygiene disposition,
read-set measurement and RESULT BLOCK: `SLICE-6P-LOG.md` → `## Accepted — 2026-09-10`.

### 2026-09-09 (6N) — closed moot: red gate did not reproduce

SLICE-6N was written to repair a red `npm run check` (`src/review/jobs.test.ts`, landed by 5Z).
On pickup, the worker's mandatory baseline step found the file passing 136/136 unsandboxed at the
worktree's `main` fork (`3395dc2`); the coordinator independently re-ran both that test and a full
`npm run check` (4373/4373, exit 0) and confirmed the same. The packet's own rule for this case —
"if the baseline exits 0, the premise is void; record it and stop without editing" — applied, so
no `src/` change was made. Builder tooling note: the Codex CLI could not be used non-interactively
in this session (its autonomous-approval flags were blocked by the permission classifier, and its
default on-request approval mode produced zero output/zero diff over three attempts); the build
step ran as a Claude subagent instead, consistent with the bindings' "defaults, not rules" note.
Full record: `SLICE-6N-LOG.md` → `## Stopped — 2026-09-09`.

### 2026-09-09 (6K) — runnable freeze-candidate mechanism for completion-sequence step 6

Ran SLICE-6K (meaningful behavior / high risk, one Claude mid-tier worker at medium effort).
Built `src/operations/freeze-candidate.ts`: a pure `planFreeze` function (no git call, no fs
write) that refuses to freeze on `sha_mismatch`, `untracked_path`, `undeclared_modification`, or
`scratch_root_inside_repo`, plus a thin CLI that reads real git state, calls it, and on acceptance
creates a detached `git worktree` checkout outside the repo with a manifest recording sha,
checkout path, changed-file list and an ISO timestamp. 13 tests in
`src/operations/freeze-candidate.test.ts`, one added `package.json` scripts entry.

Cross-family audit (Codex, `codex exec --sandbox read-only`) ran twice. Round 1 found and the
worker fixed: HIGH — a declared `--allow` exception could suppress the untracked-path refusal too
(not just the modification refusal), so an allowed-but-untracked file would silently vanish from
the frozen checkout; MEDIUM — `--scratch-root` had no check that it lands outside the repo working
tree; MEDIUM — a failed `git diff --name-only` silently defaulted the changed-file list to `[]`
instead of refusing. Round 2 confirmed both fixes are real by independent re-read, and surfaced one
further item (gitignored files are absent from `git status --porcelain`, so silently excluded from
the freeze) that the coordinator disposed as by-design rather than a defect — ignored files are
never part of any git-tracked candidate sha for any consumer, and this repo has real gitignored
clutter (`.env`, `data/analytics.db`, `node_modules`, logs) that `--ignored` would spuriously flag.
A symlink-mediated scratch-root containment bypass was accepted as low-risk P2 hardening, not
fixed. Two cheap test gaps (a diff-failure regression test, tightening a `assert.throws`-only test
to check the actual refusal reason) were closed before acceptance.

`npm run check` (coordinator's own final run, unsandboxed): exit 1, 4372/4373 pass — the sole
failure is the pre-existing, out-of-scope SLICE-5Z env-var-leak test in `src/review/jobs.test.ts`
(do-not-touch for this slice), reproduced identically with this slice's files stashed out. Codex
CLI auth was broken mid-session (expired/reused refresh token) and required the owner to
re-authenticate before the audit could run; this is a machine/account state issue, not a repo one,
so it isn't added to the bindings' machine-facts list. Full evidence and dated record in
`SLICE-6K-LOG.md` → `## Accepted — 2026-09-09`.

### 2026-09-09 (6J) — closeout gate item made assertable

Ran SLICE-6J (documentation-only, single Claude mid-tier worker, medium effort). Worker added
`### Closeout gate disposition` to `docs/operations/slice-protocol-environment.md`: states this
repository's `Closeout gate` binding is `none`, the assertable form (a `**PASS**` line with a
date, or an explicit leftover list, written before closeout), that no command belongs in the
`## Closeout` gate slot while the binding is `none`, names `SLICE-6I.md` as the packet that put
`bash scripts/repo-hygiene.sh --rescue` in that slot instead, and cites `AGENTS.md` →
`### Mandatory closeout gate` for the fallback. `SLICE-TEMPLATE.md` → `## Closeout` now points
there instead of prompting for a command, alongside the existing (unchanged) Hygiene disposition
and Read-set measurement pointers. This was the third and last hand-asserted closeout item.

Codex cross-family audit (`codex exec --sandbox read-only`, unsandboxed locally — same
`Operation not permitted` sandbox failure as prior slices) raised one flag on the two fixed
questions: it read the new section's `**PASS**`-with-date requirement as going beyond the quoted
bindings row/`### Mandatory closeout gate` text. Not an established defect — that exact form is
this packet's own acceptance item 3 and matches the `**PASS** — <date>` convention every other
accepted slice already uses; the auditor simply wasn't handed the packet's acceptance list, only
the looser protocol prose. No repair made. The second question (whether removing the template's
fenced placeholder dropped any instruction) came back clean. Full RESULT BLOCK and audit
transcript summary in `SLICE-6J-LOG.md`.

Hygiene (`bash scripts/repo-hygiene.sh --rescue`, exit 1 as expected — non-zero alone is not a
failure per `### Hygiene disposition`): the two owned files plus this packet were committed here;
everything else it listed (the two pre-existing uncommitted files from another session, three
`/private/tmp/content-agents-6d-*` checkouts, two merged branches, five unmerged `agent/cs*`
branches) is other sessions' work, named and left untouched.

No next slice packet exists yet; this session did not write one (writing a packet is a separate,
strongest-model session per `AGENTS.md` → `### Effort tiers`).

### 2026-09-09 (6I) — closeout read-set print made assertable

Ran SLICE-6I (documentation-only, single Claude mid-tier worker, medium effort). Worker added
`### Read-set measurement` to `docs/operations/slice-protocol-environment.md`: the three
closeout commands (protocol-section bytes, START HERE-block bytes, packet bytes), their
pinned-to-`HEAD` form, both exact caps (12288 / 24576) with the strictly-greater violation rule,
and the `/^## [^S]/` extraction trap that overstates the START HERE block as 3317 B instead of
927 B. `SLICE-TEMPLATE.md` → `## Closeout` now points there, alongside the existing (unchanged)
`### Hygiene disposition` pointer.

Codex cross-family audit (`codex exec --sandbox read-only`, unsandboxed locally — sandboxed
launch fails with `Operation not permitted`; default model, `gpt-5.1-codex` is rejected on this
ChatGPT account) caught two real defects the same-family worker missed: the third "live tree"
command used the literal placeholder `SLICE-<ID>.md`, which isn't verbatim-runnable (the shell
reads `<ID>` as input redirection); and the pinned-command block was missing the third (packet)
command entirely. Confirmed the trap explanation itself was correct (927 vs 3317, predicate
skips `## Standing constraints` because it also starts `## S`). Coordinator fixed both — concrete
example filename `SLICE-6I.md` with a substitution note, added the missing pinned packet
command — then re-ran all three live and all three pinned commands from the repo root: `24568`,
`927`, `10953` both ways, matching the section's claims exactly. `AGENTS.md` untouched (0-byte
diff), `SLICE-6I.md` stayed at 10953 B (cap 12288), `git diff --check` clean.

Hygiene: `repo-hygiene.sh --rescue` exited 1. Command run, output reviewed. This session created
no new paths. Every listed path was pre-existing: this session's own two edited files (now
committed), two other sessions' uncommitted files
(`content/2026-09-07-.../review-queue.md`, `data/notes-spread-ledger.jsonl`), three unrelated
`/private/tmp/content-agents-6d-*` checkouts, two merged branches (`slice-5q-queue`,
`slice-5r-routing`), and five unpushed `agent/cs*` branches — all left in place, none created or
touched by this slice.

Read-set at closeout: `## Slice protocol` 24568 B (cap 24576), `## START HERE` 927 B, `SLICE-6I.md`
10953 B (cap 12288).

### 2026-09-09 (6H) — hygiene closeout item made assertable

Ran SLICE-6H (documentation-only, single Claude mid-tier worker, medium effort). Added
`### Hygiene disposition` to `docs/operations/slice-protocol-environment.md`: a non-zero
`repo-hygiene.sh --rescue` exit is not itself a slice failure when every listed path is one the
session didn't create; the RESULT BLOCK must instead assert all four of — command run, output
reviewed, session-created paths committed-or-deleted (each named), every other path named and
left in place. `SLICE-TEMPLATE.md` → `## Closeout` now points there instead of asserting a bare
exit code, which SLICE-6G had shown was unachievable whenever another session has pending work.

Bounded cross-family audit (Codex, ordinary effort, unsandboxed after the sandboxed launch hit
`Operation not permitted` per the bindings' known fix): PASS on both required questions — the new
wording neither forbids anything the closeout rule permits nor permits anything it forbids, and
it does not contradict the bindings' `Hygiene command` row (still
`bash scripts/repo-hygiene.sh --rescue`, unchanged).

`AGENTS.md` untouched (byte-identical to HEAD, per "Do not touch"). Hygiene run before commit:
this session created no new paths; the two pre-existing uncommitted files it was told not to
touch, three other worktrees' uncommitted work, two merged branches, and five unpushed local
branches were all named and left in place, none created by this slice.

No SLICE-6I packet exists yet — `## START HERE` now says so rather than inventing one.

### 2026-09-09 (6G) — the startup reading surface: one heading, every packet under cap, cap scope written down

Wrote SLICE-6G in a packet-only session (`57a84c0`), then ran it. Three deliverables.

Coordinator took deliverable 1: `## START HERE` had a corrupted twin below it —
`## Standing constraints`.` with a stray backtick-period tail, plus an orphaned "everything below
is history" bullet, wreckage from an earlier in-place rewrite. Two headings matched
`^## Standing constraints`, so anything anchoring on that heading could land on the empty one.
Deleted both lines; count 2 → 1, constraint bullets 7 → 7.

One Lane A worker (Claude mid-tier, medium effort — the packet declares low risk) took
deliverables 2 and 3: compressed `SLICE-5O.md` from 12,957 B to 12,280 B, and added
`### Packet cap scope` to `docs/operations/slice-protocol-environment.md` recording that the cap
governs `SLICE-<ID>.md` anywhere under `launch-slices/` while `*-LOG.md`, `SLICE-TEMPLATE.md` and
`SLICE-5L-coverage.md` are exempt. That last rule is why the 20,485 B coverage file stops being
re-flagged by every future sweep.

The Codex audit earned its place. Mechanical checks were all green — heading list byte-identical,
acceptance 10/10, traps 6/6, `dropped_code_spans: []` — and Codex still found four meaning changes
none of them could see: a reversed visibility relation ("invisible to every prior claim" instead
of the scheduler being unable to see the claims), a dropped "on this machine" verification scope,
a dropped "to empty" on what `beforeEach` truncates, and a deleted archival eligibility rule.
The fourth was compounded by the coordinator: I had "corrected" 6E's post-archive figure of
12,549 B / 261 B over to today's 669 B, conflating two different moments. Reverted. All four
repaired, the ~180 B paid back out of descriptive framing only; delta audit returned all CLOSED
with no new meaning change.

One accepted deviation, recorded in `SLICE-6G-LOG.md`: the packet's acceptance item
"`repo-hygiene.sh --rescue` exits 0" is unachievable by anything this slice may do — hygiene's 5
items are three `/private/tmp/content-agents-6d-*` checkouts, two merged branches and five
unmerged `agent/cs*` branches, all other sessions' work that the closeout rule says to report and
leave. Judged instead as: run, reviewed, own paths committed, everything else named and untouched.
A future packet should assert that form directly.

Also fixed two bugs in SLICE-6G's own `## Verify`: steps 2 and 9 used
`awk '/^## START HERE/{f=1} f&&/^## [^S]/{exit} f'`, whose `[^S]` runs straight past
`## Standing constraints` and swallows the whole section into the "START HERE block" measurement.

Read-set at closeout: `## Slice protocol` 24,568 B (cap 24,576), `## START HERE` 813 B,
`SLICE-6G.md` 12,235 B (cap 12,288).

### 2026-09-09 (later) — 6F: landed the orphaned second capping wave, protocol section back under cap

Ran SLICE-6F as two disjoint lanes, per the packet's own split, both Claude. Lane A (mid-tier,
medium effort) verified/finished the second wave of packet-capping over 11 IDs
(5H/5P/5R/5S/5T/5W/5X/5Y/5Z/6B/6C): 8 were already correctly capped from a prior session, Lane A
fixed the remaining 3 (5H/5T/5Z) by moving completed `RESULT BLOCK`s / superseded `## Stopped`
sections into their `-LOG.md` siblings. Python line-set diff confirmed zero non-blank lines lost
against `HEAD` across all 11; all 11 landed ≤ 12,288 B with ≤1 `## Stopped` section each.

Lane B (Claude, strongest available, high effort — packet-declared high risk) brought
`AGENTS.md` → `## Slice protocol` from 28,694 B back to 24,568 B (cap 24,576). The packet named
only 3 items to relocate (~1,900 B), not enough for the 4,118 B overage, so Lane B relocated the
entire `## Repo bindings` table (all 12 rows, not just the 3 named) into a new
`docs/operations/slice-protocol-environment.md`, per the section's own text declaring that whole
table repo-specific ("the only part of the protocol that changes between repositories"). Coordinator
accepted this as in-scope engineering judgment, not a scope question for the owner.

Coordinator found and fixed one gap the lanes missed: `git diff --check` failed on trailing
blank-line-at-EOF in 9 of Lane A's packets; trimmed to a single trailing newline, re-ran Lane A's
verify script (still PASS, 0 missing lines), confirmed `git diff --check` exit 0.

Cross-family audit (Codex, ordinary effort, `codex exec --sandbox read-only`, unsandboxed locally
after an `Operation not permitted` sandbox failure) ran against Lane B's diff + the new
environment file. Verdict: environment material (bindings, Grok CLI section, the
Claude/Codex-default bullet) verbatim-relocated; two other removed lines (an audit-scope summary
under `Mandatory closeout gate`) are genuine duplicates of the unchanged `Audit scope and
proportional verification` section. Codex flagged 5 apparent rule changes in the parallel-lane
rewrite, but explicitly noted the supplied diff couldn't attribute them to Lane B — they belong to
the pre-existing uncommitted parallel-lane rewrite this slice was authorized to land as-is (not
authored or touched by either lane), so no rework was needed.

Committed the 24 owned documentation paths (11 packets + 11 `-LOG.md` + `AGENTS.md` +
`SLICE-TEMPLATE.md` + the new environment file) in one reviewed commit, this master-doc update
included. The two `## Do not touch` content paths
(`content/2026-09-07-.../review-queue.md`, `data/notes-spread-ledger.jsonl`) were left exactly as
found, modified by an unrelated session.

### 2026-09-09 — 6D accepted and integrated; 6E capped ten over-cap packets

Claude read the retained `full-gate.exit.json`: exit 0, ~404.9s. Hash-verified the frozen
`/private/tmp/content-agents-6d-verify` candidate's five files against `candidate-manifest.json`
(sha256 match, all five); prior Claude audit/delta-audit closure (both exit 0) still held with no
source changes since. Copied the five files into main and committed with packet/master updates in
one reviewed commit (`701e4c0`). SLICE-6D.md's superseded `## Stopped` handoff and its earlier
`## Coordinator finding R1` note moved to `SLICE-6D-LOG.md`, newest first, bringing the packet from
15,785 B to 10,765 B.

Then ran SLICE-6E: two disjoint Claude lanes (mid-tier, medium effort) trimmed ten over-cap slice
packets (5C/5D/5G/5J/5K, 5L/5M/5N/5O/5Q) to sibling `-LOG.md` files, newest first, moving only
completed RESULT BLOCKs and dated/superseded sections. Both lanes independently hit a real ugrep
quirk — this machine's `grep -F -x -v -f` silently drops blank-line patterns from a `-f` file, so
the packet's own verify script over-reports `missing_from_log`; a Python non-blank line-set diff
confirmed 0 real content loss across all ten IDs. Coordinator called the one open item: SLICE-5O
stays 669 B over its 12,288 cap because its only remaining movable content was live `## Traps`
guidance, not a dated record — recorded as an accepted deviation rather than cutting spec content.
Cross-family Grok audit was requested but Grok returned `402 Payment Required` (usage balance
exhausted); the packet's documentation-only reviewer-outage clause applied, so the coordinator
completed the bounded diff review itself (byte counts, heading-count deltas, required headings
present, `## Stopped` counts, `git diff --check` exit 0, scoped `git status --porcelain`).
Committed as `628bac7` (+ master pointer update `1e4230a`). Hygiene exit 0 both times; all
pre-existing leftovers from other in-progress sessions (6D checkouts, SLICE-5H/5P/5R/5S/5T/5W/5X/
5Y/5Z/6B/6C doc edits) were snapshotted and left untouched throughout.

Deferred, no ID assigned yet: SLICE-5T (12,346 B) and SLICE-5Z (15,775 B) remain over cap; the
`## Slice protocol` section itself is 28,217 B against its own 24 KB cap; SLICE-5O could be
re-capped later if its own work is revisited.

### 2026-09-08 — 6D parallel build, Claude handoff before acceptance

Two disjoint Codex Terra lanes built the Fiction Grok workspace launch correction and an existing
reviewed recommendation/request integration fixture. Coordinator review closed import/environment
isolation omissions; Fiction repair used Terra xhigh. Final focused checks passed: 33 Fiction tests
and 2 recommendation tests. Claude Sonnet medium (actual claude-sonnet-5) found no established defect;
its two evidence-only requests were supplied and independently closed PASS without source changes.

The combined five-file candidate is frozen in `/private/tmp/content-agents-6d-verify`; required
unsandboxed full check is still running at owner-requested closeout. No candidate source is committed
or accepted. The owner asked to conserve Codex usage and let Claude take over. Packet
`docs/operations/launch-slices/SLICE-6D.md` → `## Stopped` names retained files, exact hashes/evidence,
gate receipt paths and the single next action. Do not restart valid checks or repeat settled audits.
No live Grok/production workflow, publication, browser journey or real evidence readiness is claimed.


### 2026-09-07 — 5S safer scheduling source audit clear; visual verification blocked

Muxin chose duplicate-safe handling instead of the rejected provenance-only exception. Terra high repair omitted material invariants; same model increased to xhigh and repaired strict latest transitions, durable one-time fence, exact reconciliation, persistence/concurrency and HTTP evidence. Final affected checks 418/0, prior caller regression 176/0, typecheck exit 0. Grok workspace audit found Pending typography defect, now fixed and independently closed; actual HTTP scheduling wrapper/fake callback proof also closed. No browser available, so no rendered A9 or full gate and no implementation integration. Retained candidate and final patch/hash are in SLICE-5S → Stopped. No user risk approval needed; next action is connect browser and finish verification.


Append-only. Newest first. Never rewrite a completed dated entry.

### 2026-09-07 — session close: Muxin's approve test, the design sanity rule, X decision final

Muxin tested the desk herself after SLICE-5P closed. She found `x-1` already at `approve` and
asked whether it approved itself: it did not. That was the canary approval from the 5P run,
which the closeout asked her to reset and which was still in place. She then approved `x-2`;
the GUI fired the real publish on the click, as `serve.ts:1141-1163` does until SLICE-5S
lands, and it failed the same way `x-1` had: provider selection failed before dispatch because
Postiz capability discovery got `fetch failed`. The Publishing view now shows both rows as
"Needs attention, no planned time recorded". Nothing left the machine. Both rows remain at
`approve` in `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`
lines 31 and 32; only she edits that file.

A stale job card, "Create configured drafts: probe-atomic-63507-1788629180763", sits at the
top of the Content room with "this run was queued before the Studio recorded which brand a job
belongs to". It is a probe job from before SLICE-5N's brand change, not this session's, and
"Try it again" cannot succeed. Clearing it is part of the queue page's design pass (SLICE-5Q).

Two decisions recorded. First, a **design sanity check** is now a standing constraint for every
GUI slice (see `## Standing constraints`), and SLICE-5Q and SLICE-5S each carry it as an
acceptance line. Second, the SLICE-5R assumption is resolved: career-work comes off X. In her
words, "ONLY technical stuff goes on X cause that's the only thing that platform seems to
respect these days. Think very silicon valley monoculture, if it fits that paradigm, it can go
in X." The packet now records this as decided; X stays on claude-code and builder only.

Session close was docs only: this document, the three packets, nothing under `src/`. The
review server on port 4600 was left running for her.

### 2026-09-07 — SLICE-5P stopped before the live call; four slices queued from what it found

Muxin chose `https://humaninference.ai/essays/the-worlds-broken-what-do-we-do` (human-inference).
Stages 1 to 4 ran clean: 14 derivatives, routing included all six platforms (Bluesky on data,
the rest cold start), baselines identical before and after. She approved `x-1` in the review GUI.

The worker stopped before stage 5 on three findings, none repaired. First, the GUI's approve
handler (`serve.ts:1141-1163`) fires the real publish on approve, so her three clicks were three
real publish attempts; each failed before any provider request because Postiz capability
discovery got `fetch failed`. That failure was the error that flashed too fast to read. Second,
`publishAt: null` is unreachable: `typefully.ts:480-484` throws on `--no-schedule`, and the unified
path has no unscheduled option, so the dry run as written cannot be run. Third, the permission
classifier blocked the worker's publish command, and it rightly did not script around it. The
ledger migration fired for the first time, from Muxin's review session: 54 claims readable at the
new path, legacy file byte-identical. Nothing posted.

Muxin's decisions from the session. Approve means approved to be published; the Publishing
room owns scheduling, batch scheduling, rescheduling and pending versus published (SLICE-5S).
X carries building and technical pieces only, meaning the claude-code and builder pillars; it
comes off civic-tech, human-ai and other (SLICE-5R). She looked at the numbers first: 264 X
posts, every pillar at roughly one interaction per post, so X earns no pillar on data and the
call is hers about who is there. The review queue page puts generated content first (SLICE-5Q,
six asks). Two more slices are named but not yet written: an unscheduled draft path on the
unified route, and a `brand_id` backfill, because only Bluesky rows carry a brand and a
brand-filtered routing run therefore sees no X history at all.

### 2026-09-07 — session close: SLICE-5O accepted, START HERE compacted to pointers

**Slice state.** SLICE-5O is ACCEPTED and committed (`540c065`), gate **4293/491/0**. Full
RESULT BLOCK in `docs/operations/launch-slices/SLICE-5O.md`. No slice is open. This session
stopped at the accepted branch of the protocol's completion sequence, not the blocked branch.

**Verified live at closeout, on real data.** With `CONTENT_AGENTS_DATA_ROOT` pointed at a
throwaway directory, `readLedger()` returned **54 claims**, oldest
`2026-06-25 … building-an-innovation-nation/x`, newest
`2026-07-11 … human-inference-defining-a-brand-in-an-ai-drench/x`. `data/publish-schedule.jsonl`
hashed `3a1d30a6…` before and after, unchanged. Before SLICE-5O that read returned zero claims.

**One thing the slice write-up did not know.** `~/.content-agents/` holds an *empty*
`scheduler/publish-schedule.jsonl` plus an orphaned `.29875.tmp`, dated 2026-08-30 — but under
`content-agents-master-status-a7dc8ea24f29`, a **worktree's** data root, not the main checkout's
(`content-agents-154a8dd69ae2`, confirmed by calling `dataRoot()`). The main checkout has no
`scheduler/` directory, so its migration path is clear. Had that empty file been the main
checkout's, the helper's `existsSync(canonical)` fast path would have skipped the migration
permanently and lost all 54 claims silently — the exact failure the audit predicted, sitting one
directory away.

**The cost log, in plain terms.** `src/outreach/draft.ts:370` calls `logCost` unconditionally,
and the path was hardcoded, so every gate run since 2026-07-15 appended a synthetic
`outreach:draft,"Acme Co",0.0000` row to Muxin's real spend ledger. Final tally: **404 of 439 rows
are that fixture**; real spend is 35 rows totalling **$0.708**. Nothing was overcharged and nothing
was lost — the file simply stopped being readable for its purpose. SLICE-5O stopped the growth. The
existing rows were **deliberately left in place**: deleting entries from a financial record to tidy
test noise is the owner's call. They are trivially identifiable by the `"Acme Co"` detail column.

**Readiness for Human Inference, stated honestly.** The publishing freeze was lifted 2026-07-08, so
nothing gates posting there. SLICE-5O removed a real blocker: the first live run would otherwise
have started from an empty ledger and double-booked slots already used. But **no end-to-end run has
been performed** — `/atomize` → review → `/publish` has not been exercised against a real piece
with a Typefully draft observed at the end. Do not read "blocker removed" as "ready." The two
candidates in START HERE differ on exactly this: d3 continues the dead-code cleanup, a live dry run
answers the readiness question.

**Decisions taken at the very end of the session.** Muxin authorized the cost-log purge and chose
the dry run over d3.

The purge removed exactly the 404 rows matching `outreach:draft,"Acme Co",0.0000` and nothing else,
verified by `cmp` against a filtered copy of the pre-purge file (`dc3c71d2…`, 439 rows). The file
now holds 35 rows; the 5 genuinely paid rows still total **$0.708**. Note for anyone tempted to
treat git as the undo: **`data/cost-log.csv` is gitignored** (`.gitignore:14`) and was never
tracked, so the only pre-purge copy was an ephemeral scratchpad file. Nothing of value was in the
deleted rows — 404 byte-identical zero-cost fixtures — but the *next* destructive edit to an
untracked operational file deserves a durable backup first.

Eight rows were deliberately **left in place** despite looking synthetic: six
`agent:claude,"Note: a Charles note"` and two `agent:codex,"Note: refused"`, all from
2026-09-06/07, all zero-cost. `src/util/cost-log.ts:18` names the Charles row as test noise, but the
authorization covered the 404 Acme rows, and widening a delete on a financial record because rows
"look like" fixtures is exactly the move that should require asking. Worth a decision later, not a
worker's initiative.

**SLICE-5P is written and not started.** The design turns on a property verified in source before
the packet was drafted: `typefully.ts:136-144` — a null `publishAt` makes Typefully save an
**unscheduled** draft that will not auto-post. So the full live path, real auth and real API call,
can run while its output is structurally incapable of publishing, and `cancelDraft` removes it
afterwards. That is a genuine dry run rather than a rehearsal, and it does not weaken rule 2:
nothing reaches Typefully until Muxin approves a row. The run is also the first chance to watch
SLICE-5O's ledger migration fire in production. Budget is fixed at one authenticated canary and one
retry, with no retry around `createDraft` at all (`typefully.ts:166-167`: a 5xx can arrive after the
draft was created, so a retry risks a duplicate).

**Not committed, deliberately.** `data/notes-spread-ledger.jsonl` carries two rows appended by a
scheduled run at 2026-09-07T12:00:05Z (notes `c-331059283`, `c-331062953`). Genuine runtime
output, outside this slice, left for the owner rather than folded into a doc commit.

**Why START HERE shrank.** It had grown to 378 lines and was being read in full by every new
session — the block whose whole job is to be cheap to read had become the most expensive thing in
the document. It is now pointers only. The narrative it held is preserved verbatim below, not
rewritten, and remains reachable by any packet that cites it.

<details>
<summary>START HERE narrative as it stood on 2026-09-07, moved here verbatim</summary>


- Repository root: `/Users/Muxin/Documents/GitHub/content-agents` (branch `main`)
- This document: `docs/content-studio-master-status.md` — single source of truth for status and decisions
- Protocol: `AGENTS.md` → `## Slice protocol`. Read that before anything else.
- Next slice: **(d3)** — `rowEl` dead code (`page.ts:1466`) plus `buildFormatArg` (`jobs.ts:2100`).
  Measure the blast radius before scoping; d3 is an inventory to *measure*, not a list to trust.
  SLICE-5O just demonstrated why that warning is worth obeying: item (f)'s inherited list of
  fourteen suspect sites was twelve-thirteenths wrong, and the real defect was somewhere the item
  never looked.
- **NEEDS MUXIN, not blocking anything: 92% of `data/cost-log.csv` is test fixtures.** 404 of its
  439 rows are `outreach:draft,"Acme Co",0.0000`, accumulating since 2026-07-15 because
  `src/outreach/draft.ts:370` calls `logCost` unconditionally and the path was hardcoded. Real spend
  is 34 rows totalling $0.708. SLICE-5O stopped the bleeding; the existing rows were deliberately
  **left in place** — deleting entries from a cost log to tidy test noise is her call, not a
  worker's. They are trivially identifiable if she wants them gone.
- **ONE THING NEEDS MUXIN** (from SLICE-5N, does not block d3): `develop/SKILL.md` defines no
  `--brand` at entry — step 0 reads the arg as the source, while line 57 of its body runs
  `npm run route -- --brand <brand>`. `atomize` and `video` both carry the entry contract; develop
  does not. `.claude/skills/**` is write-protected by Muxin's settings, so neither builder nor
  coordinator may edit it and neither routed around it. Interim: `developSpawnPrompt` sends no
  undefined flag — the source stays where step 0 expects it and the brand rides as a named
  instruction, so nothing ships broken. To finish, someone who can write there gives develop
  atomize's entry contract, then `developSpawnPrompt` flips to the flag form.
- Last resolved: **SLICE-5O ACCEPTED** (2026-09-07) — item (f), which turned out to be mostly a
  false alarm wrapped around one real production bug. Gate **4293/491/0**. Full RESULT BLOCK in
  `docs/operations/launch-slices/SLICE-5O.md`.
  **The bug: the slot ledger's history was orphaned by the data-root move.** Operational state now
  lives under `dataRoot()` (`~/.content-agents/<basename>-<fingerprint>/`) and eleven stores call
  `migrateLegacyDataFile` to carry their pre-move file forward. The ledger did not — `slots.ts:160`
  resolved a bare `dataPath("scheduler", "publish-schedule.jsonl")`. Verified on disk: that
  directory did not exist, while `data/publish-schedule.jsonl` held 54 real July claims. The next
  publish run would have started from an empty ledger with every prior claim invisible to it, which
  is the exact duplicate-placement failure the ledger exists to prevent. Latent only because
  nothing has published since the July freeze — it bites on the **first run after Muxin goes live**,
  her stated next priority.
  **The audit then found the fix had the same shape as the bug.** `migrateLegacyDataFile` copied
  straight onto the canonical path, and its own fast-path guard skips the migration lock once that
  file exists — so a process killed mid-copy left a truncated file that suppressed the migration
  forever, silently. Now staged into a sibling and installed with `renameSync` under the lock,
  which fixes the other eleven callers too. **`migrateLegacyDataDirectory` still has it via
  `cpSync`** (`jobs.ts:70` is the only caller) — fix that before anything durable moves onto it.
  **Two standing lessons.** (i) *A stale comment is how a defect survives*: `slots.test.ts:5`
  asserted "the ledger path is hardcoded" while the override it denied existed two lines away in
  production and the same file's second block already used it. (ii) *Ask whether a change removed
  coverage, not only whether it added a defect* — Lane B's temp-root isolation silently destroyed
  the child-side reach of an existing assertion, invisible to both builders and to the acceptance
  criteria until an auditor compared before against after.
- Before that: **SLICE-5N ACCEPTED** (2026-09-07) — item (d2) folded with item (c)'s brandId
  debt, the ordering Muxin agreed to (d1 → d2+brandId → d3). Gate **4278/489/0**. The brand now
  travels from the browser through the HTTP routes, onto the `Job`, through the durable store and
  into the spawned prompt for `/atomize`, `/video` and `/develop`; `reuseGuardBlock` reads the
  resolved `DeliveryPolicyDecision`'s brand instead of `checkReuse`'s `human-inference` default.
  Two audit passes, two repair cycles (the protocol's bound). The audit caught a new suite that
  would have destroyed `briefs/<brand>/bets.md` — the append-only placement log preventing
  duplicate publishing — latent only because no per-brand brief exists yet; and a recovered task
  job that stranded the whole queue. Full RESULT BLOCK, including two recorded coverage limits and
  a defect the builder self-reported, in `docs/operations/launch-slices/SLICE-5N.md`.
  **Trap for anyone touching the continue path: `canonicalPath` tolerates ENOENT deliberately** —
  `--continue content/<slug>` names a folder `/atomize` is about to create, so a missing folder
  resolves `ok` and dispatches. Any code or test that assumes "missing folder means no spawn" is
  wrong for that reason; that assumption is what had SLICE-5N's test spawning real `claude` runs.
  **Two master-doc claims were corrected while scoping it, both verified in source first:**
  (i) item (c) says the brandId debt is "two call sites in `studio-scheduling.ts`" — it is **one**.
  SLICE-5K folded the pre-flight and the recovery call into a single function, `reuseGuardBlock`
  (`studio-scheduling.ts:430`), whose lone `checkReuse` is at `:433`. The doc's worry that the two
  would drift is now structurally impossible, and the fix is correspondingly smaller.
  (ii) d2 is **not** a two-line change. The `Job` record (`jobs.ts:1503`) has no brand field at all,
  so the brand has to be carried from the HTTP request through `addJob` onto the job and into the
  prompt. A third entry point the doc never mentions also needs it: `runContinueJob` calls
  `runAtomizeJob`, so the Notes picker (`serve.ts:1786`) spawns a brandless `/atomize --continue`
  today — the path SLICE-5M just repaired and the one Muxin uses most.
  Last resolved: **SLICE-5M ACCEPTED** (2026-09-06) — item (d1), the
  doubled `join` that made a successful Notes drafting job report failure. Gate **4260/488/0** (up
  from 4248; twelve new tests). Normalization landed at the **consumer**: `resolveContinueArg`
  (`jobs.ts:2205`) returns a three-way `ok`/`refused`/`unparseable`, and `settleContinueRun`
  (`jobs.ts:2221`) owns the verdict. `serve.ts` was deliberately left alone — it hands the same
  string to the `/atomize` subprocess, and the subprocess always worked; only the verification was
  broken.
  **The cross-family audit returned "do not accept" twice and was right both times.** Full
  adjudication in `SLICE-5M.md` → `## RESULT BLOCK`; read it before touching continue-job
  resolution again.
  **Read this before writing another packet: the packet's central claim was false, and it was the
  coordinator's error.** It asserted two live producers of `--continue <folder>` and built its whole
  trap section around protecting the relative one. `buildFormatArg` (`jobs.ts:2100`) has **zero
  production callers**; `addJob("continue", …)` has exactly one call site, `serve.ts:1786`. The
  claim came from trusting this document's phrasing without tracing a caller — the signature bug,
  committed inside the packet written to prevent it. **A status document is not evidence of a live
  code path. Trace the caller before you assert one in a packet.**
  **Scope note worth keeping:** the containment check that generated most of the audit findings was
  never in the packet — the builder added it while fixing a path-shape bug. Before hardening it
  further, the producer surface was checked: one call site, argument generated by this codebase, no
  route and no user input. It is correctness hygiene, **not a security boundary**. Three findings
  were declined on that basis (uppercase `CONTENT/` alias refused on macOS; non-atomic filesystem
  calls; `..` refusal rejecting legal-but-unusual filenames). All three are real and all three are
  unreachable.
- Before that: **SLICE-5L ACCEPTED** (2026-09-06) — item `3b`,
  retire `/cycle`'s drafting step, done as a **partial** retirement. Gate **4248/488/0**, no `.ts`
  file changed. `/cycle` step 3 is retired for the three inputs the Content room was *demonstrated*
  to handle (Substack essay URL, local text/markdown file, pasted text) and **kept** for two it was
  demonstrated not to: **voice memos** and **the `/video` offer**. The proof is
  `docs/operations/launch-slices/SLICE-5L-coverage.md`, one traced code path per input kind.
  The cross-family audit returned **"do not accept as written"** and was right — the first
  submission retired `/video` and asserted a Notes path on the strength of code nothing reaches.
  One repair cycle; the surviving retirements are exactly the set the auditor independently
  confirmed.
  **Three production defects were found and deliberately not fixed** (the slice measured the room,
  it did not change it). They are the next obvious work — see item (d) below.
- Before that: **SLICE-5K ACCEPTED** (2026-09-06). The Postiz path
  is now the sixth `checkReuse` caller: a row the reuse guard refuses is not created on Postiz,
  claims no slot, is not marked published, and — the part that mattered — does not fall through to
  SLICE-5J's Typefully backup route. A guard block means do not place this row anywhere, not try
  the other provider. Gate **4248/488/0**. Cross-family audit returned **zero established defects**;
  one repair cycle, test-only.
- Last accepted packet: `docs/operations/launch-slices/SLICE-5K.md` (carries a RESULT BLOCK with the
  audit adjudication and one leftover that item (c) below must honour). Prior: 5J and 5I
  (2026-09-05, parallel, 4236/487/0), 5H, 5F `44eb355` (4185/485/0), 5E `df26d30`, 5D `b8eea12`,
  5C, 5B. 5G was declined and reverted.
- **NOT PUSHED.** Muxin, 2026-09-05: "No pushing till this thing works." Local `main` is ahead of
  `origin/main` by design. Do not push until she says the system works.
- Blocked on: nothing. Pick the next dependency-ready slice below.
- Next dependency-ready, all independent:
  (0) **DONE — SLICE-5K, accepted 2026-09-06.** Kept here for the reasoning. **The Postiz path never
  consulted the reuse guard** — found during 5J, the highest-value item
  here because it is a correctness hole in a guard Muxin will assume is protecting her. Five
  publishers (`typefully`, `cards`, `tiktok`, `youtube`, `substack`) call `checkReuse` before
  creating. Postiz does not. The only `checkReuse` in `studio-scheduling.ts` is at line 459, inside
  `runPublisher`'s `done.length === 0` branch — reason-recovery for a publisher that already
  skipped, not a pre-flight gate, and the Postiz path returns from its own catch without reaching
  it. Proved empirically during 5J: with the guard answering "not allowed," Postiz posts anyway.
  What prevents a duplicate today is only `setStatus(…, "published")` taking the row out of
  `approve`, so it needs a deliberate re-approval after a completed placement. Pre-existing and
  affecting all six row kinds routed to Postiz; 5J newly makes media rows a two-route case. Scoped
  as SLICE-5K and accepted; read `SLICE-5K.md` → `## RESULT BLOCK` before touching that path again.
  (a) **DONE — SLICE-5I, accepted 2026-09-05.** Kept here for the reasoning; the decision record
  matters more than the item. **one card image per platform instead of one shared** — found during 5H. Configured
  generation stages and renders a SEPARATE image per card variant (`media-stages/<variant id>.json`,
  `configuredMediaStage`), so a request targeting LinkedIn and X renders the card twice. Because
  `configuredCardQuote` is deterministic on the approved source and the shared `quote-card`
  char limit, both renders normally paint the SAME quote — duplicate cost and a duplicate render
  path for one artifact, not two different cards. `/atomize` already does the right thing: ONE image,
  fanned out to per-platform rows. Muxin flagged this directly (2026-09-05): "Don't we just build 1
  image and put it across different places?" **Highest value of the two.**
  **The correct axis is ASPECT RATIO, not platform** (Muxin, 2026-09-05). Today there is only one
  aspect: `remotion/Root.tsx:53-75` declares BOTH card Stills (`QuoteCard`, `QuoteImageCard`) at a
  hardcoded 1080x1080, no size prop, no aspect parameter, and `config/platforms.yaml` carries no
  per-platform image dimensions. So there is **no mobile/portrait card variant today** — verified,
  not assumed. **DECIDED (Muxin, 2026-09-05): square only for now, to get the app usable ASAP.**
  No aspect parameter, no portrait variant, no per-platform dimensions in this slice. The sharing
  key is still built off render inputs rather than platform, so adding a second aspect later costs
  one extra render instead of one per platform. Scoped as **`SLICE-5I.md`** (2026-09-05).
  (b) **experiment-grading follow-on** — teach `tag-source.ts` to stamp a `posts.*` column from 5F's
  Placed-log marker and `grade-bets.ts` to key on it (the confirm half; judgment-touching, scope
  after Muxin sees 5F rows).
  (c) **Substack posting through our own script** — DECIDED 2026-09-06, deferred by Muxin, do not
  build yet. This **supersedes** the earlier "Charles and Fiction provider delivery, gated on Muxin
  connecting accounts" item. Both Charles and Fiction publish to Substack. Typefully does not
  support Substack as a destination, and the routes that might would cost Muxin a second paid
  account. Her decision, verbatim in substance: rather than pay for another account, reuse the
  approach the existing Substack **analytics pull** already uses — the saved-session real-Chrome
  agent against the Substack dashboard — and build the mirror of it for **posting**. Root
  `CLAUDE.md` rule 3 already sanctions exactly this shape: "Where no usable API exists (e.g.
  Substack), a constrained browser agent MAY post, but only on content Muxin has approved." So this
  is not a new exception, it is the sanctioned path. Rule 2 still governs — only `approve` rows
  ship, nothing auto-posts unreviewed.
  **Open questions to settle when this is scoped, not now:** `src/publish/substack.ts` already
  exists and is one of the five publishers that calls `checkReuse` — establish what it actually does
  today before designing anything, rather than assuming it is or is not a working poster (this
  block has been wrong three times by reading one file and stopping). Also unsettled: whether the
  pull agent's saved session can be reused for writes or needs its own, and whether Charles and
  Fiction post to one publication or two.
  **Carried debt this item must pay (from SLICE-5K, 2026-09-06):** the Postiz pre-flight reuse
  check calls `checkReuse(slug, platform)` without a `brandId`, deliberately matching
  `runPublisher`'s recovery call so the two cannot drift. That is provably harmless *today* only
  because `src/publish/delivery-policy.ts` makes `mode: "provider"` reachable for
  `human-inference` alone (line 43) — charles is hard-coded to `manual` (line 34), fiction to
  `blocked` (line 37) — and `human-inference` is `checkReuse`'s default brand. **Giving Charles a
  provider route breaks that equivalence.** Pass the brand at BOTH call sites in the same change,
  or the guard will silently check Charles's rows under the Human Inference brand.
  **CONFIRMED by Muxin, 2026-09-06: "Brand id will be needed."** This is no longer debt to weigh —
  it is required work. It does not have to wait for item (c): it is a change in
  `src/review/studio-scheduling.ts` plus tests, cheap and independently verifiable, and it can be
  taken as its own micro-slice at any point. If it is still unpaid when (c) is scoped, (c) pays it.
  **CORRECTED 2026-09-06 while scoping SLICE-5N, verified in source:** this says "two call sites"
  and there is **one**. SLICE-5K folded the Postiz pre-flight and `runPublisher`'s recovery into a
  single function, `reuseGuardBlock` (`studio-scheduling.ts:430`); its lone brandless `checkReuse`
  is at `:433`. The drift this paragraph warns about is now structurally impossible. **Being paid
  by SLICE-5N**, alongside (d2), since both are the same unthreaded brand.
  **Muxin's stated priority, 2026-09-06: get Human Inference posting live first.** This item waits
  behind that. Do not start it until she says so.
  (d) **Three Content-room defects found by SLICE-5L, recorded and unfixed.** Read
  `SLICE-5L.md` → `## RESULT BLOCK` and `SLICE-5L-coverage.md` items 4-6 before touching any of
  them. All three are the "listed but not reached" shape, which is now this project's signature bug.
  **(d1) DONE — SLICE-5M, accepted 2026-09-06.** Kept here for the reasoning. A successful Notes
  drafting job reported failure. `scaffoldContentFolder` returns an absolute path (`new-content.ts:125`),
  `serve.ts:1786` enqueues it as `--continue ${r.dir}`, and `runContinueJob` does
  `join(repoRoot, parsed.folder)` (`jobs.ts:2220`), which concatenates rather than discarding.
  `continueArtifactCounts` then inspects a directory that does not exist, so before and after are
  both zero and the job says "formatting ran but added no new rows or derivatives" on a run that
  worked. `stampFolderEngine` (`jobs.ts:2237`) is in the same unreachable `done` branch and never
  runs. Reproduced empirically with the real parser, not reasoned about. The user-facing cost is
  that it teaches Muxin to distrust a feature that works.
  **(d2) DONE as SLICE-5N (accepted 2026-09-07), folded with item (c)'s brandId debt.** The GUI
  spawned `/atomize` and `/video` with no brand; the `Job` record had no brand field at all; and a
  third entry point this doc never listed — the Notes picker, via `runContinueJob` → `runAtomizeJob`
  — spawned a brandless `/atomize --continue`. All threaded now, plus `/develop`. One leftover
  needs Muxin: `develop/SKILL.md`'s missing entry contract, in START HERE above.
  **This item's own text was wrong and is left here as the record of how.** It read
  "`runDevelopJob` is unaffected — `/develop` takes no brand", taken from the skill's usage line.
  `develop/SKILL.md:57` runs `npm run route -- --brand <brand>` in its body. That false claim was
  copied into the SLICE-5N packet, and the builder reproduced it rather than re-deriving it, because
  a packet claim reads as settled fact. The audit caught it. **Second false packet claim in two
  slices, same cause both times: a usage line or heading trusted over the body.** Verify against
  the body before writing anything into a packet.
  **(d3) `rowEl` (`page.ts:1466`) is dead code.** Zero callers; the live row renderer is
  `reviewScanRowEl` (`page.ts:1595`, called at `:1807`). The "Generate storyboard" button lives
  there, which is why `/cycle` keeps the `/video` offer. `onAction` is wired only at `page.ts:1590`,
  inside `rowEl`, so its `approve-media-plan` (`:1719`), `render-media` (`:1724`) and
  `attach-reviewed-media` (`:1729`) branches are unreachable too. **Blast radius not measured — do
  that before scoping a fix**, and expect it to be bigger than the storyboard button.
  **Add to d3's inventory (found by SLICE-5M, 2026-09-06): `buildFormatArg` (`jobs.ts:2100`) has zero
  production callers.** It emits the repo-relative `--continue content/<slug>` shape. It was
  deliberately not deleted — deletion is a separate decision, and the relative branch that handles
  its shape is kept as cheap insurance. Note this one was believed live and written into a slice
  packet as fact; d3 is therefore an inventory to *measure*, not a list to trust.
  **(e) A stamp can write outside the repository — found by SLICE-5M's auditor, recorded, unfixed.**
  `stampFolderEngine` (`src/review/jobs.ts:86`) joins an unrestricted `row.asset` onto the content
  folder, so an ordinary, properly contained folder can stamp `../../../outside/victim.md`.
  Reproduced, not reasoned about. Pre-existing, and a different surface from the continue-job
  resolution SLICE-5M fixed, which is why it was left alone there. **Calibrate before scoping:** as
  with 5M's containment work, check what actually reaches `row.asset` before treating this as a
  security boundary rather than correctness hygiene. It is a queue-row field this codebase writes.
  **(f) DONE as SLICE-5O (accepted 2026-09-07) — and this item's own framing was wrong, which is
  the part worth keeping.** The list below was inherited from an audit that marked it
  "auditor-confirmed, unverified by me." It was measured before the packet was written: **every one
  of the fourteen sites is benign** (uniquely-named fixtures, self-scoped cleanup) and
  `content-generation.test.ts:69` is not a write at all. The reason is that `dataRoot()`
  (`runtime/data-root.ts:15-19`) already hands every test process a throwaway `mkdtemp` root under
  `NODE_TEST_CONTEXT`, so most suites were never at risk. **The "worst first" call below was also
  wrong**: `slots.test.ts` was indeed writing a real file, but not the live ledger — production had
  already moved to `dataRoot()`, and the file it truncates is the orphaned legacy copy. The
  concurrent-slot-loss scenario described below cannot happen for that reason. What *was* real is
  recorded in START HERE: the legacy file held the only copy of 54 real claims and nothing migrated
  it forward. **Two files were ever at risk, and the more valuable defect was a production bug this
  item never mentioned.** Also corrected: the stray cost rows called "untracked and harmless" below
  were 404 of 439 rows. See START HERE.
  *Original text preserved below as the record of how a list becomes a belief.*
  Pre-existing and never checked by anything. The hazard is not "a test writes a file";
  it is that a cleanup step deletes or overwrites something the system treats as durable state.
  SLICE-5N's own new suite would have destroyed `briefs/<brand>/bets.md`, the append-only placement
  log that prevents duplicate publishing — caught only by the audit, and latent only because no
  per-brand brief exists yet. The same shape may sit in these (auditor-confirmed locations,
  unverified by me): `briefs/` — `publish/cards.test.ts:43,56,75`. `content/` —
  `review/jobs.test.ts:1736`, `serve.test.ts:265`, `content-spin-gate.test.ts:97`,
  `content-pillar-tag.test.ts:35`, `content-source-triage.test.ts:45`,
  `content-validate-gate.test.ts:75`, `content-generation.test.ts:54,69`. `data/` —
  `config/load.test.ts:13,37`, `publish/queue-view.test.ts:24,38`, `publish/slots.test.ts` (six
  sites), `db/tag-source.test.ts:62,101,151`, `cron/ledger.test.ts:16,37,101`,
  `strategy/spin-control.test.ts:118,133`, `strategy/exploration.test.ts:129,145`. No unredirected
  `stories/` writer found. **Worst first: `slots.test.ts` overwrites `data/publish-schedule.jsonl`
  and restores a snapshot.** That is the shared slot ledger every scheduled channel claims against,
  and snapshot-restore is exactly the pattern that looks safe and loses a concurrent write — if the
  review server claims a slot while the suite holds its snapshot, the restore reverts the claim and
  two posts can land in one slot. Verify that before anything else here. Separately, some tests
  append `$0` rows to `data/cost-log.csv` (`outreach:draft`, `step`); untracked and harmless, but it
  is the same class. Most of the rest use fixture-specific names and are probably benign —
  "probably benign" is the claim to check, not to accept. **Measure before scoping**, same warning
  as d3. **Route suggested by SLICE-5N's builder, worth weighing here rather than in a test:** make
  `logCost`'s destination respect a data root the way the briefs root now does. That fixes the
  cost-log writes above and simultaneously unblocks the one layer SLICE-5N could not cover
  (`runAgentSpawn`'s `buildEngineSpawn` → `runCommandSpawn` linkage, observable only with a real
  process today) — without adding a second injection seam below `setSkillSpawn`, which is now the
  only injection point for the three brand-scoped spawns.
- **§5 is CLOSED** (2026-09-05, SLICE-5H). Five capabilities ported, three declined — the
  scoring/soft gate, the home-brand thread-check, and the strategy-brief directives — and
  quote-card post text shipped. **Item `3b`** (retire `/cycle`'s drafting step) is therefore
  unblocked; it takes the stronger verification because it removes a drafting path. It does NOT need
  to wait on (a) — see the correction below: a Content-room card already has a working publish route.
  Item `3a` has been DONE since 2026-09-02 (`/cycle` SKILL.md carries its "Retired steps" section).
  **Item `3b` is now scoped as `SLICE-5L.md` and in flight (2026-09-06.)** One caution recorded there
  and repeated here because it is the standing trap: **"§5 is closed" is not evidence that the
  Content room does what `/atomize` does.** §5 declined three capabilities outright. The plan's own
  warning — "retiring drafting first would remove the only working path" — is satisfied by a traced
  code path per input kind, not by a dependency marked done.
- **CORRECTION (2026-09-05), retracting a claim this block carried for one revision:** it said a
  Content-room card "cannot publish at all" because `publish:cards` selects only `quote-card`
  platforms (`src/publish/cards.ts:78`). **That was wrong, and `cards.ts` was the wrong file to
  reason from.** Configured-media rows never route to `publishCards` OR to `publishText`:
  `scheduleKind` (`src/review/studio-scheduling.ts:64`) tests `isConfiguredMediaRow` BEFORE the
  `TEXT_PLATFORMS` check and returns kind `"media"`, whose only delivery route is **Postiz**
  (`studio-scheduling.ts:460` — "media rows are Postiz-only"). Postiz credentials have been in the
  main-checkout `.env` since 2026-09-02, so the route is live.
  **SECOND CORRECTION (2026-09-05, found while building 5J): "the route is live" was also wrong.**
  Configured-media rows were not reaching Postiz *at all* in production. A media row's
  `provisionalProvider` is `"manual"`, `decideDeliveryPolicy(human-inference, "manual")` returns
  `mode: "manual"`, and `scheduleApproved` wrote ready-to-paste and returned **before** Postiz
  discovery ever ran. So Muxin's reported symptom — "Typefully got stripped out" — was really
  "the Content page had no working scheduled route for cards by either provider." SLICE-5J restores
  both. The lesson is the same one logged below, one level deeper: a dispatch table naming a route
  is not evidence the route is reached. **Follow the value, not the table.**
  What IS true is narrower: a
  configured card cannot go through Typefully, and the older `publish:cards` path skips it by
  design. That narrower fact is **a real gap, not just a design choice** (raised by Muxin,
  2026-09-05, who read Typefully as the standing backup — she is right that it is): §"universal
  capability" row for quote cards allows "native Typefully image drafts only after an explicit
  unsupported result", but the configured-media row directly below it says "Postiz only; manual
  ready-to-paste when discovery reports no support". So an `/atomize` card has a Typefully image
  fallback and a Content-page card does not — and the Content page is the only place Muxin
  publishes from. Postiz rate-limits at 90 creates/hour instance-wide. **DECIDED (Muxin,
  2026-09-05): "Content page should be able to also use Typefully if Postiz doesn't work."** Postiz
  stays first; Typefully is the backup. Typefully was never stripped out — it is still live for
  text rows (`publishText`) and `/atomize` card rows (`publishCards`); configured-media rows are a
  newer kind that was never wired to it, so the dispatch table's missing `media` case dead-ends at
  manual ready-to-paste. Scoped as **`SLICE-5J.md`** (2026-09-05), running in parallel with 5I
  (disjoint files). **Process note:** the false claim came from reading one selector in `cards.ts` and
  stopping, without asking what else selects that row — the same "read the list, not the code path"
  failure logged one entry below about the §5 archaeology table. Before filing a "cannot X" finding,
  trace the dispatcher, not one candidate handler.
- Last decision: 2026-09-06 — **next work is item (d), in the order d1 → d2/brandId → d3.** Muxin
  agreed to the coordinator's read: d1 is small, user-visible and in her way; d2 folds into the brand
  threading item (c) already requires; d3's blast radius must be measured before it can be scoped.
  Scoped as `SLICE-5M.md` (d1 alone). **Outcome: accepted, gate 4260/488/0.** Next in that order is
  **d2 folded together with the item (c) brandId debt** — both are the same bug, a brand that must be
  threaded and is not, and Muxin has already confirmed brand id is required work.
  **Two standing lessons this slice paid for, both worth more than the fix:**
  (i) **A status document is not evidence of a live code path.** The packet asserted two producers
  because this document's phrasing implied it; one had zero callers. Trace the caller before writing
  a claim into a packet — a packet is where a false claim does the most damage, because a worker
  treats it as given.
  (ii) **Check the reachable input surface before hardening anything.** Most of 5M's audit findings
  were against a containment guard the builder added on its own initiative, defending an argument
  with exactly one producer that this codebase generates. Three real, reproduced findings were
  declined once that was established. Ask "what can actually reach this?" before round two of any
  hardening loop, and say the answer to the builder so it does not build defence in depth.
  Before that, 2026-09-06 — **brand id is required, not optional.** Muxin, on the SLICE-5K
  leftover: "Brand id will be needed." Recorded against item (c) above; may be paid earlier as its
  own micro-slice.
  Also 2026-09-06 — **next slice is item `3b`, retiring `/cycle`'s drafting step** (Muxin: "continue
  with the next slice - retiring /cycle"). Scoped as `SLICE-5L.md`, coverage proof first. The skill
  is deliberately **not renamed** in that slice — the alignment plan floats "a name that says what
  they do", but renaming a command Muxin types, referenced across a dozen docs, is a decision she
  has not made. Coordinator call, reversible, flagged to her. **Outcome: accepted as a partial
  retirement** — three inputs retired, voice memos and the `/video` offer kept, with three
  production defects recorded as item (d).
  **Standing lesson this slice paid for twice in one day:** "§5 is closed" and "the route is in the
  dispatch table" are the same error wearing different clothes. A retirement, a capability claim, or
  a "cannot X" finding needs a path traced from something a person clicks to the artifact on disk.
  Cite the caller, not the definition.
  Before that, 2026-09-06 — **Substack posting gets its own script, modelled on the existing
  Substack analytics pull; deferred behind getting Human Inference posting live.** See item (c)
  above. It replaces the assumption that Charles and Fiction delivery was waiting on Muxin
  connecting a provider account: the real blocker is that their destination is Substack, which the
  connected providers do not reach without a second paid account she does not want to buy.
  Before that, 2026-09-05 — **Charles will auto-post** (reversing `/charles` never-posts) and
  **strategy-brief directives declined**. See the Progress log entry of the same date for both.
  Before that, 2026-09-05 — **scoring/soft gate declined outright** (SLICE-5G): almost nothing
  reads the scores, the signal was never validated against engagement, and the port cost a model
  call per Studio run. Read `SLICE-5G.md` → `## Closeout result` before re-proposing it. Before
  that, 2026-09-05 — experiments are signal-driven, **tracked and proven, not auto-applied**: build
  the record/track seam (5F), not machine auto-steering; thread-check surfaces a flag only.
- Standing bar this sets for remaining §5 rows: a capability is worth porting only if something
  actually consumes its output. Check the consumers before scoping the packet. Second bar, added
  2026-09-05: a capability whose job a newer system already does better is redundant even when its
  own consumers are healthy — check for a parallel chain, not just for a dead one.
- Repository state: local `main` ahead of `origin/main` by ~26 (local-first; push is Muxin's call).
  No feature branch open, no PRs pushed.
- Recurring working-tree noise, not a defect: `data/notes-spread-ledger.jsonl` shows as modified
  most days. The 12:00 `notes-daily` cron (`src/cron/notes-daily.ts`) fetches Muxin's Substack Notes
  and appends one `{noteId, url, spreadAt, platforms: []}` line per note it has not seen before.
  `platforms` is always `[]` — the cron **drafts and publishes nothing**; the ledger is a seen-list
  so tomorrow's run does not re-flag the same note. Actual spreading happens when Muxin runs "Pull
  Substack Notes" in the review GUI. Leave the appended lines in place; commit them with whatever
  else is going in, or leave them for the next commit. Never revert them — a reverted line makes the
  cron re-flag a note she already handled.
- Design spec for item 5: `docs/content-room-alignment-plan.md` §5 and §Dependencies and running order
- Standing constraints: see `## Standing constraints` below. Do not read past this block unless a
  slice packet cites a heading; `## Progress log` is append-only archive, not a second status source.

</details>

### 2026-09-05 — SLICE-5H ACCEPTED: a card's quote and its post text are finally two things (§5 closed)

Gate 4204/485/0, exit 0, unsandboxed. Packet:
`docs/operations/launch-slices/SLICE-5H.md` (Closeout ACCEPTED, with `## Audit record` and
`## Deviations accepted by the coordinator`).

**The row understated the problem.** "Quote-card post text" was listed as a missing capability. It
was actually a defect: Studio drafted a card variant's body like any ordinary post and then rendered
**that same string onto the image** (`jobs.ts:1184` → `configured-media.ts:125` → `render.ts:60`).
One string was the derivative body, the render plan's `sourceText`, and the text painted on the
card. So a Studio card either wore a full platform post on its face or shipped a bare quote as its
post body. Either way the quote went out without context — the exact failure `/atomize` step 7 was
built to prevent (Muxin, 2026-07-03). Two related blind spots came with it: initial drafting gave
card variants no card-specific instruction at all (`isCardCaption` existed only in the REVISE path,
and its legacy regex could not match a base64url Studio id).

Fixed by splitting the two texts: `derivatives/<id>.md` keeps the post text, a new
`derivatives/<id>-quote.md` holds the verbatim ≤180-char quote, and the render plan points at the
quote. Muxin's 2026-07-03 decision already answered the product question, so it was not re-asked.

**The audit earned its keep.** Codex, against a Claude builder, found that the companion file was a
SECOND render input the approval digest never covered: `renderStill` reads it off disk, so editing
it after approval would paint unapproved, possibly non-verbatim text onto the card — defeating the
guarantee the slice existed to provide. Also that pre-existing cards would be stranded
(complete-looking, unrenderable, unrepairable), and that the byte-identity criterion had been tested
for one media value on selected fields rather than bytes. All three closed with outcome-asserting
tests; the byte baseline was captured for real by stashing the implementation.

**Two card items deferred to their own slices, both found here.** Configured card rows keep
`platform: "linkedin"`/`"x"` while `publish:cards` selects only `quote-card` platforms
(`cards.ts:78`), so **a Studio card cannot publish at all today** — 5H made its copy correct without
making it shippable. And configured generation renders a separate image per platform instead of
sharing one card. The first is now the highest-value next slice.

**§5 is closed: five ported, three declined, one shipped here.** Item `3b` unblocks, with the
caveat that `/atomize` remains the only path that can actually ship a card until the publish-routing
slice lands.

**What the three declines plus this one say together.** The archaeology list produced three rows
worth nothing and one row that understated a real defect. Reading a capability list is no substitute
for reading the code path: the same inventory that over-reported dead weight under-reported live
breakage.

### 2026-09-05 — Charles WILL auto-post; strategy-brief directives DECLINED; quote-card row renamed

Three resolutions from one conversation with Muxin.

**1. Charles auto-posts. The never-posts rule is reversed.** Muxin: "NO I DO want Charles to auto
post as well as in being reviewed in the Content page etc. I thought that was already clear from the
fact that Charles page and Fiction page has a way to send a draft of whatever we built on those
pages into the Content page to start creating social posts for. Why would this be different."

She is right, and the inconsistency was real: `src/review/charles-content-handoff.ts` already sends
Charles drafts into Content, and then `delivery-policy.ts:32` refuses to dispatch them. Half a
pipeline. The refusal was not an account gap — it was `charles/AGENTS.md` and CLAUDE.md rule 1's
Charles exception ("`/charles` never posts — delivery is ready-to-paste, Muxin pastes it herself"),
which this coordinator read as her standing decision and restated to her. It was not.

Auto-post here means **dispatch after her approval in the queue**, not unreviewed posting. Rule 2 is
untouched.

Three steps, only the first of which was a decision: (i) the reversal, made here; (ii) a Charles
provider account connected, plus Fiction's — Muxin, same conversation: "eventually I'd like to link
up accounts for Fiction and Charles profiles but right now let's just finish getting the Human
Inference related functionality out the door"; (iii) drop the `mode: "manual"` branch in
`src/publish/delivery-policy.ts` so Charles routes like any other brand.

**`charles/AGENTS.md` and CLAUDE.md are deliberately NOT yet edited.** They still describe the code
as it actually behaves today, which is correct until (ii) and (iii) land. Flipping the prose first
would make the docs lie. Whoever builds (iii) must change all three in the same slice. Fiction is
the same shape and simpler: its block is purely the missing account (refusing to reuse the Human
Inference identity), so it clears with config alone, no code decision.

**2. Strategy-brief directives declined — superseded, not dead.** Muxin: "didn't we build the whole,
'hey it needs to learn what works and proposes experiments' so is the strategy brief just redundant
now?" Partly. Two parallel learn-and-grade chains exist. Old: brief writes directives → she accepts
some → stamped `from_brief`/`directives_applied` → `/publish` logs a bet → `/strategy` grades it.
New (`src/grow/`): Signals proposes an experiment carrying an observation, hypothesis, controlled
variable and held constants → content request → published with `experiment_id` → graded. Verified
that nothing bridges them: no caller converts `BriefRecommendation` (`src/review/signals.ts`) into
`SignalsExperimentRecommendationInput` (`src/grow/experiment-slice.ts`). They duplicate. The newer
chain states what is being tested; the older one only tags a post with which bullet inspired it.

**The brief itself stays, and this is the load-bearing half of the finding.** Muxin: "I don't want an
empty Signals page." `readSignals` parses the latest brief for the Signals page's channel-confidence
table and its DO MORE/TEST/DO LESS list, and the page's "Refresh brief" button runs a real
`/strategy` (`serve.ts:663`). Delete the brief and Signals goes blank. Only the stamp-and-grade
mechanism hanging off it is obsolete.

**3. "Quote-card captions" renamed to "quote-card post text."** Muxin: "'captions' isn't really the
right word, it ought to be 'quote card post text' because you're saying the body of the post itself
needs to be generated in which case YES agree." The old name read as visual subtext under the image.
It is the body of the post that carries the card. Confirmed in the same conversation that the
transport is Typefully (`uploadMedia` + `media_ids`, `src/publish/cards.ts`), not Postiz, and that it
already works — the gap is only that Studio's Content path cannot generate the per-platform body.

**§5 tally: five ported, three declined, one remaining** (quote-card post text).

**Generalizable finding, second bar for §5.** The scorer and thread-check were declined because
nothing consumed them. Directives were declined for a different reason: its consumers are healthy,
but a newer system does its job better. So the archaeology check needs both questions — is anything
reading this, *and* is something else already doing this. A capability can be alive and still
redundant.

### 2026-09-05 — thread-check DECLINED: the scorer's sibling, dropped on the same grounds

Muxin, reading the remaining §5 list: "I would NOT need a thread check. If we retired scorer I don't
know why we'd keep its sibling." Declined before a packet was written — no code was ever built for
it, unlike 5G.

The two are the same artifact. `src/atomize/thread-check.ts` was added 2026-07-04, the same day as
`storytelling.ts` and in the same `/atomize` CLI generation, and its own header comment describes the
identical contract: Claude judges inline, writes a `thread_check` frontmatter verdict, "never a hard
gate (surface/suggest only)", and appends a `threadCheckNote()` to the review row's `notes` cell. Its
only machine consumer is a non-blocking `console.log` at `src/atomize/validate.ts:312`, exactly like
the scorer's at `:318`. `readQueue` does not read it. Applying the standing consumers bar to it took
one grep and gave the same answer.

`/atomize` keeps thread-check running as it does today. This declines the *port into Studio*, not the
existing behavior.

**Where this leaves §5:** five rows ported (routing 5a, validate 5b, source triage 5c, spin 5d,
pillar 5e), two declined (scoring, thread-check), two remaining (quote-card captions, strategy-brief
directives).

**The generalizable finding, recorded because it will recur.** The §5 table was built by inventorying
what `/atomize` does and diffing it against Studio's Content path. That makes it an archaeology list,
not a requirements list — it inherited the old CLI's leftovers alongside the capabilities Muxin
actually wants. Two of nine rows turned out to be leftovers. The consumers bar catches those, but a
cheaper question catches them earlier: **did Muxin ask for this, or did `/atomize` merely happen to
have it.** Ask that of a row before scoping its packet.

### 2026-09-05 — item 5g DECLINED: the scoring/soft-gate port, built then dropped

Scoped, built, verified, and then reverted unmerged on Muxin's decision. Recording it because the
reasoning generalizes to the remaining §5 rows.

The packet (`SLICE-5G.md`) would have had `generateConfiguredContent` score every derivative on the
six `/atomize` dimensions and surface the storytelling soft gate. Scouting had already found the
awkward part: no deterministic scorer exists anywhere in the repo — in `/atomize` the scores are
Claude's inline judgment, and `storytelling.ts` is only the plumbing that reads them. So the port
could not be a code move; the configured path would have to actually judge, which meant introducing
the first non-composition model call into that path. The design answered that carefully (one batched
call strictly after bodies are written, injectable, fail-open, below the `gateViolations` throw so no
score could reach the abort path, on the $0 subscription analyst seam). The builder delivered it
complete: 182 focused tests passing, `tsc` clean, 88/88 regression unsandboxed, and a live canary
that made one call at `costUsd: 0` and parsed correctly.

Muxin then questioned the premise — "I don't remember EVER using a scorer on my content BEFORE we
published" — and the check that followed ended the slice. **Almost nothing reads the scores.**
`readQueue` (`src/publish/queue.ts:57`) parses cells 1,2,3,4 and jumps to cell 8 for status; the
`native`/`brand`/`cta` cells are never read. Publishing, `tag-source.ts`, `grade-bets.ts`, and
`resonance` never see them. The only machine consumer in the repository is `validate.ts:318`, which
prints one non-blocking advisory line. The scores are numbers in a table for a human's eyes. Nor was
the signal ever validated: Claude grading its own draft has never been tested against real
engagement. And the port carried a real cost — the scorer fired on *every* configured run, unlike
every other model call in that path, which is why the first regression pass spawned live CLI calls
inside `npm test` (254s) and broke 5E's byte-identity assertion. The builder guarded it correctly,
but the need for a guard was the tell.

Declined, not deferred. Working tree restored; nothing committed. `/atomize` keeps scoring exactly as
it does today (real queues have carried `| 5 | 4 | yes |` and `flag: spin pass suggested (low:
narrative)` since June) and `storytelling.ts` is untouched. Two narrower successors were offered and
not taken — port only the storytelling flag into the notes cell, or first prove the scores predict
engagement — both recorded in the packet's closeout so the reasoning is not relitigated from scratch.

The generalizable lesson, now a line in START HERE: a §5 capability is worth porting only if
something actually consumes its output. Check the consumers before scoping the packet, not after
building it. That check costs one grep; skipping it cost a full slice.

### 2026-09-05 — item 5f accepted: experiment lineage recorded into the bets ledger

Reframed the old "brief directives" item-5 slot after a decision from Muxin: the migration is toward
running **signal-driven content experiments that are tracked and proven, not auto-applied**. That
settles the shape — build the record/track seam, not machine auto-steering (and thread-check, when it
comes, surfaces a flag; it never auto-rewrites a body). Scouting then found the actual gap. The
configured Content path already stamps full experiment lineage onto each experiment derivative's
frontmatter (`experiment_id`, `experiment_recommendation_id`, `experiment_plan_decision_digest`,
`experiment_variables` — `configuredExperimentFrontmatter`, `src/review/jobs.ts:682`), so "which post
is an experiment" is captured at generation. But the measure/confirm chain was broken at the first
link: `/publish`'s bets recorder (`appendBetPlacement`, `src/publish/queue.ts`) harvested only the
legacy `from_brief`/`directives_applied` fields and read none of the `experiment_*` lineage, so a
published experiment post never landed in `briefs/bets.md` **as an experiment**. SLICE-5F closes that
link: `appendBetPlacement` now writes an additive ` | experiment: <id> | recommendation: <recId>`
marker read from the frontmatter already handed to it, mirroring the existing `spin`/`cadence`/`cta`
markers (recommendation guarded on `experiment_id` so it never dangles; absent `experiment_id` →
byte-identical line). Builder = Claude, single lane; additive measurement-only, no composed prose, so
no cross-family audit and a Rule-7 self-vet merge (no hold). Coordinator-verified the full diff
against the packet (segments additive, before the quoted prefix, no other marker reordered) and the
test block (all four acceptance cases incl. an exact byte-identical baseline). Gate `npm run check`
unsandboxed **4185/485/0** (+4 tests / +1 suite vs. 5e's 4181/484 — exactly the new marker block).
Merged to local `main` `44eb355`; branch deleted. Remaining: the experiment-grading follow-on (the
confirm half — `tag-source` column + `grade-bets` keying, judgment-touching, out of 5F's scope), plus
scoring/soft gate, thread-check (as a flag), quote-card captions, and `3a`.

### 2026-09-05 — item 5e accepted: routed pillar surfaced onto Content derivatives

Ported the `/atomize` pillar-tagging capability (§5 row) into `generateConfiguredContent` as the
**surfacing** port only. A read-only scout established the key fact: the pillar the piece was routed
under already lives on disk in `routing.md`'s title line (read by `readPillar`,
`src/review/reschedule.ts:42`), which `generateConfiguredContent` already loads — and recomputing it
would need a Claude judgment call the configured path explicitly forbids (`jobs.ts:970`, "never
invent a pillar … here"). So the faithful port is deterministic: `readPillar(folder)` once →
`pillar: <value>` spliced onto derivative frontmatter beside 5c's `triageFrontmatter`; null pillar →
no line, byte-identical output. Builder = Claude; low-risk metadata-only, so no cross-family audit
and a Rule-7 self-vet merge (no hold). Coordinator-verified the diff (exact minimal splice) and the
test (end-to-end stamp = `readPillar`'s value, 5c stamp preserved, `source.md` byte-exact, and a
byte-identical no-pillar baseline). Gate `npm run check` unsandboxed **4181/484/0**. Merged to local
`main` `df26d30`; branch deleted. Four item-5 capabilities remain (scoring/soft gate, thread check,
quote-card captions, brief directives); `3a` still independently ready.

### 2026-09-05 — item 5d verified and HELD for Muxin: spin ported, skeleton gate un-dormanted

Slice 5D is built, cross-family-audited, and fully verified, but **not merged** — it is a Rule-7
draft-PR hold on branch `feat/content-spin-5d`, because it changes composed prose per platform and so
needs Muxin's before/after review. `generateConfiguredContent` (`src/review/jobs.ts`) now computes the
per-platform spin decision (`resolvePlatformSpin` in `src/atomize/spin.ts`) and, for each spun treated
variant, injects that platform's approved `spin_angles` angle (audience + angle text) into the
source-grounded drafting prompt — mirroring the shipped `duplicatePrompt` contract — so the body is
genuinely re-hooked to the approved angle rather than merely labelled. The same spin/angle is stamped
into the derivative's provenance and fed to slice 5b's skeleton gate, which now FIRES end to end: a
treated, source-traceable candidate spun to a case-skeleton platform (linkedin/x) whose recorded
source class excludes the beat is rejected atomically. This discharges the 5c→spin follow-on
(un-dormant the gate + add the end-to-end rejection test). The case gate stays intentionally dormant
(the configured path emits no `case_skeleton: true` beat).

A coordinator over-review caught the builder's first pass stamping `spin: true` without actually
spinning the body (spin-on and spin-off produced byte-identical copy — a provenance overstatement and
a miss of the packet's before/after Observable result). A scoped repair injected the approved angle
into drafting so `spin: true` is earned; the cross-family Codex audit then found no correctness
defect. Extraction-first held throughout: the angle re-frames only within cited source segments,
controls stay byte-exact, voice passes, and no-source-essay origins (Venture, Charles) / substack-note
sources are never spun. Focused 157/0, tsc 0, repo-wide `npm run check` unsandboxed 4178/484/0. Awaits
Muxin's Rule-7 approval before merge.

### 2026-09-05 — item 5c accepted: source triage ported into configured Content generation

Slice 5C is accepted and landed on local `main`. `generateConfiguredContent` (`src/review/jobs.ts`)
now runs source triage and records the real `source_class`/`source_class_case` into each variant's
derivative provenance before any write, threading the same values into slice 5b's skeleton and case
gate calls. A class recorded in `source.md` by `/atomize` wins; a new deterministic fallback
(`classifyContentOriginClass` in `src/atomize/source-triage.ts`: fiction→`fiction-promo`,
studio/human-inference→`frame-native`, venture/charles/unknown→`undefined`) supplies the class when
the folder has none. `source.md` is never mutated or invented — recording goes to derivative
frontmatter, because `source_lines` is 1-indexed into `source.md` and inserting a line would shift
every traced body line (a rule-1 traceability break). Scoped exceptions are honored: Venture and
Charles get no class stamp and no fabricated `source_lines`; fiction is stamped `fiction-promo`.

Honest scope correction, made during the slice: the packet's first draft (this coordinator's)
over-promised that the skeleton/case gates would fire end to end. They cannot yet — the configured
path computes no spin/angle/caseSkeleton (spin is a separate, not-yet-ported item-5 capability), so
those gates are wired but **dormant**; the call site passes `undefined` and no configured candidate
declares a beat. The cross-family Codex audit caught the over-claim; the packet was reframed to the
true deliverable (triage recorded + wired, enforcement deferred) and a scoped repair corrected the
code comment, relabeled the gate tests as unit-level, added a dormancy test, and added
fiction/charles `:813`-branch generation tests (8 tests total). Follow-on recorded for the spin
slice: un-dormant the gates and add the end-to-end rejection test then. Second Codex pass: no new
real defects. Repo-wide `npm run check` unsandboxed: 4173/484/0.

### 2026-09-05 — item 5b accepted: `validate` gates ported into configured Content generation

Slice 5B is accepted and landed on local `main`. `generateConfiguredContent` (`src/review/jobs.ts`)
now enforces the applicable `/atomize` `validate` gates — per-platform char/word limits, the
source-triage skeleton gate, and the case-evidence gate — over every routed candidate **before**
any derivative file, media stage, or `review-queue.md` row is written; a violation throws and
aborts the whole routed variant set atomically. Char/word limits were extracted from
`checkDerivative` into a shared `checkPlatformLimits` (`src/atomize/validate.ts`) that both the
atomize validator and the Content path call, reading limits only from `config/platforms.yaml` via
`loadPlatforms()` — there is one limit source (the hardcoded `CONFIGURED_PLATFORM_LIMITS` table was
already removed by P1, `c6842cd`). The `source_lines`-presence and spin-angle checks were
deliberately **not** ported: they are `/atomize` frontmatter contracts that would misfire on a
scoped-exception origin (Venture, Charles, fiction) that legitimately carries no tracing. The
routing include/skip gate is already consumed by 5a and was not re-run. Skeleton/case gates are
ported but defensive against today's configured frontmatter vocabulary (direct-helper tests prove
both their firing and passing shapes).

Coordinator/worker split, one packet: builder Claude, packet-only cross-family audit by Codex/GPT
(zero established defects). The audit's one material coverage gap — atomicity proven with only a
single variant — was converted to a checklist item and closed with a new two-included-platform
abort test that proves the in-limit sibling is withheld too; two trivial hardenings folded in.
Verification: focused file 7/7, wider focused run 98/0, `jobs.test.ts` 114/0, `tsc --noEmit` exit 0,
and the single repo-wide gate `npm run check` unsandboxed **exit 0, 4165 tests / 484 suites / 0
failures / 0 skips**. Bounded canary = the real `generateConfiguredContent` run inside the
atomic-rejection tests (deterministic, no model call). Full packet and RESULT BLOCK:
`docs/operations/launch-slices/SLICE-5B.md`.

Item 5's remaining seven capabilities and item `3a` are the next dependency-ready work (see START
HERE). Delivery is local-first: 5b sits on local `main` unpushed, along with the earlier
slice-protocol doc commits; pushing is Muxin's call.

### 2026-09-05 — protocol migration

Adopted the portable slice protocol. `AGENTS.md` gained `## Slice protocol` (with this
repository's bindings) and `## Ending a session`; `docs/operations/launch-slices/` was created
with `SLICE-TEMPLATE.md`; this block was cut to pointers and the previous handoff narrative moved
below. The short start and end session prompts now resolve. Closeout for the session that
preceded this one: five previously local-only commits pushed to `origin/main`, the 2026-09-05
notes-spread ledger rows committed, three stale `/private/tmp` worktrees for already-merged work
removed along with the merged branch `feat/content-routing-gate-5a`, and a fresh unsandboxed
`npm run check` passing at 4,158/4,158 tests across 484 suites. Five pre-existing local-only
`agent/*` branches still carry unpushed work and remain untouched pending Muxin's call.

### 2026-09-05 — handoff #10: item 5a landed, item 5b next

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

### 2026-09-07 — SLICE-5Q accepted: queue content first

Packet: `docs/operations/launch-slices/SLICE-5Q.md`. Claude implemented the two owned page files; Codex independently audited the frozen candidate. One repair cycle closed bulk-error persistence, informational toasts replacing errors, and the source-height heuristic. Full original inputs now divide folders; readable complete post bodies lead each row; status errors remain until dismissed or a successful action. All five design checks passed with browser evidence and intercepted status requests. No publishing or operational content changes.

Focused verification: 386 passed. Full local `npm run check`: typecheck plus 4302 tests, 491 suites, zero failures, exit 0 with serial test-file execution. The default Node v22.14.0 runner hung with CPU spin and was interrupted; the advisor-recommended temporary PATH shim added only `--test-concurrency=1`, independently reviewed as preserving the full inventory. This does not establish default-concurrency stability. Evidence is under `/private/tmp/slice-5q-evidence/`; no tracked runner configuration changed.

The stale failed job is dismissible through existing Clear queue. Its operational record was not changed. The original 5P server write/error question remains unverified; other rooms' transient toasts are outside scope. The live `x-1`/`x-2` safety warning remains: until 5S lands, a GUI retry can publish once Postiz answers; Muxin alone may set both to pending. This session preserved the pre-existing review-queue and notes-spread-ledger modifications. Next: 5R, then 5S. No push.

### 2026-09-07 — SLICE-5R accepted: X routing restricted to technical pillars

Codex worker removed X defaults and added hard vetoes for human-ai, civic-tech, career-work,
and other, preserving builder and claude-code. The existing merge veto wins even when a
piece also carries builder. No precedence or production engine change was needed.

The isolated named-essay fixture (source checksum and recorded civic-tech + human-ai pillars)
excluded X with a rule reason while keeping Bluesky and democratic-resilience. Read-only
`--all` confirmed all six pillar assignments. Focused routing and affected regression tests
passed: 138 tests. Claude Opus provided cross-family source review and closure. The initial
full gate exposed stale live-config test expectations; those were repaired without removing
requested-X coverage or queue preservation assertions. The new frozen candidate passed the
complete unsandboxed `npm run check`: exit 0, 4304 tests / 492 suites / zero failures, cancelled,
skipped, or todo. Serial Node execution used the documented 5Q workaround; default parallel
runner stability remains unverified. Evidence: `/private/tmp/slice-5r-evidence/`.

A6 used its explicit follow-up allowance: manual includes are honored by consumers but not
durable across `/atomize --continue`, which reruns routing and overwrites the file
(`.claude/skills/atomize/references/continue-mode.md:5-8`,
`.claude/skills/atomize/SKILL.md:195-196`, `src/strategy/route.ts:608`). `--explore` also respects
hard vetoes. No misleading override instruction ships. A durable deliberate per-piece X
exception remains follow-up work; protected skills were not edited.

No generated routing, live queue, database, or publishing state was changed. The pre-existing
review-queue and notes-spread-ledger modifications were preserved. Coordinator owns the local
commit and integration; nothing pushed. Packet: `docs/operations/launch-slices/SLICE-5R.md`.
Next dependency-ready: 5S, approve never publishes.

### 2026-09-07 — SLICE-5S stopped before implementation: Claude usage limit

5S is dependency-ready and its packet is confirmed. The Claude strong-tier builder returned
`You've hit your session limit · resets 8:50pm (America/Chicago)` before making any code changes
(session `005d30e8-4fb0-4203-9fad-ac342ff83034`). The protocol requires a stop on usage limits.
No acceptance checks, cross-family audit or repository-wide gate ran; 5S is not accepted.
The packet now specifies fixture-only visual verification with an isolated ledger and fake
publisher, includes the cited design criteria, and honors Muxin's autonomous engineering
instruction without a routine visual-approval pause. Product scope is unchanged.
Evidence: `/private/tmp/slice-5s-evidence/build-result.json`; retained worker prompt and audit
criteria are in the same directory. Next action: rerun the confirmed 5S packet with the Claude
builder after capacity returns, then obtain independent GPT audit before the frozen gate.
The pre-existing review queue and notes-spread ledger modifications remain untouched. No push.

### 2026-09-07 — SLICE-5S auditor changed to Grok; not accepted

Muxin requested Grok for the independent audit. Updated the packet routing from GPT to Grok. The Claude builder stopped before implementation, so no candidate diff or focused-check evidence exists to audit. No Grok call was launched. The next action remains resuming the Claude builder when capacity returns, followed by the Grok audit and the existing verification sequence. No product scope changed.


### 2026-09-07 — SLICE-5S Codex partial implementation; not accepted

Muxin authorized a non-highest-tier Codex builder; `gpt-5.6-terra` at medium effort ran in `/private/tmp/content-agents-slice-5s-codex` on `slice-5s-codex`. Partial approval/status and Publishing UI work is retained uncommitted. Focused checks: 398 pass / 3 fail; one test assertion changed afterward without rerun. Endpoint, visual proof and acceptance remain incomplete.

Automatic approval review rejected the proposed explicit-scheduling guard exception and its patch artifact, citing duplicate-post risk for legacy approved rows with missing history. No exception was applied. A bounded Grok safety assessment was attempted but its read-only sandbox refused startup because `/var/run/docker.sock` is a symlink. No Grok audit or full gate ran. Packet `## Stopped` records evidence and next action. No candidate integration or push; existing main checkout operational changes remain untouched.

### 2026-09-07 — Grok workspace audit completed; 5S not accepted

User-authorized `grok --sandbox workspace` audit completed with exit 0. Review confirms the missing Schedule endpoint and runtime verification gaps; approved-row duplicate-post guard conflict remains unresolved. Bounded findings, evidence and coordinator dispositions are in SLICE-5S → Grok candidate audit. No implementation integrated or pushed.

### 2026-09-07 — SLICE-5S accepted after connected-Chrome verification

Approve is status-only; explicit Publishing Schedule uses the audited durable first-attempt claim, strict history checks and conservative uncertain/legacy refusal. Terra xhigh implementation, independent Grok source/behavior closure and rendered closure PASS. Chrome fixture showed approval callbacks0, single/mixed selection callbacks2 with durable fence+uncertain evidence before both fake callbacks; legacy refusal persisted. Pending typography18px/1.6 and all five rendered design checks PASS. Full frozen unsandboxed `npm run check`:4321 passed/0failed/exit0, using established serial shim; source hashes unchanged. Packet `docs/operations/launch-slices/SLICE-5S.md`; bounded evidence `/private/tmp/slice-5s-evidence/`. No real publishing, operational queue edits, or push. Fixture stopped; coordinator integrates only nine implementation files plus packet/master and closes this slice.


### 2026-09-07 — SLICE-5T accepted: unified unscheduled Typefully drafts

Packet: docs/operations/launch-slices/SLICE-5T.md → Accepted closeout. Terra high builder,
then xhigh for omitted caller verification and incorrect frozen-check metadata; Grok 4.5
independent source/behavior closure PASS using workspace sandbox and no edits. Explicit
--no-schedule/TYPEFULLY_SCHEDULE=off traverses the unified approved-row dispatch fence, forces
Typefully, omits scheduling time, persists private/id with no planned time, and claims no slot.
Duplicate attempts through draft or scheduled mode refuse. Legacy direct helper behavior is
preserved. No GUI change, live provider canary or push.

Focused 77/0 and typecheck 0; final frozen unsandboxed npm run check 4326/0, exit 0, wall 570.36s.
Eight audited source/test paths remain hash-identical after gate. Evidence retained under
/private/tmp/slice-5t-evidence/. Earlier missing-tsx frozen output was a setup failure, corrected
and never used as passing proof. Coordinator includes packet/master in acceptance commit and
preserves the two pre-existing operational edits. Next refresh 5P's one-row eligibility and
obsolete extra-slot/migration premise, then run its live unscheduled readback/cleanup proof.


### 2026-09-08 — SLICE-5U accepted: exact Typefully row selection for 5P

5P read-only preflight found two approved X rows, x-1 and x-2; the folder-wide command could not
satisfy the one-draft budget without changing Muxin's approvals. No provider call was made. The
initial worker inference that missing approval journal blocked them was corrected by coordinator
source review: their recorded failed-before-dispatch history permits a guarded retry. Grok verified
the predicate and closed three bounded excerpt gaps. Eight operational-file hashes stayed unchanged.

5U adds --only-id through the same Typefully unified CLI, validates exact unique approved/kind
selection before provider effects, and preserves no-selector behavior and existing safety checks.
Terra xhigh implemented; Grok 4.5 independent audit PASS, no established defects. Fake production-entry
proof covers selected private draft/no slot, unselected row untouched, duplicate refusal, invalid
selection and supported legacy failed retry. Focused 77/0 and typecheck pass. Frozen detached final
unsandboxed gate exit 0, 4326/0, wall 558.23s; source hashes unchanged. See 5U Accepted closeout.

Accepted source/test and packet/master changes are committed locally on main, no push. Existing
review-queue and notes-spread-ledger edits remain outside the commit. Next is refreshed 5P with
--no-schedule --only-id x-1: recheck current eligibility, observe the real unscheduled draft, delete
that exact ID and verify absence. No live 5P acceptance is claimed here.

### 2026-09-08 — SLICE-5V accepted: one-attempt Typefully creation

5P preflight after 5U confirmed x-1 eligibility and unchanged operational hashes, but Grok source
review established an outer processing-message loop could repeat an ambiguous 5xx/network create;
429 also exceeded the fixed attempt budget. Chrome was disconnected, so no live call occurred.
5P stays NOT ACCEPTED; its earlier selector blocker is retired.

Codex Terra xhigh repaired only createDraft and its tests in 5V. Every create outcome now makes
one POST. Six fake transport cases pass; the actual CLI retains uncertain state after an ambiguous
503 and blocks a repeated invocation without another POST. Shared retry defaults and scheduling
payloads are unchanged. Media processing failures surface for review instead of automatic re-POST.
Grok PASS, no material findings; focused 39/0, typecheck 0; frozen unsandboxed full gate 4327/0,
exit 0. Coordinator integrates the verified candidate locally; no push or operational mutations.
Evidence and cleanup disposition: `docs/operations/launch-slices/SLICE-5V.md` → `## Accepted closeout`.
Next: reconnect Chrome and resume 5P's exact-ID live verification with a fresh eligibility check.


### 2026-09-08 — SLICE-5P accepted: real unscheduled draft and verified cleanup

Playwright provided the authenticated Typefully browser when the CUA Chrome/Edge/in-app routes
were unavailable. Read-only API discovery and UI settings matched social set 314868, Muxin Li,
with Human Inference accounts. Grok cleared the process-local account binding and one-canary
release after receiving actual source/ledger excerpts. No .env edit or new approval was needed.

The production CLI selected approved x-1 only and created draft 10682647 once, unscheduled.
Authenticated browser readback confirmed the exact ID, no scheduled date or published date.
Existing cancelDraft deleted only that ID; fresh complete browser readback showed its absence
and all four prior drafts intact. Both approvals, all protected operational bytes and 54 scheduler
claims remain unchanged. The legitimate uncertain/private events remain in local history.

Grok final evidence audit PASS, exit 0; frozen unsandboxed npm run check passed 4327 tests with
zero failures, exit 0, 559.879 seconds. No production changes, scheduling, publishing, paid model
generation or push. Temporary checkout/browser files were settled; unrelated AGENTS/template,
review-queue and notes-ledger edits were preserved. Evidence and exact hygiene disposition:
`docs/operations/launch-slices/SLICE-5P.md` → `## Accepted closeout`.


### 2026-09-08 — SLICE-5W accepted: durable per-piece X opt-in

The 5R A6 follow-up is delivered. The route CLI can explicitly opt one content folder into X or
revoke that choice; strict versioned routing-intent.json survives separate-process rerouting and
continuation. Ordinary X defaults, non-X routing, source/origin restrictions and approval remain.
Help and generated routing explain the exact commands. No real content or provider state changed.

Updated parallel-work guidance applied at the completed 5P boundary: bounded interface preparation,
then disjoint implementation and independent verifier-tooling lanes; candidate checks waited for
frozen handoffs. Coordinator reproduced a dangling metadata symlink outside-write gap; builder
fixed it with explicit lstat and no-follow writes. That regression and a contradictory header claim
were independently closed before integration. Grok PASS; focused 46/46; real CLI 12 groups PASS;
single frozen unsandboxed gate 4332/4332, exit 0. Packet/evidence: SLICE-5W.md and
/private/tmp/slice-5w-evidence/. Three temporary worktrees removed after exact patch checks.
Next work is the analytics brand_id backfill documented in 5R's known data gap.


### 2026-09-08 — 5W follow-up audit PASS; 5X awaiting source-account provenance

Grok 4.5 ran with --sandbox workspace, no edits, and returned PASS on accepted 5W A1–A7
and audit A8, exit 0. Prior symlink and generated-header findings remain closed; no new material
defect. Source/unrelated hashes remained unchanged. Evidence: `/private/tmp/slice-5x-evidence/coordinator/`.

Prepared SLICE-5X while that independent audit ran. Read-only SQLite and exact checksum-pinned
processed exports recovered post-ID coverage for X 264/264, LinkedIn 74/100, and Substack 13/13.
Legacy unbound total remains 409 posts/2981 metrics, including 32 Substack Note posts. A first
preparation script's loose config substring matching was rejected during review; Terra effort was
raised high → xhigh with paused ownership reassignment. Corrected evidence finds no explicit
public-source-account binding in configuration. Export joins must not be presented as brand proof.

5X is not accepted: owner source-account attestation and one missing LinkedIn source/alternate
mapping are required before freezing implementation. No source or operational data changed.
879 older Bluesky child metrics are optional integrity work with no measured current routing
change; they were not substituted for the requested missing platform history. The packet's Stopped
section retains the sourcing requirement and exact evidence pointers. No push.


### 2026-09-08 — SLICE-5X accepted: Substack history attribution and LinkedIn recovery

Muxin confirmed legacy X/LinkedIn are non-Human-Inference experimental data and Substack is HI.
Bounded codebase/import-root/Git search found a distinct same-name LinkedIn workbook that adds all
26 previously unjoined post IDs (union 100/100); its checksum is not substituted for the absent original.
The previous sourcing stop is resolved without asking for an internal account ID or original file.

5X added a fixed-manifest read-only preview and explicit backed-up attribution command. Actual repair
assigned 45 posts/206 metric captures across articles and Notes to their existing HI account identities.
Production routing now sees 42 pillarful posts; 3 articles remain unclassified and outside route cells.
Legacy X 264/2345 and LinkedIn 100/430 remain unchanged, unassigned and queryable for experimentation.
Audience/import rows and the unrelated older Bluesky metric gap remain outside this slice.

Parallel preparation and independent verifier tooling used disjoint ownership. Terra xhigh built;
Terra max repaired two reproduced omissions (dangling backup link and live-WAL snapshot handling)
after safe reassignment. Grok workspace audit independently closed both, source verdict PASS.
Actual isolated CLI/production measurement joins/route loader, recovery and ingestion regressions PASS.
One frozen unsandboxed npm run check passed 4338 tests with exit 0 (624.37 seconds).

Real preview/apply/post-preview all exit 0. The whole resulting DB and validated private backup match
the independently tested fixture and restored backup byte-for-byte. Approval/provider/scheduler state
and four pre-existing edits are unchanged. Durable manifest and exact hashes, backup location, worker
ownership, audit/check evidence and hygiene disposition: `docs/operations/launch-slices/SLICE-5X.md`.
Repository `/Users/Muxin/Documents/GitHub/content-agents`; no push or new live provider canary.
Task-created worktrees/branch removed. Hygiene rescue86428dd retained; no prunable worktrees.
Other sessions' four edits and existing branches preserved and excluded per packet disposition.


### 2026-09-08 — SLICE-5Y accepted: atomic directory migration

5Y closes 5O's recorded directory-copy defect in `migrateLegacyDataDirectory`. The helper now
copies to a unique sibling under the existing lock, then renames the complete tree into place.
Ordinary failures clean their staging; a killed process leaves no partial canonical directory.
Legacy bytes and existing canonical precedence remain unchanged. Retry after a killed process
still follows the existing five-minute dead-owner lock policy; no old partial tree is guessed.

Codex Terra xhigh implemented the two-file repair. Independent verifier preparation moved from
Terra high to xhigh after coordinator review found fixture-root/timeout/lock-aging omissions.
Repaired actual harness passed nested-byte, failure/retry, concurrency and SIGKILL checks;
old implementation fails as expected. One test-only string|URL type error was also corrected.
Grok 4.5 workspace audit PASS with no blockers; final frozen unsandboxed gate 4342/4342, exit 0,
431.56 seconds. Nine protected operational/pre-existing fingerprints unchanged. Full evidence,
limitations and hygiene: `docs/operations/launch-slices/SLICE-5Y.md`.

The missing next-step handoff was reconstructed from bounded sequence and later-packet evidence;
5H's historical card-routing recommendation was already covered by 5J/5K. Next is prepared
`docs/operations/launch-slices/SLICE-5Z.md`: first verify current coverage of the job-spawn chain
identified by 5O, then close only an established gap. No 5Z worker or implementation started.

### 2026-09-08 — 5Z stopped before acceptance: Grok closure balance exhausted

5Z's bounded inventory confirmed the historical job-spawn coverage gap. Codex Terra added
fixture-only tests for the real queue → engine builder → child runner chain: Claude/Codex success,
nonzero exit, timeout, observable child artifacts/logs/cost rows, and isolated environments.
No production source was changed or integrated. V1 focused checks passed 138 tests and Grok passed.
Independent review nevertheless established cleanup gaps against the packet's unconditional-cleanup
requirement. Terra effort was raised xhigh → max; cleanup repairs and failure-injection controls
were independently closed on final test SHA `7764497b1716182b158001efb86cf4c023aba8f12479421b28e6d2f418d722db`.
Final scoped raw proof is 3/3 exit 0. Full focused 140/typecheck 0 were worker-reported for R1;
raw R1 output was not retained, so the final full gate is still required.

Grok's final closure attempt exited 1 with API 402, “Grok Build usage balance exhausted”; no verdict
was produced. Per Slice protocol usage-limit and stopping rules, the slice is **not accepted**.
No full gate was run and no candidate source was integrated. Rescue snapshots retain it. Resume from the packet's `## Stopped`
section after Grok balance is available. Candidate and audit prompt/evidence are retained in the
packet-named temporary worktrees/evidence root. Only packet/master stopping records are committed.

### 2026-09-08 — Audit-efficiency policy

Owner-directed documentation update: `AGENTS.md` → `### Audit scope and proportional verification`
sets risk-based review, scoped prose checks, bounded/delta audits, and provider-specific quota
checkpoints. Agents own UI journey proof before design review; fixture/live and skipped-feature
evidence stay distinct. Required independent closure, explicit reviewer choices, security/privacy,
authenticated-canary budgets, and release gates remain in force. Current product acceptance and
blockers are unchanged. Policy verification uses coordinator review and whitespace/diff checks.

### 2026-09-08 — 5Z accepted after Claude delta closure

5Z closes the remaining 5O full job-spawn verification gap with observable isolated child
artifacts, output, job status/log and fixture cost evidence. Test-only changes include setup
and reaper failure cleanup proof. Claude Sonnet (actual `claude-sonnet-5`, medium requested)
independently closed the four material cleanup invariants; prior Grok V1 dispositions retained.
No settled audit/check was restarted. Final unsandboxed frozen `npm run check` passed: 4345 tests,
494 suites, zero failures/skips, exit 0, 541.38s. Final test SHA
`7764497b1716182b158001efb86cf4c023aba8f12479421b28e6d2f418d722db`.
Evidence `/private/tmp/slice-5z-evidence/`; packet `docs/operations/launch-slices/SLICE-5Z.md`.
No production behavior changed, no real provider/model canary, all nine resume fingerprints
preserved. Primary checkout remains main; no push. Successor slice not yet assigned.

### 2026-09-08 — 6A parallel reconciliation and 6B source checkpoints

Two Codex Terra workers independently reconciled safety and operating-loop requirements against
`b74c889`, writing only separate evidence directories. Settled 5B/5Q/5Y/5Z work stays closed.
P2 historical operational items do not establish new code defects or restore superseded policy.
Coordinator selected 5O unresolved 2 and 4 for separate bounded current-source checks: queue-view
ledger text and actual render-child cost observability. Exact scope and checkpoints are in
`docs/operations/launch-slices/SLICE-6B.md`; source/check ownership is disjoint and no live
provider/model work is authorized. 6A documentation review passed; 6B is not accepted.


### 2026-09-08 — 6B accepted: truthful queue path and exercised render-child logging

Two Codex Terra lanes worked in separate checkouts: queue-view now prints the actual configured
ledger destination, and the render test observes a real fixture Node child's `logCost` CSV row
while retaining the free-render no-row assertion. Focused outcomes: queue 11/11, render 32/32.
Claude's initial PASS exposed a missing env-loader excerpt; coordinator inspected that boundary
and required a higher-effort test-only repair because `.env` loads from repo root, not cwd.
The repaired child loader substitutes only that exact read, proves fixture parsing and zero
fetch calls; Claude delta review independently passed. No production env/render/cost seam changed.
Frozen unsandboxed full check passed 4347 tests / 494 suites, exit 0, 482.86s. All protected data
and pre-existing edits were preserved. Evidence `/private/tmp/slice-6b-evidence/`; packet has
final hashes and closeout. No live provider/model canary, no push. Next selection uses the bounded
6A remaining-work map; no new operational run or publication is selected by this closeout.


### 2026-09-08 — 6C parallel product-depth reconciliation

Three bounded investigations at ea77d5b separated implementation from live/input proof. Workflow
and Charles ran concurrently; the completed workflow worker then handled recommendation evidence
because the third initial dispatch hit the agent thread limit. All reports are frozen under
`/private/tmp/slice-6c-evidence/`; final hashes and coordinator dispositions live in `SLICE-6C.md`.

One concrete code gap is next: Fiction's idea and revision Grok builders still use read-only
sandboxing on this Mac. Prepared `SLICE-6D.md` for the two source/test pairs, actual isolated child
outcomes, bounded Claude review and final runtime gate. It is not implemented or accepted.
Charles's held persona-edit capability is represented on main; do not merge its old branch or
reinstate historical manual-policy wording. Fiction, Scout and Human Inference workflows still
need the bounded real-input exercises identified by P2; this slice ran none. Recommendation
ledgers/readiness and a specialized dossier path exist. A generic missing adapter was not proven;
next inspect the exact request/recommendation/treatment contracts before selecting implementation.
Real reviewed inputs gate operational recommendations, not independent fixture preparation.

Documentation-only scope: no runtime gate or external audit required. Three source/history reports,
24 pinned source hashes and Charles ancestry/blob checks passed. Final diff, hygiene and preserved
leftovers are recorded in 6C's closeout. No source, operational state, provider or publication changes.

### 2026-09-08 — Portable usage discipline rollout

Owner-directed documentation-only update: `AGENTS.md` → `### Usage discipline` and the
packet template now require a useful benefit for extra lanes, bounded worker contexts,
explicit model/effort, completion notifications, concise check results with disk evidence,
and automatic closeout at coherent capability boundaries. Apply at the next safe checkpoint;
preserve current worker ownership until a frozen handoff. Existing audits, outcome gates,
product scope and accepted/stopped statuses remain in force. Scoped review covers exact
insertions, rule consistency, pointer existence and whitespace; no runtime audit/build/E2E
is required for this policy-only change. Other sessions' work is excluded from this commit.

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

### 2026-09-07 — Grok launch guidance and higher-effort 5S repair

Muxin requested the working Grok invocation in every AGENTS.md across eight named active checkouts. Added the workspace-sandbox command, Docker socket symlink explanation, no-edit audit prompt, bounded evidence requirements and diff/exit/verdict verification to 11 files. Seven external checkouts received AGENTS-only commits: launch-design-review `2ed7d0704`, wt-OD22-FLEET `05c0c48`, alignment-vocabulary `35b49a84b`, elicitation-v2 `63fe2f5bc`, public-concern-monitoring `9766da897`, state-local-election-phase8 `df8ab1e24`, consumer_champion `fb149ac`. Existing work preserved; nothing pushed. Content-agents owns four guidance edits.

5S resumed on the retained candidate with `gpt-5.6-terra` raised from medium to high effort, per Muxin. Grok stays independent. Legacy unknown-history and uncertain-attempt protection remain mandatory; the rejected explicit-intent bypass is not authorized. Worker is resolving provenance safety with architectural guidance before finishing the audit checklist.

### 2026-09-07 — High-effort 5S repair stopped, not accepted

The same Codex model at high effort added the Schedule route and repaired focused assertions; worker reports 402 tests / 0 failures and focused A1 HTTP/source regressions 2 / 0. Four tracked candidate files remain in the retained worktree. Architectural guidance established that approval transitions alone cannot prove fresh history. A bounded creation-provenance expansion was approved as engineering scope, but automatic approval review rejected its scheduling integration for possible duplicate schedules when provider history is empty. No rejected provenance code or untracked artifact remains. Fresh approved rows therefore remain refused. No visual proof, fresh independent closure, or full gate ran. Exact rejection and required informed decision are in SLICE-5S → Stopped. The slice remains unaccepted; candidate not committed, nothing pushed.
