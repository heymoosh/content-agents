# Build 4 — Charles Lord Featherbottom (composed satire, walled off)

Charles is a fictional persona: a haughty consultant to oligarchs, secretly having a nervous
breakdown as belief in "inevitable power" erodes. `/charles` *composes* his posts, replies, and
essays from scratch. This is allowed **only because every post is reviewed and
approved by Muxin in `charles/review-queue.md` before it goes anywhere, and nothing
auto-publishes** — the same principle as the video-script exception (root `CLAUDE.md` rule 1),
extended to a whole persona. It must never bleed back into Builds 0/1: text/image derivatives
there stay extraction-first, and Muxin's own nonfiction voice stays exactly Muxin's.

## Rule 5 does not apply to Charles

`config/voice.yaml` (Muxin's nonfiction voice: no em dashes, no AI tells, no hedging) governs
Builds 0/1/3. Charles is the deliberate opposite of that voice — ALL CAPS bursts, multiple
exclamation marks, British affectation, panic leaking through forced reassurance. Building his
posts through the shared voice guard would mangle the bit. **He is governed instead by
`charles/config/persona.yaml`.** Do not run his drafts through `voice.yaml` checks — **except the
em-dash ban carries over**, same as `stories/AGENTS.md`'s "Muxin's house rule, fiction included."
Strip em dashes to periods, commas, colons, or parentheses in his drafts too, unless Muxin
explicitly says otherwise.

## Rule 1's real prohibition survives anyway

The exemption is from extraction-tracing, not from truthfulness. Charles is satire, not a hoax —
he is allowed to invent his own reactions, panics, and rhetorical flourishes, but the **"useful
leaks"** he accidentally lets slip (Montana I-194, CA Prop 4, End Citizens United, RepresentUs,
etc.) must stay factually accurate to real sources. A satire account that gets real facts wrong
kills the bit and misleads readers. `persona.yaml`'s leak bank carries a source URL per claim —
cite it, don't drift from it.

## What Charles is and isn't

- He does **not** help ordinary people, on purpose — every useful observation is an accidental
  slip he immediately tries to walk back or smother with denial. Don't "fix" this into him being
  earnest or helpful; the tension between the panic and the denial is the joke.
- He posts on Substack — as a guest author on Muxin's real Human Inference newsletter, or on his
  own account, depending which Muxin is using for him at the time. Either way it's not an
  account content-agents manages credentials for; see "Review and delivery" below.
- Three content types: standalone one-liners, long-form Substack essays, and replies to a real
  post/article Muxin feeds in (never auto-discovered). Memes are out of scope here on purpose —
  Muxin handles meme research and image generation herself elsewhere (Grok); this system's job is
  to hand her the persona brief to work from, not to draft memes itself (see "Persona brief"
  below).

## Review and delivery

Same governing rule as everywhere else in this repo (root `CLAUDE.md` rule 2): nothing publishes
without Muxin's approval in `charles/review-queue.md`. Delivery is **ready-to-paste only for
now** — `/charles` writes finished drafts to `charles/posts/<type>/`, Muxin approves the row, and
she pastes it to Substack herself (essay or Note, whichever account she's using for him — that's
her call at delivery time, not baked into the pipeline). No live-posting credentials are wired
for Charles; don't add any without asking first.

## Persona brief

`config/persona-brief.md` is Muxin's own original persona brief, verbatim — not the distilled
`persona.yaml` a drafting prompt reads, but the source doc itself, for her to copy out and hand to
another tool (e.g. Grok) that she's using to work memes and templates outside this system. The
Charles room's page has a one-click copy for it. Never rewrite or "improve" this file's wording —
it's hers.

## Files

- `config/persona.yaml` — voice mechanics, comic engine, the leak bank (with sources); what
  `/charles`'s own drafting prompts read
- `config/persona-brief.md` — Muxin's original brief, verbatim, for copying out to other tools
- `posts/one-liners/`, `posts/essays/`, `posts/replies/` — drafts
- `review-queue.md` — approve / revise / discard, same convention as the main pipeline's
