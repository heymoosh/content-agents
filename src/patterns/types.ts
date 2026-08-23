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
  // Added 2026-08-23. Pinterest is collected for its ARCHIVE, not its feed. A probe of 459 pins
  // across 31 accounts found that delivery to informational content collapsed around 2020: the
  // same account, same niche, same format, carries 15,201 saves on a 2017 pin and 1 to 3 saves on
  // a 2026 one. So a pinterest entry is only meaningful alongside its `era`, and pinterest posts
  // are never ranked in one pool with mixed eras. See src/patterns/era.ts.
  "pinterest",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export type PostKind = "text" | "video";

// Which delivery era a post went up in. Derived from `posted_at`, never recorded independently,
// and computed by `eraFor` in src/patterns/era.ts, which is also where the boundaries are argued.
//
// The buckets are Pinterest's, because Pinterest is where they were measured and where the split
// is enormous. They are still recorded on every platform, because a 2016 post and a 2026 post are
// not comparable anywhere and a reader should never have to parse a date to notice.
//
// "unknown" is a real answer, not a placeholder: it means the platform published no date, or
// published one that could not be read. It is never filled in by inference.
export const POST_ERAS = ["pre-2020", "2020-2022", "2023-plus", "unknown"] as const;

export type PostEra = (typeof POST_ERAS)[number];

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
  // Reddit's ratio of upvotes to total votes, 0..1, as the API reports it. Absent everywhere else,
  // because no other platform publishes it. It is recorded but deliberately NOT part of the
  // outlier score: a 0.95 ratio on a 12-point post and on a 12,000-point post are the same number
  // and mean different things, so it is context a reader weighs, never a bar the code fires on.
  upvote_ratio?: number | null;
  // Pinterest only, and it is a DIFFERENT quantity from `shares`. Read twice.
  //
  // `shares` on a pinterest entry holds that copy's own repin count: how many people saved THIS
  // pin, which is the number attributable to the account that posted it. `aggregate_saves` is
  // Pinterest's global aggregate across every copy of the same image anywhere on the platform, so
  // it measures whether the IMAGE travelled, not whether this account's post did. One collected
  // pin reads 93,185 aggregate against 2,723 repins on the same copy.
  //
  // For mining the shape of a graphic, aggregate is the honest number. For judging a creator,
  // `shares` is. Never add the two, and never quote one as the other.
  //
  // THE CUMULATIVE CONFOUND. Both are LIFETIME running totals with no time window, so a 2016 pin
  // has had ten years to accrue and a 2026 pin has had weeks. A raw comparison across eras
  // measures elapsed time as much as it measures quality. Comparisons are only honest within one
  // account, or against a same-era control. This is why `era` exists.
  aggregate_saves?: number | null;
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

// Where a collected post was found, so a reader can tell a winner from an ordinary post without
// re-reading the platform.
//
// This exists because of a real mistake. Every reddit entry in the corpus was pulled from a
// top-of-year listing, which made each one an outlier's sibling, so measuring a post against its
// siblings measured a winner against other winners. r/ADHD's biggest post of the year scored 2.2x
// that way and 4095x against the community's true median. `role` is what stops that reading:
// "winner" says the post was selected FOR having travelled, so its siblings are not a baseline.
//
// "baseline" is defined here for completeness, but the unbiased sample itself does not enter the
// corpus. It lives in data/patterns/baselines.jsonl as one AccountBaseline per account, because a
// few hundred ordinary posts per community would drown the collected winners the analysis reads.
// "unranked" is the third answer, added 2026-08-23 for Pinterest and available to any collector
// that needs it. It means the entries came off a listing that is not a ranking at all: a
// pinterest board's first server-rendered page is roughly the order the owner saved things, so it
// carries the board's best pin and its worst side by side. That is neither a winners list nor an
// unbiased performance sample, and saying either would be a lie in a different direction.
//
// What it tells a downstream step: do not read these as "this creator's best posts", and do not
// use their median as a denominator either, because on pinterest the pool spans eras whose
// medians differ by three orders of magnitude. Pinterest deliberately has no entry in
// `outlier_thresholds`, so nothing scores these automatically. See config/pattern-mining.yaml.
export type SampleRole = "winner" | "baseline" | "unranked";

export interface CorpusSample {
  // The platform listing the post came out of, in that platform's own words: "top", "new", "hot".
  listing: string;
  // The listing's time window where it has one, e.g. "year" for reddit's top?t=year. Null on a
  // listing with no window, like "new".
  window: string | null;
  // 1-based position in that listing at collection time. Null where position was not recorded.
  rank: number | null;
  role: SampleRole;
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
  // Which delivery era `posted_at` falls in. Absent on entries collected before this field
  // existed. Present, it must agree with `posted_at`: the collect step recomputes it and rejects
  // an entry where the two disagree, so it can never drift into a second, wrong source of truth.
  //
  // This is the field a downstream consumer filters on. "Top pinterest tip-graphics 2014-2019" is
  // era === "pre-2020", and it is one jq filter rather than a date parse.
  era?: PostEra;
  collected_at: string;
  kind: PostKind;
  // Full post text, or the pasted transcript for a video.
  body: string;
  transcript_source: TranscriptSource;
  metrics: CorpusMetrics;
  // The post's own title, where the platform has one as a separate field from the body. On reddit
  // the title is most of the craft and is often the entire artifact: a stranger scrolling a
  // subreddit sees the title and nothing else. Absent on platforms with no title field, and absent
  // on entries collected before this field existed.
  //
  // A titled post with no body of its own copies the title into `body` too, following the
  // convention the hand-collected reddit entries already use, and marks
  // `media.body_is_complete: false` so nothing downstream reads that title as a whole post.
  title?: string | null;
  // Absent on an entry not yet examined, and absent where the form could not be determined.
  media?: CorpusMedia;
  // How this post was found. Absent on entries collected before this field existed, which is why
  // no reader may assume an absent `sample` means an unbiased one.
  sample?: CorpusSample;
  notes?: string;
}

// An account's TRUE typical post, measured on a sample that was not selected for performance.
// Stored one JSON object per line in data/patterns/baselines.jsonl, gitignored like the corpus,
// because the scores belong to other people's posts.
//
// The whole point of this record is that it is measured somewhere other than the corpus. A
// corpus full of an account's best posts cannot produce it, and the median of that corpus is the
// wrong number by three orders of magnitude on reddit.
export interface AccountBaseline {
  platform: Platform;
  handle: string;
  // Which quantity `median` is measured on, so it is never divided into a score of the other kind.
  // "engagement" on reddit, where the score lands in metrics.likes and no view count exists.
  metric: BaselineMetric;
  // EXACTLY which counts were added together to get `median`, e.g. ["likes","comments"] or
  // ["likes","comments","shares"] or ["views"]. Derived from the sample, never chosen by a caller.
  //
  // This field is what stops the arithmetic drifting apart. A winner's numerator is rebuilt from
  // this same list before any division, so a median of likes-plus-comments can never be divided
  // into a score that also counted shares. That exact mismatch was live and invisible: the reddit
  // sample summed two terms while the corpus scored three, and it only looked right because reddit
  // publishes no share count. On Threads, Instagram or TikTok it would have inflated every
  // multiple and read as a finding.
  terms: BaselineTerm[];
  // The median score of the unbiased sample. This is the denominator of an honest multiple.
  median: number;
  // How many posts the median was taken over.
  sample_size: number;
  // Earliest and latest posting date in the sample, ISO date strings, so the window is auditable.
  window_start: string | null;
  window_end: string | null;
  // Every score in the sample, numbers only and no text, so the median can be rechecked or a
  // different percentile taken later without recollecting.
  scores: number[];
  // The account's audience size where the route exposes one: subscriber count on a subreddit.
  // Null where the number exists on the platform but not on this route.
  followers: number | null;
  // Plain words: which listing, what filter, what the sample deliberately excludes.
  method: string;
  collected_at: string;
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

// One count that can go into a travel score. These are the metric field names themselves, so a
// term list is checkable against a post's own numbers rather than being a label someone wrote.
export type BaselineTerm = "views" | "likes" | "comments" | "shares";

// What `multiple` was divided by.
//
//   "recorded" - a real AccountBaseline, measured on a sample that was not selected for
//                performance. The trustworthy one.
//   "siblings" - the median of the account's OTHER collected entries. Only as unbiased as the
//                collection is, and a collection of winners is not unbiased at all.
export type BaselineSource = "recorded" | "siblings";

export interface OutlierVerdict {
  isOutlier: boolean;
  ratio: number | null;
  multiple: number | null;
  // Which metric `multiple` was measured on, so a 4x is never ambiguous between views and
  // engagement. Null exactly when `multiple` is null.
  baselineMetric: BaselineMetric | null;
  // Where the denominator came from. Null exactly when `multiple` is null. Print it next to any
  // multiple you show a human: "12x against a recorded baseline" and "12x against other winners"
  // are not the same claim.
  baselineSource: BaselineSource | null;
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
  // Board slugs to collect from, pinterest only. Absent everywhere else, and absent on a pinterest
  // row means "read the account's boards off its profile page". It exists because pinterest has no
  // logged-out discovery at all: /search/pins/, /ideas/ and /today/ all answer 200 with zero pins,
  // so a seeded list is the primary path rather than a convenience.
  boards?: string[];
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
