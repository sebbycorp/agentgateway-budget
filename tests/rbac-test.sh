#!/bin/bash
# RBAC test: who may raise which budget via agw's management API on :4000.
U=${AGW_URL:?set AGW_URL, e.g. http://your-gateway:4000}; HERE=$(cd "$(dirname "$0")/../bin" && pwd)
put() { # put <key> <budget> <amount>  -> HTTP code
  local def; def=$(curl -s -H "authorization: Bearer sk-admin" $U/api/config/resources/llm.budget | jq -c --arg n "$2" '.resources[]|select(.id==$n)|.value')
  jq -c --argjson a "$3" '{value: (.limit.amount=$a)}' <<<"$def" | curl -s -o /dev/null -w '%{http_code}' -X PUT \
    -H "authorization: Bearer $1" -H 'content-type: application/json' --data @- $U/api/config/resources/llm.budget/$2; }
check() { [ "$2" = "$3" ] && r=PASS || r=FAIL; printf '%-4s %-62s expected=%s got=%s\n' "$r" "$1" "$3" "$2"; }
check "no key -> management API"                       "$(curl -s -o /dev/null -w '%{http_code}' $U/api/budgets/usage)" 401
check "admin port from LAN (bypasses RBAC) is closed"  "$(curl -s -m3 -o /dev/null -w '%{http_code}' ${AGW_ADMIN_URL:-http://localhost:15000}/api/budgets/usage)" 000
echo "-- what each user can SEE in /api/budgets/usage:"
for k in alice carol dave admin; do printf '   %-6s %s\n' $k "$(curl -s -H "authorization: Bearer sk-$k" $U/api/budgets/usage | jq -c '[.budgets[]?.name]')"; done
check "alice raises her OWN budget"                    "$(put sk-alice user-alice 0.60)" 200
check "alice raises BOB's budget"                      "$(put sk-alice user-bob 5)" 403
check "alice raises the TEAM POOL"                     "$(put sk-alice pool-engineering 100)" 403
check "carol (viewer) raises her own budget"           "$(put sk-carol user-carol 1)" 403
check "dave (viewer) raises his own budget"            "$(put sk-dave user-dave 1)" 403
check "admin raises carol's budget"                    "$(put sk-admin user-carol 0.05)" 200
echo "-- via the plugin script (as each user, NEAR=0 to isolate RBAC):"
for who in "bob sk-bob engineering" "carol sk-carol engineering"; do set -- $who
  echo "   [$1]"; AGW_USER=$1 AGW_KEY=$2 AGW_GROUP=$3 NEAR=0 "$HERE/increase-my-budget" 2>&1 | sed 's/^/     /'; done
echo "   [alice pretending to be bob]"; AGW_USER=bob AGW_KEY=sk-alice AGW_GROUP=engineering NEAR=0 "$HERE/increase-my-budget" 2>&1 | sed 's/^/     /'
