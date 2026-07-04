import "../util/env.js";
import { writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, repoRoot } from "../db/db.js";
import { fetchSubstackNotes, FetchedNote } from "./fetch-notes.js";
import { scaffoldContentFolder } from "./new-content.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// Pull Muxin's own Substack Notes and (a) ingest their engagement into analytics so resonance.ts
// / snapshot.ts cover Notes, and (b) let him spread chosen ones to other platforms via the normal
// atomize flow. Notes never appear in the RSS feed, so /atomize <url> can't reach them.
//
//   npm run new-notes                 → fetch recent notes, ingest engagement, print a numbered list
//                                        (notes already turned into a content folder are hidden)
//   npm run new-notes -- --all        → also show notes already turned into a content folder
//   npm run new-notes -- --limit 40   → pull further back (default 20)
//   npm run new-notes -- --pick 1,3   → scaffold a content folder per picked note (from the list)
//
// Needs SUBSTACK_HANDLE in .env (the @handle, e.g. humaninference) or a positional handle arg.
//
// fetchNotesList()/scaffoldPicked() are also imported directly by src/review/serve.ts, which
// gives the GUI its own notes checklist instead of shelling out to this CLI.

const CACHE = join(repoRoot, "data", "notes-cache.json");

const eng = (n: FetchedNote): number => n.likes + n.replies * 3 + n.reposts * 2;

function noteTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "note";
  return firstLine.slice(0, 80);
}

// Every content/<slug>/source.md carries the `origin:` it was scaffolded from. A note already
// turned into a content folder shows up here by its own URL, so re-listing doesn't invite
// scaffolding (and duplicate-folder errors on) the same note twice.
function alreadyDraftedOrigins(): Set<string> {
  const contentDir = join(repoRoot, "content");
  const origins = new Set<string>();
  if (!existsSync(contentDir)) return origins;
  for (const folder of readdirSync(contentDir)) {
    const sourcePath = join(contentDir, folder, "source.md");
    if (!existsSync(sourcePath)) continue;
    const { fm } = splitFrontmatter(readFileSync(sourcePath, "utf8"));
    if (typeof fm.origin === "string") origins.add(fm.origin);
  }
  return origins;
}

// Store each note as an organic `substack-note` post + a metrics snapshot. Mirrors fetch-bluesky.ts:
// upsert on (platform, platform_post_id) so re-runs refresh engagement and build a recency series.
// `substack-note` is a distinct platform from `substack` — note likes/restacks are a different scale
// from essay open-rates and must not share the Substack engagement baseline.
function ingestNotes(notes: FetchedNote[]): number {
  const db = openDb();
  const now = new Date().toISOString();
  const upsertPost = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format, media_type, source)
    VALUES ('substack-note', ?, ?, ?, ?, 'note', 'note', 'organic')
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      content_text = excluded.content_text,
      media_type = COALESCE(posts.media_type, excluded.media_type),
      source = COALESCE(posts.source, 'organic')
    RETURNING id
  `);
  const insertMetrics = db.prepare(`
    INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, clicks, new_follows, engagement_rate, raw_json)
    VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?)
  `);
  const tx = db.transaction(() => {
    for (const n of notes) {
      const { id } = upsertPost.get(n.noteId, n.publishedAt, n.url, n.text) as { id: number };
      insertMetrics.run(
        id,
        now,
        n.likes,
        n.replies,
        n.reposts,
        JSON.stringify({ likes: n.likes, replies: n.replies, reposts: n.reposts, url: n.url })
      );
    }
  });
  tx();
  db.close();
  return notes.length;
}

export interface AnnotatedNote extends FetchedNote {
  drafted: boolean; // already scaffolded into a content/ folder (matched by origin URL)
}

// Fetch, ingest engagement, annotate against already-scaffolded folders, and cache. Shared by the
// CLI (below) and the GUI's GET /api/notes.
export async function fetchNotesList(
  handle: string,
  limit: number
): Promise<{ handle: string; notes: AnnotatedNote[] }> {
  const h = handle.replace(/^@/, "");
  const notes = await fetchSubstackNotes(handle, { limit });
  ingestNotes(notes);
  const drafted = alreadyDraftedOrigins();
  const annotated = notes.map((n) => ({ ...n, drafted: drafted.has(n.url) }));
  writeFileSync(CACHE, JSON.stringify({ handle: h, fetchedAt: new Date().toISOString(), notes: annotated }, null, 2));
  return { handle: h, notes: annotated };
}

async function listAndIngest(handle: string, limit: number, showAll: boolean): Promise<void> {
  const { handle: h, notes } = await fetchNotesList(handle, limit);
  if (notes.length === 0) {
    console.log(`No original notes found for @${h}.`);
    return;
  }
  const hidden = notes.filter((n) => n.drafted).length;
  console.log(`# Recent Substack notes — @${h} (${notes.length} notes)\n`);
  notes.forEach((note, i) => {
    if (!showAll && note.drafted) return;
    const d = note.publishedAt ? note.publishedAt.slice(0, 10) : "????-??-??";
    const tag = note.drafted ? " [already drafted]" : "";
    console.log(`${i + 1}. ${d} · eng ${eng(note)} (♥${note.likes} ↻${note.reposts} 💬${note.replies})${tag}`);
    console.log(`   ${note.text.replace(/\s+/g, " ").slice(0, 160)}`);
  });
  if (!showAll && hidden > 0) {
    console.log(`\n(${hidden} already drafted — hidden; pass --all to show)`);
  }
  console.log(`\nSpread some: npm run new-notes -- --pick <numbers>  (e.g. --pick 1,3), then run the atomize flow on each folder.`);
}

export interface PickResult {
  idx: number;
  url: string;
  title: string;
  dir?: string;
  error?: string;
}

// Scaffold a content folder per picked index (1-based, matching the cached list's numbering).
// Shared by the CLI's --pick (below) and the GUI's POST /api/notes/pick.
export function scaffoldPicked(indices: number[]): PickResult[] {
  if (!existsSync(CACHE)) {
    throw new Error("no notes cache — run `npm run new-notes` first to fetch and list your notes.");
  }
  const cached = JSON.parse(readFileSync(CACHE, "utf8")) as { notes: FetchedNote[] };
  const out: PickResult[] = [];
  for (const idx of indices) {
    const note = cached.notes[idx - 1];
    if (!note) {
      out.push({ idx, url: "", title: "", error: `out of range (cache has ${cached.notes.length} notes)` });
      continue;
    }
    const title = noteTitle(note.text);
    try {
      const dir = scaffoldContentFolder({
        title,
        origin: note.url,
        publishedAt: note.publishedAt,
        text: note.text,
        sourceKind: "substack-note",
      });
      out.push({ idx, url: note.url, title, dir });
    } catch (e) {
      out.push({ idx, url: note.url, title, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

function pickNotes(indicesArg: string): void {
  const indices = indicesArg
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((x) => Number.isInteger(x));
  if (indices.length === 0) {
    console.error("usage: npm run new-notes -- --pick 1,3,5");
    process.exit(1);
  }
  let results: PickResult[];
  try {
    results = scaffoldPicked(indices);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  for (const r of results) {
    if (r.error) console.error(`skip #${r.idx}: ${r.error}`);
    else console.log(`#${r.idx} → ${r.dir}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  const pickIdx = args.indexOf("--pick");
  if (pickIdx >= 0) {
    pickNotes(args[pickIdx + 1] ?? "");
    return;
  }

  const showAll = args.includes("--all");

  // Positional handle = a non-flag arg that isn't the value of --limit.
  const flagValuePositions = new Set<number>();
  args.forEach((a, i) => {
    if (a === "--limit") flagValuePositions.add(i + 1);
  });
  const positional = args.filter((a, i) => !a.startsWith("--") && !flagValuePositions.has(i));
  const handle = process.env.SUBSTACK_HANDLE ?? positional[0];
  if (!handle) {
    console.error("set SUBSTACK_HANDLE in .env (your @handle, e.g. humaninference) or pass it as an arg.");
    process.exit(1);
  }

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Math.max(1, parseInt(args[limitIdx + 1] ?? "20", 10) || 20) : 20;
  await listAndIngest(handle, limit, showAll);
}

// Run only as a CLI entry point — importing fetchNotesList/scaffoldPicked (e.g. from serve.ts)
// must not execute main().
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
