# Spin: the always-on default (opt out with `/atomize --no-spin`)

Spin is the default for EVERY atomize run since 2026-07-02. No flag is needed. It reframes each
text derivative through a Muxin-approved, per-channel angle so the post fits its audience, while
staying traceable to what Muxin actually wrote. It started as the opt-in `--spin` experiment
(history and A/B protocol: `docs/spin-experiment.md`); Muxin approving a specific angle per
channel (2026-06-30) promoted it to the default. The only opt-out is `/atomize --no-spin <arg>`,
which produces strict verbatim extraction exactly like the old default.

**Where the angles live:** `config/platforms.yaml` `spin_angles`, keyed by platform. Each entry
carries the target `audience` and the approved `angle` statement. Currently: `x` (tech),
`linkedin` (business/career), `bluesky` (political), and `substack` (society; reserved, since
Substack is the source channel, not an atomize output target, per `config/routing.yaml`). The
angles are internal generation config only. Never publish an angle statement verbatim as post
copy; it shapes the framing, the words still come from Muxin. `src/atomize/spin.ts`
(`resolveAngle`) is the code's view of the same mapping.

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
so X, LinkedIn, and Bluesky today — INCLUDING a quote card's per-platform context captions
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
