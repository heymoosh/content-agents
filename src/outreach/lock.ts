import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { setFrontmatterField, parseEvidence } from "./qualify.js";
import { checkMessageShape } from "./validate.js";
import { writeCell } from "../publish/queue.js";

// outreach:lock: stage 8 LOCK (docs/outreach-engine-plan.md §5/§6 Phase 2). Approved -> locked --
// Muxin approving an outreach-message row in the review GUI calls this (src/review/serve.ts's
// scheduleApproved dispatch), NEVER publishText or any other scheduler. CLAUDE.md rule 2 analog:
// there is no send path anywhere in this codebase; this only stamps a file and a decision-log
// line. Deterministic, no LLM call -- and it re-runs validate.ts's own two-sided guard
// (checkMessageShape) before ever locking, so a hand-edited or corrupted message can never
// become a legal /atomize source through the GUI's approve button.
//
//   tsx src/outreach/lock.ts outreach/leads/client-acme-co/messages/message-01.md
//
// Resolves its lead folder structurally (the message file's grandparent directory), the same
// "navigate by directory join, not by an embedded path string" convention research.ts/qualify.ts
// use to find lead.md -- never off the message's own `lead:` frontmatter value.

export interface LockResult {
  messageFile: string; // repo-relative
  leadFile: string; // absolute
  messageId: string;
  lockedAt: string;
  alreadyLocked: boolean;
}

function relToRepo(absPath: string): string {
  return absPath.startsWith(repoRoot) ? absPath.slice(repoRoot.length + 1) : absPath;
}

export function runLock(messageFileArg: string): LockResult {
  const absMessage = messageFileArg.startsWith("/") ? messageFileArg : join(repoRoot, messageFileArg);
  if (!existsSync(absMessage)) throw new Error(`no such message file: ${absMessage}`);

  const messagesDir = dirname(absMessage);
  const leadDir = dirname(messagesDir);
  const leadPath = join(leadDir, "lead.md");
  if (!existsSync(leadPath)) {
    throw new Error(`no lead.md found at ${leadPath} (expected messages/<file>.md under a lead folder)`);
  }

  const messageId = basename(absMessage, ".md");
  const relMessage = relToRepo(absMessage);
  const raw = readFileSync(absMessage, "utf8");
  const { fm, header, body } = splitFrontmatter(raw);

  const leadRaw = readFileSync(leadPath, "utf8");
  const leadParsed = splitFrontmatter(leadRaw);
  const leadEvidenceIds = new Set(parseEvidence(leadParsed.body).map((e) => e.id));

  if (String(fm.status ?? "") === "locked") {
    return {
      messageFile: relMessage,
      leadFile: leadPath,
      messageId,
      lockedAt: String(fm.locked_at ?? ""),
      alreadyLocked: true,
    };
  }

  const violations = checkMessageShape(basename(absMessage), fm, leadEvidenceIds);
  if (violations.length) {
    throw new Error(`refusing to lock ${relMessage}, fails the two-sided guard:\n  - ${violations.join("\n  - ")}`);
  }

  const date = new Date().toISOString().slice(0, 10);
  let newHeader = setFrontmatterField(header, "status", "locked");
  newHeader = /^locked_at:/m.test(newHeader)
    ? setFrontmatterField(newHeader, "locked_at", date)
    : newHeader.replace(/^(status: .*)$/m, `$1\nlocked_at: ${date}`);
  writeFileSync(absMessage, `${newHeader}\n${body}\n`);

  const decisionLine = `- ${date}: locked ${basename(absMessage)} (channel: ${String(fm.channel ?? "")})`;
  const newLeadBody = `${leadParsed.body.replace(/\n+$/, "")}\n${decisionLine}\n`;
  writeFileSync(leadPath, `${leadParsed.header}\n${newLeadBody}`);

  return { messageFile: relMessage, leadFile: leadPath, messageId, lockedAt: date, alreadyLocked: false };
}

// GUI adapter: matches src/review/serve.ts's SchedulerDeps `(folder, {onlyIds}) => Promise<unknown[]>`
// signature exactly, so scheduleApproved's dispatch needs no special-casing beyond picking this
// function for outreach-message rows. `folder` is the LEAD folder (e.g.
// outreach/leads/client-acme-co); onlyIds is the one message id being approved (e.g.
// ["message-01"]), mirroring how every other publisher in that dispatch is scoped to one row per
// approve-click. Returns [] (the same "nothing to do" shape other publishers use) when no id is
// given, rather than throwing. Also flips the review-queue.md row's own status to "locked" --
// the same "the publisher writes back its own terminal status" convention typefully.ts's
// publishText follows (setStatus(folder, row, "published")) -- so the row never reads as a
// stale "approve" once it's actually locked.
export async function lockOutreachMessageRow(
  folder: string,
  opts: { onlyIds?: string[] } = {},
): Promise<LockResult[]> {
  const id = opts.onlyIds?.[0];
  if (!id) return [];
  const messageFile = join(folder, "messages", `${id}.md`);
  const result = runLock(messageFile);
  writeCell(folder, id, { status: "locked" });
  return [result];
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/outreach/lock.ts <lead-folder>/messages/message-NN.md");
    process.exit(1);
  }
  try {
    const result = runLock(arg);
    console.log(
      result.alreadyLocked
        ? `already locked: ${result.messageFile} (locked_at=${result.lockedAt})`
        : `locked: ${result.messageFile} (locked_at=${result.lockedAt}), decision log updated in ${result.leadFile}`,
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
