import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summarizeLead, groupByStatus, renderStatusTable, type LeadSummary } from "./status.js";

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
