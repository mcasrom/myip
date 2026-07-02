#!/usr/bin/env bash
# backup_myip_db.sh
# Backup rotativo de myip.sqlite3 (safe con WAL activo, no requiere parar el server).
# Uso: ./backup_myip_db.sh
# Cron sugerido (diario 03:00): 0 3 * * * /home/miguel/myip/backup_myip_db.sh >> /home/miguel/myip/backup.log 2>&1

set -euo pipefail

DB_PATH="$(dirname "$0")/myip.sqlite3"
BACKUP_DIR="$(dirname "$0")/backups"
KEEP_DAYS=14
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/myip_${STAMP}.sqlite3"

if [ ! -f "$DB_PATH" ]; then
  echo "[$(date)] ERROR: no existe $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# sqlite3 .backup es online y consistente aunque haya WAL activo o conexiones abiertas
sqlite3 "$DB_PATH" ".backup '$DEST'"

# comprimir para no acumular espacio
gzip -f "$DEST"

# rotacion: borrar backups mas viejos de KEEP_DAYS
find "$BACKUP_DIR" -name "myip_*.sqlite3.gz" -mtime +"$KEEP_DAYS" -delete

echo "[$(date)] Backup OK: ${DEST}.gz"
