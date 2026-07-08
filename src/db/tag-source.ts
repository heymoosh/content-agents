import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "./db.js";
import { CONTROL_RUN_SOURCE } from "../strategy/route.js";

// Classify each post's origin so origin-compare.ts can measure whether atomizing earns traction:
//   'atomized'          — shipped by /publish from a content folder (verbatim extraction-first)
//   'atomized-spin'      — shipped from a content folder, but reframed for audience fit (the
//                          opt-in spin experiment, docs/spin-experiment.md — Placed-log row
//                          carries `| spin`)
//   'spin-control-run'  — shipped from a content folder as a deliberate --no-spin control run on
//                          an already-assigned pillar/platform pair (card f444f440 — Placed-log
//                          row carries `| control-run`). Takes priority over the spin marker:
//                          route.ts's loadData() excludes this source from the pillar/platform
//                          resonance figures; spin-control.ts's loadControlData tracks it separately.
//   'organic'            — posted natively / a note Muxin wrote
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
  controlRun: boolean;
}

// Parse "- placed <ts> [<folder>/<row>] <platform> → <ref> | ... | spin | control-run | \"<text-prefix>\"" rows.
// The optional ` | spin ` segment (written by appendBetPlacement for spin-experiment derivatives)
// marks an audience-reframed variant; ` | control-run ` (card f444f440) marks a deliberate
// --no-spin control run. Markers are scoped to the segment BEFORE the quoted post-text prefix —
// the quote can itself contain a coincidental "| spin |"/"| control-run |" substring (Muxin's own
// post text), and testing the full line would false-positive on that.
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
    const markerScope = quote ? line.slice(0, quote.index) : line;
    const spin = /\|\s+spin\s*(\||$)/.test(markerScope);
    const controlRun = /\|\s+control-run\s*(\||$)/.test(markerScope);
    if (prefix.length >= 12) out.push({ platform: plat[1], prefix, spin, controlRun });
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
  let controlled = 0;
  let organic = 0;
  let untouched = 0;
  const matches: string[] = [];

  const tx = db.transaction(() => {
    for (const p of posts) {
      let value: string;
      if (DISTRIBUTED.has(p.platform)) {
        const content = norm(p.content_text ?? "");
        // Keep the matched row so its spin/control-run marker can promote the classification.
        const hit = placed.find((pl) => pl.platform === p.platform && leadMatch(content, pl.prefix));
        const matched = !!p.bet_id || !!hit;
        // bet_id-only matches (text edited before posting) lose the spin/control-run signal →
        // default atomized. control-run takes priority over spin — see CONTROL_RUN_SOURCE.
        value = matched ? (hit?.controlRun ? CONTROL_RUN_SOURCE : hit?.spin ? "atomized-spin" : "atomized") : "organic";
        if (matched) {
          const tag = hit?.controlRun ? " (control-run)" : hit?.spin ? " (spin)" : "";
          matches.push(`  #${p.id} ${p.platform}${tag}: ${(p.content_text ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
        }
      } else if (NATIVE_ONLY.has(p.platform)) {
        value = "organic";
      } else {
        untouched++;
        continue; // unknown platform — leave source as-is
      }
      if (value !== p.source) update.run(value, p.id);
      if (value === "organic") organic++;
      else if (value === "atomized-spin") spun++;
      else if (value === CONTROL_RUN_SOURCE) controlled++;
      else atomized++;
    }
  });
  tx();
  db.close();

  console.log(
    `tag-source: ${atomized} atomized, ${spun} atomized-spin, ${controlled} spin-control-run, ${organic} organic, ${untouched} left untouched (parsed ${placed.length} placed rows)`
  );
  if (matches.length) {
    console.log(`\natomized (sanity-check these are real):`);
    console.log(matches.join("\n"));
  }
}

main();
