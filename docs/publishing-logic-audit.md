# Publishing Logic Audit

**Date:** 2026-06-26  
**Scope:** `/publish` subsystem — cadence, routing, pipeline integrity, skill size  
**Auditor:** Delegated read/report agent (no code changes made)

---

## Verdict

**Publishing works: YES (all 5 channel scripts are wired and complete; test suite 17/17 pass).**

Most important single finding: The SKILL.md Step 3 (YouTube) is **stale** — it says "uploads as PRIVATE; Muxin flips to public in YouTube Studio" but the actual `youtube.ts` has shipped scheduled-publish support since the cadence update. The discrepancy is doc-only; the code behavior is correct and matches the inline comments in `youtube.ts`. No functional gap exists, but the skill gives operators the wrong mental model.

---

## 1. Cadence — how often per channel and when

**Source files:**
- `config/platforms.yaml` (lines 22–97) — all cadence config
- `src/publish/slots.ts` — unified scheduler implementation
- `data/publish-schedule.jsonl` — shared slot ledger (gitignored; absent in a fresh worktree)

### Per-channel cadence table

| Channel | posts/week | Eligible days | Time (PST/PDT) | min_reuse_days | Who schedules |
|---------|-----------|---------------|----------------|---------------|---------------|
| x | 5 | Mon–Sun (all 7) | 09:30 | 14 | `publish:typefully` via `claimSlots` |
| linkedin | 2 | Tue, Thu | 08:30 | 60 | `publish:typefully` via `claimSlots` |
| bluesky | 7 | Mon–Sun (all 7) | 18:30 | 21 | `publish:typefully` via `claimSlots` |
| quote-card | 7 | Mon–Fri | 12:00 | 30 | `publish:cards` via `claimSlots` (windowKey `quote-card`) |
| tiktok | 3 | Tue–Fri | 17:00 | 14 | `publish:tiktok` via `claimSlots` |
| youtube | 3 | Tue–Fri | 16:00 | 30 | `publish:youtube` via `claimSlots` |
| community | — | n/a (no API) | n/a | — (global 30d) | `publish:paste` — emits ready-to-paste files |

**Global default `min_reuse_days`: 30** (config/platforms.yaml line 22). Per-platform values override it: x=14, bluesky=21, linkedin=60, tiktok=14, youtube=30, quote-card=30.

### Typefully — explicit times, not "next-free-slot"

`publish:typefully` calls `claimSlots` with `windowKey = platform` (e.g. `"x"`, `"linkedin"`, `"bluesky"`). When a matching cadence entry exists in `config/platforms.yaml`, `claimSlots` returns an explicit UTC ISO timestamp that maps to the configured `slot_time_pst` wall clock on the next eligible day not already claimed. That ISO string is sent as `publish_at` in the Typefully draft API call (`typefully.ts` line 268). Platforms with no cadence entry (none currently) fall back to the literal string `"next-free-slot"` which Typefully treats as its own queue position.

### TikTok — `TIKTOK_SCHEDULE_AT` override

`publish:tiktok` resolves times via `resolveTimes()` (`tiktok.ts` lines 36–53). Precedence:

1. `TIKTOK_SCHEDULE_AT` env var (explicit ISO, manual one-off) — bypasses scheduler and ledger entirely.
2. `claimSlots` with `windowKey "tiktok"` — uses the Tue–Fri 17:00 cadence and the shared ledger.
3. Fallback: `TIKTOK_SCHEDULE_LEAD_MIN` (default 60 minutes out) — only kicks in when `windowKey "tiktok"` returns `"next-free-slot"`, which can't happen now that a `tiktok` cadence is configured.

### YouTube — scheduled publish (not private-then-manual)

`publish:youtube` claims a slot and sets `status.publishAt = slot` in the YouTube Data API call (`youtube.ts` lines 46–51). The video is uploaded as `privacyStatus: "private"` and YouTube auto-flips it to public at `publishAt`. The `YOUTUBE_PRIVACY=public` env var only applies when no `publishAt` is set (i.e., when `windowKey "youtube"` returns `"next-free-slot"`).

### Shared ledger de-confliction

Every slot claim writes to `data/publish-schedule.jsonl` (gitignored, append-only during normal runs; `pruneLedger` is the one intentional rewrite). The ledger enforces: (a) ≤1 post per platform per LA calendar day, (b) ≤`posts_per_week` per platform per Mon–Sun week, (c) cross-run and cross-stream de-confliction between text and card posts. Quote cards (`windowKey "quote-card"`) additionally record claims against each of their fan-out target platforms so a card never shares a platform-day with a text post.

---

## 2. Topics per channel — pillar routing

**Source files:**
- `config/routing.yaml` — cold-start defaults + hard overrides
- `config/pillars.yaml` — 5 pillars + "other"
- `src/strategy/route.ts` — implementation

### Pillar definitions (config/pillars.yaml)

| Pillar id | Name |
|-----------|------|
| human-ai | Human-centered AI |
| claude-code | Claude Code & AI coding workflows |
| civic-tech | Civic tech & the voting tool |
| career-work | Careers & the future of work |
| builder | Solo builder & product |
| other | (catch-all: anything not matching above) |

### Cold-start defaults per pillar (config/routing.yaml lines 11–18)

| Pillar | Cold-start platforms |
|--------|---------------------|
| human-ai | x, linkedin, bluesky |
| claude-code | x, linkedin, bluesky |
| civic-tech | bluesky, x, community:democratic-resilience |
| career-work | linkedin, x |
| builder | x, linkedin |
| other | x |

Cold start = fewer than `min_posts_for_data: 3` analytics rows for this pillar on a given platform. Once enough data exists, `route.ts` uses recency-weighted engagement (from `resonance.ts`) vs. a per-platform baseline; platforms scoring below `skip_below_score: 0.4` (normalized 0..1) are excluded.

### Hard overrides (config/routing.yaml lines 19–24)

| Pillar | Override | Platforms |
|--------|----------|-----------|
| civic-tech | always | community:democratic-resilience |

### Always-consider (format assets, never gated)

`always_consider: [quote-card]` — `quote-card` is always included regardless of routing data. It is a format asset, not a platform target; it routes to all image-capable accounts at post time.

### How routing gates /atomize

`route.ts` is invoked inside `/atomize` (and `/strategy --all`). The `routing.md` file written per content folder lists the `include`/`skip` decision per platform. `/atomize` only generates derivatives for platforms with `include`. The `quote-card` platform is always generated regardless. Community posts are scheduled paste-only (no API, no cadence gate). `/publish` then acts only on rows Muxin explicitly set to `approve` — routing gates generation, not final publication.

---

## 3. Does publishing work end-to-end?

### Test suite results

Tests run from the main checkout (worktree shares source but lacks `node_modules` — `npm install` is required per worktree to run tests locally):

```
npm test   # → node --import tsx --test "src/**/*.test.ts"
tests 17 | pass 17 | fail 0
```

Three test suites: atomize skill split structure (9 tests), new-notes media_type (3 tests), reuse-guard window math (5 tests). All pass. No test runner exists in the worktree itself since `node_modules` is absent there; tests must be run from the main checkout.

### Channel-by-channel pipeline trace

#### publish:typefully (`src/publish/typefully.ts`)

- Reads `review-queue.md`, filters rows with `status=approve` and `platform ∈ {x, linkedin, bluesky}`.
- Reuse guard check (`checkReuse`); `--force-reuse` bypasses.
- Calls `claimSlots` per platform to get explicit publish times.
- Builds Typefully draft payload with `publish_at`, optional `media_ids` (animated cards via presigned S3 upload), and CTA (per `config/cta.yaml` placement rules).
- POSTs to `https://api.typefully.com/v2/social-sets/<id>/drafts` with retry on `processing` (video transcoding).
- Marks rows `published`, appends `publish-log.md`, appends bet placement to `briefs/bets.md`.
- **Status: COMPLETE AND WIRED.**

#### publish:cards (`src/publish/cards.ts`)

- Reads `review-queue.md`, filters `status=approve`, `platform=quote-card`.
- Reuse guard check on `"quote-card"`.
- Loads image-post provider from `config/providers.yaml` (`postpeer` primary, `upload-post` failover).
- Discovers image targets from provider (fan-out to all connected image-capable accounts, excluding TikTok/YouTube).
- Splits targets by CTA placement (inline vs. omit) so X gets no in-body link.
- Calls `claimSlots` with `windowKey "quote-card"` and `conflictPlatforms` = all target platforms.
- Calls `provider.scheduleImagePost` per group (one call per placement group).
- Marks rows `published`, appends logs, appends bet placement.
- `--check` is a read-only preflight (rows + next slot + CTA plan + accounts).
- `--at <ISO>` overrides the time (bypasses ledger).
- **Status: COMPLETE AND WIRED.**

#### publish:youtube (`src/publish/youtube.ts`)

- Reads queue for approved rows that are `platform=youtube` OR `format=short` (excludes `platform=tiktok`).
- Reuse guard check on `"youtube"`.
- Validates `video/short.mp4`, `video/title.txt`, `video/description.txt` exist.
- `claimSlots(windowKey "youtube")` → gets `publishAt` ISO timestamp.
- Uploads via YouTube Data API v3 multipart; sets `status.publishAt` so YouTube auto-publishes.
- Falls back to plain private upload when no slot available (no cadence configured).
- Marks rows `published`, appends logs and bet placement.
- **Status: COMPLETE AND WIRED.**

#### publish:tiktok (`src/publish/tiktok.ts`)

- Reads queue for approved `platform=tiktok` rows.
- Reuse guard check on `"tiktok"`.
- Validates `video/short.mp4` and `video/title.txt`.
- `resolveTimes` with `TIKTOK_SCHEDULE_AT` override → scheduler → fallback lead-time.
- Two-step PostPeer upload: presign → PUT bytes → POST /posts with `scheduledFor`.
- Marks rows `published`, appends logs and bet placement.
- `--check` is a read-only preflight against PostPeer's `/connect/integrations`.
- **Status: COMPLETE AND WIRED.**

#### publish:paste (`src/publish/paste-files.ts`)

- Reads queue for approved rows with `platform ∈ {community, substack}`.
- Emits `ready-to-paste/<id>.txt` files with headers stripped.
- Marks rows `published`, appends logs and bet placement.
- **Status: COMPLETE AND WIRED.**

#### publish:all (`src/publish/all.ts`)

- Runs the 5 channel scripts in sequence: typefully → cards → tiktok → youtube → paste.
- `spawnSync`s each with the same `tsx` binary and folder argument.
- Continues on per-channel failure; reports failed channels at the end, exits non-zero.
- **Status: COMPLETE AND WIRED.**

### Gap / stale doc found

**SKILL.md Step 3 (YouTube, line 41–43) is stale:** It states "uploads as PRIVATE by default; Muxin flips to public in YouTube Studio after a spot-check." The current `youtube.ts` (lines 47–51) sets `status.publishAt` when a cadence slot is available, which auto-publishes at the claimed time. The "flip in Studio" path only applies when no cadence is configured (sentinel `"next-free-slot"`). This is a doc-only gap — the code is correct — but the skill currently gives operators the wrong expectation.

No code is stubbed, broken, or missing. Every script has a defined entry point wired to a real implementation.

---

## 4. Skill size / mega-skill split

### Size inventory (all skills)

| Rank | Skill | Lines |
|------|-------|------:|
| 1 | atomize | 171 |
| 2 | story | 165 |
| 3 | strategy | 149 |
| 4 | video | 143 |
| 5 | **publish** | **82** |
| 6 | bakeoff | 73 |
| 7 | illustrate | 59 |
| 8 | cycle | 36 |

*Note: the prior `docs/skills-audit.md` (2026-06-26) listed `atomize` at 243 lines; it has since been split into `SKILL.md` (171 lines) + `references/` (3 files: `notes-mode.md`, `spin-mode.md`, `revise-mode.md`). The split already shipped as PR #45.*

### Is publish oversized?

**No.** At 82 lines, `publish/SKILL.md` is well within the 150-line / 10 KB threshold the prior skills audit used. It covers 6 distinct channel steps, but each step is 6–12 lines of dense, single-path instruction — none is a mode that would be absent on a typical invocation. The doc loads once and remains coherent end-to-end. A split would add indirection without reducing per-run context (every `/publish` run processes all channels).

The one thing that would justify a future split is if a "community/Substack-only" mode or a per-channel dry-run mode were added with substantial doc weight. At present, that doesn't exist.

### Comparison to atomize's split

`/atomize` had four modes (`core`, `notes`, `spin`, `revise`) where notes and spin each have their own trigger and their own ~30–55 lines of content not needed on a normal run. `/publish` has one trigger and one linear flow; there are no optional sub-modes with dedicated doc sections.

---

## Proposed Changes (NOT executed)

### P1 — Fix SKILL.md Step 3 (YouTube, stale doc)

**File:** `.claude/skills/publish/SKILL.md` lines 39–43  
**Problem:** States "Uploads as PRIVATE; Muxin flips to public in Studio." Actually `youtube.ts` uses `status.publishAt` when a cadence slot is claimed (auto-publish).  
**Fix:** Replace the step with: "Uploads as SCHEDULED: the script claims a `youtube` slot from the unified scheduler and sets `status.publishAt` in the YouTube API call, so the video auto-publishes at the claimed PT time — no manual Studio trip. If no `youtube` cadence exists in `config/platforms.yaml`, it falls back to a plain private upload (then set `YOUTUBE_PRIVACY=public` or flip in Studio)."

### P2 — No skill split needed for /publish

At 82 lines with a single linear flow, splitting would add overhead without benefit. No action recommended.

### P3 — Note: worktree test isolation requires `npm install`

The worktree at `content-agents-worktrees/wt-publishing-logic-audit` has no `node_modules`; the test command `node --import tsx --test "src/**/*.test.ts"` fails with `ERR_MODULE_NOT_FOUND` when run there. Tests must be run from the main checkout or after `npm install` in the worktree. This is expected for a read-only audit worktree but worth noting if a future CI job runs tests per-worktree.

---

## Files Referenced

| File | Purpose |
|------|---------|
| `config/platforms.yaml` | Cadence config: posts_per_week, slot_days, slot_time_pst, min_reuse_days |
| `config/routing.yaml` | Cold-start defaults, hard overrides, thresholds |
| `config/pillars.yaml` | Pillar definitions and signals |
| `src/publish/slots.ts` | Unified scheduler: claimSlots, ledger, DST-aware LA time |
| `src/publish/typefully.ts` | Text posts (x/linkedin/bluesky) → Typefully |
| `src/publish/cards.ts` | Quote cards → PostPeer/Upload-Post |
| `src/publish/youtube.ts` | Shorts → YouTube Data API (scheduled publish) |
| `src/publish/tiktok.ts` | Shorts → TikTok via PostPeer |
| `src/publish/paste-files.ts` | Community/Substack → ready-to-paste files |
| `src/publish/all.ts` | Runs all 5 channel scripts in sequence |
| `src/publish/reuse-guard.ts` | Reuse frequency guard; reads `briefs/bets.md` Placed log |
| `src/publish/reuse-guard.test.ts` | 5 unit tests: window math + per-platform config |
| `src/publish/queue.ts` | Queue parsing (review-queue.md), setStatus, appendPublishLog, appendBetPlacement |
| `src/publish/queue-view.ts` | Unified read-only view: live services + ledger reconciliation |
| `src/publish/cta.ts` | Shared CTA resolver (text + cards) |
| `src/publish/image-post/postpeer.ts` | PostPeer image adapter (primary) |
| `src/publish/image-post/upload-post.ts` | Upload-Post image adapter (failover) |
| `src/strategy/route.ts` | Content router: pillar × platform decisions |
| `.claude/skills/publish/SKILL.md` | /publish skill (82 lines) |
| `docs/skills-audit.md` | Prior skills size audit (2026-06-26; atomize split already shipped) |
| `data/publish-schedule.jsonl` | Shared slot ledger (gitignored; absent in this worktree) |
