#!/usr/bin/env bash
# Paced fetcher for Reddit's public top-of-year RSS feeds. Read-only, logged out, no credentials
# and no API key. Saves the raw feed bytes untouched and parses nothing: staging is
# src/patterns/reddit-rss.ts's job, so fetching and interpreting stay separable.
#
#   bash scripts/reddit-rss-fetch.sh <out-dir> <sub> [sub...]
#   bash scripts/reddit-rss-fetch.sh data/patterns/rss ADHD civictech Entrepreneur
#
# WHY THIS EXISTS. The better route is the OAuth JSON API (npm run patterns:reddit), which returns
# scores and can measure a real community baseline. It needs a free API key. Without one, every
# other Reddit surface is walled: on 2026-08-23 both curl and a real headless Chrome got HTTP 403
# "You've been blocked by network security" from old.reddit.com and www.reddit.com alike, on the
# HTML pages and the .json routes. This RSS surface was the only one still answering.
#
# Reddit rate-limits it ferociously: a success is routinely followed by 429s. So 429 is treated as
# the normal state, not an error. Requests are spaced by BASE_DELAY and a 429 backs off
# exponentially rather than retrying fast. Measured 2026-08-23: 45s spacing retrieved 9 of 9 feeds,
# 2 of them needing one backoff retry each. Do not lower BASE_DELAY without re-measuring.
set -u

OUT_DIR="$1"; shift
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
BASE_DELAY=45
MAX_ATTEMPTS=6

mkdir -p "$OUT_DIR"
failed=""
total=$#
i=0

for sub in "$@"; do
  i=$((i+1))
  echo "[$i/$total] $sub"
  url="https://www.reddit.com/r/${sub}/top/.rss?t=year"
  out="$OUT_DIR/$(echo "$sub" | tr '[:upper:]' '[:lower:]')-top-year.xml"
  backoff=60
  ok=0
  for attempt in $(seq 1 $MAX_ATTEMPTS); do
    code=$(curl -sS -L -A "$UA" \
      -H 'Accept: application/atom+xml,application/xml,text/xml,*/*' \
      -H 'Accept-Language: en-US,en;q=0.9' \
      --max-time 45 -o "$out.tmp" -w '%{http_code}' "$url" 2>/dev/null)
    size=$(wc -c < "$out.tmp" 2>/dev/null | tr -d ' ')
    if [ "$code" = "200" ] && grep -q '<feed' "$out.tmp" 2>/dev/null; then
      mv "$out.tmp" "$out"
      echo "  attempt $attempt: HTTP 200, $size bytes -> $out"
      ok=1
      break
    fi
    echo "  attempt $attempt: HTTP $code ($size bytes), backing off ${backoff}s"
    sleep $backoff
    backoff=$((backoff*2))
    [ $backoff -gt 480 ] && backoff=480
  done
  rm -f "$out.tmp"
  [ $ok -eq 0 ] && { echo "  GAVE UP on $sub. Nothing written."; failed="$failed $sub"; }
  if [ $i -lt $total ]; then
    echo "  pausing ${BASE_DELAY}s"
    sleep $BASE_DELAY
  fi
done

echo ""
echo "Done."
[ -n "$failed" ] && echo "Failed:$failed" || echo "All $total feeds retrieved."
