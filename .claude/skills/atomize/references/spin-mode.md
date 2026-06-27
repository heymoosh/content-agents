# /atomize --spin — opt-in audience-fit experiment

Default atomization is verbatim extraction. **Spin is the one exception**, and it runs ONLY when
the invocation is `/atomize --spin <arg>` (or Muxin asks for a spin on a re-run). It tests a single
hypothesis: does reframing a post for its audience lift engagement enough to be worth dropping
strict verbatim? It is measured against verbatim, so it must be tracked, not silently mixed in.
Full rationale + protocol: `docs/spin-experiment.md`.

**What changes vs. the normal flow:** run steps 1–8 (in SKILL.md) exactly as usual, with three differences.

1. **You may reframe and flavor — within hard guardrails.** For a spun derivative you MAY re-angle
   the framing, change the hook, reorder, and adapt the register to the platform's audience. You MAY
   NOT introduce a claim, argument, statistic, metaphor, or worldview Muxin did not express in the
   source. Every spun post must still be traceable to something Muxin actually said or believes —
   reframed, not invented. When unsure whether a line crosses from flavor into invention, it has
   crossed; cut it.
2. **Mark it.** Add `spin: true` to the derivative's frontmatter. `source_lines` becomes
   best-effort: point at the lines/ideas you drew from (validation no longer hard-requires it for
   `spin: true`, but include it when you can — it keeps the trace honest).
3. **Everything else holds.** `config/voice.yaml` applies in full (no em dashes, no AI tells).
   Scoring, CTA stamping (`config/cta.yaml` — spin does not change CTA), routing, and the
   `review-queue.md` approval gate are unchanged. Nothing publishes without Muxin's `approve`.

**Which derivatives to spin (default for a `--spin` run):** spin **LinkedIn and X** — the platforms
where audience-format fit varies most. Keep **Bluesky, community, and the quote card near-verbatim**
(those surfaces already work; don't disturb the baseline). So a typical `--spin` run produces
`spin: true` LinkedIn + X derivatives and ordinary verbatim Bluesky/quote-card derivatives. The A/B
accumulates across runs over the weeks (verbatim from normal runs vs. spin from `--spin` runs), not
within one piece. If Muxin wants a clean same-piece A/B, produce both the verbatim and the spun
version of a platform and let review pick — say so in the review-queue header so it's not read as a
dupe.

**The invent-vs-flavor line, made concrete.** Say `source.md` line 14 reads:

> Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual.

- **Verbatim (default, X):** "Most AI rollouts automate the wrong layer: they hand the judgment to the model and keep the typing manual." → `source_lines: [14]`
- **Allowed spin (LinkedIn, reframed as a lesson, new hook, same claim):** "The most common AI mistake I keep seeing: teams automate the judgment and keep doing the typing by hand. That's the wrong layer. Flip it." → `spin: true`, `source_lines: [14]`. The hook and register changed; the claim is still Muxin's.
- **Not a spin, it's invention:** "Most AI rollouts automate the wrong layer. Studies show 70% fail in year one because of it." — bans: invents a statistic ("70%") and a citation ("studies show") Muxin never stated. Cut it, even on a spin run.

When you queue spun derivatives, tell Muxin which are `spin: true` and on which platforms, so the
experiment stays legible. Once published, `/publish` stamps the Placed-log row with a `spin` marker,
`tag-source` classifies the post `atomized-spin`, and `/strategy`'s `origin-compare` shows
verbatim-atomized vs spin vs organic per platform.
