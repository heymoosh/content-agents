# SLICE-5D — archived history

Moved out of `SLICE-5D.md` by SLICE-6E to bring the packet under the 12,288-byte cap. Newest
first. Every line here was removed verbatim from the packet.

## Accepted — 2026-09-05

Closeout result: **ACCEPTED — merged to local `main`** (2026-09-05). Muxin approved the Rule-7
before/after as option A: keep 5b's atomic skeleton-gate reject for reflective/fiction-promo sources
routed to LinkedIn/X; the "fall back to non-case spin" alternative is an optional, unbuilt follow-on
to raise only if reflective pieces get blocked in practice. Fast-forwarded to `b8eea12`; branch
deleted. Below is the verification that preceded acceptance.

## Pre-acceptance verdict — 2026-09-05

Pre-acceptance verdict: **VERIFIED — HELD for Muxin (Rule 7)** (2026-09-05). Coordinator-verified: read the
full diff and the test file; confirmed `configuredDraftSpinAngles` uses the SAME `resolvePlatformSpin`
decision the gate/stamp uses, so the body is spun exactly when the label fires; confirmed the default
(no spin map) `configuredContentPrompt` output is byte-identical (so `/atomize` is untouched) and the
angle instruction re-frames only within cited `approved_source_segments`. Cross-family Codex audit
(`codex exec --sandbox read-only`): **no concrete correctness defect** — independently confirmed the
approved angle reaches drafting, spin metadata reaches the skeleton gate before any write, controls
stay unspun, no-source-lines candidates stay unspun. Its remaining notes were verification-bundle
gaps (test bodies / canary / repo-gate withheld from the auditor), not defects; the coordinator holds
all three: focused suite 157/0, tsc 0, and repo-wide `npm run check` unsandboxed **exit 0,
4178/484/0**. The in-path deterministic runs (studio reject/land, note, venture) are the packet's
bounded canary. This slice is **not merged**: it changes composed prose per platform (lane C), so per
the alignment-plan Rule 7 it is a draft-PR hold carrying the before/after sample for Muxin's approval.
Committed to branch `feat/content-spin-5d` (not `main`). No untracked leftovers beyond this packet.

## RESULT BLOCK (worker-authored, coordinator-verified)

- Changed paths: `src/atomize/spin.ts` (additive: shared `resolvePlatformSpin(platform, {traceable,
  sourceKind})` + `SpinDescriptor`, composing existing `resolveAngle`/`appliesRehook` — external
  behavior unchanged); `src/review/jobs.ts` (`generateConfiguredContent` computes per-candidate spin,
  injects each spun treated variant's approved angle into `configuredContentPrompt` drafting via new
  `configuredDraftSpinAngles`, feeds real `spin`/`angle` to `checkSkeletonGate` — replacing 5c's
  hardcoded `undefined` — and stamps `spin: true`/`angle: <platform>` into spun treated derivatives;
  `configuredContentPrompt` gains an optional `spinAngles` map, default output byte-identical);
  `src/review/content-spin-gate.test.ts` (new, 5 tests).
- Outcome: the configured Content path now genuinely spins treated bodies to each platform's approved
  `spin_angles` angle (mirroring the shipped `duplicatePrompt` contract), un-dormanting slice 5b's
  skeleton gate end to end: a treated, source-traceable candidate spun to a case-skeleton platform
  (linkedin/x) whose recorded source class excludes the beat is rejected atomically (no derivatives
  dir, no media-stages dir, byte-identical `review-queue.md`, zero rows); an allowed beat lands
  pending with spin/angle stamped, the untreated control byte-exact, voice clean. `/atomize`'s
  observable output unchanged (the new drafting param is Content-path-only; default output identical).
- Gate un-dormanting: SKELETON gate — now FIRES (spin/angle computed and fed, same value stamped into
  provenance). CASE gate — deterministically dormant: the configured path emits no `case_skeleton:
  true` beat (no configured treatment declares a real anonymize-able third-party case), so
  `caseSkeleton` is `false`; un-dormanting it needs a future configured treatment that sets it true.
- Extraction-first / voice: a variant is spun only when source-traceable (cites `source_lines`), its
  platform has an approved angle, and `appliesRehook` holds — the exact shipped config-driven
  latitude, never widened. The injected angle instruction re-frames only within cited
  `approved_source_segments` and authorizes no claim outside them. Tests assert the spun body traces
  to its `source_lines` and passes `muxinVoiceFindings` (config/voice.yaml), the untreated control is
  byte-for-byte exact, and no-source-essay origins (Venture, Charles) / substack-note sources are
  never spun and never forced into a `source_lines`-demanding class.
- Checks run and results: `npx tsc --noEmit` → exit 0; focused `node --import tsx --test` on spin,
  validate, source-triage, 5b, 5c, content-generation, 5d → 157/0; cross-family Codex audit → no
  correctness defect; coordinator repo-wide `npm run check` unsandboxed → exit 0, 4178/484/0.
- Evidence locations: `src/review/content-spin-gate.test.ts`; audit bundle `/tmp/claude-501/audit-bundle-5d.md`
  (transient); repo-gate log task `blfb2e643` (transient).
- Unresolved: none blocking. Held for Muxin's Rule-7 approval (before/after sample). Case gate stays
  dormant by design as noted above.
