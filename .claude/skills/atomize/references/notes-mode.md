# /atomize notes — Substack Notes mode

Muxin's Substack **Notes** (short posts, not essays) are his highest-engagement surface, but they
never appear in the RSS feed, so the URL path above can't reach them. `/atomize notes` pulls them
directly and spreads the ones worth spreading.

1. **Pull + list.** `npm run new-notes` (needs `SUBSTACK_HANDLE` in `.env`). It prints a numbered
   list of recent original notes with engagement, ingests their engagement into analytics (so
   `/strategy` resonance covers Notes — they're otherwise invisible to it), and caches the list.
   Show Muxin the list.
2. **Pick.** Muxin says which to spread. `npm run new-notes -- --pick 1,3` scaffolds one content
   folder per picked note (`source_kind: substack-note`, the note's own URL as `origin` +
   `canonical_url`). Don't spread every note — only the ones worth cross-posting.
3. **Spread each.** For each scaffolded folder, run the standard flow (steps 2–8 in SKILL.md): read the
   brief, tag the pillar, `npm run route`, generate derivatives, validate, queue. A note is short
   and already platform-ready, so the **whole note is the extract** — derivatives are near-verbatim
   cross-posts trimmed to each platform's limit (extraction-first still holds; if a note is too thin
   for a platform like LinkedIn, the "don't pad, stop" rule applies). Substack is already excluded
   as a routing target, so a note is never reposted back to where it came from. Muxin still approves
   every draft in `review-queue.md` before `/publish`.

   **Quote card for a note.** The note body IS the quotable unit, so the quote card uses the whole
   note, not a sub-sentence. Put the entire note body in `quote-card-1.md` with `source_lines`
   pointing at the body line(s). If the full body runs past ~280 characters (it turns unreadable at
   card font sizes), take the strongest self-contained sentence(s) that stand as a complete thought
   without the rest of the note. Never use the `title` frontmatter field as the quote source: for a
   note that field is an 80-char synthetic truncation (`noteTitle()` cuts the first 80 chars, often
   mid-sentence), not a verbatim excerpt, and quoting it is what produced the broken, nonsensical
   cards. Strip em dashes per voice rules, and set `cta_label: "Full note (free to subscribe):"`
   rather than the essay CTA, since this is a note.
