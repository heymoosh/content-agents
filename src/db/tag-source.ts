import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "./db.js";

// Classify each post's origin so origin-compare.ts can measure whether atomizing earns traction:
//   'atomized' — shipped by /publish from a content folder
//   'organic'  — posted natively / a note Muxin wrote
// Deterministic; runs during /strategy next to link-bet. The atomized signal is that the post text
// matches a Placed-log row in briefs/bets.md (what /publish shipped), OR the post already carries a
// bet_id (in case the text was edited before posting). Everything else on a native channel is organic.
//   npm run tag-source

const DISTRIBUTED = new Set(["x", "linkedin", "bluesky"]); // where atomized posts land + analytics exist
const NATIVE_ONLY = new Set(["substack", "substack-note"]); // always Muxin's own writing → organic
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

interface Placed {
  platform: string;
  prefix: string;
}

// Parse "- placed <ts> [<folder>/<row>] <platform> → <ref> | ... | \"<text-prefix>\"" rows.
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
    if (prefix.length >= 12) out.push({ platform: plat[1], prefix });
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
  let organic = 0;
  let untouched = 0;
  const matches: string[] = [];

  const tx = db.transaction(() => {
    for (const p of posts) {
      let value: string;
      if (DISTRIBUTED.has(p.platform)) {
        const content = norm(p.content_text ?? "");
        const matched =
          !!p.bet_id ||
          (content.length > 0 && placed.some((pl) => pl.platform === p.platform && content.includes(pl.prefix)));
        value = matched ? "atomized" : "organic";
        if (matched) matches.push(`  #${p.id} ${p.platform}: ${(p.content_text ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
      } else if (NATIVE_ONLY.has(p.platform)) {
        value = "organic";
      } else {
        untouched++;
        continue; // unknown platform — leave source as-is
      }
      if (value !== p.source) update.run(value, p.id);
      if (value === "atomized") atomized++;
      else organic++;
    }
  });
  tx();
  db.close();

  console.log(
    `tag-source: ${atomized} atomized, ${organic} organic, ${untouched} left untouched (parsed ${placed.length} placed rows)`
  );
  if (matches.length) {
    console.log(`\natomized (sanity-check these are real):`);
    console.log(matches.join("\n"));
  }
}

main();
