import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { appendCanonEvent, readCanonEvents, hasCanonEvent, findCanonEvent } from "./canon.js";
import { ventureDir } from "./paths.js";

const SLUG = "zz-test-canon";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

describe("appendCanonEvent / readCanonEvents", () => {
  test("a fresh event is recorded and readable back", () => {
    const r = appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: "v1" }, "2026-08-19T00:00:00.000Z");
    assert.equal(r.alreadyRecorded, false);
    const events = readCanonEvents(SLUG);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "kickoff");
    assert.equal(events[0].id, `${SLUG}/kickoff`);
    assert.equal(events[0].fields.rules_version, "v1");
  });

  test("re-recording the same event_id is an idempotent no-op, not a duplicate", () => {
    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, {}, "t0");
    const second = appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, {}, "t1");
    assert.equal(second.alreadyRecorded, true);
    assert.equal(readCanonEvents(SLUG).length, 1);
  });

  test("hasCanonEvent / findCanonEvent reflect what's on the ledger", () => {
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-1`), false);
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, { complete: "3" }, "t0");
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-1`), true);
    assert.equal(findCanonEvent(SLUG, `${SLUG}/checkpoint-1`)?.fields.complete, "3");
  });

  test("multiple distinct events all persist", () => {
    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, {}, "t0");
    appendCanonEvent(SLUG, "pace-recorded", `${SLUG}/phase-1/pace`, { per_week: "5" }, "t1");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t2");
    assert.equal(readCanonEvents(SLUG).length, 3);
  });
});
