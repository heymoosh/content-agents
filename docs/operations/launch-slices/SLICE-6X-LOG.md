# SLICE-6X dated record

Packet: `SLICE-6X.md`. Evidence: `evidence/6X/`. This file holds the dated execution record so the
packet stays a specification.

## 2026-09-11 — execution

### Builder rounds

The packet's `## Families` line names Codex / GPT as builder, the repository's stated backend
default. Codex built the first candidate and one repair round, then hit its usage cap (reset
2026-09-15) mid-round, leaving four red tests and no production fixes. Muxin's instruction, given
the same day: use Claude as the builder wherever possible and reserve the cross-family models for
auditing, because Codex and Grok quota is limited and spending it on implementation burns the
quota the cross-family audit rule depends on. A Grok builder that had been started was stopped
before it made any edit (tree unchanged), and Claude built rounds 4 through 6.

Round 4 closed the four red tests and the leftover rename work. It also deleted a pre-existing
test, `stampOrigin overwrites whatever origin value a row already carries`, on the reasoning that
the slice had reversed its rule. Coordinator rejected that: the overwrite rule was correct for the
only call site that existed before this slice (`dispatchJob`'s new-folder branch, which runs on a
folder the GUI just created, where every row came from that run). What actually broke was that this
slice added a second call site, `settleContinueRun`, which rescans folders holding rows from
earlier runs. Round 5 restored the deleted test verbatim from HEAD and turned preserve-versus-
overwrite into an explicit per-call-site option (`preserveExisting`), so both guarantees survive.

Round 6 repaired the audit's HIGH finding. See below.

### Cross-family audit

Claude built, so the auditor was Grok (`--sandbox workspace`, per the bindings; Codex was capped).
Round 1 asked seven bounded questions about the disposition function, the adoption path, reachable
refusal branches, the throw-to-skip change in `recordNewQueueRows`, the `stampOrigin` filters, the
tightened `approvalId` regex, and the swallowed `stampOrigin` errors. Verdict: PASS WITH FINDINGS.

HIGH, now fixed. `stampOrigin` granted creation provenance by denylist (`status !== "approve"`).
The live status vocabulary is `pending`, `approve`, `published`, `discard`, so a continue run
rescanning an older folder could mint a `created` event on a legacy `published` row. That both
destroyed the row's adoption path (`adoptApprovedQueueRow` requires zero prior events) and let a
later re-approval through the Studio status API complete a `fresh` capability, making already
published content schedulable a second time without the reconcile CLI. A pre-journal published row
may have no publishing-ledger entry, so the ledger retry block does not necessarily catch it.
This defect came from a coordinator instruction, not from builder initiative: round 5's brief had
explicitly told the builder to keep that filter global and unchanged.

Round 6 replaced the denylist with an allowlist predicate, `statusAllowsCreationProvenance`: only
`pending` or an empty status cell may be granted creation provenance, so any status this code does
not know about today fails closed. `recordNewQueueRows` and the `appendRow`/`appendRows` path were
deliberately left unfiltered, because those callers append rows they just created and legitimately
know it; the defect was only in the folder-wide rescan. Four regression tests pin the fix, and the
builder confirmed they are load-bearing by reverting the predicate and observing exactly those four
fail. The Grok delta audit verified the caller table independently and returned CLOSED, PASS.

Two LOW findings accepted as named risks rather than fixed:
- Adoption certifies the bytes on disk at adoption time. Legacy rows have no approved-at hash, so
  there is nothing earlier to bind to. The fingerprint check closes the preview-to-write window;
  it cannot detect an edit made between the original approval and the adoption. Mitigated by the
  CLI preview, which prints fingerprint, mtime and the first five asset lines before any write.
  This is the same risk the earlier audit rounds raised as B3.
- A swallowed `stampOrigin` error leaves the job marked `done`, so a provenance miss is invisible
  until the later Schedule refusal. Fail-closed, but quiet.

### Verification

All checks run unsandboxed on the final candidate: `npm run typecheck` exit 0; the focused six-file
run exit 0 with 367 pass / 0 fail; `npm run check` exit 0 with 4405 pass / 0 fail and 159s measured
local elapsed; `npm run test:e2e` exit 0 with 55 pass / 0 fail / 16 blocked and the worktree
byte-identical afterwards. `git status --porcelain -- data` empty; `git diff --check` exit 0.
Fixture backend only, no live provider call, so live integration is not applicable.

One coordinator error worth recording: an earlier round wrote an e2e log inside the worktree, which
tripped the e2e suite's own isolation check ("shared worktree changed"). Logs belong in the
scratchpad, not the tree.

### Scope

Lane A scope extension: `src/review/jobs.ts`, `src/review/jobs.test.ts`, `src/outreach/draft.ts`
and `src/outreach/draft.test.ts` are outside the packet's Lane A block but hold three of the seven
production row-appending paths, so acceptance item 2 cannot close without them. No other lane was
active, so the disjoint-write condition still holds.
