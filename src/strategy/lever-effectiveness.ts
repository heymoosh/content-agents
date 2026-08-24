import { fileURLToPath } from "node:url";
import { openDb } from "../db/db.js";
import { loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";
import {
  loadFollowRows as loadCadenceRows,
  rankCadenceFollow,
  type FollowRow as CadenceRow,
  type CadenceFollowFitResult,
} from "./cadence-fit.js";
import { loadRows as loadFrameRows, rankFrameFit, type Row as FrameRow, type FrameFitResult } from "./frame-fit.js";
import { loadRows as loadCtaRows, rankCtaFit, type Row as CtaRow, type CtaFitResult } from "./cta-fit.js";

// Card 83166c51 (epic 2ce597d7 "Close the loop"): validate the 5 recommendation-only levers the
// epic built (A c7638362/platform-fit, B 27dc7d2d/media-fit, C ed23f712/cadence-fit,
// D a4c5b42b/frame-fit, E d80411bc/cta-fit) actually measure something, rather than assuming they
// do. The card's own example wording ("posts routed via Lever A show X% resonance lift vs.
// baseline") was NOT honestly computable for A/B/C with the schema at the time #311 shipped:
// `posts` persisted pillar, media_type, source, and cta_destination, but nothing recorded whether
// a given post's routing, media choice, or publish slot actually FOLLOWED that lever's
// recommendation versus the static defaults (config/routing.yaml / config/platforms.yaml) that
// gate generation and scheduling regardless of what the lever suggests. That was an INSUFFICIENT
// TRACKING gap, not an insufficient-data one — reporting a number would have been fabricating a
// finding (the repo's stated ethos elsewhere: never fabricate, no silent caps, flag insufficient
// data explicitly).
//
// Lever C's half of that gap is now closed (this follow-up, stacked on #311): every text-platform
// publish (src/publish/typefully.ts, the one channel config/schedule-overrides.yaml's overrides
// apply to) stamps `posts.cadence_source` ('override' | 'default') at slot-claim time, so a real
// override-vs-default engagement comparison is now possible — see rankCadenceFollow below. Levers
// A and B are still genuine tracking gaps: routing (config/routing.yaml) and media generation
// (/atomize's always-text-+-quote-card contract) never branch on anything, so there is still no
// "followed the lever" bucket to attribute a delta to. Closing THAT needs a deliberate,
// Muxin-approved control mechanism (mirroring Lever D's periodic spin-control run,
// src/strategy/spin-control.ts, card f444f440) — proposed as cards 2ed2bc5a (Lever A) and
// 30257501 (Lever B), not built here; a mistaken earlier draft of this comment pointed at card
// 6b2f9d31 for this gap, but that card's actual filed scope is the unrelated per-post
// angle/case_skeleton framing-tag persistence for Lever D, not this.
//
// Levers D and E compute a real measured delta against a baseline (spin-on vs. the verbatim
// spin-control-run baseline; per-platform engagement grouped by the CTA destination actually
// recorded on `posts.cta_destination`), gated by the same overfitting guard used across every
// lever (n >= min_posts_for_data, >= 4wk span) that Lever C's follow-through comparison now also
// uses. This module doesn't reinvent that math — it reuses cadence-fit.ts's / frame-fit.ts's /
// cta-fit.ts's own loadRows/rank exports and surfaces all three rankings together, plus the
// explicit A/B tracking-gap note, as one validation report. Recommendation only — nothing here
// changes what any lever, /atomize, or /publish does.
//   tsx src/strategy/lever-effectiveness.ts   → unified validation report to stdout

export interface LeverTrackingGap {
  lever: "A" | "B";
  name: string;
  cardId: string;
  scriptName: string;
  reason: string;
}

// Fixed, not computed — these two levers have no attribution field to query today. Reworded only
// if the underlying schema changes (e.g. cards 2ed2bc5a/30257501 ship a persisted, Muxin-approved
// control mechanism), never softened into a fake number.
export const LEVER_TRACKING_GAPS: LeverTrackingGap[] = [
  {
    lever: "A",
    name: "Platform-fit (pillar × platform routing)",
    cardId: "c7638362",
    scriptName: "npm run platform-fit",
    reason:
      "posts.pillar and posts.platform are both persisted and queryable, but nothing stamps whether a " +
      "post's routing FOLLOWED Lever A's fit read. config/routing.yaml's defaults gate generation " +
      "unconditionally (card 7e550e48), so there is no 'routed via the lever' bucket to compare against a " +
      "baseline. npm run platform-fit / npm run resonance already show current pillar x platform " +
      "performance, but that is a snapshot, not a before/after lift attributable to the lever. Proposed " +
      "fix: card 2ed2bc5a (needs Muxin's sign-off before it builds).",
  },
  {
    lever: "B",
    name: "Media-fit (media-type bias)",
    cardId: "27dc7d2d",
    scriptName: "npm run media-fit",
    reason:
      "posts.media_type is persisted, but /atomize's generation contract (always text + quote-card per " +
      "routed platform) is unconditional, so there is no post whose media choice was made because of Lever " +
      "B's recommendation versus one that wasn't, so no A/B split exists to attribute an engagement delta " +
      "to. Proposed fix: card 30257501 (needs Muxin's sign-off before it builds).",
  },
];

export interface LeverEffectivenessReport {
  cadence: CadenceFollowFitResult[]; // Lever C
  frame: FrameFitResult[]; // Lever D
  cta: CtaFitResult[]; // Lever E
  trackingGaps: LeverTrackingGap[]; // Levers A/B
}

// Pure composition — no I/O. Mirrors the cadence-fit.ts / frame-fit.ts / cta-fit.ts split between
// loadRows (I/O) and classify/rank (pure), so this stays testable without a real DB or
// config/strategy.yaml.
export function combineReport(
  cadenceRows: CadenceRow[],
  frameRows: FrameRow[],
  ctaRows: CtaRow[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): LeverEffectivenessReport {
  return {
    cadence: rankCadenceFollow(cadenceRows, cfg, strategyCfg, now),
    frame: rankFrameFit(frameRows, cfg, strategyCfg, now),
    cta: rankCtaFit(ctaRows, cfg, strategyCfg, now),
    trackingGaps: LEVER_TRACKING_GAPS,
  };
}

// I/O wrapper. injectedDb, when given, is shared across all three loaders and left open for the
// caller to close (same contract as cadence-fit.ts / frame-fit.ts / cta-fit.ts's own loadRows).
export function buildReport(injectedDb?: ReturnType<typeof openDb>, now = Date.now()): LeverEffectivenessReport {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const cadenceRows = loadCadenceRows(injectedDb);
  const frameRows = loadFrameRows(injectedDb);
  const ctaRows = loadCtaRows(injectedDb);
  return combineReport(cadenceRows, frameRows, ctaRows, cfg, strategyCfg, now);
}

function cadenceLabelText(r: CadenceFollowFitResult): string {
  switch (r.label) {
    case "override-winning":
      return "override winning, keep it";
    case "even":
      return "even";
    case "override-losing":
      return "override losing, default cadence outperforms";
    case "insufficient-data":
      return "insufficient data";
  }
}

function frameLabelText(r: FrameFitResult): string {
  switch (r.label) {
    case "frame-winning":
      return "spin frame winning, keep it";
    case "even":
      return "even";
    case "frame-losing":
      return "spin frame losing, verbatim baseline outperforms";
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
  lines.push(`# Strategy lever effectiveness, ${new Date().toISOString().slice(0, 10)}\n`);
  lines.push(
    `Card 83166c51 (epic 2ce597d7 "Close the loop") asks whether the 5 recommendation-only levers that ` +
      `epic built actually work. Three of them (C: cadence-fit, D: frame-fit, E: cta-fit) now compute a ` +
      `real measured delta against a baseline, and this report surfaces all three together. The other two ` +
      `(A: platform-fit, B: media-fit) still cannot honestly show the card's own example ("posts routed ` +
      `via Lever A show X% lift") today, because no field on \`posts\` records whether a post's routing ` +
      `or media choice actually followed that lever's recommendation. See "Insufficient tracking" below. ` +
      `That's a tracking gap, not a thin-data gap: more posts will not fix it on their own.\n`
  );

  lines.push(`## Lever C, cadence-override follow-through (override vs. default cadence)\n`);
  const cadenceWithData = report.cadence.filter((r) => r.label !== "insufficient-data");
  const cadenceThin = report.cadence.filter((r) => r.label === "insufficient-data");
  if (report.cadence.length === 0) {
    lines.push(
      "No platform has any cadence_source-tagged posts yet, either because no override has been approved in " +
        "config/schedule-overrides.yaml, or none have published since. Run npm run tag-source after " +
        "publishing to stamp posts.cadence_source.\n"
    );
  } else {
    if (cadenceWithData.length > 0) {
      lines.push(`| Platform | Read | Ratio | override n | default n |`);
      lines.push(`|---|---|---|---|---|`);
      for (const r of cadenceWithData) {
        lines.push(`| ${r.platform} | ${cadenceLabelText(r)} | ${r.ratio!.toFixed(2)}x | ${r.overrideN} | ${r.defaultN} |`);
      }
    } else {
      lines.push("No platform has enough override/default data yet (all read insufficient-data).");
    }
    if (cadenceThin.length > 0) {
      lines.push(
        `\n${cadenceThin.length} platform(s) read insufficient data (either side n<${cfg.thresholds.min_posts_for_data} ` +
          `or <4wks span): ${cadenceThin.map((r) => r.platform).join(", ")}.`
      );
    }
    lines.push("");
  }

  lines.push(`## Lever D, spin-frame fit (spin-on vs. verbatim control baseline)\n`);
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

  lines.push(`## Lever E, CTA-destination fit\n`);
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

  lines.push(`## Insufficient tracking (Levers A/B)\n`);
  lines.push(
    "Not \"insufficient data\": an attribution field literally doesn't exist yet for these two levers, " +
      "so no before/after lift can be shown honestly, at any sample size.\n"
  );
  lines.push(`| Lever | Signal | Why it can't be measured today |`);
  lines.push(`|---|---|---|`);
  for (const g of report.trackingGaps) {
    lines.push(`| ${g.lever} | ${g.name} | ${g.reason} |`);
  }
  lines.push(
    `\nEach lever's own script (${report.trackingGaps.map((g) => g.scriptName).join(", ")}) still shows the ` +
      "underlying pillar/media performance, just not a delta attributable to the lever's recommendation. " +
      "Closing this gap needs a deliberate, Muxin-approved control mechanism (mirroring Lever D's periodic " +
      "spin-control run), proposed as cards 2ed2bc5a (Lever A) and 30257501 (Lever B), pending her sign-off. " +
      "Out of scope for this report."
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
