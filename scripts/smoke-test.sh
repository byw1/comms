#!/usr/bin/env bash
#
# Boots the full stack with docker compose and verifies it comes up healthy.
# Usage: ./scripts/smoke-test.sh
set -euo pipefail

cd "$(dirname "$0")/.."

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

cleanup() {
  echo "Tearing down…"
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Building and starting the stack (this can take a few minutes the first time)…"
docker compose up -d --build

echo "Waiting for the web service to become healthy…"
ok=""
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done
[ -n "$ok" ] || { docker compose logs web; fail "web did not become healthy in time"; }
pass "web is up (/api/health responds)"

# Health payload
curl -fsS http://localhost:3000/api/health | grep -q '"status":"ok"' \
  && pass "health payload reports ok" || fail "unexpected health payload"

# Unauthenticated webhook must be rejected (validates the endpoint + auth).
code=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST 'http://localhost:3000/api/webhooks/bluebubbles/does-not-exist?secret=wrong' \
  -H 'Content-Type: application/json' -d '{"type":"new-message"}')
[ "$code" = "401" ] && pass "webhook rejects an invalid secret (401)" \
  || fail "expected 401 from webhook, got $code"

# Worker must have started and connected to Redis.
sleep 2
docker compose logs worker 2>&1 | grep -q "Comms worker started" \
  && pass "worker started" || { docker compose logs worker; fail "worker did not start"; }

echo
echo "Smoke test passed ✅  — the stack boots, migrations run, web + worker are healthy."
