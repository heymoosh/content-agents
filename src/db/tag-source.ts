import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "./db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE } from "../strategy/route.js";

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
//   'exploration-probe' — shipped from a content folder as a deliberate off-assignment
//                          exploration-budget probe (card 92bb2ae6 — Placed-log row carries
//                          `| exploration`). Takes priority over the spin marker (same as
//                          control-run above; the two markers are mutually exclusive in practice —
//                          control-run targets an already-assigned pair, exploration an
//                          off-assignment one — control-run wins if a row somehow carried both):
//                          route.ts's loadData() excludes this source from the pillar/platform
//                          resonance figures; exploration.ts's loadExplorationData tracks it separately.
//   'atomized-outreach'  — shipped from a content folder scaffolded from a LOCKED outreach
//                          message (docs/outreach-engine-plan.md §6 Phase 2 -- new-content.ts's
//                          resolveFileSource tags source.md `source_kind: outreach-message`,
//                          which the /atomize skill propagates onto the derivative as
//                          `outreach_message: true` -- Placed-log row carries `| outreach-message`)
//   'organic'            — posted natively / a note Muxin wrote
// Deterministic; runs during /strategy next to link-bet. The atomized signal is that the post text
// matches a Placed-log row in briefs/bets.md (what /publish shipped), OR the post already carries a
// bet_id (in case the text was edited before posting). Everything else on a native channel is organic.
//   npm run tag-source

const DISTRIBUTED = new Set(["x", "linkedin", "bluesky"]); // where atomized posts land + analytics exist
const NATIVE_ONLY = new Set(["substack", "substack-note"]); // always Muxin's own writing → organic
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

// Unlike CONTROL_RUN_SOURCE/EXPLORATION_SOURCE (defined in route.ts because loadData() EXCLUDES
// those two from pillar/platform resonance figures), outreach-sourced content isn't excluded from
// anything yet — that's a strategy-analytics call outside Phase 2's scope (docs/outreach-engine-plan.md
// §6) — so this constant stays local to tag-source.ts rather than living in route.ts.
export const OUTREACH_MESSAGE_SOURCE = "atomized-outreach";

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
  exploration: boolean;
  outreachMessage: boolean;
}

// Parse "- placed <ts> [<folder>/<row>] <platform> → <ref> | ... | spin | control-run | exploration | outreach-message | \"<text-prefix>\"" rows.
// The optional ` | spin ` segment (written by appendBetPlacement for spin-experiment derivatives)
// marks an audience-reframed variant; ` | control-run ` (card f444f440) marks a deliberate
// --no-spin control run; ` | exploration ` (card 92bb2ae6) marks a deliberate off-assignment
// exploration-budget probe; ` | outreach-message ` (docs/outreach-engine-plan.md §6 Phase 2)
// marks a derivative atomized from a locked outreach message. Markers are scoped to the segment
// BEFORE the quoted post-text prefix — the quote can itself contain a coincidental
// "| spin |"/"| control-run |"/"| exploration |"/"| outreach-message |" substring (Muxin's own
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
    const exploration = /\|\s+exploration\s*(\||$)/.test(markerScope);
    const outreachMessage = /\|\s+outreach-message\s*(\||$)/.test(markerScope);
    if (prefix.length >= 12) out.push({ platform: plat[1], prefix, spin, controlRun, exploration, outreachMessage });
  }
  return out;
}

// Single source of truth for the controlRun > exploration > outreachMessage > spin > plain
// priority: drives both the DB source value and the sanity-check log line so they can't drift
// apart from independently-edited ternaries. controlRun and exploration are mutually exclusive in
// practice (control-run targets an already-assigned pillar/platform pair, exploration an
// off-assignment one) — controlRun wins if a row somehow carried both markers. outreachMessage is
// likewise expected never to co-occur with either (a locked-message derivative isn't a spin-control
// or exploration pick), but sits below both defensively, above spin (an outreach-sourced
// derivative reframed for audience fit is still, first and foremost, outreach-sourced).
function classifyHit(hit: Placed | undefined): { value: string; tag: string } {
  if (hit?.controlRun) return { value: CONTROL_RUN_SOURCE, tag: " (control-run)" };
  if (hit?.exploration) return { value: EXPLORATION_SOURCE, tag: " (exploration)" };
  if (hit?.outreachMessage) return { value: OUTREACH_MESSAGE_SOURCE, tag: " (outreach-message)" };
  if (hit?.spin) return { value: "atomized-spin", tag: " (spin)" };
  return { value: "atomized", tag: "" };
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
  let explored = 0;
  let outreached = 0;
  let organic = 0;
  let untouched = 0;
  const matches: string[] = [];

  const tx = db.transaction(() => {
    for (const p of posts) {
      let value: string;
      if (DISTRIBUTED.has(p.platform)) {
        const content = norm(p.content_text ?? "");
        // Keep the matched row so its spin/control-run/exploration marker can promote the classification.
        const hit = placed.find((pl) => pl.platform === p.platform && leadMatch(content, pl.prefix));
        const matched = !!p.bet_id || !!hit;
        // bet_id-only matches (text edited before posting) lose the spin/control-run/exploration
        // signal → default atomized. Priority order (controlRun > exploration > spin) lives in
        // classifyHit, the single source of truth for both the DB value and this log tag.
        const classified = matched ? classifyHit(hit) : { value: "organic", tag: "" };
        value = classified.value;
        if (matched) {
          matches.push(`  #${p.id} ${p.platform}${classified.tag}: ${(p.content_text ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
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
      else if (value === EXPLORATION_SOURCE) explored++;
      else if (value === OUTREACH_MESSAGE_SOURCE) outreached++;
      else atomized++;
    }
  });
  tx();
  db.close();

  console.log(
    `tag-source: ${atomized} atomized, ${spun} atomized-spin, ${controlled} spin-control-run, ${explored} exploration-probe, ${outreached} atomized-outreach, ${organic} organic, ${untouched} left untouched (parsed ${placed.length} placed rows)`
  );
  if (matches.length) {
    console.log(`\natomized (sanity-check these are real):`);
    console.log(matches.join("\n"));
  }
}

main();
