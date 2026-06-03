# TODO App — Infrastructure Demo

A minimal three-tier TODO application with containerization, CI/CD, monitoring, and production-ready deployment.

## Quick Start (Development)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start the stack
docker compose up -d

# 3. Open in browser
open http://localhost:5173
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

Each service exposes a health endpoint. The CI/CD pipeline builds, pushes, and deploys on every push to `main`.

## Services

| Service | Tech | Dev Port | Health Check |
|---------|------|----------|-------------|
| Frontend | React 19 + Vite | 5173 | `localhost:5173` |
| Backend | Express 4 + Pino | 3000 | `GET /health` |
| Database | PostgreSQL 17 | 5432 | `pg_isready` |

## CI/CD Pipeline

On push to `main`:
1. **Lint** — `standard` (backend) + `eslint` (frontend)
2. **Build & Push** — multi-stage Docker images to GHCR (`ghcr.io/$USER/todo-{frontend,backend}`)
3. **Deploy** — SSH into Dokploy VPS, pull images, restart stack

## Production Deployment

```bash
# On the production server:
cp .env.example .env
# Fill in DB_NAME, DB_USER, DB_PASSWORD
docker compose -f compose.prod.yaml up -d
```

Compose.prod.yaml differs from dev:
- No bind mounts (immutable images)
- Caddy reverse-proxy with auto HTTPS (update Caddyfile with your domain)
- No hot-reload

## Monitoring

```bash
docker compose -f monitoring/uptime-kuma/compose.monitoring.yaml up -d
# Open http://localhost:3001
```

Add monitors for:
- `http://localhost:3000/health` (backend)
- `http://localhost:5173` or `http://localhost:80` (frontend in prod)
- `pg_isready` (database — via Docker health check or TCP monitor)

## Scripts

```bash
# Deploy latest images (from GHCR)
COMPOSE_FILE=compose.prod.yaml ./scripts/deploy.sh

# Backup database
./scripts/backup.sh     # outputs ./backups/todo_db_<timestamp>.sql.gz
```

Both scripts use `set -euo pipefail` and validate that `.env` exists.

## Secrets

- Never commit `.env` (it's gitignored)
- Commit `.env.example` with placeholder values
- In CI/CD, use GitHub Actions secrets:
  - `GHCR_TOKEN` — PAT with `write:packages` scope
  - `DOKPLOY_HOST`, `DOKPLOY_USER`, `DOKPLOY_SSH_KEY`

## Project Structure

```
├── .github/workflows/ci-cd.yml       # CI/CD pipeline
├── frontend/                          # React SPA
│   ├── Dockerfile                     # Multi-stage: build → nginx
│   ├── nginx.conf
│   ├── src/App.jsx
│   └── src/main.jsx
├── backend/                           # Express API
│   ├── Dockerfile                     # Multi-stage: deps → tini run
│   ├── src/index.js                   # Server + /health
│   ├── src/db.js                      # PostgreSQL pool
│   └── src/routes/todos.js            # CRUD
├── scripts/
│   ├── deploy.sh                      # Safe pull-and-restart
│   └── backup.sh                      # pg_dump with cleanup
├── monitoring/uptime-kuma/
│   └── compose.monitoring.yaml        # Uptime Kuma stack
├── compose.yaml                       # Dev profile
├── compose.prod.yaml                  # Production profile (+Caddy)
├── Caddyfile                          # Reverse-proxy config
├── .env.example
├── .gitignore
└── README.md
```
