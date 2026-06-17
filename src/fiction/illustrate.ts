import "../util/env.js";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logCost } from "../util/cost-log.js";
import { getImage, type ImageProfile } from "../providers/registry.js";
import { resolveSeriesDir, readSeriesConfig, pad2, readIfExists } from "./_series.js";

// Illustrate a series (Build 2). Two tracks:
//   --character <name> [--styles a,b,c]   fan-art: ONE baseline description rendered in several
//                                          styles, for social promo (style variety on purpose).
//   --scene <chapterN> --prompt "<desc>"   in-chapter art: the series' LOCKED style + character
//                                          reference image(s), for consistency.
//   --lock <name> --src <path>             promote an approved image to the character's reference.
// Image model is cost-first like /video: default Riverflow; --pro / --hero step up (offer first).
//   tsx src/fiction/illustrate.ts <series> --character alia --styles "ink,watercolor,comic"
//   tsx src/fiction/illustrate.ts <series> --scene 3 --prompt "Alia on the seawall at dusk" --character alia
//   tsx src/fiction/illustrate.ts <series> --lock alia --src illustrations/characters/alia/ink.png

type Aspect = "9:16" | "1:1" | "16:9";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DEFAULT_STYLES = ["ink illustration", "soft watercolor", "comic-book", "painterly digital"];

function profile(): ImageProfile | undefined {
  if (process.argv.includes("--hero")) return "hero";
  if (process.argv.includes("--pro")) return "pro";
  return undefined;
}

// A character's baseline look: the "## Appearance"/"## Physical" section of the sheet if present,
// else the whole sheet body. This is what every fan-art variant must stay faithful to.
function characterBaseline(dir: string, name: string): string {
  const sheet = readIfExists(join(dir, "characters", `${name}.md`));
  if (!sheet) throw new Error(`no character sheet: characters/${name}.md`);
  const section = sheet.match(/^#+\s*(appearance|physical|look|description)[^\n]*\n([\s\S]*?)(?=\n#|\n*$)/im);
  return (section?.[2] ?? sheet).replace(/^---[\s\S]*?---/, "").trim();
}

async function main() {
  const series = process.argv[2];
  if (!series || series.startsWith("--")) {
    console.error('usage: tsx src/fiction/illustrate.ts <series> (--character <name> [--styles ..] | --scene <N> --prompt ".." | --lock <name> --src <path>) [--pro|--hero] [--aspect 1:1]');
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const cfg = readSeriesConfig(dir);

  // --- lock a reference image -------------------------------------------------------------
  const lockName = flag("--lock");
  if (lockName) {
    const src = flag("--src");
    if (!src || !existsSync(src)) {
      console.error(`--lock needs --src <existing image path>`);
      process.exit(1);
    }
    const refDir = join(dir, "characters", lockName);
    mkdirSync(refDir, { recursive: true });
    const dest = join(refDir, "reference.png");
    copyFileSync(src, dest);
    console.log(`locked ${lockName} reference: ${dest}`);
    return;
  }

  const { provider, params } = await getImage(profile());
  const aspect = (flag("--aspect") as Aspect) ?? (cfg.illustration?.aspect as Aspect) ?? "1:1";
  const slug = cfg.slug ?? series;

  // --- character fan-art (varied styles off one baseline) ---------------------------------
  const character = flag("--character");
  if (character) {
    const baseline = characterBaseline(dir, character);
    const styles = (flag("--styles") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const useStyles = styles.length ? styles : DEFAULT_STYLES;
    const outDir = join(dir, "illustrations", "characters", character);
    mkdirSync(outDir, { recursive: true });
    let total = 0;
    for (const style of useStyles) {
      const prompt =
        `Character illustration. ${style} style. Faithful to this description: ${baseline}. ` +
        `Single character, clear depiction of their distinctive physical features. Portrait.`;
      const outPath = join(outDir, `${style.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
      const { costUsd } = await provider.generate({ prompt, aspect, outPath, params });
      logCost({ step: `image:${provider.name}`, detail: `${slug}/char-${character}-${style}`, costUsd });
      total += costUsd;
      console.log(`  ${outPath}  ($${costUsd.toFixed(4)})`);
    }
    console.log(`${useStyles.length} fan-art variant(s) for ${character}, total $${total.toFixed(4)} (${provider.name})`);
    return;
  }

  // --- scene art (locked style + character references for consistency) --------------------
  const sceneArg = flag("--scene");
  if (sceneArg !== undefined) {
    const n = Number(sceneArg);
    const desc = flag("--prompt");
    if (!desc) {
      console.error("--scene needs --prompt \"<scene description>\"");
      process.exit(1);
    }
    const styleLock = cfg.illustration?.style_lock?.trim();
    // Character reference images named after --character (repeatable) anchor likeness.
    const refNames = process.argv.filter((a, i) => process.argv[i - 1] === "--character");
    const refs = refNames
      .map((nm) => join(dir, "characters", nm, "reference.png"))
      .filter((p) => existsSync(p));
    const prompt = styleLock ? `${desc}. Consistent series art style: ${styleLock}.` : desc;
    const outDir = join(dir, "illustrations", "chapters", `chapter-${pad2(n)}`);
    mkdirSync(outDir, { recursive: true });
    const existing = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith(".png")).length : 0;
    const outPath = join(outDir, `scene-${existing + 1}.png`);
    const { costUsd } = await provider.generate({
      prompt,
      aspect,
      outPath,
      params,
      referenceImages: refs.length ? refs : undefined,
    });
    logCost({ step: `image:${provider.name}`, detail: `${slug}/scene-ch${n}`, costUsd });
    console.log(`${outPath}  ($${costUsd.toFixed(4)}, ${provider.name})${refs.length ? `  refs: ${refs.length}` : ""}`);
    return;
  }

  console.error("nothing to do: pass --character, --scene, or --lock");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
