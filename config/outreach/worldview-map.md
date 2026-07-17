# Worldview map (Phase 1 minimal set)

Brand-element language (positioning, pledge, signature line, altitudes) is canonical in
`config/brand.yaml` — keep these statements in agreement with it.

docs/outreach-engine-plan.md §9b's full version (10-20 belief statements, each with paraphrase
variants per community dialect, refreshed suggest-only and rotated across discovery runs) is
Phase 5 scope (`discover.ts`, not built yet). This Phase 1 file is a smaller, static seed: the
five statements the plan itself already worked out as examples, distilled from
`config/platforms.yaml` `home_brand` and `spin_angles`. `qualify.ts` and the research prompt read
this file directly (never a copy) as the canonical statement of what "shares the worldview" means
for the quote-required match in plan §9f.

Each statement below is what a quote must actually demonstrate, not a phrase to search for
verbatim: a candidate's own words qualify by meaning, in their own vocabulary, not by repeating
Muxin's phrasing.

## 1. Automating an unexamined process entrenches its flaws

Shipping automation over a broken process locks the break in at scale, it does not fix it.
Dialect variants (for reference; discovery-time query generation is Phase 5, not built here):
- practitioner / engineering: "paving the cowpath"
- academic: "sociotechnical systems", "algorithmic accountability"
- AI-safety: "value lock-in"
- civic tech: "digital democracy", "participatory design"
- org design: "Conway's law: shipping the org chart"

## 2. Product failure usually traces to an untested assumption, not bad execution

The team executed fine; nobody checked the assumption underneath the plan. This is the core of
the turnaround/greenfield client fit rubric in `config/outreach/clients.md`.

## 3. AI tooling gets designed inside a bubble the other 96% don't live in

Most AI product decisions are made by and for people already fluent in the tools. The people most
affected by the automation rarely get a say in how it's built.

## 4. Being open to changing your mind is the precondition for building the right thing

Openness to a real change of direction, not just faster execution of the existing plan, is what
separates a company that can act on what gets found from one that can't. This is the HARD
qualifier in `config/outreach/clients.md`: a company that fails it is disqualified regardless of
how strong the turnaround or greenfield read looks otherwise.

## 5. Who benefits or is harmed by a system is a truer diagnostic than whether it "works"

A system can run smoothly and still be quietly extracting from or excluding someone. Asking who
benefits and who's harmed surfaces the hidden belief worth changing before it gets automated.

## Using this file

- Research pass (`research.ts`): when gathering evidence for a values/worldview claim, check the
  candidate's own public words against these five statements. A match must be an actual quote
  (with a source link), not an inference from adjacent-sounding language.
- Qualify (`qualify.ts` + Claude inline judgment): a `## Classification` values claim without a
  quote traceable to one of these statements is not evidence, full stop. No quote means the
  worldview leg is unmet, not assumed: classify `unclear` rather than guess.
