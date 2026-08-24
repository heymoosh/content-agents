# Content Studio program charter

## North star

Content Studio is one calm, attended workspace that turns Muxin's source material into reviewed,
traceable platform treatments and preserves the repository's existing engines. It coordinates
work; it is not an autopilot, a second virality system, or a replacement for human judgment.

## Safety walls

- Muxin supplies claims, voice, taste, account decisions, and the final yes. Nothing publishes
  without the existing review gates.
- Rehost Fiction, Venture, Outreach, Signals, Charles, approvals, scheduling, publishing, jobs,
  and model routing. Do not rebuild them.
- Preserve the existing TypeScript and local-server architecture during the first tranche. Do not
  introduce a React migration, Tiptap, Zustand, TanStack Query, or Tailwind.
- Keep Build 2 Fiction, Build 3 Venture, Build 4 Charles, and Muxin-voice content inside their
  existing scoped walls and `AGENTS.md` rules.
- Keep raw pattern bodies local and out of coordinator context. The coordinator receives task
  metadata, summaries, diffs, commands, and reports only.
- Only one data steward may write canonical `data/patterns/**` records. Research work writes
  isolated staging packages.
- Content generation consumes reviewed platform-treatment and body-free template interfaces. It
  does not create a parallel evidence or virality layer.
- Any content-generation-logic change stays separate, includes before/after samples, and waits at
  the repository's human gate.
- The coordinator never implements product features, resolves integration conflicts, manages
  agents, writes product state, edits the existing backlog, or shares a worker-edited `STATE.md`.

## Preserved capabilities

Studio already has multi-engine execution, approval gates, room workflows, job tracking, and
publishing. Fiction, Venture, Outreach, Charles, Signals, Content, review, scheduling, and provider
routing remain authoritative in their current modules. Early Studio work extracts room-specific
client and server modules without behavior change, then rehosts existing capabilities one vertical
slice at a time.

## Gate 0 and initial lanes

PR #387 merged at `76f684077ca04d217d319761c4dcf09426192dc2`; it and the checked-in content
system blueprint are inherited work, not requirements to reimplement. Program work starts from an
explicit clean SHA and never uses a dirty checkout as a task baseline.

The pattern-evidence lane proceeds from human-reviewed candidate-account slates, to a body-free
completeness report, to exclusive canonical-data stewardship, the reviewed account/topic/platform/
medium/format matrix, body-free mechanism templates, and an independent originality/evidence audit.
Candidate slates do not become "best" claims before review and adequate denominators.

The inherited starting snapshot is descriptive, not approval: 499 corpus records, 292 analyses,
12 baselines, and 225 staged Reddit records are parse-valid but unreviewed; all 499 normalized
source-evidence rows remain blocked. The catalog has 371 account keys and zero usable targets in
the reviewed platform/pool matrix. Of 350 confirmed account targets, 345 still need valid baseline
measurement. Eight curated mad-lib hook mechanisms cover seven platforms. These facts authorize
candidate and completeness work only, not "best niche," "best broad-platform," winner, or proven
virality claims.

The Studio lane may run beside it only on disjoint leases. It begins with behavior-preserving
module extraction from the large Studio client/server/job files. Content recipe integration waits
for the reviewed treatment/template interface.

## Authoritative documents

- [Repository architecture and safety rules](../../CLAUDE.md)
- [Content system blueprint](../content-system-blueprint.md)
- [Content Studio vision](../content-studio-vision.md)
- [Gemini review brief](../content-studio-gemini-review-brief.md)
- [Multi-engine plan](../multi-engine-plan.md)
- [Pattern-mining plan](../pattern-mining-plan.md)
- [Studio reset handoff](../content-studio-reset-handoff.md)

`work.yaml` is the sole durable coordination record. Product documents remain authoritative for
product behavior; this charter summarizes their shared boundary rather than replacing them.
