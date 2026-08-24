# Content Studio UI and UX review brief

This brief is for a product-design review of the current Content Studio against the original
prototype. The original prototype is the visual reference. The current application is the real
repository-backed implementation. The fixture panel is development tooling and is not part of the
product experience.

## Product intent

The primary workflow should be simple:

1. I open one large, quiet writing space.
2. I paste or write anything: an idea, essay, note, URL, voice transcript, or question.
3. The system identifies where it belongs and tells me what it chose.
4. The relevant room becomes the workspace for that item. I should not have to understand the
   internal pipeline.
5. I can ask for a clean-up version, a hook/template version, or both. I can choose whether to
   keep one or both versions.
6. The system can create the appropriate media versions for social distribution.
7. Everything stops for my review before publishing or sending.

My words and the system's proposals must remain visually distinct. The system must never imply
that a draft is live when it is only approved, queued, or ready for me.

## Important test-mode warning

`npm run review:fixtures` adds a red fixture banner and a dark fixture panel. The panel lets a
developer force fake API responses so empty, loading, blocked, failed, and delivery states can be
reviewed before real data exists. It is not intended to be visible to a normal user. Fixture mode
also refuses every write and does not run real model jobs.

To evaluate the normal product surface, run `npm run review` instead. The server is local-only at
`http://localhost:4600`.

## Original reference

The original handoff is in `Venture Build v7.dc.html` with `support.js` beside it. It presents a
single walnut-and-paper desk, a quiet top room navigation, one conversation-like room at a time,
and a bottom-right Dev key for exploring states. Its top-level rooms are Studio, Venture, Content,
Outreach, Fiction, and Signals. The current application additionally exposes Charles as its own
room because the repository contains a separate Charles workflow.

The original vision document describes the mental model as one conversation. It calls for five
conceptual rooms, although the prototype itself has six top-level rooms. The current UI should be
judged against the interaction model and visual language, not treated as free permission to add
every backend state to the main surface.

## Current rooms and responsibilities

### Studio

- One capture textarea for arbitrary input.
- Routing verdict that identifies the destination room.
- Direct handoff to the director or direct formatting.
- Substack Notes browsing and selection.
- Mixed "needs your judgment" queue.
- Team/job status, logs, elapsed time, blocked questions, failures, retry, and stop states.

### Content

- Content source list and source provenance.
- Routing and fit basis.
- Advisor or director workbench.
- Core message cuts before platform formatting.
- Per-platform treatment and reuse windows.
- Review queue with text, image, video, and storyboard previews.
- Revise, duplicate, and storyboard actions.

### Outreach

- Client, platform, content-example, and follow-up concepts.
- Cited lead dossiers and matchmaker read: why them, why me, why mutual fit.
- Directed first drafts, revisions, locked messages, and follow-up tracking.
- Scout discovery using Claude or Grok. Scout never sends anything.

### Fiction

- Series and chapter selection.
- Story bible and canon documents.
- Beats input and scene drafting.
- Second pass and chapter review.
- Continuity findings classified as conflicts or holds.
- Safe one-line canon fixes when a replacement is unambiguous.
- Chapter approval gate.

### Charles

- Persona brief.
- Draft a post from a topic or URL.
- Draft review, revision, discard, and approval states.

### Venture

- Venture selection and intake interview.
- Durable intake guardrail fields.
- Phase ledger, decisions, artifacts, checkpoints, evidence, and delivery state.
- Engine analysis that should be read-only.
- One validated draft step that stops at the next human gate.
- Retraction and failed delivery states.

### Signals

- Strategy brief and research files.
- Analytics outcome families.
- Measured versus insufficient data states.
- Insights and questions to the selected engine.
- Refresh and adopt or decline adjustment flows.

## Full fixture state inventory

These are the state scenarios currently represented in `src/review/fixtures.ts`. They are test
coverage, not a recommendation that all of these should be visible at once.

### Job state

- queued
- running
- blocked while waiting for an answer
- blocked after an answer was recorded
- failed and retryable
- done
- stopped by the user

Jobs also carry a room, engine, label, measured elapsed time, step list, current step, last output
line, log path, failure text, retryability, and optional user question/options.

### Job by room

- Content running job
- Outreach Scout running job
- Fiction running job
- Signals running job
- Charles running job
- Venture job mapping is not yet represented in the fixture panel

### Fiction

- no beats saved
- beats saved but no chapter exists
- scene drafted from beats

The real workflow also needs empty, loading, failed, blocked, continuity conflict, continuity
hold, fixable conflict, unfixable conflict, revised scene, and approval-waiting states.

### Content wizard

- every fit basis at once
- no routing file, so no fit call
- source exists with no drafts yet
- treatment read fails

The content data model includes source text, source kind, provenance, routing, fit basis, cuts,
advisor recommendations, selected cut, platform treatments, hooks, templates, clean versions,
media/storyboard outputs, reuse windows, review rows, and publish readiness.

### Signals

- all four outcome families with their measured, insufficient, and unmeasured states
- no live platform data yet
- research capture never ran

The system tracks reach, engagement, downstream action, qualified opportunity, source dates,
sample sufficiency, confidence, and proposed adjustments. It must not turn missing data into zero.

### Venture

- decision waiting on the user
- checkpoint one row short
- confirm-live and report-failed forms
- checkpoint with mixed proof types
- phase 3 gate closed at zero
- user's draft beside a rewritten draft
- retracted post retaining its evidence

Venture state includes phases, phase status, intake answers, decisions, candidate selections,
decision reasons, artifacts, editorial status, delivery status, evidence type, checkpoint counts,
blocking reasons, retractions, and failure reports.

### Global empty and reset states

- empty Content
- empty Studio
- empty Outreach
- empty Fiction
- empty Signals
- empty Charles
- cold start with every route empty
- reset fixture overrides and return to the underlying data

## Engine choices

The current implementation exposes Claude, Grok, and GPT through Codex for most model-backed
actions. A selected engine should reach the job runner and be visible in job provenance.

Scout currently supports Claude and Grok only because the discovery flow relies on the web-search
adapter. Fiction continuity now has an engine selector. The preferred engine is remembered as a
last choice, while every action can still override it.

## Safety and approval model

- Fixture mode refuses every non-GET request.
- Normal mode writes real drafts, reports, queues, and decisions.
- No outreach message is sent automatically.
- Publishing or scheduling actions require explicit approval and must not be triggered during a
  read-only design review.
- Approved and live are separate states.

## Main design questions for Gemini

1. How should the Studio capture screen become the dominant, calm entry point?
2. Which controls belong in the first view, and which belong only after the system routes the
   idea into a room?
3. How should I choose clean-up, hooks/templates, both versions, and media without seeing the
   pipeline's internal vocabulary?
4. Which job states should appear inline in the active room, and which should remain in a compact
   Studio activity drawer?
5. How should the six or seven room concepts be presented without making the app feel like an
   operations dashboard?
6. What should empty, loading, blocked, failed, completed, approved, queued, live, and retracted
   states say to a non-technical person?
7. Which current controls or labels should be removed, renamed, collapsed, or deferred?
8. Can you propose a revised screen hierarchy that preserves the original prototype's walnut desk,
   paper, serif-versus-sans voice distinction, and one-conversation mental model?

## Files included with this brief

The accompanying bundle includes the original prototype and support file, the vision and backend
handoffs, this brief, and the current implementation sources that define the UI, routes, job
states, fixture scenarios, engine dispatch, Venture thread, Fiction continuity, and tests.

