# Porting `Venture Build v7.dc.html` — binding rules

**Status:** active. Every GUI change that ports a screen, control, or string from the design
prototype must follow this document. Read it before writing markup.

The prototype is `~/Downloads/handoff/Venture Build v7.dc.html` (4142 lines), with backend notes in
`Venture Build v5 - backend handoff.md` and `Venture Build v7 - backend handoff.md`, and six rules
in that folder's `README.md`.

---

## Rule 0 — the prototype is a layout reference, not an authority

Three independent audits found the same thing: **a faithful port would make the shipped app less
honest than it is today.** In every place where the prototype and `src/review/page.ts` disagree
about what may be claimed on screen, the repo is currently right.

So the porting question is never "does this match the design." It is:

> Does a real read in this repo produce this, and does the screen say only what that read supports?

When the answer is no, the prototype's version does not ship. Fix the copy, render an honest empty
state, or leave the element out — in that order of preference.

Two of the design's own strings were already caught and refused before shipping
(`"Rule added. Applies to next post."` and a hardcoded `"observed Aug 6"` evidence date). Those
refusals are precedent, not exceptions.

---

## Rule 1 — three regressions a faithful port would cause

These are the specific places where copying the prototype would undo work already done. Do not.

**1a. The progress bar.** The prototype's `roomJobPct` computes `Math.round(step / steps.length *
100)` unconditionally. The shipped `jobProgressPct` (`src/review/page.ts`, mirrored in the browser
script) returns `null` when `stepTotal` is null, because — its comment — *"a bar drawn from nothing
would be a number the system did not measure."* Keep the guard.

**1b. The Studio team rail.** The prototype hardcodes three resting rows
(`"Scout — swept podcasts, clients, trends · Tue 06:00"` and friends). `src/review/studio.ts`
already does this correctly: `lastScoutRun()` with a `"no sweep on record"` fallback,
`countFutureSlotClaims()` for the real holding count. Also note there is no `illustrate` job kind,
and `"Illustrator"` in the shipped naming means a *video* job. Keep the shipped version.

**1c. Answered-but-blocked jobs.** The prototype treats `blocked` as always awaiting Muxin. The
shipped code models an answered blocked job as settled — `jobRailLabel` returns `"You answered"`,
`ANSWERED_FOOTER` explains a fresh job is running from the start, and `jobAnswerEcho` renders her
choice back. The shipped comment says plainly that the design got this wrong. Keep the shipped
model.

---

## Rule 2 — prototype claims that are factually wrong about this repo

Do not port any of these. Read the real value instead.

| Prototype says | Reality |
|---|---|
| `venture/rules.yaml` is `"not written yet"` | It exists: 13,206 bytes, and root `CLAUDE.md` names it as Venture's runtime rubric with a parity test |
| `RULES 2026-08-07-DRAFT-1`, `"draft, awaiting your yes"` | `venture/rules.md:9` says `venture-rules-2026-08-19-draft-1`, and line 3 says *"Confirmed by Muxin (2026-08-18)"* |
| `"Eight of the ten things this build makes are yours to put live"` | Its own `KIND` map has **eleven** entries (7 manual, 1 app, 3 none). Count at render time |
| `"153 of your 158 subscribers arrived here"` | No per-channel subscriber attribution exists. `src/research/capture.ts` records account-level totals only |
| `"Reads in 3 minutes"` | No read-time computation exists anywhere in `src/` |
| `"The window is 14 days"` (one global constant) | `config/platforms.yaml` sets it per platform: 14 (x, threads), 21 (mastodon), 60 (linkedin), 30 fallback |
| `timerOf` renders `"00:" + mm + ":" + ss` | A 75-minute job renders `00:75:00`. Use the shipped `formatElapsed` path |
| `"38 people sit in that cluster"` | No clustering of Muxin's own audience exists in `src/` |
| Signals' per-platform table (`"X · trending up"`, `"run 3x"`) | Hardcoded markup with no data binding. Week counts are computable; the trend vocabulary has no source |
| Every Signals number (4,180 / 37 / 12 / 1) and threshold (500 / 20 / 30 / 25) | Appears in no repo document. Fixture data |
| `"saved"` after a bare 500ms `setTimeout` | Must be driven by the server response, and needs a failure state the design never drew |

---

## Rule 3 — the honesty rules that govern every screen

From the handoff README, and already enforced throughout `src/review/`:

- **Never render a duration, count, or percentage you did not measure.** An unmeasured threshold is
  as bad as an unmeasured duration.
- **The type convention is load-bearing.** Georgia serif = Muxin's own words. Sans-serif = the app
  speaking. Purple `#5b46b8` (`JC.ai`) = AI-written. Rendering her prose in the AI register is a
  real defect — one shipped and was fixed in PR #359.
- **A claim never renders bare.** A number carries where it came from.
- **Three states, never two.** Measured, measured-as-zero, and not-measured-at-all are different.
  Collapsing the last two is the failure mode all of this exists to prevent.
- **Approved is not live.** The Venture delivery state machine separates them; so must the UI.

---

## Rule 4 — decisions Muxin has made (2026-08-23)

These are settled. Do not re-litigate them in a PR.

- **Confirmations stay corner toasts.** The prototype's in-place flash-and-scroll convention is not
  adopted. `flash()` remains the confirmation mechanism app-wide.
- **The Refresh button stays.** Only jobs auto-poll; room data is otherwise static until a room
  switch. The prototype can omit it because it assumes a 1s live tick this app does not have.
- **Both filter toggles stay** — "show published / discarded" and "show already drafted". They are
  the only access to decided history. The prototype has no filtering, sorting, or pagination
  anywhere.
- **The pending-count badge may be dropped.** Studio's "Needs you today" table covers the same work.
- **Accessibility is out of scope for now.** This is a local single-user tool. Neither the prototype
  (zero aria/role/alt across 4142 lines) nor the shipped app has it. Revisit if that changes.
- **A dev fixture mode gets built.** Otherwise new screens — the Venture room especially — cannot be
  reviewed until real data happens to exist for them.

---

## Rule 5 — the mirror convention

Pure helpers in `src/review/page.ts` are written **twice**: exported for DOM-free Node testing, and
again inline inside the browser `<script>` string. They are kept in sync by hand.

Change one, change both. Then write the test that reads the emitted script text and asserts the
mirror shipped — without it, fixing the export while forgetting the inline copy goes green while the
browser keeps the bug. That exact failure is why PR #359's Fiction routes needed two tests, not one.

---

## Rule 6 — classify before building

Every item gets one tier, and the tier decides who builds it and in what order:

- **(a) Zero backend.** Pure GUI against a read that already exists. Name the read.
- **(b) Thin route.** The logic exists; it needs an HTTP route. Name the function.
- **(c) New backend.** Genuinely absent. Say what must be built — *and whether real data exists to
  make it truthful.* A tier (c) item with no data source is not a build task; it is an honest empty
  state.

Most of the remaining work is (a) or (b). The prototype's apparent size is misleading, because the
backend for the Venture room, the reuse window, channel fit, and next-free-slot all already exist.

---

## Rule 7 — concurrency

`src/review/page.ts` is one `renderPage()` of ~3,300 lines. **Only one branch may edit it at a
time.** Backend work in `src/venture/**`, `src/review/signals.ts`, `src/review/jobs.ts` and
`src/publish/**` is disjoint and parallelizes fine; GUI work does not. When adding routes to
`src/review/serve.ts` from parallel branches, insert each next to its topical neighbours so the
hunks stay far apart.

---

## Rule 8 — what does not ship without a held draft PR

Per root `CLAUDE.md` rule 7, a change to the code or prompts that decide **what content says** holds
as a draft PR carrying an old-vs-new content sample. Reads, routes, and rendering do not.

The practical line for this work: instrumenting a job with progress markers is reporting, not
judgment, and auto-merges. Adding an instruction that changes which engine a skill picks, or whether
a directive gets applied, is judgment, and holds.
