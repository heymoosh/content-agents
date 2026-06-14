import "../util/env.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { repoRoot } from "../db/db.js";
import { slugify } from "../util/slug.js";
import { logCost } from "../util/cost-log.js";
import { fetchSubstackPost } from "./fetch-substack.js";

// Scaffold a content folder from a source:
//   tsx src/atomize/new-content.ts https://muxin.substack.com/p/some-post
//   tsx src/atomize/new-content.ts notes/build-log.md
//   tsx src/atomize/new-content.ts memos/idea.m4a        (transcribes via provider)
//   tsx src/atomize/new-content.ts --text                (reads the body from stdin)
// Output: content/<YYYY-MM-DD>-<slug>/source.md + subfolders. Prints the folder path.

const AUDIO_EXTS = new Set([".m4a", ".mp3", ".wav", ".ogg", ".flac"]);

async function resolveSource(arg: string): Promise<{
  title: string;
  origin: string;
  publishedAt: string | null;
  text: string;
}> {
  if (/^https?:\/\//.test(arg)) {
    const post = await fetchSubstackPost(arg);
    return { title: post.title, origin: post.url, publishedAt: post.publishedAt, text: post.text };
  }
  if (!existsSync(arg)) throw new Error(`not a URL and file does not exist: ${arg}`);
  const ext = extname(arg).toLowerCase();
  if (AUDIO_EXTS.has(ext)) {
    const { getTranscription } = await import("../providers/registry.js");
    const provider = await getTranscription();
    const { text, costUsd } = await provider.transcribe({ audioPath: arg });
    logCost({ step: `transcription:${provider.name}`, detail: basename(arg), costUsd });
    return {
      title: basename(arg, ext).replace(/[-_]/g, " "),
      origin: `voice-memo:${basename(arg)}`,
      publishedAt: null,
      text,
    };
  }
  const text = readFileSync(arg, "utf8");
  const firstHeading = text.match(/^#\s+(.+)$/m)?.[1];
  return {
    title: firstHeading ?? basename(arg, ext).replace(/[-_]/g, " "),
    origin: `file:${basename(arg)}`,
    publishedAt: null,
    text,
  };
}

// Raw text pasted on stdin (`--text`): derive the title from the first heading or first
// non-empty line, mark the origin as pasted so source.md stays traceable.
function resolveText(text: string): {
  title: string;
  origin: string;
  publishedAt: string | null;
  text: string;
} {
  const firstHeading = text.match(/^#\s+(.+)$/m)?.[1];
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  const title = (firstHeading ?? firstLine ?? "untitled").slice(0, 80);
  return { title, origin: "pasted-text", publishedAt: null, text };
}

async function main() {
  const arg = process.argv[2];
  let src;
  if (arg === "--text") {
    const text = readFileSync(0, "utf8");
    if (!text.trim()) {
      console.error("no text on stdin: pipe a body of text into `--text`, e.g. `... | new-content -- --text`");
      process.exit(1);
    }
    src = resolveText(text);
  } else {
    if (!arg) {
      console.error(
        "usage: tsx src/atomize/new-content.ts <substack-url | text-file | audio-file | --text (body on stdin)>"
      );
      process.exit(1);
    }
    src = await resolveSource(arg);
  }
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(repoRoot, "content", `${date}-${slugify(src.title)}`);
  if (existsSync(join(dir, "source.md"))) {
    console.error(`already exists: ${dir}`);
    process.exit(1);
  }
  for (const sub of ["derivatives", "images", "video", "ready-to-paste"]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }

  // Number the source lines so derivatives can cite source_lines precisely.
  const body = src.text.trim();
  writeFileSync(
    join(dir, "source.md"),
    `---\ntitle: "${src.title.replace(/"/g, '\\"')}"\norigin: ${src.origin}\npublished_at: ${src.publishedAt ?? "null"}\ningested_at: ${new Date().toISOString()}\n---\n\n${body}\n`
  );
  writeFileSync(
    join(dir, "review-queue.md"),
    `# Review queue — ${src.title}\n\nSet status to approve / revise / discard. Add a note for revise.\n\n| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n`
  );
  console.log(dir);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
