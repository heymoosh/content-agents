export type EvidenceSample = "sample" | "live" | "default";

export interface PerformanceObservation {
  readonly topic: string;
  readonly platform: string;
  readonly media: string;
  readonly format: string;
  readonly score: number;
  readonly measured: boolean;
  readonly sample: Exclude<EvidenceSample, "default">;
  readonly weeks: number;
}

export interface PerformanceTopRead {
  readonly topic: string;
  readonly platform: string;
  readonly media: string;
  readonly format: string;
  readonly score: number | null;
  readonly sample: EvidenceSample;
  readonly source: "measured-evidence" | "cold-start-default";
}

export interface PerformanceSummary {
  readonly topic: string;
  readonly sufficient: boolean;
  readonly top: PerformanceTopRead;
  readonly unmeasured: number;
  readonly zeroMeasured: number;
  readonly action: string;
}

export interface PreselectionRecommendation {
  readonly option: string;
  readonly recommended: boolean;
  readonly explanation: string;
  readonly source: "measured-evidence" | "cold-start-default";
}

export interface ContentPreselection {
  readonly summary: PerformanceSummary;
  readonly treatments: PreselectionRecommendation[];
  readonly media: PreselectionRecommendation[];
  readonly platforms: PreselectionRecommendation[];
  readonly overridable: true;
}

const DEFAULTS = { platform: "bluesky", media: "static-quote-card", format: "summary" } as const;
const SAMPLE_TOPIC = "work, status, and institutional incentives";
const SAMPLE_OBSERVATIONS: readonly PerformanceObservation[] = [
  { topic: SAMPLE_TOPIC, platform: "linkedin", media: "image-carousel", format: "shorter-version", score: 12, measured: true, sample: "sample", weeks: 8 },
  { topic: SAMPLE_TOPIC, platform: "linkedin", media: "text", format: "summary", score: 5, measured: true, sample: "sample", weeks: 8 },
];

export function summarizePerformance(observations: readonly PerformanceObservation[], options: { topic: string }): PerformanceSummary {
  const topic = options.topic;
  const relevant = observations.filter((item) => item.topic === topic);
  const measured = relevant.filter((item) => item.measured);
  const sufficient = relevant.some((item) => item.weeks >= 4);
  const top = [...measured].sort((a, b) => b.score - a.score || a.platform.localeCompare(b.platform))[0];
  const topRead: PerformanceTopRead = top && sufficient
    ? { topic, platform: top.platform, media: top.media, format: top.format, score: top.score, sample: top.sample, source: "measured-evidence" }
    : { topic, ...DEFAULTS, score: null, sample: "default", source: "cold-start-default" };
  const action = topRead.source === "cold-start-default"
    ? "Use the safe cold-start defaults and treat results as directional until four weeks of data exist."
    : `Use ${topRead.format} on ${topRead.platform} with ${topRead.media}; keep the choice overridable.`;
  return { topic, sufficient, top: topRead, unmeasured: relevant.filter((item) => !item.measured).length, zeroMeasured: measured.filter((item) => item.score === 0).length, action };
}

function optionsFor(
  summary: PerformanceSummary,
  relevant: readonly PerformanceObservation[],
  field: "platform" | "media" | "format",
  fallback: string,
): PreselectionRecommendation[] {
  const values = [...new Set(relevant.map((item) => item[field]))];
  if (!values.includes(fallback)) values.push(fallback);
  return values.map((option) => {
    const recommended = summary.top[field] === option;
    const evidence = relevant.find((item) => item[field] === option && item.measured);
    return { option, recommended, explanation: summary.sufficient && recommended
      ? `${option} is recommended from ${evidence?.sample ?? "measured"} performance evidence.`
      : summary.sufficient ? `${option} is available; evidence does not make it the top choice.`
        : `${option} is available under the safe cold-start defaults; no sufficient evidence is measured.`, source: summary.top.source };
  });
}

export function recommendContentPreselection(observations: readonly PerformanceObservation[], options: { topic: string }): ContentPreselection {
  const summary = summarizePerformance(observations, options);
  const relevant = observations.filter((item) => item.topic === options.topic);
  return { summary, platforms: optionsFor(summary, relevant, "platform", DEFAULTS.platform), media: optionsFor(summary, relevant, "media", DEFAULTS.media), treatments: optionsFor(summary, relevant, "format", DEFAULTS.format), overridable: true };
}

/** One labeled illustrative read for Signals plus separate, non-sample defaults for real requests. */
export function buildSignalsRecommendationRead(): { performance: ContentPreselection; contentDefaults: ContentPreselection } {
  return {
    performance: recommendContentPreselection(SAMPLE_OBSERVATIONS, { topic: SAMPLE_TOPIC }),
    contentDefaults: recommendContentPreselection([], { topic: "new content request" }),
  };
}
