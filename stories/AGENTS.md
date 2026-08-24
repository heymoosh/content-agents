# Build 2 — Fiction (composed prose, walled off)

Build 2 is the **opposite** of extraction-first: `/story` *composes* original fiction. Muxin is
the showrunner (world, characters, direction); Claude drafts the prose and holds consistency.
Two drafting modes, set per series in `series.yaml` `prose:`: **claude-native** (default, no API
key, Opus plans the beats and a Sonnet/Haiku writer subagent drafts) or an external **`prose`
provider** (e.g. `grok-openrouter`) via `npm run story:draft` when a key is configured. This composition is allowed **only because every
chapter is reviewed and approved by Muxin on a GitHub PR before it publishes, and nothing
auto-publishes** — the same principle as the video-script exception (rule 1), extended to a
whole build. It must never bleed back into Build 0/1: text/image derivatives stay
extraction-first.

- **Rule 5 does not apply to fiction, except the em-dash ban.** `config/voice.yaml` (Muxin's
  nonfiction PM voice) governs Builds 0/1 only. Fiction is governed by `config/fiction/craft.md`
  + `config/fiction/style.yaml` (and per-series `narrative:` overrides). The one rule that
  carries over: **no em dashes** (Muxin's house rule, fiction included). The fiction guards
  strip them like `voice.yaml` does for nonfiction.
- **Consistency model:** `bible.md` (living world/character reference) + `canon.md` (append-only
  ledger of established facts, updated on lock) + `characters/<name>.md` sheets + loose
  `outline.md`. The plot may evolve; established canon must not silently break.
- **Review loop = GitHub PR, one per chapter.** Muxin comments on lines/ranges (mobile-friendly
  comment bubbles); `/story --revise` makes **surgical edits to only the commented passages**,
  replies on threads, pushes. Never rewrite unannotated prose. Approve → `/story lock`.
- **Skills/scripts:** `/story` (new series, draft chapter, revise from PR comments, lock) and
  `/illustrate` (character fan-art variants + optional consistent-style scene art). Scripts:
  `npm run story:new | story:context | story:draft | story:validate | story:lock | story:illustrate`.
- **Promotion reuses Builds 0/1:** a locked chapter can feed `/atomize` (teaser quoting a real
  excerpt + cliffhanger) and `/video` to drive subscriptions — those quote published prose, so
  they stay extraction-first.

| Step | Trigger | Script(s) | Claude judgment | Output |
|---|---|---|---|---|
| New series | `/story new <notes>` | `npm run story:new` | structure notes → bible + character sheets + outline | `stories/<slug>/` |
| Draft chapter | `/story <series>` | `npm run story:context`, `npm run story:draft`, `npm run story:validate` | beat sheet, QC for page-turner craft + canon consistency, set title | `chapters/chapter-NN.md`, draft PR |
| Revise | PR comments / `/story --revise` | `npm run story:validate` | surgical edits to commented passages only; reply on threads | updated chapter, PR pushes |
| Lock | `/story lock` (after approve) | `npm run story:lock` | continuity entry, character-state updates | `canon.md`, `ready-to-paste/chapter-NN.txt` |
| Illustrate | `/illustrate <series>` | `npm run story:illustrate` | fan-art styles / scene prompts; cost-first model | `illustrations/` |
