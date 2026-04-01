# ADR 011 - TLS Termination in Production

## Status
Documented (not implemented — requires a real domain and cluster)

## Context
The current setup runs without HTTPS. In local development (Docker Compose,
Docker Desktop K8s) this is acceptable — `localhost` does not need TLS.

In a production Kubernetes cluster, all external traffic must be encrypted.

## Decision
TLS termination will be handled by a **Kubernetes Ingress Controller** with
**cert-manager** for automatic Let's Encrypt certificates. Nginx inside the
pod does NOT do TLS — the Ingress handles it before traffic reaches the pod.

Production architecture:
```
Client ──► Ingress (TLS) ──► nginx (port 80) ──► Express (port 3000)
```

Required components:
1. **cert-manager** — obtains and renews certificates from Let's Encrypt.
2. **Ingress Controller** — nginx-ingress or Traefik, routes external traffic.
3. **Ingress resource** — maps a domain to the audio-api Service with TLS.
4. **DNS** — A record pointing the domain to the cluster's load balancer IP.

Example manifests (not deployed, for reference):

```yaml
# cert-manager ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
---
# Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: audio-api
  namespace: audio-api
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - audio-api.example.com
      secretName: audio-api-tls
  rules:
    - host: audio-api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: audio-api
                port:
                  number: 80
```

## Consequences
- Not implemented locally — requires a real domain and cluster.
- The nginx pod config does not change — it stays on port 80.
- cert-manager handles certificate renewal automatically (no manual ops).
