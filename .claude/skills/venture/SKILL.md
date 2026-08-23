---
name: venture
description: Build 3 — run Phase 1 ("Attention"), Phase 2 ("Audience"), Phase 3 ("Offer"), and Phase 4 ("Operations") of a solo-business sprint that tests what an audience actually wants, builds a narrow lead magnet and owned-audience capture around it, clusters real responses into one expensive problem with a transformation, outline, and price, then installs a sustainable daily operating routine and runs the Day 14 review. Usage - /venture new <slug>, /venture <slug>.
---

# /venture — Phase 1: Attention, Phase 2: Audience, Phase 3: Offer, Phase 4: Operations (Build 3)

Help Muxin test what an audience wants, needs, and will pay for — starting with Phase 1: pick one
platform, run public qualitative discovery, publish three probe posts, hit Checkpoint 1. Then
Phase 2: turn what Phase 1 learned into a narrow lead magnet, a landing page, a welcome email, and
a fit review of Muxin's existing survey, hitting Checkpoint 2. Then Phase 3: once real responses
clear the 20-eligible-unique-respondent gate, cluster them into three to five problems, score and
select the one expensive problem worth solving, define and approve a transformation sentence,
outline a small first product, and recommend a price and pitch, hitting Checkpoint 3. Then Phase 4:
install a sustainable daily operating routine, triage recurring work, thank early respondents by
hand, and run the Day 14 review that ends in Muxin's one final decision — there is no fourth
checkpoint.

## This is composed business content — and why that's allowed

Unlike Build 0/1 (extraction-first), Venture is **composed**: you draft post ideas and copy
testing the audience, not quoting a source essay. This is deliberately narrower than Build 2
(Fiction)'s exception — see `venture/CLAUDE.md` and `CLAUDE.md` rule 1's Build 3 clause before
doing anything else in this skill if you haven't read them this session. Two things carry over
in full, unlike Fiction: **`config/voice.yaml` governs every draft completely** (this ships under
Muxin's real name, not a labeled fictional register), and **every concrete claim needs a
`claim_refs` entry** tracing it to an intake answer or a confirmed fact — never assert a result,
customer, or number Muxin didn't actually have.

**Every gate below is enforced by `src/venture/phase1.ts` (Phase 1), `src/venture/phase2.ts`
(Phase 2), `src/venture/phase3.ts` (Phase 3), and `src/venture/phase4.ts` (Phase 4), not by you
remembering to stop.** Each script refuses to move forward if a prior gate hasn't cleared. Treat a
refusal as correct behavior, not a bug to route around.

## Step 1: New venture — intake

`/venture new <slug>` runs the 25-question interview from `venture/rules.md` §4.2, one question
at a time (not a form dump). For each question:

- Ask it plainly, in your own words if that helps, but store the answer **verbatim**, exactly as
  given — never paraphrase what Muxin says.
- If an answer is thin, it's fine to ask a natural follow-up, but don't push for more than she
  offers.
- After all 25, collect voice evidence: 1-3 writing samples, a worldview statement, phrases she
  naturally uses, phrases/tones she refuses.
- Then fix the **Day 14 scorecard** (rules.md §4.4) — this is what Day 14 review scores against
  later, so it has to be set now, not invented after the fact: required number of live Phase 1
  posts, ongoing posting pace, a qualified views/clicks target (or the literal `"learning_only"`
  if there's no baseline — never invent a number), a landing-page opt-in target (same
  `"learning_only"` rule), a response-quality test, and a sustainability test against her declared
  time budget (q20). The eligible-response target (min 20, target 30) and the final-decision
  option set are fixed by the rule itself — you don't ask Muxin for those.

Then write the answers via stdin as JSON matching `IntakeAnswers`/`VoiceEvidence`/`ScorecardInput`
(`src/venture/intake.ts`):

```
echo '{"answers": {...25 keys...}, "voice": {...}, "scorecard": {"required_live_posts": 3, "ongoing_pace": "...", "views_or_clicks_target": "...|learning_only", "opt_in_target": "...|learning_only", "response_quality_test": "...", "sustainability_test": "..."}}' | tsx src/venture/new-venture.ts <slug>
```

Confirm the intake is complete before moving to Phase 1 — the script refuses to kick off if any
of the 25 answers or any scorecard field is missing.

## Step 2: Research plan — assemble, then STOP

**Before drafting any idea**, assemble a `phase_1_research_plan` from intake + existing proof +
prior work: confirmed knowns (with real evidence and Muxin's explicit confirmation — never assert
"this is already known" on your own say-so), open unknowns (tagged by dimension: emotional_frame,
desired_help, audience_segment, or other), and probes (which unknown each candidate idea targets,
the hypothesis, the conversation question, the evidence that would move it).

Write it:

```
echo '{"confirmed_knowns": [...], "open_unknowns": [...], "probes": [...]}' | tsx src/venture/phase1.ts plan-init <slug>
```

**Then stop and show Muxin the plan.** Do not draft anything until she runs
`tsx src/venture/phase1.ts plan-review <slug>` herself. This is the direct analog of the
beat-sheet-approval gate `/story` had to retrofit after shipping without one — build the stop in,
don't skip it because the plan looks obviously fine to you.

## Step 3: Platform recommendation

Use exactly the three filters from `venture/rules.md` §5.1: where the audience already pays
attention, what format Muxin can produce consistently, which platform carries the lowest burnout
risk. Recommend **one** primary platform — never a multi-platform launch. Show meaningful
alternatives, why the recommendation won, and known risks.

```
echo '{"input_refs": [...], "candidates": [...], "recommended_candidate_ids": [...]}' | tsx src/venture/phase1.ts platform <slug>
```

Muxin accepts or overrides: `tsx src/venture/phase1.ts platform-select <slug> <candidate_id>`.
If she picks something other than the recommended platform, the script requires
`--override-reason "..."` — the audit trail for "why Substack lost" is not optional (rules.md
§5.1).

## Step 4: Ten ideas, ranked

Generate ten distinct ideas from audience frustrations, Muxin's own wins/lessons/proof, and the
locked venture context — never copy another creator's phrasing or claim. Score each on the four
factors (personal_stake, specificity, identity_signal, easy_reply, 1-5 scale), and name the
specific `unknown_id` each idea actually tests. An idea that only re-proves an already-confirmed
broad problem gets flagged as such, not presented as an equal probe.

```
echo '{"input_refs": [...], "candidates": [...ten...], "recommended_candidate_ids": [...]}' | tsx src/venture/phase1.ts ideas <slug>
```

**Stop and show Muxin the ranked ideas.** She selects exactly three:

```
tsx src/venture/phase1.ts select <slug> <id1> <id2> <id3> [--rationale "..."]
```

If two or three of her picks share an `unknown_id`, the script refuses without `--rationale` —
that's not a bug, it's the distinct-unknown-coverage rule (rules.md §5.2's corrective pass). Tell
her why it's asking, don't just retry with a filler reason.

## Step 5: Draft, one post at a time

Draft in this order (rules.md §3.1): **body first** (the lesson/observation/action), **then the
reply prompt** (before a lead magnet exists, a short question that invites a story/example/stuck
point), **hook last** (open on the sentence with the most charge, written only after the body
exists).

Every draft:
- fits the chosen platform, stays under 150 words;
- teaches exactly one thing, with one concrete takeaway;
- sounds like Muxin, not a brand — zero em dashes, `config/voice.yaml` fully applies;
- ends with a reply prompt, unless you're recording a deliberate, rare "no CTA" exception with a
  stated reason;
- **carries a `claim_refs` entry for every concrete factual claim** — a number, a result, a named
  experience. No ref, no claim: cut it or reframe it as an explicit hypothesis instead.

```
echo '{"title": "...", "body": "...", "claim_refs": [...], "no_cta_reason": null}' | tsx src/venture/phase1.ts draft <slug> <candidate_id> --kind substack-post|text-post-note
```

The script mechanically rejects an over-length draft, an em dash, or a missing reply
prompt/no-CTA-reason — it can't check whether every claim actually has a ref, only that some
exist when required. That's your judgment call to get right, not the script's to catch.

Show Muxin each draft. She approves or asks for a revision:

```
tsx src/venture/phase1.ts approve <slug> <candidate_id>
```

## Step 6: Deliver and confirm

Once a post is approved, hand it off:

```
tsx src/venture/deliver.ts <slug>
```

An approved `substack-post` writes to `ready-to-paste/<artifact_id>.txt` for Muxin to paste
herself; once it's live, she confirms it. Two proofs, and which one is right depends on whether the
thing has an address:

```
tsx src/venture/deliver.ts confirm <slug> <artifact_id> --url <live-url>
tsx src/venture/deliver.ts confirm <slug> <artifact_id> --attestation "<what she states>"
```

Use `--url` whenever the artifact has a real address, because a link can be re-checked later and a
sentence cannot. Use `--attestation` only for a thing with no addressable trace at all — a welcome
email sequence being switched on, a note sent by hand. **Never ask Muxin for a URL that does not
exist, and never write one on her behalf.** A kind that needs a checkable link refuses an
attestation and says so; a kind that only needs an attestation still accepts a URL if there is one.

An approved `text-post-note` claims a slot from the same shared scheduler `/atomize` uses (so it
can never collide with a same-day `/atomize` Note), then posts through the existing Substack Notes
agent once that slot is due — re-running `deliver.ts` is what actually fires an already-claimed
slot, there's no separate cron. Both paths write real delivery evidence — `{type: "url", ...}` for
what Muxin pastes herself, `{type: "agent", ...}` for what the Notes agent posts (and
`{type: "attestation", ...}` later, for Phase 2's welcome email). Each kind declares a MINIMUM, not
an exact type: a url or an agent confirmation both clear an attestation minimum, an attestation
never stands in for either. This is what Checkpoint 1 checks for below.

## Step 7: Checkpoint 1

Record the ongoing posting pace once, then attempt to clear:

```
tsx src/venture/checkpoint.ts pace <slug> "<N>/week"
tsx src/venture/checkpoint.ts clear <slug> checkpoint-1
```

Checkpoint 1 needs all three conditions: three required posts approved AND live with evidence
of the right kind for that post's type, and pace recorded. Approval alone never clears it, and
there is no partial pass — if it refuses, tell Muxin exactly what's still missing rather than
re-running it hoping something changed.

## Step 8: Phase 1 research read — the bridge into Phase 2

Checkpoint 1 proves the three posts are live. It doesn't prove anything was learned. Before any
Phase 2 concept work starts, ingest every available signal (Note replies, essay comments, DMs,
email replies, metrics, subscriber movement, follow-up questions, Muxin's own observations) and
synthesize it into a `phase_1_research_read` — per-source collection coverage, each finding
labeled `planned` or `emergent` with a rubric-backed `signal_quality`, and a measured zero counted
as a real reading, not skipped (rules.md §5.6).

```
echo '{"collection_coverage": [...], "findings": [...]}' | tsx src/venture/phase1.ts research-read-init <slug>
```

**Then stop and show Muxin the read.** Do not select a continuation until she runs
`tsx src/venture/phase1.ts research-read-review <slug>` herself — same discipline as the Step 2
plan-review gate. If any finding is `emergent`, she also confirms or rejects it specifically:
`tsx src/venture/phase1.ts research-read-confirm-emergent <slug> <finding_id> <true|false>`.

## Step 9: Continuation decision

Once the read is reviewed, offer Muxin exactly three outcomes as the
`phase-1-research-continuation` decision:

```
echo '{"input_refs": ["p1-research-plan", "p1-research-read"], "candidates": [...], "recommended_candidate_ids": [...]}' | tsx src/venture/phase1.ts continuation <slug>
tsx src/venture/phase1.ts continuation-select <slug> <more_probes|proceed_with_evidence|proceed_as_hypothesis> [--override-reason "..."]
```

Explain plainly what each choice does: **`more_probes`** sends the venture back into more Phase 1
idea generation (Step 4) instead of forward — the evidence on a priority unknown is still too thin
to act on. **`proceed_with_evidence`** means the read is solid enough to build Phase 2 concepts on
directly. **`proceed_as_hypothesis`** unlocks Phase 2 too, but every concept resting on a
thin-evidence finding must be labeled a hypothesis, not a conclusion, until more evidence arrives.
Nothing in Phase 2 (`src/venture/phase2.ts`) will run until this decision is `selected` with one of
the last two — the script enforces this itself (`requirePhase2Unlocked`), it isn't just this
skill's reminder.

## Step 10: Five lead-magnet concepts

Use the formula from rules.md §6.2 — `audience + painful moment + fast win + creator proof` —
against what Phase 1 actually learned. Generate exactly five distinct concepts, each solving a
*different* narrow frustration (not five formats for the same broad topic), and score each on the
six factors: early_problem, narrowness, frustration, fast_win, proof_fit, research_value (1-5
scale). Where a concept rests on a `phase_1_research_read` finding the read itself called thin,
label that concept a hypothesis rather than presenting it with the same confidence as a
moderate/strong-evidence concept — `label_as_hypothesis: true` on that candidate.

```
echo '{"input_refs": [...], "candidates": [...five...], "recommended_candidate_ids": [...]}' | tsx src/venture/phase2.ts concepts <slug>
```

**Stop and show Muxin the five ranked concepts.** She selects one:

```
tsx src/venture/phase2.ts concept-select <slug> <candidate_id> [--override-reason "..."]
```

If she picks something other than the recommended concept, the script requires
`--override-reason "..."` — same audit-trail discipline as Step 3's platform pick.

## Step 11: Lead magnet draft

The selected concept becomes the actual lead magnet: usable or readable in under 10 minutes, plain
language, no filler, connects to Muxin's proof, ends with one useful next step and a feedback
prompt that feeds the research loop (rules.md §6.3). Minimum fields: `title`, `intro`,
`sections` (however many the promise actually needs — don't force three), `action_step`,
`feedback_prompt`. Zero em dashes, and every concrete factual claim carries a `claim_refs` entry,
same discipline as Phase 1 drafts.

```
echo '{"title": "...", "intro": "...", "sections": [...], "action_step": "...", "feedback_prompt": "...", "claim_refs": [...]}' | tsx src/venture/phase2.ts magnet-draft <slug>
```

**Stop and show Muxin the draft.** She approves or asks for a revision:
`tsx src/venture/phase2.ts approve <slug> p2-lead-magnet`.

## Step 12: Landing page copy draft

The PDF's normative minimum is exactly five fields: `headline`, `benefit_1`, `benefit_2`,
`benefit_3`, `button_label` (rules.md §6.4). `subheadline`, `form_intro`, `thank_you_message`, and
`privacy_copy` are the built capture layer's optional support fields — draft them if useful, but
their absence is never a validation failure, and the longer list never replaces the PDF's minimum.

```
echo '{"headline": "...", "benefit_1": "...", "benefit_2": "...", "benefit_3": "...", "button_label": "..."}' | tsx src/venture/phase2.ts landing-page-draft <slug>
```

**Stop and show Muxin the draft** for approval, same as Step 11.

## Step 13: Survey fit review — NOT a new survey

Muxin already has a real, live 4-question branching survey running on her own site. Read
`venture/existing-survey-humaninference.md` first. This step is a **fit review against the chosen
lead magnet**, question by question — it does not author a new survey or replace hers wholesale
(rules.md §6.5, amended 2026-08-19). Assess all 4 questions; recommend edits only where fit
genuinely breaks, not by default.

```
echo '{"existing_survey_snapshot": "...", "fit_assessment": [{"question_number": 1, "fits_chosen_magnet": true, "note": "..."}, ...all 4...], "recommended_changes": [...], "change_needed": false}' | tsx src/venture/phase2.ts survey-review <slug>
```

**Stop and show Muxin the review.** She approves it herself:
`tsx src/venture/phase2.ts survey-review-approve <slug>`.

## Step 14: Welcome email draft

Requires both the lead magnet and the survey review to already exist — the script refuses and
names whichever is missing. It also refuses if the survey review exists but hasn't been approved
yet (run `survey-review-approve` first). The email thanks the subscriber, delivers the lead magnet,
says what's next, and asks or links to the survey question (rules.md §6.6). Minimum fields: `subject`,
`preview_text`, `body`, `lead_magnet_link_text`, `lead_magnet_destination`,
`survey_question_or_link`. Zero em dashes, `claim_refs` discipline as above.

```
echo '{"subject": "...", "preview_text": "...", "body": "...", "lead_magnet_link_text": "...", "lead_magnet_destination": "...", "survey_question_or_link": "...", "claim_refs": [...]}' | tsx src/venture/phase2.ts welcome-email-draft <slug>
```

**Stop and show Muxin the draft** for approval.

## Step 15: Announcement — optional

One native post announcing the lead magnet, bridging naturally to it (Phase 2's CTA policy),
making no unproven conversion or outcome claims (rules.md §6.7). This is **not required** for
Checkpoint 2 — skip it if there's nothing natural to say yet.

```
echo '{"title": "...", "body": "...", "claim_refs": [...], "bridges_to_lead_magnet": true}' | tsx src/venture/phase2.ts announcement-draft <slug>
```

## Step 16: Checkpoint 2

```
tsx src/venture/checkpoint.ts clear <slug> checkpoint-2
```

Checkpoint 2 needs exactly four artifacts approved AND live: the lead magnet, the landing page,
the welcome email, and the survey review — no pace requirement, and the announcement never counts
toward it. The welcome email is the one with no address to point at: it goes live inside Muxin's
email tool, so it is confirmed with `--attestation "the welcome sequence is on"`, never with an
invented link. The survey's own "live" evidence is simply its already-live URL on humaninference.ai —
Muxin isn't building anything new for it, this step only confirms the existing survey continues to
run and the review's fit findings, if any, got acted on.

## Step 17: Keep posting, keep collecting responses — the Phase 3 gate

Phase 3 has one gate, and it's the only thing that gates it: **20 eligible unique respondents**
(target 30), counted by `src/venture/responses.ts`, never by row count or pasted lines. Below 20,
posting continues, the survey keeps collecting, and every Phase 3 analysis command below refuses —
`src/venture/phase3.ts` enforces this itself at the top of every subcommand except a
status/read command, naming exactly how many more are needed. There is no separate
"Checkpoint-2-must-clear-first" gate here — the response gate is the only prerequisite the rules
define for Phase 3's own commands.

As responses come in (survey answers, email replies, DM stuck points, comments — whatever Muxin
forwards or pastes), ingest each one:

```
echo '{"source": "survey", "received_at": "...", "target_audience_eligible": true, "exact_quote": "...", "redacted_quote": "...", "stuck_point": "...", "desired_outcome": "...", "emotional_intensity": "low|medium|high"}' | tsx src/venture/phase3.ts response-ingest <slug>
```

Preserve the exact private wording in `exact_quote`; never clean the audience's language into
generic consulting phrasing (rules.md §7.4). The command's own confirmation never echoes the quote
back — that's deliberate, not a display bug. Check progress any time:

```
tsx src/venture/phase3.ts response-gate-status <slug>
```

If Muxin wants to correct an extraction, an eligibility call, or a cluster assignment on an
already-ingested response:

```
echo '{"stuck_point": "...", "target_audience_eligible": false, "exclusion_reason": "..."}' | tsx src/venture/phase3.ts response-correct <slug> <response_id>
```

## Step 18: Cluster into three to five problems

Once the gate is open, compare responses on their underlying job or struggle, not surface wording,
and group them into three to five clusters (never a long list of micro-categories, never a fixed
category count decided in advance). For each cluster, gather its redacted evidence quotes, common
stuck point, desired outcome, and visible consequences.

```
echo '{"clusters": [{"cluster_id": "...", "label": "...", "evidence": ["..."], "stuck_point": "...", "desired_outcome": "...", "visible_consequences": "..."}, ...3-5...], "assignments": [{"response_id": "...", "cluster_id": "..."}, ...every included response, exactly once...]}' | tsx src/venture/phase3.ts cluster <slug>
```

The script computes each cluster's count from the assignments you actually give it — never trust a
round number, and never invent a count. It refuses an orphaned response (one never assigned), a
double-assignment, and an assignment naming an undeclared cluster. **Stop and show Muxin the
clusters** before scoring. She can ask for a different grouping — rerun `cluster` with corrected
assignments (it's not locked until `problem-select` runs).

## Step 19: Score and select the expensive problem

Score every cluster 1-5 on the six factors from rules.md §7.6: frequency, intensity, time cost,
money cost, stress cost, solvability. Cite real evidence for each score — never fabricate a cost
the audience didn't express. The most frequent cluster doesn't automatically win; recommend the
cluster with the best combination of repeated pain, real cost, urgency, and creator solvability.

```
echo '{"input_refs": [...], "candidates": [...one per cluster, six factor scores each...], "recommended_candidate_ids": ["..."]}' | tsx src/venture/phase3.ts problem-score <slug>
```

**Stop and show Muxin the scored problems.** She selects one:

```
tsx src/venture/phase3.ts problem-select <slug> <cluster_id> [--override-reason "..."]
```

If she picks something other than the recommended cluster, the script requires
`--override-reason "..."` — same audit-trail discipline as every other selection in this skill.

## Step 20: Define and approve the transformation

Write one plain sentence: `Go from [current painful state] to [specific useful state] in
[credible scope or time].` One person or audience, one meaningful change, no promise broader than
the evidence, and none of rules.md §7.7's named vague verbs ("unlock," "elevate," "transform," or
anything that reads the same way) anywhere in it.

```
echo '{"sentence": "...", "rationale": "...", "claim_refs": [...]}' | tsx src/venture/phase3.ts transformation-draft <slug>
```

The script mechanically rejects a banned verb, an em dash, or more than one sentence — it can't
judge whether the promise is honestly scoped to the evidence, that's your call to get right.
**Stop and show Muxin the sentence.** She can ask for edits (rerun `transformation-draft` with the
revised wording, as many times as needed) before approving:

```
tsx src/venture/phase3.ts transformation-select <slug>
```

Once approved, the sentence is frozen — it can't be selected again with different wording. A later
change means a fresh `transformation-draft` before Phase 3 completes, not a silent edit.

## Step 21: Outline the first product

Build backwards from the approved transformation: five to seven concise sections moving from the
current pain to the promised useful state, buildable and shippable in about two weeks, one offer —
not a value ladder. The orientation/diagnosis/core-method/application/tools/action-plan/
continuation pattern (rules.md §7.8) is guidance, not a mandatory template.

```
echo '{"transformation_sentence": "<the exact approved sentence>", "sections": [...5-7...], "format": "...", "claim_refs": [...]}' | tsx src/venture/phase3.ts outline-draft <slug>
```

`transformation_sentence` must match the approved sentence from Step 20 **exactly** — the script
refuses a mismatch rather than silently drifting from what Muxin actually approved. Requires the
transformation to be approved first; refuses otherwise, naming what's missing.

**Stop and show Muxin the outline.** She approves or asks for a revision:
`tsx src/venture/phase3.ts approve <slug> p3-product-outline`.

## Step 22: Recommend a price and pitch

Only after the outline is approved. First, propose the considered range — real price/format
alternatives, not just one number — weighing format and depth, outcome value, audience economics,
creator-proof strength, what the offer might replace, quick-win-ability, and whether the price
actually tests willingness to pay (rules.md §7.9's seven factors):

```
echo '{"input_refs": [...], "candidates": [{"candidate_id": "...", "label": "$79 self-paced guide", "scores": {}, "evidence_refs": [], "rationale": "..."}, ...at least 2...], "recommended_candidate_ids": ["..."]}' | tsx src/venture/phase3.ts price <slug>
```

**Stop and show Muxin the considered range.** She selects one:

```
tsx src/venture/phase3.ts price-select <slug> <candidate_id> [--override-reason "..."]
```

Then draft the actual price/pitch artifact — one recommended price, the considered range, reasoning
tied to the seven factors, known uncertainty, and an editable one-paragraph pitch:

```
echo '{"recommended_price": 79, "considered_range": "...", "reasoning": "...", "known_uncertainty": "...", "pitch_paragraph": "...", "scenario_math": null, "claim_refs": [...]}' | tsx src/venture/phase3.ts price-draft <slug>
```

**Never seed the price from the Starter Kit's own worked example.** The script refuses a
recommended price of exactly $49 — the civic-tech worked example's documented figure — as one
concrete, checkable tripwire, but it cannot catch every way a fixture's judgment could leak in.
The real discipline is upstream of the script: never read `venture/examples/civic-tech-worked-example.md`
(if it exists) into context while doing this step, for this venture or any other. The
recommendation must come from THIS venture's own cluster evidence, transformation, and outline —
nothing else.

If you include optional scenario math (illustrative-only conversion assumptions, e.g. "~2% for a
digital product" or "~0.25% for a service at a higher price"), set `scenario_math.illustrative:
true` — the script refuses scenario math missing that flag — and never present the numbers as a
forecast or a promise in the pitch itself.

**Stop and show Muxin the price and pitch.** She approves or asks for a revision:
`tsx src/venture/phase3.ts approve <slug> p3-price-decision`.

## Step 23: Checkpoint 3

```
tsx src/venture/checkpoint.ts clear <slug> checkpoint-3
```

Checkpoint 3 needs all of: the response gate opened, the cluster analysis stored, and the problem,
transformation, outline, and price/pitch decisions and artifacts all approved (decisions selected,
artifacts editorially approved — Phase 3's artifacts are internal, `delivery_mode: "none"`, so
there's no separate live-delivery step to wait on). Clearing it records `phase_3_completed` and
unlocks Phase 4.

## Step 24: Compare the time budget, then choose the daily operating plan

Once Phase 4 unlocks (`phase-3-completed` recorded), first check whether the routine even fits.
The PDF's canonical daily routine is five jobs totaling 2 hours 15 minutes: 30 min content writing
and engagement, 30 min tomorrow's posts, 30 min feedback analysis, 30 min the core offer, 15 min
direct customer outreach (rules.md §8.1).

```
echo '{"time_budget_minutes": 90}' | tsx src/venture/phase4.ts time-budget-compare <slug>
```

This is read-only — it states plainly whether the intake time budget covers the canonical routine,
nothing more. Then draft the actual recorded choice. Never demand the canonical routine and call it
sustainable if the budget doesn't fit it — offer all four options every time, never silently pick
one:

```
echo '{"time_budget_minutes": 90}' | tsx src/venture/phase4.ts operating-plan-draft <slug>
```

**Stop and show Muxin the four operating-plan modes** (use the canonical routine as-is; rotate the
five jobs across the week within budget; extend the build timeline while preserving the sequence;
revise the posting pace or scope). She selects one:

```
tsx src/venture/phase4.ts operating-plan-choice-select <slug> <mode> [--override-reason "..."]
```

If she picks anything other than the recommended mode, the script requires
`--override-reason "..."`, same discipline as every other selection in this skill.

## Step 25: Write the operating plan — schedule, triage, and automation order

With a mode selected, record the actual schedule plus two more rules.md requirements in the same
artifact: triage of recurring work (§8.2) and the automation configuration order (§8.3).

Triage every recurring task into exactly one bucket: `never_build` (needs a team the creator
doesn't want, or would be miserable to run), `ignore` (a vanity signal, distracting trend, or
competitor move that doesn't serve the venture), or `automate` (repeats more than once or twice a
week and needs no creator judgment). **Never bucket "automate" anything that is actually insight,
voice, audience empathy, product judgment, or final approval** — the script mechanically refuses
this, but it's your job to never propose it in the first place.

Automation order is a strict dependency sequence (§8.3): lead-magnet delivery and welcome message,
then post-signup tagging/segmentation, then follow-up sequences, then payments/receipts/scheduling
(only if the offer needs them, and only after the earlier three are documented — even a
"skipped, not needed" entry counts, a missing step number doesn't). Never build a complex funnel
just to complete the sprint.

```
echo '{"time_budget_minutes": 90, "schedule": {"mon": "...", ...}, "triage": [{"bucket": "automate", "item": "welcome email", "note": "..."}, ...], "automation_order": [{"step": 1, "name": "lead-magnet delivery and welcome message", "status": "configured"}, ...]}' | tsx src/venture/phase4.ts operating-plan-write <slug>
```

**Stop and show Muxin the full operating plan for approval:**
`tsx src/venture/phase4.ts approve <slug> p4-operating-plan`.

## Step 26: Direct outreach — thank-you notes, one at a time, always manual

Draft a short personal thank-you note for each early respondent whose answer actually changed the
product (rules.md §8.4). Each note links privately to its source response, names the idea or
section it influenced, stays to two short sentences unless Muxin asks for more, and makes no sales
demand.

```
echo '{"response_id": "...", "influenced_idea_or_section": "...", "note_text": "..."}' | tsx src/venture/phase4.ts thank-you-note-draft <slug> <note_id>
```

The script hard-refuses a raw email address or @-handle in the note (these files are not
gitignored, unlike `responses.jsonl`) and warns — but does not block — on sales-ask language like
"buy," "purchase," "sign up," or "$", since a respondent's own words may legitimately include them.

**Stop and show Muxin each note individually, one at a time — never batch several for approval in
one pass:** `tsx src/venture/phase4.ts approve <slug> p4-thank-you-<note_id>`. This stays manual no
matter what: Muxin sends every approved note herself, this skill never sends anything.

## Step 27: Day 14 review — the facts, not a verdict

Draft the Day 14 scorecard against the fixed fields from rules.md §8.5: posts confirmed live
(computed, never entered), posting pace achieved, qualified views/clicks, the clicks target fixed
at intake, landing-page opt-in rate, the opt-in target fixed at intake, eligible unique responses
(computed), response quality, and sustainability of the operating plan.

```
echo '{"posting_pace_achieved": "...", "qualified_views_or_clicks": 120, "landing_page_opt_in_rate": 0.08, "response_quality_read": "...", "sustainability_read": "..."}' | tsx src/venture/phase4.ts day-14-scorecard-draft <slug>
```

`posts_live` and `eligible_unique_responses` are computed straight from artifact/response data, and
the script refuses stdin input for either. The two intake targets are read verbatim from the Day 0
scorecard, not re-entered — supplying a value that disagrees with what was fixed at kickoff is a
hard refusal, not a silent revision. A field the venture genuinely doesn't have enough data for
renders as "not enough data yet," never a fabricated number. **Never invent a pass condition on Day
14** — use only these fixed fields, nothing more.

**Stop and show Muxin the facts before deciding anything:**
`tsx src/venture/phase4.ts approve <slug> p4-day-14-review`.

## Step 28: Day 14 decision — Phase 4 ends here, not at a checkpoint

Once the review is approved, Muxin makes exactly one final call: continue, revise positioning,
revise the lead magnet, collect more evidence, or stop (rules.md §8.5). The system never
recommends one of these — there is no "right" answer to default to.

```
tsx src/venture/phase4.ts day-14-decide <slug> <continue|revise_positioning|revise_lead_magnet|collect_more_evidence|stop> --reason "..."
```

`--reason` is required — rules.md §8.5: "Record the decision and reason." Once the operating plan
and the Day 14 review are both approved and this decision is recorded, the script fires
`phase-4-completed` on its own and prints as much; if something's still outstanding it says exactly
what. **There is no Checkpoint 4 and no `checkpoint.ts clear <slug> checkpoint-4` command to run** —
Phase 4 is the one phase that ends in a human decision, not a cleared gate. After the decision,
show Muxin the source's broader expectation as mindset guidance, never a forecast: months 1-3 may
feel slow and unclear, months 4-6 should improve content and offers, months 7-12 may show
compounding, referrals, and repeat buyers (rules.md §8.6).

## Throughout

- One deliverable or decision at a time — never bundle "here are the ideas AND here's a draft."
- If a gate refuses, that's the wall working. Explain what's actually missing, don't work around it.
- Never read `venture/examples/civic-tech-worked-example.md` (if it exists) into context for a
  real venture, and never let its specific categories (e.g. "civically awake but not
  performative") leak into a clean venture's research plan as if they were universal defaults. This
  applies to Phase 3's price step too — see Step 22.
- If you use optional scenario math in Phase 3 (Step 22), it is illustrative only — label it as
  such, let Muxin change the assumptions, and never let it read as a forecast or a promise.
- Never treat "Day 14" or "days 11-14" as a literal calendar check — it's descriptive framing from
  the source PDF, not a date gate. Phase 4 opens purely on `phase-3-completed` being recorded
  (rules.md §13 item 18), whenever that actually happens, and the Day 14 review runs whenever
  Muxin is ready for it, not on a clock.
- Never let the Day 14 scorecard invent a pass condition beyond its nine fixed fields (Step 27) —
  no extra metric, no rounding a "not enough data yet" up into an invented number.
