# SLICE-6V-LOG — rule inventory for the `## Slice protocol` trim

Companion to `SLICE-6V.md`. No session reads this file; it exists so the packet can stay small.

## RESULT BLOCK — 2026-09-11 (moved from packet at closeout)

- Changed paths: `AGENTS.md` (`## Slice protocol` section only);
  `docs/operations/launch-slices/SLICE-6V-LOG.md` (new, the rule inventory); this packet's RESULT
  BLOCK and `## Closeout`.
- Outcome: section trimmed **26179 B → 24560 B** (−1619 B, −6.2%) by compressing wording, deleting
  eight non-normative rationale sentences, and reducing four duplicated obligations to one statement
  plus a pointer. Under the 24576 B cap with 16 B margin; the ≤ 24000 target is unmet (Unresolved).
  Two Codex cross-family audit rounds established four dropped rules in total (three on the first
  candidate, one more on the repaired one); all four are restored (+116 B), and the end-of-file
  newline the splice had removed is restored too — see `## Cross-family audit disposition` below.
- Checks run and results:
  - size 24560 (pre-trim 26179 at `HEAD`; first candidate 24444, +116 B of audit repairs across two
    rounds) — cap 24576: pass, 16 B margin.
  - `AGENTS.md` ends with a newline, as it does at `HEAD` (the splice had dropped it; `git diff
    --check` does not catch this).
  - `grep -c '^### '` → 17; `diff` of pre/post `### ` title lists empty — no subsection deleted,
    renamed, merged or reordered.
  - all seven of the packet's spot-check rules grep to exactly 1 hit in the post-trim section.
  - rule inventory: 142 rows, every row resolves to a named post-trim carrier, zero dropped; rows
    Z0a, Z0b, V12 and D13 record the audit repairs.
  - `git diff --check AGENTS.md` exit 0; `git diff --stat -- AGENTS.md` shows only `AGENTS.md`
    (245 insertions, 265 deletions).
  - `npm run check` unsandboxed: exit 0, `# tests 4379`, `# pass 4379`, `# fail 0`.
- Evidence locations: inventory, removed-rationale list and pointer-consolidation list in this
  file; candidate was the working-tree edit to `AGENTS.md` on `main`, now committed.
- Unresolved:
  - **≤ 24000 B unmet** (24560 B, 16 B under the hard cap). After rationale sentences and duplicate
    obligations were removed, every remaining sentence carries an inventoried normative statement;
    reaching 24000 means deleting one. Preservation wins, so the item is left unchecked. Whoever
    edits this section next has 16 B of margin and must trim before adding.
  - One obligation's carrier moved subsections: pre-trim `### Completion sequence`'s "Independent
    focused browser work may proceed during review outages" is now stated only in
    `### Model routing`'s usage-limit paragraph (inventory row C0c). Still inside the section;
    confirmed carried by both audit rounds.
- Delivery state: built, audited (2 rounds, PASS on round 3), coordinator-accepted and committed.
- Usage: local gate ≈ 3 min wall clock (4379 tests) per run, measured separately from model work.
  Model calls / provider-reported usage: `unknown` — not exposed to the worker.

Pre-trim section: 26179 B, 17 `### ` subsections (`git show HEAD:AGENTS.md`, commit at packet time).
Post-trim section: 24560 B, the same 17 subsection titles in the same order.
(First candidate 24444 B; audit round 1 established three dropped rules, repaired at +104 B — rows
Z0a, Z0b, V12. Audit round 2 established one more, repaired at +12 B — row D13.)

One row per normative statement (MUST / NEVER / ALWAYS / "do not" / "only" / numbered-sequence
obligation) found in the **pre-trim** text. Every row names the post-trim carrier. **Zero rows are
dropped.**

Non-normative rationale sentences were removed rather than compressed; they generate no rows and are
listed under "Rationale removed" at the end, so the auditor can separate deleted explanation from
deleted obligation.

## Preamble

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| P1 | The coordinator's whole read set is this section + `## START HERE` + the environment file + one packet | Preamble ¶1, "A coordinator reading only this section, the master document's `## START HERE` block, the environment file below and one slice packet has everything it needs" |
| P2 | Master document is the single source of truth for status and decisions; `## START HERE` is the only part a new session reads | Preamble ¶2, final sentence |
| P3 | The bindings/env file is read with this section; "the bindings" = that table | Preamble ¶2, first sentence |

## Roles

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| R1 | Coordinator reads this section, START HERE, current packet — nothing else | Coordinator bullet, "…and the current slice packet, nothing else" |
| R2 | Coordinator never loads the repo "for context" and never implements | Coordinator bullet, same sentence |
| R3 | Coordinator is the only role that commits/integrates, one reviewed commit at a time | Coordinator bullet, final sentence |
| R4 | Worker reads this section and exactly one packet | Worker bullet, sentence 2 |
| R5 | Worker implements, runs declared checks, returns a `RESULT BLOCK` | Worker bullet, sentence 3 |
| R6 | Worker never commits | Worker bullet, "and never commits" |
| R7 | Auditor is from a different model family than the builder | Auditor bullet, sentence 1 |
| R8 | Auditor receives criteria, candidate diff, changed-file list, focused check output | Auditor bullet, sentence 2 |
| R9 | Auditor never receives the master document, repo tree or a worker transcript | Auditor bullet, "and never the master document, the repository tree or a worker transcript" |
| R10 | On insufficient evidence the auditor names it or requests a bounded excerpt, never infers | Auditor bullet, final sentence |
| R11 | The read limit governs starting context only; never blocks session-produced evidence | Read-limit ¶, sentence 1 |
| R12 | Coordinator always reads RESULT BLOCKs, diff + changed-file list, check/gate output, audit findings, hygiene output, packet-named files | Read-limit ¶, "The coordinator's standing read set is…" |
| R13 | Reading those **is** the required review | Read-limit ¶, final sentence |
| R14 | Never silently substitute a same-family audit (a bigger sibling is not independent review) | Final ¶, sentence 1 |
| R15 | Missing cross-family tooling → mark review-blocked, follow the usage-limit checkpoint, do not integrate | Final ¶, sentence 2 |

## Slice packet contract

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| S1 | A slice is the smallest demonstrably-done thing, not the smallest describable thing | ¶1, sentence 1 |
| S2 | Every packet records the enumerated fields (goal … builder/auditor families) | ¶1, sentence 2 |
| S3 | Copy the bindings' template; do not invent a different shape | ¶1, sentence 3 |
| S4 | A worker's packet always includes this protocol section; "only that packet" bounds reading, not rules | ¶1, final sentence |
| S5 | Before choosing lanes, separate preparation/execution/verification and identify independent deliverables + dependencies | ¶2, sentence 1 |
| S6 | A shared budget/resource/artifact serializes only operations that modify or consume it | ¶2, sentence 2 |
| S7 | Prefer useful parallel work within agent and resource limits | ¶3, sentence 1 |
| S8 | Every concurrent lane must satisfy all three conditions, stated in the packet | ¶3, sentence 2 |
| S9 | Condition 1 — disjoint write ownership; no cross-lane create/move/delete; shared read-only inputs only under condition 3 | Bullet 1 |
| S10 | Condition 2 — no lane runs a repo-wide file-rewriting command; those are the coordinator's, after all lanes finish | Bullet 2 |
| S11 | Condition 3 — lane checks write only to owned paths (temp/generated included); may read named immutable inputs pinned to a commit/hash; must not depend on another lane's unfinished output | Bullet 3 |
| S12 | Record each lane's deliverable, owned paths, immutable inputs, checks, dependencies, handoff checkpoint | ¶4, sentence 1 |
| S13 | Verification tooling may be prepared early, but verifying the candidate waits for a frozen handoff; preparation is not proof | ¶4, sentence 2 |
| S14 | A failed condition → serialize the affected operations and reassess remaining independent work | ¶4, sentence 3 |
| S15 | A single-worker slice names the concrete dependency/resource conflict and the split considered; generic phrases are insufficient | ¶4, sentence 4 |
| S16 | Small tasks may stay single-worker, with the reason stated | ¶4, sentence 5 |
| S17 | Never create workers merely to raise utilization or duplicate an investigation | ¶4, final sentence |
| S18 | Conflicting edits, shared mutable budgets, integration and commits stay serialized | ¶5, sentence 1 |
| S19 | Workers must preserve other sessions' changes | ¶5, sentence 1 |
| S20 | A stalled lane triggers a checkpoint, not reassignment of its owned paths | ¶5, sentence 2 |
| S21 | Change lane ownership only after workers pause and the coordinator updates the packet and reissues assignments | ¶5, sentence 3 |
| S22 | Cross-family audit requirements remain unchanged | ¶5, final sentence |

## Delivery batch and owner checkpoint

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| D1 | Record authorized slice IDs, dependencies, deliverables, acceptance boundaries, stop condition before launching | ¶1, sentence 1 |
| D2 | A free slot is not permission to pull another slice | ¶1, sentence 2 |
| D3 | Expand the batch only with owner authorization; prep/repairs within fixed requirements stay engineering decisions | ¶1, sentence 2 |
| D4 | Prefer accepting built, dependency-ready candidates over more implementation | ¶1, final sentence |
| D5 | Preserve healthy running gates and existing ownership at checkpoints | ¶1, final sentence |
| D6 | One short upfront owner checkpoint for scope decisions and human-only acceptance steps | ¶2, sentence 1 |
| D7 | Record resolved decisions, remaining human actions, required checkpoint; arrange hands-on verification early | ¶2, sentence 1 |
| D8 | Never ask the owner to choose engineering methods, manufacture decisions, or treat advance approval as a walkthrough | ¶2, sentence 2 |
| D9 | Independent authorized work may continue around a blocker | ¶2, final sentence |
| D10 | Keep handoffs compact (identity, status, pointers, unresolved, next action) | ¶3, sentence 1 |
| D11 | Reload unchanged inputs only for a named new question or changed input; retain durable evidence | ¶3, sentence 2 |
| D12 | Report built/verified/accepted/committed separately | ¶3, sentence 3 |
| D13 | Report local test time separately from model/provider usage; mark unavailable usage unknown; never infer **tokens or cost** from runtime or a subscription percentage | ¶3, final sentence, "never inferring tokens or cost from runtime or a subscription percentage" — **restored after audit round 2**; the first candidate wrote "never inferring it", whose antecedent is only "usage", leaving the explicit ban on inferring *cost* without a carrier ("cost" appears elsewhere in the section only in the unrelated "cost-effective" guidance at M2) |

## Writing a missing packet

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| W1 | Writing a missing packet **is** coordination, not a read-limit departure | ¶1, sentence 1 |
| W2 | Without asking permission the coordinator may read exactly the listed inputs and nothing more | ¶1, sentence 2 |
| W3 | The four permitted inputs (template; standing-constraints section; START-HERE-named headings; named design spec limited to that slice's section + dependency/running-order section) | The four bullets, unchanged in substance |
| W4 | Draft from those, then proceed | Final ¶, sentence 1 |
| W5 | Stop for the owner only when goal or acceptance criteria are genuinely undecided | Final ¶, sentence 2 |
| W6 | Permission to read is not a decision and must never be escalated as one; the owner decides scope, not method | Final ¶, final sentence |

## Audit scope and proportional verification

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| A1 | Classify in the packet before work; record reason, applicable checks, review boundary | ¶1, sentence 1 |
| A2 | Behavior and risk set the class, not file count | ¶1, sentence 2 |
| A3 | Doc-only needs coordinator review for accuracy, links, rule consistency + a whitespace/diff check | Bullet 1 |
| A4 | Doc-only requires no external-model audit, application build or UI E2E | Bullet 1, "— no external-model audit, application build or UI E2E" |
| A5 | Doc-only is the exception to the repo-wide gate, runtime closeout command and detached runtime checkout; record the scoped result in the packet or master progress entry | Bullet 1 |
| A6 | Doc-only: review a frozen diff and commit only documentation hunks | Bullet 1 |
| A7 | Executable configuration, generated inputs and runtime prompts are never exempt | Bullet 1, final sentence ("never exempt, here or under any other exception") |
| A8 | Low-risk: focused checks + coordinator diff review, no standalone max-effort audit | Bullet 2 |
| A9 | Low-risk: batch related changes into one named capability-boundary audit where independent review is required | Bullet 2 |
| A10 | Low-risk: runtime gates still apply, including UI journeys for user-visible copy | Bullet 2 |
| A11 | Never use the low-risk class to waive independent closure or disguise a behavior/privacy/security/data-integrity change | Bullet 2, final sentence |
| A12 | Meaningful/high risk: focused outcome-regression proof + bounded cross-family review before integration | Bullet 3 |
| A13 | Supply exact changed evidence and affected invariants; broaden review only when warranted | Bullet 3 |
| A14 | Feature completion: reconcile requirements with source and real end-to-end browser evidence | Bullet 4 |
| A15 | A full review fits that boundary or an owner request, and is not repeated for every small repair | Bullet 4 |
| A16 | One bounded review of a ready candidate, then delta reviews | Closing ¶, sentence 1 |
| A17 | Retain accepted dispositions with candidate/input hashes; reopen only on invalidating change | Closing ¶, sentence 2 |
| A18 | Never re-send the whole repository, re-audit settled decisions, or duplicate reports | Closing ¶, sentence 3 |
| A19 | Record established defects, verification gaps and optional improvements separately | Closing ¶, "Record the three finding categories below separately", defined in `### Findings and escalation` ¶1 |
| A20 | A verification gap needs the missing experiment, not more model opinion | Closing ¶, final clause |
| A21 | Existing packets/templates inherit these rules and preserve owner-selected reviewers, security/privacy/authenticated-canary budgets and release gates | Final ¶ |
| A22 | A documentation exception does not waive validation of executable configuration, generated inputs or runtime prompts | Merged into A7's carrier — "never exempt, **here or under any other exception**" |

## Model routing

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| M1 | Start each kind of work on the model best at it in one shot, not the cheapest that might pass | ¶1, sentence 1 |
| M2 | Cost-effective = least total tokens to *verified* completion, counting missed requirements, retries, audits, repairs | ¶1, sentence 1 (after the colon) |
| M3 | Coordination, slice boundaries, acceptance calls, integration decisions → strong model | ¶1, sentence 2 |
| M4 | Bounded reading, inventories, mechanical edits, status writing → lighter model | ¶1, sentence 2 |
| M5 | Difficult or high-stakes implementation → strong model | ¶1, sentence 2 ("difficult or high-stakes implementation take a strong model") |
| M6 | Choose audit effort from risk and unanswered questions, not max by default | ¶2, sentence 1 |
| M7 | Routine bounded reviews at ordinary effort; reserve high/max for difficult, high-stakes or broad reviews | ¶2, sentence 2 |
| M8 | Record requested model/effort and the actual result; a failed startup is not a completed audit | ¶2, final sentence |
| M9 | At a usage limit, first record lane, evidence, blocker, retry condition in packet and master | ¶3, sentence 1 |
| M10 | Pause that provider; never repeatedly probe quota or silently change a user-required reviewer | ¶3, sentence 2 |
| M11 | Continue dependency-ready work in authorized scope where ownership/inputs are independent (browser verification, evidence prep, other repairs, separately accepted doc change) | ¶3, sentence 3 |
| M12 | Required review remains an integration gate for the blocked candidate | ¶3, sentence 4 |
| M13 | Ending work on that candidate without an accepted deliverable takes the stopping-without-acceptance branch | ¶3, sentence 4 |
| M14 | Separately scoped accepted changes use the accepted closeout; keep blocked candidates out of that commit | ¶3, final sentence |

## Usage discipline

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| U1 | Optimize total model work to verified completion, counting context, coordination, retries, review | ¶1, sentence 1 |
| U2 | A safe split alone is insufficient (qualifies the parallel-work preference) | ¶1, sentence 2 |
| U3 | Record each extra lane's useful independent result and expected benefit in one packet line | ¶1, sentence 3 |
| U4 | Keep work serial when another agent would repeat context or add bookkeeping | ¶1, final clause |
| U5 | Fresh packet-sized worker context for unrelated work | ¶2, sentence 1 |
| U6 | Reuse a worker for related repairs when retained context saves investigation; preserve ownership until a frozen handoff | ¶2, sentence 2 |
| U7 | Record worker model and effort with the assignment | ¶2, sentence 3 |
| U8 | Apply Model routing to mechanical work as well as implementation | ¶2, sentence 3 |
| U9 | Never use the strongest worker merely because it is already available | ¶2, final clause |
| U10 | Use completion notifications; poll only for a missing notification, deadline, suspected stall or concrete intervention; never re-inspect unchanged progress | ¶3, sentences 1-2 |
| U11 | Scripts emit command, exit code, counts, candidate identity, short result; raw logs/screenshots/manifests stay on disk | ¶3, sentence 3 |
| U12 | Coordinator reviews the candidate diff, RESULT BLOCKs, audit findings, check summaries, loading further evidence only for a named acceptance question or failure | ¶3, sentence 4 — "reviews its standing read set under Roles", the set enumerated at R12 |
| U13 | Never duplicate evidence bundles or narrate their contents | ¶3, sentence 4 |
| U14 | This limits context overhead, not required outcome tests, visual inspection or independent review | ¶3, final sentence |
| U15 | Closeout once per completed coherent capability, not after every worker/command/repair | ¶4, sentence 1 |
| U16 | Compact when continuing unfinished related work | ¶4, sentence 2 |
| U17 | Prefer a fresh coordinator chat at the next substantial capability boundary; keep only short resume pointers | ¶4, sentence 2 |
| U18 | Neither compaction nor fresh chats substitute for these controls | ¶4, sentence 3 |
| U19 | Never make the owner monitor workers or restate this policy in session prompts | ¶4, final sentence |

## Worker contract

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| WC1 | A worker returns a compact `RESULT BLOCK` and nothing else, with the five named fields | Sentence 1 |
| WC2 | Never relay worker transcripts or re-summarize the plan; cite section headings | Sentence 2 |

## Completion sequence

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| C0 | This order applies to runtime/tooling candidates; doc-only changes use their scoped gate | Intro, sentence 1 |
| C0b | Never start an expensive repo-wide gate while known audit or repair work remains | Intro, sentence 2 |
| C0c | Independent focused browser work may proceed during review outages | Model routing ¶3, "Continue dependency-ready work in authorized scope … browser verification …" — same permission, stated once |
| C1-C9 | The nine ordered steps (implement only the slice; declared + regression checks; fix focused failures; cross-family audit when required; reproduce/repair findings + independent closure; freeze on a detached checkout, never review a live tree, review-blocked cannot pass; repo-wide gate + UI journeys on the frozen candidate, full check once and last; mandatory closeout gate; coordinator reviews and commits only after acceptance, audit closure and a passing gate, master current in the same commit) | Numbered list 1-9, substance unchanged |
| C10 | A defect found by the final gate: repair, rerun affected checks, independent review of any material change, rerun the gate on a new frozen candidate | ¶ after the list |
| C11 | Verify a gate by its exit code; a `\| tail` pipe reports success when the gate failed | Final line of the subsection |

## Mandatory closeout gate

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| MC1 | Every worker slice finishes through the bindings' closeout gate | Sentence 1 |
| MC2 | It runs the declared check, retains only this slice's bounded evidence, persists `PASS` or an actionable leftover list | Sentence 1 |
| MC3 | Where no such tool exists, the coordinator records `PASS` or the leftover list in the packet before the slice can close | Sentence 2 |

## Findings and escalation

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| F1 | The auditor must separate established defects, verification gaps and optional improvements | ¶1, sentence 1 |
| F2 | Every material finding becomes a builder checklist item with evidence, an acceptance test or reproduction, a state invariant where relevant, and a symbol/file search over every other use | ¶1, sentence 2 |
| F3 | Close each item with a fix plus evidence, or an explicit supported disposition | ¶1, sentence 3 |
| F4 | Never expand scope for speculative suggestions | ¶1, final sentence |
| F5 | Two repair cycles on one finding with no new evidence → stop, call it engineering-blocked | ¶2, sentences 1-2 |
| F6 | Record the finding, what was tried and the failing output in the packet, then take the stopping-without-acceptance branch | ¶2, sentence 2 |
| F7 | Tell the owner it is blocked on engineering, not a scope decision | ¶2, final sentence |
| F8 | Skipped files / omitted verification / early stopping → raise effort one notch on the same model | ¶3, sentence 1 |
| F9 | A structural blind spot → change model or builder family | ¶3, sentence 2 |
| F10 | Change one variable at a time | ¶3, final sentence |
| F11 | Keep the auditor independent of whoever implements the repair | ¶3, final sentence |
| F12 | The owner decides product scope; engineering questions, including route choice, are yours | ¶4, sentence 1 |
| F13 | An unmeetable countable target becomes a sourcing requirement in the plan, never a reduced request | ¶4, sentence 2 |

## Verify the outcome, not the call

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| V1 | Asserting an argument was passed proves nothing; assert the observable outcome | ¶1 |
| V2 | Agents own frontend functional QA before asking the owner for design judgment | ¶2, sentence 1 |
| V3 | Use the repo's Playwright CLI/test runner or declared browser equivalent on real journeys, not only components | ¶2, sentence 2 |
| V4 | Each UI packet names journey + error/recovery paths, viewport(s), flag state, fixture vs live backend, observable assertions | ¶2, sentence 3 |
| V5 | Reuse relevant tests; add coverage where a required outcome is absent, not tests that mirror code | ¶2, final sentence |
| V6 | Retain candidate/build identity, command, exit code, passed/failed/skipped counts and reasons, screenshots/traces or print output where needed | ¶3, sentence 1 |
| V7 | A passing flags-OFF suite is not feature proof: run the journey with the feature enabled in an isolated local instance | ¶3, sentence 2 |
| V8 | Never change production flags or the owner's preview | ¶3, sentence 2 |
| V9 | Mocked responses are controlled UI behavior, not live backend integration | ¶3, final sentence |
| V10 | Before claiming complete, cover the required journey matrix (responsive, theme, loading/error, persistence, accessibility, print where applicable) | ¶4, sentence 1 |
| V11 | Compare the required prototype experience and run a bounded live-backend journey where a backend exists, within existing authorization and canary budgets | ¶4, sentence 1 |
| V12 | **Static** or entirely local journeys record live integration as not applicable and prove real local behavior | ¶4, sentence 2, "Static or entirely local journeys record that live integration is not applicable…" — **restored after audit**; the first candidate wrote only "Entirely local journeys", dropping the static category and narrowing the rule |
| V13 | Report blocked live steps separately and continue independent controlled/browser coverage | ¶4, sentence 3 |
| V14 | The owner reviews subtle visual and product decisions and is not the first functional smoke tester | ¶4, final sentence |

## Stopping without acceptance

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| X0 | A session stopping before acceptance (owner decision, usage, engineering-blocked, no cross-family tooling) still closes out, on this branch | Intro ¶ |
| X1 | Never commit the candidate; leave the working tree as it stands | Step 1 |
| X2 | Run the bindings' hygiene command so nothing is silently lost | Step 2 |
| X3 | Record blocker, what was verified, retained paths, single next action under a `## Stopped` heading | Step 3 |
| X4 | Rewrite START HERE to that packet and blocker; commit **only** the packet and the master edit, with a not-accepted message | Step 4 |
| X5 | Print the master document's full path and the repository root, then stop | Step 5 |
| X6 | The branch is always available; no session needs an accepted slice to end; none may end leaving the master stale | Closing ¶ |

## Closeout

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| K1 | Run the bindings' closeout gate and record `PASS` or the leftover | Step 1 |
| K2 | Run the hygiene command; commit or delete every untracked path **this session created**, reporting each by name | Step 2 |
| K3 | A path this session did not create is reported and left in place; never delete or commit another session's work, even in your own worktree | Step 2 |
| K4 | Never leave a committed file beside an untracked twin; "Clean" is not a report | Step 2 |
| K5 | Coordinator reviews the final diff and commits, master updated in the same commit | Step 3 |

## Ending a session

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| E0 | Run in order; document edits come **before** the hygiene pass and the commit | Intro ¶ |
| E1 | Not accepted → use `### Stopping without acceptance` and stop there; otherwise run the closeout through step 1 | Step 1 |
| E2 | Rewrite START HERE **in place**, 15 lines maximum, pointers only, with the six named fields | Step 2 |
| E3 | Append narrative to `## Progress log`; never rewrite a completed dated section | Step 3 |
| E4 | A spec in its own file gets a two-way breadcrumb; the spec is design only and its top block redirects here | Step 4 (the "master is the single source of truth" half is P2 in the preamble) |
| E5 | Run the hygiene command and settle every path it lists per the closeout rule | Step 5, "Run `### Closeout` steps 2 and 3: the hygiene pass, settling every path it lists" |
| E6 | Review the final diff and commit it, master included in the same commit | Step 5, "then the final-diff review and commit with the master document in it" |
| E7 | Print the master document's full path and the repository root, then stop | Step 6 |

## Packet size discipline

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| Z0a | A slice packet is a specification, not a session log | Subsection lead line, "A packet is a specification, not a session log" — **restored after audit**; first candidate dropped it as rationale, which the Codex audit correctly rejected: it is the framing rule the archival bullets presuppose |
| Z0b | A packet is read in full, at the start of every session (two obligations: completeness and timing) | Same lead line, "every session reads it in full at its start" — **restored after audit**; first candidate left only a bare "reads", losing both "in full" and the per-session timing |
| Z1 | Cap a packet at 12 KB / 12288 B, roughly 3,000 tokens; measure bytes, not lines | Bullet 1 (the pre-trim "12 KB" is now the exact `12288 B` used by the bindings) |
| Z2 | Exactly one `## Stopped` section per packet, at most 4 KB | Bullet 2, sentence 1 |
| Z3 | A frozen handoff is pointers to evidence, never the evidence itself | Bullet 2, sentence 2 |
| Z4 | Superseded `## Stopped` sections, completed `RESULT BLOCK`s and dated session records move to `SLICE-<ID>-LOG.md`, newest first | Bullet 3 |
| Z5 | No session reads that log file | Bullet 3, final sentence |
| Z6 | A session cut off mid-work writes down everything it knows; that dump is correct, not a cap violation | Bullet 4, sentence 1 |
| Z7 | The resuming session compresses it to pointers as its first act, before anything else | Bullet 4, sentence 2 |
| Z8 | Never compress another session's handoff without having read it | Bullet 4, final sentence |
| Z9 | This protocol section is capped at 24 KB / 24576 B; an over-cap section is trimmed at the next closeout, not appended to | Bullet 5 (exact `24576 B`, matching the bindings) |
| Z10 | At either cap, archive or compress; nothing is appended past a cap | Bullet 6 |
| Z11 | At closeout print the three read-set byte sizes (this section, START HERE, the packet read) | Bullet 7 |

## Effort tiers

| # | Pre-trim rule (brief) | Post-trim carrier |
| --- | --- | --- |
| T1 | Bind model and effort to the job, not to the session | ¶1, sentence 1 |
| T2 | Tiers are named by strength, never by provider | ¶1, sentence 2 |
| T3 | The four job→tier bindings | Table, unchanged |
| T4 | Workers default to a mid-tier model at medium effort | ¶2, sentence 1 |
| T5 | Escalate a worker only on packet-declared high risk or a failed first pass | ¶2, sentence 2 |
| T6 | Auditors keep the cross-family rule; family matters more than tier | ¶2, final sentence |
| T7 | Writing a packet and running it are separate sessions | ¶3, sentence 1 |
| T8 | A packet session reads this section, START HERE and cited headings, writes one packet, spawns no workers, ends | ¶3, sentence 2 |
| T9 | Before ending, that packet session rewrites the one START HERE line — planned ID replaced by the packet path, marked dependency-ready — and commits that single-line edit with the packet | ¶3, sentence 3 |
| T10 | A closeout session names a next slice by ID only, no path | ¶3, sentence 4 |
| T11 | An execution session runs an existing packet; with no written dependency-ready packet named it stops and asks for a packet session instead of switching modes mid-session at the wrong tier | ¶3, final sentence |

## Rationale removed (no obligation, therefore no row above)

Nine explanatory sentences or clauses were deleted outright rather than compressed. None states a
MUST / NEVER / ALWAYS / "do not" / "only" or a sequence step; each explained a rule stated elsewhere
and still present.

1. Preamble — "Session prompts stay short because they point here" (kept in shortened form).
2. Roles — "A bigger sibling of the builder is not independent review" survives, folded into the
   same-family ban's sentence rather than standing alone.
3. ~~Packet size discipline — "A slice packet is a specification, not a session log. It is read in
   full at the start of every session…"~~ **Withdrawn.** The Codex audit established this as two
   normative statements, not rationale. Restored as rows Z0a and Z0b above. Only its trailing
   "so its size is a recurring cost paid by every future session" clause stays removed.
4. Packet size discipline — "A packet can hold 30 KB in 300 lines when its prose is unwrapped, so a
   line count hides the real cost" (rationale for "measure bytes, not lines", Z1).
5. Packet size discipline — "It exists so the packet can stay small" (rationale for Z4/Z5).
6. Packet size discipline — "A number in the log is what stops slow drift" (rationale for Z11).
7. Packet size discipline — "an ending session cannot tell what the next one will need" and "it has
   just read the dump, so it is the cheapest and safest place to decide what mattered" (rationale
   for Z6/Z7).
8. Effort tiers — "The coordinator does two jobs whose cost differs by an order of magnitude"
   (rationale for T1).
9. Effort tiers — "Without this handshake the pointer stays one step behind and the execution
   session refuses work that is already ready" (rationale for T9/T11, both still stated).

## Cross-subsection carriers, stated once instead of twice

Three obligations appeared twice in the pre-trim text. Each is still stated in the section; the
second statement became a pointer rather than a restatement.

- R12 / U12 — the coordinator's standing read set. Enumerated under `### Roles`; `### Usage
  discipline` now points at it and keeps its own extra rules (U13, U14).
- A19 / F1 — the three finding categories. Defined in `### Findings and escalation`; `### Audit
  scope` now refers to them and keeps its own "record them separately" obligation.
- A7 / A22 — executable configuration, generated inputs and runtime prompts are never exempt. Both
  statements now ride the single clause "never exempt, here or under any other exception".
- C0c / M11 — independent browser work may continue during a review outage. Stated once, in
  `### Model routing`'s usage-limit paragraph, which is where the outage case is handled.

## Cross-family audit disposition

Codex (GPT family), bounded inputs per the packet: pre-trim and post-trim section text, the unified
diff, the changed-file list, the acceptance criteria. Verdict returned. Structure and all seven
spot-check rules passed; size under cap.

Three established defects, all dropped normative statements, all fixed — no dispositions taken in
lieu of a fix:

1. "A slice packet is a specification, not a session log" — restored, row Z0a.
2. "Read in full at the start of every session" — restored, row Z0b.
3. Static journeys dropped from the frontend live-integration rule — restored, row V12.

Repair cost +104 B: 24444 → 24548, still under the 24576 B cap.

### Round 2

Re-audit on the repaired candidate (a fresh full sweep, since the file changed). All three round-1
repairs confirmed carried. One further established defect, introduced by the original compression
pass rather than by the repairs:

4. "never infer **tokens or cost** from runtime or a subscription percentage" had been narrowed to
   "never inferring **it**", losing the explicit cost ban — restored, row D13.

Repair cost +12 B: 24548 → **24560**, under the 24576 B cap with **16 B margin**.

The round-2 sweep also caught a file-hygiene regression outside the rule inventory: the section
splice had removed `AGENTS.md`'s end-of-file newline, which `git diff --check` does not flag and the
outside-section line comparison missed. Restored; the file ends with a newline as it did at `HEAD`.
It costs nothing in the measured section, because the extraction `awk` terminates every line it
prints regardless.

The ≤ 24000 stretch target remains unmet and non-blocking; restoring rules took precedence over it in
both rounds, as the packet directs.
