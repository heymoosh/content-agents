// Matchmaker-read backfill for EXISTING leads (design 3d): writes why_them / why_me / why_mutual
// frontmatter from the evidence ALREADY on file -- no web access, no new research. New leads get
// these fields from research.ts's updated prompt; this is the one-shot catch-up for leads
// researched before the fields existed.
//
//   npm run outreach:matchmaker -- outreach/leads/client-posthog
//
// Content-generation logic (CLAUDE.md rule 7): the prompt below decides what the dossier says to
// Muxin. A PR touching it holds for review with a before/after sample.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { getAnalyst } from "../providers/registry.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { extractSection, parseEvidence, upsertFrontmatterField } from "./qualify.js";
import { logCost } from "../util/cost-log.js";

const TIMEOUT_MS = 240_000;

// Pure prompt assembly, exported for unit tests. Mirrors research.ts's WHY_* output contract
// exactly -- one rubric, two entry points.
export function buildMatchmakerPrompt(opts: {
  name: string;
  kind: string;
  profile: string;
  pitchAngle: string;
  evidenceLines: string;
}): string {
  const what = opts.kind === "platform" ? "platform (a stage or audience that could host Muxin)" : "company";
  return [
    `You are writing the MATCHMAKER READ for an outreach dossier in Muxin Li's content system. The lead was researched earlier; every fact you may use is below. Do not invent anything; no web access.`,
    ``,
    `Lead: ${opts.name} (${what})`,
    `Recorded pitch angle: ${opts.pitchAngle || "(none)"}`,
    ``,
    `Profile on file:`,
    opts.profile || "(none)",
    ``,
    `Evidence on file (cite only these):`,
    opts.evidenceLines || "(none)",
    ``,
    `Write three short blocks, addressed directly TO Muxin (second person), in Muxin's plain voice per config/voice.yaml: no em dashes, no AI tells, no strategy-memo prose, no flattery. Concrete beats clever. If the evidence is too thin for an honest claim, say so plainly in that block instead of padding.`,
    ``,
    `--- OUTPUT FORMAT (exact markers, nothing before the first or after the last) ---`,
    `WHY_THEM: <1-2 sentences: what this ${opts.kind === "platform" ? "platform" : "company"} concretely offers Muxin>`,
    `WHY_ME: <1-2 sentences: what Muxin brings that they are visibly missing, per the evidence>`,
    `WHY_MUTUAL: <2-3 sentences: the matchmaker read -- why these two, why now. Direct, energetic, honest.>`,
  ].join("\n");
}

// Same tolerant marker parse research.ts uses, scoped to the three WHY_* fields.
export function parseMatchmakerResponse(text: string): { whyThem: string; whyMe: string; whyMutual: string } {
  const markerRe = /^(WHY_THEM|WHY_ME|WHY_MUTUAL):\s*(.*)$/;
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(markerRe);
    if (m) {
      current = m[1];
      sections[current] = sections[current] ?? [];
      if (m[2]) sections[current].push(m[2]);
      continue;
    }
    if (current) sections[current].push(line);
  }
  const get = (key: string) => (sections[key] ?? []).join("\n").trim();
  return { whyThem: get("WHY_THEM"), whyMe: get("WHY_ME"), whyMutual: get("WHY_MUTUAL") };
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\s+/g, " ").trim().replace(/"/g, '\\"')}"`;
}

export async function runMatchmaker(dirArg: string): Promise<{ dir: string; wrote: string[] }> {
  const absDir = dirArg.startsWith("/") ? dirArg : join(repoRoot, dirArg);
  const leadPath = join(absDir, "lead.md");
  if (!existsSync(leadPath)) throw new Error(`no lead.md found at ${absDir}`);
  const raw = readFileSync(leadPath, "utf8");
  const { header, body, fm } = splitFrontmatter(raw);
  const evidence = parseEvidence(body);
  if (evidence.length === 0) throw new Error("refusing: lead.md has zero evidence items -- research it first");

  const evidenceLines = evidence
    .map((e) => `- ${e.id} (${e.signal}${e.person ? `, ${e.person}` : ""}): ${e.quote && e.quote !== "(none)" ? `"${e.quote}"` : e.description} -- ${e.source}`)
    .join("\n");
  const prompt = buildMatchmakerPrompt({
    name: String(fm.name ?? basename(absDir)),
    kind: String(fm.kind ?? "client"),
    profile: extractSection(body, "## Profile").trim(),
    pitchAngle: String(fm.pitch_angle ?? ""),
    evidenceLines,
  });

  // The ANALYST provider (GPT-first via Codex, Claude fallback -- Muxin's 2026-07-19 routing
  // call: understanding who to reach and why is analysis work). The prompt is self-contained.
  const analyst = await getAnalyst();
  const analysis = await analyst.analyze({ prompt, timeoutMs: TIMEOUT_MS });
  const parsed = parseMatchmakerResponse(analysis.text);
  const wrote: string[] = [];
  let newHeader = header;
  if (parsed.whyThem) { newHeader = upsertFrontmatterField(newHeader, "why_them", yamlQuote(parsed.whyThem)); wrote.push("why_them"); }
  if (parsed.whyMe) { newHeader = upsertFrontmatterField(newHeader, "why_me", yamlQuote(parsed.whyMe)); wrote.push("why_me"); }
  if (parsed.whyMutual) { newHeader = upsertFrontmatterField(newHeader, "why_mutual", yamlQuote(parsed.whyMutual)); wrote.push("why_mutual"); }
  if (!wrote.length) throw new Error("model returned no WHY_* blocks -- lead.md left untouched");
  newHeader = upsertFrontmatterField(newHeader, "why_source", analysis.engine); wrote.push(`why_source=${analysis.engine}`);
  writeFileSync(leadPath, `${newHeader}\n${body.trim()}\n`);
  logCost({ step: "outreach:matchmaker", detail: `${String(fm.name ?? dirArg)} (${analysis.engine})`, costUsd: analysis.costUsd });
  return { dir: dirArg, wrote };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dirArg = process.argv[2];
  if (!dirArg) {
    console.error("usage: npm run outreach:matchmaker -- outreach/leads/<dir>");
    process.exit(1);
  }
  runMatchmaker(dirArg)
    .then((r) => console.log(`wrote ${r.wrote.join(", ")} to ${r.dir}/lead.md`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
