#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  exit 1
fi

export $(grep -v '^#' .env | xargs)

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="$BACKUP_DIR/todo_db_$TIMESTAMP.sql"

echo "Backing up database to $FILENAME..."

docker exec "${COMPOSE_PROJECT:-todo}"-db-1 pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  > "$FILENAME"

gzip "$FILENAME"

echo "Backup complete: ${FILENAME}.gz"
echo "To restore: gunzip -c ${FILENAME}.gz | docker exec -i ${COMPOSE_PROJECT:-todo}-db-1 psql -U $DB_USER -d $DB_NAME"
