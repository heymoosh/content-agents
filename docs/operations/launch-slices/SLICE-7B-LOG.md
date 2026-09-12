# SLICE-7B log

Companion record for `SLICE-7B.md`. No session reads this file; the packet is the specification.
Newest first.

## Independent audit — 2026-09-12 — Grok, PASS WITH FINDINGS

Auditor: Grok, per `## Families` (Codex capped until 2026-09-15, never a Claude auditor). Verdict:
**PASS WITH FINDINGS. Zero P0, zero P1, one P2.** The coordinator authorized applying the P2 and
nothing else.

### P2, applied: the retry leg did not state its own vehicle

`src/review/publishing-status.test.ts`, the retry success leg of "a newly approved row with an
empty ledger remains retryable after discovery fails before dispatch".

The finding: the SLICE-7B fixture repair moved that leg's vehicle from "empty authoritative
registry, so Typefully is selected" to "registry advertises x/text, so Postiz is selected". The
assertions were byte-identical, which is what the adjudication required, but none of them checks
which provider was chosen, and `tf-retry` is only the test's own scheduler stub's object id. So the
test name no longer told a reader anything about the route, and a future regression that broke
provider selection on the retry path would have left it green. Not a correctness bug: the first leg,
which is the actual subject, is untouched, and Grok confirmed that.

Fix, Grok's first option, taken on the coordinator's instruction. One assertion ADDED as the last
line of the leg. The field name was checked against `PublishingStatus` in
`src/review/publishing-status.ts:26` and against the sibling test at `:322`, not assumed:

```ts
    // SLICE-7B audit P2. The three asserts above are byte-identical to what they were, but none of
    // them names the route, and `tf-retry` is only the stub's object id. State the vehicle the
    // retry actually uses now, so a regression in provider selection on the retry path cannot pass
    // here unnoticed.
    assert.equal(retried.publishing.provider, "postiz", "the retry selects the channel the registry advertises");
```

Nothing was removed, loosened, reworded or renamed. The whole-file diff confirms it: the only
removed line in `publishing-status.test.ts` is the original `capabilities: []` fixture line from the
adjudication, and no assertion or test name appears on any removed line.

Not vacuous, proved rather than asserted: with the expected value flipped to `"typefully"` the test
fails (`not ok 7 - a newly approved row with an empty ledger remains retryable after discovery fails
before dispatch`, 33 tests, 32 pass, 1 fail), and it was restored immediately afterwards.

Grok's second option, reverting the vehicle to `postizEnv: {}`, was explicitly NOT taken: the
coordinator ruled the Postiz vehicle the more honest one now that empty-registry-text is no longer
a production path.

### Confirmed by the audit, no action required

- Scope decision 2 holds: the neither-env-set case is identical to HEAD, verified both by reading
  the new half-config gate and by running `selectConfiguredProvider(textRow, { postizEnv: {} })`.
- The discovery-failed string and the discovery-says-no string stay distinct; they are not collapsed
  into one message.
- No branch publishes where it previously refused.
- All seven Category 2 fixture repairs pass against reverted production, the correct vehicle-only
  signature, and none is vacuous.
- Nothing deleted, nothing skipped, no `.only`.
- The contract rewrite is sound and load-bearing.

### Post-fix verification

```sh
npx tsc --noEmit -p tsconfig.json                       # exit 0
node --import tsx --test src/publish/postiz.test.ts src/review/studio-scheduling.test.ts \
  src/review/studio-scheduling-postiz.test.ts src/review/studio-scheduling-postiz-reuse.test.ts \
  src/review/publishing-status.test.ts src/review/studio-scheduling-media-fallback.test.ts
                                                        # exit 0, 154 pass / 0 fail / 0 skip / 0 todo
```

Identical counts before and after the P2 fix, with the repaired test named `ok` in the output.
`npm run check` and `npm run test:e2e` were again not rerun, per the coordinator: the other worker's
edits are in the tree and a second audit is in flight, so the full gate is the coordinator's to run.

Changed by this audit round: `src/review/publishing-status.test.ts` only, one assertion and its
comment added. No other file was touched, no commit or stage was made, `.env` was not read, and no
network or provider call was made.

## Lane A worker — 2026-09-12 — STOPPED for coordinator adjudication

### Diagnosis

`x-1` of `2026-09-07-the-world-s-broken-what-do-we-do-human-inference` sat on Typefully with
"No planned time recorded" while its `bluesky` and `threads` siblings held real Postiz planned
times. One line decided it.

`selectDeliveryRoute` (`src/publish/postiz.ts:368` at HEAD) read:

```ts
if (["x", "linkedin", "bluesky"].includes(destination) && ["text", "image"].includes(media)) return "typefully";
```

That line fires **after** the authoritative Postiz check above it. So whenever live discovery
succeeded and simply did not list `x`, the function answered `typefully` for a **text** row, and
`selectConfiguredProvider` (`src/review/studio-scheduling.ts:169` at HEAD) passed it straight
through as `{ provider: route }`. No throw, no ledger signal, no Studio message. The row landed on
a provider whose scheduling behavior differs from its siblings' and nobody was told.

The `image` half of the same line is a different animal: it is the configured-media backup route
`cards.ts` owns (`mediaFallbackTarget`, 6-series accepted), reached only through
`legacyProvider(kind, row)` for `kind === "media"`. It is out of scope and is preserved verbatim.

Path 1, `configured` (`studio-scheduling.ts:144` at HEAD), was a second silent route:

```ts
const configured = Boolean(deps.fetchPostizRegistry || (env.POSTIZ_BASE_URL?.trim() && env.POSTIZ_API_KEY?.trim()));
```

`&&` collapses three different situations into one boolean. Neither variable set is Muxin
deliberately running without Postiz, which the packet keeps working. Exactly one set is a broken
deployment, and it used to look identical to the deliberate case and quietly take the legacy route.

### Design

Three edits, two production files.

1. `src/publish/postiz.ts` — `selectDeliveryRoute` drops `text` from the x/linkedin/bluesky
   fallback and keeps `image`:

   ```ts
   if (["x", "linkedin", "bluesky"].includes(destination) && media === "image") return "typefully";
   ```

   A text destination discovery does not list now falls to `return "unsupported"`, which
   `selectConfiguredProvider` already treats as a refusal for every non-media kind. The refusal is
   raised in `selectConfiguredProvider`, not here, because `DeliveryRoute` is an enum and cannot
   carry a message.

2. `src/review/studio-scheduling.ts` — a new `postizChannelNotConnected(destination)` string,
   raised only when `route === "unsupported"` and `shape.media === "text"`. The generic
   `no delivery provider supports ${destination}/${media}` stays for every other unsupported shape.

3. `src/review/studio-scheduling.ts` — the half-configured refusal, placed where `configured` was
   computed. Gated on `!deps.fetchPostizRegistry` so the injected test/embedding seam is unaffected,
   and on `Boolean(baseUrl) !== Boolean(apiKey)` after trimming, so a whitespace-only value is
   still "unset" and still the deliberate no-Postiz case.

Fail-closed choices made along the way:

- The half-config refusal fires for **every** schedulable kind, media included. A half-configured
  deployment is broken, and blocking a channel is recoverable while posting to the wrong account is
  not. `legacyProvider` itself and the `unsupported`-branch media path are untouched.
- The unsupported-text refusal is worded for any text destination, not just the three. `threads`,
  `mastodon` and `facebook` text already threw here; they now throw a message that names the cause
  and the fix instead of `no delivery provider supports threads/text`.
- A `quote-card:*` row whose `format` is not `image`/`video`/`short` maps to `media: "text"` in
  `postizShape` and so now refuses rather than reaching the Typefully card publisher. No such row
  shape exists in the repository's fixtures or tests; every card row carries `format: "image"`.
  Refusing is the recoverable direction.

### Refusal strings, verbatim

```
Postiz does not have ${destination} connected, so this row has nowhere to go. Connect ${destination} in Postiz, add its account id to POSTIZ_ACCOUNT_IDS, then approve the row again.
```

```
Postiz is only half configured: POSTIZ_BASE_URL is set but POSTIZ_API_KEY is not. Set POSTIZ_API_KEY to schedule through Postiz, or clear POSTIZ_BASE_URL to schedule without it.
```

```
Postiz is only half configured: POSTIZ_API_KEY is set but POSTIZ_BASE_URL is not. Set POSTIZ_BASE_URL to schedule through Postiz, or clear POSTIZ_API_KEY to schedule without it.
```

Voice: run through the repository's own `muxinVoiceFindings` (`src/voice/configured.ts`). All three
return `[]`. Zero em dashes in any added production line. Each names the destination or the variable
and each ends with the next action. Only variable NAMES appear, never a value; an account id is a
non-secret audit identity and is the thing Muxin has to paste, so it stays.

Preserved byte-identical, quoted from the working tree (`studio-scheduling.ts:176-180`, HEAD
`:153-157`; `diff` against `git show HEAD:` reports no change):

```ts
  } catch (error) {
    // A transport/config failure is not authoritative evidence that Postiz lacks the capability.
    // Fail closed so an ambiguous discovery result cannot silently bypass the Postiz-first route.
    throw new Error(`Postiz capability discovery failed; provider route is uncertain: ${error instanceof Error ? error.message : String(error)}`);
  }
```

### Checks

| Command | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | 0 | clean |
| `node --import tsx --test src/publish/postiz.test.ts src/review/studio-scheduling.test.ts` | 0 | 66 pass, 0 fail, 0 skip (10 suites) |
| `npm run check` (pre-adjudication) | 1 | 4498 tests, 4490 pass, **8 fail**, 0 skip, 0 todo, 204.3 s. All 8 were pre-existing tests in files this lane did not own, now resolved under `### Adjudication`. |
| `npm run test:e2e` (pre-adjudication) | 0 | 55 pass, 0 fail, 16 blocked. `"failures": []`. Isolation: "shared worktree byte-identical after disposable passes." |
| post-adjudication `npx tsc --noEmit -p tsconfig.json` | 0 | clean |
| post-adjudication focused run over all six owned and adjudicated test files | 0 | **154 pass, 0 fail, 0 skip, 0 todo** |
| `muxinVoiceFindings` on the three refusal strings | 0 | `[]`, `[]`, `[]` |

The post-adjudication focused command is:

```sh
node --import tsx --test src/publish/postiz.test.ts src/review/studio-scheduling.test.ts \
  src/review/studio-scheduling-postiz.test.ts src/review/studio-scheduling-postiz-reuse.test.ts \
  src/review/publishing-status.test.ts src/review/studio-scheduling-media-fallback.test.ts
```

`npm run check` and `npm run test:e2e` were deliberately NOT rerun after the adjudication: a second
worker is editing `src/review/reconcile.ts` and `src/review/rows.ts` in this same checkout, so a
repository-wide gate would neither be isolated nor attributable. The coordinator runs the full gate
once both jobs land. `tsc` reported no error in either of that worker's files.

Every command was run unsandboxed. No live provider or network call was made: discovery is a stub
(`deps.fetchPostizRegistry`) or an env-only early return in every new test, and the half-config
refusal throws before `fetchPostizCapabilities` is ever reached.

E2E journey note, stated plainly as the packet asks: **no existing e2e pass covers this journey.**
Pass F exercises Publishing-room approval, refusal recovery and refusal layout, but
`publishing-status.ts`'s `disposableProviderOutcome` seam injects the provider for the disposable
harness and short-circuits `selectConfiguredProvider` entirely, so no e2e pass reaches the routing
decision this slice changes. None was added.

### Load-bearing

Method: both production files were overwritten with `git show HEAD:<path>`, the two owned test
files left exactly as written, the focused command rerun, then the production files restored from
copies and the diff confirmed intact. No git write of any kind.

Reverting production alone: **9 fail, 57 pass** of 66.

| Test | File | Fails on revert | Acceptance box |
| --- | --- | --- | --- |
| `uses discovered Postiz support first and keeps explicit fallbacks` | postiz.test.ts | yes | the one existing assertion this slice changes |
| `x/text is unsupported when discovery does not list it` | postiz.test.ts | yes | refuses, not `typefully` (x) |
| `linkedin/text is unsupported when discovery does not list it` | postiz.test.ts | yes | refuses, not `typefully` (linkedin) |
| `bluesky/text is unsupported when discovery does not list it` | postiz.test.ts | yes | refuses, not `typefully` (bluesky) |
| `a x text row refuses by name instead of returning typefully` | studio-scheduling.test.ts | yes | names `x`, exact string |
| `a linkedin text row refuses by name instead of returning typefully` | studio-scheduling.test.ts | yes | names `linkedin`, exact string |
| `a bluesky text row refuses by name instead of returning typefully` | studio-scheduling.test.ts | yes | names `bluesky`, exact string |
| `the Publishing room surfaces that refusal and no publisher runs` | studio-scheduling.test.ts | yes | observable outcome: `scheduleError`, zero publisher calls |
| `exactly one Postiz variable set is a broken configuration and refuses by name` | studio-scheduling.test.ts | yes | broken-configuration case, both directions |
| `x\|linkedin\|bluesky/text is still postiz when discovery does list it` (3 tests) | postiz.test.ts | no, regression pin | registry DOES list it, route still `postiz` |
| `the configured-media image backup route is unchanged for all three` | postiz.test.ts | no, regression pin | media rows unchanged |
| `every non-text route is unchanged` | postiz.test.ts | no, regression pin | facebook / tiktok / youtube / substack pinned |
| `a listed destination still routes to postiz, and 6Y still picks the account` | studio-scheduling.test.ts | no, regression pin | `resolveConfiguredPostizCapability` still decides; 6Y refusal byte-identical |
| `with no Postiz configured at all, a text row still goes to typefully exactly as today` | studio-scheduling.test.ts | no, regression pin | the repo must work with no Postiz |
| `media rows are untouched: the Typefully backup route and the unsupported branch both stand` | studio-scheduling.test.ts | no, regression pin | both media legs pinned |

The nine are the proof; the six pins are the regressions the acceptance list names explicitly. 6Y's
second refusal message (`N approved Postiz accounts advertise …`) is already pinned verbatim at
`src/publish/postiz.test.ts:452` and still passes untouched; its first is pinned at
`src/review/studio-scheduling.test.ts:315` and additionally re-pinned inside the new 7B block.

#### Rewritten contract test, and proof the seven repairs stayed orthogonal

Same method, rerun after the adjudication over the three adjudicated files
(`studio-scheduling-postiz.test.ts`, `studio-scheduling-postiz-reuse.test.ts`,
`publishing-status.test.ts`): production reverted to HEAD, tests left exactly as written.

Result: **73 tests, 72 pass, 1 fail.** The single failure is

```
not ok 11 - an authoritative registry without the destination refuses a text row instead of falling back to Typefully
```

That is the Category 1 rewrite, and it is therefore load-bearing: reverting the production change
alone makes it fail. All seven Category 2 fixture repairs pass under BOTH reverted and new
production, which is the signature of a vehicle-only change: their subjects never depended on the
rule this slice altered, and they still do not.

Independent corroboration that no assertion or name moved outside the one authorized rewrite: over
the whole diff of the three adjudicated files, the ONLY changed lines matching `assert.` or `test(`
are the six belonging to that rewrite (one `test(` name pair, three assertion pairs). Every other
changed line in those files is a fixture expression or a comment.

### Adjudication: eight existing tests encoded the old rule — RESOLVED

The packet's `## Verify` names one existing assertion (`src/publish/postiz.test.ts:20`) and
instructs that any OTHER existing test encoding the old rule be quoted, not edited, and the worker
stop. Eight were found, all outside `## Owned files`. The worker stopped and quoted them. The
coordinator adjudicated on 2026-09-12 and authorized edits to the three files, splitting the eight
into one contract rewrite and seven fixture-only repairs. Both dispositions are below.

`src/publish/postiz.test.ts:20` itself is handled separately, in `### Load-bearing`: the packet
authorized that one line directly, and it became `assert.equal(selectDeliveryRoute(registry,
"linkedin", "text"), "unsupported");` with a new sibling line pinning the surviving image leg.

#### Category 1, one test: the contract test, rewritten

`src/review/studio-scheduling-postiz.test.ts`. Its SUBJECT was the rule this slice removes, so it
was rewritten to assert the new contract rather than fixture-patched or deleted. The scenario is
unchanged: `deps(false, calls)` supplies a registry advertising only `youtube`/`video`, discovery
succeeds and is authoritative, and `row()` is `{ id: "x-1", platform: "x", format: "text" }`.

Before:

```ts
test("legacy provider fallback occurs only after discovered registry says capability is unsupported", async () => {
  const calls: string[] = [];
  const result = await scheduleApproved("/unused", row(), deps(false, calls));
  assert.deepEqual(calls, ["typefully"]);
  assert.equal((result.scheduled as { draftId: string }).draftId, "tf-1");
  assert.equal(result.scheduleError, null);
});
```

After:

```ts
// SLICE-7B rewrote this test's contract on the owner's decision. It used to be named "legacy
// provider fallback occurs only after discovered registry says capability is unsupported" and
// asserted that an authoritative registry without x/text handed the row to Typefully — the silent
// downgrade this slice removes. Same scenario, opposite verdict: nothing is published, and Muxin is
// told which channel Postiz is missing.
test("an authoritative registry without the destination refuses a text row instead of falling back to Typefully", async () => {
  const calls: string[] = [];
  const result = await scheduleApproved("/unused", row(), deps(false, calls));
  assert.deepEqual(calls, [], "no publisher may be reached for a row that has nowhere to go");
  assert.equal(result.scheduled, null);
  assert.equal(result.scheduleError, "Postiz does not have x connected, so this row has nowhere to go. Connect x in Postiz, add its account id to POSTIZ_ACCOUNT_IDS, then approve the row again.");
});
```

The old test name is preserved verbatim inside the new comment, so the history of the contract is
not lost. Load-bearing proof is in `### Load-bearing`, `#### Rewritten contract test`.

#### Category 2, seven tests: fixture only

Each was testing something orthogonal and only reached for a Typefully text route as a convenient
non-Postiz path. In every one the assertion under test is byte-identical and the test name is
byte-identical; only the vehicle moved.

Five of the seven take the same one-line swap. `stubDeps` spreads its override last, so passing
`postizEnv: {}` and omitting `fetchPostizRegistry` selects the deliberate no-Postiz case the packet
preserves. `selectConfiguredProvider` then returns `legacyProvider("text", row)`, which is the
identical `{ provider: "typefully" }` value the old vehicle produced, so every line of
`scheduleApproved` downstream of the selection runs on the same code path as before.

| file:line (pre-edit) | real subject | fixture before | fixture after | assertion |
| --- | --- | --- | --- | --- |
| `studio-scheduling-postiz.test.ts:65` | a legacy (non-Postiz) route still asserts its exact provider account env var | `await scheduleApproved(folder, row(), configured)` | `await scheduleApproved(folder, row({ id: "card-1", platform: "quote-card:x", format: "image", asset: "images/card.png" }), configured)` | `assert.match(result.scheduleError ?? "", /CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID is missing/);` byte-identical, plus `assert.deepEqual(calls, []);` byte-identical |
| `studio-scheduling-postiz-reuse.test.ts:248` (leg 1) | the Postiz pre-flight reuse gate does not gate a legacy route; its own publisher still runs | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]) })` | `stubDeps({ postizEnv: {} })` | `assert.deepEqual(reached.routes, ["typefully-text"], "publishText still runs and still makes its own call");` and `assert.equal(result.scheduleError, null, "the pre-flight did not veto a route it does not own");` both byte-identical |
| `studio-scheduling-postiz-reuse.test.ts:248` (leg 2) | the `done.length === 0` recovery branch is still reached on a legacy route | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => [] })` | `stubDeps({ postizEnv: {}, publishText: async () => [] })` | `assert.equal(recovered.scheduled, null);` and `assert.match(recovered.scheduleError ?? "", /^blocked by reuse guard, last placed to x /);` both byte-identical |
| `studio-scheduling-postiz-reuse.test.ts:271` | the recovery branch's generic wording survives when the publisher skips for a reason the guard cannot name | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => [] })` | `stubDeps({ postizEnv: {}, publishText: async () => [] })` | `assert.equal(result.scheduleError, "not scheduled: blocked by the reuse guard (check the server log for the reason)");` byte-identical |
| `studio-scheduling-postiz-reuse.test.ts:532` | the P0 discriminant: recovery emits the SAME same-row wording as the pre-flight but is `publisher-declined` | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => { ran.push("typefully-text"); return []; } })` | `stubDeps({ postizEnv: {}, publishText: async () => { ran.push("typefully-text"); return []; } })` | all three asserts byte-identical, including `assert.equal(result.refusal, "publisher-declined", "an empty result is not proof that nothing was created");` |
| `studio-scheduling-postiz-reuse.test.ts:550` | the recovery branch's unspecified fallback is also `publisher-declined` | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => [] })` | `stubDeps({ postizEnv: {}, publishText: async () => [] })` | both asserts byte-identical |
| `studio-scheduling-postiz-reuse.test.ts:559` | the recovery branch's variant-spacing wording is also `publisher-declined` | `stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => [] })` | `stubDeps({ postizEnv: {}, publishText: async () => [] })` | both asserts byte-identical |
| `publishing-status.test.ts:181` (retry leg) | a newly approved row with an empty ledger is still retryable after discovery failed before dispatch | `fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [] })` | `fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{ destination: "x" as const, media: ["text" as const], accountId: "acct", accountLabel: "Human Inference" }] })` | `assert.equal(calls, 1);`, `assert.equal(retried.publishing.state, "planned");`, `assert.equal(retried.publishing.providerObjectId, "tf-retry");` all byte-identical. The first leg of the test, the discovery-failure subject itself, is untouched. |

That is eight rows for seven tests because `:248` has two legs with two separate fixtures.

Notes on the two fixtures that are not the five-way swap:

- `:65` could not use `postizEnv: {}`, because its subject is specifically the account assertion
  that happens *after discovery*. It keeps a configured, authoritative registry and instead moves to
  the Typefully leg this slice deliberately preserves: a card row whose destination the registry does
  not advertise routes `x`/`image` to `typefully`, exactly as `postiz.test.ts`'s surviving image pin
  says it must. The sibling test at `:92` already used this same row shape.
- `publishing-status.test.ts:181` keeps an injected registry because its whole subject is discovery
  behaviour; the registry now advertises the row's own channel so the retry reaches the stubbed
  scheduler instead of being refused. `tf-retry` still comes from the test's own scheduler stub, so
  the asserted value is unaffected. The sibling test at `:322` already proves a postiz-provider
  selection resolves cleanly under this file's `before` hook.

Nothing was deleted, nothing was skipped, and no assertion was loosened to a regex matching both the
old and the new wording. No fixture change makes its test pass trivially: the proof is that all
seven still pass against **reverted** production (see `### Load-bearing`), which is the correct
signature for a vehicle-only repair. Had any of them become green only under the new production,
that would have meant its meaning had shifted, and it would have gone back for adjudication.

### Protected paths

- `.env` was never read, written, printed, sourced or passed to any command. `.env.example`
  untouched. No secret value appears in any added line, fixture, error string or comment. Fixture
  account ids (`acct-x`, `acct-threads`, `acct-linkedin`, `acct-bluesky`) are invented; the one
  non-fixture-looking value, `POSTIZ_API_KEY: "not-a-real-key"`, is a literal placeholder.
- `src/publish/typefully.ts`, `resolveConfiguredPostizCapability`, `approvedPostizAccountIds`,
  `src/review/publishing-status.ts`, `src/review/approval-provenance.ts`,
  `src/publish/reuse-guard.ts`, `config/platforms.yaml`, `src/publish/slots.ts`, the slot ledger,
  `docs/content-agents-backlog.md` and `docs/operations/launch-slices/evidence/**`: all untouched.
- `data/`, `briefs/`, `~/.content-agents/**`: nothing written by this lane. `git status --porcelain`
  does list `M briefs/human-inference/bets.md` and `M data/outreach/tracker.jsonl`, and both predate
  and are independent of this lane. The bets.md hunk is three live `Placed log` rows carrying real
  Postiz cuids (`cmtxp6um8000kmn81a9zgdgw8`, `cmtxv04og000nmn813w2ib6p6`,
  `cmty8qqzo000pmn81b4rpg4d4`); every stub in this repository's tests returns `pz-1` or `tf-1`, so
  no test could have produced them. They are another session's or Muxin's own shipping record and
  were left exactly as found. `src/review/studio-scheduling.test.ts`'s own `briefs/` digest guard
  passed, which independently confirms the suite wrote nothing there.
- Temporary files: one throwaway voice-check script was written to the scratchpad, copied in to run
  under the repository's tsconfig, and deleted in the same command. Nothing of it remains.

### Hygiene

`bash scripts/repo-hygiene.sh --rescue` was run and its output reviewed. Exit 1, which the
`### Hygiene disposition` form in `slice-protocol-environment.md` expects whenever other sessions
hold pending work; every item it listed is such a path.

Paths this session created: `docs/operations/launch-slices/SLICE-7B-LOG.md` only. It is an owned
file and is left uncommitted, because a worker never commits. Nothing else untracked came from
this lane, and nothing this lane created was deleted.

Paths this session did NOT create, each named and left exactly in place:
`briefs/human-inference/bets.md`, `data/outreach/tracker.jsonl`,
`content/2026-06-16-building-an-innovation-nation/develop/advice.json`,
`content/2026-06-16-building-an-innovation-nation/develop/log.md`,
`content/2026-06-16-building-an-innovation-nation/cuts/` (untracked),
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/publish-log.md`,
`content/2026-09-07-the-world-s-broken-what-do-we-do-human-inference/review-queue.md`,
the worktree `/private/tmp/claude/content-agents-worktrees/wt-slice-6m` (`e2e/pass-a-reads.ts`,
`e2e/pass-b-writes.ts`), the worktree `/private/tmp/claude/content-agents-worktrees/wt-slice-6s`
(`e2e/harness.ts`, `e2e/pass-d-editorial.ts`), and the merged branches `slice-6m-worker` and
`slice-6s-worker`. The hygiene run also listed `docs/operations/launch-slices/SLICE-7B.md` as
untracked; another session committed it while this lane was running, so it now reads as modified,
by this lane's RESULT BLOCK and nothing else.

Changed paths. Lane A ownership: `src/publish/postiz.ts`, `src/review/studio-scheduling.ts`,
`src/publish/postiz.test.ts`, `src/review/studio-scheduling.test.ts`,
`docs/operations/launch-slices/SLICE-7B.md` (RESULT BLOCK only),
`docs/operations/launch-slices/SLICE-7B-LOG.md`. Added by the coordinator's 2026-09-12
adjudication: `src/review/studio-scheduling-postiz.test.ts`,
`src/review/studio-scheduling-postiz-reuse.test.ts`, `src/review/publishing-status.test.ts`.
Nine paths, no others. `src/review/reconcile.ts`, `src/review/rows.ts`,
`src/review/reconcile.test.ts` and `src/review/rows.test.ts` belong to the concurrent worker and
were neither edited nor reverted.

The packet's `## Closeout` preflight asks for `git status --porcelain -- data briefs` to be empty.
It is not, and the reason is the `briefs/human-inference/bets.md` and `data/outreach/tracker.jsonl`
entries above, both another session's live shipping record and neither touched here. This lane
wrote nothing under `data/`, `briefs/` or `~/.content-agents/**`.

### Read set

| Input | Bytes |
| --- | --- |
| `AGENTS.md` → `## Slice protocol` | 24560 (cap 24576) |
| `docs/operations/slice-protocol-environment.md` | 8635 |
| `docs/operations/launch-slices/SLICE-7B.md`, as read | 10545 (cap 12288) |

Nothing else was loaded as starting context. Files opened afterwards were evidence the work itself
required: the two production files, the four test files that turned out to encode the rule,
`src/publish/canary-matrix.ts` (the only other `selectDeliveryRoute` caller),
`src/publish/cards.ts`'s media predicates, and `config/voice.yaml`.
