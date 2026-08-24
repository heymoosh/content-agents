# `<task-id>`

## Outcome

One observable, bounded result. State what becomes true, not the implementation approach.

## Decisions already made

- Record every product decision the worker needs.
- If a material choice is unresolved, keep the task `awaiting-user` instead of leasing it.

## Required context

List only the root/scoped rules and `context_paths` named in `work.yaml`. Do not link other vision
documents, task packets, backlog files, unrelated corpus data, or raw pattern bodies.

## Boundaries

- Write paths: copy from the lease.
- Forbidden paths: copy from the lease.
- Semantic locks: copy from the lease.
- Preserve existing capabilities and public behavior unless this packet explicitly says otherwise.

## Acceptance criteria

- A concrete behavioral or structural predicate.
- All changed paths are inside the write lease.
- Every `acceptance_commands` entry passes.
- If `user_visible_behavior` is true, provide the disposable-worktree e2e evidence.
- If `content_logic_change` is true, provide before/after samples and stop at Muxin's human gate.

## Builder return

Return one commit and a JSON builder report matching `protocol.md`. Do not edit `work.yaml` or
`runs/`, and do not resolve integration conflicts outside this task worktree.
