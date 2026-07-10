# Client fit profile

The outreach engine's client-kind fit rubric (docs/outreach-engine-plan.md §3, §5 stage 4;
backlog cards `ba9769af` and `c308a8cf`). Claude reads this file at the QUALIFY + PITCH stage of
`/outreach` to classify a client-kind lead (`lead.md` frontmatter `classification`) and again at
DRAFT to justify the pitch angle. `research.ts`'s evidence pass walks the taxonomy below as a
closed checklist (plan §10 guard #2) — never an open-ended "research this company" prompt.

This is not a "does she like them" filter. It answers one question: **is this a company where
Muxin's specific strength — surfacing the untested assumption nobody checked — is actually the
thing they need, and are they structurally capable of acting on what she'd find?**

## Fit situations

A client-kind lead fits one of two situations. Both are legitimate; neither is "better."

- **Turnaround.** They've tried many times and nothing's working. Muxin comes in and finds the
  hidden, untested assumption that's the real problem. Surfacing what nobody tested is her core
  strength.
- **Greenfield.** They don't yet know what to build and want to avoid building the wrong thing
  early. She helps build the right thing the first time (or after their 10th/20th try).

## HARD qualifier — open to changing their mind

They must be **OPEN to changing their minds / direction.** This is not optional and not a
tiebreaker; it's a gate. **NOT a fit** if they just want execution of already-made decisions, or
there's heavy politics blocking a change of direction — no matter how strong the turnaround or
greenfield read looks otherwise. A lead that fails this qualifier is `disqualified`, full stop.

## Evidence taxonomy (closed checklist)

`research.ts` gathers specific, citable signals, not a vibe. Each signal below is one checklist
item; an unfound signal after `search_budget_per_signal` searches (`config/outreach.yaml`) is
recorded as "no evidence found," not chased further.

### Turnaround signals

- Same role reposted/reopened multiple times in the past 6-12 months.
- Leadership/PM tenure gaps on LinkedIn.
- Public pivot language in press, blog posts, or founder interviews.
- Visibly different core product versions over time (web archive).
- Glassdoor/Blind commentary about repeated direction changes (a signal to cite as such, never
  presented as verified fact — see the design doc's research-ethics guardrail).

### Greenfield signals

- Recent seed/Series A funding with a vague or unshipped mission.
- "Founding PM" / "0-to-1" job language in postings.
- Founder interview/podcast content about still actively exploring direction.

### Disqualifying signals

- A long-tenured exec layer paired with a roadmap that reads locked from above.
- Job-description language like "we know what we're building, just need execution."
- Anything that mirrors the HARD qualifier above: heavy internal politics blocking a change of
  direction, or a stated preference for someone to just execute the existing plan.

## Classification

Every client-kind lead resolves to exactly one of: `turnaround` | `greenfield` | `unclear` |
`disqualified`.

**"Unclear" (insufficient evidence) must be a real, surfaced outcome, never a forced guess** —
the same posture as a strategy brief flagging a channel INSUFFICIENT rather than guessing on thin
data. Do not round a thin or mixed evidence set up to `turnaround` or `greenfield` to make the
pitch report look more decisive than the research actually supports.

## Shared values — referenced, not duplicated

Worldview fit is the third leg alongside fit situation + HARD qualifier, but it is never
restated here. It lives once, canonically, in `config/platforms.yaml` (`home_brand.worldview`,
`home_brand.worldview_expanded`, `spin_angles`) and `config/voice.yaml`, plus Muxin's essays —
the QUALIFY step reads those directly. A values-fit claim in a pitch report must quote the
candidate's own words (with a link) demonstrating the shared belief; no quote means the values
leg is unmet, not assumed.
