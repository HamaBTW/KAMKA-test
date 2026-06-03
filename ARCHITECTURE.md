# Architecture & Design Decisions

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        GitHub                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  GitHub Actions (CI/CD Pipeline)                          │   │
│  │  push → lint → build → push to GHCR → deploy via SSH     │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Container Registry                      │
│              ghcr.io/$USER/todo-frontend:latest                   │
│              ghcr.io/$USER/todo-backend:latest                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Dokploy VPS (Production)                      │
│                                                                   │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                  │
│  │  Caddy    │────▶│ Frontend │     │ Uptime   │                  │
│  │  :80/443  │     │  nginx   │     │  Kuma    │                  │
│  └──────────┘     │  :80      │     │  :3001   │                  │
│        │          └──────────┘     └──────────┘                  │
│        │                │              │                          │
│        ▼                ▼              ▼                          │
│  ┌─────────────────────────────────────┐                        │
│  │         Backend (Express) :3000      │                        │
│  │         /health, /api/todos          │                        │
│  └─────────────────────────────────────┘                        │
│                    │                                              │
│                    ▼                                              │
│  ┌─────────────────────────────────────┐                        │
│  │       PostgreSQL 17 :5432            │                        │
│  └─────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### Change Flow

1. Developer pushes code to `main` on GitHub
2. GitHub Actions triggers the CI/CD pipeline
3. **Lint**: `standard` (backend) and `eslint` (frontend) — fails fast if code quality issues
4. **Build**: Docker multi-stage builds produce slim production images
5. **Push**: Images are tagged `:latest` and `:<sha>` and pushed to GHCR
6. **Deploy**: SSH into Dokploy VPS → runs `deploy.sh` → pulls new images → restarts stack
7. **Monitor**: Uptime Kuma polls health endpoints every 60s

## Key Decisions & Trade-offs

### Why GitHub Container Registry (GHCR)?

**Chosen**: GHCR over Docker Hub or other registries.

- Tight integration with GitHub Actions — no separate login needed beyond the `GITHUB_TOKEN` (with `packages: write` permission)
- No rate limits for public packages (unlike Docker Hub's anonymous pull limits)
- Images live alongside the source code in the same org
- **Trade-off**: Pulls from GHCR can be slower than Docker Hub in some regions. For a demo app this is negligible.

### Why Uptime Kuma?

**Chosen**: Uptime Kuma over Prometheus/Grafana or Netdata.

- Single container, zero configuration — `docker compose up` and it's running
- Built-in notification channels (email, Telegram, Discord, Slack, etc.)
- Simple HTTP health check monitors — perfectly sufficient for a 3-service stack
- **Trade-off**: No historical metrics or CPU/memory dashboards. For production, Prometheus + Grafana would be better. For this assessment scope, Uptime Kuma answers "is it up?" without 10x the setup effort.

### Why Pino for Logging?

**Chosen**: Pino over Winston or console.log.

- Async by default — never blocks the event loop
- JSON output — natively parseable by log aggregators (Datadog, ELK, etc.)
- `pino-http` provides automatic request/response logging
- No configuration needed — logs to stdout (Docker-native)
- **Trade-off**: JSON logs are less human-readable in terminal. Use `pino-pretty` for dev (`| pino-pretty`).

### Why No ORM?

**Chosen**: Raw `pg` driver over Prisma/TypeORM/Knex.

- Single table TODO app — an ORM adds 5-10MB of dependencies for SQL that's 5 lines
- Direct SQL gives full control over queries and performance
- **Trade-off**: No migration system. For a real app with evolving schema, an ORM or migration tool would be necessary.

### How Secrets Are Handled

- `.env` is gitignored — never committed
- `.env.example` is committed — contains all keys with placeholder values
- CI/CD uses GitHub Actions secrets:
  - `GHCR_TOKEN`: Personal Access Token with `write:packages` scope
  - `DOKPLOY_HOST`, `DOKPLOY_USER`, `DOKPLOY_SSH_KEY`: SSH credentials for deployment
- No secrets baked into Docker images — all secrets passed at runtime via environment variables

### Dev/Prod Parity

**Similarities:**
- Same Docker images in both dev and prod (built from same Dockerfiles)
- Same PostgreSQL version (17-alpine)
- Same environment variable names

**Differences:**

| Aspect | Dev | Prod |
|--------|-----|------|
| Build | `docker compose up --build` | Pulls pre-built images from GHCR |
| Frontend | Vite dev server (HMR, bind mount) | nginx (static files) |
| Backend | `node --watch` (auto-restart) | `node` (no restart) |
| Reverse proxy | None (direct port access) | Caddy (HTTPS, TLS termination) |
| Image source | Local build | GHCR registry |
| .env | `.env` file | `.env` file + CI secrets |

The gap is intentional: dev prioritizes developer experience (hot reload), prod prioritizes stability and security (immutable images, reverse proxy).

## Container Image Strategy

### Frontend Dockerfile (Multi-stage)

```
Stage 1 (build):   node:24.16.0-alpine → npm ci → npm run build → /app/dist
Stage 2 (run):     nginx:1.27-alpine   → copy dist/ + nginx.conf → :80
```

**Why nginx?** A React SPA is static files. Node.js is overhead for serving static assets. nginx is 10x more efficient at this job, and the alpine image is ~25MB.

### Backend Dockerfile (Multi-stage)

```
Stage 1 (deps):    node:24.16.0-alpine → npm ci --omit=dev → /app/node_modules
Stage 2 (run):     node:24.16.0-alpine + tini → copy node_modules + src → :3000
```

**Why tini?** Node.js as PID 1 doesn't handle SIGTERM properly. `tini` is a tiny init (2KB) that ensures signals are forwarded and zombie processes are reaped.

### Image Hygiene

- No secrets in any layer (build args are for versions only)
- `npm cache clean --force` after install to minimize layer size
- `USER node` in backend (non-root, security best practice)
- Alpine base: ~5MB base vs ~150MB for Debian-based images
- Final images expected size: frontend ~35MB, backend ~70MB

## Limitations & Future Improvements

### Known Limitations

1. **No rollback mechanism**: The deploy script always deploys `:latest`. A rollback requires manually tagging a previous SHA and redeploying. A proper solution would maintain release versions and a rollback command.

2. **Single-node deployment**: The stack runs on one VPS. No horizontal scaling, no load balancing. For a demo this is fine; for production you'd want Kubernetes or at least multiple compose hosts.

3. **No database migration system**: The `CREATE TABLE IF NOT EXISTS` in `db.js` works for initial setup but won't handle schema changes. A tool like `node-pg-migrate` or `dbmate` is needed for production.

4. **No structured testing**: The pipeline runs lint but no unit/integration tests. For a real service, you'd add Jest/Supertest for the API and Vitest/Testing Library for the frontend.

5. **Backup script assumes container name**: The backup script uses `docker exec ${COMPOSE_PROJECT}-db-1`. If the Docker Compose project name changes, the container name changes. A more robust approach would use Docker labels or service discovery.

6. **HTTPS depends on Caddy**: The production compose relies on Caddy for Let's Encrypt. This works but requires DNS records pointing to the server. Without a real domain, you'll get TLS errors.

### What I'd Do With More Time

1. **Zero-downtime deployments**: Use a blue/green pattern with an additional reverse proxy layer (or Caddy's `health_uri` directive) to ensure no requests are dropped during restart.

2. **IaC with Terraform**: Provision the VPS, DNS records, and firewall rules via Terraform so the entire infrastructure is reproducible from scratch.

3. **Prometheus + Grafana**: Replace Uptime Kuma with Prometheus for metric collection and Grafana for dashboards, giving deeper insight into request latency, error rates, and resource usage.

4. **Staging environment**: A second compose profile or separate VPS that mirrors prod, triggered on PR branches instead of main.

5. **Docker Compose watch**: Compose v5 supports `docker compose watch` for automatic sync of changed files. This would improve the dev experience over bind mounts.

## PDF Generation Note

This document is the source for the 2-4 page PDF deliverable. Convert to PDF via:

```bash
# Using pandoc (requires LaTeX):
pandoc ARCHITECTURE.md -o ARCHITECTURE.pdf --pdf-engine=xelatex

# Using VS Code: right-click → Markdown PDF
# Or any other markdown-to-PDF converter
```
