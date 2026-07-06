#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }
echo "=== Bloque de guardado del escaneo (contexto amplio) ==="
sed -n '1165,1190p' server.ts
echo ""
echo "=== Metodos disponibles en authDb relacionados a historial ==="
grep -n "getScanHistory\|saveScanRecord\|function get.*Scan" authDb.ts 2>/dev/null || grep -rn "getScanHistory\|saveScanRecord" *.ts | grep -v node_modules
