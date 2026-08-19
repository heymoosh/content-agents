---
name: venture
description: Build 3 — run Phase 1 ("Attention") of a solo-business sprint that tests what an audience actually wants, through Muxin's own probe posts. Usage - /venture new <slug>, /venture <slug>.
---

# /venture — Phase 1: Attention (Build 3)

Help Muxin test what an audience wants, needs, and will pay for — starting with Phase 1: pick one
platform, run public qualitative discovery, publish three probe posts, hit Checkpoint 1. Later
phases (Audience, Offer, Operations) aren't built yet.

## This is composed business content — and why that's allowed

Unlike Build 0/1 (extraction-first), Venture is **composed**: you draft post ideas and copy
testing the audience, not quoting a source essay. This is deliberately narrower than Build 2
(Fiction)'s exception — see `venture/CLAUDE.md` and `CLAUDE.md` rule 1's Build 3 clause before
doing anything else in this skill if you haven't read them this session. Two things carry over
in full, unlike Fiction: **`config/voice.yaml` governs every draft completely** (this ships under
Muxin's real name, not a labeled fictional register), and **every concrete claim needs a
`claim_refs` entry** tracing it to an intake answer or a confirmed fact — never assert a result,
customer, or number Muxin didn't actually have.

**Every gate below is enforced by `src/venture/phase1.ts`, not by you remembering to stop.** The
script refuses to move forward if a prior gate hasn't cleared. Treat a refusal as correct
behavior, not a bug to route around.

## Step 1: New venture — intake

`/venture new <slug>` runs the 25-question interview from `venture/rules.md` §4.2, one question
at a time (not a form dump). For each question:

- Ask it plainly, in your own words if that helps, but store the answer **verbatim**, exactly as
  given — never paraphrase what Muxin says.
- If an answer is thin, it's fine to ask a natural follow-up, but don't push for more than she
  offers.
- After all 25, collect voice evidence: 1-3 writing samples, a worldview statement, phrases she
  naturally uses, phrases/tones she refuses.

Then write the answers via stdin as JSON matching `IntakeAnswers`/`VoiceEvidence`
(`src/venture/intake.ts`):

```
echo '{"answers": {...25 keys...}, "voice": {...}}' | tsx src/venture/new-venture.ts <slug>
```

Confirm the intake is complete before moving to Phase 1 — the script refuses to kick off if any
of the 25 answers is missing.

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

Delivery mechanics (`src/venture/deliver.ts`) aren't built yet as of this writing — check
`docs/content-agents-backlog.md` / `git log` before assuming otherwise. Once they exist: an
approved `substack-post` writes to `ready-to-paste/` for Muxin to paste herself; an approved
`text-post-note` posts through the existing Substack Notes agent via the shared scheduler.

## Step 7: Checkpoint 1

Once all three are approved and live, with posting pace recorded:

```
tsx src/venture/checkpoint.ts checkpoint-1 <slug> --pace "<N>/week"
```

(Also not built yet as of this writing — same caveat as Step 6.) Checkpoint 1 needs all three
conditions: three approved, three live with evidence, pace recorded. Approval alone never clears
it, and there is no partial pass.

## Throughout

- One deliverable or decision at a time — never bundle "here are the ideas AND here's a draft."
- If a gate refuses, that's the wall working. Explain what's actually missing, don't work around it.
- Never read `venture/examples/civic-tech-worked-example.md` (if it exists) into context for a
  real venture, and never let its specific categories (e.g. "civically awake but not
  performative") leak into a clean venture's research plan as if they were universal defaults.
