#!/bin/bash
# inspect_score.sh - localiza dónde vive el Security Score hoy

cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Buscando 'score' en frontend (src/) ==="
grep -rn -i "score" src/ --include="*.tsx" --include="*.ts" -B1 -A1

echo ""
echo "=== Buscando 'score' en server.ts ==="
grep -n -i "score" server.ts -B1 -A1

echo ""
echo "=== Estructura de App.tsx (líneas con JSX de resultado/scan) ==="
grep -n -i -E "securityScore|scanResult|scan_result" src/App.tsx

echo ""
echo "=== Últimas líneas relevantes cerca de línea 795 (contexto RRSS ya conocido) ==="
sed -n '780,810p' src/App.tsx
