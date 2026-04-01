#!/bin/bash

# ── Prerequisites ────────────────────────────────────────────────────────────
# 1. Docker Compose stack running (run scripts/docker-deploy.sh first)
# API runs on port 3000 (no port-forward needed).
# No API key required in dev mode (API_KEY not set in docker-compose.yml).

API="http://localhost:3000/api/v1"
TMPDIR_LOCAL="$(pwd)/.tmp-docker-test"
mkdir -p "$TMPDIR_LOCAL"

# Git bash on Windows rewrites Unix paths and curl @file paths.
if [ "$(uname -o 2>/dev/null)" = "Msys" ] || [ "$(uname -o 2>/dev/null)" = "Cygwin" ]; then
  CURL_FILE="@$(cygpath -w "$TMPDIR_LOCAL")\\input.mp3"
  EXEC_TMP="//tmp"
else
  CURL_FILE="@$TMPDIR_LOCAL/input.mp3"
  EXEC_TMP="/tmp"
fi

cleanup() {
  rm -rf "$TMPDIR_LOCAL"
}

echo "=== 1. Health check ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
if [ "$STATUS" != "200" ]; then echo "FAIL: health returned $STATUS"; cleanup; exit 1; fi
echo "OK: health 200"

echo "=== 2. Generate test audio ==="
docker compose exec -T api sh -c \
  "ffmpeg -f lavfi -i 'sine=frequency=440:duration=3' -q:a 9 /tmp/docker-test.mp3 -y" 2>&1 | tail -1
docker compose exec -T api cat $EXEC_TMP/docker-test.mp3 > "$TMPDIR_LOCAL/input.mp3"
echo "OK: generated $(wc -c < "$TMPDIR_LOCAL/input.mp3") bytes"

echo "=== 3. Upload ==="
MSYS_NO_PATHCONV=1 curl -s -X POST "$API/audio" \
  -F "file=$CURL_FILE;type=audio/mpeg" \
  -F "effect=REVERB" > "$TMPDIR_LOCAL/upload.json" || true

UPLOAD=$(cat "$TMPDIR_LOCAL/upload.json")
TRACK_ID=$(echo "$UPLOAD" | grep -o '"audioTrackId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TRACK_ID" ]; then echo "FAIL: no audioTrackId in response: $UPLOAD"; cleanup; exit 1; fi
echo "OK: uploaded $TRACK_ID"

echo "=== 4. Poll status ==="
for i in $(seq 1 15); do
  sleep 2
  RESP=$(curl -s "$API/audio/$TRACK_ID")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  poll $i: $STATUS"
  if [ "$STATUS" = "READY" ]; then break; fi
  if [ "$STATUS" = "FAILED" ]; then echo "FAIL: job failed"; echo "$RESP"; cleanup; exit 1; fi
done

if [ "$STATUS" != "READY" ]; then echo "FAIL: timeout waiting for READY"; cleanup; exit 1; fi
echo "OK: status READY"

echo "=== 5. Download ==="
HTTP_CODE=$(curl -s -o "$TMPDIR_LOCAL/output.mp3" -w "%{http_code}" "$API/audio/$TRACK_ID/download")
if [ "$HTTP_CODE" != "200" ]; then echo "FAIL: download returned $HTTP_CODE"; cleanup; exit 1; fi

INPUT_SIZE=$(wc -c < "$TMPDIR_LOCAL/input.mp3")
OUTPUT_SIZE=$(wc -c < "$TMPDIR_LOCAL/output.mp3")
echo "OK: download 200 (input: ${INPUT_SIZE}B, output: ${OUTPUT_SIZE}B)"

echo ""
echo "=== ALL TESTS PASSED ==="
cleanup
