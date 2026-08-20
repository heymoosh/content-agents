# Venture Build — the data contract to design against

**Status:** a contract, not code. Nothing here is built. It exists so the Venture Build front end
can be designed against real state instead of invented state, and so the build that follows has an
unambiguous target. Companion to `docs/venture-build-plan.md`, which specifies the behavior, and to
`venture/rules.md`, which specifies the decision logic; this specifies the shape of what the screens
render and what gets recorded.

**Locked product decision (2026-08-07):** Venture is the permanent sixth top-level room (see
`docs/content-studio-vision.md`). §7's earlier "room placement is a design decision" language is
withdrawn below — that question is settled and this document no longer treats it as open.

**Source version this contract is written against:** the Welsh note at
`sha256:bad486c48b8477a9ae3c92fae3cd1c40dded1dc6cda483a5f297ddbb6da81df3` (1,567 lines, current as of
2026-08-07) and the Starter Kit PDF at
`sha256:773250cefd3ec8a8dfd86b1f6247f9005dd1f1bda47a0c5171a6f6236722ecc6` (8 pages) — the same pair
`docs/venture-build-plan.md` cites. This contract makes no version-specific claims that depended on
the stale 772-line note.

**This contract states current answers only.** Earlier versions carried a stack of dated "corrective
pass" notes here, each partly superseding the one above it; those are removed and the affected
sections rewritten instead. Where a shape changed across reviews, the section that owns it says so
inline. Revision history is in `venture-work-package-1-verification.md`.

**Why this comes before the design.** The plan's §D establishes that the current queue cannot
represent this build's deliverables: `QueueRow` (`src/publish/queue.ts:14`) carries
`id`/`platform`/`format`/`asset`/`status`/`notes`/`origin` (plus `lineIndex`, a parse artifact of
the markdown table rather than part of the logical shape), and `src/review/rows.ts:35` recognizes
exactly five artifact kinds, none of which is a landing page, a survey, a welcome email, a product
outline, or a price. A phase screen designed today would show a "live" column nothing can populate,
and an "approved" state that conflates Muxin's editorial yes with the artifact actually being
public.

**Where this departs from the plan.** The plan sketches delivery as
`not_applicable | ready → scheduled → live_confirmed | failed`. That sketch has no state for a
drafted-but-unapproved artifact, and no way to represent the several deliverables the app never
publishes yet which still must be live before a checkpoint clears. §2 below extends it. Every
departure is marked **[extends plan]** and is a proposal for Muxin to confirm, not a silent
override.

---

## 0. Where venture rows physically live

**Decision: venture artifacts get their own store under `venture/<slug>/`. The existing
`content/**/review-queue.md` and `outreach/**` tables are not widened.**

The plan's "extend the queue schema" is a change to the *logical* row contract, not six new columns
bolted onto the hand-edited GFM tables. `readQueue(folder)` is already per-folder, so a venture
folder having its own store satisfies the plan's "review-queue rows" language without touching a
byte of the existing ones.

To be accurate about what does and does not force this, since one plausible argument turns out to be
false:

- **Not a reason:** "widening the table would corrupt rows on save." It would not. `writeCell`
  (`queue.ts:103`) splits on `|`, edits only cells 8 and 9, and rejoins **every** cell, so trailing
  columns survive a status click. `readQueue` parses each line by its own cell count, so a table
  mixing 9-, 10- and 16-column rows parses fine.
- **Real reason 1 — the table is a human editing surface.** Every `review-queue.md` opens with "Set
  status to approve / revise / discard." Muxin edits it by hand. A sixteen-column GFM table is not
  something a person edits by hand.
- **Real reason 2 — mixing hand-written and machine-written fields invites clobbering.** Editorial
  status is hers. Delivery status, evidence and checkpoint ids are written by scripts and agents.
- **Real reason 3 — `appendRow` writes a fixed layout.** It "always writes the full 10-column
  layout ... regardless of what column count the rest of the table happens to use"
  (`queue.ts:127`). Any existing path that creates a row would silently emit a venture row missing
  every venture field.
- **Real reason 4 — the body doesn't live where the app expects.** `saveDerivative`/`enrich` assume
  an editable body at `derivatives/<id>.md`. Landing-page copy and a product outline don't.

### 0.1 Physical layout (markdown option)

Contingent on open question #2. If that answer flips to SQLite, every field name, enum and
transition below survives unchanged and only this subsection is replaced.

```
venture/<slug>/
  intake.md                      # 25-question answers + the Day 14 scorecard, fixed at kickoff
  canon.md                       # append-only event ledger (see §5.3); stamps kickoff_at
  state.md                       # derived cache; canon.md is authoritative
  responses.jsonl                # gitignored, never reaches the GUI (§5.4) — Phase 3
  evidence-links.jsonl           # gitignored — this venture's links into the account-level
                                 #   observation store, with derived evidence_role (§5.4b)
  decisions.jsonl                # ONE LINE PER DECISION — the decision-record log (§2A)
  funnel-events.jsonl            # ONE LINE PER EVENT — visits/opt-ins/leads/sales with attribution (§5.7)
  artifacts.jsonl                # ONE LINE PER ARTIFACT — the venture queue
  phase-N-<name>/<artifact_id>.md  # the editable body

data/analytics.db                # ALREADY EXISTS, already gitignored — account-level, not per-venture
  ├ research_observations        # the canonical observation store (§5.4a), one row per source
  │                              #   observation, shared across every venture and non-venture strategy
  └ research_observation_classifications
                                 # MANY rows per observation (§5.4c) — one per taxonomy and version,
                                 #   so re-classifying never duplicates the observation

data/research/                   # MUST BE GITIGNORED (not covered today) — raw capture from the
                                 #   ingestion pipeline; holds reply text and author handles
```

**Round-3 note — `phase1-observations.jsonl` is retired.** Rounds 1–2 put observations in
`venture/<slug>/phase1-observations.jsonl`. That file no longer exists in this contract: its
venture-neutral content moved to the account-level `research_observations` store, and its
venture-relative content (`evidence_role`, `unknown_ids`, `target_audience_fit`) moved to
`evidence-links.jsonl`. §5.4a explains why. Any reference to `phase1-observations.jsonl` in an older
draft means those two together.

`artifacts.jsonl` rather than a markdown table, precisely because these rows are machine-written:
JSON Lines gives a nested `evidence` object and a `failure` object without inventing a cell-encoding
scheme, and appending is atomic per line. One line per artifact, rewritten in place on change (the
file is small; a venture produces tens of artifacts, not thousands). Each line:

```json
{ "artifact_id": "p1-essay-01", "phase": 1, "artifact_kind": "substack-post",
  "title": "Why local elections decide more than you think",
  "body_path": "phase-1-attention/p1-essay-01.md",
  "checkpoint_id": "checkpoint-1", "delivery_mode": "manual", "publishable": false,
  "editorial_status": "draft", "delivery_status": "awaiting_approval",
  "evidence": null, "retraction": null, "failure": null,
  "created_at": "…", "updated_at": "…" }
```

Venture rows have no `lineIndex`; it is meaningless outside the markdown tables.

---

## 1. The fields

Additive to the logical row contract. Existing `content/` and `outreach/` rows carry none of them
and keep working untouched — see §6.

| Field | Type | Values | Who writes it | When |
|---|---|---|---|---|
| `artifact_kind` | enum | §3 | script | at draft time, never changes |
| `delivery_mode` | enum | `app` / `manual` / `none` | script | derived from `artifact_kind` (§3) |
| `publishable` | boolean | `true` iff `delivery_mode` is `app` | script | at draft time |
| `checkpoint_id` | string \| null | `checkpoint-1`…`checkpoint-3`, or null | script | at draft time |
| `editorial_status` | enum | `draft` / `approved` / `discarded` | **Muxin**, via the GUI | on her decision |
| `delivery_status` | enum | §2 | script, agent, or her attestation | initialized at draft time; only leaves `awaiting_approval` after approval |
| `evidence` | object \| null | §4 | whoever confirms delivery | on confirmation |
| `retraction` | object \| null | §4.2 | Muxin | on a retract, alongside the original `evidence` |
| `failure` | object \| null | §4.1 | script or agent | on a delivery failure |
| `claim_refs` | array of `{ claim: string, ref: string }` | `ref` is `intake:qN` or a `confirmed_known`'s evidence pointer | script | at draft time, one entry per concrete factual claim in the body |

**`claim_refs` is a post-artifact field, distinct from `evidence_refs` (§2C).** `evidence_refs`
traces a research-plan/decision-record claim back to an observation or citation (§2A, §2C.1,
§2C.3, §2C.4). `claim_refs` is the narrower, outbound-facing counterpart: it traces each concrete
factual claim inside a **drafted Phase 1 post's own body** back to an `intake.md` answer or a
`confirmed_known`, so a reviewer can check the post itself without re-deriving the research plan.
This is the field `venture/CLAUDE.md` describes as "Venture's replacement for `source_lines`
tracing" — see that doc's "The claim boundary" section. A claim with no ref is cut or reframed as
an explicit hypothesis before a post reaches `editorial_status: approved`.

**[extends plan]** `delivery_mode`, `retraction` and `failure` are additions. `delivery_mode` exists
because `publishable` was being asked to mean two different things — "the app can deliver this" and
"this needs to be live at all" — and most kinds need the first false while the second is true.
`failure` exists because `delivery_status: failed` alone gives a screen nothing to show but the word
"failed". `retraction` is separate from `evidence` so that taking something down does not erase the
record that it was once live.

Two rules that hold across every kind:

1. **`publishable` is checked, never inferred.** Today `publishText` selects rows by
   `r.status === "approve" && TEXT_PLATFORMS.has(r.platform)` (`typefully.ts:328`). For venture rows
   a publisher must require **all three**: `publishable === true`, `editorial_status === "approved"`,
   and `delivery_status === "ready"`. Any one alone is insufficient, and a literal reading of the
   old platform check would either publish drafts or select nothing at all.
2. **`editorial_status` is the only field Muxin writes.** Everything else is machine state, except
   the explicit attestation in §4. A screen must never offer her a control that edits delivery state
   directly.

---

## 1B. Content lineage fields

**Added 2026-08-07, corrective pass.** The 2026-08-07 review flagged that §1's field table has no way
to answer "which post brought in this lead" — there was no origin, no venture/phase tag, no
primary-to-derivative relationship, no CTA/lead-magnet/offer reference, and no rules-version stamp on
content itself (only on decision records, §2A). This closes that gap. These fields apply to **every**
content item this repo produces, not only Venture ones — a Studio-originated post carries the same
fields with `origin_type: "studio"` and the venture-specific fields null. This is what
`docs/content-studio-vision.md`'s "From Venture" / "From Studio" origin tag reads from.

| Field | Type | Values | Who writes it | When |
|---|---|---|---|---|
| `origin_type` | enum | `studio` \| `venture` \| `fiction` | script | at creation, never changes |
| `venture_id` | string \| null | a venture slug | script | at creation; null unless `origin_type === "venture"` **or** a Studio item is explicitly attached to a Venture |
| `venture_phase` | integer \| null | `1`–`4` | script | at creation; the phase active when this item was drafted |
| `message_id` | string | the id of the core "cut" (`content-studio-vision.md`'s core message) this item's copy derives from | script | at creation; shared across every platform derivative of one piece |
| `primary_item_id` | string \| null | an `artifact_id` | script | null on a primary item itself; set on every derivative to the primary it derives from |
| `parent_artifact_id` | string \| null | an `artifact_id` | script | same value as `primary_item_id` for a first-generation derivative; supports future re-derivation without ambiguity |
| `pillar` | string \| null | a pillar id from `config/pillars.yaml` | script (tagging step) | at tag time, may be unset until tagged |
| `cta_id` | string \| null | a CTA decision id (see the CTA-policy work in `venture/rules.md` §1A.1) | script | at draft time, once a CTA is chosen |
| `lead_magnet_id` | string \| null | an artifact id of `artifact_kind: lead-magnet` | script | set when this item bridges to a specific lead magnet |
| `offer_id` | string \| null | an artifact id of `artifact_kind: price-decision` | script | set when this item bridges to a specific offer |
| `rules_version` | string \| null | e.g. `venture-rules-2026-08-07-draft-1` | script | stamped at creation from the venture's kickoff-time rules version; null for non-Venture content |

**A primary item's own `primary_item_id` is null; its `artifact_id` is what every derivative's
`primary_item_id` points back to.** This is the concrete mechanism behind `venture/rules.md` §1A rule
3 ("a Venture's primary content item must clear its own requirements before its derivatives are
required") — a query for "everything still blocking this primary" filters on `primary_item_id ===
<this item's artifact_id>`, and a query for "what did this lead's post look like" walks `cta_id` /
`lead_magnet_id` back from a funnel event (§5.7) to the exact content item and its `message_id`
family.

**Non-Venture content is not exempt from these fields — it just carries fewer of them set.** A direct
Studio post has `origin_type: "studio"`, `venture_id: null`, `venture_phase: null`, a real
`message_id`, and `pillar`/`cta_id` set the same way it is today. This table does not require
`content/**/review-queue.md` rows to gain new columns (§0 already establishes venture rows live in
their own store) — it specifies the logical fields Work package 2's `src/db/schema.sql` and content
lineage layer need to carry, however they end up physically stored for non-venture content.

---

## 2. The two state machines

They are independent, and conflating them is the specific bug this build must avoid: Typefully calls
`setStatus(folder, row, "published")` immediately after `createDraft` (`typefully.ts:434`), while the
draft is merely *scheduled*. Nothing about that proves anything is publicly live.

### Editorial — actor: Muxin, always

```
                    approve
        draft ──────────────────▶ approved
          ▲ ◀──────────────────────   │
          │        restore            │   discard  (never handed off)
          │                           │   cancel   (handed off, not live)
          │                           │   retract  (was live)
          │        discard            ▼
          └──────────────────── discarded
                    restore
```

| Editorial transition | When it is called | Delivery side-effect |
|---|---|---|
| `draft → approved` | **approve** | `awaiting_approval → ready`; `not_applicable` unchanged |
| `draft → discarded` | **discard** | `awaiting_approval → cancelled`; `not_applicable` unchanged |
| `approved → draft` | **restore** — only while delivery is `ready` or `not_applicable` | `ready → awaiting_approval`; `not_applicable` unchanged |
| `approved → discarded` | **discard** while delivery is `ready`/`not_applicable` | `ready → cancelled`; `not_applicable` unchanged |
| `approved → discarded` | **cancel** while delivery is `handed_off` or `failed` | `→ cancelled` |
| `approved → discarded` | **retract** — only from `live_confirmed` (§2.1) | `live_confirmed → cancelled`, `retraction` recorded |
| `discarded → draft` | **restore** | `cancelled → awaiting_approval`; `not_applicable` unchanged |

Three different words because they are three different acts: **discard** throws away something that
never went anywhere, **cancel** stops something already in flight, **retract** takes down something
that was public. Only retract records anything of its own: a `retraction` attestation (§4.2),
written alongside the original `evidence` and never over it.

`delivery_mode: none` artifacts have no delivery side-effect at all: their `delivery_status` is
`not_applicable` from creation and never changes, through every editorial transition above.

### Delivery — actor: script, agent, or Muxin's attestation

```
not_applicable                                       (delivery_mode: none — terminal)

awaiting_approval ──approved──▶ ready ──hand off──▶ handed_off ──confirm──▶ live_confirmed
        │                         │                     │                        │
        │                         │                     └──fail──▶ failed        │
        │                         │                                  │           │
        └────discarded────▶ cancelled ◀────discarded─────────────────┘           │
                                 ▲                                               │
                                 └──────────────retract──────────────────────────┘
                                                    (retract writes `retraction`, keeps `evidence`)
        failed ──retry──▶ ready
```

| Transition | Actor | Trigger |
|---|---|---|
| initial | script | `awaiting_approval` if `delivery_mode` is `app`/`manual`; `not_applicable` if `none` |
| `awaiting_approval → ready` | script | Muxin approved |
| `awaiting_approval → cancelled` | script | Muxin discarded |
| `ready → awaiting_approval` | script | Muxin restored it to draft |
| `ready → handed_off` | script / agent | app mode: scheduled at Typefully or handed to the Substack Notes agent. manual mode: `ready-to-paste/` written, or the copy handed over — it is now on a human |
| `ready → cancelled` | script | Muxin discarded before hand-off |
| `handed_off → live_confirmed` | agent, or **Muxin's attestation** | evidence supplied (§4) |
| `handed_off → failed` | script / agent | provider error, agent could not post, or Muxin reports the manual step failed |
| `handed_off → cancelled` | script | Muxin cancelled before it ever went live |
| `failed → ready` | script | retry |
| `failed → cancelled` | script | Muxin gave up on it |
| `live_confirmed → cancelled` | Muxin | retract — requires its own attestation (§2.1) |
| `cancelled → awaiting_approval` | script | Muxin restored a discarded artifact to draft |

**[extends plan]** `awaiting_approval`, `cancelled` and the rename of `scheduled` to `handed_off`
are additions. `handed_off` because for manual-mode artifacts nothing is "scheduled" — a
ready-to-paste file exists and the ball is in Muxin's court, which is the same *position* in the
machine and needs one honest name.

**Delivery never starts before editorial approval.** There is no path from `awaiting_approval` into
`ready` that does not go through Muxin's yes. That is what makes rule 2 ("nothing publishes without
review") structural rather than conventional.

**`failed` is reachable only from `handed_off`, and that applies to `manual` mode as much as to
`app` mode.** A manual delivery fails when the human step could not be completed — the page never
went up, the email tool rejected the sequence — and Muxin says so. What cannot fail is
`delivery_mode: none` (nothing is ever delivered) and `live_confirmed` (already out; use retract).
Failure is about the delivery attempt, not about who was attempting it, so `publishable` has no
bearing on it.

`not_applicable` is terminal. `cancelled` is terminal **except** for a restore back to
`awaiting_approval`. `live_confirmed` is terminal except for retract.

### 2.1 Retract

`live_confirmed → cancelled` is the only transition that walks something back after it was public.
It writes a `retraction` object (§4.2) **without touching `evidence`**, because the artifact really
was live and erasing that record would falsify the history a cleared checkpoint rests on. The
`retraction` carries its own attestation, since the system can no more verify a takedown than it could
verify the original posting. It sets `editorial_status` to `discarded` in the same operation. A checkpoint that had cleared on the
strength of that artifact does **not** silently un-clear; it records a `retracted` event in
`canon.md` and surfaces on the phase screen, because unwinding a cleared checkpoint automatically
would rewrite history the venture was already built on.

### 2.2 Valid combinations, and what a screen shows for each

This is the design-facing table — the enumerated states Muxin will actually see.

| editorial | delivery | Label | Actions available |
|---|---|---|---|
| `draft` | `awaiting_approval` | "awaiting your yes" | Approve, Discard, Edit |
| `draft` | `not_applicable` | "awaiting your yes" | Approve, Discard, Edit |
| `approved` | `not_applicable` | "done" | Discard, Restore to draft |
| `approved` | `ready` | "approved, not sent yet" | Discard, Restore to draft, (system hands off) |
| `approved` | `handed_off` (app) | "scheduled, not live yet" | Confirm live, Cancel |
| `approved` | `handed_off` (manual) | "waiting on you to put it live" | Confirm live (URL or attestation), Report failed, Cancel |
| `approved` | `failed` | "delivery failed" + the `failure` reason | Retry (if `retryable`), Give up |
| `approved` | `live_confirmed` | "live" + how it was confirmed | Retract |
| `discarded` | `cancelled` | "discarded" | Restore to draft |
| `discarded` | `not_applicable` | "discarded" | Restore to draft |
| `discarded` | `cancelled` (with `retraction`) | "retracted" + when and why | Restore to draft |

Combinations not in this table are invalid and a reader should reject them. In particular
`discarded × ready` and `discarded × handed_off` cannot exist: discarding or cancelling drives
delivery to `cancelled` in the same operation, so nothing can schedule an artifact Muxin has thrown
away. `approved × awaiting_approval` cannot exist either — approval always moves delivery to
`ready`.

"Retracted" is a distinct label from "discarded" even though both are `discarded × cancelled`: the
presence of a `retraction` object is what separates "this was never used" from "this was public and
came down", and the screen must not flatten them into one word.

"live" must always render **how** it was confirmed. An agent confirmation and Muxin's own word are
not the same fact and must not look the same (§4).

---

## 2A. Decision records — the model this contract was missing

**The gap.** Everything above models *delivery* — what an artifact is and whether it went live. None
of it models *how a venture decision got made*. The 2026-08-07 audit's central finding: the prototype
"often shows the result of a decision without representing the inputs, scoring, evidence, user
override, or audit trail that should produce it." A row-per-artifact schema cannot represent "here
are five lead-magnet concepts, here is how each scored, here is which one the system recommended,
here is which one Muxin actually picked and why." That needs its own record.

**Decision: a separate `decisions.jsonl`, not fields bolted onto artifacts.** Same physical treatment
as `artifacts.jsonl` (§0.1) — one line per decision, appended/rewritten in place, machine-written.
Living in the venture folder, not in git-sensitive territory (a decision record can reference response
evidence by id without containing the raw quote — see §5.4's redaction boundary).

```json
{
  "decision_id": "p3-problem-01",
  "decision_kind": "platform-recommendation" | "idea-ranking" | "lead-magnet-concept"
                 | "problem-selection" | "transformation-choice" | "product-format-and-price"
                 | "day-14-outcome",
  "rules_version": "venture-rules-2026-08-07-draft-1",
  "input_refs": ["response:r-001", "response:r-002"],
  "candidates": [
    {
      "candidate_id": "cluster-1",
      "label": "Overwhelm and lack of direction",
      "scores": { "frequency": 4, "intensity": 5, "time_cost": 5, "money_cost": 2,
                  "stress_cost": 5, "solvability": 4 },
      "evidence_refs": ["response:r-001"],
      "rationale": "…"
    }
  ],
  "recommended_candidate_id": "cluster-1",
  "selected_candidate_id": null,
  "selected_by": "muxin" | "system" | null,
  "override_reason": null,
  "status": "awaiting_user" | "selected" | "superseded",
  "created_at": "…", "decided_at": null
}
```

`scores` is kind-specific — the six-factor shape above is Phase 3's problem score
(`venture/rules.md` §7.6); an idea-ranking decision's candidates carry the four factors from §5.2
instead (personal stake, specificity, identity signal, easy reply); a lead-magnet-concept decision
carries the six from §6.2. The schema does not enumerate every kind's score shape here — that lives
in `venture/rules.md`, and a decision record's `rationale` and `scores` fields are free-form enough to
hold whichever kind-specific rubric produced them, so a rules revision never requires a schema
migration.

**Every judgment step in the venture uses this record family**, not a bespoke shape per step:

- platform recommendation (Phase 1, one decision, one candidate normally, but ties may show more);
- the ten ranked content ideas (one decision, ten candidates, three selected — see §1's `editorial_status`-equivalent for a decision: `selected_candidate_id` may hold multiple ids where a step allows more than one pick; represent a multi-select decision as `selected_candidate_ids: []` instead of the singular field when the kind requires it; see §2C.5 for the distinct-unknown-coverage requirement on this decision's `rationale`);
- **`phase-1-research-continuation`** (added 2026-08-07) — candidates are exactly `more_probes`, `proceed_with_evidence`, and `proceed_as_hypothesis`; `input_refs` includes the `phase_1_research_plan` and `phase_1_research_read` artifact ids; Muxin MUST select one before Phase 2 concept generation is allowed to run (§5.1/§5.2 — this is the concrete decision behind `venture/rules.md` §5.6's "review, don't just gate on existence" requirement). `more_probes` returns to Phase 1 idea generation for another round rather than advancing;
- the five lead-magnet concepts — `input_refs` MUST include the `phase_1_research_read` artifact id and the `phase-1-research-continuation` decision id, and generation MUST NOT start until that decision's `status` is `selected` with `proceed_with_evidence` or `proceed_as_hypothesis`. A candidate whose cited evidence includes a finding with `signal_quality: "thin"` MUST carry `label_as_hypothesis: true` (a structured boolean field on `Candidate`, `src/venture/decisions.ts` — not a `"hypothesis"` substring in the free-text `rationale`), not be presented at the same confidence as a candidate backed by moderate or strong evidence. This is mechanically enforced: `label_as_hypothesis` is cross-checked against the research-read finding(s) a candidate's `evidence_refs` actually cite (computed `signal_quality`, not just Claude's self-reported `thin_evidence` flag on its own input) — see `src/venture/phase2.ts`'s `cmdConcepts`;
- response clusters and problem selection;
- the transformation choice;
- product format and price;
- the Day 14 continue / revise-positioning / revise-magnet / collect-more-evidence / stop outcome.

**A screen's "show your reasoning," "choose another," and "change the inputs" controls read directly
from this record** — `candidates[].rationale` and `evidence_refs` are the reasoning; picking a
different `candidate_id` and writing `override_reason` is "choose another"; nothing in this record is
mutable once `status` is `selected`, so "change the inputs" always creates a new decision with a fresh
`decision_id` and `input_refs`, never edits history in place. This mirrors the append-only discipline
`canon.md` already uses for delivery events (§5.3).

## 2B. Structured copy-block fields — replacing the opaque `body_path`

**The gap.** §0.1 gives every artifact one `body_path` pointing at a single markdown file. That's
right for a Substack post or a product outline read top to bottom, but the audit's P0 finding was
that landing-page copy, the welcome email, the survey, the outline, and the price/pitch need
individually editable fields — the current shape makes the whole block one approve-or-discard unit.

**Decision: artifacts whose `artifact_kind` is one of the structured kinds below carry a `fields`
object alongside `body_path`.** `body_path` still exists (it's the rendered/composed view used for
delivery — what actually gets pasted or installed); `fields` is the editable source of truth the
review screen renders as separate controls, each independently saveable while
`editorial_status: draft`. A field-level edit re-derives `body_path`'s rendered content; it does not
require a new artifact.

| `artifact_kind` | `fields` shape (all string unless noted) |
|---|---|
| `landing-page-copy` | `headline`, `subheadline`, `benefit_1`, `benefit_2`, `benefit_3`, `button_label`, `form_intro`, `thank_you_message`, `privacy_copy` (optional). First four plus `button_label` are the PDF's normative minimum (`venture/rules.md` §6.4); the rest are the built capture layer's support fields, never a substitute for the minimum. |
| `welcome-email` | `subject`, `preview_text`, `body`, `lead_magnet_link_text`, `lead_magnet_destination`, `survey_question_or_link` |
| `survey` | **Superseded 2026-08-19** (`venture/rules.md` §6.5's amendment): Muxin already has a real, live 4-question branching survey (`venture/existing-survey-humaninference.md`) — this artifact reviews it for fit against the chosen lead magnet rather than authoring a new one. `existing_survey_snapshot: string` (the survey text this review ran against), `fit_assessment: { question_number: 1\|2\|3\|4; fits_chosen_magnet: boolean; note: string }[]`, `recommended_changes: string[]`, `change_needed: boolean`, `reviewed_by_muxin: boolean`, `reviewed_at: string \| null`. ~~`question` (free text, fixed to "What are you stuck on right now?" unless overridden with a recorded reason), `destination` (`confirmation_page` \| `welcome_email` \| `both`), `respondent_field_ref`~~ |
| `lead-magnet` | `title`, `intro`, `sections: string[]` (count fits the promise, not forced to three), `action_step`, `feedback_prompt` |
| `product-outline` | `transformation_sentence`, `sections: string[]` (five to seven, §7.8), `format` |
| `price-decision` | `recommended_price`, `considered_range`, `reasoning`, `known_uncertainty`, `pitch_paragraph`, `scenario_math` (optional; must carry `illustrative: true` when present, §7.9's illustrative-only rule) |
| `daily-operating-plan` | `time_budget_minutes`, `chosen_mode` (`canonical` \| `rotated` \| `extended_timeline` \| `revised_scope`), `schedule: object` |
| `phase_1_research_plan` | see §2C — a pre-post plan, drafted before any idea is written, distinct from the post-hoc read below |
| `phase_1_research_read` | see §2C — expanded 2026-08-07, corrective pass |
| `day-14-review` | see §5.1's scorecard read model below |

Two structured kinds — `phase_1_research_plan` and `phase_1_research_read` — get their own subsection
(§2C) rather than a single table cell, because the 2026-08-07 review found the original one-line
`fields` shape too free-form: it let one implementation store a thoughtful record and another put a
paragraph in `evidence` and technically satisfy the same schema. §2C fixes that.

## 2C. Phase 1 research artifacts — plan, evidence, and read

**Added 2026-08-07, corrective pass.** `venture/rules.md` §5.1A/§5.6 already state Phase 1's research
discipline in prose (assemble knowns/unknowns before drafting; ingest every signal channel; no single
number decides a "winner"; label thin evidence honestly). This section is what makes that discipline
implementable and checkable rather than a paragraph a script could satisfy by writing anything at all.

Three distinct records, not one:

1. **`phase_1_research_plan`** — written *before* any Phase 1 idea is drafted. What's already known,
   what isn't, and what each candidate post is meant to test.
2. **The evidence record of what actually came back** — the account-level `research_observations`
   store (§5.4a) plus this venture's `evidence-links.jsonl` (§5.4b). Parallel in spirit to
   `responses.jsonl` (§5.4), but account-scoped, covering Phase 1's signal channels, and never mixed
   into the Phase 3 response gate.
3. **`phase_1_research_read`** — written *after* observations come in, before Phase 2 begins. The
   synthesis: what the observations mean, how confident that reading is, and what's still open.

### 2C.1 `phase_1_research_plan` fields

```json
{ "plan_version": 1,
  "supersedes_plan_version": null,
  "created_at": "…",
  "confirmed_knowns": [
    { "claim": "…", "evidence_refs": ["intake:q3", "external:some-cited-source"],
      "confirmed_by_muxin": true } ],
  "open_unknowns": [
    { "unknown_id": "u1", "dimension": "emotional_frame" | "desired_help" | "audience_segment" | "other",
      "description": "…", "priority": 1 } ],
  "probes": [
    { "probe_id": "p1-idea-03", "unknown_id": "u1",
      "hypothesis": "…", "conversation_question": "…", "expected_evidence": "…" } ],
  "reviewed_by_muxin": false, "reviewed_at": null }
```

**`plan_version` is required on every plan, starting at 1.** It is what evidence links record in
their `research_plan_version` (§5.4b), and the whole relinking rule depends on it — a plan without a
version makes "which plan were these `unknown_ids` assigned under" unanswerable. A revision writes a
new plan with `plan_version` incremented and `supersedes_plan_version` set to the one it replaces;
the prior version is retained, never edited in place. `supersedes_plan_version` is `null` only on
version 1.

**Corrected 2026-08-07 (round-2 corrective pass).** An earlier draft of this example filled the
placeholders with real civic-tech content ("money in politics is already a felt problem," a
"the kind of citizen I'm trying to be" framing hypothesis). That is exactly the leak §F and
`venture/rules.md` §1.8/§11 exist to prevent — a *normative* schema section is not the fixture, and
concrete civic-tech text has no business sitting in a JSON example a new venture's implementation
might copy or pattern-match against. The example above uses `"…"` placeholders throughout, same as
every other JSON example in this document. For a realistic, fully filled-in illustration of this
shape, see `venture/examples/civic-tech-worked-example.md` (§F) — never this section.

- `confirmed_knowns` MUST cite `evidence_refs` and MUST carry `confirmed_by_muxin: true` before a
  known claim can be used to justify *not* testing something — an AI-asserted "this is already known"
  with no evidence reference or without Muxin's confirmation does not excuse a probe.
- `open_unknowns[].dimension` is not free text by default — it's drawn from the three the review
  named (emotional frame, desired help/job, behavior-based audience segment), plus `other` for a
  venture-specific unknown that doesn't fit those three. `priority` orders them.
- `probes` is where each Phase 1 idea's "specific unknown it tests" (`venture/rules.md` §5.2) becomes
  structured: which `unknown_id` it targets, the actual hypothesis being tested, the exact
  conversation question (the reply prompt), and what evidence would count as informative either way.
  A probe not linked to an `unknown_id` is a signal the idea doesn't test anything specific — see
  §2C.4 on distinct-unknown coverage.
- **`reviewed_by_muxin` gates drafting.** The plan is not just written — Muxin reviews it before
  probes get drafted into posts. See §5.1's read model and §5.5's mutations for the review action.

### 2C.2 The observation store and evidence links — see §5.4a / §5.4b

Full field definitions live in §5.4a (the account-level `research_observations` store) and §5.4b
(per-venture `evidence-links.jsonl` and `evidence_role` derivation), alongside the privacy treatment,
to keep them next to the equivalent Phase 3 model in §5.4 rather than duplicating the privacy
discussion here.

### 2C.3 `phase_1_research_read` fields

```json
{ "as_of": "…", "collection_window_days": 3,
  "collection_coverage": [
    { "source": "note_reply" | "essay_comment" | "metric" | "subscriber_movement"
              | "dm" | "email" | "follow_up_question" | "creator_observation",
      "window_start": "…", "window_end": "…",
      "status": "complete" | "partial" | "unavailable" | "not_checked",
      "records_captured": 12,
      "gap_reason": null | "…" } ],
  "findings": [
    { "finding_id": "f-001",
      "finding_origin": "planned" | "emergent",
      "unknown_ids": ["u1"],
      "emergent_description": null,
      "muxin_confirmed_emergent": null,
      "topic": "…",
      "emotional_frame": "…", "desired_help_or_job": "…", "behavior_audience_segment": "…",
      "evidence_refs": ["obs:o-001", "obs:o-004", "signal:s-2026-08-10"],
      "recurrence": 3, "specificity": "high" | "medium" | "low",
      "audience_fit": "confirmed" | "uncertain" | "off-target",
      "signal_quality": "thin" | "moderate" | "strong",
      "signal_quality_rationale": { /* §2C.4's rubric shape, one entry per named factor */ },
      "confidence": "…",
      "next_probes": ["…"] } ],
  "topic_heat": [ { "topic": "…", "observation_count": 12, "distinct_respondents": 9,
                     "exposure_denominator": 4200, "trend": "rising" | "flat" | "falling" | "unknown",
                     "evidence_refs": ["obs:o-001", "obs:o-004"] } ],
  "lead_magnet_implications": "…",
  "overall_signal_quality": "thin" | "moderate" | "strong",
  "reviewed_by_muxin": false, "reviewed_at": null }
```

**Round-5: `collection_coverage` replaces the single `collection_completeness` flag, per source.** A
read that says only `"ongoing"` or `"closed"` hides the thing most likely to mislead: **which channels
were actually examined.** v1 ingestion is Notes-only, essay comments are a follow-up, and DMs, emails,
and creator observations may arrive by manual entry or not at all — so a Notes-only read could
truthfully report `"closed"` while a reader reasonably assumed every listed channel in
`venture/rules.md` §5.6 had been checked. That is a false read of the evidence base, and it is exactly
the failure mode the no-single-number rule exists to prevent, one level up.

Every source named in `venture/rules.md` §5.6 MUST appear in `collection_coverage` with an explicit
status. The four statuses are distinct and none of them may be inferred:

- **`complete`** — the channel was checked across the stated window and everything available was
  captured.
- **`partial`** — checked, but the capture is known to be incomplete (a truncated fetch, a rate limit,
  a thread that failed reconciliation). `gap_reason` is required.
- **`unavailable`** — the channel could not be checked at all: no endpoint, no access, a platform
  outage. `gap_reason` is required. This is the honest status for essay comments in v1.
- **`not_checked`** — nobody looked. `gap_reason` is required and may simply say so. **This is not a
  failure state and must not be hidden** — a read that omits a channel silently is worse than one that
  says plainly that DMs were never reviewed.

`records_captured` is the count actually landing in the store for that source and window; `0` with
`status: "complete"` is a real and useful reading (nobody replied), distinct from `0` with
`status: "not_checked"` (nobody looked). **`overall_signal_quality` MUST NOT read `"strong"` when any
source carrying a finding's evidence is `partial`, `unavailable`, or `not_checked` without that being
named in the finding's `signal_quality_rationale`** — the exposure-context factor (§2C.4) is about
denominators, and an unexamined channel is a missing denominator.

**Added round-3: `topic_heat` is an aggregate on the read, and that is deliberate.** Topic heat only
exists across observations — it is a count of distinct respondents raising a topic against the
exposure those posts actually got (§2C.4's exposure-context factor, and why
`exposure_denominator` is required rather than a bare count). It is computed here, from linked
observations, and never written onto an individual observation row. The same goes for `recurrence`,
`signal_quality`, and `lead_magnet_implications`, which already live here.

**The dividing line, stated once:** a single reply carries `topic_labels`, `emotional_frame`,
`desired_help`, `behavior_audience_role`, and `stuck_point` (§5.4a) — properties of that text. A
research read carries topic heat, recurrence, signal quality, and lead-magnet implications —
conclusions that only exist across replies. An ingestion pipeline that tags one reply with a
"lead-magnet implication" has made a category error; a single reply cannot tell you what a lead magnet
should be. `trend` is `"unknown"` until there are at least two reads to compare, never inferred from
one snapshot.

**Revised 2026-08-07 (round-2 corrective pass): findings are no longer locked to the plan's
pre-named unknowns.** The first version of this shape required every `findings[]` entry to trace to
an `unknown_id` the plan had already named as open. That's backwards for a discovery instrument —
Phase 1's entire premise is testing what's still unknown, and a rule that only lets the read report
what the plan already anticipated makes it structurally impossible for a probe to surface something
nobody expected. Two changes fix this:

- **`unknown_ids` is an array, not a single `unknown_id`.** A single reply can speak to more than one
  unknown at once (a reply naming both an emotional frame and a desired next step, for example) —
  forcing one finding per unknown either drops half the signal or forces an artificial split.
- **`finding_origin` distinguishes `planned` from `emergent`.** A `planned` finding's `unknown_ids`
  MUST be non-empty and MUST reference unknowns the plan (§2C.1) already named. An `emergent` finding
  is the opposite case: something the observations surfaced that the plan didn't anticipate.
  `unknown_ids` MAY be empty for an emergent finding (nothing existing fits yet); when that's the
  case, `emergent_description` MUST hold what was actually discovered, in enough detail that it can
  become a new `open_unknowns` entry in a later plan revision. **`muxin_confirmed_emergent` MUST be
  set (`true` or `false`, not left `null`) before an emergent finding is allowed to inform Phase 2** —
  the read's own `reviewed_by_muxin` flag reviews the read as a whole, but an emergent finding
  specifically needs Muxin's yes-or-no on whether it's real signal or noise before it carries forward,
  since by definition nothing in the plan already vetted it. A `false` here means the finding is kept
  in the record (nothing here is deleted) but excluded from `lead_magnet_implications` and from any
  concept's `decisions.jsonl` `rationale`.

### 2C.4 Signal-quality rubric — a repeatable read, not one opaque score

**The gap.** `venture/rules.md` §5.6 correctly says a sharp, specific reply can outweigh many vague
ones, but didn't say *what makes a reply sharp* — so "strong" could mean something different every
time a venture runs. This rubric is what `signal_quality` in §2C.3 is actually scored against. It is
a rubric to read by, not a formula that outputs one number:

| Factor | Question |
|---|---|
| `audience_fit` | Does this respondent plausibly belong to the target audience? |
| `specificity` | Does the reply name a concrete situation, example, or consequence, or is it a general reaction? |
| `explicit_stuck_point` | Does the reply state what the person is actually stuck on? |
| `requested_help` | Does the reply ask for or imply wanting a next step? |
| `follow_up_question` | Did the respondent ask a follow-up question, a stronger signal than a single reply? |
| `recurrence` | Does this same read show up across more than one respondent? |
| `behavioral_action` | Did the respondent do something (subscribe, click, DM) beyond commenting? |
| `exposure_context` | How many people saw the post this reply came from, and how long has it been live (§5.6's `views`/`post_age_hours` — five replies on 20,000 views reads differently than five replies on 100 views)? |

**Revised 2026-08-07 (round-2 corrective pass): `signal_quality_rationale` is now an implementable
shape, not a comment placeholder.** The first version left this field as `{ /* rubric fields, scored
*/ }` — a note to a future implementer, not something two builds could produce identically. It is now
one entry per factor above, each independently scored:

```json
"signal_quality_rationale": {
  "audience_fit":         { "status": "present" | "absent" | "unknown", "evidence_refs": ["obs:o-001"], "note": null },
  "specificity":           { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "explicit_stuck_point":  { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "requested_help":        { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "follow_up_question":    { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "recurrence":            { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "behavioral_action":     { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null },
  "exposure_context":      { "status": "present" | "absent" | "unknown", "evidence_refs": [], "note": null }
}
```

- Every factor MUST be scored — there is no fifth "not scored" state. Genuinely unassessable (no way
  to tell either way from the available evidence) is `"unknown"`, distinct from `"absent"` (assessed
  and not met). This is the same "unknown data is `null`/`unknown`, never a false zero" discipline
  §5.6 already requires for `signal-snapshot`.
- `evidence_refs` may be empty only when `status` is `"unknown"` — a `"present"` or `"absent"` call
  MUST point at the `research_observations` rows (or the absence checked against) that back it.
- `note` is optional free text for anything the status alone doesn't capture; most factors will leave
  it `null`.

**Recommended default threshold — PROPOSED, needs Muxin's confirmation before Work package 2 encodes
it as a hard rule (same status as the Checkpoint 2 predicate and the survey path elsewhere in this
document):** `signal_quality: "strong"` requires `audience_fit: "present"` AND at least three other
factors `"present"`. `"moderate"` requires `audience_fit: "present"` (or `"unknown"`) and one to two
other factors `"present"`. `"thin"` is everything else. This is a concrete, checkable rule instead of
"requires multiple factors to be true" — which is exactly the ambiguity two different builds could
resolve two different ways, the problem this whole rubric exists to close. Until Muxin confirms or
adjusts the threshold, an implementation MUST surface the per-factor `signal_quality_rationale` next
to the label rather than trusting the label alone — the rationale is the source of truth; the label is
a derived convenience.

The read's `signal_quality_rationale` MUST show which factors were met, not just the resulting
label — this is what makes "strong" mean the same thing across different venture runs, and what a
"show your reasoning" control (§2A) reads from.

### 2C.5 Distinct-unknown coverage

**The gap.** The four-factor idea ranking (`venture/rules.md` §5.2 — personal stake, specificity,
identity signal, easy reply) optimizes for reply likelihood. Nothing stopped the top three ranked
ideas from all probing the same unknown, which would produce three good posts and a narrow research
read.

**Rule:** when selecting the three ideas to draft, the ten-idea decision record (§2A) MUST show, for
the three selected, which `unknown_id` (§2C.1) each one probes. If two or more of the three selected
ideas target the same `unknown_id`, the decision record's `rationale` MUST state why deliberate
repetition is more valuable here than covering a second priority unknown — this is a recorded
exception, not a silent default. The system MUST NOT auto-select for coverage over Muxin's actual
choice; it surfaces the overlap for her to see before she finalizes the three.

**Rule: a structured artifact is never approve-or-discard-only.** Every field above must be
individually editable while the artifact is `draft`, and the review screen must offer per-field edits,
not a single "edit the whole block" escape hatch. This directly closes the audit's P0 finding
("central decisions cannot be edited").

---

## 3. Artifact kinds

`delivery_mode`, `publishable` and the minimum acceptable evidence are properties of the kind, so a
script sets them without judgment.

| `artifact_kind` | `delivery_mode` | `publishable` | Delivery path | Min. evidence | Phase |
|---|---|---|---|---|---|
| `substack-post` | `manual` | false | `ready-to-paste/` → Muxin pastes into Substack | `url` | 1 |
| `text-post-note` | `app` | true | Substack Notes browser agent | `agent` | 1 |
| `text-post-announcement` | `manual` or `app` | per its channel | same as the post kind it ships as | as that kind | 2 |
| `phase_1_research_read` | `none` | false | internal artifact — required before Phase 2 concept generation (`venture/rules.md` §5.6) | — | 1 |
| `lead-magnet` | `manual` | false | published/hosted wherever it is downloadable | `url` | 2 |
| `landing-page-copy` | `manual` | false | installed on humaninference.ai | `url` | 2 |
| `welcome-email` | `manual` | false | installed in the email tool | `attestation` | 2 |
| `survey` | `manual` | false | **superseded 2026-08-19** — reviews Muxin's existing live survey (`venture/existing-survey-humaninference.md`) for fit against the chosen lead magnet; Phase 2 does not author or install a new survey (`venture/rules.md` §6.5's 2026-08-19 amendment). ~~confirmation page (primary), linked from the welcome email (secondary)~~ | `url` | 2 |
| `product-outline` | `none` | false | internal artifact | — | 3 |
| `price-decision` | `none` | false | internal artifact | — | 3 |
| `thank-you-note` | `manual` | false | sent by hand | `attestation` | 4 |

**Renamed from `text-post-longform` (2026-08-07).** A Starter Kit sprint post is capped under 150
words (`venture/rules.md` §5.3) — calling that "long-form" was actively misleading, flagged by the
2026-08-07 audit. `substack-post` names what it actually is: a native Substack post, as opposed to a
Note. Any earlier reference to `text-post-longform` in this repo's docs means this kind.

**`substack-post` is `manual`, not `app`.** The app writes a `ready-to-paste/` file; a human
puts it on Substack. Calling that "publishable" would let a publisher think it owns the delivery.

`lead-magnet` and `text-post-announcement` come from the plan's Phase 2 line ("draft the magnet +
landing page copy + welcome email (linking to the confirmation-page survey, the primary collection
path) + announcement post" — updated 2026-08-07 corrective pass; originally read "welcome email with
embedded survey") and were missing from the first draft of this contract. `text-post-announcement`
deliberately inherits its mode from the channel it ships on, which is unresolved until open question
#4 settles Phase 1's format split.

Note the asymmetry a design must show honestly. Of the ten kinds, exactly **one** (`text-post-note`)
is delivered by the app; `text-post-announcement` may be a second depending on its channel. The
other **eight are never app-delivered** — six `manual`, two `none` — and **five of those must still
be live before a checkpoint clears** (`substack-post` essay, lead magnet, landing page, welcome email,
survey). Screens that treat "approved" as "done" are wrong for almost all of this build, and a
design centred on a publish button would be designing for the rarest case.

---

## 4. Evidence

`evidence` is null until delivery is confirmed. Three shapes:

```
{ type: "url",         value: "https://…",              confirmed_at, confirmed_by: "muxin" }
{ type: "agent",       value: "<provider post id>",      provider: "substack-notes",
                                                         confirmed_at, confirmed_by: "agent" }
{ type: "attestation", value: "<what Muxin states>",     confirmed_at, confirmed_by: "muxin" }
```

Each kind declares a **minimum** in §3: where a `url` is required, an attestation alone is not
enough, because a URL is checkable later and a sentence is not. `attestation` is reserved for things
with no addressable trace at all — an email sequence being active, a note sent by hand.

Both `url` and `attestation` are ultimately Muxin's word. The difference is that a URL can be
re-checked, and the design should treat them differently: a URL renders as a link, an attestation
renders as "you confirmed this on Aug 12" — never a green check implying the system verified
anything. Never synthesize an attestation on her behalf.

### 4.1 Failure

```
{ reason: "<provider message>", provider: "typefully" | "substack-notes" | null,
  failed_at, retryable: true | false }
```

Without this a failure screen can only print the word "failed" and the provider's actual message is
lost. `retryable` decides whether the Retry action in §2.2 is offered at all. For a `manual`
artifact `provider` is `null` and `reason` is what Muxin reported.

### 4.2 Retraction

```
{ attestation: "<what she states — taken down, unpublished, link dead>", retracted_at,
  retracted_by: "muxin" }
```

Written alongside, never over, the original `evidence`. An artifact carrying both was genuinely live
and is now not, and both facts matter: the first is why a checkpoint cleared, the second is why the
thing is no longer out there.

---

## 5. The checkpoint read model

The row contract alone cannot draw a phase screen: the screens also render *where the venture is*.

### 5.1 Read

```
GET /api/venture/<slug>  ->
{
  slug, name,
  current_phase: 1..4,
  phase_status: "drafting" | "awaiting_you" | "checkpoint_ready" | "blocked" | "complete",
  days: { planned_phase_day, elapsed_calendar_day, active_work_day, blocked_waiting_days },
  checkpoints: [
    { id: "checkpoint-1" | "checkpoint-2" | "phase_3_completed",
      state: "locked" | "open" | "cleared",
      manifest: [ { artifact_id, artifact_kind, title, body_path, fields, editable,
                    delivery_mode, publishable,
                    editorial_status, delivery_status,
                    evidence, retraction, failure,
                    required: true | false } ],
      complete: 3, required: 5,
      blocking: [ { artifact_id, reason: "approved but not live" } ] } ],
  response_gate: { state: "closed" | "opened", have: 12, need: 20, target: 30,
                   opened_at: null },
  phase_1_research: { plan_status: "not_started" | "drafted" | "reviewed_by_muxin",
                       read_status: "not_started" | "drafted" | "reviewed_by_muxin",
                       continuation_decision: "pending" | "more_probes" | "proceed_with_evidence"
                                             | "proceed_as_hypothesis" },
  gated_actions: [ { action: "draft-phase-1-ideas" | "generate-lead-magnet-concepts" | "identify-problem"
                            | "outline-product" | "set-price",
                     state: "available" | "gated",
                     reason: "12 of 20 eligible responses" | "phase_1_research_plan not yet reviewed"
                           | "phase-1-research-continuation decision not yet made",
                     progress: { have: 12, need: 20 } } ],
  day_14_review: null | { scorecard: { /* §5.6 shape */ }, decision: "continue" | "revise_positioning"
                          | "revise_lead_magnet" | "collect_more_evidence" | "stop", decided_at }
}
```

`title`, `body_path`, `fields`, and `editable` are in the manifest because the review card has to
render and edit the artifact; the first draft of this contract omitted `title`/`body_path`/`editable`
and left the designer nothing to draw a card from. `fields` is present (non-null) only for the
structured artifact kinds in §2B; other kinds carry `fields: null` and render from `body_path` alone.

**`response_gate` is a top-level object, not one of the three checkpoints.** This is the concrete fix
for the audit's P0 finding that the response threshold and Phase 3 completion were both being called
"Checkpoint 3." See §5.3.

**`phase_1_research` is a top-level object, added 2026-08-07, fixing the review's finding that the
research gate checked existence, not human review.** `read_status` reaching `"drafted"` is not enough
to unlock `generate-lead-magnet-concepts` — it also needs `plan_status: "reviewed_by_muxin"` (Muxin
confirmed the knowns/unknowns before probes were drafted — §2C.1), `read_status:
"reviewed_by_muxin"` (she reviewed the findings, not just that a read exists — §2C.3), and
`continuation_decision` set to `"proceed_with_evidence"` or `"proceed_as_hypothesis"` (§2A's
`phase-1-research-continuation` decision). A `continuation_decision` of `"more_probes"` sends the
venture back into Phase 1 idea generation (`draft-phase-1-ideas` becomes `available` again) rather
than advancing — this is the literal mechanism behind "money in politics is already established, stop
testing that, test what help people want": Muxin reads the plan, confirms that known, and the probes
that get drafted target the remaining unknowns instead.

### 5.2 Derivation rules — none of these may be guessed

- **An artifact is complete** when `editorial_status === "approved"` **and** `delivery_status` is
  `live_confirmed` (modes `app`/`manual`) or `not_applicable` (mode `none`).
- **`required` / `complete`** count only manifest entries with `required: true`. A discarded required
  artifact keeps counting against `required` and blocks the checkpoint until it is replaced or the
  manifest is amended — a checkpoint must never clear by deletion.
- **`blocking`** lists every required-and-incomplete entry with the reason drawn from its state, in
  Muxin's terms. This is the most useful thing a phase screen shows.
- **`phase_status`** — evaluated in this order, first match wins, so it is total over every reachable
  combination:
  - `complete` — the venture finished Phase 4 and its Day 14 review.
  - `awaiting_you` — ≥1 required artifact is `draft`, or is waiting on her attestation or paste
    (`handed_off` in `manual` mode), or is `failed` and so needs her Retry-or-give-up call.
  - `checkpoint_ready` — every required artifact is complete and the checkpoint has not cleared.
  - `drafting` — a venture job is running or queued for this phase.
  - `blocked` — none of the above and nothing can advance without something outside the app.
    Phase 2 with no signup form on humaninference.ai is the live example. **A gated action alone
    never makes a phase `blocked`.**
- **`gated_actions` is separate from `phase_status` on purpose.** Below 20 eligible responses, three
  Phase 3 actions are gated while posting continues. Folding that into a phase-level `blocked` would
  produce exactly the "Phase 3 is blocked" screen the plan forbids.

### 5.3 Checkpoints, the response gate, and the ledger

**Revised 2026-08-07.** The earlier version of this contract called the response threshold
"Checkpoint 3" and had it "unlock the next phase" — the same conflation the build plan's own
Checkpoint 3 row had, and the exact thing the audit's P0 finding flagged: two incompatible meanings
for one name, with the prototype still separately requiring outline/price approval before Phase 4
despite the doc language suggesting the count alone unlocked it. This contract now uses two distinct
concepts, matching `venture/rules.md` §7.3/§7.10:

- **`response_gate_opened`** — not a checkpoint. Fires once at ≥20 eligible unique respondents
  (`response_gate` in §5.1's read model tracks progress toward it). It unlocks the `identify-problem`,
  `outline-product`, and `set-price` **gated actions** only. It does not touch phase status and does
  not unlock Phase 4. Posting continues before and after it fires, unaffected either way.
- **`checkpoint-3`, recorded as the `phase_3_completed` event** — a real checkpoint. Clears only when
  the problem, transformation, outline, price, and pitch decision records (§2A) are all
  `selected_candidate_id` set and their artifacts editorially approved. This is what unlocks Phase 4.

Checkpoints are `checkpoint-1`, `checkpoint-2`, and `checkpoint-3` (recorded as `phase_3_completed`)
only. **There is no `checkpoint-4`** — the plan defines three, and Phase 4 ends in the Day 14 review,
which is an output plus a recorded human decision (§5.6), not a gate. A finished venture is
`phase_status: "complete"`, not a fourth cleared checkpoint. *(Whether Phase 4 should gain a
checkpoint is a real question, but it is the plan's to answer, not this document's.)*

Checkpoint state derives from the event ledger in `canon.md`, keyed by deterministic event id
(`<slug>/checkpoint-2`, `<slug>/response-gate-opened`, `<slug>/phase-3-completed`). `state.md` is a
**cache**, never the authority. That resolves the crash-safety question the first draft waved at:

- The clearing script writes the `canon.md` event first, then updates `state.md`.
- A crash between the two leaves the event recorded and the cache stale. On any read, checkpoint
  `state` is derived from `canon.md`; a `state.md` that disagrees is **rebuilt from the ledger**,
  never trusted and never repaired by re-running the transition.
- Because `state` is ledger-derived, a checkpoint whose event exists already reads as `cleared`.
  The `clear` mutation's guard (§5.5) therefore rejects it — not as an error, but as a no-op that
  also rewrites the cache. This is the whole of the idempotency story: **the guard is what makes the
  rerun safe**, and the cache rebuild is what makes it healing. There is no separate repair path,
  and no state in which a rerun could double-apply.

The GUI reads this state. It never writes it.

### 5.4 Responses

**Record shape.** Extended (2026-08-07) to the fields `venture/rules.md` §7.2 requires — the earlier
version of this contract named the file and its privacy treatment but never specified its fields,
which is how the prototype ended up claiming deduplication and eligibility checks it had no data to
support (audit P0 finding). Each line of `responses.jsonl`:

```json
{
  "response_id": "r-001",
  "source": "survey" | "email" | "comment" | "dm" | "other",
  "received_at": "…",
  "respondent_hash": "…",
  "target_audience_eligible": true,
  "exact_quote": "…",
  "redacted_quote": "…",
  "stuck_point": "…",
  "desired_outcome": "…",
  "emotional_intensity": "low" | "medium" | "high",
  "cluster_id": null,
  "included_in_gate": true,
  "exclusion_reason": null
}
```

**Ingestion.** The current contract's earlier stance — "responses never reach the GUI" — conflicted
with the prototype's paste box, which is a real requirement (Muxin has to get response text in
somehow). Resolved: **a protected local mutation may accept raw response text** (pasted or
programmatically ingested), writes it to `responses.jsonl` with the fields above, and returns only a
confirmation (count added, any rows flagged as likely duplicates) — never the raw text back to the
caller. This is a write-only-facing, read-restricted mutation, not a general query endpoint.

**Reads stay restricted.** `responses.jsonl` never reaches the GUI as a list. It holds raw quotes and
identifying detail and stays out of git. Normal venture reads expose only: the aggregate eligible-
unique count, and — once cluster analysis exists (after `response_gate_opened`, §5.3) — a **redacted
analysis output**: per-cluster count, redacted representative quotes (`redacted_quote`, never
`exact_quote`), common stuck point, desired outcome, and visible consequences. There is no screen
that lists individual responses by default.

**Correction path.** A separate, explicitly-protected view may let Muxin open individual response
records to correct a bad cluster assignment, a wrong eligibility call, or an extraction error
(`stuck_point`/`desired_outcome` mis-derived from the exact quote). This view is not the normal
venture read path and must be entered deliberately, not surfaced inline on the phase screen.

**The count is eligible unique respondents**, deduped by `respondent_hash` and filtered on
`target_audience_eligible` — never a row count and never a tally of messages pasted in. A response
with `included_in_gate: false` carries a non-null `exclusion_reason` (duplicate, ineligible, or
unverifiable) and does not count toward the ≥20 / target-30 gate.

### 5.4a The account-level research-observation store

**Added 2026-08-07, corrective pass; re-homed in the round-3 pass.** §5.4's `responses.jsonl` is
Phase 3's model, gated to the 20/30-respondent problem-selection loop. `venture/rules.md` §5.6
requires ingesting a wider set of Phase 1 signals — comments, replies, DMs, emails, follow-up
questions, subscriber movement, and the creator's own observations — and none of that had anywhere
safe to live. Putting raw DM or email text into a general-purpose artifact's `body_path` would be a
privacy leak; this section is the fix.

**Round-3 change: observations are account-level, not venture-owned.** The first two passes put these
records in `venture/<slug>/phase1-observations.jsonl`, inside one venture's folder. That was wrong,
and a strict re-audit caught it: the evidence this store holds is account-wide Substack history that
has to serve *multiple future ventures*, the Signals room, and content strategy that has nothing to do
with any venture. A Note reply from March is a fact about Muxin's audience, not the property of
whichever venture happened to be scaffolded first. Filing it inside one venture forced either
duplication across ventures or a private-file read from Signals, and it made `unknown_ids`
unassignable until some particular venture had a reviewed research plan — a circular dependency.

**Three layers, and the principle behind each split:**

| Layer | Where | Holds |
|---|---|---|
| **Canonical observation** | `research_observations`, a private table in the existing gitignored `data/analytics.db` | The raw source record, and **only** that: source, surface, thread ids, published/observed/captured times, text, respondent hash, privacy class, edit and tombstone state, metric payload. **No classification.** |
| **Classification** | `research_observation_classifications`, same database | The interpretation of that text under one taxonomy at one version — topic labels, emotional frame, desired help, behavior audience role, stuck point, each with confidence, evidence span, and abstention. **Many rows per observation**, one per taxonomy and version — see §5.4c |
| **Per-venture evidence link** | `venture/<slug>/evidence-links.jsonl` | Everything that is a *judgment relative to one venture*: `evidence_role`, `unknown_ids`, `target_audience_fit`, `research_plan_version`, inclusion/exclusion, and **which `classification_id` this venture reads** — see §5.4b |

**Two principles, and the second is easy to lose.**

*First:* venture-neutral facts live below the link, venture-relative judgments live on it. Whether a
respondent is *the target audience* depends entirely on which venture is asking — the same reply is
`confirmed` for one venture's audience and `off-target` for another's. Same for `evidence_role` and
`unknown_ids`. Storing those on the observation was the original duplication bug.

*Second:* **being venture-neutral is not enough to belong on the observation row.** A reply's
emotional frame is a fact about the text rather than about any venture — but it is a fact *as read
through one taxonomy*, and two ventures may legitimately read the same reply through different label
sets. An earlier version of this table put "venture-neutral classification" on the observation, which
silently capped each observation at one taxonomy and forced re-classification to write a second
observation — duplicating the reply and inflating every count that works by counting observations.
The observation row holds what the platform gave us; interpretation is a separate layer that can exist
many times over the same row without ever copying it.

**`data/analytics.db` is the right home, and this does not pre-empt open question #2.** That question
is about *venture state* — `canon.md`, `artifacts.jsonl`, `decisions.jsonl` — and stays open. This is
different: `data/analytics.db` already exists, is already gitignored (root `CLAUDE.md`: "Never commit
`.env` or `data/analytics.db`"), and is already the account-level store `/strategy` reads from.
Putting account-level research evidence anywhere else would create the second silo the re-audit warned
about.

**Corrected round-4: what Signals reads today.** An earlier draft of this paragraph said Signals
already reads `data/analytics.db`. It does not. `src/review/signals.ts`'s `readSignals()` parses the
most recent generated Markdown strategy brief in `briefs/<date>-strategy-brief.md` — the data-confidence
table and the `[DO MORE]` / `[TEST]` / `[DO LESS]` recommendations — and nothing else. `/strategy` is
what reads `analytics.db`, and the brief is its output. So the accurate current state is: `/strategy`
reads the database, Signals reads `/strategy`'s briefs, and **adding a redacted research-observation
read path to Signals is new work — Card D in the backlog proposal**, not something that already exists.
The database is still the right destination; the claim about today was wrong.

**Record shape.** One row of `research_observations` (shown as JSON; the SQL column mapping is
Work-package-2 detail, but every field below is required to survive the mapping):

```json
{
  "observation_id": "o-001",
  "source": "metric" | "comment" | "reply" | "dm" | "email" | "follow_up_question"
          | "subscriber_movement" | "creator_observation",
  "source_platform": "substack" | "…",
  "surface": "note" | "essay" | "email" | "dm" | "other" | null,
  "content_item_id": "…" | null,
  "note_id": "…" | null,
  "reply_id": "…" | null,
  "parent_reply_id": "…" | null,
  "published_at": "…" | null,
  "observed_at": "…",
  "captured_at": "…",
  "respondent_hash": "…" | null,
  "exact_text": "…" | null,
  "redacted_text": "…" | null,
  "follow_up_question": "…" | null,
  "behavioral_action": "reply" | "click" | "save" | "dm" | "subscribed" | "unsubscribed" | null,
  "is_creator_observation": false,
  "privacy_class": "private_identifying" | "private_non_identifying" | "public_metric",
  "post_age_hours": 18 | null,
  "views_at_observation": 340 | null,
  "edited_at": "…" | null,
  "deleted_at": "…" | null,
  "superseded_by": "o-014" | null,
  "metric": null | {
    "metric_name": "views" | "likes" | "restacks" | "comments_count" | "replies_count"
                 | "subscribers_total" | "subscribers_delta" | "clicks" | "saves" | "…",
    "metric_value": 0,
    "previous_value": 0 | null,
    "delta": 0 | null,
    "window_start": "…" | null,
    "window_end": "…" | null,
    "collected_at": "…"
  }
}
```

**Round-4 change: there is no `classification` object on this row.** Classifications live in a separate
`research_observation_classifications` table, many-to-one against this one — see §5.4c. Round-3 embedded
a single classification object here, which quietly capped each observation at one taxonomy and forced
re-classification to write a *new observation*. That duplicated the reply, inflated recurrence and
topic-heat counts that are computed by counting observations, and let one venture's taxonomy leak into
another's evidence. §5.4c is the fix.

- **`respondent_hash` is null when there is none to have** — a Substack metric or a creator's own
  observation has no respondent. It is required (non-null) whenever `source` is `comment`, `reply`,
  `dm`, `email`, or `follow_up_question` and the respondent is identifiable at all.

**How `respondent_hash` is computed — a keyed HMAC, not a plain digest (round-4).** This rule governs
every `respondent_hash` in this contract: §5.4's responses, §5.4a's observations, and §5.7's funnel
events. A plain hash of a public Substack handle is trivially reversible — the handle space is small,
public, and enumerable, so `sha256(handle)` is a lookup table away from being the handle itself, and
calling it a hash would misrepresent the protection it gives.

> `respondent_hash = HMAC-SHA256(key = RESEARCH_HASH_KEY, message = "<platform>:<stable_platform_user_id>")`

- **The key is a local secret** in `.env` (`RESEARCH_HASH_KEY`), never committed, never logged, never
  passed to a model, and never included in an export. Root `CLAUDE.md` already forbids committing
  `.env`; this adds one variable to it.
- **The message is canonical**: a lowercase platform identifier, a colon, and the platform's *stable
  numeric or opaque user id* — not the display name and not the handle, both of which a person can
  change. If only a handle is available, that is recorded as a capture limitation on the observation
  rather than silently substituted, because a handle-keyed hash breaks identity continuity the moment
  someone renames themselves.
- **Neither the raw identifier nor the key is ever written to a log, an error record, or
  `classification-errors` output.** A debugging path that prints the pre-hash message defeats the
  entire mechanism.
- **Rotating the key re-pseudonymizes everyone.** Deduplication and recurrence counts work by matching
  hashes, so a rotation breaks continuity with all existing rows. It is therefore a deliberate,
  recorded operation with a re-hash migration, not routine hygiene.
- This is pseudonymization, not anonymization, and should be described that way. A distinctive reply
  still identifies its author to anyone who reads it. The hash keeps identity out of the store and out
  of anything derived from it; it does not make the text anonymous.
- **`exact_text` / `redacted_text` follow the same discipline as §5.4's `exact_quote` /
  `redacted_quote`.** Normal reads see `redacted_text` only; `exact_text` is available solely through
  the correction/inspection view below.
- **`is_creator_observation: true`** marks a row that is Muxin's own qualitative read (something
  noticed, not measured) rather than a platform-sourced fact. A `phase_1_research_read` finding citing
  this kind of observation must be able to say so — a creator hunch and a measured reply are not the
  same class of evidence, and §2C.3's `evidence_refs` resolve to a record that carries this flag.
- **`privacy_class`** exists because not everything here is equally sensitive: a view count is a
  `public_metric`, a redacted comment excerpt is `private_non_identifying`, and a DM or email with a
  name attached is `private_identifying`. A read or export path may treat these differently (e.g.
  never quote `private_identifying` text verbatim in a published lead magnet without separate
  permission review, matching §9.3's Phase 3 rule).
- **`post_age_hours` and `views_at_observation`** exist so a read isn't just "5 replies" with no
  denominator — this is what §2C.4's exposure-context rubric factor reads from. Both are `null`, never
  a fabricated `0`, when there is no data for that observation yet.
- **`published_at` vs. `observed_at` vs. `captured_at`** are three different times and all three are
  needed: `published_at` is when the reply or Note was written (drives §5.4b's evidence-role
  derivation), `observed_at` is when the signal existed as measured, `captured_at` is when the
  ingestion run wrote the row. Conflating them made evidence-role derivation impossible.
- **`edited_at` / `deleted_at` / `superseded_by` make the store append-only under re-ingestion.** A
  reply the author edited produces a *new* row with `superseded_by` set on the old one, never an
  in-place overwrite — a research read that cited the old text stays honest about what it cited. A
  reply that disappears from the platform gets `deleted_at` (a tombstone) and is never hard-deleted:
  still citable as evidence, rendered as withdrawn, excluded from fresh aggregate counts.

**Comments versus replies, and thread reconstruction.** The original `source` enum had no way to
distinguish a Substack essay's comments from a Note's threaded replies — different surfaces with
different shapes. `source: "comment"` is essay-surface only; `source: "reply"` is
Notes-thread-surface. `surface` names which (`"note"` or `"essay"`, plus `"email"` / `"dm"` /
`"other"` for non-Substack channels), and `note_id` / `reply_id` / `parent_reply_id` let a consumer
reconstruct who-replied-to-whom within a thread — `parent_reply_id` is `null` for a top-level reply to
the Note itself, and holds the parent's `reply_id` for a nested reply. `content_item_id` resolves
against §1B's lineage fields when the observation traces to a specific published item (a
`substack-post` essay or a `text-post-note` Note); it stays `null` for observations with no single
originating item (a subscriber-count delta, for instance).

**Typed metric payload.** A `source: "metric"` row previously carried no actual metric data — no name,
no value, nothing a rubric or a snapshot could read. `metric` is a typed sub-object: `metric_name`
names what was measured (views, likes, restacks, comment/reply counts, subscriber totals and deltas,
clicks, saves — extensible, not a closed set); `metric_value` is the reading; `previous_value` and
`delta` capture change over the stated window (`window_start`/`window_end`); `collected_at` is when
the pull happened. **Unknown data is `null`, not a fabricated zero** — a metric nobody has measured
yet carries `null` fields, never a `0` that would read as "measured and found nothing."

**Corrected 2026-08-07 (round-3): when `metric` is required.** The round-2 text said `metric` is
`null` "for every other `source`" and then, two sentences later, required `source:
"subscriber_movement"` rows to use the same object — a direct contradiction, and exactly the kind two
implementations resolve two different ways. The rule is now stated once, unambiguously:

> `metric` is **required (non-null)** when `source` is `metric` **or** `subscriber_movement`.
> It is **`null`** for every other `source` value.

A `subscriber_movement` row uses `metric_name: "subscribers_total"` or `"subscribers_delta"`.

**Round-4: a measured zero is a real value; only an unmeasured one is `null`.** These are different
facts and the distinction is load-bearing, because a Note with zero replies is genuine evidence — it
is the case Phase 1 most needs in order not to overweight the posts that happened to get conversation.
`metric_value: 0` means the pull ran and the count was zero. `null` means nobody measured it. An
ingestion pass MUST write the real `0`, and MUST NOT skip writing a metric observation because the
value is zero. The earlier phrasing ("unknown data is `null`, not a fabricated zero") is about the
opposite error and both rules hold at once: never invent a zero you did not measure, never drop a zero
you did.

**Which metrics get written, and when.** For every captured Note or essay, an ingestion pass writes a
`source: "metric"` observation per measured quantity — at minimum `views`, `likes`, `restacks`, and
either `comments_count` (essay) or `replies_count` (Note), each with `window_start` / `window_end` /
`collected_at`. Account-level subscriber state is written as `source: "subscriber_movement"`
observations carrying `subscribers_total` and `subscribers_delta`.

**Idempotency — keyed on the measured value, not the window** (corrected round-5). A re-run writes a
new metric observation **only when `metric_value` differs from the most recent observation for the
same `(content_item_id, metric_name)` pair**. An unchanged reading advances the existing row's
`window_end` and `collected_at` and creates nothing new.

The round-4 phrasing said "value **or** collection window has changed," which defeated itself: a daily
sync moves the window on every run by definition, so every metric would have written a new row every
day — the exact duplication the rule was written to prevent. The window is an attribute of the reading,
not part of its identity.

- A metric that has never moved therefore has exactly one row, whose window spans from first to most
  recent observation. That is the correct representation: one measurement that has held.
- A metric that moves gets a new row with `previous_value` and `delta` set, so history is a series.
- **`metric_value: 0` participates normally.** A Note that had zero replies at the first check and
  still has zero writes one row, not one per sync.

Without this, a daily sync inflates every count computed by counting observations.

**Reads stay restricted, same posture as §5.4.** `research_observations` never reaches the GUI as a
list. Normal venture reads expose only the aggregated `phase_1_research_read` (§2C.3), never
individual observation rows. Signals and `/strategy` read it only through the redacted read path
(§5.4b), never by direct table access. A separate, explicitly-protected correction view may let Muxin
fix a misclassified field or a bad extraction, the same discipline §5.4's correction path uses.

**This store is never the Phase 3 response gate's input.** `included_in_gate`, eligibility, and the
20/30 count belong exclusively to `responses.jsonl` (§5.4/§7.3 of `venture/rules.md`). An email or DM
captured here during Phase 1 does not silently count toward the Phase 3 gate even if the same person
later responds again in Phase 3 — that later response gets its own `responses.jsonl` entry. This holds
for every `evidence_role` (§5.4b), historical and current alike.

### 5.4b Per-venture evidence links, and how `evidence_role` is derived

**Added 2026-08-07 round-2 (as "historical evidence"), rebuilt round-3.** A venture rarely starts from
zero. Muxin may already have Notes, essay comments, and reply threads from before the venture's Phase
1 began — exactly the kind of evidence that can tell the system "this problem is already established
as a felt one, don't retest it, test what help people want and which behavior-based audience role
responds" (`venture/rules.md` §5.1A). Round-2 modeled that as an `evidence_role` field stamped onto
each observation by whatever collected it. Round-3 replaces that: **the role is a relationship between
an observation and a venture, so it lives on a link and is derived, never stamped by a collector.**

**Record shape.** Each line of `venture/<slug>/evidence-links.jsonl`:

```json
{
  "link_id": "el-001",
  "venture_slug": "…",
  "observation_id": "o-001",
  "classification_id": "c-001" | null,
  "evidence_role": "historical_prior" | "current_probe" | "current_organic",
  "evidence_role_basis": { "rule": "published_before_kickoff" | "matches_venture_probe"
                                  | "published_after_kickoff_not_a_probe",
                            "kickoff_at": "…", "published_at": "…",
                            "probe_id": "p1-idea-03" | null },
  "research_plan_version": 2,
  "unknown_ids": ["u1"],
  "unknown_mapping_status": "current" | "carried_forward" | "needs_review",
  "target_audience_fit": "confirmed" | "uncertain" | "off-target" | null,
  "included_in_research_read": true,
  "exclusion_reason": null | "…",
  "linked_by": "system" | "muxin",
  "linked_at": "…",
  "muxin_reviewed": false
}
```

**`classification_id` selects which reading of the observation this venture uses** (round-4). An
observation may carry several classifications under different taxonomies (§5.4c); the link names the
one that applies here. It is `null` for an observation with no text to classify (a metric or
subscriber-movement row) or one not yet classified under this venture's stamped taxonomy.

**Validation compares taxonomy id AND version, not id alone** (round-5). A venture stamps
`taxonomy_id` *and* `taxonomy_version` at kickoff, the same way it stamps a rules version. A link is
rejected unless the referenced classification matches **both**. Checking the id alone would let a
venture stamped at `civic-tech-substack` v1 silently link a v2 classification — and a taxonomy version
bump is precisely the case where labels were redefined, split, or retired, so v1 and v2 readings are
not interchangeable. Silently mixing them would reproduce, inside one venture, the same
incomparable-labels problem the per-venture taxonomy split exists to prevent between ventures.

Adopting a new taxonomy version for a venture already in flight is therefore a deliberate act, not a
side effect: re-stamp the venture, run `research:reclassify` under the new version, and re-point the
links. Until that happens the venture keeps reading v1, which is the correct default — a mid-sprint
relabel that nobody chose is worse than a slightly stale label set.

Together with §5.4c's "at most one live classification per (observation, taxonomy) pair," this is what
makes cross-venture and cross-version taxonomy leakage structurally impossible rather than merely
discouraged.

**Why these four fields and not others.** `evidence_role`, `unknown_ids`, and `target_audience_fit`
are the three judgments that change depending on which venture is asking, and they were the three that
made an account-level store impossible while they sat on the observation:

- **`evidence_role`** — the same March Note reply is `historical_prior` to a venture kicked off in
  August and `current_organic` to one kicked off in February. One value cannot be right for both.
- **`unknown_ids`** — an unknown only exists inside one venture's `phase_1_research_plan` (§2C.1).
  Round-2's version created a circular dependency: the ingestion pipeline could not write an
  observation until some venture had a reviewed plan to name unknowns against. On the link, the
  observation lands immediately and gets tagged against unknowns later, per venture, as each plan is
  reviewed.
- **`target_audience_fit`** — "is this person my audience" is definitionally venture-relative.
- **`included_in_research_read` / `exclusion_reason`** — one venture may exclude an observation
  another venture legitimately uses. Excluding is a per-venture editorial act, not a fact about the
  reply.

**`evidence_role` derivation — a rule, not a collector's guess.** Round-2's ingestion plan hardcoded
`historical_prior` for everything the scraper produced. That breaks the moment the scraper re-runs and
captures a Note published *during* an active venture's sprint — which the same plan explicitly
requires it to do. The role MUST be computed from three inputs (the venture's kickoff timestamp from
`canon.md`, the observation's `published_at`, and whether the content item is one of this venture's
registered probes), evaluated in this order, and recorded in `evidence_role_basis` so the call is
auditable:

1. **`published_at` < the venture's `kickoff_at` → `historical_prior`.** Unconditional, and checked
   first. Nothing published before a venture existed can be that venture's controlled probe, no matter
   what else it matches.
2. **Otherwise, `content_item_id` resolves to an artifact belonging to this venture whose
   `post_or_probe_id` is in this venture's Phase 1 probe set → `current_probe`.** This is a controlled
   test: a post this venture drafted, reviewed, and published to answer a named unknown.
3. **Otherwise → `current_organic`.** Published during the sprint window but not as one of this
   venture's probes: Muxin's other Notes, Studio content, anything running in parallel.

`published_at` being `null` (a source with no meaningful publication time, e.g. a DM) falls to rule 2
then 3 using `observed_at` in place of `published_at`. An observation whose role cannot be determined
is **not** silently defaulted — the link is written with `included_in_research_read: false` and an
`exclusion_reason`, and surfaces for Muxin to resolve.

**What each role is allowed to do:**

- **All three roles may inform the research read.** `phase_1_research_read` findings (§2C.3) draw on
  historical and current observations together; a finding's `evidence_refs` may mix them freely, and
  the read makes the mix visible so Muxin can see how much of a `"strong"` reading rests on data
  collected before this venture existed. A finding resting mostly on `historical_prior` evidence is
  not automatically weaker — old, specific, recurring evidence can score `"strong"` on the §2C.4
  rubric same as fresh evidence.
- **Only `historical_prior` may populate `confirmed_knowns`** in `phase_1_research_plan` (§2C.1) at
  kickoff, with `evidence_refs` pointing at the linked observations and `confirmed_by_muxin: true`
  once she signs off. This is the mechanism that stops a venture re-testing what its own prior work
  already established.
- **No role may clear a gate that requires controlled collection.** A `historical_prior` or
  `current_organic` observation MUST NOT count toward Checkpoint 1 (which requires the three
  *required* Phase 1 posts to be freshly drafted, approved, and confirmed live in this venture) and no
  observation of any role counts toward the Phase 3 response gate's 20/30 threshold (`venture/rules.md`
  §7.3) — that gate belongs exclusively to `responses.jsonl` (§5.4). Letting pre-existing Notes replies
  count would let a venture "start" Phase 3 most of the way to its gate on data never collected under
  its own eligibility and dedup discipline.

**Research plans are versioned, and a `more_probes` cycle never silently invalidates existing links**
(round-4). This was open question 16 and it is now closed, because it is central Phase 1 behavior, not
a later detail: a `more_probes` continuation (§2A) routes a venture back into Phase 1 and typically
revises `phase_1_research_plan` — adding unknowns, splitting one into two, retiring one that turned out
to be answered. Every existing link's `unknown_ids` then refer to a plan that no longer exists.

- **Every `phase_1_research_plan` carries an integer `plan_version`,** starting at 1 and incrementing
  on each revision. A revision is a new version, never an in-place edit — the same append-only
  discipline `canon.md` and the classification table use.
- **Every evidence link records the `research_plan_version` its `unknown_ids` were assigned under.**
  A link is always interpretable against the plan it was actually made against.
- **Links against superseded versions are preserved, not rewritten.** A research read produced under
  plan version 1 stays traceable to the evidence it actually used.
- **On a revision, each existing link is reconciled by rule, and `unknown_mapping_status` records the
  outcome:**
  - every `unknown_id` on the link still exists in the new version → **auto-carry**: the link is
    copied forward with the new `research_plan_version` and `unknown_mapping_status: "carried_forward"`;
  - any `unknown_id` was removed, renamed, split, or merged → **`unknown_mapping_status:
    "needs_review"`**, carried forward with its old ids intact so nothing is lost;
  - links created fresh under the current version are `"current"`.
- **A research read MUST NOT run while any link it would draw on is `needs_review`.** Muxin resolves
  the changed mappings first. This is the point of the rule: `more_probes` exists because the evidence
  was not good enough, and quietly re-reading it against unknowns that shifted underneath would
  reproduce exactly the problem the loop was meant to fix.

**Signals and `/strategy` read the account-level store, never a venture's private files.** This
describes the target state, and one half of it is new work rather than current behavior — see the
current-state note in §5.4a. The observation store (§5.4a) exposes a single redacted read path —
aggregate counts, `redacted_text` only, never `exact_text`, never a raw `respondent_hash` — and that
path is what the Signals room and `/strategy` are to consume, mapped into the four outcome families of
§5.8. **Today `/strategy` reads `analytics.db` and Signals reads `/strategy`'s generated briefs;
wiring the redacted research read into Signals is Card D.** Neither ever reads
`evidence-links.jsonl`, `responses.jsonl`, or anything else inside `venture/<slug>/`: those are one
venture's private working state, and a Signals read that depended on them would break the moment there
were two ventures or none.

**The ingestion pipeline that fills this store is specified separately.** Raw capture, reconciliation,
classification, taxonomy configuration, and the acceptance tests for all of it live in the Substack
Notes reply-signal ingestion plan (see `venture-build-plan.md`'s Related section and the backlog
proposal's "Historical Substack evidence ingestion" card). This section defines the contract that
pipeline's output must satisfy; it does not specify the pipeline.

### 5.4c Classifications — a separate table, many per observation

**Added round-4.** Round-3 embedded a single `classification` object on the observation row. That is
wrong for an account-level store whose whole purpose is serving multiple ventures: each venture may
classify the same corpus under its own taxonomy (§5.4b, and the taxonomy-is-configuration rule below),
and one embedded object holds exactly one. The round-3 ingestion plan then papered over the gap by
saying re-classification writes new *observation* rows — which duplicates the reply, inflates every
recurrence and topic-heat count that works by counting observations, and lets a civic-tech
classification leak into a venture that has nothing to do with civic tech.

**One row per classification, in `research_observation_classifications`:**

```json
{
  "classification_id": "c-001",
  "observation_id": "o-001",
  "taxonomy_id": "…", "taxonomy_version": "…",
  "prompt_version": "…" | null, "model": "…" | null,
  "status": "classified" | "abstained" | "human_corrected" | "human_entered",
  "classified_at": "…" | null,
  "supersedes_classification_id": "c-000" | null,
  "fields": {
    "topic_labels":           { "value": ["…"], "confidence": "high" | "medium" | "low",
                                "abstained": false, "evidence_span": "…" | null },
    "emotional_frame":        { "value": "…" | null, "confidence": "…", "abstained": false,
                                "evidence_span": "…" | null },
    "desired_help":           { "value": "…" | null, "confidence": "…", "abstained": false,
                                "evidence_span": "…" | null },
    "behavior_audience_role": { "value": "…" | null, "confidence": "…", "abstained": false,
                                "evidence_span": "…" | null },
    "stuck_point":            { "value": "…" | null, "confidence": "…", "abstained": false,
                                "evidence_span": "…" | null }
  },
  "correction": null | { "corrected_by": "muxin", "corrected_at": "…",
                          "fields_changed": ["emotional_frame"],
                          "superseded": { "emotional_frame": { "value": "…", "confidence": "…" } },
                          "reason": "…" }
}
```

**The rules that make this work:**

- **Re-classification creates a classification record, never another observation.** A new taxonomy, a
  new taxonomy version, or a new prompt produces a new row here pointing at the same
  `observation_id`. The observation — the text, the reply id, the dates, the metrics — is written once
  and never duplicated by classification activity.
- **`supersedes_classification_id`** chains revisions within the same taxonomy, so "the current read
  under taxonomy X" is the row with that `taxonomy_id` and no successor. Across *different*
  taxonomies nothing supersedes anything: two taxonomies are two parallel readings of the same text,
  both valid, neither replacing the other.
- **At most one live classification per (observation, taxonomy_id) pair.** A second row for the same
  pair must set `supersedes_classification_id`. This is what makes "which classification applies" a
  deterministic question rather than a heuristic.
- **Every count that aggregates observations counts observations, not classifications.** Recurrence,
  topic heat, and distinct-respondent counts (§2C.3) join through `observation_id` and de-duplicate on
  it. A reply classified under three taxonomies is still one reply.
- **A venture only ever sees classifications under the taxonomy it stamped.** Its evidence link names
  the classification it uses (§5.4b), so a taxonomy belonging to another venture is not merely
  discouraged from leaking — it is unreachable, because nothing links to it. This is the structural
  version of the fixture-isolation rule §9 tests for.
- **`status`** distinguishes four real states: `classified` (a pass produced labels it stands behind),
  `abstained` (a pass ran and declined), `human_corrected` (a pass ran and Muxin changed at least one
  field), `human_entered` (Muxin authored the observation herself; no classifier ran, so
  `prompt_version` and `model` are `null`).
- **Abstention is a first-class outcome, not a failure.** Any field the classifier cannot call with
  reasonable confidence carries `abstained: true` and `value: null`. A row where every field abstained
  carries `status: "abstained"`. This is what stops a pipeline from manufacturing a confident
  `emotional_frame` for a two-word reply that has none.
- **Per-field `confidence` and `evidence_span`** — the confidence for that field specifically, and the
  span of the respondent's own words the label was drawn from. A label with no `evidence_span` is a
  label with no receipt; the correction view renders the span beside the label so a wrong call is
  visible without re-reading the whole thread.
- **`correction` is provenance, not a rewrite.** When Muxin changes a field, the prior machine value is
  preserved under `superseded` with the fields changed and her reason. Nothing overwrites silently, and
  a later accuracy review can measure how often the classifier needed correcting.
- **Label vocabularies are configuration, not schema.** This contract fixes the *shape*. It
  deliberately does not name a universal set of help types, emotional frames, or audience roles,
  because those are venture-specific and a hardcoded set would be exactly the fixture leak §9 exists to
  prevent. The taxonomy file shape and location are specified in the Substack ingestion plan (§5.4b).
- **Metric observations are normally never classified** — there is no text to classify. An observation
  with no classification row at all is the normal state for `source: "metric"` and
  `"subscriber_movement"`.

**Per-reply labels versus across-reply conclusions — a hard line (round-3).** These five fields are
the only classifications that belong to a single observation, because each is a property of *that one
piece of text*: `topic_labels`, `emotional_frame`, `desired_help`, `behavior_audience_role`,
`stuck_point`. Conclusions that only exist *across* observations — **topic heat, recurrence, signal
quality, and lead-magnet implications** — MUST NOT be written onto an observation or a classification
row. They are aggregate readings and they live on `phase_1_research_read` (§2C.3), where they can be
recomputed, reviewed, and disagreed with. Tagging one reply with "lead-magnet implication" is a
category error: a single reply cannot tell you what a lead magnet should be, and a schema that invites
the label will get one.

### 5.5 Mutations

The read model is not enough; these are the only writes the GUI may make.

| Action | Effect | Guard |
|---|---|---|
Each row's delivery side-effect is exactly the corresponding §2 transition; where `delivery_mode` is
`none`, delivery stays `not_applicable` throughout and only `editorial_status` moves.

| Action | Effect | Guard |
|---|---|---|
| `POST …/artifact/<id>/approve` | `draft → approved`; delivery `awaiting_approval → ready` | only from `draft` |
| `POST …/artifact/<id>/discard` | `→ discarded`; delivery `awaiting_approval`/`ready` → `cancelled` | only while delivery is `awaiting_approval`, `ready` or `not_applicable` |
| `POST …/artifact/<id>/cancel` | `approved → discarded`; delivery `handed_off`/`failed` → `cancelled` | only while delivery is `handed_off` or `failed` |
| `POST …/artifact/<id>/restore` | `→ draft`; delivery `cancelled`/`ready` → `awaiting_approval` | from `discarded`, or from `approved` while delivery is `ready`/`not_applicable` |
| `POST …/artifact/<id>/body` | rewrites the file at `body_path` | only while `editable` |
| `POST …/artifact/<id>/field/<name>` | rewrites one entry of `fields` (§2B), re-derives `body_path` | only while `editable`; `name` must be a field the kind defines |
| `POST …/artifact/<id>/confirm` | supplies `evidence`, delivery `handed_off → live_confirmed` | only from `handed_off`; evidence must meet the kind's minimum (§3) |
| `POST …/artifact/<id>/report-failed` | delivery `handed_off → failed`, writes `failure` | manual mode only — the app learns app-mode failures itself |
| `POST …/artifact/<id>/retract` | §2.1 — writes `retraction`, keeps `evidence`, `→ discarded`, delivery `→ cancelled` | only from `live_confirmed`; the `retraction` attestation is required, `evidence` is untouched |
| `POST …/artifact/<id>/retry` | delivery `failed → ready` | only when `failure.retryable` |
| `POST …/checkpoint/<id>/clear` | appends the ledger event, unlocks the next phase | `id` is `checkpoint-1`, `checkpoint-2`, or `checkpoint-3`; only when the checkpoint's `state` is `open` and every required artifact is complete; a checkpoint already `cleared` is a no-op (§5.3) |
| `POST …/response/ingest` | writes one or more `responses.jsonl` entries (§5.4) from pasted or submitted text | protected, local-only surface; returns a confirmation (count added, likely-duplicate flags), never raw text back |
| `POST …/response/<id>/correct` | edits `cluster_id`, `target_audience_eligible`, `exclusion_reason`, `stuck_point`, or `desired_outcome` on one response | protected correction view only (§5.4); `exact_quote` itself is never rewritten |
| `POST …/decision/<id>/select` | sets `selected_candidate_id`, `selected_by`, optional `override_reason`; `status → selected` | only while `status` is `awaiting_user`; `response_gate_opened` fires automatically from the response count, it is not a decision selection |
| `POST …/observation/ingest` | writes one or more `research_observations` rows (§5.4a) from pasted or submitted text, or a metrics pull | protected, local-only surface; returns a confirmation, never raw text back; account-level, so it takes no venture slug |
| `POST …/observation/<id>/reclassify` | writes a **new** `research_observation_classifications` row (§5.4c) for this observation, setting `status: "human_corrected"` and preserving the machine values under `correction.superseded` | protected correction view only; `exact_text` is never rewritten, no prior classification is deleted, and **no new observation row is created** |
| `POST …/<slug>/evidence-link` | creates or updates one `evidence-links.jsonl` line: `classification_id`, `unknown_ids`, `target_audience_fit`, `included_in_research_read`, `exclusion_reason` | per-venture; `evidence_role` and `research_plan_version` are **derived** (§5.4b) and MUST NOT be settable through this mutation — a caller-supplied value is rejected, not honored; a `classification_id` under a taxonomy other than this venture's stamped one is rejected |
| `POST …/<slug>/evidence-link/<id>/review` | sets `muxin_reviewed: true`, and clears `unknown_mapping_status: "needs_review"` to `"current"` after she resolves the changed mapping | protected; lets Muxin confirm a system-proposed link, and is the only way a `needs_review` link becomes readable by a research read (§5.4b) |
| `POST …/<slug>/research-plan/revise` | writes a new `phase_1_research_plan` version, reconciles existing evidence links per §5.4b (auto-carry or flag `needs_review`), and returns the count of links needing review | only after a `phase-1-research-continuation` decision of `more_probes`; never edits the prior plan version in place |
| `POST …/research-read/finding/<id>/confirm-emergent` | sets `muxin_confirmed_emergent` (`true`/`false`) on one `finding_origin: "emergent"` finding | only while `muxin_confirmed_emergent` is `null`; a `false` excludes the finding from `lead_magnet_implications` and downstream `rationale` without deleting it (§2C.3) |
| `POST …/research-plan/review` | sets `reviewed_by_muxin: true`, `reviewed_at` on `phase_1_research_plan` | only while `reviewed_by_muxin` is false; unlocks `draft-phase-1-ideas` (§5.1) |
| `POST …/research-read/review` | sets `reviewed_by_muxin: true`, `reviewed_at` on `phase_1_research_read` | only while `reviewed_by_muxin` is false; a prerequisite for selecting the `phase-1-research-continuation` decision, not a substitute for it |

---

### 5.6 Signal snapshots and the Day 14 scorecard

**`signal-snapshot`** — a periodic, machine-written record of post-level performance (views, likes,
restacks, replies/comments, saves, link clicks) and venture-level subscriber movement. Not an
artifact in the `artifacts.jsonl` sense — nothing approves or
delivers it — but it is evidence: a decision record's `evidence_refs` (§2A) may point at a signal
snapshot the same way it points at a response id. Phase 2's lead-magnet-concept decision explicitly
requires Phase 1 signals as an input (`venture/rules.md` §6.1) — `signal-snapshot` is where those
live so that requirement has somewhere concrete to read from.

```json
{ "snapshot_id": "s-2026-08-10", "as_of": "…", "phase": 1,
  "posts": [
    { "artifact_id": "p1-essay-01", "surface": "essay",
      "views": 340, "post_age_hours": 18,
      "likes": 9, "restacks": 1,
      "comments": 4, "replies": null,
      "clicks": 12, "saves": 2 },
    { "artifact_id": "p1-note-02", "surface": "note",
      "views": 1180, "post_age_hours": 42,
      "likes": 23, "restacks": 3,
      "comments": null, "replies": 7,
      "clicks": null, "saves": 1 }
  ],
  "subscribers": { "total": 412, "delta_since_last_snapshot": 6,
                    "window_start": "…", "window_end": "…" } }
```

**Corrected 2026-08-07 (round-3): the example now obeys its own rule.** The round-2 example showed a
single row with `surface: "essay" | "note"` unresolved while populating `replies: 4` and leaving
`comments: null` — the exact inverse of the rule stated immediately below it, and the kind of
contradiction an implementer copies rather than reads past. The example is now two concrete rows, one
per surface, each populating the correct field and nulling the other.

**Revised 2026-08-07: `views` and `post_age_hours` are required per post**, not optional — they're
the denominator §2C.4's exposure-context rubric factor needs (five replies on 340 views at 18 hours
reads very differently than five replies on 20,000 views at three days). Fields the venture has no
data for yet are `null`, not zero — a `day-14-review` or a decision record reading `null` must render
"not enough data yet," never a fabricated zero that reads as "nothing happened."

**Revised 2026-08-07 (round-2 corrective pass): `likes`, `restacks`, a `comments`/`replies` split, and
a venture-level `subscribers` block are now part of the required shape**, not omitted. The prior
version dropped Substack's own like/restack counts entirely and had one ambiguous `replies` field for
both an essay's comments and a Note's threaded replies. Fixed:

- **`surface`** (`"essay"` or `"note"`) says which kind of post this row is, matching §5.4a's
  `research_observations` usage.
- **`comments`** is populated for `surface: "essay"` posts (Substack calls essay responses
  "comments") and `null` for Notes. **`replies`** is populated for `surface: "note"` posts (Substack
  calls a Note's threaded responses "replies") and `null` for essays. Exactly one of the two is
  non-null per row — never both, never a shared count that hides which kind it actually is.
- **`likes`** and **`restacks`** are required per post, same "`null` for no data yet, never a
  fabricated `0`" rule as every other field here.
- **`subscribers`** is venture-level, not per-post (a subscriber count isn't attributable to one
  post) — `total` and `delta_since_last_snapshot` over the stated window. This is the structured home
  for what §5.4a's `subscriber_movement` observations feed into in aggregate; an individual
  subscribe/unsubscribe event tied to a specific post still gets its own `research_observations`
  row (`behavioral_action: "subscribed"` / `"unsubscribed"`) when it's attributable.

**The earlier inline `funnel` object on this record is retired.** Landing-page visits, opt-ins,
survey completions, and every downstream business outcome now live in `funnel-events.jsonl` as
discrete, attributable events — see §5.7. `signal-snapshot` stays scoped to post-level engagement; it
does not aggregate funnel numbers itself.

**`day-14-review`** — the Phase 4 output. Not a checkpoint (§5.3), but a required artifact with its
own structured `fields` (§2B) and a decision attached:

```json
{ "scorecard": {
    "posts_live": 3, "posting_pace_achieved": "5/week",
    "qualified_views_or_clicks": 41, "clicks_target_or_learning_only": "learning_only",
    "landing_page_opt_in_rate": 0.06, "opt_in_target_or_learning_only": "learning_only",
    "eligible_unique_responses": 24, "response_quality_read": "…",
    "sustainability_read": "…" },
  "decision": "continue" | "revise_positioning" | "revise_lead_magnet"
             | "collect_more_evidence" | "stop",
  "decided_by": "muxin", "decided_at": "…" }
```

This is what §5.1's `day_14_review` field renders. Every scorecard field traces back to the target (or
`learning_only` status) fixed at intake (`venture/rules.md` §4.4) — the read model must never invent a
pass condition on Day 14 that wasn't defined on Day 0.

### 5.7 Funnel events and attribution

**Added 2026-08-07, corrective pass.** This is the direct fix for the review's central question —
"which low-performing post brought in this lead" — which nothing in the original contract could
answer. `signal-snapshot` (§5.6) aggregates engagement; it was never meant to carry qualified
inquiries, calls, opportunities, or purchases, and it had no notion of attribution at all.

**Record shape.** Each line of `funnel-events.jsonl`:

```json
{
  "event_id": "fe-001",
  "event_type": "visit" | "opt_in" | "survey_response" | "qualified_inquiry" | "call"
              | "opportunity" | "purchase",
  "occurred_at": "…",
  "respondent_hash": "…" | null,
  "value": 49.00,
  "source_note": "…",
  "attribution": [
    { "content_item_id": "p1-essay-01" | null, "touch_type": "first" | "last" | "assisted"
                                                     | "self_reported" | "unknown",
      "touch_at": "…", "confidence": "high" | "medium" | "low",
      "unattributed_reason": "…" | null } ]
}
```

- **`event_type` covers the full funnel**, not just the top: a landing-page `visit`, an `opt_in`
  (matches the Checkpoint 2 predicate's stored email), a `survey_response` (cross-references
  `responses.jsonl`'s `response_id` in `source_note` once one exists), and the three explicitly
  business-side events the handoff named — `qualified_inquiry`, `call`, `opportunity`, `purchase`.
- **`attribution` is an array, not a single field**, because a real funnel touch is rarely one clean
  line: someone can read a low-reach post, then convert weeks later after a different post reminded
  them. Every entry names which content item gets credit and how:
  - `first` — the earliest touch this person had with any venture content;
  - `last` — the touch immediately before the event;
  - `assisted` — a touch that plausibly contributed but is neither first nor last;
  - `self_reported` — the respondent said which post/email brought them, and this is not independently
    verifiable — it's still real attribution, but it must render differently from a tracked touch (a
    URL parameter can be re-checked, a person's memory cannot, same distinction §4 already draws
    between `url` and `attestation` evidence);
  - `unknown` — an event exists but no content item can be credited. This is a normal, honest state,
    not a bug to hide. A funnel-effectiveness read (Signals, `content-studio-vision.md`) MUST show an
    `unknown`-attribution rate rather than silently omitting unattributed events from a total.
- **`content_item_id` resolves against §1B's lineage fields** — an `artifact_id` for Venture content,
  or the equivalent id for Studio content once non-venture lineage exists. This is the join that
  answers "which post brought in this lead": walk a `qualified_inquiry` or `purchase` event's
  `attribution[]`, resolve each `content_item_id`, and read its `pillar`/`cta_id`/`lead_magnet_id`
  (§1B) straight off the content item.
- **Fixed 2026-08-07 (round-2 corrective pass): `content_item_id` is nullable, and MUST be `null`
  when `touch_type` is `"unknown"`.** The first version required `content_item_id` on every
  attribution entry while also defining `touch_type: "unknown"` for "no content item can be
  credited" — those two requirements directly contradicted each other; there is no content item to
  name in the case the enum value exists to describe. An `unknown`-touch entry now carries
  `content_item_id: null` and a **required** `unattributed_reason` — a short source note on why
  nothing could be credited ("no referrer captured," "landed on the homepage, not a specific post,"
  "self-reported source was too vague to match a content item"). `unattributed_reason` is `null` for
  every other `touch_type`, where `content_item_id` is required instead. This is what keeps an
  `unknown`-attribution rate (above) actually explainable rather than just a count.
- **A low-engagement content item credited on a `purchase` or `qualified_inquiry` event is exactly
  the case `venture/rules.md` §1A rule 6 and `content-studio-vision.md`'s Signals section require
  surfacing as a business result**, not folded into or overridden by that item's engagement numbers
  from `signal-snapshot`. The two records are joined by `content_item_id`, never merged into one.
- **No event pretends to certainty it doesn't have.** `confidence` on each attribution touch and the
  `self_reported`/`unknown` touch types exist specifically so a Signals read never overstates how
  solid an attribution chain is — matching the same "never synthesize evidence" discipline §4 already
  holds delivery evidence to.

### 5.8 The four outcome families — mapping records to Signals

**Added 2026-08-07, round-2 corrective pass.** `content-studio-vision.md`'s Signals section names
four families in Muxin's own words: attention (did people see it), conversation (did people reply,
comment, save it), audience (did it bring a landing visit or an opt-in), and business (did it lead to
a call, an inquiry, a sale) — "never collapse everything into one score." That prose existed before
this schema did, and nothing in the schema formally said which record and field each family reads
from. It does now:

| Family | What it answers | Fields, and which record they live on |
|---|---|---|
| **Attention** | Did people see it? | `signal-snapshot.posts[].views`, `.post_age_hours` (§5.6) |
| **Conversation** | Did people reply, comment, save, share, or DM? | `signal-snapshot.posts[].likes`, `.restacks`, `.comments`, `.replies`, `.saves` (§5.6); `research_observations` rows with `source` in `comment` / `reply` / `dm` / `follow_up_question` (§5.4a), read through the redacted account-level path (§5.4b) |
| **Audience** | Did it bring a landing visit, an opt-in, subscriber growth, or a survey response? | `funnel-events.jsonl` entries with `event_type` in `visit` / `opt_in` / `survey_response` (§5.7); `signal-snapshot.subscribers` (§5.6) |
| **Business** | Did it lead to a qualified inquiry, a call, an opportunity, or a purchase? | `funnel-events.jsonl` entries with `event_type` in `qualified_inquiry` / `call` / `opportunity` / `purchase`, joined to content via `attribution[].content_item_id` (§5.7) |

**This mapping is read-time, not a fifth record.** No new file exists to hold "the four families" —
a Signals read groups existing `signal-snapshot` and `funnel-events.jsonl` fields into these four
buckets at render time, per this table. Grouping this way is what makes "never collapse everything
into one score" (`content-studio-vision.md`) and "a quiet post that brings in one lead is a business
win, not a failed post" concretely checkable: a content item can show `attention: low` alongside
`business: 1 qualified_inquiry` on the same read, and nothing here has a mechanism to average those
into one number. A pillar- or platform-suppression recommendation (`venture/rules.md` §1A rules 4/19)
reads engagement (attention + conversation) only — it MUST NOT read audience or business families
into a "this pillar is underperforming" call, since a low-attention item can still be a business win.

---

## 6. Legacy rows

Every existing `content/` and `outreach/` row carries none of the new fields. They keep `status` and
keep working. This mapping is **read-only** — nothing rewrites a legacy row and the existing tables
are not migrated.

Legacy `status` values actually stored are empty, `pending` (`reply-draft.ts:244`), `approve`,
`revise` (written by the GUI's save-note action, `page.ts:795`), `published` (see below), `discard`,
and `locked` (written by `outreach/lock.ts:103`; `rows.ts:31` only classifies it as decided).
**`needs` is not one of them** — it is only the GUI's display fallback for an empty status
(`statusLabel(s){ return s ? s : "needs"; }`, `page.ts:638`), and a mapping that treats it as stored
would be mapping a label.

| legacy `status` | `editorial_status` | `delivery_status` |
|---|---|---|
| empty | `draft` | `awaiting_approval` |
| `pending` | `draft` | `awaiting_approval` |
| `revise` | `draft` | `awaiting_approval` — she asked for changes, so it is back to needing her yes |
| `approve` | `approved` | `ready` |
| `published` | `approved` | **platform-dependent — see below** |
| `locked` | `approved` | `not_applicable` (an outreach message is final text, not something sent) |
| `discard` | `discarded` | `cancelled` |

**`published` does not mean one thing.** Seven call sites across six publishers write it, and they
do not agree on what it asserts:

| Publisher | What `published` actually means there | Maps to |
|---|---|---|
| Typefully (`typefully.ts:434`) | a draft was created — including an *unscheduled*, non-firing one (`typefully.ts:426`). Nothing is public | `handed_off` |
| Substack Notes agent (`substack.ts:246`) | the post was fired: "the claimed slot has arrived: fire exactly once, mark the row published" | `live_confirmed` |
| TikTok / PostPeer (`tiktok.ts:204`) | scheduled for a future time | `handed_off` |
| Quote cards (`cards.ts:232`, `cards.ts:272`) | scheduled at the image relay | `handed_off` |
| Ready-to-paste (`paste-files.ts:37`) | a `.txt` file was written for Muxin to paste. Emphatically not public | `handed_off` |
| YouTube (`youtube.ts:161`) | **ambiguous** — with a slot it is scheduled; with no slot it uploads at `YOUTUBE_PRIVACY`, which if `public` means the video is live *before* this line runs | see below |

So the mapping keys off the row's `platform`: `substack` → `live_confirmed`, everything else →
`handed_off`.

**YouTube is knowingly understated.** Whether a given legacy YouTube row went straight public is not
recorded on the row — it depended on a slot and an environment variable at run time — so the mapping
cannot recover it and does not try. It reads `handed_off` even where the video may be live.

That understatement is the deliberate direction of every ambiguity here. Reading `handed_off` for
something actually live is a recoverable inaccuracy in a read-only compatibility view. Reading
`live_confirmed` for something merely scheduled is the precise conflation this contract exists to
eliminate, and it would be unfalsifiable, because:

`evidence` is always `null` for legacy rows. No publisher records a verifiable reference on the row
itself — Typefully's draft id, the Substack agent's `ref`, YouTube's URL all go to
`publish-log.md`. A `live_confirmed` legacy row is trusted on the publisher's behavior, not on
evidence, and a screen must not offer to open a link it does not have.

`delivery_mode` / `publishable` by legacy kind:

| legacy kind | `delivery_mode` | `publishable` |
|---|---|---|
| `text` | `app` | true |
| `image` | `app` | true |
| `video` | `app` | true |
| `storyboard` | `none` | **false** — a storyboard row is the render gate `src/video/render.ts` checks (`queue.ts:152`), not a publish target |
| `outreach-message` | `none` | false |

`checkpoint_id` is always `null`. `failure` is always `null`.

---

## 7. Non-goals

- **No new publish machinery.** The only change to publishing is the three-part gate in §1. Typefully
  is not part of Phase 1 at all.
- **One venture at a time.** Multiple `venture/<slug>/` folders should work structurally, but a
  multi-venture switcher is not a design target.
- **Room placement — RESOLVED, no longer a non-goal.** Locked 2026-08-07: Venture is the permanent
  sixth top-level room, after Studio and before Content (`docs/content-studio-vision.md`). This
  contract's artifact/decision/checkpoint model doesn't change either way — a room is a UI placement,
  not a data-model concern — but the question itself is settled and should not be reopened here or in
  the build plan.
- **The phase logic itself.** What decides the platform pick, the idea ranking, the price lives in
  `venture/rules.md` (distilled from the plan's source note). This contract only says where the
  results are held.

---

## 8. Still open, and what each one blocks

From the plan's own Open questions, refreshed 2026-08-07. Room placement (above) and the
Checkpoint-3/response-gate conflation (§5.3) are now resolved. What's left:

1. **Build/venture name and slug** — cosmetic for the contract; needed before scaffolding.
2. **Markdown vs. SQLite for venture state** — decides §0.1 only. Field names, enums and transitions
   are unaffected. Recommended default: keep Markdown plus JSONL at the design stage unless
   implementation evidence favors SQLite.
3. **What backs the humaninference.ai signup form, email capture, and the survey.** ~~blocks Phase 2
   and Checkpoint 2 outright. The site is live but has no signup form. This is the one open question
   that is not a design question and cannot be worked around.~~ **Superseded 2026-08-19, resolved:**
   survey and email-capture capabilities already exist live on Muxin's own site (a real 4-question
   branching survey, checked into `venture/existing-survey-humaninference.md`) — the still-missing
   piece is only the lead-magnet landing page. This repo's Phase 2 scope is producing copy/concepts
   (lead magnet, landing-page copy, welcome-email copy, a fit review of the existing survey against
   whichever magnet gets chosen) for Muxin to install and confirm herself — it does not build or wire
   any capture mechanism. §3's `survey` row's `fields` shape needs a corresponding edit (fit-review,
   not new-survey-authoring) as part of the Phase 2 build — tracked there, not restated here.
4. **Phase 1's format split** — how many `substack-post` vs. `text-post-note` (§3, renamed from
   `text-post-longform`), and whether Checkpoint 1 requires all of them live or a subset. Sets
   `required` in §5.1's manifest and decides `text-post-announcement`'s `delivery_mode` in §3, so the
   phase screen's progress indicator cannot be finalized without it.
5. **Checkpoint 2's exact predicate** — `venture/rules.md` §6.8 proposes an end-to-end predicate
   (lead magnet downloadable, landing page stores an email, survey stores a tested answer, welcome
   email active, announcement optional). Stronger than the PDF's plain wording; needs Muxin's
   confirmation before a build treats it as final. §5.3's `checkpoint-2` in the read model is written
   against this proposed predicate but does not itself lock it in.

Raised by this contract, for Muxin:

6. **Do the §2 extensions land as specified?** `awaiting_approval`, `cancelled`, `handed_off`,
   `delivery_mode` and `failure` all extend the plan's sketch. Each is marked **[extends plan]**.
7. **Does the §2A decision-record model land as specified?** New in this revision — a separate
   `decisions.jsonl`, not fields bolted onto artifacts. Confirm before a build session scaffolds it.
8. **Should Phase 4 have a checkpoint?** §5.3 says no, following the plan — Phase 4 ends in the Day
   14 review (§5.6) plus a recorded continue/revise/collect/stop decision, not a fourth cleared
   checkpoint. If the Day 14 review is meant to be a gate rather than an output, that changes the
   enum and the read model.

Raised by the 2026-08-07 corrective pass:

9. **How do `qualified_inquiry`, `call`, `opportunity`, and `purchase` events (§5.7) actually get
   recorded?** These are business-side events with no obvious automatic source the way a landing-page
   `visit` or `opt_in` might have one. The likely answer is a manual entry surface for Muxin (she knows
   when a call happened), but that's a Work package 2 design choice, not settled here.
10. **Does non-Venture (Studio-originated) content actually gain the §1B lineage fields in this
    pass, or only Venture content?** §1B specifies the fields for all content on principle, but
    wiring them into `content/**/review-queue.md` and `src/db/schema.sql` for Studio content is real
    implementation scope Work package 2 has to size, not something this contract can assume is free.
11. **Do the §2C research-artifact shapes (`phase_1_research_plan`, `phase_1_research_read`, the
    observation store and evidence links) and the §5.7 funnel-event shape land as specified?** All are
    new in this corrective pass. Confirm before a build session scaffolds against them.

Raised by the round-2 corrective pass (2026-08-07, same day):

12. **The §2C.4 `signal_quality` scoring threshold is a recommended default, not confirmed.**
    "`strong` requires `audience_fit: present` plus 3+ other factors present, `moderate` requires 1–2"
    is one reasonable line to draw; Muxin may want it stricter, looser, or weighted differently once
    real Phase 1 data exists to test it against. Confirm before Work package 2 encodes it as a hard
    gate rather than a recommendation an implementer can still see the underlying rationale behind.
13. **Where does the historical-evidence raw-capture and classification pipeline (§5.4b) actually get
    built, and by whom?** §5.4b defines the evidence contract the pipeline's output must land in; it
    does not commission the pipeline itself. See the backlog proposal's "Historical Substack evidence
    ingestion" card and the dedicated scraper/ingestion plan referenced from `venture-build-plan.md`.
14. **Does converting existing (pre-venture) Substack Notes and comments into `research_observations`
    require a one-time backfill migration, or does it only apply going forward from whenever the
    ingestion pipeline first runs?** Affects how much historical evidence a venture's first
    `phase_1_research_plan` can actually cite at kickoff. The ingestion plan's answer is *both* — a
    one-time backfill command and a separate ongoing sync — but whether the backfill runs before the
    first venture kicks off is Muxin's scheduling call.

Raised by the round-3 corrective pass (2026-08-07, same day):

15. **Do `research_observations` and `research_observation_classifications` live in
    `data/analytics.db` or their own gitignored database file?** §5.4a specifies `data/analytics.db`
    because it already exists, is already gitignored, and is already what `/strategy` reads (Signals
    reads `/strategy`'s briefs — see §5.4a's current-state note). The counter-argument is blast
    radius: research evidence is more privacy-sensitive than post analytics, and a separate
    `data/research.db` would let the two carry different backup and access rules. Either satisfies
    this contract; confirm before Work package 2 writes the migration. Both tables go wherever this
    lands — splitting them across databases would break the join every aggregate depends on.
16. ~~**Who owns re-linking when a venture's `phase_1_research_plan` is revised?**~~ **Closed
    round-4** — this was central Phase 1 behavior, not an optional later detail, and leaving it open
    let `more_probes` route back into Phase 1 with links still pointing at obsolete unknown ids. §5.4b
    now specifies it: plans carry a `plan_version`, links record the `research_plan_version` they were
    made under, links against superseded versions are preserved, links whose unknowns all survive
    auto-carry, and anything changed or removed is flagged `needs_review` and blocks the research read
    until Muxin resolves it.

Raised by the round-4 corrective pass (2026-08-07, same day):

17. **Does a venture stamp exactly one taxonomy, or may it use more than one?** §5.4c and §5.4b assume
    one stamped `taxonomy_id` per venture, which is what makes cross-venture leakage structurally
    impossible. A venture wanting to compare two taxonomies over the same corpus would need a second
    mechanism. Recommended default: one per venture; revisit only if a real need appears.
18. **Key rotation policy for `RESEARCH_HASH_KEY`.** Rotation re-pseudonymizes everyone and breaks
    dedup continuity across existing rows (§5.4a), so it needs a re-hash migration. Recommended
    default: do not rotate on a schedule; rotate only on suspected exposure, with the migration run in
    the same operation.

## 9. Validation — proving fixtures cannot enter a clean venture

New in this revision, closing the audit's P0 finding that the civic-tech worked example was acting as
runtime logic (`phase2Arts()` always drafting the first civic checklist regardless of the selected
magnet; cluster counts coming from fixed weights; a $49 price seeded before any response analysis
existed). None of that is a data-contract bug by itself — it's a build-time discipline this contract
has to make checkable. A build against this contract must be able to demonstrate, not just assert:

1. **A freshly-scaffolded venture's `artifacts.jsonl`, `decisions.jsonl`, and `responses.jsonl` are
   all empty**, and every phase-1 script call on that venture produces artifacts whose `fields` and
   `body_path` content contains none of the civic-tech fixture's terms, cluster labels, outline
   sections, or the `$49` price — checked by string-matching generated content against a fixture
   term-list, not by trusting that the fixture file simply wasn't imported.
2. **A decision record's `candidates` are never prepopulated from the fixture.** `phase2Arts()`'s bug
   was structural — the magnet-selection decision's `selected_candidate_id` didn't actually drive
   which candidate's fields got drafted. The regression test asserts a decision record's *drafted
   artifact* traces to `selected_candidate_id`, not to a hardcoded default.
3. **Cluster counts and evidence in a `problem-selection` decision derive from `responses.jsonl`
   entries with `cluster_id` set**, never from a fixed weight table. A test asserts that changing the
   response set changes the cluster counts, and that zero responses produces zero clusters, not the
   civic-tech default five.
4. **Any cluster or candidate is selectable**, not only the first/recommended one — a test drives
   `POST …/decision/<id>/select` with a non-recommended `candidate_id` and confirms it's accepted and
   recorded with `selected_by`.
5. **If `venture/examples/civic-tech-worked-example.md` (§F of the plan) exists on disk, no phase
   script's runtime context includes it by default.** A test can assert this by checking the fixture
   path is never in a phase script's read-file list for a non-test venture, or by running a phase
   script with the fixture file deleted and confirming behavior is unchanged for a clean venture.
6. **Added 2026-08-07: a `phase_1_research_read`'s `findings[].emotional_frame`,
   `desired_help_or_job`, and `behavior_audience_segment` never match the civic-tech fixture's
   categories** ("civically awake but not performative" and similar) for a clean, non-civic venture —
   a test generates a research read for a synthetic non-civic venture and string-matches its findings
   against the fixture's category list, asserting zero overlap.
7. **Added 2026-08-07: Phase 2 concept generation cannot start on a clean venture without a real
   `phase-1-research-continuation` decision selected by a simulated Muxin action** — a test attempts to
   call the concept-generation step with `phase_1_research.continuation_decision: "pending"` and
   asserts it is rejected, then confirms it proceeds once the decision is `selected`.
8. **Added 2026-08-07, round-2: an `emergent` finding cannot influence Phase 2 while
   `muxin_confirmed_emergent` is `null`.** A test writes a `phase_1_research_read` with an emergent
   finding, confirms `lead_magnet_implications` and any downstream concept's `rationale` exclude it
   while unconfirmed, sets `muxin_confirmed_emergent: true`, and confirms it is now includable — then
   repeats with `false` and confirms it stays excluded permanently rather than reappearing.
9. **Added 2026-08-07, round-2; updated round-3: a `historical_prior` observation never counts toward
   Checkpoint 1 or the Phase 3 response gate.** A test seeds `research_observations` with rows
   predating the venture's `kickoff_at`, links them into the venture, and confirms Checkpoint 1's
   three-required-posts check and the response-gate's eligible-unique count are both unaffected by
   their presence or absence.
12. **Added 2026-08-07, round-3: `evidence_role` is derived, and the same observation gets different
    roles in different ventures.** A test creates two ventures with different `kickoff_at` timestamps,
    links one identical observation into both, and asserts the derived roles differ per §5.4b's rules
    (`historical_prior` for the later venture, `current_organic` or `current_probe` for the earlier
    one) — and that a caller-supplied `evidence_role` on the link mutation is rejected rather than
    honored.
13. **Added 2026-08-07, round-3: the account-level store is never duplicated per venture.** A test
    links one observation into two ventures and asserts exactly one `research_observations` row
    exists, with two `evidence-links.jsonl` lines pointing at it — not two copies of the text.
14. **Added 2026-08-07, round-3: Signals and `/strategy` never read inside `venture/<slug>/`.** A test
    asserts the Signals/strategy read path resolves only through the redacted account-level read
    function, and that its file-read set contains no path under `venture/`.
15. **Added 2026-08-07, round-3: no aggregate conclusion is ever written onto an observation row.** A
    test asserts `research_observations` rows carry no `topic_heat`, `recurrence`, `signal_quality`,
    or `lead_magnet_implication` field, and that a classification pass attempting to write one fails
    schema validation rather than silently adding a column.
16. **Added 2026-08-07, round-4: re-classification never duplicates an observation.** A test
    classifies one observation under taxonomy A, then re-classifies it under taxonomy B, and asserts
    exactly one `research_observations` row exists with two
    `research_observation_classifications` rows pointing at it. A second test asserts a recurrence
    count over that observation returns 1, not 2.
17. **Added 2026-08-07, round-4: a venture cannot read another venture's taxonomy.** A test creates an
    evidence link whose `classification_id` belongs to a taxonomy other than the venture's stamped one
    and asserts the link is rejected.
18. **Added 2026-08-07, round-4: a measured zero is stored, and an unchanged metric is not re-written.**
    A test captures a Note with zero replies and asserts a metric observation exists with
    `metric_value: 0` (not absent, not `null`); a second run against unchanged values asserts no new
    metric rows were created.
19. **Added 2026-08-07, round-4: a plan revision flags stale links and blocks the read.** A test
    revises a `phase_1_research_plan` so one `unknown_id` is removed, asserts affected links carry
    `unknown_mapping_status: "needs_review"` while unaffected links auto-carry, and asserts a research
    read is rejected until Muxin resolves them.
20. **Added 2026-08-07, round-4: `respondent_hash` is keyed.** A test asserts the same platform user id
    hashes differently under two different `RESEARCH_HASH_KEY` values, and that no log, error record,
    or export contains the raw identifier or the key.
21. **Added 2026-08-07, round-5: taxonomy validation compares id and version.** A test creates an
    evidence link whose classification carries the venture's stamped `taxonomy_id` but a different
    `taxonomy_version` and asserts the link is rejected — not just the different-id case.
22. **Added 2026-08-07, round-5: metric idempotency is keyed on value, not window.** A test runs three
    consecutive syncs against unchanged metric values across three different daily windows and asserts
    exactly one row exists per `(content_item_id, metric_name)` pair, with `window_end` advanced.
23. **Added 2026-08-07, round-5: every plan carries a version and every link records it.** A test
    asserts a `phase_1_research_plan` written without `plan_version` is rejected, and that a link
    created against it carries the matching `research_plan_version`.
24. **Added 2026-08-07, round-5: a research read names every channel.** A test generates a read from a
    Notes-only ingestion run and asserts `collection_coverage` contains an entry for every source in
    `venture/rules.md` §5.6 — essay comments `unavailable`, DMs and emails `not_checked`, each with a
    `gap_reason` — and that a read omitting any channel is rejected.
10. **Added 2026-08-07, round-2: `signal_quality_rationale` cannot be empty or partial when
    `signal_quality` is set.** A test asserts all eight §2C.4 factors are present with a `status` of
    `"present"`, `"absent"`, or `"unknown"` — never missing — before a finding's `signal_quality` label
    is allowed to render.
11. **Added 2026-08-07, round-2: `funnel-events.jsonl`'s `unknown`-touch entries always carry a
    non-null `unattributed_reason` and a null `content_item_id`, and every other touch type carries
    the reverse.** A test asserts the two fields are never both null and never both non-null on the
    same attribution entry.

These validations belong to Work package 2 (they require running code); this section exists so the
Work package 2 acceptance criteria have a concrete list to build against rather than the general
instruction "don't leak the fixture."
