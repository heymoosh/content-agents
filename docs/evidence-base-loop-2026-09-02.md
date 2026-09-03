# Evidence: the base content loop on one real essay, 2026-09-02

The base-loop test the master status names as gate 1. Every earlier run of the front door used
invented probe text, because extraction-first forbids drafting from anything Muxin did not write
(`docs/evidence-capture-router-2026-09-02.md` says so in its closing line). This run used a real,
never-atomized essay of hers.

**Source:** "The world's broken. What do we do?", published 2026-08-30, pulled from the public
Substack RSS feed. 3,677 words. It is the newest of seven essays published since 2026-08-02 that
have never been through the pipeline; every one of the fifteen existing `content/` folders is July
material, seven of which are the stale pending rows in the open questions.

## What ran, and what it proved

| Leg | Command | Result |
|---|---|---|
| Ingest | `npx tsx src/atomize/new-content.ts <url>` | `content/2026-09-02-the-world-s-broken-what-do-we-do/source.md`. **Found a defect — see below.** |
| Front door, link | `routeCapture("<url>")` | `ask-link`, keyword path, never sent to the model. Matches the drafted-probe behavior. |
| Front door, prose | `routeCapture(<first ~1,100 chars of source.md>)` | `room: Content`, method `model`, engine `gpt-codex`, reason "This is Muxin's nonfiction reflection on AI, society, power, and collective leverage." First time the router has been read against Muxin's own writing rather than an invented probe. |
| Routing | `npx tsx src/strategy/route.ts --brand human-inference --pillar civic-tech,human-ai --folder <folder>` | Wrote `routing.md`. **Found a usage defect — see below.** |
| Source triage | `npm run tag-source` (inside `/atomize`) | `source_class: frame-native`, `source_class_beat2: not_found`, `source_class_case: not_found` stamped on `source.md`. |
| Drafting | `/atomize --brand human-inference --continue <folder>` | 15 derivatives (11 text across x/linkedin/bluesky/mastodon/threads, 3 quote-card captions, 1 card line), each with `source_lines` frontmatter. 15 `pending` rows in the folder's `review-queue.md`. Nothing rendered, nothing approved. |
| Validate | `npx tsx src/atomize/validate.ts <folder>` | `ok: 15 derivative(s) within platform limits`. No derivative exists for a `skip` platform, so the routing gate held on real output. |

## Defect found and fixed: HTML entities survived ingest

`htmlToText` in `src/atomize/fetch-substack.ts` decoded six named entities by hand and no numeric
references at all. Substack's feed writes smart punctuation and accents as numeric references, so
the first pull of this essay wrote **119 undecoded references into `source.md`**:

| Reference | Count | Character |
|---|---|---|
| `&#8217;` | 69 | ’ |
| `&#8220;` / `&#8221;` | 23 / 23 | “ ” |
| `&#8211;` | 1 | – |
| `&#233;` / `&#232;` / `&#237;` | 1 each | é è í |

`source.md` is the file every derivative quotes line for line, so all 119 would have shipped to a
platform encoded. The three accented characters are inside real proper nouns — "Médecins Sans
Frontières" and "la alegría" — which would have been published misspelled.

The fix is `src/util/html-entities.ts`, one decoder shared by the ingest paths, wired into
`fetch-substack.ts` (body and title) and `src/patterns/youtube-transcript.ts` (the same
named-only chain, also with no numeric support). It decodes named references, decimal and hex
numeric references, and the Windows-1252 range authoring tools emit, in a **single pass** — the
old sequential chains re-read their own output, so an author writing about `&amp;lt;` got a
literal `<`. Unknown or unreadable references are left exactly as written rather than dropped.

Re-pulling the same essay through the fixed path: **0 remaining references**, and the proper nouns
read correctly.

`unescapeXml` in `src/patterns/reddit-rss.ts` was left alone. It already decodes numeric
references, and its `&amp;`-last ordering is a documented part of a two-layer double-unescape. It
does not decode named references beyond XML's five — a smaller gap, unproven against real data,
and not worth changing that contract blind.

## Defect found and fixed: `route.ts` usage strings omit a required flag

`src/strategy/route.ts` requires `--brand`, and every usage string omitted it. Following the
documented invocation produces an unhandled `Error: strategy measurement requires explicit
--brand ...` stack trace instead of a usage line. Corrected in `route.ts` (header comment and the
printed usage), `src/strategy/exploration.ts` (comment and the instruction it prints to the
operator), `src/strategy/routing-drift.ts`, and `.claude/skills/strategy/SKILL.md` line 180 — the
last two matter because a skill and a printed instruction are read as commands to run.

A cross-family audit (Grok, see below) then found the miss that mattered most: the four files above
are not the invocation `/atomize` actually follows. `.claude/skills/atomize/SKILL.md` step 3.5 (and
its `--explore` example), `.claude/skills/develop/SKILL.md`'s routing preview, and this repo's own
`CLAUDE.md` pipeline table all still printed the flagless form. Those are corrected too.

## Cross-family audit

The change was audited by Grok against six written requirements, with the diff and the changed
files. Verdict: **FIX**, three defects, all now closed.

| Finding | Fix |
|---|---|
| P1 — `/atomize`'s own skill still printed `npm run route -- --pillar ... --folder ...`, the exact form that throws | `--brand` added there, in `/develop`, and in `CLAUDE.md` |
| P2 — the unmapped Windows-1252 slots (129, 141, 143, 144, 157) and `&#8;` decoded into invisible control characters, contradicting the code's own comment | `fromCodePoint` now refuses C0/C1 controls other than tab, newline and carriage return; a new test pins it |
| P2 — `CLAUDE.md` pipeline table | same `--brand` fix |

Confirmed met by the audit: single-pass decoding with no backtracking, the Latin-1 block complete
and correctly ordered (96/96, `reg` at 174), the shared decoder reaching the YouTube caption path,
`U+00A0` flattening staying body-only and post-decode, and title decoding being slug- and
YAML-safe.

## What this run does NOT prove

- **The routing decisions are cold-start, not data-driven.** All 20 posts in this worktree's
  `data/analytics.db` have a null `pillar`, so every platform came back `cold-start (no tagged
  data yet), posting broadly to gather signal`. The July folders show what a data-backed decision
  looks like (`1.20× platform norm (n=81)`). The router's code path ran live and wrote a real
  `routing.md`; the decisions in it reflect this worktree's thin snapshot, not Muxin's history.
- **Source triage ran but narrowed nothing.** `source_class` came back `frame-native` with no
  beat-2 belief statement and no anonymize-able third-party case, so the
  `source-triage: excluded by source_class` rule that narrowed the July routing had nothing to
  exclude. The rule is unexercised on this piece, not disproven.
- **No strategy brief was layered on.** There is no scoped `briefs/human-inference/` brief, so no
  brief directives applied and no community derivative was drafted for the community route the
  civic-tech editorial rule included.
- **Nothing was published, scheduled, or approved.** Drafted rows stay `pending`. The last leg of
  gate 1 — Muxin approving one row into a scheduled Postiz post — is hers and was not touched.
- **The queue rows are stamped `from /cycle`, which is wrong.** This was
  `/atomize --brand human-inference --continue`, not `/cycle`. That is the skill's default origin
  stamp, left as written rather than hand-edited; worth fixing in the skill, not in this run's
  output.
- **No image or video was rendered.** The drafting leg ran under an explicit no-spend constraint:
  text derivatives and quote-card text only, no render, no paid model call. The quote-card rows
  point at an `images/quote-card-1.png` that does not exist yet.
- The drafting leg was first attempted on the Claude CLI, which stopped on a session limit before
  producing anything. It was re-run on the codex CLI (GPT), same subscription route, same $0
  marginal cost. The derivatives on disk are codex's work under the `/atomize` skill's rules.
