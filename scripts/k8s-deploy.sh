#!/bin/bash
set -e

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
