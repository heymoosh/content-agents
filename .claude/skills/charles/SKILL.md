---
name: charles
description: Build 4 — draft posts for Charles Lord Featherbottom, a satirical persona (haughty consultant to oligarchs, secretly panicking as belief in "inevitable power" erodes). Three modes — one-liners, essays, and replies to a fed-in link. Usage - /charles oneliner [topic], /charles essay <topic>, /charles reply <url>.
---

# /charles — draft posts for Charles Lord Featherbottom (Build 4)

Draft in-character posts for Charles, a fictional persona. Read `charles/CLAUDE.md` and
`charles/config/persona.yaml` this session before drafting anything if you haven't already —
his voice is the deliberate opposite of Muxin's (`config/voice.yaml` does NOT apply to him), and
that file has the wall-off reasoning plus the comic engine you're writing against.

**Nothing here publishes itself.** Every mode ends the same way: write the draft to a file under
`charles/posts/<type>/`, then append a row to `charles/review-queue.md` with status `pending`.
Muxin reviews and sets `approve` / `revise` / `discard` by hand. Delivery (pasting to Substack)
is hers to do — this skill never posts anything.

## Before drafting: load persona.yaml

Read `charles/config/persona.yaml` fully — voice mechanics, the comic engine's five angles, and
the leak bank. Pick ONE primary comic angle per draft (a light second layer is fine). If the
draft references a "useful leak," it MUST be one from the leak bank, cited close to how the
source states it — never invent a statistic, org, or ballot measure that isn't in the bank.

## Mode: `/charles oneliner [topic]`

1-3 sentences. Either a small accidental slip he immediately walks back, or a disproportionate
panic about something minor. If no topic given, pick one from the comic engine's angles.

Write to `charles/posts/one-liners/<slug>.md`:
```
---
type: one-liner
angle: <comic_engine angle id>
drafted: <today's date>
---

<the post text>
```

## Mode: `/charles essay <topic>`

Long-form, several sections, framed as instruction to an aspiring oligarch or a dispatch on a
specific threat to the arrangement (see `charles/CLAUDE.md` for the tone reference). Structure:
calm/confident opening → building unease → a slip he can't fully contain → attempted denial that
doesn't quite land. Weave in 1-2 leak-bank items where they fit naturally as things "he wishes
people hadn't noticed" — don't force all of them into one piece.

Write to `charles/posts/essays/<slug>.md`:
```
---
type: essay
angle: <primary comic_engine angle id>
leaks_used: [<leak id>, ...]
drafted: <today's date>
---

<the essay, with a title as an H1>
```

## Mode: `/charles reply <url>`

Muxin feeds in a real post or article — fetch it (WebFetch) to see what it actually says before
replying; never invent what the target said. Charles responds in-character: dismissive/defensive
opening, escalates, often ends leaking more than he meant to. 1-2 short paragraphs, matching the
reply examples in `charles/CLAUDE.md`'s history.

Write to `charles/posts/replies/<slug>.md`:
```
---
type: reply
replying_to: <url>
angle: <comic_engine angle id>
drafted: <today's date>
---

<the reply text>
```

## Memes are out of scope here

Muxin handles meme research, templates, and image generation herself with another tool (e.g.
Grok) — this skill doesn't draft memes. If asked for one, point at the "Persona brief" copy
feature in the Charles room instead (`charles/config/persona-brief.md`, her original brief
verbatim) — that's what she hands to the other tool.

## After any mode: update the review queue

Append one row to `charles/review-queue.md`:
```
| <slug> | <type> | posts/<type>/<slug>.md | pending | <one-line note on the angle/topic> |
```

Tell Muxin what you drafted and where, and that it's waiting in the review queue.
