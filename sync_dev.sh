#!/bin/bash
# sync_dev.sh
#
# Sync RAPIDO por rsync hacia Hetzner, para iterar en desarrollo SIN pasar
# por commit+push (eso es lo que hace deploy_myip.sh, y sigue siendo el
# camino oficial para releases reales).
#
# Este script NO hace git push, NO verifica working tree limpio, y NO
# hace pull en el server: solo copia archivos y reconstruye el contenedor.
# Usalo solo para probar cambios rapido; cuando quede bien, commitea y
# usa ./deploy_myip.sh para el deploy real (deja server/git/local alineados).
#
# Uso: ./sync_dev.sh

set -euo pipefail

SERVER="deploy@178.105.80.193"
REMOTE_PATH="/home/deploy/myip"
HEALTHCHECK_URL="https://myip.viajeinteligencia.com/api/ip/detect"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}==>${NC} $1"; }
warn()  { echo -e "${YELLOW}!!${NC} $1"; }
fail()  { echo -e "${RED}XX${NC} $1"; exit 1; }

cd "$(dirname "$0")"

# ------------------------------------------------------------------
# 1. Verificacion local rapida (falla antes de tocar nada remoto)
# ------------------------------------------------------------------
info "Ejecutando tsc --noEmit..."
npx tsc --noEmit; echo "Exit code: $?"

info "Ejecutando build local (npm run build)..."
npm run build || fail "El build local fallo. Corrige antes de sincronizar."

# ------------------------------------------------------------------
# 2. rsync con exclusiones (evita rockyou.txt, .bak*, node_modules, etc.)
# ------------------------------------------------------------------
info "Sincronizando con $SERVER:$REMOTE_PATH ..."
rsync -avz --partial --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'scripts/rockyou.txt' \
  --exclude 'scripts/*.pkl' \
  --exclude '*.bak' \
  --exclude '*.bak.*' \
  --exclude '*.bak_*' \
  --exclude '*.log' \
  --exclude '*.sqlite3' \
  --exclude '*.sqlite3-*' \
  . "$SERVER:$REMOTE_PATH/" || fail "rsync fallo. Revisa red/espacio en disco en el server."

info "Sync OK."

# ------------------------------------------------------------------
# 3. Rebuild + restart del contenedor (disciplina de nombres: servicio=myip)
# ------------------------------------------------------------------
info "Reconstruyendo contenedor en el server (docker compose)..."
ssh "$SERVER" "cd $REMOTE_PATH && docker compose up -d --build myip"

# ------------------------------------------------------------------
# 4. Healthcheck real
# ------------------------------------------------------------------
info "Esperando arranque y verificando healthcheck..."
sleep 5
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL" || echo "000")"

if [ "$HTTP_CODE" = "200" ]; then
  info "Sync completo. Healthcheck respondio 200."
  warn "Recuerda: esto NO ha pasado por git. Cuando el cambio quede bien," \
       " commitea y corre ./deploy_myip.sh para dejar server/git/local alineados."
else
  warn "Healthcheck devolvio HTTP $HTTP_CODE (esperado 200)."
  warn "Revisa logs: ssh $SERVER 'docker logs myip-server --tail 50'"
  exit 1
fi
