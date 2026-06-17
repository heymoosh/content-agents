import "../util/env.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { slugify } from "../util/slug.js";
import { STORIES_DIR } from "./_series.js";

// Scaffold a new fiction series from Muxin's notes (the story bible).
//   tsx src/fiction/new-series.ts notes/my-story.md
//   tsx src/fiction/new-series.ts --text                 (notes on stdin)
//   ... [--title "The Glass Coast"] [--slug glass-coast]
// Output: stories/<slug>/ with bible.md + scaffolding. Prints the folder path.
// The /story skill then structures the raw notes into character sheets + an outline.

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const argv = process.argv.slice(2);
  const fromText = argv[0] === "--text";
  let notes: string;
  let defaultTitle: string;

  if (fromText) {
    notes = readFileSync(0, "utf8");
    if (!notes.trim()) {
      console.error("no notes on stdin: pipe your story bible into `--text`");
      process.exit(1);
    }
    defaultTitle = notes.match(/^#\s+(.+)$/m)?.[1] ?? "untitled story";
  } else {
    const file = argv[0];
    if (!file || file.startsWith("--")) {
      console.error("usage: tsx src/fiction/new-series.ts <notes-file | --text> [--title ..] [--slug ..]");
      process.exit(1);
    }
    if (!existsSync(file)) {
      console.error(`notes file does not exist: ${file}`);
      process.exit(1);
    }
    notes = readFileSync(file, "utf8");
    defaultTitle = notes.match(/^#\s+(.+)$/m)?.[1] ?? basename(file, extname(file)).replace(/[-_]/g, " ");
  }

  const title = arg("--title") ?? defaultTitle;
  const slug = slugify(arg("--slug") ?? title);
  const dir = join(STORIES_DIR, slug);
  if (existsSync(join(dir, "series.yaml"))) {
    console.error(`series already exists: ${dir}`);
    process.exit(1);
  }

  for (const sub of [
    "chapters",
    "characters",
    "illustrations/characters",
    "illustrations/chapters",
    "ready-to-paste",
  ]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }

  const now = new Date().toISOString();

  writeFileSync(
    join(dir, "bible.md"),
    `---\ntitle: "${title.replace(/"/g, '\\"')}"\nslug: ${slug}\ncreated: ${now}\n---\n\n` +
      `# ${title} — Story Bible\n\n` +
      `> Living reference. The world, the rules, the major characters, the big plot points.\n` +
      `> Edit freely as the story evolves. This is the source of truth the writer reads before every chapter.\n\n` +
      `## Muxin's notes (as provided)\n\n${notes.trim()}\n`
  );

  writeFileSync(
    join(dir, "outline.md"),
    `# Outline — ${title}\n\n` +
      `> Loose and evolving. Beat ideas, where the story might go. The plot is allowed to change;\n` +
      `> this is a map, not a contract. The writer uses it for direction, not as law.\n\n` +
      `## Planned / possible beats\n\n- (add beats here)\n`
  );

  writeFileSync(
    join(dir, "canon.md"),
    `# Canon — ${title}\n\n` +
      `> Append-only continuity ledger. One entry per LOCKED chapter, recording what has actually\n` +
      `> been established (facts, events, timeline, character state). The writer treats everything\n` +
      `> here as fixed. \`npm run story:lock\` appends to this when a chapter is approved.\n\n` +
      `## Established facts (cross-chapter)\n\n- (seeded as chapters lock)\n\n## Chapter log\n`
  );

  writeFileSync(
    join(dir, "series.yaml"),
    `slug: ${slug}\n` +
      `title: "${title.replace(/"/g, '\\"')}"\n\n` +
      `# Prose model for this series. "default" = use config/providers.yaml \`prose\`.\n` +
      `# Set to any adapter in src/providers/prose/ to override per series.\n` +
      `prose: default\n\n` +
      `narrative:\n` +
      `  pov: third person limited   # overrides config/fiction/style.yaml for this series\n` +
      `  tense: past\n` +
      `  style_ref: config/fiction/style.yaml\n\n` +
      `chapter:\n` +
      `  target_words: 2200\n` +
      `  min_words: 1200\n\n` +
      `illustration:\n` +
      `  style_lock: ""              # locked visual style for in-chapter art (set once you choose one)\n` +
      `  aspect: "1:1"\n\n` +
      `substack:\n` +
      `  publication: ""             # your substack publication URL\n\n` +
      `created: ${now}\n`
  );

  writeFileSync(
    join(dir, "characters", "README.md"),
    `# Characters — ${title}\n\n` +
      `One \`<name>.md\` sheet per major character (motivations, physical tells, voice, arc state).\n` +
      `The writer reads every sheet before drafting. Drop a locked likeness anchor at\n` +
      `\`<name>/reference.png\` for consistent illustration. The /story skill seeds these from the bible.\n`
  );

  console.log(dir);
}

main();
