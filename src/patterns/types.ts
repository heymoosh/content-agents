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

// The five shapes a post can take on the page. "none" is a recorded observation, not a default:
// it means someone looked and found no image, carousel, video or thread, which is a different
// fact from `visual` being absent because nobody ever checked.
export const VISUAL_FORMS = ["image", "carousel", "video", "thread", "none"] as const;

export type VisualForm = (typeof VISUAL_FORMS)[number];

// What the post actually looked like on the page, and whether `body` alone is the whole post.
//
// Absent on an entry nobody has examined for a visual yet. Present means someone looked.
export interface CorpusVisual {
  form: VisualForm;
  // The text rendered ON the image, frame or slide, word for word. This is Sabrina Ramonov's
  // "on-screen title", and remix mode copies it into Muxin's own post VERBATIM. So a guess here
  // does not degrade gracefully: it puts words she never verified into her feed under a claim
  // they were market-tested. Null means "not retrievable", never "probably something like this".
  onscreen_text: string | null;
  // What the visual depicts, in plain words. An observation of what was actually seen, e.g. "a
  // slide of stacked text on a plain background". Never a guess at text that could not be read.
  description: string | null;
  // Slides in a carousel. Null when the post is not a carousel, or when the count was not
  // retrievable.
  slide_count: number | null;
  // Tweets/posts in a thread. Null when the post is not a thread, or when the length was not
  // retrievable.
  thread_length: number | null;
  // READ THIS ONE TWICE. False means the post's substance is NOT in `body` - it sits in an
  // attached image, in slides 2..n of a carousel, or in reply tweets, none of which were
  // collected. A 22-character caption over an image that earned 3,536 likes has
  // body_is_complete: false, because the caption is not what won.
  //
  // This is the flag that stops a downstream step copying that caption and calling it a proven
  // opener. Any step that quotes `body` as if it were the whole post must check this first.
  body_is_complete: boolean;
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
  // Absent on a plain text post, and absent on any entry not yet examined for a visual.
  visual?: CorpusVisual;
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

// One verbatim opener, kept separately from the shape libraries because it is stored WORD FOR
// WORD. That is the deliberate 2026-08-22 exception described in
// `.claude/skills/patterns/references/remix-mode.md`, and it is scoped to two elements: the
// opener and the on-screen title. Everything after the opener stays shapes-only.
//
// Stored one JSON object per line in data/patterns/openers.jsonl, gitignored like the rest of
// data/patterns/**, because this is another creator's exact text.
export interface Opener {
  // Stable: opener-<corpus_entry_id>. Same corpus entry, same id, every rebuild.
  id: string;
  corpus_entry_id: string;
  platform: Platform;
  creator: string;
  handle: string;
  url: string;
  // The verbatim first line or first two lines of a text post, or the first spoken sentences of a
  // video. Never a paraphrase, never a summary. If it cannot be captured exactly, it is not
  // captured at all and no record is written.
  opener_text: string;
  // The big text on the video, verbatim. Null when the post has none, and also null when it was
  // simply not retrievable, because CorpusEntry has nowhere to record it today. A null here means
  // "unknown", so a remix run says so rather than inventing a title.
  onscreen_title: string | null;
  kind: PostKind;
  performance: {
    multiple: number | null;
    metric: BaselineMetric | null;
    // Plain-language reading of the two numbers above, including why they are null when they are.
    note: string;
  };
  // True ONLY where the creator has publicly granted permission to remix their work. False is the
  // default and the honest answer for almost everyone. This is a fact shown to Muxin at pick
  // time, not a gate the code enforces.
  verbatim_ok: boolean;
  collected_at: string;
}
