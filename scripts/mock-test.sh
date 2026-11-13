#!/usr/bin/env bash
# End-to-end checks of the GitHub layer against scripts/mock-github.mjs:
# no real quota is spent. Needs a finished `npm run build`.
#   bash scripts/mock-test.sh
# Starts the mock (port 4010) and the standalone server (port 3210) with a
# throw-away database, runs the checks, prints memory figures and stops both.
set -u
cd "$(dirname "$0")/.."

APP=http://127.0.0.1:3210
MOCK=http://127.0.0.1:4010
TMP=$(mktemp -d)
PASS=0
FAIL=0

cat > "$TMP/mem.cjs" <<'EOF'
const fs = require("fs");
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const timer = setInterval(() => {
    const m = process.memoryUsage();
    fs.appendFileSync(process.env.MEM_LOG, `${m.rss} ${m.heapUsed} ${m.heapTotal} ${m.external} ${m.arrayBuffers}\n`);
  }, 500);
  timer.unref();
}
EOF

MOCK_PORT=4010 node scripts/mock-github.mjs > "$TMP/mock.log" 2>&1 &
MOCK_PID=$!

PORT=3210 HOSTNAME=127.0.0.1 GITHUB_TOKEN=fake-token-for-tests \
  GITHUB_GRAPHQL_URL=$MOCK/graphql GITHUB_CACHE_TTL_MS=3000 \
  DB_PATH="$TMP/leaderboard.db" MEM_LOG="$TMP/mem.log" \
  NODE_OPTIONS="--max-old-space-size=200 --require $TMP/mem.cjs" \
  node .next/standalone/server.js > "$TMP/app.log" 2>&1 &
APP_PID=$!

cleanup() { kill "$APP_PID" "$MOCK_PID" 2>/dev/null; }
trap cleanup EXIT

for _ in $(seq 1 50); do curl -s -o /dev/null "$APP/robots.txt" && break; sleep 0.2; done

# A different client IP per request, so the per-IP limiter does not interfere
ip() { echo "10.$((RANDOM % 200)).$((RANDOM % 250)).$((RANDOM % 250))"; }
# get <user> [extra curl args]: prints "<status> <x-cache> <retry-after> <code>"
get() {
  local user=$1; shift
  curl -s -D "$TMP/h" -o "$TMP/b" -H "CF-Connecting-IP: $(ip)" "$@" "$APP/api/github/$user" -w "%{http_code}" > "$TMP/s"
  local code; code=$(grep -o '"code":"[a-z_]*"' "$TMP/b" | head -1 | cut -d'"' -f4)
  local xc; xc=$(grep -i '^x-cache:' "$TMP/h" | tr -d '\r' | awk '{print $2}')
  local ra; ra=$(grep -i '^retry-after:' "$TMP/h" | tr -d '\r' | awk '{print $2}')
  echo "$(cat "$TMP/s") ${xc:--} ${ra:--} ${code:--}"
}
calls() { curl -s "$MOCK/__calls" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]||0))' "$1"; }
check() { # check <name> <actual> <expected-regex>
  if [[ "$2" =~ ^$3$ ]]; then PASS=$((PASS + 1)); echo "  ok   $1: $2"; else FAIL=$((FAIL + 1)); echo "  FAIL $1: got '$2', expected /$3/"; fi
}

echo "A. normal profile, cache, in-flight de-duplication"
check "first request" "$(get alice)" "200 MISS - -"
check "second request" "$(get alice)" "200 HIT - -"
(for i in $(seq 1 20); do curl -s -o /dev/null -H "CF-Connecting-IP: 10.99.0.$i" "$APP/api/github/bob" & done; wait)
check "20 concurrent -> upstream calls" "$(calls bob)" "1"

echo "B. unknown user and negative cache"
check "not found" "$(get nf-ghost)" "404 - - not_found"
check "not found again" "$(get nf-ghost)" "404 - - not_found"
check "upstream calls" "$(calls nf-ghost)" "1"
check "page is a real 404 now" "$(curl -s -o /dev/null -w '%{http_code}' "$APP/user/nf-ghost")" "404"

echo "C. upstream 5xx: one retry, sanitized message"
check "502" "$(get err-boom)" "502 - - upstream"
check "no internal detail leaked" "$(grep -c 'secret\|mock' "$TMP/b")" "0"
check "upstream calls (1 + 1 retry)" "$(calls err-boom)" "2"

echo "F. partial GraphQL data is accepted"
check "partial" "$(get partial-org)" "200 MISS - -"

echo "G. big profile: pagination caps"
check "big" "$(get big-one)" "200 MISS - -"
check "upstream calls (1 + 2 pages)" "$(calls big-one)" "3"
check "repos kept (300 owned + 2 contributed)" "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).data.repos.length)' "$TMP/b")" "302"
check "PRs kept" "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).data.pullRequests.length)' "$TMP/b")" "200"

echo "I. stale-if-error (TTL is 3 s in this run)"
check "fresh" "$(get once-flaky)" "200 MISS - -"
sleep 3.3
check "GitHub down -> stale copy" "$(get once-flaky)" "200 STALE - -"
check "stale Cache-Control" "$(grep -i '^cache-control' "$TMP/h" | tr -d '\r')" "[Cc]ache-[Cc]ontrol: public, max-age=60"

echo "J. load: 300 distinct profiles (40 of them big), 8 at a time"
seq 1 300 | xargs -P 8 -I{} sh -c 'u=load-{}; [ $(({} % 8)) -eq 0 ] && u=big-load-{}; curl -s -o /dev/null -m 60 -H "CF-Connecting-IP: 10.200.$(({} / 250)).$(({} % 250))" '"$APP"'/api/github/$u'
grep -o 'cache [0-9]* entries / [0-9]* KB' "$TMP/app.log" | sort -t' ' -k2 -n | tail -1 | sed 's/^/  largest cache seen: /'
check "cache entries capped" "$(grep -o 'cache [0-9]* entries' "$TMP/app.log" | awk '{print $2}' | sort -n | tail -1)" "([0-9]|[0-9][0-9]|1[0-9][0-9]|200)"
seq 1 3000 | xargs -P 16 -I{} curl -s -o /dev/null -H "CF-Connecting-IP: 10.201.0.1" "$APP/api/leaderboard"
seq 1 60 | xargs -P 4 -I{} curl -s -o /dev/null "$APP/og/alice.png"
curl -s -o /dev/null "$APP/og/_site.png"; curl -s -o /dev/null "$APP/leaderboard"; curl -s -o /dev/null "$APP/user/alice"
sleep 1
awk 'BEGIN{r=0;h=0;e=0} {if($1>r)r=$1; if($2>h)h=$2; if($4>e)e=$4} END{printf "  memory peaks: rss %.0f MB, heapUsed %.0f MB, external %.0f MB (%d samples)\n", r/1048576, h/1048576, e/1048576, NR}' "$TMP/mem.log"
tail -1 "$TMP/mem.log" | awk '{printf "  memory now:   rss %.0f MB, heapUsed %.0f MB, heapTotal %.0f MB, external %.0f MB\n", $1/1048576, $2/1048576, $3/1048576, $4/1048576}'
check "heapUsed peak under 200 MB" "$(awk 'BEGIN{h=0} {if($2>h)h=$2} END{print (h < 200*1048576) ? "yes" : "no"}' "$TMP/mem.log")" "yes"
check "server still alive" "$(curl -s -o /dev/null -w '%{http_code}' "$APP/robots.txt")" "200"

echo "H. timeout (15 s per call, no retry)"
START=$(date +%s)
check "slow upstream" "$(get slow-poke -m 40)" "504 - - timeout"
echo "  took $(( $(date +%s) - START )) s"

echo "E. quota reserve"
check "low quota answer is still served" "$(get low-fuel -m 90)" "200 MISS - -"
check "next evaluation refused" "$(get after-low)" "503 - [0-9]+ quota_exhausted"
check "cached profiles still served" "$(get low-fuel)" "200 HIT - -"
check "refused without calling GitHub" "$(calls after-low)" "0"

echo "D. secondary rate limit (Retry-After from GitHub)"
sleep 21 # the reserve block ends when the (mock) quota window resets
check "403 + Retry-After" "$(get rl-abuse)" "503 - 30 quota_exhausted"
check "blocked meanwhile" "$(get someone-else)" "503 - (2[0-9]|30) quota_exhausted"
check "blocked without calling GitHub" "$(calls someone-else)" "0"

echo "M. leaderboard queue"
sleep 31 # GitHub's Retry-After from the previous section
post() { curl -s -X POST -H "Content-Type: application/json" -H "CF-Connecting-IP: $(ip)" --data "{\"username\":\"$1\"}" "$APP/api/leaderboard" -o "$TMP/b" -w "%{http_code}"; }
check "save alice" "$(post alice) $(cat "$TMP/b")" '200 \{"status":"queued","position":1\}'
sleep 0.5
check "alice saved" "$(curl -s "$APP/api/leaderboard/status/ALICE" | grep -o '"inLeaderboard":true,"entry":{"username":"alice","rank":1')" '.+'
check "save again within 24 h" "$(post Alice) $(grep -o '"status":"done","data":{"username":"alice"' "$TMP/b")" '200 .+'
check "unknown user fails cleanly" "$(post nf-ghost)" "200"
sleep 0.3
check "status carries the code" "$(curl -s "$APP/api/leaderboard/status/nf-ghost")" '\{"status":"error","code":"not_found","inLeaderboard":false\}'
for i in $(seq 1 53); do post "slow-q$i" > /dev/null; done
check "queue full -> 503 busy" "$(post slow-q99) $(cat "$TMP/b")" '503 \{"error":"[^"]+","code":"busy"\}'

echo "K. concurrency cap (1 queue worker + 2 direct = 3 slots, 10 waiting)"
(for i in $(seq 1 12); do curl -s -m 1 -o /dev/null -H "CF-Connecting-IP: 10.98.0.$i" "$APP/api/github/slow-c$i" & done; wait)
check "14th concurrent evaluation" "$(get slow-c99 -m 5)" "503 - 5 busy"

echo "L. clean shutdown"
kill -TERM "$APP_PID"; wait "$APP_PID" 2>/dev/null; echo "  exit code $?"
ls -la "$TMP" | grep leaderboard | sed 's/^/  /'
check "WAL folded into the main file" "$(stat -c %s "$TMP/leaderboard.db-wal" 2>/dev/null || echo 0)" "0"
check "token never logged" "$(grep -c 'fake-token-for-tests' "$TMP/app.log" "$TMP/mock.log" | awk -F: '{s+=$2} END{print s}')" "0"

echo
echo "server log (last lines):"; tail -6 "$TMP/app.log" | sed 's/^/  /'
echo
echo "passed $PASS, failed $FAIL"
rm -rf "$TMP"
[ "$FAIL" -eq 0 ]
