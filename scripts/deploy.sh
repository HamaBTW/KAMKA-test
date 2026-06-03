#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

export $(grep -v '^#' .env | xargs)

echo "Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull

echo "Recreating services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "Pruning unused images..."
docker image prune -f

echo "Deployment complete."
