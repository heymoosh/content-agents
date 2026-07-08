# Codebase review: complaint root causes + improvement plan

**Date:** 2026-07-07
**Scope:** root-cause diagnosis of the P0/P1/P2 complaint cards in `docs/content-agents-backlog.md`, plus a general health pass (maintainability, reliability, performance) over all of `src/`. Produced from three full read-only audits: the entire review GUI (`src/review/serve.ts`, all 1,720 lines), the publish pipeline (`src/publish/*`, `src/pull/*`), and a codebase-wide structural sweep (91 modules, ~11.4k LOC, 20 test files).
**No code was changed.** Every finding cites file:line so fixes can be scoped into backlog cards.

---

## Part 1: The complaints, root-caused

### 1. "Ask Claude" on the GUI does nothing (P0, card `9304e4a5`)

**What you asked it to do:** edit a Bluesky post into an X post, AND create a new X post from the source. **Both are impossible by design, and the failure message vanishes in 1.4 seconds.**

Three root causes stack up here:

1. **Ask Claude is hard-scoped to editing ONE existing derivative's body, in place.** The button only renders on rows whose `derivatives/<id>.md` already exists (`serve.ts:254`, `serve.ts:1387`). The prompt it sends (`revisePrompt`, `serve.ts:373-394`) explicitly instructs: "Edit ONLY that one file. Touch nothing else" and "Keep the YAML frontmatter block intact (platform, spin, angle...)". So retargeting the platform (frontmatter) and creating a new derivative (a second file + queue row) are both forbidden by the very prompt. Claude obeys, changes nothing.
2. **A no-op is reported as a failure you never see.** After the CLI returns, `reviseDerivative` diffs the file and throws "Claude ran but didn't change anything" (`serve.ts:425-428`). The client shows that in a `flash()` toast that auto-hides after **1400ms** (`serve.ts:1332`, `serve.ts:1458`). Blink and it reads as "nothing's working."
3. **There is no "create a post" affordance anywhere per-row.** The only creation path is the Add/Queue tab, which runs a full `/atomize` on a source.

**Fix:**
- **Make errors durable.** Replace the 1.4s toast with persistent inline error text on the row (and keep a small per-row action history). This one change would have answered all three of your GUI complaints in the moment.
- **Add the missing action explicitly** rather than stretching free-text: a per-row "Duplicate to platform..." action that copies the derivative, respins it for the target platform's angle via the existing spin path, appends a new review-queue row, and lands it back in the Review tab. Keep Ask Claude for what it is (body edits).
- **Teach Ask Claude to say no.** When the request is out of scope (platform change, new post), have the prompt instruct Claude to write a one-line refusal-with-reason to stdout that the server surfaces on the row, instead of silently making no edit.

### 2. "Am I only able to run 1 Claude task at a time?" (same card)

**No hard one-task limit exists, and your vault dashboard was almost certainly not blocked by this GUI.** Here is what actually serializes:

- Only **atomize jobs** queue single-file: a module-level `draining` boolean (`serve.ts:716`, `785-831`) runs them strictly one at a time.
- The other four Claude features (Ask Claude/revise `serve.ts:411`, insights `530`, ask `571`, brief revise `671`) each spawn their own `claude -p` subprocess **with no coordination at all**, concurrently with each other and with a draining atomize job.
- There are no lock files or session collisions between separate `claude` CLI processes. The only shared resource between this GUI and your vault dashboard is the **Claude subscription's usage/rate limits**. Contention there shows up as slowdowns or rate-limit errors, not as one app cleanly pausing another. Your vault task not finishing was most plausibly its own failure or a rate-limit hit, not a GUI conflict.

**Fix:** route ALL of the GUI's Claude spawns through the one existing job queue (it already exists for atomize) so the GUI's own concurrency is bounded, visible in the jobs pill, and each run gets a log (see next item). You can then run as many separate Claude-powered apps as you like; each will just compete for subscription throughput.

### 3. Stuck on "working…" for 10+ minutes, can't tell if it's doing anything (same card)

**Root cause: the job is a black box by construction.**

- Subprocess output is **buffered in memory, never streamed**: `execFileP("claude", ...)` with a 40MB buffer (`serve.ts:796-801`), no `stdio: inherit`, so nothing reaches the terminal or the browser while it runs.
- The UI shows only a pulsing dot + "working…" (`serve.ts:1622`, `1629`). The 3s poll of `/api/jobs` returns status/label/error only, no progress and no log (`publicJob`, `serve.ts:735-740`).
- There IS a timeout: 15 minutes (`ATOMIZE_TIMEOUT_MS`, `serve.ts:696`). A legitimate ~10-minute `/atomize` run looks identical to a hung one.

**Fix (this is the single highest-leverage GUI change):**
1. **Persist every Claude job's output to a log file** (e.g. `~/.content-agents/logs/gui-jobs/<jobId>.log`), streaming stdout/stderr as it arrives (spawn with piped streams instead of `execFile`'s buffer).
2. Add to `/api/jobs`: elapsed time + the last stdout line as a heartbeat; render both in the job pill.
3. Add a "view log" link per job that serves the log file. "Is it doing anything?" becomes one click.

### 4. "atomize finished but created no new content folder" with an empty terminal (P0, card `c43a8041`)

**Root cause: "finished" means only "the subprocess exited 0", and the output that would tell you what actually happened is thrown away.**

- Success/failure is decided purely by exit code (`serve.ts:788-828`). `claude -p "/atomize ..."` exits 0 as long as the CLI ran, even if the skill bailed or refused, so a genuinely failed atomize reads as `done` plus the warning you saw (`serve.ts:813-816`).
- Folder detection is a before/after slug diff, and `listSlugs()` only counts folders containing `review-queue.md` (`serve.ts:745`, `791`, `802`). A folder scaffolded but abandoned before the queue-writing step is invisible, so "no new content folder" can be literally false.
- On success, stdout is captured and **never read, logged, or persisted** (`serve.ts:796` does not even destructure it). On failure, only 400 chars of stderr survive (`serve.ts:825`). The error text says "check the terminal running the GUI" but the terminal never received the output; the schedule lines you saw were from unrelated approve/publish actions.

**Fix:**
1. The job-log persistence from complaint 3 fixes the "empty terminal" half outright.
2. **Verify success by artifact, not exit code:** after the subprocess exits, check that a new folder with `review-queue.md` exists (and count its rows). Better still, have `/atomize` print a final machine-readable line (e.g. `ATOMIZE_RESULT: {"folder": ..., "rows": N}`) that the server parses; anything else is a failure.
3. When the artifact check fails, attach the last ~30 log lines to `job.error` so the row itself explains what happened.

### 5. What does the Refresh button do? (P1, card `3625b185`)

**Answer:** there is ONE global Refresh in the header (`serve.ts:1256`), not one per tab. It runs `load()` + `loadJobs()` (`serve.ts:1713`):

- `load()` hits `/api/queue`, which is a **full server-side re-scan**: it re-reads every `content/<slug>/review-queue.md` from disk and, when any row needs it, live-fetches Typefully + PostPeer to reconcile actual scheduled state (`listPieces`, `serve.ts:305-337`; `fetchLiveProviderState`, `235-238`). So it genuinely re-syncs the Review tab with disk and providers.
- `loadJobs()` re-fetches the in-memory job list.
- It does **NOT** refresh the Analytics tab: the strategy brief loads once per page load (`briefLoaded`, `serve.ts:1537-1539`) and the raw-exports list has its own separate refresh button (`serve.ts:1318`). It does not trigger any pipeline work (no ingest, no atomize, no publish).

**Fix:** make Refresh tab-aware (refresh whatever tab is active, including the brief), label it ("Re-read queues + provider schedules"), and show a "last refreshed HH:MM" stamp so its effect is visible.

### 6. Video script approved... then what? (P2, card `9e20a616`)

**Root cause: the video path dead-ends in the GUI, by design plus a missing wire.**

- You can't hit Approve on a video-script row because a guard (shipped for card `4bef9a7c`) deliberately blocks approving a `storyboard`-format row until `video/storyboard.md` exists on disk (`approveBlockReason`, `serve.ts:123-137`; enforced client-side `1392-1404` and server-side `920-926`). That guard is correct: approving a storyboard that doesn't exist was the phantom-approve bug.
- But the GUI has **no way to run `/video`** to produce the storyboard. The job queue only ever runs `/atomize` (`serve.ts:796`). So the intended flow (script looks good → run `/video` → storyboard row appears → approve → render) requires leaving the GUI for a terminal, and the only hint is the terse "run /video" in the block reason.

**Fix:** add a "Generate storyboard" button on video-script rows that enqueues `claude -p "/video <folder>"` through the same job queue (which, per complaint 3's fix, now has logs and progress). This turns the dead end into a two-stage flow inside the GUI: script review → storyboard generation → storyboard approval → render. The approve guard stays exactly as is.

### 7. Browser automation for image uploads (P0, card `ca75b2e0`)

**Recommendation: don't build it. A cheaper, safer path already exists in the repo and retires the third-party relays for everything except TikTok, where the relay is genuinely better.**

Why browser posting is the wrong trade, honestly:

- The analytics pull is the *easy* shape of browser automation: navigate, click one Export button, and the downloaded file is proof of success. Posting is the hard shape: composer, file-chooser upload, spinners, confirm dialogs, and **no artifact proving success**. All of that would be net-new per platform (`src/pull/registry.ts:9-13` covers only linkedin/x/substack; no Bluesky or TikTok profile exists).
- X and Substack actively fingerprint automation; the pull code needs real Chrome plus anti-automation flags just to *log in* (`src/pull/browser.ts:8-13`). Posting is a higher-signal action than reading, so the ToS/ban exposure is materially worse.
- Browser posting is inherently **instant**, which breaks the "scheduled draft, never instant" safety posture (CLAUDE.md rules 2/3), unless we also automate each platform's native scheduler UI (even more fragile).

The better path, mostly already built:

- **Typefully already supports image attachments.** Verified two ways (2026-07-07): (a) Typefully's official v2 API migration guide lists "Upload images" alongside videos/GIFs in the feature matrix, with the exact presigned-S3 flow `uploadMedia` implements (`POST /v2/social-sets/{id}/media/upload` → PUT → attach `media_ids`); (b) the repo's own `uploadMedia` (`src/publish/typefully.ts:61-75`) + `media:` frontmatter attach (`typefully.ts:304-313`) has worked for real once, for the animated quote card mp4 (`qvid-x → typefully draft 9638763`, 2026-06-24, innovation-nation publish-log.md). Honest caveat: **no PNG has gone through this path from this repo yet**, so the first step is one supervised test card (upload a `quote-card-N.png`, confirm it renders on X/LinkedIn/Bluesky drafts) before rewiring `cards.ts`. Typefully covers exactly x/linkedin/bluesky, so cards then ship as **native image posts through the existing paid, scheduled, reviewed Typefully path**, retiring PostPeer AND Upload-Post for cards on all three text platforms. This is a wiring change in `cards.ts`, not new infrastructure.
- **Bluesky needs no relay at all** if you ever want one fewer vendor: `@atproto/api` is already a dependency (`src/ingest/fetch-bluesky.ts`), and posting an image is login → `uploadBlob` → `post({embed})`.
- **TikTok: keep PostPeer.** It holds audited TikTok Content Posting API access (`src/publish/tiktok.ts:11-13`); a browser poster there is a strict downgrade (fragile, ToS-exposed, still can't set the AI-content label).

If browser posting is ever justified, it is for a no-API channel like Substack Notes (card `8026f53c`, already deferred), under rule-3 manual approval, not as a relay replacement.

---

## Part 2: General codebase improvements

Overall verdict first: **healthier than its size suggests.** There is a real shared-utility layer (`src/util/`), disciplined additive DB migrations (`src/db/db.ts:10-38`), a clean provider registry, centralized publish-log parsing, and good test coverage on the parsing-heavy modules. The risks are concentrated, and they are drift-and-silent-degradation risks, not crashes.

### Reliability (highest priority)

**R1. `/publish` can double-post after a partial failure.** The publish flow's only idempotency guard is flipping the review-queue row to `published` (`setStatus`, `src/publish/queue.ts:54`), which happens *after* provider calls. The worst case is the ordinary CTA card fan-out: `cards.ts:278-285` posts a `withLink` group (Bluesky/LinkedIn) and a `noLink` group (X); if group 2 fails on a transient error, group 1 is already live at the provider, the row stays `approve`, and the next `/publish` re-posts both groups. Crash between a successful POST and `setStatus` has the same effect on any channel. No provider call sends an idempotency key.
*Fix direction:* consult `publish-log.md` before posting (the parser and `findLoggedRef` already exist in `src/review/reconcile.ts`); write a per-group placement marker immediately after each successful provider call, and skip already-logged groups on re-run.

**R2. No retry/backoff on any provider call.** All 28 fetch sites check `res.ok` and throw good messages, but a single 429/5xx/network blip aborts the row (the only retry in the pipeline is Typefully media transcoding, `typefully.ts:324-338`). Transient blips are what convert into R1's partial states.
*Fix direction:* one small shared `fetchWithRetry` (exponential backoff on 429/5xx/network) wrapped around the publish and provider adapters.

**R3. Orphaned future slot claims silently push the schedule.** Slots are claimed in the ledger *before* posting (`slots.ts:132-197`); a mid-run abort leaves future claims with no post behind them. `pruneLedger` only drops past days, and `queue -- --sync` won't touch future orphans (`queue-view.ts:296-298`), so every failed run permanently shifts subsequent posts later. `queue-view` already *detects* this as `claimedNotLive` drift; nothing cleans it.
*Fix direction:* extend `--sync` to release future `claimedNotLive` claims (with a printed diff), and/or release a claim in a `finally` when its post never happened.

**R4. Config loaders swallow YAML errors and degrade silently.** `zod` is a dependency but used nowhere. Configs load as `parse(readFileSync(...)) as T` inside bare `catch {}` blocks that return defaults, so one YAML typo silently disables behavior: `typefully.ts:77-89` (all `max_chars` → Infinity, over-length posts ship), `cta.ts:19-33` (CTAs vanish), `slots.ts:25-42` (cadence falls back to next-free-slot), `reuse-guard.ts:26-40` (reuse limits off).
*Fix direction:* per-config zod schema validated once at load; treat `ENOENT` as "use defaults", anything else as a loud throw naming the file and the reason.

**R5. Zero tests on the highest-stakes logic.** `slots.ts` (decides the send time of every post: DST math, weekly caps, daily uniqueness) has no test. Also untested: `cta.ts`, `youtube.ts`, `tiktok.ts`, both image-post adapters, `all.ts`, and the entire serve.ts job queue + HTTP layer (its tests cover only extracted pure functions).
*Fix direction:* table-driven tests for `claimSlots` (cap enforcement, no double-booking, DST boundary) and `cta.ts` first; both are pure logic, nothing to mock.

**R6. GUI job state is in-memory only.** `jobs`, `jobSeq`, `draining` (`serve.ts:714-716`): a server restart orphans a running job and erases all history; the array also grows unbounded.
*Fix direction:* persist jobs to a small JSONL alongside the log files from Part 1 fix 3; mark orphans `interrupted` on startup.

### Maintainability

**M1. `serve.ts` is a 1,720-line monolith.** One file holds the HTTP server (flat if-ladder of ~15 routes, `serve.ts:889-1086`), a ~620-line inlined HTML/CSS/JS template (`1099-1720`, including a hand-rolled markdown renderer whose regexes need double-escaping inside the template literal), fs mutation, and Claude subprocess orchestration. Everything behind complaints 1-4 is untestable because it is tangled with I/O.
*Fix direction:* mechanical split, no behavior change: `page.ts` (client), `jobs.ts` (queue + claude runner), `rows.ts` (fs read/write), `serve.ts` (routes only). Do this BEFORE building the Part 1 features on top.

**M2. review-queue.md is parsed by hard-coded column index in 3 independent places.** The 10-column table is the approval database, decoded by `cells[N]` offsets in `src/publish/queue.ts:29-52` (canonical), `src/review/serve.ts:339-361` (`updateRow` reimplements the write path), and `src/video/render.ts:198-211` (a third parser). The 2026-07-04 origin-column addition already required hand-hunting these.
*Fix direction:* one typed review-queue module (grow `queue.ts`) exposing `readRows`/`writeCell`; route serve and render through it.

**M3. `config/platforms.yaml` is independently read and cast in 6 files** (`thread-check.ts:21`, `validate.ts:126`, `spin.ts:15`, `typefully.ts:79`, `reuse-guard.ts:28`, `slots.ts:27`), each with its own partial `as {...}` shape that can drift.
*Fix direction:* one memoized `loadPlatforms()` returning the R4-validated object; same pattern for the other config files.

**M4. Second frontmatter parser.** `serve.ts:85-95` (`splitRaw`) forks `src/util/frontmatter.ts` to keep the raw header for byte-preserving edits.
*Fix direction:* extend `splitFrontmatter` with an option to return the raw header; delete the fork.

### Performance (minor, worth noting)

**P1. `/api/queue` re-reads and re-parses every content folder synchronously on every request** (`listPieces`, `serve.ts:305-336`), sometimes plus a live Typefully/PostPeer fetch. Fine at ~33 folders, degrades linearly forever since content folders only accumulate.
*Fix direction:* cache parsed rows keyed by file mtime; run provider reconciliation on a background interval with a staleness stamp instead of inline on request.

**P2. Ledger writes are non-atomic.** `pruneLedger` rewrites `publish-schedule.jsonl` with a single `writeFileSync` (`slots.ts:110-119`); a crash mid-write truncates the ledger. Two overlapping publishers (CLI run + GUI approve-click) could also both read-then-append (lost update).
*Fix direction:* write-temp-then-rename for the rewrite; document the single-writer assumption or add a simple lockfile.

### What is healthy (do not churn)

- `src/util/` (frontmatter, slug, a real RFC-4180 CSV parser, cost-log, env), used consistently.
- `src/db/db.ts` additive migrations with backfill + WAL, deliberately reasoned in comments.
- `src/providers/registry.ts` capability→adapter indirection; clean, descriptive errors.
- publish-log.md parsing centralized (one parser in `reconcile.ts`, one writer in `queue.ts`).
- 20 test files targeting exactly the parsing/logic-dense modules; provider error messages that name the fix.
- The scheduling *design* (shared ledger, PT-day uniqueness, cadence caps) is sound; the gaps above are in failure handling around it, not the model.

---

## Part 3: Suggested fix order

Sequenced so each phase pays for the next; phases 1-2 directly close the complaint cards.

| Phase | What | Closes / enables |
|---|---|---|
| 1. Job observability | Persist + stream Claude job logs, heartbeat + elapsed in the jobs pill, artifact-based success check, durable inline errors instead of 1.4s toasts | Cards `c43a8041` and the stuck-working + invisible-error halves of `9304e4a5` |
| 2. GUI actions | "Generate storyboard" button (wires `/video` into the job queue); "Duplicate to platform" per-row action; all Claude spawns through the one queue; tab-aware Refresh with a label + timestamp | Cards `9e20a616`, `3625b185`, rest of `9304e4a5` |
| 3. Publish integrity | publish-log-consulting idempotency + per-group markers (R1), `fetchWithRetry` (R2), future-orphan claim cleanup in `--sync` (R3) | The double-post and schedule-drift risks before volume goes up (card `ffa6491d` raises caps; fix this first) |
| 4. Cards via Typefully | Attach card PNGs as `media:` on Typefully drafts; retire PostPeer/Upload-Post for cards; keep PostPeer for TikTok only | Card `ca75b2e0`, without browser automation |
| 5. Structure + guardrails | zod-validate configs, loud on parse errors (R4); unify review-queue parsing (M2) + platform config loader (M3); split serve.ts (M1); tests for `claimSlots` + `cta.ts` (R5) | Makes everything above safe to keep building on |

Phases 1, 2 and 4 are each small enough to be one backlog card; phase 3 is two cards (idempotency; retry+cleanup); phase 5 is best as three (configs, review-queue module, serve split).
