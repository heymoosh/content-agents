# Venture Build — the data contract to design against

**Status:** a contract, not code. Nothing here is built. It exists so the Venture Build front end
can be designed against real state instead of invented state, and so the build that follows has an
unambiguous target. Companion to `docs/venture-build-plan.md`, which specifies the behavior; this
specifies the shape of what the screens render.

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
  canon.md                       # append-only event ledger (see §5.3)
  state.md                       # derived cache; canon.md is authoritative
  responses.jsonl                # gitignored, never reaches the GUI (§5.4)
  artifacts.jsonl                # ONE LINE PER ARTIFACT — the venture queue
  phase-N-<name>/<artifact_id>.md  # the editable body
```

`artifacts.jsonl` rather than a markdown table, precisely because these rows are machine-written:
JSON Lines gives a nested `evidence` object and a `failure` object without inventing a cell-encoding
scheme, and appending is atomic per line. One line per artifact, rewritten in place on change (the
file is small; a venture produces tens of artifacts, not thousands). Each line:

```json
{ "artifact_id": "p1-essay-01", "phase": 1, "artifact_kind": "text-post-longform",
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

## 3. Artifact kinds

`delivery_mode`, `publishable` and the minimum acceptable evidence are properties of the kind, so a
script sets them without judgment.

| `artifact_kind` | `delivery_mode` | `publishable` | Delivery path | Min. evidence | Phase |
|---|---|---|---|---|---|
| `text-post-longform` | `manual` | false | `ready-to-paste/` → Muxin pastes into Substack | `url` | 1 |
| `text-post-note` | `app` | true | Substack Notes browser agent | `agent` | 1 |
| `text-post-announcement` | `manual` or `app` | per its channel | same as the post kind it ships as | as that kind | 2 |
| `lead-magnet` | `manual` | false | published/hosted wherever it is downloadable | `url` | 2 |
| `landing-page-copy` | `manual` | false | installed on humaninference.ai | `url` | 2 |
| `welcome-email` | `manual` | false | installed in the email tool | `attestation` | 2 |
| `survey` | `manual` | false | embedded in the welcome email | `url` | 2 |
| `product-outline` | `none` | false | internal artifact | — | 3 |
| `price-decision` | `none` | false | internal artifact | — | 3 |
| `thank-you-note` | `manual` | false | sent by hand | `attestation` | 4 |

**`text-post-longform` is `manual`, not `app`.** The app writes a `ready-to-paste/` file; a human
puts it on Substack. Calling that "publishable" would let a publisher think it owns the delivery.

`lead-magnet` and `text-post-announcement` come from the plan's Phase 2 line ("draft the magnet +
landing page copy + welcome email (with embedded survey) + announcement post") and were missing from
the first draft of this contract. `text-post-announcement` deliberately inherits its mode from the
channel it ships on, which is unresolved until open question #4 settles Phase 1's format split.

Note the asymmetry a design must show honestly. Of the ten kinds, exactly **one** (`text-post-note`)
is delivered by the app; `text-post-announcement` may be a second depending on its channel. The
other **eight are never app-delivered** — six `manual`, two `none` — and **five of those must still
be live before a checkpoint clears** (long-form post, lead magnet, landing page, welcome email,
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
    { id: "checkpoint-1",
      state: "locked" | "open" | "cleared",
      manifest: [ { artifact_id, artifact_kind, title, body_path, editable,
                    delivery_mode, publishable,
                    editorial_status, delivery_status,
                    evidence, retraction, failure,
                    required: true | false } ],
      complete: 3, required: 5,
      blocking: [ { artifact_id, reason: "approved but not live" } ] } ],
  gated_actions: [ { action: "identify-problem" | "outline-product" | "set-price",
                     state: "available" | "gated",
                     reason: "12 of 20 eligible responses",
                     progress: { have: 12, need: 20 } } ]
}
```

`title`, `body_path` and `editable` are in the manifest because the review card has to render and
edit the artifact; the first draft of this contract omitted them and left the designer nothing to
draw a card from.

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

### 5.3 Checkpoints and the ledger

Checkpoints are `checkpoint-1` … `checkpoint-3` only. **There is no `checkpoint-4`** — the plan
defines three, and Phase 4 ends in the Day 14 review, which is an output, not a gate. A finished
venture is `phase_status: "complete"`, not a fourth cleared checkpoint. *(Whether Phase 4 should
gain a checkpoint is a real question, but it is the plan's to answer, not this document's.)*

Checkpoint state derives from the event ledger in `canon.md`, keyed by deterministic event id
(`<slug>/checkpoint-2`). `state.md` is a **cache**, never the authority. That resolves the
crash-safety question the first draft waved at:

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

`responses.jsonl` never reaches the GUI. It holds raw quotes and identifying detail and stays out of
git. Only the aggregate count and, after Checkpoint 3, a redacted synthesis are exposed. There is no
screen that lists responses. The count is **eligible unique respondents**, deduped by respondent
hash and filtered for target-audience eligibility — never a row count and never a tally of messages
pasted in.

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
| `POST …/artifact/<id>/confirm` | supplies `evidence`, delivery `handed_off → live_confirmed` | only from `handed_off`; evidence must meet the kind's minimum (§3) |
| `POST …/artifact/<id>/report-failed` | delivery `handed_off → failed`, writes `failure` | manual mode only — the app learns app-mode failures itself |
| `POST …/artifact/<id>/retract` | §2.1 — writes `retraction`, keeps `evidence`, `→ discarded`, delivery `→ cancelled` | only from `live_confirmed`; the `retraction` attestation is required, `evidence` is untouched |
| `POST …/artifact/<id>/retry` | delivery `failed → ready` | only when `failure.retryable` |
| `POST …/checkpoint/<id>/clear` | appends the ledger event, unlocks the next phase | only when the checkpoint's `state` is `open` and every required artifact is complete; a checkpoint already `cleared` is a no-op (§5.3) |

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
- **Room placement is a design decision.** Whether this is a sixth room on the desk or an extension
  of Content is exactly what the design phase should answer. This document deliberately does not.
- **The phase logic itself.** What decides the platform pick, the idea ranking, the price lives in
  the plan and its source note. This contract only says where the results are held.

---

## 8. Still open, and what each one blocks

From the plan's own Open questions. **None is resolved here.**

1. **Build/venture name and slug** — cosmetic for the contract; needed before scaffolding.
2. **Markdown vs. SQLite for venture state** — decides §0.1 only. Field names, enums and transitions
   are unaffected.
3. **What backs the humaninference.ai signup form, email capture and embedded survey** — blocks
   Phase 2 and Checkpoint 2 outright. The site is live but has no signup form. This is the one open
   question that is not a design question and cannot be worked around.
4. **Phase 1's format split** — how many long-form essays vs. Notes, and whether Checkpoint 1
   requires all of them live or a subset. Sets `required` in §5.1's manifest and decides
   `text-post-announcement`'s `delivery_mode` in §3, so the phase screen's progress indicator cannot
   be finalized without it.

Raised by this contract, for Muxin:

5. **Do the §2 extensions land as specified?** `awaiting_approval`, `cancelled`, `handed_off`,
   `delivery_mode` and `failure` all extend the plan's sketch. Each is marked **[extends plan]**.
6. **Should Phase 4 have a checkpoint?** §5.3 says no, following the plan. If the Day 14 review is
   meant to be a gate rather than an output, that changes the enum and the read model.
