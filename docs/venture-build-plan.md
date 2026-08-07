# Venture Build — plan (Build 3, compose-permitted like Fiction)

**Status:** nothing built yet. This is a plan doc for a fresh Claude Code session to scaffold, same role as `docs/outreach-engine-plan.md` and `docs/unified-queue-plan.md` play for their features. Describes desired structure and behavior only — no code included on purpose.

**Revision note:** a Codex review of the first draft found it not implementation-ready — a false "reuse `src/publish/*` unedited" claim (Typefully can't post to Substack), no schema for non-post deliverables (landing pages, surveys, emails), the composition exception missing from root `CLAUDE.md`, "approved" vs "published" vs "live" conflated, an undefined response-gate data model, non-idempotent checkpoints, and verification limited to typechecking. This revision resolves those: two of the original open questions are now locked-in decisions (Phase 1's publish path, the landing-page destination), and the schema/state-machine/idempotency gaps are specified below instead of left implicit. What's still genuinely open is in **Open questions** at the bottom.

**Source of truth for the actual phase logic:** `Personal Obsidian/Projects/Monetizing Projects/One-Person Business Engine (Justin Welsh Session).md`. That doc holds the Starter Kit's phases/checkpoints/rules (pulled from the source PDF) plus the real decision logic for every judgment call (platform pick, idea ranking, lead magnet generation and selection, response clustering, problem scoring, product outline, pricing) and the real 25-question intro interview. This plan is about *where that logic runs and how it holds state*, not what the logic is.

**Version this plan was written against:** that note at `sha256:7f8ebc3c369a0a295d9ebad3291dc9fadbdcc8673767d470844d1417966876a8` (772 lines, last modified 2026-08-06). Every claim in this plan and in `docs/venture-schema-contract.md` was checked against that exact version. The note is a live file Muxin edits, so if it has moved on, re-verify before trusting a specific claim here. Each venture stamps its own hash into `canon.md` at kickoff (see §E.1) for the same reason: a decision made in Phase 3 should stay traceable to the rules as they read at the time. When scaffolding, read that doc first — but see the "distilled rules spec" guardrail below before wiring phase scripts directly to it.

## Why this build, and why it can't be Atomize

Muxin wants to run a 14-day phased process (intro interview → Attention → Audience → Offer → Operations) to bootstrap a new solo venture — starting with a civic tech / Substack newsletter. Each phase composes original content from scratch (post ideas, lead magnet copy, landing page copy, a product outline, a price), guided by an interview and, later, real audience responses. That's fundamentally different from `/atomize`, whose entire job is extracting and trimming Muxin's own already-written sentences (CLAUDE.md rule 1) — there's no source essay to extract from here.

The repo already has the answer for "a build that composes instead of extracts": **Build 2, Fiction.** Its `stories/CLAUDE.md` wall states the same tension explicitly — composition is allowed *only because every output is reviewed and approved by Muxin before anything ships*, and it's walled off so the exception never bleeds into Builds 0/1. This build (call it Build 3 for now) is the same pattern applied to venture-building instead of serialized fiction: its own wall, its own consistency files, review-gated like everything else, and it hands finished, approved output to the *existing* publish mechanisms rather than building a second one.

## What already exists (reuse, do NOT rebuild)

- **The review app** — `npm run review` (`src/review/serve.ts`, `studio.ts`, `develop.ts`, `jobs.ts`, `rows.ts`). This is the actual answer to "I want a web interface to track phases and keep things in sync" — it already renders a queue/job/studio view. New work is adding a row type/schema and a status view for venture phases, not building a UI from nothing — but see Section D, the current schema can't represent this build's deliverables as-is.
- **Review-gated publish, via two separate delivery mechanisms** — `review-queue.md` rows set to `approve`/`revise`/`discard`, `/publish` acting only on `approve` rows. Text posts on x/linkedin/bluesky schedule via Typefully (`TEXT_PLATFORMS` in `src/publish/typefully.ts` — x, linkedin, bluesky only, no Substack). Substack itself has no publish API, so CLAUDE.md rule 3 already covers it with two fallbacks instead: a constrained browser agent for Notes only (`src/publish/substack.ts`), and the `ready-to-paste/` convention for anything the agent can't do (full essays). Phase 1 hands off to the Substack side of this, not Typefully — see Section E for why the original "reuse `src/publish/*` unedited" framing was wrong.
- **Append-only ledger pattern** — `briefs/bets.md` (Build 0) and `canon.md` (Build 2) both work the same way: a running record of locked decisions that later steps read from and never silently overwrite. The venture build needs this shape for locked phase decisions, but fiction's own implementation (`src/fiction/canon.ts`) blindly `appendFileSync`s on every invocation with no duplicate-transition guard — too weak for a multi-phase workflow engine with crash/retry risk. See Model notes for what this build needs instead.
- **The project-skill mechanic** — commands like `/story`, `/atomize`, `/cycle` only exist inside this repo's Claude Code session (`.claude/skills/<name>/`). New skill follows the same shape.
- **Ready-to-paste for Substack** — CLAUDE.md rule 3 already covers Substack (no usable API → constrained browser agent may post Notes only, full essays go out as a `ready-to-paste/` file Muxin pastes in by hand). Phase 1's long-form posts use this path directly, as the primary mechanism — not as a fallback of last resort the way the original draft implied.
- **The voice guard** — `config/voice.yaml`'s em-dash ban and AI-tell checklist. Fiction already proved the pattern for partial reuse (rule 5 doesn't fully apply, but the em-dash ban carries over). Venture Build should do the same: adopt the em-dash ban and general "sounds like a person, not a brand" bar; skip anything that assumes there's a source Muxin already wrote.

## What's new to build

### A. The wall — `venture/CLAUDE.md`, plus a required root `CLAUDE.md` update

This is now two edits, not one. The original plan only scoped the first:

- **`venture/CLAUDE.md`** (new) — parallel to `stories/CLAUDE.md`: this build composes original content and is not bound by extraction-first/`source_lines` tracing; composition is allowed only because every phase has a checkpoint Muxin must clear before the next phase drafts anything; the em-dash ban and AI-tell bar from `config/voice.yaml` still apply; nothing here auto-publishes — finished, approved output hands off to the existing Substack/Typefully mechanisms per Section E. State explicitly what does NOT carry over from `config/voice.yaml` (source_lines tracing, "never compose new claims") — the same explicit way `stories/CLAUDE.md` does it — so a future session can't assume Build 3 is extraction-bound.
- **Root `CLAUDE.md` edit** (new requirement, not in the original plan) — a nested wall under `venture/` doesn't govern `.claude/skills/venture/`, `src/venture/`, or future root-level orchestration; only the root file's own rules do. It needs: Build 3 added to the top-level Builds list next to Build 0/1/2; its composition exception stated explicitly in rule 1, alongside the existing video-script exception; its skill added to the pipeline map table; and the `venture:phaseN` scripts' Claude-judgment prompts (what decides platform pick, idea ranking, problem/outline/pricing) added to rule 7's held-PR list — a change to what those prompts draft is exactly the "logic that decides what content says" rule 7 already holds PRs for.

### B. Consistency model — per-venture state files

Parallel to fiction's `bible.md` / `canon.md` / `characters/*.md`, one folder per venture (`venture/<slug>/`):

- **`intake.md`** — the answers to the 25-question intro interview (who it's for, proof, format, platform, time budget, what it shouldn't become) plus the Day 14 scorecard definition (see Model notes) fixed at kickoff, not invented after the fact. Written once, rarely changes.
- **`canon.md`** — append-only ledger of locked decisions as phases clear their checkpoints: chosen platform mix (+ why), the published Phase 1 posts (with live URLs), chosen lead magnet concept, the Phase 3 response-log AGGREGATE and a redacted synthesis (never raw quotes/identities — those stay in `responses.jsonl`, see below), chosen problem, transformation sentence, product outline, price. Never silently overwritten — but see Model notes for the idempotency gap in how fiction's own canon.ts does this, which this build should not copy as-is.
- **`state.md`** (or frontmatter fields on `canon.md` — open question, unchanged from original) — current phase number, checkpoint status, day tracking. Extend this to hold the editorial/delivery state split and checkpoint event IDs described in Model notes, not just a single "checkpoint pending/cleared" flag.
- **`responses.jsonl`** (new — kept OUT of git, same treatment as `data/analytics.db`) — the Phase 3 response log: one line per response with a stable id, source (survey/DM/comment/email), date, a hash of the respondent (never their raw name/email/handle), an eligibility flag against the target audience, either the exact quote or a redacted version, and an exclusion reason for anything that didn't count (duplicate, ineligible, unverifiable). `canon.md` only ever sees the aggregate count and a redacted synthesis once Phase 3's checkpoint clears.
- **`phase-N-<name>/`** — that phase's working drafts (post ideas, lead magnet copy, landing page copy blocks, product outline), parallel to how `/atomize` produces `content/<slug>/derivatives/`.

### C. Skill + scripts + pipeline

New skill `/venture` (parallel to `/story`):

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| Intake | `/venture new <name>` | `venture:intake` | run the 25-question interview, synthesize into `intake.md`, fix the Day 14 scorecard definition | `venture/<slug>/intake.md` |
| Phase 1 — Attention | `/venture <slug>` | `venture:phase1` | pick the platform mix (long-form Substack essays + Notes — see Section E), generate 10 ideas, rank by reply likelihood, draft the top ideas across both formats (exact split TBD — see Open questions) | `venture/<slug>/phase-1/`, review-queue rows |
| Checkpoint 1 | `/venture <slug> checkpoint` | `venture:checkpoint` | verify every Phase 1 artifact is both editorially `approve`d AND delivery-confirmed live (essay: Muxin-confirmed public URL; Note: browser-agent-confirmed posted) — see Model notes' two-state-machine model | append aggregate + URLs to `canon.md`, unlock Phase 2 |
| Phase 2 — Audience | `/venture <slug>` | `venture:phase2` | generate 5 lead magnet concepts, select one, draft the magnet + landing page copy + welcome email (with embedded survey) + announcement post, targeting humaninference.ai | `venture/<slug>/phase-2/`, review-queue rows |
| Checkpoint 2 | `/venture <slug> checkpoint` | `venture:checkpoint` | verify landing page live on humaninference.ai + welcome email (survey embedded) active — hard-blocked until that site has a working signup form/email capture (see Section E, still an open dependency) | append to `canon.md`, unlock Phase 3 |
| Phase 3 — Offer | `/venture <slug>` | `venture:phase3` | keep posting; once `responses.jsonl` logs ≥20 ELIGIBLE UNIQUE responses (not just 20 pasted-in messages), cluster them, score cost, pick the problem, write the transformation sentence, build the 5–7 section outline, set the price | `venture/<slug>/phase-3/`, review-queue rows |
| Checkpoint 3 | `/venture <slug> checkpoint` | `venture:checkpoint` | hard script gate, scoped to the problem/outline/price steps only (posting continues unblocked) — checks `responses.jsonl`'s eligible-unique count, not a row count anywhere else | append to `canon.md`, unlock Phase 4 |
| Phase 4 — Operations | `/venture <slug>` | `venture:phase4` | daily checklist, automation order, draft thank-you notes, Day 14 review against the scorecard fixed at intake (not invented after the fact) | `venture/<slug>/phase-4/` |
| Status | `/venture <slug> status` | `venture:status` | read-only — print current phase, checkpoint state, what's waiting on Muxin | terminal output |

### D. Review loop / checkpoint gating

The original plan's "venture phase deliverable" row type can't actually work with the queue as it exists: `src/publish/queue.ts`'s `QueueRow` only has `platform`/`format`/`status`/`notes`/`origin` — no way to say a row isn't meant to publish anywhere, or which checkpoint it belongs to. The review app compounds this: `src/review/rows.ts` recognizes exactly five `kind`s (text/image/video/storyboard/outreach-message), discovers rows only from two roots (`content/` and `outreach/leads/`), and `saveDerivative`/`enrich` assume an editable body lives at `derivatives/<id>.md`. Landing-page copy, surveys, welcome emails, a product outline, and thank-you notes don't fit any of that — they'd become rows the app can't render or edit correctly, not harmless new rows.

**The concrete contract for everything in this section — exact field names, enum values, who writes each field, both state machines with their allowed transitions and actors, the per-artifact-kind matrix, evidence shapes, the checkpoint read model the GUI renders, and the legacy-row mapping — is in `docs/venture-schema-contract.md`. Design and build against that document; this section is the summary.**

This build needs the queue schema extended with:

- `artifact_kind` — e.g. `text-post-longform`, `text-post-note`, `landing-page-copy`, `welcome-email`, `survey`, `product-outline`, `price-decision`, `thank-you-note`.
- `publishable` — explicit boolean. Publishers (Typefully, the Substack agent, `ready-to-paste`) must check this is `true`, never infer it from `platform`/`format` the way they do today.
- `checkpoint_id` — which phase checkpoint this row counts toward (e.g. `checkpoint-1`).
- `editorial_status` and `delivery_status` — the two independent state machines from Model notes, replacing the single `status` column for venture rows (existing atomize/outreach rows keep `status` as-is; this is additive, not a breaking rename).
- `evidence` — what proves delivery: a URL, a provider reference, or a human attestation string.

`src/review/rows.ts` needs: the new `artifact_kind`s added to its `Kind` type and `enrich()`; `venture/<slug>/phase-N-*/` added as a third discovery root alongside `CONTENT`/`OUTREACH_LEADS`; and an editable-body path that isn't hardcoded to `derivatives/<id>.md` for venture artifacts. Publishers must require `publishable=true` before acting on a row — not infer it from platform, the way `publishText` currently filters on `TEXT_PLATFORMS` membership alone.

### E. Handoff to publish — two destinations, both decided

**Phase 1 (Substack essays + Notes) does not go through Typefully.** `TEXT_PLATFORMS` is x/linkedin/bluesky only; Substack was never in it, so "reuse `review-queue.md` → `/publish` → Typefully... just sourced from `venture/<slug>/phase-1/`" in the original plan doesn't work — that pipeline can't address Substack at all. Instead, Phase 1 reuses the two mechanisms CLAUDE.md rule 3 already defines: full essays go out as a `ready-to-paste/<file>`, Muxin pastes it into Substack herself, and the checkpoint's delivery evidence is the live URL she confirms back; Notes go through the existing constrained browser agent (`src/publish/substack.ts`), same review-gated as everything else, with the agent's own posted-confirmation as delivery evidence. Both are already-built, already-approved mechanisms — the fix here is which one Phase 1 actually uses, not new publish machinery.

**Landing page + welcome email target humaninference.ai** (Muxin's own site), and the capture layer is **built, not rented** (Muxin, 2026-08-06). Email capture and the survey stay under her own control, on her own domain, rather than depending on a hosted funnel product or Substack's built-in email/survey support — signups are expected from outside Substack entirely, and a rented funnel makes the subscriber list and the copy shape somebody else's schema.

**Open dependency:** humaninference.ai has an About page and no signup form or email capture. Phase 2 cannot produce a working checkpoint deliverable until that exists. This plan doesn't scope building it (a "no code in the plan doc" decision), so it needs to either land as prep work before Phase 2 starts, or become an explicit first sub-step of Phase 2. What it must do is fixed by §E.1 below; what stores the addresses and sends the mail is Open question 3.

### E.1 Phase 2's deliverable shape — pointer, not a copy

**Do not restate the framework here.** The landing-page copy blocks, the welcome email's structure,
the survey question, the lead magnet's shape and the constraints that make one valid all live in the
source note named at the top of this doc. Read them there. A second copy in this repo would drift
from the note the first time either changes, and drift is worse than a lookup.

What belongs here is only what this build decided, which the note cannot tell you:

- **The capture layer is built, not rented** (Muxin, 2026-08-06). No hosted funnel product, and not
  Substack's built-in email/survey. Email capture and the survey stay on Muxin's own domain and
  under her own control; signups are expected from outside Substack entirely, and a rented funnel
  makes both the subscriber list and the copy's shape somebody else's schema.
- **What that layer must do**, derived from the note's delivery shape: render the framework's copy
  blocks, store an email address, deliver a file, send one message, and record one survey answer
  against the respondent. That is the whole requirement, and it is why Open question 3 is a build
  decision rather than a purchase.
- **One caution when reading the note for copy blocks.** It carries two block lists: the framework's
  required set, and a longer one written to line up with a hosted page builder's input fields. Only
  the first is normative. Treat the longer list as a checklist of things a page usually needs, never
  as a schema to conform to — conforming to it would reimport the vendor lock-in this build exists
  to avoid.

**Record which version of the note a venture was built against.** The note is a live file. Stamp its
content hash and date into `canon.md` at kickoff so a decision made in Phase 3 can always be traced
to the rules as they read at the time. That buys reproducibility without duplicating anything.

## Files

- **New:** `venture/CLAUDE.md` (the wall); `venture/<slug>/intake.md`, `canon.md`, `state.md`, `responses.jsonl` (gitignored), `phase-N-*/` (per venture, created at runtime, not authored now); `.claude/skills/venture/` (skill definition); `src/venture/intake.ts`, `phase1.ts`, `phase2.ts`, `phase3.ts`, `phase4.ts`, `checkpoint.ts`, `status.ts` (parallel to `src/fiction/*.ts`); corresponding `venture:*` entries in `package.json` scripts.
- **Edit:** root `CLAUDE.md` (Section A — Build 3 in the builds list, composition exception, pipeline map, rule 7's held-PR list); `src/publish/queue.ts` (the schema fields in Section D); `src/review/rows.ts` / `serve.ts` (new `artifact_kind`s, third discovery root, non-`derivatives/`-path editing, `publishable` gating); `.gitignore` (add `responses.jsonl`, same treatment as `data/analytics.db`); possibly `config/voice.yaml` header comment (note the partial-carryover exception, same as fiction did).
- **Reuse, mostly unedited, but NOT the blanket "`src/publish/*`" the original plan claimed:** `src/publish/substack.ts` (Notes), the `ready-to-paste/` convention, `config/platforms.yaml`'s substack cadence block, `review-queue.md` mechanics. `src/publish/typefully.ts` is not part of Phase 1's path — it would only become relevant if this venture's attention content later fans out to x/linkedin/bluesky too, which isn't in scope yet.

## Model notes / guardrails

- **Editorial and delivery are two separate state machines, not one `status` column.** Editorial: `draft → approved | discarded`. Delivery: `not_applicable | ready → scheduled → live_confirmed | failed`. Checkpoints reference a manifest of required artifact IDs and require evidence appropriate to each: a public URL (Substack essay), an agent-confirmed post (Notes), or an explicit human attestation (anything with no other verifiable trace). This replaces the original plan's "verify all rows are `approve`d" checkpoint criteria, which conflated Muxin's editorial decision with the post actually being live — Typefully in particular flips a row to `published` the moment it creates a *scheduled* draft, which proves nothing about it being publicly live yet.
- **Checkpoint transitions must be idempotent and crash-safe.** Fiction's `canon.ts` blindly appends to `canon.md` on every invocation with no duplicate-transition guard — fine for a human manually locking one chapter at a time, too weak for a scripted multi-phase gate. Use deterministic checkpoint event IDs (e.g. `venture-slug/checkpoint-2`), reject a transition whose id has already been recorded, and order the writes so a crash mid-transition can't leave contradictory state — write the `canon.md` entry first, only flip `state.md`'s phase/checkpoint fields after, so a crash before that second write just looks like "not yet advanced" and is safely re-run. Derive current state from the event ledger where possible instead of trusting a separately-maintained flag.
- **The Phase 3 response gate has a privacy-sensitive data model, not just a count.** Keep `responses.jsonl` out of git entirely (same treatment as `data/analytics.db`) — it can hold raw email/DM/comment text and identifying detail. Each entry redacts identity to a respondent hash, not a name or email. `canon.md` only ever gets the aggregate count plus a redacted synthesis. The ≥20 gate counts ELIGIBLE UNIQUE responses — a script dedupes by respondent hash and checks target-audience eligibility, it does not just count rows or messages pasted in.
- **The gate is scoped to the problem/outline/price steps specifically, not the whole of Phase 3.** The source framework's own restriction is "do not identify the problem, outline the product, or price it until you have enough data" — posting ("keep the engine running") is explicitly allowed to continue in parallel below 20 responses. `venture:checkpoint` should block only those three steps.
- **Version a distilled rules spec inside the repo instead of reading the live Obsidian note directly.** That note is the runtime source of truth today, which makes builds non-reproducible outside Muxin's machine and vulnerable to silent drift if she edits it later. It also mixes normative rules/scoring rubrics with a worked civic-tech example and a recommended $49 price that the note itself warns must not be pre-selected before real data comes in — feeding the whole thing into Phase 3 risks anchoring on those numbers. Pull the normative rules and format constraints into a versioned `venture/rules.md` (or similar) inside this repo; leave the worked example and unvalidated hypotheses as illustration a phase script doesn't ingest directly. Record which version/hash of that file each venture was built against.
- **The 14-day clock needs more than a day counter.** Track planned phase-day, elapsed calendar day, active-work day, and "blocked waiting on Phase 3 responses" as separate fields. A missed Day 14 should reschedule downstream milestones — it must never silently advance a phase or manufacture validation just to hit the date.
- **"Validated content engine" needs a ship predicate defined at intake, not invented at Day 14.** Fix the scorecard when `intake.md` is written: live post count, qualified views/clicks, opt-in conversion rate, unique eligible response count, a response-quality read (not just the count), and a sustainability check (can Muxin actually keep the daily checklist running). Include explicit failure branches — revise positioning or the lead magnet — not just a path that proceeds straight to product.
- **`npm run check` (typechecking only) is not enough verification for this build.** Stage 0 (`docs/maturity.md`) justifies skipping CI infrastructure, not skipping behavioral tests for safety-critical gates. At minimum, add tests for: allowed/rejected editorial and delivery state transitions; checkpoint idempotency, including an interrupted write between the `canon.md` and `state.md` steps; response eligibility and dedup logic; venture-root discovery and path-traversal safety (mirrors the slug-injection guard `safeFolder` already has in `rows.ts`); non-`publishable` artifacts being excluded from every publish path; and compatibility with legacy queue rows that carry none of the new schema fields.
- **One venture at a time is fine for v1.** Multiple concurrent `venture/<slug>/` folders should work structurally (same pattern as multiple `stories/<slug>/` series) but don't need to be a design target until there's a second venture.

## Open questions

1. **Name for the build and the first venture's slug.** "Build 3" and `venture/` are placeholders in this doc. What does Muxin want to call the civic tech venture itself (the slug used for `venture/<slug>/`)?
2. **State format: plain markdown files (fiction's approach) vs. a couple of SQLite rows (Build 0/1's approach).** Venture state is low-volume and read by a human as often as by scripts, which argues for markdown like fiction. Recommend markdown; confirm before scaffolding.
3. **How do we build the capture layer on humaninference.ai?** DECIDED (Muxin, 2026-08-06): built, not rented -- no hosted funnel product, and not Substack's built-in email/survey. What it must do is fully specified in E.1 (render the copy blocks, store an email, deliver a file, send one message, record one survey answer per respondent). What remains open is the implementation: what stores subscribers, what actually sends mail from the domain, and whether that lands as prep work before Phase 2 or as its explicit first sub-step. It is a prerequisite for Checkpoint 2 either way.
4. **Phase 1's exact format split.** "Long-form Substack essays and Notes" is decided (Section E); the count/ratio isn't — the original plan assumed exactly 3 posts, all one format. How many of each, and does Checkpoint 1 require every one of them live, or a minimum subset?

## Related

- `Personal Obsidian/Projects/Monetizing Projects/One-Person Business Engine (Justin Welsh Session).md` — source of truth for all phase reasoning, the 25-question intake, and the worked civic-tech/Substack example (platform pick, 10 ranked ideas, ideas 2/5/6/8/9 already selected for Phase 1 drafting). See the "distilled rules spec" guardrail above before wiring phase scripts to read this directly.
- `stories/CLAUDE.md` — the architectural precedent this plan copies (compose-permitted build, walled off, review-gated).
- `CLAUDE.md` rule 1 — the extraction-first rule this build is explicitly exempted from, same exemption shape as Build 2. Rule 3 — the Substack browser-automation/ready-to-paste fallbacks Phase 1 reuses. Rule 7 — the held-PR policy Build 3's phase-drafting logic needs adding to (Section A).
- `docs/outreach-engine-plan.md`, `docs/unified-queue-plan.md` — format precedent for this plan doc.
