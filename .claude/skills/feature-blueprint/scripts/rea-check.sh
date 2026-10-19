#!/usr/bin/env bash
# Read-only REA readiness check. Never changes configuration.
# Usage: rea-check.sh [client]   (default client: claude_code)
# Override the pinned version with REA_VERSION=x.y.z.
set -u

client="${1:-claude_code}"
version="${REA_VERSION:-6.5.0}"
rea=(npx -y "rea-agents@${version}")

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found: install Node.js 22.19+ or 24.11+ first." >&2
  exit 2
fi

echo "== REA ${version} doctor (client: ${client})"
doctor_output="$("${rea[@]}" doctor --client "$client" --skill 2>&1)"
echo "$doctor_output" | sed -n '1,40p'

if echo "$doctor_output" | grep -q '^healthy: true'; then
  echo
  echo "REA is registered for ${client}. If its tools are missing from the"
  echo "current session, restart the session instead of re-running setup."
  exit 0
fi

echo
echo "== Not ready. Proposed setup plan (dry run, nothing applied):"
"${rea[@]}" setup --client "$client" --dry-run 2>&1 \
  | awk '/^plannedActions/{p=1} /^appliedActions/{p=0} p'
echo
echo "Review the plan, then apply with:"
echo "  npx -y rea-agents@${version} setup --client ${client} --yes"
exit 1
