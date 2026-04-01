#!/bin/bash
set -e

API="http://localhost:8080/api/v1"
API_KEY="change-me-in-production"
AUTH="-H x-api-key:$API_KEY"

echo "=== Setting up port-forward ==="
kubectl -n audio-api port-forward svc/audio-api 8080:80 &>/dev/null &
PF_PID=$!
sleep 3

cleanup() {
  kill $PF_PID 2>/dev/null
  rm -f /tmp/k8s-test-input.mp3 /tmp/k8s-test-output.mp3
}
trap cleanup EXIT

echo "=== 1. Health check ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API/health)
if [ "$STATUS" != "200" ]; then echo "FAIL: health returned $STATUS"; exit 1; fi
echo "OK: health 200"

echo "=== 2. Auth check (should reject without key) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API/audio/nonexistent)
if [ "$STATUS" != "401" ]; then echo "FAIL: expected 401, got $STATUS"; exit 1; fi
echo "OK: auth 401"

echo "=== 3. Generate test audio ==="
kubectl -n audio-api exec deploy/audio-api -- sh -c \
  "ffmpeg -f lavfi -i 'sine=frequency=440:duration=3' -q:a 9 //tmp/k8s-test.mp3 -y" 2>&1 | tail -1
kubectl -n audio-api exec deploy/audio-api -- cat //tmp/k8s-test.mp3 > /tmp/k8s-test-input.mp3

echo "=== 4. Upload ==="
UPLOAD=$(curl -s $AUTH -X POST $API/audio \
  -F "file=@/tmp/k8s-test-input.mp3;type=audio/mpeg" \
  -F "effect=REVERB")
echo "$UPLOAD"

TRACK_ID=$(echo "$UPLOAD" | grep -o '"audioTrackId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TRACK_ID" ]; then echo "FAIL: no audioTrackId in response"; exit 1; fi
echo "OK: uploaded $TRACK_ID"

echo "=== 5. Poll status ==="
for i in $(seq 1 15); do
  sleep 2
  RESP=$(curl -s $AUTH $API/audio/$TRACK_ID)
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  poll $i: $STATUS"
  if [ "$STATUS" = "READY" ]; then break; fi
  if [ "$STATUS" = "FAILED" ]; then echo "FAIL: job failed"; echo "$RESP"; exit 1; fi
done

if [ "$STATUS" != "READY" ]; then echo "FAIL: timeout waiting for READY"; exit 1; fi

DOWNLOAD_READY=$(echo "$RESP" | grep -o '"downloadReady":true')
if [ -z "$DOWNLOAD_READY" ]; then echo "FAIL: downloadReady not true"; exit 1; fi
echo "OK: status READY, downloadReady true"

echo "=== 6. Download ==="
HTTP_CODE=$(curl -s -o /tmp/k8s-test-output.mp3 -w "%{http_code}" $AUTH $API/audio/$TRACK_ID/download)
if [ "$HTTP_CODE" != "200" ]; then echo "FAIL: download returned $HTTP_CODE"; exit 1; fi

INPUT_SIZE=$(wc -c < /tmp/k8s-test-input.mp3)
OUTPUT_SIZE=$(wc -c < /tmp/k8s-test-output.mp3)
echo "OK: download 200 (input: ${INPUT_SIZE}B, output: ${OUTPUT_SIZE}B)"

if [ "$OUTPUT_SIZE" -le "$INPUT_SIZE" ]; then
  echo "WARN: processed file is not larger (reverb should add tail)"
fi

echo ""
echo "=== ALL TESTS PASSED ==="
echo "  Health:   OK"
echo "  Auth:     OK"
echo "  Upload:   OK ($TRACK_ID)"
echo "  Process:  OK (READY)"
echo "  Download: OK (${OUTPUT_SIZE}B)"
