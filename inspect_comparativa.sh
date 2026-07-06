#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Esquema de la tabla scan_history ==="
grep -n "CREATE TABLE.*scan_history" -A 15 db.ts

echo ""
echo "=== Cuantos registros hay actualmente en produccion ==="
ssh deploy@178.105.80.193 "docker exec myip-server sqlite3 /app/data/*.db 'SELECT COUNT(*) FROM scan_history;'" 2>/dev/null || echo "(ajustar ruta de la DB si falla)"

echo ""
echo "=== Distribucion de scoreNumeric si existe la columna ==="
grep -n "scoreNumeric\|score_numeric" db.ts server.ts | head -10
