<!-- last-archive: 2026-07-02T16:18:39.271788+00:00 -->

## Archived 2026-07-02T16:18:39.270246+00:00

**Fix the stale YouTube step in publish SKILL.md**
- - The publish SKILL.md Step 3 still says "private upload; flip in Studio" but src/publish/youtube.ts now uses status.publishAt to auto-schedule the publish (since the cadence update).
- Doc-only fix (~4 lines) to match current behavior. No code change.
- Found during the "Confirm we have publishing logic" audit (PR #50).
- STATUS: Done
<!-- card-id: 420e2ffb-d045-4b7a-9cd4-a920f01b217b -->

**Confirm we have publishing logic**
- How often per channel and when
- Which topics per channel
- Ensure this actually works. If it’s all wrapped up in 1 single mega skill, we may need to parse it out separately so no single skill is too large.
- STATUS: Done
- DECISION: hold — audit publishing cadence and topics per channel and report; propose (not execute) any skill split; blocked tonight by Skills Sanity Check
<!-- card-id: 2662fffb-33ce-42e2-8815-7db9fbe59086 -->

**Add a --force-reuse override flag to publish:typefully and publish:cards**
- Add a --force-reuse CLI flag so a re-publish can intentionally override the reuse-frequency guard without editing config.
- Builds on the reuse guard shipped in PR #44.
- STATUS: Done
- DECISION: hold — small follow-up; build as a draft PR for review, not auto-merge
<!-- card-id: d2388491-7088-488f-8e9d-f10fac741eeb -->

**Wire the reuse-frequency guard into publish:youtube and publish:tiktok**
- Extend src/publish/reuse-guard.ts checkReuse() into the youtube and tiktok publish paths for completeness.
- Add min_reuse_days entries for youtube/tiktok in config/platforms.yaml.
- Builds on the reuse guard shipped in PR #44.
- STATUS: Done
- DECISION: hold — small follow-up; build as a draft PR for review, not auto-merge
<!-- card-id: a9ccabf1-3241-4767-9d0b-84c9d280b4ab -->

**Set media_type='note' on the /atomize notes ingest path**
- When the /atomize notes ingestion (fetch-substack-notes) records posts, set media_type='note' explicitly.
- Today notes land as platform=substack, format=text, so they collapse into media_type='text' and lose the note distinction.
- Builds on the media_type dimension shipped in PR #44.
- STATUS: Done
- DECISION: hold — small follow-up; build as a draft PR for review, not auto-merge
<!-- card-id: 5bb61c81-bb34-4e93-a482-c611b035d367 -->

**Execute the atomize skill split**
- Split .claude/skills/atomize/SKILL.md into a leaner core plus references/ files loaded on demand, per the skills audit.
- Proposed structure: core SKILL.md plus references/notes-mode.md, references/spin-mode.md, references/revise-mode.md.
- Pure refactor: do NOT change what /atomize does. The core SKILL.md must reference the split-out files so behavior is unchanged.
- Story skill split is deliberately NOT in scope (Muxin's call).
- STATUS: Done
- DECISION: hold — execute the atomize split per the audit; pure refactor, /atomize behavior unchanged; story skill NOT in scope
<!-- card-id: 814b2e5a-5749-4c96-a298-bfd4dd6f52f3 -->

**Skills Sanity Check**
- Check that no single skill is too large
- Split up bigger skills into smaller ones
- Ensure Orchestrator and /Users/Muxin/Documents/Personal Obsidian/Content Agents.md are updated to run skills in the right order
- STATUS: Done
- DECISION: hold — audit each skill's size and propose a split plan only; do NOT execute splits; do NOT edit the external Personal Obsidian/Content Agents.md; output a markdown report
<!-- card-id: 46cc35ff-b565-4c2b-984b-00c2608521cd -->

**Keeping track of what we've posted, where, when, in what format**
- We can reuse content but not so frequently.
- I also want to ensure we have a decent variety of different media types to test with - would like to know if different platforms engage better with different kinds of content and message.
- Would want to use this data as part of informing our strategy.
- STATUS: Done
- DECISION: hold — build the gap vs existing tracking: a reuse-frequency guard plus a media-type/format analytics dimension
<!-- card-id: b5897047-7d77-468c-8d58-85f855838a00 -->

**Fix atomize notes for generating quote cards**
- They look terrible - the quote itself doesn’t make sense, and it leaves a super long ’title’ at the bottom because it’s using the substack article/post template.
- Also, is this free? It better be - quote cards should just be free, IMO.
- I’d also want it to create animated versions as well as static versions. All free of course. We have the scripts, it just needs to be bundled with whatever creates quote cards - remotion or hyperframes (prefer the latter) are each good at animating quotes/text for free. That’s all I need.
- STATUS: Done
<!-- card-id: e73b6a12-3f31-4a33-b900-5e8295b21c4c -->
