/**
 * Unit tests for src/publish/slots.ts — the atomic ledger rewrite (writeLedgerAtomic) and
 * releaseClaims (drops specific claims, e.g. an orphaned future claim --sync finds).
 *
 * Strategy: the ledger path is hardcoded (join(repoRoot, "data", "publish-schedule.jsonl")), same
 * as reuse-guard.test.ts's bets.md problem. before/after hooks save the real file and restore it
 * on teardown so real local ledger data is never lost.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger, pruneLedger, releaseClaims, writeLedgerAtomic, type Claim } from "./slots.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEDGER = join(repoRoot, "data", "publish-schedule.jsonl");

let savedLedger: string | null = null;
let savedExisted = false;

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-01",
    time: "2026-08-01T17:00:00.000Z",
    asset: "test-fixture/x",
    by: "test",
    ...overrides,
  };
}

function seedLedger(claims: Claim[]): void {
  writeFileSync(LEDGER, claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "");
}

describe("slots.ts: writeLedgerAtomic + releaseClaims", () => {
  before(() => {
    savedExisted = existsSync(LEDGER);
    savedLedger = savedExisted ? readFileSync(LEDGER, "utf8") : null;
  });

  after(() => {
    if (savedExisted) writeFileSync(LEDGER, savedLedger ?? "");
    else if (existsSync(LEDGER)) unlinkSync(LEDGER);
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("writeLedgerAtomic replaces the ledger content on success", () => {
    const claims = [claim({ asset: "a" }), claim({ asset: "b" })];
    writeLedgerAtomic(claims);
    assert.deepEqual(readLedger(), claims);
  });

  test("writeLedgerAtomic writes an empty file for an empty claim list", () => {
    seedLedger([claim()]);
    writeLedgerAtomic([]);
    assert.equal(readFileSync(LEDGER, "utf8"), "");
  });

  test("writeLedgerAtomic never truncates the real ledger if the tmp write throws mid-write", () => {
    const original = [claim({ asset: "keep-me" })];
    seedLedger(original);
    const before = readFileSync(LEDGER, "utf8");

    assert.throws(
      () =>
        writeLedgerAtomic([claim({ asset: "should-never-land" })], {
          writeFileSync: () => {
            throw new Error("simulated crash mid-write");
          },
          renameSync: () => {
            throw new Error("should not be reached");
          },
        }),
      /simulated crash mid-write/
    );

    assert.equal(readFileSync(LEDGER, "utf8"), before, "real ledger must be untouched, not truncated");
  });

  test("writeLedgerAtomic never truncates the real ledger if rename fails after a good tmp write", () => {
    const original = [claim({ asset: "keep-me-2" })];
    seedLedger(original);
    const before = readFileSync(LEDGER, "utf8");

    assert.throws(
      () =>
        writeLedgerAtomic([claim({ asset: "should-never-land-2" })], {
          writeFileSync,
          renameSync: () => {
            throw new Error("simulated rename failure");
          },
        }),
      /simulated rename failure/
    );

    assert.equal(readFileSync(LEDGER, "utf8"), before, "real ledger must be untouched when rename fails");
  });

  test("pruneLedger drops past claims and keeps future ones (still atomic via writeLedgerAtomic)", () => {
    const now = new Date("2026-07-08T12:00:00.000Z").getTime();
    const past = claim({ asset: "past", time: new Date(now - 86_400_000).toISOString() });
    const future = claim({ asset: "future", time: new Date(now + 86_400_000).toISOString() });
    seedLedger([past, future]);

    const result = pruneLedger(now);
    assert.deepEqual(result, { removed: 1, kept: 1 });
    assert.deepEqual(readLedger(), [future]);
  });

  test("releaseClaims removes exactly the matching claims and leaves the rest", () => {
    const a = claim({ asset: "release-a" });
    const b = claim({ asset: "release-b" });
    const c = claim({ asset: "release-c" });
    seedLedger([a, b, c]);

    const result = releaseClaims([b]);
    assert.deepEqual(result, { removed: 1, removedClaims: [b] });
    assert.deepEqual(readLedger(), [a, c]);
  });

  test("releaseClaims is a no-op (and does not write) when given an empty list", () => {
    seedLedger([claim({ asset: "untouched" })]);
    const before = readFileSync(LEDGER, "utf8");
    const result = releaseClaims([]);
    assert.deepEqual(result, { removed: 0, removedClaims: [] });
    assert.equal(readFileSync(LEDGER, "utf8"), before);
  });

  test("releaseClaims is a no-op when the claim isn't in the ledger", () => {
    seedLedger([claim({ asset: "stays" })]);
    const result = releaseClaims([claim({ asset: "not-present" })]);
    assert.deepEqual(result, { removed: 0, removedClaims: [] });
    assert.equal(readLedger().length, 1);
  });

  test("releaseClaims only reports claims actually found in the ledger, even if toRelease asked for more", () => {
    const present = claim({ asset: "present" });
    seedLedger([present]);
    const result = releaseClaims([present, claim({ asset: "already-gone" })]);
    assert.deepEqual(result, { removed: 1, removedClaims: [present] }, "must not echo back a claim it never actually removed");
    assert.deepEqual(readLedger(), []);
  });
});
