# Skills Audit: Size Report and Proposed Split Plan

**Date:** 2026-06-26
**Scope:** 8 skills in `.claude/skills/` — audit and proposals only. No files were changed.

---

## Size Inventory

Each skill ships as a single `SKILL.md`. None currently has a `references/` directory. The load-bearing cost metric is `SKILL.md` length: that is the context loaded every time the skill runs.

| Rank | Skill | Lines | Bytes | References files | What lives in the dir |
|------|-------|------:|------:|:----------------:|----------------------|
| 1 | **atomize** | 243 | 17,072 | 0 | SKILL.md only |
| 2 | **story** | 165 | 10,261 | 0 | SKILL.md only |
| 3 | **strategy** | 149 | 8,674 | 0 | SKILL.md only |
| 4 | **video** | 143 | 8,526 | 0 | SKILL.md only |
| 5 | **publish** | 82 | 5,911 | 0 | SKILL.md only |
| 6 | **bakeoff** | 73 | 4,022 | 0 | SKILL.md only |
| 7 | **illustrate** | 59 | 3,372 | 0 | SKILL.md only |
| 8 | **cycle** | 36 | 2,130 | 0 | SKILL.md only |

**Total context loaded per full-cycle invocation (cycle + strategy + atomize + publish):** roughly 510 lines / ~34KB. That is substantial given every skill load is model context.

---

## Threshold and Flagging Rationale

**Threshold used:** SKILL.md over 150 lines OR over 10 KB is a candidate for splitting.

Rationale: a skill loaded inline fills roughly 3,000-4,000 tokens at typical prose density. At 150 lines / 10 KB that cost becomes material, especially for skills that run as inner loops of `/cycle`. Below 150 lines, the skill is dense enough to be worth keeping whole for cognitive coherence (fewer files = fewer loading decisions). Above 150 lines, the skill is typically bundling distinct sub-modes that could be loaded selectively.

**Flagged oversized:**

- `atomize` (243 lines, 17 KB) -- significantly over threshold
- `story` (165 lines, 10.3 KB) -- over threshold

**Borderline (not flagged, noted for awareness):**

- `strategy` (149 lines, 8.7 KB) -- one line under threshold; the content is structurally unified (one sequential flow), so a split would add overhead without clear savings
- `video` (143 lines, 8.5 KB) -- under threshold; the engine comparison table is the main bulk and is legitimately needed at load time

---

## Proposed Split Plans (oversized skills only)

### atomize (243 lines, 17 KB)

**Current responsibilities bundled in one file:**

1. Core pipeline: steps 1-8 (ingest, brief, tag/extract, route, generate derivatives, CTA stamping, scoring, validate, render quote card, queue). This is the main path and runs on every invocation.
2. Notes mode: the separate `/atomize notes` sub-flow (pull Substack Notes, pick, scaffold, spread). Roughly 30 lines, distinct trigger.
3. Spin mode: the audience-reframing experiment (`--spin`). Roughly 45 lines plus a detailed worked example. Only invoked when Muxin explicitly passes `--spin`.
4. Revise mode: `--revise` sub-flow (read `review-queue.md`, act on `revise` rows). Roughly 10 lines but logically distinct.

**Proposed split:**

- **`atomize/SKILL.md` (core, ~120 lines):** Steps 1-8 only, extraction-first rule, voice rules, scoring, CTA stamping. Trim the worked spin example (it belongs in the spin reference). Add one-line callouts: "For notes: see `references/notes-mode.md`", "For spin: see `references/spin-mode.md`", "For revise: see `references/revise-mode.md`". The core runs on every invocation; it should load lean.

- **`atomize/references/notes-mode.md` (~35 lines):** The complete `/atomize notes` flow (pull, pick, scaffold, spread, quote-card rules for notes). Loaded only when the invocation is `/atomize notes`.

- **`atomize/references/spin-mode.md` (~55 lines):** The spin protocol, guardrails, which derivatives to spin, the verbatim invent-vs-flavor worked example, tracking and experiment-legibility rules. Loaded only when the invocation includes `--spin`.

- **`atomize/references/revise-mode.md` (~10 lines):** The `--revise` sub-flow. Loaded only when the invocation includes `--revise`.

**Why:** The spin worked example alone is ~20 lines of illustrative text that adds zero cost-per-run value when Muxin is just running a normal atomize. Notes mode has its own distinct trigger. Extracting them reduces every standard `/atomize` invocation by roughly 85 lines.

---

### story (165 lines, 10.3 KB)

**Current responsibilities bundled in one file:**

1. Context and Build 2 premise (why composition is allowed, scope, guardrails). Roughly 15 lines; needed once but repetitive if the reader already knows the pipeline.
2. Consistency model (bible, canon, character sheets, outline). Short, but reference material more than procedural steps.
3. New series flow (`/story new`). Self-contained, 3 steps.
4. Chapter drafting flow (`/story <series>`). The main path: beat-sheet approval gate, context pack, draft (two sub-modes: claude-native and external provider), QC, validate, PR. Roughly 60 lines.
5. Revise flow (`/story --revise`). Roughly 20 lines, distinct trigger.
6. Lock flow (`/story lock`). Roughly 15 lines, distinct trigger.
7. Illustrations and promotion note. Roughly 10 lines.
8. Model note. Roughly 5 lines.

**Proposed split:**

- **`story/SKILL.md` (core, ~80 lines):** The Build 2 premise (condensed to 5-7 lines), consistency model reference list, new-series flow, and chapter-drafting flow only. These run in sequence on the main path (`/story new` then `/story <series>`). Callouts to references for revise, lock, and illustrations.

- **`story/references/revise-mode.md` (~25 lines):** The full `--revise` protocol (reading PR comments, surgical edits, reply on threads, re-validate, push). Loaded only on `/story --revise`.

- **`story/references/lock-and-promote.md` (~20 lines):** The lock flow (continuity entry, character sheet updates, `story:lock` script) plus the illustrations and promotion note. Loaded only on `/story lock` or when Muxin asks about illustrations/promotion.

**Why:** The revise and lock flows are distinct operations with their own triggers and are never needed mid-draft. Separating them keeps the main drafting skill under 90 lines without losing any procedural detail.

---

## Run-order and Orchestration

### Inferred invocation order (from CLAUDE.md pipeline map and `/cycle` SKILL.md)

**Weekly full cycle (orchestrated by `/cycle`):**

1. Ingest analytics scripts (`npm run ingest`, `npm run bluesky`) -- no skill, script-only
2. `/strategy` -- grades prior bets, runs analytics scripts, writes strategy brief and updates `briefs/bets.md`
3. `/atomize <url|file>` (per piece) -- reads the strategy brief, routes, generates derivatives, renders quote card, queues for review
4. `/video <folder>` (optional, per piece) -- heavier path, separate opt-in after atomize
5. Review by Muxin (manual, no skill)
6. `/publish <folder>` (per folder) -- acts on approved rows only

**Ad-hoc / support skills (not part of the weekly cycle):**

- `/bakeoff` -- run when evaluating image models; feeds results into `config/providers.yaml`
- `/story <series>` -- Build 2, fully separate from Build 0/1
- `/illustrate <series>` -- runs after `/story lock`

**Dependency chain that matters for ordering:**

- `/strategy` must run before `/atomize` on a new cycle (atomize reads `from_brief` directives)
- `/atomize` must complete before `/publish` (publish acts on the review queue atomize wrote)
- `/video` is decoupled from `/atomize` but typically runs after it (reuses the content folder)

### Recommended doc updates (proposals only, not performed)

These two updates are out of scope for this card. They are proposed for a follow-up:

1. **Update the Obsidian doc (`Content Agents.md`):** Add the invocation order above as a one-table "when to run each skill" quick reference. The current CLAUDE.md pipeline map describes scripts, not skill entry points; the Obsidian doc is where Muxin is most likely to look before running something new.

2. **Update the orchestrator profile (`.orchestrator.json`):** If the conductor is running skills automatically, it should encode the explicit ordering constraint: `/strategy` before `/atomize`, `/atomize` before `/publish`, and `/video` as an opt-in step that does not gate publish. The current profile (written by `orchestrator-onboard`) likely does not enumerate per-skill ordering; adding a `skill_order` or `pipeline_steps` array would make the dependency explicit and prevent a future conductor run from atomizing before grading last cycle's bets.

Neither update touches skill files; they are documentation and config changes only.

---

## Summary

| | Count |
|---|---|
| Skills audited | 8 |
| Flagged oversized | 2 (atomize, story) |
| Largest skill | atomize (243 lines, 17 KB) |
| Proposed sub-files across oversized skills | 6 (3 per skill: core + 2-3 references) |
| Files changed by this audit | 0 (audit only) |
