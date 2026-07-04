# Setup: Weekly analytics auto-pull

A macOS `launchd` job that runs `npm run pull:weekly` every **Sunday at 07:00 local time**, so your
analytics DB is fresh before your Sunday `/strategy`. It pulls LinkedIn + X + Substack (saved-session
browser, no stored passwords) and Bluesky (API), then ingests — the exact commands you'd run by hand.

**Nothing publishes.** This only refreshes the analytics DB.

Why a local job and not a claude.ai cloud routine: the pull drives real Chrome with your saved login,
which lives on *this Mac* (`~/.content-agents/browser-profiles/`). A cloud clone has no session and
would just hit a login wall — so the recurring pull has to run locally.

Estimated setup: ~2 minutes.

---

## Why weekly re-pulling is safe (and the point)

- **Posts** upsert on `(platform, platform_post_id)` — re-pulling a post updates it in place, never
  duplicates it.
- **Metrics** are an append-only time series: each pull inserts a *fresh* snapshot stamped
  `captured_at`. A post that gains traction later gets re-measured; the old snapshot is kept.
- `/strategy` (`snapshot.ts`, `resonance.ts`) reads `MAX(captured_at)` per post — the **latest**
  snapshot, never a sum — and recency-weights by `posted_at`. So weekly pulls keep stats current
  without double-counting or making old posts look artificially fresh.

Run it by hand any time to confirm: `npm run pull:weekly`.

---

## Enable it

```bash
# 1. Make the log directory (launchd writes the run log here, doesn't create the dir)
mkdir -p ~/.content-agents/logs

# 2. Install the LaunchAgent (paths are already baked into the plist for this machine)
cp config/launchd/com.content-agents.weekly-pull.plist ~/Library/LaunchAgents/

# 3. Load it
launchctl load ~/Library/LaunchAgents/com.content-agents.weekly-pull.plist
```

Verify it registered:

```bash
launchctl list | grep content-agents      # shows the job
```

---

## Operate it

| Task | Command |
|---|---|
| Run once now (test) | `launchctl start com.content-agents.weekly-pull` |
| Watch the log | `tail -f ~/.content-agents/logs/weekly-pull.log` |
| Change day/time | edit `StartCalendarInterval` in `~/Library/LaunchAgents/com.content-agents.weekly-pull.plist`, then `launchctl unload` + `launchctl load` it |
| Disable | `launchctl unload ~/Library/LaunchAgents/com.content-agents.weekly-pull.plist` |

`Weekday`: 0 = Sunday … 6 = Saturday. `Hour` is 24h local time.

---

## When a session lapses

Saved logins eventually expire. When that happens the run logs a loud
`the saved session lapsed` line naming the platform, and the job exits non-zero (so the log shows a
failure). Fix it with a one-time headed login, then the weekly job resumes on its own:

```bash
npm run pull:login -- linkedin      # or x / substack
```

Diagnostics bundles (screenshot + HTML) for any failure land in `~/.content-agents/pull-diagnostics/`.
