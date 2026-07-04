#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/data/myip.sqlite3" ]; then
  DB_PATH="$SCRIPT_DIR/data/myip.sqlite3"
else
  DB_PATH="$SCRIPT_DIR/myip.sqlite3"
fi
BACKUP_DIR="$SCRIPT_DIR/backups"
KEEP_DAYS=14
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/myip_${STAMP}.sqlite3"

if [ ! -f "$DB_PATH" ]; then
  echo "[$(date)] ERROR: no existe $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup '$DEST'"
gzip -f "$DEST"

find "$BACKUP_DIR" -name "myip_*.sqlite3.gz" -mtime +"$KEEP_DAYS" -delete

echo "[$(date)] Backup OK: ${DEST}.gz"
