#!/bin/bash
set -e

# ── Prerequisites ────────────────────────────────────────────────────────────
# 1. Docker running
# 2. kubectl configured with a cluster (e.g. Docker Desktop K8s)
# 3. Logged in to ghcr.io:
#      echo $(gh auth token) | docker login ghcr.io -u <your-github-user> --password-stdin
#    Requires `gh auth refresh --hostname github.com --scopes write:packages` first.
# 4. The ghcr.io package must be public for K8s to pull without imagePullSecrets.
#    Set visibility at: https://github.com/users/<your-github-user>/packages/container/audio-api/settings

echo "=== Checking prerequisites ==="
docker info >/dev/null 2>&1 || { echo "FAIL: Docker is not running"; exit 1; }
kubectl cluster-info >/dev/null 2>&1 || { echo "FAIL: kubectl not configured"; exit 1; }
docker pull ghcr.io/jorgeferrando/audio-api:latest >/dev/null 2>&1 || \
  echo "WARN: cannot pull from ghcr.io — make sure you are logged in (see script header)"

echo "=== Building image ==="
docker build -t ghcr.io/jorgeferrando/audio-api:latest .

echo "=== Pushing to ghcr.io ==="
docker push ghcr.io/jorgeferrando/audio-api:latest

echo "=== Deploying to Kubernetes ==="
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/infra.yaml
kubectl apply -f k8s/configmap.yaml -f k8s/secret.yaml
kubectl apply -f k8s/api-deployment.yaml -f k8s/api-service.yaml -f k8s/worker-deployment.yaml

echo "=== Restarting API and worker ==="
kubectl -n audio-api rollout restart deployment audio-api audio-worker

echo "=== Waiting for pods ==="
kubectl -n audio-api wait --for=condition=Available deployment --all --timeout=120s

echo "=== Status ==="
kubectl -n audio-api get pods

echo ""
echo "Deploy complete. Run: kubectl -n audio-api port-forward svc/audio-api 8080:80"
echo "Then open: http://localhost:8080"
