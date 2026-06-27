# Setup: Daily Notes Cloud Routine

A Claude Code cloud routine that runs every morning, pulls your recent Substack Notes, picks the
best new ones, and saves them as **UNSCHEDULED Typefully drafts** across your text channels
(x, bluesky). The drafts sit in Typefully with no publish time. **Nothing auto-posts.** You review
and manually schedule/publish the good ones; the rest you ignore or delete.

Estimated setup time: ~5 minutes.

---

## How it works

1. The routine clones the repo fresh, loads `data/notes-spread-ledger.jsonl` to know which notes
   were already spread, fetches your latest Substack Notes, picks the top new ones by engagement
   score, and saves each as an **unscheduled** Typefully draft (via
   `publish:typefully --no-schedule`, which omits the publish time so the draft never auto-fires),
   then commits and pushes the updated ledger.
2. On the next run, the ledger tells it to skip those notes — so the same note is never spread
   twice. This is the cloud-safe dedup mechanism (analytics.db is gitignored and not available
   in the cloud clone).
3. Analytics ingestion (`npm run ingest`, bluesky, etc.) stays in your **weekly local
   `/cycle`/`/strategy` run** — it is NOT part of this daily job.

---

## Step 1 — Connect the repo

In your [claude.ai](https://claude.ai/code) account:

1. Go to **Settings → Integrations → GitHub** and authorize the content-agents repo if you have
   not already done so.
2. When creating the routine (Step 3), it will clone from the **default branch** (main).

---

## Step 2 — Add secrets to the cloud environment

In **Settings → Routines → Environment Variables** (or the equivalent in the cloud routine
configuration UI), add each of the following. These are the minimum required for `notes-daily`:

| Variable | Purpose |
|---|---|
| `SUBSTACK_HANDLE` | Your Substack @handle (e.g. `humaninference`). Used to fetch your Notes via the public profile feed. No auth token needed — read-only public endpoint. |
| `TYPEFULLY_API_KEY` | Your Typefully API key (generate at typefully.com/settings/api). Used to create unscheduled drafts. Requires a paid Typefully plan. |
| `TYPEFULLY_SOCIAL_SET_ID` | (Optional) Your Typefully social set ID. If omitted, the first social set is used automatically. Set this if you have multiple social sets to be explicit. |

You do NOT need `BLUESKY_APP_PASSWORD`, `POSTPEER_API_KEY`, `YOUTUBE_*`, or other keys for this
job — those are only used for analytics ingest and video/card publishing (weekly local runs).

---

## Step 3 — Create the daily routine

In claude.ai → Routines → New Routine, use this exact prompt:

```
Run the daily Substack Notes spread for content-agents.

Steps:
1. cd to the repo root (it is already cloned)
2. npm install (restore node_modules for the cloud environment)
3. npm run notes-daily
4. If any new notes were spread, commit and push the ledger:
   git add data/notes-spread-ledger.jsonl content/
   git commit -m "notes-daily: spread notes $(date -u +%Y-%m-%d)"
   git push

If notes-daily exits with a non-zero code, print the error and stop (do not commit).
In all cases, print a summary of what was spread.
```

**Schedule**: Daily at **14:00 UTC** (7:00 AM PT). The drafts are UNSCHEDULED, so this time does
NOT control when anything posts — it only controls when the drafts appear in your Typefully queue
for review. 7 AM PT lands them in front of you with your morning coffee, in time to schedule
anything good for that day's posting windows. Pick any time that fits your review rhythm; nothing
auto-fires regardless.

---

## Step 4 — Test it safely first

Before enabling the live schedule, run a dry-run locally:

```bash
npm run notes-daily -- --dry-run
```

This uses fixture notes (no Substack fetch, no Typefully calls) and prints exactly what the
routine WOULD do: which notes would be selected, what their character counts are per platform, and
what content folders it would create.

To test the live fetch path without creating Typefully drafts, you can temporarily add a
`process.exit(0)` before the `spawnSync` call in `src/cron/notes-daily.ts`, run it, then revert.
Or just check the dry-run output — the real path is the same logic.

---

## What Muxin does after each run

1. Open **Typefully** — the new **unscheduled** drafts appear in your Drafts list (NOT in the
   scheduled queue). They have no publish time and will never post on their own.
2. Review each draft. For the ones you want to ship, set a time / add to your queue / hit publish
   in Typefully yourself. Typefully's own cadence slots are right there when you schedule.
3. Ignore or delete the drafts you do not want. They never fire, so doing nothing is safe — an
   un-actioned draft just sits in your Drafts list. The content folder stays in the repo as a
   record either way.

**Nothing publishes automatically.** The only way a notes draft goes live is you scheduling or
publishing it by hand in Typefully. This is the review gate.

You do NOT need to touch `review-queue.md` — the routine pre-approves the rows (the note text is
verbatim / extraction-first, so no AI judgment gate is needed before Typefully sees it). The
Typefully Drafts list IS the review step for this flow.

---

## Ledger file

`data/notes-spread-ledger.jsonl` — one JSON line per spread note, appended after each run. Example:

```json
{"noteId":"c-279240534","url":"https://substack.com/@humaninference/note/c-279240534","spreadAt":"2026-06-26T06:31:00.000Z","platforms":["x","bluesky"],"contentFolder":"content/2026-06-26-ai-is-not-going-to-replace-workers"}
```

The routine commits this file back after each run so the next fresh-clone run remembers what was
already spread. Never delete entries — the ledger is append-only.

---

## Platforms targeted

By default: **x** and **bluesky** (the natural short-form platforms for Notes).

LinkedIn is intentionally excluded from the default: casual Notes often mismatch the professional
register LinkedIn rewards. To include it, add `"linkedin"` to `SPREAD_PLATFORMS` in
`src/cron/notes-daily.ts`.

---

## Adjusting the selection

- **How many notes per run**: `MAX_PER_RUN = 3` in `notes-daily.ts`. Lower it to 1 for a quieter
  queue; raise it if you publish many Notes per day.
- **How far back to fetch**: default `--limit 20`. Pass `--limit 40` in the routine prompt if you
  need to catch up after a gap.
- **Selection logic**: notes are sorted by engagement score (`likes + replies×3 + reposts×2`),
  same formula as `new-notes.ts`, and the top N are picked. All new (not-in-ledger) notes are
  candidates regardless of engagement floor.

---

## Analytics note

The `notes-daily` routine does NOT ingest note engagement into `analytics.db`. That happens in
your weekly local `/cycle`/`/strategy` run via `npm run new-notes` (which calls `ingestNotes()`).
The cloud routine is text-distribution only: fetch → spread → ledger → done.
