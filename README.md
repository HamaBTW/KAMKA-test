# TODO App — Infrastructure Demo

A minimal three-tier TODO application with containerization, CI/CD, monitoring, and production-ready deployment.

## Quick Start (Development)

```bash
cp .env.example .env
docker compose up -d
# open http://localhost:5173
```

The dev stack includes hot-reload for both frontend (Vite HMR) and backend (Node `--watch`).

## Architecture

```
Browser → Frontend (React/Vite :5173)
             ↓
         Backend (Express :3000)
             ↓
         PostgreSQL (:5432)
```

Each service exposes a health endpoint.

## Services

| Service | Tech | Dev Port | Health Check |
|---------|------|----------|-------------|
| Frontend | React 19 + Vite | 5173 | `localhost:5173` |
| Backend | Express 4 + Pino | 3000 | `GET /health` |
| Database | PostgreSQL 17 | 5432 | `pg_isready` |

## Compose Files — Which One to Use

| File | When | Build | Ports |
|------|------|-------|-------|
| `compose.yaml` | **Local dev** | Local build, bind mounts, hot-reload | 5173, 3000 |
| `compose.dokploy.yaml` | **Production (Dokploy)** | Pulls pre-built images from GHCR | 80 (frontend) |

For Dokploy: the built-in Traefik reverse proxy handles HTTPS + domain routing.

## CI/CD Pipeline

On push to `main`:
1. **Lint** — `standard` (backend) + `eslint` (frontend)
2. **Build & Push** — multi-stage Docker images to GHCR (`ghcr.io/$USER/todo-{frontend,backend}`)
3. **Deploy** — Dokploy auto-detects the push and redeploys

> Only `GHCR_TOKEN` needed as a GitHub secret.

## Production Deployment (Dokploy)

1. In Dokploy dashboard, create a new project → link `HamaBTW/KAMKA-test`
2. Set compose file to `compose.dokploy.yaml`
3. Set environment variables:
   ```
   GHCR_USERNAME=hamabtw
   DB_NAME=todo
   DB_USER=todo
   DB_PASSWORD=<pick one>
   ```
4. Set your domain in Dokploy's UI (under the frontend service → Domains)
5. Deploy

Dokploy handles HTTPS certificates automatically.

## Monitoring (Uptime Kuma)

Deploy via Dokploy as a separate project:
1. New project → link `HamaBTW/KAMKA-test`
2. Compose file: `monitoring/uptime-kuma/compose.monitoring.yaml`
3. Set domain (e.g., `status.yourdomain.com`), container port `3001`
4. Deploy

After setup, add monitors:
| Monitor | URL | Type |
|---------|-----|------|
| Backend API | `https://yourdomain.com/health` | HTTP(s) |
| Frontend | `https://yourdomain.com` | HTTP(s) |

Each monitor checks every 60s and alerts on failure.

## Scripts

```bash
./scripts/deploy.sh       # Pull latest images, restart stack
./scripts/backup.sh       # pg_dump → ./backups/todo_db_<timestamp>.sql.gz
```

Both use `set -euo pipefail` and validate `.env` exists.

## Secrets

- `.env` is gitignored — never committed
- `.env.example` is committed with placeholder values
- `GHCR_TOKEN` goes in GitHub repo Settings → Secrets → Actions

## Project Structure

```
├── .github/workflows/ci-cd.yml           # CI/CD pipeline
├── compose.yaml                          # Dev (hot-reload, bind mounts)
├── compose.dokploy.yaml                  # Production (for Dokploy)
├── backend/
│   ├── Dockerfile                        # Multi-stage: deps → prod (+ tini)
│   ├── src/index.js                      # Express + /health
│   ├── src/db.js                         # PostgreSQL pool
│   └── src/routes/todos.js               # CRUD
├── frontend/
│   ├── Dockerfile                        # Multi-stage: deps → build → nginx
│   ├── nginx.conf
│   └── src/App.jsx                       # TODO UI
├── scripts/
│   ├── deploy.sh                         # Safe pull-and-restart
│   └── backup.sh                         # pg_dump
├── monitoring/uptime-kuma/
│   └── compose.monitoring.yaml           # Uptime Kuma
├── .env.example
├── .gitignore
├── PROJECT_MAP.md
├── ARCHITECTURE.md
└── README.md
```
