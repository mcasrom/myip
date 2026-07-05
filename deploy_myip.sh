#!/bin/bash
# deploy_myip.sh
# Pipeline completo de deploy para myip:
#   1. Verifica que no haya secretos a punto de subirse
#   2. tsc --noEmit + build local (falla rapido, antes de tocar nada remoto)
#   3. Exige git status limpio (nada de commits automaticos a ciegas)
#   4. git push a GitHub
#   5. SSH al server: git pull + docker compose build + up
#   6. Healthcheck real post-deploy
#
# Uso: ./deploy_myip.sh
# Uso (saltando confirmaciones interactivas): ./deploy_myip.sh --yes

set -euo pipefail

SERVER="deploy@178.105.80.193"
REMOTE_PATH="/home/deploy/myip"
HEALTHCHECK_URL="https://myip.viajeinteligencia.com/api/ip/detect"
AUTO_YES=false
[ "${1:-}" = "--yes" ] && AUTO_YES=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}==>${NC} $1"; }
warn()  { echo -e "${YELLOW}!!${NC} $1"; }
fail()  { echo -e "${RED}XX${NC} $1"; exit 1; }

confirm() {
  $AUTO_YES && return 0
  read -rp "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

cd "$(dirname "$0")"

# ------------------------------------------------------------------
# 1. Guardarrail: nada sensible a punto de commitear/pushear
# ------------------------------------------------------------------
info "Verificando que no haya secretos trackeados..."
if git ls-files | grep -qE '^\.env$|rockyou\.txt$|rockyou-bloom\.json$|\.sqlite3$'; then
  fail "Hay un archivo sensible TRACKEADO en git (.env, rockyou.txt, .sqlite3...). Revisa .gitignore antes de continuar."
fi
if git status --porcelain | grep -qE '\.env|rockyou\.txt|rockyou-bloom\.json'; then
  fail "Hay cambios pendientes sobre un archivo sensible. Revisa antes de continuar."
fi
info "OK: sin secretos a la vista."

# ------------------------------------------------------------------
# 2. Verificacion local: tipos + build (falla rapido, sin tocar nada remoto)
# ------------------------------------------------------------------
info "Ejecutando tsc --noEmit..."
npx tsc --noEmit || fail "tsc --noEmit encontro errores. Corrige antes de desplegar."

info "Ejecutando build local (npm run build)..."
npm run build || fail "El build local fallo. Corrige antes de desplegar."

info "Build local OK."

# ------------------------------------------------------------------
# 3. Exigir git status limpio (nada de commits automaticos a ciegas)
# ------------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  warn "Hay cambios sin commitear:"
  git status --short
  fail "Commitea o descarta los cambios antes de desplegar (no se commitea automaticamente)."
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "main" ] || fail "No estas en main (estas en '$CURRENT_BRANCH'). Cambia de rama antes de desplegar."

LOCAL_HASH="$(git rev-parse HEAD)"
info "Working tree limpio. HEAD local: ${LOCAL_HASH:0:7}"

# ------------------------------------------------------------------
# 4. Push a GitHub
# ------------------------------------------------------------------
confirm "¿Hacer push a origin/main?" || fail "Deploy cancelado por el usuario."
info "Pusheando a GitHub..."
git push origin main

# ------------------------------------------------------------------
# 5. Deploy remoto: pull + rebuild Docker
# ------------------------------------------------------------------
info "Conectando al server para hacer pull + rebuild..."
ssh "$SERVER" bash -s << ENDSSH
set -euo pipefail
cd "$REMOTE_PATH"

echo "==> git status en server antes de pull:"
git status --short

if [ -n "\$(git status --porcelain)" ]; then
  echo "XX Hay cambios sin commitear en el SERVER. Abortando para no perder trabajo."
  echo "   Resuelve manualmente (commit o restore) antes de reintentar el deploy."
  exit 1
fi

echo "==> Pulling..."
git pull origin main

echo "==> Verificando .env sigue presente (nunca viaja por git)..."
[ -f .env ] || { echo "XX .env no existe en el server. Deploy detenido, no arranques sin configuracion."; exit 1; }

echo "==> Rebuild + restart Docker..."
docker compose build
docker compose up -d

echo "==> Esperando arranque..."
sleep 5
docker compose ps
ENDSSH

# ------------------------------------------------------------------
# 6. Healthcheck real post-deploy
# ------------------------------------------------------------------
info "Verificando healthcheck en $HEALTHCHECK_URL ..."
sleep 3
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL" || echo "000")"

if [ "$HTTP_CODE" = "200" ]; then
  info "Deploy OK. Healthcheck respondio 200."
else
  warn "Healthcheck devolvio HTTP $HTTP_CODE (esperado 200)."
  warn "Revisa logs: ssh $SERVER 'docker logs myip-server --tail 50'"
  exit 1
fi

info "Deploy completo. Server, GitHub y local alineados en ${LOCAL_HASH:0:7}."
