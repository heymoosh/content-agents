# Worked examples

All ten frames, filled. **The filled material is placeholder, written to demonstrate the fill step,
not proposed copy.** Nothing here is a claim Muxin has made. Real use fills the slots from her own
thought, claim, experience or evidence.

Support reads as: entries / distinct creators / top-quartile among ranked instances. The corpus base
rate is 28%.

| Frame | Support | Template | Filled |
|---|---|---|---|
| `today-i-want-to-share` | 31e / 4c / 7 of 29 | Today, I want to share {promise}. | Today, I want to share the review step that catches everything my tests do not. |
| `hi-im-name-role` | 19e / 8c / 6 of 19 | Hi, I am {name}. I am a {role}. {purpose_of_piece}. | Hi, I am Muxin. I am a product manager. This is how I run a week. |
| `ive-been-for-timespan` | 11e / 8c / 4 of 11 | I have been {state} for {timespan} now. | I have been shipping one small thing a day for three months now. |
| `challenge-experiment-premise` | 6e / 3c / 3 of 6 | {question} I am going to {action}. My goal: {outcome} | Can a solo operator run a real content pipeline? I am going to run mine in the open for thirty days. My goal: one publishable piece a day |
| `im-a-role-here-is` | 5e / 3c / 4 of 5 | I am a {role}, and here is {promise}. | I am a product manager who writes her own code, and here is the part of the job nobody puts in the ladder. |
| `built-because-pain` | 4e / 4c / 1 of 3 | Got tired of {object}, so I {action} | Got tired of copying the same numbers between four dashboards, so I built one that reads them all |
| `guest-post-by` | 3e / 2c / 2 of 3 | Guest post by {name}, a {credential} who {background}. | Guest post by a colleague, a staff engineer who has shipped this three times. |
| `used-to-think-now` | 3e / 2c / 1 of 3 | I used to think {old_belief}. Now {new_belief}. | I used to think a backlog was a plan. Now it is mostly a list of things nobody decided. |
| `i-just-bought-then` | 2e / 2c / 2 of 2 | I just bought {object}. And then I {next_action}. | I just bought a year of a tool I already had. And then I cancelled the other three. |
| `if-youve-ever-read-this` | 2e / 2c / 1 of 2 | If you have ever {experience}, read this. | If you have ever shipped something nobody used, read this. |

All ten exit 0 with `review: pending` and their source refs attached. A fill carrying an em dash, an
unfilled slot, or a known AI tell exits 1 with the reason.

## Before and after

Before this change there was no path from the corpus to a draft opening. The 69 mechanism proposals
could tell you a belief-correction opener exists across several creators. They could not give you
the sentence.

```
before:  mech:framing:conventional-belief-corrective-stance
         "Names a belief, default answer, or objection the audience already holds,
          then treats the rest of the piece as correcting or clearing it."
         (a description; nothing to type)

after:   used-to-think-now
         I used to think {old_belief}. Now {new_belief}.
         seen: 3 entries across 2 creators; 1/3 ranked instances top-quartile (33%)
```

## What got dropped, and why it matters

31 of 41 candidate frames failed the grounding check. A representative sample of what was rejected
and the phrase that killed it:

| Dropped frame | Offending fixed wording | Why |
|---|---|---|
| `on-date-event` | "here is what followed" | in none of its 51 cited hooks |
| `most-advice-is-bad` | "is not very good here is what works instead" | in none of its cited hooks |
| `quoted-line-stuck` | "and i keep thinking about it" | in none of its cited hooks |
| `imagine-scenario` | "stick with me for a moment" | in none of its cited hooks |
| `numbered-change-your-life` | "that will change your life if you start them" | in none of its cited hooks |
| `do-not-use-if-unknown` | "if you do not know how or it will" | one creator's sentence only |
| `percent-have-never` | "not even once" | one creator's phrasing only |
| `conventional-wisdom-pivot` | "much has been said about" | one creator's phrasing only |
| `did-it-hurt-when` | "did it hurt when you realized" | one creator's phrasing only |
| `follower-count-then-system` | "i use to" | one creator's phrasing only |

The full list is `verify`'s output before the bank was trimmed; the drops are reproducible by
restoring a candidate and re-running it.

The pattern is worth naming plainly. Asked to produce templates, the model wrote the connective
tissue templates are supposed to have, whether or not anyone had written it. Cross-creator counting
did not catch that, because the invented wording was attached to real, correctly cited hooks. Only
checking the template's own words against those hooks caught it.
