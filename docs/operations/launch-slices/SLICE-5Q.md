# SLICE-5Q: the review queue page puts the generated content first

Protocol: `AGENTS.md` → `## Slice protocol`. Read that and this file only.
Do not open `docs/content-studio-master-status.md` unless a heading is cited below.
Do not load the repository for context. Do not commit.

## Goal

Muxin reviewed the SLICE-5P canary in the review GUI (`npm run review`, `http://localhost:4600`)
on 2026-09-07 and asked for five changes, in her words:

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

Parallel-safe: **no — single lane.** All five changes land in the same render function and the
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

`none`

## Acceptance

- [ ] A1 — The row title is the post body, not the row id. `row.id` is not rendered inside a
      heading or `<strong>` element in the list. It may survive as `data-id`, a `title` attribute,
      or a muted line below the body.
- [ ] A2 — Body type size in the list is at least 1.125rem (18 px at default zoom), with line
      height ≥ 1.5. Body text is the darkest text in the row; metadata is muted.
- [ ] A3 — A body at or under 300 characters renders in full in the list with no truncation and
      no scrollbar. A longer body renders in a container that scrolls vertically inside the row
      (no `.slice(0, 150)`, no fixed 150-char cut).
- [ ] A4 — An error from `/api/status` (the `ok:false` branch) stays on screen until the user
      dismisses it or the next action succeeds. Success confirmations may still auto-hide.
- [ ] A5 — The platform pill, status badge, checkbox, and Open Focus Mode control are still
      present per row and still work (existing tests still pass).
- [ ] A6 — `page.test.ts` covers A1, A3 (both branches) and A4 by asserting on rendered HTML or
      the flash function's behaviour, not on arguments passed.
- [ ] A7 — No em dashes introduced in any user-visible string.
- [ ] A8 — The folder divider renders the original input body (the same text the current
      "Original input" toggle reveals) open by default, in body type no smaller than the row
      body, inside a container that scrolls vertically past roughly 40vh. The essay title and the
      folder slug appear once, as a single muted subtitle line below or above it, not as the
      page's largest heading. The "Descriptor · …" line is gone. Covered by a `page.test.ts`
      assertion on rendered HTML.

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

## Closeout

No closeout tool in this repository. The coordinator records `PASS` or the leftover list here.

## RESULT BLOCK (worker fills this in and returns it)

- Changed paths:
- Outcome:
- Checks run and results:
- Evidence locations:
- Unresolved:
