import "../util/env.js";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { logCost } from "../util/cost-log.js";
import type { ImageProvider } from "../providers/types.js";

// Image-gen bakeoff. Run one prompt across every contender in config/bakeoff.yaml whose API
// key is present, write the images + a side-by-side gallery + a scorecard, and (after you
// score) rank by price, quality, and quality-per-dollar.
//
//   npm run bakeoff -- --prompt "..." [--aspect 1:1] [--name run] [--only a,b] \
//                      [--suffix "..."] [--svg path.svg]
//   npm run bakeoff -- --decide <run>

type Aspect = "1:1" | "9:16" | "16:9";

type Contender = {
  label: string;
  provider: string;
  requires?: string | null;
  cost_usd?: number;
  needs_svg?: boolean;
  params?: Record<string, unknown>;
};

type BakeoffConfig = {
  aspect_default?: string;
  image_size?: string;
  contenders: Contender[];
};

type Result = {
  label: string;
  provider: string;
  model: string;
  status: "ok" | "skipped" | "error";
  costUsd: number | null;
  ms: number | null;
  file: string | null;
  note: string;
};

const BAKEOFF_DIR = join(repoRoot, "bakeoff");

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

function loadConfig(): BakeoffConfig {
  const cfg = parse(readFileSync(join(repoRoot, "config", "bakeoff.yaml"), "utf8")) as BakeoffConfig;
  if (!cfg?.contenders?.length) throw new Error("config/bakeoff.yaml has no contenders");
  return cfg;
}

function modelLabel(c: Contender): string {
  return (c.params?.model as string) ?? c.provider;
}

async function run(): Promise<void> {
  const cfg = loadConfig();

  const prompt = flag("prompt");
  if (!prompt) {
    console.error(
      'usage: npm run bakeoff -- --prompt "..." [--aspect 1:1] [--name run] [--only a,b] [--suffix "..."] [--svg file.svg]\n' +
        "       npm run bakeoff -- --decide <run>"
    );
    process.exit(1);
  }
  const aspect = (flag("aspect") ?? cfg.aspect_default ?? "1:1") as Aspect;
  const suffix = flag("suffix");
  const fullPrompt = suffix ? `${prompt} ${suffix}` : prompt;
  const only = flag("only")?.split(",").map((s) => s.trim());
  const svgArg = flag("svg");
  const svgPath = svgArg ? (isAbsolute(svgArg) ? svgArg : join(repoRoot, svgArg)) : undefined;
  const runId = flag("name") ?? `run-${stamp()}`;
  const outDir = join(BAKEOFF_DIR, runId);
  mkdirSync(outDir, { recursive: true });

  let contenders = cfg.contenders;
  if (only) contenders = contenders.filter((c) => only.includes(c.label));
  if (!contenders.length) throw new Error(`no contenders match --only ${flag("only")}`);

  console.log(`bakeoff "${runId}"  aspect ${aspect}\nprompt: ${fullPrompt}\n`);

  const results: Result[] = [];
  for (const c of contenders) {
    const model = modelLabel(c);

    if (c.requires && !process.env[c.requires]) {
      results.push({ label: c.label, provider: c.provider, model, status: "skipped", costUsd: null, ms: null, file: null, note: `set ${c.requires} in .env` });
      console.log(`- ${c.label.padEnd(18)} skipped (set ${c.requires})`);
      continue;
    }
    if (c.needs_svg && !svgPath) {
      results.push({ label: c.label, provider: c.provider, model, status: "skipped", costUsd: null, ms: null, file: null, note: "pass --svg <file>" });
      console.log(`- ${c.label.padEnd(18)} skipped (author an SVG, pass --svg <file>)`);
      continue;
    }

    try {
      const mod = (await import(`../providers/image/${c.provider}.js`)) as { provider?: ImageProvider };
      if (!mod.provider) throw new Error(`src/providers/image/${c.provider}.ts does not export 'provider'`);
      const file = `${c.label}.png`;
      const params: Record<string, unknown> = {
        ...c.params,
        cost_usd: c.cost_usd,
        image_size: c.params?.image_size ?? cfg.image_size,
      };
      if (c.needs_svg && svgPath) params.svgPath = svgPath;

      const t0 = Date.now();
      const { costUsd } = await mod.provider.generate({
        prompt: fullPrompt,
        aspect,
        outPath: join(outDir, file),
        params,
      });
      const ms = Date.now() - t0;
      logCost({ step: `bakeoff:${c.label}`, detail: `${runId}/${c.label}`, costUsd });
      results.push({ label: c.label, provider: c.provider, model, status: "ok", costUsd, ms, file, note: "" });
      console.log(`- ${c.label.padEnd(18)} ok   $${costUsd.toFixed(3)}  ${(ms / 1000).toFixed(1)}s`);
    } catch (e) {
      const note = (e as Error).message.replace(/\s+/g, " ").slice(0, 200);
      results.push({ label: c.label, provider: c.provider, model, status: "error", costUsd: null, ms: null, file: null, note });
      console.log(`- ${c.label.padEnd(18)} ERROR ${note.slice(0, 110)}`);
    }
  }

  // Stash the authored SVG alongside the run for reproducibility.
  if (svgPath && existsSync(svgPath)) {
    try {
      copyFileSync(svgPath, join(outDir, "remotion-svg.svg"));
    } catch {
      /* best effort */
    }
  }

  const rank = (r: Result) => (r.status === "ok" ? 0 : r.status === "skipped" ? 1 : 2);
  results.sort((a, b) => rank(a) - rank(b) || (a.costUsd ?? Infinity) - (b.costUsd ?? Infinity));

  writeFileSync(
    join(outDir, "results.json"),
    JSON.stringify({ runId, prompt: fullPrompt, aspect, createdAt: new Date().toISOString(), results }, null, 2)
  );
  writeFileSync(join(outDir, "prompt.txt"), `${fullPrompt}\n`);
  writeFileSync(join(outDir, "gallery.html"), galleryHtml(runId, fullPrompt, aspect, results));
  writeFileSync(join(outDir, "scorecard.md"), scorecardMd(runId, fullPrompt, aspect, results));

  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\n${ok}/${results.length} generated → bakeoff/${runId}/`);
  console.log(`  view:    open bakeoff/${runId}/gallery.html`);
  console.log(`  score:   edit bakeoff/${runId}/scorecard.md  (Quality 1-5, mark the winner)`);
  console.log(`  decide:  npm run bakeoff -- --decide ${runId}`);
}

function galleryHtml(runId: string, prompt: string, aspect: Aspect, results: Result[]): string {
  const cheapestOk = results.find((r) => r.status === "ok")?.label;
  const card = (r: Result) => {
    const cost = r.costUsd != null ? `$${r.costUsd.toFixed(3)}` : "—";
    const secs = r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "";
    const badge = r.label === cheapestOk ? `<span class="badge">cheapest</span>` : "";
    const body =
      r.status === "ok"
        ? `<img src="./${r.file}" alt="${r.label}">`
        : `<div class="miss ${r.status}">${r.status}<br><small>${r.note}</small></div>`;
    return `<figure>
      <div class="frame">${body}</div>
      <figcaption><b>${r.label}</b> ${badge}<br><span class="meta">${r.model}</span><br><span class="meta">${cost} · ${secs}</span></figcaption>
    </figure>`;
  };
  return `<!doctype html><meta charset="utf-8"><title>bakeoff ${runId}</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f2ead9; color: #1a1a1a; }
  header { padding: 28px 32px; border-bottom: 2px solid #1a1a1a; }
  header h1 { margin: 0 0 6px; font-size: 18px; letter-spacing: .3px; }
  header p { margin: 0; max-width: 70ch; color: #444; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 22px; padding: 28px 32px; }
  figure { margin: 0; }
  .frame { background: #fff; border: 1px solid #d8cdb0; border-radius: 6px; overflow: hidden; aspect-ratio: ${aspect.replace(":", "/")}; display: flex; align-items: center; justify-content: center; }
  .frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .miss { color: #b03525; text-align: center; padding: 18px; font-size: 13px; }
  .miss small { color: #777; font-weight: 400; }
  figcaption { margin-top: 8px; }
  .meta { color: #666; font-size: 12.5px; }
  .badge { background: #e2552f; color: #fff; font-size: 10px; padding: 1px 7px; border-radius: 10px; vertical-align: middle; letter-spacing: .4px; }
</style>
<header>
  <h1>image bakeoff · ${runId}</h1>
  <p>${escapeHtml(prompt)}</p>
</header>
<div class="grid">
${results.map(card).join("\n")}
</div>`;
}

function scorecardMd(runId: string, prompt: string, aspect: Aspect, results: Result[]): string {
  const rows = results.map((r, i) => {
    const cost = r.costUsd != null ? `$${r.costUsd.toFixed(3)}` : "—";
    const secs = r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "—";
    const q = r.status === "ok" ? "" : `(${r.status})`;
    return `| ${i + 1} | ${r.label} | ${r.model} | ${cost} | ${secs} | ${q} |  |`;
  });
  return `# Bakeoff scorecard — ${runId}

**Prompt:** ${prompt}
**Aspect:** ${aspect}

Fill the **Quality** column (1–5) for each generated image, then mark the **Best?** column with an \`x\` for your favorite(s). Open \`gallery.html\` to compare side by side. When done:

\`\`\`
npm run bakeoff -- --decide ${runId}
\`\`\`

| Rank | Contender | Model | Cost | Latency | Quality (1-5) | Best? |
|---|---|---|---|---|---|---|
${rows.join("\n")}

_Cost is the real billed amount for OpenRouter contenders; estimates for direct/local ones. Rank above is cheapest-first._
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- decide -------------------------------------------------------------------------------

function parseScores(md: string): Map<string, number> {
  const lines = md.split("\n").filter((l) => l.trim().startsWith("|"));
  const cells = (l: string) => l.split("|").slice(1, -1).map((s) => s.trim());
  const map = new Map<string, number>();
  if (lines.length < 3) return map;
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  const ci = header.findIndex((h) => h.startsWith("contender"));
  const qi = header.findIndex((h) => h.startsWith("quality"));
  if (ci < 0 || qi < 0) return map;
  for (const l of lines.slice(2)) {
    const c = cells(l);
    const q = parseFloat(c[qi]);
    if (c[ci] && !Number.isNaN(q)) map.set(c[ci], q);
  }
  return map;
}

type Scored = Result & { quality: number | null };

function printTable(title: string, rows: Scored[]): void {
  console.log(`\n${title}`);
  for (const r of rows) {
    const cost = r.costUsd != null ? `$${r.costUsd.toFixed(3)}` : "  —  ";
    const secs = r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : "—";
    const q = r.quality != null ? `q${r.quality}` : "q—";
    console.log(`  ${r.label.padEnd(18)} ${cost.padStart(7)}  ${secs.padStart(6)}  ${q.padStart(3)}  ${r.model}`);
  }
}

function decide(runId: string): void {
  const dir = join(BAKEOFF_DIR, runId);
  const metaPath = join(dir, "results.json");
  if (!existsSync(metaPath)) throw new Error(`no run at bakeoff/${runId} (results.json missing)`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as { prompt: string; results: Result[] };
  const scores = existsSync(join(dir, "scorecard.md"))
    ? parseScores(readFileSync(join(dir, "scorecard.md"), "utf8"))
    : new Map<string, number>();

  const rows: Scored[] = meta.results
    .filter((r) => r.status === "ok")
    .map((r) => ({ ...r, quality: scores.get(r.label) ?? null }));

  if (!rows.length) {
    console.log(`bakeoff/${runId}: no successful generations to rank.`);
    return;
  }

  console.log(`Bakeoff ${runId} — "${meta.prompt}"`);
  printTable("Cheapest first", [...rows].sort((a, b) => (a.costUsd ?? 0) - (b.costUsd ?? 0)));

  const scoredRows = rows.filter((r) => r.quality != null);
  if (!scoredRows.length) {
    console.log(`\nNo quality scores yet — fill the Quality column in bakeoff/${runId}/scorecard.md, then re-run --decide.`);
    return;
  }

  printTable("Best quality first", [...scoredRows].sort((a, b) => b.quality! - a.quality!));
  const byValue = [...scoredRows].sort(
    (a, b) => b.quality! / Math.max(b.costUsd!, 0.0001) - a.quality! / Math.max(a.costUsd!, 0.0001)
  );
  printTable("Best quality-per-dollar", byValue);

  const win = byValue[0];
  console.log(`\n→ Best value (quality ÷ cost): ${win.label} — quality ${win.quality}/5 at $${win.costUsd!.toFixed(3)}`);
  if (win.provider === "openrouter-image") {
    console.log(`  To keep it in the pipeline, add an "image: openrouter-image" path or point the`);
    console.log(`  image adapter at model ${win.model}. (config/providers.yaml selects an adapter by name;`);
    console.log(`  passing the model variant needs the small follow-up noted in the /bakeoff skill.)`);
  } else if (win.provider === "gemini-imagen") {
    console.log(`  To keep it: image: gemini-imagen in config/providers.yaml (set GEMINI_IMAGE_MODEL=${win.model} for this variant).`);
  } else if (win.provider === "remotion-svg") {
    console.log(`  Winner is the free local SVG path — no API cost. Keep authoring spots as SVG.`);
  }
}

async function main(): Promise<void> {
  const decideRun = flag("decide");
  if (decideRun) {
    decide(basename(decideRun));
    return;
  }
  await run();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
