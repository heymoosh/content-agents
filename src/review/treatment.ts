// The Content room's "decide the treatment" read layer.
//
// One read per content slug that answers, for every channel the router could send this piece to:
// does it fit, has it already been placed there recently, and when is the next free slot. Pure
// READS — nothing here writes the slot ledger, the review queue, or any file. `claimSlots` is
// always called with `dryRun: true` (see slots.ts:353, which is the guard that skips the append).
//
// Three honesty rules this module exists to keep:
//
//  1. Reuse windows are PER CHANNEL. config/platforms.yaml sets min_reuse_days: x=14, threads=14,
//     mastodon=21, bluesky=21, linkedin=60, quote-card=30, with a global fallback of 30. There is
//     no single global reuse window, so this module never returns one — every channel carries its
//     own `minDays` straight out of checkReuse(), and the UI must print that number, not a
//     constant.
//  2. A low fit score NEVER means "excluded". route.ts:250-256 is a locked policy decision: the
//     score is computed for visibility only and config/routing.yaml's `defaults` list is the sole
//     source of truth for include/skip. So a channel that scored under the floor and is still
//     enabled is reported as information (`belowFloor` / `scoredBelowFloorButEnabled`), never as
//     an exclusion.
//  3. Missing data gets an explicit "we don't know" value, never a default that reads as measured:
//     no routing.md → `pillarSource: "none"` and every fit label is null; never placed → `everPlaced:
//     false` with null lastPlacedAt/daysSince; no cadence for a channel → the literal
//     "next-free-slot" claimSlots itself returns.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { checkReuse as realCheckReuse, type ReuseCheckResult } from "../publish/reuse-guard.js";
import { claimSlots as realClaimSlots } from "../publish/slots.js";
import { parseRoutingDecisions } from "../atomize/validate.js";
import {
  CORE_TEXT,
  PILLARS,
  loadConfig,
  loadData,
  decideForPillar,
  mergeDecisions,
  type Confidence,
  type Decision,
  type LoadedData,
  type MergedDecision,
  type RoutingConfig,
} from "../strategy/route.js";

// ---------------------------------------------------------------------------
// Fit label
// ---------------------------------------------------------------------------

export type FitLabel = "STRONG FIT" | "REACH ONLY" | "COLD START" | "POOR FIT";

// What the label is standing on. The UI needs this to avoid stating a measured claim about an
// unmeasured channel — a `null` label with basis "editorial-rule" is "Muxin's rule put this here,
// the data hasn't spoken", which is a different sentence from "STRONG FIT".
export type FitBasis = "measured" | "insufficient-data" | "editorial-rule" | "format-asset" | "unknown";

// The four-bucket mapping. It did not exist in the repo before this module; it is derived from
// route.ts's own `confidence` + `score` and NOTHING else:
//
//   confidence "cold-start"   → COLD START      (basis: insufficient-data)
//   confidence "exploration"  → COLD START      (basis: insufficient-data)
//   confidence "data":
//        score >= 1.0         → STRONG FIT      (basis: measured) — at or above the platform's own norm
//        score >= floor       → REACH ONLY      (basis: measured) — measurably under norm, still above
//                                                config/routing.yaml's skip_below_score floor
//        score <  floor       → POOR FIT        (basis: measured)
//   confidence "rule"         → null            (basis: editorial-rule)
//   confidence "always"       → null            (basis: format-asset)
//
// Three deliberate calls:
//
//  * COLD START wins over any score. It is checked FIRST, and it is not a weak STRONG FIT: a
//    cold-start row has no verdict at all (route.ts sets score to null in that branch precisely
//    because n < min_posts_for_data or weeks < 4). "Not enough data to say" is the honest label.
//  * `rule` and `always` get NO label. An editorial `never`/`always` rule and a format asset
//    (quote-card) were never fit-scored, so mapping them into STRONG FIT / POOR FIT would put an
//    unmeasured claim on screen. They return null and let the caller say "editorial rule" /
//    "always generated" instead. This is why there is no fifth bucket — an unlabelled channel is
//    an absent label, not a new state.
//  * `decision` (include/skip) deliberately does NOT feed the label. Since route.ts:250-256 the
//    score never flips include/skip and the defaults list decides alone, so include/skip carries
//    zero information about fit. It is returned as its own field instead.
//
// `floor` is always config/routing.yaml's thresholds.skip_below_score, never a literal.
export function fitLabelFor(
  d: { score: number | null; confidence: Confidence },
  floor: number
): { label: FitLabel | null; basis: FitBasis } {
  if (d.confidence === "cold-start" || d.confidence === "exploration") {
    return { label: "COLD START", basis: "insufficient-data" };
  }
  if (d.confidence === "rule") return { label: null, basis: "editorial-rule" };
  if (d.confidence === "always") return { label: null, basis: "format-asset" };
  if (d.confidence === "data") {
    if (d.score == null) return { label: null, basis: "unknown" }; // defensive: data confidence always carries a score
    if (d.score >= 1) return { label: "STRONG FIT", basis: "measured" };
    if (d.score >= floor) return { label: "REACH ONLY", basis: "measured" };
    return { label: "POOR FIT", basis: "measured" };
  }
  return { label: null, basis: "unknown" };
}

// ---------------------------------------------------------------------------
// Reuse + slot keys
// ---------------------------------------------------------------------------

// Which platform key the Placed log in briefs/bets.md is ACTUALLY keyed on for this channel.
// Routing channel names and Placed-log platform names are not the same vocabulary:
//
//   community:<id>  → logged (and reuse-checked by publishText) as the generic "community";
//                     the specific room only lives in the filename (see validate.ts routingKeyFor).
//   quote-card      → null. A card ships through publish:cards as `quote-card:<x|linkedin|bluesky>`
//                     and cards.ts:214 reuse-checks the TARGET platform, so the Placed log records
//                     it under x/linkedin/bluesky (bets.md carries exactly such a row). Checking
//                     "quote-card" would therefore always come back "never placed" — a false
//                     all-clear. Returning null makes the caller say "enforced per target" instead.
export function reuseKeyFor(channel: string): string | null {
  if (channel === "quote-card") return null;
  if (channel.startsWith("community:")) return "community";
  return channel;
}

const CARD_REUSE_NOTE =
  "reuse for a quote card is enforced per fan-out target (x / linkedin / bluesky), not on the card itself";

// Slot lookup shape per channel, copied from the two existing call sites rather than invented:
// text platforms use { windowKey: platform, conflictPlatforms: [platform] } (typefully.ts:386),
// quote-card uses { windowKey: "quote-card", conflictPlatforms: [] } (cards.ts:121). A channel
// with no cadence entry in config/platforms.yaml (community rooms) gets the literal
// "next-free-slot" claimSlots returns for an unknown windowKey.
function slotKeyFor(channel: string): { windowKey: string; conflictPlatforms: string[] } {
  if (channel === "quote-card") return { windowKey: "quote-card", conflictPlatforms: [] };
  if (channel.startsWith("community:")) return { windowKey: "community", conflictPlatforms: [] };
  return { windowKey: channel, conflictPlatforms: [channel] };
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface ChannelReuse {
  key: string; // the Placed-log platform key this check ran against (see reuseKeyFor)
  allowed: boolean;
  everPlaced: boolean; // false = no Placed-log row at all, NOT "placed long ago"
  lastPlacedAt: string | null;
  daysSince: number | null;
  minDays: number; // THIS channel's own min_reuse_days from config/platforms.yaml
  reason: string | null;
}

export interface ChannelTreatment {
  channel: string;
  pillars: string[]; // which of the piece's pillars produced this decision
  decision: "include" | "skip" | null; // null = no pillar, so routing was never computed
  recordedDecision: "include" | "skip" | null; // what routing.md on disk records (the gate validate.ts enforces)
  score: number | null;
  confidence: Confidence | null;
  rationale: string | null;
  fitLabel: FitLabel | null;
  fitBasis: FitBasis;
  belowFloor: boolean; // measured score under skip_below_score while still routed `include`
  reuse: ChannelReuse | null; // null only where no direct reuse check exists (quote-card)
  reuseNote: string | null;
  slot: { time: string; label: string };
}

export interface Treatment {
  slug: string;
  pillars: string[];
  pillarSource: "routing.md" | "none"; // "none" = nothing on disk says what this piece is about
  floor: number; // config/routing.yaml thresholds.skip_below_score
  channels: ChannelTreatment[];
  // Channels with a MEASURED score under the floor that routing still includes. Information, not
  // an exclusion — see honesty rule 2 at the top of this file.
  scoredBelowFloorButEnabled: string[];
}

export interface TreatmentDeps {
  folder?: string; // content folder; defaults to <repo>/content/<slug>
  cfg?: RoutingConfig;
  data?: LoadedData; // defaults to loadData() (opens analytics.db)
  checkReuse?: (slug: string, platform: string) => ReuseCheckResult;
  claimSlots?: typeof realClaimSlots;
  schedule?: Parameters<typeof realClaimSlots>[0]["schedule"]; // passed through to claimSlots
  now?: Date; // passed through to claimSlots
}

// ---------------------------------------------------------------------------
// Pillar
// ---------------------------------------------------------------------------

// A piece's pillar is not stored in source.md frontmatter — the only place on disk that records it
// is routing.md's heading, written by route.ts's routingMd(). That heading has had two shapes and
// BOTH must keep parsing forever, because routing.md files already on disk are never rewritten:
//   current: "# Routing: human-ai (2026-06-16)"  /  "# Routing: civic-tech + human-ai (2026-07-04)"
//   pre-2026-08-23 (em dash, banned by root CLAUDE.md rule 5 and config/voice.yaml, so no longer
//   written): "# Routing — human-ai — 2026-06-16"  /  "# Routing — civic-tech + human-ai — 2026-07-04"
// The two eras get two explicit patterns rather than one merged expression, so each stays exact and
// greppable. The historical one is a regex LITERAL on purpose: it MATCHES a dash in files Muxin
// already has, it never prints one, which is why the em-dash guard exempts regex literals.
// A pasted foreign essay that was never routed has no routing.md and therefore no pillar; that is
// reported as pillarSource "none" rather than guessed at.
export function parsePillars(routingMd: string): string[] {
  const m =
    routingMd.match(/^#\s*Routing:\s*(.+?)\s*\(\d{4}-\d{2}-\d{2}\)\s*$/m) ??
    routingMd.match(/^#\s*Routing\s*—\s*(.+?)\s*—\s*\d{4}-\d{2}-\d{2}\s*$/m);
  if (!m) return [];
  return m[1]
    .split("+")
    .map((p) => p.trim())
    .filter((p) => PILLARS.includes(p));
}

// Every channel routing could ever target, for a piece whose pillar we do NOT know: the union of
// config/routing.yaml's per-pillar defaults, its always/never rules, route.ts's CORE_TEXT and the
// always_consider format assets. Derived from config, never a hardcoded list.
export function allChannels(cfg: RoutingConfig): string[] {
  const out = new Set<string>(CORE_TEXT);
  for (const list of Object.values(cfg.defaults)) for (const p of list) out.add(p);
  for (const rule of Object.values(cfg.rules)) {
    for (const p of rule.always ?? []) out.add(p);
    for (const p of rule.never ?? []) out.add(p);
  }
  for (const p of cfg.thresholds.always_consider) out.add(p);
  return [...out];
}

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

export function readTreatment(slug: string, deps: TreatmentDeps = {}): Treatment {
  if (!slug || slug.includes("/") || slug.includes("..")) throw new Error("bad slug");

  const folder = deps.folder ?? join(repoRoot, "content", slug);
  const routingPath = join(folder, "routing.md");
  const routingMd = existsSync(routingPath) ? readFileSync(routingPath, "utf8") : "";
  const pillars = parsePillars(routingMd);
  const recorded = routingMd ? parseRoutingDecisions(routingMd) : new Map<string, "include" | "skip">();

  const cfg = deps.cfg ?? loadConfig();
  const floor = cfg.thresholds.skip_below_score;
  const checkReuseFn = deps.checkReuse ?? realCheckReuse;
  const claimSlotsFn = deps.claimSlots ?? realClaimSlots;

  let merged: MergedDecision[];
  if (pillars.length > 0) {
    const data = deps.data ?? loadData();
    const perPillar = new Map<string, Decision[]>();
    for (const pillar of pillars) perPillar.set(pillar, decideForPillar(pillar, cfg, data));
    merged = mergeDecisions(pillars, perPillar);
  } else {
    // No pillar on disk: fit was never computed, so every fit field stays null. Reuse and slots are
    // slug/platform-scoped and still perfectly knowable, so they are still returned.
    merged = [];
  }

  const channelNames = pillars.length > 0 ? merged.map((d) => d.platform) : allChannels(cfg);
  const byChannel = new Map(merged.map((d) => [d.platform, d]));

  const channels: ChannelTreatment[] = channelNames.map((channel) => {
    const d = byChannel.get(channel);
    const { label, basis } = d ? fitLabelFor(d, floor) : { label: null, basis: "unknown" as FitBasis };

    const reuseKey = reuseKeyFor(channel);
    let reuse: ChannelReuse | null = null;
    if (reuseKey) {
      const r = checkReuseFn(slug, reuseKey);
      reuse = {
        key: reuseKey,
        allowed: r.allowed,
        everPlaced: r.lastPlacedAt != null,
        lastPlacedAt: r.lastPlacedAt ?? null,
        daysSince: r.daysSince ?? null,
        // checkReuse always resolves a window (per-platform value, else the global fallback), so
        // this is never a guess. The `?? 0` is only to satisfy the optional type.
        minDays: r.minDays ?? 0,
        reason: r.reason ?? null,
      };
    }

    const { windowKey, conflictPlatforms } = slotKeyFor(channel);
    const { times, labels } = claimSlotsFn({
      windowKey,
      conflictPlatforms,
      count: 1,
      asset: `${slug}/${channel}`,
      by: "review-treatment",
      dryRun: true, // read-only: never appends to data/publish-schedule.jsonl
      schedule: deps.schedule,
      now: deps.now,
    });

    return {
      channel,
      pillars: d?.pillars ?? [],
      decision: d?.decision ?? null,
      recordedDecision: recorded.get(channel) ?? null,
      score: d?.score ?? null,
      confidence: d?.confidence ?? null,
      rationale: d?.rationale ?? null,
      fitLabel: label,
      fitBasis: basis,
      belowFloor: d != null && d.score != null && d.score < floor && d.decision === "include",
      reuse,
      reuseNote: reuseKey ? null : CARD_REUSE_NOTE,
      slot: { time: times[0] ?? "next-free-slot", label: labels[0] ?? "next-free-slot" },
    };
  });

  return {
    slug,
    pillars,
    pillarSource: pillars.length > 0 ? "routing.md" : "none",
    floor,
    channels,
    scoredBelowFloorButEnabled: channels.filter((c) => c.belowFloor).map((c) => c.channel),
  };
}
