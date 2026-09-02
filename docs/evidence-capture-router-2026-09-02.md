# Evidence: Studio front-door room routing, 2026-09-02

Sixteen drafted captures, one per bucket plus deliberate traps (a nonfiction essay that mentions
"price", "email", or "response"; Venture, Fiction, Charles, and Outreach ideas with none of the
keyword sniff's trigger words; one Signals-style analytics note). Run unsandboxed through
`src/review/capture-router.ts` with the subscription analyst route (GPT via the codex CLI answered
every probe; Claude is the fallback). No paid calls.

| Probe | Keyword sniff | Model route |
|---|---|---|
| Content: AI essay | Content | Content |
| Content: career | Content | Content |
| Content: essay mentioning "response" | Venture (wrong) | Content |
| Content: essay mentioning "price" | Venture (wrong) | Content |
| Content: essay mentioning "email" | Outreach (wrong) | Content |
| Content: bare URL | ask-link | ask-link (never sent to the model) |
| Venture: priced offer idea | Outreach (wrong) | Venture |
| Venture: landing page | Venture | Venture |
| Venture: no trigger words | Content (wrong) | Venture |
| Fiction: chapter beat | Fiction | Fiction |
| Fiction: no trigger words | Content (wrong) | Fiction |
| Charles: named | Charles | Charles |
| Charles: unnamed one-liner | Content (wrong) | Charles |
| Outreach: follow up | Outreach | Outreach |
| Outreach: no trigger words | Content (wrong) | Outreach |
| Signals: analytics note | Content | Content |

Keyword sniff: 7 of 16. Model route: 15 of 16. The one miss is the Signals note, which lands in
Content by design: Signals is not a routing target (its room-owned safe capture action does not
exist yet), and the verdict set stays at the five rooms the desk can advance.

Each model verdict carried a one-sentence reason, shown under the verdict on the desk. The desk
keeps its "Wrong room?" override, the verdict is bound to the exact text it was read from, and
nothing is created or queued until Muxin clicks Start on it.

Not proven here: the pillar-to-platform router inside `/atomize` (`src/strategy/route.ts`), which
decides which platforms a Content piece is drafted for. That path still needs one live Content run.
