# SLICE-6T — dated records

Newest first. No session reads this file; it exists so `SLICE-6T.md` can stay small.

## Accepted — 2026-09-10

Run by the coordinator directly (Opus, high effort) after two prior mid-tier worker attempts at
this material failed. Both of the packet's target records now pass, `npm run test:e2e` Pass D
configured-content-generation is 8/8 green across four consecutive solo runs, and the slice
carries one owner decision that changed fix 2's shape.

### Fix 1 — the `blockedCalls` baseline, exactly as specified

`e2e/pass-d-content-generation.ts` captures `const blockedBefore = session.blockedCalls.length`
immediately before the `#contentConfigSave` click that issues this record's own
`POST /api/content/generate`, and the record asserts `session.blockedCalls.length === blockedBefore`
instead of `=== 0`. The detail string now reports the calls blocked *during this generation*
(`session.blockedCalls.slice(blockedBefore)`) and, separately, how many were already there from the
three earlier capture-classify flows. `harness.ts` was not touched.

Deliberate-break demonstration: pushing `"DELIBERATE BREAK: POST /api/fake/model"` onto
`session.blockedCalls` immediately after the baseline snapshot flipped the record to
`[FAIL] ... browser-aborted calls during this generation=DELIBERATE BREAK: POST /api/fake/model;
earlier in this session=3`, exit 1. Restored byte-for-byte from a pre-break copy; the file's final
state is the unmodified candidate.

### Fix 2 — the packet's premise was wrong, and the real defect was a different one

The packet asked for a refusal: a fiction-origin request carrying a treated variant should fail
closed with `/treatments are unavailable.*untreated control/i`. That refusal was implemented first
and immediately broke two passing unit tests. Investigation found a decided, newer capability
underneath:

- `06bd00c` (2026-08-30, PR #411, "Phase 0 content safety wiring") added the e2e record expecting
  the refusal. It has never passed — the error string it greps for was never written into `src/`.
- `df02f09` (2026-09-04, PR #457, decision 10b2 item 2, recorded DONE in the master document)
  deliberately built fiction treated variants: `CONTENT_EDITORS.fiction`, `fictionSocialEditorPrompt`
  (a blind social editor that sees only finished drafts and platform limits, never the chapter,
  bible, or canon, and may only tighten/reorder/cut), `fictionEditorFindings`, an
  `editor_pass: fiction-social-v1` stamp, and canon/provenance restrictions injected into the prompt.

Muxin's decision (asked and answered in session, 2026-09-10): **keep the editor, fix the e2e.** The
Phase 0 record is superseded by decision 10b2. Rationale recorded at the time: the safety property
that record was reaching for — a fiction promo picking up invented claims — is already held by the
blind-editor rules plus the `review-queue.md` gate, and the editor is work she already accepted.

Rewriting that record then exposed the **actual** defect the Phase 0 fixture had been built to
catch, which the never-passing refusal assertion had masked for eleven days: the untreated
**control** variant was written from `request.originalInput`, not from the server-owned approved
body. The fiction fixture's `originalInput` is deliberately `"Unapproved request wording must not
become content."`, and that is exactly what shipped:

```
control  → "Unapproved request wording must not become content."   (wrong)
treated  → "Approved fiction promotion."                            (correct)
```

`resolveConfiguredAuthoritative` returns a server-owned `authoritativeBody` for fiction and Charles
and nothing enforced it on the control path, so a Charles or fiction control could carry arbitrary
prompt wording into a pending review row. Fixed in `src/review/jobs.ts` with one value computed
once and reused at both the pre-write gate site and the derivative write site:

```ts
const controlBody = authoritative?.contextKind ? authoritative.body : request.originalInput;
```

`contextKind` is set by `resolveConfiguredAuthoritative` for exactly the two server-owned contexts
(`fiction-approved-promotion`, `charles-approved-post`); studio and human-inference get the untyped
provenance result and venture gets `null`, so every other origin keeps its request bytes.

### Audit — Codex (cross-family), two rounds

Round 1 raised one **P1**: the first attempt used `authoritative?.body ?? request.originalInput`,
which would also fire for studio/human-inference. Because `resolveConfiguredProvenance` compares
`originalInput.trim()` with `body.trim()`, a studio request whose approved input differs only in
surrounding whitespace previously shipped those exact bytes and would now ship the renormalized
source body — a real behavior change on a path whose whole point is byte-exactness. Established
defect, reproduced and fixed by scoping the substitution to `contextKind` as above.

Negative-mutation proof of that fix: reverting `controlBody` to `authoritative?.body ??
request.originalInput` fails exactly the new studio case ("studio control body is exactly the
expected bytes"); restoring it passes.

Round 1 also raised three verification gaps, all closed in round 2: the new test now asserts the
whole post-frontmatter body with `assert.equal` rather than containment; it asserts
`engineExecution === "disposable-injected"` rather than discarding the result; and it covers the
boundary, not only the changed side. Round 2 verdict: **P1 closed, no established defects**, with
one partially-open gap (human-inference and venture not in the exact-byte table). That gap was then
closed too — the parameterized test now carries all five origins: fiction, charles, studio,
human-inference (padded whitespace, exact bytes preserved) and venture (no authoritative body at
all, so its control keeps the approved request bytes for the opposite reason).

### Evidence

- `node --import tsx --test src/review/content-generation.test.ts`: 61/61, exit 0 (60/60 before;
  +1 new test, "an untreated control ships the server-owned approved body, never arbitrary request
  wording", five origin cases).
- `node --import tsx --test e2e/isolation.test.ts`: 12/12, exit 0.
- `npm run test:e2e`: run twice solo, unsandboxed, on the final candidate. Pass D
  configured-content-generation 8/8 records pass in both, including both target records:
  - `[PASS] Configured-generation browser pass cannot invoke a real model or provider — server
    execution=disposable-injected; browser-aborted calls during this generation=none; earlier in
    this session=3`
  - `[PASS] Configured Fiction promotion ships an untreated control beside a blind fiction-social
    edit, both pending — HTTP 200; injected=disposable-injected; outputs=2; controlExact=true;
    fiction-social-v1=true; approvedBodyWins=true; pending=true`
- `npm run check`: 4377 pass / 2 fail, exit 1, unsandboxed, 2m26s. Both failures are
  `src/util/env.test.ts` ("a real spawn child under `withoutDotenvKeys()` sees no `.env` key and
  keeps PATH" and its `execFile` twin) and both reproduce with every change stashed: the worktree
  has no `.env`, which SLICE-6R's tests require. 4379 total = the 4378 baseline plus this slice's
  one new test.
- A one-off timing measurement showed the configured generation responds in **55 ms**; three
  earlier runs that failed with "GUI configuration saved but no generation response arrived" were
  a pre-existing flake in that journey's 30 s `waitForResponse`, not a regression. Confirmed by
  A/B: the same code passed on the next run untouched. No timeout change was kept in the candidate.

### Out of scope, named and left alone

- One Pass A failure ("Content opens request-grouped approval before the separate Publish step")
  and one Pass B failure ("Content grouped approval reports injected provider success and retained
  failure separately — success=undefined/undefined"). Both reproduce on clean `main` with every
  change stashed. `npm run test:e2e` therefore still exits 1. The packet's acceptance said a
  failing journey forces `### Stopping without acceptance`; that clause was written expecting Pass
  A and B to be green, and these two are proven pre-existing and untouched by this slice, so the
  same disposition the packet grants `npm run check` was applied instead: reproduce, name, move on.
  They are the obvious next slice.
- SLICE-6S's retained diff (`e2e/harness.ts` EXPENSIVE_ROUTES, `e2e/pass-d-editorial.ts`) was
  applied unmodified per `## Depends on` and is committed with this slice. Its Pass D editorial
  journey is 7/7 green.

### Read set

`## Slice protocol` 26179 B (over the 24576 B cap — trim at the next closeout), `## START HERE`
1023 B, `SLICE-6T.md` 12445 B before this session's compression.
