#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Definicion de compareScans() ==="
grep -rn "compareScans" src/ server.ts

echo ""
echo "=== Contexto de la funcion (si esta en server.ts) ==="
grep -n "function compareScans" -A 30 server.ts 2>/dev/null

echo ""
echo "=== Tabla scan_history / campos de timestamp ==="
grep -n "scan_history\|created_at\|createdAt" server.ts | head -20
