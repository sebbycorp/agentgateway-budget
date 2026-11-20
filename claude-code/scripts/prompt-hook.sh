#!/usr/bin/env bash
# UserPromptSubmit hook: intercept /my-budget and /increase-my-budget BEFORE the model sees them.
# Runs the agw script and blocks the prompt, so the command costs no tokens and works while blocked.
# Any other prompt passes through untouched (exit 0, no output).
prompt=$(jq -r '.prompt // ""')
case "$prompt" in
  /increase-my-budget*) args=() ;;
  /my-budget*)          args=(status) ;;
  *) exit 0 ;;
esac
out=$("${CLAUDE_PLUGIN_ROOT}/scripts/increase-my-budget.sh" "${args[@]}" 2>&1); code=$?
jq -n --arg r "agentgateway budget (exit $code):
$out" '{decision: "block", reason: $r}'
