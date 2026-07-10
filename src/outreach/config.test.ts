import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadOutreachConfig } from "./config.js";

// docs/outreach-engine-plan.md §3 Phase 4: config/outreach.yaml's `follow_up:` section (checked
// in) must parse into loadOutreachConfig()'s new `followUp` field with defaults matching that
// file exactly, so a missing/partial config still yields sane per-bucket windows.
describe("loadOutreachConfig: follow_up windows", () => {
  test("parses the real checked-in config/outreach.yaml for all 4 buckets", () => {
    const config = loadOutreachConfig();
    assert.deepEqual(config.followUp.client, { followUpAfterDays: 7, abandonAfterDays: 30 });
    assert.deepEqual(config.followUp.platform, { followUpAfterDays: 10, abandonAfterDays: 45 });
    assert.deepEqual(config.followUp.jobsearch, { followUpAfterDays: 7, abandonAfterDays: 30 });
    assert.deepEqual(config.followUp.inbound, { followUpAfterDays: 3, abandonAfterDays: 14 });
  });
});
