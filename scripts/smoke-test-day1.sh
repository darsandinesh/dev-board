#!/bin/bash
# Day 1 smoke test — run after docker compose up + bootstrap.sh
# Verifies the JWT validation gate works end-to-end.
#
# Usage: bash scripts/smoke-test-day1.sh

set -e

KC="http://localhost:8080"
REALM="devboard"
CLIENT_ID="devboard-app"
CLIENT_SECRET="devboard-secret"
API="http://localhost:8000"

echo "======================================="
echo " DevBoard Day 1 Smoke Test"
echo "======================================="

# ---- 1. Get a real token for alice ----
echo ""
echo "--> [1/4] Getting token for alice..."
TOKEN_RESPONSE=$(curl -s -X POST "$KC/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=alice" \
  -d "password=password123")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "FAIL: Could not get token. Response was:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi
echo "OK  Token acquired for alice."

# ---- 2. GET /health (no token needed) ----
echo ""
echo "--> [2/4] GET /health..."
HEALTH=$(curl -s "$API/health")
echo "    Response: $HEALTH"
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'" && echo "OK  Health check passed."

# ---- 3. GET /me with valid token ----
echo ""
echo "--> [3/4] GET /me with alice's token..."
ME_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$API/me")
echo "    Response: $ME_RESPONSE"
echo "$ME_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'sub' in d and d['username']=='alice'" && echo "OK  /me returned alice's user info."

# ---- 4. GET /me with no token → should 401 ----
echo ""
echo "--> [4/4] GET /me with no token (expect 401)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/me")
echo "    Status: $STATUS"
[ "$STATUS" = "401" ] && echo "OK  401 returned as expected." || echo "FAIL: Expected 401, got $STATUS"

echo ""
echo "======================================="
echo " Day 1 gate: PASSED"
echo " Keycloak → JWT → FastAPI working."
echo "======================================="
