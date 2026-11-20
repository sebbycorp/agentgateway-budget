#!/usr/bin/env bash
# agentgateway-budget: check or raise YOUR budget on Solo Enterprise agentgateway, using only agw's
# management API. No server, no LLM call. agentgateway RBAC decides what your key may do.
#
#   increase-my-budget status   -> show my budget + my team pool
#   increase-my-budget          -> borrow: raise my limit if the team has room and I'm near my cap
#
# Key (first found):  AGW_KEY | AGW_API_KEY | ANTHROPIC_AUTH_TOKEN | OPENAI_API_KEY | pi's agw-ent provider key
# URL (first found):  AGW_URL | pi's agw-ent baseUrl | ANTHROPIC_BASE_URL | OPENAI_BASE_URL | http://localhost:4000
#   (a trailing /v1 is stripped; the management API lives at <gateway>/api/...)
# Borrow rule: STEP (USD per borrow, 0.10), MAX (personal ceiling, 0.50),
#              NEAR (fraction used before borrowing is allowed, 0.8), MIN_TEAM (USD to leave in pool, 0.10)
# Exit codes: 0 ok/raised, 1 setup error, 2 denied by rule, 3 forbidden by agentgateway RBAC
set -euo pipefail
PI_MODELS="$HOME/.pi/agent/models.json"
pi_val() { jq -r --arg k "$1" '.providers["agw-ent"][$k] // empty' "$PI_MODELS" 2>/dev/null || true; }
AGW_KEY=${AGW_KEY:-${AGW_API_KEY:-${ANTHROPIC_AUTH_TOKEN:-${OPENAI_API_KEY:-$(pi_val apiKey)}}}}
URL=${AGW_URL:-$(pi_val baseUrl)}; URL=${URL:-${ANTHROPIC_BASE_URL:-${OPENAI_BASE_URL:-http://localhost:4000}}}
ADMIN=${URL%/}; ADMIN=${ADMIN%/v1}
STEP=${STEP:-0.10}; MAX=${MAX:-0.50}; NEAR=${NEAR:-0.8}; MIN_TEAM=${MIN_TEAM:-0.10}
[ -n "$AGW_KEY" ] || { echo "no gateway key found (set AGW_KEY)"; exit 1; }
AUTH=(-H "authorization: Bearer $AGW_KEY")

usage=$(curl -fsS "${AUTH[@]}" "$ADMIN/api/budgets/usage") || { echo "cannot read $ADMIN/api/budgets/usage"; exit 1; }
# RBAC only lets a non-admin key see its own user budget and its own team pool -> derive identity.
USER_=${AGW_USER:-$(jq -r '[.budgets[].subject.user // empty]|unique|if length==1 then .[0] else "" end' <<<"$usage")}
GROUP=${AGW_GROUP:-$(jq -r '[.budgets[]|select(.subject|keys==["group"])|.subject.group]|unique|if length==1 then .[0] else "" end' <<<"$usage")}
[ -n "$USER_" ] && [ -n "$GROUP" ] || { echo "cannot determine user/team for this key (set AGW_USER/AGW_GROUP)"; exit 1; }
me=$(jq -c --arg n "user-$USER_" '.budgets[]|select(.name==$n)' <<<"$usage"); [ -n "$me" ] || me='{}'
team=$(jq -c --arg g "$GROUP" '.budgets[]|select(.subject=={"group":$g})' <<<"$usage"); [ -n "$team" ] || team='{}'
def=$(curl -fsS "${AUTH[@]}" "$ADMIN/api/config/resources/llm.budget" | jq -c --arg n "user-$USER_" '.resources[]|select(.id==$n)|.value')
[ -n "$def" ] || { echo "no visible budget user-$USER_ (missing or not allowed by RBAC)"; exit 1; }

limit=$(jq -r .limit.amount <<<"$def")
used=$(jq -r '.usage.used // "0"' <<<"$me")
team_left=$(jq -r '.usage.remaining // "0"' <<<"$team")
printf 'user=%s used=$%s limit=$%s | team %s left=$%s\n' "$USER_" "$used" "$limit" "$GROUP" "$team_left"
[ "${1:-}" = status ] && exit 0

awk -v t="$team_left" -v m="$MIN_TEAM" 'BEGIN{exit !(t>=m)}' || { echo "DENIED: team pool too low"; exit 2; }
awk -v u="$used" -v l="$limit" -v n="$NEAR" 'BEGIN{exit !(u>=n*l)}' || { echo "DENIED: only using $used of $limit (needs >= ${NEAR} used)"; exit 2; }
new=$(awk -v l="$limit" -v s="$STEP" -v x="$MAX" -v t="$team_left" -v u="$used" \
  'BEGIN{n=l+s; if(n>x)n=x; if(n>u+t)n=u+t; printf "%.2f", n}')
awk -v n="$new" -v l="$limit" 'BEGIN{exit !(n>l)}' || { echo "DENIED: already at personal ceiling \$$MAX"; exit 2; }

tmp=$(mktemp)
code=$(jq -c --argjson a "$new" '{value: (.limit.amount=$a)}' <<<"$def" |
  curl -sS -o "$tmp" -w '%{http_code}' "${AUTH[@]}" -X PUT -H 'content-type: application/json' --data @- \
    "$ADMIN/api/config/resources/llm.budget/user-$USER_")
[ "$code" = 200 ] || { echo "FORBIDDEN by agentgateway RBAC (HTTP $code): $(cat "$tmp")"; rm -f "$tmp"; exit 3; }
rm -f "$tmp"
echo "RAISED: user-$USER_ \$$limit -> \$$new (spend so far \$$used is kept; applies in ~5s)"
