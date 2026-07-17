# Develop log — Why do we seem to fear AI more than we fear power?

## Round 1 — advisor (2026-07-17)

### Angles

**r1-c1 · Belief under audit: limiting frontier AI is what creates a permanent underclass**
(lens `gini-check`, source line 13)
Reader: the X and tech crowd worried that capping frontier models locks in economic inequality.
Payoff: the underclass already exists, so the fear is pointed at the wrong target. Technical
altitude, maps to X. Observable: look up the current US Gini wealth index yourself, one search,
under a day. The verbatim carrier is line 13 ("being poor in America is already a permanent
underclass, and when was the last time you looked at the US Gini wealth index").

**r1-c2 · Belief under audit: meeting a real threat requires granting supernormal powers**
(lens `power-audit`, source lines 15, 17)
Reader: the civic and political audience worried about emergency power consolidation riding in on
AI. Payoff: a concrete question to chase, has any society ever answered a genuine threat without
handing over supernormal powers. Society and political altitude, maps to Bluesky. Observable:
find one historical case in an afternoon of reading. Carried by line 15 (the emergency-power
question) and line 17 (the challenge of power "as old as civilization").

**r1-c3 · Belief under audit: you can only argue about wealth and power, you cannot test the assumptions**
(lens `assumption-check`, source lines 19, 21-23)
Reader: practitioners and builders who hold strong priors about society, wealth, and power.
Payoff: they can check those priors against real data now, hand the problem to Claude and its
datasets instead of trading vibes. Professional and builder altitude, maps to LinkedIn.
Observable: take one belief you hold about wealth or power and ask Claude to check it against the
data, under a day. Carried by line 19 (giving social problems to Claude to test assumptions) and
lines 21-23 (modeling power structures with agents and incentives).

### CTA sense-check

**r1-c4** — Reads as `society_capitalism_piece` (society-level inequality and power), with the
rogue-AI and agency thread also fitting `ai_agency_thesis`. Both resolve the primary CTA to
`source` (the note's own `canonical_url`). No `project_url` is present and none should be guessed.
Open question for Muxin: on the power-consolidation angle (r1-c2), do you want the voting tool
attached as a project CTA (a literal civic-tech override), or keep it source-only? I will not
invent a project link.

### Platform spin fit

**r1-c5**
- **X (tech):** strong. The Gini angle names a real observable, not a generic "AI is like X" gloss.
- **Bluesky (political):** strong. Power-consolidation and the fairness gap are its approved angle.
- **LinkedIn (business/career):** partial. No work scene with a number plus a literally quoted
  belief, so it fails beat 2 of the case template. Fall back to normal extraction, not a forced case.
- **Substack (society):** the builder-philosopher angle fits the material, but Substack essays are
  not a routing target here.

### Routing preview

**r1-c6** — Pillars: **human-ai** primary (critique of hype-driven AI fear, who is harmed),
**civic-tech** secondary (power, democratic resilience). I could not run `npm run route` this
session (the shell is blocked by an OS permission error on `~/.claude/session-env`), so this is
read from `config/routing.yaml`, not the deterministic CLI. At cold start (INSUFFICIENT data) the
union of the pillar defaults is **x, linkedin, bluesky**, plus **community:democratic-resilience**
from civic-tech's `always` rule. `quote-card` is always generated. Re-run the route CLI to confirm
before formatting.
