#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Cuerpo completo de compareScans() ==="
sed -n '55,110p' alerts.ts

echo ""
echo "=== Que devuelve /api/scan/history completo ==="
sed -n '1192,1206p' server.ts

echo ""
echo "=== Import de alerts.ts en server.ts (para saber si podemos reusar compareScans) ==="
grep -n "from './alerts'\|require.*alerts" server.ts
