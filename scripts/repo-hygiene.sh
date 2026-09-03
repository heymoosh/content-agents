#!/usr/bin/env bash
# Report-only repo hygiene check. Portable: pure git, no repo-specific paths.
#
# Answers one question — "is there any state here that a later session, or a
# different coding agent, could read as current when it is not?" It reports;
# it never deletes, commits, or prunes. You decide.
#
# Usage: scripts/repo-hygiene.sh [--base <ref>] [--rescue]
#          --base    ref to measure branches against (default origin/main)
#          --rescue  also snapshot uncommitted work to refs/wip/<worktree>
#
# Exit 0 = clean, exit 1 = something needs a decision. Safe in CI either way.

set -uo pipefail

BASE="origin/main"
RESCUE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:?--base needs a ref}"; shift 2 ;;
    --rescue) RESCUE=1; shift ;;
    *) echo "usage: repo-hygiene.sh [--base <ref>] [--rescue]"; exit 2 ;;
  esac
done

# --rescue snapshots a worktree's uncommitted work into refs/wip/<name>, so it
# survives `git clean`, a branch switch, or a machine dying. The commit is built
# through a throwaway index and only its own ref is written, so the live
# worktree, its index and its branch are never touched — this is safe to run
# against a worktree another agent is actively writing in.
#
# Reporting alone does NOT do this, and reporting alone is what loses files.
rescue() {
  local wt="$1" slug idx tree commit
  # printf, not echo — `tr -c` would otherwise translate the trailing newline
  # into a stray '-' and give every ref a dangling suffix.
  slug=$(printf '%s' "$(basename "$wt")" | tr -c 'A-Za-z0-9._-' '-')
  idx="${TMPDIR:-/tmp}/hygiene-index.$$.$RANDOM"
  rm -f "$idx"
  GIT_INDEX_FILE="$idx" git -C "$wt" add -A >/dev/null 2>&1
  tree=$(GIT_INDEX_FILE="$idx" git -C "$wt" write-tree 2>/dev/null)
  rm -f "$idx"
  [ -n "$tree" ] || { echo "    -> snapshot FAILED (write-tree)"; return 1; }
  commit=$(git -C "$wt" commit-tree "$tree" -p HEAD \
    -m "wip snapshot: uncommitted work in $slug ($(date -u +%Y-%m-%dT%H:%M:%SZ))" 2>/dev/null)
  [ -n "$commit" ] || { echo "    -> snapshot FAILED (commit-tree)"; return 1; }
  git -C "$wt" update-ref "refs/wip/$slug" "$commit" 2>/dev/null \
    || { echo "    -> snapshot FAILED (update-ref)"; return 1; }
  echo "    -> snapshotted to refs/wip/$slug ($(git -C "$wt" rev-parse --short "$commit"))"
}

git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repository"; exit 2; }
git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "base ref '$BASE' not found"; exit 2; }

findings=0
note() { findings=$((findings + 1)); }

# 1. Uncommitted work, in EVERY worktree — not just the one you are sitting in.
#    This is the whole of "one copy per artifact" and "nothing valuable stays
#    uncommitted": a stale duplicate of a committed file shows up here as an
#    untracked path. Each listed file is either newer than its committed
#    version (commit it) or superseded by it (delete it). Never both.
echo "== uncommitted work =="
while IFS= read -r wt; do
  [ -d "$wt" ] || continue
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null)
  [ -n "$dirty" ] || continue
  note
  echo "  $wt"
  printf '%s\n' "$dirty" | sed 's/^/    /'
  [ "$RESCUE" -eq 1 ] && rescue "$wt"
done < <(git worktree list --porcelain | awk '/^worktree /{print $2}')
[ "$findings" -eq 0 ] && echo "  (none)"

# 2. Worktrees whose directory is gone. Dead registrations; `git worktree
#    prune` clears them.
echo "== prunable worktrees =="
prunable=$(git worktree list | grep -c ' prunable$' || true)
if [ "${prunable:-0}" -gt 0 ]; then
  note
  git worktree list | grep ' prunable$' | sed 's/^/  /'
  echo "  -> git worktree prune"
else
  echo "  (none)"
fi

# 3. Local branches already contained in the base ref. Their commits live in
#    the base; the branch name is the only thing left, and it makes "which
#    version is current" harder to answer.
echo "== merged branches (safe to delete) =="
merged=0
while IFS= read -r b; do
  git merge-base --is-ancestor "$b" "$BASE" 2>/dev/null || continue
  [ "$(git rev-parse "$b")" = "$(git rev-parse "$BASE")" ] && continue
  merged=$((merged + 1))
  echo "  $b"
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
if [ "$merged" -gt 0 ]; then
  note
  echo "  -> git branch -d <name>"
else
  echo "  (none)"
fi

# 4. Unmerged local branches with no upstream. Informational, not a defect —
#    but each one is work that exists on this machine only.
echo "== unpushed, unmerged branches (local-only work) =="
local_only=0
while IFS= read -r b; do
  git merge-base --is-ancestor "$b" "$BASE" 2>/dev/null && continue
  git rev-parse --verify --quiet "$b@{upstream}" >/dev/null 2>&1 && continue
  local_only=$((local_only + 1))
  echo "  $b ($(git rev-list --count "$BASE..$b") ahead, tip $(git log -1 --format=%ad --date=short "$b"))"
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
[ "$local_only" -eq 0 ] && echo "  (none)"

echo
if [ "$findings" -gt 0 ]; then
  echo "$findings item(s) need a decision. Nothing was changed."
  exit 1
fi
echo "clean. $local_only local-only branch(es) carrying unpushed work."
exit 0
