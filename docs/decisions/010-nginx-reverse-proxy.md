# ADR 010 - Nginx Reverse Proxy for Static Files

## Status
Accepted

## Context
Express was serving both the API and static files (HTML, CSS, JS). This caused
two problems:

1. The HTML template was read from disk on every request (`fs.readFileSync`)
   to inject the API key, adding unnecessary I/O per request.
2. Express is not optimized for serving static files — it lacks proper
   cache headers, compression, and TLS termination that a dedicated
   web server provides.

## Decision
Add **nginx** as a reverse proxy in front of Express:

- nginx serves all static files from `/usr/share/nginx/html`
- nginx proxies `/api/*` requests to Express
- nginx injects the `API_KEY` into the HTML via `sub_filter` at runtime
- Express only handles API requests — no static files, no HTML template logic

## Consequences

**Positive:**
- Express is API-only — simpler, faster, no filesystem reads per request.
- nginx handles cache headers natively: CSS/JS cached 1 hour (immutable),
  HTML never cached.
- CSP `style-src 'self'` is no longer a concern for the API — nginx serves
  the HTML with proper headers.
- Clear separation: nginx owns the frontend delivery, Express owns the API.
- In production, nginx also handles TLS termination, gzip compression,
  and connection pooling — none of which Express does well.

**Negative:**
- One more container in Docker Compose and K8s.
- API key injection via `sub_filter` + `envsubst` is less obvious than
  a simple string replace in Express.
