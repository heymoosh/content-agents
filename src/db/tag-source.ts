import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "./db.js";

// Classify each post's origin so origin-compare.ts can measure whether atomizing earns traction:
//   'atomized'      — shipped by /publish from a content folder (verbatim extraction-first)
//   'atomized-spin' — shipped from a content folder, but reframed for audience fit (the opt-in
//                     spin experiment, docs/spin-experiment.md — Placed-log row carries `| spin`)
//   'organic'       — posted natively / a note Muxin wrote
// Deterministic; runs during /strategy next to link-bet. The atomized signal is that the post text
// matches a Placed-log row in briefs/bets.md (what /publish shipped), OR the post already carries a
// bet_id (in case the text was edited before posting). Everything else on a native channel is organic.
//   npm run tag-source

const DISTRIBUTED = new Set(["x", "linkedin", "bluesky"]); // where atomized posts land + analytics exist
const NATIVE_ONLY = new Set(["substack", "substack-note"]); // always Muxin's own writing → organic
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

// Reduce text to lowercase alphanumerics + single spaces before matching. Exports differ:
// LinkedIn stores text punctuation-stripped/lowercased AND truncated to a ~40-char snippet, while
// the Placed-log prefix is the first 80 chars of the derivative. So normalize, then match on a
// leading overlap (below) rather than a strict substring.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Does a published post's (normalized) text correspond to a Placed-log prefix? X/Bluesky carry the
// full post text (substring match); LinkedIn truncates, so also accept a leading-prefix overlap in
// EITHER direction (the shorter string being the start of the longer), with a 20-char floor so a
// short snippet can't false-positive.
function leadMatch(content: string, prefix: string): boolean {
  if (prefix.length < 12 || content.length === 0) return false;
  if (content.includes(prefix)) return true;
  const [shorter, longer] = content.length <= prefix.length ? [content, prefix] : [prefix, content];
  return shorter.length >= 20 && longer.startsWith(shorter);
}

interface Placed {
  platform: string;
  prefix: string;
  spin: boolean;
}

// Parse "- placed <ts> [<folder>/<row>] <platform> → <ref> | ... | spin | \"<text-prefix>\"" rows.
// The optional ` | spin ` segment (written by appendBetPlacement for spin-experiment derivatives)
// marks an audience-reframed variant; it sits before the end-anchored quote so both still parse.
function readPlaced(): Placed[] {
  let text = "";
  try {
    text = readFileSync(BETS_PATH, "utf8");
  } catch {
    return [];
  }
  const out: Placed[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("- placed ")) continue;
    const plat = line.match(/\]\s+(\S+)\s+→/);
    const quote = line.match(/\|\s+"([^"]*)"\s*$/);
    if (!plat) continue;
    const prefix = quote ? norm(quote[1]) : "";
    const spin = /\|\s+spin\s*(\||$)/.test(line);
    if (prefix.length >= 12) out.push({ platform: plat[1], prefix, spin });
  }
  return out;
}

function main() {
  const placed = readPlaced();
  const db = openDb();
  const posts = db.prepare(`SELECT id, platform, content_text, bet_id, source FROM posts`).all() as {
    id: number;
    platform: string;
    content_text: string | null;
    bet_id: string | null;
    source: string | null;
  }[];

  const update = db.prepare("UPDATE posts SET source = ? WHERE id = ?");
  let atomized = 0;
  let spun = 0;
  let organic = 0;
  let untouched = 0;
  const matches: string[] = [];

  const tx = db.transaction(() => {
    for (const p of posts) {
      let value: string;
      if (DISTRIBUTED.has(p.platform)) {
        const content = norm(p.content_text ?? "");
        // Keep the matched row so its spin marker can promote 'atomized' → 'atomized-spin'.
        const hit = placed.find((pl) => pl.platform === p.platform && leadMatch(content, pl.prefix));
        const matched = !!p.bet_id || !!hit;
        // bet_id-only matches (text edited before posting) lose the spin signal → default atomized.
        value = matched ? (hit?.spin ? "atomized-spin" : "atomized") : "organic";
        if (matched) matches.push(`  #${p.id} ${p.platform}${hit?.spin ? " (spin)" : ""}: ${(p.content_text ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
      } else if (NATIVE_ONLY.has(p.platform)) {
        value = "organic";
      } else {
        untouched++;
        continue; // unknown platform — leave source as-is
      }
      if (value !== p.source) update.run(value, p.id);
      if (value === "organic") organic++;
      else if (value === "atomized-spin") spun++;
      else atomized++;
    }
  });
  tx();
  db.close();

  console.log(
    `tag-source: ${atomized} atomized, ${spun} atomized-spin, ${organic} organic, ${untouched} left untouched (parsed ${placed.length} placed rows)`
  );
  if (matches.length) {
    console.log(`\natomized (sanity-check these are real):`);
    console.log(matches.join("\n"));
  }
}

main();
