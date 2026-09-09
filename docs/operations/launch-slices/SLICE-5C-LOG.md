# SLICE-5C — archived history

Moved out of `SLICE-5C.md` by SLICE-6E to bring the packet under the 12,288-byte cap. Newest
first. Every line here was removed verbatim from the packet.

## Closeout result — 2026-09-05

Closeout result: **PASS** (2026-09-05). Cross-family Codex audit ran twice. The first pass surfaced
one material gap — the slice and its tests claimed the skeleton/case gates fire end to end, which is
not reachable: the configured path has no spin/angle/caseSkeleton computation (a separate,
not-yet-ported item-5 slice), so the gates are structurally dormant. The coordinator owned the fix
(the packet's original Goal over-promised): the packet was reframed to the true achievable
deliverable (triage classified + recorded to provenance + threaded into the dormant gate calls,
enforcement deferred to the spin slice), and a scoped repair corrected the inaccurate "no longer
inert" comment, relabeled the gate tests as unit-level, added a dormancy test that pins current
behavior, and added fiction/charles `:813`-branch generation tests. The second Codex pass found **no
new real defects** and confirmed the dormancy is consistent with the corrected criteria. Repo-wide
gate `npm run check` unsandboxed: **4173 tests / 484 suites / 0 failures / 0 skipped**. No leftovers
beyond this packet and the slice's own new test file, committed with the slice.

## RESULT BLOCK (worker-authored, coordinator-verified)

- Changed paths: `src/atomize/source-triage.ts` (added `classifyContentOriginClass(origin)` —
  fiction→`fiction-promo`, studio/human-inference→`frame-native`, venture/charles/unknown→`undefined`;
  pure addition, `/atomize`'s Claude-judged classification untouched); `src/review/jobs.ts`
  (`generateConfiguredContent` resolves `triageSourceClass = readSourceClass(folder) ??
  classifyContentOriginClass(request.origin)` and `triageCaseEvidence` before any write, stamps
  `source_class`/`source_class_case` into each variant's derivative frontmatter, and threads the
  same values into the 5b skeleton/case gate calls; honest comment documenting the gates as dormant);
  `src/review/content-source-triage.test.ts` (new, 8 tests).
- Outcome: the configured Content path classifies its source and records the real
  `source_class`/`source_class_case` into each variant's provenance before any derivative/media-stage/
  review-row write, threading the same values into the gate calls. A `/atomize`-recorded class in
  `source.md` wins; the origin classifier is a fallback only; `source.md` is never mutated or invented
  (traceability + the source.md-unchanged invariant preserved). Scoped exceptions honored: Venture and
  Charles get no class stamp and no fabricated `source_lines`; fiction is stamped `fiction-promo`. The
  skeleton/case gates are honestly dormant (no configured candidate declares a beat until the spin
  slice) — pinned by a dormancy test; the gate FUNCTIONS' verdicts on recorded facts are proven at
  unit level.
- Checks run and results: `npx tsc --noEmit` → exit 0; focused suite (content-source-triage +
  validate + source-triage + content-validate-gate + content-generation + jobs) → 250/0; coordinator
  repo-wide `npm run check` (unsandboxed) → 4173/484/0. Cross-family Codex audit (v2) → no new real
  defects.
- Evidence locations: `src/review/content-source-triage.test.ts` (8 tests); audit bundles
  `/tmp/claude-501/audit-bundle-5c.md` and `…-5c-v2.md` (transient).
- Unresolved: none. Follow-on (spin slice) recorded above — not a leftover of this slice.
