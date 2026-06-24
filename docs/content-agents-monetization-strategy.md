# content-agents — monetization strategy

What in this repo can be sold, to whom, in what order, and what we must fix or verify before we
can honestly sell it. Structured as a decision doc, not a pitch. Grounded in what is actually in
the repo as of 2026-06-24, with the gaps called out explicitly.

> Filing note: this lives in the repo because it was generated in a remote container that cannot
> write to a local Obsidian vault. To file it under `Personal Obsidian/Projects/Monetizing
> Projects`, copy this file out of `docs/`. The tracked gaps below are also filed as GitHub issues
> on `heymoosh/content-agents`.

---

## 1. Inventory — everything we could monetize

Across SaaS and services (setup → retainer → custom builds). This is the full surface, not the
ready-now list (see §2 for that).

| # | Asset | SaaS angle | Service angle |
|---|---|---|---|
| A | **Build 0 — strategy intelligence** (analytics in → SQLite → recency-weighted scoring, pillar×platform resonance, self-grading `bets.md` loop, routing) | "Analytics in, graded strategy brief out" hosted tool | Done-for-you weekly strategy brief |
| B | **Build 1 — atomization** (essay → extraction-first derivatives → review queue → scheduled publish via Typefully/YouTube/PostPeer) | Hosted atomizer with a voice/source-line UI | Done-for-you content operation (the retainer) |
| C | **Build 2 — fiction** (composed serialized prose, story bible/canon, per-chapter PR review loop) | Hosted "serialized fiction studio" | Ghost-showrunning a serialized series for an author |
| D | **The system itself** (the configured repo + skills) | n/a | One-time **setup/install** for another creator or agency |
| E | **Provider/adapter architecture** (cost-first model routing, `costUsd` logging, vendor-agnostic) | n/a | **Custom builds**: new platforms, new model adapters, vertical config packs |
| F | **The methodology** (extraction-first + self-grading-bets as a documented playbook) | Templates/course | Workshops, audits, "voice + pillar" onboarding |

---

## 2. Ready-now filter — what actually exists and is ready to sell *today*

Ignoring the roadmap. Ranked by how much real evidence exists in the repo.

**Genuinely runnable today (validated at least once):**

- **Build 0 strategy brief (A) — as a service.** Ran for real: `briefs/2026-06-16-strategy-brief.md`
  exists, generated from ingested analytics. The scripts (`snapshot`, `resonance`, `grade-bets`,
  `route`) all run. Sellable as a *one-off or weekly brief service* now. **Caveat:** the
  self-grading half has never completed a cycle (see §6).
- **Build 1 atomization (B) — as a service.** Ran for real: one piece
  (`content/2026-06-16-building-an-innovation-nation/`) produced ~17 derivatives with enforced
  `source_lines` traceability, scheduled into Typefully (real draft IDs in `publish-log.md`).
  Sellable as a done-for-you atomization service now, text + quote cards.
- **Setup/install (D) — as a service.** The repo runs; configuring it for one client is real work
  we can do today. This is the natural onboarding step for A or B.

**Exists but NOT ready to sell as "it works":**

- **Video shorts.** Code is wired end to end, but there is *no evidence any video was ever
  rendered* in this repo (no artifacts, and the path needs Kokoro/whisper.cpp/ffmpeg installed).
  Sell only after a real render is demonstrated.
- **Build 2 — fiction (C).** Scaffolding only: bible, outline, characters, canon, notes. **Zero
  chapters have been drafted.** The core claim (AI composes a publishable chapter) is entirely
  unvalidated. Do not sell yet.
- **The self-grading strategy claim.** Built, never exercised (§6).

**Not ready as SaaS at all.** Everything here runs inside Claude Code, a developer tool. There is
no hosting, auth, multi-tenancy, billing, or non-terminal UI. SaaS is a build, not an inventory
item.

**Bottom line:** what is ready to sell today is **services on Build 0 and Build 1, plus setup** —
operated by us, for a small number of creators. Nothing here is ready as self-serve SaaS.

---

## 3. Problem & buyer — for each launch-ASAP offering

### Managed content operation (Build 1 service) — the lead offer
- **Problem:** experts/founders write but cannot consistently turn one essay into a week of
  on-voice, multi-platform posts without it sounding like AI or eating their week.
- **Buyer:** thought-leader founders and solo experts who already publish (the "Muxin" persona).
- **Why us:** extraction-first means it is *their words*, traceably, not a model imitating them.

### Weekly strategy brief (Build 0 service)
- **Problem:** creators post into the void and cannot tell what is actually working or what to do
  next; dashboards report, they do not recommend.
- **Buyer:** the same founders, plus small content teams and boutique agencies who need defensible
  "what to double down on" guidance for clients.
- **Why us:** recommendations are concrete (cite real posts), recency-weighted (won't fossilize),
  and *designed* to be graded next cycle.

### Setup / install (service)
- **Problem:** a technical creator or agency wants this engine but can't stand it up and tune
  pillars/voice/routing themselves.
- **Buyer:** technically comfortable creators; agencies wanting a delivery multiplier.
- **Why us:** we built it; we can configure and hand it over with their first brief.

---

## 4. Rights & clearance — can we actually sell each of these?

Not legal advice. These are the checks to clear *before* taking money, with my read on risk.

**Source content rights**
- Selling derivatives of **Muxin's own** Substack essays: fine, he owns them.
- Selling the service to **clients**: contract must require the client owns/licenses their source
  content. Extraction-first *helps* here (it only ever uses the client's own words), but the
  onboarding needs an explicit rights clause. **Action: add a client content-rights clause.**

**Third-party API / platform terms (we operate on the client's behalf)**
- **Typefully:** API needs a paid plan; confirm their terms permit managing client accounts /
  agency use (each client likely needs their own subscription). *Verify.*
- **YouTube Data API:** uploading to a client's channel via their own OAuth is fine if they
  authorize it; must comply with YouTube API Services ToS. *Low risk, document consent.*
- **PostPeer (TikTok relay):** the whole TikTok path depends on PostPeer being a sanctioned relay.
  CLAUDE.md asserts this; it is an external dependency and TikTok ToS can change. *Verify, and
  treat TikTok as best-effort, not guaranteed.*
- **Image models (Riverflow, Nano Banana Pro, gpt-image):** commercial-use and output-ownership
  terms vary per model. Reselling generated images needs a per-model check. *Verify before charging
  for image deliverables.*
- **OpenRouter / Gemini / Grok (xAI):** commercial use of outputs is generally permitted; confirm
  current terms. *Low-to-medium risk.*
- **Kokoro TTS:** Apache-2.0 model, commercial use OK. *Clear.*
- **Remotion:** **this is the real licensing gotcha.** Remotion is free for individuals/small teams
  but requires a **paid company license** above a size/revenue threshold. If we render video as a
  paid service or company, we likely need that license. **Action: confirm Remotion licensing for
  commercial/service use.**
- **whisper.cpp (MIT), ffmpeg, better-sqlite3, etc.:** permissive; fine.

**The repo itself**
- **No LICENSE file.** If a setup SKU hands the client this code, we must decide a license (and
  honor the deps' licenses that ride along). **Action: add a LICENSE / decide distribution terms.**

**Highest-risk clearance items:** Remotion company license; per-image-model commercial terms;
PostPeer/TikTok reliance; missing repo LICENSE.

---

## 5. Differentiation / moat — and where we'd be overclaiming

**Real, verifiable differentiators:**
- **Extraction-first with enforced traceability.** Not marketing: `src/atomize/validate.ts` fails
  validation if a derivative lacks `source_lines`. Most "AI ghostwriters" can't claim "never
  composes in your voice" and back it mechanically. This is the strongest honest claim.
- **A self-grading strategy *design*.** The `bets.md` loop (falsifiable hypothesis per
  recommendation, recency half-life) is a genuinely uncommon design.

**Where we would be overclaiming (flag these):**
- **"Self-grading strategy that tells you when it was wrong."** True as a design, but it has graded
  exactly **zero** cycles. The brief itself says "no prior cycle to grade." Claim the *mechanism*,
  not a track record, until a cycle closes.
- **"Proven end-to-end content engine."** Validated on **n=1** piece, one creator (the author of
  the tool). Not yet shown to generalize to other voices/topics.
- **"Auto-generates video shorts."** No render has been demonstrated in this repo. Do not claim
  until proven.
- **"AI writes your serialized fiction."** Zero chapters drafted. This is currently vaporware-level
  for sales purposes.
- **"Moat."** Be honest internally: extraction-first and the bets loop are *copyable designs*, not a
  technical moat. The real, thin defensibility is the integrated, opinionated workflow plus
  accumulated voice/pillar tuning per client. Treat it as a **head-start**, not a durable moat.

---

## 6. Reality check — have we actually validated what we claim?

Brutally honest, especially the riskiest claims.

- **Riskiest claim #1 — the self-grading loop works.** **Not validated.** All four bets in
  `briefs/bets.md` are `status: open`; `grade-bets` has never produced a scorecard; the brief
  states there was no prior cycle to grade. We have built the loop and run the *first* half (record
  bets). We have never observed the second half (grade them and change behavior). Until one full
  cycle closes, this is an unproven mechanism.
- **Riskiest claim #2 — fiction composition.** **Not validated at all.** No chapter exists. The
  drafting mode (`prose: claude-native`) has never run to a finished chapter in this repo.
- **Atomization quality.** **Partially validated.** One real piece, derivatives produced and
  pushed to Typefully as drafts. We do *not* have evidence those drafts were published or how they
  performed. Quality across varied inputs/voices is untested (n=1).
- **Video pipeline.** **Not validated.** Wired, never demonstrably rendered.
- **Strategy brief usefulness.** **Weakly validated.** One brief exists and is coherent, but its
  recommendations have not been tested against outcomes (same gap as the bets loop).

**Net:** the two flashiest selling points (self-grading strategy, AI-composed fiction) are the
*least* validated. The least flashy points (extraction-first atomization to scheduled drafts,
a coherent first strategy brief) are the *most* validated. Sell the boring, proven parts; fix the
flashy parts before they go in a pitch.

---

## 7. Sequence by distance-to-revenue

Closest to cash first.

1. **Setup + managed content operation (Build 1 service).** Real today, high margin, recurring.
   Distance: ~0. Only needs a packaged onboarding + pricing.
2. **Weekly strategy brief (Build 0 service).** Real today; can bundle into #1 or sell standalone.
   Distance: ~0, once we stop overclaiming the grading track record.
3. **Custom builds (new adapters/platforms/vertical packs).** Architecture already supports them
   cheaply; sell opportunistically as clients ask. Distance: low, per-project.
4. **Video as a premium retainer tier.** Distance: short — needs one proven end-to-end render +
   Remotion license check.
5. **Fiction service (Build 2).** Distance: medium — needs at least one full drafted+reviewed
   chapter before it can be sold.
6. **SaaS (Build 0 slice: analytics-in → graded brief-out).** Distance: far — needs auth,
   multi-tenant storage, a non-terminal UI, billing, and a closed grading cycle to justify the
   headline. Fund it from services; build it last.

---

## 8. Tracked gaps (filed as GitHub issues)

Each blocks an honest sale of the offering noted.

- **G1 — Close one full strategy-grading cycle** so the self-grading claim is real (blocks #2, #6).
- **G2 — Draft + review one complete fiction chapter** to validate Build 2 (blocks #5).
- **G3 — Demonstrate one end-to-end video render** and capture proof (blocks #4).
- **G4 — Add a repo LICENSE / define setup-handover distribution terms** (blocks #1 setup SKU).
- **G5 — Confirm Remotion commercial/company-license requirement** for paid/service rendering (blocks #4).
- **G6 — Audit per-image-model commercial-use + output-ownership terms** (Riverflow, Nano Banana, gpt-image) (blocks paid image deliverables).
- **G7 — Verify PostPeer/TikTok and Typefully terms for agency/multi-client use** (blocks the TikTok/multi-client retainer).
- **G8 — Templatize onboarding (pillars/voice/routing/CTA from a questionnaire) + client content-rights clause** (unblocks repeatable #1).
- **G9 — Validate atomization beyond n=1** (multiple inputs/voices) before claiming a general engine.

---

## 9. Recommendation

Sell the **managed content operation** first, with **setup** as its onboarding step and the
**strategy brief** bundled in. These are the only offerings fully real today, they are high-margin
and recurring, and they lead with the one claim we can actually back in code (extraction-first).
Take **custom builds** opportunistically. Fix G1–G3 before the flashy claims (self-grading, video,
fiction) ever appear in a pitch. Defer **SaaS** to a single Build 0 slice, funded by services and
built only after a grading cycle has actually closed.
