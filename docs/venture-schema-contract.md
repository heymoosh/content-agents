# Venture Build — the data contract to design against

**Status:** a contract, not code. Nothing here is built. It exists so the Venture Build front end
can be designed against real state instead of invented state, and so the build that follows has an
unambiguous target. Companion to `docs/venture-build-plan.md`, which specifies the behavior; this
specifies the shape of what the screens render.

**Why this comes before the design.** `docs/venture-build-plan.md` §D establishes that the current
queue cannot represent this build's deliverables: `QueueRow` (`src/publish/queue.ts:14`) carries
only `id`/`platform`/`format`/`asset`/`status`/`notes`/`origin`, and `src/review/rows.ts:35`
recognizes exactly five artifact kinds, none of which is a landing page, a survey, a welcome email,
a product outline, or a price. A phase screen designed today would show a "live" column that nothing
in the system can populate, and an "approved" state that conflates Muxin's editorial yes with the
artifact actually being public. Those are the two gaps this document closes.

---

## 0. Where venture rows physically live

**Decision: venture artifacts get their own store under `venture/<slug>/`. The existing
`content/**/review-queue.md` and `outreach/**` tables are not widened.**

The plan's "extend the queue schema" is a change to the *logical* row contract (the `QueueRow` /
`EnrichedRow` shape the app reasons about), not six new columns bolted onto the hand-edited GFM
tables. `readQueue(folder)` is already per-folder, so a venture folder having its own richer store
satisfies the plan's "review-queue rows" language without touching a byte of the existing ones.

To be accurate about what does and does not force this, since one plausible argument turns out to be
false:

- **Not a reason:** "widening the table would corrupt rows on save." It would not. `writeCell`
  (`queue.ts:103`) splits on `|`, edits only cells 8 and 9, and rejoins **every** cell, so trailing
  columns survive a status click. `readQueue` parses each line by its own cell count, so a table
  mixing 9-, 10-, and 16-column rows parses fine.
- **Real reason 1 — the table is a human editing surface.** Every `review-queue.md` opens with "Set
  status to approve / revise / discard." Muxin edits it by hand. A sixteen-column GFM table is not
  something a person edits by hand.
- **Real reason 2 — mixing hand-written and machine-written fields in one row invites clobbering.**
  Editorial status is Muxin's to write. Delivery status, evidence URLs, and checkpoint ids are
  written by scripts and agents. Putting both in a file whose whole premise is hand-editing means a
  stray keystroke silently changes machine state, and a script overwrite silently changes hers.
- **Real reason 3 — `appendRow` writes a fixed layout.** It "always writes the full 10-column
  layout ... regardless of what column count the rest of the table happens to use"
  (`queue.ts:127`). Any existing path that creates a row (the GUI's Duplicate-to-platform action,
  for one) would silently emit a venture row missing every venture field.
- **Real reason 4 — the body doesn't live where the app expects anyway.** `saveDerivative`/`enrich`
  assume an editable body at `derivatives/<id>.md`. Landing-page copy and a product outline don't,
  so venture artifacts need their own discovery and editing path regardless of column count.

**Contingent on open question #2** (markdown vs. SQLite for venture state). This contract is written
for the markdown option, which the plan already recommends and which matches fiction. If that answer
flips to SQLite, every field name, enum, and transition below survives unchanged — only the physical
file layout in this section changes. **Do not treat question #2 as resolved by this document.**

---

## 1. The six fields

Additive to the logical row contract. Existing `content/` and `outreach/` rows carry none of them
and must keep working untouched — see §6.

| Field | Type | Values | Who writes it | When |
|---|---|---|---|---|
| `artifact_kind` | enum | see §3 | script | at draft time, never changes |
| `publishable` | boolean | `true` / `false` | script | at draft time, from `artifact_kind` (§3) |
| `checkpoint_id` | string \| null | `checkpoint-1`…`checkpoint-4`, or null | script | at draft time |
| `editorial_status` | enum | `draft` / `approved` / `discarded` | **Muxin**, via the GUI | on her decision |
| `delivery_status` | enum | `not_applicable` / `ready` / `scheduled` / `live_confirmed` / `failed` | script, agent, or attestation | after approval only |
| `evidence` | object \| null | see §4 | whoever confirms delivery | when delivery is confirmed |

Two rules that hold across every kind:

1. **`publishable` is checked, never inferred.** Today `publishText` decides by testing platform
   membership in `TEXT_PLATFORMS`. Every publish path must instead require `publishable === true`.
   An artifact with `publishable: false` must be unreachable from every publish path, and that is a
   test, not a convention (plan §"Model notes").
2. **`editorial_status` is the only field Muxin writes.** Everything else is machine state. This is
   the split that keeps the design honest: a screen must never offer her a control that edits
   delivery state directly, except the explicit attestation in §4.

---

## 2. The two state machines

They are independent, and conflating them is the specific bug this build has to avoid: Typefully
flips a row to `published` the moment it creates a *scheduled* draft, which proves nothing about
anything being publicly live.

### Editorial — who: Muxin, always

```
draft ──approve──▶ approved
  │
  └───discard───▶ discarded   (terminal)
```

`approved → discarded` is allowed (she changes her mind) **only while `delivery_status` is
`not_applicable` or `ready`.** Once something is `scheduled` or `live_confirmed`, un-approving it is
meaningless — it is already out. The screen should offer "retract" as a separate, explicit action
with its own consequences, not a silent status flip.

### Delivery — who: scripts, agents, or Muxin's attestation

```
not_applicable                          (publishable: false — terminal, never leaves)

ready ──schedule──▶ scheduled ──confirm──▶ live_confirmed   (terminal)
  │                     │
  └──────fail───────────┴─────fail──────▶ failed ──retry──▶ ready
```

| Transition | Actor | Trigger |
|---|---|---|
| → `ready` | script | `editorial_status` became `approved` and `publishable` is true |
| `ready → scheduled` | script / browser agent | handed to Typefully, the Substack Notes agent, or written to `ready-to-paste/` |
| `scheduled → live_confirmed` | agent or **Muxin's attestation** | evidence supplied (§4) |
| any → `failed` | script / agent | provider error, agent could not post |
| `failed → ready` | script | retry |

**Delivery never starts before editorial approval.** There is no path from `draft` into `ready`.
This is what makes rule 2 ("nothing publishes without review") structural rather than a convention.

---

## 3. Artifact kinds

`publishable` default and evidence type are properties of the kind, so a script sets them without
judgment.

| `artifact_kind` | Publishable | Delivery path | Evidence (§4) | Editable body lives at |
|---|---|---|---|---|
| `text-post-longform` | true | `ready-to-paste/` → Muxin pastes into Substack | `attestation` (live URL she confirms) | `phase-N-*/<id>.md` |
| `text-post-note` | true | Substack Notes browser agent | `agent` | `phase-N-*/<id>.md` |
| `landing-page-copy` | false | none — copy handed to humaninference.ai | `attestation` (page live) | `phase-N-*/<id>.md` |
| `welcome-email` | false | none — installed in the email tool | `attestation` (sequence active) | `phase-N-*/<id>.md` |
| `survey` | false | none — embedded in the welcome email | `attestation` (survey reachable) | `phase-N-*/<id>.md` |
| `product-outline` | false | none — internal artifact | `not_applicable` | `phase-N-*/<id>.md` |
| `price-decision` | false | none — internal artifact | `not_applicable` | `phase-N-*/<id>.md` |
| `thank-you-note` | true | sent by hand | `attestation` | `phase-N-*/<id>.md` |

Note the asymmetry the design has to show honestly: **most venture artifacts never publish.** A
landing page's copy being approved does not put it on the internet; Muxin (or whoever builds the
site) does that, and the checkpoint needs her word that it happened. Screens that treat "approved"
as "done" will be wrong for five of the eight kinds.

`landing-page-copy`, `welcome-email` and `survey` carry `publishable: false` **and** a real evidence
requirement. That combination is deliberate and is the case a naive design misses: not publishable
by the app, still required to be live before the checkpoint clears.

---

## 4. Evidence

`evidence` is null until delivery is confirmed. Three shapes, one per confirmation route:

```
{ type: "url",         value: "https://humaninference.substack.com/p/...", confirmed_at, confirmed_by: "muxin" }
{ type: "agent",       value: "<provider post id>", provider: "substack-notes", confirmed_at, confirmed_by: "agent" }
{ type: "attestation", value: "<what Muxin states is true>", confirmed_at, confirmed_by: "muxin" }
```

`attestation` is the escape hatch for anything with no machine-verifiable trace (a landing page
being live, an email sequence being active). It is deliberately a human claim and should be
**labelled as one in the UI** — "you confirmed this on Aug 12", not a green check that implies the
system verified anything. Never synthesize an attestation on Muxin's behalf.

---

## 5. The checkpoint read model

The row contract alone is not enough to draw a phase screen: the screens also render *where the
venture is*. This is what the GUI can read, and the only thing it should.

```
GET /api/venture/<slug>  ->
{
  slug, name,
  current_phase: 1..4,
  phase_status: "drafting" | "awaiting_you" | "checkpoint_ready" | "blocked",
  days: { planned_phase_day, elapsed_calendar_day, active_work_day, blocked_waiting_days },
  checkpoints: [
    { id: "checkpoint-1",
      state: "locked" | "open" | "cleared",
      manifest: [ { artifact_id, artifact_kind, editorial_status, delivery_status, evidence } ],
      complete: 3, required: 5,
      blocking: [ "<artifact_id> approved but not live" ] } ],
  response_gate: { eligible_unique: 12, required: 20, gates: ["problem","outline","price"] }
}
```

Four things the design must respect here:

- **`complete` / `required` come from the checkpoint's manifest**, not from counting rows. A
  checkpoint knows which artifact ids it requires; a row existing does not make it required.
- **`blocking` is the honest list.** It is what stands between now and the checkpoint clearing, in
  Muxin's terms. This is the single most useful thing a phase screen can show, and it is the thing a
  design invents badly if it does not know the shape.
- **`response_gate` counts eligible unique respondents**, deduped by respondent hash, not rows in
  `responses.jsonl` and not messages pasted in. It gates **only** the problem/outline/price steps;
  posting continues below 20. A screen that shows Phase 3 as wholly "blocked" is wrong.
- **`responses.jsonl` never reaches the GUI.** It holds raw quotes and identifying detail, stays out
  of git, and only its aggregate count and a redacted synthesis are ever exposed. There is no screen
  that lists responses.

Checkpoint state is derived from the event ledger in `canon.md`, keyed by deterministic event id
(`<slug>/checkpoint-2`), not from trusting a separate flag — so a re-run is a no-op and a crash
between the `canon.md` write and the `state.md` write reads as "not yet advanced" (plan §"Model
notes"). The GUI reads this state; it never writes it.

---

## 6. Legacy rows

Every existing `content/` and `outreach/` row carries none of the six fields. They keep `status` and
keep working. Reading a legacy row through the venture-aware contract yields:

- `artifact_kind`: mapped from its existing `kind` (`text`/`image`/`video`/`storyboard`/`outreach-message`)
- `publishable`: `true` for rows in `content/` (their whole purpose), `false` for `outreach-message`
- `checkpoint_id`: `null`
- `editorial_status`: its existing `status`
- `delivery_status`: `live_confirmed` if `status` is `published`, else derived; **never** invented
- `evidence`: `null`

This mapping is read-only. Nothing rewrites a legacy row into the new shape, and the existing tables
are not migrated.

---

## 7. Non-goals

Explicitly out of scope, so the design does not assume them:

- **No new publish machinery.** The only change to publishing is that every path must gate on
  `publishable === true`. Typefully is not part of Phase 1 at all.
- **One venture at a time.** Multiple `venture/<slug>/` folders should work structurally, but a
  multi-venture switcher is not a design target.
- **Room placement is a design decision, not a contract decision.** Whether this is a sixth room on
  the desk or an extension of Content is exactly the kind of question the design phase should
  answer. This document deliberately does not.
- **The phase logic itself.** What decides the platform pick, the idea ranking, the price — that
  lives in the plan doc and its source note. This contract only says where the results are held.

---

## 8. Still open, and what each one blocks

These are from `docs/venture-build-plan.md`'s own Open questions. **None is resolved here.**

1. **Build/venture name and slug** — cosmetic for the contract; needed before scaffolding.
2. **Markdown vs. SQLite for venture state** — intersects §0. This contract assumes markdown, as the
   plan recommends. Field names and transitions are unaffected either way.
3. **What backs the humaninference.ai signup form, email capture, and embedded survey** — blocks
   Phase 2 and Checkpoint 2 outright. The site is live but has no signup form. Nothing in Phase 2
   can produce a working deliverable until this is answered, and it is not a design question.
4. **Phase 1's format split** — how many long-form essays vs. Notes, and whether Checkpoint 1
   requires all of them live or a subset. Directly sets `required` in §5's checkpoint manifest, so
   the phase screen's progress indicator cannot be finalized without it.
