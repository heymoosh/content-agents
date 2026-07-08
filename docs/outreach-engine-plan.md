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
                              # abandon threshold, JSA_DB_PATH env name, channels list, mid-tail
                              # size bands + research search budget (§9/§10)
config/outreach/clients.md    # client fit profile: turnaround/greenfield/disqualifying evidence
                              # taxonomy (verbatim from c308a8cf step 2) + the HARD qualifier
                              # (open to changing their mind) from ba9769af
config/outreach/platforms.md  # platform fit profile: topic overlap, audience reality check,
                              # values, guest-friendliness/pitch-path, recency (active ≤90 days)
config/outreach/worldview-map.md  # 10–20 belief statements distilled from Muxin's essays, each
                              # with paraphrase variants per community dialect — the query-
                              # generation source for discovery (§9). Refreshed suggest-only,
                              # same posture as angle-refresh; Muxin approves changes.
config/outreach/anchors.md    # Muxin-seeded people/orgs she already trusts (e.g. Audrey Tang,
                              # the Collective Intelligence Project) — the seeds for anchor-graph
                              # expansion (§9). Grows as pursued leads lock; every entry carries
                              # a one-line "why this anchor" note.
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
Phase 1 build requirements from §9/§10: the quote-required worldview match (a values claim in a
pitch report must quote the candidate's own words with a link, or classify unclear), the
disconfirmation pass, the closed-checklist research prompt with per-signal search budget and
hard subprocess timeout, `--from-jsa` bulk-refusal, and the per-run research log line.

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
`discover.ts` built to the §9 discovery methodology (worldview-map query generation, anchor-graph
expansion, mid-tail size bands, lens rotation, pass-reason anti-examples — NOT naive keyword
search), dedup against all lead folders, batch caps + rate-limit backoff exercised for real
(this is where multi-lead sittings actually happen). Deliberately last: seeded leads prove the
qualify/draft pipeline first; discovery quality is the least verifiable stage and benefits from
months of Muxin's pursue/pass decisions as a calibration record. Pull it earlier only if
Phase 1–3 throughput runs dry of seeded candidates. The worldview-map and anchors config files
land earlier (Phase 1) since qualify scores against the map from day one.

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
   Anchor seeds for §9 count too (first two on file from Muxin, 2026-07-08: Audrey Tang, the
   Collective Intelligence Project).
4. This plan's phase ordering (specifically: discovery last). **RATIFIED 2026-07-08.**

---

## 9. Discovery methodology (how SOURCE finds worldview matches) — added 2026-07-08, approved by Muxin

Approved direction (Muxin, 2026-07-08) with two refinements folded in: (a) never rely on literal
phrase matching — feed the search process from a belief map, not a keyword list; (b) generalize
the recommendation-graph idea to every graph an anchor sits in, for platforms AND client-people.

### 9a. Why naive search fails here

"Shares my worldview" is not a searchable attribute; it's latent. Generic category queries
("best AI/product podcasts", "AI startups") return whoever owns the SEO — the same hot list
everyone is pitching. And Muxin's own distinctive phrases won't recur verbatim in other people's
writing, so dumb keyword search on essay quotes misses too. Two mechanisms replace both.

### 9b. The worldview map: beliefs × dialects × modality, queries generated per run

`config/outreach/worldview-map.md` distills Muxin's essays into 10–20 belief statements (e.g.
"automating an unexamined process entrenches its flaws", "product failure usually traces to an
untested assumption, not bad execution", "AI tooling is designed inside a bubble the other 96%
don't live in"). For each belief, the map lists paraphrase variants in the dialects different
communities actually use — the same idea is "paving the cowpath" to practitioners,
"sociotechnical systems" / "algorithmic accountability" to academics, "value lock-in" to the
AI-safety crowd, "digital democracy" / "participatory design" to civic tech, "Conway's law
shipping the org chart" to org-design people.

Discovery queries are **generated fresh each run** by Claude from (one belief) × (one dialect) ×
(one modality: episode-level podcast search, newsletter search, founder-post search) — never a
static phrase list. Claude is the query-expansion engine; that's what feeds the search process.
The map itself refreshes on the angle-refresh rhythm (suggest-only, Muxin approves edits), and
belief/dialect slices are rotated across runs (§9e) so successive runs probe different cells of
the matrix instead of re-running the same searches.

A second query family: **named anchors as proxies**. Worldview-adjacent people cite the same
books, thinkers, frameworks, and orgs. Searching who cites/discusses an anchor (a book like
Seeing Like a State, a person like Audrey Tang, a framework like plurality/collective
intelligence) surfaces belief-holders whose own vocabulary matches none of Muxin's phrases.

### 9c. Anchor-graph expansion (the recommendation-graph idea, generalized)

`config/outreach/anchors.md` holds people/orgs Muxin already trusts. Discovery expands each
anchor 1–2 hops along every public graph it sits in, then scores every node found against the
worldview map before anything is surfaced:

- **Co-appearance graph:** podcasts/panels/conferences that featured the anchor → those shows are
  themselves platform candidates (they've proven appetite for exactly these themes), and their
  other guests are candidate people/anchors.
- **Collaboration/citation graph:** co-authors, project contributors, partner orgs, advisors;
  funders' other grantees.
- **Engagement graph:** who the anchor publicly follows/boosts/recommends (Substack
  recommendations, Bluesky/Mastodon follows) — the original Substack-graph idea, applied to
  every network with public follow/recommend data.
- **Alumni graph (client-people):** people who worked at values-aligned orgs and now lead
  product/strategy elsewhere are warm client-person leads — the values fit travels with the
  person, and their new employer inherits a decision-maker who already shares the worldview.

Worked example (Muxin's own seed, 2026-07-08): **Audrey Tang + the Collective Intelligence
Project.** Co-appearance: every podcast/conference that hosted Tang is a platform candidate, and
its co-panelists/other guests enter the pool. Collaboration: the Plurality book's open-source
contributor network; CIP's co-founders, research collaborators, partner orgs, and the adjacent
org cluster (RadicalxChange, Metagov, New_ Public, vTaiwan/g0v community, plurality institutes);
each org's team pages and event speaker lists. Engagement: who Tang and CIP's researchers boost
and recommend. Alumni: ex-CIP/g0v/civic-tech people now in product roles at startups — client-
person leads with the worldview already on board. Every pursued lead that locks becomes a new
anchor, so the frontier compounds instead of re-searching flat.

### 9d. Client discovery targets PEOPLE, not companies

A company's public voice is marketing; a person's is a worldview trail. The richest client seam
is reflective founder/exec writing: postmortems, "what I got wrong" essays, podcast appearances
saying "we spent a year building the wrong thing" — one artifact that proves worldview match,
fit situation (turnaround), and the HARD qualifier (openness to changing their mind)
simultaneously. Job-post language analysis ("founding PM", "help us figure out what to build"
vs "execute our roadmap") is the secondary seam. Once db22283f (inbound listening) lands,
people already engaging with Muxin's content are a third, pre-qualified seam. The company a
person leads is researched AFTER the person qualifies, not before.

### 9e. Anti-convergence: never the same list twice

1. **Dedup ledger is a hard exclusion** — every candidate ever surfaced (pursued or passed) is
   excluded from future runs; run N+1 starts past run N's frontier by construction.
2. **Lens rotation** — each run is assigned one modality + one worldview-map slice + one anchor
   subset (logged in the run log), so the engine never quietly reverts to generic queries.
3. **Mid-tail size bands as disqualifiers** (config knobs): podcasts ≳50k listeners, newsletters
   ≳50k subs, companies past Series B or on current hype lists are downgraded/excluded — everyone
   is vying for them and Muxin can hand-add a big name herself; the engine exists for the
   mid-tail she'd never have time to scan.
4. **Pass-reasons as anti-examples** — Muxin's pass decisions (with one-line reasons, from the
   lead Decision logs) are fed into the discovery prompt as negative few-shots so lookalikes of
   rejected leads stop surfacing.

### 9f. Match verification before anything reaches Muxin

- **Quote-required worldview match:** a values-fit claim in a pitch report must quote the
  candidate's own words (with link) demonstrating the shared belief — the qualification analog
  of `source_lines`. No quote → classify unclear, never "seems aligned".
- **Disconfirmation pass:** qualify explicitly searches for counter-evidence (execution-only
  language, roadmap-locked signals, worldview-opposed statements) and reports what was found or
  not found; the pitch report shows evidence for AND against.
- **Calibration loop:** on the grade-bets rhythm, compare discovery output against Muxin's
  actual pursue/pass record; pursue rate is the precision metric (healthy ≈ 20–40% on platforms,
  lower on clients). A cold streak recalibrates the fit profile/worldview map before another
  discovery run spends the rate-limit window.

## 10. Research anti-churn guards — added 2026-07-08, approved by Muxin

The token/rate-limit exposure lives in the research pass, not intake (intake is a deterministic
SQLite read + file write, zero model calls). Build requirements:

1. **Pull ≠ research.** `outreach:research` is its own explicit command; nothing auto-researches
   on intake. `--from-jsa` with no argument refuses to bulk-import — it requires a company name
   or `--verdict TARGET --limit N`.
2. **Closed-checklist research prompt.** The evidence pass walks the finite signal taxonomy from
   `config/outreach/clients.md`/`platforms.md` — never an open-ended "research this company".
   Per-signal search budget (default 2 searches/signal, config knob); an unfound signal is
   recorded as "no evidence found" and the pass moves on. "Unclear" is a legal terminal verdict,
   so the model is never incentivized to keep digging to force a classification.
3. **Hard subprocess timeout** (5–8 min, config), same pattern as the polish provider's 180s cap.
   A run that hits the wall keeps what it wrote (checkpointing) and stops cleanly.
4. **Batch cap + backoff** (already §1 gap 3): default 5 leads/run; rate-limit detection by exit
   code/output size with backoff, per JSA's V14 lesson. The real currency is Muxin's Claude Max
   5-hour rolling window, not dollars — exhausting it locks her out of every other Claude use.
5. **Run log:** every research/discovery run appends one line (lead/lens, duration, searches
   used, evidence found) to `data/outreach/run-log.jsonl` so churn is visible in a file, not
   discovered at the rate limit.
