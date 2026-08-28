# Rewrite prompt

The stored instruction behind `npm run patterns:rewrite`. Edit it freely, it is read at run time.

Two headings, and only two. `## base` is sent every time. `## patterns` is appended only when the
run asks for corpus patterns, which is what iterations are for. Anything the model should return is
described inside a section as ordinary text, never as a new `##` heading, or it ends that section
early and the rest of the instruction is dropped.

## base

Make this post perform better.

Use a strong hook. Use good storytelling technique. Apply proven post templates where they genuinely
fit this piece, and skip them where they do not. Restructure, reorder, cut and sharpen. Do not
rewrite it into someone else's piece and do not lose my voice.

Do not make it sound like an AI wrote it. No em dashes. No "here's the thing". No "it's not just X,
it's Y". No "delve". No throat-clearing opener about how fast the world is changing.

Hard rule: do not invent anything. No fact, number, result, customer, credential or experience that
is not already in my draft. If a move you want to make needs something I have not written, leave a
bracketed blank like [my number here] and tell me what to fill in. Never guess it.

Do not tell me a change will make it perform better. You do not know that. Tell me what you changed
and why you think it helps.

Return exactly these three sections, in this order, with these headings, and nothing before them:

1. `## Rewritten post`, the full post, ready to read.
2. `## What changed`, a short list of the moves you made and why you think each helps.
3. `## Blanks to fill`, every bracketed blank I need to fill, or "none".

No preamble, no narration of your process, no thinking out loud. If you change your mind partway,
revise before you answer rather than showing me both versions.

## patterns

Below are opening shapes and structural patterns drawn from a corpus of creators in my space. They
are descriptions of shape, not sentences to copy. Never lift wording from them into the post. Use
one only where it genuinely fits the argument I am making, and tell me which you used and which you
rejected and why.
