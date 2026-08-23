# Content system blueprint

**Status:** Directional architecture, 2026-08-23

## What this system is

Content-agents is an evidence-backed, multi-platform content operating system. It is not only a
pattern library and it is not an autopilot. Muxin supplies the claims, observations, judgment, and
voice. The system organizes research, produces useful cuts and platform treatments, records what
happened, and turns tested signals into better Venture decisions.

The core path is:

```text
raw thought / essay / Substack
  -> message cuts
  -> per-platform, per-format variants
  -> human review
  -> approved publish
  -> metrics and comments
  -> experiments and signals
  -> Venture learning
```

Every meaningful step should leave an inspectable artifact. Nothing publishes without human
approval. Metrics can inform a decision, but they do not silently rewrite the voice, routing, or
strategy.

## Research and evidence model

The source and account catalog is the shared index for external examples and internal learning.
Each record should carry:

- creator or account, platform, and handle
- source kind, such as post, thread, essay, video, comment, or account profile
- audience size, audience type, date, and provenance
- granular multi-label topics
- formats and media
- popularity scope: niche, platform-wide, format, account-relative, or community
- evidence quality, collection date, and caveats

Popularity is always scoped. A post that is strong within one account is not automatically a
platform-wide winner. The catalog should preserve the denominator, the comparison group, and the
reason a record was included so later analysis can distinguish observation from inference.

Research stays in three separate pools:

1. **Niche winners:** examples that perform unusually well for the relevant subject or audience.
2. **Broad platform-wide winners:** examples that help us understand wider platform behavior,
   even when the topic is unrelated.
3. **Format or medium winners:** examples selected for the mechanics of a medium, such as a
   short video, quote card, carousel, thread, or newsletter opening.

These pools can contribute different hypotheses. They must not be blended into one universal
ranking or treated as interchangeable evidence.

## Adaptation boundary

It is valid to reuse a popular hook family, opener shape, rhythm, or mad-lib-style template when
the new copy is materially original and uses Muxin's own claims and voice. The system can learn
that a pattern such as a tension opener followed by a concrete example and a soft invitation often
helps a format. It cannot turn a creator's words into a noun-swapped phrase bank.

Exact creator text remains analysis material, quoted material, or licensed material. It is not
drafting material for substitution. Research outputs should describe the structure, trigger,
sequence, pacing, and conditions of success, with short quotations only when needed for analysis.
Internal candidates must be checked for originality, source traceability, and fit with Muxin's
voice before review.

## Human Inference and testable lanes

Human Inference is the positioning center: making human judgment, meaning, and responsibility
legible in an AI-shaped world. It is a lens for deciding which claims are worth testing, not a
license to force every post into one slogan.

Adjacent lanes are hypotheses to test, not settled brand pillars:

- AI building
- product thinking for social problems
- ADHD and nonlinear work
- mission-driven solopreneurship
- AI and public trust
- civic systems and power
- founder sustainability and meaning

The system should record which lane, claim, audience, platform, format, and experiment variable a
piece addresses. It should also make it easy to say that the evidence is too thin to generalize.

## Shared path and skill architecture

The common path should be lightweight and called **Grow-this** at the surface. It should help a
person move from an idea to a reviewed, learnable content experiment without exposing every
specialized engine or requiring a taxonomy lesson.

Under that path, keep the engines and simplify the surface:

- develop and brand-lens are lenses that recommend or check, not hidden authors
- atomize remains the internal format engine, surfaced as formatting for platforms
- patterns provide background intelligence for research and adaptation
- video, publish, Venture, strategy, and signals remain specialized layers
- story, outreach, Charles, and other separate systems remain separate

The surface should show the message being shaped, why a treatment was suggested, what needs human
judgment, and what evidence will be collected. Plumbing such as routing notes, line citations, and
internal pattern IDs belongs behind the conversation, while remaining available for audit.

## Experiment and feedback loop

High-volume experimentation happens internally. The system generates candidate variants, attaches
explicit experiment variables, and presents reviewed variants for approval. Variables may include
the opener family, claim angle, format, medium, audience lane, CTA, length, or platform treatment.
The publish record must preserve those variables so outcomes can be compared later.

The system must not call weak samples universal. It should report sample size, comparison scope,
collection date, missing data, and caveats. Signals should keep attention, conversation, audience,
and business outcomes distinct. A comment is an observation that may inform Venture, not proof that
clears a Venture evidence gate. Comments can suggest a question, a problem, or a follow-up test;
Venture still requires its own documented evidence and human decisions.

## Phased roadmap

**Phase 1, blueprint and inventory.** Document the shared vocabulary, source catalog, three
research pools, adaptation rules, current skill boundaries, and evidence caveats. Connect the
existing seeded material without broad scraping.

**Phase 2, evidence-aware research.** Normalize catalog records, preserve provenance, separate
popularity scopes, and make pattern summaries cite their source records. Add lightweight review
surfaces for research quality and originality.

**Phase 3, Grow-this experiments.** Route one source through cuts, platform and format variants,
review, approved publishing, and outcome capture. Store explicit experiment variables and make
signals readable without collapsing them into one score.

**Phase 4, Venture learning.** Feed qualified patterns, audience observations, and business
signals into Venture as inputs. Keep comments and engagement as observations until Venture's own
evidence gates are met. Let Muxin adopt or reject strategic changes.

## Current state and boundaries

The branch currently has 352 seeded target rows across 13 configured platforms, 292 corpus entries
across 13 corpus platforms, 31 hook patterns, and 47 full-post records. Coverage is incomplete.
These counts are inventory facts, not proof that the research is representative or that any pattern
is universally effective.

This slice does not include a repo-wide rewrite, a universal virality score, automatic publishing
or replies, or broad scraping. It does not replace the existing specialized builds, weaken human
review, or make exact creator text reusable. Those boundaries are part of the architecture.
