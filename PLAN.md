# PLAN — mission-driven test posts, out the door and measured

Status: frozen 2026-09-15 by the owner. Run ID MP-1 builds this document. This file is `PLAN.md`
at the repo root. It implements rows V4, L6, X6 and G17 of
`docs/content-studio-master-status.md`, whose "Owner decisions, 2026-09-15 (planning session)"
block is the authority if anything here reads differently.

This is the whole request for this run. The repo already holds the Content Studio app
(`npm run review`, port 4600 for the owner's personal instance), the Venture, Content and Signals
rooms, the analytics database and the publishing pipeline. Read `CLAUDE.md`, `AGENTS.md` and
`venture/AGENTS.md` before touching anything; their content, review and identity rules are not
relaxed by this plan. Every numbered ID below is a requirement someone who did not build it can
check true or false. Write one evidence note per ID in `EVIDENCE.md`.

## What it is

Muxin has an outcome model for her Human Inference brand: three obstacles her audience feels
(overwhelm, resignation, outrage), each with a handful of "missions" a single social post can
carry out (a start-here kit, a myth-bust, proof it has worked before, and so on). She wants to
learn which missions move people down the funnel. Today nothing in the system knows what a
mission is, so nothing can be learned per mission.

After this run: in the Venture room she pastes or points at her notes, presses one button, and
the system writes one post per mission for the missions that have been tested least, straight
into ordinary Content folders. She reviews and approves them exactly as she does every other
post. The mission id rides along invisibly: content request, derivative frontmatter, the Placed
log, and finally the analytics `posts` row. Signals shows one plain table: per mission, how many
posts went out, and how far they took people down the funnel. Posts she wrote outside Studio can
be assigned to a mission by editing one small file. Data is pulled in one batch a day at most.

Also in this run, because the owner does not want simple work burning expensive tokens: writing
jobs run on a mid-tier model and analysis jobs run on the strongest model, set once in a config
file and passed on every model spawn, with each job showing what it actually used.

Not in this run: recording missions inside Venture's decision or artifact ledgers, the Signals
redesign, image generation, the replies room, any change to how posts publish, any change to
Phase 1 to 4 of Venture, learned model preferences, storing platform post ids at publish time.

## Fixed choices (do not relitigate)

- Stack as it is: TypeScript on Node 22, `tsx`, the existing `src/review` server and pages, the
  existing SQLite `data/analytics.db` opened through `src/db/db.ts`. No new framework, no new
  dependency without an entry in `ESCALATIONS.md`.
- Tests: `node --import tsx --test <files>` while building. Gate: `npm run check` (typecheck plus
  the whole unit suite), run once at the end, unsandboxed (the sandbox produces phantom failures;
  see `docs/content-studio-master-status.md` and memory notes). Exit 0 or the work is not done.
- Layout: mission list in `config/missions.yaml`; model tiers in `config/models.yaml`; hand
  assignments in `data/mission-overrides.jsonl`; new code under `src/venture/missions/`,
  `src/review/` (routes and pages), `src/db/` (migration and stamping). Tests next to the code.
- Model calls go through the existing engine spawn (`src/review/engines.ts`) and provider
  adapters (`src/providers/`). Mission post writing uses the writing tier. No paid API route.
- The app under test runs on `REVIEW_PORT=4610`. Never 4600, which is the owner's live instance.
- The six existing series folders `content/venture-human-inference-1441a449abba-{1..6}` and
  `venture/human-inference/` must be present in the worktree at the base commit. If they are
  not, stop and record it in `ESCALATIONS.md`; do not recreate them.
- Mission ids are the strings in `docs/content-studio-master-status.md` ("Human Inference outcome
  model"): `O1-M1`, `O1-M2`, `O1-M3`, `O2-M1` to `O2-M6`, `O3-M1` to `O3-M6`. `O2-M7` is excluded
  (the owner marked it a tool, not a post mission).
- Nothing in this run publishes, schedules, sends, spends money or touches a live account. Draft
  writing is a model call on the owner's subscription CLIs and is the only model spending.
- Cross-family audit (run `codex exec` or `grok -p` over the diff, record the verdict in
  `EVIDENCE.md`) is required for exactly two changes because they are shared contracts: the
  `posts.mission_id` migration and the new `missionId` field on the content request. Nothing
  else needs one.

## Piece 1 — the mission list and the model tiers (config)

- **M1.** `config/missions.yaml` lists the three obstacles and their missions from the master
  status doc, verbatim in meaning: each mission has `id`, `obstacle` (`O1`, `O2`, `O3`), `name`
  (the bolded title), `brief` (the sentence or two after it), and each obstacle has `id`, `name`,
  `milestone` (its opposite). `O2-M7` is absent. A test loads the file and asserts 15 missions.
- **M2.** One function `loadMissions()` in `src/venture/missions/missions.ts` returns the typed
  list; every reader of missions uses it. An unknown mission id anywhere fails loudly with the id
  in the message.
- **M3.** `config/models.yaml` defines two tiers, `writing` and `analysis`, each with an entry
  per engine (`claude`, `codex`, `grok`) giving `model` and optional `effort`, and a `jobs` map
  from job kind to tier. Shipped values: writing = claude `sonnet`, codex `gpt-5.6-luna` effort
  `medium`, grok `grok-4.6` effort `medium`; analysis = claude `fable` with `fallback: opus`,
  codex `gpt-6-astra` effort `xhigh` with `fallback: gpt-5.6-luna`, grok `grok-4.6` effort `high`.
- **M4.** The `jobs` map covers at least: `content-draft`, `content-treatment`, `mission-post`,
  `charles-draft`, `fiction-draft`, `outreach-message`, `text-polish` as `writing`; and
  `signals-brief`, `signals-insights`, `venture-intake-analysis`, `develop-advisor`,
  `capture-routing`, `fiction-continuity`, `outreach-research` as `analysis`. A job kind missing
  from the map resolves to `writing` and logs a one-line warning naming the kind.
- **M5.** `resolveModel(engine, jobKind)` in `src/review/model-tiers.ts` returns
  `{ model, effort, tier }` from the file; a test covers every engine for both tiers and the
  missing-kind default.

## Piece 2 — write mission posts

- **W1.** A `POST /api/venture/missions/write` route accepts `{ slug, context, contextPath,
  count, missionIds, engine }`. Exactly one of `context` (pasted text) or `contextPath` (a file
  path under the owner's home directory, read as UTF-8, Markdown or plain text) is required.
  `count` defaults to 10 and is capped at 15. `missionIds` is optional; when absent the system
  picks.
- **W2.** Mission picking, in `src/venture/missions/pick.ts`, is a pure function: given the
  missions and a count per mission id already written (W7), return `count` mission ids, taking
  the least-written first, breaking ties by obstacle round-robin (O1, O2, O3, O1, ...) and then
  by list order, allowing a mission to appear twice only when every mission has been taken once.
  A test covers an empty history, a lopsided history, and `count` above 15 missions.
- **W3.** For each picked mission, one model call on the writing tier drafts one post from the
  context. The prompt contains: the mission `name`, `brief`, its obstacle and milestone; the full
  supplied context; `config/voice.yaml`; the Build 3 rules from `venture/rules.md` §3 (no invented
  proof, results, customers, numbers or experiences); the reference shape (hook, story, one CTA)
  described as a reference only. It asks for a title and body, and for `O2-M1` and `O2-M4` it
  requires every example be drawn from the supplied context, with the sentence it came from
  quoted back in a `sources` list. A test builds the prompt for a fixture mission and asserts
  those parts are present.
- **W4.** Each drafted post is written the way `queueExistingSeries`
  (`src/review/venture-actions.ts`) writes the six existing series posts: a new
  `content/venture-<slug>-<random>/` folder with `source.md`, `content-request.json`, an empty
  `review-queue.md`, and the folder's usual subdirectories, with `origin: "venture"`,
  `ventureId: <slug>`, and the new `missionId` field (T1). It appears in the Content room's
  review list like any other folder. Nothing is approved, scheduled or published by this route.
- **W5.** The route runs as a job in the existing job store so the Venture page shows progress,
  elapsed time, the engine and model used (D3), errors, and the list of folders created when
  done. One failed mission draft does not discard the others; the job result names which missions
  succeeded and which failed and why.
- **W6.** The Venture room has a "Write mission posts" control on the venture's page: a large
  text area for context, an optional path field, a count field defaulting to 10, and an
  "Advanced" disclosure listing the 15 missions as checkboxes for manual override. The engine
  comes from the page's existing engine picker. The button is disabled with an explanation when
  both context fields are empty.
- **W7.** `missionHistory(slug)` in `src/venture/missions/history.ts` counts, per mission id, the
  Content folders whose `content-request.json` has `ventureId === slug` and a `missionId`,
  split into drafted (folder exists), approved (any non-discard approved row in
  `review-queue.md`) and placed (a Placed-log row in `briefs/bets.md` carrying that folder and
  `mission:<id>`). This is what W2 picks from and what S1 shows.
- **W8.** The six existing series folders' `content-request.json` files gain `missionId` values
  `O1-M3`, `O1-M2`, `O2-M1`, `O2-M2`, `O3-M1`, `O3-M6` for folders 1 to 6 respectively, by a
  one-time script `npm run missions:backfill-series` that only adds the field when it is absent
  and changes nothing else in the file. Run it once and commit the result.
- **W9.** User outcome: on the owner's Mac, with the app on port 4610 and a real pasted context of
  at least 500 words, pressing the button with count 3 produces three folders in under ten
  minutes, each visible in the Content room with its draft text, each carrying a different
  mission id, and the Venture page shows the engine and model used. Record the folder names.

## Piece 3 — the mission id travels

- **T1.** `ContentRequestInput` and the on-disk `content-request.json` accept an optional
  `missionId: string`. Validation rejects an id not in `config/missions.yaml`. Existing files
  without the field load unchanged. (Shared contract: cross-family audit required.)
- **T2.** Derivative frontmatter written by `src/review/jobs.ts` includes `mission_id: <id>` on
  every derivative, including quote-card companions and thread controls, whenever the request has
  a `missionId`, placed next to `experiment_id`. A test generates derivatives from a fixture
  request with a mission and asserts the line on each.
- **T3.** `appendBetPlacement` (`src/publish/queue.ts`) adds `| mission:<id>` to the Placed-log
  row when the derivative's frontmatter has `mission_id`, in the same position pattern as
  `experiment:<id>`. A test asserts the row text.
- **T4.** The Placed-log parser used by `src/db/tag-source.ts` reads `mission:<id>` back. A test
  parses a fixture row with and without the marker.
- **T5.** The review card in the Content room shows the mission as a small label
  ("Mission O1-M2 · Myth-bust the complexity") when the request has one, and nothing when it does
  not.

## Piece 4 — attribution and the daily batch

- **A1.** `src/db/db.ts` migrates `posts` to add `mission_id TEXT` (nullable) and an index, using
  the file's existing add-column pattern; the migration is safe to run twice. (Shared contract:
  cross-family audit required.)
- **A2.** `tag-source.ts` stamps `posts.mission_id` from the Placed-log `mission:` marker using
  the same lead-text match it already uses for `source`, `cta_destination` and `cadence_source`.
  It never overwrites a non-null `mission_id` with a different value from the matcher; a conflict
  is logged with both ids and the post id.
- **A3.** `data/mission-overrides.jsonl` holds one JSON object per line: `{ platform, url }` or
  `{ platform, platform_post_id }`, plus `mission_id`, optional `note`. `npm run
  missions:apply-overrides` stamps matching `posts` rows, wins over A2 on conflict, and prints
  one line per override: applied, already set, or no matching post yet. A malformed line stops
  the run with its line number. The file starts as an empty file with a comment-free example in
  `docs/missions.md`.
- **A4.** `npm run pull:daily` runs, in order: the existing pull with ingest, the Bluesky fetch,
  `tag-source`, `missions:apply-overrides`. It is the existing `src/cron/weekly-pull.ts` extended,
  and `config/launchd/com.content-agents.pull-daily.plist` replaces the weekly plist with a daily
  07:30 local schedule. `docs/setup-weekly-pull.md` is updated to describe the daily job; the
  owner installs the plist by hand (record that as an owner action, do not install it).
- **A5.** The Signals page's Pull button refuses with a plain sentence when the newest
  `metrics.captured_at` or `imports.imported_at` is under 24 hours old, and offers a "Pull anyway"
  second click that passes `force: true`. Nothing pulls, ingests or regenerates a brief on page
  load. A test covers the refusal, the force path and the stale path with a fixture database.
- **A6.** Nothing in this piece makes a model call. Record in `EVIDENCE.md` the grep or trace
  that shows it.

## Piece 5 — model defaults enforced

- **D1.** `buildEngineSpawn` (`src/review/engines.ts`) passes the resolved model on every engine:
  claude `--model <model>`; codex `-m <model>` and `-c model_reasoning_effort="<effort>"`; grok
  `-m <model>` and `--reasoning-effort <effort>` when an effort is set. A test asserts the exact
  argument vectors for all three engines and both tiers.
- **D2.** Every production spawn names its job kind so M5 can resolve a tier: content drafting
  and treatments, the mission writer (W3), Charles, Fiction drafts and continuity, Signals brief
  and insights, Venture intake analysis (`intake-notes.ts`), develop advisor, capture routing,
  outreach research and drafting, and the `src/providers` `claude-cli`, `codex-cli` and
  `grok-cli` analyst and polish adapters. A grep recorded in `EVIDENCE.md` shows no remaining
  spawn of `claude -p`, `codex exec` or `grok -p` without a model argument.
- **D3.** Each job record stores `engine`, `model` and `effort` as passed, and the job row in
  every room that lists jobs shows them (for example "Codex · gpt-5.6-luna · medium").
- **D4.** When an engine rejects the analysis model (non-zero exit whose stderr names the
  model; claude `fable`, codex `gpt-6-astra`), the spawn retries once with the tier's `fallback`
  and the job record shows the fallback as the model used. A test simulates the rejection for
  claude and for codex.
- **D5.** The GUI's engine picker is unchanged in behavior (provider choice, remembered in the
  browser). No per-page selector, no per-button selector, no learned preference is added.

## Piece 6 — Signals per-mission table

- **S1.** The Signals page for the Human Inference brand shows a "Missions" table with one row
  per mission in `config/missions.yaml`, in file order, columns: mission (id and name), drafted,
  approved, placed (from W7), posts matched (count of `posts` rows with that `mission_id`), and
  the funnel numbers summed across matched posts from the latest `metrics` row per post:
  impressions, clicks, replies, new follows. Rows with zero matched posts show "no data yet"
  in the funnel columns, not zeros.
- **S2.** A "Not yet assigned" line under the table counts Human Inference `posts` rows from the
  last 90 days with `mission_id` null, and links to `docs/missions.md`, which explains the
  overrides file in under 20 lines.
- **S3.** The table is computed by one function in `src/review/signals-missions.ts` with a test
  against a fixture database and fixture folders; the page only renders its result. No model call.
- **S4.** The old series-progress block (`ventureSeriesSignalsHtml` / `readSeriesProgress`) is
  removed from the Signals and Venture pages, along with its tests. Its data file, if any, is
  left on disk untouched.
- **S5.** User outcome: after running W8 and `npm run missions:apply-overrides` with at least one
  override the owner supplies (or, if none is available on this machine, a fixture override
  against a real `posts` row chosen by URL from the local database), the Missions table on port
  4610 shows that mission with one matched post and real funnel numbers. Screenshot it.

## Piece 7 — the whole thing

- **G1.** `npm run check` exits 0 on the final commit, run unsandboxed and in full; do not pipe
  its output through anything that hides the exit code. Commit the log under `docs/evidence/`.
- **G2.** `docs/missions.md` explains, in under 60 lines and truthfully: what a mission is, how to
  write a round, where the id travels, how to assign an outside post, and how the daily pull
  runs.
- **G3.** `npm run review` still starts the app and every room still opens with no console
  errors on load (Studio, Content, Venture, Fiction, Charles, Outreach, Signals).
- **G4.** `EVIDENCE.md` has one entry per ID above, naming the test, file, or hand check that
  proves it. `ESCALATIONS.md` has every decision you had to make that this document did not, or
  the single line `No escalations.`
- **G5.** No file is written outside the worktree except `$TMPDIR`. No live account, scheduler,
  publisher or paid API is called. No post is approved, scheduled or published by any test or
  hand check.
- **G6.** Before the final commit, run `USE-IT-CHECKLIST.md` at the repo root in a real browser
  against the app on port 4610, and commit the filled-in copy as `docs/evidence/use-it.md` with
  one pass or fail per line and the screenshot or output each line asks for. A line that cannot
  be run on this machine is marked blocked with the reason, never pass.
- **G7.** The two cross-family audits (T1, A1) are recorded in `EVIDENCE.md` with the command,
  the model, and the verdict, and every finding was either fixed or answered in
  `ESCALATIONS.md`.
