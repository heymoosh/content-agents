# Content Studio master status

**Last reconciled:** 2026-08-31
**Repository baseline:** merged `origin/main` commit `10e678e` (PR #419), plus the Phase 4
cross-system learning patch recorded by the current branch until its review PR merges. PR #419
contains the audited Phase 3 Experiment implementation; the current patch closes the measured
Signals-to-Venture decision and artifact boundary.
**Phase 0 status:** operational provenance and policy wiring are complete with deterministic browser
coverage, and one authenticated Codex generation canary passed; authenticated provider canaries remain.
**Phase 1 status:** repository implementation and deterministic verification are complete for durable capture and
safe next actions, advisor-cut enforcement, seven staged media pipelines, normalized delivery and
reconciliation, one locked operational data root, the gated Postiz-first/Typefully-fallback canary
matrix, and reviewed Signals apply/rollback. Operational acceptance is still open because the
authenticated Postiz-first/Typefully-fallback lifecycle matrix has not run. A read-only discovery
attempt on 2026-08-30 reached the configured `localhost:4007` address but the Postiz instance was
not running, so it changed no provider state and proved no live capability.
**Generation review:** Muxin approved the treatment, editor, voice, CTA, and distribution behavior
shown in `docs/reviews/content-studio-phase1-generation-review.html`. The artifact contains eight Luna and eight Grok
source-grounded treatments of Muxin's essay plus eight before/after examples from a blind Luna
cold-feed editor that saw no source context and grounded each opening for a reader scanning
unrelated topics. The untreated control remains byte-for-byte exact; treated
posts must make a standalone point, cite supporting source lines, strip footnote syntax, capitalize
after colons, pass the voice gate, and attach the canonical essay CTA with platform-aware placement.
This approved behavior is locked by the root policy, `/atomize` instructions, runtime validation,
and deterministic tests.
**Distribution recommendations:** the Content treatment read now derives cold-start platform and
media defaults from the source's topic, length, structure, and source kind, with a visible reason
for every preselection. The evaluator covers every configured downstream text, visual, and video destination;
it does not recommend reposting to the source channel itself (for example, a Substack essay or Note back to Substack).
Video-first recommendations name and preselect the required short-video asset, and final delivery remains gated
by discovered provider capabilities. Existing routing and measured performance remain stronger evidence. The
three-source review is `docs/reviews/source-distribution-recommendations-review.html`.
**CTA default:** a real canonical essay, chapter, or other long-form published source is now the
default CTA for every derivative and cannot be displaced by automatic content-type lead routing.
Substack Notes are deliberately excluded: they are complete short-form objects and never link
back to their own Note URL.
With no canonical source, a promotional destination must already exist and be explicitly reviewed
as high-fit and high-value; otherwise the resolver emits no forced link and never invents a lead
magnet or substitutes a generic homepage.
**Provider-cost update:** Studio edits already route Claude, Grok, and GPT/Codex through local
subscription CLIs. Grok prose now uses the subscription CLI, transcription uses local whisper.cpp,
and unattended image generation is disabled; reviewed Codex-generated image files are the preferred
art path through Studio's reviewed-file attachment step. OpenRouter remains temporarily for Kling video interpolation only while Wan 2.2
is evaluated locally; HunyuanVideo 1.5 is not a fit for this Apple-Silicon machine.
**Verification status:** the subscription-backed Grok prose adapter completed a live nonempty
canary at zero reported cost; provider-policy, Studio scheduling, Content capture, all seven media
stage contracts, durable runtime state, provider reconciliation, and Signals apply/rollback are
covered locally. The Postiz adapter and attended canary harness exist, but the configured local
instance was offline during the latest read-only discovery attempt. Publishing remains live-unverified
until Postiz capability discovery and the attended create/read/cancel/reconcile matrix pass.
**Purpose:** one current answer to what Content Studio is meant to do, what is actually wired,
what has been verified, and what remains.

## Authority and update rule

This is the master **implementation-status and current-decision** document. It records the
current implementation truth and resolved product decisions. It does not replace the product
and safety authorities below:

1. Current product direction: `docs/Muxin's Vision for Content Studio.md`. This is the newer
   product-direction document and supersedes older wording where a later explicit decision differs.
2. Foundational product principles and detailed UX intent: `docs/content-studio-vision.md`.
   It remains authoritative except where superseded by the newer vision or a later explicit decision.
3. Repository safety: root `CLAUDE.md` and `AGENTS.md`.
4. Domain behavior: `stories/AGENTS.md`, `venture/AGENTS.md`, `venture/rules.md`,
   `venture/rules.yaml`, `docs/venture-schema-contract.md`, and `charles/AGENTS.md`.
5. Typed target contracts: `docs/content-system-contracts.md` and
   `docs/content-system-blueprint.md`.
6. Current implementation status, resolved implementation decisions, and remaining scope:
   **this file**.
7. Work index and historical record: `docs/content-agents-backlog.md` and
   `docs/content-agents-backlog.archive.md`. The backlog is not a second status specification.

Any merge that changes a product decision, runtime capability, provider, verification level, or
known gap must update this file in the same PR. Point-in-time handoffs and audits remain useful
history, but they do not override this file's current-state statements.

## Status vocabulary

| Status | Meaning |
|---|---|
| Live verified | Exercised against the real external system or real authenticated account under an explicit safety gate. |
| Deterministic tested | Implemented and covered by unit, integration, CLI, or disposable-browser tests without a live provider/model dependency. |
| Provider unverified | Provider integration exists, but its current authenticated create/list/cancel/delivery lifecycle has not been canary-tested. |
| Partially wired | Real pieces exist, but the user-visible end-to-end contract is incomplete. |
| Scaffold only | Types, projections, or read-only adapters exist without a production write path. |
| Not implemented | No production implementation exists. |
| Intentionally manual | The latest decision is that the system stops and Muxin performs the external action. |
| Blocked for safety | Code exists, but it must not be treated as complete or enabled broadly until the named safety boundary is fixed. |

File existence is not completion. Unit tests do not prove an authenticated provider accepted an
operation. A scheduled item is not a confirmed published item. A typed scaffold is not a wired
product flow.

## Executive truth

The repository has a substantial backend, not just a UI. It has durable content folders, review
queues, Venture's four-phase state machine, Fiction drafting and continuity tools, Charles's
persona workflow, Outreach dossiers and follow-ups, analytics and Signals reads, a shared job
queue, publishing adapters, and a shared scheduler.

PR #404 reorganized the product surface. PR #406 added publishing-state tracking, Venture-to-
Content handoff, Signals decisions, Outreach tracking improvements, durable Content requests,
and engine boundaries. PR #407 added Fiction passage editing and review history plus Charles
status views, prose-only editing, and retry-safe review notes.

Merged PR #412 closes the four Phase 0 safety boundaries with deterministic coverage:
configured Muxin-voice generation is constrained within an approved source/cut boundary; Fiction
and Charles handoffs preserve their approved body and domain restrictions; delivery resolves origin
to a fail-closed brand/account policy; and a disposable injected-engine Chromium pass now drives
the real configured-generation GUI flow. A bounded
authenticated Codex CLI generation canary passed in a throwaway repository copy; no authenticated
provider lifecycle canary is claimed. A read-only authenticated Substack saved-session check also
passed, proving login readiness but not create/list/cancel or live delivery.

The system is **not operationally verified end to end**. The largest unresolved boundaries are:

1. The authenticated Postiz-first/Typefully-fallback create/read/cancel/reconcile matrix has not
   run. The configured Postiz instance was offline at the latest read-only discovery attempt.
2. Provider reconciliation records explicit `uncertain` evidence instead of guessing when an API
   cannot prove a terminal state. Typefully and YouTube list absence is not terminal proof, and
   Substack still needs provider or reviewed human evidence.
3. Media pipelines are deterministically wired behind approval gates, including a safe reviewed-file
   attachment path for attended Codex image and carousel files. Paid/authenticated provider renders
   and delivery paths remain live-unverified.
4. The newer Experiment/pattern architecture contains many useful typed contracts, but much of it remains
   scaffolded or partially connected to live generation, review, delivery, and outcomes.
5. Provider credentials and non-secret account bindings are configured locally, but credentials
   alone are not lifecycle evidence and must not be described as a successful canary.

## Studio and Content

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Global Studio shell | One global room bar; each room has a small local view menu; persistent references live in the right rail. | Seven rooms are implemented: Studio, Venture, Content, Outreach, Fiction, Charles, Signals. PR #404. | Deterministic tested in DOM and Chromium fixture passes. | `src/review/page.ts` remains a very large generated HTML/JS module. Keep room labels and supporting documentation synchronized with the seven-room model. |
| Studio capture | One front door accepts a thought or link, identifies the destination, explains it, and starts the next safe step. | `studio-capture-v1` records are repository-owned under the operational data root, locked, idempotent, and restart-safe. The current classifier has four actionable destinations: Content reserves and starts one durable advisor job; Fiction, Outreach, and Venture open the existing room-owned human gate with the saved capture visible. It does not claim to route directly to Charles or Signals. | Deterministic cross-process, crash-recovery, route, and browser/UI coverage for those four destinations. | Add Charles and Signals only after each has a room-owned safe capture action; until then the global bar is not evidence of direct seven-room classification. |
| Advisor and cuts | Muxin supplies substance; the advisor proposes lens/CTA choices; Muxin edits message-level cuts before formatting. | `/develop`, recommendation rounds, deterministic accept/dismiss, cuts, and cut comments exist. Content configuration re-reads the authoritative approved cut and refuses missing, dismissed, mismatched, ambiguous, malformed, or uncited cut provenance before formatting. | Deterministic unit, persistence, and authorization coverage; authenticated model calls remain nondeterministic. | Repeat the authenticated model canary when the advisor engine adapter changes. |
| Content configuration | The system recommends treatments, media, and destinations; Muxin accepts or overrides rather than constructing the plan from scratch. | Durable `content-request.json` now persists validated source or approved-cut provenance, treatment/media/platform selections, untreated controls, recommendations, and grouped input-request filters. The working-tree merge path preserves the authoritative provenance/context rather than accepting client replacement. | Deterministic request, persistence, and UI coverage. | Current UI makes Muxin choose the matrix directly. Real recommendation evidence is blocked or generic until reviewed mechanism data exists. |
| Configured text generation | The untreated control is byte-exact. Approved treatments may re-hook, reorder, trim, clarify, and add connective structure within cited source boundaries; every generated item remains pending review and preserves provenance. | Human Inference/Studio generation requires authoritative `source_lines`, materially applies the selected treatment, then runs a blind cold-feed editor that sees only the finished drafts and sharpens topic grounding for a rapidly context-switching reader. Voice validation rejects AI tells, dashes, footnote syntax, and lowercase prose after colons. Canonical long-form sources get a CTA; Substack Notes never self-link. | Deterministic prompt/parser/provenance/editor/voice/CTA/output coverage, a disposable injected-engine Chromium pass through the real GUI save-and-generate flow, reviewed Luna and Grok comparison artifacts, and one bounded authenticated Codex CLI generation canary in a throwaway repository copy. | Keep provenance enforcement and human review fail-closed while reconnecting advisor/cut review. Repeat authenticated canaries when engine adapters change. |
| Media generation | Requested media should invoke the relevant text/script, review, render, and asset pipeline. Paid steps remain explicit. | All seven configured choices create a source-bound, inspectable stage; require explicit digest-bound approval; dispatch to the production renderer/provider; verify the created assets and cost; checkpoint promotion; and update the review row without double-rendering after a promotion failure. Image and carousel stages also accept attended Codex files already placed inside the content folder, validate regular nonempty nonsymlink image files and matching image signatures, enforce the approved image count, preserve the supplied positional slide order, reject contradictory numbered filenames, copy files to canonical output paths, and use the same manifest/promotion checkpoint. | Deterministic registry, plan, approval, tamper, reviewed-file safety, renderer-injection, asset-verification, promotion-retry, and no-double-billing coverage for quote still, animated quote, image, carousel, short video, caption package, and audiogram. | Authenticated/paid provider renders remain live-unverified. Attended Codex images are now supported through the reviewed-file workflow. |
| Content review | Group by original request; edit directly; comment/revise; approve explicitly; keep publishing status separate. | Searchable request filter, direct derivative editor, revise notes/engine, bulk selection, approval, and four-step Content views exist. PRs #404/#406. | Strong unit/UI coverage. | Add a disposable-browser pass for Content direct edit, grouped approval, and injected provider outcomes. Clarify in UI that approval currently attempts scheduling immediately. |
| Cross-room Content handoffs | Venture, Fiction, and Charles reuse one Content workflow while retaining source identity, voice/canon rules, CTA ownership, and delivery policy. | Typed idempotent handoff contracts and routes exist for all three. The working tree requires and persists Fiction's approved promotion body plus locked passages/canon/provenance restrictions, and Charles's approved post body plus persona/CTA/manual-delivery restrictions. Fiction/Charles configured generation permits only an untreated control copied from that approved body and records context/restriction references; any treated variant fails closed before a job or write. Venture retains its scoped composition exception: treated variants use an approved Venture artifact, `claim_refs`, `config/voice.yaml`, and the no-invented-proof constraint. | Deterministic unit, persistence, route, generation-policy, and Venture prompt/parser coverage. The disposable Chromium pass directly proves Fiction treatment refusal before a job or derivative write. | Add broader cross-room browser scenarios for approved-body/restriction display and Venture composition. Fiction remains provider-blocked until it has a separate configured account; Charles remains manual by decision. |

## Models, jobs, and runtime safety

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Engine selection | Choose per run. Prefer subscription/free routes. Claude, Grok, and GPT/Codex use their installed subscription CLIs; reserve Grok for deliberate cross-family work. Stop GPT-OSS experiments unless Muxin explicitly reopens them. | Claude, Grok, Codex, and restricted local-engine dispatch exist across supported actions; availability and engine provenance are exposed. PR #406. | Extensive argv/domain/UI tests; real multi-engine jobs remain nondeterministic and unverified end to end. | Mark GPT-OSS paused in product choices, not available merely because Ollama reports a model. Stamp Fiction draft and continuity outputs with engine provenance consistently. |
| Shared job queue | One bounded lane, real elapsed time, logs, stop/retry, blocked questions, engine attribution, artifact-based success. | One serialized lane persists durable job summaries under the operational data root, uses a cross-process execution lease, and recovers abandoned queued/running work fail-closed as nonretryable instead of silently replaying a possibly non-idempotent model call. | Strong unit, cross-process, stale-lock, restart-recovery, and deterministic browser coverage. | Recovery deliberately does not resume an interrupted model call. A future resumable engine contract would need artifact checkpoints and engine-specific idempotency. |
| Approval boundary | Generation never implies approval; no delivery without explicit approval. | Review queues and Muxin-only Venture/Fiction/Charles gates are enforced in domain code. | Strong deterministic tests. | Provider and cross-brand integration must continue to fail closed while the account/policy gaps above remain. |

## Publishing and delivery

### Provider matrix

Postiz is the canonical social publishing infrastructure and the primary target path. A
self-hosted Postiz instance is the default path for destinations and media it currently supports.
The available destination/media matrix must come from that instance rather than from an assumed
universal capability list. Typefully remains a working fallback and must not be removed until the
Postiz path is implemented and verified. Provider-specific or manual paths remain exceptions where
Postiz does not support the required destination or capability.

| Destination | Current provider/path | State | What is still unverified or missing |
|---|---|---|---|
| X, LinkedIn, Bluesky, Mastodon, Threads text | Self-hosted Postiz when live discovery advertises the exact account/destination/media capability; Typefully scheduled drafts only after an explicit unsupported result | Postiz and Typefully adapters deterministic-tested; both provider-unverified | Start the configured Postiz instance and run the attended Postiz-first matrix. Verify Typefully fallback in the same matrix before any migration or removal. |
| X, LinkedIn, Bluesky quote cards | Postiz when live discovery advertises media upload for the exact account/destination; native Typefully image drafts only after an explicit unsupported result | Postiz and Typefully media paths deterministic-tested; both provider-unverified | Verify Postiz media registration/create/read/cancel and retain the Typefully image fallback until its own lifecycle passes. |
| TikTok | Postiz when live discovery advertises TikTok/video; otherwise the explicit PostPeer exception | Capability-first selection implemented; providers unverified | Discover the connected Postiz capability first. If unsupported, verify PostPeer schedule/list/cancel live. |
| YouTube Shorts | Postiz when live discovery advertises YouTube/video; otherwise the explicit YouTube Data API exception, private until `publishAt` | Capability-first selection implemented; providers unverified | Discover Postiz first. If unsupported, verify OAuth upload, scheduled-public transition, final URL, and terminal reconciliation for YouTube. |
| Substack Notes | Constrained saved-session browser automation | Provider unverified | Run an explicitly approved canary; maintain selectors; add independent live confirmation. Full essays remain manual. |
| Community/manual destinations | `ready-to-paste/` | Intentionally manual | Surface the handoff and status in the Studio consistently. |
| Postiz | Self-hosted Postiz | **Implemented and deterministic-tested; provider unverified** | The adapter, environment contract, dynamic capability/account registry, Studio scheduling path, stable provider IDs, create/read/cancel/reconcile lifecycle, recovery ledger, gated canary, and fallback matrix exist. The configured local instance was offline at the latest discovery attempt; start it and pass the attended matrix before changing the working fallback. |
| Outreach email/Gmail | **Target:** send from the Content Agents GUI through the connected email account after explicit approval; **current fallback:** manual/external send with a “sent elsewhere” record | **Not implemented** for GUI sending; manual fallback currently available | Add authenticated send, success/failure reconciliation, and automatic sent-state updates. Keep manual/external sending for unsupported channels such as LinkedIn DMs. |

### Scheduler and publishing status

| Capability | Current state | Verification | Remaining work |
|---|---|---|---|
| Unified scheduler | `src/publish/slots.ts`, configuration, publish ledger, durable jobs, captures, provider status, and reconciliation health all resolve through `CONTENT_AGENTS_DATA_ROOT` (defaulting outside the checkout). File locks and execution leases serialize cross-process mutation; startup recovery fails abandoned non-idempotent work closed. | Strong deterministic PT/DST, migration, cross-process, stale-lock, lease, and restart-recovery tests. | Operational backup/retention for the external data root remains an installation concern, not a second checkout-local authority. |
| Publish orchestration | Studio approval discovers the live Postiz account/capability registry first and chooses Postiz only for exact advertised support. A verified unsupported result permits the explicit Typefully/PostPeer/YouTube/manual fallback. Human Inference/Venture require exact non-secret account assertions, Fiction fails closed without a separate account, Charles is ready-to-paste, and missing/ambiguous origins are blocked at scheduler and adapter boundaries. | Deterministic policy, discovery, capability-first selection, scheduler, adapter, fallback, and mocked lifecycle coverage; no authenticated lifecycle pass. | Start Postiz and run the attended matrix. Do not treat discovery transport failure as unsupported, and do not remove Typefully before its fallback canary passes. |
| Publishing status | Append-only normalized events record atomic claims, provider/account/object IDs, provider URLs, planned and observed timestamps, policy identity, uncertainty, human evidence, and delivered/deleted/canceled/failed/private/uncertain outcomes. A bounded reconciler runs under one cross-process lease and persists last-run health. | Strong deterministic unit, cross-process, runner-wiring, all-state normalization, human-evidence, and no-blind-retry coverage; no authenticated provider verification. | APIs that cannot prove terminal state remain explicitly `uncertain`. Run authenticated provider lifecycles and retain reviewed human evidence for providers without authoritative reads. |

## Venture

Venture is substantially implemented in backend code. `docs/venture-build-plan.md` is design
history and its “nothing built yet” statement is obsolete.

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| State authority and gates | `canon.md` is authority; decisions/artifacts are append-only; all selections, approvals, live confirmations, and checkpoints are hard Muxin-only predicates. Phase 4 ends in a Day-14 human decision, not checkpoint 4. | Implemented across `src/venture/`, `venture/AGENTS.md`, rules, and schema contract. | Extensive phase/state/CLI tests. | Keep the master and root scan docs synchronized with runtime predicates. |
| Intake and Phase 1 Attention | 25-question intake, fixed scorecard, reviewed research plan, platform decision, 10 ideas, exactly 3 selected probes, approvals/live evidence, research-read continuation decision. | Implemented. | Unit/CLI plus disposable-browser intake/autosave/commit. | Run a real venture through model-produced plan/ideas/drafts and real delivery evidence. |
| Phase 2 Audience | Select lead magnet, draft magnet and landing-page copy, review existing survey, draft welcome email, optional announcement. External capture/survey already exist. | Implemented as composition and gates. No Venture-specific email provider is built. | Unit/CLI tests. | Installation, capture, Venture email delivery, and live confirmation remain manual/outside the repo. Content Studio Outreach email is tracked separately below. |
| Phase 3 Offer | Privacy-preserving response intake, 20 minimum/30 target gate, clusters, problem and transformation decisions, outline, price/format, price decision, checkpoint 3. | Implemented. | Strong tests plus browser response/artifact writes. | Survey response ingestion is manual; no external survey/email connector. Real-volume analysis remains operationally unverified. |
| Phase 4 Operations | Time-budget choice, approved operating plan, manual thank-yous, approved Day-14 facts, final explicit decision. | Implemented. | Unit/CLI tests. | No real Day-14 run yet. Thank-you delivery remains manual by design. |
| Venture Studio UI | Work/Documents/Intake and guardrails/History, decision and artifact actions, response intake, evidence, pace/checkpoint, one engine-owned next step. | Implemented across Venture review modules. | Deterministic UI and browser write coverage. | No GUI `deliver` action/retry flow. Real model step and Substack delivery remain provider-unverified. |
| Venture to Content | Approved primary Phase-1 post/note can idempotently become a normal Content source without claiming it went live. | Implemented in PR #406. | Unit/route coverage. | Decide whether the Venture artifact should record a queued handoff state. Downstream Content generation/media gaps still apply. |

## Outreach

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Fit lifecycle | Source/add, cited research, qualify, pursue/pass, editable draft, lock, approved send, per-person follow-ups. Poor fits never advance. | Implemented for client/platform flows with JSA read-only integration and matchmaker reads. | Extensive deterministic tests; selected historic real research exists. | Model-generated first draft/revision remains unverified end to end. GUI delivery remains incomplete. |
| Matchmaker read | Show why them, why Muxin, and why now before the yes/no choice. | Implemented and surfaced. | Unit/UI coverage. | Keep sources and current direction editable and visible. |
| Discovery | Bounded cited scouting with caps and honest downgrade. | A smaller `/scout` implementation exists. | Parser/budget/unit tests; live Scout is unverified. | **Partially wired.** The ratified Phase 5 anchor graph, rolling lens state, fuzzy permanent frontier, pass-reason learning, calibration loop, and rate-limit behavior are not complete. Keep Phase 5 open. |
| Contact selection | Muxin can use extracted contacts or add one manually. | Implemented manual/research-extracted path. | UI/unit coverage. | Automated contact discovery and public-email harvesting are not implemented. |
| Draft, edit, lock | Direction input, engine choice, direct edit, revise with model, validation, immutable lock. | Implemented. | Unit/route/UI coverage. | Add deterministic injected-engine browser coverage for draft/revise. |
| Send | Send a locked message from the Content Agents GUI through the connected email account after Muxin's explicit approval; retain manual/external sending for unsupported channels such as LinkedIn DMs. | **Not implemented** for Gmail GUI sending; no Gmail UI or send route. Manual/external “sent elsewhere” recording remains available. | Browser coverage verifies the manual fallback and approval boundary. | Add authenticated send, provider success/failure reconciliation, and automatic sent-state updates. Keep the fallback for unsupported channels. |
| Follow-ups | Append-only per-person clocks with origin context; client/platform/inbound/job-search buckets; mark sent/responded/move on; no guilt styling. | Implemented. | Strong tests and browser tracker write coverage. | Drafting support is limited for buckets without lead folders. Actual delivery remains external. Weekly Strategy summary integration remains open. |
| Outreach to Content | Locked outreach can become extraction-first Content source. | Existing reuse path. | Deterministic tests around source/lock boundaries. | Exclude cold B2B outreach derivatives from resonance metrics until the open strategy decision is implemented. |

## Fiction

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Co-creation surface | Write next accepts beats; Review drafts supports scene review, continuity, direct passage edits, and notes; Promotion is separate; canon stays in the rail. | Implemented through PRs #404/#406/#407. | Strong unit/route tests and real disposable-Chromium exact-passage edit/history pass. | Model drafting/repass and continuity model calls remain unverified end to end. |
| Final chapter approval | GitHub PR is the final chapter review loop. Surgical comment-driven changes only. Lock updates append-only canon. | Existing `/story` workflow remains authoritative. | Strong deterministic tests; established operational workflow. | No UI bridge that promotes a Studio-created scene into the chapter PR and lock flow. |
| Idea routing | Fiction should accept an idea and decide whether it belongs in world, character, plot, chapter, or imagery while preserving Muxin's wording for non-chapter material. | Not implemented as one conversational inbox. | None end to end. | Build the idea conversation/router, cleanup-without-paraphrase storage, and reviewable writes to the correct canonical document. |
| PR comment engine routing | Muxin may name different engines for individual GitHub comment edits. | Not implemented. | None. | Parse approved PR comments, bind exact spans and requested engine, execute surgically, reply with provenance. |
| Fiction to Content | Approved promotion based on approved/locked chapter may enter Content with fixed Fiction ownership. | Typed handoff exists. The working tree preserves the approved promo body and canon/source restrictions, permits only an untreated control, and records a blocked delivery-policy outcome when no Fiction account is configured. | Deterministic handoff, generation-policy, delivery-policy, and publishing-ledger coverage. | Deterministic safety boundaries are closed. Operational provider delivery remains blocked until Fiction has a separately configured and verified platform/account mapping. |

## Charles

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Persona drafting | One-liner, essay, and reply composed under `charles/config/persona.yaml`; memes stay external; never apply Muxin's voice. | Implemented. | Strong deterministic tests; model drafting unverified end to end. | Preserve leak-bank truthfulness and stamp engine provenance consistently. |
| Review and editing | Input, Needs review, Approved, All; prose-only editor; append-only retry-safe review notes. | Implemented in PR #407. | Disposable Chromium proves prose save, frontmatter preservation, retry deduplication, and reload history. | Review history is local single-process JSONL and silently appears empty on read failure. Add visible health/error state if it becomes operationally important. |
| Persona editing | Muxin wants to update the persona source from the Studio without accidental rewriting. | The persona brief can be read/copied; production persona files are not directly editable in the UI. | Read-only UI coverage. | Add an explicit, reviewable persona-edit workflow that preserves the verbatim brief and treats changes to drafting logic as held for review. |
| Delivery | Charles remains ready-to-paste unless Muxin explicitly approves account automation. | Intentionally manual in `charles/AGENTS.md`. | Policy tests. | No Charles-owned provider/account implementation, by design. |
| Charles to Content | Approved Charles prose can enter Content without inheriting another venture/CTA. | Typed handoff exists. The working tree preserves approved prose and persona restrictions, refuses unsupported treatments, and records manual ready-to-paste delivery as private with no provider account. | Deterministic handoff, generation-policy, delivery-policy, and publishing-ledger coverage. | Deterministic safety boundaries are closed. Delivery remains intentionally manual unless Muxin explicitly changes the policy; no authenticated Charles provider path is claimed. |

## Signals, analytics, patterns, and Experiment

**Resolved architecture decision:** “Experiment” is the user-facing name for the capability
previously called Grow. Existing `src/grow/**`, `grow-*`, and `npm run grow:*` identifiers are
legacy implementation names and may remain until a deliberate migration; they do not define the
product boundary. Signals is the scientific intelligence layer: it reviews ordinary Content
performance and other qualified evidence, separates attention, conversation, audience, and
business outcomes, and recommends the next bounded content-growth experiment when a useful
uncertainty warrants publishing capacity. Experiment is the execution layer: it preserves the
approved hypothesis and lineage, creates controlled variants through the normal Content treatment
and cold-feed-editor path, obtains Muxin's approval, schedules safely, records observations, and
returns results to Signals for interpretation. Experiment does not invent its own rationale or
silently turn every post into a test.

Signals must rank approval-ready experiment proposals by confidence and expected information value,
then spend generation and publishing capacity on the strongest candidates first. Low-confidence
ideas are deferred before generation. A proposal may honestly return no experiment. Confidence is
a prioritization input, never a claim that a treatment has already won.

Experiment has no separate copy-review inbox. Muxin reviews the body-free scientific proposal in
Signals. Approving that plan authorizes creation of an experiment-tagged request through the same
configured Content generator used for ordinary work. The resulting variants receive the normal
treatments, blind cold-feed editor, voice/CTA/platform/media validation, and land as `pending` drafts
in the ordinary Content review queue. Muxin then edits, approves, rejects, and publishes them from
Content exactly like any other draft. Plan approval must not count as copy approval. The normal
Content queue is the sole copy approval authority.

Multiple experiments may be proposed, approved, drafting, running, or awaiting measurement at the
same time. Every request, draft, review row, delivery, provider observation, and outcome retains one
experiment id, allowing Content to show experiment context without becoming a second experiment
system and allowing Signals to group and interpret performance per experiment. Capacity prevents
over-scheduling; it does not impose a global one-experiment lock.

There are two distinct experiment families. A **content-growth experiment** is Signals-owned and
tests a general content, treatment, media, platform, distribution, or audience-growth question.
A **venture-learning experiment** is owned by one named Venture and tests that venture's market,
reader problem, product, offer, or demand hypothesis. Venture surveys belong to the latter: Venture
owns their questions, responses, clustering, interpretation, and phase decisions. Shared Experiment
machinery may provide review, scheduling, attribution, and measurement, but it may not detach a
Venture result from its venture context or reinterpret it as a global content rule. Any learning
crossing between Venture and Signals requires a visible reviewed handoff with provenance, scope,
sample size, an evidence-ladder tier, an honest claim ceiling, and caveats. Signals prioritizes
analytics and patterns; Venture remains the contextual authority for lead-generation, product, offer,
and strategy hypotheses.

Before Muxin can approve any experiment, its review must show: the observation and evidence that
motivated it; the proposed interpretation; a directional, falsifiable hypothesis; why the chosen
input is a valid test; the single controlled variable and held-constant factors; primary success
metric and outcome family; guardrails; sample size or duration; keep/revise/reject decision rule;
confidence and caveats; and why the opportunity is worth the publishing capacity. The proposal is
body-free. After plan approval, candidate copy must pass the same treatments, media/platform
configuration, voice validation, source/CTA rules, and blind cold-feed editor used by ordinary
Content generation before it appears as pending work in Content. A generic claim that a treatment
“may change outcomes” is not an approval-ready hypothesis.

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Analytics and strategy | Keep attention, conversation, audience, and business separate; thin data stays insufficient; no silent routing changes. | Analytics DB, strategy briefs, bets, routing/resonance, and several recommendation layers exist. | Extensive deterministic tests plus historic operational data. | Landing/opt-in/business outcome ingestion remains incomplete; account/brand separation is not complete in the Studio read. |
| Signals decisions | Muxin adopts or declines recommendations; an adopted recommendation may change behavior only through a separate visible review/apply gate. | Adoption creates an exact allowlisted cadence or routing proposal against a configuration digest. Muxin separately approves or rejects it, apply uses a write-ahead intent and conflict guard, restart reconciles an interrupted apply without guessing, and rollback requires the exact applied value plus evidence. Unsupported prose recommendations remain blocked. | Deterministic intent, allowlist, preview, review, apply, conflict, crash-recovery, rollback, append-only audit, concurrency, route, and UI coverage. | Expand the allowlist only with a reviewed typed delta and matching recovery semantics; never turn free-form recommendation prose directly into configuration writes. |
| Per-brand Signals | Human Inference, Charles, and Fiction have separate content, goals, strategy, and accounts. | **P2.4 foundation complete.** Analytics and research rows now carry an explicit canonical brand plus provider-account identity; legacy rows stay visibly unassigned. Signals outcome families and redacted research reads require a brand, isolate latest metrics/audience/research, and preserve measured-vs-unmeasured truth. Bound re-ingest promotes only an explicitly reviewed legacy match, rejects conflicting identities, and provider reconciliation keeps account mismatches uncertain. The Studio exposes a brand selector while clearly labeling briefs, recommendations, and experiments as not yet brand-scoped. Human Inference delivery remains provider-bound, Charles manual, and Fiction blocked. | Deterministic migration, binding, identity-conflict, cross-brand read, audience/research-only, legacy-exclusion, delivery-wall, reconciliation, UI, and browser-switch coverage. | Strategy briefs, recommendations, experiments, platform configuration, and account-level selection within a brand still need their full partition. Existing unassigned history is not auto-attributed; it requires an explicit reviewed migration decision. |
| Pattern evidence | Use reviewed common mechanisms without copying creator-specific prose; evidence and originality remain explicit. | **Phase 2 vertical slice complete.** Corpus, pattern, review metadata, evidence ledgers, mechanism blueprints, and reports/adapters exist. The first real `research-dossier-v2` records Muxin's approval of the bounded evidence and a separate `hypothesis` disposition for the used-to-think/now scaffold. The packet, receipt, caveats, citations, and no-winner boundary remain digest-bound. | Strong deterministic contract/report tests, including forged receipt, partial-approval, unknown-field, tamper, body, winner-claim, and authority failures; the approved real dossier is retained under `docs/reviews/`. | Continue expanding reviewed account metadata, baselines, platform/pool coverage, and the live mechanism ledger without calling the current evidence a winner claim. The first reviewed-evidence-to-Signals recommendation boundary now exists in Phase 3. |
| Experiment lifecycle | Signals ranks and proposes content-growth experiments; Muxin approves plans in Signals; Experiment creates tagged work through the canonical Content generator; Content remains the sole copy-review and publishing surface; Signals later interprets grouped outcomes. Venture owns venture-learning experiments and surveys within one venture's hypothesis chain. | **Phase 3 implementation complete, including the 2026-08-31 cross-family audit corrections.** Signals can evaluate a persisted normal Content request against a digest-bound, Muxin-approved Phase 2 dossier through the wired Claude, Grok, or Codex subscription-CLI seam; the production route records either an honest no-experiment result or a ranked body-free plan. The approval view exposes the full science case and explicitly declared capacity. Generic hypotheses and missing or insufficient capacity fail closed, decline rationale is durable, and the retired legacy Grow CLI can no longer put copy into an approved queue state. Approved plans still use canonical Content generation, concurrent experiment identities, and pending-copy review. The measurement loop matches live provider identities to the latest analytics and attributed outcomes, then presents collecting/ready status and a separately reviewed keep/revise/reject interpretation. No path selects a winner or changes routing automatically. | Red-green tests cover production-route wiring with injected runners, canonical dossier replay, body-free prompts, honest abstention, complete approval evidence, generic-hypothesis rejection, capacity deferral, durable decline rationale, legacy pending-copy behavior, canonical generation, exact provider matching, readiness, and separately reviewed interpretation. The real signed-in CLI spawn and first browser-operated experiment remain operational proofs, not claims made by the deterministic suite. | Exercise one signed-in CLI proposal in the Studio, then run the first approved experiment through publication and data collection. Metrics absent from provider exports remain honestly collecting until explicit attributed rows enter `data/outcomes.jsonl`. Multi-pair operational cadence remains bounded by declared Content capacity and human review. |
| Cross-system learning and Venture handoff | Signals may offer analytics/experiment learning to one named Venture; Venture-native reader responses enter from their existing manually judged intake. Muxin separately reviews every recommendation. | **Phase 4 deterministic implementation complete on the current branch, including the 2026-09-01 audit corrections.** Engagement → attention; qualitative/comments → resonance; surveys → stated-need; directional → directional-comparison; controlled → bounded-comparison; funnel → behavioral-intent; business → observed-demand. Ordinary account-level analytics and redacted comment/reply/DM/email observations are listed from `data/analytics.db` as reviewable Venture learning sources; exact text and respondent hashes never enter the evaluator. Signals remains analytics/pattern prioritization; Venture remains contextual hypothesis authority for lead-generation, product, offer, and strategy. Accepted learning may recommend no-change/change/test without upgrading evidence. Signals-origin adoption creates one internal, non-publishable `signals-input` artifact plus an append-only canon decision; Venture-native surveys/comments/emails/DMs use their existing explicit response-intake judgment instead of a redundant Signals gate. Neither path clears a checkpoint, advances a phase, publishes, selects a winner, changes configuration, or claims demand automatically. Accepted tests flow through the canonical Experiment planner, normal plan approval, canonical Content drafting/review/publishing/measurement, then back to Signals and Venture learning; the normal queue supports multiple experiments. | Deterministic contract, lifecycle, lineage, tier/ceiling, tamper, idempotency, ordinary-engagement intake, redaction, and rules-parity coverage. No operational live proof is claimed until a real reviewed loop is run. | Run one complete reviewed loop with real evidence after operational verification is authorized; preserve deterministic-only status meanwhile. |

## Prioritized remaining work

### P0: safety and truthfulness before broader use

Implemented in the PR #412 change set, with deterministic evidence:

1. Configured Muxin-voice generation enforces approved source/cut provenance, applies only
   source-grounded treatments within cited `source_lines`, and sends treated long-form derivatives
   through the blind cold-feed editor. Missing, mismatched, or out-of-bound references fail closed;
   untreated controls remain byte-exact.
2. Fiction/Charles handoffs preserve the approved body plus canon/persona/provenance/CTA
   restrictions in the durable Content request. Configured generation copies that body only for an
   untreated control and refuses treated variants before starting a job or writing output. Venture
   treated variants remain on their separate approved-artifact composition path, constrained by
   `claim_refs`, `config/voice.yaml`, and the no-invented-proof rule.
3. Delivery applies a versioned origin/brand/account policy at scheduling and provider boundaries.
   Charles is manual ready-to-paste, Fiction is blocked without its own account, Human Inference/
   Venture require exact account assertions, and ambiguous/missing origins are blocked.
4. `POST /api/content/generate` remains blocked by default in browser tests, but a one-run token
   tied to the disposable repository enables a deterministic injected engine for one Chromium pass.
   That pass proves GUI authority, traced pending output, zero external calls, and Fiction treatment
   refusal. Pass E separately inventories only authenticated live CLI execution as nondeterministic.

One bounded authenticated Codex CLI generation canary passed in a throwaway repository copy.
Provider credentials and non-secret provider-account bindings are configured locally, but the
configured Postiz service was offline, so no authenticated provider lifecycle canary ran. Before
operationally broadening delivery, start Postiz and explicitly gate those provider canaries. Do not
treat a working-tree diff or deterministic test as a PR, merge, or live delivery proof. The
read-only `publish:substack -- --check` probe did confirm
that the saved Substack browser session is currently authenticated.

### P1: complete the promised operating loop

Repository implementation and deterministic verification are complete across merged PR #412 and
the current Phase 1 completion patch:

1. Studio capture is durable. Content starts one idempotent advisor job; Fiction, Outreach, and
   Venture open their existing human-gated next step without implying autonomous work.
2. Content configuration requires an authoritative approved cut before treatment formatting.
3. All seven configured media choices have source-bound stages, explicit approval, production
   dispatch, asset verification, promotion checkpoints, and retry-safe deterministic coverage.
4. Provider/account/object IDs and normalized delivered/deleted/canceled/failed/private/uncertain
   evidence persist append-only. Reconciliation never converts absence or transport failure into a
   guessed terminal state.
5. Scheduler, job, capture, publishing, and reconciliation state share one operational data root
   with cross-process locks, leases, migration, and fail-closed restart recovery.
6. Postiz-first discovery, Typefully fallback, explicit provider exceptions, and the attended
   lifecycle matrix are implemented and deterministic-tested.
7. Signals uses separate propose, review, apply, recovery, and rollback events for exact allowlisted
   configuration deltas.

**Remaining Phase 1 acceptance gate:** start the configured Postiz instance, pass read-only live
capability discovery, then run the explicitly approved attended Postiz-first/Typefully-fallback
create/read/cancel/reconcile matrix. The 2026-08-30 discovery attempt failed closed with
`ECONNREFUSED` at `localhost:4007`; it created or changed nothing. Do not label Phase 1 live verified
until the matrix finishes with terminal cleanup for every created canary object.

### P2: complete product depth

1. Finish Fiction's conversational idea router, non-paraphrasing canonical updates, Studio-to-PR
   bridge, and per-comment engine routing.
2. Finish the ratified Outreach Phase 5 discovery/calibration method and weekly Strategy summary.
3. Add a safe Charles persona-edit workflow and keep delivery manual unless the policy changes.
4. Complete the remaining per-brand strategy, platform, and account-selection layers on top of the
   shipped P2.4 analytics/Signals identity foundation. Do not auto-attribute legacy unassigned rows.
5. Populate and review pattern/account/baseline/mechanism evidence, then connect it to honest
   recommendations.
6. Exercise the implemented Experiment and Signals-to-Venture lifecycle with real publication,
   attributed outcome, two-room decisions, and a completed measurement window.

### Recorded product decisions

1. Postiz is the canonical primary social publishing infrastructure. Self-hosted Postiz is the
   default path for capabilities advertised by live discovery. The repository path is implemented;
   authenticated lifecycle verification remains open.
2. Typefully remains the working fallback and must not be removed before Postiz is implemented and
   verified.
3. Outreach email is intended to send from the Content Agents GUI after Muxin's explicit approval.
   Successful sends must update sent state automatically. Manual/external sending remains the
   fallback for unsupported channels.
4. Charles delivery remains ready-to-paste. Do not infer account automation from the existence of
   a Content handoff.

## Known stale or historical documents

These files remain useful sources, but must not be read as current completion ledgers:

- `docs/session-handoff-2026-08-29.md`: recovery-branch snapshot predating PRs #404/#406/#407.
- `docs/content-studio-reset-handoff.md`: redesign starting point, not current status.
- `docs/venture-build-plan.md`: design authority/history with an obsolete “nothing built yet” line.
- `docs/multi-engine-plan.md` and `docs/handoff-multi-engine.md`: say designed/not built even though
  PR #406 implemented most dispatch boundaries; GPT-OSS attempts are now paused.
- `docs/publishing-logic-audit.md`: June snapshot predating current providers, platforms, and
  publishing-status ledger.
- `docs/setup-typefully.md`: stale network count and scheduling description; Typefully remains the
  working fallback while self-hosted Postiz is implemented and verified as primary.
- `docs/unified-queue-plan.md`: valuable original plan, but several gaps later shipped.
- Disposable `e2e/RESULTS.md` reports: point-in-time run artifacts, not cumulative product truth.
- `docs/content-system-blueprint.md` and `docs/content-system-contracts.md`: target contracts and
  scaffold inventory, not proof of integrated runtime behavior.
- `docs/outreach-engine-plan.md`: ratified behavior, but not a live status ledger; its full Phase 5
  remains incomplete despite the smaller `/scout` implementation.

## Source map

- Product intent: `docs/Muxin's Vision for Content Studio.md`, `docs/content-studio-vision.md`
- Pipeline scan: `CLAUDE.md`
- Studio UI/runtime: `src/review/`
- Publishing: `src/publish/`, `config/platforms.yaml`, `config/providers.yaml`
- Content artifacts: `content/`
- Venture: `venture/`, `src/venture/`, `docs/venture-schema-contract.md`
- Outreach: `src/outreach/`, `src/discovery/`, `config/outreach/`, `data/outreach/`
- Fiction: `stories/`, `src/fiction/`, `stories/AGENTS.md`
- Charles: `charles/`, `charles/AGENTS.md`
- Analytics/Signals: `src/db/`, `src/strategy/`, `src/review/signals*.ts`, `briefs/`
- Patterns/Grow contracts: `src/patterns/`, `src/grow/`, `docs/content-system-{blueprint,contracts}.md`
- Work index/history: `docs/content-agents-backlog.md`,
  `docs/content-agents-backlog.archive.md`, `docs/content-studio-program/work.yaml`

## Reconciliation checklist for future updates

Before changing a status in this file:

1. Name the merged commit or PR and the exact production path.
2. State whether evidence is unit, CLI, disposable browser, or authenticated live verification.
3. Confirm the implementation honors the latest product and scoped safety decisions.
4. Distinguish an adapter/type from an integrated write path.
5. Distinguish scheduled/accepted from confirmed live delivery.
6. Update any stale source named above or leave an explicit historical label.
7. Add only the actionable gap to the backlog through `prose_kanban`; keep the full explanation
   here and use the backlog as an index.
