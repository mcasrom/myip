#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(pwd)"
OUT() { echo -e "\n### $1"; }
echo "===== DIAGNOSTICO MYIP ====="
echo "Fecha: $(date -Iseconds)"
echo "Directorio: $PROJECT_DIR"

OUT "1. Estructura del proyecto (2 niveles, sin node_modules/venv)"
find . -maxdepth 2 -not -path "*/node_modules*" -not -path "*/.git*" -not -path "*/venv*" -not -path "*/__pycache__*" | sort

OUT "2. Stack detectado"
[ -f package.json ] && echo "- Node.js: $(grep -m1 '"name"' package.json || true)"
[ -f requirements.txt ] && echo "- Python (requirements.txt presente)"
[ -f pyproject.toml ] && echo "- Python (pyproject.toml presente)"
[ -f composer.json ] && echo "- PHP (composer.json presente)"
[ -f go.mod ] && echo "- Go (go.mod presente)"
[ -f docker-compose.yml ] && echo "- docker-compose.yml presente"
[ -f Dockerfile ] && echo "- Dockerfile presente"

OUT "3. Archivos .env detectados (SOLO NOMBRES, no contenido)"
find . -maxdepth 3 -iname "*.env*" -not -path "*/node_modules*" -not -path "*/.git*" | sort

OUT "4. Variables definidas en .env (SOLO CLAVES, valores ocultos)"
if [ -f .env ]; then
  grep -v '^\s*#' .env | grep '=' | cut -d '=' -f1 | sed 's/^/  - /'
else
  echo "  (no hay .env en la raiz)"
fi

OUT "5. .gitignore actual"
[ -f .gitignore ] && cat .gitignore || echo "  (NO EXISTE .gitignore -- riesgo de subir secretos)"

OUT "6. Estado de git"
git status --short 2>/dev/null || echo "  (no es un repo git o no esta inicializado)"

OUT "7. Remoto configurado"
git remote -v 2>/dev/null || true

OUT "8. Archivos actualmente trackeados que parecen sensibles"
git ls-files 2>/dev/null | grep -iE '\.env|secret|key|token|password|credentials' || echo "  (ninguno encontrado, bien)"

OUT "9. Ultimos 10 commits"
git log --oneline -10 2>/dev/null || true

OUT "10. Dependencias con vulnerabilidades conocidas (si aplica)"
if [ -f package.json ] && command -v npm >/dev/null; then
  npm audit --omit=dev 2>&1 | tail -20 || true
fi
if [ -f requirements.txt ] && command -v pip >/dev/null; then
  echo "(instala pip-audit si quieres chequeo automatico: pip install pip-audit)"
fi

OUT "11. Endpoints/rutas de auth y registro detectados (grep heuristico)"
grep -rniE 'register|signup|sign-up|login|auth' --include="*.js" --include="*.ts" --include="*.py" --include="*.php" -l . 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -30

OUT "12. Uso de CAPTCHA / rate limiting / verificacion email (grep heuristico)"
grep -rniE 'captcha|recaptcha|rate.?limit|throttle|verify.?email|email.?verif' --include="*.js" --include="*.ts" --include="*.py" --include="*.php" . 2>/dev/null | grep -v node_modules | grep -v "\.git/" | head -30

OUT "13. Puertos y procesos relacionados (PM2 si existe)"
command -v pm2 >/dev/null && pm2 list 2>/dev/null || echo "  (pm2 no encontrado o no aplica)"

echo -e "\n===== FIN DIAGNOSTICO ====="
