# /atomize --continue — resume on an already-scaffolded folder

`/atomize --continue <folder>`: the folder already has a `source.md` (scaffolded ahead of time —
e.g. via `npm run new-notes -- --pick`, or the review GUI's notes checklist), so **skip step 1**
(ingest/scaffold) entirely. Read `source.md`, then run steps 2-8 from SKILL.md exactly as normal:
brief directives, tag + extract, route, generate derivatives, validate, quote card, queue.

If `source.md`'s frontmatter has `source_kind: substack-note`, follow the Notes quote-card
convention in `references/notes-mode.md` step 3 (whole-note quote, note CTA) instead of the
default essay convention — everything else about steps 2-8 is unchanged.
