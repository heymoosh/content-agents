# Monetization strategy

What in this repo can be sold, to whom, and in what order. Written as an internal decision doc,
not a pitch. Honest about what is real today versus what needs building.

## TL;DR

Lead with **services**, not SaaS. The system already automates roughly 80% of the labor in a
weekly content operation, which makes a **managed retainer** the highest-leverage product we can
sell today with zero new engineering. Use retainer revenue to validate demand and templatize the
config, then carve out the narrowest hostable slice as SaaS later (the self-grading strategy loop,
not the whole thing).

Recommended sequence:

1. **Productized setup** (one-time fee) — installs and configures the engine for one client.
2. **Managed content operation** (monthly retainer) — we run the weekly cycle; they write and approve. This is the cash engine.
3. **Custom builds** (project fee) — new platforms, new adapters, new verticals (e.g. the fiction build for authors).
4. **SaaS, later** — one slice only, after services prove the demand and the config is templated.

## What we actually have (the sellable assets)

The differentiators are not "AI writes your posts." Everyone has that. Ours are:

1. **Extraction-first discipline (Build 1).** The system never composes in the creator's voice. It
   quotes and trims their own sentences and traces every derivative back to `source_lines` in the
   source. This directly answers the #1 objection to AI content ("it sounds like AI / it isn't
   me"). It is a rule enforced in code and guards (`config/voice.yaml`, em-dash strip,
   AI-tell detection), not a promise. This is the wedge.

2. **A self-grading strategy loop (Build 0).** Most analytics tools are dashboards. This is a
   closed loop: `briefs/bets.md` records a falsifiable hypothesis per recommendation
   (`hypothesis_metric`) and `grade-bets` scores it against fresh data next cycle.
   Recency-weighted engagement (4-week half-life) keeps strategy from fossilizing on stale wins.
   "A strategy that tells you when it was wrong" is a real and rare claim.

3. **A routing engine.** `route.ts` + `config/routing.yaml` decide which platforms each piece goes
   to, driven by resonance data with cold-start defaults. Not "post everywhere."

4. **Vendor-agnostic, cost-first plumbing.** Provider adapters per capability
   (`src/providers/<capability>/<name>.ts`), every call returns `costUsd` and appends to
   `data/cost-log.csv`, model escalation is cheap-by-default and opt-in. We can prove unit
   economics to a client line by line.

5. **Structurally safe publishing.** Nothing auto-publishes (review queue gate), official APIs and
   sanctioned relays only (Typefully, YouTube, AT Protocol, PostPeer), no browser automation. No
   ToS/ban risk to underwrite when we run it for someone else.

6. **A second vertical already built (Build 2 — fiction).** Composed serialized prose with a story
   bible/canon and a per-chapter GitHub PR review loop. Proof the same skeleton extends beyond
   marketing content (authors, serialized newsletters, lore/worldbuilding).

## The honest constraints

- **The runtime is Claude Code, a developer tool.** Non-technical buyers cannot run this
  themselves. That kills near-term self-serve SaaS but *strengthens* the managed-retainer case:
  the thing they can't operate, we operate for them.
- **Single-tenant repo.** No auth, no multi-tenancy, no UI beyond the terminal, no billing. SaaS is
  a 6 to 12 month build competing with funded incumbents (Typefully, Taplio, Hypefury, Buffer AI).
- **Bespoke to one creator.** Pillars, voice, routing, and CTAs are tuned to Muxin. Productizing =
  turning that tuning into a repeatable onboarding, which is exactly the "setup" SKU below.

## Buyers

Ranked by fit with what exists today:

1. **Thought-leader founders / solo experts** who already write and want to scale distribution
   without sounding like a bot. Highest willingness to pay for the retainer; they value voice
   fidelity above all. This is the "Muxin" persona, so we already know it works.
2. **Fractional content teams / boutique agencies** serving several such founders. They want the
   system as a delivery multiplier. Best channel for volume; sell them setup + custom builds, or
   white-label the retainer.
3. **B2B founder-led-brand companies** (the exec-ghostwriting market that Taplio/Hypefury serve).
   Our wedge against incumbents: it is *actually their words*, traceably, not a model imitating
   them.

## The SKUs

### 1. Productized setup — one-time

"Install your content engine." Fork and configure for one client: pillars rubric, `voice.yaml`,
routing defaults, CTAs, account wiring (Typefully, YouTube, PostPeer, Bluesky), first analytics
ingest and baseline strategy brief, and a walkthrough of the weekly cycle.

- Deliverable: a working, configured repo + their first strategy brief + a Loom of the cycle.
- Price as a fixed package. This funds the templatization work the first few times we do it.
- Gate: only sell standalone to technically comfortable buyers. For everyone else it is the
  onboarding step of the retainer, not a self-serve product.

### 2. Managed content operation — monthly retainer (the cash engine)

We run the weekly `/cycle` for them. They drop analytics exports and write their thing; we deliver
the strategy brief, the atomized drafts in their review queue, and scheduled posts on approval.

- Why this is the best product today: the system already does the heavy lifting, so marginal
  delivery cost is low and margin is high. It is recurring (MRR). It sidesteps the "can't run
  Claude Code" problem entirely.
- Tier it by volume and surface area: e.g. text-only vs text+quote-cards vs full (incl. video
  shorts via `/video`). Video is the natural premium tier because it is the heaviest path.
- Retention hook: the `bets.md` loop means every month we show them what we predicted, whether it
  hit, and what we are changing. That report *is* the renewal pitch.

### 3. Custom builds — project fee

The provider/adapter architecture makes these clean, scoped projects:

- **New platforms / adapters** (Threads, Instagram, Reddit, Mastodon; new TTS/image/video models).
  Each is one file in `src/providers/<capability>/` or `src/publish/`.
- **Vertical config packs** — pillar rubrics + voice + routing for a niche (legal, dev-tools,
  fintech, healthcare-compliant).
- **Build 2 for authors / serialized newsletters** — the fiction engine as a separate offer.
- **Internal-comms / exec variant** — same atomization, private channels instead of public.

### 4. SaaS — later, one slice only

Do not try to host the whole thing. When services have proven demand and config is templated,
pick the single most hostable, most differentiated slice and build that as a product:

- **Best candidate: the strategy intelligence loop (Build 0) as analytics-in → brief-out.** It is
  the most defensible piece (self-grading bets, anti-fossilization), it has no live-posting risk,
  and it is the easiest to make multi-tenant (upload exports, get a brief). Charge for the brief +
  the graded bets history.
- Atomization-as-SaaS is harder: it needs the voice/source-line UX to survive without a human in
  the loop, and it lands squarely in incumbent territory.
- Treat SaaS as a wedge funded by services, not the opening move.

## What to build to make each viable

- **For setup + retainer (now):** extract Muxin's tuning into a documented onboarding template so a
  new client's pillars/voice/routing/CTAs can be filled in from a questionnaire. This is the single
  highest-ROI internal task; it converts bespoke work into a repeatable SKU.
- **For retainer reporting:** a client-facing summary of `bets.md` (predicted vs actual vs next
  move). Mostly a formatting job on data we already produce.
- **For custom builds:** keep doing what the architecture already encourages (one adapter per file).
  No new work needed; it is already productized internally.
- **For SaaS:** the real lift (auth, multi-tenant storage, a non-terminal UI for upload + brief,
  billing). Only after the above prove demand.

## Recommendation

Sell the **managed retainer** first, with **setup** as its onboarding step. It is the only option
that is fully real today, has high margin, recurs, and turns the system's existing automation
directly into revenue. Take **custom builds** opportunistically (the architecture already supports
them cheaply). Defer **SaaS** until the retainer book proves the market and pays for the build, then
ship only the Build 0 strategy loop as the first hosted product.
