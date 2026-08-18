import { fileURLToPath } from "node:url";
import { openDb } from "../db/db.js";
import { loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";
import { loadRows as loadFrameRows, rankFrameFit, type Row as FrameRow, type FrameFitResult } from "./frame-fit.js";
import { loadRows as loadCtaRows, rankCtaFit, type Row as CtaRow, type CtaFitResult } from "./cta-fit.js";

// Card 83166c51 (epic 2ce597d7 "Close the loop"): validate the 5 recommendation-only levers the
// epic built (A c7638362/platform-fit, B 27dc7d2d/media-fit, C ed23f712/cadence-fit,
// D a4c5b42b/frame-fit, E d80411bc/cta-fit) actually measure something, rather than assuming they
// do. The card's own example wording ("posts routed via Lever A show X% resonance lift vs.
// baseline") is NOT honestly computable for A/B/C with today's schema: `posts` persists pillar,
// media_type, source, and cta_destination, but nothing records whether a given post's routing,
// media choice, or publish slot actually FOLLOWED that lever's recommendation versus the static
// defaults (config/routing.yaml / config/platforms.yaml) that gate generation and scheduling
// regardless of what the lever suggests. Without that attribution field there is no "posts that
// followed the recommendation" bucket to compare against a baseline — so this is an INSUFFICIENT
// TRACKING gap, not an insufficient-data one, and reporting a number here would be fabricating a
// finding (the repo's stated ethos elsewhere: never fabricate, no silent caps, flag insufficient
// data explicitly). See card 6b2f9d31 (open, hold) for the related gap on per-post framing tags.
//
// Levers D and E are different: both already compute a real measured delta against a baseline
// (spin-on vs. the verbatim spin-control-run baseline; per-platform engagement grouped by the CTA
// destination actually recorded on `posts.cta_destination`), gated by the same overfitting guard
// used across every lever (n >= min_posts_for_data, >= 4wk span). This module doesn't reinvent
// that math — it reuses frame-fit.ts's and cta-fit.ts's own loadRows/rank exports and surfaces
// both rankings together, plus the explicit A/B/C tracking-gap note, as one validation report.
// Recommendation only — nothing here changes what any lever, /atomize, or /publish does.
//   tsx src/strategy/lever-effectiveness.ts   → unified validation report to stdout

export interface LeverTrackingGap {
  lever: "A" | "B" | "C";
  name: string;
  cardId: string;
  scriptName: string;
  reason: string;
}

// Fixed, not computed — these three levers have no attribution field to query today. Reworded
// only if the underlying schema changes (e.g. card 6b2f9d31 ships a persisted routing-decision
// field), never softened into a fake number.
export const LEVER_TRACKING_GAPS: LeverTrackingGap[] = [
  {
    lever: "A",
    name: "Platform-fit (pillar × platform routing)",
    cardId: "c7638362",
    scriptName: "npm run platform-fit",
    reason:
      "posts.pillar and posts.platform are both persisted and queryable, but nothing stamps whether a " +
      "post's routing FOLLOWED Lever A's fit read — config/routing.yaml's defaults gate generation " +
      "unconditionally (card 7e550e48), so there is no 'routed via the lever' bucket to compare against a " +
      "baseline. npm run platform-fit / npm run resonance already show current pillar x platform " +
      "performance, but that is a snapshot, not a before/after lift attributable to the lever.",
  },
  {
    lever: "B",
    name: "Media-fit (media-type bias)",
    cardId: "27dc7d2d",
    scriptName: "npm run media-fit",
    reason:
      "posts.media_type is persisted, but /atomize's generation contract (always text + quote-card per " +
      "routed platform) is unconditional — there is no post whose media choice was made because of Lever " +
      "B's recommendation versus one that wasn't, so no A/B split exists to attribute an engagement delta " +
      "to.",
  },
  {
    lever: "C",
    name: "Cadence-fit (posting cadence / timing)",
    cardId: "ed23f712",
    scriptName: "npm run cadence-fit",
    reason:
      "config/schedule-overrides.yaml stays inert (approved: false) until Muxin opts in, and even once " +
      "approved, src/publish/slots.ts consumes it to pick a slot without stamping which published post " +
      "used an active override versus the default cadence. No before/after split exists to measure a " +
      "cadence lift.",
  },
];

export interface LeverEffectivenessReport {
  frame: FrameFitResult[]; // Lever D
  cta: CtaFitResult[]; // Lever E
  trackingGaps: LeverTrackingGap[]; // Levers A/B/C
}

// Pure composition — no I/O. Mirrors the frame-fit.ts / cta-fit.ts split between loadRows (I/O)
// and classify/rank (pure), so this stays testable without a real DB or config/strategy.yaml.
export function combineReport(
  frameRows: FrameRow[],
  ctaRows: CtaRow[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): LeverEffectivenessReport {
  return {
    frame: rankFrameFit(frameRows, cfg, strategyCfg, now),
    cta: rankCtaFit(ctaRows, cfg, strategyCfg, now),
    trackingGaps: LEVER_TRACKING_GAPS,
  };
}

// I/O wrapper. injectedDb, when given, is shared across both loaders and left open for the
// caller to close (same contract as frame-fit.ts / cta-fit.ts's own loadRows).
export function buildReport(injectedDb?: ReturnType<typeof openDb>, now = Date.now()): LeverEffectivenessReport {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const frameRows = loadFrameRows(injectedDb);
  const ctaRows = loadCtaRows(injectedDb);
  return combineReport(frameRows, ctaRows, cfg, strategyCfg, now);
}

function frameLabelText(r: FrameFitResult): string {
  switch (r.label) {
    case "frame-winning":
      return "spin frame winning — keep it";
    case "even":
      return "even";
    case "frame-losing":
      return "spin frame losing — verbatim baseline outperforms";
    case "insufficient-data":
      return "insufficient data";
  }
}

function ctaLabelText(r: CtaFitResult): string {
  switch (r.label) {
    case "clear-winner":
      return `${r.topDestination} clearly wins`;
    case "even":
      return "no clear winner (even)";
    case "insufficient-data":
      return "insufficient data";
  }
}

// Pure formatting — no I/O, so tests can assert on the exact string without a DB or config file.
export function formatReport(report: LeverEffectivenessReport, cfg: RoutingConfig): string {
  const lines: string[] = [];
  lines.push(`# Strategy lever effectiveness — ${new Date().toISOString().slice(0, 10)}\n`);
  lines.push(
    `Card 83166c51 (epic 2ce597d7 "Close the loop") asks whether the 5 recommendation-only levers that ` +
      `epic built actually work. Two of them (D: frame-fit, E: cta-fit) already compute a real measured ` +
      `delta against a baseline — this report surfaces both together. The other three (A: platform-fit, ` +
      `B: media-fit, C: cadence-fit) cannot honestly show the card's own example ("posts routed via Lever ` +
      `A show X% lift") today, because no field on \`posts\` records whether a post's routing, media ` +
      `choice, or publish slot actually followed that lever's recommendation — see "Insufficient tracking" ` +
      `below. That's a tracking gap, not a thin-data gap: more posts will not fix it on their own.\n`
  );

  lines.push(`## Lever D — spin-frame fit (spin-on vs. verbatim control baseline)\n`);
  const frameWithData = report.frame.filter((r) => r.label !== "insufficient-data");
  const frameThin = report.frame.filter((r) => r.label === "insufficient-data");
  if (report.frame.length === 0) {
    lines.push(
      "No platform has both a spin-on and a spin-off (control) row yet. Run npm run tag-source and npm run " +
        "spin-control.\n"
    );
  } else {
    if (frameWithData.length > 0) {
      lines.push(`| Platform | Read | Ratio | spin-on n | spin-off n |`);
      lines.push(`|---|---|---|---|---|`);
      for (const r of frameWithData) {
        lines.push(`| ${r.platform} | ${frameLabelText(r)} | ${r.ratio!.toFixed(2)}x | ${r.spinOnN} | ${r.spinOffN} |`);
      }
    } else {
      lines.push("No platform has enough spin-on/spin-off data yet (all read insufficient-data).");
    }
    if (frameThin.length > 0) {
      lines.push(
        `\n${frameThin.length} platform(s) read insufficient data (either side n<${cfg.thresholds.min_posts_for_data} ` +
          `or <4wks span): ${frameThin.map((r) => r.platform).join(", ")}.`
      );
    }
    lines.push("");
  }

  lines.push(`## Lever E — CTA-destination fit\n`);
  const ctaWithData = report.cta.filter((r) => r.label !== "insufficient-data");
  const ctaThin = report.cta.filter((r) => r.label === "insufficient-data");
  if (report.cta.length === 0) {
    lines.push("No platform has any CTA-tagged posts yet. Publish CTA-carrying posts, then run npm run tag-source.\n");
  } else {
    if (ctaWithData.length > 0) {
      lines.push(`| Platform | Read | Ratio |`);
      lines.push(`|---|---|---|`);
      for (const r of ctaWithData) {
        lines.push(`| ${r.platform} | ${ctaLabelText(r)} | ${r.ratio!.toFixed(2)}x |`);
      }
    } else {
      lines.push("No platform has two CTA destinations with enough data yet (all read insufficient-data).");
    }
    if (ctaThin.length > 0) {
      lines.push(
        `\n${ctaThin.length} platform(s) read insufficient data (fewer than two destinations clear ` +
          `n>=${cfg.thresholds.min_posts_for_data} + 4wk span): ${ctaThin.map((r) => r.platform).join(", ")}.`
      );
    }
    lines.push("");
  }

  lines.push(`## Insufficient tracking (Levers A/B/C)\n`);
  lines.push(
    "Not \"insufficient data\" — an attribution field literally doesn't exist yet for these three levers, " +
      "so no before/after lift can be shown honestly, at any sample size.\n"
  );
  lines.push(`| Lever | Signal | Why it can't be measured today |`);
  lines.push(`|---|---|---|`);
  for (const g of report.trackingGaps) {
    lines.push(`| ${g.lever} | ${g.name} | ${g.reason} |`);
  }
  lines.push(
    `\nEach lever's own script (${report.trackingGaps.map((g) => g.scriptName).join(", ")}) still shows the ` +
      "underlying pillar/media/cadence performance — just not a delta attributable to the lever's " +
      "recommendation. Closing this gap needs a persisted routing-decision field on `posts` (related: card " +
      "6b2f9d31, open, hold) — out of scope for this report."
  );

  return lines.join("\n");
}

function main() {
  const cfg = loadConfig();
  const report = buildReport();
  console.log(formatReport(report, cfg));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
