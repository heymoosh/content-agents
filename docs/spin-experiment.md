# Spin experiment — give `/atomize` audience-fit latitude, measured against verbatim

**Status:** approved 2026-06-24, built, ran as an opt-in experiment through 2026-07-02.
**Promoted to an always-on default 2026-07-02** — driven by Muxin approving a specific angle per
channel (2026-06-30, `config/platforms.yaml` `spin_angles`), not by the A/B protocol below reaching
a verdict (verbatim-vs-spin data was still accumulating). See "Promotion (2026-07-02)" near the end
for what changed. Everything below this line is the original design and is kept as history; current
behavior lives in `.claude/skills/atomize/references/spin-mode.md`.

## Why

Today every text derivative is strict extraction-first: verbatim sentences from the source, trimmed
for the platform, never new claims in Muxin's voice (CLAUDE.md rule 1). The 2026-06-24 analysis
showed audience-format fit matters a lot (the same human-ai content scored 13.1 as a Substack note,
5.5 on LinkedIn, 1.45 on X). The question: would letting the agent **reframe and flavor** a post
for each audience, instead of staying verbatim, lift engagement enough to be worth it?

This is not a new principle. The architecture already allows scoped, review-gated composition for
video scripts (Grok drafts from ideas) and all of Build 2 fiction. Spin extends that to text
derivatives **as an opt-in, tracked experiment**, never the default.

## Guardrails (must hold — non-negotiable)

1. **Reframe/flavor for the platform, never invent.** The agent may re-angle, re-order, change the
   framing and the hook to fit the audience. It may NOT introduce a claim, argument, or worldview
   Muxin did not express in the source. The post must still be traceable to something Muxin actually
   said or believes.
2. **Voice guards stay on.** `config/voice.yaml` applies in full (no em dashes, no AI tells).
3. **Review gate stays.** Nothing publishes without Muxin's `approve` in `review-queue.md`.
4. **Opt-in only.** Verbatim extraction stays the default. Spin is produced only when asked, until
   the experiment data says otherwise. *(Superseded 2026-07-02 — see "Promotion" below: spin is
   now the default; `/atomize --no-spin` is the opt-out.)*

## Design

A spun derivative is a tracked variant so the existing test can judge it. Reuse the
`posts.source` machinery (`atomized` / `organic`) by adding a third value `atomized-spin`.

Build (each is a small, well-scoped change):

1. **`/atomize` skill** (`.claude/skills/atomize/SKILL.md`): add a spin mode (a `--spin` run flag,
   or a per-derivative choice). When spinning, the agent may reframe/flavor within the guardrails
   above, and marks the derivative `spin: true` in frontmatter. Document the invent-vs-flavor line
   with one or two before/after examples so the bar is concrete.
2. **Derivative frontmatter**: add `spin: true`. `source_lines` becomes best-effort for spun text
   (it may point at the ideas it drew from rather than exact lines).
3. **`src/atomize/validate.ts`**: relax the strict `source_lines` requirement for `spin: true`
   derivatives (still enforce char limits, voice, no-AI-tells). CHECK the current validate logic
   first; it may key off `source_lines` presence.
4. **`src/publish/queue.ts` (`appendBetPlacement`)**: when a shipped derivative has `spin: true`,
   record a spin marker in the Placed-log row (e.g. a trailing `| spin`). This is what tag-source
   reads back.
5. **`src/db/tag-source.ts`**: when a matched post's Placed-log entry is marked spin, set
   `source = 'atomized-spin'` instead of `'atomized'`. (No schema change; `source` is free text.)
6. **`src/strategy/origin-compare.ts`**: add `atomized-spin` as a third column so the report shows
   verbatim-atomized vs spin vs organic per platform.

No DB migration needed.

## Experiment protocol

1. **Prerequisite:** a verbatim-atomized + organic baseline to compare against. The 2026-06-24
   cycle started it (atomized X 3.0 vs organic 1.2, n=6 — still INSUFFICIENT). Let verbatim
   accumulate to roughly n≥10 per platform before reading spin against it.
2. **Run:** for a few weeks, produce spin variants for a subset of derivatives (suggest starting on
   the platforms where flavor should matter most — LinkedIn and X — and leaving Bluesky/Notes
   near-verbatim since those already work). Muxin approves and publishes both verbatim and spin over
   time.
3. **Measure:** each `/strategy` cycle, `origin-compare` shows verbatim vs spin vs organic
   (recency-weighted, INSUFFICIENT-flagged). Record a bet in `briefs/bets.md` for the spin
   hypothesis so it gets graded like everything else.
4. **Decide:** if spin's engagement beats verbatim by a meaningful margin across ≥2 cycles at
   adequate n (per the brief's honesty rules), make spin the default for that platform. If it ties
   or loses, keep verbatim. Either way the answer is data, not vibes.

## Open questions to settle when building

- Per-piece spin, per-platform spin, or produce-both-and-let-review-pick? (Produce-both gives the
  cleanest A/B but doubles drafts.)
- How aggressive is "flavor"? Calibrate the invent-vs-reframe line with a few Muxin-reviewed
  before/afters before running at volume.
- Does spin change the CTA logic at all? (Probably not — CTA stays per `config/cta.yaml`.)

## Promotion (2026-07-02)

Spin moved from an opt-in, tracked experiment to the always-on default for every `/atomize` run.
This was driven by Muxin approving a specific angle per channel (2026-06-30), not by the A/B
protocol above reaching a verdict — verbatim-vs-spin data was still accumulating toward the n≥10
threshold. The four approved angles are internal generation config in `config/platforms.yaml`
`spin_angles` (`x`, `linkedin`, `bluesky` active; `substack` reserved — it's the source channel,
not an atomize output target, see `config/routing.yaml`).

What changed:
- Default flips: every X/LinkedIn/Bluesky derivative is now reframed through its channel's angle
  unless the run is `/atomize --no-spin` (the new opt-out, producing strict verbatim as before).
- A spun derivative now also carries `angle: <platform-key>` frontmatter (in addition to
  `spin: true`), naming which approved angle shaped it. `src/atomize/validate.ts` enforces that the
  angle is present and matches the derivative's own platform.
- The guardrails above (never invent, voice guards, review gate) are unchanged and still
  non-negotiable — only the on/off default and the per-channel angle mapping are new.

Current default behavior lives in `.claude/skills/atomize/references/spin-mode.md`; this file
stays as the historical record of why and how spin was built, and the experiment protocol above
still applies if verbatim-vs-spin needs re-measuring later (e.g. via `--no-spin` runs).

## Storytelling extension (2026-07-04)

A storytelling rubric (hook / narrative / resonance / overall) was tested against 10 real
derivatives in `content/`. **Finding:** native/brand scored 4-5 while storytelling clustered at
2-3 — the re-hook/re-order latitude in guardrail #1 above existed but was unused in the sample (no
`spin: true` derivative had actually reframed its hook or order, only its angle).

**DECISION (Muxin, 2026-06-30):** engagement is measured as resonance, not conversion. Practical
angle and CTA are CONDITIONAL — present only when genuinely warranted by the source — never
scored requirements. Never ask for engagement; a felt truth earns a reaction, asking for one is
inauthentic (already banned, `config/voice.yaml`).

Built in response (ship now, no guardrail change, pure upside):

1. **`hook` / `narrative` / `resonance`** joined `native` / `brand` as scored dimensions
   (`.claude/skills/atomize/SKILL.md` step 5, `src/atomize/storytelling.ts`). Soft-gated only: a
   derivative scoring `<= 3` on any of the three gets a note appended to its review-queue.md row
   suggesting a Spin pass — never a block. `native`/`brand`/`cta` low scores still mean "discard
   it yourself"; storytelling low scores mean "flag it, Muxin still decides."
2. **The re-hook/re-order latitude was made concrete and applied**, scoped to X and LinkedIn only
   (`appliesRehook()` in `src/atomize/spin.ts`; worked example in
   `.claude/skills/atomize/references/spin-mode.md`). Bluesky and any Notes-sourced derivative
   (`source_kind: substack-note`) stay near-verbatim — this is not a broader invent-latitude, it's
   the SAME reframe-never-invent guardrail from guardrail #1, just actually used on the two
   platforms where audience-fit data (the 2026-06-24 finding, "Why" section above) says flavor
   matters most.

No schema change to review-queue.md's table (native/brand/cta stay a fixed 9-column layout —
`src/publish/queue.ts`, `src/video/render.ts`, and `src/review/serve.ts` all parse it by column
position). The storytelling flag rides in the existing free-text `notes` cell instead.

## Related
- The tracking substrate: `posts.source`, `tag-source.ts`, `origin-compare.ts` (built 2026-06-24).
- The guardrail it must not break: CLAUDE.md rule 1 (extraction-first) and rule 5 / `voice.yaml`.
