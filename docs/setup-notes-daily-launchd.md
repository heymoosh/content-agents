# Setup: Daily Substack Notes auto-fetch

A macOS `launchd` job that runs `npm run notes-daily` every day at **07:00 local time**. It fetches
your recent Substack Notes, checks them against `data/notes-spread-ledger.jsonl`, and marks any new
ones as seen. **It drafts nothing and never publishes** — run "Pull Substack Notes" in the review
GUI (`npm run review`) to actually draft the good ones with real per-platform Spin.

## Why this is local, not a GitHub Actions cloud job

A cloud version was tried first (`.github/workflows/notes-daily.yml`) and abandoned: Substack's WAF
returns a flat `403` to every request from GitHub Actions' runner IPs, even with a realistic browser
User-Agent (confirmed on two live runs — see PRs #75-78). This isn't a header-sniffing block, it's an
IP-reputation block, so no request-shaping fix works from a cloud runner. The fetch only succeeds
from a real residential/ISP IP — i.e., your own Mac. Same underlying reason the weekly analytics pull
(`docs/setup-weekly-pull.md`) is local too.

Estimated setup: ~1 minute.

---

## Enable it

```bash
# 1. Make the log directory (launchd writes the run log here, doesn't create the dir)
mkdir -p ~/.content-agents/logs

# 2. Install the LaunchAgent (paths are already baked into the plist for this machine)
cp config/launchd/com.content-agents.notes-daily.plist ~/Library/LaunchAgents/

# 3. Load it
launchctl load ~/Library/LaunchAgents/com.content-agents.notes-daily.plist
```

Verify it registered:

```bash
launchctl list | grep content-agents      # shows the job
```

---

## Operate it

| Task | Command |
|---|---|
| Run once now (test) | `launchctl start com.content-agents.notes-daily` |
| Watch the log | `tail -f ~/.content-agents/logs/notes-daily.log` |
| Change the time | edit `StartCalendarInterval` in `~/Library/LaunchAgents/com.content-agents.notes-daily.plist`, then `launchctl unload` + `launchctl load` it |
| Disable | `launchctl unload ~/Library/LaunchAgents/com.content-agents.notes-daily.plist` |

`Hour` is 24h local time.

The Mac needs to be **on and awake** (or wake-on-schedule) at that time for the job to fire — if it
sleeps through 07:00, `launchd` runs it at the next wake, it doesn't queue for the exact minute.
