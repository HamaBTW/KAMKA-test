# PROJECT MAP — TODO App Infrastructure

## TECH_STACK

| Component | Technology | Version | Docker Image |
|-----------|-----------|---------|--------------|
| Runtime | Node.js (LTS "Krypton") | 24.16.0 | `node:24.16.0-alpine3.23` |
| Frontend | React | 19.2.7 | Built from `frontend/Dockerfile` |
| Backend | Express | 4.22.2 | Built from `backend/Dockerfile` |
| Database | PostgreSQL | 17.10 | `postgres:17-alpine` |
| Container Orchestration | Docker Compose | 5.1.4 | Compose Specification (no version field) |
| CI/CD | GitHub Actions | N/A | `ubuntu-latest` runner |
| Registry | GitHub Container Registry | N/A | `ghcr.io/mohamed/*` |
| Monitoring | Uptime Kuma | 2.4.0 | `louislam/uptime-kuma:2.4.0` |
| Logging | Pino | latest | Async, JSON, stdout |
| Deployment | Dokploy | N/A | Self-hosted VPS |

## SYSTEM_FLOW

```
[Dev Push] → GitHub → GitHub Actions → GHCR → Dokploy VPS
                                                 ↓
┌──────────────────────────────────────────────────────┐
│  Browser → Frontend (React :5173)                     │
│               ↓                                       │
│  Caddy reverse-proxy (:80/:443) → Backend API (:3000) │
│                                      ↓                 │
│                                   PostgreSQL (:5432)    │
│                                      ↓                 │
│                              Health: GET /health        │
└──────────────────────────────────────────────────────┘
                                      ↑
                              Uptime Kuma (:3001)
                              monitors all /health endpoints
```

### Change Flow (git push → production)
1. `git push` → triggers `.github/workflows/ci-cd.yml`
2. **Test**: `npm run lint` (frontend + backend) — fails loudly
3. **Build**: Multi-stage Docker builds → tagged `:latest` + `:${{ github.sha }}`
4. **Push**: Images pushed to `ghcr.io/mohamed/todo-{frontend,backend}`
5. **Deploy**: SSH into Dokploy VPS → `deploy.sh` pulls new images, restarts stack
6. **Monitor**: Uptime Kuma polls `/health` every 60s

## ARCHITECTURE

### Directory Structure
```
todo-app/
├── .github/workflows/       # CI/CD pipeline
│   └── ci-cd.yml
├── frontend/                # React SPA (Vite)
│   ├── Dockerfile           # Multi-stage: build + nginx/alpine serve
│   ├── nginx.conf           # Prod nginx config
│   ├── eslint.config.js     # Flat ESLint config
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── App.jsx
│       └── main.jsx
├── backend/                 # Express REST API
│   ├── Dockerfile           # Multi-stage: install + run
│   ├── package.json
│   └── src/
│       ├── index.js         # Express app, /health, /api/*
│       ├── db.js            # PostgreSQL connection pool (pg)
│       └── routes/
│           └── todos.js     # CRUD for todos
├── scripts/
│   ├── deploy.sh            # Safe pull-and-restart
│   └── backup.sh            # pg_dump to timestamped file
├── monitoring/
│   └── uptime-kuma/
│       └── compose.monitoring.yaml  # Standalone Uptime Kuma stack
├── compose.yaml             # Dev (hot-reload, bind mounts)
├── compose.dokploy.yaml     # Production (for Dokploy deployment)
├── .env.example             # Committed template
├── .gitignore               # .env, node_modules, etc.
├── PROJECT_MAP.md
└── README.md
```

### Container Architecture
- **Frontend**: Built with Vite, multi-stage: `node:alpine` build → `nginx:alpine` serve (static files)
- **Backend**: Multi-stage: `node:alpine` install prod deps → `node:alpine` run with `tini` init
- **Database**: Official `postgres:17-alpine` with healthcheck, persistent volume
- **Monitoring**: `louislam/uptime-kuma:2.4.0` with persistent volume

### Key Decisions
- **No top-level `version`** in compose files (obsolete in Compose Specification)
- **Multi-stage builds** to keep final images < 50MB each
- **Pino** for async JSON logging (no file I/O, Docker-native stdout)
- **PG** driver (not ORM) — minimal dependency, SQL is fine for a TODO
- **Dokploy** handles reverse-proxy + HTTPS via built-in Traefik (no separate Caddy needed)
- **Env vars** sourced from `.env` (gitignored), `.env.example` committed

## ORPHANS & PENDING
- All core deliverables implemented. ARCHITECTURE.md written (PDF source — convert via pandoc or Markdown-to-PDF tool).
