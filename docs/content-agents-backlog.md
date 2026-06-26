**Confirm we have publishing logic**
- How often per channel and when
- Which topics per channel
- Ensure this actually works. If it’s all wrapped up in 1 single mega skill, we may need to parse it out separately so no single skill is too large.
- STATUS: Backlog
- DEPENDS ON: Skills Sanity Check
<!-- card-id: 2662fffb-33ce-42e2-8815-7db9fbe59086 -->

**Skills Sanity Check**
- Check that no single skill is too large
- Split up bigger skills into smaller ones
- Ensure Orchestrator and /Users/Muxin/Documents/Personal Obsidian/Content Agents.md are updated to run skills in the right order
- STATUS: Backlog
<!-- card-id: 46cc35ff-b565-4c2b-984b-00c2608521cd -->

**Set up a Claude Code cron to automatically pull my substack notes every day and publish them across other channels**
- STATUS: Backlog
- DEPENDS ON: Keeping track of what we've posted, where, when, in what format
<!-- card-id: f26bf827-2833-43ec-b5dc-3c62da0ab3e5 -->

**Keeping track of what we've posted, where, when, in what format**
- We can reuse content but not so frequently.
- I also want to ensure we have a decent variety of different media types to test with - would like to know if different platforms engage better with different kinds of content and message.
- Would want to use this data as part of informing our strategy.
- STATUS: Backlog
<!-- card-id: b5897047-7d77-468c-8d58-85f855838a00 -->

**Voice Notes to Published**
- Allow me to just drop a voice note (or typed) into Claude, we figure out what it should say at the end, and then it automatically runs /atomize or whatever the skills are to create good content out of
- Orchestrator level - I stay out of entering commands, Claude handles figuring out which skill to use. Still checks with me on approving content before they go out, but handles all the scheduling and making sure the right content goes on the right platform at the right cadence and publishing times etc..
- Skills Sanity Check
- STATUS: Backlog
<!-- card-id: 664189d9-8b3f-417f-a077-e8cd71d30477 -->

**Smarter routing**
- No longer going to keep a simple ’subscribe to substack’ CTA - it will depend on the content. See notes:
If the post is derived from a Substack essay and the main value is the argument, CTA = read the full essay / subscribe.

If the post is about a project, tool, system, case study, or build process, CTA = explore the project or landing page.

If the post diagnoses a builder/product problem, CTA = work with me or landing page.

If the post is broad worldview but mentions a concrete artifact, CTA = read essay + see project.

If the post is personal reflection, CTA = follow/subscribe, unless it connects directly to a project.

Mermaid of Job of Each Piece for CTA
flowchart TD
    A[New social/content piece] --> B{Main job of the piece?}

    B -->|Expand an essay idea| C[Send to Substack]
    B -->|Show what you built| D[Send to project page]
    B -->|Diagnose a builder/product problem| E[Send to work-with-me page]
    B -->|Personal reflection or point of view| F[Send to follow/subscribe]
    B -->|Mix of essay + artifact| G[Dual CTA:\nRead essay + see project]

    C --> H[Deepen audience]
    D --> I[Build proof]
    E --> J[Create income opportunity]
    F --> K[Build relationship]
    G --> L[Connect worldview to practice]

Examples - use both Primary and a Secondary CTA

| Content type               | Primary CTA                 | Secondary CTA                    |
| -------------------------- | --------------------------- | -------------------------------- |
| Essay excerpt              | Read full essay on Substack | See related project              |
| Society/capitalism piece   | Subscribe/read more         | Optional: explore projects       |
| AI agency thesis           | Read full essay             | See what I'm building            |
| Product/builder insight    | See how I think/work        | Read related essay               |
| Project demo               | Explore the project         | Work with me                     |
| Offer-adjacent post        | Work with me / landing page | Read my thinking                 |
| Personal career reflection | Subscribe/follow            | Maybe: see my job-search project |
| Case study                 | See projects / work with me | Read the essay behind it         |
- STATUS: Backlog
- DEPENDS ON: Landing page
<!-- card-id: 6dcaee98-1a54-4fc8-b170-92611872676f -->

**Fix atomize notes for generating quote cards**
- They look terrible - the quote itself doesn’t make sense, and it leaves a super long ’title’ at the bottom because it’s using the substack article/post template.
- Also, is this free? It better be - quote cards should just be free, IMO.
- I’d also want it to create animated versions as well as static versions. All free of course. We have the scripts, it just needs to be bundled with whatever creates quote cards - remotion or hyperframes (prefer the latter) are each good at animating quotes/text for free. That’s all I need.
- STATUS: Done
<!-- card-id: e73b6a12-3f31-4a33-b900-5e8295b21c4c -->
