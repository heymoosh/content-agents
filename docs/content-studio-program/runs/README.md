# Coordinator run records

The coordinator creates `runs/<batch-id>/<task-id>.json` from submitted builder, audit, diff, and
integration evidence. Workers never write here. No run exists until an approved task reports work.
