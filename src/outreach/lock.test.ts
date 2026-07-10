import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue } from "../publish/queue.js";
import { runLock, lockOutreachMessageRow } from "./lock.js";

const LEAD_BODY = [
  "## Profile",
  "",
  "text",
  "",
  "## Evidence",
  "",
  '- E1 | signal: greenfield | person: | source: https://acme.co/a | quote: (none) | a note',
  '- E6 | signal: worldview-match | person: Jane Doe | source: https://acme.co/b | quote: "I was wrong" | founder reversal',
  "",
  "## Classification",
  "",
  "text",
  "",
  "## Pitch",
  "",
  "text",
  "",
  "## Decision log",
  "",
  "- 2026-07-01: intake (manual)",
].join("\n");

const LEAD_HEADER = [
  "---",
  "kind: client",
  'name: "Acme Co"',
  "url: https://acme.co",
  "source: manual",
  "status: drafted",
  "classification: greenfield",
  "pitch_angle: \"the angle\"",
  "---",
].join("\n");

function makeLeadWithMessage(messageFmOverrides: Record<string, string> = {}): {
  leadDir: string;
  messageFile: string;
} {
  const leadDir = mkdtempSync(join(tmpdir(), "outreach-lock-test-"));
  writeFileSync(join(leadDir, "lead.md"), `${LEAD_HEADER}\n\n${LEAD_BODY}\n`);
  writeFileSync(
    join(leadDir, "review-queue.md"),
    "# Outreach review queue -- Acme Co\n\n| id | platform | format | asset | native | brand | cta | status | notes | origin |\n" +
      "|----|----|----|----|----|----|----|----|----|----|\n" +
      "| message-01 | email | outreach-message | messages/message-01.md | — | — | — | approve |  | from /outreach draft |\n",
  );
  mkdirSync(join(leadDir, "messages"), { recursive: true });
  const fm: Record<string, string> = {
    lead: "client-acme-co",
    channel: "email",
    evidence: "[E1, E6]",
    classification: "greenfield",
    status: "draft",
    ...messageFmOverrides,
  };
  const fmLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  const messageFile = join(leadDir, "messages", "message-01.md");
  writeFileSync(messageFile, `---\n${fmLines.join("\n")}\n---\n\nHi Acme Co team,\n\nThis is the message body.\n`);
  return { leadDir, messageFile };
}

describe("runLock: approved -> locked", () => {
  test("sets status: locked and a locked_at date on the message", () => {
    const { leadDir, messageFile } = makeLeadWithMessage();
    try {
      const result = runLock(messageFile);
      assert.equal(result.alreadyLocked, false);
      const { fm } = splitFrontmatter(readFileSync(messageFile, "utf8"));
      assert.equal(fm.status, "locked");
      assert.ok(typeof fm.locked_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fm.locked_at as string));
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("appends an entry to the lead's own Decision log section", () => {
    const { leadDir, messageFile } = makeLeadWithMessage();
    try {
      runLock(messageFile);
      const leadRaw = readFileSync(join(leadDir, "lead.md"), "utf8");
      const { body } = splitFrontmatter(leadRaw);
      const decisionSection = body.split("## Decision log")[1];
      assert.ok(decisionSection.includes("locked message-01.md"));
      assert.ok(decisionSection.includes("channel: email"));
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("preserves the message body text untouched", () => {
    const { leadDir, messageFile } = makeLeadWithMessage();
    try {
      runLock(messageFile);
      const { body } = splitFrontmatter(readFileSync(messageFile, "utf8"));
      assert.ok(body.includes("This is the message body."));
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("is idempotent: locking an already-locked message is a no-op success, not a duplicate log entry", () => {
    const { leadDir, messageFile } = makeLeadWithMessage();
    try {
      const first = runLock(messageFile);
      const leadAfterFirst = readFileSync(join(leadDir, "lead.md"), "utf8");
      const second = runLock(messageFile);
      assert.equal(second.alreadyLocked, true);
      assert.equal(second.lockedAt, first.lockedAt);
      const leadAfterSecond = readFileSync(join(leadDir, "lead.md"), "utf8");
      assert.equal(leadAfterFirst, leadAfterSecond);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("refuses to lock a message that fails the two-sided guard (empty evidence)", () => {
    const { leadDir, messageFile } = makeLeadWithMessage({ evidence: "[]" });
    try {
      assert.throws(() => runLock(messageFile), /two-sided guard/);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("refuses to lock a message with an evidence id that doesn't exist in the lead", () => {
    const { leadDir, messageFile } = makeLeadWithMessage({ evidence: "[E1, E99]" });
    try {
      assert.throws(() => runLock(messageFile), /E99/);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("refuses to lock a message with an illegal classification", () => {
    const { leadDir, messageFile } = makeLeadWithMessage({ classification: "unclear" });
    try {
      assert.throws(() => runLock(messageFile), /non-fit/);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("throws a clear error when the message file does not exist", () => {
    const leadDir = mkdtempSync(join(tmpdir(), "outreach-lock-test-"));
    try {
      assert.throws(() => runLock(join(leadDir, "messages", "message-01.md")), /no such message file/);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });
});

describe("lockOutreachMessageRow: GUI approve-equals-lock adapter", () => {
  test("locks the message named by onlyIds[0] and returns it wrapped in an array", async () => {
    const { leadDir } = makeLeadWithMessage();
    try {
      const results = await lockOutreachMessageRow(leadDir, { onlyIds: ["message-01"] });
      assert.equal(results.length, 1);
      assert.equal(results[0].alreadyLocked, false);
      assert.ok(existsSync(join(leadDir, "messages", "message-01.md")));
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("returns an empty array when no onlyIds is given (mirrors other publishers' reuse-guard skip)", async () => {
    const { leadDir } = makeLeadWithMessage();
    try {
      const results = await lockOutreachMessageRow(leadDir, {});
      assert.deepEqual(results, []);
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });

  test("flips the review-queue.md row's own status to locked, mirroring how every other publisher writes back its terminal status", async () => {
    const { leadDir } = makeLeadWithMessage();
    try {
      await lockOutreachMessageRow(leadDir, { onlyIds: ["message-01"] });
      const { rows } = readQueue(leadDir);
      assert.equal(rows.find((r) => r.id === "message-01")?.status, "locked");
    } finally {
      rmSync(leadDir, { recursive: true, force: true });
    }
  });
});
