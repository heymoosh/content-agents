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

// What `body` actually holds on a video entry, so nothing downstream has to guess.
//
// "manual"   - the SPOKEN words, typed or pasted by hand off the video.
// "captions" - the SPOKEN words, taken from the platform's own caption track.
// "caption"  - NOT the spoken words. The creator's written caption, description, or on-screen
//              text, recorded because the spoken transcript could not be retrieved at all. Note
//              the single letter between this and "captions": the two mean opposite things, so
//              read twice before labelling.
// null       - only ever valid on a text entry, where `body` is simply the post.
//
// The distinction is load-bearing for the analyze step, which reads a hook as the first few
// seconds of speech. A "caption" entry cannot answer that question, and this value is what says
// so, instead of letting a caption be read as if it were speech.
export type TranscriptSource = "manual" | "captions" | "caption" | null;

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

// Which quantity the baseline was measured on. "views" where a public view count was recorded,
// "engagement" where it was not and the sum of the recorded likes/comments/shares stood in.
export type BaselineMetric = "views" | "engagement";

export interface OutlierVerdict {
  isOutlier: boolean;
  ratio: number | null;
  multiple: number | null;
  // Which metric `multiple` was measured on, so a 4x is never ambiguous between views and
  // engagement. Null exactly when `multiple` is null.
  baselineMetric: BaselineMetric | null;
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
