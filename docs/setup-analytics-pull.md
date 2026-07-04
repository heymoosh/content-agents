# Automated analytics pull (constrained browser agent)

Kills the manual "download the export, drop it in `data/inbox/`" step for platforms with
no usable analytics API. A persistent Chrome profile per platform holds your login, so
you sign in **once** and every later run reuses it headless — no passwords are stored.

**v1 covers LinkedIn** (the most painful export). X and Substack clone the same shape
once LinkedIn is verified live.

Bluesky already pulls via API (`npm run bluesky`) and needs none of this.

## One-time setup

```bash
npm install                       # picks up the new `playwright` dependency
npx playwright install chromium   # downloads the browser Playwright drives
npm run pull:login -- linkedin    # opens a real browser — log in (incl. 2FA), press Enter
```

The saved session lives in `~/.content-agents/browser-profiles/linkedin/` — **outside the
repo, never committed** (contains live session cookies; treat it like a password).

## Regular use

```bash
npm run pull -- linkedin --ingest   # download the export AND update the DB in one shot
npm run pull -- linkedin            # just download into data/inbox/linkedin/
```

When a session eventually expires, the run tells you to re-run `pull:login`. That's the
only time you touch it.

## When a pull fails — triage

Every failure prints a `culprit:` line that says whose fault it is, so you never guess:

| `culprit:` | Meaning | Fix |
|---|---|---|
| **THEIR SIDE — the site's UI changed** | Logged in and on the page, but the Export control moved/renamed | Open the saved screenshot, then update the 3 selectors atop [`linkedin.ts`](../src/pull/platforms/linkedin.ts) (`ANALYTICS_URL`, `EXPORT_TRIGGER`, `EXPORT_CONFIRM`) |
| **LOGIN — the saved session lapsed** | LinkedIn bounced us to a login wall | `npm run pull:login -- linkedin` |
| **OUR SIDE — connectivity** | Couldn't reach the site | check your network |
| **OUR SIDE — setup** | Playwright/browser missing | `npm install && npx playwright install chromium` |

On any on-page failure the puller saves a **diagnostics bundle** (full-page screenshot +
URL + page title + raw HTML) to `~/.content-agents/pull-diagnostics/…`. That's what tells
a UI change apart from our-side breakage without re-running. It captures your analytics
screen, so it lives outside the repo and is never committed.

To watch a run live and see exactly where it breaks:

```bash
npm run pull -- linkedin --headed
```

Auth is the solved part; the per-platform click-path is the upkeep.

## Adding X / Substack

Implement the `PlatformPuller` interface in `src/pull/platforms/<name>.ts` (download the
export into `inboxDir("<name>")` in the format `src/ingest/import.ts` expects) and register
it in `src/pull/registry.ts`. Everything else — session, login, ingest wiring — is shared.
