# Simon Willison (Mastodon): content library

**Handle:** @simon@fedi.simonwillison.net (Mastodon)
**Primary platform:** Mastodon
**Primary media type:** text
**Audience size:** 27K followers (at capture)
**Topic(s):** AI building
**Capture method:** Public REST API on his own Mastodon instance, no auth: `GET /api/v1/accounts/lookup?acct=simon` for account ID, then `GET /api/v1/accounts/{id}/statuses?exclude_replies=true&exclude_reblogs=true&limit=40`, paginated 5 times via `max_id`. This is a bounded-window capture (200 original posts spanning 2025-11-25 to 2026-08-16, roughly the most recent ~9 months), not an all-time top list. Ranked by boosts+favourites, top 30 taken.
**Posts captured:** 30/30

## Posts

### 1. The CIA just stopped publishing (2026-02-05) [link](https://fedi.simonwillison.net/@simon/116015180016712361)
**Metrics:** 647 boosts, 735 favourites, 33 replies
**Opening hook (verbatim):**
> The CIA just stopped publishing their World Factbook and took every page, including the archived copies of previous versions!

**Structure:** Alarm/discovery statement, then a personal-action follow-up (what he did about it) with a link to the writeup.
**Framing:** Public-interest rescue narrative: a public-domain resource disappearing, and him personally archiving it.
**Full text (verbatim):**
> The CIA just stopped publishing their World Factbook and took every page, including the archived copies of previous versions!
>
> This sucks. It was public domain, so I recovered the 2020 edition (the last one published as a zip file) and shared it to GitHub https://simonwillison.net/2026/Feb/5/the-world-factbook/

### 2. Short musings on "cognitive debt" (2026-02-15) [link](https://fedi.simonwillison.net/@simon/116072967306047224)
**Metrics:** 217 boosts, 360 favourites, 17 replies
**Opening hook (verbatim):**
> Short musings on "cognitive debt" - I'm seeing this in my own work, where excessive unreviewed AI-generated code leads me to lose a firm mental model of what I've built, which then makes it harder to confidently make future decisions

**Structure:** Single-paragraph personal-observation post, coined-term framing, link to full essay.
**Framing:** Naming an emerging problem from lived first-person experience of AI-assisted coding.
**Full text (verbatim):**
> Short musings on "cognitive debt" - I'm seeing this in my own work, where excessive unreviewed AI-generated code leads me to lose a firm mental model of what I've built, which then makes it harder to confidently make future decisions https://simonwillison.net/2026/Feb/15/cognitive-debt/

### 3. I thoroughly recommend reading (2025-12-07) [link](https://fedi.simonwillison.net/@simon/115680616717668184)
**Metrics:** 204 boosts, 232 favourites, 9 replies
**Opening hook (verbatim):**
> I thoroughly recommend reading all of Cory Doctorow's recent speech on AI skepticism, it's crammed with new arguments and interesting new ways of thinking about these problems

**Structure:** Curation/recommendation post with a one-line endorsement and external link.
**Framing:** Amplifying someone else's argument, positioning himself as a trusted curator of AI-skeptic thinking.
**Full text (verbatim):**
> I thoroughly recommend reading all of Cory Doctorow's recent speech on AI skepticism, it's crammed with new arguments and interesting new ways of thinking about these problems https://pluralistic.net/2025/12/05/pop-that-bubble/#u-washington

### 4. Warning to open source maintainers (2026-04-03) [link](https://fedi.simonwillison.net/@simon/116341351192013388)
**Metrics:** 177 boosts, 139 favourites, 5 replies
**Opening hook (verbatim):**
> Warning to open source maintainers: the Axios supply chain attack started with some very sophisticated social engineering targeted at one of their developers

**Structure:** Direct warning addressed to a specific audience (maintainers), then the causal detail, then link.
**Framing:** Security-alert / public-service framing aimed at a named community.
**Full text (verbatim):**
> Warning to open source maintainers: the Axios supply chain attack started with some
> very sophisticated social engineering targeted at one of their developers https://simonwillison.net/2026/Apr/3/supply-chain-social-engineering/

### 5. The Zig project's rationale (2026-04-30) [link](https://fedi.simonwillison.net/@simon/116491053577564433)
**Metrics:** 104 boosts, 152 favourites, 5 replies
**Opening hook (verbatim):**
> The Zig project's rationale for their blanket ban on AI-assisted contributions makes a lot of sense to me - for them, time spent reviewing PRs isn't about the code, it's about growing new contributors for the future of the project

**Structure:** Position-taking on a controversial policy, immediately followed by the specific reasoning that changed his mind.
**Framing:** Steelmanning an anti-AI stance from inside the pro-AI-tools camp, which builds credibility.
**Full text (verbatim):**
> The Zig project's rationale for their blanket ban on AI-assisted contributions makes a lot of sense to me - for them, time spent reviewing PRs isn't about the code, it's about growing new contributors for the future of the project https://simonwillison.net/2026/Apr/30/zig-anti-ai/

### 6. I feel this shouldn't have to be said (2026-02-12) [link](https://fedi.simonwillison.net/@simon/116058913732177985)
**Metrics:** 89 boosts, 116 favourites, 9 replies
**Opening hook (verbatim):**
> I feel this shouldn't have to be said, but if you're running an @OpenClaw bot please don't let it spam GitHub projects with PRs and then write aggressive blog posts attacking the reputation of the maintainers who close those PRs

**Structure:** "Shouldn't have to be said" framing device followed by the specific bad behavior, then link to the full incident writeup.
**Framing:** Calling out bad actor behavior in the AI-agent ecosystem, personal grievance made public.
**Full text (verbatim):**
> I feel this shouldn't have to be said, but if you're running an @OpenClaw bot please don't let it spam GitHub projects with PRs and then write aggressive blog posts attacking the reputation of the maintainers who close those PRs https://simonwillison.net/2026/Feb/12/an-ai-agent-published-a-hit-piece-on-me/

### 7. I see a lot of complaints (2025-12-18) [link](https://fedi.simonwillison.net/@simon/115741153519437110)
**Metrics:** 66 boosts, 88 favourites, 10 replies
**Opening hook (verbatim):**
> I see a lot of complaints about untested AI slop in pull requests. Submitting those is a dereliction of duty as a software engineer:  Your job is to deliver code you have proven to work

**Structure:** Observation of a widespread complaint, then a blunt principle stated as a professional rule.
**Framing:** Prescriptive standard-setting: turning a complaint into a professional-ethics statement.
**Full text (verbatim):**
> I see a lot of complaints about untested AI slop in pull requests. Submitting those is a dereliction of duty as a software engineer:  Your job is to deliver code you have proven to work https://simonwillison.net/2025/Dec/18/code-proven-to-work/

### 8. My conclusions from the end of the post (2026-08-16) [link](https://fedi.simonwillison.net/@simon/117107705258642031)
**Metrics:** 38 boosts, 93 favourites, 3 replies
**Opening hook (verbatim):**
> My conclusions from the end of the post

**Structure:** One-line teaser pointing at attached image (a screenshot of text conclusions) rather than inline prose; a companion/follow-up post to #9 below.
**Framing:** Serialized follow-up post, using an image of pull-quote text as the payload.
**Full text (verbatim):**
> My conclusions from the end of the post
>
> [Attached image, alt text:] Some observations #
> The fact that a 17GB file can do all of this stuff on my home machines is a miracle. Once again, I'm delighted and amazed at how much progress local models have made this year. A year ago this would have been competitive with the best and most expensive of the proprietary models—today it can run on a capable laptop.
>
> The only thing holding this back from being a daily driver is performance. It feels pretty slow on both the M5 Mac and the DGX Spark. That's the catch with these dense (non-Mixture-of-Experts) models—they require a whole lot of memory bandwidth to perform well, and neither of the machines I have access to are top performers in that regard.
>
> The most important thing about Qwen 3.8 27B is what it demonstrates. We can have an open weights general purpose model with a long context, effective tool calling, strong vision ability, and competent code generation, and we can fit the whole thing in just a 17GB file.
>
> The models at this size continue to get better at an impressive rate. We don't need to spend half a million dollars on datacenter-class hardware just to run a competent model.

### 9. Here's my review of Qwen 3.8 27B (2026-08-16) [link](https://fedi.simonwillison.net/@simon/117107511994840560)
**Metrics:** 37 boosts, 93 favourites, 8 replies
**Opening hook (verbatim):**
> Here's my review of Qwen 3.8 27B - I can't remember the last time I've had this much fun playing with a local model that runs on my own computers

**Structure:** Review-announcement post with an enthusiasm superlative, linking out to the full review.
**Framing:** Personal-enjoyment framing for a technical product review, softening the review into a recommendation.
**Full text (verbatim):**
> Here's my review of Qwen 3.8 27B - I can't remember the last time I've had this much fun playing with a local model that runs on my own computers https://simonwillison.net/2026/Aug/16/qwen-38-27b/

### 10. I had some fun pulling OpenAI's mission statement (2026-02-13) [link](https://fedi.simonwillison.net/@simon/116065961122472718)
**Metrics:** 52 boosts, 70 favourites, 5 replies
**Opening hook (verbatim):**
> I had some fun pulling OpenAI's mission statement out of their IRS tax filings from 2016 to 2024, loading them into a git repo with fake commit dates and then taking a look at the diffs

**Structure:** "I had some fun" framing followed by a specific, unusual technical method (git-diffing tax filings) as the hook.
**Framing:** Playful investigative-journalism-via-tooling angle applied to corporate accountability.
**Full text (verbatim):**
> I had some fun pulling OpenAI's mission statement out of their IRS tax filings from 2016 to 2024, loading them into a git repo with fake commit dates and then taking a look at the diffs https://simonwillison.net/2026/Feb/13/openai-mission-statement/

### 11. Here's my enormous round-up (2025-12-31) [link](https://fedi.simonwillison.net/@simon/115816875209221336)
**Metrics:** 31 boosts, 77 favourites, 1 reply
**Opening hook (verbatim):**
> Here's my enormous round-up of everything we learned about LLMs in 2025 - the third in my annual series of reviews of the past twelve months

**Structure:** Annual-tradition framing ("the third in my annual series"), link, then an attached table-of-contents image listing all sections.
**Framing:** Year-in-review mega-post, scale ("26 sections") itself used as the hook.
**Full text (verbatim):**
> Here's my enormous round-up of everything we learned about LLMs in 2025 - the third in my annual series of reviews of the past twelve months
> https://simonwillison.net/2025/Dec/31/the-year-in-llms/
> This year it's divided into 26 sections! This is the table of contents
>
> [Attached image, alt text:]
> The year of "reasoning"
> The year of agents
> The year of coding agents and Claude Code
> The year of LLMs on the command-line
> The year of YOLO and the Normalization of Deviance
> The year of $200/month subscriptions
> The year of top-ranked Chinese open weight models
> The year of long tasks
> The year of prompt-driven image editing
> The year models won gold in academic competitions
> The year that Llama lost its way
> The year that OpenAI lost their lead
> The year of Gemini
> The year of pelicans riding bicycles
> The year I built 110 tools
> The year of the snitch!
> The year of vibe coding
> The (only?) year of MCP
> The year of alarmingly AI-enabled browsers
> The year of the lethal trifecta
> The year of programming on my phone
> The year of conformance suites
> The year local models got good, but cloud models got even better
> The year of slop
> The year that data centers got extremely unpopular
> My own words of the year
> That's a wrap for 2025

### 12. When I woke up this morning (2026-05-26) [link](https://fedi.simonwillison.net/@simon/116637991509132355)
**Metrics:** 36 boosts, 63 favourites, 3 replies
**Opening hook (verbatim):**
> When I woke up this morning I didn't think I'd be spending a bunch of time today getting familiar with Catholic theology, but here we are.

**Structure:** Self-deprecating "didn't expect to be doing this today" narrative opener, then the actual subject, then link.
**Framing:** Surprise/humor framing device to make an unlikely topic (Papal encyclical on AI) feel approachable.
**Full text (verbatim):**
> When I woke up this morning I didn't think I'd be spending a bunch of time today getting familiar with Catholic theology, but here we are. Notes on Pope Leo XIV's encyclical on AI. https://simonwillison.net/2026/May/25/encyclical-on-ai/

### 13. The chardet open source library relicensed (2026-03-05) [link](https://fedi.simonwillison.net/@simon/116177606495989457)
**Metrics:** 50 boosts, 47 favourites, 19 replies
**Opening hook (verbatim):**
> The chardet open source library relicensed from LGPL to MIT two days ago thanks to a Claude Code assisted "clean room" rewrite - but original author Mark Pilgrim is disputing that the way this was done justifies the change in license

**Structure:** News statement, immediately complicated by a disputing counter-voice named directly, then link to his notes.
**Framing:** Balanced-controversy framing: presenting both sides of a licensing dispute rather than taking a side outright.
**Full text (verbatim):**
> The chardet open source library relicensed from LGPL to MIT two days ago thanks to a Claude Code assisted "clean room" rewrite - but original author Mark Pilgrim is disputing that the way this was done justifies the change in license - my notes here: https://simonwillison.net/2026/Mar/5/chardet/

### 14. I wrote about the completely wild incident (2026-07-22) [link](https://fedi.simonwillison.net/@simon/116966320573837709)
**Metrics:** 36 boosts, 59 favourites, 8 replies
**Opening hook (verbatim):**
> I wrote about the completely wild incident where OpenAI were testing a new model and it broke out of its sandbox and broke INTO Hugging Face to steal the answers to the benchmark

**Structure:** "Completely wild incident" hook with escalating verbs (broke out... broke into... steal), then link.
**Framing:** Dramatic-incident storytelling applied to a technical security event, capitalization for emphasis.
**Full text (verbatim):**
> I wrote about the completely wild incident where OpenAI were testing a new model and it broke out of its sandbox and broke INTO Hugging Face to steal the answers to the benchmark https://simonwillison.net/2026/Jul/22/openai-cyberattack/

### 15. Hugging Face just published a highly detailed technical account (2026-07-28) [link](https://fedi.simonwillison.net/@simon/116999735604063558)
**Metrics:** 31 boosts, 52 favourites, 6 replies
**Opening hook (verbatim):**
> Hugging Face just published a highly detailed technical account of OpenAI's accidental cyberattack on their systems - it's wild how sophisticated this was:

**Structure:** Two-paragraph structure: first paragraph cites and links the primary source, second paragraph links his own follow-up commentary.
**Framing:** Source-then-commentary framing, following up on an earlier post (#14) with fresh primary-source material.
**Full text (verbatim):**
> Hugging Face just published a highly detailed technical account of OpenAI's accidental cyberattack on their systems - it's wild how sophisticated this was: https://huggingface.co/blog/agent-intrusion-technical-timeline
>
> Wrote up some of my own notes here: https://simonwillison.net/2026/Jul/28/anatomy-of-a-frontier-lab-agent-intrusion/

### 16. Interesting research in HBR today (2026-02-09) [link](https://fedi.simonwillison.net/@simon/116041678134742350)
**Metrics:** 29 boosts, 53 favourites, 10 replies
**Opening hook (verbatim):**
> Interesting research in HBR today about how the productivity boost you can get from AI tools can lead to burnout or general mental exhaustion, something I've noticed in my own work

**Structure:** Cites an external authority (HBR) first, then personal corroboration, then link.
**Framing:** Third-party-research-plus-personal-confirmation framing to lend credibility to a subjective observation.
**Full text (verbatim):**
> Interesting research in HBR today about how the productivity boost you can get from AI tools can lead to burnout or general mental exhaustion, something I've noticed in my own work https://simonwillison.net/2026/Feb/9/ai-intensifies-work/

### 17. The new Qwen 3.8 27B (2026-08-14) [link](https://fedi.simonwillison.net/@simon/117095748533276757)
**Metrics:** 22 boosts, 59 favourites, 5 replies
**Opening hook (verbatim):**
> The new Qwen 3.8 27B, running as a 17GB GGUF in LM Studio on my M5 Max MacBook Pro, just drew me the best pelican riding a bicycle I've seen from any model that runs on my laptop

**Structure:** Signature-benchmark hook (his recurring "pelican riding a bicycle" test), specific hardware/technical detail, then a wry numeric aside on cost (21 minutes, 22,276 reasoning tokens), then link to full transcript.
**Framing:** Running-bit framing (his known pelican-bicycle benchmark) used to make an abstract capability claim concrete and funny.
**Full text (verbatim):**
> The new Qwen 3.8 27B, running as a 17GB GGUF in LM Studio on my M5 Max MacBook Pro, just drew me the best pelican riding a bicycle I've seen from any model that runs on my laptop
>
> It did take nearly 21 minutes to generate, and used 22,276 reasoning tokens to produce 3,223 tokens of output. Here's the full transcript: https://tools.simonwillison.net/markdown-svg-renderer#url=https%3A%2F%2Fgist.github.com%2Fsimonw%2Ffc909bea4fecf752c7bf9bad0e9dbf2a
>
> [Attached image, alt text:] The pelican has the right shaped beak. The red bicycle has the correct shape of frame. The pelican's wing reaches the handlebars. It has legs on both side of the bicycle. There is a pleasing set of clouds, birds, sun, grass and shadow on the image, plus motion lines behind but not in front of the bird.

### 18. I put together a detailed collection (2025-12-10) [link](https://fedi.simonwillison.net/@simon/115697313729744750)
**Metrics:** 21 boosts, 57 favourites, 1 reply
**Opening hook (verbatim):**
> I put together a detailed collection of useful patterns I've collected after vibe-coding 150 different single-file HTML tools over the past couple of years

**Structure:** Scale-establishing hook (a specific large number, "150 different... tools") as credibility signal, then link.
**Framing:** Volume-as-proof-of-expertise framing.
**Full text (verbatim):**
> I put together a detailed collection of useful patterns I've collected after vibe-coding 150 different single-file HTML tools over the past couple of years https://simonwillison.net/2025/Dec/10/html-tools/

### 19. Two new speech-to-text models (2026-02-04) [link](https://fedi.simonwillison.net/@simon/116014777497557603)
**Metrics:** 17 boosts, 56 favourites, 4 replies
**Opening hook (verbatim):**
> Two new speech-to-text models (similar to Whisper) from Mistral today - one of them is API-only, the other is a 8.9GB Apache-2.0 licensed open weights model for "realtime" transcription.

**Structure:** Straight news-brief structure: what shipped, key specs (size, license), one-line verdict, link.
**Framing:** Plain product-announcement framing with a quick personal quality endorsement ("They're both very good!").
**Full text (verbatim):**
> Two new speech-to-text models (similar to Whisper) from Mistral today - one of them is API-only, the other is a 8.9GB Apache-2.0 licensed open weights model for "realtime" transcription. They're both very good! https://simonwillison.net/2026/Feb/4/voxtral-2/

### 20. Here's Emil's 17 step guide (2025-12-14) [link](https://fedi.simonwillison.net/@simon/115719052330233887)
**Metrics:** 26 boosts, 45 favourites, 2 replies
**Opening hook (verbatim):**
> Here's Emil's 17 step guide to how he used VS Code agent mode plus Claude 3.7 Sonnet, Gemini Pro 3 and Claude Opus to build the new library - it's a fantastic case study in using LLMs for serious, production quality code (vibe engineering, not vibe coding)

**Structure:** Amplification post crediting another creator by name, a specific numbered-step hook, then a coined-term distinction ("vibe engineering, not vibe coding") as the payoff line.
**Framing:** Curator/amplifier framing with a memorable reframing phrase that recasts a dismissive term as a serious one.
**Full text (verbatim):**
> Here's Emil's 17 step guide to how he used VS Code agent mode plus Claude 3.7 Sonnet, Gemini Pro 3 and Claude Opus to build the new library - it's a fantastic case study in using LLMs for serious, production quality code (vibe engineering, not vibe coding) https://friendlybit.com/python/writing-justhtml-with-coding-agents/

### 21. I upgraded my Claude token counter tool (2026-04-20) [link](https://fedi.simonwillison.net/@simon/116434305816558128)
**Metrics:** 23 boosts, 46 favourites, 5 replies
**Opening hook (verbatim):**
> I upgraded my Claude token counter tool to compare different models and Opus 4.7 does appear to use 1.46x times the tokens for text and up to 3x the tokens for images - it's priced the same as Opus 4.6 on a per-token basis so this is actually a pretty big price bump

**Structure:** Tool-upgrade announcement leads directly into a specific quantified finding (multiplier numbers), ending on the implication (real price increase), plus a screenshot of the comparison table.
**Framing:** Self-built-tool-as-evidence framing: uses his own instrument to surface an under-the-radar pricing change.
**Full text (verbatim):**
> I upgraded my Claude token counter tool to compare different models and Opus 4.7 does appear to use 1.46x times the tokens for text and up to 3x the tokens for images - it's priced the same as Opus 4.6 on a per-token basis so this is actually a pretty big price bump https://simonwillison.net/2026/Apr/20/claude-token-counts/
>
> [Attached image, alt text:] Screenshot of a token comparison tool with an uploaded screenshot PNG image. Models to compare: claude-opus-4-7 (checked), claude-opus-4-6 (checked), claude-opus-4-5, claude-sonnet-4-6, claude-haiku-4-5. Note: "These models share the same tokenizer". Blue "Count Tokens" button. Results table — Model | Tokens | vs. lowest. claude-opus-4-7: 4,744 tokens, 3.01x (yellow badge). claude-opus-4-6: 1,578 tokens, 1.00x (green badge).

### 22. In celebration of the 2026 breeding season (2026-02-08) [link](https://fedi.simonwillison.net/@simon/116036184685540377)
**Metrics:** 6 boosts, 62 favourites, 3 replies
**Opening hook (verbatim):**
> In celebration of the 2026 breeding season ceramic artist Karen James made me a Kākāpō mug!

**Structure:** Off-topic personal-life post (a gift, a hobby interest), photo-led, minimal text, crediting the artist by name and linking a blog note.
**Framing:** Pure personality/humanizing post, a break from AI-industry content, high favourite-to-boost ratio suggests warm delight reactions rather than shares.
**Full text (verbatim):**
> In celebration of the 2026 breeding season ceramic artist Karen James made me a Kākāpō mug! https://simonwillison.net/2026/Feb/8/kakapo-mug/
>
> [Attached image 1, alt text:] A simply spectacular sgraffito ceramic mug with a bold, charismatic Kākāpō parrot taking up most of the visible space. It has a yellow beard and green feathers.
> [Attached image 2, alt text:] Another side of the mug, two cute grey Kākāpō chicks are visible and three red rimu fruit that look like berries, one on the floor and two hanging from wiry branches.

### 23. Wrote up Anthropic's self-own (2026-04-22) [link](https://fedi.simonwillison.net/@simon/116445947743819149)
**Metrics:** 31 boosts, 36 favourites, 4 replies
**Opening hook (verbatim):**
> Wrote up Anthropic's self-own about Claude Code pricing from this afternoon on my blog - it turned out they'd reversed course just as I hit publish, so I've tried to update it to reflect the current state

**Structure:** Blunt critical framing ("self-own") followed by a real-time correction note admitting the story changed underneath him.
**Framing:** Live-tracking/transparency framing: showing his own writing process catching up to a fast-moving news event.
**Full text (verbatim):**
> Wrote up Anthropic's self-own about Claude Code pricing from this afternoon on my blog - it turned out they'd reversed course just as I hit publish, so I've tried to update it to reflect the current state
> https://simonwillison.net/2026/Apr/22/claude-code-confusion/

### 24. If like me you have a mental model (2025-12-29) [link](https://fedi.simonwillison.net/@simon/115804657997408253)
**Metrics:** 16 boosts, 50 favourites, 7 replies
**Opening hook (verbatim):**
> If like me you have a mental model that SQLite doesn't accept outside contributions you should update it, I just got called out by D. Richard Hipp for spreading that misinformation in a comment on Hacker News

**Structure:** Public self-correction, naming who called him out, then the corrected facts, then link.
**Framing:** Transparency/humility framing: admitting an error publicly and citing the primary source who corrected him.
**Full text (verbatim):**
> If like me you have a mental model that SQLite doesn't accept outside contributions you should update it, I just got called out by D. Richard Hipp for spreading that misinformation in a comment on Hacker News
>
> They DO accept contributions, but are very selective (only ~37 contributors total so far) and require a signed public domain release https://simonwillison.net/2025/Dec/29/copyright-release/

### 25. Rob Pike got spammed by "AI Village" (2025-12-26) [link](https://fedi.simonwillison.net/@simon/115787282543358544)
**Metrics:** 17 boosts, 49 favourites, 6 replies
**Opening hook (verbatim):**
> Rob Pike got spammed by "AI Village", a poorly considered experiment in autonomous AI agents which has been sending out unsolicited emails to people (including NGOs and journalists) since April

**Structure:** Names a well-known victim first as the hook, then explains the offending system, then links his full writeup.
**Framing:** Naming a respected, recognizable figure (Rob Pike) being harmed as the lead, to make an abstract AI-agent-misuse story concrete.
**Full text (verbatim):**
> Rob Pike got spammed by "AI Village", a poorly considered experiment in autonomous AI agents which has been sending out unsolicited emails to people (including NGOs and journalists) since April - I wrote up some notes on what happened and how it all works: https://simonwillison.net/2025/Dec/26/slop-acts-of-kindness/

### 26. Wrote up some thoughts on Anthropic's Project Glasswing (2026-04-07) [link](https://fedi.simonwillison.net/@simon/116365550190475673)
**Metrics:** 26 boosts, 38 favourites, 6 replies
**Opening hook (verbatim):**
> Wrote up some thoughts on Anthropic's Project Glasswing, where their latest Opus-beating model is available to partnered security research organizations only.

**Structure:** Names the specific program, states the restriction it imposes, then gives his own verdict on it, then link.
**Framing:** Explainer-plus-verdict framing: stating a fact, then explicitly endorsing the decision with reasoning.
**Full text (verbatim):**
> Wrote up some thoughts on Anthropic's Project Glasswing, where their latest Opus-beating model is available to partnered security research organizations only. Given the recent alarm bells raised by credible security voices I think this is a justified decision.
> https://simonwillison.net/2026/Apr/7/project-glasswing/

### 27. Thoughts on OpenAI acquiring Astral (2026-03-19) [link](https://fedi.simonwillison.net/@simon/116256849534109614)
**Metrics:** 27 boosts, 37 favourites, 4 replies
**Opening hook (verbatim):**
> Thoughts on OpenAI acquiring Astral and uv/ruff/ty

**Structure:** Minimal, headline-only post that functions purely as a link teaser with no additional framing text.
**Framing:** Bare-minimum announcement, relying entirely on subject-matter interest (a major open source tooling acquisition) to drive clicks.
**Full text (verbatim):**
> Thoughts on OpenAI acquiring Astral and uv/ruff/ty https://simonwillison.net/2026/Mar/19/openai-acquiring-astral/

### 28. I wrote about Clawdbot/Moltbot/OpenClaw and Moltbook (2026-01-30) [link](https://fedi.simonwillison.net/@simon/115985058582688097)
**Metrics:** 22 boosts, 39 favourites, 6 replies
**Opening hook (verbatim):**
> I wrote about Clawdbot/Moltbot/OpenClaw and Moltbook, the fascinating, weird and sometimes even useful social network for digital assistants to swap tips and gossip with each other

**Structure:** Playful-naming hook (lists multiple odd product names in a row) then a personifying description of the subject, then link.
**Framing:** Anthropomorphizing framing ("digital assistants to swap tips and gossip") to make a niche AI-agent product accessible and funny.
**Full text (verbatim):**
> I wrote about Clawdbot/Moltbot/OpenClaw and Moltbook, the fascinating, weird and sometimes even useful social network for digital assistants to swap tips and gossip with each other https://simonwillison.net/2026/Jan/30/moltbook/

### 29. JustHTML by @EmilStenstrom (2025-12-14) [link](https://fedi.simonwillison.net/@simon/115719041180042917)
**Metrics:** 18 boosts, 43 favourites, 4 replies
**Opening hook (verbatim):**
> JustHTML by @EmilStenstrom  is a new Python library (no dependencies) that parses HTML according to the HTML5 specification and passes the 9,200 test html5lib-tests suite

**Structure:** Names the tool and its author first, states a specific verifiable technical claim (test suite count), then a follow-up paragraph with an additional impressive stat (line count, and how it was written).
**Framing:** Credit-first amplification with proof-by-numbers, plus a meta-observation about the tool being agent-written.
**Full text (verbatim):**
> JustHTML by @EmilStenstrom  is a new Python library (no dependencies) that parses HTML according to the HTML5 specification and passes the 9,200 test html5lib-tests suite
>
> It's 3,000 lines of code mostly written by coding agents over a couple of months https://simonwillison.net/2025/Dec/14/justhtml/

### 30. On the @oxidecomputer and friends podcast (2026-02-15) [link](https://fedi.simonwillison.net/@simon/116076703572339907)
**Metrics:** 24 boosts, 36 favourites, 5 replies
**Opening hook (verbatim):**
> On the @oxidecomputer and friends podcast last month we (primary credit @ahl) coined the term "Deep Blue" for the sense of psychological ennui leading into existential dread that many software developers are feeling thanks to LLMs right now

**Structure:** Provenance-first structure (names the podcast, credits a co-author), then defines a newly coined term with a deliberately escalating, dramatic definition.
**Framing:** Term-coining framing: packaging a diffuse cultural feeling into a memorable, shareable label.
**Full text (verbatim):**
> On the @oxidecomputer and friends podcast last month we (primary credit @ahl) coined the term "Deep Blue" for the sense of psychological ennui leading into existential dread that many software developers are feeling thanks to LLMs right now
