# Develop log — Building an Innovation Nation

## Round 1 — advisor (2026-09-10)

Most of the piece's obvious lines are already spoken for: linkedin-1/2, x-1 through x-7, six
bluesky posts, six quote cards and the community post between them cite L10, 20, 22, 44, 46,
48, 50, 56, 60, 78, 94, 98, 104, 106, 108, 118, 120, 122, 133, 135, 137. This round goes after
what's left unmined, four sections nobody has cut from yet.

**r1-c1 — Belief under audit: shareholder value is how you measure a well-run company.**
Reader: a LinkedIn manager who assumes quarterly shareholder pressure is just what good
governance looks like. Payoff: a citation trail, Welch calling it "the dumbest idea in the
world," Buffett/Dimon on short-termism, the 2019 Business Roundtable's 181-CEO reversal, Ries's
*Incorruptible*, to name what's happening when long-horizon work loses to this quarter's number.
Altitude: professional -> linkedin. Observable: pull up the Business Roundtable statement and
check it against your own company's last earnings call, under 10 minutes. Lines L57, L59.
Lens: `shareholder-primacy`.

**r1-c2 — Belief under audit: our innovation problem is a talent shortage, not a funding
structure.** Reader: a builder or PM losing ambitious work to the current roadmap. Payoff: a
named list of exactly what quarterly incentives starve, foundational research, workforce
training, customer discovery, new-category bets, infra upkeep, so the pattern has a name.
Altitude: professional/technical -> linkedin or x. Observable: pick one item and check if your
own roadmap actually funds it. Lines L51-55. Lens: `rnd-starvation-list`.

**r1-c3 — Belief under audit: founders succeed because they had the right idea.** Reader:
career-work/builder audience wondering if they have "what it takes." Payoff: a concrete,
learnable checklist, resilience, questioning assumptions, talking to customers early, tolerating
ambiguity, that recasts founder success as trainable behavior. Altitude: professional ->
linkedin. Observable: audit your last quarter against the 9-item list. Lines L29-31, L35-43.
Lens: `founder-checklist`.

**r1-c4 — Belief under audit: wealth reflects merit when the game is actually fair.** Reader:
technical/contrarian X audience skeptical of "wealth = value created." Payoff: not just the
conclusion, the actual simulation to run. Altitude: technical -> x. Observable: the piece
already built the cheapest test there is, a 100-agent coin-toss wealth simulation at the linked
URL, watch extreme concentration emerge from a fair 50/50 coin toss in under a minute. Deliberately
distinct from x-1 and quote-card-2, which extract the conclusion sentence (L78/L94); this one
leads with the run-it-yourself setup instead. Lines L81, L83, L93. Lens: `yard-sale-observable`.

**r1-c5 — CTA sense-check.** Content type reads as `society_capitalism_piece` per
config/content-types.yaml, which pairs primary=source, secondary=project. The piece's own
project, the voting-history tool at L138-140, is real and already wired into
derivatives/community-democratic-resilience.md through the civic-tech routing override. Nothing
to ask Muxin here, nothing invented.

**r1-c6 — Platform spin fit.** x and linkedin: weak fit for their case-beat templates (no single
tool-plus-number scene, no literal quoted belief from a named practitioner), so both correctly
fall back to non-case extraction, matching how the shipped posts already read. mastodon: strong
fit for r1-c1, "you already questioned one entrenched system, now question this one."
threads: strong fit for r1-c3's personal "what it actually takes" framing. substack: strong fit,
the whole essay already is the builder-philosopher thesis. bluesky: strong fit, the inequality
material plus the civic close match the democracy-as-broken-UX angle directly.

**r1-c7 — Routing preview, with a caveat.** `npm run route -- --brand human-inference --pillar
human-ai,civic-tech` failed under the sandbox (tsx's IPC listener hit EPERM), and the unsandboxed
retry was denied, so this round reports from the existing routing.md (2026-06-16) and a direct
read of config/routing.yaml instead of a fresh live run. Pillars read as human-ai (primary),
civic-tech (secondary, via the voting-tool close), matching extracts.md. Worth flagging:
config/routing.yaml's rules block now reads `human-ai: never: [x]`, dated 2026-09-07, after this
piece's original routing pass. A routing preview run today would exclude x for human-ai, which
would contradict the 7 already-published x-1 through x-7 posts filed under this pillar.
civic-tech's rules already match what shipped. Worth a live re-run once the sandbox allows it.
