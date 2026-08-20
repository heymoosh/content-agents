# Spin: the always-on default (opt out with `/atomize --no-spin`)

Spin is the default for EVERY atomize run since 2026-07-02. No flag is needed. It reframes each
text derivative through a Muxin-approved, per-channel angle so the post fits its audience, while
staying traceable to what Muxin actually wrote. It started as the opt-in `--spin` experiment
(history and A/B protocol: `docs/spin-experiment.md`); Muxin approving a specific angle per
channel (2026-06-30) promoted it to the default. The only opt-out is `/atomize --no-spin <arg>`,
which produces strict verbatim extraction exactly like the old default.

**Where the angles live:** `config/platforms.yaml` `spin_angles`, keyed by platform. Each entry
carries the target `audience` and the approved `angle` statement. Currently: `x` (tech),
`linkedin` (business/career), `bluesky` (political), `substack` (society), `mastodon`
(decentralized-tech), and `threads` (casual/mainstream). Substack is the
source channel for ordinary essays (never an atomize output target for those), but IS a
conditional routing target for Substack Notes specifically — a Note (`source_kind: substack-note`)
gets reposted back to Substack via `route.ts`'s `applySubstackRepost` hook + `src/publish/
substack.ts` (see `config/routing.yaml` and `references/notes-mode.md` step 3). In practice a
Note repost skips the extra spin/rehook pass anyway (`spin.ts`'s `appliesRehook` — the whole note
is already the near-verbatim extract), so the `substack` angle above mostly documents the register,
not an active rewrite. The angles are internal generation config only. Never publish an angle
statement verbatim as post copy; it shapes the framing, the words still come from Muxin.
`src/atomize/spin.ts` (`resolveAngle`) is the code's view of the same mapping.

**LinkedIn and X updated 2026-07-10 (Muxin, per-channel positioning review).** LinkedIn's angle is
now case-first, not thesis-first: open on one real anonymized situation (never a category), name
the assumption in the subject's own words, show what it cost to have missed it, and put the
zoom-out-to-the-broader-pattern line last, as the closer — ending on a soft signal of availability
(what Muxin would look for in scoping this kind of work), not a hard sales ask. The old
essay-as-thesis register read as "interesting worldview," not "hire me for this"; this fixes that
without turning the post into a pitch. X's angle keeps the non-engineer-outsider voice (Muxin does
NOT want X reading as insider/tech-circle content) but now requires real technical specifics — the
actual tool or mechanism and where it actually breaks — instead of a surface-level "AI is like X."
This prose intent was rewritten into an explicit beat template later the same day — see "Beat-
template rewrite" below for the current spec; the YAML in `config/platforms.yaml` reflects the
beat template, not this paragraph.

**What changes vs. a verbatim run:** run steps 1–8 (in SKILL.md) exactly as usual, with three differences.

1. **You may reframe and flavor, through the channel's approved angle, within hard guardrails.**
   For a spun derivative you MAY re-angle the framing, change the hook, reorder, and adapt the
   register to the platform's audience, steering by that platform's `spin_angles` entry. You MAY
   NOT introduce a claim, argument, statistic, metaphor, or worldview Muxin did not express in
   the source. Every spun post must still be traceable to something Muxin actually said or
   believes: reframed, not invented. When unsure whether a line crosses from flavor into
   invention, it has crossed; cut it.
2. **Mark it.** Add `spin: true` AND `angle: <platform-key>` to the derivative's frontmatter.
   The `angle` value must equal the derivative's own `platform` and name a configured
   `spin_angles` entry; `npm run validate` fails a spun derivative whose angle is missing or
   mismatched (e.g. a LinkedIn angle stamped on an X post). `source_lines` becomes best-effort:
   point at the lines/ideas you drew from (validation no longer hard-requires it for
   `spin: true`, but include it whenever you can; it keeps the trace honest).
3. **Everything else holds.** `config/voice.yaml` applies in full (no em dashes, no AI tells).
   Scoring, CTA stamping (`config/cta.yaml`; spin does not change CTA), routing, and the
   `review-queue.md` approval gate are unchanged. Nothing publishes without Muxin's `approve`.

**Which derivatives get spun:** every text derivative whose platform has a `spin_angles` entry,
so X, LinkedIn, Bluesky, Mastodon, and Threads today — INCLUDING a quote card's per-platform context captions
(`quote-card-N-<target>.md`, whose `platform` is the target channel), since each is a real text
post for that channel. What stays verbatim: the card's QUOTE itself (the `quote-card-N.md`
definition that renders onto the image — a verbatim quotable by definition, `platform: quote-card`,
no angle), community variants, and anything else `resolveAngle` returns nothing for. A `--no-spin`
run spins nothing: all derivatives (captions included) are verbatim, `source_lines` hard-required,
no `spin`/`angle` keys.

**The invent-vs-flavor line, made concrete.** Say `source.md` line 14 reads:

> Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual.

- **Verbatim (`--no-spin`, X):** "Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual." → `source_lines: [14]`
- **Allowed spin (LinkedIn, reframed as a lesson, new hook, same claim):** "The most common AI mistake I keep seeing: teams automate the judgment and keep doing the typing by hand. That's the wrong layer. Flip it." → `spin: true`, `angle: linkedin`, `source_lines: [14]`. The hook and register changed; the claim is still Muxin's.
- **Not a spin, it's invention:** "Most AI rollouts automate the wrong layer. Studies show 70% fail in year one because of it." Banned: it invents a statistic ("70%") and a citation ("studies show") Muxin never stated. Cut it, even though spin is on.

When you queue spun derivatives, tell Muxin which are `spin: true` and which angle each applied,
so the output stays legible. Once published, `/publish` stamps the Placed-log row with a `spin`
marker, `tag-source` classifies the post `atomized-spin`, and `/strategy`'s `origin-compare`
shows verbatim-atomized vs spin vs organic per platform. If verbatim-vs-spin ever needs
re-measuring, `--no-spin` runs are the control arm; the original protocol is preserved in
`docs/spin-experiment.md`.

## Storytelling re-hook/re-order latitude (Muxin, 2026-07-04)

A rubric run against 10 real derivatives (2026-06-30) found native/brand scoring 4-5 while
storytelling — hook, narrative, resonance (see SKILL.md step 5) — clustered at 2-3. The spin
latitude to re-angle a hook already existed (guardrail #1 above); it just wasn't being used. This
extends it, concretely, on the two platforms Muxin asked for:

- **Lead with the strongest existing line.** Cut throat-clearing openers like "What I described
  in my essay..." or "I've been thinking about...". Open on the sentence that already has the
  most charge.
- **Re-order for a narrative arc**, not a list of facts restated in source order.
- **Never trim concrete personal specifics that ARE the story.** A past mistake this corrects:
  cutting a real detail (a number, a name, a moment) in favor of generic framing. The specific
  IS the resonance; keep it even when reordering around it.
- Still bound by every spin guardrail above: reframe, never invent.

**Scoped to X and LinkedIn only.** `appliesRehook(platform, sourceKind)` in `src/atomize/spin.ts`
is the gate: true only for `platform` in `{x, linkedin}` AND `sourceKind !== "substack-note"`.
Bluesky derivatives don't get this pass — Bluesky already works close to verbatim (`docs/spin-experiment.md`).
Neither does any derivative from a Notes-sourced folder (`source_kind: substack-note`), on ANY
platform including x/linkedin — a note is already "the whole note is the extract" and near-verbatim
by design (`references/notes-mode.md`); re-hooking it would fight that.

**Before/after, concrete.** Say the source essay reads (in order): "What I described in my essay
was a hiring process that looks fair on paper. Then last quarter I watched a manager reject a
candidate for 'not being a culture fit' three interviews after her resume had already cleared the
bar twice." A verbatim/pre-rehook X draft keeps that order and the throat-clearing opener — this
is exactly the shape the eval scored 2-3 on hook/narrative. The re-hooked version leads with the
charged specific and drops the preamble: "Last quarter I watched a manager reject a candidate for
'not being a culture fit' — three interviews after her resume had already cleared the bar twice.
That's what a hiring process that 'looks fair on paper' actually does." Same claim, same specifics
(the manager, the quarter, "three interviews," the culture-fit line) — reordered and re-hooked, not
invented.

**The soft gate that motivates this:** a derivative scoring `<= 3` on hook, narrative, or resonance
(`needsSpinPass()` in `src/atomize/storytelling.ts`) gets `spinPassNote()`'s text appended to its
review-queue.md `notes` cell — a suggestion to run this pass, never a block. Muxin's `approve` in
review-queue.md is still the only real gate.

**Pattern options for the reorder/lead-line decision.** `references/hook-patterns.md` catalogs
proven sentence SHAPES (not text) for how to open — pulled from real creators in Muxin's adjacent
niches. When re-hooking, it's fine to pick a shape that fits the source material's actual content
and lead-line specifics into it. Read that file's "How to use this" section first: fill every shape
using only facts already in the source, never the file's own attributed examples' wording — the
same reframe-never-invent rule as everywhere else in this pass. For civic/social-issues source
material specifically, prefer the joyful-activism register in that file over the outrage register
unless the source itself is genuinely grief- or anger-toned (Muxin, 2026-08-18).

## Beat-template rewrite: LinkedIn + X (Muxin, 2026-07-10)

PR #185's LinkedIn/X angles (2026-07-10, section above) described the case-first structure in
**prose** — what the output should feel like. That was too weak a steering signal: even PR #185's
own verification sample drifted thesis-first, subject-is-me, despite being drafted under the new
angle. Runtime models follow explicit **structure** — named beats with pass/fail tests — far more
reliably than a paragraph describing intent. `config/platforms.yaml`'s `spin_angles.linkedin` and
`spin_angles.x` now encode the case shape as numbered beats, each with an embedded test. Read the
current YAML there for the authoritative beat list; this section explains it with a worked example.

**The fallback rule (load-bearing):** beat 2 (LinkedIn) / beat 1's assumption half (X) requires a
literal quoted-or-near-quoted belief statement in the source material. If the source can't produce
one, the piece does NOT fit the case skeleton — fall back to normal (non-case) extraction/spin.
Never fabricate a quote or a scene to force the fit. This rule exists because the case format only
works on real third-party material; forcing it onto material that has no real assumption-to-quote
produces exactly the drift PR #185 hit (see counter-example below).

**Exemplar, mapped to LinkedIn's 5 beats.** Source: Muxin's own draft, "LinkedIn — Case Format
(Diagnosis Post).md" (Draft v1, approved for reuse):

> A demand response program for smart thermostats was stuck under 50 professional installs across
> two full campaigns. First they dropped the install fee from $100 to $30. The next move on the
> table was $0.
>
> The team's read was consistent: "It's a pricing problem. Get the fee low enough and installs
> follow."
>
> Nobody had asked why someone would choose paid professional installation when DIY was already
> free. Price was never the gap. There was no reason to pick the paid option over the free one, at
> any price point.
>
> The fix wasn't a lower price. It was a bill credit tied specifically to choosing professional
> install, something that made the paid option worth choosing instead of just cheaper. Installs
> went from under 50 to over 1,500. It was later cited by a Texas PUC contractor as the most cost
> effective demand response program in the state.
>
> Two campaigns and two price drops happened before anyone tested that assumption. Not for lack of
> attention. "It's a pricing problem" just felt too obviously true to write down as a guess.
>
> When I get pulled into something like this, I'm not looking for "we don't know what to do." I'm
> looking for "we've already tried a few things and the number hasn't moved." That's usually a sign
> the team is optimizing a variable that was never the real constraint.

- **Beat 1 (situation):** under-50-installs across two campaigns, fee dropped $100 → $30, $0 next
  on the table. A stranger can picture the scene from this alone.
- **Beat 2 (assumption, quoted):** "It's a pricing problem. Get the fee low enough and installs
  follow." — a literal quoted belief sentence.
- **Beat 3 (cost):** the bill-credit fix, installs from under-50 to 1,500+, the Texas PUC citation
  — concrete numbers and a named outcome, not "it got better."
- **Beat 4 (zoom-out, last):** "That's usually a sign the team is optimizing a variable that was
  never the real constraint" — one line, the close of the piece, not the opener.
- **Beat 5 (soft availability close):** the final paragraph — what Muxin looks for when pulled into
  something like this ("we've already tried a few things and the number hasn't moved") — a
  diagnostic signal, not "book a call" or "DM me."

**Counter-example — labeled "wrong: thesis-first, subject is me."** This is PR #185's own hand-
drafted "NEW" sample, and PR #185's own PR body already admitted it drifted thesis-first despite
being drafted under the case-first prose angle. It is a real, documented failure case, not a
strawman:

> Earlier this year I was convinced my LinkedIn problem was a positioning problem: pick the right
> lane, repeat it, and the brand follows. That's the standard advice, so I ran it as an experiment
> on myself.
>
> My actual career doesn't fit one lane: journalism, education, anthropology, product, tech, an
> MBA. Every framing I tried for a "brand" asked me to pick one of those and treat the rest as noise
> to cut.
>
> I spent most of this year testing that assumption instead of accepting it. Every time I cut a
> piece to fit the lane, the post got easier to write and said less. The parts I was told to
> amputate were exactly the parts doing the real work.
>
> The pattern underneath: "pick a lane and repeat it" is advice built for people whose value already
> sits inside one category. It punishes range right as AI is about to make range more valuable, not
> less.
>
> If your own experience doesn't reduce to one lane either, I'd be glad to compare notes on what
> you've tried and what actually held up.

**Why it's wrong under the beat template:** beat 1's "situation" here is a category/reflection ("my
LinkedIn problem was a positioning problem"), not a scene with a number or a decision a stranger
could picture — it fails beat 1's test outright. And the subject of the whole case is Muxin
herself, not a third-party/client situation, which defeats the case format's actual purpose: a
client-conversion register (a stranger recognizing "this could be my team"), not personal
reflection. This happened because no real third-party case existed in the corpus yet when PR #185
was drafted, and the prior interim guidance here told you to force the beat template onto whatever
source material most resembled a case anyway (even autobiographical material) as a stand-in — that
is exactly the drift this counter-example documents, so that instruction is now superseded.

**Superseded 2026-07-15 (card f7b186c2/5021f759):** do NOT force the beat template onto non-case
material as a stand-in anymore. Source-triage's `--case found|not_found` judgment (step 2.5 of
`.claude/skills/atomize/SKILL.md`) is now the gate: only declare `case_skeleton: true` on a
derivative when that source was triaged `--case found` — a real, anonymize-able third-party case
actually exists in the source. When it reads `not_found` (the same legitimate, expected outcome as
"no beat-2 belief statement"), fall back to normal (non-case) extraction/spin for that platform
instead — never fabricate a quote or a scene to force the fit, and never draft a
`case_skeleton: true` derivative off autobiographical material standing in for a case.
`validate.ts`'s `checkCaseGate` enforces this at the code level: a `case_skeleton: true` derivative
whose source wasn't triaged `--case found` is a hard violation, not just a prompt hint anymore.

**Dialect preservation (X vs. LinkedIn).** `spin_angles.linkedin` and `spin_angles.x` stay separate
config entries — never merged. Voice (`config/voice.yaml`, Muxin's cadence) is constant across both;
what differs is compression and register only. X compresses the same underlying beats into 2-3
visible beats (situation + assumption folded together, cost, zoom-out folded into the closing
line), keeps its own non-engineer-outsider register with real named tools/mechanisms, and drops
beat 5 (the soft-availability close) entirely — that beat is LinkedIn-only, X has no engagement-
scoping subtext.

**Follow-up not done here:** X's beat count/shape is provisional until real technical-mechanism
source material (a genuine tool/mechanism failure case, not an essay excerpt) exists to test it
against — worth revisiting once card f7b186c2's sourcing work lands a first real case either
platform can draw on.
