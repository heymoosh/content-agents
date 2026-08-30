# Content Studio master status

**Last reconciled:** 2026-08-30
**Repository baseline:** PR #412 branch `docs/content-studio-master-status-final`, rebased onto
`origin/main` at `06bd00c`, with Phase 0 already landed on `main` and Phase 1 committed on this branch.
**Phase 0 status:** operational provenance and policy wiring are complete with deterministic browser
coverage, and one authenticated Codex generation canary passed; authenticated provider canaries remain.
**Phase 1 status:** implementation and deterministic verification are complete for durable capture and
safe next actions, advisor-cut enforcement, seven staged media pipelines, normalized delivery and
reconciliation, one locked operational data root, the gated Postiz-first/Typefully-fallback canary
matrix, and reviewed Signals apply/rollback; authenticated provider lifecycle canaries remain unrun.
**Generation review:** open `docs/reviews/content-studio-phase1-generation-review.html` for Codex-run
ordinary Content, Venture, cross-room refusal, and all-seven-media examples from a synthetic fixture.
**Provider-cost update:** Studio edits already route Claude, Grok, and GPT/Codex through local
subscription CLIs. Grok prose now uses the subscription CLI, transcription uses local whisper.cpp,
and unattended image generation is disabled; reviewed Codex-generated image files are the preferred
art path until Studio has a reviewed-file attachment step. OpenRouter remains temporarily for Kling video interpolation only while Wan 2.2
is evaluated locally; HunyuanVideo 1.5 is not a fit for this Apple-Silicon machine.
**Verification status:** the subscription-backed Grok prose adapter completed a live nonempty
canary at zero reported cost; provider-policy, Studio scheduling, and Content capture regressions
are covered locally. The Postiz adapter is not ready for a live canary because its account and
capability contract still does not match the self-hosted API, so publishing remains blocked pending
that correction and an attended lifecycle test.
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

The current working tree closes the four Phase 0 safety boundaries with deterministic coverage:
configured Muxin-voice generation is constrained within an approved source/cut boundary; Fiction
and Charles handoffs preserve their approved body and domain restrictions; delivery resolves origin
to a fail-closed brand/account policy; and a disposable injected-engine Chromium pass now drives
the real configured-generation GUI flow. These changes are not yet a PR or merge. A bounded
authenticated Codex CLI generation canary passed in a throwaway repository copy; no authenticated
provider lifecycle canary is claimed. A read-only authenticated Substack saved-session check also
passed, proving login readiness but not create/list/cancel or live delivery.

The system is **not** complete end to end. The largest unresolved boundaries are:

1. Configured media choices produce Markdown rows and declared asset paths, not the requested
   rendered image, carousel, audiogram, or video assets.
2. Publishing records scheduling attempts but does not reliably confirm terminal live delivery
   across providers.
3. Studio capture is browser-local and does not start durable work.
4. Signals adoption records Muxin's decision but does not apply an approved change to system
   behavior.
5. The newer Grow/pattern architecture contains many useful typed contracts, but much of it remains
   scaffolded or partially connected to live generation, review, delivery, and outcomes.
6. Provider delivery lifecycles remain live-unverified because this environment has no provider
   credentials or non-secret account bindings.

## Studio and Content

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Global Studio shell | One global room bar; each room has a small local view menu; persistent references live in the right rail. | Seven rooms are implemented: Studio, Venture, Content, Outreach, Fiction, Charles, Signals. PR #404. | Deterministic tested in DOM and Chromium fixture passes. | `src/review/page.ts` remains a very large generated HTML/JS module. Keep room labels and supporting documentation synchronized with the seven-room model. |
| Studio capture | One front door accepts a thought or link, identifies the destination, explains it, and starts the next safe step. | Classification and a `content-studio.capture-handoff.v1` browser `localStorage` record exist. The target room can display and clear it. | Deterministic browser/UI coverage. | **Partially wired.** The capture is not repository-durable, starts no backend job, and has no real next action in Content. “Start on it” currently overstates the result. |
| Advisor and cuts | Muxin supplies substance; the advisor proposes lens/CTA choices; Muxin edits message-level cuts before formatting. | `/develop`, recommendation rounds, deterministic accept/dismiss, cuts, and cut comments exist. | Deterministic unit coverage; model route not browser-verified. | The advisor/cut path is not the primary current Content cycle. Reconnect it before platform/media formatting. |
| Content configuration | The system recommends treatments, media, and destinations; Muxin accepts or overrides rather than constructing the plan from scratch. | Durable `content-request.json` now persists validated source or approved-cut provenance, treatment/media/platform selections, untreated controls, recommendations, and grouped input-request filters. The working-tree merge path preserves the authoritative provenance/context rather than accepting client replacement. | Deterministic request, persistence, and UI coverage. | Current UI makes Muxin choose the matrix directly. Real recommendation evidence is blocked or generic until reviewed mechanism data exists. |
| Configured text generation | Extraction-first for Muxin's content; every generated item remains pending review and preserves provenance. | In the working tree, Human Inference/Studio generation requires authoritative `source_lines`, resolves them through the established source/cut extractor, accepts only a nonempty engine-selected subset/reordering within the approved boundary, writes the selected `source_lines` to frontmatter, and refuses body/provenance mismatches. The engine selects approved lines; it does not compose treated prose. | Deterministic prompt/parser/provenance/output coverage, a disposable injected-engine Chromium pass through the real GUI save-and-generate flow, and one bounded authenticated Codex CLI generation canary in a throwaway repository copy. | Keep provenance enforcement fail-closed while reconnecting advisor/cut review. Repeat authenticated canaries when engine adapters change. |
| Media generation | Requested media should invoke the relevant text/script, review, render, and asset pipeline. Paid steps remain explicit. | The classic quote-card, image, storyboard/video, captions, TTS, and render subsystems exist. The configured request can name media and declare expected paths. | Classic subsystems have deterministic tests; paid/live paths are gated. | **Partially wired.** Configured image, carousel, audiogram, and video selections do not create the assets. Wire each media type to its real staged pipeline and review gates. |
| Content review | Group by original request; edit directly; comment/revise; approve explicitly; keep publishing status separate. | Searchable request filter, direct derivative editor, revise notes/engine, bulk selection, approval, and four-step Content views exist. PRs #404/#406. | Strong unit/UI coverage. | Add a disposable-browser pass for Content direct edit, grouped approval, and injected provider outcomes. Clarify in UI that approval currently attempts scheduling immediately. |
| Cross-room Content handoffs | Venture, Fiction, and Charles reuse one Content workflow while retaining source identity, voice/canon rules, CTA ownership, and delivery policy. | Typed idempotent handoff contracts and routes exist for all three. The working tree requires and persists Fiction's approved promotion body plus locked passages/canon/provenance restrictions, and Charles's approved post body plus persona/CTA/manual-delivery restrictions. Fiction/Charles configured generation permits only an untreated control copied from that approved body and records context/restriction references; any treated variant fails closed before a job or write. Venture retains its scoped composition exception: treated variants use an approved Venture artifact, `claim_refs`, `config/voice.yaml`, and the no-invented-proof constraint. | Deterministic unit, persistence, route, generation-policy, and Venture prompt/parser coverage. The disposable Chromium pass directly proves Fiction treatment refusal before a job or derivative write. | Add broader cross-room browser scenarios for approved-body/restriction display and Venture composition. Fiction remains provider-blocked until it has a separate configured account; Charles remains manual by decision. |

## Models, jobs, and runtime safety

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Engine selection | Choose per run. Prefer subscription/free routes. Claude, Grok, and GPT/Codex use their installed subscription CLIs; reserve Grok for deliberate cross-family work. Stop GPT-OSS experiments unless Muxin explicitly reopens them. | Claude, Grok, Codex, and restricted local-engine dispatch exist across supported actions; availability and engine provenance are exposed. PR #406. | Extensive argv/domain/UI tests; real multi-engine jobs remain nondeterministic and unverified end to end. | Mark GPT-OSS paused in product choices, not available merely because Ollama reports a model. Stamp Fiction draft and continuity outputs with engine provenance consistently. |
| Shared job queue | One bounded lane, real elapsed time, logs, stop/retry, blocked questions, engine attribution, artifact-based success. | One serialized in-memory queue with persisted logs and visible job state exists. | Strong unit and deterministic browser coverage. | Queue state is memory-only. Restart loses queued/running/blocked jobs, no cross-process global mutex exists, and a killed model may leave partial writes. Add a durable job/event store and recovery contract if restart recovery is promised. |
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
| X, LinkedIn, Bluesky, Mastodon, Threads text | **Target:** self-hosted Postiz; **current fallback:** Typefully scheduled drafts | Postiz **Not implemented**; Typefully provider unverified | Implement and verify the Postiz account/auth/create/list/cancel/reconciliation path. Keep Typefully working and verify its fallback lifecycle before any migration or removal. |
| X, LinkedIn, Bluesky quote cards | **Target:** self-hosted Postiz where supported; **current fallback:** native Typefully image drafts | Postiz **Not implemented**; Typefully provider unverified | Verify Postiz media upload and create/list/cancel. Keep Typefully media fallback available until the Postiz path is verified. |
| TikTok | **Target:** Postiz where supported; **current exception/fallback:** PostPeer upload and scheduled post | Postiz **Not implemented**; PostPeer provider unverified | Confirm whether the connected Postiz instance supports TikTok and the required media. Otherwise verify PostPeer schedule/list/cancel live. |
| YouTube Shorts | **Target:** Postiz where supported; **current exception/fallback:** YouTube Data API, private until `publishAt` | Postiz **Not implemented**; YouTube provider unverified | Confirm Postiz capability first. If unsupported, verify OAuth upload, scheduled-public transition, final URL, and terminal reconciliation for the YouTube path. |
| Substack Notes | Constrained saved-session browser automation | Provider unverified | Run an explicitly approved canary; maintain selectors; add independent live confirmation. Full essays remain manual. |
| Community/manual destinations | `ready-to-paste/` | Intentionally manual | Surface the handoff and status in the Studio consistently. |
| Postiz | Self-hosted Postiz | **Decided primary; Not implemented** | No adapter, environment variables, routes, jobs, account mapping, reconciliation, or tests exist in reachable history. Build the primary path, expose capabilities dynamically, and verify it before changing the working fallback. |
| Outreach email/Gmail | **Target:** send from the Content Agents GUI through the connected email account after explicit approval; **current fallback:** manual/external send with a “sent elsewhere” record | **Not implemented** for GUI sending; manual fallback currently available | Add authenticated send, success/failure reconciliation, and automatic sent-state updates. Keep manual/external sending for unsupported channels such as LinkedIn DMs. |

### Scheduler and publishing status

| Capability | Current state | Verification | Remaining work |
|---|---|---|---|
| Unified scheduler | `src/publish/slots.ts`, `config/platforms.yaml`, and local append-only `data/publish-schedule.jsonl` claim PT/DST-aware slots across streams. | Strong deterministic tests. | The ledger is gitignored and checkout-local. Define one operational data root and cross-process concurrency/recovery behavior. |
| Publish orchestration | Studio approval dispatches through the currently implemented provider paths; Postiz remains the decided but unimplemented primary. The working tree resolves persisted origin before dispatch: Human Inference/Venture require an exact non-secret account assertion matching the credential identity, Fiction fails closed without a separate account, Charles writes ready-to-paste copy, and missing/ambiguous origins are blocked. Publisher adapters also assert the supplied policy at their boundary. | Deterministic policy-matrix, scheduler, adapter, and mocked-provider tests only; Postiz is not implemented and no authenticated provider lifecycle was exercised. | Use the self-hosted Postiz capability/account registry as canonical. Keep Typefully fallback behavior verified during migration. Current Content choices omit supported Mastodon, expose unsupported Instagram generation/delivery, and omit community. Configure and live-verify each asserted account before operational dispatch. |
| Publishing status | Append-only `data/publishing-status.jsonl` records atomic per-row attempts, planned provider/time, retry blocking, uncertainty, and human reconciliation. The working tree also records policy version, origin, brand, delivery mode, provider account ID, and policy reason, including blocked/manual outcomes. | Strong deterministic unit/UI coverage; no authenticated provider verification. | There is no reliable terminal `published/live` ingest across all providers. Distinguish delivered, deleted, canceled, failed, private, and uncertain; persist provider IDs and `published_at`/URL instead of parsing free-text logs. |

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

## Signals, analytics, patterns, and Grow

| Capability | Latest decision | Current state | Verification | Remaining work |
|---|---|---|---|---|
| Analytics and strategy | Keep attention, conversation, audience, and business separate; thin data stays insufficient; no silent routing changes. | Analytics DB, strategy briefs, bets, routing/resonance, and several recommendation layers exist. | Extensive deterministic tests plus historic operational data. | Landing/opt-in/business outcome ingestion remains incomplete; account/brand separation is not complete in the Studio read. |
| Signals decisions | Muxin adopts or declines recommendations; adoption should eventually change system behavior through a visible gate. | PR #406 stores append-only adopt/decline decisions. | Deterministic unit/UI coverage. | **Partially wired.** Adoption records intent only. Build an explicit apply/review step and audit trail before changing config or generation behavior. |
| Per-brand Signals | Human Inference, Charles, and Fiction have separate content, goals, strategy, and accounts. | Source/origin concepts exist in some Content contracts. | Partial domain tests. | No complete brand/account/outcome partition in analytics, Signals, or provider reconciliation. |
| Pattern evidence | Use reviewed common mechanisms without copying creator-specific prose; evidence and originality remain explicit. | Corpus, pattern, review metadata, evidence ledgers, mechanism blueprints, and many reports/adapters exist. PR #405 added mechanism proposals and mad-lib hook frames. | Strong deterministic contract/report tests. | Much of the reviewed account metadata, baseline coverage, platform/pool matrix, and live mechanism ledger remains awaiting human review or scaffolded. Do not call it an integrated recommendation engine yet. |
| Grow lifecycle | Connect source, claim/cut, variant, review, capacity, delivery, outcome, and Venture without auto-approval. | Many typed, side-effect-free records and reconciliation projections exist. | Deterministic contract tests. | **Scaffold/partial.** Connect the lifecycle to live generation, review queue, scheduler/provider facts, comments, funnel events, and business outcomes. |

## Prioritized remaining work

### P0: safety and truthfulness before broader use

Implemented in the current uncommitted working tree, with deterministic evidence:

1. Configured Muxin-voice generation enforces approved source/cut provenance and writes the
   engine-selected nonempty subset/reordering as traceable `source_lines`; missing, mismatched,
   or out-of-bound references fail closed.
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

One bounded authenticated Codex CLI generation canary passed in a throwaway repository copy. No
provider credential or non-secret provider-account binding is available in this environment, so no
authenticated provider lifecycle canary ran. Before operationally broadening delivery, configure
and explicitly gate those provider canaries. Do not treat a working-tree diff or deterministic test
as a PR, merge, or live delivery proof. The read-only `publish:substack -- --check` probe did confirm
that the saved Substack browser session is currently authenticated.

### P1: complete the promised operating loop

1. Make Studio capture durable and make “Start on it” launch the real next safe action.
2. Reconnect advisor/cut review ahead of treatment formatting.
3. Wire configured media choices to actual render pipelines and staged approvals.
4. Persist provider IDs and terminal delivery outcomes; reconcile delivered vs canceled/deleted/
   failed/private/uncertain for every provider.
5. Define one operational scheduler/job data root with cross-process locking and restart recovery.
6. Add gated live canaries with **Postiz first** for each supported destination/media, then verify
   **Typefully as the fallback** before any migration or removal. Verify PostPeer, YouTube, and
   Substack only for destinations or capabilities Postiz does not support. A live canary must never
   bypass approval or make an instant public post.
7. Make adopted Signals changes enter a separate explicit apply/review audit flow.

### P2: complete product depth

1. Finish Fiction's conversational idea router, non-paraphrasing canonical updates, Studio-to-PR
   bridge, and per-comment engine routing.
2. Finish the ratified Outreach Phase 5 discovery/calibration method and weekly Strategy summary.
3. Add a safe Charles persona-edit workflow and keep delivery manual unless the policy changes.
4. Complete per-brand analytics, Signals, platform, and provider-account separation.
5. Populate and review pattern/account/baseline/mechanism evidence, then connect it to honest
   recommendations.
6. Connect the Grow contracts to the real source-to-review-to-delivery-to-outcome lifecycle.

### Recorded product decisions

1. Postiz is the canonical primary social publishing infrastructure. Self-hosted Postiz is the
   default path for supported destinations/media, but it is not implemented yet.
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
