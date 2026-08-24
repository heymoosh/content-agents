# Content Studio reset handoff

This is the clean starting point for the next design session.

## Intent of the reset

Step back from the current screen layout and rethink the product around the original Content
Studio vision. The next session should produce a clearer design architecture before making more
UI changes.

The goal is not to rebuild working capabilities. Preserve the existing repository-backed engines,
job queue, approval gates, provenance, Venture state machine, Fiction continuity rules, Outreach
discovery, Signals reads, and Charles workflow. Rehost those capabilities behind a calmer surface.

## Product anchor

The original reference files are in `/Users/Muxin/Downloads/handoff`. The most important files are:

- `Venture Build v7.dc.html` and `support.js`: visual and interaction reference
- `content-studio-vision.md`: product intent and non-negotiables
- `Venture Build v7 - backend handoff.md`: prototype-to-repository gap analysis
- `Venture Build v5 - backend handoff.md`: existing backend contracts

The newest authored direction is `docs/Muxin's Vision for Content Studio.md` in this preserved
branch. Read it alongside the prototype. It is the current product brief for the redesign.

The primary user flow should be:

1. One large, quiet Studio writing space.
2. Muxin writes or pastes anything.
3. The system identifies the destination and explains its choice.
4. The item opens in the relevant workspace without exposing internal pipeline plumbing.
5. Muxin chooses clean-up, hooks/templates, or both, and chooses which outputs and media to keep.
6. Everything remains human-reviewed before publishing or sending.

## Preserved implementation

The preserved implementation is on branch `docs/multi-engine-plan` in the isolated worktree that
was used for the multi-engine work. The next session must inspect the commit named in the session
summary before changing anything.

The implementation already contains, among other things:

- Real repository-backed Content, Studio, Outreach, Fiction, Charles, Venture, and Signals rooms.
- A serialized job queue with measured elapsed time, logs, blocked questions, retry, and stop.
- Claude, Grok, and Codex engine dispatch for supported actions with provenance.
- Fiction continuity routed through the engine seam and a selector.
- Human approval gates and no automatic outreach sending.
- Venture intake, phase, artifact, evidence, decision, checkpoint, retraction, and failure state.
- Read-only fixture mode for reviewing many states before real data exists.

## What the next session should not assume

- The fixture panel is not product UI. It is a developer state explorer.
- The current seven-room layout is not the final information architecture.
- Every backend state needs a permanent visible card.
- Engine selectors need to be visible everywhere. They may belong at the action boundary or in a
  preference layer.
- Gemini's earlier recommendations are not the product vision. They are audit input only.

## State inventory to preserve during redesign

The current fixture and source model covers queued, running, blocked-awaiting, blocked-answered,
failed, done, stopped, empty, cold-start, Fiction beats and scene states, Content routing and
treatment failures, Signals measured and insufficient data, and Venture checkpoint, decision,
delivery, retraction, and failure states. The complete source inventory is in
`docs/content-studio-gemini-review-brief.md` and `docs/content-studio-gemini-review-bundle.zip`.

The redesign should decide where each state belongs:

- inline in the active workspace
- in a compact Studio activity drawer
- as a recoverable interruption
- as a quiet history record

It should not delete the state merely because it is hidden from the first view.

## Safety and repository status

- No publishing, sending, merging, or pushing was performed for this reset.
- The main checkout remains user-owned, dirty, and separate. Do not reset or clean it.
- PR #358 and the overlapping viral-content work remain out of scope.
- The current Studio branch must be preserved before any redesign work begins.

## Recommended next-session sequence

1. Read this handoff and the original prototype files.
2. Read `docs/content-studio-gemini-review-brief.md` for the complete state and data inventory.
3. Produce a design architecture and screen hierarchy first.
4. Mark each current capability as keep, rehost, collapse, rename, or defer.
5. Only then make UI changes, preserving the current backend contracts and tests.
