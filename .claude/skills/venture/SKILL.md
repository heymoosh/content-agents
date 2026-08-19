---
name: venture
description: Build 3 — run Phase 1 ("Attention") and Phase 2 ("Audience") of a solo-business sprint that tests what an audience actually wants, then builds a narrow lead magnet and owned-audience capture around it. Usage - /venture new <slug>, /venture <slug>.
---

# /venture — Phase 1: Attention, Phase 2: Audience (Build 3)

Help Muxin test what an audience wants, needs, and will pay for — starting with Phase 1: pick one
platform, run public qualitative discovery, publish three probe posts, hit Checkpoint 1. Then
Phase 2: turn what Phase 1 learned into a narrow lead magnet, a landing page, a welcome email, and
a fit review of Muxin's existing survey, hitting Checkpoint 2. Offer and Operations (Phases 3-4)
aren't built yet.

## This is composed business content — and why that's allowed

Unlike Build 0/1 (extraction-first), Venture is **composed**: you draft post ideas and copy
testing the audience, not quoting a source essay. This is deliberately narrower than Build 2
(Fiction)'s exception — see `venture/CLAUDE.md` and `CLAUDE.md` rule 1's Build 3 clause before
doing anything else in this skill if you haven't read them this session. Two things carry over
in full, unlike Fiction: **`config/voice.yaml` governs every draft completely** (this ships under
Muxin's real name, not a labeled fictional register), and **every concrete claim needs a
`claim_refs` entry** tracing it to an intake answer or a confirmed fact — never assert a result,
customer, or number Muxin didn't actually have.

**Every gate below is enforced by `src/venture/phase1.ts` (Phase 1) and `src/venture/phase2.ts`
(Phase 2), not by you remembering to stop.** Each script refuses to move forward if a prior gate
hasn't cleared. Treat a refusal as correct behavior, not a bug to route around.

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
herself; once it's live, she confirms the URL:

```
tsx src/venture/deliver.ts confirm <slug> <artifact_id> --url <live-url>
```

An approved `text-post-note` claims a slot from the same shared scheduler `/atomize` uses (so it
can never collide with a same-day `/atomize` Note), then posts through the existing Substack Notes
agent once that slot is due — re-running `deliver.ts` is what actually fires an already-claimed
slot, there's no separate cron. Both paths write real delivery evidence
(`{type: "url", ...}` or `{type: "agent", ...}`) — this is what Checkpoint 1 checks for below.

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
toward it. The survey's own "live" evidence is simply its already-live URL on humaninference.ai —
Muxin isn't building anything new for it, this step only confirms the existing survey continues to
run and the review's fit findings, if any, got acted on.

## Throughout

- One deliverable or decision at a time — never bundle "here are the ideas AND here's a draft."
- If a gate refuses, that's the wall working. Explain what's actually missing, don't work around it.
- Never read `venture/examples/civic-tech-worked-example.md` (if it exists) into context for a
  real venture, and never let its specific categories (e.g. "civically awake but not
  performative") leak into a clean venture's research plan as if they were universal defaults.
