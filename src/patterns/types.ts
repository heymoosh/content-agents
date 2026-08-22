// Pattern mining, phase 1: the shape of one collected post and the shape of an outlier verdict.
// Nothing here does I/O. The corpus itself lives in data/patterns/ and is gitignored, because
// other creators' full post text and transcripts never reach git.

// Mirrors the account-bearing keys in config/platforms.yaml, plus instagram. The pipeline-only
// keys in that file (quote-card, video-script, community) are not places another creator posts,
// so they are not collectable platforms here.
export const PLATFORMS = [
  "x",
  "linkedin",
  "mastodon",
  "threads",
  "bluesky",
  "substack",
  "tiktok",
  "youtube",
  "instagram",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export type PostKind = "text" | "video";

export type TranscriptSource = "manual" | "captions" | null;

export interface CorpusMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  followers: number | null;
}

// One collected post. Stored one JSON object per line in data/patterns/corpus.jsonl.
export interface CorpusEntry {
  // Stable slug: <platform>-<handle>-<short hash of url>.
  id: string;
  platform: Platform;
  handle: string;
  creator: string;
  // One of the niches listed in config/pattern-mining.yaml.
  niche: string;
  url: string;
  posted_at: string | null;
  collected_at: string;
  kind: PostKind;
  // Full post text, or the pasted transcript for a video.
  body: string;
  transcript_source: TranscriptSource;
  metrics: CorpusMetrics;
  notes?: string;
}

// Per-platform bars from config/pattern-mining.yaml. Either bar clearing makes an outlier.
export interface OutlierThresholds {
  view_follower_ratio: number;
  baseline_multiple: number;
}

export type OutlierReason = "ratio" | "baseline" | "both" | "none";

export interface OutlierVerdict {
  isOutlier: boolean;
  ratio: number | null;
  multiple: number | null;
  reason: OutlierReason;
}

export interface PatternMiningConfig {
  niches: string[];
  accounts: AccountSeed[];
  outlier_thresholds: Record<string, OutlierThresholds>;
  targets: { corpus_size_min: number; corpus_size_max: number };
}

export interface AccountSeed {
  handle: string | null;
  creator: string;
  platform: Platform;
  niche: string;
  followers: number | null;
}
