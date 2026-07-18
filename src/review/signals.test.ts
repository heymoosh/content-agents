import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBriefSignals, latestBriefFile, appendBacklogCard } from "./signals.js";

const BRIEF = `# Strategy Brief

## Data confidence

| Channel | Posts | Weeks of data | Status |
|---|---|---|---|
| bluesky | 73 | 28 | OK |
| threads | 3 | 2 | INSUFFICIENT (<4 wks) — directional only |

## Recommendations

1. **[DO MORE] Lean into Substack Notes, and spread them.** Notes out-engage essays by multiples
   for a fraction of the effort.
2. **[TEST] The pipeline beats hand-posting on X.** Tiny sample (n=6). If it holds to n≥10,
   let the pipeline feed it.

The funnel goal is unchanged.

## Directives for atomization
`;

test("parseBriefSignals reads the confidence table and the marked recommendations", () => {
  const { confidence, recommendations } = parseBriefSignals(BRIEF);
  assert.deepEqual(confidence[0], { channel: "bluesky", posts: 73, weeks: 28, status: "OK" });
  assert.match(confidence[1].status, /INSUFFICIENT/);
  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].type, "DO MORE");
  assert.equal(recommendations[0].title, "Lean into Substack Notes, and spread them");
  assert.match(recommendations[0].rationale, /fraction of the effort/);
  assert.equal(recommendations[1].type, "TEST");
});

test("latestBriefFile picks the newest dated brief", () => {
  const dir = mkdtempSync(join(tmpdir(), "signals-test-"));
  try {
    writeFileSync(join(dir, "2026-06-16-strategy-brief.md"), "x");
    writeFileSync(join(dir, "2026-06-24-strategy-brief.md"), "x");
    writeFileSync(join(dir, "bets.md"), "x");
    assert.equal(latestBriefFile(dir), "2026-06-24-strategy-brief.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendBacklogCard appends a prose_kanban card once, refusing a duplicate title", () => {
  const dir = mkdtempSync(join(tmpdir(), "signals-test-"));
  const p = join(dir, "backlog.md");
  try {
    writeFileSync(p, "# Backlog\n\n**Existing card**\n- STATUS: Backlog\n");
    const r = appendBacklogCard({ title: "Lead X posts with the audit hook", detail: "[DO MORE] ran 3x", briefPath: "briefs/b.md", date: "2026-07-18" }, p);
    assert.equal(r.ok, true);
    const text = readFileSync(p, "utf8");
    assert.match(text, /\*\*Lead X posts with the audit hook\*\*/);
    assert.match(text, /- STATUS: Backlog\n<!-- card-id: [0-9a-f-]+ -->/);
    assert.match(text, /Signals room adjustment, sent by Muxin 2026-07-18/);
    const dup = appendBacklogCard({ title: "Lead X posts with the audit hook", detail: "again", briefPath: null, date: "2026-07-18" }, p);
    assert.equal(dup.ok, false);
    assert.match(dup.error!, /already/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
