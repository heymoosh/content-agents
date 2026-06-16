---
name: bakeoff
description: Image-gen bakeoff — run one prompt across many image models (via OpenRouter) plus a free local Remotion/SVG, view them side by side, score them, and decide which model(s) to keep on cost + quality. Usage - /bakeoff "<prompt>" [--aspect 1:1].
---

# /bakeoff — image model bakeoff

Put image models head-to-head on a single prompt, then pick winners by **price vs. quality**.
Contenders live in `config/bakeoff.yaml`; most route through OpenRouter on the existing
`OPENROUTER_API_KEY`, so adding a model is one line. The harness skips any contender whose key
is missing and reports the **real billed cost** for OpenRouter models.

## Steps

1. **Get the prompt.** Use what Muxin gave; don't rewrite it. Default aspect `1:1` (quote-card /
   spot) unless told otherwise (`9:16`, `16:9`).

2. **Author the free SVG contender (`remotion-svg`)** — optional but recommended, it's $0.
   Hand-draw a flat *New Yorker conceptual spot* as SVG for the prompt and save it to
   `bakeoff/_authored/<short-slug>.svg`. Style target:
   - Flat, witty, conceptual — one clear visual idea, generous negative space.
   - **Limited screen-print palette:** cream `#f2ead9` (paper), black ink `#1a1a1a`,
     persimmon `#e2552f`, teal `#2f7e7e`, ochre `#d8a23a`. Flat fills, slight mis-registration
     feel is fine; no gradients, no photoreal shading.
   - Author a real `viewBox` (e.g. `0 0 1024 1024`) so it rasterizes crisp.
   If you skip this, the contender is skipped automatically.

3. **Run it.**
   ```
   npm run bakeoff -- --prompt "<prompt>" [--aspect 1:1] [--svg bakeoff/_authored/<slug>.svg]
   ```
   Each generated image lands in `bakeoff/<run>/<label>.png`; costs append to `data/cost-log.csv`.
   The command prints which contenders ran vs. skipped (and the env key to add for skipped ones).

4. **Surface the results.** Point Muxin at `bakeoff/<run>/gallery.html` (side-by-side, cheapest
   first). Optionally also show the top few images inline here.

5. **Score.** Muxin fills the **Quality (1-5)** column and marks **Best?** in
   `bakeoff/<run>/scorecard.md`. (Or tells you scores conversationally — then you edit the file.)

6. **Decide.**
   ```
   npm run bakeoff -- --decide <run>
   ```
   Prints rankings by price, by quality, and by quality-per-dollar, plus a recommendation. Relay
   it and confirm which model(s) to keep.

## Keeping a winner

`config/providers.yaml` selects an image adapter by name (`image: <adapter>`), which covers the
main pipeline's *default*. To actually pin a winning OpenRouter model as that default you'd point
the image path at `openrouter-image` with the chosen `params.model` — a small follow-up, since
`providers.yaml` can't carry params yet. For now the bakeoff's job is to **choose**; wiring the
winner into `/atomize` rendering is a separate, explicit change. Don't silently rewire it.

## Re-running / going cheaper / open-source

- Re-run anytime with a new `--prompt`; every run is its own `bakeoff/<run>/` folder.
- Cheaper/open-weight end is already in: `flux2-klein`, `riverflow-v2-fast`, and the free
  `remotion-svg`. Add any model OpenRouter carries by copying a row in `config/bakeoff.yaml` and
  changing `label` + `params.model` (the OpenRouter slug). Models OpenRouter doesn't cover get
  their own adapter in `src/providers/image/` (follow `gemini-imagen.ts`).
- `cost_usd` in the config is only a pre-run display estimate; the OpenRouter adapter overrides it
  with the actual billed cost, so price rankings are real. Edit estimates if you like.

## Notes

- Nothing here publishes anything — it only writes images + a gallery + a scorecard under
  `bakeoff/` (gitignored). It does spend API credits per generated image (cents each), so it runs
  only when Muxin asks for a bakeoff.
- `--only a,b` limits to specific contenders; `--name <run>` sets the folder name;
  `--suffix "..."` appends a shared style string to every contender's prompt (keep the base prompt
  identical across models for a fair comparison).
