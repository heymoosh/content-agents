# Funding + mission-aligned-role fit profile — Voter Choice

Origin: Muxin's direction (2026-07-24), given first to Boardy AI and repeated here so it's a
durable spec instead of something living only in a chat thread. This is the search-criteria
reference for anyone (Claude, `/scout`, a future person) evaluating a funding lead or a full-time
role opportunity for **Voter Choice** (https://voter-choice.vercel.app — a tool to help people
assess their congress members).

**Status: not yet wired into code.** `LeadKind` in `src/outreach/{intake,research,qualify,draft,
validate}.ts` is currently `client | platform | content-example` only — there is no `funding`
kind, and neither `/outreach research`/`qualify`/`draft` nor `/scout`'s discovery pass reads this
file yet. It exists now as the rubric Claude should apply whenever Muxin asks about a funding or
role lead by hand, and as the spec a future ratified build (see backlog) would wire in exactly the
way `clients.md`/`platforms.md` are already wired into `research.ts` — same closed-checklist,
quote-required-worldview-match, disconfirmation-pass discipline as the rest of the engine, once
that phase is scoped and ratified.

## Priority order

1. **Non-dilutive funding — first priority.** A funder, grantor, or sponsor who does NOT take a
   piece of Voter Choice's IP, product, or company. Legitimate forms: an institutional or major
   funder, a grant, or a sponsorship. This is a hard preference, not a tiebreaker — screen equity-
   seeking capital out of this lane entirely (it belongs in a normal VC/investor search, which is
   explicitly NOT what this profile is for).
2. **A great-fit full-time role — second priority.** A role that would react strongly and
   positively to this specific body of work, with salary emphasized over equity:
   - Hands-on founding or early product builder
   - Applied AI product builder or prototyping lead
   - Mission-aligned product IC
   - Paid founder- or builder-in-residence (salary-first, not equity-first)

## Four funding channels (what "funding opportunities" means here)

- **Investors** — angels, VCs, crowdfunding platforms. (Lowest priority per the non-dilutive
  preference above; only surface these if nothing non-dilutive exists, and flag the equity
  trade-off explicitly rather than treating an investor lead as equivalent to a grant.)
- **Grants** — federal, state, and local grant programs. A citable fit read should note why the
  program's mandate matches Voter Choice's civic/election-accountability mission, not just that a
  program exists.
- **Loans** — SBA loans, term loans, bank financing. Non-dilutive by nature, but note repayment
  obligations as part of the fit read (it's non-dilutive, not free).
- **Programs & accelerators** — cohorts and investor groups. See the founder-studio/residency
  caveat below before treating one of these as a fit.

## Founder studios, residencies, and accelerators — the equity caveat

Muxin would consider a founder studio, residency, or accelerator, but explicitly prefers NOT to
give up equity to get one. Screen these for whether the arrangement is equity-free (a paid
residency, a no-equity fellowship) before surfacing them as a strong fit; an equity-taking studio
or accelerator should be flagged as a trade-off, not presented as a clean match.

## What Muxin actually prefers instead

Sponsors, distribution partners with an audience this tool would already serve, or an
institutional underwriter who can receive findings — most likely reports on Voter Choice's impact
across election cycles. A funder or partner who wants exactly that kind of reporting relationship
(sponsor a civic tool, get the impact data back) is a strong fit signal, distinct from a generic
grant or investor lead.

## Worked example: Nava Labs

A philanthropically funded three-person team (designer/researcher, engineer, product manager)
that researches, builds, ships public prototypes, and publishes what it learns. This is the
model Muxin is pointing at: small, mission-driven, publicly-funded (not VC-funded), builds and
publishes in public. Use it as the calibration example for both funding-source fit (who funds a
team shaped like this) and role fit (what a paid position on a team shaped like this looks like).

## Example networking-contact archetypes

When evaluating a person (not a company/fund) as a lead in this lane, the useful roles are: a
founder, a hiring principal, a team lead, a trusted introducer, or a specialist recruiter. These
are routing/access contacts more than funders themselves — value them for who they can connect
Muxin to, not just for what they can offer directly (see `outreach/boardy-intros.md` for worked
examples of this exact pattern — e.g. a specialist recruiter surfaced as a routing connection
rather than a direct funder).

## Shared values — referenced, not duplicated

As with `clients.md`/`platforms.md`, worldview fit lives once in `config/platforms.yaml`
(`home_brand.worldview`, `home_brand.worldview_expanded`), `config/voice.yaml`, and
`config/outreach/worldview-map.md`. For this profile specifically, the current focus lens
(2026-07-24) is people and institutions tackling oligarchy and concentration of money in
politics — narrower than "civic tech" generally. A funding or role fit claim should be able to
cite this lens directly, the same quote-required standard the rest of the engine holds to.
