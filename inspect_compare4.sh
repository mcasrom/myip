#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Cuerpo COMPLETO de compareScans (funcion + cierre) ==="
awk '/^function compareScans/,/^}/' alerts.ts

echo ""
echo "=== Exports de alerts.ts ==="
grep -n "^export" alerts.ts

echo ""
echo "=== Tiers de usuario (para saber quien tiene historial) ==="
grep -n "isPremium\|tier ===" server.ts | head -10
