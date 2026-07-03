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
so X, LinkedIn, and Bluesky today. Platforms with no configured angle stay verbatim with no spin
frontmatter: the quote card (its quote line is a verbatim quotable by definition), community
variants, and anything else `resolveAngle` returns nothing for. A `--no-spin` run spins nothing:
all derivatives are verbatim, `source_lines` hard-required, no `spin`/`angle` keys.

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
