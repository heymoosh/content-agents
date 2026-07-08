# Home-brand thread-check — every piece threads back to the worldview line

**Status:** built 2026-07-04.

## Why

Every published piece should connect back to Muxin's home-brand worldview:

> I uncover harmful hidden beliefs and why they need to change before AI automates everything.

The fuller statement behind it (`config/platforms.yaml` `home_brand.worldview_expanded`):

> The real AI risk isn't the machine, it's the unexamined human systems we're about to automate at
> full speed. I ship software as the proof.

**The operational test is NOT "is this about AI."** It's whether the piece touches one of
`home_brand.signals` in `config/platforms.yaml`: an unexamined human system/assumption, who
actually benefits or is harmed, or building/shipping the right thing rather than automating the
wrong one faster.

## Where it runs

This is **atomize step 5.5** (`.claude/skills/atomize/SKILL.md`), right after scoring (step 5,
`native`/`brand`/`cta`) and before validate (step 6) — the same slot the pillar tag (step 3) and
CTA stamp (step 4.5) already occupy: Claude does the judgment inline while running `/atomize`,
using `home_brand.signals` as the rubric, and stamps the verdict into the derivative's
frontmatter:

```yaml
thread_check: pass            # or: missing
thread_spin_applied: true     # only present once Spin has attempted a redraft
```

This file remains the detailed spec (rationale, fallback mechanics, examples); `SKILL.md` step 5.5
is the short in-context pointer a live `/atomize` run actually reads.

## On a "missing" verdict

Invoke Spin's existing per-channel reframing (`config/platforms.yaml` `spin_angles`,
`references/spin-mode.md`) to weave `home_brand.worldview_expanded` into the derivative in the
platform's voice — reuse that approved language, never invent a new claim. If a sharper
platform-voiced rewrite doesn't fit, `src/atomize/thread-check.ts` `draftThreadIn()` gives a safe,
deterministic fallback: it appends `worldview_expanded` verbatim as a closing line (idempotent —
running it twice never duplicates the line) and returns the frontmatter patch
`{ thread_check: "pass", thread_spin_applied: true }`.

If the redraft genuinely still doesn't connect, leave `thread_check: missing`, queue it anyway
(step 8), and append `threadCheckNote()`'s text to the row's review-queue.md `notes` cell (see
below) so skimming the raw markdown itself surfaces it too — not just the frontmatter and the GUI
badge.

## Never a hard gate

A missing or failing thread-check **never blocks** a piece from being queued or published:

- `npm run validate` (`src/atomize/validate.ts`) reports a non-blocking summary line —
  `home-brand thread-check: N pass, M missing (not blocking) — <files>` — via
  `summarizeThreadChecks()`. It never affects the script's exit code.
- The review GUI (`src/review/serve.ts`) surfaces a `thread: pass` / `thread: missing` badge next
  to the `spin` badge on each row (reading `thread_check`/`thread_spin_applied` straight from the
  derivative's frontmatter, the same way `spin`/`angle` are already surfaced) — informational only.
- The raw `review-queue.md` markdown itself carries the same signal: a row still `thread_check:
  missing` after the redraft attempt gets `threadCheckNote()`'s text
  (`flag: home-brand thread-check missing`) appended to its `notes` cell (step 8) — same
  notes-cell pattern the storytelling soft gate already uses (`spinPassNote()`). A passing
  derivative gets no flag.
- `/publish` never reads `thread_check`; approval and publishing are gated solely on
  `review-queue.md` row `status`, unchanged by this feature.

## Deterministic plumbing (`src/atomize/thread-check.ts`)

- `loadHomeBrand()` — reads `config/platforms.yaml` `home_brand`.
- `classifyThread(fm)` — normalizes `fm.thread_check` to `"pass" | "missing"`, defaulting to
  `"missing"` for anything other than the literal string `"pass"` (fail-safe: an omitted or
  malformed field always surfaces for review instead of silently passing).
- `draftThreadIn(body, homeBrand)` — the deterministic Spin fallback described above.
- `threadCheckNote(fm)` — the review-queue.md notes-cell suffix for a still-missing check;
  `undefined` when the check passed.
- `summarizeThreadChecks(files)` — the advisory rollup `validate.ts` prints.

Tests: `src/atomize/thread-check.test.ts` (`node --import tsx --test src/atomize/thread-check.test.ts`).
