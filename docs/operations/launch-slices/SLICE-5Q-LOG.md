# SLICE-5Q archive log

Moved sections from SLICE-5Q.md, newest first.

## RESULT BLOCK

- **Changed paths:** `src/review/page.ts`, `src/review/page.test.ts` only. `docs/operations/launch-slices/SLICE-5Q.md` left as the coordinator has it; no commits.

**Repairs**

1. **A4 — every `/api/status` caller classified.** Five call sites, now fixed by the test `every /api/status caller shows a refusal as a standing error` (which fails if a sixth appears):
   - `approveReviewSelection` (`page.ts:2043-2046`) — failures now `flashError`, clean runs still `flash`.
   - `onAction` discard (`page.ts:1748-1752`) — was ignoring `ok:false` and recolouring the row locally; now reports the error, re-enables the button, leaves the row at its real status.
   - `onAction` save-note (`page.ts:1756-1761`) — was ignoring `ok:false` and claiming "Marked revise"; now errors and writes nothing into the row.
   - `openReviewFocus` approve/discard (`page.ts:1702`) — already `flashError`.
   - `outreachLock` (`page.ts:2802-2806`) — `ok:false`, `scheduleError` and the thrown-error path moved to `flashError`; a real lock still gets the ordinary confirmation. Display only; no publishing or lock semantics touched.
2. **A8 — 40vh window is unconditional.** Removed the `source.length>700` heuristic and the `.scroll` variant; `.piece-source` now always carries `max-height:40vh; overflow-y:auto` (`page.ts:315-322`). Measured at 1280×600: the 699-character input has `scrollHeight 274` vs `clientHeight 238` — it *would* have overflowed under the old rule and is now contained with its own scrollbar; the 24,000-character input is identical at 238px. Short content still shows no scrollbar (row bodies unchanged).
3. **A4 — informational toasts cannot clear an unread error.** Three explicit toasts: `flash` (success, auto-hides, clears a standing error), `flashNote` (aside, suppressed while an error stands), `flashError` (never auto-hides). Added `flashSeq` so a pending success auto-hide fires only while its own toast is displayed. `flashNote` now carries Request changes and the "type what you want changed first" nudge. Editor unchanged.
4. Bounded disposition, out of queue scope: toasts elsewhere on the desk (Studio capture, Fiction, Charles, Venture, Signals, media-plan/render/attach in `onAction`) still use transient `flash` for failures. Not changed — outside this slice; recommend a follow-up slice if the same rule should cover the whole desk.

**Focused outcomes** (`/private/tmp/slice-5q-evidence/focused-tap.txt`)
- `node --import tsx --test src/review/page.test.ts src/review/serve.test.ts` — **386 tests, 386 pass, 0 fail, 0 skipped**, exit 0 (was 382/382; +4 tests). Run unsandboxed; sandboxed it reports false `listen EPERM` failures.
- `npx tsc --noEmit` — exit 0, empty output (`typecheck.txt`).
- New behavioural tests: refused discard/save-note keep the row's real status and never flash a confirmation; bulk approve posts both rows and reports failures as a standing error; informational toast suppressed while an error stands, then shown after Dismiss; a stale success timer cannot strip a newer error; source blocks have no per-length class.

**Design checks (A9, five points)**
1. *Body ≥1.125rem / line-height ≥1.5* — `.scan-body { font:400 1.125rem/1.6 … }`, measured 18px/28.8px on `x-1`, `x-2`, `linkedin-1`; source 19.2px/30.72px.
2. *Content first, ids/slugs muted* — body column precedes metadata; body `rgb(28,26,23)`, `.scan-id` and `.piece-sub` `rgb(122,114,102)`; `headings: 0` per row; id also `data-id` + `title`.
3. *One clear divider* — `.piece-source` renders the original input in body type with a blue rule, bounded to 40vh at every viewport (`maxHeight: 240px` at 600px tall, `440px` at 1100px); title+slug one muted line; `h3s: 0`, `details: 0`, no "Descriptor ·".
4. *Errors stay until read* — at 2.5 s after a failed approve: `flash show error`, opacity 1, 15px, `zIndex 90`, on screen, Dismiss present; still identical after clicking Request changes; cleared only by Dismiss (`className "flash"`).
5. *Scannable at arm's length* — `x-1` (268) and `x-2` (259) render whole with `scrolls: false`; `linkedin-1` (1923) scrolls in place; screenshots at 1280×1100 and 1280×600.

**Evidence** (all under `/private/tmp/slice-5q-evidence/`): `focused-tap.txt`, `typecheck.txt`, `visual.txt` (full stdout of `shot.mjs`), `slice-5q-queue.png`, `slice-5q-error.png`, `slice-5q-short-viewport.png`, `shot.mjs`, `stale-job-evidence.txt`. Server was isolated (port 4671, `CONTENT_AGENTS_DATA_ROOT=…/slice-5q-evidence/data`) and is stopped; port 4600 never contacted. All `/api/status` traffic was fulfilled by browser interception — `{"intercepted":1}`, zero requests reached the server, no publish path exercised, no operational data mutated. No page errors.

**Unresolved**
- The SLICE-5P server question is **not** disproven and was not verified here: whether `/api/status` can answer `ok:false` after a successful write is still open (`serve.ts` untouched, out of scope). Stated as such in `stale-job-evidence.txt`.
- A9 stale job card: dismissible today via the existing "Clear queue" control; record `job-1788629180763-1` / `failed` / `Create configured drafts: probe-atomic-63507-1788629180763` satisfies `jobIsSweepable` (`jobs.ts:1605-1610`). Not cleared — operational data.
- Desk-wide transient failure toasts outside the queue surface (item 4 above) left in place deliberately.
