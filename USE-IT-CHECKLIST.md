# Use it like a user

Run every line on the owner's Mac with the real app (`REVIEW_PORT=4610 npm run review` from your
worktree) and a real browser. Read the code to explain a failure, not to decide a pass. One line,
one result: pass, fail, or blocked (with the reason). Attach what the line asks for. Copy this file
to `docs/evidence/use-it.md` and fill it in there. Nothing on this list approves, schedules or
publishes anything; if a line seems to need that, it is a fail, not a step.

| # | Do this | Expect | Attach | Result |
| --- | --- | --- | --- | --- |
| U1 | Start the app, open http://localhost:4610 in Chrome, click through Studio, Content, Venture, Fiction, Charles, Outreach, Signals | Every room opens; no console errors | Console screenshot | |
| U2 | Venture room, open the `human-inference` venture | A "Write mission posts" control with a context box, optional path, count (10), and an Advanced disclosure with 15 mission checkboxes; button disabled while the box is empty | Screenshot | |
| U3 | Paste at least 500 words of real notes (use `venture/human-inference/intake.md` if no other context is on this machine), set count to 3, engine Claude, press the button | A job appears with progress and elapsed time; when done it lists 3 new folders and shows "Claude · sonnet" | Screenshot of the finished job | |
| U4 | Open each of the 3 folders in the Content room | Each shows draft text, a different mission label (id and name), origin Venture; no em dashes in the text; no approve or schedule action was taken | Screenshot of one card; the three mission ids | |
| U5 | Read one O2-M1 or O2-M4 draft if one was produced (else pick any) | Every example or claim in it appears in the pasted notes; nothing is invented | Quote the sentence and its source line | |
| U6 | Press the button again with count 3 and no manual override | The 3 new missions are different from the first 3 (least-tested first) | The six mission ids | |
| U7 | Advanced, tick exactly one mission, count 1, press the button | Exactly one folder with that mission | Folder name and mission id | |
| U8 | Content room, open one of the six existing series folders (`venture-human-inference-1441a449abba-3`) | Its card shows mission O2-M1 after the backfill; its text is unchanged | Screenshot | |
| U9 | Content room, generate drafts for one new mission folder with the untreated control only (do not approve) | Each derivative file has `mission_id` in its frontmatter | `head -20` of one derivative | |
| U10 | Signals room, Human Inference brand, find the Missions table | 15 rows in file order; drafted counts match the folders you made; rows without posts say "no data yet"; a "Not yet assigned" line links to docs/missions.md | Screenshot | |
| U11 | Add one line to `data/mission-overrides.jsonl` for a real post URL from the local database, run `npm run missions:apply-overrides`, reload Signals | The command prints "applied"; that mission's row shows 1 matched post and real impressions | Command output and screenshot | |
| U12 | Signals, press Pull when data is under 24 hours old | A plain refusal sentence with a "Pull anyway" option; nothing ran | Screenshot | |
| U13 | Open any job list (Content or Venture) after U3 | Every job row shows engine, model and effort | Screenshot | |
| U14 | Signals, press "Generate insights" with Claude selected | The job row shows the analysis model (`fable`, or `opus` if it fell back) | Screenshot | |
| U15 | Reload the browser | The Venture control, the three folders, their mission labels and the Missions table are all still there | Screenshot | |
| U16 | `git status` in the worktree | Only intended files changed; nothing under `venture/human-inference/`; `data/analytics.db` not staged | Paste the output | |

What is only a number in a test (argument vectors, migration idempotence, parser cases) is
already covered by the tests. This list is for what a person sees.
