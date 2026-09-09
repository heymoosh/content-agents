# SLICE-5Q: the review queue page puts the generated content first

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin reviewed the SLICE-5P canary in the review GUI (`npm run review`, `http://localhost:4600`)
on 2026-09-07 and asked for six changes, in her words:

1. The text ought to be larger and easier to scan through.
2. The focus of the page ought to be the generated content.
3. There is no reason for a backend tag like `x-1`, `x-2` to be displayed as the row title.
4. A short post must be readable from the main page without opening Focus Mode. At minimum the
   overflow text scrolls inline on the home page.
5. Clicking approve flashed an error too fast to read, yet the status was written. Errors must
   stay on screen until read.
6. The biggest, most obvious thing dividing one thought from the next on this page ought to be
   the **full original input**, not the essay title and its descriptor line. The source (title,
   folder) can be a subtitle. Today the divider is a bold title, a muted "Descriptor · title ·
   folder-slug" line, and a collapsed "▶ Original input" toggle.

Demonstrably true when done: on the queue page, each content folder's divider shows the original
input body itself, expanded by default, in a scrollable block when it is long, with the title and
folder demoted to one muted subtitle line; each row leads with the post body in a larger type
size, the whole body of a post under the platform limit is readable in place (longer bodies
scroll inside the row), the row id no longer appears as a heading (it may remain as a `title`
attribute, a `data-` attribute, or a small muted line after the body for people who need it), the
platform pill and status badge remain, and an action error stays visible until dismissed or until
the next successful action.

## Difficulty

Easy — one client-rendered page in one file, no data-model change, no server change.

## Depends on

SLICE-5P (must be closed first so the GUI is not changed under a live verification run).

## Owned files

Parallel-safe: **no — single lane.** All six changes land in the same render function and the
same test file; two workers would edit the same lines.

### Lane A — the queue row and the flash

- `src/review/page.ts` — the queue row template (row id as title `page.ts:1606`, the 150-char
  preview `page.ts:1604`, the `max-height:4.5em` clamp `page.ts:1606`), the row CSS, and the
  flash helper (`page.ts:1350`, currently a 1400 ms timeout) and its error call site
  (`page.ts:1666`).
- `src/review/page.test.ts` — assertions for the new render output.

## Do not touch

- `src/review/serve.ts` — the API is not in scope. If the SLICE-5P flash error turns out to come
  from the server returning `ok:false` after a successful write, record `file:line` under
  Unresolved; the repair is its own slice.
- Focus Mode / the per-row editor. It stays as it is; this slice changes what the list shows.
- `review-queue.md` files and anything under `content/`.
- `.claude/skills/**` — write-protected.
- `docs/content-studio-master-status.md`.

## Cited headings

- `docs/content-studio-master-status.md` → `## Standing constraints` → "Design sanity check on every GUI slice" (A9 only).

## Acceptance

- [x] A1 — The row title is the post body, not the row id. `row.id` is not rendered inside a
      heading or `<strong>` element in the list. It may survive as `data-id`, a `title` attribute,
      or a muted line below the body.
- [x] A2 — Body type size in the list is at least 1.125rem (18 px at default zoom), with line
      height ≥ 1.5. Body text is the darkest text in the row; metadata is muted.
- [x] A3 — A body at or under 300 characters renders in full in the list with no truncation and
      no scrollbar. A longer body renders in a container that scrolls vertically inside the row
      (no `.slice(0, 150)`, no fixed 150-char cut).
- [x] A4 — An error from `/api/status` (the `ok:false` branch) stays on screen until the user
      dismisses it or the next action succeeds. Success confirmations may still auto-hide.
- [x] A5 — The platform pill, status badge, checkbox, and Open Focus Mode control are still
      present per row and still work (existing tests still pass).
- [x] A6 — `page.test.ts` covers A1, A3 (both branches) and A4 by asserting on rendered HTML or
      the flash function's behaviour, not on arguments passed.
- [x] A7 — No em dashes introduced in any user-visible string.
- [x] A8 — The folder divider renders the original input body (the same text the current
      "Original input" toggle reveals) open by default, in body type no smaller than the row
      body, inside a container that scrolls vertically past roughly 40vh. The essay title and the
      folder slug appear once, as a single muted subtitle line below or above it, not as the
      page's largest heading. The "Descriptor · …" line is gone. Covered by a `page.test.ts`
      assertion on rendered HTML.
- [x] A9 — The design sanity check passes: `docs/content-studio-master-status.md` →
      `## Standing constraints` → "Design sanity check on every GUI slice" (the five points).
      Record each of the five in the RESULT BLOCK with the CSS or HTML that satisfies it. Also
      remove or let Muxin dismiss the stale job card at the top of the Content room ("Create
      configured drafts: probe-atomic-63507-1788629180763", queued before brand tracking); if
      that needs a server change, record `file:line` under Unresolved instead.

## Verify

Focused (run unsandboxed; tsx needs a socket under `$TMPDIR`):

```
node --import tsx --test src/review/page.test.ts src/review/serve.test.ts
```

Visual: start `npm run review`, open `http://localhost:4600`, open the folder
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference`, and check A1 through A4
against rows `x-1` (268 + 85 chars, two posts) and `linkedin-1` (longer), and A8 against the
folder divider (the essay body is long, so the scroll branch is exercised). Capture one screenshot to
`$TMPDIR/slice-5q-queue.png` and name it in the RESULT BLOCK.

## Observable result

Muxin opens the queue page and reads a whole X post without clicking anything. The first thing in
each row is her content in readable type; the id is gone from the heading. When an action fails,
she can read why.

## Risk

Low — audit required: **yes**, at a coherent boundary: this is a page Muxin reads with her own
eyes, so the auditor checks the rendered HTML against A1 through A4 from the diff and the test
output, not from intent.

## Families

- Builder: Claude, strong tier (frontend default).
- Auditor: Codex (GPT), strong tier. Receives the diff, the changed-file list, the focused test
  output and this Acceptance list only.

## Coordination

- Dependency ready confirmed 2026-09-07: SLICE-5P is closed, NOT ACCEPTED; no live verification is running for it.
- One Claude lane in `/private/tmp/content-agents-slice-5q`, branch `slice-5q-queue`; Codex audits the bounded candidate evidence. Coordinator alone commits and integrates.
- No authenticated model canary is needed for this client-only slice. Visual action checks must intercept requests or use isolated fixtures; never approve or retry a live publishing action.
- Primary checkout pre-existing modifications: `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and `data/notes-spread-ledger.jsonl`. Preserve both.

## Closeout

**PASS — accepted 2026-09-07.** A1-A9 and all five design checks passed. Claude built; Codex independently audited and closed every material finding after one repair cycle. Focused: 386/386, exit 0. Full `npm run check`: typecheck plus 4302 tests / 491 suites / 0 failures, exit 0 on the frozen candidate, with test-file concurrency set to 1 by a temporary PATH shim.

The default-concurrency gate hung in Node v22.14.0 (runner CPU spin, idle children, no output growth, no printed failures); terminated with exit 137 and recorded HUNG/INTERRUPTED, not PASS. Technical advisor recommended the serial recovery; the independent auditor confirmed it preserves the complete inventory and exit status. Default-concurrency runner stability remains unverified. No repository test configuration changed.

Evidence: `/private/tmp/slice-5q-evidence/` contains `candidate-v2.patch`, `focused-tap.txt`, `visual.txt`, `shot.mjs`, three screenshots, `stale-job-evidence.txt`, `audit-final.md`, `gate.log` (hung attempt), `gate-serial.log` (passing full gate), and `gate-workaround.txt` (shim and candidate hashes). No live status or publishing request was sent.

Nonblocking leftovers: the stale failed job can be dismissed with the existing **Clear queue** control; operational data was left untouched. The original 5P server write/error question and other rooms' transient errors remain outside this slice. Next dependency-ready slice: 5R, then 5S. Hygiene (`bash scripts/repo-hygiene.sh --rescue`) returned 1 for known uncommitted work, with rescue refs created. Disposition: this session's four tracked files are committed together; no session-created untracked repository paths remain. The frozen checkout contains the same verified two source files and is removed after integration. Pre-existing primary modifications in `content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md` and `data/notes-spread-ledger.jsonl` remain untouched. The five pre-existing local `agent/cs*` branches reported by hygiene remain untouched; this session's `slice-5q-queue` branch is retained as provenance after integration.
