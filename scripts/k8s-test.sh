#!/bin/bash

API="http://localhost:8080/api/v1"
API_KEY="change-me-in-production"
TMPDIR_LOCAL="$(pwd)/.tmp-k8s-test"
mkdir -p "$TMPDIR_LOCAL"

# Git bash on Windows rewrites Unix paths and curl @file paths.
# Detect OS and set the correct file reference for curl -F.
if [ "$(uname -o 2>/dev/null)" = "Msys" ] || [ "$(uname -o 2>/dev/null)" = "Cygwin" ]; then
  CURL_FILE="@$(cygpath -w "$TMPDIR_LOCAL")\\input.mp3"
  EXEC_TMP="//tmp"
else
  CURL_FILE="@$TMPDIR_LOCAL/input.mp3"
  EXEC_TMP="/tmp"
fi

echo "=== Setting up port-forward ==="
kubectl -n audio-api port-forward svc/audio-api 8080:80 &>/dev/null &
PF_PID=$!
sleep 3

cleanup() {
  kill $PF_PID 2>/dev/null
  rm -rf "$TMPDIR_LOCAL"
}

echo "=== 1. Health check ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
if [ "$STATUS" != "200" ]; then echo "FAIL: health returned $STATUS"; cleanup; exit 1; fi
echo "OK: health 200"

echo "=== 2. Auth check (should reject without key) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/audio/nonexistent")
if [ "$STATUS" != "401" ]; then echo "FAIL: expected 401, got $STATUS"; cleanup; exit 1; fi
echo "OK: auth 401"

echo "=== 3. Generate test audio ==="
kubectl -n audio-api exec deploy/audio-api -- sh -c \
  "ffmpeg -f lavfi -i 'sine=frequency=440:duration=3' -q:a 9 /tmp/k8s-test.mp3 -y" 2>&1 | tail -1
kubectl -n audio-api exec deploy/audio-api -- cat $EXEC_TMP/k8s-test.mp3 > "$TMPDIR_LOCAL/input.mp3"
echo "OK: generated $(wc -c < "$TMPDIR_LOCAL/input.mp3") bytes"

echo "=== 4. Upload ==="
MSYS_NO_PATHCONV=1 curl -s -H "x-api-key: $API_KEY" -X POST "$API/audio" \
  -F "file=$CURL_FILE;type=audio/mpeg" \
  -F "effect=REVERB" > "$TMPDIR_LOCAL/upload.json" || true

UPLOAD=$(cat "$TMPDIR_LOCAL/upload.json")
TRACK_ID=$(echo "$UPLOAD" | grep -o '"audioTrackId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TRACK_ID" ]; then echo "FAIL: no audioTrackId in response: $UPLOAD"; cleanup; exit 1; fi
echo "OK: uploaded $TRACK_ID"

echo "=== 5. Poll status ==="
for i in $(seq 1 15); do
  sleep 2
  RESP=$(curl -s -H "x-api-key: $API_KEY" "$API/audio/$TRACK_ID")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  poll $i: $STATUS"
  if [ "$STATUS" = "READY" ]; then break; fi
  if [ "$STATUS" = "FAILED" ]; then echo "FAIL: job failed"; echo "$RESP"; cleanup; exit 1; fi
done

if [ "$STATUS" != "READY" ]; then echo "FAIL: timeout waiting for READY"; cleanup; exit 1; fi
echo "OK: status READY"

echo "=== 6. Download ==="
HTTP_CODE=$(curl -s -o "$TMPDIR_LOCAL/output.mp3" -w "%{http_code}" \
  -H "x-api-key: $API_KEY" "$API/audio/$TRACK_ID/download")
if [ "$HTTP_CODE" != "200" ]; then echo "FAIL: download returned $HTTP_CODE"; cleanup; exit 1; fi

INPUT_SIZE=$(wc -c < "$TMPDIR_LOCAL/input.mp3")
OUTPUT_SIZE=$(wc -c < "$TMPDIR_LOCAL/output.mp3")
echo "OK: download 200 (input: ${INPUT_SIZE}B, output: ${OUTPUT_SIZE}B)"

echo ""
echo "=== ALL TESTS PASSED ==="
cleanup
