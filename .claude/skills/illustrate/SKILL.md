---
name: illustrate
description: Build 2 — illustrate a fiction series. Character "fan-art" variants (one description, many styles) for social promo, and optional consistent-style in-chapter scene art using locked character references. Usage - /illustrate <series> (character <name> | scene <chapter>).
---

# /illustrate — character & scene art for a fiction series (Build 2)

Make illustrations for a `/story` series. Two deliberate tracks (Muxin's call which to use):

1. **Fan-art (social promo) — varied styles on purpose.** One baseline character description
   rendered across several styles, like fan-art off a model sheet. These are posts for social,
   to build an audience. Style variety is a feature here.
2. **In-chapter art — one consistent style.** Scene illustrations that share a **locked** series
   style and reuse **character reference images** so the same character looks the same across
   chapters (the Sandman model: consistent interior look, even as covers vary). Optional — Muxin
   decides per chapter whether to embed art in the story.

## Image model — cost-first, escalate only on request (same policy as /video)

Default is **Riverflow** (~$0.02/img). If Muxin wants a better look, **offer first** —
re-render with `--pro` (Nano Banana Pro ~$0.13, and the model that conditions on reference
images for character consistency) or `--hero` (gpt-5.4-image-2 ~$0.23). Never auto-escalate.
Every image logs its cost to `data/cost-log.csv`.

## Character fan-art (social)

`npm run story:illustrate -- <series> --character <name> [--styles "ink, watercolor, comic"] [--pro|--hero]`

- Reads `characters/<name>.md` (the `## Appearance` section if present, else the whole sheet) as
  the baseline the image must stay faithful to — the distinctive physical tells carry across
  every style.
- Renders one image per style into `illustrations/characters/<name>/<style>.png`.
- Default styles cover a useful spread; pass `--styles` to choose. These are deliberately NOT
  reference-locked, so each style can reinterpret the look.
- Review the spread with Muxin. The ones he likes can go to social via `/atomize`'s image flow,
  or be posted as ready-to-paste.

## Consistent in-chapter scene art

First, **lock a reference** so the character stays consistent:
`npm run story:illustrate -- <series> --lock <name> --src <approved-image-path>`
(copies it to `characters/<name>/reference.png`).

Set the series' locked style once in `stories/<slug>/series.yaml` → `illustration.style_lock`
(e.g. "muted ink-wash, cool palette, high contrast"). Then render scenes:

`npm run story:illustrate -- <series> --scene <chapterN> --prompt "<scene description>" --character <name> [--character <name2>] [--pro|--hero]`

- Appends the locked style to the prompt and passes each named character's `reference.png` as a
  reference image (use `--pro` so the model actually conditions on them) → consistent likeness.
- Writes to `illustrations/chapters/chapter-NN/scene-K.png` (auto-numbered).

## Workflow

1. After a chapter locks (`/story lock`), offer illustrations.
2. For social: generate fan-art variants, show Muxin, keep his picks.
3. For in-story art (if Muxin wants it): confirm the locked style + a locked reference per
   recurring character first, then render scenes so they match.
4. Costs are logged automatically; report total spend.
