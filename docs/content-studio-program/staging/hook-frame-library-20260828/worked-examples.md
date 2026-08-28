# Worked examples

Eight frames filled, to show the mechanics. **The filled material below is placeholder, written to
demonstrate the fill step, not proposed copy.** Nothing here is a claim Muxin has made. Every real
use fills the slots from her own thought, claim, experience or evidence.

| Frame | Template | Filled |
|---|---|---|
| `conventional-wisdom-pivot` | Much has been said about {object}. But {surprising_result}. | Much has been said about AI replacing product managers. But the teams shipping fastest kept a human owning the roadmap. |
| `used-to-think-now` | I used to think {old_belief}. Now {new_belief}. | I used to think a backlog was a plan. Now it is mostly a list of things nobody decided. |
| `most-advice-is-bad` | Most {subject} is not very good. Here is what works instead. | Most advice about breaking into product is not very good. Here is what works instead. |
| `over-past-i-have` | Over the past {timespan}, I have {effort}. Here is what still works. | Over the past six months, I have rebuilt the same pipeline three times. Here is what still works. |
| `i-had-to-action` | I {noticed_thing}, so I had to {action}. | I kept reopening the same review queue, so I had to automate the boring half. |
| `if-you-have-identity` | If you have {identity}, you need to {directive}. | If you have a day job and a side project, you need to protect the first hour. |
| `quoted-line-stuck` | Someone said "{object}" and I keep thinking about it. | Someone said "ship the org chart" and I keep thinking about it. |
| `delayed-post-confession` | I was planning to {action}, but {surprising_result} | I was planning to write about the analytics pipeline, but what broke was my own review habit |

Each of those exits 0 with `review: pending` and its source refs attached. A fill carrying an em
dash, an unfilled slot, or a known AI tell exits 1 with the reason.

## Before and after

Before this change there was no way to go from the corpus to a draft opening. The 69 mechanism
proposals could tell you that a "belief reversal opener" exists across several creators. They could
not give you the sentence.

```
before:  mech:framing:conventional-belief-corrective-stance
         "Names a belief, default answer, or objection the audience already holds,
          then treats the rest of the piece as correcting or clearing it."
         (a description; nothing to type)

after:   used-to-think-now
         I used to think {old_belief}. Now {new_belief}.
         seen: 3 entries across 2 creators; 1/3 ranked instances top-quartile (33%)
```

## The bank as it stands

41 frames. Support is thin and the README says so plainly: only six frames have ten or more
instances, and a share computed over two or four is noise. The frames themselves are the deliverable
right now; the performance column becomes worth reading as more of the corpus gets labelled.

| instances | frames |
|---|---|
| 20 or more | 2 |
| 10 to 19 | 4 |
| 5 to 9 | 13 |
| 2 to 4 | 22 |

Every frame is `review: pending` and `originality: pending`. `list` hides them all until Muxin marks
them approved in `config/hook-frames.jsonl`; `--include-pending` is the only way to see the bank
before then.
