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
  // Added 2026-08-23. Open channels where a post travels on its own merit rather than on the
  // poster's follower count, so a real timeline sample is cheap and the baselines mean something.
  // reddit and hackernews score in upvotes and expose no follower concept at all, so a
  // view-to-follower ratio can never run on them; they are baseline-multiple only.
  "reddit",
  "hackernews",
  "devto",
  // Substack Notes is its own surface with its own feed, its own numbers and its own craft. Kept
  // separate from "substack" on purpose: a Note and an essay are different products, and pooling
  // them would put an essay's baseline under a Note.
  "substack-notes",
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

// Every form a post can take on the page. This is the axis the analysis compares on - which form
// wins, per platform - so a form recorded here must be a determination, never a shrug.
//
// "text-only" is a recorded observation, not a default: it means someone looked and found no
// attached media at all, which is a different fact from `media` being absent because nobody ever
// checked. "video" and "short-video" are split deliberately: a 40-second vertical short and a
// 20-minute upload are different products and perform differently. "document" is LinkedIn's PDF
// carousel, a distinct high-performing form there, and is never folded into "carousel".
//
// "mixed" is for a post that genuinely combines forms, with the parts named in `description`. It
// is NOT the label for a post whose form could not be determined - for that, leave the whole
// `media` object absent.
export const MEDIA_FORMS = [
  "text-only",
  "image",
  "carousel",
  "video",
  "short-video",
  "thread",
  "link-preview",
  "document",
  "poll",
  "audio",
  "gif",
  "live",
  "repost-with-comment",
  "mixed",
] as const;

export type MediaForm = (typeof MEDIA_FORMS)[number];

export type MediaAspect = "vertical" | "square" | "horizontal";

// What form the post actually took, and whether `body` alone is the whole post.
//
// Absent on an entry nobody has examined yet, and absent on an entry whose form could not be
// determined. Present means someone looked and reached an answer.
export interface CorpusMedia {
  form: MediaForm;
  // The text the creator typeset ONTO the image, frame or slide as its hook, word for word. This
  // is Sabrina Ramonov's "on-screen title", and remix mode copies it into Muxin's own post
  // VERBATIM. So a guess here does not degrade gracefully: it puts words she never verified into
  // her feed under a claim they were market-tested.
  //
  // Null when the post has no such title, and also null when one was simply not retrievable.
  // `description` is what tells those two apart. Never "probably something like this".
  onscreen_text: string | null;
  // What the media is, in plain words. An observation of what was actually seen, e.g. "a slide of
  // stacked text on a plain background". Never a guess at text that could not be read. On a
  // "mixed" entry this is where the parts are named, and on any entry it is where the method that
  // determined `form` is recorded.
  description: string | null;
  // Real running time of a video, short-video or audio post, in seconds. NEVER estimated from a
  // title, a thumbnail or a transcript length: null means it was not retrievable, and a null here
  // is a better answer than a plausible number.
  duration_seconds: number | null;
  // How many parts the media has: slides in a carousel, images in a set, pages in a document,
  // posts in a thread. Null when there is one part, and null when the count was not retrievable.
  media_count: number | null;
  // Whether a video carries captions, burned into the frame or served as a caption track. Null on
  // a non-video post, and null where it could not be determined.
  has_captions: boolean | null;
  aspect: MediaAspect | null;
  // READ THIS ONE TWICE. False means the post's substance is NOT in `body` - it sits in an
  // attached image, in slides 2..n of a carousel, in a video, or in reply tweets, none of which
  // were collected. A 22-character caption over an image that earned 3,536 likes has
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
  // Absent on an entry not yet examined, and absent where the form could not be determined.
  media?: CorpusMedia;
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
  // Creators who have PUBLICLY granted permission to remix their content verbatim. Absent on a
  // config written before remix mode existed, so every reader treats absent as "nobody".
  verbatim_ok?: VerbatimGrant[];
}

// One public grant. `grant` is the citation, and it is required for the same reason every other
// claim in this repo needs a source: a wrong entry here puts someone else's words in Muxin's feed
// under a permission she does not have.
export interface VerbatimGrant {
  handle: string;
  creator: string;
  grant: string;
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
  // Reasons to doubt this opener, shown at pick time. Empty is the good case.
  warnings: OpenerWarning[];
  collected_at: string;
}

// Why an opener is doubtful. Coded rather than freeform, because two of these four decide a
// refusal in `/patterns remix` and the other two only decide what Muxin is told.
//
// Refuse the pick on any of these three. All three mean the post's substance sat OUTSIDE the body
// the corpus holds, so copying its opener copies a fragment and misses the thing that worked:
//
//   "substance-outside-body" - RECORDED, not guessed: the entry's `media.body_is_complete` is
//                              false, meaning someone looked at the post and confirmed the body is
//                              not the whole of it. This is the trustworthy one, and when it fires
//                              the two guesses below are not used at all.
//   "short-body"             - a guess, used only where no `media` block was recorded. The body is
//                              short enough to be a caption over an image, a carousel, or a video
//                              that was never collected. It can also be a genuinely short post that
//                              worked on its own words. Nothing in the corpus tells those apart,
//                              which is why this reaches Muxin instead of being decided for her.
//   "media-first-platform"   - the same kind of guess, from the platform: slide text, frame text,
//                              and on-screen text usually carry the post there.
//
// Do NOT refuse on these two. They are context, not disqualification:
//
//   "missing-onscreen-title" - the post has media but no on-screen text on record. Muxin reads
//                              it off the original and supplies it; see remix-mode.md.
//   "truncated-body"         - the opener is intact but the body was cut off later, so the rest of
//                              the post is not fully known.
export type OpenerWarningCode =
  | "substance-outside-body"
  | "short-body"
  | "media-first-platform"
  | "missing-onscreen-title"
  | "truncated-body";

export interface OpenerWarning {
  code: OpenerWarningCode;
  // Plain-language version of the code, written to be read straight out to Muxin.
  note: string;
}
