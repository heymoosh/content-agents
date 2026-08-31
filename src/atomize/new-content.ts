import "../util/env.js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { slugify } from "../util/slug.js";
import { logCost } from "../util/cost-log.js";
import { fetchSubstackPost } from "./fetch-substack.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// Scaffold a content folder from a source:
//   tsx src/atomize/new-content.ts https://muxin.substack.com/p/some-post
//   tsx src/atomize/new-content.ts notes/build-log.md
//   tsx src/atomize/new-content.ts memos/idea.m4a        (transcribes via provider)
//   tsx src/atomize/new-content.ts --text                (reads the body from stdin)
//   tsx src/atomize/new-content.ts outreach/leads/client-acme-co/messages/message-01.md
//                                                         (a LOCKED outreach message; see
//                                                          resolveFileSource below)
// Output: content/<YYYY-MM-DD>-<slug>/source.md + subfolders. Prints the folder path.

const AUDIO_EXTS = new Set([".m4a", ".mp3", ".wav", ".ogg", ".flac"]);

// Outreach Phase 2 (docs/outreach-engine-plan.md §6): a locked outreach message
// (outreach/leads/<lead>/messages/message-NN.md) is a legal /atomize file source -- its
// frontmatter (lead/channel/evidence/classification/status/locked_at) must be stripped before
// becoming source.md's body (raw YAML in the body would break source_lines line-number tracing),
// and it's flagged via sourceKind so tag-source.ts can later tell atomized-from-outreach content
// apart from an atomized essay (see src/db/tag-source.ts).
export function resolveFileSource(arg: string, raw: string): {
  title: string;
  origin: string;
  publishedAt: string | null;
  text: string;
  sourceKind?: string;
} {
  const ext = extname(arg).toLowerCase();
  const { fm, body } = splitFrontmatter(raw);
  const isOutreachMessage =
    typeof fm.lead === "string" && typeof fm.channel === "string" && Array.isArray(fm.evidence);
  // Rule 1's scoped exception for draft.ts's composed prose is legal ONLY because Muxin reviews
  // every message before lock.ts ever fires (docs/outreach-engine-plan.md §6/§7) -- so only a
  // LOCKED message (her review already happened) is a legal /atomize source. A draft/approved
  // message atomized here would let unreviewed composed prose into the extraction-first pipeline.
  if (isOutreachMessage && fm.status !== "locked") {
    throw new Error(
      `refusing to atomize ${arg}: outreach message status is "${String(fm.status ?? "")}", not locked -- only a LOCKED message (Muxin has approved it) is a legal /atomize source`,
    );
  }
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1];
  const title =
    firstHeading ??
    (isOutreachMessage ? `Outreach message: ${fm.lead}` : basename(arg, ext).replace(/[-_]/g, " "));
  return {
    title,
    origin: `file:${basename(arg)}`,
    publishedAt: null,
    text: body,
    sourceKind: isOutreachMessage ? "outreach-message" : undefined,
  };
}

async function resolveSource(arg: string): Promise<{
  title: string;
  origin: string;
  publishedAt: string | null;
  text: string;
  sourceKind?: string;
  sourceBinaryPath?: string;
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
      sourceKind: "audio",
      sourceBinaryPath: arg,
    };
  }
  return resolveFileSource(arg, readFileSync(arg, "utf8"));
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

export interface ScaffoldSource {
  title: string;
  origin: string;
  publishedAt: string | null;
  text: string;
  sourceKind?: string; // e.g. "substack-note" — omitted for essays/files/audio
  sourceBinaryPath?: string;
}

// Scaffold content/<date>-<slug>/ (source.md + subfolders + empty review queue) from a resolved
// source. Shared by /atomize (essays/files/audio/paste) and /atomize notes (one folder per note).
// Throws "already exists: <dir>" if the folder is already there, so callers can skip or abort.
export function scaffoldContentFolder(src: ScaffoldSource): string {
  const sourceBinaryExtension = src.sourceBinaryPath ? extname(src.sourceBinaryPath).toLowerCase() : "";
  if (src.sourceBinaryPath && (!AUDIO_EXTS.has(sourceBinaryExtension) || !existsSync(src.sourceBinaryPath))) {
    throw new Error("source binary is not an existing supported audio file");
  }
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(repoRoot, "content", `${date}-${slugify(src.title)}`);
  if (existsSync(join(dir, "source.md"))) throw new Error(`already exists: ${dir}`);
  for (const sub of ["derivatives", "images", "video", "ready-to-paste"]) {
    mkdirSync(join(dir, sub), { recursive: true });
  }

  // canonical_url is the published piece's own URL — what "read more" CTAs (cta: source) point at.
  // Auto-filled when the origin is a live URL (essay URL or note URL); left blank for local drafts.
  const canonicalUrl = /^https?:\/\//.test(src.origin) ? src.origin : "";
  const canonicalLine = canonicalUrl
    ? `canonical_url: ${canonicalUrl}`
    : `canonical_url:   # paste the published essay URL so "read more" CTAs point at it (else they fall back to the Substack home)`;
  const sourceKindLine = src.sourceKind ? `source_kind: ${src.sourceKind}\n` : "";

  const body = src.text.trim();
  writeFileSync(
    join(dir, "source.md"),
    `---\ntitle: "${src.title.replace(/"/g, '\\"')}"\norigin: ${src.origin}\n${canonicalLine}\n${sourceKindLine}published_at: ${src.publishedAt ?? "null"}\ningested_at: ${new Date().toISOString()}\n---\n\n${body}\n`
  );
  if (src.sourceBinaryPath) {
    copyFileSync(src.sourceBinaryPath, join(dir, `source-audio${sourceBinaryExtension}`));
  }
  const ctaReminder = canonicalUrl
    ? ""
    : `> CTA: this draft has no \`canonical_url\` yet. To send "read more" posts to the essay itself, paste the published URL into source.md \`canonical_url:\` before /publish — otherwise those CTAs fall back to the Substack home.\n\n`;
  writeFileSync(
    join(dir, "review-queue.md"),
    `# Review queue — ${src.title}\n\nSet status to approve / revise / discard. Add a note for revise.\n\n> Routing: see routing.md — only platforms the router marked \`include\` are queued below.\n\n${ctaReminder}| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n`
  );
  return dir;
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
  console.log(scaffoldContentFolder(src));
}

// Run only as a CLI entry point — importing scaffoldContentFolder (e.g. from new-notes.ts) must
// not execute main().
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
