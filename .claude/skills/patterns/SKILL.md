---
name: patterns
description: Learn what already works in Muxin's niches on each platform, then put it to work on her own material. Collects real winners from other creators into a gitignored local corpus, flags outliers off recorded numbers, synthesizes the patterns that repeat per platform, then proposes net-new post ideas, series arcs, and completable civic CTAs in both accepted forms (micro-action and value-aligned matching), and restructures her existing source material into platform-native treatments using common hook templates adapted into her own words. Exact creator text is retained only as internal evidence, quotation, attribution, or a licensed exception. It proposes rather than publishes. Usage - /patterns collect [--platform X] [--account @handle], /patterns analyze, /patterns synthesize [--platform X], /patterns ideas [--platform X] [--niche Y], /patterns series <content-folder>, /patterns rewrite <content-folder | file>, /patterns asap <content-folder>, /patterns remix <content-folder | topic> [--platform X].
---

# /patterns: the pattern mining pipeline

Reverse-engineer what the paid analytics tools sell, by hand and for free: gather posts that
already worked in Muxin's niches, find the genuine outliers, read what they have in common, write
that down as reusable structure, and then use that structure on her own work.

Eight modes in three jobs:

| Job | Modes | What it touches |
|---|---|---|
| **Learn** what works | `collect`, `analyze`, `synthesize` | other creators, studied for structure |
| **Propose** new work | `ideas`, `series`, `asap` | proposal cards Muxin accepts or dismisses |
| **Apply** to her material | `rewrite`, `remix` | her own source, restructured or given a proven opener |

**Scope:** `/patterns` never produces a publishable asset. `/atomize` still owns derivatives, the
review queue, and everything that reaches `/publish`. Nothing here publishes, queues, renders, or
schedules.

## Cold start: on day one nothing has been mined yet

`post-patterns.md` ships empty and `data/patterns/` ships with no corpus. Until `collect`,
`analyze`, and `synthesize` have actually run, `ideas`, `series`, and `rewrite` have no mined
patterns to work from, and they fall back to the 23 hook shapes in
`references/hook-patterns.md` plus the channel's `spin_angles` entry in `config/platforms.yaml`.

That fallback is fine. Hiding it is not. Before proposing anything in those three modes, check
both of these:

- does `.claude/skills/atomize/references/post-patterns.md` carry any mined records for the target
  platform, or does that platform's section still read "Not yet mined"
- does `data/patterns/corpus.jsonl` exist and hold entries, and has `analyze` written anything to
  `data/patterns/analyses.jsonl`

If either one is empty, **say so to Muxin in the output, before the proposals**, in plain language:
this run found no mined patterns, it is working from the August hook library instead, and the fix
is `/patterns collect`, then `/patterns analyze`, then `/patterns synthesize`. Never present
hook-patterns fallback output as if it came from mined patterns, and never call it "what wins on
this platform" when nothing was mined.

## The four non-negotiable rules

### 1. Common templates, original substance

The whole guardrail, inherited from `.claude/skills/atomize/references/hook-patterns.md`. Read
that file's "How to use this" section before you synthesize, propose, or rewrite anything.

- **What we mine is the mechanism and the reusable hook template.** "This format is common and
  works under these conditions" is the value. A common opener may be adapted in mad-lib form.
- **Every synthesized pattern has slots**, filled at apply time with Muxin's own fact, claim,
  experience, evidence, example, and point of view. The resulting wording should sound like her,
  not like a generic social post.
- **A real example is evidence, not a body-copy bank.** Cite the creator, platform, post, metric,
  and scope. Exact creator wording may remain visible in internal analysis, but the generated
  treatment must adapt the common template and must not copy a distinctive phrase sequence.
- **Never copy a creator's body text into a committed file.** The corpus holds their full text
  locally and stays out of git for exactly this reason. Only distilled shapes get committed.

`/patterns remix` applies this same common-template rule to the selected opener and on-screen
title. It may show the exact captured text as evidence, but the output adapts the hook into
Muxin's own wording and fills it with her substance. There is no requirement for a creator-specific
permission flag when the output is a common template rather than a quotation.

### 2. The system proposes. It does not compose.

`/develop` (`.claude/skills/develop/SKILL.md`) already settled how this repo does net-new
suggestion without breaking extraction-first, and `/patterns ideas`, `series`, and `asap` follow
its model exactly. Read its "Hard rules" before running any of the three.

- An idea card, a series arc, and a candidate micro-action are **proposals about what to write**.
  They are not claims in Muxin's voice, so they do not violate CLAUDE.md rule 1.
- **The system never writes the body.** Drafting stays on the existing paths: accepting an angle
  deterministically builds a cut from Muxin's own verbatim `source.md` lines
  (`src/review/develop.ts` `acceptAngle`), and `/atomize --continue <folder> [--cut <lens>]` takes
  it from there.
- The line is concrete. "Here is a post shape, and lines 31-33 of your essay already carry it" is
  a proposal. Writing those three lines into a paragraph in her voice is composition. Do the
  first, never the second.
- **A proposal that points at nothing of hers is marked as needing her input, never invented into
  a claim.** An honest "this shape is strong but you have not written anything that fills it yet"
  is a useful card. A fabricated fill is not.

### 3. Extraction-first governs the rewrite (CLAUDE.md rule 1)

`/patterns rewrite` is the one mode that produces prose, so this is where the rule bites hardest:

- Every rewritten version reorders, re-hooks, and re-frames material **already in her source**.
- The hook may be newly worded from a selected common template. That is the deliberate exception
  to strict extraction, and it applies only to the platform hook/opening. The body must continue
  to use Muxin's own source, facts, examples, and point of view.
- It NEVER composes a new claim, statistic, experience, result, or worldview line in her voice.
  If a shape has a blank the source cannot fill honestly, that shape does not fit this piece. Pick
  a different one. Do not fill the blank with something you made up.
- **A bare topic with no source material is REFUSED.** Route it to `/patterns ideas` or
  `/patterns series` instead, which are built for exactly that case and stay on the proposal side
  of rule 2.
- A viral shape never overrides her voice. `config/voice.yaml` governs the output completely.

### 4. No invented proof

Nothing anywhere in this skill asserts a link, form, tool, deadline, race, ballot measure,
statistic, or result that has not been verified as real and current. This is the same
no-invented-proof spirit CLAUDE.md rule 1 carries into every scoped exception in this repo, and it
binds a proposal card exactly as hard as it binds a draft. A plausible-sounding fake deadline is
worse than a generic fallback, not better. When the specific thing cannot be verified, say so on
the card and fall back to `config/cta.yaml`'s default.

## Voice and AI tells (CLAUDE.md rule 5)

Read `config/voice.yaml` before drafting any text a human will read, and before writing a card
title or summary. The short version: no em dashes anywhere, no "here's the thing", no "it's not
just X, it's Y", no "let's unpack", no rhetorical-question hooks, no reflexive triads. Muxin
sounds like a working PM thinking out loud. Read every rewrite aloud before handing it over.

The em-dash rule applies to the pattern libraries too. A mined shape written with an em dash in it
gets copied into a real post later.

## The civic layer

Muxin's civic adaptation rubric lives in
`.claude/skills/atomize/references/civic-adaptation.md`: two tables she supplied and decided.
Read it before synthesizing, proposing, or rewriting anything civic. Three things about it:

- **It is a rubric, not mined data.** `/patterns` reads it and never writes to it. hook-patterns.md
  and post-patterns.md hold shapes discovered by mining. This file holds a standard she set.
- **A raw viral shape is not shipped unadapted for civic material.** Table 1 is the adaptation
  layer: concrete pain or outcome in the hook, an immediate personal payoff, one specific
  low-friction next action, everyday local language instead of abstract "democracy" talk, one
  source repurposed into many short pieces, and recurring series arcs.
- **The rubric and the register stack, they do not compete.** This rubric says WHAT a civic piece
  delivers. hook-patterns.md's joyful-activism niche default (patterns 16 to 23, preferred over
  the outrage register unless the source is genuinely grief or anger toned) says in WHICH
  REGISTER. A joyful piece ending on "get involved" fails the rubric. A perfect 90-second
  micro-action written as grievance fails the register default. Every civic output of this skill
  needs both.

Table 2 is the CTA bar, and it is a hard one: "vote", "get involved", and "stay informed" are
explicitly rejected. It has three replacements, not one. A micro-action a reader can finish
immediately. Belief- or value-aligned matching, her words for it being "based on what you said you
care about, here's how these candidates actually voted on X", kept neutral and record-based so it
reads as useful rather than partisan. And local plus specific beating national plus abstract.

## Scripts count, Claude judges (CLAUDE.md rule 4)

The deterministic catalog/report scripts are:

- `npm run patterns:collect` validates staged entries, dedupes by url, appends to the corpus, and
  prints a per-account summary. It never judges, analyzes, or calls a model.
- `npm run patterns:outliers` is the same script's `outliers` subcommand. It scores the corpus off
  recorded numbers and prints the report. It appends nothing and fetches nothing.

- `npm run patterns:account-mapping`, `npm run patterns:coverage`, and
  `npm run patterns:pool-evidence` print deterministic inventory reports. They preserve nulls,
  expose missing metadata, and never infer pool membership, select winners, or generate copy.

- `npm run patterns:openers` builds the verbatim opener bank from the corpus and prints it ranked.
  It derives, dedupes, and appends. It never judges or calls a model, and it skips any entry whose
  opener cannot be known rather than guessing.

Everything else here is Claude judgment done inline while running this skill. There is no
`patterns:analyze`, `patterns:synthesize`, `patterns:ideas`, `patterns:series`,
`patterns:rewrite`, `patterns:asap`, or `patterns:remix` script. Do not invent one.

## Where things live

| Thing | Path | In git? |
|---|---|---|
| Config: niches, accounts, thresholds, targets | `config/pattern-mining.yaml` | yes |
| Muxin's civic rubric (read only, never written here) | `.claude/skills/atomize/references/civic-adaptation.md` | yes |
| The common-hook template rule | `.claude/skills/patterns/references/remix-mode.md` | yes |
| Hook shapes | `.claude/skills/atomize/references/hook-patterns.md` | yes |
| Full-post shapes (this skill writes these) | `.claude/skills/atomize/references/post-patterns.md` | yes |
| Staged entries waiting to be collected | `data/patterns/inbox/*.json` | no |
| The corpus of collected posts | `data/patterns/corpus.jsonl` | no |
| Per-outlier structural analyses | `data/patterns/analyses.jsonl` | no |
| The verbatim opener evidence bank (analysis only) | `data/patterns/openers.jsonl` | no |
| Proposed post ideas | `data/patterns/ideas.md` | no |
| Remix drafts for her review | `<content-folder>/pattern-remixes.md` | yes |
| Series and micro-action proposal cards | `<content-folder>/develop/advice.json` + `develop/log.md` | yes |

`data/patterns/**` is gitignored on purpose. Other creators' full post text and video transcripts
never reach git, same treatment as `data/analytics.db`. Say this to Muxin the first time she asks
where the corpus went.

`config/pattern-mining.yaml` is Muxin's to edit freely. Read it, never rewrite it on her behalf.
If she wants a new account or a tuned threshold, tell her which key to change.

### The three reference files in `.claude/skills/atomize/references/`

There are exactly THREE, they are one system, and this skill never adds a fourth:

1. **`hook-patterns.md`** holds hook shapes: how a post OPENS, 23 cited patterns today.
   `/patterns synthesize` appends to it, continuing its numbering.
2. **`post-patterns.md`** holds full-post structure: the arc after the hook. Empty until a
   synthesis run fills it, split by platform. `/patterns synthesize` writes into the target
   platform's own section.
3. **`civic-adaptation.md`** holds Muxin's decided civic rubric. **`/patterns` reads it and never
   writes to it**, because it is a standard she set rather than something mined.

If a shape does not belong in one of the first two, it does not get a new file. Say so and stop.

**The re-hook gate is no longer X and LinkedIn only.** Muxin widened `appliesRehook(platform,
sourceKind)` (`src/atomize/spin.ts`) on 2026-08-22 to EVERY platform, with `rehook: false` in
`config/platforms.yaml` as the per-channel opt-out (only `quote-card` uses it today, since a card
is pulled verbatim) and the `source_kind: substack-note` exclusion unchanged. So mined patterns are
in scope wherever the re-hook pass runs, which is why this skill synthesizes across all nine
collectable platforms rather than two. If you ever read prose here or elsewhere implying the old
two-platform scope, it is stale.

## Mode dispatch

- **`/patterns collect`** gathers winners into the corpus. Read
  `references/platform-collection.md` first, every time.
- **`/patterns analyze`** extracts structure from the outliers.
- **`/patterns synthesize`** turns repeated structure into a committed pattern library.
- **`/patterns ideas`** proposes net-new posts from those patterns and her existing material.
- **`/patterns series`** proposes a multi-piece arc from one thing she already gave the system.
- **`/patterns rewrite`** restructures her own source material three ways.
- **`/patterns asap`** proposes ranked, verifiable civic CTA candidates for a piece, in either
  accepted form: a micro-action, or value-aligned matching.
- **`/patterns remix`** adapts one proven common opener template and, when available, its visual
  title into her own words, then builds the rest of the post out of her own material. Read
  `references/remix-mode.md` first, every time.

`ideas`, `series`, and `asap` all run under rule 2. `rewrite` runs under rule 3. `remix` runs under
rule 1's common-template hook exception, and under rule 3's source-only constraint for every line
after the adapted hook. Nothing runs without rules 1 and 4.

---

## Mode 1: `/patterns collect [--platform X] [--account @handle]`

Goal: 20-50 real winners in the corpus (`targets.corpus_size_min` / `corpus_size_max` in
`config/pattern-mining.yaml`). Quality beats volume. Twenty genuinely strong posts across three
accounts is a better corpus than fifty mediocre ones.

**There is no scraper in v1. Say so plainly.** Muxin does the gathering with her eyes and her
clipboard; you do the sorting, structuring, and bookkeeping. Do not imply anything is being pulled
automatically, and do not pretend a number was fetched when she read it off a screen. Fetching one
post's own raw markup with `curl` to read its text back is allowed, and is governed by the hard
rule directly below. A built per-platform pull pipeline is not, and stays Phase 2.

### Hard rule: the `body` field is raw text only, never a summarizing fetch tool

**Read this before staging a single entry.** It is the most damaging thing that can go wrong in
this skill, and it did go wrong on 2026-08-22.

**Never use WebFetch, or any other tool that answers a prompt against a page with a model, to
produce a `body`.** WebFetch converts a page to markdown and then has a small fast model answer
your prompt against it. Instructing it "return the text verbatim, do not summarize" does NOT make
it return verbatim text. It returns that model's version of the page. On one LinkedIn post whose
real body is 22 characters, it returned roughly 1,100 characters that were a COMMENT written by a
different person, with the author attribution stripped. That entry was staged as the creator's own
words and scored as the highest outlier in its set. Every winning pattern derived from it would
have been a shape that creator never wrote. All 15 LinkedIn entries had to be purged and
re-collected from raw markup.

**A body comes from one of exactly two places.**

1. **Muxin pastes it.** Her clipboard is a verbatim route and it is the v1 default.
2. **Raw retrieval.** `curl` the page and read the creator's words out of the markup or JSON the
   platform itself serves, with no model anywhere in the path. Routes verified on 2026-08-22:
   - **LinkedIn**: curl the public post URL and parse the
     `<script type="application/ld+json">` `SocialMediaPosting` block. `articleBody` is the true
     body, `interactionStatistic` carries the like and comment counts,
     `author.interactionStatistic.userInteractionCount` is the follower count, and `datePublished`
     is a real ISO timestamp.
   - **Substack, Bluesky, Instagram**: the platform's own raw JSON endpoints, or raw HTML via curl.
   - **YouTube**: the real caption track off the watch page.
   `references/platform-collection.md` carries the per-platform detail and the honest limits.

**The tells that a body was summarized.** Check all four before staging a batch:

- line breaks are missing, or a post that plainly had structure arrives as one flowing paragraph
- every body from one platform lands in a suspiciously similar length range
- the body text does not match the post's own URL slug
- the text reads like a description of the post rather than the creator's own voice

The 2026-08-22 run reported "line breaks lost on 11 of 15 bodies" and read it as a platform
rendering quirk. It was the summarizer reflowing text it had rewritten. After re-collection from
raw markup, 13 of those 15 bodies carried real line breaks.

**Why this is the worst failure mode in the pipeline.** A fabricated or misattributed body looks
exactly like a real one. Nothing downstream can catch it: `outliers.ts` scores it, `analyze` reads
structure off it, `synthesize` writes that structure into `post-patterns.md`, and no human reading
`post-patterns.md` later has any way to tell. A missing entry costs one row. A fake entry costs the
credibility of every pattern near it.

**When raw retrieval fails, stage nothing for that post.** An honest gap is a finding. Say which
platform could not be collected and why, and report the thinner coverage as it is. Never thin
coverage elsewhere to compensate, and never reach for a summarizing tool to fill the hole.

### Steps

1. **Read the config and the platform guide.** `config/pattern-mining.yaml` for the niches and the
   seeded account list. `references/platform-collection.md` for the platform she named (or for
   every covered platform if she named none). Then tell her, per platform, the FREE way to sort
   that creator's posts by performance, what numbers she will actually be able to see, and what to
   do when views do not exist there. That guide is the substance of this step; do not paraphrase
   it from memory.

2. **Narrow the target.** Honor `--platform` and `--account` when given. Otherwise run
   `npm run patterns:outliers` (it prints per-account counts and writes nothing) and propose the
   thinnest account or platform, so the corpus fills evenly instead of stacking one creator.

3. **Ask for the account's follower count once**, before collecting any of its posts, and reuse it
   for every entry from that account in this session. `viewFollowerRatio` in
   `src/patterns/outliers.ts` cannot work without it. It is public on every platform covered here.
   YouTube subscriber counts are rounded; record the rounded number and say it is rounded.

4. **Take one post at a time.** For each one Muxin pastes, capture:
   - the post text, verbatim, for a text post
   - the transcript, for a video (TikTok, Reels, YouTube Shorts). Pasted by hand
     (`transcript_source: "manual"`), or copied from the platform's own caption track
     (`transcript_source: "captions"`). YouTube's "Show transcript" is the free route and it is the
     easiest of the three. When no spoken transcript can be had at all, record the creator's
     written caption or on-screen text instead and set `transcript_source: "caption"`, singular,
     which records out loud that `body` is not the spoken words. **A summary is not a transcript.**
     Never write a paraphrase into `body`; the analysis step reads structure off the actual words
     and a summary erases it.
   - the url, the posting date if visible, and whichever metrics are genuinely on screen
   - anything she noticed herself, into `notes`

5. **Stage each entry as JSON into `data/patterns/inbox/`.** A file may hold ONE entry object or an
   ARRAY of them, so a session's whole batch can go in one file. The record shape:

   ```json
   {
     "platform": "youtube",
     "handle": "@alilbitcloser",
     "creator": "A Lil Bit Closer",
     "niche": "inner-journey",
     "url": "https://www.youtube.com/watch?v=...",
     "posted_at": "2026-07-14",
     "kind": "video",
     "body": "<full post text, or the full transcript for a video>",
     "transcript_source": "captions",
     "metrics": {
       "views": 412000,
       "likes": 18400,
       "comments": 962,
       "shares": null,
       "followers": 88000
     },
     "notes": "Sorted via channel Videos tab, Popular. Third from the top."
   }
   ```

   Field rules, all verified against `src/patterns/collect.ts` and `types.ts`:
   - **Leave `id` and `collected_at` out.** `collect.ts` fills both: the id as
     `<platform>-<handle-slug>-<first 8 hex of a sha1 of the url>` (the slug is the handle
     lowercased with the `@` stripped and every run of other characters turned into one dash), and
     `collected_at` as the moment it ran. Only set them by hand when re-staging an entry that
     already has one.
   - **Keep the leading `@` in `handle`.** That is what the config seeds use and what the corpus
     stores. The `@` is stripped only when building the id slug and the account grouping key, so
     `@Someone` and `someone` already group as one account.
   - Required non-empty strings: `platform`, `handle`, `creator`, `niche`, `url`, `body`. Plus
     `kind` and a `metrics` object.
   - `platform` is one of the nine in `PLATFORMS` (`src/patterns/types.ts`): the account-bearing
     `config/platforms.yaml` keys plus `tiktok`, `youtube`, and `instagram`. The pipeline-only keys
     (`quote-card`, `video-script`, `community`) are not places another creator posts and are
     rejected.
   - `niche` must be one of the niches in `config/pattern-mining.yaml`
     (`building-solopreneur`, `inner-journey`, `civic-democracy`). Do not invent one.
   - `kind` is `"text"` or `"video"`. A video entry MUST carry a non-null `transcript_source`, and
     a text entry MUST leave it `null`. Validation enforces both directions.
   - **`transcript_source` has FOUR values, and two of them sit one letter apart on purpose.**
     Re-read this every time you stage a video. `"captions"` and `"caption"` now mean nearly
     opposite things.
     - `"manual"`: the SPOKEN words, typed out by hand.
     - `"captions"`, plural: the SPOKEN words, taken from the platform's caption track.
     - `"caption"`, singular: **NOT the spoken words.** The creator's written caption or the
       on-screen text, recorded because the spoken transcript could not be retrieved.
     - `null`: text entries only. A video entry may never be null.
     Swapping the singular for the plural tells every later step that written text is speech, which
     is the same misattribution the body rule above exists to stop.
   - `posted_at` is an ISO date string or null. `notes` is an optional string.
   - **Every metric may be null, and null is the correct answer when the number is not public.**
     A missing key reads as null. **Never write 0 for an unknown number**: a real 0 suppresses the
     ratio, and the math cannot tell a reading from a guess. LinkedIn, Substack, Bluesky, Mastodon,
     and Threads have no public view counts at all.

6. **Run `npm run patterns:collect`.** It validates the shape, drops duplicate urls, appends to
   `data/patterns/corpus.jsonl`, and prints how many entries each account and platform now holds
   plus which cleared the outlier bar. Relay that summary to Muxin as is.
   - A rejected entry is named by file, array index, and every reason, and the run exits non-zero.
     Valid entries in the same batch still get appended. Fix the staged JSON and re-run; never edit
     `corpus.jsonl` by hand to work around it.
   - Staged files are NOT consumed. Re-running is safe because the corpus dedupes by url, and
     Muxin can clear `data/patterns/inbox/` whenever she wants (it is gitignored either way). A
     one-off file outside the inbox can be passed with `--entry <file>`.

7. **Report honestly.** Corpus size against the 20-50 target, which accounts are still thin, which
   platforms had no visible numbers and are therefore leaning on judgment rather than scoring, and
   anything that failed validation and why. If she collected on a platform where views do not
   exist, tell her that platform's entries will only ever be outliers by engagement baseline, not
   by view ratio.

---

## Mode 2: `/patterns analyze`

Goal: one structural record per outlier, appended to `data/patterns/analyses.jsonl`. This file is
gitignored, same as the corpus.

### Steps

1. **Run `npm run patterns:outliers`.** It reads the corpus and the per-platform thresholds in
   `config/pattern-mining.yaml` and returns the outlier set, each with its `ratio`, its
   `multiple`, and the `reason` naming which test fired. That is the whole selection step. Do not
   re-judge which posts are outliers; the script owns that call.

   **The `admissible` field, and what it is not.** Records in `analyses.jsonl` carry `admissible`,
   which is true exactly when `gate` is `ADMITTED`. It was called `outlier` in earlier passes and
   was renamed once its meaning stopped matching `classifyOutlier` in `src/patterns/outliers.ts`.
   Do not read it as that function's verdict. A post can be a script-outlier and still not
   admissible, because admission also requires clearing its platform's raw-popularity floor and
   having a complete body. The per-record `reason` prose is historical working notes and may
   describe a retired gate; trust `gate`, `popularity` and `platform_floor` instead.

2. **If the outlier set is empty or tiny, say so and stop.** The usual causes are a corpus under
   the size target, an account with fewer than three other scored entries (so `baselineMultiple`
   cannot compute), or a platform with no public views. Name the actual cause and recommend either
   more collecting or a threshold tune in the config. Do not lower the bar yourself to manufacture
   an outlier set.

3. **Pull each outlier's actual text.** The outliers report prints ids and urls, not bodies. Look
   each id up in `data/patterns/corpus.jsonl` and read that entry's `body`, which is the full post
   text, the full spoken transcript, or (on a `transcript_source: "caption"` entry) the creator's
   written caption. Check `transcript_source` before you read a video entry, because a `"caption"`
   body is not speech and step 4 handles it differently. Analyze the words that are there, never
   the url and never a memory of the post.

4. **For EACH outlier, extract these eight fields.** The first six are Muxin's own requested
   fields. The last two exist to test her civic rubric against real numbers instead of assuming
   it. Keep all eight, even when one is genuinely absent, recording it as absent rather than
   dropping it:

   - **`hook`**: the exact hook. First 1 to 3 sentences for a text post. The first 3 seconds for
     a video, meaning the opening words of the transcript, not a description of the visuals.
     **A `transcript_source: "caption"` entry cannot answer that and must not be made to.** Its
     body is written caption text, so record what that caption does structurally (how it opens,
     what it withholds, where it turns) and then state plainly that the spoken hook is unknown for
     this entry. Never infer, reconstruct, or guess a spoken hook from a caption. A guessed hook
     becomes a synthesized pattern about how videos open, built on words nobody said.
   - **`structure`**: the overall structure and storytelling arc. Beat by beat, in order. What
     the opening sets up, where it turns, what pays off, how it lands.
   - **`emotional_trigger`**: the emotional trigger or curiosity gap. What feeling or unanswered
     question keeps someone reading past line one.
   - **`cta`**: the CTA or call to conversation, including "none" when there is none. Note
     whether it asks for a click, a reply, or nothing at all.
   - **`format`**: length and formatting patterns. Word or character count, line-break rhythm,
     paragraph length, list use, emoji use, hashtag count, where the link sits.
   - **`why_it_worked`**: why this likely performed well for THIS audience on THIS platform. Tie
     it to the platform's mechanics and the creator's specific audience, not to a generic "it was
     relatable". This is the field the synthesis step leans on hardest, so make it specific enough
     to disagree with.
   - **`immediate_payoff`**: what the reader gets or avoids RIGHT NOW, in the post's own terms
     (time, money, power, protecting something they care about), or `"none"` when the post offers
     no immediate payoff at all. Civic-adaptation table 1 names this as what makes a piece work;
     recording it on every post, civic or not, is what lets the corpus prove or disprove that.
   - **`cta_completable`**: one of `"micro-action"` (a specific thing a reader could finish in
     under 5 to 10 minutes), `"vague"` (a "vote" / "get involved" / "stay informed" style ask), or
     `"none"`. Judge what the post actually asked, not what it should have asked.
     **Do not "align" this enum with the two-form civic CTA bar.** It classifies what a MINED post
     did, not what one of Muxin's CTAs may be, a value-matching close already classifies as
     `"micro-action"` here, and changing the vocabulary mid-corpus would make records written
     before and after the change incomparable.

   Record these two the same way on non-civic posts. The point is to find out whether payoff and
   completable CTAs correlate with reach across every niche, which is a real question the corpus
   can answer and this skill should not pre-answer.

5. **Write one record per outlier** to `data/patterns/analyses.jsonl`, appending, never rewriting
   the file. Carry the corpus `id`, `platform`, `handle`, `niche`, and `url` onto the record so a
   synthesized pattern can cite its source later, plus the `reason` the outlier fired and an
   `analyzed_at` date.
   - **Skip ids already in the file.** Read `analyses.jsonl` before you start and analyze only the
     outliers that are not in it yet. The file is append-only, so a second run that re-analyzes
     everything silently doubles every record and skews the synthesis step's sense of what repeats.

6. **Quote sparingly and mark it.** The `hook` field will contain the creator's actual words, which
   is the point, and it is safe because this file never enters git. Everywhere else, describe the
   move rather than transcribing the line.

7. **Report** how many outliers were analyzed, per platform, how many were skipped as already
   analyzed, and anything you noticed repeating already. Do not synthesize yet. That is the next
   mode and it wants the whole set.

---

## Mode 3: `/patterns synthesize [--platform X]`

Goal: the 5 to 7 most common winning patterns, **per platform**, written as reusable shapes,
adapted for civic where the niche calls for it, and proposed as an edit Muxin approves before it
lands in git.

**Every record you write MUST carry a `Reach behind it` line.** It sits between `Mechanism` and
`Structure / arc`, and it states the real size of the evidence in the metric that platform
publishes, named every time. List raw values where there are five or fewer; add a median only where
there are three or more AND every one is identified. **Never round up, never blend a view count
with an engagement count, and never write a number you did not measure.** Where you cannot resolve
a pattern to specific posts, say "section band" and quote that platform's admitted range, which is
a statement about the section rather than a measurement of the pattern.

This exists because post count and evidence strength point in opposite directions in this corpus.
Mastodon contributed 54 posts at a median of 128 engagements while TikTok contributed 38 at 29,691,
a 232x gap on the same unit. Without this line a Mastodon pattern resting on three posts reads as
equal to a TikTok pattern resting on three posts. See the "How much reach is actually behind the
evidence" section in `post-patterns.md` for the full table.

**Per platform is load-bearing.** What wins on LinkedIn is not what wins on TikTok. A LinkedIn
case-first structure and a TikTok three-second visual-payoff hook are different patterns, not one
pattern with variants. Never blend platforms into a single list. If `--platform` is given, do that
one. If not, do every platform with enough analyses to support it and say which ones were skipped
for thin data.

### Steps

1. **Read `data/patterns/analyses.jsonl`** and group by platform. A platform with fewer than about
   five analyses does not support a pattern list; say so and skip it rather than generalizing from
   two posts.

2. **Find what repeats.** A pattern is something that shows up across MULTIPLE creators or multiple
   posts, not one clever post you liked. Aim for 5 to 7 per platform. Fewer is fine and honest.
   More than 7 usually means you are describing individual posts instead of patterns.

3. **Adapt every civic pattern through the rubric before writing it down.** A mined viral pattern
   is rarely civic-native, and **a raw viral shape is not shipped unadapted for civic material.**
   When a pattern is being written for the `civic-democracy` niche, or when it will plausibly be
   applied to Muxin's `civic-tech` pillar, run it through
   `.claude/skills/atomize/references/civic-adaptation.md` table 1 and express the shape in its
   ADAPTED form, the way that table's right-hand column does it:
   - the hook slot becomes concrete pain or outcome, not abstract stakes
   - the shape carries an immediate personal payoff slot, and it is not optional
   - the closing slot is one specific low-friction action, completable in under 5 to 10 minutes
   - the language slot is everyday and local, never "democracy" talk
   - **The register default still stacks on top.** hook-patterns.md prefers the joyful-activism
     register for civic material unless the source is genuinely grief or anger toned. The rubric
     sets what the shape delivers, the default sets how it sounds. Note both on the pattern.
   - Record the unadapted viral shape you started from in the pattern's Mechanism line, so a
     reader can see where it came from. Then never ship that raw form for civic use.

4. **Write each pattern in its destination file's own record format.** Do not invent a third
   format. Both files already specify theirs, and both carry the same guardrails.
   - **A full-post pattern** uses the record block defined under "Record format" in
     `post-patterns.md`: Platform, Mechanism, Structure / arc, Emotional trigger, Immediate
     personal payoff, CTA style, Length and formatting, Shape, Real example, in that order.
     **Immediate personal payoff is required on every record, civic or not**: what the reader gets
     or avoids right now (time, money, power, protecting something they care about), and where the
     arc makes that payoff land. Read that section and its five
     numbered rules before writing one. Note rule 3 in particular: a pattern with fewer than three
     collected posts behind it is marked `(thin evidence)` on its name.
     - **A civic pattern's CTA style field has to clear table 2's bar, and that bar has TWO
       accepted forms.** One, a specific micro-action the reader can finish in under 5 to 10
       minutes. Two, belief- or value-aligned matching, kept neutral and record-based, built on an
       actual vote or an actual position on the record and never a partisan characterization. Both
       must point at something real and verified. Never "vote", "get involved", or "stay informed".
       Value-matching carries the harder rule: if the record cannot be verified it is not written
       at all, not written with a caveat and not labeled as needing verification. That is
       deliberate, not an oversight. A wrong claim about how someone voted is a factual assertion
       about a real person, not a soft guess. If the winners behind the pattern all
       closed vaguely, say that in the field rather than upgrading it on their behalf. That is a
       finding about the niche, not a defect in the record.
   - **A hook pattern** uses hook-patterns.md's table row: `| # | Name | Mechanism | Shape | Real
     example (citation only) |`, appended to the existing numbered set and continuing its
     numbering.
   - Either way: **Name** is short and memorable, the way "Relatable Enemy" or "Curiosity-Gap
     Teaser" are. **Mechanism** is one line on why it holds a reader. **Shape** is the skeleton
     with every blank bracketed and described by what fills it, never by a sample phrase, and
     every blank must be fillable from a source essay's own facts. If a blank could only be filled
     by inventing something, rewrite the shape until it cannot. **Real example** is a citation:
     creator, platform, and enough context to find the post, never the wording.

5. **Route each pattern to the right library so the two never fork:**
   - A pattern about **how a post OPENS** goes to
     `.claude/skills/atomize/references/hook-patterns.md`.
   - A pattern about **the whole post's structure** goes to
     `.claude/skills/atomize/references/post-patterns.md`, into that platform's own section. Every
     platform section there currently reads "Not yet mined"; replacing one of those placeholders is
     what a first synthesis run actually does.
   - When a pattern is genuinely both, put the full structure in post-patterns.md and reference the
     hook pattern by its number instead of duplicating it. One home per shape.
   - **Never carry a pattern across a platform heading without evidence from that platform.** That
     is post-patterns.md's own standing rule and it is the whole reason the file is split by
     platform.
   - **Never write to `civic-adaptation.md`, and never create a fourth library file.** It is
     Muxin's rubric, not a mining output. Every mined shape has a home in one of the other two.

6. **Propose, do not write.** Show Muxin the proposed additions in full, in chat, grouped by
   platform and by destination file, with the citation for each and the civic adaptation shown
   next to the raw shape it came from. Say plainly which are new, which overlap something already
   in hook-patterns.md, and which platforms you skipped for thin data.
   **She approves before anything is written to either file.** These files feed `/atomize`'s
   drafting directly, so an unreviewed addition changes what future posts say. That makes it a
   content-generation logic change under CLAUDE.md rule 7, which is exactly the thing that needs
   her eyes every time.

7. **On approval, write the edit**, keeping both files' existing structure, numbering, and
   verification-caveat sections intact. Add a short provenance line naming the corpus size and the
   date the synthesis ran, so a future reader knows what evidence sat behind these rows.

---

## Mode 4: `/patterns ideas [--platform X] [--niche Y]`

Goal: net-new post ideas, proposed. No content folder required, and none is created. This is the
mode for "what should I post next", and it is the correct destination for a bare topic that
`/patterns rewrite` refuses.

**Rule 2 governs this mode completely.** An idea card says what to write and points at material
that could fill it. It never writes the post.

### Steps

1. **Read the inputs.** The synthesized patterns in `post-patterns.md` and `hook-patterns.md`,
   `config/pillars.yaml` for Muxin's pillars, and `config/brand.yaml` for the brand frame. Honor
   `--platform` and `--niche` when given. **Run the cold-start check before you write a card.** If
   that platform's `post-patterns.md` section still reads "Not yet mined", or the corpus is empty,
   say so in the output ahead of the cards: these ideas came from the August hook library, not from
   mined patterns, and the fix is `/patterns collect`, then `analyze`, then `synthesize`. Then work
   from hook-patterns.md plus the channel's `spin_angles` entry in
   `config/platforms.yaml`, and lower the number of ideas you propose accordingly.

2. **Find what of hers could fill each shape.** This is the step that keeps the mode a proposal
   rather than a composition, so do it before you write any card. Look at her existing material:
   - past pieces in `content/` and their `source.md` files
   - the pillars in `config/pillars.yaml`
   - `data/community-log.md`, her append-only manual observation log. **Read it, never edit it.**
   - the latest strategy brief in `briefs/`, including its directives and open bets

3. **Write one card per idea**, aiming for a handful of strong ones rather than a long list. Each
   card carries all five of these:
   - **Pattern**: which winning pattern it applies, by name and number, and one line on why that
     pattern fits that platform, tied to the platform's mechanics.
   - **Her material**: which specific thing of Muxin's could fill it. Name the file, the pillar,
     the community-log observation, or the brief, precisely enough that she can go look. **An idea
     with nothing of hers behind it is marked `NEEDS HER INPUT` and says what is missing.** Do not
     invent the fill, and do not quietly drop a good shape just because nothing fills it yet.
     Naming the gap is the useful output.
   - **Platform and format**: where it goes and what form it takes (short text, thread, essay
     excerpt, quote card, short video).
   - **CTA**: for civic or social-issues material, a candidate micro-action from
     civic-adaptation.md table 2, with the thing it depends on named. For everything else, the
     `config/cta.yaml` default for that pillar. **A candidate micro-action that cannot be verified
     is labeled `UNVERIFIED` and falls back to the default rather than being asserted**
     (rule 4). Table 2's belief- or value-aligned matching is an available angle here too, and it
     only counts when it is neutral and record-based, built on an actual vote or an actual
     position on the record; with no verifiable record it is not proposed at all, because a wrong
     claim about how someone voted is a factual assertion about a real person, not a soft guess.
     `/patterns asap` is the deeper pass on this once a real source exists.
   - **Register**: for civic material, note the joyful-activism default explicitly, so whoever
     acts on the card knows the rubric and the register both apply.

4. **Write the cards to `data/patterns/ideas.md`**, appending a dated section per run rather than
   overwriting. It is gitignored with the rest of `data/patterns/`, so it is a working file, not a
   commitment.

5. **Stop.** No content folder, no cut, no derivative, no queue row. **This mode never emits a
   `/develop` card of any kind, and never writes `advice.json`.** Its output is prose in
   `data/patterns/ideas.md`, because an idea has no content folder and therefore no `source.md`
   whose lines an angle card could cite. If this mode is ever extended to emit angle cards, the
   non-empty `sourceLines` requirement in mode 5 step 6 applies here too, and there would be no way
   to satisfy it without a folder. Hand her the path and a short
   summary: how many ideas, which platforms, and how many are marked `NEEDS HER INPUT`. If she
   wants to act on one, the path is `/atomize` on the material it points at, or `/patterns series`
   if the idea is really an arc.

---

## Mode 5: `/patterns series <content-folder>`

Goal: take ONE thing Muxin already gave the system and propose a series arc from it. This is her
own civic-adaptation table 1 made real: "High volume + repurposing, one source to many short pieces
across formats" and "Series / ongoing arcs".

**Rule 2 governs this mode completely**, and here the mechanism matters: the proposal cards go into
the SAME files `/develop` writes, in the SAME schema, so the review GUI renders them with no code
change and accepting one deterministically builds a cut from Muxin's verbatim source lines.

### Steps

1. **Read `.claude/skills/develop/SKILL.md` first**, specifically its hard rules and its step 3
   schema. You are writing a round in its format, so its rules are yours for this mode: your ONLY
   writes are `develop/advice.json` and `develop/log.md`, you never call `addCut`, never touch
   `source.md`, `extracts.md`, or any `derivatives/`, and you never modify a prior round or a
   prior card's status.

2. **Read the source.** `<content-folder>/source.md`, in full, with line numbers, because the cards
   have to cite them. Read the existing `develop/advice.json` and `develop/log.md` if they exist,
   and follow `/develop`'s own rule for whether this is an initial round or a reply round.

3. **Judge whether a series is actually there.** A source with one idea and one example is one
   post, not five. If it will not carry an arc, say so and propose fewer pieces, or a single `note`
   card explaining what the source would need. Padding a source into a series is the same failure
   as padding a post.

4. **Propose 3 to 7 pieces**, after the cold-start check. If `post-patterns.md` carries no mined
   records for the platforms this arc targets, or the corpus is empty, say so plainly ahead of the
   cards: this arc was shaped from the August hook library, not from mined patterns, and the fix is
   `/patterns collect`, then `analyze`, then `synthesize`. Each piece is one card, and each card
   names:
   - its winning pattern, by name, and its hook shape
   - its angle: what this piece is about that the others are not
   - **which verbatim lines from `source.md` it would draw on**, as exact 1-indexed line numbers
     (a range is `"31-33"`). **This is a hard requirement, not a nicety.** `acceptAngle`
     (`src/review/develop.ts:183`) THROWS on an angle card with no source line refs, and
     `src/review/develop.ts:137` throws on an angle with fewer than one ref, so a piece proposed
     without them breaks the moment Muxin clicks accept. See step 6 for what to do when a piece
     genuinely has no verbatim line behind it.
   - its platform and format
   - its own micro-action CTA for civic material, or the `config/cta.yaml` default otherwise, with
     the same UNVERIFIED labeling rule as everywhere else. Table 2's belief- or value-aligned
     matching is an available angle for a civic piece, neutral and record-based off a real vote or
     a real position, and dropped rather than labeled when the record cannot be verified, because a
     wrong claim about how someone voted is a factual assertion about a real person
   - for civic material, a note that hook-patterns.md's joyful-activism register default applies
     alongside the rubric, so whoever accepts the card knows both are in play

5. **Propose the arc itself**, as its own card. Two things: what makes this a series rather than N
   unrelated posts (the through-line, the order, what each piece sets up for the next), and a
   recurring frame if one fits. Her rubric's examples of a recurring frame are "This week's 3
   ballot items you can actually check" and "local government in 60 seconds". **Adapt the frame to
   her material, never copy those lines**, which are illustrations of the shape exactly like every
   other example in these libraries.

6. **Map the cards onto `/develop`'s existing schema. Do not invent a new card kind.**
   - **Each series piece is a `kind: "angle"` card.** That is the kind that carries `lens` and
     `sourceLines`, and it is the kind the GUI can accept into a real cut. Give each a lens slug
     matching `^[a-z][a-z0-9-]*$` and never `extract`. Put the pattern, the hook shape, the
     platform, the format, and the CTA into the card's `summary` prose.
   - **Every angle card MUST carry a non-empty `sourceLines` array** pointing at real line numbers
     or ranges in THIS folder's `source.md`, in the same shape `/develop` uses: `[12, "31-33"]`.
     This is a constraint from the code, not a style preference. `src/review/develop.ts:137` throws
     "an angle needs at least one source line ref", and `src/review/develop.ts:183` throws "this
     angle carries no source line refs, nothing verbatim to build a cut from". An angle card
     without them breaks the moment Muxin clicks accept, which is a runtime failure in her hands,
     not a lint issue.
   - **Never invent or pad line refs to satisfy the requirement.** Padding a card with refs that do
     not really carry the piece is worse than not proposing the piece, because the GUI will happily
     build a cut out of the wrong lines.
   - **Two more things `acceptAngle` throws on, and a series of 3 to 7 cards hits both easily.**
     A lens must be UNIQUE: not just valid and not `extract`, but distinct from every other card in
     this batch AND from every cut already in the folder ("a <lens> cut already exists"). And the
     referenced lines must contain actual text, not blank lines ("the referenced source lines are
     empty"). Check both before you write the round, since one bad card in a batch of seven still
     breaks for Muxin on the click.
   - **When a proposed piece genuinely has no verbatim line behind it, emit it as
     `kind: "note"` describing the gap.** Never as an angle with an empty `sourceLines`, and never
     with invented line numbers. This is the same honesty-over-padding rule `/develop`'s hard rules
     already carry: a note saying "this piece would work but the source does not carry it yet, here
     is what it would need" is a useful card. A broken angle card is not.
   - **The arc is a `kind: "note"` card**, since it is context rather than something acceptable as
     a cut on its own. Say in its title that it describes the series.
   - **Never add keys to a card.** The schema is fixed and the GUI parses it. Everything extra this
     mode wants to say goes in `summary`. A card with an invented key is a card the GUI may not
     render.
   - Card ids are `r<round>-c<card>`, unique across the whole file. `status` is always `"open"`,
     `acceptedLens` and `decidedAt` always `null`.

7. **Append ONE round** to `develop/advice.json` (creating it with `{"version": 1, "rounds": []}`
   if absent) and a matching readable `## Round N` section to `develop/log.md`, exactly as
   `/develop` step 3 specifies.

8. **Stop, and say what happens next.** Acting on an accepted series piece uses the existing paths:
   the GUI's accept builds the cut from her verbatim lines, then
   `/atomize --continue <folder> --cut <lens>` formats it. **Automatic scaffolding of a whole
   accepted series is explicitly Phase 2 and does not exist yet.** Do not imply it does, and do not
   scaffold cuts yourself.

Line refs go stale if she edits `source.md` after your round, and the GUI refuses an accept whose
refs point past the file. Cite the lines that really carry each piece, not a whole-document range.

---

## Mode 6: `/patterns rewrite <content-folder | file>`

Goal: three versions of Muxin's OWN source material, each restructured into a strong pattern for a
target platform, for her to read and react to. Not a queued asset. Not a publishable derivative.

### Read this before drafting anything

This mode reorders, re-hooks, and re-frames material **already in her source**. That is the entire
license and there is nothing else in it.

- **It never composes a new claim, statistic, experience, result, or worldview line in her voice.**
  The pattern decides the ORDER and the EMPHASIS. The source decides the CONTENT. Every sentence in
  every version must be traceable to something she actually wrote or said.
- **A shape whose blank the source cannot fill honestly does not fit this piece.** Change the
  shape. Never fill the blank with an invention. If you are unsure whether a line crossed from
  reframing into inventing, it crossed. Cut it.
- **A bare topic with no source material is REFUSED.** If Muxin passes a subject rather than a file
  or a content folder, stop and say why in plain language: this mode restructures what she already
  wrote, and with nothing written there is nothing to restructure, so anything produced would be
  Claude composing claims in her voice, which CLAUDE.md rule 1 forbids. Then point her at the modes
  built for that case: **`/patterns ideas`** for a net-new post, or **`/patterns series`** once she
  has a source worth spreading across several. Do not produce "an example of what it might look
  like" as a consolation. That is the forbidden thing with a disclaimer on it.
- **`config/voice.yaml` governs the output completely.** A viral shape never overrides her voice.
  No em dashes. If a mined pattern's register clashes with how she actually talks, her voice wins
  and the pattern loses.

### Steps

1. **Load the source.** A content folder means its `source.md` (or a named cut's
   `cuts/<lens>/cut.md`). A file means that file. Read the whole thing before picking a pattern. If
   the source is too thin to restructure honestly, say so and stop, the same way `/atomize` does.

2. **Confirm the target platform.** Ask if it is not obvious from the argument. The pattern
   library is per platform and picking the wrong one produces a well-shaped post for the wrong
   audience.

3. **Pick three patterns for that platform** from `post-patterns.md` and `hook-patterns.md`,
   preferring the strongest by the evidence behind them. **Run the cold-start check first.** If
   that platform's `post-patterns.md` section still reads "Not yet mined", or the corpus is empty,
   say so in the output ahead of the three versions: these shapes came from the August hook
   library, not from mined patterns, and the fix is `/patterns collect`, then `analyze`, then
   `synthesize`. Then work from `hook-patterns.md` plus the channel's
   `spin_angles` entry in `config/platforms.yaml` instead. An empty section is never permission to
   invent a structure and call it proven. Pick three that are genuinely DIFFERENT from each other,
   so Muxin is choosing between real alternatives rather than three shades of one idea. For civic
   or social-issues material, use the ADAPTED form of each pattern (mode 3, step 3) and follow
   hook-patterns.md's joyful-activism register default unless the source itself is genuinely grief
   or anger toned.

4. **The CTA gate, for civic and social-issues source material.** Every one of the three versions
   has to clear this. It is not optional and it is not a scoring suggestion:
   - **Each version ends in one of the two accepted civic CTA forms.** One, a specific
     micro-action the reader can finish in under 5 to 10 minutes: check a registration status,
     look up one race, find a polling place, read one local measure in plain English. Two, belief-
     or value-aligned matching, kept neutral and record-based, built on an actual vote or an actual
     position on the record and never a partisan characterization. Value-matching is an additional
     accepted form, not a replacement, so a version may close either way. Table 2 of
     civic-adaptation.md is the reference for both.
   - **"Vote", "get involved", and "stay informed" are rejected.** So is anything else that names
     no specific thing to do. If a version ends on one of these, it is not finished.
   - **Local and specific beats national and abstract.** City council, school board, county, state
     legislative races, and ballot measures over pure national politics.
   - **The close must point at something real.** Name the link, form, tool, race, measure, or
     voting record it depends on, and whether you verified it. **If it cannot be verified, fall
     back to the `config/cta.yaml` default for that pillar** (civic-tech points at the voting tool)
     rather than inventing a link, form, deadline, race, measure, or voting record. Rule 4, no
     exceptions. Say on the version that you fell back and why.
   - **Value-matching carries the harder rule.** If the record cannot be verified, the
     value-matching close is not written at all, not written with a caveat and not labeled as
     needing verification. That is deliberate, not an oversight. A wrong claim about how someone
     voted is a factual assertion about a real person, not a soft guess.
   - **Every version states its immediate personal payoff**: what the reader gets or avoids right
     now (time, money, power, protecting something they care about). Not "why this matters" in the
     abstract. What changes for them today.
   - Non-civic material keeps the ordinary `config/cta.yaml` default for its pillar, and a CTA
     stays conditional there rather than mandatory, exactly as `/atomize` step 5 has it.
   - **Write the ask, not the URL.** The close is words in the body. The link itself gets
     placed per platform by `/publish` from `config/cta.yaml` `placement` if this version ever
     becomes a real derivative, so do not paste a bare url into the body.

5. **Draft each version.** For each one, state:
   - which pattern it applied, by name and number
   - why that pattern fits THIS platform, in one line tied to the platform's mechanics
   - the draft itself
   - which source lines each major beat came from, so the trace is checkable
   - its close (the micro-action, or the value-matching line) and its immediate payoff, called
     out explicitly, plus whether that close was verified or fell back

6. **Write the three versions to `<content-folder>/pattern-rewrites.md`.** Given a bare file
   instead of a folder, write `<file-stem>-pattern-rewrites.md` next to the input file.
   **Never into `derivatives/`.** A file in `derivatives/` is a pipeline asset that
   `npm run validate` and the review queue will treat as publishable, and these are not that. They
   are drafts for Muxin to react to.

7. **Stop. Nothing here publishes and nothing here queues.** Hand her the path, name the three
   patterns applied, and flag anything you wanted to say but could not because the source did not
   support it. That last part matters. A gap you refused to fill is useful information about the
   source, and naming it is how she decides whether to write more.

---

## Mode 7: `/patterns asap <content-folder>`

Goal: a ranked list of candidate closes a reader of THIS piece could act on right now, in either
accepted form: a micro-action they can complete, or a value-matching line off a real voting
record.
This is a brainstorm, not a pass or fail gate. The point is to give Muxin options for the ending,
each one honest about what it depends on.

**Rule 4 is the whole difficulty here.** A micro-action is only worth proposing if the thing it
points at is real. Ranking a fabricated link first is worse than proposing nothing.

### Steps

1. **Read the source** and, as in mode 5, read `.claude/skills/develop/SKILL.md` for the round
   schema and its hard rules, plus `civic-adaptation.md` table 2 for how these are phrased.

2. **Propose a ranked list of candidates**, strongest first. Rank on how specific the action is,
   how local it is, and how solid the thing it depends on is. A verified local action outranks an
   unverified national one every time. Each candidate carries four things:
   - **Action**: the specific thing to do, phrased the way table 2 phrases them. Check a
     registration status. Look up one race on the next ballot. Find a polling place. Read one local
     measure in plain English. Adapt the shape to this source's actual subject; do not paste those
     example lines.
   - **Payoff**: what the reader gets or avoids right now. Time, money, power, or protecting
     something they care about. Concrete, and in this piece's terms.
   - **Time**: roughly how long it takes. **It has to be under 5 to 10 minutes to qualify.** If it
     is longer, it is not a micro-action; either narrow it until it is, or drop it and say why.
   - **Verify**: **required on every candidate.** Name the specific real thing it depends on: the
     link, the form, the tool, the race, or the measure. Then state plainly whether that has
     actually been verified as real and current, or not. **A candidate with no Verify line does
     not get written.** An unverified candidate is surfaced as `NEEDS VERIFICATION`, never
     presented as fact, and never ranked above a verified one.

   **Value-aligned matching is one of the candidate actions, not a footnote.** Table 2's middle
   bullet is a real form of ASAP action: "based on what you said you care about, here's how these
   candidates actually voted on X." Propose one wherever the source material supports it, ranked
   and written the same way as any other candidate. What makes one valid is narrow. It is neutral
   and record-based, built on an actual vote or an actual position on the record, and it never
   characterizes a candidate, a party, or a side as good, bad, or extreme. That is a partisan
   read, not a record, and it fails the rubric's own "useful rather than partisan" test. Rule 4
   binds this harder than it binds an ordinary micro-action: **if the record cannot be verified,
   the candidate is not proposed at all**, not surfaced as `NEEDS VERIFICATION`. That is
   deliberate, not an oversight. A wrong claim about how someone voted is a factual assertion about
   a real person, not a soft guess.

3. **When nothing verifiable exists, say so and fall back.** The fallback is `config/cta.yaml`'s
   default for the piece's pillar (civic-tech points at the voting tool, most others at the source
   essay). Propose that as the honest ending and explain that the specific micro-actions all
   depend on things nobody has checked yet. Do not invent a link, form, deadline, race, or measure
   to fill the gap.

4. **Write the candidates as cards into the same round format** as mode 5: appended as ONE round to
   `<content-folder>/develop/advice.json` plus a readable section in `develop/log.md`, following
   `/develop` step 3 exactly.
   - **Each candidate is a `kind: "cta"` card, and this mode never emits an `angle` card.** That
     is `/develop`'s existing kind for exactly this judgment, so no new card type is needed. A
     micro-action is a proposed ENDING, not a piece to build a cut from, so it has nothing to cite
     and `sourceLines` does not apply. If this mode is ever extended to emit angle cards, mode 5
     step 6's non-empty `sourceLines` requirement applies to them in full.
   - The schema has no `verify` key and **you must not add one**. Put `Verify:` as an explicit
     labeled line inside the card's `summary`, along with the payoff and the time estimate. The
     requirement is that every card states it, not that it lives in its own field.
   - Same id, status, and prior-round rules as mode 5.

5. **Stop.** Report the ranking in one short paragraph, and say plainly how many candidates need
   verification before they can be used. That number is the useful headline, not the count of
   candidates.

---

## Mode 8: `/patterns remix <content-folder | topic> [--platform X]`

Goal: one post that adapts a proven common opener template to Muxin's own material, then says
something that is entirely hers.

**Read `references/remix-mode.md` before running this, every time.** It carries the full rule, the
two honest cautions, and the refuse conditions. The short version is here so nothing important is
only in one place.

### What this mode adapts

This mode applies a common template to the opener (the first thing said on a video, or the first
lines on a text platform) and, when present, the on-screen title. The exact captured text is shown
as evidence, but the generated hook is mad-lib close in structure and written in Muxin's own
words. A copied opener over a copied body is not a remix, and this mode does not produce one.

**The opener half always works. The title half depends on what was collected.** An entry's
`visual.onscreen_text` holds the on-screen title verbatim when a collector recorded one, and
`onscreen_title` is null when nobody did. Null means unknown, so on those, ask Muxin to read the
title off the original and paste it, per remix-mode.md's manual step, and never write a title the
system did not capture. On text platforms there is no title to miss at all. The same `visual` block
carries `body_is_complete`, which is what tells the bank, as a recorded fact rather than a guess,
that a post won on something outside the words that were collected.

### Steps

1. **Show her the ranked opener evidence for the target platform.** Build or refresh it first with
   `npm run patterns:openers -- [--platform X]`. Each row shows the captured opener,
   its on-screen title where one is known, the creator, the measured multiple and its metric, and
   the comparison scope and warnings on it. She picks one or accepts a common template
   recommendation. `verbatim_ok` may still be shown for quotation or licensed exceptions, but it
   is not required for ordinary template adaptation.

2. **Adapt the opener and the on-screen title into Muxin's own words.** Keep the familiar rhythm,
   promise, tension, or audience callout, but fill the slots with her actual substance. Do not
   preserve a distinctive creator-specific phrase sequence.

3. **Write the rest out of her material.** Her list, her picks, her examples, her take. Use
   `post-patterns.md` for that platform where a shape has been mined, run the cold-start disclosure
   if that section still reads "Not yet mined", and apply `config/voice.yaml` throughout.

4. **Civic material still clears the CTA gate.** Mode 6 step 4 applies here unchanged. The remix
   rule relaxes nothing about the close, and rule 4 binds it exactly as hard.

5. **Write to `<content-folder>/pattern-remixes.md`**, or `<file-stem>-pattern-remixes.md` next to
   a bare file. **Never into `derivatives/`.** Nothing here publishes or queues.

6. **State the provenance in the file itself**, not only in the chat: which source example informed
   the template, from which creator and handle, its URL, its multiple and scope, and what was
   adapted into Muxin's own words. This keeps the borrowing visible to her at review time.

### Refuse, in plain language, when

- **there is no opener bank yet.** Point her at `/patterns collect` then the openers build. Never
  write an opener that merely sounds proven as a substitute.
- **the chosen opener came from a `"caption"` entry or a truncated body.** The real opener is
  unknown, so there is not enough evidence to select the template honestly.
- **the chosen opener's post won on something outside its body** (a `substance-outside-body`,
  `short-body`, or `media-first-platform` warning). Say it plainly: this post won on an image we
  did not collect, so copying its 22-character caption would copy the wrong thing and miss the post.
  She can inspect the original and resolve the evidence; the system does not silently treat a
  fragment as the winning template.
- **the body she wants to remix is not her own material.** Route her to `/patterns ideas` when
  there is no source yet.

---

## What v1 does not do

Say these plainly rather than working around them:

- **No scrapers.** Collection is paste-driven, with raw `curl` retrieval of one post's own markup
  as the sanctioned alternative for the `body` field (mode 1's hard rule). Automated per-platform
  pull pipelines are a later phase, and TikTok needs one before it is collectable at all.
- **No automatic video transcripts.** Paste, the platform's caption track, or, when neither exists,
  the written caption recorded honestly as `"caption"`. Record which in `transcript_source`, and
  never a summary in any of the three cases.
- **No automatic series scaffolding.** `/patterns series` proposes; accepting a piece goes through
  the GUI's existing accept and `/atomize --continue`. Scaffolding a whole accepted arc in one step
  is Phase 2.
- **No GUI surface of its own.** `series` and `asap` ride `/develop`'s existing Develop tab
  rendering, which is why they match its schema exactly. There is no patterns tab.
- **No cost.** Every route in `references/platform-collection.md` is free, and this whole skill
  runs on Claude Code's subscription with no paid API call anywhere in it (CLAUDE.md rule 6). If a
  step seems to want a paid tool, it wants the free route in that guide instead.

## Note on changes to this skill

This skill decides what future posts say: its synthesized patterns feed `/atomize`'s drafting
directly, and its proposal cards feed the Develop tab. That makes it content-generation logic
under CLAUDE.md rule 7. A PR touching this skill, its references, or the pattern libraries it
writes holds for Muxin's review with an old-vs-new sample. No self-vet merge.
