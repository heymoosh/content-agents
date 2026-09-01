import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, repoRoot } from "./db.js";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE } from "../strategy/route.js";
import { isBrandId, type BrandId } from "../identity/brand.js";

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
function betsPath(brandId: BrandId): string { return process.env.CONTENT_AGENTS_TEST_BETS_PATH ?? join(repoRoot, "briefs", brandId, "bets.md"); }
export function parseBrandArgv(argv: readonly string[]): BrandId {
  const index = argv.indexOf("--brand");
  const value = index >= 0 ? argv[index + 1] : argv.find((arg) => arg.startsWith("--brand="))?.slice(8);
  if (!isBrandId(value)) throw new Error("--brand <brand> is required");
  return value;
}

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

export interface Placed {
  platform: string;
  prefix: string;
  spin: boolean;
  controlRun: boolean;
  exploration: boolean;
  outreachMessage: boolean;
  ctaDestination: string | null;
  cadenceSource: string | null;
}

// Parse "- placed <ts> [<folder>/<row>] <platform> → <ref> | ... | spin | control-run | exploration | outreach-message | cta:<dest> | cadence:<source> | \"<text-prefix>\"" rows.
// The optional ` | spin ` segment (written by appendBetPlacement for spin-experiment derivatives)
// marks an audience-reframed variant; ` | control-run ` (card f444f440) marks a deliberate
// --no-spin control run; ` | exploration ` (card 92bb2ae6) marks a deliberate off-assignment
// exploration-budget probe; ` | outreach-message ` (docs/outreach-engine-plan.md §6 Phase 2)
// marks a derivative atomized from a locked outreach message; ` | cta:<dest> ` (card d80411bc,
// strategy lever E scaffold) carries the post's resolved primary CTA destination
// (source/project/work_with_me); ` | cadence:<source> ` (strategy lever C follow-through, epic
// 2ce597d7) carries 'override' or 'default' — whether this post's publish slot came from an
// active config/schedule-overrides.yaml entry. Markers are scoped to the segment BEFORE the
// quoted post-text prefix — the quote can itself contain a coincidental "| spin |"/
// "| control-run |"/"| exploration |"/"| outreach-message |"/"| cta:... |"/"| cadence:... |"
// substring (Muxin's own post text), and testing the full line would false-positive on that.
export function readPlaced(path: string = betsPath("human-inference")): Placed[] {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
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
    const ctaMatch = markerScope.match(/\|\s+cta:(\S+)\s*(\||$)/);
    const ctaDestination = ctaMatch ? ctaMatch[1] : null;
    const cadenceMatch = markerScope.match(/\|\s+cadence:(\S+)\s*(\||$)/);
    const cadenceSource = cadenceMatch ? cadenceMatch[1] : null;
    if (prefix.length >= 12)
      out.push({
        platform: plat[1],
        prefix,
        spin,
        controlRun,
        exploration,
        outreachMessage,
        ctaDestination,
        cadenceSource,
      });
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
export function classifyHit(hit: Placed | undefined): { value: string; tag: string } {
  if (hit?.controlRun) return { value: CONTROL_RUN_SOURCE, tag: " (control-run)" };
  if (hit?.exploration) return { value: EXPLORATION_SOURCE, tag: " (exploration)" };
  if (hit?.outreachMessage) return { value: OUTREACH_MESSAGE_SOURCE, tag: " (outreach-message)" };
  if (hit?.spin) return { value: "atomized-spin", tag: " (spin)" };
  return { value: "atomized", tag: "" };
}

function main() {
  const brand = parseBrandArgv(process.argv);
  const placed = readPlaced(betsPath(brand));
  const db = openDb();
  const posts = db
    .prepare(`SELECT id, platform, content_text, bet_id, source, cta_destination, cadence_source FROM posts WHERE brand_id = ?`)
    .all(brand) as {
    id: number;
    platform: string;
    content_text: string | null;
    bet_id: string | null;
    source: string | null;
    cta_destination: string | null;
    cadence_source: string | null;
  }[];

  const update = db.prepare("UPDATE posts SET source = ? WHERE id = ? AND brand_id = ?");
  // cta_destination is set only from a genuine text-match hit (not a bet_id-only match, which
  // carries no marker) — same posture as spin/control-run/exploration, which also only ride
  // along on a matched Placed row's markers.
  const updateCta = db.prepare("UPDATE posts SET cta_destination = ? WHERE id = ? AND brand_id = ?");
  // cadence_source rides along the same way — only from a genuine text-match hit, never a
  // bet_id-only match (card ed23f712 / lever C follow-through, epic 2ce597d7).
  const updateCadence = db.prepare("UPDATE posts SET cadence_source = ? WHERE id = ? AND brand_id = ?");
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
      let hit: Placed | undefined;
      if (DISTRIBUTED.has(p.platform)) {
        const content = norm(p.content_text ?? "");
        // Keep the matched row so its spin/control-run/exploration/cta marker can promote the classification.
        hit = placed.find((pl) => pl.platform === p.platform && leadMatch(content, pl.prefix));
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
      if (value !== p.source) update.run(value, p.id, brand);
      // cta_destination rides along on the same text-match hit (never a bet_id-only match, which
      // carries no marker — same posture as spin/control-run/exploration). A hit carrying no
      // `| cta:<dest> |` marker (posts placed before card d80411bc, or a post whose CTA didn't
      // resolve) leaves the column untouched.
      if (hit?.ctaDestination && hit.ctaDestination !== p.cta_destination) {
        updateCta.run(hit.ctaDestination, p.id, brand);
      }
      if (hit?.cadenceSource && hit.cadenceSource !== p.cadence_source) {
        updateCadence.run(hit.cadenceSource, p.id, brand);
      }
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

// Run only as a CLI entry point — importing classifyHit/readPlaced for tests must not execute
// main() (which opens the db and mutates posts.source).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
