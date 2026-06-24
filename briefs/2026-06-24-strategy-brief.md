# Strategy Brief: 2026-06-24
data_window: 2025-06-17 → 2026-06-24

Second cycle. One week of new data on top of the baseline, plus two things the first brief was
blind to: Substack Notes are now ingested (the single biggest gap), and we can now tell
machine-distributed posts from hand-written ones. Hold the week-old reads loosely: most of the new
post-level data is one essay's atomized batch (Innovation Nation), so this is more confirmation of
the baseline than a fresh independent cycle.

## Last cycle scorecard

| Bet | Type | Claim | Numbers now | Verdict | New status |
|---|---|---|---|---|---|
| 2026-06-16-001 | DO_MORE | On-pillar X (human-ai+claude-code) out-pulls 'other' | on-pillar X 1.47 vs other 0.60 (beats by 0.87, both >1.3 floor); n=117 | passed | confirmed |
| 2026-06-16-002 | TEST | civic-tech is a real X performer (was 1.7, n=6) | civic-tech X 1.63, n=8 (still <10) | trending, sample short | carried |
| 2026-06-16-003 | DO_LESS | Cutting 'other' on X lifts overall X engagement | 'other' share 31%→23% (cut happened) but overall X avg stuck at 1.28 (<1.3) | half: mix tidied, no lift | carried |
| 2026-06-16-004 | DO_MORE | LinkedIn builder/PM framing beats human-ai framing | claude-code+builder 8.65 vs human-ai 5.5; driven by claude-code (10.93), builder fell to 4.38 | passed (via claude-code) | confirmed |

What we learned: the two DO_MOREs held. On-pillar beats personal on X, and on LinkedIn the
builder/claude-code register beats values framing, though it is claude-code carrying it now, not
builder (builder dropped to 4.38 on n=8, below human-ai). The X 'other'-cut bet is the honest
disappointment: the share did drop, but overall X engagement did not move off 1.28. That is not a
content-mix problem, it is X being structurally low-engagement for this account. civic-tech on X is
still one good week short of a real sample.

## Data confidence

| Channel | Posts | Weeks of data | Status |
|---|---|---|---|
| bluesky | 73 | 28 | OK |
| linkedin | 58 | 53 | OK |
| substack | 6 | 52 | OK |
| substack-note | 20 | 16 | OK |
| x | 184 | 13 | OK |

Same scale caveat as last cycle: LinkedIn reports one lumped engagement count per post, X and
Bluesky give a weighted reply/repost/like score. Read each platform on its own, never across. New
this cycle: `substack-note` is its own channel (note likes/restacks/replies), kept separate from
`substack` essays whose export carries no reaction data. The atomized-vs-organic splits for the new
batch are flagged INSUFFICIENT below and are one week old; do not lean on them yet.

## Channel performance snapshot

| Channel | Posts | Avg engagement | Read |
|---|---|---|---|
| linkedin | 58 | 9.31 (top 44) | strongest channel, biggest audience (2,304) |
| substack-note | 20 | 8.75 (top 67) | the real Substack surface, see below |
| bluesky | 73 | 1.63 (top 14) | small but conversational |
| x | 184 | 1.28 (top 15) | high volume, low return |
| substack (essays) | 6 | 1-3 reactions/post (dashboard) | barely read; export shows 0 |

- **The headline this cycle: Notes are where Substack actually engages, not essays.** Notes
  average 8.75 engagement (top note 67: 37 likes, 10 replies). Essays get 1-3 reactions and 12-46
  views each at a 36% open rate (from the dashboard; the CSV export carries no essay reactions). A
  note is minutes of work and out-engages an essay that takes hours. This is the clearest new
  signal we have.
- **LinkedIn stays the strongest channel on every axis** (avg 9.31, 2,304 followers, +4 this
  week). It is the room with the audience and the engagement.
- **Bluesky is small but conversational** (28 replies across 73 posts). The room that talks back.
- **X is structurally low** (1.28 across 184 posts) and did not move when the post mix improved.
  High effort, low return.

## Topic resonance map

Avg engagement per post (replies ×3, reposts ×2, likes ×1), read DOWN each column on its own scale.

| Pillar | bluesky | linkedin | substack-note | x |
|---|---|---|---|---|
| human-ai | 1.94 · n=16 | 5.5 · n=12 | **13.1 · n=9** | 1.45 · n=71 |
| claude-code | 0.5 · n=2 | **10.93 · n=15** | 1.0 · n=1 | 1.5 · n=46 |
| civic-tech | 1.61 · n=28 | 3.0 · n=2 | 7.6 · n=5 | 1.63 · n=8 |
| career-work | - | 11.8 · n=10 | 7.0 · n=1 | 1.29 · n=7 |
| builder | 0.0 · n=2 | 4.38 · n=8 | 2.0 · n=1 | 1.7 · n=10 |
| other | 1.68 · n=25 | **13.73 · n=11** | 3.0 · n=3 | 0.6 · n=42 |

- **Substack Notes confirm what the first brief only guessed: human-ai and AI-and-society land
  here** (human-ai 13.1, civic-tech 7.6). The society writing Muxin wants to do works, as notes.
- **LinkedIn rewards claude-code (10.93), career-work (11.8) and personal/"other" (13.73); human-ai
  (5.5) and builder (4.38) lag.** Same shape as last cycle. Builder slipped, claude-code is the
  durable LinkedIn winner.
- **Bluesky: human-ai leads (1.94), civic strong on volume (1.61, n=28).** The AI-and-society and
  civic room, as before.
- **X: everything sits between 0.6 and 1.7.** On-pillar beats 'other' (0.6) but nothing on X is
  strong in absolute terms.

## Atomized vs organic

First real data on whether the pipeline earns its keep. Observational, and the atomized cells are
one week old, so treat as a direction to watch, not a verdict.

| Platform | atomized | organic |
|---|---|---|
| x | 3.0 · n=6 ⚠INSUFFICIENT | 1.2 · n=178 |
| bluesky | 1.5 · n=6 ⚠INSUFFICIENT | 1.6 · n=67 |
| linkedin | 2.0 · n=2 ⚠INSUFFICIENT | 9.6 · n=56 |
| substack-note | - | 8.8 · n=20 |

- **On X, the atomized posts (3.0) beat the organic ones (1.2)** roughly 2.5x. Tiny sample, but the
  early read is that extracted/pipeline posts do better than casual hand-posting on X, the platform
  where Muxin posts most and engages least.
- **On LinkedIn it is the reverse** (atomized 2.0 vs organic 9.6). That is the Innovation Nation
  society derivatives landing in a room that wants builder/career content. Consistent with the
  resonance map, not a knock on the pipeline: it is the wrong topic for LinkedIn, not the wrong
  process.

## Audience (who you're reaching)

| Platform | Followers/subs | Recent net growth | Demographics |
|---|---|---|---|
| linkedin | 2,304 | +4 | yes |
| bluesky | 34 | - | none |
| substack | 33 free / 0 paid | - | tier only |

LinkedIn is Senior 38% / Director 15%, by title Product Manager 6% / Founder 6% / Co-Founder 4%, in
Technology / Software / IT, concentrated in Houston (18%), SF Bay (14%), NYC (6%). The audience and
the engagement agree: a room of PMs and founders rewards claude-code/career content and is lukewarm
on values. human-ai's home is the small but on-pillar Bluesky and Substack-Notes rooms. Substack is
still 100% free (0 paid), so the funnel goal stays "grow the free list," not monetize yet.

## Routing map (what to post where)

| Pillar | bluesky | community:democratic-resilience | linkedin | x |
|---|---|---|---|---|
| human-ai | include | - | include | include |
| claude-code | include | - | include | include |
| civic-tech | include | include | skip | include |
| career-work | skip | - | include | include |
| builder | skip | - | include | include |
| other | include | - | include | include |

Data-driven now that the pillars are tagged. One refinement the resonance map argues for but the
router has not yet caught: human-ai on LinkedIn is `include` at a weak fit, and the atomized-vs-
organic split says society/human-ai underperforms there. Treat human-ai → LinkedIn as low priority
by hand until the data forces the router to skip it. Notes are a SOURCE (like Substack essays), not
a routing target.

## Community signals

`community-log.md` still has only the seed democratic-resilience entry ("action-oriented, specific
posts beat general civic commentary"). The Innovation Nation civic post shipped to democratic-
resilience this cycle but no observation was logged. The highest-leverage 30-second habit remains:
log a line after each community post and after notable Notes, since both are invisible to the
exports.

## Recommendations

1. **[DO MORE] Lean into Substack Notes, and spread them.** Notes out-engage essays by multiples
   (8.75 vs 1-3 reactions) for a fraction of the effort, and human-ai/civic notes are the highest
   cells in the whole map (13.1, 7.6). This is the highest-ROI surface Muxin has. Keep writing
   notes, and use `/atomize notes` to cross-post the strong ones to Bluesky (the room that wants
   human-ai/civic) and selectively to LinkedIn only when a note is builder/career-shaped.
2. **[TEST] The pipeline beats hand-posting on X.** Atomized X posts scored 3.0 vs 1.2 organic.
   Tiny sample (n=6). If it holds to n≥10, stop hand-writing on X and let the pipeline feed it.
3. **[DO LESS] Stop routing society/human-ai essays to LinkedIn.** The atomized human-ai
   derivatives scored 2.0 there vs 9.6 organic, and human-ai is the weakest LinkedIn pillar (5.5).
   Keep LinkedIn for claude-code, career-work, and personal; send the human-ai/society work to
   Bluesky and Substack Notes where it lands.

The funnel goal is unchanged: feed everything into the free Substack list (33 and climbing), which
is why every cross-post's CTA points back to Substack.

## Directives for atomization
- prioritize_pillar: human-ai (as NOTES and on Bluesky/Substack), claude-code + career-work (on LinkedIn)
- channel_emphasis: substack-notes are the highest-ROI surface, spread the strong ones; bluesky for human-ai + civic; linkedin for claude-code/career/personal, NOT human-ai/society; x = reach net, pipeline-fed not hand-posted; community for civic
- format_notes: "Notes and their cross-posts are near-verbatim short takes, that is the format that wins. On X, lead with the contrarian take, short singles. On LinkedIn, open on product/builder/career craft, never philosophy. On Bluesky, human-ai and civic earn replies."
- hooks_that_worked: ["It's honestly difficult to pay attention to How to boost your productivity with AI content", "I want to live in a world that feels free and fair", "how i failed to build a simple hackathon", "for anyone looking for ai product roles"]
