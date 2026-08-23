# Setup: Weekly pattern mining auto-collect

A macOS `launchd` job that runs the weekly pattern-mining pass every **Monday at 08:00 local time**.
It pulls fresh public posts from the accounts already listed in `config/pattern-mining.yaml` on X,
LinkedIn, and Substack, appends the new ones to the local corpus, then runs a search-based
discovery pass that **proposes** new accounts worth watching.

**Nothing publishes, and nothing is added to your config.** The job only fills
`data/patterns/corpus.jsonl` and writes account proposals you approve by hand.

**Shipping the job does not schedule it.** The plist is committed to the repo, but committing a
file installs nothing. Nothing runs until you copy it into `~/Library/LaunchAgents/` and load it,
both of which are your steps below.

Why a local job and not a cloud routine: collection drives real Chrome with your saved login, which
lives on *this Mac* (`~/.content-agents/browser-profiles/`). A cloud clone has no session and would
hit a login wall. Same reason `docs/setup-weekly-pull.md` and `docs/setup-notes-daily-launchd.md`
are local.

Estimated setup: ~2 minutes.

---

## What it actually runs

Four steps, each in its own process so one blocked platform never stops the rest:

```
npm run patterns:weekly
  1. npm run patterns:auto -- --platform x
  2. npm run patterns:auto -- --platform linkedin
  3. npm run patterns:auto -- --platform substack
  4. npm run patterns:discover
```

Text platforms only. TikTok, YouTube, and Instagram collection is not built, so video entries still
get staged by hand with a pasted transcript (`/patterns collect`, the manual fallback path).

**The four steps run one after another, and they have to.** Chrome takes an exclusive lock on a
profile directory, and there is one profile per platform under `~/.content-agents/browser-profiles/`.
If collection and discovery ever touched the same platform at the same moment, the second one would
die on that lock with an error that explains nothing. Each step is a separate child process that the
job waits out, and discovery, which walks all three platforms itself, runs last. This is a design
constraint, not an optimization that got missed.

Try it first without touching the network:

```bash
npm run patterns:weekly -- --dry-run
```

A dry run walks all four steps, fetches nothing, and writes nothing.

**A real run needs the sandbox off.** Chrome creates its profile lock file (`SingletonLock`) under
`~/.content-agents/`, and a sandboxed shell refuses that write with "Operation not permitted". The
dry run is unaffected, because it never launches a browser. This is an environment constraint, not
a code one, and launchd runs are not sandboxed, so it only bites when you run the job by hand from
a sandboxed session.

---

## Why running it every week is safe

- **The corpus dedupes by url** (`appendEntries` in `src/patterns/corpus.ts`). A post already
  collected is skipped, so a second run over the same week appends nothing and re-collecting is a
  no-op rather than a duplicate.
- **Discovery never edits your config.** Proposals land in
  `data/patterns/account-proposals.jsonl`. Adding an account to `config/pattern-mining.yaml` only
  ever happens when you run the approve command yourself.
- **A blocked platform is recorded, not retried around.** If a platform rate limits or blocks the
  session, that platform stops for the run, the failure is named in the report, and the other
  platforms carry on. Nothing tries to defeat a block.

Each run appends one line to `data/patterns/weekly-runs.jsonl`: what ran, what failed, and how much
the corpus grew. That file is gitignored along with the rest of `data/patterns/`, because what it
summarizes is other people's posts.

---

## Enable it

```bash
# 1. Make the log directory (launchd writes the run log here, doesn't create the dir)
mkdir -p ~/.content-agents/logs

# 2. Install the LaunchAgent (paths are already baked into the plist for this machine)
cp config/launchd/com.content-agents.patterns-weekly.plist ~/Library/LaunchAgents/

# 3. Load it
launchctl load ~/Library/LaunchAgents/com.content-agents.patterns-weekly.plist
```

`bash -lc` inside the plist loads your profile so node and npm are on PATH under launchd's minimal
environment, the same trick the other two jobs use.

Verify it registered:

```bash
launchctl list | grep content-agents      # shows the job
```

---

## Operate it

| Task | Command |
|---|---|
| Run once now (test) | `launchctl start com.content-agents.patterns-weekly` |
| Run by hand, no schedule needed | `npm run patterns:weekly` |
| See what it would do, no network | `npm run patterns:weekly -- --dry-run` |
| Watch the log | `tail -f ~/.content-agents/logs/patterns-weekly.log` |
| Change day/time | edit `StartCalendarInterval` in `~/Library/LaunchAgents/com.content-agents.patterns-weekly.plist`, then `launchctl unload` + `launchctl load` it |
| Disable | `launchctl unload ~/Library/LaunchAgents/com.content-agents.patterns-weekly.plist` |

`Weekday`: 0 = Sunday … 6 = Saturday. `Hour` is 24h local time. Monday morning is the default so a
fresh corpus is waiting when you next run `/patterns analyze`.

The Mac needs to be **on and awake** (or wake-on-schedule) at that time for the job to fire. If it
sleeps through 08:00, `launchd` runs it at the next wake rather than queueing for the exact minute.

---

## Reading the proposals

The discovery step never touches `config/pattern-mining.yaml`. To see what it found:

```bash
npm run patterns:discover -- --list
```

Each proposal names the handle, the platform, a guessed niche, why it was proposed, and the real
post that justified it. The raw file is `data/patterns/account-proposals.jsonl` if you would rather
read it directly.

Discovery finds them by search: the `discovery:` block in `config/pattern-mining.yaml` holds search
terms per niche, run against each platform's own public search. Those terms are yours to edit, and
they are the main lever on what turns up. A run that proposes nothing usually means the terms need
work, not that there is nothing out there.

```bash
npm run patterns:discover -- --approve <handle>              # adds it to the config
npm run patterns:discover -- --reject <handle> --reason "off niche"   # stops it coming back
```

Approve is the only path that writes an account into the config, and it records the proposal's
evidence url and the approval date as a comment next to the new entry. Reject only marks the
proposal, so next week's run does not surface it again. If the same handle was proposed on two
platforms, both commands ask you to add `--platform <name>`. Anything you neither approve nor
reject just sits in the proposals file.

---

## When a session lapses

Saved logins expire. When that happens the platform's step fails and the run report names it. Fix
it with a one-time headed login, then the weekly job resumes on its own:

```bash
npm run pull:login -- linkedin      # or x / substack
```

The job exits non-zero when any step failed, so the log shows the failure rather than a quiet
half-run.

---

## What this does not collect

- **Video.** TikTok, YouTube, and Instagram are not automated. A video entry still needs a pasted
  or captions-copied transcript staged by hand.
- **Bluesky, Mastodon, Threads.** Collectable platforms in the corpus schema, but no automated
  collector was built for them. Manual staging still works.
- **Anything behind a login wall, a paywall, or a DM.** Public pages only.
