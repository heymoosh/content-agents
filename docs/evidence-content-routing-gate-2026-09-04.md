# Item 5a: configured Content platform routing

## Slice contract

Status: complete on `feat/content-routing-gate`, based on `409bacf`; all required
verification and audit gates passed before commit. Completed 2026-09-05.
Scope: master-status START HERE, Lane C item 5a; alignment-plan §5.
Difficulty: hard (generation selection and persisted content invariants).
Coordinator: Astra. Mapping: Luna high. Builder: Astra. Audit: independent
Anthropic/Grok family, given only this contract, the diff, and test results.

Port the existing platform-routing include/skip, cold-start, and exploration-probe
decisions into `generateConfiguredContent` before variant generation. Reuse the
existing routing policy. Do not port validate or any other item-5 capability.

## Acceptance checklist

- [x] A deterministic integration test proves skipped platforms produce no variants.
- [x] Included platforms retain their intended variants.
- [x] Cold-start defaults and exploration probes retain their intended variants.
- [x] Request identity, source provenance, origin-specific rules, and pending review
      states remain valid; no publishing or approval is introduced.
- [x] Search every caller/reader of changed routing and generation symbols; cover
      empty selection and relevant legacy/missing-metadata behavior explicitly.
- [x] Focused red/green tests and fake-model end-to-end generation pass.
- [x] Cross-family audit passes before the authenticated canary. Classify findings
      as introduced blocker, pre-existing problem, or optional hardening.
- [x] One isolated authenticated canary passes (at most one retry), preserving
      successful output if later validation fails. Isolate Git, operational data,
      secrets, ports, and model permissions.
- [x] Final unsandboxed `npm run check` passes before committing.
- [x] Record audit findings as concrete acceptance tests, state invariants, or
      symbol-search checks for the next builder.

## Execution slices

1. Map reuse seams and run the early read-only Claude architecture/threat review.
2. Implement item 5a and deterministic tests; return a compact result block.
3. Machine-verify, audit the bounded packet across families, and close P0/P1 gaps.
4. Run the bounded canary and final check, record evidence, commit, and update the
   master-status next action to the validate port.

P2 findings are recorded unless they threaten data or invalidate the canary.
No adjacent issue receives more than 30 minutes without a scope decision.

## Routing compatibility decisions

Consume the persisted `routing.md` decision, which already includes the route
policy's origin/source-triage rules and exploration override. Do not re-open the
analytics database or partially recompute that chain during generation.

Filter before media preflight, occupancy checks, model calls, and writes. Preserve
the saved request and deterministic variant identities; return only generated IDs.
Included exploration rows carry `exploration_probe: true` into derivatives.
Missing routing files or platform rows retain the existing validator's compatibility
behavior. Malformed decision rows in an existing routing file must not silently
bypass the gate. An entirely skipped fresh/partial selection fails clearly before
model work or output writes. A fully generated selection subsequently routed to
all skip returns an empty generated-ID list with `existing: true`, without changes.

## Early architecture review

Claude Opus, high effort, subscription CLI with read-only tools, completed before
production edits. It confirmed persisted routing must be consumed rather than
partially recomputed. It flagged experiment pairing, channel/media mapping, and
idempotency when routing changes after generation.

Builder closure required: filtering applies to whole platforms and preserves all
control/treatment variants on retained platforms; media uses its destination
platform's routing; already-generated output remains a benign repeat without
generating newly skipped content. Tests must distinguish these cases.

The review proposed rejecting the whole request when any platform is skipped.
That recommendation is not adopted: item 5a requires included variants to survive
while skipped platforms produce none. Platform-level filtering must be tested
against the actual pairing constraints; the later integration and prompt tests
close this decision.

## Deterministic verification

The red run reproduced generation of skipped variants and missing exploration
stamps. The coordinator independently ran the focused command below and confirmed
160 tests passed, zero failures/skips, before audit:

```sh
node --import tsx --test src/review/content-generation.test.ts src/strategy/recorded-routing.test.ts src/strategy/route.test.ts src/review/treatment.test.ts src/atomize/validate.test.ts src/review/content-request.test.ts src/atomize/content-request.test.ts src/grow/experiment-content-handoff.test.ts
```

The suite covers generation through the real job/queue/filesystem path using the
guarded fake-model seam, including pairing, provenance, pending review, skipped
media, malformed routing, missing metadata, and changed-routing reruns.
The consumer search confirmed draft/editor/media helpers use the filtered variant
set. Existing outputs are not retroactively rewritten or exploration-restamped.

## Cross-family audit

The packet contains only slice requirements, implementation diff, and the
coordinator's focused-test output. Claude Opus high-effort audit returned **FIX**.
The same Astra builder is closing findings at **xhigh** (raised from high for
coverage/verification gaps), through the subscription CLI because the embedded
agent thread limit prevented a new effort-configured worker.

Audit closure checklist:

- [x] F1: a completed routed subset followed by all-skip returns empty/existing;
      each occupied identity remains complete, half-created identities still fail,
      and all prior queue/derivative/stage bytes remain unchanged.
- [x] F2: assert actual drafting/editor payloads contain no skipped identity; list
      every remaining request-scoped read and why it must remain request-scoped.
- [x] F3: qualified community keys use direct lookup. The request domain accepts
      generic `community` but has no room field or legacy room-bearing filename;
      when only qualified routing destinations exist, refuse the ambiguous generic
      selection before any model/output work. Persistence and refusal tests cover it.
- [x] F4: multi-pillar merge/writer/parser roundtrip; read-only compatibility scan
      of existing routing files, reporting only counts and error classes.

Coordinator reran the expanded suite: **184 passed, zero failed/skipped**. Prompt
tests inspect eight actual drafting/editor calls across all five editor origins;
the optional code-level engine dependency is not exposed by the HTTP route.
Twelve partial-occupancy cases preserve every existing artifact byte. The routing
scan covered eight main-checkout files: seven parsed; one refused invalid confidence;
zero extra tables, repeated platform rows, or read errors; five multi-pillar headings.
No existing source/routing document was changed. **Claude Opus final re-audit:
PASS, no introduced P0/P1 or requirements gaps.** It independently re-derived F1–F4
closure from the final diff and 184-test packet. Live canary and final full check
remained pending by design at that verdict.

Deferred P2 checklist for the next builder:

- [ ] Type/centralize confidence values when the router's confidence vocabulary
      changes; search `Confidence`, `parseRecordedRouting`, and all parser readers.
- [ ] Specify route-widening recovery without deleting reviewable artifacts;
      current partial-occupancy refusal is deliberately non-destructive.
- [ ] Isolate the shared fake-engine marker per test process before broadening
      concurrent test execution (pre-existing harness constraint).
- [ ] Keep generated table header/parser compatibility pinned when changing the
      routing writer; do not infer support for arbitrary document layouts.
- [ ] Search all `generateConfiguredContent` callers when changing empty/existing
      result semantics, and both routing parsers when porting validate in item 5b.
- [ ] Pin routed-down experiment subset/empty handoff behavior; the downstream
      Venture bridge currently refuses an incomplete experiment set.
- [ ] Keep the fourth, code-only engine dependency out of HTTP/CLI/queue inputs;
      production callers use the normal transport.
- [ ] Add a two-identities-half-created occupancy case and preserve every artifact
      byte on refusal, supplementing the current twelve single-identity masks.
- [ ] Define legacy two-column routing's unknown probe status before changing
      downstream `exploration_probe` interpretation.

Standing state invariants: filtering never mutates request variants/IDs or the
saved request; generation never writes routing.md; refusal never rewrites existing
derivatives, stages, or queue rows. Survey shared fake-engine-marker users before
the full check so parallel tests cannot accidentally fall through to live calls.

Pre-check marker survey: only `content-generation.test.ts` mutates the repository
marker and process environment; other unit helper tests use temporary directories
and explicit environment objects. E2E passes run sequentially against disposable
roots. No current cross-file marker race was found, so the final gate remains
exactly `npm run check` (no script or concurrency-policy change).

The additional Grok 4.6 read-only audit could not start: its sandbox refused
`/var/run/docker.sock` because the endpoint is a symlink. Context7's official
Grok Build sandbox documentation was consulted; it supplied no targeted repair.
Sandbox protections were not disabled. This attempt produced no audit verdict.

## Live canary budget and harness

Prepared by Sol high; coordinator reviewed the fixture and corrected its initial
import/isolation-path mismatch before any authenticated invocation. A subsequent
fake-CLI dry run passed and is explicitly labeled `fake-cli-dry-run`, not live proof.

The corrected temporary launcher uses a new, source-only Git fixture with no history,
remotes or alternates, no source operational content or `.env`, isolated data/job/home directories,
an allowlisted environment, no server/ports, and subscription-only Codex auth. Its
model wrapper forces `read-only`, ignores user config, clears MCP configuration,
and preserves model outputs before application validation. The whole-run cap is
24 minutes for generation; one fresh retry is permitted only after a failed first attempt.

Live attempt 1 started after the PASS verdict. Exact launch:

```sh
CANARY_I_MEAN_IT=1 CROSS_FAMILY_AUDIT_PASSED=1 /private/tmp/content-routing-canary/run-canary.sh /private/tmp/content-routing-canary-runs/routing-gate-2026-09-04 1
```

Attempt 1's behavior assertions passed at `2026-09-05T04:32:36.417Z`: two live
Codex calls, four included pending variants, zero X output, exact request/source/
routing bytes, and a done job. **Post-run isolation review then found historical
job logs inside the temporary data directory.** This attempt is not yet accepted
as isolated verification; its successful model outputs and behavior result remain
preserved unchanged. The migration source and host-write consequences were
resolved in the bounded investigation below. The final local check had already started
when this post-run finding surfaced; product source remains unchanged.

Isolation finding resolved: `jobs.ts` migrates `homedir()/.content-agents` through
`cpSync`; the real HOME caused 220 historical logs to be copied into the temporary
root. Nothing was moved and no host mutation was observed. The corrected harness
isolates process HOME and all XDG roots while retaining explicit CODEX_HOME only
for subscription auth, requires empty mutable data before generation, and requires
exactly one current job log afterwards. A fake-CLI isolation dry run passed.
Attempt 1 now has a separate failed isolation-postcheck; its original behavior
result and model outputs remain intact. A narrow Claude harness audit precedes
the single allowed retry.

Harness audit closure also removed full repository history from the model-visible
fixture and replaced CLI passthrough with an explicit argument allowlist, pinned
cwd, read-only sandbox, and never-approval policy. Sol's effort was raised from
high to xhigh for these missed checks; the coordinator stopped the worker at its
timebox after its launcher dry run completed, then verified the artifacts directly.
The complete launcher fake-CLI run passed with exactly one current job log and
zero Git history/remotes/alternates. All four checked product-file hashes matched.
Unknown `--yolo`, attempt 3, and a one-second timeout were exercised (refusal,
exit 64, and exit 124 respectively). Early-exit isolation evidence is also tested
and never overwrites an existing postcheck.

Claude cleared the corrected harness after local CLI help verified every capability
flag, an isolated-HOME auth-status check confirmed ChatGPT login without a model
request, and the existing attempt-1 isolation-failure record was supplied. The
actual argv prefix is `-a never exec`; exec-only flags follow the subcommand.
The sole terminal retry is attempt 2 under the same run base. No third run or
fresh-base workaround is authorized. **Attempt 2 passed behavior and isolation at
`2026-09-05T05:12:03.850Z`** with the frozen, fully checked product source and an
offline temporary npm cache. Two real Codex calls produced four pending variants
for Bluesky/Mastodon and none for X; exactly one current job log existed, with no
historical copies. Git history/remotes/alternates were empty and all four product
file hashes matched the full-check source. The live budget is exhausted.

Accepted evidence and both attempts' preserved model outputs:
[artifact index](evidence/content-routing-gate-2026-09-04/README.md).

Future canary builders must close these checks before spending a live call:

- Source-only independent Git, not a full-history clone; verify no objects/refs
  from the real repository, remotes, alternate objects, or operational files.
- Isolated process HOME and XDG roots in addition to application data variables;
  survey `homedir()` and legacy migration readers, and assert exact log counts.
- Actual full-launcher fake-CLI test, including setup/environment/wrapper paths.
- Strict capability allowlist, installed CLI flag checks, recorded argv ordering,
  and early-exit evidence that cannot overwrite successful output.
- Pin the attempt count globally in the coordinator record; a fresh directory is
  not permission for another live attempt.

## Final local gate

Unsandboxed `npm run check` **PASS: 4,158 tests / 484 suites / zero failures or
skips**, exit 0 (250.228 seconds for the test phase). This was the single full
check, started after attempt 1's behavior PASS and completed during the harness-only
isolation correction. The audited product source did not change during that
correction; the accepted retry ran that same checked implementation, confirmed
by hashes. The next maturity rung did not trigger: no deployment configuration or
deployment/release workflow exists.
