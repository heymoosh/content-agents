# Keeping writing from sounding AI-generated: what practitioners actually do

*Research note, 2026-07-14. Scope: non-fiction (personal essays + LinkedIn/X/Substack posts), drafted speech-to-text (Wispr) and lightly edited. Question underneath: how to edit a raw transcript into clean prose without it drifting into AI register, and how to keep AI-assisted derivative copy from reading as AI.*

## Executive summary

- **The tells are specific and now well-documented.** The strongest evidence is a real corpus study (Kobak et al., 15M PubMed abstracts) showing a post-ChatGPT spike in *style* words like "delve," "underscore," "crucial." The rest — em dashes, tricolons, "it's not X, it's Y," uniform sentence length, over-smooth transitions — is heavily and consistently reported by editors and Wikipedia's community, though more as pattern-recognition than controlled study.
- **Detectors don't read words; they read structure.** "Perplexity" (predictability) and "burstiness" (sentence-length variation) are what flag AI, which is why word-swapping "humanizers" fail. This is the single most useful frame: fix rhythm and specifics, not vocabulary.
- **Speaking-first genuinely helps, but mostly as a *source* of burstiness and concrete detail** — the very things AI lacks. It is widely reported by working writers, not proven in a study.
- **The consensus leans hard toward process over prompt.** Even brand-voice vendors concede prompts fight "billions of parameters pulling toward the default." The differentiator is human judgment applied in editing, not a better system prompt.
- **What fails: "write in my brand voice," "make it sound human," and humanizer tools.** All three change surface words while leaving the AI structure intact.

## 1. The linguistic markers that read as AI

Best-evidenced first. Kobak et al. analyzed 15M+ PubMed abstracts (2010–2024) and found an unprecedented post-2022 surge in *stylistic* words — "delve," "underscore," "crucial," "notably," "intricate" — not content words, estimating LLM influence in ≥10% of 2024 papers ([Kobak et al., arXiv 2406.07016](https://arxiv.org/pdf/2406.07016)). This is the one item here backed by large-scale measurement rather than editorial impression.

The remaining markers are consistently catalogued by editors, instructors, and Wikipedia's editor community — credible converging opinion, not controlled findings:

- **Diction:** "delve," "tapestry," "testament," "pivotal," "underscore," "vibrant," "meticulous," "robust," plus promotional "nestled," "boasts," "stands as" ([Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)).
- **Em dashes** as an all-purpose connector — the most-discussed punctuation tell, attributed to models lacking a learned sense of rhythm ([McGill OSS](https://www.mcgill.ca/oss/article/critical-thinking-student-contributors-technology/why-did-llms-steal-our-em-dashes)).
- **Tricolons / rule of three** — parallel triples "nearly always equal in length," one is fine, six is a tell ([Vollmer, *A Field Guide to AI Tells*](https://matthewvollmer.substack.com/p/i-asked-the-machine-to-tell-on-itself); [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)).
- **Negated antithesis:** "It's not just X — it's Y" ([Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [Vollmer](https://matthewvollmer.substack.com/p/i-asked-the-machine-to-tell-on-itself)).
- **Uniform sentence length**, **over-smooth pseudo-transitions** ("building on that," "with that in mind," "it's worth considering"), five-paragraph structure at any length, aphoristic pull-quote closings, and — most tellingly — **"the missing concrete particular":** no real names, dates, or sensory detail ([Vollmer](https://matthewvollmer.substack.com/p/i-asked-the-machine-to-tell-on-itself)).

Vollmer's field guide is worth trusting more than most listicles: he explicitly grounds it in Kobak's work and in editorial testimony (e.g. *Clarkesworld*'s Neil Clarke), not personal taste. His key claim — the signal is in the *clustering* of tells, no single one convicts — matches the corpus evidence.

## 2. Does speaking-first actually help?

Reported benefit, not measured: writers who dictate consistently say spoken drafts run "more conversational, with longer sentences and a more natural rhythm," and that dictation collapses the usual gap between how you write and how you talk ([Speechify](https://speechify.com/blog/why-all-professional-writers-should-be-using-voice-typing-and-dictation/); [Lateral Action](https://lateralaction.com/articles/speech-recognition-writing/)). Note these are dictation advocates, so discount for bias.

But it lines up with the mechanism in §1. AI reads as AI partly because of *low burstiness* — too-even sentence lengths ([LegitWrite](https://legitwrite.com/blogs/why-ai-humanizers-dont-work.html)). Speech is naturally bursty: a four-word reaction slams into a run-on. Speech also supplies the "concrete particular" AI can't invent — the specific aside, the real name, the thing that happened. So the speech-to-text-first approach helps not because "spoken syntax is magic," but because it hands you two things AI structurally lacks: irregular rhythm and lived specifics.

**Editing discipline that preserves the fingerprint** (rather than smoothing it away): edit *toward* the transcript's roughness, not away from it. Keep the short blunt sentence, the mid-thought turn, the odd word choice. The failure mode is "cleaning up" a transcript until it reads like the AI mean — the same flattening a model does. Cut filler and false starts; keep asymmetry.

## 3. Concrete, repeatable edit processes

The most-cited mechanical sequence is a **multi-pass edit**, one concern per pass ([Tools for Writing](https://toolsforwriting.com/blog/how-to-make-ai-writing-sound-human)):

1. **Structure** — read fast, decide keep/cut/reorder; don't touch sentences yet.
2. **Rhythm** — deliberately vary sentence length; break up any run of same-length sentences.
3. **Phrasing** — find-and-strip pass on stock transitions and buzzwords; replace with specific language.
4. **Voice** — add at least one detail per section *only you could know* (the single highest-leverage move — the concrete particular from §1).
5. **Read aloud** — anything that sounds stiff spoken gets rewritten. Read-aloud recurs across nearly every source ([Junia](https://www.junia.ai/blog/add-human-touch-to-ai-generated-content); [Surfer](https://surferseo.com/blog/make-ai-sound-human/)).

Targeted find-and-strip passes worth hard-coding into a checklist: em dashes (convert most to periods/commas/parentheses — matches this repo's `config/voice.yaml` rule), tricolons (cap at one), "it's not just X, it's Y," and the pseudo-transition list above. These map cleanly onto content-agents' existing voice rules and could be a literal lint pass on derivative copy.

## 4. Process vs. model

Practitioners land firmly on **process**. The sharpest concession comes from *inside* the brand-voice-prompting camp: your prompt "is fighting against billions of parameters pulling toward [a helpful, neutral] default... the pull toward generic is constant," and generic adjectives like "friendly" or "conversational" "mean almost nothing to an AI model" ([Atom Writer](https://www.atomwriter.com/blog/complete-guide-ai-brand-voice/)). The stated fix is not a better prompt but a *system*: a voice document plus structured human review of every output.

This validates the skepticism in the brief. De-AI-ing is primarily a human-process problem. A model/prompt can raise the floor of a first draft; only judgment applied in editing — specificity, rhythm, cutting the tells — removes the register. The distinctiveness lives in the thinking, which is the human's job.

## 5. What does not work

- **"Write in my brand voice."** Voice adjectives are near-meaningless to the model; it falls back to training-data clichés ("Great question!", "absolutely") ([Atom Writer](https://www.atomwriter.com/blog/complete-guide-ai-brand-voice/)).
- **"Make it sound human."** Produces the model's *idea* of human — more of the same register.
- **AI "humanizer" tools.** ~90% are paraphrasers; word-swapping doesn't move perplexity or burstiness, the structural signals detectors and readers actually pick up. In one practitioner test, 14 of 16 failed ([LegitWrite](https://legitwrite.com/blogs/why-ai-humanizers-dont-work.html); [Anangsha Alammyan, Medium](https://medium.com/freelancers-hub/i-tried-7-ai-humanizers-heres-the-best-tool-to-bypass-ai-detectors-628590da5ccf)). (Detector-gaming is a different, weaker goal than "reads human"; cited only because the failure mechanism — surface edits over structural ones — is the same one that traps manual editing.)
- **Adding random typos / erratic length by rule.** Named as a humanizer failure mode; imperfection has to come from real content, not injected noise ([Humanivio](https://humanivio.com/why-ai-humanizers-dont-work/)).

## Sources

- Kobak et al., *Delving into ChatGPT usage in academic writing through excess vocabulary* — https://arxiv.org/pdf/2406.07016 *(large-scale study; strongest evidence)*
- Wikipedia, *Signs of AI writing* — https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing *(community-catalogued, broadly corroborated)*
- Matthew Vollmer, *A Field Guide to AI Tells* — https://matthewvollmer.substack.com/p/i-asked-the-machine-to-tell-on-itself *(writing instructor; sourced to Kobak, Clarke, Vara)*
- McGill Office for Science and Society, *Why Did LLMs Steal Our Em-Dashes?* — https://www.mcgill.ca/oss/article/critical-thinking-student-contributors-technology/why-did-llms-steal-our-em-dashes
- LegitWrite, *Why AI Humanizers Don't Work* — https://legitwrite.com/blogs/why-ai-humanizers-dont-work.html *(clear on perplexity/burstiness; vendor-adjacent, discount accordingly)*
- Atom Writer, *Complete Guide to AI Brand Voice* — https://www.atomwriter.com/blog/complete-guide-ai-brand-voice/ *(brand-voice vendor conceding prompts' limits)*
- Tools for Writing, *How to Make AI Writing Sound Human* — https://toolsforwriting.com/blog/how-to-make-ai-writing-sound-human *(multi-pass edit sequence)*
- Junia, *10-Minute Editing Checklist* — https://www.junia.ai/blog/add-human-touch-to-ai-generated-content
- Speechify, *Why Professional Writers Should Use Dictation* — https://speechify.com/blog/why-all-professional-writers-should-be-using-voice-typing-and-dictation/ *(dictation advocate; biased)*
- Lateral Action, *Benefits of Voice Typing* — https://lateralaction.com/articles/speech-recognition-writing/
- Anangsha Alammyan, *I Re-Tested 30+ AI Humanizers* (Medium) — https://medium.com/freelancers-hub/i-tried-7-ai-humanizers-heres-the-best-tool-to-bypass-ai-detectors-628590da5ccf
