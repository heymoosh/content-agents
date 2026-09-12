# SLICE-7C log

## 2026-09-12 — coordinator adjudication of the four pre-existing failures

The first worker delivered the implementation and stopped without accepting, because four existing
tests fail. It was right to stop and right not to edit them: the standing rule is that a worker
never weakens, rewrites or deletes a test to make one pass, and whether these four are "weakening"
or "re-pointing" is a design judgment the coordinator owns.

I read all four. Each builds a SAME-ROW placement inside `min_reuse_days` on a non-Postiz route and
asserts the publisher was invoked and the refusal was `publisher-declined`:

| Test | File |
|---|---|
| `a legacy route is not gated by the Postiz pre-flight: its own publisher still runs and still decides` | `studio-scheduling-postiz-reuse.test.ts:248` |
| `the recovery branch emits the SAME same-row wording but is publisher-declined` | `studio-scheduling-postiz-reuse.test.ts:535` |
| `the unscheduled-draft route's recovery branch is publisher-declined too` | `studio-scheduling-postiz-reuse.test.ts:577` |
| `recovery path: a Charles row IS explained by Charles's own placement` | `studio-scheduling.test.ts:204` |

That premise is exactly what SLICE-7C changes on purpose: such a row is now refused before the
publisher runs. The tests are not wrong about safety, they describe the old provenance. The
original packet failed to say what should happen to them, and it did not own the fourth file. Both
are my errors, not the worker's.

The binding rules for re-pointing them are in the packet's `## Adjudication` section. The short
version: no assertion about what `publisher-declined` means may be softened, none may be deleted or
skipped, each keeps a live example by using a scenario the pre-flight lets through (guard allows or
defers, publisher returns `[]` anyway), and each also gains the new same-row assertion. Coverage
strictly increases.

Sibling tests that already survive unchanged, and which is why the fail-closed residue stays proven
without relying on the four above: `the recovery branch's unspecified fallback is
publisher-declined`, `the recovery branch's variant-spacing wording is publisher-declined`, and
`the recovery branch still explains a publisher that skips for a reason the guard knows nothing
about`. All three have the guard allowing or deferring and the publisher declining anyway.
