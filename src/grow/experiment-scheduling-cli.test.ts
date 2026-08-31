import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGrowExperimentProposal } from "./experiment-slice.js";
import { main } from "./experiment-scheduling-cli.js";
import type { AppliedGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";

const proposal = buildGrowExperimentProposal({
  id: "p", createdAt: "2026-08-30T12:00:00Z",
  source: { id: "s", kind: "raw-thought", body: "A complete thought.", originRef: "fixture:s" },
  selectedPlatforms: ["x"],
  cut: { id: "c", body: "A complete thought.", sourceRefs: ["s#body"], rationale: "Complete.", decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T11:00:00Z" } },
  variants: [{ id: "v", platform: "x", medium: "text", format: "post", body: "A complete thought.", sourceRefs: ["s#body"], treatment: { ref: "t", rationale: "Direct.", evidenceStatus: "supported", evidenceRefs: ["s#body"] }, experimentVariables: { opener: "direct" }, voiceCheck: "passed", originalityCheck: "passed" }],
  capacity: { day: "2026-09-01", review: [{ platform: "x", available: 1 }], slots: [{ platform: "x", available: 1, capacity: 1, scheduledCount: 0 }] },
  experiment: { id: "e", question: "Does it work?", outcomeFamilies: ["attention"], minimumSample: 10, topic: "topic", audience: "readers" },
});
const decision = { proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-30T13:00:00Z", decisions: [{ variantId: "v", status: "approved" as const, note: "yes" }] };

test("Grow scheduling CLI previews by default and requires --schedule for every write/dispatch", async () => {
  let applied = 0; let scheduled = 0; let output = "";
  const code = await main(["--proposal", "p.json", "--decision", "d.json", "--folder", "/tmp/content", "--variant", "v"], {
    out: async (value) => { output += value; }, error: async () => {},
    readJson: async (path) => path.endsWith("p.json") ? proposal : decision,
    apply: (() => { applied += 1; throw new Error("must not apply"); }) as never,
    schedule: (async () => { scheduled += 1; throw new Error("must not schedule"); }) as never,
  });
  assert.equal(code, 0); assert.equal(applied, 0); assert.equal(scheduled, 0); assert.match(output, /"mode": "preview"/);
});

test("Grow scheduling CLI dispatches only with --schedule", async () => {
  let applied = 0; let scheduled = 0;
  const fake = { rows: [{ id: "v" }] } as unknown as AppliedGrowExperimentQueueHandoff;
  const code = await main(["--proposal", "p.json", "--decision", "d.json", "--folder", "/tmp/content", "--variant", "v", "--schedule"], {
    out: async () => {}, error: async () => {}, readJson: async (path) => path.endsWith("p.json") ? proposal : decision,
    apply: (() => { applied += 1; return fake; }) as never,
    schedule: (async () => { scheduled += 1; return { scheduleError: null, binding: { readiness: { status: "ready" } } }; }) as never,
  });
  assert.equal(code, 0); assert.equal(applied, 1); assert.equal(scheduled, 1);
});
