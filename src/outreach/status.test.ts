import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { summarizeLead, groupByStatus, renderStatusTable, renderTargetsList, readLeadDetail, type LeadSummary } from "./status.js";

function makeLeadMd(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    kind: "client",
    name: '"Acme Co"',
    url: "https://acme.co",
    source: "manual",
    status: "intake",
    classification: "unclear",
    pitch_angle: "",
    ...overrides,
  };
  const lines = ["---", ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), "---", "", "## Profile", "", "x"];
  return lines.join("\n");
}

describe("summarizeLead", () => {
  test("extracts kind/name/source/status/classification from a client lead", () => {
    const summary = summarizeLead("outreach/leads/client-acme-co", makeLeadMd());
    assert.equal(summary.dir, "outreach/leads/client-acme-co");
    assert.equal(summary.kind, "client");
    assert.equal(summary.name, "Acme Co");
    assert.equal(summary.source, "manual");
    assert.equal(summary.status, "intake");
    assert.equal(summary.classificationOrFit, "unclear");
  });

  test("reads the fit field (not classification) for a platform-kind lead", () => {
    // A hand-built platform-kind fixture (not makeLeadMd, which always emits a classification
    // line) -- a real platform lead.md never carries that field, see intake.ts's writeLeadFile.
    const platformRaw = [
      "---",
      "kind: platform",
      'name: "Some Podcast"',
      "url: https://pod.example.com",
      "source: manual",
      "status: researched",
      "fit: strong",
      "pitch_angle: ",
      "---",
      "",
      "## Profile",
    ].join("\n");
    const summary = summarizeLead("outreach/leads/platform-some-podcast", platformRaw);
    assert.equal(summary.kind, "platform");
    assert.equal(summary.classificationOrFit, "strong");
  });

  test("defaults missing fields to empty strings instead of throwing", () => {
    const summary = summarizeLead("outreach/leads/x", "no frontmatter at all");
    assert.equal(summary.name, "");
    assert.equal(summary.status, "");
    assert.equal(summary.classificationOrFit, "");
  });
});

describe("groupByStatus", () => {
  const A: LeadSummary = {
    dir: "outreach/leads/client-a", kind: "client", name: "A", source: "manual",
    status: "pursue", classificationOrFit: "turnaround", pitchAngle: "",
  };
  const B: LeadSummary = {
    dir: "outreach/leads/client-b", kind: "client", name: "B", source: "manual",
    status: "intake", classificationOrFit: "unclear", pitchAngle: "",
  };
  const C: LeadSummary = {
    dir: "outreach/leads/client-c", kind: "client", name: "C", source: "manual",
    status: "pursue", classificationOrFit: "greenfield", pitchAngle: "",
  };

  test("groups leads by their status field", () => {
    const groups = groupByStatus([A, B, C]);
    assert.equal(groups.get("pursue")?.length, 2);
    assert.equal(groups.get("intake")?.length, 1);
  });

  test("falls back to a (no status) bucket for an empty status", () => {
    const noStatus: LeadSummary = { ...A, status: "" };
    const groups = groupByStatus([noStatus]);
    assert.ok(groups.has("(no status)"));
  });
});

describe("renderStatusTable", () => {
  test("returns a friendly empty-state message for zero leads", () => {
    const text = renderStatusTable([]);
    assert.ok(text.includes("no outreach leads yet"));
  });

  test("lists a lead under its status heading with kind, source, and classification", () => {
    const lead: LeadSummary = {
      dir: "outreach/leads/client-acme-co", kind: "client", name: "Acme Co", source: "manual",
      status: "pursue", classificationOrFit: "turnaround", pitchAngle: "some pitch",
    };
    const text = renderStatusTable([lead]);
    assert.ok(text.includes("PURSUE (1)"));
    assert.ok(text.includes("Acme Co [client, manual] classification=turnaround"));
    assert.ok(text.includes("outreach/leads/client-acme-co"));
  });

  test("orders pursue-worthy leads before intake/passed leads", () => {
    const pursueLead: LeadSummary = {
      dir: "outreach/leads/client-a", kind: "client", name: "A", source: "manual",
      status: "pursue", classificationOrFit: "turnaround", pitchAngle: "",
    };
    const intakeLead: LeadSummary = {
      dir: "outreach/leads/client-b", kind: "client", name: "B", source: "manual",
      status: "intake", classificationOrFit: "unclear", pitchAngle: "",
    };
    const text = renderStatusTable([intakeLead, pursueLead]);
    assert.ok(text.indexOf("PURSUE") < text.indexOf("INTAKE"));
  });

  test("uses the fit field label for a platform-kind lead", () => {
    const lead: LeadSummary = {
      dir: "outreach/leads/platform-some-podcast", kind: "platform", name: "Some Podcast", source: "manual",
      status: "researched", classificationOrFit: "strong", pitchAngle: "",
    };
    const text = renderStatusTable([lead]);
    assert.ok(text.includes("fit=strong"));
  });
});

describe("renderTargetsList", () => {
  const strongPlatform: LeadSummary = {
    dir: "outreach/leads/platform-strong-show", kind: "platform", name: "Strong Show", source: "manual",
    status: "pursue", classificationOrFit: "strong", pitchAngle: "the civic-tech angle applies here",
  };
  const partialPlatform: LeadSummary = {
    dir: "outreach/leads/platform-partial-show", kind: "platform", name: "Partial Show", source: "discovered",
    status: "qualified", classificationOrFit: "partial", pitchAngle: "a thinner but real overlap",
  };
  const weakPlatform: LeadSummary = {
    dir: "outreach/leads/platform-weak-show", kind: "platform", name: "Weak Show", source: "manual",
    status: "qualified", classificationOrFit: "weak", pitchAngle: "",
  };
  const clientLead: LeadSummary = {
    dir: "outreach/leads/client-acme", kind: "client", name: "Acme Co", source: "manual",
    status: "pursue", classificationOrFit: "turnaround", pitchAngle: "a client pitch angle",
  };

  test("returns a friendly empty-state message when there are no platform-kind leads", () => {
    const text = renderTargetsList([clientLead]);
    assert.ok(text.includes("no platform-kind leads yet"));
  });

  test("includes only platform-kind leads, excluding client-kind leads entirely", () => {
    const text = renderTargetsList([clientLead, strongPlatform]);
    assert.ok(!text.includes("Acme Co"));
    assert.ok(text.includes("Strong Show"));
  });

  test("renders name, fit verdict, pitch angle, and source dir for each platform lead", () => {
    const text = renderTargetsList([strongPlatform]);
    assert.ok(text.includes("Strong Show"));
    assert.ok(text.includes("strong"));
    assert.ok(text.includes("the civic-tech angle applies here"));
    assert.ok(text.includes("outreach/leads/platform-strong-show"));
  });

  test("orders strong/partial fit ahead of weak fit", () => {
    const text = renderTargetsList([weakPlatform, strongPlatform, partialPlatform]);
    const strongIdx = text.indexOf("Strong Show");
    const partialIdx = text.indexOf("Partial Show");
    const weakIdx = text.indexOf("Weak Show");
    assert.ok(strongIdx < partialIdx);
    assert.ok(partialIdx < weakIdx);
  });

  test("shows a placeholder when a lead has no pitch angle yet", () => {
    const text = renderTargetsList([weakPlatform]);
    assert.ok(text.includes("no pitch angle yet"));
  });
});

describe("readLeadDetail", () => {
  // Uses an absolute tmpdir path (readLeadDetail supports "starts with / else join(repoRoot,...)",
  // the same convention runResearch/runQualify/runLock use) so this test never touches the real
  // outreach/leads/ tree.
  function writeLeadFixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "status-test-"));
    const leadMd = [
      "---",
      "kind: client",
      'name: "Acme Co"',
      "url: https://acme.co",
      "source: discovered",
      "status: researched",
      "classification: greenfield",
      'pitch_angle: "lead with the shared worldview"',
      "---",
      "",
      "## Profile",
      "",
      "Acme makes widgets.",
      "",
      "## Evidence",
      "",
      '- E1 | signal: worldview-match | person: | source: https://acme.co/blog | quote: "we believe in people" | founder blog post',
      "",
      "## Classification",
      "",
      "Per E1, a real worldview match.",
      "",
      "## Pitch",
      "",
      "lead with the shared worldview",
      "",
      "## Decision log",
      "",
      '- 2026-07-16: discovered via /scout (theme: "career-work")',
    ].join("\n");
    writeFileSync(join(dir, "lead.md"), leadMd);
    return dir;
  }

  test("parses profile, evidence (with clickable source + quote), classification note, and pitch", () => {
    const dir = writeLeadFixture();
    try {
      const detail = readLeadDetail(dir);
      assert.equal(detail.name, "Acme Co");
      assert.equal(detail.classificationOrFit, "greenfield");
      assert.match(detail.profile, /Acme makes widgets\./);
      assert.equal(detail.evidence.length, 1);
      assert.equal(detail.evidence[0].source, "https://acme.co/blog");
      assert.match(detail.evidence[0].quote, /we believe in people/);
      assert.match(detail.classificationNote, /Per E1, a real worldview match\./);
      assert.match(detail.pitch, /lead with the shared worldview/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
