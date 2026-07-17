# /atomize --continue — resume on an already-scaffolded folder

`/atomize --continue <folder>`: the folder already has a `source.md` (scaffolded ahead of time —
e.g. via `npm run new-notes -- --pick`, or the review GUI's notes checklist), so **skip step 1**
(ingest/scaffold) entirely. Read `source.md`, then run steps 2-8 from SKILL.md exactly as normal:
brief directives, tag + extract, route, generate derivatives, validate, quote card, queue. (Step
1.5's cut proposal still applies — this just skips the ingest mechanics, not the conversation.)

If `source.md`'s frontmatter has `source_kind: substack-note`, follow the Notes quote-card
convention in `references/notes-mode.md` step 3 (whole-note quote, note CTA) instead of the
default essay convention — everything else about steps 2-8 is unchanged.

## `--cut <lens>`

`/atomize --continue <folder> --cut <lens>` (`<lens>` not `extract`): the folder already has
`cuts/<lens>/cut.md` (step 1.5 already ran `addCut()` for this lens, e.g. after Muxin approved a
`derisk` cut). Read `cuts/<lens>/cut.md` instead of `source.md`, then run steps 2-8 exactly as
above, per "Cut-aware steps" in SKILL.md: derivatives go in `cuts/<lens>/derivatives/`, and every
queue row id gets `cutRowId(lens, id)`'s prefix. `routing.md` and source-triage facts are shared
across every cut in the folder — don't re-run route/triage per cut, reuse what's already there.
