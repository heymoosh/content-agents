# Platform fit profile

The outreach engine's platform-kind fit rubric (docs/outreach-engine-plan.md §3, §5 stage 4,
§6 Phase 3; backlog cards `b7dcb608` and `c308a8cf`). Claude reads this file at the QUALIFY +
PITCH stage of `/outreach` to classify a platform-kind lead (`lead.md` frontmatter `fit`) and
again at DRAFT to justify the pitch angle. `research.ts`'s evidence pass walks the taxonomy
below as a closed checklist (plan §10 guard #2) — never an open-ended "research this platform"
prompt. This is the direct sibling of `config/outreach/clients.md` — same document shape and
role, one level lower (evidence taxonomy, classification, shared-values reference), only the
fit dimensions differ because the question being answered is different.

This is not a "would this be nice exposure" filter. It answers one question: **is this an
audience Muxin can genuinely borrow — real people who'd care what she has to say — and is there
an actual path for her to reach them as a guest or contributor, not just a wishlist name?**

## Fit dimensions

A platform-kind lead is evaluated across five dimensions. All five feed the `fit` verdict; none
is a standalone gate the way the client HARD qualifier is, except guest-friendliness (below),
which behaves like one.

### 1. Topic overlap

Does the platform's actual content sit close to Muxin's essay themes — AI & society, fairness,
product/build work (the untested-assumption pattern, greenfield vs. turnaround judgment)? Judge
by recent episodes/issues/posts, not an "about" page description. A platform whose stated mission
sounds aligned but whose last 10 episodes are all something else (e.g. pure market news, pure
celebrity interviews) does not have real topic overlap no matter what the tagline says.

### 2. Audience reality check

Real audience, not vanity metrics. A platform can look big (follower count, subscriber count)
while its actual engaged audience is thin (low listen-through, low comment/reply activity, a
newsletter that's mostly unopened). Evidence should distinguish claimed size from evidence of an
actually-engaged audience: comments, replies, discussion threads, guest testimonials about
listener/reader response, download or open-rate figures if publicly stated. A platform with a
modest audience that visibly engages with its content is a better lead than one with a large,
quiet audience.

### 3. Values alignment (worldview-match)

Referenced, not restated — see "Shared values" below. The platform (or its host/editor) must
have publicly said something, in their own words, that echoes one of the worldview-map
statements. No quote means the values leg is unmet, not assumed, same rule as clients.md.

### 4. Guest-friendliness / pitch-path

Do they actually take outside guests or contributors, and is there a real, visible path in
(a pitch page, a "be on the show" link, a public call for contributors, a history of hosting
non-celebrity outside guests)? This behaves like clients.md's HARD qualifier: a platform that is
purely a solo-voice format with zero outside-guest history, or one whose "contact" surface is
dead (no response mechanism at all, a form that visibly goes nowhere), cannot be pitched no
matter how strong the topic/audience/values read is. That does not automatically mean
`disqualified` — a platform can be `weak` on this dimension pending more research — but it caps
the fit verdict at `partial` at best until a real pitch path is found.

### 5. Recency

Active in the last **≤90 days**. A dead show or newsletter is a dead lead regardless of past
reputation or archive quality. Check the most recent episode/issue/post date directly; do not
infer activity from a still-live website or an old "subscribe" call to action. A platform whose
last public output is older than 90 days is not a fit today, whatever it once was — record this
as a recency evidence item and let it drive the verdict down, it is not a soft consideration.

## Evidence taxonomy (closed checklist)

`research.ts` gathers specific, citable signals, not a vibe. Each signal below is one checklist
item; an unfound signal after `search_budget_per_signal` searches (`config/outreach.yaml`) is
recorded as "no evidence found," not chased further.

### Topic-overlap signals

- Recent episodes/issues/posts (last ~90 days) whose subject matter maps onto AI & society,
  fairness, or product/build themes.
- The platform's own stated focus/mission, cross-checked against what it actually publishes.

### Audience-reality signals

- Claimed size (subscriber count, listener count, follower count) as stated publicly.
- Independent engagement evidence: comment activity, reply threads, discussion, guest
  testimonials about audience response, stated open/listen-through rates.
- **Mid-tail sizing (plan §9e / §10, `config/outreach.yaml` `mid_tail_caps`):** a podcast past
  roughly 50k listeners or a newsletter past roughly 50k subscribers is **downgraded, not
  auto-disqualified**. Record the size explicitly as an audience-reality evidence item and note
  it crossed the mid-tail cap; let it pull the fit verdict down a notch (e.g. from `strong`
  toward `partial`), rather than forcing `disqualified`. The engine exists to find the mid-tail
  niches Muxin couldn't find herself; she can hand-add a big name on her own initiative
  separately, so oversized reach is a downgrade signal, not a hard stop.

### Guest-friendliness / pitch-path signals

- A visible "be on the show" / "pitch us" / "write for us" page or mechanism.
- A track record of hosting non-celebrity outside guests or contributors (not just the
  founder/host talking solo, not just industry-famous names).
- Any explicit statement that the show/newsletter is closed to outside contributors (a
  disqualifying-strength signal for this dimension specifically).

### Recency signals

- Date of the most recent public episode/issue/post.
- Any explicit hiatus/on-break/discontinued announcement.

### Disqualifying signals

- No outside-guest history at all and no visible pitch path (see dimension 4 — this caps fit,
  it does not automatically zero it out; see Classification below for when it goes all the way
  to `disqualified`).
- Most recent public output older than roughly 180 days with no announced return (well past the
  90-day recency threshold, functionally abandoned).
- Content that has visibly moved away from AI/society/product themes entirely and shows no sign
  of returning to them.

## Classification

Every platform-kind lead resolves to exactly one of: `strong` | `partial` | `weak` |
`disqualified`.

- **`strong`.** Real topic overlap, a genuinely engaged (not just large) audience, a quoted
  worldview match, and a live, evidenced pitch path.
- **`partial`.** Most dimensions clear but at least one is thin or capped (e.g. mid-tail size
  downgrade, or guest-friendliness unconfirmed rather than confirmed dead).
- **`weak`.** Insufficient evidence to call it either way, or several dimensions are thin —
  `weak` is the platform-kind analog of clients.md's "unclear": **a real, legitimate, surfaced
  outcome, never a forced guess.** Do not round a thin or mixed evidence set up to `strong` or
  `partial` to make the pitch report look more decisive than the research actually supports.
- **`disqualified`.** The platform is dead (no public output well past the recency threshold, no
  announced return) or has an explicitly confirmed closed-to-outside-contributors policy with no
  visible exception, or its content has moved entirely away from relevant themes. Being large is
  never on its own a reason to disqualify — that is the mid-tail downgrade above, not this.

## Shared values — referenced, not duplicated

Worldview fit lives once, canonically, in `config/platforms.yaml` (`home_brand.worldview`,
`home_brand.worldview_expanded`, `spin_angles`) and `config/voice.yaml`, plus Muxin's essays — the
QUALIFY step reads those directly, exactly as clients.md does. A values-fit claim in a pitch
report must quote the platform's own words (with a live link) demonstrating the shared belief; no
quote means the values leg is unmet, not assumed.

`spin_angles` (`config/platforms.yaml`) additionally serves the platform-kind PITCH stage
directly: each entry (`x`, `linkedin`, `substack`, `bluesky`) pairs an audience description with
the specific angle Muxin already uses to reach that audience. When framing why THIS platform's
audience specifically would want Muxin as a guest or contributor, match the platform's real
audience to whichever `spin_angles` entry is the closest analog, and use that entry's `angle`
text as the raw material for the pitch angle — do not invent a new worldview framing from
scratch when an already-approved one fits.
