<!-- Source: Claude Design project "Content Studio Riff" (09c28898-3226-4fe5-8702-ac0d81fab484),
     content-studio-vision.md, retrieved verbatim 2026-07-19. This is the written intent behind
     the six-room review GUI (PRs #248–#256); check design decisions against it.
     Revised 2026-08-07: Venture locked in as the permanent sixth room, after Studio and before
     Content (see the 2026-08-07 audit handoff and docs/venture-build-plan.md — the handoff is an
     external planning document Muxin holds outside this repo, not a file checked in under docs/).
     Everything else in this file is unchanged from the 2026-07-19 original except where noted. -->

# Content Studio — what I actually want out of this system

My own notes, captured so nothing gets lost. This is the "why" behind the redesign. If a
future decision contradicts something here, this file is the intent to check against.

Written in my voice, my rules: no em dashes, plain verbs, no AI tells.

---

## The one principle

I want an all-in-one content team that is NOT automated into AI slop. It preserves what matters:
my insights, my voice, my thoughts. It automates only the repetitive stuff.

The division is the whole point:

- **I bring** the insight, the instinct, the nuance, the final yes.
- **The team handles** the repetition: tying in a branding phrase, choosing the right ask for
  where the piece sits and checking it actually fits the message, spot checks on format and
  storytelling hooks, applying best practices, picking the platform and media and format,
  generating visuals, doing the per-platform posting.

I don't want to remember to "apply this framing" or "use that tagline." I don't want to think
about which platform, what media, what format, or handle posting. I don't want to manually make
visuals. All of that is repetitive. The one exception is idea scout offering me suggestions,
which I welcome.

## The mental model I want: one conversation

I provide input (a URL, text, whatever). The AI and I have a conversation to improve the idea.
It acts like an advisor and makes recommendations. It offers to apply lenses based on the skills
available:

- brand-lens, as a check to see if the content can carry my branding better
- a CTA sense check, is an ask worth it here
- a spin based on the platform

If I like where it's going, it drafts. It takes different cuts. A cut is tweaking the core
MESSAGE, before any formatting. I can edit it, ask for changes. Then it goes through the
platform x media treatment to make versions that work across platforms, applying logic.

The old app got this backwards: the "cut" showed me a raw working file full of pillar routing
notes and line-number citations. I had no idea what message it made, what lens was applied, or
why. That is plumbing. A cut should read as a message.

## The six rooms

Everything lives in six rooms. Any single object (a content idea, a venture step, an outreach
lead, a fiction scene) opens as the same conversation described above.

1. **Studio (home).** One capture bar for anything. One "needs your judgment" queue that mixes
   everything, ranked by my day. The team's background work shown honestly with real elapsed
   times. Not a dashboard shouting metrics.

2. **Venture.** See the dedicated section below.

3. **Content.** The Workbench. My thought, the advisor's lens recommendations, the cut (the core
   message I edit before formatting), then the team formats it per platform. I never pick
   platform or media. Every draft still waits for my yes in Review before anything schedules.
   Content coming from a venture step goes through this exact same room, not a separate one. It
   just carries a plain tag saying where it came from: "From Venture" or "From Studio."

4. **Outreach.** See the dedicated section below.

5. **Fiction.** See below. The only overlap with the rest of the system is social promo.

6. **Signals.** See below.

## Venture, in detail

Venture is where I choose and run the business side: the audience, the problem, the lead
magnet, the offer, and whatever step the venture is actually on right now. It is the
business-strategy room, not a second Workbench. It does not own every content idea. A Studio
idea can stand on its own with no venture attached at all, same as always.

Locked in (2026-08-07): Venture is a permanent room, not a temporary mode tucked inside Studio.
I don't want this reopened as a question later.

It runs on the same Content engine everyone else uses. A venture step hands its primary piece
to Content: same cut, same lens checks, same Format for platforms, same Review, same publish
gate. I never get a second, different pipeline just because an idea started in Venture.
Cross-platform versions of a venture piece go through the normal Format for platforms step once
the primary piece is approved and live. They don't have to clear the venture's own step first.

The CTA on a venture piece comes from where the venture actually is right now (early posts,
building the list, testing the offer, running the business) and whether this specific message
actually earns that ask. It is not decided by how the last post performed. One piece gets one
clear ask, or none. A landing page is a place a CTA can point to. It is not the strategy itself.

Brand pillars still apply here, same as everywhere. A slow week or a quiet post does not turn
off a pillar or a platform on its own. If a post barely gets seen but brings in a subscriber or
a lead, that is a business win, not a failed post, and Signals should say so plainly, not bury
it in an engagement number.

## Outreach, in detail

Segment it into:

- **Platforms** (podcasts, newsletters, conferences, communities, anyone who already has an
  audience and might host me as a guest).
- **Organizations**, split into:
  - **mission fit** (values-aligned, worth knowing)
  - **open roles** (mission fit AND an actual job listing / full-time work)

Segmenting tells me what kind of angle or reason to bring before I read a word.

For each one I want, in a fast extract, the matchmaker read: **why this person or platform or
org, why me, why it's a good mutual fit.** If the AI were a perfect networker pairing people who
need to meet, why us two? Then tell me more: high level first, then details, then links to
direct sources.

If it seems interesting, then we draft. I help craft the body and core first: "I liked what you
said about X," "this reminds me of a project where I...", what to highlight. The AI cleans it up
and drafts it in my voice. It never invents interest I don't have.

**Follow-ups belong here, tied to the origin.** Assume I will not remember any of it in a few
weeks or months by the time we finally meet. Every follow-up row must carry: why I reached out,
what I said, when, and a link back to the original dossier. Something marks "I sent outreach to
this person at this org on this date with this intent," and the tracker runs the clock from
there. Different people at the same org get separate clocks, both linked to the one org dossier.

Nothing in outreach sends anything. Sending stays a manual, by-hand action I take.

## Signals, in detail

This is a two-way feedback system. The data helps me understand what is working AND where the
signal is too weak to trust. Anything I decide to change should get absorbed back into how the
system works. It must be clear, not a wall of numbers.

There is a lot of data and many ways to draw insight: platform, content topic, media type,
timing. The repo has this. But I want the final say on whether to adapt, because a cohesive,
coherent voice matters even across platforms.

What matters right now:

1. I don't know which platforms I'd do best on, given the kind of work I want to do and the
   effect I want the brand to have (attract like-minded people, lead to opportunities or income).
2. Consistency matters for brand building. That is the whole reason I need a system, so I can be
   consistent without being chained to my accounts all day. But I don't want to copy-paste the
   same thing everywhere. That is lazy. AI can tailor per platform and give each post a real
   reason for being there.
3. My audience may be everywhere. I don't know where they hang out yet, when they check content,
   or what they respond to on each platform. LinkedIn looks career and job-seeker heavy, but it
   could be B2B inbound too. Who knows until we test topics, times, content types.

So Signals should: show where I fit per platform (and admit when it's still learning), show
what's working tied to real posts, name what's too weak to trust so I don't chase noise, and
propose adjustments I adopt or decline. Adopting one means the system starts doing it. My voice
stays cohesive throughout.

Signals should never collapse everything into one score. Keep four things separate: attention
(did people see it), conversation (did people reply, comment, save it), audience (did it bring a
landing visit or an opt-in), and business (did it lead to a call, an inquiry, a sale). A quiet
post that brings in one lead is a business win, not a failed post, even if the reach number is
small. And low engagement on a pillar or a platform is never on its own a reason to quietly turn
it off. Signals can tell me a pillar is landing softer somewhere right now. It still needs my
yes before anything about the pillar or the routing actually changes.

## Fiction, in detail

I provide the world, the outline, the philosophy, the core plot line, and the characters. I do
NOT want to write every sentence and scene word by word. It drafts scenes from my beats, in the
series voice, never my personal essay voice. This is the one place the machine composes original
prose, and every chapter waits for my yes.

It also helps create the imagery and content to promote the series. That social promo is the
ONLY overlap between Fiction and the rest of the system. Otherwise Fiction is walled off.

## Research / idea scout

Do some research into topics that are trending and currently talked about that I could touch
with my lens and brand framing. Surface these as suggestions I can start a note from. This is
the welcome exception to "don't offer me things," because ideas are inspiration, not automation
of my judgment.

## Non-negotiables (these do not change)

- **Extraction-first.** Any text shown as my content is my verbatim words. AI proposals (angles,
  checks) are always visually distinct from my own text and never enter content silently. My
  verbatim words render in serif behind a blue rule; system and AI prose render in sans. The one
  scoped exceptions where AI composes: video scripts, fiction chapters, and the outreach message
  draft, all gated behind my approval.
- **Nothing publishes or sends without my explicit decision.** Say so honestly, once, at the
  moment it matters. Not in a defensive gray paragraph on every screen.
- **Long AI jobs (30s to 10min) show real elapsed time and a log link.** Never a fake ETA.
- **The word "atomize" never appears in the UI.** The production step is "Format for platforms."
- **Interface copy is written to me,** active voice, sharp-colleague tone. No AI tells, no em
  dashes, no rhetorical-question hooks, no emoji bullets. If a label needs a legend, rewrite the
  label.

## Working backwards: what to keep, change, cut from the current build

The failure is the surface, not the skills. The skills already enforce my non-negotiables.

**Keep the engine, rehost the surface:**

- `/develop` advisor rounds (recommendation cards + reply) ARE the Workbench conversation. Keep
  the logic, stop leaking the JSON structure.
- `develop.ts acceptAngle` already builds cuts from my verbatim lines deterministically. Keep.
- `outreach/tracker.ts` already does append-only, per-person follow-ups keyed on lead + person,
  so two contacts at one org already get separate clocks. It just isn't surfaced with the origin
  context. Surface it.
- `/scout` already finds ideas AND opportunities AND trending examples. That is why Signals and
  the Studio idea-drops are the same engine.

**Change the presentation, not the logic:**

- Cuts renders `extracts.md` raw. Render the assembled message instead. Demote pillar, slug, and
  line numbers to footnotes.
- Rename "atomize" to "Format for platforms" everywhere in the UI.
- Rewrite the outreach "why this fits" from strategy-memo prose into the matchmaker read (why
  them, why me, why mutual), direct address.
- Retire the standing gray caveat paragraphs. Move each reassurance to the button it concerns.

**Genuinely new (design work, not new skills):**

- The unified Studio home and single capture.
- The "team working" honest-status layer.
- Pipeline continuity so Cuts is never three tabs from Develop.
- The Fiction desk (the `/story` skill exists but has no GUI home).
- The Signals two-way loop with adopt/decline adjustments.

Net: we don't rethink the skills, we rehost them.
