import "../util/env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { repoRoot } from "../db/db.js";
import { logCost } from "../util/cost-log.js";
import type { TranscriptionProvider } from "../providers/types.js";

// Transcription bakeoff — whisper.cpp (free, local) vs Gemini (paid, per-token). Standalone from
// src/bakeoff/run.ts, which is image-gen only. There is no automated "quality" scorer here: only
// a human can judge verbatim accuracy against what was actually said. This script's job is to
// produce the side-by-side artifact (transcript + cost + latency per engine) for that human read,
// not to auto-pick a winner. See config/providers.yaml `transcription:` and
// docs/bakeoffs/whispercpp-vs-gemini-transcription.md.
//
//   npm run bakeoff:transcription -- <audio-file> [--name run-id]

const BAKEOFF_DIR = join(repoRoot, "bakeoff"); // gitignored (/bakeoff/) — same dir as the image bakeoff

type EngineResult = {
  name: string;
  status: "ok" | "error";
  text: string | null;
  costUsd: number | null;
  ms: number | null;
  note: string;
};

const CONTENDERS: { name: string; modulePath: string }[] = [
  { name: "gemini", modulePath: "../providers/transcription/gemini.js" },
  { name: "whispercpp", modulePath: "../providers/transcription/whispercpp.js" },
];

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function runOne(audioPath: string, name: string, modulePath: string): Promise<EngineResult> {
  try {
    const mod = (await import(modulePath)) as { provider?: TranscriptionProvider };
    if (!mod.provider) throw new Error(`${modulePath} does not export 'provider'`);
    const t0 = Date.now();
    const { text, costUsd } = await mod.provider.transcribe({ audioPath });
    const ms = Date.now() - t0;
    logCost({ step: `bakeoff:transcription:${name}`, detail: basename(audioPath), costUsd });
    return { name, status: "ok", text, costUsd, ms, note: "" };
  } catch (e) {
    const note = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
    return { name, status: "error", text: null, costUsd: null, ms: null, note };
  }
}

function comparisonMd(audioPath: string, runId: string, results: EngineResult[]): string {
  const rows = results.map((r) => {
    const cost = r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : "—";
    const secs = r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "—";
    return `| ${r.name} | ${r.status} | ${cost} | ${secs} |`;
  });
  const transcripts = results
    .map((r) => `### ${r.name}\n\n${r.status === "ok" ? r.text : `_${r.status}: ${r.note}_`}\n`)
    .join("\n");
  return `# Transcription bakeoff — ${runId}

**Audio:** ${basename(audioPath)}
**Generated:** ${new Date().toISOString()}

| Engine | Status | Cost | Latency |
|---|---|---|---|
${rows.join("\n")}

No automated quality score — read both transcripts against what was actually said and judge by
eye/ear. This artifact is the comparison; the verdict is a human call.

## Transcripts

${transcripts}`;
}

async function main(): Promise<void> {
  const audioPath = process.argv[2];
  if (!audioPath || audioPath.startsWith("--")) {
    console.error(
      "usage: npm run bakeoff:transcription -- <audio-file> [--name run-id]\n" +
        "  runs the audio through both the gemini and whispercpp transcription adapters and\n" +
        "  writes a side-by-side comparison (transcript, cost, latency) — no auto quality score."
    );
    process.exit(1);
  }

  const runId = flag("name") ?? `transcription-${stamp()}`;
  const outDir = join(BAKEOFF_DIR, runId);
  mkdirSync(outDir, { recursive: true });

  console.log(`transcription bakeoff "${runId}"\naudio: ${audioPath}\n`);

  const results: EngineResult[] = [];
  for (const c of CONTENDERS) {
    const r = await runOne(audioPath, c.name, c.modulePath);
    results.push(r);
    if (r.status === "ok") {
      console.log(`- ${r.name.padEnd(12)} ok    $${(r.costUsd ?? 0).toFixed(4)}  ${((r.ms ?? 0) / 1000).toFixed(1)}s`);
      console.log(`  "${(r.text ?? "").slice(0, 160)}${(r.text ?? "").length > 160 ? "…" : ""}"`);
    } else {
      console.log(`- ${r.name.padEnd(12)} ERROR ${r.note}`);
    }
  }

  writeFileSync(
    join(outDir, "results.json"),
    JSON.stringify({ runId, audioPath, createdAt: new Date().toISOString(), results }, null, 2)
  );
  writeFileSync(join(outDir, "comparison.md"), comparisonMd(audioPath, runId, results));

  console.log(`\n→ bakeoff/${runId}/comparison.md`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
