import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildClientPlatformLeadFile,
  buildContentExampleLeadFile,
  runDiscover,
  DISCOVERY_KINDS,
  DISCOVERY_STEP_LABELS,
  type DiscoveryKind,
} from "./discover.js";
import { parseStepMarker, ingestMarkerChunk } from "../review/jobs.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { checkLeadShape } from "../outreach/validate.js";
import { parseEvidence } from "../outreach/qualify.js";

const CLIENT_CANDIDATE = {
  name: "Acme Co",
  url: "https://acme.co",
  profile: "Acme makes widgets.",
  evidenceBlock: "",
  evidence: [
    { id: "E1", signal: "worldview-match", person: "", source: "https://acme.co/blog", quote: '"we believe in people"', description: "founder blog post", captured_at: null },
  ],
  disconfirmation: "Nothing found against it.",
  classification: "greenfield",
  classificationNote: "Per E1, a real worldview match.",
  pitchAngle: "lead with the shared worldview",
};

const CE_CANDIDATE = {
  name: "Acme's Q3 pricing relaunch",
  url: "https://acme.co/blog/pricing",
  why: "They bet usage-based pricing would grow revenue without churn.",
  evidence: [
    { id: "E1", signal: "source-quote", person: "", source: "https://acme.co/blog/pricing", quote: '"we are betting on usage-based pricing"', description: "company blog", captured_at: null },
  ],
  angle: "the riskiest belief is that switching pricing models won't spike churn",
};

describe("DISCOVERY_KINDS", () => {
  test("is client, platform, content-example in that order", () => {
    assert.deepEqual(DISCOVERY_KINDS, ["client", "platform", "content-example"]);
  });
});

describe("buildClientPlatformLeadFile", () => {
  test("produces a lead.md whose frontmatter/body pass checkLeadShape (kind: client)", () => {
    const text = buildClientPlatformLeadFile("client", CLIENT_CANDIDATE, "career-work");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "client");
    assert.equal(fm.source, "discovered");
    assert.equal(fm.status, "researched");
    assert.equal(fm.classification, "greenfield");
    assert.equal(fm.fit, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
    assert.match(body, /Acme makes widgets\./);
    assert.match(body, /discovered via \/scout \(theme: "career-work"\)/);
    assert.match(body, /Disconfirmation pass: Nothing found against it\./);
  });

  test("kind: platform writes fit, not classification, and defaults to weak when unclassified", () => {
    const text = buildClientPlatformLeadFile("platform", { ...CLIENT_CANDIDATE, classification: "" }, "civic-tech");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "platform");
    assert.equal(fm.fit, "weak");
    assert.equal(fm.classification, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
  });
});

  // A scout run IS the capture, so a scaffolded lead.md carries a real date from the start —
  // the same clock the decision log already reads, and a measured fact rather than a guess. It
  // round-trips through qualify.ts's parser, which is the only thing that ever reads it back.
  test("stamps the evidence with the day this discovery run gathered it", () => {
    const text = buildClientPlatformLeadFile("client", CLIENT_CANDIDATE, "career-work");
    const { body } = splitFrontmatter(text);
    const today = new Date().toISOString().slice(0, 10);
    assert.match(body, new RegExp("\\| captured: " + today + "$", "m"));
    const [item] = parseEvidence(body);
    assert.equal(item.captured_at, today);
    assert.equal(item.description, "founder blog post", "the note must survive the new segment");
  });

describe("buildContentExampleLeadFile", () => {
  test("produces a lead.md whose frontmatter/body pass checkLeadShape (kind: content-example)", () => {
    const text = buildContentExampleLeadFile(CE_CANDIDATE, "builder");
    const { fm, body } = splitFrontmatter(text);
    assert.equal(fm.kind, "content-example");
    assert.equal(fm.source, "discovered");
    assert.equal(fm.status, "intake");
    assert.equal(fm.classification, undefined);
    assert.equal(fm.fit, undefined);
    assert.deepEqual(checkLeadShape("lead.md", fm, body), []);
    assert.match(body, /usage-based pricing/);
    assert.match(body, /discovered via \/scout \(theme: "builder"\)/);
  });

  test("falls back to placeholder text when why/angle are empty (model returned nothing usable)", () => {
    const text = buildContentExampleLeadFile({ ...CE_CANDIDATE, why: "", angle: "" }, "builder");
    const { body } = splitFrontmatter(text);
    assert.match(body, /\(no summary returned\)/);
    assert.match(body, /\(not yet drafted\)/);
  });
});

// ── STEP markers: what the Outreach tab's "Scout new leads" job puts on the progress checklist ──
// The GUI runs `npm run scout` through runCommandSpawn, whose stream reader parses `STEP n/total
// label` lines off stdout (src/review/jobs.ts). These assert the emitter and the parser speak the
// same dialect, and that a marker means real work: one per kind, fired before that kind runs.
describe("discovery: STEP markers", () => {
  const TMP_RUN_LOG = join(tmpdir(), `discover-steps-${randomUUID()}.jsonl`);

  // Records the marker AND the order it arrived in relative to the kind sweeps themselves, so a
  // marker emitted after its own work would fail rather than pass on count alone.
  function traceRun(kinds?: DiscoveryKind[]) {
    const trace: string[] = [];
    return {
      trace,
      run: () =>
        runDiscover({
          kinds,
          theme: "a fixed theme",
          runLogPath: TMP_RUN_LOG,
          onStep: (n, total, label) => trace.push(`STEP ${n}/${total} ${label}`),
          runKind: async (kind) => {
            trace.push(`ran ${kind}`);
            return { kind, created: [], skipped: [] };
          },
        }),
    };
  }

  after(() => rmSync(TMP_RUN_LOG, { force: true }));

  test("emits one marker per kind, in order, each before that kind's work", async () => {
    const { trace, run } = traceRun();
    await run();
    assert.deepEqual(trace, [
      "STEP 1/3 Scouting companies worth pitching",
      "ran client",
      "STEP 2/3 Scouting platforms worth pitching",
      "ran platform",
      "STEP 3/3 Scouting real examples to write about",
      "ran content-example",
    ]);
  });

  test("the total is the kinds actually about to run, not a fixed guess", async () => {
    const { trace, run } = traceRun(["platform"]);
    await run();
    assert.deepEqual(trace, ["STEP 1/1 Scouting platforms worth pitching", "ran platform"]);
  });

  test("every emitted line parses back through the job queue's own parser", async () => {
    const { trace, run } = traceRun();
    await run();
    const markers = trace.filter((l) => l.startsWith("STEP ")).map((l) => parseStepMarker(l));
    assert.equal(markers.length, DISCOVERY_KINDS.length);
    markers.forEach((m, i) => {
      assert.ok(m, `line ${i + 1} did not parse as a step marker`);
      assert.equal(m!.n, i + 1);
      assert.equal(m!.total, DISCOVERY_KINDS.length);
      assert.equal(m!.label, DISCOVERY_STEP_LABELS[DISCOVERY_KINDS[i]]);
      assert.ok(m!.label.length <= 48, `label ${m!.label.length} chars, over the 48-char budget`);
    });
  });

  test("a caller that passes no onStep still runs — markers stay opt-in", async () => {
    const ran: DiscoveryKind[] = [];
    const result = await runDiscover({
      theme: "a fixed theme",
      runLogPath: TMP_RUN_LOG,
      runKind: async (kind) => {
        ran.push(kind);
        return { kind, created: [], skipped: [] };
      },
    });
    assert.deepEqual(ran, [...DISCOVERY_KINDS]);
    assert.equal(result.results.length, DISCOVERY_KINDS.length);
  });

  // A step whose checklist row fills in with a marker Muxin's screen renders: the checklist state
  // the parser builds must match the phases that actually executed, never one more.
  test("the job's checklist ends with exactly the kinds that ran", async () => {
    const { trace, run } = traceRun(["client", "content-example"]);
    await run();
    const target = { steps: [] as string[], stepTotal: null as number | null, step: 0, ask: null };
    ingestMarkerChunk(target, trace.filter((l) => l.startsWith("STEP ")).join("\n"));
    assert.equal(target.stepTotal, 2);
    assert.deepEqual(target.steps, [
      DISCOVERY_STEP_LABELS.client,
      DISCOVERY_STEP_LABELS["content-example"],
    ]);
  });
});
