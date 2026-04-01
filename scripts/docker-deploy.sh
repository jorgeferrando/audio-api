#!/bin/bash
set -e

# ── Prerequisites ────────────────────────────────────────────────────────────
# 1. Docker and Docker Compose running
# No registry login needed — images are built and run locally.

echo "=== Checking prerequisites ==="
docker info >/dev/null 2>&1 || { echo "FAIL: Docker is not running"; exit 1; }

echo "=== Building and starting all services ==="
docker compose up -d --build

echo "=== Waiting for services ==="
sleep 10

echo "=== Status ==="
docker compose ps

echo ""
echo "Deploy complete. Open: http://localhost:3000"
