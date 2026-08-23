import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test-only isolation for Phase 1-4's on-disk venture state.
//
// Every venture test writes real files under paths.ts's venture root, and every test file used a
// fixed slug anchored at the repo's own venture/ directory. That directory is shared by every
// concurrent test run in the checkout, and cleanup only ever ran on the way OUT (afterEach), never
// on the way in. So a killed run, or two runs overlapping in one checkout, left a partial venture
// behind -- and a leftover canon.md carrying `response-gate-opened` with no responses.jsonl beside
// it makes getResponseGateState() report "opened" (the state is latched in canon, the count is
// read live), so phase3's gate tests hit a later validation instead of the gate refusal they
// assert. The failure then wiped its own leftovers via afterEach, which is why it never reproduced
// on a second run.
//
// The fix follows the two conventions already in the repo: mkdtempSync(tmpdir(), ...) for
// throwaway test state (src/atomize/cuts.test.ts, src/publish/queue.test.ts, and others), reached
// through a lazily-read CONTENT_AGENTS_TEST_* env override (src/publish/slots.ts's ledgerPath()).
// spawnSync inherits process.env, so the venture CLI subprocesses these tests drive land in the
// same throwaway root as their in-process seeding.
//
// Usage, in every src/venture/*.test.ts that touches disk:
//   beforeEach(useTempVentureRoot);
//   afterEach(clearTempVentureRoot);

let current: string | null = null;

/** Give the current test its own empty venture root. */
export function useTempVentureRoot(): void {
  current = mkdtempSync(join(tmpdir(), "venture-test-"));
  process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT = current;
}

/** Delete that root and stop overriding, so nothing carries into the next test. */
export function clearTempVentureRoot(): void {
  if (current) rmSync(current, { recursive: true, force: true });
  current = null;
  delete process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT;
}
