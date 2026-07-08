# Fit-finder + outreach engine — implementation plan

**Date:** 2026-07-08
**Status:** RATIFIED (Muxin, 2026-07-08) — all recommendations agreed (§2a handoff format, §2b
tracker ownership, §6 phase ordering). The build is unblocked; the one remaining input is the
Phase 0 seed list (§8 item 3), which can also come straight from JSA TARGET verdicts via the
ratified `--from-jsa` path.
**What this is:** the implementation-scoping pass Muxin asked for on the client/platform/job-outreach
backlog cluster ("Muxin wants a different/stronger model to do that scoping before a worker starts").
It assesses the approved architecture, closes the open decisions with concrete recommendations, and
lays out the file layout, data model, and build sequencing.

**Cards covered** (docs/content-agents-backlog.md):

| Card | Role in this plan |
|---|---|
| `c308a8cf` Draft tailored outreach messages | The approved 10-stage integrated design; this plan implements it |
| `ba9769af` Content agent: find fit clients | Client config of the shared fit-finder engine |
| `b7dcb608` Content agent: find platforms to appear on | Platform config of the shared engine |
| `659b50f0` Unified follow-up tracking ("Follow-ups" tab) | Post-send state machine + GUI surface |
| `30772ba1` Growth via borrowed audiences | Strategy umbrella; Phase 3 produces the target list it wants |

---

## 1. Assessment of the approved design

The 10-stage design on c308a8cf (PROFILE → SOURCE → RESEARCH → QUALIFY+PITCH → DECISION GATE →
DRAFT → REVIEW → LOCK → REUSE VIA /atomize → FOLLOW-UP TRACKING) is sound and should be kept
as-is. What it gets right, verified against the codebase:

- **One shared engine, two configs (client / platform).** Correct — the stages are identical;
  only the fit profile, evidence taxonomy, and output framing differ. Nothing in the repo pushes
  toward two implementations.
- **Subscription-only end to end.** The `claude-cli` subprocess pattern already exists in this
  repo (`src/providers/polish/claude-cli.ts`) and JSA's `auto_analyze.py` proves it at real
  company-research depth. No new cost surface.
- **The LOCK → extraction-source mechanic.** This is the strongest idea in the design: only the
  DRAFT step (step 6) ever needs the rule-1 composed-prose exception. Everything after lock is
  extraction-first against Muxin's own approved words, exactly like the rest of Build 1.
  Mechanically it's nearly free: `/atomize <file>` already accepts a file input, so a locked
  message needs only origin-marking frontmatter, not a new ingestion path.
- **Follow-ups as a GUI tab, not a new dashboard; JSA state read locally from SQLite.** Both
  match shipped patterns (Typefully/PostPeer read-only reconciliation; local-first everything).

**Gaps the design left open — closed by this plan:**

1. **No data model.** Where leads live, what a lead file contains, where follow-up state lives.
   Closed in §3.
2. **No dedup memory.** Repeated discovery runs would resurface candidates Muxin already passed
   on. Closed: pass/pursue decisions are permanent state on the lead folder, and discovery
   dedupes against all existing lead folders (see §3, §6 Phase 5).
3. **Rate-limit failure mode designed in, not discovered later.** JSA's own lesson (Claude Max
   5-hour rolling-window limits during batch runs, its plan V14). Closed: per-lead checkpointing —
   every research pass writes its evidence into the lead file incrementally, so a batch that dies
   resumes by skipping leads whose research is already complete; batches are capped per run
   (config knob, default 5); rate-limit detection by exit code/output-size mirrors JSA's fix.
4. **No mechanical enforcement of the two-sided-message rule.** Muxin's requirement: a message
   must name THEIR problem, not just assert shared values. Closed: a drafted message's
   frontmatter must reference at least one evidence item recorded in the lead file plus the
   classification; the validator fails the draft otherwise (§4, `validate` step).
5. **Two open decisions** (handoff format; JSA Level 2 ownership). Recommendations in §2.

---

## 2. Recommendations on the open decisions

### 2a. JSA → content-agents handoff format: **snapshot-on-intake, file-based** — RATIFIED (Muxin, 2026-07-08)

A lead enters the engine as a folder + `lead.md` file, created by `/outreach add`, which accepts
the same input shapes `/atomize` does (a name, a URL, pasted notes). For JSA-sourced candidates,
`/outreach add --from-jsa <company>` reads JSA's `manual_research.db` **read-only** (path from a
`JSA_DB_PATH` env var in `.env`) and copies the minimum into the new lead file: company name,
domain, JSA verdict, per-dimension notes, sources, and the persona/founder_persona narratives.

**Snapshot, don't live-link**: the lead file is self-contained from intake onward, so a JSA
schema change can never break an in-flight lead, and leads Muxin adds by hand (no JSA row) are
first-class rather than a special case. The Follow-ups tab is the only place that reads JSA's DB
live (read-only, for the job-search bucket), and that read is display-only.

This answers c308a8cf's "minimum JSA hands off" question: **company name + domain + JSA verdict +
its reasoning/sources, snapshotted at intake.** Nothing else is required; everything else this
engine needs (turnaround/greenfield evidence) is its own research pass by design.

### 2b. JSA Level 2 Networking ownership: **content-agents owns outreach + follow-up tracking (option b), built pluggable** — RATIFIED (Muxin, 2026-07-08)

Recommendation: option (b) from c308a8cf — content-agents' engine is the single place all four
reason-buckets' outreach and follow-up state lives; JSA hands off Level-1 verdicts only and never
builds its own Level 2 *for Muxin's use*. Reasoning:

- JSA's Level 2 is spec-only ("Early Concept/Brainstorming", unbuilt, verified 2026-07-08 —
  `manual_research.db` holds zero outreach state). Waiting on it blocks the Follow-ups tab
  indefinitely on a roadmap that hasn't started.
- Content-agents is building the tracker anyway for the client + platform buckets. The marginal
  cost of a `jobsearch` bucket value is near zero; a second tracker later would recreate the
  twin-engine problem the shared-engine decision already avoided.
- This does NOT foreclose JSA productizing Level 2 for its *other* users. To keep that door open,
  the tracker is deliberately pluggable: the job-search bucket is just another `bucket` value on
  tracker events, and if JSA ever ships its own tracking, the Follow-ups tab swaps that bucket to
  a read-only pull of JSA state (the same reconciliation shape the GUI already does for
  Typefully/PostPeer) with no change to the other three buckets.

This is a recommendation with JSA-roadmap implications outside this repo — ratified by Muxin
2026-07-08: the Follow-ups tab tracks the jobsearch bucket natively; JSA hands off Level-1
verdicts only. The pluggable design stays (a future JSA product tracker can still swap that
bucket to a read-only pull without touching the other three).

### 2c. JSA values-depth question: **check it in Phase 0, don't block on it; content-agents is the worldview source of truth either way**

The UNVERIFIED flag (how deep JSA's shared-values matching really is) gets a timeboxed Phase 0
look on Muxin's machine: read JSA's actual profile content, record the finding on c308a8cf.
Regardless of the answer, the engine's PROFILE stage reads the worldview from this repo's existing
canonical material (`config/platforms.yaml` `home_brand` + `spin_angles`, `config/voice.yaml`,
essays) — never a copy. If JSA's values layer turns out shallow, the fix is JSA importing this
repo's profile material into its qualifying step (one-way, JSA-side change, out of scope here);
the engine's own qualification never depends on JSA's values scoring either way.

---

## 3. Data model

### Lead folders — `outreach/leads/<kind>-<slug>/`

A new top-level `outreach/` tree, parallel to `content/` and `stories/` (same
folder-per-unit-of-work convention). `<kind>` is `client` or `platform`.

```
outreach/
  leads/
    client-acme-co/
      lead.md              # profile, evidence, classification, pitch report — the lead's whole record
      review-queue.md      # standard 10-column table; outreach-message rows await Muxin here
      messages/
        message-01.md      # drafted message (frontmatter + body); message-02.md for later touches
    platform-lenny-pod/
      ...
```

### `lead.md` schema (frontmatter + structured body)

```yaml
kind: client | platform
name: Acme Co
url: https://acme.co
source: manual | jsa | discovered        # how it entered
jsa_verdict: TARGET                      # only when source: jsa (snapshot)
status: intake | researched | qualified | pursue | passed | drafted | locked
classification: turnaround | greenfield | unclear | disqualified   # client kind
# platform kind instead uses: fit: strong | partial | weak | disqualified
pitch_angle: <one-line suggested angle>  # written at QUALIFY+PITCH; Muxin can override at the gate
```

Body sections (written incrementally by the research pass — this is the checkpointing unit):
`## Profile` (who they are, cited), `## Evidence` (numbered items `E1..En`, each with a source
URL and which taxonomy signal it supports), `## Classification` (verdict + reasoning, "unclear"
is a legal surfaced outcome, never a forced guess), `## Pitch` (the narrative
"why this is worth your time" report Muxin reads cold — mirrors JSA's persona/best_for/watch_out
fields), `## Decision log` (append-only: gate decisions, lock notes, with dates).

**Canonical-state split** (keeps one source of truth per fact): `lead.md` frontmatter owns
pre-send lifecycle state (intake → locked). `data/outreach/tracker.jsonl` owns post-send state
(contacted → done/abandoned). The boundary is the moment Muxin sends a message herself — before
it, the review GUI reads lead folders; after it, the Follow-ups tab reads the tracker.

### `messages/message-NN.md` schema

```yaml
lead: client-acme-co
channel: email | linkedin-dm | contact-form | podcast-pitch
evidence: [E1, E3]        # REQUIRED, ≥1 — the mechanical two-sided guard
classification: turnaround # must match lead.md at draft time
status: draft | approved | locked
locked_at: 2026-07-15      # set by lock; locked text is /atomize-able source
```

Body = the message text, drafted in Muxin's voice (`config/voice.yaml`, em-dash strip and all —
rule 5 fully applies: a human reads this). The validator refuses a message whose `evidence` list
is empty or references ids that don't exist in `lead.md`, or whose classification is
`unclear`/`disqualified` (you don't draft outreach off a non-fit).

### Follow-up tracker — `data/outreach/tracker.jsonl` (committed, append-only)

Same pattern as `data/publish-schedule.jsonl` / `notes-spread-ledger.jsonl`: append-only events,
current state derived by folding. Git-friendly, human-readable, no new storage tech.

```json
{"ts":"2026-07-15T17:00:00Z","lead":"client-acme-co","bucket":"client","event":"contacted","channel":"email","message":"message-01","next":"follow-up if silent","due":"2026-07-22"}
{"ts":"2026-07-20T14:00:00Z","lead":"client-acme-co","bucket":"client","event":"responded","note":"intro call Fri"}
```

- `bucket`: `client | platform | inbound | jobsearch` (the four reason-buckets from 659b50f0).
- `event`: `contacted | responded | no_response | followup_sent | scheduled | done | abandoned |
  re_researched` (the 3B7 shape from JSA's Level 2 PRD, plus a re-research event so an `unclear`
  lead can re-enter the pipeline when new evidence appears).
- Follow-up timing windows are config per bucket (client vs platform vs job-search cadences
  differ) — `config/outreach.yaml`, not hardcoded.
- The `jobsearch` bucket per §2b: native events if Muxin ratifies option (b); swapped to a
  read-only JSA pull if she picks (a). The `inbound` bucket is fed by db22283f
  (inbound listening) when that lands — schema supports it from day one, nothing else waits on it.

### Config

```
config/outreach.yaml          # knobs: batch cap per run (default 5), follow-up windows per bucket,
                              # abandon threshold, JSA_DB_PATH env name, channels list
config/outreach/clients.md    # client fit profile: turnaround/greenfield/disqualifying evidence
                              # taxonomy (verbatim from c308a8cf step 2) + the HARD qualifier
                              # (open to changing their mind) from ba9769af
config/outreach/platforms.md  # platform fit profile: topic overlap, audience reality check,
                              # values, guest-friendliness/pitch-path, recency (active ≤90 days)
```

Fit profiles are prose markdown (Claude-judgment rubrics, like `config/pillars.yaml`'s role),
editable by Muxin without code changes. The worldview itself is REFERENCED from
`config/platforms.yaml` (`home_brand`, `spin_angles`) and `config/voice.yaml`, never duplicated.

---

## 4. File/module layout

```
src/outreach/
  intake.ts        # outreach:add — scaffold lead folder from name|url|notes; --from-jsa snapshot import
  jsa.ts           # read-only manual_research.db reader (better-sqlite3, readonly:true), behind JSA_DB_PATH
  research.ts      # outreach:research — assemble evidence-pass prompt from fit profile + worldview refs,
                   # run claude-cli subprocess (web search at research time), write ## Evidence/## Profile
                   # into lead.md incrementally (checkpoint unit); rate-limit detect + backoff (JSA V14 lesson)
  qualify.ts       # deterministic half of QUALIFY: evidence completeness check, classification legality,
                   # writes frontmatter status transitions. (The judgment half — the actual classify +
                   # pitch narrative — is Claude inline in the /outreach skill, per repo convention:
                   # scripts do deterministic work, Claude does judgment.)
  draft.ts         # outreach:draft — compose message via claude-cli with voice.yaml guards; writes
                   # messages/message-NN.md + appends the review-queue.md row
  validate.ts      # outreach:validate — em-dash/AI-tell strip check, evidence-reference guard (two-sided
                   # rule), classification legality, frontmatter shape. Mirrors src/atomize/validate.ts's role
  lock.ts          # outreach:lock — approved → locked; stamps locked_at; appends Decision log; the locked
                   # file is now legal /atomize source (origin frontmatter marks it for tag-source)
  tracker.ts       # append/fold tracker.jsonl; due-date + overdue computation; summary for /strategy
  discover.ts      # Phase 5 — web-search candidate discovery per fit profile; dedupes against ALL
                   # existing lead folders (any status) before surfacing anything

.claude/skills/outreach/SKILL.md    # /outreach add|research|qualify|draft|lock|discover|status
                                    # references/clients.md + references/platforms.md walkthroughs

src/review/  (extensions, no new server)
  rows.ts          # scan outreach/leads/*/review-queue.md alongside content/*/ (root list, not new code path)
  serve.ts         # approve semantics for outreach-message rows: Approve = lock (calls lock.ts),
                   # NOT publishText — nothing schedules, nothing sends, Muxin sends manually
  page.ts          # new "Follow-ups" tab: fold tracker.jsonl, render per-row who/bucket/why (locked
                   # core-message angle)/last touch/next action + due; actions: mark-responded,
                   # draft-follow-up (enqueues /outreach via the existing job queue), move-on.
                   # Anti-patterns per 659b50f0: no CRM aesthetics, no guilt-styling on overdue,
                   # "move on" reads as closing a chapter
```

`package.json` scripts: `outreach:add | outreach:research | outreach:draft | outreach:validate |
outreach:lock | outreach:status | outreach:discover` — same `tsx src/outreach/*.ts` pattern as
every other lane.

**What is deliberately NOT built:** any send path. No email integration, no DM automation, no
browser-agent posting of messages. Muxin sends every message herself, on every channel, in v1 and
until she explicitly asks otherwise. This is the rule-2 analog for outreach and it's structural
(no code exists to send), not just policy.

---

## 5. The 10 approved stages, mapped

| # | Stage (c308a8cf) | Where it runs |
|---|---|---|
| 1 | PROFILE | `config/outreach/*.md` fit profiles + worldview refs from `platforms.yaml`/`voice.yaml` |
| 2 | SOURCE | `/outreach add` (manual/JSA snapshot) now; `discover.ts` in Phase 5 |
| 3 | RESEARCH | `research.ts` → claude-cli subprocess with web search; cited evidence into `lead.md` |
| 4 | QUALIFY + PITCH | `qualify.ts` (deterministic) + Claude-in-skill (classification + pitch narrative) |
| 5 | DECISION GATE | Muxin reads `## Pitch` (GUI lead view or the file), sets pursue/passed + optional angle |
| 6 | DRAFT | `draft.ts` — the ONE rule-1-exception step; voice.yaml enforced; two-sided guard |
| 7 | REVIEW | `review-queue.md` row in the lead folder, surfaced in the existing GUI Review tab |
| 8 | LOCK | Approve in GUI → `lock.ts`; locked text = the lead's core message |
| 9 | REUSE VIA /atomize | locked `message-NN.md` is a legal `/atomize <file>` source; follow-ups are Spin reframes of locked text, extraction-first |
| 10 | FOLLOW-UP TRACKING | `tracker.jsonl` + Follow-ups tab; windows per bucket from `config/outreach.yaml` |

The platform config differs only at stages 1 (fit profile), 4 (fit verdict instead of
turnaround/greenfield; pitch angle aligned to the per-channel positioning from `spin_angles`),
and 6 (message is a guest/feature pitch, channel `podcast-pitch`/`email`). Same code, different
config — the shared-engine promise holds concretely.

---

## 6. Build sequencing

Each phase is one backlog card → one PR. **Every phase except 0 and 4 touches
content-generation logic (research/qualify/draft prompts decide what messages say), so those PRs
HOLD for Muxin's review per CLAUDE.md rule 7.** Phase 4 is GUI/state plumbing and auto-merges on
green CI.

**Phase 0 — Discovery spike (Muxin's machine, ~half a day, no PR needed)**
Verify JSA profile depth (§2c) and record the finding on c308a8cf; confirm `JSA_DB_PATH` and that
read-only better-sqlite3 access works; Muxin seeds 3–5 real candidate clients + 3–5 platforms as
the Phase 1/3 test set. Output: notes on the backlog cards, `.env` entry.

**Phase 1 — Engine core + client config, seeded leads only (ba9769af, first slice)**
`intake.ts`, `jsa.ts`, `research.ts` (checkpointed), `qualify.ts`, `validate.ts` (lead-shape
half), `config/outreach.yaml` + `clients.md`, `/outreach` skill (add/research/qualify/status),
GUI reads lead review-queues. Definition of done: Muxin runs `/outreach add` on a seeded company
and gets a cited, classified pitch report she can judge cold; "unclear" demonstrably surfaces as
unclear on at least one thin-evidence lead. **No discovery, no drafting yet** — this validates
research quality, the riskiest judgment surface, before anything composes prose.

**Phase 2 — Decision gate → draft → lock → /atomize reuse (c308a8cf core)**
`draft.ts`, `validate.ts` (message half: two-sided guard), `lock.ts`, GUI approve-equals-lock
semantics, locked-message-as-/atomize-source frontmatter + `tag-source` origin value. Definition
of done: one seeded lead goes gate → draft → Muxin edits/approves in GUI → locked; `/atomize`
accepts the locked file and its derivatives trace `source_lines` to it.

**Phase 3 — Platform config (b7dcb608) + borrowed-audience target list (feeds 30772ba1)**
`config/outreach/platforms.md`, platform walkthrough in the skill, pitch-angle alignment to
`spin_angles`, and `outreach:status --targets` — a rendered target-list summary of platform-kind
leads that `/strategy` includes in the weekly brief (the "maintain a target list" action seed
from 30772ba1, which stays a strategy card and needs no build of its own).

**Phase 4 — Follow-ups tab + tracker (659b50f0)**
`tracker.ts`, tab in `page.ts`/`serve.ts`, follow-up windows in config, jobsearch bucket per the
§2b decision (native or read-only JSA pull — pluggable either way), draft-follow-up action
enqueueing `/outreach` through the existing GUI job queue (follow-up drafts are Spin reframes of
locked text, extraction-first, per stage 9). The inbound bucket ships schema-ready but empty
until db22283f lands.

**Phase 5 — Discovery + batch hardening (ba9769af/b7dcb608 completion)**
`discover.ts` (web-search sourcing per fit profile, dedup against all lead folders), batch caps +
rate-limit backoff exercised for real (this is where multi-lead sittings actually happen).
Deliberately last: seeded leads prove the qualify/draft pipeline first; discovery quality is the
least verifiable stage and benefits from months of Muxin's pursue/pass decisions as a
calibration record. Pull it earlier only if Phase 1–3 throughput runs dry of seeded candidates.

Sequencing rationale in one line: **value lands at every phase boundary** — after Phase 1 Muxin
gets research reports, after 2 she's sending real messages, after 3 she's pitching podcasts,
after 4 nothing falls through the cracks, after 5 the top of the funnel fills itself.

---

## 7. Guardrails (restated as build requirements)

- **Rule 1:** composition happens ONLY in `draft.ts` (stage 6), same carve-out posture as video
  scripts and Build 2 — legal only because Muxin reviews every message before anything leaves.
  Follow-up touches after lock are extraction-first reframes of the locked text.
- **Rule 2 analog:** no send path exists in the codebase. Approve means lock, never transmit.
- **Rule 5:** messages are Muxin's voice — `config/voice.yaml` enforced by `validate.ts`,
  em dashes stripped, read-aloud test applies. Pitch reports (Muxin-facing, internal) follow
  plain clear prose, not the brand voice rules.
- **Rule 6:** subscription-only. All research/drafting via `claude -p` subprocess (existing
  pattern); `better-sqlite3` readonly for JSA; zero new paid APIs, zero OpenRouter in this lane.
- **Rule 7:** research/qualify/draft prompt logic = content-generation logic → those PRs hold
  for Muxin. Lead files, messages, tracker events = generated content/state → auto-merge.
- **Research ethics:** public footprint only. No scraping behind logins, no contact-info
  harvesting beyond a public email/contact form/pitch page, no Glassdoor/Blind quotes presented
  as fact (they're signals, cited as such in evidence items).

## 8. What Muxin ratifies before Phase 1 starts

1. §2a handoff format (snapshot-on-intake via `--from-jsa`). **RATIFIED 2026-07-08.**
2. §2b tracker ownership (content-agents owns all four buckets; JSA hands off Level-1 only).
   Has JSA roadmap implications — her call; Phases 1–3 proceed regardless. **RATIFIED 2026-07-08.**
3. The Phase 0 seed list (3–5 clients + 3–5 platforms from her own head/JSA TARGETs).
   **STILL PENDING — the only remaining input.** Muxin supplies names, or Phase 0 pulls
   TARGET-verdict companies from `manual_research.db` via the ratified `--from-jsa` path.
4. This plan's phase ordering (specifically: discovery last). **RATIFIED 2026-07-08.**
