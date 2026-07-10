# Substack setup (Notes publishing via browser automation)

**Scope: Substack Notes only.** This pipeline posts short Notes (Substack's tweet-like feed posts),
never full essays/newsletter issues — those are written and published by Muxin directly on
Substack, outside this repo.

Substack has no public REST API for publishing, so the pipeline posts through **browser automation**
— a constrained Playwright session that reuses Muxin's saved, already-authenticated Substack
profile. The session persists, so repeated publishes stay authenticated without re-entering
credentials.

No API key, no `.env` secret — authentication is session-based and stored locally (same as the
read-only Substack analytics pull in `npm run pull`).

## Setup

1. Run the one-time login to save your Substack session:
   ```
   npm run pull:login -- substack
   ```
   A browser window will open at the Substack sign-in page. Log in fully (including any
   email verification, 2FA, or captcha), then return to the terminal and press Enter. The
   session is saved for future runs.

   **Substack email-sign-in hint:** Substack defaults to email-code verification: tick
   "I'm not a robot" if prompted, enter your email, and check your inbox for a 6-digit code
   or magic link. If you get a magic link and it opens your other browser, copy the link
   and paste it into this window's address bar so the session lands correctly.

2. Verify the session works:
   ```
   npm run publish:substack -- --check
   ```
   This reads the saved session without posting — confirms your publication is reachable
   and Playwright can navigate it. No writes, no scheduling.

3. (Optional) Verify DOM selectors work on your publication by watching a live browser:
   ```
   npm run publish:substack -- --headed <content-folder>
   ```
   This runs the real claim-then-fire machine in a visible browser window so you can watch the
   automation (check `review-queue.md` first — you must approve the row for it to be eligible).
   Depending on whether the row already has a claimed slot, this run will either just CLAIM a
   future slot (no browser posting yet) or, if a previously claimed slot has already arrived,
   FIRE the note live. Use this once after first setup to confirm selectors haven't drifted on
   your Substack publication.

## How publishing behaves

- `/publish` schedules approved **`substack`** rows via `npm run publish:substack <content-folder>`.
- **Text source:** `derivatives/substack.md` (extraction-first; no composed copy).
- **Two-phase claim-then-fire, never instant on the first run.** Substack Notes has no native
  "schedule for later" API, so the pipeline builds scheduling itself using the shared slot ledger
  (`src/publish/slots.ts`): the FIRST run against an approved row just claims a future PT-anchored
  slot in the ledger (`data/publish-schedule.jsonl`) — no browser, no post. A LATER run, once that
  claimed slot's time has passed, drives the saved-session browser to actually open the Notes
  composer and click Post — exactly once, then marks the row `published`. Re-running
  `npm run publish:substack <content-folder>` (e.g. from cron, or by hand) is what advances a row
  from "claimed" to "fired"; nothing posts until a run happens to execute after the slot's time.
  See `## Triggering the fire step` below for how to make that happen unattended.
- **Dry run / preview without posting.** Report what each approved row's claim/fire state is,
  without writing anything:
  ```
  npm run publish:substack -- --dry-run <content-folder>
  ```
  Makes zero mutations — no ledger claim, no status change, no browser launch, no post. Safe to
  run any time to check what the next real run would do.
- **Verify config anytime:** `npm run publish:substack -- --check` (read-only — confirms the
  saved session authenticates and the Notes page is reachable; no form, no post, no claim).

## Triggering the fire step

Because posting drives a real logged-in browser, it can only run **locally**, on a machine where
the saved Substack session lives — not from a cloud/hosted routine (same constraint as the
analytics pull). To actually fire a claimed slot once its time arrives, something has to re-run
`npm run publish:substack <content-folder>` (no flags) after that time — e.g. a local cron/launchd
job, the `/loop` skill, or re-running `/publish` by hand. Until a run happens to execute after the
claimed slot's time, the row just sits "claimed, not yet posted" — this is expected, not a bug.

## No .env credential needed

Unlike Typefully (which needs `TYPEFULLY_API_KEY`) or TikTok (which needs `POSTPEER_API_KEY`),
Substack publishing uses a **persistent browser session** saved by the login step. No secret
in `.env` — the authentication is stored locally and reused across runs. It's the same session
mechanism as `npm run pull -- substack` (the read-only analytics pull). A lost session means
re-run `npm run pull:login -- substack` once.

## Substack's DOM changes

Substack's UI can shift — form selectors (button labels, input IDs, field order) sometimes change
without warning. If a post fails during the fire step with a "selector not found" / UI_CHANGED
error, the DOM has likely changed. **Fix it with a live `--headed` refinement pass:**

1. Run `npm run publish:substack -- --headed <content-folder>` to watch the browser live.
2. If the automation gets stuck, you'll see where. Update the selectors in
   `src/publish/substack.ts` to match the current publication form.
3. Re-run the post or dry-run to confirm the fix.

This is rare (Substack updates are infrequent), but document the fix so future runs don't break
on the same selector drift.
