#!/bin/bash
set -euo pipefail

if [[ "${CANARY_I_MEAN_IT:-}" != "1" ]]; then
  echo "Refusing: set CANARY_I_MEAN_IT=1 only after approving the bounded canary." >&2
  exit 64
fi
if [[ "${CROSS_FAMILY_AUDIT_PASSED:-}" != "1" ]]; then
  echo "Refusing: the cross-family security audit must pass first (CROSS_FAMILY_AUDIT_PASSED=1)." >&2
  exit 64
fi

run_base="${1:-}"
attempt="${2:-1}"
source_worktree="${SOURCE_WORKTREE:-/private/tmp/content-agents-routing-gate}"
execution_mode="${CANARY_EXECUTION_MODE:-live}"
if [[ ! "$run_base" =~ ^/private/tmp/content-routing-canary-runs/[A-Za-z0-9._-]+$ ]]; then
  echo "run base must be a simple fresh path under /private/tmp/content-routing-canary-runs/" >&2
  exit 64
fi
if [[ "$attempt" != "1" && "$attempt" != "2" ]]; then
  echo "attempt must be 1, or 2 for the single permitted retry" >&2
  exit 64
fi
if [[ "$execution_mode" != "live" && "$execution_mode" != "fake-cli-dry-run" ]]; then
  echo "CANARY_EXECUTION_MODE must be live or fake-cli-dry-run" >&2
  exit 64
fi
if [[ "$attempt" == "2" ]]; then
  isolation_postcheck="$run_base/attempt-1/artifacts/isolation-postcheck.json"
  if [[ ! -f "$run_base/attempt-1/artifacts/exit-code" ]]; then
    echo "retry refused: attempt 1 has no completed exit record" >&2
    exit 64
  fi
  if [[ ! -f "$isolation_postcheck" ]] || ! grep -Eq '"retryAuthorized"[[:space:]]*:[[:space:]]*true' "$isolation_postcheck"; then
    echo "retry refused: attempt 1 has no documented retry-authorizing isolation failure" >&2
    exit 64
  fi
fi
if [[ ! -d "$source_worktree/.git" && ! -f "$source_worktree/.git" ]]; then
  echo "feature worktree is unavailable: $source_worktree" >&2
  exit 66
fi

attempt_root="$run_base/attempt-$attempt"
repo="$attempt_root/repo"
artifacts="$attempt_root/artifacts"
if [[ -e "$attempt_root" ]]; then
  echo "refusing to overwrite preserved attempt: $attempt_root" >&2
  exit 73
fi
mkdir -p "$run_base" "$attempt_root" "$artifacts"
chmod 700 "$run_base" "$attempt_root" "$artifacts"

record_exit() {
  local status=$?
  if [[ ! -e "$artifacts/exit-code" ]]; then
    printf '%s\n' "$status" > "$artifacts/exit-code"
    chmod 600 "$artifacts/exit-code"
  fi
  node /private/tmp/content-routing-canary/record-postcheck.mjs "$artifacts" "$status"
}
trap record_exit EXIT

source_head="$(git -C "$source_worktree" rev-parse HEAD)"

# A new source-only repository: no source objects, refs, remotes, alternate-object links,
# product history, docs, secrets, or operational trees ever enter the fixture.
mkdir -p "$repo"
git -C "$repo" init --quiet --initial-branch=canary-fixture
copy_excludes=(
  --exclude='.git/' --exclude='.codex/' --exclude='.claude/' --exclude='.mcp.json'
  --exclude='.env*' --exclude='content/' --exclude='data/' --exclude='auth.json'
  --exclude='*.pem' --exclude='*.key' --exclude='*.p12' --exclude='*.pfx'
  --exclude='id_rsa' --exclude='id_ed25519' --exclude='*private-key*' --exclude='*private_key*'
  --exclude='*.local.*' --exclude='*secret*'
)
rsync -a "${copy_excludes[@]}" "$source_worktree/src/" "$repo/src/"
rsync -a "${copy_excludes[@]}" "$source_worktree/config/" "$repo/config/"
for name in package.json package-lock.json tsconfig.json remotion.config.ts; do
  if [[ -f "$source_worktree/$name" ]]; then cp "$source_worktree/$name" "$repo/$name"; fi
done

if [[ ! -f "$repo/src/strategy/recorded-routing.ts" ]]; then
  echo "source-only fixture is missing the audited untracked routing parser" >&2
  exit 65
fi
if [[ -n "$(find "$repo/src" "$repo/config" -type l -print -quit)" ]]; then
  echo "source-only fixture refused symlinks" >&2
  exit 65
fi
while IFS= read -r path; do
  rel="${path#"$repo"/}"
  base="${path##*/}"
  case "/$rel/" in
    */content/*|*/data/*) echo "forbidden operational path in fixture: $rel" >&2; exit 65 ;;
  esac
  case "$base" in
    .env|.env.*|auth.json|*.pem|*.key|*.p12|*.pfx|id_rsa|id_ed25519|*private-key*|*private_key*|*.local.*|*secret*)
      echo "forbidden credential/config filename in fixture: $rel" >&2
      exit 65
      ;;
  esac
done < <(find "$repo" -path "$repo/.git" -prune -o -print)
if [[ -e "$repo/.git/objects/info/alternates" ]] || [[ -n "$(git -C "$repo" remote)" ]] || [[ -n "$(git -C "$repo" rev-list --all)" ]]; then
  echo "fixture Git repository unexpectedly contains history, remotes, or alternate objects" >&2
  exit 65
fi

printf 'source_worktree=%s\nsource_head=%s\nattempt=%s\nexecution=%s\nfixture_git_commits=0\nfixture_git_remotes=0\n' \
  "$source_worktree" "$source_head" "$attempt" "$execution_mode" > "$artifacts/manifest.txt"
git -C "$source_worktree" status --short > "$artifacts/source-status.txt"
(
  cd "$repo"
  find src config -type f -print
  for name in package.json package-lock.json tsconfig.json remotion.config.ts; do [[ -f "$name" ]] && printf '%s\n' "$name"; done
) | LC_ALL=C sort | while IFS= read -r path; do
  (cd "$repo" && shasum -a 256 "$path")
done > "$artifacts/source-files.sha256"
printf 'source_files_sha256=%s\n' "$(shasum -a 256 "$artifacts/source-files.sha256" | awk '{print $1}')" >> "$artifacts/manifest.txt"
chmod 600 "$artifacts/manifest.txt" "$artifacts/source-status.txt" "$artifacts/source-files.sha256"

cp /private/tmp/content-routing-canary/live-canary.ts "$repo/live-canary.ts"
node_bin="$(command -v node)"
npm_bin_dir="$(dirname "$(command -v npm)")"
if [[ "$execution_mode" == "fake-cli-dry-run" ]]; then
  model_cli="${CANARY_FAKE_CLI:-}"
  auth_codex_home="$attempt_root/fake-codex-home"
  mkdir -p "$auth_codex_home"
  chmod 700 "$auth_codex_home"
else
  model_cli="$(command -v codex)"
  auth_codex_home="${CODEX_HOME:-$HOME/.codex}"
fi
if [[ "$model_cli" != /* || ! -x "$model_cli" ]]; then
  echo "selected Codex CLI is unavailable or not an absolute executable" >&2
  exit 69
fi

# Dependency setup receives only a minimal, credential-free environment.
mkdir -p "$attempt_root/npm-home" "$attempt_root/tmp"
chmod 700 "$attempt_root/npm-home" "$attempt_root/tmp"
npm_cache="$attempt_root/npm-cache"
npm_cache_mode=()
if [[ -n "${CANARY_NPM_CACHE:-}" ]]; then
  [[ "$CANARY_NPM_CACHE" == /* && -d "$CANARY_NPM_CACHE/_cacache" ]] || { echo "CANARY_NPM_CACHE must be an absolute npm content cache" >&2; exit 65; }
  npm_cache="$CANARY_NPM_CACHE"
  npm_cache_mode=(--offline)
else
  mkdir -p "$npm_cache"
  chmod 700 "$npm_cache"
fi
mkdir -p "$attempt_root/npm-logs"
chmod 700 "$attempt_root/npm-logs"
/usr/bin/env -i \
  PATH="$npm_bin_dir:/usr/bin:/bin:/usr/sbin:/sbin" \
  HOME="$attempt_root/npm-home" \
  TMPDIR="$attempt_root/tmp" \
  CI=1 \
  npm --prefix "$repo" ci --ignore-scripts --no-audit --no-fund --cache "$npm_cache" --logs-dir "$attempt_root/npm-logs" "${npm_cache_mode[@]}" > "$artifacts/npm-ci.log" 2>&1

mkdir -p \
  "$artifacts/content-agents-data" "$artifacts/content-agents-home" \
  "$artifacts/process-home" "$artifacts/xdg-data" "$artifacts/xdg-config" "$artifacts/xdg-cache"
chmod 700 \
  "$artifacts/content-agents-data" "$artifacts/content-agents-home" \
  "$artifacts/process-home" "$artifacts/xdg-data" "$artifacts/xdg-config" "$artifacts/xdg-cache"

cd "$repo"
set +e
/usr/bin/env -i \
  PATH="/private/tmp/content-routing-canary:$npm_bin_dir:/usr/bin:/bin:/usr/sbin:/sbin" \
  HOME="$artifacts/process-home" USER="${USER:-canary}" LOGNAME="${LOGNAME:-canary}" \
  LANG="${LANG:-en_US.UTF-8}" TMPDIR="$attempt_root/tmp" \
  XDG_DATA_HOME="$artifacts/xdg-data" XDG_CONFIG_HOME="$artifacts/xdg-config" XDG_CACHE_HOME="$artifacts/xdg-cache" \
  CODEX_HOME="$auth_codex_home" \
  CANARY_I_MEAN_IT=1 CROSS_FAMILY_AUDIT_PASSED=1 \
  CANARY_REAL_CODEX="$model_cli" CANARY_REPO="$repo" CANARY_ATTEMPT_TMP="$attempt_root/tmp" \
  CANARY_ARTIFACTS="$artifacts" CANARY_ENGINE_EXECUTION="$execution_mode" \
  CONTENT_AGENTS_DATA_ROOT="$artifacts/content-agents-data" \
  CONTENT_AGENTS_TEST_JOB_STORE="$artifacts/content-agents-data/jobs/review-jobs.json" \
  CONTENT_AGENTS_HOME="$artifacts/content-agents-home" \
  "$node_bin" /private/tmp/content-routing-canary/wallclock.mjs 1440 \
    "$node_bin" --import tsx "$repo/live-canary.ts" > "$artifacts/canary.log" 2>&1
status=$?
set -e

chmod 600 "$artifacts/canary.log" "$artifacts/npm-ci.log"
if [[ "$status" -eq 0 ]]; then
  echo "Canary passed ($execution_mode). Private evidence: $artifacts"
else
  echo "Canary failed with exit $status ($execution_mode). Evidence is preserved at: $artifacts" >&2
fi
exit "$status"
