import "../util/env.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { logCost } from "../util/cost-log.js";
import { appendRow } from "../publish/queue.js";
import { parseEvidence, type EvidenceItem } from "./qualify.js";

// outreach:draft: stage 6 DRAFT (docs/outreach-engine-plan.md §5/§6 Phase 2). Composes ONE
// outreach message for an already-qualified lead via a `claude -p` subprocess (mirrors
// research.ts's subprocess-invocation pattern). This is the ONE place in the whole engine
// composed prose is allowed (CLAUDE.md rule 1's scoped exception, same posture as video scripts
// and Build 2 fiction) -- legal only because Muxin reviews every message in the GUI before
// lock.ts can ever fire. There is no send path anywhere in this codebase (CLAUDE.md rule 2
// analog): this writes a file and a review-queue.md row, nothing else.
//
//   tsx src/outreach/draft.ts outreach/leads/client-acme-co [--channel email|linkedin-dm|contact-form|podcast-pitch]
//
// kind: platform uses `fit` (strong|partial) in place of kind: client's `classification`
// (turnaround|greenfield) -- same two-sided-guard posture, parallel field per validate.ts's own
// kind-specific lead-shape rules.

const execFileP = promisify(execFile);

export const CHANNELS = ["email", "linkedin-dm", "contact-form", "podcast-pitch"] as const;
export type Channel = (typeof CHANNELS)[number];

const DRAFT_TIMEOUT_MS = 120_000; // same order of magnitude as reply-draft.ts's REPLY_TIMEOUT_MS

// Exported so the GUI's draft path (src/review/jobs.ts, card d39258ab) can invoke `claude` with the
// SAME model as callClaudeDraft below -- the GUI swaps subprocess transport (a logged spawn instead
// of execFile, for a real log + heartbeat) but must never change what gets generated.
export function draftModel(): string {
  return (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim();
}

const POSITIVE_CLASSIFICATIONS = new Set(["turnaround", "greenfield"]);
const POSITIVE_FITS = new Set(["strong", "partial"]);

// Deterministic evidence selection for the two-sided guard: the classification-supporting
// signal plus any worldview-match item(s), so the message frontmatter's `evidence` list -- and
// what draft.ts actually asks Claude to write about -- always cites REAL, specific facts about
// this lead, never a free choice the model could hallucinate around. Falls back to every
// evidence item on file if nothing matches (a qualified/pursue lead is guaranteed >=1 evidence
// item by qualify.ts's own rules, so this never returns empty on a lead runDraft has already
// let through its classification guard).
export function selectEvidenceForDraft(evidence: EvidenceItem[], classification: string): EvidenceItem[] {
  const picked = evidence.filter((e) => e.signal === classification || e.signal === "worldview-match");
  return picked.length ? picked : evidence;
}

// Pure prompt assembly, exported so it's unit-testable without spawning a subprocess -- mirrors
// buildResearchPrompt/buildReplyPrompt's role in research.ts/reply-draft.ts.
export function buildDraftPrompt(opts: {
  leadName: string;
  channel: Channel;
  classification: string;
  classificationLabel?: string;
  pitchAngle: string;
  evidence: EvidenceItem[];
}): string {
  const evidenceLines = opts.evidence
    .map((e) => {
      const text = e.quote && e.quote !== "(none)" ? `"${e.quote}"` : e.description;
      return `- ${e.id} (${e.signal}${e.person ? `, ${e.person}` : ""}): ${text} -- ${e.source}`;
    })
    .join("\n");
  return [
    `You are drafting ONE outreach message for Muxin Li to send BY HAND to ${opts.leadName} (docs/outreach-engine-plan.md stage 6, DRAFT). Print ONLY the message body to stdout: no subject line, no preamble, no quote marks around it, no explanation, nothing else.`,
    ``,
    `Channel: ${opts.channel}`,
    `${opts.classificationLabel ?? "Classification"}: ${opts.classification}`,
    `Approved pitch angle: ${opts.pitchAngle || "(none recorded, find the honest angle from the evidence below)"}`,
    ``,
    `Cite THESE SPECIFIC facts about ${opts.leadName} (the two-sided rule: name their real situation, not just shared values):`,
    evidenceLines,
    ``,
    `RULES:`,
    `- Two-sided: the message must name something concrete and true about ${opts.leadName} from the evidence above. Do not write a generic template that could go to anyone; do not lead with flattery about shared values alone.`,
    `- Do not invent a fact, statistic, or quote beyond what is given above.`,
    `- Follow config/voice.yaml: Muxin's plain, direct voice. No em dashes anywhere (use periods, commas, colons, or parentheses instead). No AI tells ("here's the thing", "I hope this finds you well", hedging, thought-leader cadence).`,
    `- Short. A real person writing a real note, not a marketing email. No hashtags, no emoji.`,
    `- End with a low-pressure, specific ask (a short call, a reply), not a hard sell.`,
    `- Print ONLY the message body. Nothing else.`,
  ].join("\n");
}

async function callClaudeDraft(prompt: string): Promise<string> {
  const model = draftModel();
  let stdout: string;
  try {
    // `--tools ""`: drafting only ever needs Claude to read the prompt and print text -- every
    // fact it can cite already lives in the evidence embedded above (research.ts already ran the
    // live web search at stage 3) -- so there is no legitimate need for tool access here, mirrors
    // reply-draft.ts's same lockdown rationale.
    const r = await execFileP("claude", ["-p", prompt, "--model", model, "--tools", ""], {
      cwd: repoRoot,
      timeout: DRAFT_TIMEOUT_MS,
      maxBuffer: 5_000_000,
    });
    stdout = r.stdout;
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error("`claude` CLI not on PATH -- draft.ts needs Claude Code installed");
    }
    if (err.killed) {
      throw new Error(`claude -p timed out after ${Math.round(DRAFT_TIMEOUT_MS / 1000)}s during draft`);
    }
    throw new Error(`claude -p failed: ${err.stderr?.trim() || (e instanceof Error ? e.message : String(e))}`);
  }
  const text = stdout.trim();
  if (!text) throw new Error("claude -p returned no text during draft");
  return text;
}

function nextMessageNumber(messagesDir: string): number {
  if (!existsSync(messagesDir)) return 1;
  const nums = readdirSync(messagesDir)
    .map((f) => f.match(/^message-(\d+)\.md$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => Number(m[1]));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

export interface DraftResult {
  dir: string;
  messageFile: string;
  messageId: string;
  channel: Channel;
  evidenceIds: string[];
}

export async function runDraft(
  dirArg: string,
  // `recipient` names the person the message addresses ("Jamie R."). Recorded into the message
  // frontmatter as provenance for the per-person follow-up clock; NOT fed into the drafting
  // prompt here (the prompt is content-generation logic -- addressing the recipient by name in
  // the composed text is the /outreach skill's held change, not this plumbing's).
  opts: { channel?: string; recipient?: string; callClaude?: (prompt: string) => Promise<string> } = {},
): Promise<DraftResult> {
  const absDir = dirArg.startsWith("/") ? dirArg : join(repoRoot, dirArg);
  const leadPath = join(absDir, "lead.md");
  if (!existsSync(leadPath)) throw new Error(`no lead.md found at ${absDir}`);
  const raw = readFileSync(leadPath, "utf8");
  const { fm, body } = splitFrontmatter(raw);

  const kind = fm.kind === "platform" ? "platform" : "client";

  let classification: string;
  let classificationLabel: string | undefined;
  if (kind === "platform") {
    const fit = String(fm.fit ?? "unclear");
    if (!POSITIVE_FITS.has(fit)) {
      throw new Error(
        `refusing to draft: fit is "${fit}" (must be strong or partial) -- you don't draft outreach off a non-fit`,
      );
    }
    classification = fit;
    classificationLabel = "Fit";
  } else {
    classification = String(fm.classification ?? "unclear");
    if (!POSITIVE_CLASSIFICATIONS.has(classification)) {
      throw new Error(
        `refusing to draft: classification is "${classification}" (must be turnaround or greenfield) -- you don't draft outreach off a non-fit`,
      );
    }
  }

  const evidence = parseEvidence(body);
  if (evidence.length === 0) {
    throw new Error("refusing to draft: lead.md has zero evidence items");
  }

  const channelArg = (opts.channel ?? "email").trim();
  if (!(CHANNELS as readonly string[]).includes(channelArg)) {
    throw new Error(`--channel must be one of ${CHANNELS.join("|")} (got "${channelArg}")`);
  }
  const channel = channelArg as Channel;

  const leadName = String(fm.name ?? dirArg);
  const pitchAngle = String(fm.pitch_angle ?? "");
  const selected = selectEvidenceForDraft(evidence, classification);

  const prompt = buildDraftPrompt({ leadName, channel, classification, classificationLabel, pitchAngle, evidence: selected });
  // GUI callers (src/review/jobs.ts, card d39258ab) inject a callClaude backed by the shared logged
  // spawn (runClaudeSpawn) instead of this file's own execFile call, for a real job log + heartbeat
  // -- same model/tools/prompt/timeout either way, only the transport differs. The CLI path below
  // (main()) and every test always use the default execFile-based callClaudeDraft.
  const messageBody = await (opts.callClaude ?? callClaudeDraft)(prompt);

  const messagesDir = join(absDir, "messages");
  mkdirSync(messagesDir, { recursive: true });
  const num = nextMessageNumber(messagesDir);
  const messageId = `message-${String(num).padStart(2, "0")}`;
  const messageFile = join(messagesDir, `${messageId}.md`);

  const leadSlug = basename(absDir);
  const evidenceIds = selected.map((e) => e.id);
  const classificationField = kind === "platform" ? `fit: ${classification}\n` : `classification: ${classification}\n`;
  const recipient = (opts.recipient ?? "").trim().replace(/\n/g, " ");
  const frontmatter =
    `---\n` +
    `lead: ${leadSlug}\n` +
    `channel: ${channel}\n` +
    (recipient ? `recipient: "${recipient.replace(/"/g, '\\"')}"\n` : "") +
    `evidence: [${evidenceIds.join(", ")}]\n` +
    classificationField +
    `status: draft   # draft | approved | locked\n` +
    `---\n`;

  // Append the queue row BEFORE writing the message body: if the process dies between these two
  // writes, a "pending" row pointing at a not-yet-written asset is a visible, diagnosable gap
  // (the GUI / outreach:status shows the row; opening it surfaces the missing file). The reverse
  // order risks an orphaned message file with no queue trail at all -- invisible to both.
  appendRow(absDir, {
    id: messageId,
    platform: channel,
    format: "outreach-message",
    asset: `messages/${messageId}.md`,
    status: "pending", // NEVER "approve" on creation -- CLAUDE.md rule 2 analog, Muxin reviews first
    origin: "from /outreach draft",
  });

  writeFileSync(messageFile, `${frontmatter}\n${messageBody}\n`);

  logCost({ step: "outreach:draft", detail: leadName, costUsd: 0 });

  return { dir: dirArg, messageFile, messageId, channel, evidenceIds };
}

function parseArgs(argv: string[]): { dir?: string; channel?: string } {
  let dir: string | undefined;
  let channel: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--channel") channel = argv[++i];
    else if (!a.startsWith("--")) dir = a;
  }
  return { dir, channel };
}

function main() {
  const { dir, channel } = parseArgs(process.argv.slice(2));
  if (!dir) {
    console.error("usage: tsx src/outreach/draft.ts <lead-folder> [--channel email|linkedin-dm|contact-form|podcast-pitch]");
    process.exit(1);
  }
  runDraft(dir, { channel })
    .then((result) => {
      console.log(`${result.messageFile} (channel=${result.channel}, evidence=[${result.evidenceIds.join(", ")}])`);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
