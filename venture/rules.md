# Venture rules

**Status:** Confirmed by Muxin (2026-08-18) — all §12 open items resolved. Phase 1 build resumed
2026-08-18; `venture/rules.yaml` (Phase-1-scoped) is the runtime input phase scripts load — see
`src/venture/rules.ts`.

**Rules version:** `venture-rules-2026-08-07-draft-1`

**Purpose:** Define the reusable rules that govern every Venture run. Phase scripts and prompts may read this file. They must not read a worked example as if it were a rule.

## Sources and precedence

This file distills two fixed source snapshots:

1. **Required process:** `The_Solo_Business_Starter_Kit.pdf`
   - SHA-256: `773250cefd3ec8a8dfd86b1f6247f9005dd1f1bda47a0c5171a6f6236722ecc6`
   - 8 pages
2. **Decision logic and operating guidance:** `One-Person Business Engine (Justin Welsh Session).md`
   - SHA-256: `bad486c48b8477a9ae3c92fae3cd1c40dded1dc6cda483a5f297ddbb6da81df3`
   - 1,567 lines

Precedence:

1. The PDF controls the four phases, required sequence, deliverables, and stop conditions.
2. The Welsh notes supply the decision rubrics and operating advice the PDF does not spell out.
3. Repo-level safety, voice, review, and publishing rules still apply.
4. A venture's own intake, signals, and audience responses control its actual recommendations.
5. Worked examples are fixtures only. They never control a new venture.

If a source changes, create a new rules version and record the new source hash. Never change the meaning of a version already stamped into a venture.

## Normative language

- **MUST** means the rule is required.
- **MUST NOT** means the behavior is prohibited.
- **SHOULD** means follow the rule unless the user makes a recorded exception.
- **MAY** means optional.
- **PROPOSED** means Muxin must confirm the product decision before this draft becomes final.

## 1. Venture boundary

1. Venture is a composition-permitted workflow. It may draft original posts, lead magnets, pages, emails, surveys, offers, and operating plans.
2. Composition is allowed only because Muxin reviews every user-facing draft and makes every final business decision.
3. Nothing publishes, sends, or becomes a locked business decision without Muxin's explicit action.
4. A generated recommendation MUST remain visibly distinct from Muxin's own words.
5. A user edit becomes the user's version. The system MUST preserve that authorship distinction.
6. The runtime MUST read the current venture's intake and locked decisions before every judgment step.
7. The runtime MUST stamp the rules version and source hashes into the venture at kickoff.
8. A worked example MUST NOT be loaded into the runtime context for a clean venture.

## 1A. Cross-system rules — Venture, Content, and Signals

These govern how Venture sits inside the wider six-room product (`docs/content-studio-vision.md`),
not the 14-day phase logic itself. Locked 2026-08-07, alongside the room-placement decision in §12.

1. Venture is a permanent top-level room. It is not a temporary mode inside Studio and this is not
   open for reconsideration in a future revision of this file.
2. Venture-generated content and direct Studio content share one Content execution engine — the same
   cut, lens checks, Format for platforms, Review, and publish gate. Venture does not get a second,
   parallel content pipeline.
3. A Venture's primary content item (the live Phase 1 post, the Phase 2 lead magnet post, etc.) must
   clear its own review/approval/delivery requirements before its optional cross-platform derivatives
   are required. A derivative shares lineage with the primary item but does not itself have to pass
   the Venture phase checkpoint.
4. Brand pillars are editorial and identity guardrails. They are not automatic routing kill switches.
   Weak engagement on a pillar or platform produces a recommendation or a divergence flag for Muxin
   to review — it never silently disables the pillar or the platform.
5. Attention (impressions, reach), conversation (replies, comments, saves), audience (landing visits,
   opt-ins, survey responses), and business (qualified inquiries, calls, opportunities, purchases)
   stay four separate outcome families. Nothing in Venture or Signals collapses them into one score.
6. A low-reach or low-engagement item that produces a subscriber, a qualified lead, a call, or a sale
   is surfaced as a business result, not labeled an unsuccessful post. Engagement numbers never
   overrule a recorded business outcome.
7. CTA strategy for Venture-generated content follows the venture's current phase, its active
   business asset (lead magnet, offer, project), and whether the CTA actually fits this specific
   message. Platform engagement does not select the CTA. See the locked CTA policy table below.
8. Direct Studio content does not inherit a Venture's CTA policy unless that content is explicitly
   attached to the Venture. Unattached Studio content gets a CTA sense check that may recommend no
   CTA, a source, or a relevant project — never a Venture-stage lead magnet or offer it has no
   relationship to.
9. One social item carries one clear ask, or none. Never stack unrelated CTAs on a single piece.
10. Every automated recommendation — platform fit, media mix, cadence, framing, CTA — stays
    recommendation-only and approval-gated. Nothing here authorizes an automatic content-engine
    change without Muxin's explicit adoption.

**Authority note (Muxin, 2026-08-07).** This file, `docs/venture-build-plan.md`, and
`docs/venture-schema-contract.md` are the authority for Venture CTA and strategy behavior.
`docs/content-agents-backlog.md` is not, and neither is Lever E (`d80411bc`) — that card's
engagement-proxy CTA methodology predates this policy and has not yet been superseded on the live
board. Do not read it as current. Its engagement data stays valid as evidence; it never selects a CTA.

### 1A.1 Locked CTA policy by phase

| Venture phase | CTA policy |
|---|---|
| Phase 1 — test the problem | Reply prompt by default. "No CTA" only as a rare, intentional control — see below. |
| Phase 2 — build the owned audience | Bridge to the relevant active lead magnet. |
| Phase 3 — validate the offer | Normally the lead magnet or a response request. Show an offer only after the response gate and the required approvals (§7.10) have cleared. |
| Phase 4 and later — grow the business | The relevant lead magnet, an approved offer, a project, or no CTA, chosen by the item's actual purpose. |

Direct Studio content attached to a Venture follows this table for that Venture's current phase.
Direct Studio content with no Venture attached does not use this table at all — see rule 8 above.

**Fixed 2026-08-07 (corrective pass): the Phase 1 "no CTA" contradiction.** §5.3 requires every
required Phase 1 post to end with a short conversational question or reply prompt — a probe that
generates no research signal isn't doing its job. "No CTA" for a Phase 1 post is therefore NOT a
routine option; it MUST be a deliberate, recorded exception (e.g. a rare piece Muxin explicitly wants
to run without inviting replies), captured with its reason in that post's decision record
(`venture-schema-contract.md` §2A `rationale`), the same way §5.2's distinct-unknown-coverage repeats
are recorded rather than silently allowed. Absent a recorded reason, every required Phase 1 post
carries a reply prompt.

## 2. Global operating rules

### 2.1 Sequence

1. Complete intake before Day 1.
2. Work one phase at a time.
3. Do not open a later phase until the current gate or completion condition allows it.
4. Present one deliverable or decision at a time.
5. Get Muxin's approval, revision, or rejection before presenting the next dependent deliverable.
6. Stop at every gate. Never infer that a user completed a manual step.

### 2.2 Context

Every recommendation and draft MUST use:

- the current intake;
- the selected audience;
- creator proof;
- voice evidence;
- sustainable time budget;
- locked platform and offer decisions;
- available post signals;
- available audience responses;
- the rules version stamped at kickoff.

If required context is missing, ask for it. Do not fill it from a worked example.

### 2.3 Calendar

Track these values separately:

- planned phase day;
- elapsed calendar day;
- active work day;
- days blocked while waiting for responses or external setup.

If the user falls behind, move the schedule and preserve the sequence. Never advance a phase to protect a date.

### 2.4 Copy blocks

1. User-facing copy MUST be delivered in labeled fields that match its real destination.
2. Each field MUST be editable before approval.
3. The interface MUST say where the field goes in plain language.
4. A longer vendor-specific field list MAY be offered as a checklist. It MUST NOT become the core schema unless that provider is chosen.

## 3. Content and voice standards

Every user-facing draft MUST pass these checks:

1. **Plain language:** short sentences, familiar words, no marketing hype.
2. **One idea:** one narrow problem or lesson per asset.
3. **Specificity:** use concrete actions, numbers, examples, and named outcomes.
4. **Immediate value:** help the intended reader learn, feel understood, or take one useful step.
5. **Authentic voice:** use the creator's worldview, proof, natural phrases, and edits.
6. **Recognizability:** if the draft could belong to any creator, revise it.
7. **Fifth-grade clarity:** aim for sentences below 16 words and one idea per sentence. A readability score is a warning, not a substitute for human review.
8. **No AI tells:** follow `config/voice.yaml`. Do not use em dashes.
9. **No invented proof:** do not create results, stories, customer language, or experience.
10. **No hidden AI prose:** generated text never enters an approved artifact without review.

Necessary topic terms MAY exceed fifth-grade vocabulary. Define them the first time and keep the sentence around them simple.

### 3.1 Post writing order

Draft posts in this order:

1. **Body:** write the lesson, observation, comparison, prediction, process, or concrete action first.
2. **CTA or reply bridge:** choose the next useful action.
   - Before the lead magnet exists, use a short reply prompt that produces a story, example, question, or stuck point.
   - After the lead magnet exists, add a natural bridge that explains why the lead magnet extends this post.
3. **Hook:** write the opening last. Use a proven pattern only when it fits the body and the creator's voice.

Do not add a lead-magnet CTA to a post it does not naturally extend.

## 4. Day 0: intake

Intake happens before the 14-day clock. Nothing drafts until intake and the Day 14 scorecard are complete.

### 4.1 Interview behavior

1. Ask one question at a time.
2. Save each answer without rewriting it.
3. Let the user pause and resume at the same question.
4. Let the user inspect and correct prior answers.
5. A question from the user does not count as an answer to the active interview question.
6. Synthesize the completed answers only after the original wording is safely stored.

### 4.2 Required 25 questions

#### Block A: what are we building?

1. What are you helping people do?
2. Who will you help first?
3. What problem do they already know they have?
4. What do you think is broken for them?
5. If this works, what gets better for them?

#### Block B: what makes you credible?

6. What have you built, shared, taught, or tested?
7. What proof shows that people care?
8. What have people thanked you for?
9. What do you know from experience that others often miss?
10. What proof should we keep using?

#### Block C: what does the audience feel?

11. What frustrates them now?
12. What do they waste time trying to learn?
13. What do they not trust?
14. What do they want to do but keep putting off?
15. What words do they use when they talk about this problem?

#### Block D: what can the creator sustain?

16. What format feels easiest for you: writing, video, audio, live teaching, demos, or templates?
17. What can you make in under an hour and still enjoy?
18. Which platform feels most natural?
19. Which platform would tire you out fastest?
20. How much time can you give this for the next 14 days?

#### Block E: what might the first offer become?

21. What should the first paid offer be: a guide, toolkit, short course, community, coaching, or software-supported product?
22. What small win can someone get in 10 minutes?
23. What bigger win can someone get in one or two weeks?
24. What must this business never become?
25. What would make the first 14 days worth continuing?

Question 21 records a hypothesis. It MUST NOT preselect the final product format before audience evidence arrives.

### 4.3 Required voice evidence

After the 25 questions, collect:

- one to three representative writing samples or source links;
- a short statement of the creator's worldview or repeated idea;
- phrases the creator naturally uses;
- phrases, tones, and tactics the creator refuses to use;
- any existing voice configuration or brand rules.

The system SHOULD learn from later edits. It MUST NOT overwrite the original voice evidence.

### 4.4 Day 14 scorecard

Fix the scorecard before Phase 1. Store both the user's answer to question 25 and structured fields.

Required scorecard fields:

- required number of live Phase 1 posts;
- ongoing posting pace;
- qualified views or clicks target, or `learning_only` when no baseline exists;
- landing-page opt-in target, or `learning_only`;
- eligible unique response target: minimum 20, target 30;
- response-quality test;
- sustainability test against the declared time budget;
- final decision options: continue, revise positioning, revise lead magnet, collect more evidence, or stop.

The system MUST NOT invent a target when the user has no baseline. It may recommend a learning target and explain why.

## 5. Phase 1: Attention, days 1-3

**Goal:** Choose one primary platform, then run public qualitative discovery — not selling — by publishing three native posts, one per day, each testing a specific open question about the audience.

### 5.1 Platform recommendation

Use exactly these three filters:

1. Where the target audience already pays attention.
2. What format the creator can produce consistently.
3. Which platform carries the lowest burnout risk.

Required output:

- one recommended primary platform;
- evidence from intake for each filter;
- meaningful alternatives considered;
- why the recommendation won;
- known risks or uncertainty;
- a user action to accept or choose another platform.

The system MUST recommend one primary platform. It MUST NOT recommend a multi-platform launch during this phase.

If Muxin overrides the recommendation, store the selected platform and her reason. Later steps use her selection.

### 5.1A Research framing — Phase 1 is discovery, not selling

Added 2026-08-07; formalized into a structured plan in the same-day corrective pass. Phase 1 posts
are public qualitative discovery instruments before they are anything else. Their job is to test what
is still unknown about the audience, not to convert or persuade.

**Before drafting any idea**, the system MUST assemble a `phase_1_research_plan`
(`venture-schema-contract.md` §2C.1) from intake, existing proof, prior published work, and any
credible outside research the creator already has:

- **confirmed knowns** — facts and evidence already established about the audience's problem, each
  citing what supports it and carrying an explicit `confirmed_by_muxin` flag. An AI-asserted "this is
  already known" with no cited evidence and no confirmation from Muxin does not count as confirmed and
  MUST NOT excuse skipping a test;
- **open unknowns** — the remaining unknowns, each tagged with which dimension it falls under (see
  below) and given a priority;
- **probes** — for each candidate idea, the specific unknown it targets, the hypothesis being tested,
  the exact conversation question, and what evidence would be informative either way.

**The plan MUST be reviewed by Muxin before any probe is drafted into a post.** This is not the same
requirement as the plan simply existing. A system-drafted plan sitting unreviewed does not authorize
drafting — see §5.2's gate and `venture-schema-contract.md` §5.1's `phase_1_research` object.

**Do not retest a broad problem the creator already supports with credible research.** If a confirmed
known already establishes that the audience feels a given problem, a Phase 1 post MUST NOT spend its
one test re-proving that. Point the sprint's limited tests at what is genuinely still open — the plan's
open-unknown dimensions are, typically:

- the audience's **emotional frame** around the problem (how they feel about it, not just that they
  have it);
- the **specific help or job** they want done (what "solved" looks like to them, in their terms);
- which **behavior-based audience segment** actually responds (not a demographic guess — who shows up
  when this is posted);
- an `other` dimension for a venture-specific unknown that doesn't fit the three above.

**The civic-tech worked example's specific categories stay in that fixture.** Its emotional-frame and
audience-segment language ("civically awake but not performative," "anti-corruption but not
partisan," and similar) illustrates the method. It MUST NOT become a universal default category set a
new venture's research reaches for — a clean venture derives its own categories from its own intake
and its own audience, every time.

### 5.2 Generate and rank ten ideas

Generate ideas from:

- audience questions and frustrations;
- creator wins, lessons, observations, and solved problems;
- creator proof and direct experience;
- relevant questions on community sites or search sources;
- a different take on relevant public content;
- the creator's prior high-signal posts;
- the current venture's locked context.

Do not copy another creator's phrasing or claim.

Generate ten distinct ideas. Rank each idea on four factors:

1. **Personal stake:** does the right person already feel this?
2. **Specificity:** is there a narrow action, example, number, or decision?
3. **Identity signal:** can a reply help the reader express who they are or want to be?
4. **Easy reply:** can the reader answer with a story, example, question, or stuck point in one or two sentences?

For each idea, record:

- a short title;
- the narrow problem;
- the concrete takeaway or action;
- the proposed reply prompt;
- the four factor scores and rationale;
- evidence from intake or existing signals;
- **the specific unknown this idea tests** (§5.1A) — an idea that only retests an already-evidenced
  broad problem MUST be flagged as such rather than presented as equal to a genuine probe.

**Operational scoring:** use a 1-5 scale for each factor and show all four scores. The total may help order ideas, but it MUST NOT silently decide the user's selection. Ties should remain visible.

Let the user select exactly three. Bank the other seven. Do not delete them.

**Distinct-unknown coverage.** Added in the same-day corrective pass; closes a gap the four factors
above don't cover on their own — they optimize for reply likelihood, and nothing stops the top three
ranked ideas from all probing the same unknown, which would yield three good posts and a narrow
research read. When the three are selected, the ten-idea decision record
(`venture-schema-contract.md` §2A) MUST show which `unknown_id` (§2C.1 of that contract) each selected
idea probes. If two or more of the three target the same `unknown_id`, the decision record's
`rationale` MUST state why deliberate repetition is more valuable here than covering a second priority
unknown — a recorded exception, not a silent default. The system surfaces the overlap; it does not
auto-select for coverage over Muxin's actual choice (`venture-schema-contract.md` §2C.5).

### 5.3 Draft the three posts

Draft one post at a time.

Each post MUST:

- fit the chosen platform;
- remain below 150 words for the Starter Kit sprint;
- teach or convey exactly one useful idea;
- include one concrete takeaway or action;
- use short sentences and plain words;
- sound like this creator;
- end with a short conversational question or reply prompt.

Run the post writing order in section 3.1.

Do not call a sub-150-word post “long-form” in the user interface.

### 5.4 Publish and pace

1. Publish one approved post on each of days 1, 2, and 3.
2. Record live evidence for each post.
3. Set the ongoing pace at five posts per week.
4. Continue keeping an idea bank.
5. For the ongoing weekly loop, collect about 15 ideas, rank them, select five, and bank the rest.
6. A 60-90 minute batching session is a recommended option, not a hard gate.

### 5.5 Checkpoint 1

Checkpoint 1 clears only when:

- exactly three required Phase 1 posts are editorially approved;
- all three are confirmed live with evidence;
- the ongoing pace is recorded.

Approval alone does not clear the checkpoint.

**OPEN-P1-FORMAT:** The exact mix of Substack posts and Notes remains a product decision. Store it as configuration. Do not encode the existing worked-example mix as a universal rule.

### 5.6 Phase 1 research read

Added 2026-08-07; extended in the same-day corrective pass to name the formal artifacts and decision
this section previously only described in prose. Checkpoint 1 proves the posts are live. It does not
by itself prove anything was learned. Before Phase 2 concept generation begins (§6.2), the system MUST
produce a `phase_1_research_read` (`venture-schema-contract.md` §2C.3) built from the private evidence
record and drive it through a real decision — not stop at "a read artifact exists."

**Ingest every available signal, not one channel, and keep the ingest itself as a record.** Each
observation — a metric pull, an essay comment, a Note reply, a DM, an email reply, a subscriber-count
move, a follow-up question, or the creator's own qualitative note — is written to the account-level
`research_observations` store (`venture-schema-contract.md` §5.4a) as it comes in, not summarized
straight into the read. That store is the evidence record the read is synthesized from:

- Substack native metrics (views, likes, restacks);
- essay comments;
- Note replies;
- DMs;
- email replies;
- subscriber-count movement;
- follow-up questions from readers;
- the creator's own qualitative observations — things noticed that don't reduce to a number.

**Round-3 change: the evidence store is account-level, and each venture links to it.** Observations
are not filed inside one venture's folder. They live once, account-wide, in
`research_observations`; each venture writes `evidence-links.jsonl` lines pointing at the ones it
uses, carrying the judgments that are specific to that venture — `evidence_role`, `unknown_ids`, and
`target_audience_fit` (`venture-schema-contract.md` §5.4b). This is what lets the same body of
audience evidence serve this venture, a later venture, and the Signals room without three copies of
the same reply, and it is why a research read cites observations rather than owning them.

The store stays access-restricted to Muxin and the system — it is not a publish artifact and never
becomes part of the Phase 3 response gate's count (that gate is public post responses only, §7.10).
Its purpose is solely to ground the read in evidence someone can trace, not to widen what counts as a
qualified response.

**Classification labels one reply at a time; conclusions are drawn across replies.** A single
observation may carry topic labels, an emotional frame, a desired help type, a behavior-based audience
role, and a stuck point — each a property of that person's own words, each with its own confidence and
the span it was drawn from, and each allowed to *abstain* rather than guess
(`venture-schema-contract.md` §5.4c). Topic heat, recurrence, signal quality, and lead-magnet
implications are NOT per-reply labels and MUST NOT be written onto an observation — they only exist
across many observations and belong to this read (§2C.3 of that contract). A pipeline that tags one
reply with a "lead-magnet implication" has made a category error.

**Round-4: classifications are separate records, and re-classifying never duplicates evidence.** One
observation may carry several classifications, one per taxonomy and version
(`venture-schema-contract.md` §5.4c). Each venture stamps the taxonomy its Phase 1 classification runs
under and its evidence links name the classification they use, so a venture can never read another
venture's labels. Re-classifying under a new taxonomy MUST write a new classification record and MUST
NOT write a second observation — a duplicated observation would double-count the same reply in every
recurrence and topic-heat figure this read produces.

**Metrics are evidence too, and a measured zero is a real reading.** A post that reached people and
drew no replies is one of the more useful things a Phase 1 read can know, and it only exists in the
record if metric observations are written for every captured post — views, likes, restacks, and the
reply or comment count — plus account-level subscriber totals and deltas
(`venture-schema-contract.md` §5.4a). A measured zero is stored as `0`; `null` means nobody measured
it. A read that only ever sees posts with replies will systematically overweight conversation and
under-read reach, which is the opposite of what §5.6's no-single-number rule is for.

**No single number decides the read, and "strong" means the same thing every time.** Reply count, like
count, or any one engagement metric MUST NOT be treated as the sole signal of which post "won." Every
`signal_quality` label (thin / moderate / strong) on a finding MUST be backed by the named-factor
rubric at `venture-schema-contract.md` §2C.4 — each of the eight factors (audience fit, specificity, an
explicit stuck point, requested help, a follow-up question, recurrence, a behavioral action, and
exposure context) scored `present` / `absent` / `unknown` with evidence references, not a comment
placeholder. A "strong" label requires multiple factors to be true, not just a high reply count; the
read MUST show its full `signal_quality_rationale`, not just the resulting label. A quiet post with one
sharply specific, high-context reply can outweigh a loud post with many vague ones.

**A finding may be planned or emergent, and may speak to more than one unknown.** Added in the round-2
corrective pass — the first version of this rule silently required every finding to trace to an
unknown the plan already named, which makes it structurally impossible for Phase 1 to surface anything
nobody anticipated. That's backwards for a discovery instrument. A `planned` finding traces to one or
more `unknown_id`s from `phase_1_research_plan`, same as before. An `emergent` finding is something the
observations surfaced that the plan didn't name — it MUST carry an `emergent_description` and MUST get
Muxin's explicit confirm-or-reject before it can inform Phase 2 (`muxin_confirmed_emergent`,
`venture-schema-contract.md` §2C.3); nothing here is silently absorbed into the read's conclusions
without that check. A single finding's `unknown_ids` MAY list more than one unknown when one reply
genuinely speaks to more than one dimension — emotional frame and desired help in the same reply, for
example — rather than forcing an artificial split.

**Required output.** For each unknown named in §5.1A / `phase_1_research_plan`'s `open_unknowns`, plus
any emergent finding surfaced along the way, `phase_1_research_read` MUST show:

- whether the finding is planned or emergent, and which unknown(s) it speaks to;
- the structured finding — topic, emotional frame, desired help or job, behavior-based audience
  segment, as applicable to that unknown's dimension;
- evidence references back to the specific `research_observations` rows the finding rests on —
  historical evidence (see below) and current-probe evidence may both appear in the same finding, and
  the read must make that mix visible, not blend it into one undifferentiated evidence pile;
- recurrence, specificity, and audience fit as their own named fields, not folded into one score;
- a signal-quality read (thin / moderate / strong) with its full per-factor rubric-backed rationale;
- a confidence level;
- unknowns that remain open;
- next probes — specific follow-up posts or questions that would close the remaining gaps;
- lead-magnet implications — what this suggests about the narrow problem, format, or angle a Phase 2
  lead magnet should address;
- **per-source collection coverage** — for every channel listed above, the window checked, a status of
  `complete` / `partial` / `unavailable` / `not_checked`, how many records were captured, and a reason
  for anything short of complete (`venture-schema-contract.md` §2C.3). A single "ongoing or closed"
  flag is not enough: the ingestion pipeline covers Notes in v1, essay comments are not yet reachable,
  and DMs, emails, and creator observations arrive by manual entry. A read that says "closed" while
  three channels were never examined is a false reading of the evidence base. **A finding MUST NOT
  carry `signal_quality: "strong"` when a channel its evidence would plausibly have come from is
  `partial`, `unavailable`, or `not_checked`, unless that gap is named in its
  `signal_quality_rationale`** — an unexamined channel is a missing denominator, and §2C.4's
  exposure-context factor is about denominators.

**Existing Substack data is a first-class Phase 1 evidence source, and its role is derived, never
declared.** Added in the round-2 corrective pass, answering the standing "should existing Substack
data be included" question: yes. Notes, essay comments, reply threads, metrics, and subscriber
movement enter through the same `research_observations` contract as fresh Phase 1 data
(`venture-schema-contract.md` §5.4a) — never as an untagged extra pile.

**Round-3 change: `evidence_role` is computed per venture, not stamped by whatever collected the
row.** The round-2 rule effectively let an ingestion pass declare everything it produced
`historical_prior`, which breaks the moment that same pass re-runs and captures a Note published
during an active sprint. The role is a relationship between an observation and one venture, so it is
derived on the link (`venture-schema-contract.md` §5.4b) from three inputs, in this order: published
before this venture's kickoff → `historical_prior`; otherwise published as one of this venture's
registered probes → `current_probe`; otherwise → `current_organic`. The same March reply is therefore
`historical_prior` to a venture that kicked off in August and `current_organic` to one that kicked off
in February, and both readings are correct.

- **`historical_prior` evidence MAY populate `phase_1_research_plan`'s `confirmed_knowns`**, reducing
  needless retesting — this is the literal mechanism behind "this problem is already established,
  don't retest that, test what help people want instead" — and MAY shape new probes.
- **No observation of any role MUST count toward Checkpoint 1** (which requires posts freshly drafted,
  approved, and confirmed live through this venture) **or toward the Phase 3 response gate's 20/30
  threshold** (§7.3). Old Notes replies were never collected under this venture's eligibility and
  dedup discipline, and letting them shortcut either gate would defeat the point of both.

**A `more_probes` cycle revises the plan, and evidence links are reconciled, not silently orphaned**
(round-4). When the `phase-1-research-continuation` decision is `more_probes`, this venture returns to
Phase 1 and its `phase_1_research_plan` is revised — unknowns get added, split, merged, or retired.
Every existing evidence link's `unknown_ids` then points at a plan version that no longer describes the
venture. The rule (`venture-schema-contract.md` §5.4b): plans carry a `plan_version` and a revision
writes a new version rather than editing in place; each link records the `research_plan_version` it was
made under; links whose unknowns all survive are carried forward automatically; any link touching a
changed or removed unknown is flagged for review, with its original ids intact. **A new
`phase_1_research_read` MUST NOT run while any link it would draw on is still flagged for review.**
`more_probes` exists precisely because the evidence was not good enough — re-reading it against
unknowns that shifted underneath would reproduce the problem the loop was meant to fix.

**Muxin must review the read itself, not just confirm it exists.** The read carries its own
`reviewed_by_muxin` / `reviewed_at` fields (`venture-schema-contract.md` §2C.3) that only she can set,
distinct from the read simply being drafted. A drafted-but-unreviewed read does not authorize the next
step.

**The read resolves into a recorded decision, not an implicit "good enough, move on."** Once the read
is reviewed, Muxin selects one of three outcomes as the `phase-1-research-continuation` decision
(`venture-schema-contract.md` §2A, candidates `more_probes` | `proceed_with_evidence` |
`proceed_as_hypothesis`):

- **`more_probes`** — evidence on one or more priority unknowns is still too thin to act on; this sends
  the venture back into Phase 1 idea generation (§5.2) with those unknowns as the priority, rather than
  advancing to Phase 2;
- **`proceed_with_evidence`** — the read's findings are moderate or strong enough to build Phase 2
  concepts on directly;
- **`proceed_as_hypothesis`** — Phase 2 concept generation may begin, but every concept resting on a
  thin-evidence finding MUST be labeled a hypothesis, not a conclusion, in that concept's decision
  record `rationale` (`venture-schema-contract.md` §2A), until more evidence arrives.

Phase 2 concept generation (§6.2) MUST NOT begin before this decision is `selected` with
`proceed_with_evidence` or `proceed_as_hypothesis`. Neither the read's existence nor its review alone
unlocks Phase 2 — the decision is the gate.

## 6. Phase 2: Audience, days 4-6

**Goal:** Create a narrow lead magnet, a working signup path, a one-question research loop, a welcome email, and an announcement.

### 6.1 Inputs

Use:

- intake and proof;
- the chosen platform;
- the three live posts;
- **`phase_1_research_read`** (§5.6) — required. Concept generation MUST NOT begin before this exists.
- early replies, comments, DMs, clicks, saves, and follow-up questions;
- known audience language;
- the creator's small-win ability from question 22.

The first lead magnet is an informed hypothesis. It is not assumed correct forever. Where
`phase_1_research_read` reports thin evidence for an unknown a concept depends on, that concept MUST
be labeled a hypothesis rather than presented with the same confidence as a concept backed by a
moderate or strong read.

### 6.2 Generate five lead-magnet concepts

Each concept MUST solve a different narrow frustration. Do not create five formats for the same broad topic.

Use this formula:

`audience + painful moment + fast win + creator proof`

Score and explain each concept on:

1. **Early problem:** is it one of the first obstacles in the audience's journey?
2. **Narrowness:** does it solve one specific problem?
3. **Frustration:** do people already feel this problem?
4. **Fast win:** can the reader use it in under 10 minutes?
5. **Proof fit:** can this creator help credibly?
6. **Research value:** will the signup and follow-up question teach the venture what people need next?

**Operational scoring:** use a visible 1-5 scale for comparison. The system recommends one concept. Muxin selects or overrides it.

Do not choose the broadest or most impressive concept. Prefer the narrowest painful problem with the fastest credible win.

### 6.3 Lead magnet

The selected lead magnet MUST:

- solve one narrow, frustrating problem;
- be usable or readable in under 10 minutes;
- create an immediate win;
- use plain language and no filler;
- connect to the creator's proof;
- end with one useful next step;
- invite feedback that supports the research loop.

Minimum structured fields:

- title;
- short introduction;
- practical sections;
- action step;
- feedback prompt.

The number of practical sections should fit the promise. Do not force three sections when the asset needs fewer or more.

### 6.4 Landing page

The PDF's normative minimum fields are:

- headline;
- three concrete benefits;
- button label.

The built capture layer SHOULD also support:

- internal page title;
- subheadline;
- form introduction;
- thank-you or confirmation message;
- privacy or consent copy when required.

The longer list is implementation support. It does not replace the PDF's minimum.

### 6.5 Survey

**Superseded 2026-08-19 (Muxin).** The rules below describe authoring a new single-question survey
from scratch. That assumption no longer holds: Muxin already has a real, live 4-question branching
survey on her own site (checked into `venture/existing-survey-humaninference.md`). Phase 2's
`survey` artifact now reviews that existing survey for fit against whichever lead magnet gets
selected, and recommends changes only where fit breaks — it does not author a new question or
replace the existing survey wholesale. The original text below is kept for its still-relevant
parts (store the answer privately, preserve it exactly, do not delay the research loop for
segmentation questions) but its premise — "the survey doesn't exist yet, write it" — is superseded.

~~The primary research question is:~~

~~`What are you stuck on right now?`~~

~~Rules:~~

1. ~~Use free text.~~
2. ~~Ask immediately after signup.~~
3. Store the answer against a privacy-safe respondent record.
4. Preserve the exact answer privately.
5. ~~Do not add rating scales or extra required questions to the Starter Kit sprint.~~
6. Optional segmentation questions from the wider Welsh method MAY be added later. They MUST NOT delay the first research loop.

### 6.6 Welcome email

The first welcome email MUST:

- thank the subscriber;
- deliver or link to the lead magnet;
- state what the asset helps them do;
- say what kind of message comes next and when;
- ask or link to the survey question;
- remain simple. Do not require a complex funnel.

Minimum structured fields:

- subject;
- preview text;
- body;
- lead-magnet link text and destination;
- survey question or survey link.

### 6.7 Announcement

Draft one native post that announces the lead magnet and gives the first wave of readers a clear reason to get it.

The announcement SHOULD use the post writing order in section 3.1. It MUST NOT make unproven conversion or outcome claims.

### 6.8 Checkpoint 2

The PDF requires a live landing page and an active welcome email before Phase 3.

**PROPOSED end-to-end predicate:** Checkpoint 2 clears only when:

- the lead magnet is available at its delivery destination;
- the landing page accepts and stores an email;
- the post-signup survey stores one tested answer against the subscriber;
- the welcome email is active and delivers the lead magnet;
- each required manual step has valid evidence.

The announcement is not required to clear the checkpoint.

This stronger end-to-end predicate requires Muxin's approval before this rules draft becomes final.

**OPEN-CAPTURE:** The subscriber store, email provider, and exact survey implementation remain product decisions.

**PROPOSED survey path:** Ask on the confirmation page, link to the same question from the welcome email, and accept email replies as a secondary response source.

**Superseded 2026-08-19 (Muxin), on the survey specifically.** The capture path above (confirmation
page primary, welcome-email link secondary) still stands for how the survey is *reached* — that part
was confirmed 2026-08-18 (§12). What is superseded is the assumption that Phase 2 designs the
question itself: Muxin's existing survey (`venture/existing-survey-humaninference.md`) already
covers that ground and stores answers against the subscriber. Checkpoint 2's "the post-signup
survey stores one tested answer against the subscriber" bullet above is satisfied by that existing
survey continuing to run — Phase 2 in this repo does not build or wire it. The `survey` artifact's
job is a fit review against the chosen lead magnet (see §6.5's amendment above), not implementation.

## 7. Phase 3: Offer, days 7-10

**Goal:** Use real audience language to choose one expensive, solvable problem and define a small first offer.

### 7.1 Keep the attention engine running

Continue five posts per week.

After the lead magnet is live, each post SHOULD point naturally to the landing page when the magnet extends that post. Do not force an unrelated CTA.

Posting continues while the response gate is closed.

### 7.2 Response record

Every response MUST carry enough information to support eligibility, deduplication, analysis, and audit.

Required private fields:

- stable response ID;
- source: survey, email, comment, DM, or another named channel;
- received date;
- privacy-safe respondent hash;
- target-audience eligibility;
- exact private quote;
- redacted quote for normal review;
- extracted stuck point;
- desired outcome;
- emotional intensity: low, medium, or high;
- cluster assignment when analyzed;
- inclusion in the gate;
- exclusion reason when not included.

The system MUST NOT claim a response is unique without a respondent key. It MUST NOT claim eligibility without an eligibility check.

### 7.3 Response gate

The gate counts eligible unique respondents, not rows, messages, or lines pasted.

- Minimum: 20.
- Target: 30.

Below 20:

- posting continues;
- the survey continues collecting;
- response cleanup may continue;
- the system MUST NOT choose the core problem, outline the product, or set the price.

At 20, record `response_gate_opened`. This event unlocks analysis only. It does not complete Phase 3 or unlock Phase 4.

### 7.4 Prepare responses

For each included response:

1. Preserve the exact private wording.
2. Extract the stated stuck point.
3. Extract the desired outcome when present.
4. Mark emotional intensity from the language and consequences.
5. Keep source and respondent identity private in normal views.
6. Allow the user to correct an extraction, exclusion, or cluster assignment.

Do not clean the audience's language into generic consulting language. Their words may later inform copy, after privacy review.

### 7.5 Cluster into three to five problems

1. Compare underlying jobs and struggles, not surface wording.
2. Group semantically similar responses.
3. Produce three to five clusters, not a long list of micro-categories.
4. Show the count, redacted evidence, common stuck point, desired outcome, and visible consequences for each cluster.
5. Keep a response-to-cluster audit trail.
6. Let the user correct the grouping before problem selection.

### 7.6 Find the expensive problem

Score every cluster from 1-5 on:

1. **Frequency:** how often does it appear?
2. **Intensity:** how emotional or urgent is the language?
3. **Time cost:** how much time does it waste?
4. **Money cost:** what money, tools, donations, subscriptions, or support does it waste?
5. **Stress cost:** does it create anxiety, cynicism, burnout, or paralysis?
6. **Solvability:** can this creator credibly solve a useful part of it in a small first offer?

Record the score and evidence for each factor. Do not fabricate a cost the audience did not express or that the creator cannot support.

The most frequent cluster does not win automatically. The recommendation should reflect the best combination of repeated pain, real cost, urgency, and creator solvability.

The system recommends one problem. Muxin makes the final selection and may override the recommendation with a recorded reason.

### 7.7 Define the transformation

Before outlining, write one plain transformation sentence:

`Go from [current painful state] to [specific useful state] in [credible scope or time].`

Rules:

- one person or audience;
- one meaningful change;
- no promise broader than the evidence;
- no vague verbs such as “unlock,” “elevate,” or “transform” in user-facing copy;
- editable and separately approved.

### 7.8 Outline the first product

Build backwards from the approved transformation.

The outline MUST:

- contain five to seven concise sections;
- move from the current pain to the promised useful state;
- fit the likely product format;
- be buildable, packageable, and shippable in about two weeks;
- include useful tools, templates, examples, or action steps when they improve the result;
- avoid a full value ladder. Build one offer first.

A useful outline pattern is:

1. orientation;
2. diagnosis;
3. core method;
4. application;
5. tools or templates;
6. immediate action plan;
7. continuation or consistency, only if needed.

This pattern is guidance, not a mandatory seven-section template.

### 7.9 Price and pitch

Recommend a specific price only after the problem, transformation, format, and outline exist.

Evaluate:

1. product format and depth;
2. outcome value;
3. audience economics and accessibility;
4. strength of creator proof;
5. time, money, or stress the offer may replace;
6. whether the buyer can get a useful win quickly;
7. whether the price tests real willingness to pay.

The price should feel serious enough to test demand without ignoring the audience's means.

The runtime MUST NOT seed a price from a worked example.

The output MUST include:

- one recommended price;
- the considered range;
- reasoning tied to the seven inputs above;
- known uncertainty;
- an editable one-paragraph pitch focused on the approved transformation.

Optional scenario math MAY use rough source benchmarks to illustrate outcomes:

- digital product scenario: about 2 percent conversion;
- service scenario: about 0.25 percent conversion at a higher price.

These are illustrative assumptions, not forecasts or promises. Label them clearly and let the user change them.

### 7.10 Complete Phase 3

Phase 3 completes only when:

- the response gate opened;
- cluster analysis is stored;
- the selected problem is approved;
- the transformation is approved;
- the five-to-seven-section outline is approved;
- the price and pitch are approved.

Record `phase_3_completed`. This event unlocks Phase 4.

## 8. Phase 4: Operations, days 11-14

**Goal:** Start the product build and install a routine the creator can sustain.

### 8.1 Daily operating plan

The PDF's canonical daily routine contains:

- 30 minutes for content writing and engagement;
- 30 minutes for tomorrow's posts;
- 30 minutes for feedback analysis;
- 30 minutes for the core offer;
- 15 minutes for direct customer outreach.

Total: 2 hours 15 minutes.

The system MUST compare this routine with the time budget from intake.

If the user has less time, do not demand the canonical routine and call it sustainable. Offer a recorded choice:

1. use the canonical daily routine;
2. rotate the five jobs across the week within the available budget;
3. extend the build timeline while preserving the sequence;
4. revise the posting pace or scope.

The user approves the final operating plan. Record the chosen schedule and tradeoffs.

### 8.2 Triage recurring work

Classify recurring tasks into:

1. **Never build:** it requires a team the creator does not want or would be miserable to run.
2. **Ignore:** it is a vanity signal, distracting trend, or competitor move that does not serve the venture.
3. **Automate:** it repeats more than once or twice a week and does not require creator judgment.

Do not automate insight, voice, audience empathy, product judgment, or final approval.

### 8.3 Automation order

Configure in this dependency order:

1. lead-magnet delivery and welcome message;
2. post-signup tagging or segmentation;
3. follow-up sequences;
4. payments, receipts, and scheduling when the offer needs them.

Do not build a complex funnel to complete the Starter Kit sprint.

### 8.4 Direct outreach

Draft short personal thank-you notes for early respondents whose answers changed the product.

Each note MUST:

- link privately to the source response;
- name the idea or section the response influenced;
- use no more than two short sentences unless the user asks for more;
- make no sales demand;
- remain manual and require approval before sending.

### 8.5 Day 14 review

Review facts against the Day 0 scorecard:

- posts confirmed live;
- posting pace achieved or revised;
- qualified views, clicks, and reply quality;
- lead magnet available;
- landing page capturing emails;
- opt-in conversion rate when measurable;
- survey working;
- eligible unique response count;
- response quality and recurring problems;
- approved product problem, transformation, outline, price, and pitch;
- product build started;
- operating plan tested for sustainability.

Do not invent a pass condition on Day 14. Use the fixed scorecard and clearly show fields that remain `learning_only` or lack enough data.

Muxin makes one final decision:

- continue;
- revise positioning;
- revise the lead magnet;
- collect more evidence;
- stop.

Record the decision and reason. Phase 4 ends with this review and decision. There is no fourth checkpoint in this draft.

### 8.6 Longer expectation

After the Day 14 decision, show the source's broad expectation:

- months 1-3 may feel slow and unclear;
- months 4-6 should improve content and offers;
- months 7-12 may show compounding, referrals, and repeat buyers.

Treat this as mindset guidance, not a forecast or excuse to ignore bad signals.

## 9. Evidence, decisions, and privacy

### 9.1 Decision records

Every judgment step MUST record:

- decision ID and kind;
- rules version;
- input references;
- candidate options;
- visible scores and evidence;
- AI recommendation and rationale;
- Muxin's selection;
- selecting actor;
- override reason when applicable;
- timestamps and status.

The user MUST be able to inspect why a recommendation was made.

### 9.2 Approval and delivery

Editorial approval and delivery are different facts.

- A draft is not approved.
- An approved artifact is not necessarily handed off.
- A handed-off artifact is not necessarily live.
- A live artifact requires evidence.
- A retracted artifact keeps its original live evidence and adds the retraction record.

Follow `docs/venture-schema-contract.md` for the full state machines once that contract is updated to this rules version.

### 9.3 Response privacy

1. Raw responses and identifying information stay in a private, gitignored store.
2. Normal venture reads expose counts, derived fields, and redacted excerpts only.
3. The user may open a protected correction view when necessary.
4. Canon or other committed records contain aggregates and redacted synthesis, never raw identities.
5. Exact quotes used in public copy require privacy review and any needed permission.

## 10. User-facing copy rules

Do not expose storage or state-machine language in the normal interface.

| Internal term | User-facing term |
|---|---|
| canon | saved choice or final choice |
| artifact | draft, post, page, email, survey, or plan |
| eligible unique respondents | people who count toward the goal |
| deduplicated | repeats removed |
| attestation | you confirmed it |
| delivery status | where it stands |
| transformation | the change this creates |
| gated | waiting for enough answers |
| cluster | common problem |

Buttons MUST use a concrete action, such as:

- Approve this draft
- Edit the words
- Choose this idea
- Show why
- Use another option
- Add the live link
- Record the problem
- Open Phase 4

Avoid vague buttons such as “Continue,” “Done,” or “Commit” when a more specific action exists.

## 11. Prohibited behaviors

The system MUST NOT:

1. load a worked example as business context for a clean venture;
2. prefill topic ideas, clusters, outlines, or prices from a fixture;
3. claim eligibility or uniqueness from pasted line count;
4. create cluster counts from fixed weights;
5. make only the AI-recommended candidate selectable;
6. hide the inputs or rationale behind a recommendation;
7. make structured copy approve-or-discard without editing;
8. start Day 1 before intake and scorecard completion;
9. treat approval as proof that something is live;
10. let the response threshold unlock Phase 4;
11. outline or price the product before the response gate opens;
12. force a 2-hour-15-minute routine when intake says it is unsustainable;
13. seed a price from the source's worked example;
14. publish or send without explicit approval;
15. silently rewrite a user's answer, voice evidence, or final selection;
16. advance merely because the planned date arrived;
17. report a Day 14 pass without the fixed scorecard;
18. disable a brand pillar or a platform automatically from engagement data alone (§1A rule 4);
19. select a CTA from engagement or likes rather than venture phase and message fit (§1A rule 7);
20. apply a Venture's CTA policy to Studio content that is not attached to that Venture (§1A rule 8);
21. stack more than one ask on a single social item (§1A rule 9);
22. let an automated recommendation change routing, cadence, framing, or CTA without Muxin's adoption (§1A rule 10);
23. spend a Phase 1 post retesting a broad problem already supported by credible evidence (§5.1A);
24. treat reply count or any single engagement number as the sole signal of which Phase 1 post won (§5.6);
25. begin Phase 2 concept generation before `phase_1_research_read` exists, or present a thin-evidence concept as a confident conclusion (§5.6, §6.1);
26. load the civic-tech worked example's emotional-frame or audience-segment categories as defaults for a clean venture's research read (§5.1A).

**Added 2026-08-07 (corrective pass).** The system MUST NOT:

27. draft a Phase 1 probe idea into a post before Muxin has reviewed the `phase_1_research_plan` — a
    system-drafted, unreviewed plan does not authorize drafting (§5.1A);
28. select the three Phase 1 ideas to draft when two or more target the same `unknown_id`, without a
    recorded rationale for why the repetition is more valuable than a second priority unknown (§5.2);
29. assign a Phase 1 post "no CTA" without a recorded, deliberate reason in that post's decision record
    — "no CTA" is not a routine Phase 1 default (§1A.1);
30. assign a `signal_quality` label (thin / moderate / strong) on a `phase_1_research_read` finding
    without a rubric-backed rationale showing which named factors were met (§5.6);
31. begin Phase 2 concept generation before the `phase-1-research-continuation` decision has been
    `selected` with `proceed_with_evidence` or `proceed_as_hypothesis` — a drafted-but-undecided read
    does not unlock Phase 2, even once Muxin has reviewed it (§5.6);
32. count a `research_observations` row toward the Phase 3 response gate, or expose its raw private
    text outside the protected research views (§5.6).

**Added 2026-08-07 (round-2 corrective pass).** The system MUST NOT:

33. let an `emergent` finding inform `lead_magnet_implications` or a concept's `rationale` while its
    `muxin_confirmed_emergent` flag is unset (§5.6);
34. count a `historical_prior`-tagged observation toward Checkpoint 1's three-live-post requirement or
    the Phase 3 response gate's 20/30 threshold, regardless of how recently it was captured or
    reclassified (§5.6, `venture-schema-contract.md` §5.4b);
35. render a `signal_quality` label without showing all eight §2C.4 rubric factors scored
    `present`/`absent`/`unknown` — a partial or missing rationale is not a valid basis for the label
    (§5.6);
36. attribute a funnel event to a specific content item when `touch_type` is `"unknown"`, or leave an
    `"unknown"`-touch entry without a stated reason (`venture-schema-contract.md` §5.7).

**Added 2026-08-07 (round-3 corrective pass).** The system MUST NOT:

37. accept a caller-supplied `evidence_role` on an evidence link — the role is derived from kickoff
    time, venture linkage, and probe identity, and a collector that declares its own role is
    rejected (§5.6, `venture-schema-contract.md` §5.4b);
38. write topic heat, recurrence, signal quality, or a lead-magnet implication onto an individual
    observation — those are across-reply conclusions belonging to `phase_1_research_read` (§5.6);
39. store the same observation once per venture — observations live once, account-level, and each
    venture links to them (§5.6);
40. read anything inside `venture/<slug>/` from the Signals room or `/strategy` — those consume the
    redacted account-level research read path only (`venture-schema-contract.md` §5.4b);
41. record a classification label with no confidence, no evidence span, and no abstention option —
    a classifier that cannot tell must abstain rather than guess, and a correction must preserve the
    machine value it replaced (`venture-schema-contract.md` §5.4c).

**Added 2026-08-07 (round-4 corrective pass).** The system MUST NOT:

42. write a second observation row when re-classifying text it has already captured — a new taxonomy
    or version produces a new *classification* record against the same observation (§5.6,
    `venture-schema-contract.md` §5.4c);
43. let a venture read a classification produced under a taxonomy other than the one it stamped
    (`venture-schema-contract.md` §5.4b/§5.4c);
44. skip writing a metric observation because the measured value is zero, or write a zero for a
    measurement that failed or never ran (§5.6);
45. run a new `phase_1_research_read` while any evidence link it would draw on is flagged for review
    after a plan revision (§5.6);
46. derive `respondent_hash` from an unkeyed digest, from a display name or handle rather than a
    stable platform user id, or log the raw identifier or the HMAC key
    (`venture-schema-contract.md` §5.4a).

**Added 2026-08-07 (round-5 corrective pass).** The system MUST NOT:

47. present a `phase_1_research_read` without per-source collection coverage, or let a channel that
    was never examined go unmentioned rather than being marked `not_checked` (§5.6);
48. link a venture to a classification produced under a different taxonomy **version** than the one
    the venture stamped, not just a different taxonomy id (`venture-schema-contract.md` §5.4b);
49. run a classification taxonomy at scale when any of its five outputs failed its gold-set threshold
    — a taxonomy where one field is reliable and another is not ships as fully abstained, not
    partially (see the ingestion plan's acceptance tests);
50. write a `phase_1_research_plan` without a `plan_version` (`venture-schema-contract.md` §2C.1).

## 12. Open product decisions

**Room placement is locked, not open.** Venture is the permanent sixth top-level room, after Studio
and before Content (2026-08-07, `docs/content-studio-vision.md`). It is not a mode inside Studio.
This draft does not reopen that question and no future revision should either.

**Confirmed by Muxin (2026-08-18):**

1. **Phase 1 format:** 3 posts total, `substack-post`/`text-post-note` mix decided per idea; Checkpoint 1 requires all 3 live.
2. **Checkpoint 2:** adopt the proposed end-to-end predicate (§6.8).
3. **Capture implementation:** Resend as the email provider; subscriber store implementation (JSONL file, per item 5) is a build-time detail.
4. **Survey path:** confirmation page as primary, linked from the welcome email, email replies as secondary input.
5. **State store:** Markdown plus JSONL.
6. **First venture's slug/name:** `voter-choice`.
7. **Phase/day structure:** approved to loosen the fixed 14-day scaffolding into a test-and-read-responses loop (see `docs/venture-build-plan.md` Open questions #7) — the actual redesign is not yet drafted; still needs Muxin's sign-off on the specific new structure before it replaces this file's Day 1/Day 14 scaffolding (§4.4, §8.5, and the Day-14-scorecard rules throughout).

- end Phase 4 with a human decision, not a fourth checkpoint.

## 13. Required verification

Before implementation is considered faithful, verify:

1. A clean non-civic venture contains no terms, ideas, clusters, outlines, or prices from the worked example.
2. Every recommendation cites current venture inputs and the stamped rules version.
3. All 25 intake answers remain verbatim and correctable.
4. Day 1 begins after intake.
5. Platform selection uses all three filters and permits an override.
6. Idea ranking stores four scores per idea and permits any three selections.
7. Each Phase 1 post passes the word, takeaway, clarity, voice, and reply checks.
8. Checkpoint 1 requires three live posts.
9. Selecting any lead-magnet concept produces drafts for that selected concept.
10. Phase 2 copy fields are editable.
11. Checkpoint 2 tests working capture behavior once its predicate is approved.
12. Response imports cannot count a person without a stable respondent key and eligibility decision.
13. Cluster counts derive from stored responses.
14. Every cluster shows the six problem scores and evidence.
15. Any cluster may be selected.
16. No product outline or price exists before the response gate opens.
17. The response gate does not unlock Phase 4.
18. Phase 4 opens only after Phase 3 decisions are approved.
19. The operating plan addresses the intake time budget.
20. The Day 14 review uses the fixed scorecard and records Muxin's final decision.
21. Venture-generated content and direct Studio content both render through the same Content room, with a plain origin tag, not two different pipelines.
22. A CTA on a Venture item traces to the phase table in §1A.1, never to an engagement or likes ranking.
23. A low-engagement item with a recorded lead, call, or sale reads as a business result in Signals, not as a failed post.
24. Disabling a brand pillar or platform always requires Muxin's adoption of a recommendation — never happens from performance data alone.
25. Every Phase 1 idea records the specific unknown it tests, and no idea presents a retest of an already-evidenced broad problem as a genuine probe.
26. `phase_1_research_read` exists, ingests every listed signal source via the account-level `research_observations` store, and never lets one engagement number stand in for the read.
27. A thin-evidence `phase_1_research_read` is labeled thin, and any Phase 2 concept it feeds is labeled a hypothesis, not a conclusion.

**Added 2026-08-07 (corrective pass):**

28. `phase_1_research_plan` carries `reviewed_by_muxin: true` before any of its probes are drafted into a post — plan review is checked as an actual state, not inferred from the plan's presence.
29. The three selected Phase 1 ideas show which `unknown_id` each probes, and any repeated `unknown_id` among the three carries a recorded rationale.
30. Every `signal_quality` label on a `phase_1_research_read` finding shows a rubric-backed `signal_quality_rationale` naming the factors met, not just the label.
31. `phase_1_research_read` carries `reviewed_by_muxin: true` and a `phase-1-research-continuation` decision with a `selected_candidate_id` of `proceed_with_evidence` or `proceed_as_hypothesis` before Phase 2 concept generation runs; a `more_probes` decision routes back into Phase 1 idea generation instead.
32. Any Phase 1 post with no CTA carries a recorded reason in its decision record; absent one, the post carries a reply prompt.
33. `research_observations` rows never appear in the Phase 3 response-gate count and are never exposed outside protected research views.

**Added 2026-08-07 (round-2 corrective pass):**

34. A `phase_1_research_read` finding is labeled `planned` or `emergent`, and an emergent finding
    shows a non-null `muxin_confirmed_emergent` before it reaches `lead_magnet_implications` or any
    concept's `rationale`.
35. Observations linked with a derived `evidence_role` of `historical_prior` are excluded from
    Checkpoint 1's live-post count and the Phase 3 response gate's eligible-unique count, in every
    build, with a passing test demonstrating it (`venture-schema-contract.md` §9, item 9).
36. Every `signal_quality_rationale` shows all eight §2C.4 factors scored, each with evidence
    references or an `"unknown"` status — never a partial rationale backing a rendered label.
37. Every `funnel-events.jsonl` attribution entry carries exactly one of `content_item_id` or
    `unattributed_reason` as non-null, never both null and never both set.

**Added 2026-08-07 (round-3 corrective pass):**

38. One observation linked into two ventures exists exactly once in `research_observations`, with two
    `evidence-links.jsonl` lines pointing at it — never two copies of the text.
39. The same observation resolves to different `evidence_role` values in ventures with different
    kickoff dates, and every link records the `evidence_role_basis` that produced its value.
40. No `research_observations` row carries topic heat, recurrence, signal quality, or a lead-magnet
    implication; those appear only on `phase_1_research_read`.
41. Every classification field carries a confidence and an evidence span, or is explicitly abstained;
    a Muxin correction preserves the superseded machine value rather than overwriting it.
42. The Signals and `/strategy` read paths resolve entirely through the redacted account-level
    research read function, with no file read under `venture/`.

**Added 2026-08-07 (round-4 corrective pass):**

43. Re-classifying one observation under a second taxonomy leaves exactly one observation row and two
    classification rows, and a recurrence count over it still returns 1.
44. An evidence link naming a classification from a taxonomy other than the venture's stamped one is
    rejected.
45. Every captured post yields metric observations for views, likes, restacks, and its reply or
    comment count, with a real `0` where the count is zero and nothing written where the fetch failed;
    an unchanged re-run creates no new metric rows.
46. Revising a research plan carries forward links whose unknowns survive, flags the rest for review,
    and blocks the next research read until they are resolved.
47. `respondent_hash` is a keyed HMAC over platform plus stable platform user id; the raw identifier
    and the key appear in no log, error record, or export.

**Added 2026-08-07 (round-5 corrective pass):**

48. Every `phase_1_research_plan` carries a `plan_version`, and every evidence link records the
    version its `unknown_ids` were assigned under.
49. An evidence link is rejected when the referenced classification's taxonomy id **or version**
    differs from the one the venture stamped.
50. Every `phase_1_research_read` lists every channel from §5.6 in its collection coverage with an
    explicit status; none is omitted.
51. All five classification outputs — desired help, emotional frame, behavior audience role, topic
    labels, and stuck point — have a gold-set threshold, and a taxonomy failing any one of them ships
    fully abstained rather than partially.
