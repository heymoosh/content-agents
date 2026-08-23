# Pattern mining: implementation plan

**Date:** 2026-08-22
**Status:** Phase 1 BUILT on branch `feat/pattern-mining`. Phases 2 and 3 are backlog cards, not
code.

Muxin first asked for this to be logged, not built ("log everythign I've shared ... and make a note
of it so I can follow up on it later"). Five minutes later, in a new session the same day, she said
"I want to build this." Both messages are 2026-08-22. So this doc describes a real build, not a
note to self.

**What works after Phase 1.** A collected corpus of other creators' winning posts, stored as JSONL
outside git. A deterministic collect step that validates staged entries, drops duplicates, and
appends them. Pure outlier scoring off recorded numbers (view-to-follower ratio and a post's
multiple over its own account's baseline). A committed config holding the niches, the seeded
reference accounts, the per-platform outlier thresholds, and the 20 to 50 corpus target. The
`/patterns` skill, with seven modes: collect, analyze, synthesize, rewrite, plus ideas, series and
asap. Muxin's civic adaptation rubric, committed and pointed at from the atomize skill's drafting
and CTA steps as instruction a drafting agent reads (§3). A re-hook
gate that is now config-driven: every platform gets the pass unless `config/platforms.yaml` opts it
out with `rehook: false`, so it is no longer X and LinkedIn only. Quote-card is the only channel
opted out, because its own style rule is verbatim quotable lines. A Notes-sourced folder still
never gets the pass, on any platform.

**What does NOT work yet.** Nothing is collected automatically. Every corpus entry is staged by
hand as a JSON file, and a video entry carries a transcript Muxin pastes in. There is no scraper,
no automatic transcript pull, and no GUI. Those are Phase 2 and Phase 3 (§10), filed as backlog
cards in `docs/content-agents-backlog.md`.

**What this extends, and does not replace.** `.claude/skills/atomize/references/hook-patterns.md`
shipped on 2026-08-18 with 23 cited hook patterns. This build adds full-post structure next to it
and keeps every pattern, guardrail, and niche default it already carries. See §4.

---

## 1. Muxin's request, verbatim

Reproduced word for word, typos and all. This is the primary artifact. The closing line
("For now, log everythign I've shared") is superseded by her next message the same day, "I want to
build this." Both are 2026-08-22.

> While we work on that, I want to add this and have it integrated into our process - analyze the top performing posts in our niche and extract their structure, log it for ourselves, use them/copy/template them. Simlar to things we already have, but now with the additional pipeline of finding what already works isntead of relying only on our own data and our own posts. This applies for every platform. And it must be bsaed on what works best on EACH platform and reworks the content to be more viral-friendly FOR THAT platform. Apply a strategy like this: Analyze these top-performing posts from [niche]. For each one extract:
> - Exact hook / first 1–3 sentences (or first 3 seconds of video)
> - Overall structure / storytelling arc
> - Emotional trigger or curiosity gap
> - CTA or call-to-conversation
> - Length and formatting patterns
> - Why this likely performed well for this audience
>
> Then summarize the 5–7 most common winning patterns across all of them.
> Finally, rewrite 3 versions of my topic using the strongest patterns while keeping my voice. We have a swipe file already in Obsidian - /Users/Muxin/Documents/Personal Obsidian/Branding/Content/Hooks Bank.md and the goal is adapt, don't copy: Adapt, don’t copy. Take the pattern (e.g., “contrarian opener + specific data + soft CTA”) and apply it to your own experiences, data, and voice. The full end ot end: 2. Free / low-cost workflow that works extremely well
> This is the method most people who actually grow (including Justin Welsh–style creators) use:
>
> Identify 5–10 strong accounts in your exact niche (or adjacent ones that get the kind of engagement you want).
> Sort their content by performance:
> LinkedIn → use Taplio/Shield or just scroll + note high-reaction posts.
> TikTok/IG → sort by “Most viewed” or use the tools above; look for view-to-follower ratio outliers.
> YouTube → sort by most popular or use outlier tools.
>
> Collect the winners (save links, screenshots, or full text/transcripts). Aim for 20–50 strong examples.
> Analyze systematically — feed them into Claude or ChatGPT with a structured prompt like:
>
> textAnalyze these top-performing posts from [niche]. For each one extract:
> - Exact hook / first 1–3 sentences (or first 3 seconds of video)
> - Overall structure / storytelling arc
> - Emotional trigger or curiosity gap
> - CTA or call-to-conversation
> - Length and formatting patterns
> - Why this likely performed well for this audience
>
> Then summarize the 5–7 most common winning patterns across all of them.
> Finally, rewrite 3 versions of my topic using the strongest patterns while keeping my voice.
>
> Build a personal swipe file / pattern library (Notion, Obsidian, or even a simple Google Doc). Group by hook type, structure, etc.
> Adapt, don’t copy. Take the pattern (e.g., “contrarian opener + specific data + soft CTA”) and apply it to your own experiences, data, and voice. and tools we can use, by platform: [Image #3] - I want to leverage free ones if possible, or reverse engineer what they're already doing. For now, log everythign I've shared - verbatim, including parsing out that image - and make a note of it so I can follow up on it later.

---

## 2. The tool table from her screenshot

Transcribed from the image she pasted, so no one needs the image again. Framing sentence, table,
and closing sentence are all hers:

> These are purpose-built for finding outliers (posts that massively outperform a creator's
> usual results) and analyzing why they worked:

| Tool | Best for | What it does well | Notes |
|---|---|---|---|
| ReverseClip | TikTok + Instagram Reels | Finds viral/outlier videos in your niche, hook analysis (first 3 seconds), pattern recognition, script generation | Strong competitor intelligence focus |
| Octupie | Instagram Reels | Tracks specific accounts, surfaces baseline outliers (e.g. a 40k-follower creator whose usual post gets 12k views but one hits 180k) | Excellent signal vs noise |
| ViralHunt / SuperTrends / ViralityAI / ViralMint | Multi-platform trends | Live radar of rising content across TikTok, IG, YouTube, Reddit, X, etc. Often includes scoring and filters by niche | Good for broad discovery |
| Taplio / Shield / AuthoredUp | LinkedIn | Sort any profile's posts by impressions or engagement, analyze top performers | Justin Welsh-style reverse engineering is easy here |
| vidIQ / TubeBuddy / 1of10 / Viewstats / OutlierKit | YouTube | Outlier videos, title/thumbnail patterns, niche mapping | Especially useful for Shorts + long-form |
| Twemex / TweetHunter / Typefully | X/Twitter | Top posts of any account, inspiration templates | Fast for text-based reverse engineering |

> Many of these now include AI breakdowns of hooks, structure, CTAs, and storytelling arcs, plus
> the ability to generate adapted versions in your voice.

**Her constraint:** prefer free tools, or reverse-engineer what these paid ones do rather than pay
for them. That constraint shapes the whole build. Phase 1 buys nothing.

**Cheapest starting point:** Typefully is already an integration in this repo
(`src/publish/typefully.ts`), so its "top posts of any account" surface costs nothing extra when
Phase 2 automates X collection. The two columns those paid tools really sell are outlier detection
and structure analysis. `src/patterns/outliers.ts` does the first from recorded numbers, and the
`/patterns` skill (`.claude/skills/patterns/`) does the second on
Muxin's Claude subscription, so neither needs a subscription to a third party.

---

## 3. Muxin's civic adaptation tactics (her words, 2026-08-22)

She sent these mid-build with "I want to make sure we don't lose THESE tactics" and "all of our
content needs to flow from these principles as well!" They are a rubric she has already decided,
not something the pipeline goes and discovers. Both tables are reproduced verbatim.

**Table 1: what to steal from viral niches**

| Viral niche pattern | How to adapt it for civic |
|---|---|
| Strong first 1-3 second hook | Open with the concrete pain or outcome: "Your ballot has 7 races you haven't researched," "This one local rule is quietly costing you money," "Here's the exact form that takes 90 seconds." |
| Immediate personal payoff | Frame every piece around *what the person gets or avoids right now* (time, money, power, protection of something they care about). |
| Ultra-clear "do this next" | End almost every piece with one specific, low-friction action that can be completed in under 5-10 minutes. |
| High volume + repurposing | One source (ballot data, city agenda, voting record) to many short pieces across formats. |
| Pattern interrupt + relatability | Use everyday language and specific local examples instead of abstract "democracy" talk. |
| Series / ongoing arcs | "This week's 3 ballot items you can actually check," recurring "local government in 60 seconds," etc. |

**Table 2: making civic action ASAP**

> This is the highest-leverage part. Most civic content fails because the call-to-action is vague
> ("vote," "get involved," "stay informed"). Replace that with:

- **Micro-actions that can be finished immediately**
  Check your registration status to an actual link + 60-second walkthrough.
  Look up one specific race on the next ballot to a direct tool or simple checklist.
  Find your polling place / early voting location to a map + hours.
  Read the actual text of one local measure in plain English.

- **Belief- or value-aligned matching** (this is already close to what you've built)
  "Based on what you said you care about, here's how these candidates actually voted on X."
  Keep it neutral and record-based so it feels useful rather than partisan.

- **Local + specific beats national + abstract**
  City council, school board, county, state legislative races, and ballot measures usually convert
  better than pure national politics because the stakes feel closer and the information gap is
  larger.

### Where this lives, and what reads it

- **`.claude/skills/atomize/references/civic-adaptation.md`** is the committed rubric file, created
  by this build. Unlike the corpus, this is Muxin's own decided rubric, so it belongs in git and
  `/patterns` never overwrites it.
- **`.claude/skills/atomize/SKILL.md`** points at it at two decision points, step 4 for drafting
  and step 4.5 as a constraint on the existing `cta` / `cta_label` mechanics. That matters: it is
  the difference between a rubric a drafting agent is told to read while atomizing and one that is
  merely filed somewhere. It reaches all atomize drafting, not just the new pipeline, and it
  reaches it as instruction rather than as a check.
- **`/patterns synthesize`** adapts a mined viral shape through table 1 before shipping it for
  civic material.
- **`/patterns rewrite`** carries the table 2 CTA gate in its own instructions: a specific
  micro-action that can be finished in under 5 to 10 minutes, never "vote" or "get involved".
- **`/patterns analyze`** now also extracts the immediate personal payoff and whether the CTA was a
  completable micro-action, so the corpus can test her rubric against real numbers instead of
  taking it on faith.

**None of this is enforced by code.** Every line above is skill prose that a drafting agent reads
while it drafts. No TypeScript loads the rubric or validates anything against it, and
`npm run validate` does not fail a draft for a missing micro-action CTA or a missing personal
payoff. A code-level gate does not exist today and would be a separate piece of work.

### How it fits with what already exists

These stack, they do not compete. `hook-patterns.md`'s joyful-activism default (patterns 16 to 23)
sets the REGISTER for civic material, meaning how it sounds. This rubric sets WHAT the piece has to
deliver: an immediate personal payoff and a finishable action. A drafting agent applies both. The
repo's existing CTA default is sharpened the same way, not replaced: civic material still routes to
the voting tool, but a civic CTA is now expected to be a specific micro-action rather than a vague
"get involved".

Together with the other two reference files this is one system, not three libraries.
`hook-patterns.md` holds 23 cited hook patterns, `post-patterns.md` holds full-post structure and
ships empty until `/patterns synthesize` runs (with a documented fallback to `hook-patterns.md`
until then), and `civic-adaptation.md` holds this rubric.

---

## 4. What already exists (extend it, do not rebuild)

| Thing | Where | What it gives this build |
|---|---|---|
| Hook pattern library | `.claude/skills/atomize/references/hook-patterns.md` | 23 hook patterns from real named creators, each with a mechanism, a fill-in-the-blanks Shape row, and a cited example. Carries the shapes-not-lines guardrail already: "These are proven sentence SHAPES, not text to copy." Also carries the niche default Muxin picked on 2026-08-18, joyful-activism register over the outrage register for civic material. |
| The drafting hook-in | `appliesRehook(platform, sourceKind)` in `src/atomize/spin.ts:32` | The single gate that decides when a re-hook pass runs. Before this build it was X and LinkedIn only, and never on a Substack Note repost. |
| Browsing copy of the swipe file | `/Users/Muxin/Documents/Personal Obsidian/Branding/Content/Hooks Bank.md` | Muxin's condensed reading copy with a "New hooks (add below as I find them)" section. **This build leaves it untouched on purpose.** The request is a pipeline, not a hook, so nothing here belongs in that file. The path is recorded so the link is not lost. |
| Discovery agent | `/scout` (`.claude/skills/scout/SKILL.md`) | Already finds `content-example` candidates, real-world examples worth writing about. The obvious feeder for reference accounts later. |
| A real Chrome session | `src/pull/**` | Already drives a logged-in Chrome for analytics pulls. The obvious engine for Phase 2 collection. Unused in Phase 1. |
| Per-platform knobs | `config/platforms.yaml` | Where platform settings live by convention, so pattern-mining thresholds follow the same habit in their own file. |

---

## 5. Muxin's four locked decisions (2026-08-22)

Recorded in this batch's build brief and not reopened during the build:

1. > Platforms: ALL of them, including TikTok / Reels / YouTube. Video matters most to her because
   > it is likelier to go viral. Video means transcripts.
2. > Corpus lives in `data/patterns/`, gitignored. Other creators' full text never enters git.
   > Only the distilled patterns get committed.
3. > Reference accounts seed from the creators already cited in hook-patterns.md, as an editable
   > config list she can change.
4. > Build it in phases. Not everything in one pass.

---

## 6. What Phase 1 builds, gap by gap

The six gaps this build closes, and the file that closes each one:

| Gap | Closed by |
|---|---|
| Full-post structure, not just hooks | `.claude/skills/atomize/references/post-patterns.md`, a full-post companion to the hook library, written and refreshed by `/patterns synthesize` (it ships empty and falls back to `hook-patterns.md` until then) |
| Every platform, not just two | `config/pattern-mining.yaml` (per-platform thresholds), the config-driven `appliesRehook` gate in `src/atomize/spin.ts`, and the `rehook` keys in `config/platforms.yaml` |
| A repeatable pass, not a one-off | `.claude/skills/patterns/` plus `npm run patterns:collect` (`src/patterns/collect.ts`) |
| The raw corpus saved | `src/patterns/corpus.ts` over `data/patterns/corpus.jsonl`, gitignored |
| Outlier detection by view-to-follower ratio | `src/patterns/outliers.ts` |
| The rewrite-my-topic-3-ways step | `/patterns rewrite`, which rewrites Muxin's own source material and refuses to run without it |

Added mid-build on 2026-08-22, past the original six gaps, after Muxin asked whether this would
actually do what she needs (§7):

| Added | Closed by |
|---|---|
| Ideas for the next post | `/patterns ideas`, output `data/patterns/ideas.md` |
| One thing she gave the system, turned into a series | `/patterns series`, output proposal cards in that content folder's `develop/advice.json` |
| ASAP micro-actions she can put in the post | `/patterns asap`, ranked candidates each carrying a required `Verify:` line |
| Her civic adaptation rubric, kept and read at drafting time | `.claude/skills/atomize/references/civic-adaptation.md`, pointed at from `.claude/skills/atomize/SKILL.md` steps 4 and 4.5 as instruction, not as a code check |

Supporting pieces: `src/patterns/types.ts` holds the record shape,
`.claude/skills/patterns/references/platform-collection.md` tells her how to stage entries
per platform, and `.gitignore` gains a `data/patterns/**` rule with `.gitkeep` escapes for the
folder itself and for the staging inbox. `src/patterns/` ships with 33 tests, all passing.

---

## 7. Does this do what Muxin actually asked for?

She asked that question directly mid-build and listed five capabilities she wants:

1. Ideas on the next post
2. Sourcing patterns and applying them
3. Taking something she gave the system and turning it into a series
4. Editorial suggestions that CREATE new posts, not just edit the existing one
5. Brainstorming ASAP benefits that can be done right now, as part of the post

**The honest scorecard before this change:** only #2 was fully covered. #4 was partly covered by
the rewrite mode, which restructures a piece that already exists rather than creating a new one.
#1, #3 and #5 were missing outright. Three modes were added to close that gap.

| What she asked for | Mode that delivers it | What it does | What it does not do |
|---|---|---|---|
| 1. Ideas on the next post | `/patterns ideas` | Proposes net-new post ideas from the synthesized winning patterns, and each idea points at which of Muxin's OWN existing material could fill it. Output: `data/patterns/ideas.md` | Does not write the post. An idea with no material of hers behind it is marked `NEEDS HER INPUT` and says what is missing, rather than being filled in with invented content |
| 2. Sourcing patterns and applying them | `/patterns collect`, `analyze`, `synthesize`, `rewrite` | The original pipeline: collect real winners, flag outliers, extract structure, synthesize the 5 to 7 patterns that repeat per platform, then rewrite her own material into the strongest of them | Does not collect automatically yet (Phase 2) |
| 3. Turning something she gave the system into a series | `/patterns series` | Takes one thing she already gave the system and proposes a 3 to 7 piece arc across formats and platforms. This is her civic table 1 rows "High volume + repurposing" and "Series / ongoing arcs" made real. Output: proposal cards in that content folder's `develop/advice.json`, with the run logged to `develop/log.md` | Does not cut the pieces. v1 proposes the arc; she accepts pieces through the existing paths. Automatic scaffolding is Phase 2 |
| 4. Editorial suggestions that CREATE new posts | `/patterns ideas` and `/patterns series` | Both produce new pieces rather than edits to an existing one. `rewrite` stays what it always was, a restructure of the piece in front of it | Neither drafts body copy |
| 5. ASAP benefits that can be done right now, as part of the post | `/patterns asap` | Brainstorms ranked candidate micro-actions for a piece, each carrying a required `Verify:` line in its card summary, against the table 2 bar in §3 | Does not verify the link, form or deadline itself. The `Verify:` line is a to-do for a human, and the skill's own rule is that an unverified action never ships |

**Reuse decision worth stating.** `series` and `asap` write into `/develop`'s existing
`advice.json` card schema rather than inventing a parallel surface. The review GUI already renders
those cards, so nothing in `src/review/page.ts` changes. That is what keeps this whole build clear
of the in-flight Content Studio batch.

---

## 8. Corpus record schema

One collected post per line, JSONL, at `data/patterns/corpus.jsonl`. Never committed.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, `<platform>-<handle>-<short-hash-of-url>` |
| `platform` | string | A `config/platforms.yaml` key, plus tiktok, youtube, instagram |
| `handle` | string | For example `@justinwelsh` |
| `creator` | string | Display name |
| `niche` | string | One of the niches in `config/pattern-mining.yaml` |
| `url` | string | The post link. Also the dedupe key |
| `posted_at` | ISO date or null | When they posted it |
| `collected_at` | ISO date | When it was staged |
| `kind` | `"text"` or `"video"` | Video entries carry a transcript |
| `body` | string | Full post text, or the transcript for a video |
| `transcript_source` | `"manual"`, `"captions"`, or null | Null for text entries |
| `metrics` | object | `{ views, likes, comments, shares, followers }`, any of which may be null |
| `notes` | string | Free text, optional |

## 9. Outlier scoring rules

`src/patterns/outliers.ts` is pure functions with no I/O. It works only off numbers already
recorded on an entry, and never fetches anything.

- **`viewFollowerRatio(entry)`** returns views divided by followers, or null when either number is
  missing.
- **`baselineMultiple(entry, accountEntries)`** returns views divided by the median views of that
  same account's other entries. It returns null when there are fewer than 3 other entries with
  views, because a median off one or two posts is not a baseline.
- **`classifyOutlier(entry, accountEntries, thresholds)`** returns
  `{ isOutlier, ratio, multiple, reason }`. An entry counts as an outlier when EITHER the ratio
  clears its platform threshold OR the baseline multiple clears its threshold. `reason` records
  which of the two fired, so a later reader can tell "reached far past its follower count" from
  "beat its own author's usual numbers."

Thresholds live in `config/pattern-mining.yaml`, per platform. Video platforms get a higher ratio
bar than text platforms, because video reach is not capped by follower count the way a text feed
mostly is. Every number in that file is a starting guess with a comment saying so. They get tuned
once real data lands (§11).

The config also holds the niches from `hook-patterns.md` (building-solopreneur, inner-journey,
civic-democracy), the seeded account list, and Muxin's stated corpus target of 20 to 50 entries.
The account list is hers to edit freely.

---

## 10. Phase 2 and Phase 3, and why each waits

**Phase 2: automated collection, video transcripts, and series scaffolding.** Reuse `src/pull`'s
Chrome session for per-platform collection, and Typefully for X. Pull video transcripts
automatically instead of pasting them. Scaffold an accepted series into real cuts: v1 only proposes
the arc, and Muxin accepts pieces one at a time through the existing paths.

Why it waits: this is the part that reads other people's posts at scale, and that is a product
direction call and possibly a legal one. Terms of service differ per platform, and transcript
sourcing differs again. Phase 1 works fine on hand-staged entries, so nothing is blocked by
waiting. Muxin decides this one before anyone builds it.

**Phase 3: a pattern-library GUI surface in the review page.** A room where Muxin can browse the
corpus, see which entries cleared the outlier bar, and read the synthesized patterns.

Why it waits: it needs `src/review/page.ts`, which the in-flight Content Studio batch owns. Two
sessions editing that file would collide. Everything upstream of the GUI is clear right now, which
is why Phase 1 could ship in parallel with that batch.

---

## 11. Open questions

Recorded, not answered.

1. **Which accounts make the reference set.** Phase 1 seeds from the creators already cited in
   `hook-patterns.md`. Muxin's own workflow says 5 to 10 strong accounts per niche. Who fills the
   gap between the seeded list and that target, and on what basis, is undecided.
2. **How outlier thresholds get tuned.** Today's numbers are guesses. Once 20 to 50 real entries
   land, the thresholds need a real pass. Open: what counts as evidence that a threshold is wrong,
   and whether tuning is a manual edit or a computed suggestion.
3. **Whether video transcripts can be pulled legally and cheaply, per platform.** The rules and the
   cost are not the same for YouTube, TikTok, and Reels. This gates Phase 2.
4. **How a per-platform pattern set interacts with `config/voice.yaml`.** A winning shape must
   never override Muxin's voice. What happens when a proven structure for a platform pushes toward
   something `voice.yaml` bans is not written down anywhere yet.

---

## 12. The rule-1 boundary

CLAUDE.md rule 1 is extraction-first: Muxin is the author, and derivatives quote and trim her own
lines. Mining other people's posts sounds like it cuts against that. It does not, and the line is
worth stating plainly because this build sits right next to it.

**What gets mined is structure.** The output of the analysis step is a shape, written as a template
with blanks, exactly the way `hook-patterns.md` writes its Shape row. "Contrarian opener, specific
data, soft CTA" is a shape. Nobody owns it. A real example is stored as a citation that proves the
shape works in the wild, never as a phrase bank to draw lines from.

**What never gets copied is words.** A collected creator's actual sentences stay in the corpus,
outside git, and are never handed to a drafting step as text to reuse or closely paraphrase. These
are named people with audiences who know their lines. A near-match reads as plagiarism, not
inspiration.

**The rewrite step rewrites Muxin's own material.** "Rewrite 3 versions of my topic" means taking
source material she already wrote and reordering it into a proven shape. It never composes a new
claim, statistic, or worldview line in her voice. A rewrite request with no source material is
refused rather than invented around.

**"Steal from viral niches" means the shape, and only the shape.** Muxin's civic table 1 (§3) uses
the word "steal" and it means the same thing `hook-patterns.md` already means: the structure, never
the sentences. Her example lines in that table illustrate a shape. They are not copy to paste into
a post.

**A micro-action CTA has to point at something real.** This is where the civic rubric raises the
sharpest version of rule 1. Inventing a link, a form, a deadline, a race, or a ballot measure to
make a CTA land would be invented proof. Rule 1 forbids that even inside a composition exception,
which is why `/patterns asap` requires a `Verify:` line on every candidate and rules out shipping
an unverified action. That requirement lives in the skill's instructions, not in a code check.

**The system proposes the post. It does not write the body.** Idea cards, series arcs, and
candidate micro-actions are all proposals. Body copy still comes from Muxin's own verbatim source
lines, through the existing accept-angle and `/atomize --continue` paths. Writing net-new body copy
in her voice would need a scoped rule-1 exception of the kind Build 3 (Venture) carries. This build
deliberately does not take one.

So the boundary is: shapes in, words out. A pattern may decide HOW a specific detail she already
wrote gets led with. It may never be the reason a new fact appears.
