# Civic adaptation rubric

**Source:** Muxin, 2026-08-22. Her own two tables, supplied verbatim, with her instruction: "I want
to make sure we don't lose THESE tactics ... so all of our content needs to flow from these
principles as well!"

## How to use this, read before drafting

**This is Muxin's decided rubric, not mined data.** It is hers, already settled. `/patterns` never
writes to this file and never overwrites it. `references/hook-patterns.md` and
`references/post-patterns.md` hold shapes discovered by mining real creators. This file holds a
standard Muxin set. The three sit side by side and are one system, but only the other two get
rewritten by a mining pass.

**This answers WHAT a civic piece must deliver. The joyful-activism default answers in WHICH
REGISTER. They stack, they do not compete.** hook-patterns.md's niche default (patterns 16 to 23,
the joyful-activism register preferred over the outrage/moral-clarity register for civic material)
still holds in full. Read it as tone. Read this file as substance. A civic piece written in the
joyful register that ends on "get involved" fails this rubric. A piece with a perfect 90-second
micro-action written as grievance fails that default. A drafting agent needs both, and neither one
overrides the other.

**Rule 1 still binds. "Steal" means the SHAPE.** Table 1's column header says "What to steal from
viral niches," and it means exactly what hook-patterns.md already means by it: the structure is the
borrowed thing, never the wording. The civic example lines inside table 1 ("Your ballot has 7 races
you haven't researched," "Here's the exact form that takes 90 seconds," and the rest) are
illustrations of the shape. They are not lines to paste into a post. Fill the shape from the source
material being atomized, the same as every other pattern in this skill.

**A micro-action CTA must point at something real.** Never invent a link, a form, a deadline, a
race, or a ballot measure. If the specific thing cannot be verified as real and current, the CTA
falls back to the general default (civic material routes to the voting tool, general material to
the Substack subscribe) rather than fabricating a specific one. Value-matching carries the harder
rule: if the record cannot be verified it is not written at all, not written with a caveat and not
labeled as needing verification. A plausible-sounding fake deadline is worse than a generic CTA,
and CLAUDE.md rule 1's no-invented-proof spirit covers it. This rubric sharpens the existing CTA
default, it does not replace it.

## What to steal from viral niches

| Viral niche pattern | How to adapt it for civic |
|---|---|
| Strong first 1-3 second hook | Open with the concrete pain or outcome: "Your ballot has 7 races you haven't researched," "This one local rule is quietly costing you money," "Here's the exact form that takes 90 seconds." |
| Immediate personal payoff | Frame every piece around *what the person gets or avoids right now* (time, money, power, protection of something they care about). |
| Ultra-clear "do this next" | End almost every piece with one specific, low-friction action that can be completed in under 5-10 minutes. |
| High volume + repurposing | One source (ballot data, city agenda, voting record) to many short pieces across formats. |
| Pattern interrupt + relatability | Use everyday language and specific local examples instead of abstract "democracy" talk. |
| Series / ongoing arcs | "This week's 3 ballot items you can actually check," recurring "local government in 60 seconds," etc. |

## Making civic action ASAP

> This is the highest-leverage part. Most civic content fails because the call-to-action is vague
> ("vote," "get involved," "stay informed"). Replace that with:

- **Micro-actions that can be finished immediately**
  Check your registration status to an actual link + 60-second walkthrough.
  Look up one specific race on the next ballot to a direct tool or simple checklist.
  Find your polling place / early voting location to a map + hours.
  Read the actual text of one local measure in plain English.

- **Belief- or value-aligned matching** (this is already close to what you've built)
  "Based on what you said you care about, here's how these candidates actually voted on X."
  Keep it neutral and record-based so it feels useful rather than partisan.

- **Local + specific beats national + abstract**
  City council, school board, county, state legislative races, and ballot measures usually convert
  better than pure national politics because the stakes feel closer and the information gap is
  larger.

## Where this is wired in

This file is a committed reference, unlike the mined corpus, because it is Muxin's decided rubric
rather than collected data. Three places read it:

- **`SKILL.md` step 4 (drafting).** Civic and social-issues derivatives are drafted against table 1:
  concrete hook, immediate personal payoff, one specific next action, everyday local language.
- **`SKILL.md` step 4.5 (CTA).** A civic CTA has two accepted forms from table 2: a specific
  micro-action, or belief- or value-aligned matching kept neutral and record-based. Either is set
  through the existing literal-`cta` / `cta_label` override that already points civic-tech
  pieces at the voting tool. The mechanics are unchanged. The bar for what goes in them is higher.
- **`references/post-patterns.md`.** Every synthesized full-post pattern records an immediate
  personal payoff and a CTA, and its CTA field carries this rubric's civic gate.

Nothing here is a new CTA system. It is a standard the existing one now has to clear.
