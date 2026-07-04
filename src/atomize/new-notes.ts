import "../util/env.js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "../db/db.js";
import { fetchSubstackNotes, FetchedNote } from "./fetch-notes.js";
import { scaffoldContentFolder } from "./new-content.js";

// Pull Muxin's own Substack Notes and (a) ingest their engagement into analytics so resonance.ts
// / snapshot.ts cover Notes, and (b) let him spread chosen ones to other platforms via the normal
// atomize flow. Notes never appear in the RSS feed, so /atomize <url> can't reach them.
//
//   npm run new-notes                 → fetch recent notes, ingest engagement, print a numbered list
//   npm run new-notes -- --limit 40   → pull further back (default 20)
//   npm run new-notes -- --pick 1,3   → scaffold a content folder per picked note (from the list)
//
// Needs SUBSTACK_HANDLE in .env (the @handle, e.g. humaninference) or a positional handle arg.

const CACHE = join(repoRoot, "data", "notes-cache.json");

const eng = (n: FetchedNote): number => n.likes + n.replies * 3 + n.reposts * 2;

function noteTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "note";
  return firstLine.slice(0, 80);
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

async function listAndIngest(handle: string, limit: number): Promise<void> {
  const h = handle.replace(/^@/, "");
  const notes = await fetchSubstackNotes(handle, { limit });
  if (notes.length === 0) {
    console.log(`No original notes found for @${h}.`);
    return;
  }
  const n = ingestNotes(notes);
  writeFileSync(CACHE, JSON.stringify({ handle: h, fetchedAt: new Date().toISOString(), notes }, null, 2));
  console.log(`# Recent Substack notes — @${h} (${notes.length} notes; ${n} ingested into analytics)\n`);
  notes.forEach((note, i) => {
    const d = note.publishedAt ? note.publishedAt.slice(0, 10) : "????-??-??";
    console.log(`${i + 1}. ${d} · eng ${eng(note)} (♥${note.likes} ↻${note.reposts} 💬${note.replies})`);
    console.log(`   ${note.text.replace(/\s+/g, " ").slice(0, 160)}`);
  });
  console.log(`\nSpread some: npm run new-notes -- --pick <numbers>  (e.g. --pick 1,3), then run the atomize flow on each folder.`);
}

function pickNotes(indicesArg: string): void {
  if (!existsSync(CACHE)) {
    console.error("no notes cache — run `npm run new-notes` first to fetch and list your notes.");
    process.exit(1);
  }
  const cached = JSON.parse(readFileSync(CACHE, "utf8")) as { notes: FetchedNote[] };
  const indices = indicesArg
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((x) => Number.isInteger(x));
  if (indices.length === 0) {
    console.error("usage: npm run new-notes -- --pick 1,3,5");
    process.exit(1);
  }
  for (const idx of indices) {
    const note = cached.notes[idx - 1];
    if (!note) {
      console.error(`skip #${idx}: out of range (cache has ${cached.notes.length} notes)`);
      continue;
    }
    try {
      const dir = scaffoldContentFolder({
        title: noteTitle(note.text),
        origin: note.url,
        publishedAt: note.publishedAt,
        text: note.text,
        sourceKind: "substack-note",
      });
      console.log(`#${idx} → ${dir}`);
    } catch (e) {
      console.error(`skip #${idx}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  const pickIdx = args.indexOf("--pick");
  if (pickIdx >= 0) {
    pickNotes(args[pickIdx + 1] ?? "");
    return;
  }

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
  await listAndIngest(handle, limit);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
